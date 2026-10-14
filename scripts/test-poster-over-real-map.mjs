#!/usr/bin/env node
// The real map is the default map, with the festival's own map laid over it,
// and how strongly that art shows is a claim about how well it fits the ground.
//
// Jake's ruling (2026-10-13): "Real map + poster overlay becomes the default
// everywhere. Poster shows at full strength ONLY where alignment is checked and
// close (Summerfest, Lollapalooza, Outside Lands today). Everywhere else it
// shows faded with a 'not to scale' label until anchors are measured."
//
// The contract this gate holds:
//   1. POSTER_TIER is posterTierFor(cfg, affine, geometryVerifiedFor(id)): the
//      one geometry predicate decides "checked", not a second list. The fleet
//      table below pins today's answer so a festival changing tier is a diff
//      somebody reads, never a silent drift.
//   2. Pins (stages, landmarks, Water/Medical dots) only where the geometry is
//      CHECKED (REAL_MAP_PLACES_CHECKED = affine + geometryVerifiedFor). #313
//      review, Instinct's lane: "Stage pins OFF on unchecked festivals ... pins
//      off, full stop." An unchecked affine still turns poster art into
//      coordinates (Ultra's land up to 387 m off), so ACL, Gov Ball, Ultra,
//      EDC LV and EDC Orlando read STAGES PENDING exactly like III Points. With
//      no affine at all mapToGps() returns the venue centre.
//   3. MapScreen hands RealMap the tier's stages and poster; the poster's
//      opacity follows the tier; the posture label names it.
//   4. The real map is on unless the user chose the art map ("0"), or it
//      failed this session; a failure never erases the user's own choice.
//
// Runs the REAL compiled code (build/data.js + build/map.js) in a vm, plus
// source checks on MapScreen, each proven live by a mutation of the compiled
// source in memory (nothing on disk is rewritten).
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean).map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
const DATA = readFileSync(join(ROOT, "build", "data.js"), "utf8");
const MAP = readFileSync(join(ROOT, "build", "map.js"), "utf8");
const noop = () => {};
const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop, remove: noop } });

function load(fid, mapSrc = MAP) {
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
  vm.runInContext(DATA, ctx, { filename: "build/data.js" });
  vm.runInContext(mapSrc, ctx, { filename: "build/map.js" });
  return vm.runInContext(`({ id: FESTIVAL_CONFIG.id, DS: _DATA_SETS, tier: POSTER_TIER, affine: MAP_AFFINE,
    realStages: REAL_MAP_STAGES, placed: PLACED_STAGES, posterTierFor, _solveMapAffine, geometryVerifiedFor,
    placesChecked: REAL_MAP_PLACES_CHECKED, realAmenities: REAL_MAP_AMENITIES, amenities: AMENITIES,
    unchecked: POSTER_OPACITY_UNCHECKED })`, ctx);
}

// Today's answer. A festival moves up ONLY by measured anchors (first-party
// evidence per anchor); edit this table in the same PR that registers them.
const EXPECTED = {
  checked:   ["summerfest-2026", "lollapalooza-2026", "outside-lands-2026"],
  unchecked: ["edc-lv-2026", "acl-2026", "edc-orlando-2026", "ultra-miami-2026", "governors-ball-2026"],
};
const expectedTier = id => EXPECTED.checked.includes(id) ? "checked" : EXPECTED.unchecked.includes(id) ? "unchecked" : "none";

function fleet(mapSrc) {
  const fails = [];
  const ok = (c, msg) => { if (!c) fails.push(msg); };
  const P = load("summerfest-2026", mapSrc);
  const ids = Object.keys(P.DS);
  ok(ids.length >= 19, `only ${ids.length} festivals in _DATA_SETS (loader broke?)`);
  for (const id of ids) {
    const { config: cfg, stages } = P.DS[id];
    const aff = P._solveMapAffine(cfg, stages);
    const ver = P.geometryVerifiedFor(id);
    const t = P.posterTierFor(cfg, aff, ver);
    ok(t === expectedTier(id), `${id}: tier "${t}", expected "${expectedTier(id)}"`);
    ok((t === "checked") === ver, `${id}: "checked" must mean geometryVerifiedFor() passes (tier ${t}, verified ${ver})`);
    if (cfg.mapMode === "real") ok(t === "none", `${id}: mapMode "real" has no art to lay over (tier ${t})`);
  }
  // The active-festival constants agree with the function (one policy).
  // EDC Orlando is gated (it cannot be the active festival); its tier is pinned above.
  for (const id of ["summerfest-2026", "lollapalooza-2026", "outside-lands-2026", "ultra-miami-2026", "acl-2026", "governors-ball-2026",
                    "edc-lv-2026", "escape-halloween-2026", "iii-points-2026", "hard-summer-2026"]) {
    const A = load(id, mapSrc);
    ok(A.id === id, `active festival is ${A.id}, not ${id} (a gated id silently loads the default)`);
    ok(A.tier === expectedTier(id), `${id} active: POSTER_TIER "${A.tier}", expected "${expectedTier(id)}"`);
    const checked = expectedTier(id) === "checked";
    ok(A.placesChecked === checked, `${id}: pins placed=${A.placesChecked}, expected ${checked} (only checked geometry places pins)`);
    if (checked) {
      ok(A.realStages.length === A.placed.length && A.placed.length > 0, `${id}: checked, so the real map pins all ${A.placed.length} placed stages (got ${A.realStages.length})`);
      ok(A.realAmenities.length === A.amenities.length && A.amenities.some(a => a.type === "water") && A.amenities.some(a => a.type === "med"),
        `${id}: checked, so Water and Medical are on the real map (${A.realAmenities.length}/${A.amenities.length} amenities)`);
    } else {
      ok(A.realStages.length === 0, `${id}: ${A.affine ? "unchecked anchors" : "no affine"}, so the real map pins NO stages (got ${A.realStages.length})`);
      ok(A.realAmenities.length === 0, `${id}: not checked, so no amenity dots from poster positions (got ${A.realAmenities.length})`);
    }
  }
  ok(P.unchecked > 0 && P.unchecked <= 0.5, `unchecked poster opacity ${P.unchecked} must read as faded (0 < o <= 0.5)`);
  return fails;
}

// Source contract on the compiled MapScreen / RealMap.
const SRC = [
  ["RealMap gets the tier's stages", /stages:\s*REAL_MAP_STAGES/],
  ["RealMap gets the poster only when the tier places it", /officialMap:\s*POSTER_TIER !== "none"/],
  ["poster opacity follows the tier", /"raster-opacity":\s*POSTER_TIER === "checked"[\s\S]{0,120}POSTER_OPACITY_UNCHECKED/],
  ["real map is on unless the user chose \"0\"", /localStorage\.getItem\("plursky_use_realmap"\) !== "0"/],
  ["a failed real map holds for the session", /sessionStorage\.getItem\("plursky_realmap_failed"\) === "1"\) return false/],
  ["a failure does not erase the user's choice", s => !/removeItem\("plursky_use_realmap"\)/.test(s)],
  ["the toggle records both choices", /setItem\("plursky_use_realmap", v \? "1" : "0"\)/],
  ["posture: unplaced pins on the real map read STAGES PENDING", /REAL_MAP_ONLY \|\| useRealMap && !REAL_MAP_PLACES_CHECKED \? useRealMap && POSTER_TIER === "unchecked" \? "NOT TO SCALE · STAGES PENDING" : "VENUE MAP · STAGES PENDING"/],
  ["landmarks need checked placement", /SUB_LANDMARKS = REAL_MAP_PLACES_CHECKED \?/],
  ["RealMap gets the checked amenities", /amenities:\s*REAL_MAP_AMENITIES/],
  ["Water/Medical chips follow the map on screen", /has = t => mapAmenities\.some/],
  ["the real map's zoom buttons drive the real map", s => /zoomIn = \(\) => useRealMap \? realMapCtl\.current\?\.zoomIn\(\)/.test(s) && /zoomOut = \(\) => useRealMap \? realMapCtl\.current\?\.zoomOut\(\)/.test(s) && /controlRef:\s*realMapCtl/.test(s)],
  ["a failed overlay is latched off", s => /if \(officialMapFailedRef\.current\) return;/.test(s) && /sourceId === "official-map"\) \{\s*officialMapFailedRef\.current = true;/.test(s)],
  // MapLibre cannot decode SVG (createImageBitmap); six festivals ship SVG art.
  ["an SVG map is rasterised before MapLibre sees it", /toDataURL\("image\/png"\)/],
  ["the image source loads the rasterised URL", /(?:const|var) src = dims\.url \|\| FESTIVAL_CONFIG\.mapImage/],
  ["a failed map overlay is dropped, not an error card", /e\.sourceId === "official-map"\)[\s\S]{0,240}removeSource\("official-map"\)[\s\S]{0,40}return;/],
];
function source(s) {
  return SRC.filter(([, t]) => !(typeof t === "function" ? t(s) : t.test(s))).map(([n]) => `source: ${n}`);
}

let checks = 0, failed = 0;
const report = (fails, label) => { checks++; if (fails.length) { failed++; console.log(`  ✗  ${label}:\n     ` + fails.join("\n     ")); } };
report(fleet(MAP), "fleet table");
for (const [n] of SRC) { checks++; }
const srcFails = source(MAP);
if (srcFails.length) { failed++; console.log("  ✗  " + srcFails.join("\n  ✗  ")); }

// Mutations: each must turn the gate red. A mutation that does not apply is a
// broken gate, not a pass.
const MUT = [
  ["tier ignores verification", "return verified ? \"checked\" : \"unchecked\";", "return \"checked\";", "fleet"],
  ["tier ignores the affine", "!affine) return \"none\";", "false) return \"none\";", "fleet"],
  ["no-affine festivals pin every stage", "REAL_MAP_STAGES = REAL_MAP_PLACES_CHECKED ? PLACED_STAGES : [];", "REAL_MAP_STAGES = PLACED_STAGES;", "fleet"],
  ["unchecked anchors pin stages (the #313 head)", "REAL_MAP_STAGES = REAL_MAP_PLACES_CHECKED ? PLACED_STAGES : [];", "REAL_MAP_STAGES = MAP_AFFINE ? PLACED_STAGES : [];", "fleet"],
  ["placement ignores verification", "REAL_MAP_PLACES_CHECKED = !!MAP_AFFINE && !!MAP_REGISTRATION_SOURCED;", "REAL_MAP_PLACES_CHECKED = !!MAP_AFFINE;", "fleet"],
  ["amenities pinned from unchecked art", "REAL_MAP_AMENITIES = REAL_MAP_PLACES_CHECKED &&", "REAL_MAP_AMENITIES = true &&", "fleet"],
  ["RealMap gets no amenities", "amenities: REAL_MAP_AMENITIES", "amenities: []", "src"],
  ["chips art-map only again", "has = t => mapAmenities.some", "has = t => !useRealMap && mapAmenities.some", "src"],
  ["zoom drives the art map only", "useRealMap ? realMapCtl.current?.zoomIn()", "false ? realMapCtl.current?.zoomIn()", "src"],
  ["overlay failure not latched", "if (officialMapFailedRef.current) return;", "", "src"],
  ["RealMap back on all placed stages", "stages: REAL_MAP_STAGES", "stages: PLACED_STAGES", "src"],
  ["poster whenever there is art", "officialMap: POSTER_TIER !== \"none\"", "officialMap: !!FESTIVAL_CONFIG.mapImage", "src"],
  ["opt-in default restored", "localStorage.getItem(\"plursky_use_realmap\") !== \"0\"", "localStorage.getItem(\"plursky_use_realmap\") === \"1\"", "src"],
  ["landmarks on unchecked anchors", "SUB_LANDMARKS = REAL_MAP_PLACES_CHECKED ?", "SUB_LANDMARKS = MAP_AFFINE ?", "src"],
  ["SVG handed to MapLibre raw", "src = dims.url || FESTIVAL_CONFIG.mapImage", "src = FESTIVAL_CONFIG.mapImage", "src"],
  ["overlay failure becomes the error card", "e.sourceId === \"official-map\"", "e.sourceId === \"never\"", "src"],
];
let caught = 0;
for (const [name, a, b, kind] of MUT) {
  checks++;
  if (!MAP.includes(a)) { failed++; console.log(`  ✗  mutation "${name}" did not apply (needle missing from build/map.js)`); continue; }
  const m = MAP.split(a).join(b);
  const red = kind === "fleet" ? fleet(m).length > 0 : source(m).length > 0;
  if (red) caught++; else { failed++; console.log(`  ✗  mutation "${name}" was NOT caught`); }
}
if (failed) { console.log(`✗ poster over real map: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ poster over real map: ${checks} checks (fleet table ${Object.values(EXPECTED).flat().length} tiered + the rest none; ${caught}/${MUT.length} mutations caught)`);
