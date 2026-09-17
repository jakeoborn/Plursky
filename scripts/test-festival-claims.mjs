#!/usr/bin/env node
// Gate: a festival page may not claim a capability the data behind that page
// does not prove.
//
// THE DEFECT CLASS THIS EXISTS FOR:
//   `stagesSection()` emitted one sentence on all 15 stage-bearing pages —
//   "The Plursky app carries a live map of <venue> with every stage, water
//   station and amenity." That is THREE claims, and the fleet supports none of
//   them uniformly:
//     • "a live map"    — geometryVerifiedFor() is true for 3 festivals, not 15.
//                         ACL is deliberately blind; its stage coordinates are
//                         poster art (src:"poster"), which the predicate refuses
//                         as evidence.
//     • "water station" — 6 stage-bearing festivals carry ZERO amenities.
//     • "amenity"       — the same 6, and the section renders no amenity list.
//   A rendered stage list proves the stage list. Nothing more.
//
// The map rule is checked against map.jsx's OWN predicate, loaded from the
// compiled build, rather than a copy of its logic. verify.mjs already warns what
// happens when one number lives in two places: "one number, two copies, already
// drifted". There is exactly one geometryVerifiedFor in this repo and this gate
// asks it.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const F_DIR = join(ROOT, 'f');

let checks = 0, failed = 0;
const fail = (msg) => { checks++; failed++; console.log(`  ✗  ${msg}`); };
const ok = () => { checks++; };

const decode = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Visible text only: scripts (and their JSON-LD) stripped, tags removed. A claim
// hiding in markup is still a claim, but a claim in JSON-LD is the FAQ gate's
// business; this gate is about what a reader sees.
const visibleText = (html) => decode(
  html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
).replace(/\s+/g, ' ').trim();

// ── Load the real predicate from the compiled build ───────────────────────
// Same shim verify.mjs uses. If the build is stale or missing we FAIL rather
// than skip: a gate that quietly checks nothing is worse than no gate.
function loadBrowser() {
  const need = ['build/data.js', 'build/home.js', 'build/map.js'];
  const missing = need.filter(f => !existsSync(join(ROOT, f)));
  if (missing.length) {
    console.log(`  ✗  HARNESS DEAD: missing ${missing.join(', ')} — run node scripts/build.mjs`);
    process.exit(1);
  }
  const noop = () => {};
  const store = {};
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Date, Math, JSON, Object, Array,
    String, Number, Boolean, Set, Map, isNaN, parseInt, parseFloat, isFinite,
    Promise, RegExp, Symbol, Error,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    fetch: () => new Promise(noop), URLSearchParams, location: { search: '' },
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { userAgent: 'node', geolocation: {} },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} },
                createElement: () => ({ style: {}, setAttribute: noop }), getElementById: () => null,
                querySelector: () => null, head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }) },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.window.addEventListener = noop; ctx.window.removeEventListener = noop;
  ctx.window.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  const mods = execFileSync('git', ['ls-files', 'data/festivals/*.js'], { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean)
    .map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  vm.runInContext(mods, ctx);
  for (const f of need) vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx);
  return ctx;
}

const wc = loadBrowser();
if (typeof wc.geometryVerifiedFor !== 'function') {
  console.log('  ✗  HARNESS DEAD: map.jsx must expose geometryVerifiedFor — this gate would check nothing');
  process.exit(1);
}
const DS = wc._DATA_SETS || {};
if (!Object.keys(DS).length) {
  console.log('  ✗  HARNESS DEAD: _DATA_SETS is empty in the vm');
  process.exit(1);
}

if (!existsSync(F_DIR)) {
  console.log('  ✗  HARNESS DEAD: f/ does not exist — run node scripts/gen-festival-pages.mjs');
  process.exit(1);
}
const pages = readdirSync(F_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(F_DIR, d.name, 'index.html')))
  .map(d => d.name).sort();
if (pages.length < 5) {
  console.log(`  ✗  HARNESS DEAD: only ${pages.length} pages found`);
  process.exit(1);
}

// ── Control: the predicate must DISCRIMINATE ──────────────────────────────
// If geometryVerifiedFor were false for every festival, the map rule below
// would pass forever by being unsatisfiable, and would keep passing if the
// whole feature died. Assert both answers exist in the fleet.
const stageBearing = Object.entries(DS).filter(([, ds]) => (ds.stages || []).length);
const verifiedIds = stageBearing.filter(([fid]) => wc.geometryVerifiedFor(fid)).map(([fid]) => fid);
const blindIds = stageBearing.filter(([fid]) => !wc.geometryVerifiedFor(fid)).map(([fid]) => fid);
if (!verifiedIds.length || !blindIds.length) {
  fail(`geometryVerifiedFor does not discriminate (verified=${verifiedIds.length} blind=${blindIds.length}) — the map rule would be vacuous`);
} else ok();

// ── Claim patterns ────────────────────────────────────────────────────────
// Each is a claim about a CAPABILITY or COVERAGE, not about the rendered list.
// ── The one exemption, and why it is keyed to EXACT TEXT ──────────────────
// Every festival page carries a product note listing what the APP does. It
// names no venue and asserts nothing about this festival's geometry, which is
// a different kind of statement from "a live map of <venue> with every stage".
// It is exempted by its exact string — never by a loosened pattern — because a
// pattern carve-out silently grows to cover whatever someone writes next. A
// control below fails if this sentence stops appearing on every page, so a copy
// change forces the exemption to be re-ruled rather than quietly inherited.
//
// ⚠ OPEN FOR RULING: this note still says "find stages on a live map" on all 25
// pages, 10 of which are preview entries with no stages at all. That is
// audience-facing product copy, so it is Jake's call, not this gate's.
// TWO sanctioned variants. The map clause is itself a claim, so it rides only
// on a festival whose data can actually place its stages on a map — map art
// plus every stage carrying coordinates. map.jsx falls back to the SVG
// TopDownMap, which with no placed stages "would render an empty plate with no
// stages and no art" (map.jsx:1933).
const PRODUCT_NOTE_MAP = 'Plursky is a free festival companion — build a personal schedule from the official lineup, find stages on a live map, meet your crew, and turn the weekend into a shareable recap.';
const PRODUCT_NOTE_PLAIN = 'Plursky is a free festival companion — build a personal schedule from the official lineup, meet your crew, and turn the weekend into a shareable recap.';

const MAP_CLAIMS = [
  /\blive map\b/i,
  /\bcarries a .{0,12}map\b/i,
  /\bmap of\b/i,
  /\bmapped in the Plursky app\b/i,
];
const WATER_CLAIMS = [/\bwater station/i, /\bwater point/i];
const AMENITY_CLAIMS = [/\bamenit/i];
const EVERY_STAGE_CLAIMS = [/\bevery stage\b/i, /\ball stages\b/i];

let noteMapSeen = 0, notePlainSeen = 0;
for (const id of pages) {
  const raw = visibleText(readFileSync(join(F_DIR, id, 'index.html'), 'utf8'));
  const dsCfg = (DS[id] || {}).config || {};
  const dsStages = (DS[id] || {}).stages || [];
  const placed = dsStages.filter(s => s && s.x != null && s.y != null).length;
  const mapBacked = dsStages.length > 0 && placed === dsStages.length
    && !!(dsCfg.mapImage || dsCfg.mapMode);

  const hasMapNote = raw.includes(PRODUCT_NOTE_MAP);
  const hasPlainNote = raw.includes(PRODUCT_NOTE_PLAIN);
  if (hasMapNote) noteMapSeen++;
  if (hasPlainNote) notePlainSeen++;

  // Exactly one sanctioned variant, always. Neither means the copy drifted;
  // both is impossible unless the strings overlap and the exemption is leaking.
  if (hasMapNote === hasPlainNote) {
    fail(`${id}: expected exactly ONE sanctioned product-note variant — map=${hasMapNote} plain=${hasPlainNote}`);
  } else ok();

  // The map clause is a claim about THIS festival, so it has to be backed here.
  if (hasMapNote && !mapBacked) {
    fail(`${id}: product note says "find stages on a live map" but ${placed}/${dsStages.length} stages carry coordinates and mapArt=${!!(dsCfg.mapImage || dsCfg.mapMode)}`);
  } else ok();

  // Strip whichever variant this page carries BEFORE scanning, so any remaining
  // map/amenity language is a claim the page makes on its own account.
  const text = raw.split(PRODUCT_NOTE_MAP).join(' ').split(PRODUCT_NOTE_PLAIN).join(' ');
  const ds = DS[id] || {};
  const stages = ds.stages || [];
  const amenities = ds.amenities || [];
  const water = amenities.filter(a => a && a.type === 'water').length;
  const verified = stages.length ? !!wc.geometryVerifiedFor(id) : false;

  const hit = (pats) => pats.find(p => p.test(text));

  const mapHit = hit(MAP_CLAIMS);
  if (mapHit) {
    if (!verified) fail(`${id}: claims a map (${mapHit}) but geometryVerifiedFor(${id}) is FALSE — the geometry behind it is unverified`);
    else ok();
  } else ok();

  const waterHit = hit(WATER_CLAIMS);
  if (waterHit) {
    if (!water) fail(`${id}: claims water stations (${waterHit}) but the festival data carries ${water} of them`);
    else ok();
  } else ok();

  const amenHit = hit(AMENITY_CLAIMS);
  if (amenHit) {
    if (!amenities.length) fail(`${id}: claims amenities (${amenHit}) but the festival data carries an EMPTY amenity array`);
    else ok();
  } else ok();

  // "every stage" is a COVERAGE claim: it says our list is complete and, when
  // paired with a map, that each one is placed. Only allow it where every stage
  // actually carries coordinates AND the geometry is verified.
  const everyHit = hit(EVERY_STAGE_CLAIMS);
  if (everyHit) {
    const withCoords = stages.filter(s => s && s.x != null && s.y != null).length;
    if (!verified || withCoords !== stages.length) {
      fail(`${id}: claims "${everyHit}" but verified=${verified} and ${withCoords}/${stages.length} stages carry coordinates`);
    } else ok();
  } else ok();
}

// ── Control: the exemption must stay exactly as narrow as it was ruled ────
// If the product note is edited, this fires. That is deliberate: the sentence
// was exempted on the strength of what it says, so different words need a
// fresh ruling rather than an inherited pass.
if (noteMapSeen + notePlainSeen !== pages.length) {
  fail(`product note matched on ${noteMapSeen + notePlainSeen}/${pages.length} pages — the exemption is keyed to exact text, so a changed sentence must be re-ruled, not silently exempted`);
} else ok();

// Discrimination control, same reasoning as the geometry predicate: if every
// page carried the same variant, the map-backing rule would be unexercised and
// would pass just as happily if the conditional were deleted.
if (!noteMapSeen || !notePlainSeen) {
  fail(`the product-note rule does not discriminate (map=${noteMapSeen} plain=${notePlainSeen}) — one branch is UNEXERCISED and therefore unproven`);
} else ok();

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED — a page claims a capability its data does not prove.`);
  process.exit(1);
}
console.log(`  ✓ festival claims: ${checks} checks across ${pages.length} pages — map, water, amenity and coverage claims all backed by festival data (geometry verified: ${verifiedIds.length}, blind: ${blindIds.length})`);
