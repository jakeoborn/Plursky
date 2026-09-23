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
vm.runInContext(mods + "\n" + readFileSync(join(ROOT, "data.jsx"), "utf8") + "\n;__o={DS:_DATA_SETS,avatarStartFor,AVATAR_CLEARANCE,active:_active};", ctx);
const acl = ctx.__o.DS["acl-2026"];
ok(acl?.config?.id === "acl-2026", "could not load the acl-2026 data set");

const swSrc = readFileSync(join(ROOT, "sw.js"), "utf8");
const localBlock = (swSrc.match(/const LOCAL = \[([\s\S]*?)\n\];/) || [, ""])[1];
const LOCAL = new Set([...localBlock.matchAll(/['"`]\.\/([^'"`?]*)(?:\?[^'"`]*)?['"`]/g)].map(m => m[1]));
const tracked = new Set(execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean));

const grid = v => Math.round(1000 * v / M.derivativeSize[0]) / 10;

const CORNERS = ["12,88", "88,88", "12,12", "88,12"];
// The printed 2026 map, surveyed badge by badge: 8 hydration drops, 7 restroom
// badges, 4 medical squares, plus the 2 numbered food courts. Guest services
// ("i") is deliberately absent until verified (founder ruling 2026-09-23).
const AMENITY_SURVEY = { water: 8, toilet: 7, med: 4, food: 2 };

function validate(ds, { local = LOCAL, start = ctx.__o.avatarStartFor(ds) } = {}) {
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
  const amIds = (ds.amenities || []).map(a => a.id);
  for (const id of Object.keys(M.measured.amenities)) if (!amIds.includes(id)) p.push(`measured amenity ${id} is not shipped`);
  const byType = {};
  for (const a of ds.amenities || []) byType[a.type] = (byType[a.type] || 0) + 1;
  if (JSON.stringify(byType, Object.keys(AMENITY_SURVEY).concat(Object.keys(byType)).sort()) !== JSON.stringify(AMENITY_SURVEY, Object.keys(AMENITY_SURVEY).concat(Object.keys(byType)).sort()))
    p.push(`amenities by type are ${JSON.stringify(byType)}, the printed map surveys ${JSON.stringify(AMENITY_SURVEY)}`);
  // The demo YOU marker: a corner of its wander box, clear of every pin.
  const pins = [...ds.stages, ...(ds.amenities || [])];
  const room = Math.min(...pins.map(q => Math.hypot(q.x - start.x, q.y - start.y)));
  if (!CORNERS.includes(`${start.x},${start.y}`)) p.push(`the demo YOU marker starts at (${start.x},${start.y}), not a map corner`);
  if (room < ctx.__o.AVATAR_CLEARANCE) p.push(`the demo YOU marker starts ${room.toFixed(1)} units from a pin`);
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
mustFail("pin guest services before it is verified", m => { Object.assign(m.amenities.find(a => a.id === "ah1"), { type: "info", label: "Guest Services" }); });
mustFail("drop a measured hydration badge", m => { m.amenities = m.amenities.filter(a => a.id !== "ah5"); });
mustFail("start the YOU marker at the old fleet-wide {50,52}", () => {}, { start: { x: 50, y: 52 } });
mustFail("start the YOU marker on a stage", m => { const c = ctx.__o.avatarStartFor(m); m.stages[0].x = c.x; m.stages[0].y = c.y; }, { start: ctx.__o.avatarStartFor(acl) });
mustFail("Snapchat copy still says TBA", m => { m.stages.find(s => s.id === "snapchat").desc = "Location TBA · check the on-site map"; });

// map.jsx seeds the demo marker from the bare AVATAR_START, which resolves
// through window: it must be the computed corner for the active festival.
ok(JSON.stringify(ctx.window.AVATAR_START) === JSON.stringify(ctx.__o.avatarStartFor(ctx.__o.active)),
  `window.AVATAR_START is ${JSON.stringify(ctx.window.AVATAR_START)}, not the computed corner for the active festival`);
ok(/React\.useState\(AVATAR_START\)/.test(readFileSync(join(ROOT, "map.jsx"), "utf8")), "map.jsx no longer seeds the demo marker from AVATAR_START");

// ── 4. fleet-wide: no festival's demo marker starts on a pinned stage ──
for (const [id, ds] of Object.entries(ctx.__o.DS)) {
  const st = (ds.stages || []).filter(q => Number.isFinite(q.x) && Number.isFinite(q.y));
  if (!st.length) continue;
  const c = ctx.__o.avatarStartFor(ds);
  const near = Math.min(...st.map(q => Math.hypot(q.x - c.x, q.y - c.y)));
  ok(CORNERS.includes(`${c.x},${c.y}`) && near >= 3, `${id}: demo YOU marker starts at (${c.x},${c.y}), ${near.toFixed(1)} units from a stage`);
}

if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} ACL map checks failed`); process.exit(1); }
console.log(`  ✓ ACL 2026 map: plate is the verified 2026 patron map (square ${M.derivativeSize.join("×")}), ` +
  `${acl.stages.length} stages + ${acl.amenities.length} amenities on measured rows, 4 satellite anchors untouched, YOU starts at (${ctx.__o.avatarStartFor(acl).x},${ctx.__o.avatarStartFor(acl).y}), ` +
  `${checks} checks (${mutations} mutations, each caught)`);
