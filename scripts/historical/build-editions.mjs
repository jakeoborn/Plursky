#!/usr/bin/env node
// build-editions.mjs — source sheets + ledgers → immutable edition files.
//
//   node scripts/historical/build-editions.mjs [--check]
//
// Reads data/historical/sheets/<id>.tsv (the reviewed source sheet) and
// data/historical/ledger/<id>.json (where every row came from), and writes
// data/historical/editions/<id>.json. An edition with no sheet is emitted as
// lineup_only only if a lineup sheet exists; otherwise it is skipped and
// reported, never guessed. --check rebuilds in memory and fails if a checked-in
// edition file differs (so a hand edit to generated data cannot pass).
//
// These files live apart from data/festivals/ and _DATA_SETS on purpose: a
// historical edition can never become the active festival.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITIONS, dropReason } from "./editions.mjs";
import { slug } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const H = p => join(ROOT, "data/historical", p);

export function readSheet(file) {
  const [head, ...lines] = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const cols = head.split("\t");
  return lines.map(l => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v])));
}

// The key an artist keeps across editions: billing, case- and accent-folded.
// A B2B billing is one set but several performers; each gets its own key so a
// later solo slot joins their history.
export const artistKey = name => slug(name);
export const performerKeys = name => name.split(/\s+(?:B2B|B3B)\s+/i).map(slug).filter(Boolean);

// Printed rows the library does not keep (editions.mjs DROP_RULES/ACTIVITIES),
// with the reason, in sheet order. build writes them to ledger/<id>.json.
export const droppedRows = rows => rows.flatMap(r => {
  const why = dropReason(r.artist, r.stage);
  return why ? [{ day: +r.day, stage: r.stage, start: r.start, end: r.end || null, billing: r.artist, ...why }] : [];
});

export function buildEdition(id, rows, ledger) {
  const ed = EDITIONS[id];
  const stages = [], artists = [], sets = [];
  const stageId = name => {
    let s = stages.find(x => x.name === name);
    if (!s) stages.push(s = { id: `${id}:${slug(name)}`, name });
    return s.id;
  };
  const artistId = name => {
    let a = artists.find(x => x.name === name);
    if (!a) artists.push(a = { id: `${id}:${slug(name)}`, name, key: artistKey(name), performers: performerKeys(name) });
    return a.id;
  };
  for (const r of rows) {
    if (dropReason(r.artist, r.stage)) continue;
    const day = +r.day, stage = stageId(r.stage);
    const base = { day, stageId: stage, start: r.start, end: r.end || null };
    if (r.openEnd === "1") base.openEnd = true;
    sets.push({ id: `${id}:d${day}:${slug(r.stage)}:${r.start.replace(":", "")}:${slug(r.artist)}`, artistId: artistId(r.artist), ...base });
  }
  const days = ed.dates.map(([date, weekday], i) => ({ day: i + 1, date, label: ed.dayLabels?.[i] || weekday }));
  const provenance = {
    extractionMethod: ed.method,
    official: ledger.official,
    captures: ledger.days.filter(d => !d.blocked).map(d => ed.method === "structured_html"
      ? { day: d.day, archivedUrl: d.archivedUrl, captureTimestamp: d.chosen, sha256: d.sha256 }
      : { day: d.day, pageArchivedUrl: d.pageArchivedUrl, pageCapture: d.pageCapture, imageArchivedUrl: d.imageArchivedUrl,
          imageCapture: d.imageCapture, sha256: d.sha256, reviewManifest: `data/historical/review/${id}.json` }),
  };
  return {
    id, festivalId: ed.festivalId, name: ed.name, year: ed.year, timezone: ed.timezone, rolloverHour: ed.rolloverHour,
    completeness: sets.length ? "complete_schedule" : "lineup_only",
    days, stages, artists, sets, provenance,
  };
}

// The library's table of contents: what the Past Festivals list needs to draw
// every edition row without fetching every edition file. Generated, and
// --check fails on drift like the editions themselves.
export function editionIndex(editions) {
  return {
    editions: editions.map(e => ({
      id: e.id, festivalId: e.festivalId, festivalName: e.name.replace(/\s+\d{4}$/, ""), name: e.name, year: e.year,
      timezone: e.timezone, completeness: e.completeness,
      days: e.days.map(d => ({ day: d.day, date: d.date, label: d.label })),
      counts: { stages: e.stages.length, artists: e.artists.length, sets: e.sets.length },
    })).sort((a, b) => a.festivalName.localeCompare(b.festivalName) || b.year - a.year),
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const check = process.argv.includes("--check");
  let bad = 0;
  const built = [];
  mkdirSync(H("editions"), { recursive: true });
  for (const id of Object.keys(EDITIONS)) {
    const sheet = H(`sheets/${id}.tsv`), led = H(`ledger/${id}.json`);
    if (!existsSync(sheet) || !existsSync(led)) { console.log(`  · ${id}: no reviewed sheet yet — not emitted`); continue; }
    const rows = readSheet(sheet), ledger = JSON.parse(readFileSync(led, "utf8"));
    const edition = buildEdition(id, rows, ledger);
    built.push(edition);
    const out = JSON.stringify(edition, null, 1) + "\n";
    const ledOut = JSON.stringify({ ...ledger, dropped: droppedRows(rows) }, null, 2) + "\n";
    const file = H(`editions/${id}.json`);
    if (check) {
      const same = existsSync(file) && readFileSync(file, "utf8") === out;
      if (!same) { bad++; console.error(`  ✗ ${id}: editions/${id}.json is not what its sheet builds — rerun build-editions.mjs`); }
      else console.log(`  ✓ ${id}: generated file matches its sheet`);
      if (readFileSync(led, "utf8") !== ledOut) { bad++; console.error(`  ✗ ${id}: ledger/${id}.json does not record exactly the rows the build drops — rerun build-editions.mjs`); }
    } else {
      writeFileSync(file, out);
      writeFileSync(led, ledOut);
      const e = JSON.parse(out), d = JSON.parse(ledOut).dropped;
      console.log(`  ✓ ${id}: ${e.completeness} · ${e.days.length} days · ${e.stages.length} stages · ${e.artists.length} artists · ${e.sets.length} sets · ${d.length} dropped · ${out.length} B`);
    }
  }
  const idx = JSON.stringify(editionIndex(built), null, 1) + "\n", idxFile = H("index.json");
  if (check) {
    if (!existsSync(idxFile) || readFileSync(idxFile, "utf8") !== idx) { bad++; console.error("  ✗ index.json is not what the editions build — rerun build-editions.mjs"); }
    else console.log(`  ✓ index.json matches ${built.length} editions`);
  } else { writeFileSync(idxFile, idx); console.log(`  ✓ index.json: ${built.length} editions · ${idx.length} B`); }
  process.exit(bad ? 1 : 0);
}
