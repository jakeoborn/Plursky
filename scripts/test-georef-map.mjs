#!/usr/bin/env node
// test-georef-map.mjs — the georeference tool, and EDC Orlando's map as it
// ships on the official 2026 plate.
//
// Three things are locked:
//   1. The fit itself, against a transform whose answer is known.
//   2. edc-orlando-2026 as shipped: the anchors are the 2026 street-corner
//      fit (map-sources/edco-map-2026-control-points.json) applied to the
//      measured pins, every x/y is a measured pin, and map.jsx's own affine
//      draws the four street corners where the art draws them.
//   3. build-edco-map-2026.mjs, pinned: the plate ships, the placeholder is
//      gone, and the festival stays gated.
// Each rule is proven live by a mutation that must fail it.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fitAffine, applyAffine, deriveGrid, distanceM, metresPerDegree, outsideBoundsM, worstPairwiseError, festivalById } from "./georef-map.mjs";
import { EDCO_MAP_2026, checkEdcoMap, isPinned } from "./build-edco-map-2026.mjs";
import { loadRegistry } from "./lib/load-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
let checks = 0, mutations = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
// A mutation is caught when the rule it breaks goes false.
const caught = (stillPasses, msg) => { mutations++; checks++; if (stillPasses) fails.push(`mutation NOT caught: ${msg}`); };
const clone = x => JSON.parse(JSON.stringify(x));

// ── 1. the fit, against a known transform ─────────────────────────────────
// A rotated, non-square map: 0.9 m per pixel, turned 12 degrees, y down.
const ORIGIN = { lat: 28.5380, lng: -81.4010 };
const M0 = metresPerDegree(ORIGIN.lat);
const truth = (px, py) => {
  const t = 12 * Math.PI / 180, s = 0.9;
  const e = s * (Math.cos(t) * px + Math.sin(t) * py) - 400, n = s * (Math.sin(t) * px - Math.cos(t) * py) + 300;
  return { lat: ORIGIN.lat + n / M0.lat, lng: ORIGIN.lng + e / M0.lng };
};
const PIX = [[120, 80], [900, 110], [860, 700], [150, 640], [500, 380], [300, 200], [720, 520]];
const control = PIX.map(([px, py], i) => ({ name: `cp${i + 1}`, px, py, ...truth(px, py) }));
{
  const fit = fitAffine(control);
  ok(fit.residuals.length === 7 && fit.worst.metres < 0.01, `a clean 7-point fit has no residual (worst ${fit.worst.metres.toFixed(4)} m)`);
  const stage = applyAffine(fit.affine, 640, 300);
  ok(distanceM(stage, truth(640, 300)) < 0.01, "a stage pixel projects to its true position");

  // One control point read 60 m wrong: the fit must say which one.
  const bad = clone(control); bad[3].lat += 60 / M0.lat;
  const badFit = fitAffine(bad);
  ok(badFit.worst.name === "cp4" && badFit.worst.metres > 20, `a misread control point is the worst residual (got ${badFit.worst.name}, ${badFit.worst.metres.toFixed(1)} m)`);
  caught(badFit.worst.metres < 0.01, "a 60 m misread leaves the fit looking clean");

  let threw = 0;
  try { fitAffine(control.slice(0, 2)); } catch { threw++; }
  try { fitAffine([0, 1, 2, 3].map(i => ({ name: `l${i}`, px: 100 * i, py: 50 * i, ...truth(100 * i, 50 * i) }))); } catch { threw++; }
  ok(threw === 2, `two points, and four points on one line, are both refused (${threw} of 2)`);

  const b = { n: 28.5390, s: 28.5370, w: -81.4020, e: -81.4000 };
  ok(outsideBoundsM({ lat: 28.5380, lng: -81.4010 }, b) === 0, "a point inside the bounds is 0 m outside");
  const out = outsideBoundsM({ lat: 28.5380, lng: -81.3990 }, b);
  ok(Math.abs(out - 0.001 * metresPerDegree(28.5380).lng) < 0.01, `a point east of the bounds reports its distance out (${out.toFixed(1)} m)`);
}

// ── 2. EDC Orlando, as shipped ────────────────────────────────────────────
const FID = "edc-orlando-2026";
const { config, stages } = festivalById(FID);
ok(config.id === FID, `the loader returned the festival asked for (${config.id})`);
let askedWrong = false;
try { festivalById("no-such-festival-2026"); } catch { askedWrong = true; }
ok(askedWrong, "an unknown festival id is an error, not another festival");

const anchors = config.gpsAnchors;
const IDS = ["kinetic", "circuit", "neon", "stereo", "bacardi"];
ok(anchors.length === 5 && IDS.every((id, i) => anchors[i].stageId === id), `five anchors, in order (${anchors.map(a => a.stageId).join(", ")})`);
ok(anchors.every(a => a.src === "poster"), "every anchor is still poster class: a read off art, not a measurement");

// The 2026 fit, re-run from the control points data.jsx names. Every anchor
// must be that fit applied to its stage's measured pin.
const M = EDCO_MAP_2026;
const CP = JSON.parse(readFileSync(join(ROOT, "map-sources/edco-map-2026-control-points.json"), "utf8"));
ok(CP.plate === M.derivative && CP.plateSize.join("x") === M.derivativeSize.join("x"), `the control points are read on the shipped plate (${CP.plate} ${CP.plateSize.join("x")})`);
const fit = fitAffine(CP.controlPoints);
ok(CP.controlPoints.length === 4 && fit.worst.metres < 15, `four street intersections, worst residual under 15 m (${fit.worst.name}, ${fit.worst.metres.toFixed(1)} m)`);
ok(CP.stages.every(s => M.measured.stages[s.stageId] && M.measured.stages[s.stageId].px.join() === `${s.px},${s.py}`), "the control file's stage pixels are the manifest's measured pins");
const fitted = (pins, id) => applyAffine(fit.affine, ...pins[id].px);
const anchorIsFit = (as, pins) => IDS.every(id => distanceM(fitted(pins, id), as.find(a => a.stageId === id)) < 0.5);
ok(anchorIsFit(anchors, M.measured.stages), `every anchor is the fit at its pin (${IDS.map(id => `${id} ${distanceM(fitted(M.measured.stages, id), anchors.find(a => a.stageId === id)).toFixed(2)} m`).join(", ")})`);
// #73's anchors, fitted on other art (data.jsx keeps them as history).
const OLD73 = [
  { stageId: "kinetic", lat: 28.53700, lng: -81.40040 }, { stageId: "circuit", lat: 28.53999, lng: -81.40219 },
  { stageId: "neon", lat: 28.53900, lng: -81.39850 }, { stageId: "stereo", lat: 28.53730, lng: -81.40310 },
  { stageId: "bacardi", lat: 28.53660, lng: -81.40240 },
];
caught(anchorIsFit(OLD73, M.measured.stages), "#73's anchors pass as the 2026 fit");
const pinMoved = clone(M.measured.stages); pinMoved.circuit.px[0] += 30;
caught(anchorIsFit(anchors, pinMoved), "circuit's pin moved 30 px leaves its anchor unchanged");
// The independent check: the stadium is drawn on the art and is not a
// control point, so where the fit puts it tests the fit.
const bowl = applyAffine(fit.affine, CP.check.px, CP.check.py);
ok(distanceM(bowl, CP.check) < 20, `the drawn stadium lands ${distanceM(bowl, CP.check).toFixed(1)} m from OpenStreetMap's stadium centre (limit 20)`);
const skew = clone(CP.controlPoints); skew[1].px -= 40;
caught(distanceM(applyAffine(fitAffine(skew).affine, CP.check.px, CP.check.py), CP.check) < 20, "a corner misread 40 px still puts the stadium in place");

// Art coordinates: every stage and amenity x/y is its measured pin as a
// percentage of the plate, and nothing unmeasured ships. TBA has no place.
const gridPct = v => Math.round(1000 * v / M.derivativeSize[0]) / 10;
const { amenities } = { amenities: loadRegistry(ROOT).DS[FID].amenities || [] };
const artProblems = (st, am) => {
  const p = [];
  const rows = [...st.filter(s => s.id !== "tba").map(s => ["stages", s]), ...am.map(a => ["amenities", a])];
  for (const [kind, item] of rows) {
    const m = M.measured[kind][item.id];
    if (!m) { p.push(`${kind} ${item.id} ships x/y (${item.x},${item.y}) with no measurement row`); continue; }
    if (item.x !== gridPct(m.px[0]) || item.y !== gridPct(m.px[1])) p.push(`${item.id} is (${item.x},${item.y}); measured ${m.px.join(",")} px = (${gridPct(m.px[0])},${gridPct(m.px[1])})`);
  }
  for (const [kind, list] of [["stages", st], ["amenities", am]])
    for (const id of Object.keys(M.measured[kind])) if (!list.some(x => x.id === id)) p.push(`measured ${kind.slice(0, -1)} ${id} is not shipped`);
  return p;
};
const art = artProblems(stages, amenities);
ok(!art.length, `every x/y is a measured pin:\n      ${art.join("\n      ")}`);
const SURVEY = { food: 6, info: 1, med: 4, toilet: 7, water: 2 };
const byType = {}; for (const a of amenities) byType[a.type] = (byType[a.type] || 0) + 1;
ok(JSON.stringify(Object.keys(byType).sort().map(k => [k, byType[k]])) === JSON.stringify(Object.keys(SURVEY).sort().map(k => [k, SURVEY[k]])),
  `amenities by type match the printed survey ${JSON.stringify(SURVEY)} (${JSON.stringify(byType)})`);
for (const [kind, rows] of Object.entries(M.measured)) for (const [id, r] of Object.entries(rows))
  ok(r.px[0] >= 0 && r.px[0] < M.derivativeSize[0] && r.px[1] >= M.pad.top && r.px[1] < M.derivativeSize[1] - M.pad.bottom && r.note,
    `${kind} ${id} measured at ${r.px}, on the map art, with a note`);
const nudged = clone(stages); nudged.find(s => s.id === "kinetic").x += 1;
caught(!artProblems(nudged, amenities).length, "kinetic's x nudged one unit off its pin");
caught(!artProblems(stages, [...amenities, { id: "eoa1", type: "water", label: "Hydration", x: 44, y: 30 }]).length, "an unmeasured amenity carried back in");

// On screen: map.jsx's OWN 3-anchor affine (first three anchors + their x/y)
// must draw a person standing at each street corner where the art draws it.
const mapSrc0 = readFileSync(join(ROOT, "map.jsx"), "utf8");
const sFrom = mapSrc0.indexOf("function _solveMapAffine(cfg, stages)"), sTo = mapSrc0.indexOf("const MAP_AFFINE = _solveMapAffine();");
ok(sFrom > 0 && sTo > sFrom, "_solveMapAffine is found in map.jsx");
const cornerOffsPx = (cfg, st) => {
  const ctx = { Math, __cfg: cfg, __st: st };
  vm.createContext(ctx);
  vm.runInContext(`${mapSrc0.slice(sFrom, sTo)}\n;__A = _solveMapAffine(__cfg, __st);`, ctx);
  const A = ctx.__A, k = M.derivativeSize[0] / 100;
  return CP.controlPoints.map(c => Math.hypot((A.x[0] * c.lat + A.x[1] * c.lng + A.x[2]) * k - c.px, (A.y[0] * c.lat + A.y[1] * c.lng + A.y[2]) * k - c.py));
};
const TOL_PX = 16, offs = cornerOffsPx(config, stages);
ok(offs.every(o => o <= TOL_PX), `every street corner is drawn within ${TOL_PX} plate px of the art (${offs.map(o => o.toFixed(1)).join(", ")})`);
caught(cornerOffsPx({ ...clone(config), gpsAnchors: OLD73 }, stages).every(o => o <= TOL_PX), "#73's anchors on the 2026 plate keep the corners in place");

// Centroid: the middle of the four edges data.jsx records (the west one is
// not Tampa Avenue; see the comment there).
const POLY = { n: 28.54022, s: 28.5363, w: -81.40353, e: -81.39935 };
const mid = { lat: (POLY.n + POLY.s) / 2, lng: (POLY.w + POLY.e) / 2 };
ok(mid.lat.toFixed(5) === config.gps.lat.toFixed(5) && mid.lng.toFixed(5) === config.gps.lng.toFixed(5),
  `the centroid is the edges' midpoint (${mid.lat.toFixed(5)}, ${mid.lng.toFixed(5)})`);
const miles = a => distanceM(a, config.gps) / 1609.344;
ok(anchors.every(a => miles(a) < config.gps.onSiteRadiusMi), `every anchor is inside onSiteRadiusMi ${config.gps.onSiteRadiusMi} (farthest ${Math.max(...anchors.map(miles)).toFixed(3)} mi)`);
caught([{ ...anchors[2], lng: anchors[2].lng + 0.012 }].every(a => miles(a) < config.gps.onSiteRadiusMi), "an anchor 1.2 km east still counts as on site");

// ── 3. the 2026 map pipeline, pinned ──────────────────────────────────────
{
  const entry = loadRegistry(ROOT).REG.find(f => f.config && f.config.id === FID);
  ok(M.festivalId === FID && isPinned(M), "the pipeline is EDC Orlando's and the official 2026 map is pinned");
  const state = checkEdcoMap(M, { mapImage: config.mapImage });
  ok(state.ok && state.pinned && state.built, `pinned and built, the check passes (${state.msg})`);
  ok(config.mapImage === M.derivative, `the registry ships the official plate (${config.mapImage})`);
  ok(!existsSync(join(ROOT, M.placeholder)), `the placeholder ${M.placeholder} is gone`);
  ok(/'\.\/edco-tinker-2026\.webp'/.test(readFileSync(join(ROOT, "sw.js"), "utf8")), "sw.js precaches the plate for offline");
  ok(M.sourcePage === "https://orlando.edc.com/guide/map/" && /^https:\/\/[^/]+\/.*\/edco_2026_[^/]*\.png$/.test(M.sourceUrl),
    `the source is the 2026 file the official Festival Map page shows (${M.sourcePage})`);
  ok(entry && entry.available === false, "the festival stays gated until the official 2026 set times are out");

  caught(checkEdcoMap(M, { mapImage: M.placeholder }).ok, "the registry still shipping the placeholder once the plate is pinned");
  const unpinned = { ...clone(M), sourceUrl: null, sourceObservedAt: null, sourceSha256: null, sourceSize: null, crop: null, pad: null, source: "map-sources/no-such-map.png" };
  caught(checkEdcoMap(unpinned, { mapImage: unpinned.placeholder }).ok, "measured rows with no pinned source");
  caught(checkEdcoMap({ ...clone(M), sourceSha256: null }, { mapImage: config.mapImage }).ok, "a half-pinned manifest");
  const wrong = { ...clone(M), source: "map-sources/acl-map-2026-source.png" };
  const wrongState = checkEdcoMap(wrong, { mapImage: config.mapImage });
  caught(wrongState.ok, "a source file whose sha256 is not the pinned one");
  ok(/sha256 differs/.test(wrongState.msg || ""), `a wrong source is refused for its hash (${wrongState.msg})`);
  caught(checkEdcoMap({ ...clone(M), derivativeSha256: "0".repeat(64) }, { mapImage: config.mapImage }).ok, "a plate that is not the one measured on");

  let cli = "";
  try { cli = execFileSync(process.execPath, ["scripts/build-edco-map-2026.mjs", "--check"], { cwd: ROOT, encoding: "utf8" }); } catch (e) { cli = `threw: ${e.stderr || e.message}`; }
  ok(/^✓ map-sources\/edco-map-2026-source\.png 1080x1350 · edco-tinker-2026\.webp 960x960/.test(cli), `--check passes on the pinned plate (${cli.trim()})`);
}

// ── 4. poster reads and unsourced pins cannot fire a geofence ─────────────
// Founder, 2026-10-20: the five anchors stay poster reads and say so in the
// data, every amenity names its source, and nothing geofence-triggered fires
// off either. Still true on the official 2026 map (2026-10-29): a read off
// art through a fit is not a survey.
{
  const BASIS = "poster-read, 2026 art, unsurveyed";
  const anchors = config.gpsAnchors || [];
  ok(anchors.length === 5 && anchors.every(a => a.src === "poster" && a.basis === BASIS),
    `all five anchors are labelled "${BASIS}" (${anchors.filter(a => a.basis === BASIS).length} of ${anchors.length})`);
  const am = loadRegistry(ROOT).DS[FID].amenities || [];
  ok(am.length === 20 && am.every(a => a.src === "official-2026-map"),
    `every amenity pin names its source (${am.filter(a => a.src).length} of ${am.length})`);

  // detectCurrentArtist is the GPS auto-attend geofence. Run the shipped
  // function, not a copy: stand ON the kinetic anchor during a live kinetic set.
  const src = readFileSync(join(ROOT, "chrome.jsx"), "utf8");
  const from = src.indexOf("function _gpsDistMeters(");
  const to = src.indexOf("// Called from the GPS effect in MapScreen");
  ok(from > 0 && to > from, "detectCurrentArtist is found in chrome.jsx");
  const detect = cfg => {
    const ctx = {
      window: { FESTIVAL_CONFIG: cfg, NOW: { day: 1, time: "21:00" } }, Math,
      activeLineup: () => [{ id: "act1", stage: "kinetic" }], isSetLive: () => true,
    };
    vm.createContext(ctx);
    vm.runInContext(`${src.slice(from, to)}\n;__hit = detectCurrentArtist(${cfg.gpsAnchors[0].lat}, ${cfg.gpsAnchors[0].lng});`, ctx);
    return ctx.__hit;
  };
  ok(detect(clone(config)) === null, "standing on a poster-read anchor during its live set marks nothing attended");
  const surveyed = clone(config); surveyed.gpsAnchors[0].src = "osm";
  caught(detect(surveyed) === null, "the same spot on a surveyed (osm) anchor no longer fires, so the guard is not just dead code");

  // GLOBAL (founder, 2026-10-20): every festival, through the real
  // resolvedStageAnchors. Stand on each anchor during a live set on every
  // stage. An osm/crowd point must fire for its stage; a poster, provisional,
  // derived or unsourced point must never resolve to its own stage (a hit on a
  // neighbouring EVIDENCE anchor inside 140 m is allowed — that one is real).
  const dataSrc = readFileSync(join(ROOT, "data.jsx"), "utf8");
  const rFrom = dataSrc.indexOf("function resolvedStageAnchors(cfg)");
  const rTo = dataSrc.indexOf("function resolvedStageAnchor(cfg, stageId)");
  ok(rFrom > 0 && rTo > rFrom, "resolvedStageAnchors is found in data.jsx");
  const EVIDENCE = new Set(["osm", "crowd"]);
  let fired = 0, refused = 0;
  const leaks = [], dead = [];
  for (const { config: cfg } of loadRegistry(ROOT).REG) {
    if (!cfg || !((cfg.gpsAnchors || []).length || (cfg.crowdAnchors || []).length)) continue;
    const crowdIds = new Set((cfg.crowdAnchors || []).map(c => c.stageId));
    const points = [
      ...(cfg.gpsAnchors || []).filter(a => !crowdIds.has(a.stageId)).map(a => ({ ...a, kind: a.src || "unsourced" })),
      ...(cfg.crowdAnchors || []).map(c => ({ ...c, kind: "crowd" })),
    ];
    const stageIds = [...new Set(points.map(p => p.stageId))];
    for (const p of points) {
      const ctx = {
        window: { FESTIVAL_CONFIG: cfg, NOW: { day: 1, time: "21:00" } }, Math,
        activeLineup: () => stageIds.map(s => ({ id: `act-${s}`, stage: s })), isSetLive: () => true,
      };
      vm.createContext(ctx);
      vm.runInContext(`${dataSrc.slice(rFrom, rTo)}\n${src.slice(from, to)}\n;__hit = detectCurrentArtist(${p.lat}, ${p.lng});`, ctx);
      const own = ctx.__hit && ctx.__hit.stageId === p.stageId;
      if (EVIDENCE.has(p.kind)) { if (own) fired++; else dead.push(`${cfg.id}:${p.stageId}(${p.kind})`); }
      else { if (own) leaks.push(`${cfg.id}:${p.stageId}(${p.kind})`); else refused++; }
    }
  }
  ok(leaks.length === 0, `no poster/prov/derived/unsourced point fires auto-attend, any festival (${refused} refused${leaks.length ? `; LEAK ${leaks.join(", ")}` : ""})`);
  ok(dead.length === 0 && fired > 0, `every osm/crowd point still fires for its own stage (${fired} fired${dead.length ? `; DEAD ${dead.join(", ")}` : ""})`);
  ok(refused > 0, `the sweep met non-evidence points to refuse (${refused})`);

  // Crew nudge: inferring a friend's stage from their GPS dot needs sourced
  // registration. Source check (the cluster lives inside a component).
  const mapSrc = readFileSync(join(ROOT, "map.jsx"), "utf8");
  ok(/f\.stageId \|\| \(MAP_REGISTRATION_SOURCED \? _nearestStageId\(f\.x, f\.y\) : null\)/.test(mapSrc),
    "the crew-cluster nudge infers a stage from GPS only on sourced registration");
}

for (const f of fails) console.log(`  ✗  ${f}`);
console.log(`  ${fails.length ? "✗" : "✓"}  georef + EDC Orlando map pipeline: ${checks - fails.length}/${checks} checks, ${mutations} mutations`);
process.exit(fails.length ? 1 : 0);
