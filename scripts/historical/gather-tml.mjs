#!/usr/bin/env node
// gather-tml.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Tomorrowland edition read from its official timetable page (format
// "tml-stages", tml-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-tml.mjs <edition-id> <out-dir> <official-url> <ts> <url> <location|heading>
//
// Every set the page prints becomes a sheet row, as printed. A day the page
// prints that is not one of the edition's (the Thursday "Gathering" before
// each weekend) becomes excluded off-day rows. A stage printed two ways
// (case, spacing, a leading "The") is carried onto its most-printed form.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseTomorrowland } from "./tml-schedule.mjs";
import { stageFold } from "./import-gather.mjs";

const [id, out, official, ts, url, stageFrom] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url || !stageFrom) {
  console.error("usage: gather-tml.mjs <edition-id> <out-dir> <official-url> <ts> <url> <location|heading>"); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseTomorrowland(cap.text, { stageFrom });
const ref = `page ${ts}`, rows = [], printed = {}, offDay = "printed for the Thursday before a festival weekend";
const twice = "printed twice in the same slot";
for (const d of page.days) {
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1, seen = new Set();
  if (day) printed[day] = d.label;
  for (const x of d.sets) {
    const k = [x.stage, x.start, x.end, x.artist].join("|"), again = day && seen.has(k);
    seen.add(k);
    rows.push({ day: day || "", date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist,
      source_ref: ref, note: !day ? offDay : again ? twice : "" });
  }
}
const missing = ed.dates.filter((_, i) => !printed[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`${url} @${ts}: does not print ${missing.join(", ")}`);
if (rows.some(r => !r.day && new Date(r.date + "T12:00:00Z").getUTCDay() !== 4)) throw new Error(`${url} @${ts}: prints a day outside the edition that is not a Thursday`);

// One name per stage across the edition: its most-printed form.
const count = new Map();
for (const r of rows.filter(r => r.day)) count.set(r.stage, (count.get(r.stage) || 0) + 1);
const stageAs = {};
for (const name of count.keys()) {
  const best = [...count.keys()].filter(n => stageFold(n) === stageFold(name)).sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b))[0];
  if (best !== name) stageAs[name] = best;
}
const exclude = [];
if (rows.some(r => !r.day)) exclude.push({ note: `^${offDay}$`, reason: "printed for the Thursday before a festival weekend (The Gathering), not one of the festival's days", offDay: true });
if (rows.some(r => r.note === twice)) exclude.push({ note: `^${twice}$`, reason: "the page prints this set twice, same stage and time; the second copy is not a set", duplicate: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "tml-stages", stageFrom, printed, ...(Object.keys(stageAs).length && { stageAs }) };
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => !r.day).length} off-day) · ${Object.keys(stageAs).length} stage spellings carried · → ${out}`);
