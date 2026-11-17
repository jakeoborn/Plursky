#!/usr/bin/env node
// gather-tml-drupal.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Tomorrowland edition read from its official 2013-2016 day timetables
// (format "tml-drupal", tml-drupal-schedule.mjs: one page per day), from the
// research cache. import-gather.mjs then re-reads every page and must agree.
//
//   node scripts/historical/gather-tml-drupal.mjs <edition-id> <out-dir> <official-url> \
//     <ts> <url> [<ts> <url> …] [--programme-stage <stage>] …
//
// Every set a page prints becomes a sheet row, as printed. A stage row that
// holds a broadcast, not sets (Radio Modern's all-day "Radio Ultra Modern"
// show, `--programme-stage`), has its rows excluded. Two sets printed on one
// stage at once are both excluded rows, with what each prints.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseTmlDrupal } from "./tml-drupal-schedule.mjs";

const argv = process.argv.slice(2), take = flag => { const out = []; for (let i; (i = argv.indexOf(flag)) >= 0;) out.push(argv.splice(i, 2)[1]); return out; };
const progStages = take("--programme-stage");
const [id, out, official, ...pages] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || !pages.length || pages.length % 2) {
  console.error("usage: gather-tml-drupal.mjs <edition-id> <out-dir> <official-url> <ts> <url> [<ts> <url> …] [--programme-stage <stage>] …"); process.exit(2);
}
const rows = [], sources = [], seenProg = new Set();
const progNote = "a broadcast on a stage that holds no sets", misprint = "printed range cannot be confirmed";
for (let i = 0; i < pages.length; i += 2) {
  const [ts, url] = pages.slice(i, i + 2);
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  const d = parseTmlDrupal(cap.text, { year: ed.year });
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${d.date}, not a day of ${id}`);
  if (sources.some(s => s.printed[day])) throw new Error(`${id}: two pages print ${d.date}`);
  const ref = `page ${ts}`;
  for (const st of progStages) if (d.stages.includes(st)) seenProg.add(st);
  for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, ref, note: progStages.includes(x.stage) ? progNote : "" });
  for (const x of d.misprints) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, ref, note: `${misprint}: ${x.misprint}` });
  sources.push({ kind: "page", match: ref, url, captureTimestamp: ts, format: "tml-drupal", printed: { [day]: d.label },
    ...(progStages.some(st => d.stages.includes(st)) && { programmeStages: progStages.filter(st => d.stages.includes(st)) }) });
}
for (const st of progStages) if (!seenProg.has(st)) throw new Error(`${id}: no page prints a stage "${st}"`);
const missing = ed.dates.filter((_, i) => !sources.some(s => s.printed[i + 1])).map(([d]) => d);
if (missing.length) throw new Error(`${id}: no page prints ${missing.join(", ")}`);
const exclude = [];
if (rows.some(r => r.note === progNote)) exclude.push({ note: `^${progNote}$`, reason: `${progStages.join(" and ")} carries an all-day radio broadcast, not music sets`, programme: true });
if (rows.some(r => r.note.startsWith(misprint))) exclude.push({ note: `^${misprint}: `, reason: "the page prints this range against its own drawing of the stage (two sets at once, or a slot of another length), so the time cannot be confirmed", misprint: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? r.ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources, ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded) from ${sources.length} pages → ${out}`);
