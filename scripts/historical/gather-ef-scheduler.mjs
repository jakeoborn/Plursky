#!/usr/bin/env node
// gather-ef-scheduler.mjs — a gather folder (sheet.tsv + receipts.json) for an
// Electric Forest edition read from its official 2014-2015 Scheduler (format
// "ef-scheduler", ef-scheduler-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-ef-scheduler.mjs <edition-id> <out-dir> <official-url> <ts> <url> \
//     [--programme-stage <stage>] …
//
// Every set the page draws becomes a sheet row, as printed. A stage row that
// holds only programming (2015's Workshops and The Electric Glen's panels and
// interviews, `--programme-stage`) has its rows excluded. A block whose place
// on the scale disagrees with its printed range is an excluded row, with what
// it prints. Programme entries printed in a music stage's row are kept as rows
// here and dropped by the build (PROGRAMME in editions.mjs).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS, PROGRAMME } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseEfScheduler } from "./ef-scheduler-schedule.mjs";

const argv = process.argv.slice(2), take = flag => { const out = []; for (let i; (i = argv.indexOf(flag)) >= 0;) out.push(argv.splice(i, 2)[1]); return out; };
const progStages = take("--programme-stage");
const [id, out, official, ts, url] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url) {
  console.error("usage: gather-ef-scheduler.mjs <edition-id> <out-dir> <official-url> <ts> <url> [--programme-stage <stage>] …"); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseEfScheduler(cap.text, { year: ed.year, programme: PROGRAMME[id] || [] });
for (const st of progStages) if (!page.days.some(d => d.stages.includes(st))) throw new Error(`${url} @${ts}: no stage "${st}"`);
const ref = `page ${ts}`, rows = [], printed = {};
const progNote = "programming on a stage that holds no music sets", misprint = "printed range disagrees with its block on the scale";
for (const d of page.days) {
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${d.date}, not a day of ${id}`);
  printed[day] = d.label;
  for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: progStages.includes(x.stage) ? progNote : "" });
  for (const x of d.misprints) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: `${misprint}: ${x.misprint}` });
}
const missing = ed.dates.filter((_, i) => !printed[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`${url} @${ts}: does not print ${missing.join(", ")}`);
const exclude = [];
if (rows.some(r => r.note === progNote)) exclude.push({ note: `^${progNote}$`, reason: `${progStages.join(" and ")} hold only workshops, panels and interviews, not music sets`, programme: true });
if (rows.some(r => r.note.startsWith(misprint))) exclude.push({ note: `^${misprint}: `, reason: "the printed range and the block's place on the page's own time scale disagree, so neither time can be confirmed", misprint: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "ef-scheduler", printed,
  ...(progStages.length && { programmeStages: progStages }) };
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
const repeats = page.days.reduce((n, d) => n + d.repeats.length, 0);
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded, ${repeats} drawn twice) → ${out}`);
