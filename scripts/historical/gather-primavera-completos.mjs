#!/usr/bin/env node
// gather-primavera-completos.mjs — a gather folder (sheet.tsv + receipts.json)
// for a Primavera Sound edition read from its official full timetable pages
// (format "primavera-completos", primavera-completos-schedule.mjs), one page
// per Parc del Fòrum day, from the research cache. Only the Fòrum's stages
// become rows; the city venues' columns are not the festival site's.
// import-gather.mjs then re-reads every page and must agree.
//
//   node scripts/historical/gather-primavera-completos.mjs <edition-id> <out-dir> <official-url> <ts> <day-url> [ … one pair per day ]
//
// Every block the page draws becomes a sheet row, as printed; a block that
// prints its start alone is an open end. The parser throws on anything it
// cannot confirm, so there are no excluded rows.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parsePrimaveraCompletos } from "./primavera-completos-schedule.mjs";

const [id, out, official, ...pairs] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !pairs.length || pairs.length % 2) {
  console.error("usage: gather-primavera-completos.mjs <edition-id> <out-dir> <official-url> <ts> <day-url> …"); process.exit(2);
}
const rows = [], sources = [];
for (let i = 0; i < pairs.length; i += 2) {
  const [ts, url] = pairs.slice(i, i + 2);
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  const page = parsePrimaveraCompletos(cap.text, { year: ed.year });
  const run = page.tabDates.join(), want = ed.dates.map(([d]) => d).join();
  if (!`,${run},`.includes(`,${want},`)) throw new Error(`${url} @${ts}: its day tabs print ${run}, which do not hold the days of ${id} in a row`);
  const day = ed.dates.findIndex(([x]) => x === page.date) + 1;
  if (rows.some(r => r.day === day)) throw new Error(`${url} @${ts}: a second page for ${page.date}`);
  const ref = `page ${ts}`;
  for (const x of page.sets) rows.push({ day, date: page.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, openEnd: x.openEnd ? 1 : "", source_ref: ref });
  sources.push({ kind: "page", match: ref, url, captureTimestamp: ts, format: "primavera-completos", printed: { [day]: page.label } });
}
const missing = ed.dates.filter((_, i) => !rows.some(r => r.day === i + 1)).map(([d]) => d);
if (missing.length) throw new Error(`no timetable page for ${missing.join(", ")}`);
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "openEnd", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources, reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.openEnd).length} open-ended) from ${sources.length} day page(s) → ${out}`);
