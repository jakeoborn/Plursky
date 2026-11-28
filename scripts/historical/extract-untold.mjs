#!/usr/bin/env node
// extract-untold.mjs — a past UNTOLD edition's own Artists page
// (untold-artists.mjs), read from the Wayback Machine, as a LINEUP: who plays
// which day, and on which stage. No times.
//
//   node scripts/historical/extract-untold.mjs untold-2024 untold-2025
//
// The page embeds each performance with its festival day's date and a
// numbered day label, so a capture proves the edition by printing exactly
// the edition's dates, Day 1 to Day N in order, and every entry on the day
// its label names. The census's dated post-event run for the year
// (data/historical/census/coverage-2010-2026.tsv) must be the same dates; the
// ledger quotes it as `census`.
//
// Every capture in the year up to WINDOW_DAYS after the last day is listed,
// the LATEST valid one is used, and the others are diffed against it. After
// the festival the page empties and then lists the next edition, so later
// captures are not considered.
//
// Only the Next.js site (from late 2023) embeds its lineup. The 2016 site was
// an AngularJS app, and its 2016-2018 programme, timetable, schedule and
// line-up captures are each under 3 KB; the 2019-2023 Gatsby site's line-up,
// schedule and stages pages print "Loading ..." and fetch their lists by
// script, which the archive never kept. No 2023 capture of the new site was
// taken before the festival.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseUntoldArtists, untoldRows } from "./untold-artists.mjs";
import { censusRow, runDates, CENSUS } from "./extract-creamfields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WINDOW_DAYS = 7;
export const UNTOLD_URL = "https://untold.com/artists";
export const UNTOLD_EDITIONS = ["untold-2024", "untold-2025"];

const stamp = d => d.replace(/-/g, "");
const addDays = (date, n) => { const t = new Date(date + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export async function extract(id) {
  const ed = EDITIONS[id];
  if (!ed || !UNTOLD_EDITIONS.includes(id)) throw new Error(`unknown UNTOLD edition ${id}`);
  const dates = ed.dates.map(([d]) => d);
  const census = censusRow(ed.festivalId, ed.year);
  const censusRec = census && { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published };
  const until = addDays(dates.at(-1), WINDOW_DAYS);
  const caps = (await listCaptures(UNTOLD_URL.replace(/^https?:\/\//, ""), `${ed.year}0101`, `${ed.year}1231`))
    .filter(c => c.timestamp.slice(0, 8) <= stamp(until));
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, UNTOLD_URL); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseUntoldArtists(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    const out = page ? untoldRows(page, dates) : null;
    const valid = !!out;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, labels: page?.labels ?? [], printedDates: page?.printedDates ?? [],
      entries: page?.acts.length ?? 0, timedEntries: page?.timed ?? 0, valid,
      ...(why && { unread: why }), ...(page && !out && { unread: `the page prints ${page.printedDates.join(", ")}, not the edition's ${dates.join(", ")}` }),
      billings: out ? new Set(out.rows.map(r => r.artist)).size : 0, out });
  }
  const ledger = { id, method: "official_lineup_html", official: UNTOLD_URL, format: "untold-artists",
    window: { until, why: `captures more than ${WINDOW_DAYS} days after the last day show the next edition` } };
  const strip = ({ out, ...c }) => c;
  if (!census || census.lifecycle !== "occurred" || JSON.stringify(runDates(census.range)) !== JSON.stringify(dates))
    return { ledger: { ...ledger, blocked: `the census's ${ed.year} run (${census?.dates}) is not the edition's dates`, considered: considered.map(strip) }, rows: [] };
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no ${ed.year} capture of ${UNTOLD_URL} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.out.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  const rows = chosen.out.rows;
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    // The dates are the page's own; the census's dated run must agree.
    census: censusRec,
    // Stages in the order the page first lists them.
    stageOrder: [...new Set(rows.map(r => r.stage))],
    // Entries the page printed twice on one day and stage: one row each.
    printedTwice: chosen.out.printedTwice,
    // Names printed with spaces around them, billed without.
    trimmed: chosen.out.trimmed,
    // Two spellings of one name (the same id), billed under the first.
    sameActs: chosen.out.sameActs,
    considered: considered.map(c => ({ ...strip(c), diffVsChosen: c === chosen || !c.valid ? undefined : diff(c) })),
  });
  const cols = ["artist", "day", "stage"];
  mkdirSync(join(ROOT, "data/historical/sheets"), { recursive: true });
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.lineup.tsv`), [cols.join("\t"), ...rows.map(r => cols.map(k => r[k]).join("\t"))].join("\n") + "\n");
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: extract-untold.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} ${c.unread || c.notFiled || ""}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · ${ledger.stageOrder.length} stages · ${ledger.printedTwice.length} printed twice`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}${c.notFiled ? " (not filed)" : ""}`);
  }
}
