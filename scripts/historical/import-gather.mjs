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
//             Insomniac parser; the rows must equal the sheet's, row for row.
//             format "day-tabs": one page prints every day (Dreamstate 2016)
//     graphic { kind, match, file, imageUrl, foundAt, published, rehostedBy,
//               fetchedAt, printed: {day: header}, stageAs?, when?, review }
//             the local file's sha256 is what the ledger and review record.
//             Its receipt is a Wayback capture of `foundAt` that cites the
//             image (citeToken); the earliest such capture is recorded
//   plus `exclude` (note patterns for printed rows that are not the
//   edition's, e.g. a pre-event slot the final page re-filled),
//   `notUsedGraphics` ([{cites, reason}]: a set-times graphic a receipt page
//   shows that is not the edition's, e.g. an after-party's) and `reviewedAt`.
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
import { citeToken, postSlides, setTimesGraphics, sameGraphic, receiptGaps } from "./lib.mjs";
import { parseDay } from "../fetch-insomniac-settimes.mjs";
import { sheetRow } from "./extract-insomniac.mjs";
import { readSheet } from "./build-editions.mjs";
import { parseAclSchedule } from "./acl-schedule.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sha256 = buf => createHash("sha256").update(buf).digest("hex");
const rowKey = r => [r.day, r.stage, r.start, r.end, r.artist].join("|");

// The public review label: who checked the pixels and how, never a session.
export const REVIEWER = "Plursky history review (Claude Plur): Vision OCR cross-check and by-eye reading on 2x crops";

// The earliest Wayback capture of the page a graphic was found on that cites
// the graphic: the proof that the re-host's page carried this image.
// Wayback holds no Instagram post, so an Instagram slide's receipt is the
// post's logged-out embed, read once and kept in the gather folder
// (`receiptCopy`, read on `receiptReadAt`).
async function receiptFor(s, dir) {
  const token = citeToken(s.imageUrl);
  if (new URL(s.imageUrl).hostname.endsWith("cdninstagram.com")) {
    const buf = readFileSync(join(dir, s.receiptCopy));
    if (!buf.toString("utf8").includes(token)) throw new Error(`${s.foundAt}: the post's embed does not cite ${token}`);
    // Every slide of the post, so the edition is held to all of them.
    const slides = postSlides(buf.toString("utf8"));
    if (!slides) throw new Error(`${s.foundAt}: the post's embed shows neither a carousel nor a single image`);
    if (!slides.includes(token)) throw new Error(`${s.foundAt}: cites ${token}, but it is not one of the post's slides (${slides.join(", ")})`);
    return { url: `${s.foundAt}embed/captioned/`, fetchedAt: s.receiptReadAt, sha256: sha256(buf), cites: token, setTimesGraphics: slides };
  }
  for (const c of await listCaptures(s.foundAt, "2010", "2026")) {
    const cap = await fetchCapture(c.timestamp, s.foundAt);
    if (!cap.text.includes(token)) continue;
    const receipt = { archivedUrl: cap.archivedUrl, captureTimestamp: cap.captureTimestamp, sha256: cap.sha256, cites: token };
    // An EDM Identity post also records every set-times graphic it shows, so
    // the edition can be held to all of them, not just the one cited here.
    if (new URL(s.foundAt).hostname === "edmidentity.com") {
      const shown = setTimesGraphics(cap.text);
      if (!shown) throw new Error(`${cap.archivedUrl}: no article body found to list its set-times graphics`);
      if (!shown.some(t => sameGraphic(t, token))) throw new Error(`${cap.archivedUrl}: cites ${token}, but not among the set-times graphics it shows (${shown.join(", ") || "none"})`);
      receipt.setTimesGraphics = shown;
    }
    return receipt;
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

// Dreamstate's 2016 theme prints every day on one page: a tab pane per day,
// a header naming the stages in order, then one ds-stage column per stage.
// Each pane comes back under its own tab label, with ranges as printed.
const plain = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&#8217;/g, "'").replace(/\s+/g, " ").trim();
export function parseDayTabs(html) {
  const labels = new Map([...html.matchAll(/<li id="day_([a-z0-9_]+)"[^>]*>([^<]+)</g)].map(m => [m[1], plain(m[2])]));
  const panes = [...html.matchAll(/<div role="tabpanel" class="tab-pane[^"]*" id="([a-z0-9_]+)">/g)];
  return panes.map((p, i) => {
    const seg = html.slice(p.index, panes[i + 1]?.index ?? html.length);
    const stages = [...seg.matchAll(/<div class="stg[^"]*">([^<]*)<\/div>/g)].map(m => plain(m[1]));
    const cols = seg.split(/<div class="ds-stage[ "]/).slice(1);
    if (cols.length !== stages.length) throw new Error(`pane ${p[1]}: ${stages.length} stage headers, ${cols.length} stage columns`);
    const sets = cols.flatMap((c, j) => [...c.matchAll(/<strong class="ds-event-title">([\s\S]*?)<\/strong>\s*<span class="ds-time-range">([\s\S]*?)<\/span>/g)]
      .map(m => ({ stage: stages[j], artist: plain(m[1]), printed: plain(m[2]) })));
    return { tab: labels.get(p[1]), sets };
  });
}

export async function importGather(id, dir) {
  const ed = EDITIONS[id];
  if (!ed || ed.method !== "official_sources") throw new Error(`${id} is not an official_sources edition`);
  const rc = JSON.parse(readFileSync(join(dir, "receipts.json"), "utf8"));
  if (rc.id !== id) throw new Error(`receipts.json is for ${rc.id}, not ${id}`);
  const rows = readSheet(join(dir, "sheet.tsv"));
  const excluded = [], bySource = new Map(rc.sources.map((s, i) => [i, []]));

  for (const r of rows) {
    const ex = (rc.exclude || []).find(x => new RegExp(x.note).test(r.note || ""));
    // A row of a cancelled day (ACL 2013's flooded Sunday) is not a day of the
    // edition: it must be excluded as cancelled, and is recorded by its date.
    if ((ed.cancelledDays || []).some(c => c.date === r.date)) {
      // (A row an earlier capture printed and the final page replaced stays
      // excluded as superseded; only the final page's blocks are "cancelled".)
      if (!ex) throw new Error(`row ${r.artist}: ${r.date} is a cancelled day, but the row is not excluded`);
      excluded.push({ date: r.date, stage: r.stage, start: r.start, end: r.end, billing: r.artist, reason: ex.reason, ...(ex.canceled && { canceled: true }) });
      continue;
    }
    const date = ed.dates[+r.day - 1]?.[0];
    if (r.date !== date) throw new Error(`row ${r.artist}: day ${r.day} is ${r.date}, the edition says ${date}`);
    if (ex) { excluded.push({ day: +r.day, stage: r.stage, start: r.start, end: r.end, billing: r.artist, reason: ex.reason, ...(ex.canceled && { canceled: true }), ...(ex.duplicate && { duplicate: true }), ...(ex.repeat && { repeat: true }) }); continue; }
    const hits = rc.sources.map((s, i) => [s, i]).filter(([s]) => (r.source_ref || "").includes(s.match)
      && (!s.when?.stage || new RegExp(s.when.stage).test(r.stage)) && (!s.when?.stageNot || !new RegExp(s.when.stageNot).test(r.stage)));
    if (hits.length !== 1) throw new Error(`row d${r.day} ${r.stage} ${r.start} ${r.artist}: ${hits.length} sources match its source_ref`);
    const [s, i] = hits[0];
    // Only a day the edition registry marks untimed may carry blank times.
    if ((!r.start || !r.end) && !(ed.untimedDays || []).includes(+r.day)) throw new Error(`row ${r.artist}: blank time (no openEnd convention for gather rows yet)`);
    bySource.get(i).push({ day: +r.day, stage: stageFor(s, r.stage), start: r.start, end: r.end, artist: r.artist, source: s.match, note: r.note || "" });
  }

  const ledgerDays = ed.dates.map(([date], i) => ({ day: i + 1, date, sources: [] }));
  const cancelledLedger = [];
  const reviewDays = [], out = [];
  for (const [i, s] of rc.sources.entries()) {
    const got = bySource.get(i);
    const days = [...new Set(got.map(r => r.day))].sort();
    if (!days.length) throw new Error(`source ${s.match} contributes no rows`);
    if (s.kind === "page") {
      const cap = await fetchCapture(s.captureTimestamp, s.url);
      if (cap.captureTimestamp !== s.captureTimestamp) throw new Error(`${s.url}: Wayback served ${cap.captureTimestamp}, not ${s.captureTimestamp}`);
      const agree = (day, parsed) => {
        const mine = got.filter(r => r.day === day);
        // An untimed day lists an act once per stage: a second set by the same
        // act on the same stage is an excluded repeat, and the sheet must
        // exclude exactly the page's second and later sets, one for one.
        if ((ed.untimedDays || []).includes(day)) {
          const seen = new Set(), later = [];
          parsed = parsed.filter(x => { const k = `${x.stage}|${x.artist}`; if (!seen.has(k)) { seen.add(k); return true; } later.push(x); return false; });
          const k = x => [x.stage, x.start, x.artist ?? x.billing].join("|");
          const pageRep = later.map(k).sort().join("\n"), sheetRep = excluded.filter(x => x.day === day && x.repeat).map(k).sort().join("\n");
          if (pageRep !== sheetRep) throw new Error(`${s.url} @${s.captureTimestamp}: day ${day} prints ${later.length} repeat set(s) on an untimed day, the sheet excludes others\n  page: ${pageRep}\n  sheet: ${sheetRep}`);
        } else if (excluded.some(x => x.day === day && x.repeat)) throw new Error(`day ${day}: a repeat set is excluded, but the day is timed`);
        const want = mine.map(rowKey).sort(), have = parsed.map(x => ({ day, ...sheetRow(day, x) })).map(rowKey).sort();
        const missing = want.filter(k => !have.includes(k)), extra = have.filter(k => !want.includes(k));
        if (missing.length || extra.length) throw new Error(`${s.url} @${s.captureTimestamp}: the archived page and the reviewed sheet disagree\n  sheet only: ${missing.join("\n  ")}\n  page only: ${extra.join("\n  ")}`);
        ledgerDays[day - 1].sources.push({ kind: "page", url: s.url, archivedUrl: cap.archivedUrl, captureTimestamp: cap.captureTimestamp,
          printed: s.printed[day], sha256: cap.sha256, bytes: cap.bytes, rows: mine.length, ...(s.format && { format: s.format }) });
      };
      if (s.format === "acl-grid") {
        // One page per weekend: every day it prints is cited, each read off
        // its own hour axis (acl-schedule.mjs). A cancelled block (2014's
        // "*canceled*") is not a set: it must be a sheet row excluded as
        // cancelled, one for one.
        const page = parseAclSchedule(cap.text);
        const dayOf = date => ed.dates.findIndex(([d]) => d === date) + 1;
        const key = x => [x.stage, x.start, x.end, x.artist ?? x.billing].join("|");
        // A cancelled day the page still prints: the page must print the
        // cancellation banner, and every block of it is a cancelled sheet row.
        for (const c of ed.cancelledDays || []) {
          const d = page.days.find(x => x.date === c.date);
          if (!d) continue;
          if (!cap.text.includes(c.banner)) throw new Error(`${s.url} @${s.captureTimestamp}: prints cancelled day ${c.date} without the banner "${c.banner}"`);
          const blocks = d.sets.map(key).sort(), ex = excluded.filter(x => x.date === c.date && x.canceled).map(key).sort();
          if (blocks.join("\n") !== ex.join("\n")) throw new Error(`${s.url} @${s.captureTimestamp}: cancelled day ${c.date} prints ${blocks.length} block(s), the sheet excludes ${ex.length}`);
          cancelledLedger.push({ date: c.date, banner: c.banner, archivedUrl: cap.archivedUrl, captureTimestamp: cap.captureTimestamp, blocks: blocks.length });
        }
        page.days = page.days.filter(d => !(ed.cancelledDays || []).some(c => c.date === d.date));
        const printedDays = page.days.map(d => dayOf(d.date));
        if (printedDays.some(d => d < 1)) throw new Error(`${s.url} @${s.captureTimestamp}: prints a day that is not the edition's (${page.days.map(d => d.date).join(", ")})`);
        if (printedDays.join() !== days.join()) throw new Error(`${s.url} @${s.captureTimestamp}: prints days ${printedDays.join(",")}, the sheet cites it for ${days.join(",")}`);
        for (const d of page.days) {
          const day = dayOf(d.date), tab = page.tabs.find(t => t.date === d.date);
          if (tab?.label !== s.printed[day]) throw new Error(`${s.url} @${s.captureTimestamp}: day ${day}'s tab prints "${tab?.label}", the receipt says "${s.printed[day]}"`);
          // A day the page itself cannot read (a misprinted range on it, as on
          // Lollapalooza 2013's Saturday) ships untimed, and only when the
          // edition registry says so; the misprints are kept in the ledger.
          if (!d.timed && !(ed.untimedDays || []).includes(day)) throw new Error(`${s.url} @${s.captureTimestamp}: day ${day} cannot be read off its hour axis, and the edition does not list it as untimed`);
          // A block printed twice (once off the axis) is one set: the sheet
          // must exclude its second row as a duplicate, one for one.
          const dupKey = x => [x.stage, x.artist ?? x.billing].join("|");
          const dups = d.duplicates.map(dupKey).sort(), dupRows = excluded.filter(x => x.day === day && x.duplicate).map(dupKey).sort();
          if (dups.join("\n") !== dupRows.join("\n")) throw new Error(`${s.url} @${s.captureTimestamp}: day ${day} prints ${dups.length} duplicate off-axis block(s) (${d.duplicates.map(x => `${x.artist} ${x.printed}`).join(", ")}), the sheet excludes ${dupRows.length} as duplicates`);
          const cancelled = d.sets.filter(x => x.canceled).map(key).sort();
          const excludedHere = excluded.filter(x => x.day === day && x.canceled).map(key).sort();
          if (cancelled.join("\n") !== excludedHere.join("\n")) throw new Error(`${s.url} @${s.captureTimestamp}: day ${day} prints ${cancelled.length} cancelled block(s), the sheet excludes ${excludedHere.length} as cancelled\n  page: ${cancelled.join("\n  page: ")}\n  sheet: ${excludedHere.join("\n  sheet: ")}`);
          agree(day, d.sets.filter(x => !x.canceled).map(x => ({ stage: x.stage, start: x.start, end: x.end, artist: x.artist })));
          const misprints = d.sets.filter(x => x.rangeMismatch).map(x => `${x.stage}: ${x.artist} ${x.printed}`);
          if (!d.timed && !misprints.length) throw new Error(`${s.url} @${s.captureTimestamp}: day ${day} is unreadable for no reason the parser can name`);
          Object.assign(ledgerDays[day - 1].sources.at(-1), { meridiem: d.timed ? "printed hour axis" : "unreadable: a printed range disagrees with its block",
            ...(misprints.length && { misprints }),
            axis: `${d.axis.labels[0]} … ${d.axis.labels.at(-1)}`, emPerMinute: Math.round(page.scale * 1e4) / 1e4,
            ...(cancelled.length && { cancelled: cancelled.length }), ...(dups.length && { duplicateBlocks: dups.length }),
            ...((ed.untimedDays || []).includes(day) && { timesConfirmed: false }) });
        }
      } else if (s.format === "day-tabs") {
        // Every day is on the page; each day's rows must equal its own pane.
        const panes = parseDayTabs(cap.text);
        for (const day of days) {
          const pane = panes.find(p => p.tab === s.printed[day]);
          if (!pane) throw new Error(`${s.url} @${s.captureTimestamp}: no day tab prints "${s.printed[day]}" (tabs: ${panes.map(p => p.tab).join(" / ")})`);
          agree(day, pane.sets);
        }
      } else {
        if (days.length !== 1) throw new Error(`page ${s.match} is cited for ${days.length} days; a set-times page shows one`);
        const day = days[0];
        // The receipt's day tab is what the page itself shows as the active tab,
        // not the page's script data (Orlando 2024's _siteTranslations carry 2025).
        const tab = activeTab(cap.text);
        if (tab !== s.printed[day]) throw new Error(`${s.url} @${s.captureTimestamp}: the active day tab prints "${tab}", the receipt says "${s.printed[day]}"`);
        agree(day, parseDay(cap.text));
      }
      // An untimed day (ACL 2017's pre-weekend W2 capture) keeps its lineup
      // and drops the times: they were checked against the page above, but
      // the page cannot confirm them (Instinct's ruling, 2026-11-04).
      out.push(...got.map(r => ({ ...r, ...((ed.untimedDays || []).includes(r.day) && { start: "", end: "" }), source: `page ${cap.captureTimestamp}` })));
    } else if (s.kind === "graphic") {
      const buf = readFileSync(join(dir, s.file)), hash = sha256(buf), receipt = await receiptFor(s, dir);
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
  // Every set-times graphic a receipt page shows is used by a source or
  // excluded in receipts.json `notUsedGraphics` with the reason.
  const notUsedGraphics = rc.notUsedGraphics || [];
  const { unused, stale } = receiptGaps(ledgerDays.flatMap(d => d.sources), notUsedGraphics);
  if (unused.length) throw new Error(`set-times graphics no source uses and none excludes:\n  ${unused.map(u => `${u.cites} (${u.page})`).join("\n  ")}`);
  if (stale.length) throw new Error(`notUsedGraphics entries that are used, on no receipt page, or have no reason: ${stale.map(n => n.cites).join(", ")}`);
  for (const c of ed.cancelledDays || []) if (!cancelledLedger.some(x => x.date === c.date)) throw new Error(`no source prints cancelled day ${c.date} with its banner`);
  const ledger = { id, method: "official_sources", official: rc.official, days: ledgerDays, excluded,
    ...(cancelledLedger.length && { cancelledDays: cancelledLedger }), ...(notUsedGraphics.length && { notUsedGraphics }) };
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
