#!/usr/bin/env node
// test-georef-map.mjs — the georeference tool reproduces what EDC Orlando
// ships, and the 2026 map pipeline cannot ship an unpinned map.
//
// Three things are locked:
//   1. The fit itself, against a transform whose answer is known.
//   2. The numbers #73 (v264) recorded for edc-orlando-2026, re-derived from
//      the shipped anchors: the x/y grid, its scale, the centroid, the radius.
//   3. build-edco-map-2026.mjs while the official map is unpublished.
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

const grid = deriveGrid(anchors);
const shipped = id => stages.find(s => s.id === id);
const gridMatches = g => g.stages.every(s => shipped(s.stageId) && shipped(s.stageId).x === s.x && shipped(s.stageId).y === s.y);
ok(gridMatches(grid), `the shipped x/y grid is the one the anchors derive (${grid.stages.map(s => `${s.stageId} ${s.x},${s.y}`).join(" · ")})`);
ok(Math.abs(grid.metresPerUnit - 5.62) < 0.02, `one scale, 5.62 m per grid unit as #73 recorded (${grid.metresPerUnit.toFixed(3)})`);
ok(Math.round(grid.spanE) === 450 && Math.round(grid.spanN) === 376, `east span 450 m, north span 376 m (${grid.spanE.toFixed(0)}, ${grid.spanN.toFixed(0)})`);
const worst = worstPairwiseError(anchors, grid.stages, grid.metresPerUnit);
ok(worst.pair === "stereo–bacardi" && worst.pct < 4.0, `worst pairwise error is stereo–bacardi, under 4 % (${worst.pair}, ${worst.pct.toFixed(2)} %)`);

// The table #73 rejected: each axis stretched to fill on its own.
const stretched = deriveGrid(anchors, { isotropic: false });
caught(gridMatches(stretched), "a per-axis stretch derives the shipped grid");
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

// ── 3. the 2026 map pipeline, unpinned ────────────────────────────────────
{
  const M = EDCO_MAP_2026;
  ok(M.festivalId === FID && M.placeholder === "edco-tinker-2026.jpg", "the pipeline is EDC Orlando's and names the placeholder");
  ok(!isPinned(M), "no official 2026 map is pinned");
  const state = checkEdcoMap(M, { mapImage: config.mapImage });
  ok(state.ok && state.pinned === false, `unpinned, the check passes and says the placeholder ships (${state.msg})`);
  ok(config.mapImage === M.placeholder, `the registry ships the placeholder (${config.mapImage})`);

  caught(checkEdcoMap(M, { mapImage: M.derivative }).ok, "the registry pointing at an unbuilt plate");
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

  let cli = "", buildRefused = false;
  try { cli = execFileSync(process.execPath, ["scripts/build-edco-map-2026.mjs", "--check"], { cwd: ROOT, encoding: "utf8" }); } catch (e) { cli = `threw: ${e.stderr || e.message}`; }
  ok(/placeholder edco-tinker-2026\.jpg still ships/.test(cli), `--check exits 0 while unpinned (${cli.trim()})`);
  try { execFileSync(process.execPath, ["scripts/build-edco-map-2026.mjs"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch { buildRefused = true; }
  ok(buildRefused, "a build with nothing pinned refuses to run");
}

for (const f of fails) console.log(`  ✗  ${f}`);
console.log(`  ${fails.length ? "✗" : "✓"}  georef + EDC Orlando map pipeline: ${checks - fails.length}/${checks} checks, ${mutations} mutations`);
process.exit(fails.length ? 1 : 0);
