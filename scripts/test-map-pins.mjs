#!/usr/bin/env node
// SPEC-178 map pins: your own tagged photos and videos at their capture GPS.
//
// SPEC-178 rules: pins for EVERY tagged item; location stays on the
// device (not in diagnostic export, share cards, recaps, exports, public
// pages, any network call); no GPS = no pin (no placeholder, no estimate).
//
// This gate runs the REAL source functions, sliced out of the .jsx files:
//   A. _momentPinsFor: every tagged item with a valid fix gets exactly one pin
//      at its own lat/lng; untagged, no-GPS, out-of-range, null-island and
//      other-festival items get none. No estimate path exists.
//   B. Cloud backup (_slimMomentsForSync): a moment carrying planted capture
//      coordinates, accuracy and heading leaves with none of them; the rest of
//      the record (tag, night, amenity label) is kept so restore still works.
//   D. Accuracy rings (SPEC-192 ws1): each pin with a recorded accuracy gets a
//      true-metre circle on its OWN fix with its OWN radius; precise/coarse is
//      the shared photoFixAccClass (data.jsx, the tagger's maxAccM); no
//      recorded accuracy = no ring, never a default.
//   C. Mutations: each must turn a check red, or the check proves nothing.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP = readFileSync(join(ROOT, "map.jsx"), "utf8");
const SB = readFileSync(join(ROOT, "supabase.jsx"), "utf8");

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; } else { fail++; console.log(`  ✗ ${msg}`); } };

function slice(src, startMark, endMark) {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark, a + startMark.length);
  if (a < 0 || b < 0) throw new Error(`slice markers not found: ${startMark} … ${endMark}`);
  return src.slice(a, b);
}
const PIN_SRC = slice(MAP, "function _validGps(g)", "function _lngLatOf(p)");
const SLIM_SRC = slice(SB, "const _MOMENT_LOCAL_FIELDS", "// Ceiling on the moments blob");
const DATA = readFileSync(join(ROOT, "data.jsx"), "utf8");
const TRUST_SRC = slice(DATA, "const STAGE_FIX_PHOTO = {", "function stageFixGate(");
const loadPins = (src, trust = TRUST_SRC) => new Function(`${trust}\n${src}; return { _momentPinsFor, _momentPinsGeoJson, _momentAccRingsGeoJson };`)();
const loadSlim = (src) => new Function(`${src}; return _slimMomentsForSync;`)();

// Fixture: real-shaped moments as the import loop writes them (spotify.jsx).
const FID = "edc-orlando-2026";
const LAT = 28.5412345, LNG = -81.3987654;
const fixture = () => [
  { id: "m_gps_photo", artistId: "kaskade", festivalId: FID, night: 2, kind: "photo", parsedGps: { lat: LAT, lng: LNG }, gpsAccM: 6, heading: 211, headingRef: "T", location: { label: "Water", type: "water", icon: "💧", distMeters: 40 } },
  { id: "m_gps_video", artistId: "maddix", festivalId: FID, night: 3, kind: "video", parsedGps: { lat: 28.5420001, lng: -81.3990002 }, gpsAccM: 35 },
  { id: "m_nogps_tagged", artistId: "atliens", festivalId: FID, night: 3, kind: "photo", parsedGps: null, hasGps: false },
  { id: "m_gps_untagged", artistId: null, festivalId: FID, night: 1, kind: "photo", parsedGps: { lat: LAT, lng: LNG } },
  { id: "m_bad_range", artistId: "kaskade", festivalId: FID, night: 2, kind: "photo", parsedGps: { lat: 128.5, lng: LNG } },
  { id: "m_nan", artistId: "kaskade", festivalId: FID, night: 2, kind: "photo", parsedGps: { lat: NaN, lng: LNG } },
  { id: "m_null_island", artistId: "kaskade", festivalId: FID, night: 2, kind: "photo", parsedGps: { lat: 0, lng: 0 } },
  { id: "m_other_fest", artistId: "kaskade", festivalId: "acl-2026", night: 1, kind: "photo", parsedGps: { lat: 30.267, lng: -97.770 } },
  { id: "m_str_gps", artistId: "kaskade", festivalId: FID, night: 2, kind: "photo", parsedGps: { lat: "28.54", lng: "-81.39" } },
];

// ── A. pins ─────────────────────────────────────────────────────────────
{
  const { _momentPinsFor, _momentPinsGeoJson } = loadPins(PIN_SRC);
  const pins = _momentPinsFor(fixture(), FID);
  const ids = pins.map(p => p.id).sort();
  ok(JSON.stringify(ids) === JSON.stringify(["m_gps_photo", "m_gps_video"]), `A1 only tagged items with a valid fix pin (got ${ids.join(",")})`);
  const p1 = pins.find(p => p.id === "m_gps_photo");
  ok(p1 && p1.lat === LAT && p1.lng === LNG, "A2 a pin sits at the item's own capture lat/lng, unrounded");
  ok(p1 && p1.accM === 6, "A3 the pin carries the recorded accuracy radius");
  ok(pins.find(p => p.id === "m_gps_video")?.kind === "video", "A4 videos pin too, marked video");
  ok(!ids.includes("m_nogps_tagged"), "A5 no GPS = no pin (tagged item without a fix is absent, not estimated)");
  ok(_momentPinsFor([], FID).length === 0 && _momentPinsFor(null, FID).length === 0, "A6 no moments = no pins, no throw");
  const gj = _momentPinsGeoJson(pins);
  ok(gj.type === "FeatureCollection" && gj.features.length === 2, "A7 GeoJSON has one feature per pin");
  const f1 = gj.features.find(f => f.properties.id === "m_gps_photo");
  ok(f1 && f1.geometry.coordinates[0] === LNG && f1.geometry.coordinates[1] === LAT, "A8 GeoJSON is [lng, lat] (MapLibre order)");
  ok(gj.features.every(f => JSON.stringify(Object.keys(f.properties).sort()) === '["acc","id","kind"]'), "A9 feature properties are id + kind + accuracy class only");
  // Every tagged item in a GPS-complete fixture gets a pin (the "EVERY" lock).
  const allGps = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, artistId: `a${i % 7}`, festivalId: FID, kind: i % 3 ? "photo" : "video", parsedGps: { lat: LAT + i * 1e-5, lng: LNG - i * 1e-5 } }));
  ok(_momentPinsFor(allGps, FID).length === 50, "A10 every tagged item with GPS pins (50 of 50)");
  // No estimate code path: the helper never reads stage/poster/x/y/jitter.
  const body = slice(MAP, "function _momentPinsFor(", "function _momentPinsGeoJson(");
  ok(!/STAGES|\.x\b|\.y\b|_idJitter|mapToGps|gpsToMap|cfg\.gps|FESTIVAL_CONFIG/.test(body), "A11 _momentPinsFor has no stage, poster, jitter or venue fallback");
}

// ── D. accuracy rings ───────────────────────────────────────────────────
const hav = (a, b) => { const R = 6371008.8, k = Math.PI / 180, dLat = (b.lat - a.lat) * k, dLng = (b.lng - a.lng) * k; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const accFixture = () => [
  { id: "r_p", artistId: "kaskade", festivalId: FID, kind: "photo", parsedGps: { lat: LAT, lng: LNG }, gpsAccM: 6 },
  { id: "r_c", artistId: "kaskade", festivalId: FID, kind: "video", parsedGps: { lat: 28.5420001, lng: -81.3990002 }, gpsAccM: 250 },
  { id: "r_u", artistId: "kaskade", festivalId: FID, kind: "photo", parsedGps: { lat: 28.5402, lng: -81.3979 } },
  { id: "r_nan", artistId: "kaskade", festivalId: FID, kind: "photo", parsedGps: { lat: 28.5403, lng: -81.3978 }, gpsAccM: NaN },
  { id: "r_zero", artistId: "kaskade", festivalId: FID, kind: "photo", parsedGps: { lat: 28.5404, lng: -81.3977 }, gpsAccM: 0 },
  { id: "r_str", artistId: "kaskade", festivalId: FID, kind: "photo", parsedGps: { lat: 28.5405, lng: -81.3976 }, gpsAccM: "12" },
];
function ringSuite(api) {
  const failed = []; const t = (c, n) => { if (!c) failed.push(n); };
  const pins = api._momentPinsFor(accFixture(), FID);
  const by = Object.fromEntries(pins.map(p => [p.id, p]));
  const rings = api._momentAccRingsGeoJson(pins).features;
  const rb = Object.fromEntries(rings.map(f => [f.properties.id, f]));
  t(Object.keys(rb).sort().join() === "r_c,r_p", `D1 a ring for each pin with a recorded accuracy, none otherwise (got ${Object.keys(rb).join(",")})`);
  for (const id of ["r_p", "r_c"]) {
    const f = rb[id], want = id === "r_p" ? 6 : 250, c = by[id];
    const ds = f ? f.geometry.coordinates[0].map(([lng, lat]) => hav(c, { lat, lng })) : [];
    t(!!f && ds.length > 30 && ds.every(d => Math.abs(d - want) / want < 0.01), `D2 ${id}: every ring vertex is ${want} m from its own fix (got ${ds.length ? Math.min(...ds).toFixed(2) + "-" + Math.max(...ds).toFixed(2) : "none"})`);
    t(!!f && JSON.stringify(f.geometry.coordinates[0][0]) === JSON.stringify(f.geometry.coordinates[0].at(-1)), `D2b ${id}: the ring is closed`);
  }
  t(by.r_p?.acc === "precise" && by.r_c?.acc === "coarse" && rb.r_p?.properties.acc === "precise" && rb.r_c?.properties.acc === "coarse", "D3 precise within the tagger's line, coarse past it");
  t(["r_u", "r_nan", "r_zero", "r_str"].every(id => by[id] && by[id].acc === "unknown" && by[id].accM === null), "D4 missing, NaN, 0 and string accuracy are unknown (accM null), still pinned");
  t(rings.every(f => JSON.stringify(Object.keys(f.properties).sort()) === '["acc","accM","id"]'), "D5 ring properties are id + class + radius only");
  return failed;
}
{
  const failed = ringSuite(loadPins(PIN_SRC));
  for (const f of failed) ok(false, f);
  ok(!failed.length, "D suite green on the real source");
  const body = slice(MAP, "function _momentPinsFor(", "function _momentPinsGeoJson(");
  ok(!/gpsAccM|maxAccM|\b100\b/.test(body) && /photoFixAccM\(/.test(body) && /photoFixAccClass\(/.test(body), "D6 the map restates no accuracy rule: it calls photoFixAccM/photoFixAccClass");
  const RM = [
    ["missing accuracy defaulted to a ring", PIN_SRC, TRUST_SRC.replace("&& a > 0 ? a : null;", "&& a > 0 ? a : 10;")],
    ["ring tighter than captured", PIN_SRC.replace("const dLat = p.accM / R / k, dLng = p.accM / (R", "const dLat = p.accM / 2 / R / k, dLng = p.accM / 2 / (R"), TRUST_SRC],
    ["ring on a shared centre", PIN_SRC.replace("ring.push([p.lng + dLng * Math.cos(a), p.lat + dLat * Math.sin(a)]);", "ring.push([-81.3987654 + dLng * Math.cos(a), 28.5412345 + dLat * Math.sin(a)]);"), TRUST_SRC],
    ["coarse drawn as precise", PIN_SRC, TRUST_SRC.replace('return acc <= STAGE_FIX_PHOTO.maxAccM ? "precise" : "coarse";', 'return "precise";')],
  ];
  for (const [name, src, trust] of RM) {
    if (src === PIN_SRC && trust === TRUST_SRC) { ok(false, `D setup: mutation "${name}" did not apply`); continue; }
    const f = ringSuite(loadPins(src, trust));
    ok(f.length > 0, `D mutation "${name}" turns a ring check red`);
    if (f.length) console.log(`  · mutation "${name}" caught by: ${f[0]}`);
  }
}

// ── B. cloud backup keeps coordinates on the device ─────────────────────
{
  const slim = loadSlim(SLIM_SRC);
  const all = { 2: fixture().slice(0, 1), 3: fixture().slice(1, 3) };
  const out = slim(all);
  const json = JSON.stringify(out);
  ok(!json.includes("28.54") && !json.includes("-81.39"), "B1 no planted coordinate digits in the backup payload");
  ok(!/parsedGps|gpsAccM|"heading"|headingRef/.test(json), "B2 parsedGps, gpsAccM, heading, headingRef are not sent");
  const m = out[2][0];
  ok(m.id === "m_gps_photo" && m.artistId === "kaskade" && m.night === 2, "B3 tag, night and id still back up (restore works)");
  ok(m.location && m.location.label === "Water" && !("lat" in m.location), "B4 amenity label still backs up, and carries no coordinates");
  ok(all[2][0].parsedGps && all[2][0].parsedGps.lat === LAT, "B5 the on-device store is not mutated by the slim");
}

// ── C. mutations ────────────────────────────────────────────────────────
{
  // C1: the pre-fix denylist leaks coordinates.
  const oldSlim = loadSlim(SLIM_SRC.replace(/\[\s*"nativePath"[^\]]*\]/, '["nativePath", "_fingerprint", "_contentSha256"]'));
  ok(JSON.stringify(oldSlim({ 1: fixture().slice(0, 1) })).includes("28.54"), "C1 mutation: the old field list leaks coordinates (B1 would catch it)");
  // C2: a stage-position fallback for no-GPS items is caught by A5.
  const fallback = PIN_SRC.replace("if (!_validGps(g) || (g.lat === 0 && g.lng === 0)) continue;",
    "if (!_validGps(g) || (g.lat === 0 && g.lng === 0)) { out.push({ id: m.id, lat: 28.5, lng: -81.4, accM: null, kind: 'photo' }); continue; }");
  ok(fallback !== PIN_SRC, "C2 setup: fallback mutation applied");
  ok(loadPins(fallback)._momentPinsFor(fixture(), FID).some(p => p.id === "m_nogps_tagged"), "C2 mutation: an estimate for a no-GPS item is visible to A5");
  // C3: dropping the tagged-only filter is caught by A1.
  const untagged = PIN_SRC.replace("if (!m || !m.id || !m.artistId) continue;", "if (!m || !m.id) continue;");
  ok(untagged !== PIN_SRC && loadPins(untagged)._momentPinsFor(fixture(), FID).some(p => p.id === "m_gps_untagged"), "C3 mutation: untagged items pinning is visible to A1");
  // C4: dropping the festival filter is caught by A1.
  const anyFest = PIN_SRC.replace("if (festivalId && m.festivalId && m.festivalId !== festivalId) continue;", "");
  ok(anyFest !== PIN_SRC && loadPins(anyFest)._momentPinsFor(fixture(), FID).some(p => p.id === "m_other_fest"), "C4 mutation: another festival's items pinning is visible to A1");
}

console.log(`test-map-pins: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
