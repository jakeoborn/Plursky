#!/usr/bin/env node
// Set-level attendance (spec PR 1) — the pure verdict, on the REAL compiled
// build/data.js in a vm. No browser, no GPS, no live festival data: every
// case runs on a synthetic config so a lineup flip can never move it.
//   1. Runs: qualifying fixes → presence intervals per stage, a 5-min gap
//      closes a run, and array order never decides (both orders seeded).
//   2. Verdict boundaries: full (85% + both ends within 10 min), partial
//      (15 min or 25%), brief, Jake's "30 of a 60-min set".
//   3. Windows: a set crossing midnight, a both-weekend act on ACL-style W2,
//      W1/W2-tagged acts, the ±5 min grace.
//   4. Time class: third_party never earns full/partial, blank never claims
//      the set, an unresolved time is blank.
//   5. Evidence: a photo is a point (caught, never full), manual always wins.
//   6. Mutations: each threshold nudged in the compiled source must fail a
//      check here, or the check is vacuous.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const DATA = readFileSync(join(ROOT, "build", "data.js"), "utf8");
const noop = () => {};

function load(src) {
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = {};
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  vm.runInContext(src, ctx, { filename: "build/data.js" });
  return vm.runInContext(`({ attendFixesToIntervals, attendanceVerdict, attendanceVerdictLabel, attendTimeClass, attendSetWindowMs })`, ctx);
}

const H = 3600000, M = 60000, D = 86400000;
// Synthetic two-weekend festival in Central time (CDT, no DST change on these
// nights): day 1 = Fri Oct 2 2026, Weekend 2 a week later.
const MID = Date.UTC(2026, 9, 2, 5);                       // Oct 2 00:00 CDT
const cfg = { id: "fixture-fest", tz: "America/Chicago",
  dayDates: { 1: { midnightUtc: MID, m: 9, d: 2 } }, weekendStartMs: { W1: MID, W2: MID + 7 * D } };
const at = (hh, mm, wk = 0) => MID + (hh < 8 ? hh + 24 : hh) * H + mm * M + wk * 7 * D;
const act = (start, end, extra = {}) => ({ id: "x", day: 1, stage: "main", start, end, ...extra });
// One qualifying fix a minute from..to (inclusive), at `stage`.
const fixes = (from, to, stage = "main", step = M) => { const o = []; for (let t = from; t <= to; t += step) o.push({ ms: t, stageId: stage }); return o; };

function run(S) {
  let checks = 0, failed = 0;
  const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const V = (a, fx, opts) => S.attendanceVerdict(a, S.attendFixesToIntervals(fx), cfg, opts);
  const set60 = act("20:00", "21:00"), set120 = act("20:00", "22:00"), set40 = act("20:00", "20:40");

  // ── 1. Runs ──────────────────────────────────────────────────────────────
  {
    const r5 = S.attendFixesToIntervals(fixes(at(20, 0), at(20, 30), "main", 5 * M));
    check(r5.main.length === 1 && r5.main[0].from === at(20, 0) && r5.main[0].to === at(20, 30), "fixes 5 min apart are one run");
    const r6 = S.attendFixesToIntervals(fixes(at(20, 0), at(20, 30), "main", 6 * M));
    check(r6.main.length === 6 && r6.main.every(r => r.from === r.to), "fixes 6 min apart are separate zero-length runs");
    const mixed = [...fixes(at(20, 0), at(20, 10), "main"), ...fixes(at(20, 3), at(20, 12), "side")];
    const fwd = JSON.stringify(S.attendFixesToIntervals(mixed)), rev = JSON.stringify(S.attendFixesToIntervals(mixed.slice().reverse()));
    check(fwd === rev, "interleaved stages: forward and reversed input give the same runs");
    const tie = [{ ms: at(20, 0), stageId: "side" }, { ms: at(20, 0), stageId: "main" }];
    check(JSON.stringify(S.attendFixesToIntervals(tie)) === JSON.stringify(S.attendFixesToIntervals(tie.slice().reverse())), "same-instant tie between stages: both orders agree");
    check(Object.keys(S.attendFixesToIntervals([{ ms: NaN, stageId: "main" }, { ms: at(20, 0) }, null])).length === 0, "bad fixes are dropped");
  }

  // ── 2. Verdict boundaries ────────────────────────────────────────────────
  {
    const full = V(set60, fixes(at(20, 0), at(21, 0)));
    check(full.verdict === "full" && full.caught && full.minutes === 60 && full.setMin === 60, `whole set → full (${full.verdict} ${full.minutes})`);
    check(S.attendanceVerdictLabel(full) === "Full set", "full label");
    const jake = V(set60, fixes(at(20, 0), at(20, 30)));
    check(jake.verdict === "partial" && jake.minutes === 30, `Jake's 30 of 60 → partial (${jake.verdict} ${jake.minutes})`);
    check(S.attendanceVerdictLabel(jake) === "≈ 30 of 60 min", `partial label "${S.attendanceVerdictLabel(jake)}"`);
    check(V(set60, fixes(at(20, 0), at(20, 51))).verdict === "full", "51 of 60 (85%) with both ends → full");
    check(V(set60, fixes(at(20, 0), at(20, 50))).verdict === "partial", "50 of 60 (83%) → partial");
    check(V(set120, fixes(at(20, 10), at(22, 0))).verdict === "full", "arrive 10 min late, stay to the end → full");
    check(V(set120, fixes(at(20, 11), at(22, 0))).verdict === "partial", "arrive 11 min late → partial, though 109/120 min");
    check(V(set120, fixes(at(20, 0), at(21, 50))).verdict === "full", "leave 10 min early → full");
    check(V(set120, fixes(at(20, 0), at(21, 49))).verdict === "partial", "leave 11 min early → partial");
    check(V(set120, fixes(at(20, 30), at(20, 45))).verdict === "partial", "15 min of a 120-min set → partial");
    const b14 = V(set120, fixes(at(20, 30), at(20, 44)));
    check(b14.verdict === "brief" && !b14.caught && S.attendanceVerdictLabel(b14) === "", "14 min of 120 → brief, not caught, no label");
    check(V(set40, fixes(at(20, 0), at(20, 10))).verdict === "partial", "10 of 40 (25%) → partial");
    check(V(set40, fixes(at(20, 0), at(20, 9))).verdict === "brief", "9 of 40 → brief");
    check(V(set60, fixes(at(20, 0), at(20, 30), "side")).verdict === "none", "presence at another stage → none");
    check(V(set60, []).verdict === "none", "no evidence → none");
    check(V(set60, fixes(at(20, 0), at(20, 30), "main", 6 * M)).verdict === "brief", "walk-bys 6 min apart never add up");
  }

  // ── 3. Windows ───────────────────────────────────────────────────────────
  {
    const night = act("23:30", "01:00");
    const w = S.attendSetWindowMs(night, cfg, []);
    check(w && w.startMs === at(23, 30) && w.endMs === at(1, 0) && w.endMs - w.startMs === 90 * M, "a set crossing midnight is 90 min on one night");
    check(V(night, fixes(at(23, 30), at(1, 0))).verdict === "full", "crossing midnight, whole set → full");
    const both = act("20:00", "21:00", { weekend: "both" });
    const w2 = V(both, fixes(at(20, 0, 1), at(21, 0, 1)));
    check(w2.verdict === "full", `both-weekend act, presence on W2 → full on W2 (${w2.verdict})`);
    check(V(both, fixes(at(20, 0), at(21, 0))).verdict === "full", "both-weekend act, presence on W1 → full on W1");
    check(V(act("20:00", "21:00", { weekend: "W2" }), fixes(at(20, 0, 1), at(21, 0, 1))).verdict === "full", "W2-only act, W2 presence → full");
    check(V(act("20:00", "21:00", { weekend: "W1" }), fixes(at(20, 0, 1), at(21, 0, 1))).verdict === "none", "W1-only act, W2 presence → none");
    const photoW2 = S.attendanceVerdict(both, { main: [{ from: at(20, 30, 1), to: at(20, 30, 1), src: "photo" }] }, cfg);
    check(photoW2.verdict === "unknown" && photoW2.caught && photoW2.span.from === at(20, 30, 1), "both-weekend act, a W2 photo alone picks W2");
    const ph = t => S.attendanceVerdict(set60, { main: [{ from: t, to: t, src: "photo" }] }, cfg);
    check(ph(at(21, 7)).caught, "a photo 7 min after the end (5 grace + 2 point) still counts");
    check(ph(at(21, 8)).verdict === "none", "a photo 8 min after the end → none");
    check(V(set60, [{ ms: at(21, 5), stageId: "main" }]).verdict === "brief", "a fix inside the grace counts as evidence, not minutes");
    check(V(set60, [{ ms: at(21, 6), stageId: "main" }]).verdict === "none", "a fix 6 min after the end is outside the grace");
  }

  // ── 4. Time class ────────────────────────────────────────────────────────
  {
    const tp = act("20:00", "21:00", { sourceClass: "third_party" });
    check(S.attendTimeClass(tp) === "third_party" && S.attendTimeClass(set60) === "settled", "time class: third_party vs settled");
    const tpv = V(tp, fixes(at(20, 0), at(21, 0)));
    check(tpv.verdict === "unknown" && tpv.caught && tpv.minutes === 60, `third_party whole set → unknown (caught, ≈60), never full (${tpv.verdict})`);
    check(S.attendanceVerdictLabel(tpv) === "≈ 60 min", `third_party label "${S.attendanceVerdictLabel(tpv)}"`);
    check(V(tp, fixes(at(20, 0), at(20, 14))).verdict === "brief", "third_party 14 min → brief");
    const blank = act("", "");
    check(S.attendTimeClass(blank) === "blank", "TBA time → blank");
    const bv = V(blank, fixes(at(20, 0), at(21, 0)));
    check(bv.verdict === "unknown" && !bv.caught && bv.span.from === at(20, 0) && bv.span.to === at(21, 0) && bv.minutes === null, "blank time: stage + span only, no set claim");
    check(V(blank, []).verdict === "none", "blank time, no evidence → none");
    const unres = act("20:00", "21:00", { timeEvidence: { status: "unresolved" } });
    check(S.attendTimeClass(unres) === "blank" && !V(unres, fixes(at(20, 0), at(21, 0))).caught, "an unresolved time is blank and never claims the set");
    check(S.attendTimeClass(act("20:00", "")) === "blank", "no end time → blank");
  }

  // ── 5. Evidence kinds ────────────────────────────────────────────────────
  {
    const photo = S.attendanceVerdict(set60, { main: [{ from: at(20, 30), to: at(20, 30), src: "photo" }] }, cfg);
    check(photo.verdict === "unknown" && photo.caught && photo.minutes === 0, "a photo alone: caught, length unknown");
    const mix = S.attendanceVerdict(set60, { main: [...S.attendFixesToIntervals(fixes(at(20, 0), at(20, 50))).main,
      { from: at(20, 58), to: at(20, 58), src: "photo" }] }, cfg);
    check(mix.verdict === "partial", "a photo near the end never lifts 50 min to full");
    const man = V(set60, fixes(at(20, 0), at(20, 5)), { manual: "full" });
    check(man.verdict === "full" && man.caught, "manual full wins over a brief GPS read");
    check(V(set60, fixes(at(20, 0), at(21, 0)), { manual: "partial" }).verdict === "partial", "GPS never upgrades a manual partial");
  }
  return { checks, failed, fails };
}

const base = run(load(DATA));
for (const f of base.fails) console.log(`  ✗  ${f}`);

// ── 6. Mutations: every threshold nudge must be caught ──────────────────────
const MUT = [
  ["ATTEND_FULL_SHARE = 0.85", "ATTEND_FULL_SHARE = 0.8"],
  ["ATTEND_FULL_EDGE_MS = 10 * 60000", "ATTEND_FULL_EDGE_MS = 12 * 60000"],
  ["ATTEND_PARTIAL_MS = 15 * 60000", "ATTEND_PARTIAL_MS = 16 * 60000"],
  ["ATTEND_PARTIAL_SHARE = 0.25", "ATTEND_PARTIAL_SHARE = 0.3"],
  ["ATTEND_GAP_MS = 5 * 60000", "ATTEND_GAP_MS = 6 * 60000"],
  ["ATTEND_GRACE_MS = 5 * 60000", "ATTEND_GRACE_MS = 7 * 60000"],
  ["ATTEND_PHOTO_MS = 2 * 60000", "ATTEND_PHOTO_MS = 0"],
  ["return score(w2) > score(w1) ? w2 : w1", "return w1"],
  ['a.sourceClass === "third_party" ? "third_party"', 'false ? "third_party"'],
];
let caught = 0, mutFail = 0;
for (const [from, to] of MUT) {
  const n = DATA.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  const r = run(load(DATA.replace(from, to)));
  if (r.failed > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}
const failed = base.failed + mutFail;
console.log(`${failed ? "✗" : "✓"} set attendance: ${base.checks - base.failed}/${base.checks} checks, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
