#!/usr/bin/env node
// Set attendance evidence (SPEC-200 Build 2) on the REAL compiled build in a
// vm: data.js for the pure rules, chrome.js for the stores the screens use.
// No browser, no GPS, synthetic config only, so a lineup flip never moves it.
//   1. A moment's capture time is read in the festival's zone (midnight too).
//   2. Which moments are evidence: a trusted check-in, a photo placed by a
//      trusted fix. Not: a photo with no GPS, a hand retag, an ambiguous or
//      unconfirmed time, another festival, a poster-placed stage.
//   3. Duplicates never add up; walk-bys, leaving and coming back, another
//      stage, and a set over midnight read as the shipped engine says.
//   4. The why list is times and kinds only, never a place.
//   5. Corrections: full / part / not there win, read back after a reload,
//      and say they are yours; clearing gives the evidence back.
//   6. "Still here": denied, untrusted and not-live record nothing; a
//      trusted fix records one point; no coordinate is stored.
//   7. Mutations: each rule nudged in the compiled source must fail a check.
//   8. Calibrate stages: 30 m fixes inside the venue, two taps 10+ min apart
//      within 30 m, counted only when every stage with a set is placed, never
//      over a measured stage; a saved set that is over with no evidence is
//      listed (the screens say "No record", never "Missed").
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

function load(dataSrc, chromeSrc) {
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
  vm.runInContext(dataSrc, ctx, { filename: "build/data.js" });
  vm.runInContext(MACHINE, ctx, { filename: "build/machine.js" });
  vm.runInContext(chromeSrc, ctx, { filename: "build/chrome.js" });
  ctx.__store = store;
  return ctx;
}

const H = 3600000, M = 60000;
const MID = Date.UTC(2026, 9, 2, 5);                       // Fri Oct 2 2026 00:00 CDT
const at = (hh, mm) => MID + (hh < 8 ? hh + 24 : hh) * H + mm * M;
const cfg = {
  id: "fixture-fest", tz: "America/Chicago",
  dayDates: { 1: { midnightUtc: MID, m: 9, d: 2 } },
  // main and side are measured; "poster" is a stage placed from map art.
  gpsAnchors: [
    { stageId: "main", lat: 30.2650, lng: -97.7700, src: "osm" },
    { stageId: "side", lat: 30.2680, lng: -97.7700, src: "osm" },
    { stageId: "poster", lat: 30.2710, lng: -97.7700 },
  ],
};
const ARTISTS = [
  { id: "m1", name: "Main Act", day: 1, stage: "main", start: "20:00", end: "21:00" },
  { id: "s1", name: "Side Act", day: 1, stage: "side", start: "20:00", end: "21:00" },
  { id: "p1", name: "Poster Act", day: 1, stage: "poster", start: "20:00", end: "21:00" },
  { id: "late", name: "Late Act", day: 1, stage: "main", start: "00:00", end: "01:00" },
];
const art = id => ARTISTS.find(a => a.id === id);
const photo = (id, takenAt, extra = {}) => ({ id, festivalId: cfg.id, kind: "image", artistId: "m1", takenAt,
  autoTagged: true, tagSource: "exif", tagAmbiguous: false, matchEvidence: "trusted-gps+time", ...extra });
const checkin = (id, takenAt, extra = {}) => ({ id, festivalId: cfg.id, kind: "checkin", artistId: "m1", stageId: "main",
  takenAt, locationSource: "gps-live", ...extra });

function run(S) {
  let checks = 0, failed = 0;
  const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  S.FESTIVAL_CONFIG = cfg; S.ARTISTS = ARTISTS;
  S._DATA_SETS = { ...(S._DATA_SETS || {}), [cfg.id]: { config: cfg, artists: ARTISTS, stages: [] } };

  // ── 1. Capture time in the festival's zone ──
  check(S.attendMomentMs({ takenAt: "2026-10-02 20:30" }, cfg) === at(20, 30), "takenAt 20:30 reads as 20:30 Chicago");
  check(S.attendMomentMs({ takenAt: "2026-10-03 00:30:15" }, cfg) === at(0, 30) + 15000, "after midnight, with seconds");
  check(S.attendMomentMs({ createdAt: at(20, 0) }, cfg) === null, "no takenAt: not a capture time");

  // ── 2. Which moments are evidence ──
  const P = moments => S.attendMomentPoints(moments, cfg, ARTISTS);
  const one = (m, stage = "main") => (P([m])[stage] || []).length;
  check(one(checkin("c1", "2026-10-02 20:10")) === 1 && P([checkin("c1", "2026-10-02 20:10")]).main[0].via === "checkin", "trusted check-in → one point");
  check(one(checkin("c2", "2026-10-02 20:10", { locationSource: "none" })) === 0, "check-in without a trusted fix → nothing");
  check(one(checkin("c3", "2026-10-02 20:10", { stageId: "poster" }), "poster") === 0, "check-in at a poster-placed stage → nothing");
  check(one(photo("p1", "2026-10-02 20:20")) === 1, "photo placed by a trusted fix → one point");
  check(one(photo("p2", "2026-10-02 20:20", { matchEvidence: "saved+time" })) === 0, "photo with no GPS → nothing");
  check(one(photo("p3", "2026-10-02 20:20", { tagSource: "manual" })) === 0, "hand-retagged photo → nothing");
  check(one(photo("p4", "2026-10-02 20:20", { tagAmbiguous: true })) === 0, "ambiguous photo → nothing");
  check(one(photo("p5", "2026-10-02 20:20", { dateUnverified: true })) === 0, "unconfirmed capture time → nothing");
  check(one(photo("p6", "2026-10-02 20:20", { festivalId: "other-fest" })) === 0, "another festival's photo → nothing");
  check(one(photo("p7", "2026-10-02 20:20", { festivalId: undefined })) === 0, "a photo with no festival → nothing (never guessed)");
  check(one(photo("p8", "2026-10-02 20:20", { artistId: "p1" }), "poster") === 0, "photo at a poster-placed stage → nothing");
  check(P({ 1: [photo("a", "2026-10-02 20:20")], 2: [checkin("b", "2026-10-02 20:25")] }).main.length === 2, "night buckets are read like an array");
  const ptKeys = Object.keys(P([photo("p9", "2026-10-02 20:20", { lat: 1, lng: 2 })]).main[0]).sort().join(",");
  check(!/lat|lng/.test(ptKeys), `a point carries no coordinate (${ptKeys})`);

  // ── 3. The engine on merged evidence ──
  const runs = (from, to, stage = "main", step = M) => { const o = []; for (let t = from; t <= to; t += step) o.push({ ms: t, stageId: stage }); return S.attendFixesToIntervals(o); };
  const V = (a, iv) => S.attendanceVerdict(a, iv, cfg);
  const pts = P([photo("d1", "2026-10-02 20:20")]);
  const twice = S.attendMergeEvidence(pts, pts, P([photo("d2", "2026-10-02 20:20")]));
  check(twice.main.length === 1, `the same point three times counts once (${twice.main.length})`);
  const half = runs(at(20, 0), at(20, 30));
  const dup = S.attendMergeEvidence(half, half);
  check(V(art("m1"), dup).minutes === V(art("m1"), half).minutes, "duplicated GPS runs do not inflate minutes");
  const walk = V(art("m1"), runs(at(20, 10), at(20, 13)));
  check(walk.verdict === "brief" && !walk.caught, `a 3-min walk-by is not a set (${walk.verdict})`);
  const back = V(art("m1"), S.attendMergeEvidence(runs(at(20, 0), at(20, 20)), runs(at(20, 40), at(21, 0))));
  check(back.verdict === "partial" && back.minutes === 40, `leave and come back: 40 of 60, partial (${back.verdict} ${back.minutes})`);
  check(V(art("m1"), runs(at(20, 0), at(21, 0), "side")).verdict === "none", "a whole set at the other stage → none here");
  const ph = V(art("m1"), pts);
  check(ph.verdict === "unknown" && ph.caught && S.attendanceVerdictLabel(ph) === "", "photo only: caught, length unknown, no length label");
  const lateIv = S.attendMergeEvidence(runs(at(0, 0), at(1, 0)), P([checkin("l1", "2026-10-03 00:30", { artistId: "late" })]));
  check(V(art("late"), lateIv).verdict === "full", "a set over midnight, evidence after midnight → full");

  // ── 4. The why list ──
  const why = S.attendEvidenceList(art("m1"), S.attendMergeEvidence(half, pts), cfg);
  check(why.length === 2 && why.some(e => e.kind === "gps") && why.some(e => e.kind === "photo"), `why lists the run and the photo (${why.map(e => e.kind)})`);
  check(why.every(e => Object.keys(e).sort().join(",") === "from,kind,to"), "why rows are kind and times only");
  check(S.attendEvidenceList(art("m1"), runs(at(22, 0), at(22, 30)), cfg).length === 0, "evidence outside the window is not in the why");

  // ── 5. Corrections ──
  S.__store.plursky_moments_v1 = JSON.stringify({ 1: [photo("w1", "2026-10-02 20:20")] });
  check(S.setTrackVerdict(art("m1"), cfg)?.verdict === "unknown", "a stored photo reaches the screens' verdict");
  check(S.setTrackVerdict(art("s1"), cfg) === null, "no evidence at a stage → no verdict");
  S.setSetManual(cfg.id, "m1", "full");
  const mf = S.setTrackVerdict(art("m1"), cfg);
  check(mf?.verdict === "full" && mf.manual === "full" && /your edit/.test(mf.label), `a correction wins and says so ("${mf && mf.label}")`);
  const reloaded = JSON.parse(S.__store.plursky_set_manual_v1 || "{}");
  check(reloaded[cfg.id]?.m1 === "full", "the correction is stored for a reload");
  S.setSetManual(cfg.id, "s1", "partial");
  check(S.setTrackVerdict(art("s1"), cfg)?.verdict === "partial", "a correction stands with no evidence at all");
  S.setSetManual(cfg.id, "m1", "absent");
  check(S.setTrackVerdict(art("m1"), cfg) === null, "\"I wasn't there\" removes the set");
  check(S.setTrackSummary(ARTISTS, cfg).full === 0, "a set you weren't at is not in the recap count");
  S.setSetManual(cfg.id, "m1", null);
  check(S.setTrackVerdict(art("m1"), cfg)?.verdict === "unknown" && S.getSetManual(cfg.id, "m1") === null, "clearing gives the evidence back");
  check(S.setSetManual(cfg.id, "m1", "most") === false && S.getSetManual(cfg.id, "m1") === null, "an unknown answer is refused");

  return { checks, failed, fails, S };
}

async function runTap(S) {
  let checks = 0, failed = 0;
  const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const now = Date.now();
  const liveCfg = { ...cfg, id: "tap-fest" };
  S._festivalPhase = () => "live";
  const fix = f => { S._checkinFix = async () => f; };
  fix({ denied: true });
  check((await S.setTrackStillHere(liveCfg)).status === "denied", "denied location → nothing noted");
  fix({ lat: 30.2650, lng: -97.7700, accuracy: 300, timestamp: now });
  check((await S.setTrackStillHere(liveCfg)).status === "coarse", "a coarse fix → nothing noted");
  check(!S.__store.plursky_set_taps_v1, "nothing stored until a fix is trusted");
  fix({ lat: 30.2650, lng: -97.7700, accuracy: 10, timestamp: now });
  const ok = await S.setTrackStillHere(liveCfg);
  check(ok.status === "trusted" && ok.stageId === "main", `a trusted fix → noted at main (${ok.status})`);
  await S.setTrackStillHere(liveCfg);
  const taps = JSON.parse(S.__store.plursky_set_taps_v1 || "{}")["tap-fest"] || [];
  check(taps.length === 1, `the same tap twice stores once (${taps.length})`);
  check(!/lat|lng|accuracy/.test(S.__store.plursky_set_taps_v1 || ""), "a tap stores no coordinate");
  check((S.getSetTapPoints("tap-fest").main || []).length === 1, "the tap is a point at main");
  S._festivalPhase = () => "ended";
  check((await S.setTrackStillHere(liveCfg)).status === "not-live", "after the festival, a tap notes nothing");
  check(S.clearSetTrack("tap-fest") === true && !Object.keys(S.getSetTapPoints("tap-fest")).length, "Clear removes the taps");
  return { checks, failed, fails };
}


// ── 8. Calibrate stages and "No record" ──
async function runCalib(S) {
  let checks = 0, failed = 0;
  const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const c = { id: "calib-fest", tz: "America/Chicago", dayDates: cfg.dayDates, gpsAnchors: [],
    mapGeoref: { bounds: [-97.7720, 30.2630, -97.7680, 30.2700] } };
  const stages = [{ id: "a", name: "Stage A" }, { id: "b", name: "Stage B" }, { id: "idle", name: "No sets" }];
  const acts = [{ id: "x1", name: "X", day: 1, stage: "a", start: "20:00", end: "21:00" },
                { id: "x2", name: "Y", day: 1, stage: "b", start: "20:00", end: "21:00" }];
  S._DATA_SETS = { ...S._DATA_SETS, [c.id]: { config: c, artists: acts, stages } };
  S._festivalPhase = () => "live";
  const T0 = Date.UTC(2026, 10, 21, 3);
  const tap = (stage, lat, lng, acc, ms) => S.calibrateStageTap(c, stage, { lat, lng, accuracy: acc, timestamp: ms }, ms);
  check(S.setTrackEligibility(c, T0) === "no-stages", "no measured stage: not eligible");
  check(S.stageCalibrationStatus(c).needed === 2, `only stages with a set need calibrating (${S.stageCalibrationStatus(c).needed})`);
  check(tap("a", 30.2650, -97.7700, 40, T0).status === "coarse" && !S.__store.plursky_stage_calib_v1, "a 40 m fix is refused and stores nothing");
  check(tap("a", 30.3000, -97.7700, 10, T0).status === "off-site", "a fix outside the venue is refused");
  check(tap("a", 30.2650, -97.7700, 10, T0).status === "first", "first tap is pending");
  check(tap("a", 30.2650, -97.7700, 10, T0 + 5 * M).status === "too-soon", "a second tap after 5 min is too soon");
  check(tap("a", 30.2660, -97.7700, 10, T0 + 11 * M).status === "moved", "a second tap 111 m away starts over");
  check(tap("a", 30.26605, -97.7700, 10, T0 + 22 * M).status === "set", "two taps 11 min apart within 30 m set the stage");
  check(S.stageCalibrationAnchors(c).length === 0 && S.setTrackEligibility(c, T0) === "no-stages", "one of two stages: nothing counts yet");
  tap("b", 30.2690, -97.7700, 10, T0); tap("b", 30.2690, -97.77001, 10, T0 + 10 * M);
  const an = S.attendEvidenceAnchors(c);
  check(an.length === 2 && an.every(x => x.anchorSource === "device"), `both stages done: two on-device anchors (${an.length})`);
  check(Math.abs(an.find(x => x.stageId === "a").lat - 30.266025) < 1e-9, "the anchor is the two taps' midpoint");
  check(S.setTrackEligibility(c, T0) === "live", "calibrated: set tracking can run");
  const g = S.stageFixGate(an, { lat: 30.2661, lng: -97.7700, accuracy: 10, timestamp: T0 }, T0, S.STAGE_FIX_ATTEND);
  check(g.status === "trusted" && g.stageId === "a", `a fix at stage A is trusted to A (${g.status})`);
  const meas = { ...c, id: "calib-meas", gpsAnchors: [{ stageId: "a", lat: 30.2650, lng: -97.7700, src: "osm" }] };
  S._DATA_SETS[meas.id] = { config: meas, artists: acts, stages };
  check(S.stageCalibrationStatus(meas).needed === 1 && S.stageCalibrationStatus(meas).stages[0].id === "b", "a measured stage is never recalibrated");
  check(S.attendEvidenceAnchors({ ...c, id: "calib-poster", gpsAnchors: [{ stageId: "a", lat: 1, lng: 1 }] }).length === 0, "a poster stage stays out");
  S._festivalPhase = () => "ended";
  check(tap("a", 30.2650, -97.7700, 10, T0 + 60 * M).status === "not-live", "after the festival, a tap notes nothing");
  S._festivalPhase = () => "live";
  check(!/"(a|b)":\{"ms"/.test(JSON.stringify(JSON.parse(S.__store.plursky_stage_calib_v1)[c.id].pending)), "a confirmed stage leaves no pending tap");
  check(S.clearStageCalibration(c.id) === true && S.attendEvidenceAnchors(c).length === 0, "Clear removes the calibration");
  // "No record": a saved set that is over, with no evidence, is listed; one
  // still to come is not.
  const nr = { ...c, id: "nr-fest", gpsAnchors: [{ stageId: "a", lat: 30.2650, lng: -97.7700, src: "osm" }] };
  const past = [{ id: "n1", name: "Past", day: 1, stage: "a", start: "20:00", end: "21:00" },
                { id: "n2", name: "Future", day: 1, stage: "a", start: "20:00", end: "21:00", __future: true }];
  const futureCfg = { ...nr, dayDates: { 1: { midnightUtc: Date.now() + 48 * H, m: 1, d: 1 } } };
  S._DATA_SETS[nr.id] = { config: nr, artists: [past[0]], stages };
  S._DATA_SETS["nr-future"] = { config: { ...futureCfg, id: "nr-future" }, artists: [past[1]], stages };
  S.__store["nr-fest_saved_v1"] = JSON.stringify(["n1"]);
  S.__store["nr-future_saved_v1"] = JSON.stringify(["n2"]);
  const rows = S.setReviewRows(nr);
  check(rows.length === 1 && rows[0].a.id === "n1" && rows[0].ev.length === 0 && rows[0].verdict === null, "a saved set that is over with no evidence is listed, with no verdict");
  check(S.setReviewRows({ ...futureCfg, id: "nr-future" }).length === 0, "a saved set still to come is not listed");
  const src = readFileSync(join(ROOT, "chrome.jsx"), "utf8");
  check(/: "No record";/.test(src) && !/["'>]Missed["'<]/.test(src), "the screens say \"No record\", never \"Missed\"");
  return { checks, failed, fails };
}

const base = run(load(DATA, CHROME));
const tap = await runTap(base.S);
const cal = await runCalib(base.S);
for (const f of [...base.fails, ...tap.fails, ...cal.fails]) console.log(`  ✗  ${f}`);

// ── 7. Mutations ──
const MUT = [
  ["data", 'if (m.locationSource === "gps-live" && m.stageId)', "if (m.stageId)"],
  ["data", "if (!stageId || !measured.has(stageId)) continue;", "if (!stageId) continue;"],
  ["data", 'm.tagSource !== "manual"', "true"],
  ["data", "if (!m || m.dateUnverified || m.festivalId !== cfg.id) continue;", "if (!m) continue;"],
  ["data", 'if (r.src === "photo" && rows.some(', 'if (false && rows.some('],
  ["data", "return naive - _utcOffsetMs(tz, naive - _utcOffsetMs(tz, naive));", "return naive;"],
  ["chrome", 'if (manual === "absent") return null;', ""],
  ["chrome", 'if (g.status !== "trusted") return {', 'if (false) return {'],
  ["chrome", "if (!list.some(t => t.ms === ms && t.stageId === stageId))", "if (true)"],
  ["data", "if (prev && _r.from <= prev.to)", "if (false)"],
  ["chrome", "fix.accuracy > STAGE_CALIB.maxAccM", "false"],
  ["chrome", "ms - p.ms < STAGE_CALIB.minGapMs", "false"],
  ["chrome", "<= STAGE_CALIB.agreeM", "<= 1e9"],
  ["chrome", "if (!_calibOnSite(cfg, fix))", "if (false)"],
  ["chrome", "need.some(id => !anchors[id])", "false"],
  ["data", "if (!cfg || !cfg.id || typeof stageCalibrationAnchors !== \"function\") return measured;", "return measured;"],
  ["chrome", "if (!manual && !ev.length && !attended.has(a.id) && !savedOver) continue;", "if (!manual && !ev.length && !attended.has(a.id)) continue;"],
];
let caught = 0, mutFail = 0;
for (const [file, from, to] of MUT) {
  const src = file === "data" ? DATA : CHROME;
  const n = src.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once in ${file} (${n}): ${from}`); continue; }
  let r;
  try {
    const S = file === "data" ? load(src.replace(from, to), CHROME) : load(DATA, src.replace(from, to));
    const a = run(S), b = await runTap(a.S), d = await runCalib(a.S);
    r = a.failed + b.failed + d.failed;
  } catch { r = 1; }
  if (r > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}
const total = base.checks + tap.checks + cal.checks, bad = base.failed + tap.failed + cal.failed;
const failed = bad + mutFail;
console.log(`${failed ? "✗" : "✓"} set evidence: ${total - bad}/${total} checks, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
