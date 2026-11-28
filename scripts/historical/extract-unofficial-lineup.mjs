#!/usr/bin/env node
// extract-unofficial-lineup.mjs — a past edition's lineup from an unofficial
// source (unofficial.mjs): a fan-made Clashfinder timetable, an article,
// Wikipedia, a social post or a poster, for years no official page survives.
//
//   node scripts/historical/extract-unofficial-lineup.mjs <edition-id>
//
// Reads <cache>/unofficial/<id>/source.json and source.txt. source.json:
//   { kind, url, title, fetchedAt, fetchedVia, scope: "full"|"partial",
//     format: "clashfinder" | "rows", publisher?, published?, note? }
// format "clashfinder" parses the line-up view (clashfinder.com/m/<event>/):
// each day heading must name one of the edition's dates; each act is billed
// on its day and stage, never with its time. format "rows" reads rows.tsv
// beside it (artist, day, stage; day and stage may be blank), listed by hand
// from the source; a row's day needs `days` in source.json, the words the
// source prints for that day ({ "1": "Friday" }), which must appear in the text.
//
// Every billing must appear in the saved text (billedIn), whatever the
// format. Dates come from the census's dated run for the year (datesFrom).
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITIONS } from "./editions.mjs";
import { sha256 } from "./wayback.mjs";
import { censusRow, runDates, CENSUS } from "./extract-creamfields.mjs";
import { METHOD, readSource, hostOf, billedIn, sourceProblems, parseClashfinder, clashfinderDay } from "./unofficial.mjs";

const readSheet = file => {
  const [head, ...lines] = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const cols = head.split("\t");
  return lines.map(l => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v])));
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function extract(id) {
  const ed = EDITIONS[id];
  if (!ed) throw new Error(`unknown edition ${id}`);
  if (ed.method !== METHOD) throw new Error(`${id} is registered as ${ed.method}, not ${METHOD}`);
  const { meta, text, dir } = readSource(id);
  const dates = ed.dates.map(([d]) => d);
  const cen = censusRow(ed.festivalId, ed.year);
  if (!cen || !["occurred", "scheduled_unverified", "partly_canceled"].includes(cen.lifecycle) || !cen.dates) throw new Error(`${id}: the census has no dated ${ed.year} run for ${ed.festivalId}`);
  const run = runDates(cen.range);
  if (!ed.undated && JSON.stringify(run) !== JSON.stringify(dates)) throw new Error(`${id}: registry dates ${dates.join(",")} are not the census run ${cen.dates}`);
  const source = { kind: meta.kind, site: hostOf(meta.url), url: meta.url, title: meta.title, ...(meta.publisher && { publisher: meta.publisher }),
    ...(meta.published && { published: meta.published }), fetchedAt: meta.fetchedAt, fetchedVia: meta.fetchedVia, scope: meta.scope,
    sha256: sha256(Buffer.from(text, "utf8")), bytes: Buffer.byteLength(text, "utf8") };
  const bad = sourceProblems(source, id);
  if (bad.length) throw new Error(bad.join("\n"));

  let rows, stageOrder = [], printed;
  if (meta.format === "clashfinder") {
    if (source.site !== "clashfinder.com" || !/^https:\/\/clashfinder\.com\/m\/[\w-]+\/$/.test(source.url)) throw new Error(`${id}: a Clashfinder source must be a line-up view (clashfinder.com/m/<event>/)`);
    const page = parseClashfinder(text);
    if (!page.title.includes(String(ed.year)) && !page.title.includes(`'${String(ed.year).slice(2)}`)) throw new Error(`${id}: the timetable's title "${page.title}" does not name ${ed.year}`);
    rows = [];
    printed = { title: page.title, days: page.days.map(d => d.heading) };
    for (const d of page.days) {
      const day = clashfinderDay(d.heading, dates);
      if (!day) { if (d.stages.some(s => s.acts.length)) throw new Error(`${id}: day "${d.heading}" is not one of the edition's dates (${dates.join(", ")})`); continue; }
      for (const s of d.stages) {
        if (s.acts.length && !stageOrder.includes(s.name)) stageOrder.push(s.name);
        for (const a of s.acts) rows.push({ artist: a.act, day, stage: s.name });
      }
    }
    for (let i = 1; i <= dates.length; i++) if (!rows.some(r => r.day === i)) throw new Error(`${id}: the timetable prints no act on day ${i} (${dates[i - 1]})`);
  } else if (meta.format === "rows") {
    const file = join(dir, "rows.tsv");
    if (!existsSync(file)) throw new Error(`${id}: format rows needs ${file}`);
    rows = readSheet(file).map(r => ({ artist: (r.artist || "").trim(), day: r.day ? +r.day : "", stage: (r.stage || "").trim() }));
    for (const r of rows) {
      if (!r.artist) throw new Error(`${id}: a row has no artist`);
      if (r.day !== "" && !(Number.isInteger(r.day) && r.day >= 1 && r.day <= dates.length)) throw new Error(`${id}: ${r.artist} is on day ${r.day}, the edition has ${dates.length}`);
      if (r.day !== "" && !billedIn(text, meta.days?.[r.day] || "\u0000")) throw new Error(`${id}: day ${r.day} has no printed name in the source (source.json days)`);
      if (r.stage && !billedIn(text, r.stage)) throw new Error(`${id}: stage "${r.stage}" is not in the source text`);
      if (r.stage && !stageOrder.includes(r.stage)) stageOrder.push(r.stage);
    }
    printed = { days: meta.days || null };
    if (!ed.undated) for (let i = 1; i <= dates.length; i++) if (!rows.some(r => r.day === i)) throw new Error(`${id}: no row is on day ${i}; a source that prints no days makes an undated edition`);
    if (ed.undated && rows.some(r => r.day !== "")) throw new Error(`${id}: undated, but a row carries a day`);
  } else throw new Error(`${id}: unknown source format "${meta.format}"`);

  const missing = rows.filter(r => !billedIn(text, r.artist));
  if (missing.length) throw new Error(`${id}: not in the source text: ${[...new Set(missing.map(r => r.artist))].join("; ")}`);
  if (!rows.length) throw new Error(`${id}: no rows`);
  // One row per billing, day and stage, in source order.
  const seen = new Set();
  rows = rows.filter(r => { const k = `${r.day}|${r.stage}|${r.artist}`; return !seen.has(k) && seen.add(k); });

  const ledger = { id, method: METHOD, format: meta.format, source, printed,
    datesFrom: { census: CENSUS, family: cen.family, year: ed.year, lifecycle: cen.lifecycle, dates: cen.dates, evidence: cen.evidence_url, published: cen.published },
    ...(meta.note && { note: meta.note }),
    verified: { billings: new Set(rows.map(r => r.artist)).size, inSourceText: true },
    stageOrder };
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2];
  if (!id) { console.error("usage: extract-unofficial-lineup.mjs <edition-id>"); process.exit(2); }
  const { ledger, rows } = extract(id);
  const H = p => join(ROOT, "data/historical", p);
  mkdirSync(H("sheets"), { recursive: true }); mkdirSync(H("ledger"), { recursive: true });
  writeFileSync(H(`sheets/${id}.lineup.tsv`), ["artist\tday\tstage", ...rows.map(r => `${r.artist}\t${r.day}\t${r.stage}`)].join("\n") + "\n");
  writeFileSync(H(`ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  console.log(`${id}: ${ledger.verified.billings} acts, ${rows.length} billings, ${ledger.stageOrder.length} stages, from ${ledger.source.site}`);
}
