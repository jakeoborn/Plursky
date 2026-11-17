#!/usr/bin/env node
// gather-acl-grid.mjs — a gather folder (sheet.tsv + receipts.json) for an
// official_sources edition whose sources are C3 schedule-grid pages
// (aclfestival.com, lollapalooza.com, format "acl-grid"), read from the
// research cache. import-gather.mjs then re-reads every page and must agree.
//
//   node scripts/historical/gather-acl-grid.mjs <edition-id> <out-dir> <official-url> <ts> <url> [<ts> <url> …]
//
// Every block the page prints becomes a sheet row, as printed. Cancelled
// blocks and off-axis duplicates become excluded rows; a day the page cannot
// read keeps its rows with blank times (the edition must list it untimed).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseAclSchedule } from "./acl-schedule.mjs";

const [id, out, official, ...pairs] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || pairs.length < 2 || pairs.length % 2) {
  console.error("usage: gather-acl-grid.mjs <edition-id> <out-dir> <official-url> <ts> <url> [<ts> <url> …]"); process.exit(2);
}
const rows = [], sources = [], exclude = [];
for (let i = 0; i < pairs.length; i += 2) {
  const [ts, url] = [pairs[i], pairs[i + 1]];
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  const page = parseAclSchedule(cap.text), printed = {};
  for (const d of page.days) {
    const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
    if (!day) throw new Error(`${url} @${ts}: prints ${d.date}, not a day of ${id}`);
    printed[day] = page.tabs.find(t => t.date === d.date)?.label;
    const ref = `page ${ts}`;
    const untimed = (ed.untimedDays || []).includes(day), seen = new Set();
    for (const x of d.sets) {
      const k = `${x.stage}|${x.artist}`, repeat = untimed && !x.canceled && seen.has(k);
      seen.add(k);
      rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist,
        source_ref: ref, note: x.canceled ? "canceled block" : repeat ? "repeat set on an untimed day" : "" });
    }
    for (const x of d.duplicates) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist,
      source_ref: ref, note: "duplicate off-axis block" });
  }
  sources.push({ kind: "page", match: `page ${ts}`, url, captureTimestamp: ts, format: "acl-grid", printed });
}
if (rows.some(r => r.note === "canceled block")) exclude.push({ note: "^canceled block$", reason: "the page prints this block as cancelled", canceled: true });
if (rows.some(r => r.note === "duplicate off-axis block")) exclude.push({ note: "^duplicate off-axis block$", reason: "the page prints this block twice; the second copy is not a set", duplicate: true });
if (rows.some(r => r.note === "repeat set on an untimed day")) exclude.push({ note: "^repeat set on an untimed day$", reason: "a second set by the same act on the same stage; the day is untimed, so the act is listed once", repeat: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources, ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows from ${sources.length} page(s) → ${out}`);
