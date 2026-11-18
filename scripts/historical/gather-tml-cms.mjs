#!/usr/bin/env node
// gather-tml-cms.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Tomorrowland edition read from its official 2010-2012 line-up day pages
// (format "tml-cms", tml-cms-schedule.mjs: one page per day), from the research
// cache. import-gather.mjs then re-reads every page and must agree.
//
//   node scripts/historical/gather-tml-cms.mjs <edition-id> <out-dir> <official-url> <ts> <url> [<ts> <url> …]
//
// Every set a page prints becomes a sheet row, as printed. Three kinds of
// block are excluded rows, with what each prints: a block printed across two
// or more whole sets on its stage (an all-day MC or live percussionist), a
// block named as its own stage (a broadcast or a sponsor's island, naming no
// act), and two sets printed on one stage at once (both).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseTmlCms } from "./tml-cms-schedule.mjs";

const [id, out, official, ...pages] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !pages.length || pages.length % 2) {
  console.error("usage: gather-tml-cms.mjs <edition-id> <out-dir> <official-url> <ts> <url> [<ts> <url> …]"); process.exit(2);
}
const rows = [], sources = [];
const misprint = "printed range cannot be confirmed", overlay = "printed across other sets on its stage", stageBlock = "printed as its own stage, naming no act";
for (let i = 0; i < pages.length; i += 2) {
  const [ts, url] = pages.slice(i, i + 2);
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  const d = parseTmlCms(cap.text, { year: ed.year });
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${d.date}, not a day of ${id}`);
  if (sources.some(s => s.printed[day])) throw new Error(`${id}: two pages print ${d.date}`);
  const ref = `page ${ts}`, row = (x, note) => rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, ref, note });
  for (const x of d.sets) row(x, "");
  for (const x of d.misprints) row(x, `${misprint}: ${x.misprint}`);
  for (const x of d.overlays) row(x, `${overlay}: prints ${x.printed}`);
  for (const x of d.stageBlocks) row(x, `${stageBlock}: prints ${x.printed}`);
  sources.push({ kind: "page", match: ref, url, captureTimestamp: ts, format: "tml-cms", printed: { [day]: d.label } });
}
const missing = ed.dates.filter((_, i) => !sources.some(s => s.printed[i + 1])).map(([d]) => d);
if (missing.length) throw new Error(`${id}: no page prints ${missing.join(", ")}`);
const exclude = [];
const has = p => rows.some(r => r.note.startsWith(p));
if (has(misprint)) exclude.push({ note: `^${misprint}: `, reason: "the page prints two acts in one stage's time, a range over eight hours, or one that runs backwards, so neither the act nor the time can be confirmed", misprint: true });
if (has(overlay)) exclude.push({ note: `^${overlay}: `, reason: "an MC or live accompanist printed across two or more whole sets on the stage: not a set of its own", overlay: true });
if (has(stageBlock)) exclude.push({ note: `^${stageBlock}: `, reason: "a block named as its own stage (a radio broadcast or a sponsor's island) names no performer", programme: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? r.ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources, ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded) from ${sources.length} pages → ${out}`);
