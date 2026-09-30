#!/usr/bin/env node
// test-georef-map.mjs — the georeference tool, EDC Orlando's anchors, and the
// map plate EDC Orlando ships.
//
// Four things are locked:
//   1. The fit itself, against a transform whose answer is known.
//   2. The numbers #73 (v264) recorded for edc-orlando-2026, re-derived from
//      the five anchors #73 shipped: the grid they derive, its scale, the
//      centroid, the radius. Continuity only: this does not validate them.
//      Three of the five still ship; the record of all five lives here.
//   3. What ships since 2026-09-30: the official 2025 map, every stage pin
//      measured on it, labelled as the 2025 map, no amenity pins, and GPS
//      anchors for kinetic, circuit and neon only.
//   4. What the three-anchor fit is, measured: exact at its own three points
//      by construction, and not agreement with anything.
//   5. build-edco-map-2026.mjs while the official 2026 map is unpublished.
// Each rule is proven live by a mutation that must fail it.
//
// ⚠ NOT reproduced, and it cannot be from the repo: #73's affine fit. Issue
// #68 and PR #73 name the seven control points but record no pixel position
// for them or for the five stages, so the raw fits in data.jsx are inputs
// here, not outputs.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fitAffine, applyAffine, deriveGrid, distanceM, metresPerDegree, outsideBoundsM, worstPairwiseError, festivalById } from "./georef-map.mjs";
import { EDCO_MAP_2026, checkEdcoMap, isPinned } from "./build-edco-map-2026.mjs";
import { EDCO_MAP_2025 } from "./build-edco-map-2025.mjs";

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
const ANCHORED = ["kinetic", "circuit", "neon"];
const { config, stages, amenities, entry } = festivalById(FID);
ok(config.id === FID, `the loader returned the festival asked for (${config.id})`);
let askedWrong = false;
try { festivalById("no-such-festival-2026"); } catch { askedWrong = true; }
ok(askedWrong, "an unknown festival id is an error, not another festival");

// The five anchors #73 (v264) shipped, as a RECORD. All five were in data.jsx
// until 2026-09-30; stereo and bacardi were then removed (founder ruling), so
// the continuity numbers below are derived from this table, not from what
// ships. What ships is checked against it in section 3.
const IDS = ["kinetic", "circuit", "neon", "stereo", "bacardi"];
const ANCHORS_73 = [
  { stageId: "kinetic", lat: 28.53700, lng: -81.40040, src: "poster" },
  { stageId: "circuit", lat: 28.53999, lng: -81.40219, src: "poster" },
  { stageId: "neon",    lat: 28.53900, lng: -81.39850, src: "poster" },
  { stageId: "stereo",  lat: 28.53730, lng: -81.40310, src: "poster" },
  { stageId: "bacardi", lat: 28.53660, lng: -81.40240, src: "poster" },
];
const anchors = ANCHORS_73;

// The grid #73 shipped, derived from these anchors on one scale. It shipped
// until 2026-09-30; the pins now sit on real art (section 3), so this is the
// record of the derivation, not of what is on screen.
const GRID_73 = { kinetic: [57, 76], circuit: [26, 17], neon: [90, 36], stereo: [10, 70], bacardi: [22, 83] };
const grid = deriveGrid(anchors);
const shipped = id => stages.find(s => s.id === id);
const gridMatches = g => g.stages.every(s => GRID_73[s.stageId] && GRID_73[s.stageId][0] === s.x && GRID_73[s.stageId][1] === s.y);
ok(gridMatches(grid), `the anchors still derive the grid #73 recorded (${grid.stages.map(s => `${s.stageId} ${s.x},${s.y}`).join(" · ")})`);
ok(Math.abs(grid.metresPerUnit - 5.62) < 0.02, `one scale, 5.62 m per grid unit as #73 recorded (${grid.metresPerUnit.toFixed(3)})`);
ok(Math.round(grid.spanE) === 450 && Math.round(grid.spanN) === 376, `east span 450 m, north span 376 m (${grid.spanE.toFixed(0)}, ${grid.spanN.toFixed(0)})`);
const worst = worstPairwiseError(anchors, grid.stages, grid.metresPerUnit);
ok(worst.pair === "stereo–bacardi" && worst.pct < 4.0, `worst pairwise error is stereo–bacardi, under 4 % (${worst.pair}, ${worst.pct.toFixed(2)} %)`);

// The table #73 rejected: each axis stretched to fill on its own.
const stretched = deriveGrid(anchors, { isotropic: false });
caught(gridMatches(stretched), "a per-axis stretch derives the recorded grid");
// An anchor moved 30 m must move the grid.
const moved = clone(anchors); moved[0].lat += 30 / metresPerDegree(28.538).lat;
caught(gridMatches(deriveGrid(moved)), "kinetic moved 30 m north leaves the grid unchanged");

// Centroid: the middle of the festival polygon data.jsx records
// (Church St N / SR-408 + W Anderson S / S Tampa W / S Nashville E).
const POLY = { n: 28.54022, s: 28.5363, w: -81.40353, e: -81.39935 };
const mid = { lat: (POLY.n + POLY.s) / 2, lng: (POLY.w + POLY.e) / 2 };
ok(mid.lat.toFixed(5) === config.gps.lat.toFixed(5) && mid.lng.toFixed(5) === config.gps.lng.toFixed(5),
  `the centroid is the polygon's midpoint (${mid.lat.toFixed(5)}, ${mid.lng.toFixed(5)})`);
const miles = a => distanceM(a, config.gps) / 1609.344;
const far = anchors.reduce((a, b) => (miles(b) > miles(a) ? b : a));
ok(far.stageId === "neon" && Math.abs(miles(far) - 0.186) < 0.002, `the farthest anchor is neon at 0.186 mi (${far.stageId}, ${miles(far).toFixed(3)})`);
ok(anchors.every(a => miles(a) < config.gps.onSiteRadiusMi), `every anchor is inside onSiteRadiusMi ${config.gps.onSiteRadiusMi}`);
caught([{ ...far, lng: far.lng + 0.012 }].every(a => miles(a) < config.gps.onSiteRadiusMi), "an anchor 1.2 km east still counts as on site");

// Raw fits before snapping, as data.jsx records them. kinetic and circuit
// shipped unsnapped; the other three were moved inside the fence by hand.
const RAW = {
  kinetic: { lat: 28.537000, lng: -81.400398 }, circuit: { lat: 28.539991, lng: -81.402186 },
  neon:    { lat: 28.539542, lng: -81.397451 }, stereo:  { lat: 28.536498, lng: -81.403728 },
  bacardi: { lat: 28.535902, lng: -81.402559 },
};
const snap = id => distanceM(RAW[id], anchors.find(a => a.stageId === id));
ok(snap("kinetic") < 1 && snap("circuit") < 1, `kinetic and circuit ship their raw fit, rounded (${snap("kinetic").toFixed(1)} m, ${snap("circuit").toFixed(1)} m)`);
// Measured from the two recorded coordinate sets. data.jsx's prose says
// ~85 m, ~85 m and ~40 m; the coordinates say otherwise, and they are the
// record.
const SNAPS = { neon: 119, stereo: 108, bacardi: 79 };
for (const [id, m] of Object.entries(SNAPS))
  ok(Math.abs(snap(id) - m) < 1.5, `${id} was snapped ${m} m from its raw fit (${snap(id).toFixed(1)} m)`);
ok(outsideBoundsM(RAW.neon, POLY) > 0 && outsideBoundsM(RAW.stereo, POLY) > 0 && outsideBoundsM(RAW.bacardi, POLY) > 0,
  "the three snapped stages' raw fits fall outside the festival polygon, which is why they were snapped");

// ── 3. what ships: the official 2025 map, and it says so ─────────────────
{
  const P = EDCO_MAP_2025;
  const plate = checkEdcoMap(P, { mapImage: config.mapImage });
  ok(plate.ok && plate.built === true, `the 2025 source and the plate built from it are the pinned files (${plate.msg})`);
  ok(config.mapImage === P.derivative, `the registry ships the 2025 plate (${config.mapImage})`);
  ok(P.mapYear === 2025 && config.mapArtYear === P.mapYear && config.mapArtYear !== config.year,
    `the config names the art's own year, and it is not the festival's (mapArtYear ${config.mapArtYear}, year ${config.year})`);
  ok(P.crop.w + P.pad.left + P.pad.right === P.derivativeSize[0] && P.crop.h + P.pad.top + P.pad.bottom === P.derivativeSize[1]
    && P.derivativeSize[0] === P.derivativeSize[1], "crop plus pad is the square plate, with no scaling");
  // The crop starts under the title block's date line: a 2025 date on the
  // plate would be a wrong date for the 2026 festival.
  ok(P.crop.y >= 306, `the crop starts below the "NOV 7+8+9" line (y ${P.crop.y})`);

  const rows = P.measured.stages;
  const want = id => rows[id] && rows[id].px.map(v => Math.round(1000 * v / P.derivativeSize[0]) / 10);
  const pinsMatch = list => IDS.every(id => { const s = list.find(x => x.id === id), w = want(id); return s && w && s.x === w[0] && s.y === w[1]; });
  ok(Object.keys(rows).sort().join() === [...IDS].sort().join(), `one measured row per stage, and no others (${Object.keys(rows).join(", ")})`);
  ok(pinsMatch(stages), `every stage pin is its measured row on the plate (${IDS.map(id => `${id} ${shipped(id).x},${shipped(id).y}`).join(" · ")})`);
  ok(Object.values(rows).every(r => r.px.every(v => v >= 0 && v <= P.derivativeSize[0]) && r.note && r.confidence), "every measured row is on the plate and says what was measured");
  const tba = shipped("tba");
  ok(tba && tba.x === undefined && tba.y === undefined, "the TBA stage has no position: it is not a place on the map");
  ok(stages.filter(s => typeof s.x === "number").length === IDS.length, "no stage has a pin without a measured row");
  const nudged = stages.map(s => (s.id === "bacardi" ? { ...s, x: s.x + 0.5 } : s));
  caught(pinsMatch(nudged), "a pin moved half a grid unit off its measured row");
  // The pre-2026-09-30 derived grid, over real art, would put pins off their stages.
  caught(pinsMatch(stages.map(s => (GRID_73[s.id] ? { ...s, x: GRID_73[s.id][0], y: GRID_73[s.id][1] } : s))), "the derived grid shipped over the 2025 art");

  ok(Array.isArray(amenities) && amenities.length === 0 && Object.keys(P.measured.amenities).length === 0,
    `no amenity pins ship and none is measured off last year's map (${amenities.length})`);
  ok(entry.available === true && entry.scheduleTBA === true, `open on its lineup, set times pending (available ${entry.available}, scheduleTBA ${entry.scheduleTBA})`);

  // GPS anchors: kinetic, circuit and neon only (founder ruling 2026-09-30).
  // An anchor is a lat/lng; a pin is a place on the art. stereo and bacardi
  // keep the second and lose the first, and stay stages everywhere else.
  const live = config.gpsAnchors;
  const threeOnly = list => list.length === 3 && ANCHORED.every((id, i) => list[i].stageId === id);
  ok(threeOnly(live), `three GPS anchors, in order (${live.map(a => a.stageId).join(", ")})`);
  caught(threeOnly(ANCHORS_73), "all five of #73's anchors still ship");
  ok(live.every((a, i) => a.lat === ANCHORS_73[i].lat && a.lng === ANCHORS_73[i].lng), "the three kept anchors are #73's, unmoved");
  ok(live.every(a => a.src === "poster"), "every anchor is still poster class: a read off art, not a measurement");
  caught([{ ...live[0], src: "osm" }, live[1], live[2]].every(a => a.src === "poster"), "a poster anchor relabelled as a measurement");
  const unanchored = IDS.filter(id => !live.some(a => a.stageId === id));
  ok(unanchored.join() === "stereo,bacardi", `stereo and bacardi have no GPS anchor (${unanchored.join(", ")})`);
  ok(unanchored.every(id => { const st = shipped(id); return st && typeof st.x === "number" && typeof st.y === "number" && st.name; }),
    "stereo and bacardi are still stages, with their pins on the art");
  ok(!(config.crowdAnchors || []).length, "no crowd anchor stands in for a removed one");
}

// ── 4. the three-anchor fit, measured ────────────────────────────────────
// map.jsx solves its GPS-to-map affine from the first three anchors and the
// pins of the same three stages. This re-solves it and records what it is.
// Nothing here is a validation: three points fit any affine exactly.
{
  const live = config.gpsAnchors;
  const pinOf = id => { const st = shipped(id); return { px: st.x, py: st.y }; };
  const fit = fitAffine(live.map(a => ({ name: a.stageId, ...pinOf(a.stageId), lat: a.lat, lng: a.lng })));
  ok(fit.worst.metres < 0.01, `the fit is exact at its own three anchors, by construction (worst ${fit.worst.metres.toFixed(4)} m)`);
  // Where the two removed anchors stood against where this fit draws their
  // stages. This was the only disagreement the data could show, and it is
  // why the blue dot is called approximate. Removing the anchors removed the
  // evidence from data.jsx, not the error from the map.
  const gap = id => { const pin = pinOf(id); return distanceM(applyAffine(fit.affine, pin.px, pin.py), ANCHORS_73.find(a => a.stageId === id)); };
  ok(Math.abs(gap("stereo") - 98) < 2 && Math.abs(gap("bacardi") - 48) < 2,
    `the removed anchors sat 98 m (stereo) and 48 m (bacardi) from where the fit draws them (${gap("stereo").toFixed(1)}, ${gap("bacardi").toFixed(1)})`);
  // The shape of the fit. The art is drawn north-up, so a sound registration
  // would have its two axes square on the ground. These do not.
  const { east, north } = fit.affine;
  const ux = [east[0], north[0]], uy = [east[1], north[1]];
  const len = v => Math.hypot(v[0], v[1]);
  const between = Math.acos((ux[0] * uy[0] + ux[1] * uy[1]) / (len(ux) * len(uy))) * 180 / Math.PI;
  ok(Math.abs(between - 114) < 1.5, `the map axes meet at 114° on the ground, not 90°: the fit is sheared (${between.toFixed(1)}°)`);
  ok(Math.abs(len(ux) - 5.7) < 0.15 && Math.abs(len(uy) - 9.3) < 0.2, `one grid unit is 5.7 m across and 9.3 m down (${len(ux).toFixed(2)}, ${len(uy).toFixed(2)})`);
  // A person at the festival polygon's north-west corner (Church St at
  // S Tampa Ave) is drawn left of the plate's edge.
  const m = metresPerDegree(fit.affine.lat0);
  const toGrid = p => {
    const e = (p.lng - fit.affine.lng0) * m.lng - east[2], n = (p.lat - fit.affine.lat0) * m.lat - north[2];
    const det = east[0] * north[1] - east[1] * north[0];
    return [fit.affine.px0 + (north[1] * e - east[1] * n) / det, fit.affine.py0 + (east[0] * n - north[0] * e) / det];
  };
  const back = toGrid(live[0]);
  ok(Math.abs(back[0] - shipped("kinetic").x) < 0.01 && Math.abs(back[1] - shipped("kinetic").y) < 0.01, "the inverse used here puts kinetic's anchor back on kinetic's pin");
  const nw = toGrid({ lat: POLY.n, lng: POLY.w });
  ok(nw[0] < 0 && nw[0] > -12, `the polygon's north-west corner draws off the plate's left edge (x ${nw[0].toFixed(1)})`);
}

// ── 5. the 2026 map pipeline, unpinned ────────────────────────────────────
{
  const M = EDCO_MAP_2026;
  ok(M.festivalId === FID && M.placeholder === EDCO_MAP_2025.derivative, "the 2026 pipeline is EDC Orlando's, and what ships until it is pinned is the 2025 plate");
  ok(!isPinned(M), "no official 2026 map is pinned");
  const state = checkEdcoMap(M, { mapImage: config.mapImage });
  ok(state.ok && state.pinned === false, `unpinned, the check passes and says the 2025 plate ships (${state.msg})`);

  caught(checkEdcoMap(M, { mapImage: M.derivative }).ok, "the registry pointing at an unbuilt 2026 plate");
  const measured = clone(M); measured.measured.stages.kinetic = { px: [500, 500] };
  caught(checkEdcoMap(measured, { mapImage: config.mapImage }).ok, "a measured row with no pinned source");
  const half = { ...clone(M), sourceSha256: "0".repeat(64) };
  caught(checkEdcoMap(half, { mapImage: config.mapImage }).ok, "a half-pinned manifest");
  const full = { ...clone(M), sourceUrl: "https://example.invalid/map.png", sourceObservedAt: "2026-10-30",
    sourceSha256: "0".repeat(64), sourceSize: [2000, 2000], crop: { x: 0, y: 0, w: 2000, h: 2000 },
    pad: { top: 0, bottom: 0, left: 0, right: 0, color: "000000" } };
  caught(checkEdcoMap(full, { mapImage: config.mapImage }).ok, "a fully pinned manifest whose source file is absent");
  // Pinned to a real file that is not the map: the hash must refuse it.
  const wrong = { ...full, source: "map-sources/acl-map-2026-source.png" };
  const wrongState = checkEdcoMap(wrong, { mapImage: config.mapImage });
  caught(wrongState.ok, "a source file whose sha256 is not the pinned one");
  ok(/sha256 differs/.test(wrongState.msg || ""), `a wrong source is refused for its hash (${wrongState.msg})`);
  // The same for the plate that ships: a re-encoded or swapped webp is refused.
  caught(checkEdcoMap({ ...EDCO_MAP_2025, derivativeSha256: "0".repeat(64) }).ok, "a 2025 plate whose sha256 is not the pinned one");

  let cli = "", buildRefused = false;
  try { cli = execFileSync(process.execPath, ["scripts/build-edco-map-2026.mjs", "--check"], { cwd: ROOT, encoding: "utf8" }); } catch (e) { cli = `threw: ${e.stderr || e.message}`; }
  ok(/the 2025 plate edco-tinker-2025\.webp still ships/.test(cli), `--check exits 0 while unpinned (${cli.trim()})`);
  try { execFileSync(process.execPath, ["scripts/build-edco-map-2026.mjs"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch { buildRefused = true; }
  ok(buildRefused, "a 2026 build with nothing pinned refuses to run");
}

for (const f of fails) console.log(`  ✗  ${f}`);
console.log(`  ${fails.length ? "✗" : "✓"}  georef + EDC Orlando map: ${checks - fails.length}/${checks} checks, ${mutations} mutations`);
process.exit(fails.length ? 1 : 0);
