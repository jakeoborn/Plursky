#!/usr/bin/env node
// georef-map.mjs — fit a festival map's ART onto the ground, and derive the
// 0-100 stage grid from measured anchors. Tooling only: it writes nothing.
//
// Why it exists: EDC Orlando's geometry (#73, v264) was fitted by hand. The
// method is a comment in data.jsx; the inputs were never saved. The flip
// session has to run the same fit again on the official 2026 map, days before
// the event, and this is that fit as a command.
//
//   node scripts/georef-map.mjs fit points.json      # art pixels → lat/lng
//   node scripts/georef-map.mjs grid <festivalId>    # shipped anchors → x/y
//
// points.json:
//   { "controlPoints": [ { "name": "Church/Tampa", "px": 412, "py": 96,
//                          "lat": 28.54022, "lng": -81.40353 }, ... ],
//     "stages":        [ { "stageId": "kinetic", "px": 1033, "py": 1210 }, ... ],
//     "bounds":        { "n": 28.54022, "s": 28.5363, "w": -81.40353, "e": -81.39935 } }
//
// controlPoints are FIXED features read on both the art and an ortho (street
// corners, building corners), never stages. `bounds` is optional: the fence,
// so a stage the fit lands outside it is reported with how far out it is.
//
// ⚠ What a fit is and is not. The output is a read off map ART. Its residuals
// are the art's own error, and a stage projected through it is `src: "poster"`
// until a real measurement says otherwise. A small residual does not promote
// an anchor; scripts/anchor-residuals.mjs and the distance-readout gate decide
// that, not this script.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/load-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAD = Math.PI / 180;

// Metres per degree at a latitude (WGS84 series). A festival is under a
// kilometre across, so one local scale is exact to well under a metre.
export function metresPerDegree(lat) {
  const p = lat * RAD;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p),
    lng: 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p),
  };
}
export function distanceM(a, b) {
  const m = metresPerDegree((a.lat + b.lat) / 2);
  return Math.hypot((a.lng - b.lng) * m.lng, (a.lat - b.lat) * m.lat);
}

// 3x3 solve by Cramer's rule. Returns null when the points are collinear (or
// fewer than three are distinct): no affine is determined, and guessing one
// is how a fit ends up in a lake.
function solve3(A, b) {
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
                 - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                 + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A);
  const scale = Math.max(...A.flat().map(Math.abs)) ** 3 || 1;
  if (Math.abs(d) < 1e-12 * scale) return null;
  return [0, 1, 2].map(c => det(A.map((row, r) => row.map((v, k) => (k === c ? b[r] : v)))) / d);
}

// Least-squares affine from art pixels to lat/lng. Solved in metres about the
// control points' own centre so both axes weigh the same.
export function fitAffine(controlPoints) {
  const pts = controlPoints || [];
  if (pts.length < 3) throw new Error(`need at least 3 control points, got ${pts.length}`);
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng0 = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  const px0 = pts.reduce((s, p) => s + p.px, 0) / pts.length;
  const py0 = pts.reduce((s, p) => s + p.py, 0) / pts.length;
  const m = metresPerDegree(lat0);
  const rows = pts.map(p => ({ u: p.px - px0, v: p.py - py0, e: (p.lng - lng0) * m.lng, n: (p.lat - lat0) * m.lat }));
  const S = f => rows.reduce((s, r) => s + f(r), 0);
  const A = [
    [S(r => r.u * r.u), S(r => r.u * r.v), S(r => r.u)],
    [S(r => r.u * r.v), S(r => r.v * r.v), S(r => r.v)],
    [S(r => r.u),       S(r => r.v),       rows.length],
  ];
  const east  = solve3(A, [S(r => r.u * r.e), S(r => r.v * r.e), S(r => r.e)]);
  const north = solve3(A, [S(r => r.u * r.n), S(r => r.v * r.n), S(r => r.n)]);
  if (!east || !north) throw new Error("control points are collinear; an affine needs three that are not on one line");
  const affine = { east, north, px0, py0, lat0, lng0, m };
  const residuals = pts.map(p => ({ name: p.name, metres: distanceM(applyAffine(affine, p.px, p.py), p) }));
  const rms = Math.sqrt(residuals.reduce((s, r) => s + r.metres ** 2, 0) / residuals.length);
  return { affine, residuals, rms, worst: residuals.reduce((a, b) => (b.metres > a.metres ? b : a)) };
}
export function applyAffine(a, px, py) {
  const u = px - a.px0, v = py - a.py0;
  return {
    lat: a.lat0 + (a.north[0] * u + a.north[1] * v + a.north[2]) / a.m.lat,
    lng: a.lng0 + (a.east[0] * u + a.east[1] * v + a.east[2]) / a.m.lng,
  };
}
// Metres a point sits outside a lat/lng box; 0 when inside.
export function outsideBoundsM(p, b) {
  if (!b) return 0;
  const m = metresPerDegree(p.lat);
  const dN = Math.max(0, p.lat - b.n, b.s - p.lat) * m.lat;
  const dE = Math.max(0, p.lng - b.e, b.w - p.lng) * m.lng;
  return Math.hypot(dN, dE);
}

// Anchors → the 0-100 grid map.jsx draws in. ONE scale for both axes: the
// larger span fills margin..100-margin and the other is centred. map.jsx's
// space is square, so a scale per axis is a real stretch of the ground
// (EDC Orlando's east span is 1.20x its north span, so filling both is a 20 %
// vertical stretch; #73 rejected that table for this reason). `isotropic:
// false` exists only so the rejected table can be re-derived and compared.
export function deriveGrid(anchors, { margin = 10, isotropic = true } = {}) {
  if (!anchors || anchors.length < 2) throw new Error("need at least 2 anchors to derive a grid");
  const lat0 = (Math.max(...anchors.map(a => a.lat)) + Math.min(...anchors.map(a => a.lat))) / 2;
  const m = metresPerDegree(lat0);
  const pts = anchors.map(a => ({ stageId: a.stageId, e: a.lng * m.lng, n: a.lat * m.lat }));
  const minE = Math.min(...pts.map(p => p.e)), maxE = Math.max(...pts.map(p => p.e));
  const minN = Math.min(...pts.map(p => p.n)), maxN = Math.max(...pts.map(p => p.n));
  const spanE = maxE - minE, spanN = maxN - minN, room = 100 - 2 * margin;
  const sE = isotropic ? Math.max(spanE, spanN) / room : spanE / room;
  const sN = isotropic ? Math.max(spanE, spanN) / room : spanN / room;
  const padX = (room - spanE / sE) / 2, padY = (room - spanN / sN) / 2;
  const stages = pts.map(p => ({
    stageId: p.stageId,
    x: Math.round(margin + padX + (p.e - minE) / sE),
    y: Math.round(margin + padY + (maxN - p.n) / sN),   // y grows south
  }));
  return { stages, metresPerUnit: sE, metresPerUnitY: sN, spanE, spanN };
}

// Worst disagreement between the grid's inter-stage distances and the ground's.
export function worstPairwiseError(anchors, gridStages, metresPerUnit) {
  let worst = { pct: 0, pair: null };
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) {
    const a = anchors[i], b = anchors[j];
    const ga = gridStages.find(s => s.stageId === a.stageId), gb = gridStages.find(s => s.stageId === b.stageId);
    if (!ga || !gb) continue;
    const ground = distanceM(a, b), drawn = Math.hypot(ga.x - gb.x, ga.y - gb.y) * metresPerUnit;
    const pct = Math.abs(drawn - ground) / ground * 100;
    if (pct > worst.pct) worst = { pct, pair: `${a.stageId}–${b.stageId}` };
  }
  return worst;
}

// The festival ASKED for, or an error. A loader that quietly hands back a
// different festival turns every number below into a claim about the wrong one.
export function festivalById(id, root = ROOT) {
  const { REG, DS } = loadRegistry(root);
  const entry = REG.find(f => f.config && f.config.id === id);
  if (!entry) throw new Error(`no festival "${id}" in the registry`);
  if (!DS[id]) throw new Error(`festival "${id}" has no data set`);
  return { config: entry.config, stages: DS[id].stages, amenities: DS[id].amenities || [], entry };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  const f5 = n => n.toFixed(5), f6 = n => n.toFixed(6);
  if (cmd === "fit" && arg) {
    const input = JSON.parse(readFileSync(arg, "utf8"));
    const fit = fitAffine(input.controlPoints);
    console.log(`affine over ${input.controlPoints.length} control points · rms ${fit.rms.toFixed(1)} m · worst ${fit.worst.metres.toFixed(1)} m (${fit.worst.name})`);
    for (const r of fit.residuals) console.log(`  ${String(r.name).padEnd(28)} ${r.metres.toFixed(1).padStart(7)} m`);
    const anchors = (input.stages || []).map(s => ({ stageId: s.stageId, ...applyAffine(fit.affine, s.px, s.py) }));
    if (anchors.length) {
      console.log("\nstage reads (poster class — a read off art, not a measurement):");
      for (const a of anchors) {
        const out = outsideBoundsM(a, input.bounds);
        console.log(`  ${a.stageId.padEnd(12)} ${f6(a.lat)}, ${f6(a.lng)}${out > 0 ? `   ⚠ ${out.toFixed(0)} m OUTSIDE bounds` : ""}`);
      }
    }
    if (anchors.length >= 2) {
      const g = deriveGrid(anchors);
      const w = worstPairwiseError(anchors, g.stages, g.metresPerUnit);
      console.log(`\ngrid · one scale, ${g.metresPerUnit.toFixed(2)} m per unit · worst pairwise error ${w.pct.toFixed(1)} % (${w.pair})`);
      for (const s of g.stages) console.log(`  ${s.stageId.padEnd(12)} x: ${s.x}, y: ${s.y}`);
    }
  } else if (cmd === "grid" && arg) {
    const { config, stages } = festivalById(arg);
    const anchors = config.gpsAnchors || [];
    const g = deriveGrid(anchors);
    const w = worstPairwiseError(anchors, g.stages, g.metresPerUnit);
    console.log(`${config.id} · ${anchors.length} anchors · ${g.metresPerUnit.toFixed(2)} m per unit · east ${g.spanE.toFixed(0)} m, north ${g.spanN.toFixed(0)} m · worst pairwise error ${w.pct.toFixed(1)} % (${w.pair})`);
    for (const s of g.stages) {
      const shipped = stages.find(x => x.id === s.stageId);
      const same = shipped && shipped.x === s.x && shipped.y === s.y;
      console.log(`  ${s.stageId.padEnd(12)} derived ${s.x}, ${s.y}   shipped ${shipped ? `${shipped.x}, ${shipped.y}` : "—"}   ${same ? "=" : "≠"}`);
    }
    console.log(`  centroid ${f5(config.gps.lat)}, ${f5(config.gps.lng)}`);
  } else {
    console.error("usage: node scripts/georef-map.mjs fit <points.json> | grid <festivalId>");
    process.exit(2);
  }
}
