#!/usr/bin/env node
// build-scan-calendar.mjs — the calendar the past-photo scan matches against.
//
// The Past Festivals library (data/historical/index.json) only holds years whose
// lineup has been read from an archived official page. A camera roll reaches
// much further back: EDC Las Vegas 2019, Das Energi 2016. To find those photos
// the scan needs only WHEN a festival year ran and WHERE, not who played.
//
// Inputs (all hand-kept, every row sourced):
//   data/historical/census/coverage-2010-2026.tsv  dates + venue per family-year
//                                                  (owned by the lineup census;
//                                                  read here, never edited)
//   data/historical/scan-calendar/supplement.tsv   fills census blanks and adds
//                                                  families the census lacks
//   data/historical/scan-calendar/venues.tsv       venue name → GPS + on-site radius
//   data/historical/scan-calendar/families.tsv     family → display name + time zone
//
// Output: data/historical/scan-calendar.json — one entry per festival year that
// has dates and a located venue, skipping canceled, not-yet-founded and hiatus
// years. Ids follow the library's own (`edc-las-vegas-2019`). It ships in the app, so it carries only what the scan reads; every
// row's source stays in the TSVs above. Ids are `${family}-${year}`, the same ids the library uses, so photos
// tagged to a calendar-only year join its lineup page once that year is added.
//
//   node scripts/historical/build-scan-calendar.mjs           write the file
//   node scripts/historical/build-scan-calendar.mjs --check   fail if stale/invalid
//   node scripts/historical/build-scan-calendar.mjs --report  list skipped years
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, "data", "historical", "scan-calendar");
const CENSUS = path.join(ROOT, "data", "historical", "census", "coverage-2010-2026.tsv");
const INDEX = path.join(ROOT, "data", "historical", "index.json");
const OUT = path.join(ROOT, "data", "historical", "scan-calendar.json");

const SKIP_LIFECYCLES = new Set(["canceled", "not_founded", "hiatus"]);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_WEEKEND_DAYS = 12; // Summerfest runs ~11 days in one block

export function readTsv(file) {
  const lines = readFileSync(file, "utf8").split("\n").filter(l => l.trim() && !l.startsWith("#"));
  const head = lines[0].split("\t");
  return lines.slice(1).map((l, i) => {
    const cells = l.split("\t");
    const row = { _line: i + 2 };
    head.forEach((h, j) => { row[h] = (cells[j] ?? "").trim(); });
    return row;
  });
}

export const normVenue = s => String(s || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
const addDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const weekday = iso => WEEKDAYS[new Date(iso + "T12:00:00Z").getUTCDay()];

// "2019-05-17..2019-05-19" or "W1 a..b; W2 c..d[; W3 e..f]" → [[start, end], ...]
export function parseDates(s) {
  const text = String(s || "").trim();
  if (!text) return null;
  const parts = text.split(";").map(p => p.trim()).filter(Boolean);
  const blocks = [];
  for (const [i, p] of parts.entries()) {
    const m = /^(?:W(\d)\s+)?(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(p);
    if (!m) throw new Error(`unreadable dates "${text}"`);
    if (parts.length > 1 && +m[1] !== i + 1) throw new Error(`weekend numbering in "${text}"`);
    if (parts.length === 1 && m[1]) throw new Error(`single weekend tagged W${m[1]} in "${text}"`);
    const [, , a, b] = m;
    if (!isIso(a) || !isIso(b) || a > b) throw new Error(`bad range ${a}..${b}`);
    const span = Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
    if (span > MAX_WEEKEND_DAYS) throw new Error(`range ${a}..${b} is ${span} days`);
    if (blocks.length && a <= blocks.at(-1)[1]) throw new Error(`weekends overlap in "${text}"`);
    blocks.push([a, b]);
  }
  return blocks;
}

export function expandDays(blocks) {
  const days = [];
  blocks.forEach(([a, b], w) => {
    for (let d = a; d <= b; d = addDays(d, 1)) {
      const label = blocks.length > 1 ? `Weekend ${w + 1} · ${weekday(d)}` : weekday(d);
      days.push({ day: days.length + 1, date: d, label });
    }
  });
  return days;
}

export function loadVenues() {
  const map = new Map();
  for (const r of readTsv(path.join(DIR, "venues.tsv"))) {
    const lat = +r.lat, lng = +r.lng, radius = +r.radiusMi;
    const where = `venues.tsv:${r._line}`;
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || !r.lat || !r.lng) throw new Error(`${where} bad coordinates`);
    if (!(radius >= 0.1 && radius <= 2)) throw new Error(`${where} radius ${r.radiusMi} outside 0.1–2 mi`);
    if (!r.source) throw new Error(`${where} has no source`);
    const names = r.names.split("|").map(s => s.trim()).filter(Boolean);
    if (!names.length) throw new Error(`${where} has no name`);
    const venue = { name: names[0], gps: { lat, lng, onSiteRadiusMi: radius }, source: r.source };
    for (const n of names) {
      const k = normVenue(n);
      if (map.has(k)) throw new Error(`${where} venue name "${n}" listed twice`);
      map.set(k, venue);
    }
  }
  return map;
}

export function loadFamilies() {
  const fams = new Map();
  for (const r of readTsv(path.join(DIR, "families.tsv"))) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: r.tz }); }
    catch { throw new Error(`families.tsv:${r._line} unknown time zone "${r.tz}"`); }
    if (!/^[a-z0-9-]+$/.test(r.family) || !r.name) throw new Error(`families.tsv:${r._line} bad row`);
    if (fams.has(r.family)) throw new Error(`families.tsv:${r._line} ${r.family} listed twice`);
    fams.set(r.family, { name: r.name, tz: r.tz });
  }
  return fams;
}

export function buildCalendar() {
  const venues = loadVenues();
  const families = loadFamilies();
  // The library is the naming authority. Its edition ids are not always
  // `${festivalId}-${year}` (EDC Las Vegas is festivalId "edc-lv", editions
  // "edc-las-vegas-2019"), and a calendar year must carry the id its lineup
  // will have, so photos filed under it land on that page once it is added.
  const libraryNames = new Map();
  const idPrefix = new Map();
  const libraryDays = new Map();
  if (existsSync(INDEX)) {
    for (const e of JSON.parse(readFileSync(INDEX, "utf8")).editions || []) {
      if (!e.festivalId) continue;
      if (e.festivalName) libraryNames.set(e.festivalId, e.festivalName);
      const m = /^(.*)-(\d{4})$/.exec(e.id || "");
      if (!m || +m[2] !== e.year) throw new Error(`index.json edition ${e.id} does not end in its year`);
      if (idPrefix.has(e.festivalId) && idPrefix.get(e.festivalId) !== m[1]) throw new Error(`index.json festival ${e.festivalId} uses two id prefixes`);
      idPrefix.set(e.festivalId, m[1]);
      if (e.status !== "canceled" && Array.isArray(e.days) && e.days.length) libraryDays.set(`${e.festivalId}-${e.year}`, e.days);
    }
  }

  const rows = new Map(); // id → merged row
  for (const r of readTsv(CENSUS)) {
    const id = `${r.family}-${r.year}`;
    rows.set(id, { family: r.family, year: +r.year, lifecycle: r.lifecycle, dates: r.dates, venue: r.venue, source: r.evidence_url, from: "census" });
  }
  const supplementSeen = new Set();
  for (const s of readTsv(path.join(DIR, "supplement.tsv"))) {
    const id = `${s.family}-${s.year}`;
    const where = `supplement.tsv:${s._line} ${id}`;
    if (supplementSeen.has(id)) throw new Error(`${where} listed twice`);
    supplementSeen.add(id);
    if (!s.source) throw new Error(`${where} has no source`);
    const base = rows.get(id);
    if (!base) {
      if (!s.lifecycle) throw new Error(`${where} adds a year the census lacks, so it must give a lifecycle`);
      rows.set(id, { family: s.family, year: +s.year, lifecycle: s.lifecycle, dates: s.dates, venue: s.venue, source: s.source, from: "supplement" });
      continue;
    }
    const merged = { ...base };
    if (s.lifecycle && s.lifecycle !== base.lifecycle) throw new Error(`${where} lifecycle ${s.lifecycle} contradicts census ${base.lifecycle}`);
    if (s.dates) {
      if (base.dates && base.dates !== s.dates) throw new Error(`${where} dates ${s.dates} contradict census ${base.dates}`);
      merged.dates = s.dates;
    }
    if (s.venue) {
      // A supplement may name a venue the census left blank, or replace a census
      // venue too vague to locate ("Miami, FL"). It may not move a located one.
      if (base.venue && venues.has(normVenue(base.venue)) && normVenue(base.venue) !== normVenue(s.venue)) {
        throw new Error(`${where} venue ${s.venue} contradicts located census venue ${base.venue}`);
      }
      merged.venue = s.venue;
    }
    if (s.dates || s.venue) merged.source = merged.source ? `${merged.source} + ${s.source}` : s.source;
    merged.from = "census+supplement";
    rows.set(id, merged);
  }

  const editions = [];
  const skipped = [];
  for (const [id, r] of [...rows].sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[a-z0-9-]+$/.test(r.family) || !(r.year >= 2000 && r.year <= 2100)) throw new Error(`${id} bad family/year`);
    const fam = families.get(r.family);
    if (!fam) throw new Error(`${id}: family ${r.family} missing from families.tsv`);
    if (SKIP_LIFECYCLES.has(r.lifecycle)) { skipped.push({ id, reason: r.lifecycle }); continue; }
    const blocks = parseDates(r.dates);
    // A year whose lineup is in the library has its printed days there; they
    // fill a census row that has no dates (Escape Halloween 2017).
    const libDays = libraryDays.get(id);
    const days = blocks ? expandDays(blocks) : libDays ? libDays.map(d => ({ day: d.day, date: d.date, label: d.label })) : null;
    const venue = r.venue ? venues.get(normVenue(r.venue)) : null;
    if (!days && !venue) { skipped.push({ id, reason: "no dates or venue yet" }); continue; }
    if (!days) { skipped.push({ id, reason: "no dates yet" }); continue; }
    if (!venue) { skipped.push({ id, reason: r.venue ? `venue "${r.venue}" not located` : "no venue yet" }); continue; }
    if (+days[0].date.slice(0, 4) !== r.year && +days.at(-1).date.slice(0, 4) !== r.year) throw new Error(`${id} dates ${r.dates} are not in ${r.year}`);
    const festivalName = libraryNames.get(r.family) || fam.name;
    editions.push({
      id: `${idPrefix.get(r.family) || r.family}-${r.year}`, festivalId: r.family, festivalName, name: `${festivalName} ${r.year}`, year: r.year,
      timezone: fam.tz, days, venue: venue.name, gps: venue.gps,
    });
  }
  return { editions, skipped };
}

export function serialize(editions) {
  // One edition per line keeps diffs readable when a year is added.
  return `{"editions":[\n${editions.map(e => JSON.stringify(e)).join(",\n")}\n]}\n`;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv[2] || "";
  let built;
  try { built = buildCalendar(); }
  catch (e) { console.error(`  ✗ scan calendar: ${e.message}`); process.exit(1); }
  const text = serialize(built.editions);
  if (mode === "--check") {
    const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (cur !== text) {
      console.error("  ✗ data/historical/scan-calendar.json is stale — run node scripts/historical/build-scan-calendar.mjs");
      process.exit(1);
    }
    console.log(`  ✓ scan calendar: ${built.editions.length} festival years located, ${built.skipped.length} skipped`);
  } else if (mode === "--report") {
    for (const s of built.skipped) console.log(`${s.id}\t${s.reason}`);
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${path.relative(ROOT, OUT)}: ${built.editions.length} years, ${built.skipped.length} skipped`);
  }
}
