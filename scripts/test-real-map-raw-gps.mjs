#!/usr/bin/env node
// Real basemap: a live GPS fix is drawn where it is, with or without an affine.
//
// The defect (main c0b8b3e): on a festival with no gpsAnchors (III Points,
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
  return vm.runInContext("({ id: FESTIVAL_CONFIG.id, cfg: FESTIVAL_CONFIG, affine: MAP_AFFINE, placed: PLACED_STAGES, gpsToMap, mapToGps, _lngLatOf, distMiles })", ctx);
}

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const m = (P, a, b) => P.distMiles(a.lat, a.lng, b.lat, b.lng) * 1609.34;

// ── 1. III Points: no affine; raw fixes are drawn where they are ─────────────
{
  const P = load("iii-points-2026");
  check(P.id === "iii-points-2026", `active festival is ${P.id}, not iii-points-2026 (a gated id silently loads the default)`);
  check(P.affine === null, "III Points has no gpsAnchors, so MAP_AFFINE must be null (fixture premise)");
  const C = P.cfg.gps;
  // Two fixes inside the geofence, 220 m apart east-west across the site.
  const A = { lat: 25.7980, lng: -80.2027 }, B = { lat: 25.7980, lng: -80.2005 };
  const onSite = p => P.distMiles(p.lat, p.lng, C.lat, C.lng) <= C.onSiteRadiusMi;
  check(onSite(A) && onSite(B), "fixture fixes must both be inside the on-site radius");
  check(m(P, A, B) > 200, `fixture fixes must be >200 m apart (are ${m(P, A, B).toFixed(0)} m)`);
  // The defect's cause, kept visible: the grid cannot tell these apart.
  const gA = P.gpsToMap(A.lat, A.lng), gB = P.gpsToMap(B.lat, B.lng);
  check(gA.x === 50 && gA.y === 50 && gB.x === 50 && gB.y === 50, "without an affine gpsToMap returns the grid centre (premise)");
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
  // Demo avatar: no gps, so it stays on the grid path and is not a real fix.
  const demo = P._lngLatOf({ x: 30, y: 70 });
  check(m(P, demo, C) < 0.5, "a point without gps on a no-affine festival resolves to the centroid, as before");
  // Broken gps falls back instead of drawing NaN.
  const bad = P._lngLatOf({ x: 50, y: 50, gps: { lat: NaN, lng: -80.2 } });
  check(Number.isFinite(bad.lat) && Number.isFinite(bad.lng), "a non-finite gps must fall back, never draw NaN");
  // A gps from another phone (crew location, rally) is untrusted: finite but
  // out of range would make MapLibre throw and take the map down.
  for (const g of [{ lat: 1e308, lng: 0 }, { lat: 91, lng: -80.2 }, { lat: 25.8, lng: -181 }, { lat: "25.8", lng: -80.2 }, null]) {
    const r = P._lngLatOf({ x: 50, y: 50, gps: g });
    check(Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180 && m(P, r, C) < 0.5, `gps ${JSON.stringify(g)} must be rejected and fall back to the grid path`);
  }
  // Stage pins: none can render today, because none has a published position.
  check(P.placed.length === 0, `III Points has ${P.placed.length} placed stages; pins need sourced coordinates first`);
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

// ── 3. Source: every RealMap placement of avatar / meet pin / route goes via _lngLatOf ──
{
  const src = readFileSync(join(ROOT, "map.jsx"), "utf8");
  const start = src.indexOf("function RealMap(");
  const end = src.indexOf("\nfunction ", start + 20);
  const body = src.slice(start, end);
  check(start > 0 && end > start, "RealMap body found");
  for (const bad of ["mapToGps(avatar.x", "mapToGps(meetTarget.x", "mapToGps(target.x"])
    check(!body.includes(bad), `RealMap still places a point with ${bad}, …) instead of _lngLatOf()`);
  check((body.match(/_lngLatOf\(avatar\)/g) || []).length >= 2 && /_lngLatOf\(avatarRef\.current\)/.test(body), "RealMap draws the avatar via _lngLatOf (create from the latest avatar, follow, route)");
  check(/_lngLatOf\(meetTarget\)/.test(body), "RealMap draws the meet pin via _lngLatOf(meetTarget)");
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
  check(/const \{ lat, lng \} = _lngLatOf\(f\);/.test(body), "crew friend markers go through the range-checked _lngLatOf");
  check(/\.\.\.\(_validGps\(incomingRally\.gps\)/.test(src), "an accepted rally's gps is range-checked");
  check(/const routingLabel = !avatar\?\.live \? "ROUTE PREVIEW"/.test(src), "the meet sheet never says ROUTING LIVE for the demo avatar");
  const sb = readFileSync(join(ROOT, "supabase.jsx"), "utf8");
  check(/Math\.abs\(gps\.lat\) <= 90 && Math\.abs\(gps\.lng\) <= 180/.test(sb), "sbBroadcastRally range-checks the pin's lat/lng");
  check(/function sbBroadcastRally\(\{ x, y, label, stageId, gps \}\)/.test(sb) && /\.\.\.\(g \? \{ gps: g \} : \{\}\)/.test(sb), "sbBroadcastRally sends the pin's lat/lng");
}

if (failed) { console.log(`✗ real map raw GPS: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ real map raw GPS: ${checks} checks — no-affine fixes drawn at their raw position, meet pin roundtrips, affine festivals unchanged`);
