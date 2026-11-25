#!/usr/bin/env node
// gather-defqon-logos.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Defqon.1 edition read from the festival's own 2014 timetable page (format
// "defqon-logos", defqon-logos-schedule.mjs: one page prints the whole
// weekend, one box per area and day), from the research cache.
// import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-defqon-logos.mjs <edition-id> <out-dir> <official-url> <ts> <url>
//
// Every set the page prints becomes a sheet row, its range as printed (an
// end the page prints past the next set's start is left open). A block (one
// range over several acts with no time of their own) gives none of its acts
// a time: each is an excluded untimed row.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseDefqonLogos } from "./defqon-logos-schedule.mjs";

const [id, out, official, ts, url] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url) { console.error("usage: gather-defqon-logos.mjs <edition-id> <out-dir> <official-url> <ts> <url>"); process.exit(2); }
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseDefqonLogos(cap.text, { year: ed.year, rolloverHour: ed.rolloverHour });
if (page.days.map(d => d.date).join() !== ed.dates.map(([d]) => d).join()) throw new Error(`${url} @${ts}: prints ${page.days.map(d => d.date).join(", ")}, not the days of ${id}`);
const ref = `page ${ts}`, rows = [], printed = {};
for (const [i, d] of page.days.entries()) {
  printed[i + 1] = d.label;
  for (const x of d.sets) rows.push({ day: i + 1, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, openEnd: x.openEnd ? "1" : "", source_ref: ref });
}
for (const b of page.bills) {
  const day = ed.dates.findIndex(([d]) => d === b.date) + 1;
  for (const a of b.acts) rows.push({ day, date: b.date, stage: b.stage, start: "", end: "", artist: a, source_ref: ref, note: `block from ${b.start} till ${b.end}` });
}
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "openEnd", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : r[c] ?? "").join("\t"))].join("\n") + "\n");
const blocks = rows.filter(r => r.note);
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official,
  sources: [{ kind: "page", match: ref, url, captureTimestamp: ts, format: "defqon-logos", printed }],
  ...(blocks.length && { exclude: [{ note: "^block from \\d\\d:\\d\\d till \\d\\d:\\d\\d$", reason: "The area prints one range over several acts that print no time of their own: none of them is placed as a set.", untimed: true }] }),
  reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${blocks.length} in a block, excluded) → ${out}`);
