#!/usr/bin/env node
// Escape Halloween 2026: the official set times, as shipped.
//
// Source: escapehalloween.com/lineup/set-times/day-1/ and /day-2/, read
// 2026-10-26 (118 sets, 7 stages, Fri 58 / Sat 60). Every number below is
// the official page's, not the module's: a drifted module fails here.
//   1. counts: 118 sets, per day, per stage, per day x stage;
//   2. every act timed, staged and dayed, no provisional left, ids unique;
//   3. closes: every stage 02:00 both nights, Saturday's Warehouse 01:40;
//   4. names as printed, oddities included, and the two Saturday repeats;
//   5. absolute instants: every set resolves through _wallMs to its PDT
//      reading (lane ruling: venue-local Pacific, UTC-7 both nights), with
//      literal instants from an independent browser read pinned;
//   6. acts also billed at an EDC edition are the same printed name there.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = {
  window: {}, console, Date, Math, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat, Intl,
  fetch: () => {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
vm.createContext(ctx);
const mods = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
vm.runInContext(mods + "\n" + readFileSync(join(ROOT, "data.jsx"), "utf8") +
  "\n;__out = { REG: FESTIVALS_REGISTRY, DS: _DATA_SETS, _wallMs };", ctx);
const { REG, DS, _wallMs } = ctx.__out;

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const ID = "escape-halloween-2026";
const ds = DS[ID], cfg = ds.config, reg = REG.find(e => e.config.id === ID);
const acts = ds.artists;
const stageName = Object.fromEntries(ds.stages.map(s => [s.id, s.name]));

// ── 1. Counts (official pages) ───────────────────────────────────────────
const OFFICIAL = {
  1: { "The Big Top": 9, "Sewer District": 10, "Feeding Grounds": 10, "The Cage": 6, "The Warehouse": 7, "Danse Macabre": 10, "Beatbox Art Car": 6 },
  2: { "The Big Top": 9, "Sewer District": 11, "Feeding Grounds": 8, "The Cage": 7, "The Warehouse": 8, "Danse Macabre": 10, "Beatbox Art Car": 7 },
};
check(acts.length === 118, `118 sets, got ${acts.length}`);
check(acts.filter(a => a.day === 1).length === 58, `Friday 58 sets, got ${acts.filter(a => a.day === 1).length}`);
check(acts.filter(a => a.day === 2).length === 60, `Saturday 60 sets, got ${acts.filter(a => a.day === 2).length}`);
check(ds.stages.length === 7, `7 stages, got ${ds.stages.length}`);
check(JSON.stringify(cfg.officialStages) === JSON.stringify(ds.stages.map(s => s.name)), `officialStages must list the 7 stage names in STAGES order`);
for (const d of [1, 2]) for (const [name, n] of Object.entries(OFFICIAL[d])) {
  const got = acts.filter(a => a.day === d && stageName[a.stage] === name).length;
  check(got === n, `day ${d} ${name}: ${n} sets, got ${got}`);
}

// ── 2. Every act complete ────────────────────────────────────────────────
check(new Set(acts.map(a => a.id)).size === acts.length, `act ids are unique`);
for (const a of acts) {
  check(/^\d\d:\d\d$/.test(a.start) && /^\d\d:\d\d$/.test(a.end), `${a.id}: start/end must be HH:MM, got "${a.start}"–"${a.end}"`);
  check(a.stage in stageName, `${a.id}: stage "${a.stage}" is not an Escape stage`);
  check(a.day === 1 || a.day === 2, `${a.id}: day ${a.day}`);
  check(!a.provisional && !a.unscheduled, `${a.id}: still provisional/unscheduled`);
}
check(reg && reg.available === true && reg.scheduleTBA === false, `registry: available, scheduleTBA false`);
check(cfg.scheduleSource?.official === true && /escapehalloween\.com\/lineup\/set-times\//.test(cfg.scheduleSource.url), `scheduleSource cites the official set-times page`);

// ── 3. Closes ────────────────────────────────────────────────────────────
const nightMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
for (const d of [1, 2]) for (const s of ds.stages) {
  const list = acts.filter(a => a.day === d && a.stage === s.id).sort((x, y) => nightMin(x.start) - nightMin(y.start));
  const want = d === 2 && s.id === "warehouse" ? "01:40" : "02:00";
  check(list.length && list[list.length - 1].end === want, `day ${d} ${s.name} closes ${want}, got ${list.length ? list[list.length - 1].end : "nothing"}`);
  check(list.length && list[0].start === "16:00", `day ${d} ${s.name} opens 16:00 (gates 4PM), got ${list.length ? list[0].start : "nothing"}`);
  for (let i = 1; i < list.length; i++)
    check(nightMin(list[i].start) >= nightMin(list[i - 1].end), `day ${d} ${s.name}: "${list[i - 1].name}" overlaps "${list[i].name}"`);
}

// ── 4. Printed names ─────────────────────────────────────────────────────
const at = (d, stage, start) => acts.filter(a => a.day === d && a.stage === stage && a.start === start);
const one = (d, stage, start, name, end) => {
  const m = at(d, stage, start);
  check(m.length === 1 && m[0].name === name && m[0].end === end, `day ${d} ${stage} ${start}: "${name}" to ${end}, got ${JSON.stringify(m.map(a => [a.name, a.end]))}`);
};
one(1, "big-top", "16:00", "Solitaire", "17:15");                        // not "Discovery Project" (lineup page)
one(1, "feeding-grounds", "17:00", "k?d presents: Kill The Kid", "18:00");
one(1, "beatbox-art-car", "22:00", "Dr. Greco", "00:00");
one(1, "danse-macabre", "23:00", "B2", "00:00");
one(1, "big-top", "00:45", "Cloonee", "02:00");
one(2, "warehouse", "00:40", "MALUGI presents Matteo & Friends B2B", "01:40");
one(2, "big-top", "00:45", "Zedd", "02:00");
one(2, "sewer-district", "23:45", "Too $hort", "00:15");
one(2, "sewer-district", "00:15", "Ja Rule", "00:45");
const twice = n => acts.filter(a => a.day === 2 && a.name === n).map(a => `${a.stage} ${a.start}`).sort().join(", ");
check(twice("Acyan") === "beatbox-art-car 18:30, sewer-district 16:00", `Acyan plays twice Saturday, got ${twice("Acyan")}`);
check(twice("Cat & Maomi") === "beatbox-art-car 21:30, feeding-grounds 16:00", `Cat & Maomi plays twice Saturday, got ${twice("Cat & Maomi")}`);
for (const gone of ["Discovery Project", "Ice Cube", "VNSSA B2B ????", "RoRoll", "HUA"])
  check(!acts.some(a => a.name === gone), `"${gone}" is not on the 2026-10-26 official lineup`);

// ── 5. Absolute instants ─────────────────────────────────────────────────
const pdt = (d, t) => {                                    // the locked reading: wall clock + 7 h
  const dd = cfg.dayDates[d], [h, m] = t.split(":").map(Number);
  return Date.UTC(dd.y, dd.m, dd.d + (h < 8 ? 1 : 0), h + 7, m);
};
let instants = 0;
for (const a of acts) for (const t of [a.start, a.end]) {
  instants++;
  check(_wallMs(cfg.dayDates[a.day], t, cfg.tz) === pdt(a.day, t), `${a.id} ${t}: _wallMs ${new Date(_wallMs(cfg.dayDates[a.day], t, cfg.tz)).toISOString()} ≠ PDT ${new Date(pdt(a.day, t)).toISOString()}`);
}
// Literal instants from an independent browser read of the official pages.
const pin = (id, startIso, endIso) => {
  const a = acts.find(x => x.id === id);
  check(a && new Date(_wallMs(cfg.dayDates[a.day], a.start, cfg.tz)).toISOString() === startIso
    && new Date(_wallMs(cfg.dayDates[a.day], a.end, cfg.tz)).toISOString() === endIso, `${id}: ${startIso} → ${endIso}`);
};
pin("esc-solitaire-d1", "2026-10-30T23:00:00.000Z", "2026-10-31T00:15:00.000Z");
pin("esc-cloonee-d1", "2026-10-31T07:45:00.000Z", "2026-10-31T09:00:00.000Z");
pin("esc-zedd-d2", "2026-11-01T07:45:00.000Z", "2026-11-01T09:00:00.000Z");
pin("esc-dabin-d2", "2026-11-01T07:50:00.000Z", "2026-11-01T09:00:00.000Z");
pin("esc-malugi-presents-matteo-and-friends-b2b-d2", "2026-11-01T07:40:00.000Z", "2026-11-01T08:40:00.000Z");
check(Math.max(...acts.map(a => _wallMs(cfg.dayDates[a.day], a.end, cfg.tz))) === cfg.endMs, `the last set ends at endMs (Nov 1 09:00Z)`);
check(Math.min(...acts.map(a => _wallMs(cfg.dayDates[a.day], a.start, cfg.tz))) === cfg.startMs, `the first set starts at startMs (Oct 30 23:00Z)`);

// ── 6. Cross-check against EDC editions ──────────────────────────────────
// An act billed at both must carry one printed name, or the artist registry
// splits it. Matched case- and accent-insensitively on letters and digits.
const norm = s => String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const edc = Object.keys(DS).filter(id => /^edc-/.test(id));
let shared = 0;
for (const a of acts) for (const id of edc) for (const b of DS[id].artists)
  if (norm(b.name) === norm(a.name)) { shared++; check(b.name.toLowerCase() === a.name.toLowerCase(), `${a.name} is "${b.name}" on ${id}`); }
check(edc.length >= 2, `control: EDC editions loaded (${edc.length})`);
check(shared > 0, `control: some Escape acts are also billed at EDC (${shared})`);

if (failed) { console.log(`  ✗  ${failed} of ${checks} Escape set-time checks failed`); process.exit(1); }
console.log(`✓ Escape 2026 set times: ${checks} checks — 118 sets (Fri 58, Sat 60) on 7 stages, ${instants} instants in PDT, ${shared} EDC cross-billings agree`);
