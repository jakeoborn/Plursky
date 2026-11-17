#!/usr/bin/env node
// SVG map: a live GPS fix is never drawn on poster art that no affine registers.
//
// The defect (#311, main efe65bc7): on a festival with poster art but no
// gpsAnchors (Escape, Nocturnal), MAP_AFFINE is null and gpsToMap() returns
// the grid centre {50,50} for EVERY fix. MapScreen built the live avatar from
// that, so wherever the user stood, the SVG TopDownMap drew "YOU" in the middle
// of the poster and the GPS pill read LIVE.
//
// The contract this gate holds:
//   1. _liveFixUnplaced(liveOnSite, hasAffine, onRealMap) is true exactly when
//      a live on-site fix would land on unregistered SVG art — on every
//      zero-anchor poster festival, and on none with an affine or on the real
//      basemap (#310 draws the raw fix there).
//   2. The GPS pill reads ON SITE, never LIVE, for that case (the pill
//      expression is lifted from map.jsx and evaluated, not pattern-matched).
//   3. MapScreen hands TopDownMap an avatar marked `unplaced` for that case,
//      and every avatar-anchored mark in TopDownMap (the dot, the YOU label,
//      both route lines, the crew proximity glow and the friend "nearby"
//      highlight) is guarded by !avatar.unplaced.
//
// Runs the REAL compiled code (build/data.js + build/map.js) in a vm per
// festival, plus source checks on map.jsx. No browser, no network.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean);
const MODS = FILES.map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
const BUILD = ["data", "map"].map(n => [n, readFileSync(join(ROOT, "build", `${n}.js`), "utf8")]);
const SRC = readFileSync(join(ROOT, "map.jsx"), "utf8");
const noop = () => {};
const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop, remove: noop } });

function load(fid) {
  const store = { onboarded: "v1", active_festival_id: fid, active_festival_explicit: "1" };
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Date, Math, JSON, Object, Array, Promise,
    String, Number, Boolean, Set, Map, WeakMap, Symbol, Proxy, Reflect, RegExp, Error, isNaN, parseInt, parseFloat, isFinite, Intl,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    fetch: () => new Promise(noop), URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  for (const [n, src] of BUILD) vm.runInContext(src, ctx, { filename: `build/${n}.js` });
  return vm.runInContext(`({ id: FESTIVAL_CONFIG.id, cfg: FESTIVAL_CONFIG, affine: MAP_AFFINE, gpsToMap, distMiles,
    unplaced: typeof _liveFixUnplaced === "function" ? _liveFixUnplaced : null })`, ctx);
}

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// Every festival module, read from its own registration (not a hand list).
const reg = {};
{
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  Object.assign(reg, ctx.window.PLURSKY_FESTIVALS || {});
}
const zeroAnchorPoster = Object.entries(reg)
  .filter(([, f]) => f.config.mapImage && f.config.mapMode !== "real" && !(f.config.gpsAnchors || []).length)
  .map(([id]) => id).sort();
const registered = Object.entries(reg)
  .filter(([, f]) => (f.config.gpsAnchors || []).length >= 3)
  .map(([id]) => id).sort();

// Positive controls: the two festivals the issue names must be in the set,
// and the set of registered festivals must not be empty.
check(zeroAnchorPoster.includes("escape-halloween-2026"), `escape-halloween-2026 must be a zero-anchor poster festival (found: ${zeroAnchorPoster.join(", ") || "none"})`);
check(zeroAnchorPoster.includes("nocturnal-wonderland-2026"), "nocturnal-wonderland-2026 must be a zero-anchor poster festival");
check(registered.length > 0, "at least one festival must carry >=3 gpsAnchors (control)");

// ── 1. The predicate, on the real compiled code, per festival ──
for (const fid of zeroAnchorPoster) {
  const P = load(fid);
  check(P.id === fid, `active festival is ${P.id}, not ${fid} (a gated id silently loads the default)`);
  check(!P.affine, `${fid}: MAP_AFFINE must be null (premise)`);
  check(typeof P.unplaced === "function", `${fid}: _liveFixUnplaced must exist in build/map.js`);
  if (typeof P.unplaced !== "function") continue;
  // Premise of the bug: two on-site fixes 267 m apart collapse to one grid point.
  const C = P.cfg.gps;
  const A = { lat: C.lat + 0.0012, lng: C.lng }, B = { lat: C.lat - 0.0012, lng: C.lng };
  const gA = P.gpsToMap(A.lat, A.lng), gB = P.gpsToMap(B.lat, B.lng);
  check(gA.x === gB.x && gA.y === gB.y, `${fid}: premise — distinct fixes collapse to one grid point without an affine`);
  check(P.unplaced(true, !!P.affine, false) === true, `${fid}: a live on-site fix on the SVG art must be unplaced`);
  check(P.unplaced(true, !!P.affine, true) === false, `${fid}: on the real basemap the raw fix is placed (#310), so not unplaced`);
  check(P.unplaced(false, !!P.affine, false) === false, `${fid}: no live on-site fix, nothing to hide (demo/off-site unchanged)`);
}
for (const fid of registered) {
  const P = load(fid);
  if (P.id !== fid) continue; // a gated id; covered by its own gates
  check(!!P.affine, `${fid}: >=3 anchors must solve an affine (control)`);
  if (typeof P.unplaced === "function") check(P.unplaced(true, !!P.affine, false) === false, `${fid}: a registered festival keeps its live dot`);
}

// ── 2. The pill, evaluated from map.jsx's own expression ──
{
  const m = SRC.match(/const gpsLabel = ([\s\S]*?);\n/);
  check(!!m, "map.jsx must define `const gpsLabel = …;`");
  if (m) {
    const pill = (v) => new Function(...Object.keys(v), `return (${m[1]});`)(...Object.values(v));
    const base = { gpsLive: true, gpsStatus: "live", isLiveOnSite: true };
    check(pill({ ...base, fixUnplaced: true }) === "ON SITE", `unplaced live fix: pill reads "${pill({ ...base, fixUnplaced: true })}", must read ON SITE`);
    check(pill({ ...base, fixUnplaced: false }) === "LIVE", "placed live fix: pill still reads LIVE (control)");
    check(pill({ ...base, isLiveOnSite: false, fixUnplaced: false }) === "OFF-SITE", "off-site: pill still reads OFF-SITE (control)");
  }
}

// ── 3. Wiring: MapScreen marks the avatar; TopDownMap guards every mark ──
check(/const fixUnplaced = _liveFixUnplaced\(isLiveOnSite, !!MAP_AFFINE, useRealMap\);/.test(SRC),
  "MapScreen must compute fixUnplaced from isLiveOnSite, MAP_AFFINE and useRealMap");
check(/<TopDownMap\s+avatar=\{fixUnplaced \? \{ \.\.\.avatar, unplaced: true \} : avatar\}/.test(SRC),
  "MapScreen must pass TopDownMap an avatar marked unplaced when fixUnplaced");
{
  const lines = SRC.split("\n");
  const start = lines.findIndex(l => /^function TopDownMap\(/.test(l));
  let end = lines.findIndex((l, i) => i > start && /^function /.test(l));
  if (end < 0) end = lines.length;
  check(start >= 0, "TopDownMap must exist");
  let uses = 0;
  for (let i = start + 1; i < end; i++) {
    if (!/\bavatar\.[xy]\b/.test(lines[i])) continue;
    uses++;
    if (lines[i].includes("!avatar.unplaced")) continue;
    let j = i - 1;
    while (j > start && !/^ {8}\{/.test(lines[j])) j--;
    check(j > start && lines[j].includes("!avatar.unplaced"),
      `map.jsx:${i + 1} draws from avatar.x/y without an !avatar.unplaced guard`);
  }
  // Floor: the pass must have seen the marks (an empty scan proves nothing).
  check(uses >= 15, `expected >=15 avatar.x/y uses in TopDownMap, scanned ${uses} (the scan broke?)`);
}

console.log(`  live fix on unregistered art: ${checks} checks · ${zeroAnchorPoster.length} zero-anchor poster festivals (${zeroAnchorPoster.join(", ")})`);
if (failed) { console.log(`  ✗ ${failed} failed`); process.exit(1); }
console.log("  ✓ a live fix is never drawn on art no affine registers, and never labelled LIVE there");
