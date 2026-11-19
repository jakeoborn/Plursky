#!/usr/bin/env node
// gather-dostuff-embed.mjs — a gather folder (sheet.tsv + receipts.json) for
// an edition read from its official lineup widget's embed script (format
// "dostuff-embed", dostuff-embed-schedule.mjs), from the research cache.
// import-gather.mjs then re-reads the script and must agree.
//
//   node scripts/historical/gather-dostuff-embed.mjs <edition-id> <out-dir> <official-url> \
//     <ts> <embed-url> <page-ts> <page-url> [--via <ts> <site-script-url>] \
//     [--food <stage>]... [--comedy <stage>] [--programme <stage>]...
//
// <page-ts> <page-url> is the archived official lineup page that loads the
// script (its <script src> is <embed-url>), captured within a month of it, or
// loads it through the site's own script (`--via`: Outside Lands 2019's
// main.js, which adds the widget's <script> on the lineup route). Every
// performance becomes a sheet row, billed as the widget bills it. Shows on
// the festival's food-and-drink stages (`--food <stage>`, repeatable:
// Outside Lands' GastroMagic and Cocktail Magic) and in its comedy tent
// (`--comedy <stage>`: The Barbary) are excluded rows, as in the years read
// from the schedule grids. Shows on a programme stage
// (`--programme <stage>`, repeatable: Lightning in a Bottle's yoga and
// meditation stages) are excluded rows too: classes, not music sets.
// The edition's days are the run's days the widget prints a set on.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseDoStuffEmbed, embedPageOk, pageLoadsScript, scriptSetsSrc } from "./dostuff-embed-schedule.mjs";

const argv = process.argv.slice(2);
const food = [], prog = [];
for (let fi; (fi = argv.indexOf("--food")) >= 0;) food.push(argv.splice(fi, 2)[1]);
for (let pi; (pi = argv.indexOf("--programme")) >= 0;) prog.push(argv.splice(pi, 2)[1]);
const ci = argv.indexOf("--comedy");
const comedy = ci >= 0 ? argv.splice(ci, 2)[1] : null;
const vi = argv.indexOf("--via");
const via = vi >= 0 ? (([, captureTimestamp, url]) => ({ url, captureTimestamp }))(argv.splice(vi, 3)) : null;
const [id, out, official, ts, url, pageTs, pageUrl] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url || !/^\d{14}$/.test(pageTs || "") || !pageUrl) {
  console.error("usage: gather-dostuff-embed.mjs <edition-id> <out-dir> <official-url> <ts> <embed-url> <page-ts> <page-url> [--via <ts> <site-script-url>] [--food <stage>]... [--comedy <stage>] [--programme <stage>]..."); process.exit(2);
}
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const w = parseDoStuffEmbed(cap.text, { rolloverHour: ed.rolloverHour });
if (w.setDays.join() !== ed.dates.map(([d]) => d).join()) throw new Error(`${url} @${ts}: the widget prints sets on ${w.setDays.join(", ")}, not the days of ${id}`);
const embeddedBy = { url: pageUrl, captureTimestamp: pageTs, ...(via && { via }) };
if (!embedPageOk(ed.festivalId, ts, embeddedBy)) throw new Error(`${pageUrl} @${pageTs}: not ${ed.festivalId}'s official lineup page captured close enough to the script`);
const page = await fetchCapture(pageTs, pageUrl);
if (page.captureTimestamp !== pageTs) throw new Error(`${pageUrl}: Wayback served ${page.captureTimestamp}, not ${pageTs}`);
if (via) {
  const vs = await fetchCapture(via.captureTimestamp, via.url);
  if (vs.captureTimestamp !== via.captureTimestamp || !pageLoadsScript(page.text, via.url, pageUrl) || !scriptSetsSrc(vs.text, url)) throw new Error(`${pageUrl} @${pageTs}: does not load ${url} through ${via.url} @${via.captureTimestamp}`);
} else if (!pageLoadsScript(page.text, url, pageUrl)) throw new Error(`${pageUrl} @${pageTs}: does not load ${url}`);
if (w.timezone !== ed.timezone) throw new Error(`${url} @${ts}: the widget's time zone is ${w.timezone}, not ${ed.timezone}`);
for (const st of [...food, comedy, ...prog].filter(Boolean)) if (!w.stages.includes(st)) throw new Error(`${url} @${ts}: no stage "${st}"`);
const ref = `page ${ts}`, rows = [], printed = {};
for (const [i, [date]] of ed.dates.entries()) {
  const day = i + 1, d = w.days.find(x => x.date === date);
  printed[day] = d.date;
  for (const x of d.sets) rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, note: food.includes(x.stage) ? "food stage" : x.stage === comedy ? "show in the comedy tent" : prog.includes(x.stage) ? "programme stage" : "" });
}
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "dostuff-embed", printed, run: `${w.startDate} to ${w.endDate}`,
  embeddedBy, ...(food.length === 1 && { foodStage: food[0] }), ...(food.length > 1 && { foodStages: food }), ...(comedy && { comedyStage: comedy }), ...(prog.length && { programmeStages: prog }) };
const exclude = [...(food.length === 1 ? [{ note: "^food stage$", reason: `a show on ${food[0]}, the festival's food-and-drink stage (as GastroMagic's in earlier years)`, food: true }] : []),
  ...(food.length > 1 ? [{ note: "^food stage$", reason: `a show on ${food.slice(0, -1).join(", ")} or ${food.at(-1)}, the festival's food-and-drink stages (chef demos, food contests, cocktails with magicians), not music sets`, food: true }] : []),
  ...(comedy ? [{ note: "^show in the comedy tent$", reason: `${comedy} is the festival's comedy tent: its shows are comedy, not music sets`, comedy: true }] : []),
  ...(prog.length ? [{ note: "^programme stage$", reason: `${prog.length > 1 ? prog.slice(0, -1).join(", ") + " and " + prog.at(-1) + " hold" : prog[0] + " holds"} yoga, movement and meditation sessions, not music sets`, programme: true }] : [])];
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded on ${[...food, comedy, ...prog].filter(Boolean).join(", ") || "no food, comedy or programme stage"}) on ${w.stages.length} stages, ${w.drawnTwice.length} drawn twice → ${out}`);
