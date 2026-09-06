#!/usr/bin/env node
// Measure whether a festival's map art can actually carry a distance readout.
//
// `gpsAnchors[].src` records where a lat/lng CAME FROM. That is necessary but
// not sufficient: provenance says the anchors are real, it says nothing about
// whether the ART they register onto is an affine projection of the ground.
// map.jsx's _solveMapAffine() fits the FIRST THREE anchors exactly, so a basis
// residual is always 0 — the honest question is what happens to the anchors
// OUTSIDE the basis.
//
// A poster drawn by an illustrator has local scale that wanders (ACL's is
// 5.8–11.3 m/unit), and no single affine can register it. Fitting one anyway
// produces a transform that looks fine at the three basis stages and puts the
// others in a lake. This script is how you find that out BEFORE shipping it.
//
//   node scripts/anchor-residuals.mjs                  # audit what ships today
//   node scripts/anchor-residuals.mjs --proposed p.json # score a patch first
//
// p.json: { "<festivalId>": [ {stageId, lat, lng, src}, ... ], ... }
// Anchor ORDER matters — the first three are the basis.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = new Set(["osm", "crowd"]);
// Tolerance for "the art actually fits these anchors". Every festival whose
// x/y were derived FROM its anchors lands at 0–1 m, so 25 m is generous.
const TOL_M = 25;

const args = process.argv.slice(2);
const proposedPath = args.includes("--proposed") ? args[args.indexOf("--proposed") + 1] : null;
const PROPOSED = proposedPath ? JSON.parse(readFileSync(proposedPath, "utf8")) : null;

// ── Load the real data exactly as the browser does ───────────────────────────
const ctx = { window: {}, console, Date, Math, JSON, Object, Array, String, Number,
  isNaN, parseInt, parseFloat, fetch: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
vm.createContext(ctx);
const mods = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean)
  .map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
vm.runInContext(mods + "\n" + readFileSync(join(ROOT, "data.jsx"), "utf8") +
  "\n;__o={REG:FESTIVALS_REGISTRY,DS:_DATA_SETS};", ctx);
const { REG, DS } = ctx.__o;

// ── The same affine map.jsx solves, so this measures the shipped transform ───
function solveAffine(anchors, stages) {
  const find = id => stages.find(s => s.id === id);
  const [a0, a1, a2] = anchors;
  if (!a0 || !a1 || !a2) return null;
  if (!find(a0.stageId) || !find(a1.stageId) || !find(a2.stageId)) return null;
  const A = { lat: a0.lat, lng: a0.lng, mx: find(a0.stageId).x, my: find(a0.stageId).y };
  const B = { lat: a1.lat, lng: a1.lng, mx: find(a1.stageId).x, my: find(a1.stageId).y };
  const C = { lat: a2.lat, lng: a2.lng, mx: find(a2.stageId).x, my: find(a2.stageId).y };
  const det = A.lat*(B.lng-C.lng) - A.lng*(B.lat-C.lat) + (B.lat*C.lng - C.lat*B.lng);
  if (Math.abs(det) < 1e-12) return null;
  const solve = (v1, v2, v3) => [
    (v1*(B.lng-C.lng) - A.lng*(v2-v3) + (C.lng*v2 - B.lng*v3)) / det,
    (A.lat*(v2-v3) - v1*(B.lat-C.lat) + (B.lat*v3 - C.lat*v2)) / det,
    (A.lat*(B.lng*v3-C.lng*v2) - A.lng*(B.lat*v3-C.lat*v2) + v1*(B.lat*C.lng-C.lat*B.lng)) / det];
  return { x: solve(A.mx, B.mx, C.mx), y: solve(A.my, B.my, C.my) };
}
function mapToGps(af, x, y) {
  const [a,b,c] = af.x, [d,e,f] = af.y;
  const det = a*e - b*d;
  if (Math.abs(det) < 1e-12) return null;
  return { lat: (e*(x-c) - b*(y-f)) / det, lng: (-d*(x-c) + a*(y-f)) / det };
}
const hav = (la1, lo1, la2, lo2) => {
  const R = 6371000, r = Math.PI/180;
  const dla = (la2-la1)*r, dlo = (lo2-lo1)*r;
  const h = Math.sin(dla/2)**2 + Math.cos(la1*r)*Math.cos(la2*r)*Math.sin(dlo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};

function audit(id, stages, anchors, label) {
  const out = [];
  out.push(`\n### ${id} — ${label}`);
  const missing = anchors.filter(a => !stages.some(s => s.id === a.stageId));
  if (missing.length) out.push(`  ⚠ anchors naming a stage that does not exist: ${missing.map(m => m.stageId).join(", ")}`);
  if (anchors.length < 3) { out.push("  ⚠ fewer than 3 anchors — no affine"); return { lines: out, verdict: null }; }
  const af = solveAffine(anchors, stages);
  if (!af) { out.push("  ⚠ affine failed to solve"); return { lines: out, verdict: null }; }

  const basis = anchors.slice(0, 3);
  out.push(`  basis: ${basis.map(a => `${a.stageId}(${a.src})`).join(" ")}`);

  const rest = anchors.slice(3).filter(a => stages.some(s => s.id === a.stageId));
  const rows = rest.map(a => {
    const s = stages.find(x => x.id === a.stageId);
    const g = mapToGps(af, s.x, s.y);
    return { id: a.stageId, src: a.src, m: hav(a.lat, a.lng, g.lat, g.lng) };
  });
  for (const r of rows) {
    out.push(`    ${r.id.padEnd(14)} ${String(r.src).padEnd(8)} ${r.m.toFixed(0).padStart(5)} m from where the affine draws it`);
  }
  if (!rows.length) out.push("    (no anchors outside the basis — nothing independent to check)");

  // The two conditions. Provenance alone was never enough.
  const provenanceOk = basis.some(a => EVIDENCE.has(a.src));
  const corroborated = rows.filter(r => EVIDENCE.has(r.src) && r.m <= TOL_M);
  out.push(`  provenance (basis has evidence) : ${provenanceOk ? "PASS" : "FAIL"}`);
  out.push(`  corroboration (sourced anchor outside basis within ${TOL_M} m) : ` +
    (corroborated.length ? `PASS (${corroborated.map(c => `${c.id} ${c.m.toFixed(0)}m`).join(", ")})` : "FAIL"));
  const verdict = provenanceOk && corroborated.length > 0;
  out.push(`  → distance readouts: ${verdict ? "DEFENSIBLE" : "must stay suppressed"}`);
  return { lines: out, verdict };
}

const live = REG.filter(f => f.available === true && DS[f.config && f.config.id]);
console.log(`Anchor residual audit — ${live.length} live festival(s), tolerance ${TOL_M} m`);
for (const f of live) {
  const id = f.config.id, ds = DS[id];
  console.log(audit(id, ds.stages, ds.config.gpsAnchors || [], "SHIPPING TODAY").lines.join("\n"));
}
// Gated modules ship no readouts, so nothing here can be user-visible — but
// their anchors are still the thing a flip session inherits, and an unaudited
// anchor set is exactly how edc-orlando-2026 carried five centroid offsets
// 170-481 m from the real stages for two weeks. Audit them too, plainly
// labelled, so a bad basis is caught at authoring time and not at flip time.
const gated = REG.filter(f => f.available !== true && DS[f.config && f.config.id]
                              && (DS[f.config.id].config.gpsAnchors || []).length);
if (gated.length) {
  console.log(`\n\n══ GATED (not shipping — audited so the flip session inherits a known-good basis) ══`);
  for (const f of gated) {
    const id = f.config.id, ds = DS[id];
    console.log(audit(id, ds.stages, ds.config.gpsAnchors, "GATED").lines.join("\n"));
  }
}

if (PROPOSED) {
  console.log("\n\n══ PROPOSED PATCHES ══");
  for (const [id, anchors] of Object.entries(PROPOSED)) {
    if (id.startsWith("_")) continue;   // "_note" and friends are documentation, not festivals
    const ds = DS[id];
    if (!ds) { console.log(`\n### ${id} — not a known festival`); continue; }
    console.log(audit(id, ds.stages, anchors, `PROPOSED (${proposedPath})`).lines.join("\n"));
    const cur = ds.config.gpsAnchors || [];
    const moves = anchors.map(a => {
      const c = cur.find(x => x.stageId === a.stageId);
      return c ? `${a.stageId} ${hav(c.lat, c.lng, a.lat, a.lng).toFixed(0)}m` : `${a.stageId} (new)`;
    });
    console.log(`  movement vs shipping: ${moves.join(", ")}`);
  }
}
