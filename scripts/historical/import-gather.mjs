#!/usr/bin/env node
// import-gather.mjs — a reviewed gather edition (official_sources) into the
// repo's source sheet, ledger and visual-review manifest.
//
//   node scripts/historical/import-gather.mjs <edition-id> <gather-dir>
//
// <gather-dir> is the research folder for one edition, kept outside the
// repo. It holds:
//   sheet.tsv      one row per printed set: day, date, stage, start, end,
//                  artist, source_kind, source_ref, note
//   receipts.json  the edition's sources, each with its receipt:
//     page    { kind, match, url, captureTimestamp, printed: {day: tab} }
//             re-read here through wayback.mjs and re-parsed with the
//             Insomniac parser; the rows must equal the sheet's, row for row
//     graphic { kind, match, file, imageUrl, foundAt, published, rehostedBy,
//               fetchedAt, printed: {day: header}, stageAs?, when?, review }
//             the local file's sha256 is what the ledger and review record.
//             Its receipt is a Wayback capture of `foundAt` that cites the
//             image (citeToken); the earliest such capture is recorded
//   plus `exclude` (note patterns for printed rows that are not the
//   edition's, e.g. a pre-event slot the final page re-filled) and
//   `reviewedAt`.
//
// Every sheet row must belong to exactly one source. Nothing is fetched from
// a non-Wayback host and no image enters the repo: only public URLs, hashes
// and counts. Local file names and folder paths stay in the gather folder.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture, listCaptures } from "./wayback.mjs";
import { citeToken } from "./lib.mjs";
import { parseDay } from "../fetch-insomniac-settimes.mjs";
import { sheetRow } from "./extract-insomniac.mjs";
import { readSheet } from "./build-editions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sha256 = buf => createHash("sha256").update(buf).digest("hex");
const rowKey = r => [r.day, r.stage, r.start, r.end, r.artist].join("|");

// The public review label: who checked the pixels and how, never a session.
export const REVIEWER = "Plursky history review (Claude Plur): Vision OCR cross-check and by-eye reading on 2x crops";

// The earliest Wayback capture of the page a graphic was found on that cites
// the graphic: the proof that the re-host's page carried this image.
async function receiptFor(s) {
  const token = citeToken(s.imageUrl);
  for (const c of await listCaptures(s.foundAt, "2010", "2026")) {
    const cap = await fetchCapture(c.timestamp, s.foundAt);
    if (cap.text.includes(token)) return { archivedUrl: cap.archivedUrl, captureTimestamp: cap.captureTimestamp, sha256: cap.sha256, cites: token };
  }
  throw new Error(`${s.foundAt}: no archived capture cites ${token}`);
}

// stageAs: a string renames every row of a source (a separately printed
// section); a map carries a graphic's styled stage name onto the edition's
// other printing, only where the two differ by case and spacing alone
// (Orlando 2023's "kineticFIELD" graphic beside its "Kinetic Field" pages).
export function stageFor(s, printed) {
  if (typeof s.stageAs === "string") return s.stageAs;
  const as = s.stageAs?.[printed];
  if (!as) return printed;
  const fold = x => x.replace(/\s+/g, "").toLowerCase();
  if (fold(as) !== fold(printed)) throw new Error(`stageAs "${printed}" → "${as}" is not the same name: only case and spacing may differ`);
  return as;
}

// The day a set-times capture shows is its active day tab. The page's
// _siteTranslations carry other years' dates (Orlando 2024's Feb 2025
// captures print 2025's), so only the tab counts.
export const activeTab = html => /class="[^"]*button-blocks--active[^"]*"[^>]*>([^<]+)</.exec(html)?.[1].trim();

export async function importGather(id, dir) {
  const ed = EDITIONS[id];
  if (!ed || ed.method !== "official_sources") throw new Error(`${id} is not an official_sources edition`);
  const rc = JSON.parse(readFileSync(join(dir, "receipts.json"), "utf8"));
  if (rc.id !== id) throw new Error(`receipts.json is for ${rc.id}, not ${id}`);
  const rows = readSheet(join(dir, "sheet.tsv"));
  const excluded = [], bySource = new Map(rc.sources.map((s, i) => [i, []]));

  for (const r of rows) {
    const date = ed.dates[+r.day - 1]?.[0];
    if (r.date !== date) throw new Error(`row ${r.artist}: day ${r.day} is ${r.date}, the edition says ${date}`);
    const ex = (rc.exclude || []).find(x => new RegExp(x.note).test(r.note || ""));
    if (ex) { excluded.push({ day: +r.day, stage: r.stage, start: r.start, end: r.end, billing: r.artist, reason: ex.reason }); continue; }
    const hits = rc.sources.map((s, i) => [s, i]).filter(([s]) => (r.source_ref || "").includes(s.match)
      && (!s.when?.stage || new RegExp(s.when.stage).test(r.stage)) && (!s.when?.stageNot || !new RegExp(s.when.stageNot).test(r.stage)));
    if (hits.length !== 1) throw new Error(`row d${r.day} ${r.stage} ${r.start} ${r.artist}: ${hits.length} sources match its source_ref`);
    const [s, i] = hits[0];
    if (!r.start || !r.end) throw new Error(`row ${r.artist}: blank time (no openEnd convention for gather rows yet)`);
    bySource.get(i).push({ day: +r.day, stage: stageFor(s, r.stage), start: r.start, end: r.end, artist: r.artist, source: s.match, note: r.note || "" });
  }

  const ledgerDays = ed.dates.map(([date], i) => ({ day: i + 1, date, sources: [] }));
  const reviewDays = [], out = [];
  for (const [i, s] of rc.sources.entries()) {
    const got = bySource.get(i);
    const days = [...new Set(got.map(r => r.day))].sort();
    if (!days.length) throw new Error(`source ${s.match} contributes no rows`);
    if (s.kind === "page") {
      const cap = await fetchCapture(s.captureTimestamp, s.url);
      if (cap.captureTimestamp !== s.captureTimestamp) throw new Error(`${s.url}: Wayback served ${cap.captureTimestamp}, not ${s.captureTimestamp}`);
      if (days.length !== 1) throw new Error(`page ${s.match} is cited for ${days.length} days; a set-times page shows one`);
      const day = days[0];
      // The receipt's day tab is what the page itself shows as the active tab,
      // not the page's script data (Orlando 2024's _siteTranslations carry 2025).
      const tab = activeTab(cap.text);
      if (tab !== s.printed[day]) throw new Error(`${s.url} @${s.captureTimestamp}: the active day tab prints "${tab}", the receipt says "${s.printed[day]}"`);
      const parsed = parseDay(cap.text).map(x => sheetRow(day, x)).map(x => ({ day, stage: x.stage, start: x.start, end: x.end, artist: x.artist }));
      const want = got.map(rowKey).sort(), have = parsed.map(rowKey).sort();
      const missing = want.filter(k => !have.includes(k)), extra = have.filter(k => !want.includes(k));
      if (missing.length || extra.length) throw new Error(`${s.archivedUrl || s.url}: the archived page and the reviewed sheet disagree\n  sheet only: ${missing.join("\n  ")}\n  page only: ${extra.join("\n  ")}`);
      ledgerDays[day - 1].sources.push({ kind: "page", url: s.url, archivedUrl: cap.archivedUrl, captureTimestamp: cap.captureTimestamp,
        printed: s.printed[day], sha256: cap.sha256, bytes: cap.bytes, rows: got.length });
      out.push(...got.map(r => ({ ...r, source: `page ${cap.captureTimestamp}` })));
    } else if (s.kind === "graphic") {
      const buf = readFileSync(join(dir, s.file)), hash = sha256(buf), receipt = await receiptFor(s);
      for (const day of days) {
        const n = got.filter(r => r.day === day).length;
        ledgerDays[day - 1].sources.push({ kind: "graphic", imageUrl: s.imageUrl, foundAt: s.foundAt, published: s.published,
          rehostedBy: s.rehostedBy, fetchedAt: s.fetchedAt, printed: s.printed[day], sha256: hash, bytes: buf.length, rows: n, receipt,
          ...(s.stageAs && typeof s.stageAs === "object" && { stagesAs: s.stageAs }) });
        const rv = s.review || {};
        const onDay = l => (l || []).filter(x => x.startsWith(`d${day} `));
        reviewDays.push({ day, date: ed.dates[day - 1][0], sha256: hash, imageUrl: s.imageUrl, reviewer: REVIEWER, reviewedAt: rc.reviewedAt,
          rowsConfirmed: n, note: `Header read off the graphic: ${s.printed[day]}`,
          method: "every row checked against the graphic: Vision OCR of the whole graphic at 1x and 2x matched each billing and its printed range; every row OCR could not match on both was read by eye on a 2x crop",
          ocrMatchedBoth: n - onDay(rv.byEye).length, byEye: onDay(rv.byEye),
          printedReadings: got.filter(r => r.day === day && /PRINTED|sic/i.test(r.note)).map(r => `${r.artist}: ${r.note}`) });
      }
      out.push(...got.map(r => ({ ...r, source: `graphic ${hash.slice(0, 12)}` })));
    } else throw new Error(`source ${s.match}: kind ${s.kind}`);
  }

  // Sheet order: day, then stage as first printed, then start on the festival night.
  const night = t => { const [h, m] = t.split(":").map(Number); return (h < ed.rolloverHour ? h + 24 : h) * 60 + m; };
  const stageOrder = [...new Set(out.map(r => r.stage))];
  out.sort((a, b) => a.day - b.day || stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage) || night(a.start) - night(b.start));
  const cols = ["day", "stage", "start", "end", "artist", "openEnd", "source"];
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.tsv`), [cols.join("\t"), ...out.map(r => cols.map(c => r[c] ?? "").join("\t"))].join("\n") + "\n");
  const ledger = { id, method: "official_sources", official: rc.official, days: ledgerDays, excluded };
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  if (reviewDays.length) {
    mkdirSync(join(ROOT, "data/historical/review"), { recursive: true });
    writeFileSync(join(ROOT, `data/historical/review/${id}.json`), JSON.stringify({ id, days: reviewDays }, null, 1) + "\n");
  }
  return { out, ledger, reviewDays, excluded };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [id, dir] = process.argv.slice(2);
  if (!id || !dir) { console.error("usage: import-gather.mjs <edition-id> <gather-dir>"); process.exit(2); }
  try {
    const { out, ledger, excluded } = await importGather(id, dir);
    console.log(`▸ ${id}: ${out.length} printed rows · ${excluded.length} excluded`);
    for (const d of ledger.days) console.log(`  day ${d.day} ${d.date}: ${d.sources.map(s => `${s.kind} ${s.captureTimestamp || s.sha256.slice(0, 12)} ${s.rows}`).join(" + ")}`);
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
