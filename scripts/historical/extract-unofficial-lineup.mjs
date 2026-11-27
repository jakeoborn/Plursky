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
// Day numbers in the source (rows.tsv `day`, source.json `days`, Clashfinder
// headings) count over that whole run. A day the festival cancelled is
// registered in `cancelledDays` (date, weekday, reason and a saved article
// that says so, cancelled-<date>.txt beside the source, quoting it); it is
// left out of the edition's dates and every billing on it is dropped, so no
// act is credited with a day that never happened. The first or last day of
// the run may carry no acts (an arrival or departure day); a day between
// them may not; such an empty day is left out of the registry's dates.
// An act printed two ways that read as one name (Sven Väth / Sven Vath) is
// kept under its first spelling; the ledger lists the other (`spellings`).
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITIONS } from "./editions.mjs";
import { sha256 } from "./wayback.mjs";
import { censusRow, runDates, CENSUS } from "./extract-creamfields.mjs";
import { METHOD, readSource, hostOf, billedIn, sourceProblems, parseClashfinder, clashfinderDay } from "./unofficial.mjs";
import { slug } from "./lib.mjs";

const readSheet = file => {
  const [head, ...lines] = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const cols = head.split("\t");
  return lines.map(l => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v])));
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Each registered cancelled day: a date in the run, and a saved article
// (cancelled-<date>.txt) that quotes the cancellation.
function cancelledDays(id, ed, run) {
  return (ed.cancelledDays || []).map(c => {
    const s = c.source || {};
    if (!run.includes(c.date)) throw new Error(`${id}: cancelled day ${c.date} is not in the census run`);
    const wd = new Date(c.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    if (c.weekday !== wd) throw new Error(`${id}: cancelled day ${c.date} is a ${wd}, not ${c.weekday}`);
    if (!c.reason) throw new Error(`${id}: cancelled day ${c.date} has no reason`);
    if (!/^https:\/\/[^/\s]+\/\S*$/.test(s.url || "") || !s.title || !s.publisher || !/^\d{4}-\d{2}-\d{2}$/.test(s.published || "") || !/^\d{4}-\d{2}-\d{2}$/.test(s.fetchedAt || ""))
      throw new Error(`${id}: cancelled day ${c.date} needs a source with an https url, title, publisher, published and fetchedAt`);
    if (s.published < c.date) throw new Error(`${id}: cancelled day ${c.date}: the source was published ${s.published}, before the day`);
    const file = join(readSource(id).dir, `cancelled-${c.date}.txt`);
    if (!existsSync(file)) throw new Error(`${id}: cancelled day ${c.date} needs the article saved as ${file}`);
    const text = readFileSync(file, "utf8");
    if (!c.quote || !billedIn(text, c.quote)) throw new Error(`${id}: cancelled day ${c.date}: the quote is not in the saved article`);
    return { date: c.date, weekday: c.weekday, reason: c.reason, quote: c.quote,
      source: { url: s.url, site: hostOf(s.url), title: s.title, publisher: s.publisher, published: s.published, fetchedAt: s.fetchedAt,
        sha256: sha256(Buffer.from(text, "utf8")) } };
  });
}

// Every edition day carries an act, and a run day left out of the edition
// (an empty arrival or departure day) carries none.
function everyDay(id, rows, run, cancelled, kept) {
  run.forEach((d, i) => {
    if (cancelled.some(c => c.date === d)) return;
    const has = rows.some(r => r.day === i + 1);
    if (kept.includes(d) && !has) throw new Error(`${id}: no act is on day ${i + 1} (${d}); an empty first or last day is left out of the registry's dates`);
    if (!kept.includes(d) && has) throw new Error(`${id}: acts are billed on ${d}, which the registry leaves out`);
  });
}

export function extract(id) {
  const ed = EDITIONS[id];
  if (!ed) throw new Error(`unknown edition ${id}`);
  if (ed.method !== METHOD) throw new Error(`${id} is registered as ${ed.method}, not ${METHOD}`);
  const { meta, text, dir } = readSource(id);
  const cen = censusRow(ed.festivalId, ed.year);
  if (!cen || !["occurred", "scheduled_unverified", "partly_canceled"].includes(cen.lifecycle) || !cen.dates) throw new Error(`${id}: the census has no dated ${ed.year} run for ${ed.festivalId}`);
  const run = runDates(cen.range);
  // `dates` below is the whole run: source day numbers count over it.
  const dates = run;
  const cancelled = cancelledDays(id, ed, run);
  const ran = run.filter(d => !cancelled.some(c => c.date === d));
  // The registry's dates: the days that ran, less at most an empty first and
  // an empty last day (checked against the rows below).
  const kept = ed.dates.map(([d]) => d);
  const trims = [ran, ran.slice(1), ran.slice(0, -1), ran.slice(1, -1)];
  if (!ed.undated && !trims.some(t => t.length && JSON.stringify(t) === JSON.stringify(kept))) throw new Error(`${id}: registry dates ${kept.join(",")} are not the census run ${cen.dates}${cancelled.length ? ` without its cancelled days` : ""} (only an empty first or last day may be left out)`);
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
    everyDay(id, rows, dates, cancelled, kept);
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
    if (!ed.undated) everyDay(id, rows, dates, cancelled, kept);
    if (ed.undated && rows.some(r => r.day !== "")) throw new Error(`${id}: undated, but a row carries a day`);
  } else throw new Error(`${id}: unknown source format "${meta.format}"`);

  const missing = rows.filter(r => !billedIn(text, r.artist));
  if (missing.length) throw new Error(`${id}: not in the source text: ${[...new Set(missing.map(r => r.artist))].join("; ")}`);
  if (!rows.length) throw new Error(`${id}: no rows`);
  // One spelling per name: the first the source prints.
  const first = new Map(), spellings = {};
  for (const r of rows) {
    const k = slug(r.artist);
    if (!first.has(k)) first.set(k, r.artist);
    else if (first.get(k) !== r.artist) { spellings[r.artist] = first.get(k); r.artist = first.get(k); }
  }
  // Billings on a cancelled day are dropped; the rest renumbered over the
  // days that ran.
  for (const c of cancelled) {
    const i = run.indexOf(c.date) + 1;
    c.dropped = rows.filter(r => r.day === i).length;
  }
  rows = rows.filter(r => r.day === "" || !cancelled.some(c => c.date === run[r.day - 1]))
    .map(r => r.day === "" ? r : { ...r, day: kept.indexOf(run[r.day - 1]) + 1 });
  const emptyDays = ed.undated ? [] : run.filter(d => !kept.includes(d) && !cancelled.some(c => c.date === d));
  // One row per billing, day and stage, in source order.
  const seen = new Set();
  rows = rows.filter(r => { const k = `${r.day}|${r.stage}|${r.artist}`; return !seen.has(k) && seen.add(k); });

  const ledger = { id, method: METHOD, format: meta.format, source, printed,
    datesFrom: { census: CENSUS, family: cen.family, year: ed.year, lifecycle: cen.lifecycle, dates: cen.dates, evidence: cen.evidence_url, published: cen.published },
    ...(meta.note && { note: meta.note }),
    ...(cancelled.length && { cancelledDays: cancelled }),
    ...(emptyDays.length && { emptyDays }),
    ...(Object.keys(spellings).length && { spellings }),
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
