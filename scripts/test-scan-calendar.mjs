#!/usr/bin/env node
// test-scan-calendar.mjs — the festival-year calendar behind "Scan past
// festivals", and the scan's choice of what to look for.
//
// Jake 2026-11-11: "ensure the scan of the photos and videos can do any
// festival we have and past years specifically like edc 2019 or the times I
// went to das in the past". Node only (no browser): the generated calendar is
// checked against its sources and against the library, and the app's own
// target and on-site functions, lifted from build/photo-tag.js, are run on it.
// The full scan-and-import path runs in the browser in
// scripts/test-past-edition-scan.mjs.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { buildCalendar, parseDates, expandDays, readTsv } from "./historical/build-scan-calendar.mjs";

let n = 0;
const fails = [];
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg); };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

// ── The file is fresh ──────────────────────────────────────────────────────
try {
  execFileSync(process.execPath, ["scripts/historical/build-scan-calendar.mjs", "--check"], { stdio: "pipe" });
  ok(true, "");
} catch (e) {
  ok(false, `calendar --check: ${String(e.stderr || e.stdout || e.message).trim().slice(0, 300)}`);
}

// ── Date parsing ───────────────────────────────────────────────────────────
ok(JSON.stringify(parseDates("2019-05-17..2019-05-19")) === JSON.stringify([["2019-05-17", "2019-05-19"]]), "parseDates: single range");
const two = parseDates("W1 2018-06-21..2018-06-24; W2 2018-06-28..2018-07-01");
ok(two?.length === 2, "parseDates: two weekends");
const twoDays = expandDays(two);
ok(twoDays.length === 8 && twoDays[4].label === "Weekend 2 · Thursday" && twoDays[7].date === "2018-07-01" && twoDays[7].day === 8,
  `expandDays: weekend labels ${JSON.stringify(twoDays.slice(3, 5))}`);
ok(expandDays(parseDates("2015-12-31..2016-01-01"))[1].date === "2016-01-01", "expandDays: a range across New Year");
for (const bad of ["2019-05-19..2019-05-17", "2019-02-30..2019-03-01", "2019-05-17", "W2 2019-05-17..2019-05-19",
  "W1 2019-05-17..2019-05-19; W2 2019-05-18..2019-05-20", "2019-05-01..2019-05-30"]) {
  ok(throws(() => parseDates(bad)), `parseDates accepted "${bad}"`);
}

// ── The calendar ───────────────────────────────────────────────────────────
const { editions: built, skipped } = buildCalendar();
const cal = JSON.parse(readFileSync("data/historical/scan-calendar.json", "utf8")).editions;
const index = JSON.parse(readFileSync("data/historical/index.json", "utf8"));
const byId = new Map(cal.map(e => [e.id, e]));
ok(cal.length === built.length && cal.length >= 300, `calendar: ${cal.length} years (want 300+)`);
ok(new Set(cal.map(e => e.id)).size === cal.length, "calendar: duplicate ids");

const dates = id => (byId.get(id)?.days || []).map(d => d.date).join(",");
const edc = byId.get("edc-las-vegas-2019");
ok(edc && dates("edc-las-vegas-2019") === "2019-05-17,2019-05-18,2019-05-19" && edc.venue === "Las Vegas Motor Speedway" && edc.timezone === "America/Los_Angeles",
  `EDC Las Vegas 2019: ${JSON.stringify(edc)?.slice(0, 200)}`);
const das = byId.get("das-energi-2019");
ok(das && dates("das-energi-2019") === "2019-08-16,2019-08-17" && das.venue === "The Great Saltair" && das.timezone === "America/Denver",
  `Das Energi 2019: ${JSON.stringify(das)?.slice(0, 200)}`);
const dasYears = cal.filter(e => e.festivalId === "das-energi").map(e => e.year);
ok(JSON.stringify(dasYears) === JSON.stringify([2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025, 2026]),
  `Das Energi years: ${dasYears.join(",")} (want 2012-2026 without 2020)`);

// A festival that moved is looked for where it was that year.
const hav = (a, b) => {
  const R = 6371000, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2));
};
const h16 = byId.get("hard-summer-2016"), h24 = byId.get("hard-summer-2024");
ok(h16?.venue === "Auto Club Speedway" && h24?.venue === "Hollywood Park" && hav(h16.gps, h24.gps) > 40000,
  `HARD Summer venue move: 2016 ${h16?.venue}, 2024 ${h24?.venue}`);

// Never a year that did not happen; every census row accounted for.
const prefix = new Map(index.editions.map(e => [e.festivalId, e.id.replace(/-\d{4}$/, "")]));
const idOf = (f, y) => `${prefix.get(f) || f}-${y}`;
const supplement = new Map(readTsv("data/historical/scan-calendar/supplement.tsv").map(r => [`${r.family}-${r.year}`, r]));
let censusRows = 0;
for (const r of readTsv("data/historical/census/coverage-2010-2026.tsv")) {
  censusRows++;
  const lifecycle = supplement.get(`${r.family}-${r.year}`)?.lifecycle || r.lifecycle;
  if (["canceled", "not_founded", "hiatus"].includes(lifecycle)) ok(!byId.has(idOf(r.family, r.year)), `${r.family} ${r.year} is ${lifecycle} but in the calendar`);
}
for (const [id, r] of supplement) if (r.lifecycle === "canceled") ok(!byId.has(idOf(r.family, r.year)), `${id} canceled but in the calendar`);
ok(!byId.has("hard-summer-2020") && !byId.has("das-energi-2020") && !byId.has("lights-all-night-2020"), "a 2020 year that never ran is in the calendar");
const familyYears = new Set([...readTsv("data/historical/census/coverage-2010-2026.tsv").map(r => `${r.family}-${r.year}`), ...supplement.keys()]);
ok(cal.length + skipped.length === familyYears.size, `accounting: ${cal.length} in + ${skipped.length} skipped != ${familyYears.size} family-years (census ${censusRows})`);

// Every library year is in the calendar under the library's own id.
for (const e of index.editions.filter(e => e.status !== "canceled")) {
  ok(byId.has(e.id), `library year ${e.id} missing from the calendar`);
}

// Shape of every entry.
for (const e of cal) {
  const ds = e.days.map(d => d.date);
  ok(e.days.every((d, i) => d.day === i + 1) && ds.every((d, i) => i === 0 || d > ds[i - 1]), `${e.id}: days out of order`);
  ok(e.gps && e.gps.onSiteRadiusMi >= 0.1 && e.gps.onSiteRadiusMi <= 2, `${e.id}: radius`);
  ok(/^[a-z0-9-]+-\d{4}$/.test(e.id) && e.id.endsWith(`-${e.year}`), `${e.id}: id`);
  ok(!("source" in e), `${e.id}: ships a source string (provenance stays in the TSVs)`);
}

// ── The app's scan targets, run on the real calendar ─────────────────────────
function lift(src, names) {
  const out = [];
  for (const name of names) {
    const start = src.search(new RegExp(`function ${name}\\(`));
    if (start < 0) throw new Error(`build has no ${name}`);
    let i = src.indexOf("{", start), depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) break;
    }
    out.push(src.slice(start, i + 1));
  }
  return out.join("\n");
}
const photoTag = readFileSync("build/photo-tag.js", "utf8");
const dataJs = readFileSync("build/data.js", "utf8");
const ctx = vm.createContext({ window: { _DATA_SETS: {} }, Intl, Date, Math, Number, String, Object, Array, Map, Set, JSON, isFinite });
vm.runInContext(`var _OFF_VENUE_MARGIN_M = 500;\n${lift(dataJs, ["_haversineMeters"])}\n${lift(photoTag,
  ["_zonedWallToUtc", "_histMidnightUtc", "_histEditionConfig", "_histFamilyConfig", "_histScanTargets", "_histAssetOnSite"])}`, ctx);
const NOW = Date.UTC(2026, 10, 11);
const targets = ctx._histScanTargets(index, {}, { editions: cal }, NOW);
const tById = new Map(targets.map(t => [t.entry.id, t]));
ok(targets.length >= 300, `targets: ${targets.length} (want 300+)`);
ok(targets.every((t, i) => i === 0 || targets[i - 1].entry.year <= t.entry.year), "targets: not oldest first");
const tEdc = tById.get("edc-las-vegas-2019"), tDas = tById.get("das-energi-2019");
ok(tEdc?.inLibrary === true && tEdc.cfg.dayDates[1].midnightUtc === Date.UTC(2019, 4, 17, 7), `targets: EDC LV 2019 ${JSON.stringify(tEdc?.cfg?.dayDates?.[1])} inLibrary ${tEdc?.inLibrary}`);
ok(tDas?.inLibrary === false && tDas.cfg.historical === true && tDas.cfg.dayDates[1].midnightUtc === Date.UTC(2019, 7, 16, 6),
  `targets: Das Energi 2019 calendar-only, MDT midnight ${JSON.stringify(tDas?.cfg?.dayDates?.[1])}`);
ok(!tById.has("lights-all-night-2026") && tById.has("lights-all-night-2025"), "targets: a year that has not started yet is scanned (or a past one dropped)");
ok(!tById.has("das-energi-2020"), "targets: canceled Das Energi 2020 scanned");
// The library's printed days win over the census (ACL 2013 lost its last day to rain).
ok(tById.get("acl-2013")?.cfg && Object.keys(tById.get("acl-2013").cfg.dayDates).length === index.editions.find(e => e.id === "acl-2013").days.length,
  "targets: a library year scanned on the census's days, not the library's printed ones");
// A library year outside the calendar still scans on its live footprint.
const gps = { lat: 41.8755, lng: -87.6198, onSiteRadiusMi: 0.5 };
const fallback = ctx._histScanTargets({ editions: [index.editions.find(e => e.id === "lollapalooza-2025")] }, { "lollapalooza-2026": { config: { gps } } }, null, NOW);
ok(fallback.length === 1 && fallback[0].inLibrary === true, "targets: library-only fallback lost");
// On site: Saltair, not Salt Lake City; HARD 2016 at Fontana, not Inglewood.
const near = (g, dm) => ({ lat: g.lat + dm / 111320, lng: g.lng, acc: 10 });
ok(ctx._histAssetOnSite(near(das.gps, 100), tDas.cfg) === true && ctx._histAssetOnSite({ lat: 40.7608, lng: -111.891, acc: 10 }, tDas.cfg) === false,
  "on site: Das Energi 2019 footprint wrong");
const t16 = tById.get("hard-summer-2016");
ok(ctx._histAssetOnSite(near(h16.gps, 200), t16.cfg) === true && ctx._histAssetOnSite(near(h24.gps, 0), t16.cfg) === false,
  "on site: HARD Summer 2016 matched Hollywood Park");

for (const f of fails) console.log(`  ✗  ${f}`);
if (fails.length) process.exit(1);
console.log(`  ✓ scan calendar: ${n} checks — ${cal.length} festival years, EDC Las Vegas 2019 and Das Energi 2012–2026 scannable, canceled years never`);
