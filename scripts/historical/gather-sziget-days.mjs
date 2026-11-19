#!/usr/bin/env node
// gather-sziget-days.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Sziget edition read from the festival's own day-by-day programme pages
// (format "sziget-days", sziget-days-schedule.mjs), one page per day, from
// the research cache. import-gather.mjs then re-reads every page and must
// agree.
//
//   node scripts/historical/gather-sziget-days.mjs <edition-id> <out-dir> <official-url> <ts> <day-url> [ … one pair per day ]
//
// Every set the grid draws becomes a sheet row, its start as printed and no
// end (the grid prints none). A programme entry that bills several acts under
// one start (a night's line-up on the party stage) gives none of them a time
// of its own: it is one excluded untimed row, its lines joined with " / ".

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseSzigetDays } from "./sziget-days-schedule.mjs";

const [id, out, official, ...pairs] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !pairs.length || pairs.length % 2) {
  console.error("usage: gather-sziget-days.mjs <edition-id> <out-dir> <official-url> <ts> <day-url> …"); process.exit(2);
}
const rows = [], sources = [];
for (let i = 0; i < pairs.length; i += 2) {
  const [ts, url] = pairs.slice(i, i + 2);
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  const page = parseSzigetDays(cap.text, { year: ed.year });
  if (page.tabDates.join() !== ed.dates.map(([d]) => d).join()) throw new Error(`${url} @${ts}: its day tabs print ${page.tabDates.join(", ")}, not the days of ${id}`);
  if (!url.includes(`day=${page.date}&`)) throw new Error(`${url} @${ts}: prints ${page.date}, not the day its address asks for`);
  const day = ed.dates.findIndex(([x]) => x === page.date) + 1;
  if (rows.some(r => r.day === day)) throw new Error(`${url} @${ts}: a second page for ${page.date}`);
  const ref = `page ${ts}`;
  for (const x of page.sets) rows.push({ day, date: page.date, stage: x.stage, start: x.start, end: "", artist: x.artist, openEnd: 1, source_ref: ref });
  for (const b of page.bills) rows.push({ day, date: page.date, stage: b.stage, start: "", end: "", artist: b.lines.join(" / "), openEnd: "", source_ref: ref, note: `night's bill from ${b.start}` });
  sources.push({ kind: "page", match: ref, url, captureTimestamp: ts, format: "sziget-days", printed: { [day]: page.label } });
}
const missing = ed.dates.filter((_, i) => !rows.some(r => r.day === i + 1)).map(([d]) => d);
if (missing.length) throw new Error(`no programme page for ${missing.join(", ")}`);
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "openEnd", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : r[c] ?? "").join("\t"))].join("\n") + "\n");
const bills = rows.filter(r => r.note);
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources,
  ...(bills.length && { exclude: [{ note: "^night's bill from \\d\\d:\\d\\d$", reason: "One programme entry bills several acts under a single start (a night's line-up): none of them has a time of its own, so none is placed as a set.", untimed: true }] }),
  reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.openEnd).length} open-ended, ${bills.length} bill(s) excluded) from ${sources.length} day page(s) → ${out}`);
