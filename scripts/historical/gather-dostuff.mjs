#!/usr/bin/env node
// gather-dostuff.mjs — a gather folder (sheet.tsv + receipts.json) for an
// Outside Lands edition read from its official per-day schedule grids
// (format "dostuff-grid", dostuff-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads every page and must agree.
//
//   node scripts/historical/gather-dostuff.mjs <edition-id> <out-dir> <official-url> \
//     <ts> <day-url> <anchor-ts> <anchor-act-url> [ … one group per day ]
//
// Each day's grid prints its times with no am/pm; the anchor is one act's own
// page on the same site, which prints that act's set with its meridiem and
// fixes the day's axis (dostuff-schedule.mjs). Every block becomes a sheet
// row, as printed. Shows in the festival's comedy tent (`--comedy <stage>`)
// shows on its chef-and-food stage (`--food <stage>`, GastroMagic) and blocks
// whose place disagrees with their printed range are excluded rows.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseDoStuff, parseDoStuffBand, timeDay } from "./dostuff-schedule.mjs";

const argv = process.argv.slice(2);
const ci = argv.indexOf("--comedy");
const comedy = ci >= 0 ? argv.splice(ci, 2)[1] : null;
const fi = argv.indexOf("--food");
const food = fi >= 0 ? argv.splice(fi, 2)[1] : null;
const [id, out, official, ...groups] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || !groups.length || groups.length % 4) {
  console.error("usage: gather-dostuff.mjs <edition-id> <out-dir> <official-url> [--comedy <stage>] [--food <stage>] <ts> <day-url> <anchor-ts> <anchor-act-url> …"); process.exit(2);
}
const capture = async (ts, url) => {
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  return cap;
};
const rows = [], sources = [];
for (let i = 0; i < groups.length; i += 4) {
  const [ts, url, ats, aurl] = groups.slice(i, i + 4);
  const page = parseDoStuff((await capture(ts, url)).text);
  if (page.year !== ed.year) throw new Error(`${url} @${ts}: prints ${page.title}, not ${ed.year}`);
  const day = ed.dates.findIndex(([x]) => x === page.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${page.label} (${page.date}), not a day of ${id}`);
  const slug = /\/band\/([^/?#]+)/.exec(aurl)?.[1];
  const t = timeDay(page, parseDoStuffBand((await capture(ats, aurl)).text), slug);
  const ref = `page ${ts}`;
  for (const x of t.sets) rows.push({ day, date: page.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, source_ref: ref,
    note: comedy && x.stage === comedy ? "show in the comedy tent" : food && x.stage === food ? "show on the food stage" : "" });
  for (const x of page.misprints) rows.push({ day, date: page.date, stage: x.stage, start: "", end: "", artist: x.artist, source_ref: ref,
    note: `misprint: prints "${x.printed}", ${x.misprint}` });
  sources.push({ kind: "page", match: ref, url, captureTimestamp: ts, format: "dostuff-grid", printed: { [day]: page.label },
    anchor: { url: aurl, captureTimestamp: ats }, ...(comedy && { comedyStage: comedy }), ...(food && { foodStage: food }) });
}
const missing = ed.dates.filter((_, i) => !rows.some(r => r.day === i + 1)).map(([d]) => d);
if (missing.length) throw new Error(`no grid for ${missing.join(", ")}`);
const exclude = [];
if (rows.some(r => r.note === "show in the comedy tent")) exclude.push({ note: "^show in the comedy tent$", reason: `${comedy} is the festival's comedy tent: its shows are comedy, not music sets`, comedy: true });
if (rows.some(r => r.note === "show on the food stage")) exclude.push({ note: "^show on the food stage$", reason: `${food} is the festival's chef-and-food stage: its shows are cooking demos, food contests and themed food events, not music sets`, food: true });
if (rows.some(r => r.note.startsWith("misprint:"))) exclude.push({ note: "^misprint: ", reason: "the block's place on the grid disagrees with its printed range, so its time cannot be read", misprint: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources, ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded) from ${sources.length} day page(s) → ${out}`);
