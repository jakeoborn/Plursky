#!/usr/bin/env node
// Festival switcher order — _festivalPhase and _sortFestivalsForSwitcher.
//
// Runs data.jsx itself in a vm (the same load test-schedule-diff uses). No browser.
//   1. Fixtures: one festival per phase, shuffled, plus ties inside each phase.
//      Order must be live → upcoming (soonest first) → TBA (registry order) →
//      ended (most recently ended first). A missing timestamp is TBA, not epoch 0.
//   2. Boundaries: start instant is live, end instant is live, end+1 is ended.
//   3. The real registry at a fixed instant: phases never go backwards, and
//      EDC Las Vegas 2026 (ended May 18) sorts into the ended tail.
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
  "\n;__out = { REG: FESTIVALS_REGISTRY, _festivalPhase, _sortFestivalsForSwitcher, _festivalWindow, _festivalEventDates };", ctx);
const { REG, _festivalPhase, _sortFestivalsForSwitcher, _festivalWindow, _festivalEventDates } = ctx.__out;

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const ids = list => Array.from(list, f => f.config.id).join(",");

// ── 1. Fixtures ─────────────────────────────────────────────────────────────
const D = 86400000, NOW = Date.UTC(2026, 8, 13, 12);
const fx = (id, s, e) => ({ config: s == null ? { id } : { id, startMs: NOW + s * D, endMs: NOW + e * D } });
const input = [
  fx("ended-old", -120, -118), fx("tba-a"), fx("up-far", 60, 62), fx("live-b", -1, 1),
  fx("ended-recent", -10, -8), fx("tba-b"), fx("up-near", 5, 7), fx("live-a", -2, 2),
  { config: { id: "tba-halfdated", startMs: NOW + 3 * D } },
  // No timestamps, but printed dates: ordered by those days, not dumped in TBA.
  { config: { id: "ended-printed", dates: "Dec 31, 2025 – Jan 1, 2026" } },
  { config: { id: "up-printed", dates: "Oct 1–2, 2026" } },
];
check(ids(_sortFestivalsForSwitcher(input, NOW)) ===
  "live-a,live-b,up-near,up-printed,up-far,tba-a,tba-b,tba-halfdated,ended-recent,ended-old,ended-printed",
  `fixture order: ${ids(_sortFestivalsForSwitcher(input, NOW))}`);
check(_festivalPhase({ config: { id: "p", dates: "Sep 12–14, 2026" } }, NOW) === "live", "printed dates spanning now = live");
// A real gate instant vs a printed-only day: Decadence (Dec 30 17:00 MST =
// Dec 31 00:00Z) must still list above Countdown NYE (printed Dec 31). The
// row shows the printed date, so that is the order the eye checks.
{
  const dec = { config: { id: "dec30", dates: "Dec 30–31, 2026", startMs: Date.UTC(2026, 11, 31, 0, 0), endMs: Date.UTC(2027, 0, 1, 9) } };
  const nye = { config: { id: "nye31", dates: "Dec 31, 2026 – Jan 1, 2027" } };
  check(ids(_sortFestivalsForSwitcher([nye, dec], NOW)) === "dec30,nye31", "printed Dec 30 lists above printed Dec 31");
}
check(_festivalPhase({ config: { id: "p", dates: "Dates TBA" } }, NOW) === "tba", "\"Dates TBA\" = tba");
check(ids(input).startsWith("ended-old,"), "the input array is not mutated");
check(_festivalPhase({ config: { id: "x", startMs: NOW + D } }, NOW) === "tba", "only startMs = tba");
check(_festivalPhase(null, NOW) === "tba", "a null entry = tba, no throw");

// ── 2. Boundaries ───────────────────────────────────────────────────────────
const b = { config: { id: "b", startMs: NOW, endMs: NOW + D } };
check(_festivalPhase(b, NOW - 1) === "upcoming", "start-1 = upcoming");
check(_festivalPhase(b, NOW) === "live", "start instant = live");
check(_festivalPhase(b, NOW + D) === "live", "end instant = live");
check(_festivalPhase(b, NOW + D + 1) === "ended", "end+1 = ended");

// ── 3. Real registry ────────────────────────────────────────────────────────
const rank = { live: 0, upcoming: 1, tba: 2, ended: 3 };
const real = _sortFestivalsForSwitcher(REG, NOW);
check(real.length === REG.length, `registry keeps every entry (${real.length}/${REG.length})`);
const phases = Array.from(real, f => _festivalPhase(f, NOW));
check(phases.every((p, i) => i === 0 || rank[phases[i - 1]] <= rank[p]), `phases monotone: ${phases.join(",")}`);
const lv = real.findIndex(f => f.config.id === "edc-lv-2026");
check(lv >= 0 && phases[lv] === "ended", "edc-lv-2026 is in the ended tail");
const tbaWithDates = real.filter((f, i) => phases[i] === "tba" && _festivalEventDates(f.config));
check(!tbaWithDates.length, `TBA only for entries with no date at all: ${ids(tbaWithDates)}`);
// Checked on the PRINTED start date, the thing the row shows. Comparing
// window startMs passed while NYE (Dec 31) listed above Decadence (Dec 30).
const ups = real.filter((f, i) => phases[i] === "upcoming")
  .map(f => (_festivalEventDates(f.config) || {}).start || new Date(_festivalWindow(f.config).startMs).toISOString().slice(0, 10));
check(ups.every((s, i) => i === 0 || ups[i - 1] <= s), `upcoming runs soonest first by printed date: ${ups.join(",")}`);
const count = p => phases.filter(x => x === p).length;

console.log(`${checks - failed}/${checks} switcher-order checks passed ` +
  `(registry at 2026-09-13: ${count("live")} live, ${count("upcoming")} upcoming, ${count("tba")} TBA, ${count("ended")} ended)`);
process.exit(failed ? 1 : 0);
