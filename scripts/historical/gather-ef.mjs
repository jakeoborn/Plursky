#!/usr/bin/env node
// gather-ef.mjs — a gather folder (sheet.tsv + receipts.json) for an Electric
// Forest edition read from its official Artist Schedule page (format
// "ef-grid", ef-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-ef.mjs <edition-id> <out-dir> <official-url> <ts> <url>
//
// Every set the page prints becomes a sheet row, as printed. A set printed
// open-ended ("2:15am - Close") keeps its start and is marked openEnd. An
// entry printed with no set time, or whose printed range disagrees with its
// block on the grid, is an excluded row, with the page's own words.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseElectricForest } from "./ef-schedule.mjs";

const [id, out, official, ts, url] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url) {
  console.error("usage: gather-ef.mjs <edition-id> <out-dir> <official-url> <ts> <url>"); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseElectricForest(cap.text, { year: ed.year });
const ref = `page ${ts}`, rows = [], printed = {};
const noTime = "printed with no set time", misprint = "printed range disagrees with its block on the grid";
for (const d of page.days) {
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${d.label}, not a day of ${id}`);
  printed[day] = d.label;
  for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, openEnd: x.openEnd ? 1 : "", note: "" });
  for (const x of d.untimed) rows.push({ day, date: d.date, stage: x.stage, start: "", end: "", artist: x.artist, note: `${noTime}: "${x.printed}"` });
  for (const x of d.misprints) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: `${misprint}: ${x.misprint}` });
}
const missing = ed.dates.filter((_, i) => !printed[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`${url} @${ts}: does not print ${missing.join(", ")}`);
const exclude = [];
if (rows.some(r => r.note.startsWith(noTime))) exclude.push({ note: `^${noTime}: `, reason: "the page prints this entry with no set time (the words it prints instead are kept in the sheet)", untimed: true });
if (rows.some(r => r.note.startsWith(misprint))) exclude.push({ note: `^${misprint}: `, reason: "the printed range and the block's length on the page's own time grid disagree, so neither time can be confirmed", misprint: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "openEnd", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "ef-grid", printed };
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.openEnd).length} open-ended, ${rows.filter(r => r.note).length} excluded) → ${out}`);
