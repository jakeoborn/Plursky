#!/usr/bin/env node
// gather-sonar-schedule.mjs — a gather folder (sheet.tsv + receipts.json) for
// a Sónar Barcelona edition read from the festival's own timetable page
// (format "sonar-calendar", sonar-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads the page and must agree.
//
//   node scripts/historical/gather-sonar-schedule.mjs <edition-id> <out-dir> <official-url> \
//     <ts> <page-url> [--programme <stage>]...
//
// The page prints every session of the edition, each a dated calendar
// (Sónar by Day, Sónar by Night). Every set becomes a sheet row on its
// calendar's date; a day's printed label is its sessions' headings, Day
// before Night. Entries on a programme stage (`--programme <stage>`,
// repeatable: 2022's Sónar+D stages) are excluded rows: talks, masterclasses
// and installations, not music sets.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseSonarSchedule } from "./sonar-schedule.mjs";

const argv = process.argv.slice(2);
const prog = [];
for (let pi; (pi = argv.indexOf("--programme")) >= 0;) prog.push(argv.splice(pi, 2)[1]);
const [id, out, official, ts, url] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || !/^\d{14}$/.test(ts || "") || !url) {
  console.error("usage: gather-sonar-schedule.mjs <edition-id> <out-dir> <official-url> <ts> <page-url> [--programme <stage>]..."); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseSonarSchedule(cap.text, { year: ed.year, programme: prog });
if (page.days.map(d => d.date).join() !== ed.dates.map(([d]) => d).join()) throw new Error(`${url} @${ts}: prints ${page.days.map(d => d.date).join(", ")}, not the days of ${id}`);
for (const st of prog) if (!page.stages.includes(st)) throw new Error(`${url} @${ts}: no stage "${st}"`);
const ref = `page ${ts}`, rows = [], printed = {};
for (const [i, d] of page.days.entries()) {
  const day = i + 1;
  printed[day] = d.label;
  for (const x of [...d.sets].sort((a, b) => a.stage.localeCompare(b.stage) || a.from - b.from))
    rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: x.programme ? "programme stage" : "" });
}
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "sonar-calendar", printed, ...(prog.length && { programmeStages: prog }) };
const exclude = prog.length ? [{ note: "^programme stage$", reason: `${prog.slice(0, -1).join(", ")}${prog.length > 1 ? " and " : ""}${prog.at(-1)} ${prog.length > 1 ? "are" : "is"} Sónar+D's programme: talks, masterclasses and installations, not music sets`, programme: true }] : [];
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded on ${prog.join(", ") || "no programme stage"}) on ${page.stages.length} stages over ${page.days.length} days → ${out}`);
