#!/usr/bin/env node
// gather-shambhala-webflow.mjs — a gather folder (sheet.tsv + receipts.json)
// for a Shambhala edition read from its official 2024-2025 set-times pages
// (format "shambhala-webflow", shambhala-webflow-schedule.mjs: one page per
// weekday, no date printed), from the research cache. import-gather.mjs then
// re-reads every page and the dated post and must agree.
//
//   node scripts/historical/gather-shambhala-webflow.mjs <edition-id> <out-dir> <official-url> \
//     --dates <ts> <url> <ts> <url> [<ts> <url> …] [--stage-by-logo <class>=<name>] …
//
// The day of each page is its printed weekday, dated by the festival's own
// announcement (`--dates`, a post on its blog that prints the run, "July
// 26-29, 2024"). Every set a page prints becomes a sheet row, as printed. Two
// acts drawn in one slot, or a block whose readings disagree, are excluded
// rows with what each prints. A block drawn more than once is one set (the
// ledger counts it), and a mystery set printed only as question marks names
// no act (the ledger keeps it). Workshops in the Secret Garden's daytime are
// kept as rows here and dropped by the build (PROGRAMME in editions.mjs).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseShambhalaWebflow, readDatesPost } from "./shambhala-webflow-schedule.mjs";

const argv = process.argv.slice(2);
const take = (flag, n = 1) => { const out = []; for (let i; (i = argv.indexOf(flag)) >= 0;) out.push(argv.splice(i, n + 1).slice(1)); return out; };
const datesArg = take("--dates", 2), logoArg = take("--stage-by-logo");
const stageByLogo = Object.fromEntries(logoArg.map(([x]) => { const i = x.indexOf("="); if (i < 1) throw new Error(`--stage-by-logo ${x}: want <class>=<name>`); return [x.slice(0, i), x.slice(i + 1)]; }));
const [id, out, official, ...pages] = argv;
const ed = EDITIONS[id];
if (!ed || !out || !official || datesArg.length !== 1 || !pages.length || pages.length % 2) {
  console.error("usage: gather-shambhala-webflow.mjs <edition-id> <out-dir> <official-url> --dates <ts> <url> <ts> <url> [<ts> <url> …] [--stage-by-logo <class>=<name>] …"); process.exit(2);
}
const [[dts, durl]] = datesArg;
const dcap = await fetchCapture(dts, durl);
if (dcap.captureTimestamp !== dts) throw new Error(`${durl}: Wayback served ${dcap.captureTimestamp}, not ${dts}`);
const post = readDatesPost(dcap.text, ed.year);
const datesFrom = { url: durl, captureTimestamp: dts, printed: post.printed };

const rows = [], sources = [];
const misprint = "printed block cannot be confirmed";
for (let i = 0; i < pages.length; i += 2) {
  const [ts, url] = pages.slice(i, i + 2);
  const cap = await fetchCapture(ts, url);
  if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
  const d = parseShambhalaWebflow(cap.text, { year: ed.year, stageByLogo });
  const date = post.days[d.weekday];
  const day = ed.dates.findIndex(([x]) => x === date) + 1;
  if (!date || !day) throw new Error(`${url} @${ts}: prints ${d.weekday}, which the post dates ${date || "nowhere"}, not a day of ${id}`);
  if (sources.some(s => s.printed[day])) throw new Error(`${id}: two pages print ${d.weekday}`);
  // Several days can be captured in one second (2025), so a row cites its page by both.
  const ref = `page ${ts} ${new URL(url).pathname}`;
  for (const x of d.sets) rows.push({ day, date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, ref, note: "" });
  for (const x of d.misprints) rows.push({ day, date, stage: x.stage, start: x.start, end: x.end, artist: x.artist, ref, note: `${misprint}: ${x.misprint}` });
  sources.push({ kind: "page", match: ref, url, captureTimestamp: ts, format: "shambhala-webflow", printed: { [day]: d.weekday }, published: d.published, datesFrom,
    ...(Object.keys(stageByLogo).length && { stageByLogo }) });
}
const missing = ed.dates.filter((_, i) => !sources.some(s => s.printed[i + 1])).map(([d]) => d);
if (missing.length) throw new Error(`${id}: no page prints ${missing.join(", ")}`);
const exclude = [];
if (rows.some(r => r.note.startsWith(misprint))) exclude.push({ note: `^${misprint}: `, reason: "the page draws two acts in one stage's slot, or prints a range its own block does not show, so neither the act nor the time can be confirmed", misprint: true });
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? r.ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources, ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded) from ${sources.length} pages, dated by "${post.printed}" → ${out}`);
