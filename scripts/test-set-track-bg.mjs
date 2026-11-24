#!/usr/bin/env node
// Attendance option B (SPEC-192): set tracking with the screen locked, iPhone
// app only, When In Use only. Pure rules run on the REAL compiled build/*.js
// in a vm, on a synthetic festival (no live data). Static checks read code.
//   1. setTrackWindows: timed sets ± grace, merged per day, blank times add
//      nothing, past windows dropped. Mutation: widen the grace → caught.
//   2. setTrackIngest: held fixes go through attendQualifyFixes on measured
//      stages only, become runs with no coordinate; another festival's fixes
//      and off-stage fixes are dropped. Positive control: 3 in-window fixes at
//      a measured stage make one run.
//   3. Swift: no Always request, no region, no significant-change wake; the
//      session starts only with the app in front; ends at window end, on
//      disarm and at the battery floor; held fixes excluded from backup and
//      deleted on drain; the battery test is internal-build-only by the same
//      rule as ShazamPlugin.buildChannel.
//   4. Info.plist: UIBackgroundModes is exactly [location]; no Always string.
//   5. Page wiring: arm only while visible, a hide never disarms, Clear and
//      Delete all reach the native queue, the test row renders only when the
//      plugin says internal.
// Not wired into verify.mjs: that is a gate edit and goes to Jake with the
// two set-tracking gate edits.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const DATA = readFileSync(join(ROOT, "build", "data.js"), "utf8");
const CHROME = readFileSync(join(ROOT, "build", "chrome.js"), "utf8");
// chrome.js reads globals from the files that load before it (index.html order).
const BEFORE_CHROME = ["supabase.js", "machine.js"].map(f => readFileSync(join(ROOT, "build", f), "utf8"));
const noop = () => {};
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log("  ✗ " + msg); } else console.log("  ✓ " + msg); };

function ctxFor() {
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
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(), visibilityState: "visible",
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  ctx.__store = store;
  const deep = new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : deep), apply: () => deep });
  ctx.supabase = { createClient: () => deep };
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  return ctx;
}

const H = 3600000, M = 60000;
const MID = Date.UTC(2026, 9, 2, 5);                       // Oct 2 00:00 CDT
const cfg = { id: "fixture-fest", tz: "America/Chicago",
  dayDates: { 1: { midnightUtc: MID, m: 9, d: 2 }, 2: { midnightUtc: MID + 24 * H, m: 9, d: 3 } },
  startMs: MID + 12 * H, endMs: MID + 54 * H,
  gpsAnchors: [{ stageId: "main", lat: 30.2670, lng: -97.7730, src: "osm" }] };
const act = (id, day, start, end, extra = {}) => ({ id, name: id, day, stage: "main", start, end, ...extra });
const lineup = [
  act("a1", 1, "18:00", "19:00"), act("a2", 1, "19:30", "20:30"), act("a3", 1, "21:30", "00:30"),
  act("b1", 2, "16:00", "17:00"), act("tba", 2, "TBA", "TBA"),
];

// ── 1. windows ──
function windowsOn(src) {
  const ctx = ctxFor();
  vm.runInContext(src, ctx, { filename: "build/data.js" });
  return vm.runInContext("({ setTrackWindows, attendTimeClass, ATTEND_GRACE_MS })", ctx);
}
{
  const S = windowsOn(DATA);
  check(S.attendTimeClass(lineup[0]) !== "blank", "positive control: a fixture act with times is timed (" + S.attendTimeClass(lineup[0]) + ")");
  check(S.attendTimeClass(lineup[4]) === "blank", "a TBA act is blank");
  const w = S.setTrackWindows(cfg, lineup);
  const g = S.ATTEND_GRACE_MS;
  const d1s = MID + 18 * H - g, d1e = MID + 24.5 * H + g, d2s = MID + 40 * H - g, d2e = MID + 41 * H + g;
  check(w.length === 2, "day 1 merges into one window (gaps ≤ 90 min), day 2 is its own (" + w.length + ")");
  check(w[0] && w[0].from === d1s && w[0].to === d1e, "day 1 window = first set start − grace … last set end (past midnight) + grace");
  check(w[1] && w[1].from === d2s && w[1].to === d2e, "day 2 window = its one timed set ± grace; the TBA act adds nothing");
  check(S.setTrackWindows(cfg, lineup, MID + 30 * H).length === 1, "windows that ended before now are dropped");
  check(S.setTrackWindows(cfg, [lineup[4]]).length === 0, "no timed sets → no windows (the session never holds a fix)");
  const mut = DATA.replace("from: s - ATTEND_GRACE_MS", "from: s - 4 * ATTEND_GRACE_MS");
  const caught = mut !== DATA && (() => { const W2 = windowsOn(mut).setTrackWindows(cfg, lineup); return !(W2[0] && W2[0].from === d1s); })();
  check(caught, "mutation: widening the grace moves the window and is caught");
}

// ── 2. ingest ──
{
  const ctx = ctxFor();
  vm.runInContext(DATA, ctx, { filename: "build/data.js" });
  let loaded = true;
  try { for (const s of BEFORE_CHROME) vm.runInContext(s, ctx); vm.runInContext(CHROME, ctx, { filename: "build/chrome.js" }); } catch (e) { loaded = false; console.log("  (chrome.js load: " + e.message + ")"); }
  check(loaded, "build/chrome.js loads in the vm");
  if (loaded) {
    const ingest = vm.runInContext("setTrackIngest", ctx);
    const t0 = MID + 18 * H + 10 * M;
    const at = (ms, extra = {}) => ({ lat: 30.2670, lng: -97.7730, accuracy: 8, timestamp: ms, atMs: ms, festivalId: "fixture-fest", ...extra });
    const n = ingest("fixture-fest", [at(t0), at(t0 + M), at(t0 + 2 * M)], cfg);
    const store = JSON.parse(ctx.__store.plursky_set_intervals_v1 || "{}");
    const runs = (store["fixture-fest"] && store["fixture-fest"].runs) || {};
    check(n === 3 && (runs.main || []).length === 1, "positive control: 3 held fixes at a measured stage → one run (" + n + ", " + JSON.stringify(runs) + ")");
    check(!/lat|lng|coords|accuracy/.test(ctx.__store.plursky_set_intervals_v1 || ""), "what is stored carries no coordinate");
    const other = ingest("fixture-fest", [at(t0 + 3 * M, { festivalId: "other-fest" })], cfg);
    check(other === 0, "a fix held for another festival is dropped");
    const far = ingest("fixture-fest", [at(t0 + 4 * M, { lat: 30.30, lng: -97.70 })], cfg);
    check(far === 0, "a fix nowhere near a measured stage is dropped (the one gate)");
    const coarse = ingest("fixture-fest", [at(t0 + 5 * M, { accuracy: 400 })], cfg);
    check(coarse === 0, "a coarse fix is dropped (the one gate)");
  }
}

// ── 3. Swift ──
const code = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const SWIFT = code(readFileSync(join(ROOT, "ios/App/App/SetTrackPlugin.swift"), "utf8"));
check(!/requestAlwaysAuthorization/.test(SWIFT), "never asks for Always");
check(!/startMonitoring\(for:/.test(SWIFT) && !/CLCircularRegion|CLRegion/.test(SWIFT), "no region monitoring");
check(!/startMonitoringSignificantLocationChanges|startMonitoringVisits/.test(SWIFT), "no significant-change or visit wake");
check(/if want, !tracking, canStart \{ startTracking\(\) \}/.test(SWIFT) && /evaluate\(canStart: appInFront\)/.test(SWIFT)
  && (SWIFT.match(/canStart: true/g) || []).length === 0, "the session starts only with the app in front (When In Use)");
check(/applicationState != \.background/.test(SWIFT), "in front = not background");
check(/if !want \{ stopTracking\(\) \}/.test(SWIFT) && /inSpan\(now\)/.test(SWIFT), "it stops once now is past the day's last window");
check(/func disarm\(\)[\s\S]{0,200}clear\(\)[\s\S]{0,80}evaluate\(canStart: false\)/.test(SWIFT), "Turn off disarms, deletes held fixes and re-evaluates (stops)");
check(/batteryFloor: Float = 0\.20/.test(SWIFT) && /!batteryLow/.test(SWIFT), "it ends itself below 20% battery");
check(/guard inWindow\(ms\)/.test(SWIFT), "a fix outside every set window is never written");
check(/isExcludedFromBackup = true/.test(SWIFT), "held fixes are excluded from backup");
check(/func drain\(\)[\s\S]{0,120}clear\(\)/.test(SWIFT), "drain deletes the file");
check(/showsBackgroundLocationIndicator = true/.test(SWIFT), "iOS shows the location indicator while it runs");
check(/CLBackgroundActivitySession\(\)/.test(SWIFT) && /allowsBackgroundLocationUpdates = true/.test(SWIFT), "iOS 17+ background activity session; iOS 15-16 background updates");
// The battery test is compiled out of every Release archive (TestFlight and
// App Store ship the same binary): its plugin methods, its engine entry
// points and the internal flag exist only under #if DEBUG.
const releaseView = SWIFT.replace(/#if DEBUG[\s\S]*?(#else([\s\S]*?))?#endif/g, (m, e, rel) => rel || "");
check(!/testStart|testStop|startTest|stopTest/.test(releaseView) && /CAPPluginMethod\(name: "testStart"/.test(SWIFT), "Release build: no battery-test method or entry point is compiled in");
check(/private var internalBuild: Bool \{\s*#if DEBUG\s*return true\s*#else\s*return false\s*#endif/.test(SWIFT) && !/sandboxReceipt/.test(SWIFT), "internal = Debug builds only (no TestFlight receipt path)");
const PBX = readFileSync(join(ROOT, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
const conds = [...PBX.matchAll(/SWIFT_ACTIVE_COMPILATION_CONDITIONS = ([^;]*);[\s\S]*?name = (\w+);/g)].map(m => [m[2], m[1].trim()]);
check(conds.length > 0 && conds.every(([n, v]) => n === "Debug" ? /DEBUG/.test(v) : !/DEBUG/.test(v)), "DEBUG is defined in Debug configurations only (" + conds.map(c => c.join("=")).join(", ") + ")");
check(/if testing \{ testFixes \+= 1; return \}/.test(SWIFT), "the battery test writes no fix, only a count");

// ── 4. Info.plist ──
const PLIST = readFileSync(join(ROOT, "ios/App/App/Info.plist"), "utf8");
const modes = (PLIST.match(/<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/) || ["", ""])[1].match(/<string>[^<]*<\/string>/g) || [];
check(modes.length === 1 && modes[0] === "<string>location</string>", "UIBackgroundModes is exactly [location] (" + modes.join(",") + ")");
check(!/NSLocationAlways/.test(PLIST), "no Always usage string");
check(/NSLocationWhenInUseUsageDescription/.test(PLIST), "positive control: the When In Use key is read");

// ── 5. page wiring ──
const CSRC = code(readFileSync(join(ROOT, "chrome.jsx"), "utf8"));
const watcher = (CSRC.match(/function SetTrackingWatcher\(\)[\s\S]*?\n}\n/) || [""])[0];
check(/if \(!P \|\| !visible\) return;/.test(watcher), "the plugin is armed only while the page is visible");
check(!/visibilitychange[^\n]*disarm|hidden[^\n]*disarm/.test(watcher), "a hide never disarms");
check(/pref && fid && elig === "live"/.test(watcher) && /P\.disarm\(\)/.test(watcher), "armed only when on and live; disarmed otherwise");
check(/!\(native && _setTrackNativeOn\)/.test(watcher), "no second GPS watch while the native session runs");
check(/function clearSetTrack[\s\S]{0,600}_setTrackNativeClear\(\)/.test(CSRC) && /function clearAllSetTrack\(\)[\s\S]{0,300}_setTrackNativeClear\(\)/.test(CSRC), "Clear <festival> and Delete all reach the native queue");
check(/setTrackIngest\(r && r\.festivalId/.test(CSRC) && /function setTrackIngest[\s\S]{0,700}attendQualifyFixes\(samples, attendEvidenceAnchors\(c\)/.test(CSRC), "drained fixes go through attendQualifyFixes on measured stages only");
check(/data-set-tracking-delete-all onClick=\{\(\) => setConfirmDelete\(true\)\}/.test(CSRC) && /data-set-tracking-delete-yes onClick=\{\(\) => \{ clearAllSetTrack\(\)/.test(CSRC)
  && !/data-set-tracking-delete-all onClick=\{clearAllSetTrack\}/.test(CSRC), "Delete all set times asks to confirm before deleting");
const iosConsent = (CSRC.match(/\{native \? \([\s\S]*?<div style=\{body\}>([\s\S]*?)<\/div>/) || ["", ""])[1];
check(/Your exact location:<\/b> kept on this phone only until Plursky turns it into stage times, then deleted/.test(iosConsent) && !/Not recorded/.test(iosConsent), "iOS consent says raw locations are held until turned into stage times (no \"not recorded\" claim)");
check(/Never sent to Plursky or anyone else\. Your own iPhone backup can include the stage times/.test(iosConsent) && !/Nothing leaves this phone/.test(iosConsent), "iOS consent names the iPhone backup instead of \"nothing leaves this phone\"");
check(/native && _setTrackInternal && <SetTrackBatteryTest/.test(CSRC) && /if \(!P \|\| !_setTrackInternal\) return null;/.test(CSRC), "the battery test row renders only when the plugin says internal");

console.log((failed ? "✗" : "✓") + " set tracking B: " + (checks - failed) + "/" + checks + " checks");
process.exit(failed ? 1 : 0);
