#!/usr/bin/env node
// gather-dostuff-embed.mjs — a gather folder (sheet.tsv + receipts.json) for
// an edition read from its official lineup widget's embed script (format
// "dostuff-embed", dostuff-embed-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads the script and must agree.
//
//   node scripts/historical/gather-dostuff-embed.mjs <edition-id> <out-dir> <official-url> \
//     <ts> <embed-url> <page-ts> <page-url> [--food <stage>]
//
// <page-ts> <page-url> is the archived official lineup page that loads the
// script (its <script src> is <embed-url>, captured seconds before it). Every
// performance becomes a sheet row, billed as the widget bills it. Shows on
// the festival's food-and-drink stage (`--food <stage>`: Outside Lands'
// Cocktail Magic, cocktails with magicians, DJs and talks) are excluded rows,
// as GastroMagic's are in earlier years.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseDoStuffEmbed } from "./dostuff-embed-schedule.mjs";

const argv = process.argv.slice(2);
const fi = argv.indexOf("--food");
const food = fi >= 0 ? argv.splice(fi, 2)[1] : null;
const [id, out, official, ts, url, pageTs, pageUrl] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url || !/^\d{14}$/.test(pageTs || "") || !pageUrl) {
  console.error("usage: gather-dostuff-embed.mjs <edition-id> <out-dir> <official-url> <ts> <embed-url> <page-ts> <page-url> [--food <stage>]"); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const w = parseDoStuffEmbed(cap.text, { rolloverHour: ed.rolloverHour });
if (w.run.join() !== ed.dates.map(([d]) => d).join()) throw new Error(`${url} @${ts}: the widget's run is ${w.run.join(", ")}, not the days of ${id}`);
if (w.timezone !== ed.timezone) throw new Error(`${url} @${ts}: the widget's time zone is ${w.timezone}, not ${ed.timezone}`);
if (food && !w.stages.includes(food)) throw new Error(`${url} @${ts}: no stage "${food}"`);
const ref = `page ${ts}`, rows = [], printed = {};
for (const [i, d] of w.days.entries()) {
  const day = i + 1;
  printed[day] = d.date;
  for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: x.stage === food ? "food stage" : "" });
}
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "dostuff-embed", printed, run: `${w.startDate} to ${w.endDate}`,
  embeddedBy: { url: pageUrl, captureTimestamp: pageTs }, ...(food && { foodStage: food }) };
const exclude = food ? [{ note: "^food stage$", reason: `a show on ${food}, the festival's food-and-drink stage (as GastroMagic's in earlier years)`, food: true }] : [];
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} on ${food || "no food stage"}) on ${w.stages.length} stages → ${out}`);
