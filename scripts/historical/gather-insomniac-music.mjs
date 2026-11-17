#!/usr/bin/env node
// gather-insomniac-music.mjs — a gather folder (sheet.tsv + receipts.json) for
// an EDC Las Vegas edition read from its official 2012-2013 music page
// (format "insomniac-music", insomniac-music-schedule.mjs), from the research
// cache. import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-insomniac-music.mjs <edition-id> <out-dir> <official-url> <ts> <url>
//
// Every set the page prints becomes a sheet row, as printed. A range that
// cannot be a set (it runs backwards or over eight hours, or two sets are
// printed on one stage at once, or the page's two readings of a block
// disagree) is an excluded row, with what it prints, and is never read
// another way.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseInsomniacMusic } from "./insomniac-music-schedule.mjs";

const [id, out, official, ts, url] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url) { console.error("usage: gather-insomniac-music.mjs <edition-id> <out-dir> <official-url> <ts> <url>"); process.exit(2); }
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseInsomniacMusic(cap.text, { year: ed.year });
const ref = `page ${ts}`, rows = [], printed = {};
const misprint = "printed range cannot be confirmed";
for (const d of page.days) {
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${d.date}, not a day of ${id}`);
  printed[day] = d.label;
  for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: "" });
  for (const x of d.misprints) rows.push({ day, date: d.date, stage: x.stage, start: "", end: "", artist: x.artist, note: `${misprint}: prints "${x.printed}" (${x.misprint})` });
}
const missing = ed.dates.filter((_, i) => !printed[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`${url} @${ts}: does not print ${missing.join(", ")}`);
const exclude = rows.some(r => r.note) ? [{ note: `^${misprint}: `, reason: "the page prints a range that runs backwards or over eight hours, two sets on one stage at once, or two readings of one block that disagree, so its time cannot be confirmed", misprint: true }] : [];
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "insomniac-music", printed };
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded) → ${out}`);
