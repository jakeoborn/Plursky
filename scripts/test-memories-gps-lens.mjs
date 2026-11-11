#!/usr/bin/env node
// Memories PHOTOS lens: real GPS only.
//
// Rule: a thumbnail sits where its OWN capture fix says. No stage fallback,
// no jitter, no poster x/y anywhere in the lens; a moment without a valid fix
// is counted, never placed. Runs the REAL layout, sliced out of spotify.jsx:
//   L1 only moments with a valid fix are placed (no-GPS, out-of-range, NaN,
//      null island, string and missing fixes are not).
//   L2 every placed position is explained by its own fix: one scale on both
//      axes and true bearings for every pair (a fabricated, jittered or
//      poster-projected position breaks this; see the mutations).
//   L3 a cluster sits on its face shot's own fix, never a computed centre.
//   L4 counts: without-GPS and far-away shots are counted, not placed.
//   L5 static: the lens never reads STAGES, ARTISTS, gpsToMap, the poster image
//      or a jitter helper.
//   M  mutations: each must turn a check red, or the check proves nothing.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SP = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
function slice(src, a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`slice markers not found: ${a} … ${b}`);
  return src.slice(i, j);
}
const TIME_SRC = slice(SP, "function _momentTime(m)", "// One photo/video thumbnail pinned");
const LAYOUT_SRC = slice(SP, "function _lensFix(m)", "function MemoriesPhotoMapLens(");
const LENS_SRC = slice(SP, "// PHOTOS lens: real GPS only.", "// MAP-lens wrapper:");
const load = src => new Function(`${TIME_SRC}\n${src}; return _gpsLensLayout;`)();

// Fixture: real-shaped moments (spotify.jsx import loop). Fixes ~EDC Orlando.
const F = {
  a: { lat: 28.5291731, lng: -81.4048917 },
  b: { lat: 28.5296000, lng: -81.4040000 },   // ~100 m NE of a
  c: { lat: 28.5283000, lng: -81.4055000 },   // ~115 m SW of a
  d: { lat: 28.5300500, lng: -81.4061000 },   // ~160 m NW of a
};
const mk = (id, gps, extra = {}) => ({ id, photoId: `p_${id}`, kind: "photo", night: 2, festivalId: "edc-orlando-2026", artistId: "kaskade", takenAt: `2026-11-07 2${id.length % 10}:00:00`, createdAt: 1, parsedGps: gps, ...extra });
const fixture = () => [
  mk("m_a", F.a), mk("m_b", F.b, { kind: "video" }), mk("m_c", F.c, { artistId: null }), mk("m_d", F.d),
  mk("m_nogps_tagged", null, { hasGps: false }),
  mk("m_range", { lat: 128.5, lng: -81.4 }), mk("m_nan", { lat: NaN, lng: -81.4 }),
  mk("m_null_island", { lat: 0, lng: 0 }), mk("m_str", { lat: "28.53", lng: "-81.40" }),
  { id: "m_no_media", parsedGps: F.a, night: 2 },
];
const GPS_IDS = ["m_a", "m_b", "m_c", "m_d"];
const fixOf = id => ({ m_a: F.a, m_b: F.b, m_c: F.c, m_d: F.d }[id]);
// Independent geometry (not the lens's own code): metres east/north between fixes.
const enM = (p, q) => { const R = 6371008.8, k = Math.PI / 180; return { e: (q.lng - p.lng) * k * R * Math.cos(((p.lat + q.lat) / 2) * k), n: (q.lat - p.lat) * k * R }; };

function suite(layout) {
  const failed = []; let total = 0;
  const ok = (c, name) => { total++; if (!c) failed.push(name); };
  // clusterPct 0: every fix its own pin, so positions can be read one by one.
  const L = layout(fixture(), { clusterPct: 0.0001 });
  const placed = L.clusters.flatMap(c => c.items.map(m => m.id)).sort();
  ok(JSON.stringify(placed) === JSON.stringify(GPS_IDS), `L1 only moments with a valid fix are placed (got ${placed.join(",")})`);
  ok(!L.clusters.some(c => c.items.some(m => !fixOf(m.id))), "L1b no moment without a valid fix is inside any cluster");
  const pos = Object.fromEntries(L.clusters.map(c => [c.face.id, { x: c.x, y: c.y }]));
  // L2: for every pair, screen vector = k × (east, -north) with ONE k.
  const ks = [];
  let bearingOk = true;
  for (let i = 0; i < GPS_IDS.length; i++) for (let j = i + 1; j < GPS_IDS.length; j++) {
    const p = pos[GPS_IDS[i]], q = pos[GPS_IDS[j]];
    if (!p || !q) { bearingOk = false; continue; }
    const { e, n } = enM(fixOf(GPS_IDS[i]), fixOf(GPS_IDS[j]));
    const dx = q.x - p.x, dy = q.y - p.y;
    ks.push(Math.hypot(dx, dy) / Math.hypot(e, n));
    const angScreen = Math.atan2(-dy, dx), angTrue = Math.atan2(n, e);
    let d = Math.abs(angScreen - angTrue); if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > 0.01) bearingOk = false;  // ~0.6°
  }
  const kMin = Math.min(...ks), kMax = Math.max(...ks);
  ok(ks.length === 6 && kMax / kMin < 1.005, `L2 one scale for every pair (ratio spread ${(kMax / kMin).toFixed(4)})`);
  ok(bearingOk, "L2b every pair's on-screen bearing is its true bearing (north up)");
  ok(Object.values(pos).every(p => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100), "L2c every pin is inside the lens");
  // L3: clustered, the cluster sits on its newest shot's own position.
  const Lc = layout(fixture(), { clusterPct: 200 });
  const c0 = Lc.clusters[0];
  ok(Lc.clusters.length === 1 && c0.items.length === 4 && pos[c0.face.id] && Math.abs(c0.x - pos[c0.face.id].x) < 1e-9 && Math.abs(c0.y - pos[c0.face.id].y) < 1e-9, "L3 a cluster sits on its face shot's own fix");
  // L4: counts.
  ok(L.noGps === 5, `L4 the five moments without a valid fix are counted (got ${L.noGps})`);
  const farL = layout([...fixture(), mk("m_far", { lat: 28.62, lng: -81.40 })], { clusterPct: 0.0001 });
  ok(farL.far === 1 && !farL.clusters.some(c => c.items.some(m => m.id === "m_far")), "L4b a fix ~10 km from the rest is counted far, not placed");
  const one = layout([mk("m_one", F.a)]);
  ok(one.clusters.length === 1 && one.clusters[0].x === 50 && one.clusters[0].y === 50 && one.mPerPct > 0, "L4c a single fix sits centred with a finite scale");
  const none = layout([mk("m_x", null), mk("m_y", { lat: 0, lng: 0 })]);
  ok(none.clusters.length === 0 && none.noGps === 2, "L4d no fixes → no pins (empty state), no throw");
  ok(layout(null).clusters.length === 0, "L4e no moments → no pins, no throw");
  return { failed, total };
}

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log(`  ✗ ${msg}`); } };
{
  const { failed, total } = suite(load(LAYOUT_SRC));
  for (const f of failed) ok(false, f);
  pass += total - failed.length;
}
// L5 static
ok(!/STAGES|ARTISTS|gpsToMap|mapToGps|_nearestStageId|_idJitter|mapImage|FESTIVAL_CONFIG|\.stage\b|gpsAnchors/.test(LENS_SRC), "L5 the lens reads no stage, artist, poster projection, poster image or jitter");
ok(!/function _idJitter/.test(SP), "L5b the jitter helper is gone (no lens can reach for it)");

const MUTANTS = [
  ["stage fallback for no-GPS", LAYOUT_SRC.replace("if (!g) { noGps++; continue; }", "if (!g) { fixes.push({ m, g: { lat: 28.5291, lng: -81.4049 }, t: 0 }); continue; }")],
  ["jitter", LAYOUT_SRC.replace("for (const p of pts) { p.x = 50 + (p.e - ce) * scale; p.y = 50 - (p.n - cn) * scale; }", "for (const p of pts) { const h = String(p.m.id).charCodeAt(2); p.x = 50 + (p.e - ce) * scale + (h % 3) * 0.9; p.y = 50 - (p.n - cn) * scale - (h % 2) * 0.9; }")],
  ["separate x/y scales (poster-style stretch)", LAYOUT_SRC.replace("p.y = 50 - (p.n - cn) * scale; }", "p.y = 50 - (p.n - cn) * scale * 1.4; }")],
  ["null island accepted", LAYOUT_SRC.replace("if (g.lat === 0 && g.lng === 0) return null;", "")],
  ["string fixes coerced", LAYOUT_SRC.replace('if (!g || typeof g.lat !== "number" || typeof g.lng !== "number") return null;', "if (!g) return null; g = { lat: +g.lat, lng: +g.lng };").replace("const g = m && m.parsedGps;", "let g = m && m.parsedGps;")],
  ["cluster at a computed centre", LAYOUT_SRC.replace("clusters.push({ x: head.x, y: head.y,", "clusters.push({ x: group.reduce((s, g) => s + g.x, 0) / group.length, y: group.reduce((s, g) => s + g.y, 0) / group.length,")],
];
for (const [name, src] of MUTANTS) {
  if (src === LAYOUT_SRC) { ok(false, `M setup: mutation "${name}" did not apply`); continue; }
  const { failed } = suite(load(src));
  ok(failed.length > 0, `M mutation "${name}" turns a check red`);
  if (failed.length) console.log(`  · mutation "${name}" caught by: ${failed[0]}`);
}
console.log(`test-memories-gps-lens: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
