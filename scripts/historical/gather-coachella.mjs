#!/usr/bin/env node
// gather-coachella.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Coachella edition read from its official lineup page (format
// "coachella-cards", coachella-lineup.mjs), from the research cache.
// import-gather.mjs then re-reads each page and must agree.
//
//   node scripts/historical/gather-coachella.mjs <edition-id> <out-dir> <official-url> <ts> <url> [<ts> <url> ...]
//
// One page prints both weekends (2016), or one per weekend view (2014,
// 2015: ?weekend=1 / ?weekend=2); each day must be printed by exactly one of
// the pages given. Every set the page prints becomes a sheet row, as
// printed, open-ended (the page prints no end times). An entry printed
// without its time or stage is an excluded row, with the page's own words.
// The 2017 page holds its lineup as data (format "coachella-data",
// parseCoachellaData): a set with an end keeps it, one without is
// open-ended. The 2012 page (format "coachella-overlays", parseCoachella2012)
// prints each act's sets in its hidden overlay, start times only.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseCoachella, parseCoachellaData, parseCoachella2012 } from "./coachella-lineup.mjs";

const PARSERS = { "coachella-cards": parseCoachella, "coachella-data": parseCoachellaData, "coachella-overlays": parseCoachella2012 };

const [id, out, official, ...pairs] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !pairs.length || pairs.length % 2) {
  console.error("usage: gather-coachella.mjs <edition-id> <out-dir> <official-url> <ts> <url> [<ts> <url> ...]"); process.exit(2);
}
const rows = [], sources = [], printedBy = {}, incomplete = "printed without its time or stage";
for (let i = 0; i < pairs.length; i += 2) {
  const [ts, url] = [pairs[i], pairs[i + 1]];
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  const format = /<lineup-listing\b/.test(cap.text) ? "coachella-data" : /<div class="artist-overlay" id="artist-/.test(cap.text) ? "coachella-overlays" : "coachella-cards";
  const page = PARSERS[format](cap.text, { year: ed.year });
  const ref = `page ${ts}`, printed = {};
  for (const d of page.days) {
    const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
    if (!day) throw new Error(`${url} @${ts}: prints ${d.label}, not a day of ${id}`);
    if (printedBy[day]) throw new Error(`${url} @${ts}: day ${day} is also printed by page ${printedBy[day]}`);
    printedBy[day] = ts; printed[day] = d.label;
    for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, openEnd: x.end ? "" : 1, ref, note: "" });
    for (const x of d.incomplete) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: "", artist: x.artist, ref, note: `${incomplete}: "${x.printed}"` });
  }
  sources.push({ kind: "page", match: ref, url, captureTimestamp: ts, format, printed });
}
const missing = ed.dates.filter((_, i) => !printedBy[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`no page given prints ${missing.join(", ")}`);
const exclude = rows.some(r => r.note) ? [{ note: `^${incomplete}: `, reason: "the page prints this entry without its set time or its stage (what it prints is kept in the sheet)", incomplete: true }] : [];
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "openEnd", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? r.ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources, ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded) from ${sources.length} page(s) → ${out}`);
