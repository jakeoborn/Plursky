#!/usr/bin/env node
// Your weekend (SPEC-200 Build 3) on the REAL compiled build in a vm. The
// timeline model is checked here; the shipped engine makes the verdicts, so
// a synthetic config and acts only, and a lineup flip never moves this test.
//   1. Behind a flag: off unless plursky_flag_your_weekend is "on".
//   2. In: sets the engine calls caught, and your own Full / Part answers.
//      Out: brief passes, "I wasn't there", saved sets with no evidence.
//   3. Marks: a GPS run is its share of the set window, clipped to it; a
//      photo is a point; a run that sits wholly in the grace before the
//      start draws nothing.
//   4. Nights: a set after midnight belongs to the night before (08:00 rule),
//      and nights and sets come out in time order.
//   3b. Your own times: the first and last evidence at the stage inside the set,
//       in festival time; your answer alone invents none.
//   5. Nothing says "Missed", and nothing carries a place.
//   6. Mutations: each rule nudged in the compiled source must fail a check.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const DATA = readFileSync(join(ROOT, "build", "data.js"), "utf8");
const CHROME = readFileSync(join(ROOT, "build", "chrome.js"), "utf8");
const MACHINE = readFileSync(join(ROOT, "build", "machine.js"), "utf8");
const noop = () => {};

function load(chromeSrc) {
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
  vm.runInContext(DATA, ctx, { filename: "build/data.js" });
  vm.runInContext(MACHINE, ctx, { filename: "build/machine.js" });
  vm.runInContext(chromeSrc, ctx, { filename: "build/chrome.js" });
  return ctx;
}

const H = 3600000, M = 60000;
const MID1 = Date.UTC(2026, 9, 2, 5);                      // Fri Oct 2 2026 00:00 CDT
const MID2 = MID1 + 24 * H;                                // Sat Oct 3
const at = (mid, hh, mm) => mid + (hh < 8 ? hh + 24 : hh) * H + mm * M;
const cfg = {
  id: "fixture-fest", tz: "America/Chicago",
  dayDates: { 1: { midnightUtc: MID1, m: 9, d: 2, short: "FRI" }, 2: { midnightUtc: MID2, m: 9, d: 3, short: "SAT" } },
};
const ACTS = {
  full:   { id: "full",   name: "Full Act",   day: 1, stage: "main", start: "20:00", end: "21:00" },
  half:   { id: "half",   name: "Half Act",   day: 1, stage: "side", start: "21:00", end: "22:00" },
  walk:   { id: "walk",   name: "Walk Act",   day: 1, stage: "main", start: "22:00", end: "23:00" },
  absent: { id: "absent", name: "Absent Act", day: 1, stage: "side", start: "22:00", end: "23:00" },
  hand:   { id: "hand",   name: "Hand Act",   day: 2, stage: "main", start: "19:00", end: "20:00" },
  late:   { id: "late",   name: "Late Act",   day: 1, stage: "main", start: "00:00", end: "01:00" },
  photo:  { id: "photo",  name: "Photo Act",  day: 2, stage: "side", start: "21:00", end: "22:00" },
  saved:  { id: "saved",  name: "Saved Act",  day: 2, stage: "main", start: "23:00", end: "23:59" },
  early:  { id: "early",  name: "Early Act",  day: 2, stage: "side", start: "18:00", end: "19:00" },
};

function run(S) {
  let checks = 0, failed = 0;
  const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };

  // ── 1. The flag ──
  check(S.yourWeekendEnabled() === false, "off by default");
  S.localStorage.setItem("plursky_flag_your_weekend", "yes");
  check(S.yourWeekendEnabled() === false, "only the exact value \"on\" turns it on");
  S.localStorage.setItem("plursky_flag_your_weekend", "on");
  check(S.yourWeekendEnabled() === true, "\"on\" turns it on");

  // Rows built the way setReviewRows builds them, from the shipped engine.
  const runsAt = (stage, from, to) => { const o = []; for (let t = from; t <= to; t += M) o.push({ ms: t, stageId: stage }); return S.attendFixesToIntervals(o); };
  const merge = (...xs) => S.attendMergeEvidence(...xs);
  const iv = merge(
    runsAt("main", at(MID1, 20, 0), at(MID1, 21, 0)),        // full
    runsAt("side", at(MID1, 21, 0), at(MID1, 21, 30)),       // half
    runsAt("main", at(MID1, 22, 10), at(MID1, 22, 13)),      // walk-by
    runsAt("side", at(MID1, 22, 0), at(MID1, 23, 0)),        // absent (evidence, but you said no)
    runsAt("main", at(MID1, 0, 0), at(MID1, 1, 0)),          // late, after midnight
    { side: [{ from: at(MID2, 21, 20), to: at(MID2, 21, 20), src: "photo", via: "photo" }] },
    runsAt("side", at(MID2, 17, 55), at(MID2, 17, 58)),      // early: only in the grace before 18:00
  );
  const manual = { absent: "absent", hand: "full" };
  const rows = Object.values(ACTS).map(a => {
    const m = manual[a.id] || null;
    const ev = S.attendEvidenceList(a, iv, cfg);
    // "absent" keeps the engine's own (caught) verdict: your answer must win over it.
    const v = S.attendanceVerdict(a, iv, cfg, m && m !== "absent" ? { manual: m } : {});
    const verdict = v && v.verdict !== "none" ? { ...v, label: S.attendanceVerdictLabel(v) + (m ? " · your edit" : "") } : null;
    return { a, manual: m, ev, verdict };
  });
  const nights = S.yourWeekendNights(rows, cfg);
  const sets = nights.flatMap(n => n.sets);
  const get = id => sets.find(s => s.id === id);

  // ── 2. In and out ──
  check(!!get("full") && get("full").tag === "Full set", `a full set is in, tagged Full set (${get("full") && get("full").tag})`);
  check(!!get("half") && /^≈ 30 of 60 min$/.test(get("half").tag), `half a set is in with its minutes (${get("half") && get("half").tag})`);
  check(!get("walk"), "a 3-minute walk-by is left out");
  check(!get("absent"), "\"I wasn't there\" is left out, even with evidence");
  check(!!get("hand") && get("hand").mine && /your edit/.test(get("hand").tag) && get("hand").marks.length === 0, "your own Full answer is in, says so, and draws no evidence");
  check(!get("saved"), "a set with nothing on this phone is left out, not Missed");
  check(!get("early"), `evidence only in the grace before the start is not a caught set`);
  check(!!get("photo") && get("photo").tag === "Length unknown", `a photo alone is caught, length unknown (${get("photo") && get("photo").tag})`);

  // ── 3. Marks ──
  const fm = get("full") ? get("full").marks : [];
  check(fm.length === 1 && fm[0].kind === "run" && fm[0].l === 0 && Math.abs(fm[0].w - 1) < 1e-9, `a full set fills its track (${JSON.stringify(fm)})`);
  const hm = get("half") ? get("half").marks : [];
  check(hm.length === 1 && hm[0].l === 0 && Math.abs(hm[0].w - 0.5) < 1e-9, `half a set fills half (${JSON.stringify(hm)})`);
  const pm = get("photo") ? get("photo").marks : [];
  check(pm.length === 1 && pm[0].kind === "point" && Math.abs(pm[0].l - 1 / 3) < 1e-9, `a photo is a point at its time (${JSON.stringify(pm)})`);
  const lone = S.yourWeekendNights([{ a: ACTS.early, manual: "partial", ev: [{ kind: "gps", from: at(MID2, 17, 55), to: at(MID2, 17, 58) }], verdict: null }], cfg);
  check(lone.length === 1 && lone[0].sets[0].marks.length === 0, "a run wholly before the start draws nothing, not a zero-width bar");
  const over = S.yourWeekendNights([{ a: ACTS.full, manual: "partial", ev: [{ kind: "gps", from: at(MID1, 19, 50), to: at(MID1, 20, 30) }], verdict: null }], cfg);
  const om = over[0].sets[0].marks[0];
  check(om && om.l === 0 && Math.abs(om.w - 0.5) < 1e-9, `a run starting before the set is clipped to the window (${JSON.stringify(om)})`);

  // ── 3b. Your own times: first and last evidence at the stage, inside the set ──
  const yt = id => get(id) && get(id).youText;
  check(yt("full") === "You: 8:00 PM to 9:00 PM", `a full set shows when you came and went (${yt("full")})`);
  check(yt("half") === "You: 9:00 PM to 9:30 PM", `half a set shows you left at 9:30; the next act's run at that stage does not count (${yt("half")})`);
  check(yt("photo") === "You: 9:20 PM", `a photo alone is one time, not a range (${yt("photo")})`);
  check(yt("late") === "You: 12:00 AM to 1:00 AM", `after midnight reads in festival time (${yt("late")})`);
  check(get("hand") && get("hand").you === null && yt("hand") === "Your times: nothing on this phone", `your own answer alone invents no times (${yt("hand")})`);
  const ot = over[0].sets[0];
  check(ot.youText === "You: 8:00 PM to 8:30 PM" && ot.you.fromMs === at(MID1, 20, 0), `time at the stage before the set is the last act's: clipped to the start (${ot.youText})`);
  const two = S.yourWeekendNights([{ a: ACTS.full, manual: "full", ev: [
    { kind: "gps", from: at(MID1, 20, 20), to: at(MID1, 20, 30) },
    { kind: "photo", from: at(MID1, 20, 10), to: at(MID1, 20, 10) },
    { kind: "gps", from: at(MID1, 20, 40), to: at(MID1, 20, 55) }], verdict: null }], cfg)[0].sets[0];
  check(two.youText === "You: 8:10 PM to 8:55 PM", `earliest and latest across every kind, in any order (${two.youText})`);

  // ── 4. Nights ──
  const fri = nights.find(n => n.sets.some(s => s.id === "full"));
  check(!!fri && fri.sets.some(s => s.id === "late"), "a 00:00 set belongs to the night it follows");
  check(nights.length === 2 && /Fri/.test(nights[0].label) && /Sat/.test(nights[1].label), `nights in order (${nights.map(n => n.label).join(" | ")})`);
  check(fri && fri.sets.map(s => s.id).join(",") === "full,half,late", `sets in time order (${fri && fri.sets.map(s => s.id).join(",")})`);
  const blank = S.yourWeekendNights([{ a: { id: "tba", name: "TBA", day: 2, stage: "main", start: "", end: "" }, manual: "full", ev: [], verdict: null }], cfg);
  check(blank.length === 1 && blank[0].label === "SAT" && blank[0].sets[0].startMs === null, "a set with no published time still lists under its day, with no track");

  // ── 5. No Missed, no place ──
  const json = JSON.stringify(nights);
  check(!/Missed/i.test(json), "nothing says Missed");
  check(!/"(lat|lng|latitude|longitude|accuracy)":/.test(json), "nothing carries a place");
  return { checks, failed, fails };
}

const base = run(load(CHROME));
for (const f of base.fails) console.log(`  ✗  ${f}`);
const src = readFileSync(join(ROOT, "chrome.jsx"), "utf8");
const sheet = src.slice(src.indexOf("function YourWeekendSheet"), src.indexOf("// One set: what the evidence says"));
const noMissed = !/Missed/.test(sheet.replace(/\/\/.*$/gm, ""));
if (!noMissed) console.log("  ✗  the Your weekend sheet says Missed");

// ── 6. Mutations ──
const MUT = [
  ['localStorage.getItem(YOUR_WEEKEND_FLAG_KEY) === "on"', 'localStorage.getItem(YOUR_WEEKEND_FLAG_KEY) !== "off"'],
  ['if (!a || manual === "absent") return 0;', "if (!a) return 0;"],
  ['manual === "partial" || verdict && verdict.caught', 'manual === "partial" || verdict'],
  ["new Date(ms - 8 * 3600000)", "new Date(ms)"],
  ["if (rr > l) marks.push", "if (true) marks.push"],
  ["Math.min(1, Math.max(0, (ms - w.startMs) / L))", "(ms - w.startMs) / L"],
  // Your own times: departure read as the first run's end; arrival read from the first item; no-evidence invents the set window.
  ["toMs: Math.max(...youTimes.map(t => t[1]))", "toMs: youTimes[0][1]"],
  ["fromMs: Math.min(...youTimes.map(t => t[0]))", "fromMs: youTimes[0][0]"],
  ["var inSet = e => !w || (", "var inSet = e => true || ("],
  [': "Your times: nothing on this phone";', ': (w ? `You: ${_setClock(w.startMs, cfg)} to ${_setClock(w.endMs, cfg)}` : "Your times: nothing on this phone");'],
];
let caught = 0, mutFail = 0;
for (const [from, to] of MUT) {
  const n = CHROME.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  let r;
  try { r = run(load(CHROME.replace(from, to))).failed; } catch { r = 1; }
  if (r > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}
const failed = base.failed + mutFail + (noMissed ? 0 : 1);
console.log(`${failed ? "✗" : "✓"} your weekend: ${base.checks - base.failed}/${base.checks} checks, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
