#!/usr/bin/env node
// Real basemap: a live GPS fix is drawn where it is, with or without an affine.
//
// The defect (main c0b8b3e): on a festival with no gpsAnchors (III Points,
// pre-flip; it now carries a poster-class affine — see section 1),
// mapMode "real") MAP_AFFINE is null, gpsToMap() returns the grid centre for
// every fix and RealMap drew the user through mapToGps(x, y), which then
// returns the venue centroid. Two real fixes 220 m apart both rendered on the
// centroid; a meet pin dropped anywhere on the basemap landed there too.
//
// The contract this gate holds:
//   1. RealMap places the avatar, the meet pin and the route ends through
//      _lngLatOf(): a point's own raw GPS when it carries one, else the affine.
//   2. The live avatar carries its raw fix {lat, lng, accuracy, ts}; a meet pin
//      dropped on the basemap carries the clicked lat/lng, and so does the
//      rally it is broadcast as.
//   3. The demo avatar carries no GPS, so it is never drawn as a real fix.
//   4. A festival WITH a registered affine is unchanged for points without GPS.
//
// Runs the REAL compiled code (build/data.js + build/map.js) in a vm per
// festival, plus source checks on the RealMap call sites. No browser, no
// network: the walking check with MapLibre is scripts/e2e-real-map-raw-gps.mjs.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean).map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
const BUILD = ["data", "map"].map(n => [n, readFileSync(join(ROOT, "build", `${n}.js`), "utf8")]);
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
  return vm.runInContext("({ id: FESTIVAL_CONFIG.id, cfg: FESTIVAL_CONFIG, affine: MAP_AFFINE, placed: PLACED_STAGES, placesChecked: REAL_MAP_PLACES_CHECKED, gpsToMap, mapToGps, _lngLatOf, distMiles })", ctx);
}

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const m = (P, a, b) => P.distMiles(a.lat, a.lng, b.lat, b.lng) * 1609.34;

// ── 1. III Points: poster-class affine; raw fixes are drawn where they are ──
// FLIP 2026-10-15: III Points now has 13 poster gpsAnchors, so MAP_AFFINE is
// solved — but the registration is UNCHECKED (no osm/crowd evidence), so
// placesChecked stays false and stage pins still do not render on the real
// map. The raw-GPS contract below is unchanged: fixes draw where they are.
{
  const P = load("iii-points-2026");
  check(P.id === "iii-points-2026", `active festival is ${P.id}, not iii-points-2026 (a gated id silently loads the default)`);
  check(!!P.affine, "III Points has 13 poster gpsAnchors, so MAP_AFFINE is solved (flip premise)");
  check(P.placesChecked === false, "all anchors are poster-class, so the real map must NOT place stage pins (flip premise)");
  const C = P.cfg.gps;
  // Two fixes inside the geofence, 220 m apart east-west across the site.
  const A = { lat: 25.7980, lng: -80.2027 }, B = { lat: 25.7980, lng: -80.2005 };
  const onSite = p => P.distMiles(p.lat, p.lng, C.lat, C.lng) <= C.onSiteRadiusMi;
  check(onSite(A) && onSite(B), "fixture fixes must both be inside the on-site radius");
  check(m(P, A, B) > 200, `fixture fixes must be >200 m apart (are ${m(P, A, B).toFixed(0)} m)`);
  // With an affine, the grid tells the two fixes apart too.
  const gA = P.gpsToMap(A.lat, A.lng), gB = P.gpsToMap(B.lat, B.lng);
  check(!(gA.x === gB.x && gA.y === gB.y), "with an affine gpsToMap no longer collapses distinct fixes to one grid point");
  // The fix: the live avatar shape MapScreen builds, drawn by _lngLatOf.
  const av = p => ({ x: 50, y: 50, live: true, gps: { lat: p.lat, lng: p.lng, accuracy: 8, ts: 1 } });
  const dA = P._lngLatOf(av(A)), dB = P._lngLatOf(av(B));
  check(m(P, dA, A) < 0.5, `fix A drawn ${m(P, dA, A).toFixed(1)} m from its raw input`);
  check(m(P, dB, B) < 0.5, `fix B drawn ${m(P, dB, B).toFixed(1)} m from its raw input`);
  check(m(P, dA, dB) > 200, `fixes A and B drawn ${m(P, dA, dB).toFixed(0)} m apart, must stay distinct (>200 m)`);
  check(m(P, dA, C) > 50 && m(P, dB, C) > 50, "neither live fix may collapse onto the venue centroid");
  // Meet pin dropped on the basemap: the clicked lat/lng survives the roundtrip.
  const T = { lat: 25.7985, lng: -80.2010 };
  const pin = P._lngLatOf({ x: 50, y: 50, gps: T, label: "Meet here" });
  check(m(P, pin, T) < 0.5, `meet pin drawn ${m(P, pin, T).toFixed(1)} m from where it was dropped`);
  // Demo avatar: no gps, so it goes through the affine's grid path — finite,
  // in range, and never presented as a real fix.
  const demo = P._lngLatOf({ x: 30, y: 70 });
  const viaAffine = P.mapToGps(30, 70);
  check(demo.lat === viaAffine.lat && demo.lng === viaAffine.lng, "a point without gps resolves through the affine, as before");
  // Broken gps falls back instead of drawing NaN.
  const bad = P._lngLatOf({ x: 50, y: 50, gps: { lat: NaN, lng: -80.2 } });
  check(Number.isFinite(bad.lat) && Number.isFinite(bad.lng), "a non-finite gps must fall back, never draw NaN");
  // A gps from another phone (crew location, rally) is untrusted: finite but
  // out of range would make MapLibre throw and take the map down.
  const fallback = P.mapToGps(50, 50);
  for (const g of [{ lat: 1e308, lng: 0 }, { lat: 91, lng: -80.2 }, { lat: 25.8, lng: -181 }, { lat: "25.8", lng: -80.2 }, null]) {
    const r = P._lngLatOf({ x: 50, y: 50, gps: g });
    check(Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180 && r.lat === fallback.lat && r.lng === fallback.lng, `gps ${JSON.stringify(g)} must be rejected and fall back to the grid path`);
  }
  // Stage pins: 13 stages carry poster x/y now, but the real map pins none
  // until an osm/crowd anchor corroborates the registration.
  check(P.placed.length === 13, `III Points has ${P.placed.length} placed stages, expected 13 poster reads`);
  check(P.placesChecked === false, "poster anchors cannot place real-map pins — corroboration first");
}

// ── 2. A festival with a registered affine: grid points unchanged ───────────
{
  // ACL 2026: gpsAnchors over poster art. (An ended festival that the switch
  // refuses would silently load the default, hence the id check.)
  const P = load("acl-2026");
  check(P.id === "acl-2026", `active festival is ${P.id}, not acl-2026`);
  check(!!P.affine, "ACL has gpsAnchors, so MAP_AFFINE must be solved (fixture premise)");
  check(P.placed.length > 0, "ACL has placed stages (fixture premise)");
  for (const s of P.placed.slice(0, 5)) {
    const a = P._lngLatOf({ x: s.x, y: s.y }), b = P.mapToGps(s.x, s.y);
    check(a.lat === b.lat && a.lng === b.lng, `${s.id}: a grid point must still go through the affine`);
  }
  const wild = P._lngLatOf({ x: 1e300, y: -1e300 });
  check(Math.abs(wild.lat) <= 90 && Math.abs(wild.lng) <= 180, "an absurd grid point (e.g. from a rally) never projects out of range");
  const F = { lat: P.cfg.gps.lat + 0.001, lng: P.cfg.gps.lng - 0.001 };
  const d = P._lngLatOf({ x: 10, y: 10, live: true, gps: F });
  check(m(P, d, F) < 0.5, "a live fix is drawn at its raw position on an affine festival too");
}

// ── 2b. Zero anchors over poster art (Escape): the real basemap still moves the dot ──
{
  const P = load("escape-halloween-2026");
  check(P.id === "escape-halloween-2026", `active festival is ${P.id}, not escape-halloween-2026`);
  check(P.affine === null && P.placed.length > 0, "Escape has placed stages but no affine (fixture premise)");
  const C = P.cfg.gps, A = { lat: C.lat + 0.0012, lng: C.lng }, B = { lat: C.lat - 0.0012, lng: C.lng };
  const dA = P._lngLatOf({ x: 50, y: 50, live: true, gps: A }), dB = P._lngLatOf({ x: 50, y: 50, live: true, gps: B });
  check(m(P, dA, A) < 0.5 && m(P, dB, B) < 0.5 && m(P, dA, dB) > 200, "on a zero-anchor festival two live fixes are drawn apart at their raw positions");
}

// ── 3. Source: RealMap places the avatar via _lngLatOf, targets via _realMapTarget ──
{
  const src = readFileSync(join(ROOT, "map.jsx"), "utf8");
  const start = src.indexOf("function RealMap(");
  const end = src.indexOf("\nfunction ", start + 20);
  const body = src.slice(start, end);
  check(start > 0 && end > start, "RealMap body found");
  for (const bad of ["mapToGps(avatar.x", "mapToGps(meetTarget.x", "mapToGps(target.x"])
    check(!body.includes(bad), `RealMap still places a point with ${bad}, …) instead of _lngLatOf()`);
  check(/_lngLatOf\(avatar\)/.test(body) && /_lngLatOf\(avatarRef\.current\)/.test(body), "RealMap draws the avatar via _lngLatOf (create from the latest avatar, follow)");
  // #313 item 7: targets (meet pin, route ends, crew) go through _realMapTarget,
  // which keeps raw GPS and refuses a poster x/y on an unchecked festival.
  check(/_realMapTarget\(avatar\)/.test(body) && /_realMapTarget\(target\)/.test(body), "RealMap draws the route between two placeable ends (_realMapTarget)");
  check(/_realMapTarget\(meetTarget\)/.test(body), "RealMap draws the meet pin via _realMapTarget(meetTarget)");
  check(/onMapClickRef\.current\(\{[^}]*gps: \{ lat: ll\.lat, lng: ll\.lng \}/.test(body), "a basemap click hands its lat/lng to onMapClick");
  check(/avatar\.gps\?\.lat, avatar\.gps\?\.lng\]/.test(body), "the avatar follow effect re-runs when the raw fix moves");
  check(/gps: \{ lat: gpsPos\.lat, lng: gpsPos\.lng/.test(src), "the live avatar carries the raw fix");
  check(/live: true, gps: liveAvatar\.gps/.test(src), "MapScreen passes the raw fix on the avatar");
  check(/\.\.\.\(xy\.gps \? \{ gps: xy\.gps \} : \{\}\)/.test(src), "MapScreen keeps the clicked lat/lng on the meet target");
  check(/gps: meetTarget\.gps \|\| null/.test(src), "a rally carries the meet pin's lat/lng");
  // The overlay re-stack ran moveLayer on every styledata, and moveLayer fires
  // styledata: the style never settled, so "load" never fired and no avatar or
  // stage marker was ever added (measured on III Points and ACL, main c0b8b3e).
  check(/if \(_top\.some\(\(id, i\) => _tail\[i\] !== id\)\) _top\.forEach/.test(body), "RealMap re-stacks its overlay layers only when they are out of order (no styledata loop)");
  check(!/\]\.forEach\(\(id\) => \{\s*try \{ if \(map\.getLayer\(id\)\) map\.moveLayer\(id\)/.test(body), "the unconditional moveLayer loop is gone");
  check(/const ll = _realMapTarget\(f\);/.test(body), "crew friend markers go through the range-checked _realMapTarget");
  check(/\.\.\.\(_validGps\(incomingRally\.gps\)/.test(src), "an accepted rally's gps is range-checked");
  check(/const routingLabel = !avatar\?\.live \? "ROUTE PREVIEW" : "YOUR LOCATION LIVE";/.test(src), "the meet sheet says YOUR LOCATION LIVE only for a live avatar, else ROUTE PREVIEW");
  check(!/WALKING`/.test(src) && /\$\{meetGroup\.length \? ` · YOU \+ \$\{meetGroup\.length\}` : ""\}/.test(src), "the meet banner names who the meetup is for, never claims anyone is WALKING");
  check(!/(ALL|BOTH) ROUTING LIVE/.test(src), "no ALL/BOTH ROUTING LIVE crew claim (friends' freshness is not checked there)");
  check(/const gpsPos = _gpsFresh \? _gpsRaw : null;/.test(src), "MapScreen reads the fix only while useGeolocation says it is live");
  check(/live: _gpsFresh \} = useGeolocation\(gpsLive\)/.test(src), "MapScreen takes the live flag from useGeolocation");
  const sb = readFileSync(join(ROOT, "supabase.jsx"), "utf8");
  check(/Math\.abs\(gps\.lat\) <= 90 && Math\.abs\(gps\.lng\) <= 180/.test(sb), "sbBroadcastRally range-checks the pin's lat/lng");
  check(/function sbBroadcastRally\(\{ x, y, label, stageId, gps \}\)/.test(sb) && /\.\.\.\(g \? \{ gps: g \} : \{\}\)/.test(sb), "sbBroadcastRally sends the pin's lat/lng");
}

// ── 4. useGeolocation: OFF, an error and a stale fix are never LIVE ─────────
// Runs the real hook from build/map.js under a minimal one-component hook
// runner, with a scripted navigator.geolocation and a hand-driven clock.
{
  const A = { lat: 25.7980, lng: -80.2027 }, B = { lat: 25.7980, lng: -80.2005 };
  const runHook = () => {
    let now = Date.parse("2026-10-17T02:00:00Z");
    const watchers = new Map(); let nextId = 1; const intervals = new Map(); let nextT = 1;
    const slots = []; let effects = []; let dirty = false; let i = 0;
    const R = {
      useState(init) { const k = i++; if (!(k in slots)) slots[k] = { v: typeof init === "function" ? init() : init };
        const sl = slots[k]; return [sl.v, (v) => { const nv = typeof v === "function" ? v(sl.v) : v; if (nv !== sl.v) { sl.v = nv; dirty = true; } }]; },
      useReducer(f, init) { const [v, set] = R.useState(init); return [v, (a) => set((x) => f(x, a))]; },
      useEffect(fn, deps) { const k = i++; const sl = slots[k]; const changed = !sl || !deps || deps.some((d, j) => d !== sl.deps[j]);
        if (changed) effects.push(() => { sl?.cleanup?.(); slots[k] = { deps, cleanup: fn() }; }); },
      useRef(v) { const k = i++; if (!(k in slots)) slots[k] = { current: v }; return slots[k]; },
      useMemo(fn) { return fn(); }, useCallback(fn) { return fn; },
    };
    const geo = {
      watchPosition(ok, err) { const id = nextId++; watchers.set(id, { ok, err }); return id; },
      clearWatch(id) { watchers.delete(id); },
    };
    const ctx = {};
    const store = { onboarded: "v1", active_festival_id: "iii-points-2026", active_festival_explicit: "1" };
    Object.assign(ctx, {
      console: { log: noop, warn: noop, error: noop }, Math, JSON, Object, Array, Promise, String, Number, Boolean, Set, Map, WeakMap, Symbol, Proxy, Reflect, RegExp, Error, isNaN, parseInt, parseFloat, isFinite, Intl,
      Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } },
      setTimeout: noop, clearTimeout: noop, requestAnimationFrame: noop,
      setInterval: (f, ms) => { const id = nextT++; intervals.set(id, { f, ms }); return id; }, clearInterval: (id) => intervals.delete(id),
      fetch: () => new Promise(noop), URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
      localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
      sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      navigator: { userAgent: "node", geolocation: geo, vibrate: noop, onLine: true },
      document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(), createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
      React: R, ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
      matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }), addEventListener: noop, removeEventListener: noop,
    });
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(MODS, ctx);
    for (const [n, src] of BUILD) vm.runInContext(src, ctx, { filename: `build/${n}.js` });
    ctx.useBatterySaver = () => ({ active: false });
    const hook = vm.runInContext("useGeolocation", ctx);
    let enabled = true, out;
    const render = () => { for (let n = 0; n < 20; n++) { i = 0; dirty = false; effects = []; out = hook(enabled); const fx = effects; fx.forEach(f => f()); if (!dirty && !fx.length) return out; } return out; };
    return {
      render, get out() { return out; }, setEnabled(v) { enabled = v; return render(); },
      // The first render after a change, before any effect runs: what the
      // screen shows in that frame.
      firstFrame(v) { enabled = v; i = 0; effects = []; const o = hook(enabled); effects = []; return o; },
      // Time passes with no interval tick (a backgrounded phone throttles timers).
      sleep(ms) { now += ms; i = 0; effects = []; const o = hook(enabled); effects = []; return o; },
      fix(lat, lng) { for (const w of watchers.values()) w.ok({ coords: { latitude: lat, longitude: lng, accuracy: 8 } }); return render(); },
      fail(code) { for (const w of watchers.values()) w.err({ code }); return render(); },
      advance(ms) { const end = now + ms; while (now < end) { now += 5000; for (const t of intervals.values()) t.f(); } return render(); },
      watchers: () => watchers.size,
    };
  };
  let h = runHook(); h.render();
  let o = h.fix(A.lat, A.lng);
  check(o.live === true && o.status === "live" && o.pos?.lat === A.lat, `a fresh fix is live (live=${o.live}, status=${o.status})`);
  o = h.firstFrame(false);
  check(o.live === false, "the very frame GPS turns OFF is not live (before the effect drops the fix)");
  h.render();
  o = h.setEnabled(false);
  check(o.live === false && o.pos === null && o.status === "idle", `live fix -> GPS OFF: not live, fix dropped (live=${o.live}, pos=${JSON.stringify(o.pos)}, status=${o.status})`);
  check(h.watchers() === 0, "GPS OFF stops the watch");
  o = h.setEnabled(true); o = h.fix(A.lat, A.lng);
  check(o.live === true, "GPS back ON with a new fix is live again");
  o = h.fail(2);
  check(o.live === false && o.pos === null && o.status === "unavailable", `live fix -> position error: not live, fix dropped (status=${o.status})`);
  o = h.fix(B.lat, B.lng); o = h.fail(1);
  check(o.live === false && o.pos === null && o.status === "denied", `live fix -> permission denied: not live, fix dropped (status=${o.status})`);
  h = runHook(); h.render(); h.fix(A.lat, A.lng);
  o = h.sleep(65000);
  check(o.live === false, "a 65 s old fix read before any tick fires is not live");
  h = runHook(); h.render(); h.fix(A.lat, A.lng);
  o = h.advance(55000);
  check(o.live === true, "a fix 55 s old is still live");
  o = h.advance(10000);
  check(o.live === false && o.status === "stale", `live fix -> no update for 65 s: stale, not live (live=${o.live}, status=${o.status})`);
  o = h.fix(B.lat, B.lng);
  check(o.live === true && o.status === "live", "a new fix after stale is live again");
  o = h.fix(91, B.lng);
  check(o.live === false, "an out-of-range fix is never live");
}

if (failed) { console.log(`✗ real map raw GPS: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ real map raw GPS: ${checks} checks — no-affine fixes drawn at their raw position, meet pin roundtrips, affine festivals unchanged`);
