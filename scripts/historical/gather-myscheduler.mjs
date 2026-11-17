#!/usr/bin/env node
// gather-myscheduler.mjs — a gather folder (sheet.tsv + receipts.json) for an
// Outside Lands edition read from its official 2010-2011 schedule planner
// (format "myscheduler-data", myscheduler-schedule.mjs), from the research
// cache. import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-myscheduler.mjs <edition-id> <out-dir> <official-url> <ts> <url> \
//     [--variety <stage>] [--restore <name>] …
//
// Every set the page's data schedules becomes a sheet row, as written. Shows
// on the festival's comedy-and-variety stage (`--variety <stage>`, 2011's
// Barbary) are excluded rows. A billing whose letters the capture cannot
// decode is written as the `--restore` name that reads it (each lost letter
// one non-ASCII letter, every other character the page's), and the receipt
// lists the name so the import can check it.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseMyScheduler, restoreSets } from "./myscheduler-schedule.mjs";

const argv = process.argv.slice(2), take = flag => { const out = []; for (let i; (i = argv.indexOf(flag)) >= 0;) out.push(argv.splice(i, 2)[1]); return out; };
const [variety = null] = take("--variety"), restore = take("--restore");
const [id, out, official, ts, url] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url) {
  console.error("usage: gather-myscheduler.mjs <edition-id> <out-dir> <official-url> <ts> <url> [--variety <stage>] [--restore <name>] …"); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = restoreSets(parseMyScheduler(cap.text, { year: ed.year }), restore);
if (variety && !page.stages.includes(variety)) throw new Error(`${url} @${ts}: no stage "${variety}"`);
const ref = `page ${ts}`, rows = [], printed = {};
for (const d of page.days) {
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: schedules ${d.date}, not a day of ${id}`);
  printed[day] = d.label;
  for (const x of d.sets) {
    if (x.subtitle && x.stage !== variety) throw new Error(`${d.date} ${x.stage} ${x.start}: "${x.artist}" prints a subtitle "${x.subtitle}" on a music stage`);
    rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: x.stage === variety ? "show on the comedy and variety stage" : "" });
  }
}
const missing = ed.dates.filter((_, i) => !printed[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`${url} @${ts}: schedules nothing on ${missing.join(", ")}`);
const exclude = rows.some(r => r.note) ? [{ note: "^show on the comedy and variety stage$", reason: `${variety} is the festival's comedy and variety stage: its shows are stand-up, sideshow, magic and circus acts, not music sets`, comedy: true }] : [];
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "myscheduler-data", printed,
  ...(variety && { comedyStage: variety }), ...(restore.length && { restore }) };
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded, ${page.restored.length} restored, ${page.unscheduled.length} unscheduled) → ${out}`);
