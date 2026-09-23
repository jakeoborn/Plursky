#!/usr/bin/env node
// test-acl-map-2026.mjs — the ACL 2026 map refresh keeps its two coordinate
// systems apart (verify gate 1z-c5).
//
//   stage/amenity x/y   where a thing is on the rendered 2026 map ART
//   gpsAnchors lat/lng  where it is in the WORLD (satellite-measured)
//
// The official patron map is evidence for the first question only. This gate
// locks: the exact first-party source and the square plate built from it; every
// shipped x/y equals a measured row in scripts/build-acl-map-2026.mjs; the four
// satellite anchors are untouched and in order; no anchor is read off the
// poster (Snapchat, Tito's, Beatbox); no Lady Bird stage without a 2026 set.
// Each rule is proven live by a mutation that must fail it.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { ACL_MAP_2026 as M, imageSize, sha256 } from "./build-acl-map-2026.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
let checks = 0, mutations = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const clone = x => JSON.parse(JSON.stringify(x));

// The anchors as they stood before the refresh. Same order: map.jsx solves
// MAP_AFFINE from the first three.
const ANCHORS = [
  { stageId: "amex",    lat: 30.267233, lng: -97.763236, src: "osm" },
  { stageId: "miller",  lat: 30.269017, lng: -97.769316, src: "osm" },
  { stageId: "tmobile", lat: 30.268021, lng: -97.770282, src: "osm" },
  { stageId: "bmi",     lat: 30.266404, lng: -97.767698, src: "derived" },
];
const STAGE_IDS = ["amex", "snapchat", "titos", "miller", "tmobile", "bmi", "beatbox"];

// ── load the real data exactly as the browser does ──
const ctx = { window: {}, console, Date, Math, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat,
  fetch: () => {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
vm.createContext(ctx);
const mods = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT }).toString().trim().split("\n")
  .filter(Boolean).map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
vm.runInContext(mods + "\n" + readFileSync(join(ROOT, "data.jsx"), "utf8") + "\n;__o={DS:_DATA_SETS};", ctx);
const acl = ctx.__o.DS["acl-2026"];
ok(acl?.config?.id === "acl-2026", "could not load the acl-2026 data set");

const swSrc = readFileSync(join(ROOT, "sw.js"), "utf8");
const localBlock = (swSrc.match(/const LOCAL = \[([\s\S]*?)\n\];/) || [, ""])[1];
const LOCAL = new Set([...localBlock.matchAll(/['"`]\.\/([^'"`?]*)(?:\?[^'"`]*)?['"`]/g)].map(m => m[1]));
const tracked = new Set(execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean));

const grid = v => Math.round(1000 * v / M.derivativeSize[0]) / 10;

function validate(ds, { local = LOCAL } = {}) {
  const p = [], cfg = ds.config;
  // Asset: the ACL config renders the 2026 plate, and the plate is precached.
  if (cfg.mapImage !== M.derivative) p.push(`mapImage is ${cfg.mapImage}, not ${M.derivative}`);
  if (cfg.mapStyle !== "image-overlay" || cfg.mapTheme !== "park") p.push("mapStyle/mapTheme changed");
  if (!local.has(cfg.mapImage)) p.push(`${cfg.mapImage} is not in sw.js LOCAL`);
  if (local.has(M.source)) p.push("the 4 MB source PNG is precached; only the derivative is a runtime asset");
  // Stages: exactly the seven programmed ones, every artist row resolves.
  const ids = ds.stages.map(s => s.id);
  if (ids.slice().sort().join() !== STAGE_IDS.slice().sort().join()) p.push(`stages are ${ids.join(",")}, expected the 7 programmed 2026 stages`);
  if (ids.some(id => /lady|bonus/i.test(id))) p.push("a Lady Bird / Bonus Tracks stage is defined with no 2026 programming");
  for (const a of ds.artists) if (!ids.includes(a.stage)) { p.push(`artist ${a.id} plays unknown stage ${a.stage}`); break; }
  // World coordinates: the four satellite anchors, unchanged and in order.
  const an = cfg.gpsAnchors || [];
  if (JSON.stringify(an.map(a => [a.stageId, a.lat, a.lng, a.src])) !== JSON.stringify(ANCHORS.map(a => [a.stageId, a.lat, a.lng, a.src])))
    p.push(`gpsAnchors changed: ${an.map(a => a.stageId).join(",")}`);
  for (const id of ["snapchat", "titos", "beatbox"]) if (an.some(a => a.stageId === id)) p.push(`${id} has a GPS anchor; the poster is not a survey`);
  // Art coordinates: every x/y is a measured row, and nothing unmeasured ships.
  const rows = [...ds.stages.map(s => ["stages", s]), ...(ds.amenities || []).map(a => ["amenities", a])];
  for (const [kind, item] of rows) {
    const m = M.measured[kind][item.id];
    if (!m) { p.push(`${kind} ${item.id} ships x/y (${item.x},${item.y}) with no measurement row`); continue; }
    if (!(item.x >= 0 && item.x <= 100 && item.y >= 0 && item.y <= 100)) p.push(`${item.id} x/y outside 0–100`);
    if (item.x !== grid(m.px[0]) || item.y !== grid(m.px[1])) p.push(`${item.id} is (${item.x},${item.y}); measured ${m.px.join(",")} px = (${grid(m.px[0])},${grid(m.px[1])})`);
  }
  for (const id of Object.keys(M.measured.stages)) if (!ids.includes(id)) p.push(`measured stage ${id} is not shipped`);
  // Copy must not claim what the map does not say.
  const snap = ds.stages.find(s => s.id === "snapchat");
  if (snap && /TBA|not yet|unpublished/i.test(`${snap.desc} ${snap.vibeNote}`)) p.push("Snapchat still reads as unplaced");
  return p;
}

// ── 1. the shipped data ──
const live = validate(acl);
ok(!live.length, `acl-2026 map data:\n      ${live.join("\n      ")}`);

// ── 2. the assets ──
const src = join(ROOT, M.source), der = join(ROOT, M.derivative);
ok(existsSync(src) && sha256(src) === M.sourceSha256, `${M.source} is missing or is not the verified 2026 patron map`);
ok(existsSync(src) && imageSize(readFileSync(src))?.join("x") === M.sourceSize.join("x"), `${M.source} is not ${M.sourceSize.join("x")}`);
const dsz = existsSync(der) && imageSize(readFileSync(der));
ok(dsz && dsz[0] === dsz[1] && dsz.join("x") === M.derivativeSize.join("x"), `${M.derivative} is not a ${M.derivativeSize.join("x")} square`);
ok(existsSync(der) && sha256(der) === M.derivativeSha256, `${M.derivative} is not the plate the coordinates were measured on`);
ok(tracked.has(M.source) && tracked.has(M.derivative), "the source PNG and the derivative must both be tracked in git");
ok(M.source.includes("/"), "the source PNG must stay out of the repo root, which build.mjs ships to iOS");
for (const [kind, rows] of Object.entries(M.measured)) for (const [id, r] of Object.entries(rows)) {
  ok(r.px[0] >= 0 && r.px[0] < M.derivativeSize[0] && r.px[1] >= M.pad.top && r.px[1] < M.derivativeSize[1] - M.pad.bottom,
    `${kind} ${id} measured at ${r.px} — outside the map art (padding or off-plate)`);
  ok(r.confidence === "high" && r.note, `${kind} ${id} has no confident, explained measurement`);
}

// ── 3. mutations: each rule must be able to fail ──
const mustFail = (label, mutate, opts) => {
  const m = clone(acl); mutate(m); mutations++;
  ok(validate(m, opts).length > 0, `mutation not caught: ${label}`);
};
mustFail("render the 2025 plate", m => { m.config.mapImage = "acl-park.webp"; });
mustFail("drop the plate from the precache", () => {}, { local: new Set([...LOCAL].filter(x => x !== M.derivative)) });
mustFail("precache the 4 MB source", () => {}, { local: new Set([...LOCAL, M.source]) });
mustFail("add a Snapchat GPS anchor from the poster", m => { m.config.gpsAnchors.push({ stageId: "snapchat", lat: 30.2665, lng: -97.7672, src: "poster" }); });
mustFail("add a Tito's anchor", m => { m.config.gpsAnchors.push({ stageId: "titos", lat: 30.2685, lng: -97.7652, src: "derived" }); });
mustFail("reorder the affine basis", m => { const a = m.config.gpsAnchors; [a[0], a[1]] = [a[1], a[0]]; });
mustFail("move a satellite anchor", m => { m.config.gpsAnchors[2].lat += 0.0005; });
mustFail("restore Lady Bird as a stage", m => { m.stages.push({ id: "ladybird", name: "Lady Bird", x: 50, y: 50 }); });
mustFail("drop a programmed stage", m => { m.stages = m.stages.filter(s => s.id !== "beatbox"); });
mustFail("nudge a stage off its measurement", m => { m.stages.find(s => s.id === "snapchat").x += 1; });
mustFail("carry an unmeasured 2025 amenity into 2026", m => { m.amenities.push({ id: "aa5", type: "med", label: "Medical", x: 55, y: 60 }); });
mustFail("Snapchat copy still says TBA", m => { m.stages.find(s => s.id === "snapchat").desc = "Location TBA · check the on-site map"; });

if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} ACL map checks failed`); process.exit(1); }
console.log(`  ✓ ACL 2026 map: plate is the verified 2026 patron map (square ${M.derivativeSize.join("×")}), ` +
  `${acl.stages.length} stages + ${acl.amenities.length} amenities on measured rows, 4 satellite anchors untouched, ` +
  `${checks} checks (${mutations} mutations, each caught)`);
