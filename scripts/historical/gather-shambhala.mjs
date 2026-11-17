#!/usr/bin/env node
// gather-shambhala.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Shambhala edition read from its official schedule page (format
// "shambhala-table", shambhala-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-shambhala.mjs <edition-id> <out-dir> <official-url> <ts> <url>
//
// Every set the page prints becomes a sheet row, as printed. The page prints
// a start and no end, so a set is open-ended, unless its billing prints its
// own range ("Opiuo (1-2:15am)"). A set in a table's last row, which is the
// next day's first row printed again, is an excluded row.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseShambhala } from "./shambhala-schedule.mjs";

const [id, out, official, ts, url] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url) {
  console.error("usage: gather-shambhala.mjs <edition-id> <out-dir> <official-url> <ts> <url>"); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseShambhala(cap.text, { year: ed.year });
const ref = `page ${ts}`, rows = [], printed = {};
const again = "printed again as the next day's first set";
for (const d of page.days) {
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${d.label} ${d.date}, not a day of ${id}`);
  printed[day] = d.label;
  for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, openEnd: x.openEnd ? 1 : "", note: "" });
  for (const x of d.overlap) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, openEnd: "", note: again });
}
const missing = ed.dates.filter((_, i) => !printed[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`${url} @${ts}: does not print ${missing.join(", ")}`);
const exclude = rows.some(r => r.note === again)
  ? [{ note: `^${again}$`, reason: "the day's table ends with the next day's first slot printed again; the set is the next day's, where it is kept", duplicate: true }] : [];
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "openEnd", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "shambhala-table", printed };
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.openEnd).length} open-ended, ${rows.filter(r => r.note).length} excluded) → ${out}`);
