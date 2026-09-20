#!/usr/bin/env node
// General Landing + Saved Festivals — the state contract.
//
// The failure this guards against is one festival's state leaking into
// another's screen. Three stores have to stay apart:
//
//   SAVED  (plursky_saved_festivals_v1)  — an explicit list the user built
//   ACTIVE (active_festival_id)          — which festival the scoped screens show
//   LANDED (root routing)                — whether this load shows General Home
//
// Collapse any pair and you get the behaviour this wave removes: the app
// opening a festival you did not choose, or a landing card counting memories
// that belong to a different weekend.
//
// Runs the REAL compiled build/landing.js in a vm, the same harness the other
// Memories gates use, so this grades the shipped functions.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const noop = () => {};
const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                    classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
const store = {}, session = {};
const ctx = {
  console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  sessionStorage: { getItem: k => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: k => { delete session[k]; } },
  navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
  document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
              createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
  React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
  ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
  CustomEvent: function CustomEvent(type) { this.type = type; },
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
vm.createContext(ctx);
vm.runInContext(MODS, ctx);
for (const n of ["data", "photo-tag", "landing", "spotify"]) {
  vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
}
const S = vm.runInContext(
  `({ readSavedFestivals, writeSavedFestivals, isFestivalSaved, saveFestival, unsaveFestival,
      toggleSavedFestival, runLandingMigration, landingShouldOpenGeneral,
      momentsForFestival, unattributedMoments, festivalMemoryCount,
      readFestivalView, writeFestivalView, _landingFestivalState,
      _sortFestivalsForSwitcher, _festivalPhase,
      FESTIVALS_REGISTRY, FESTIVAL_CONFIG, _DATA_SETS })`, ctx);

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── Harness positive control ───────────────────────────────────────────────
for (const fn of ["readSavedFestivals", "saveFestival", "unsaveFestival", "runLandingMigration",
                  "landingShouldOpenGeneral", "momentsForFestival", "festivalMemoryCount"]) {
  if (typeof S[fn] !== "function") {
    console.log(`  ✗  HARNESS DEAD: ${fn} not reachable from build/landing.js`);
    process.exit(1);
  }
}
const registry = (S.FESTIVALS_REGISTRY || []).filter(f => f && f.config && f.config.id);
if (registry.length < 5) {
  console.log(`  ✗  HARNESS DEAD: registry has ${registry.length} entries`);
  process.exit(1);
}
const activeId = S.FESTIVAL_CONFIG && S.FESTIVAL_CONFIG.id;
const otherId = registry.map(f => f.config.id).find(id => id !== activeId);
check(!!activeId && !!otherId, "fixture sanity: an active festival and a second festival exist");

// ── 1. Saved is EXPLICIT, versioned, and separate from active ──────────────
check(S.readSavedFestivals().length === 0,
  "saved: a fresh install has no saved festivals");
// Nothing about being the ACTIVE festival makes a festival saved.
store["active_festival_id"] = activeId;
check(S.isFestivalSaved(activeId) === false,
  "saved != active: the active festival is NOT saved just by being active");
// Nor do saved artists / archives / last-opened imply it.
store["plursky_saved_v1"] = JSON.stringify(["some-artist"]);
store["plursky_last_festival_id"] = activeId;
store["plursky_festival_archive_v1"] = JSON.stringify({ [activeId]: { totalAttended: 4 } });
check(S.isFestivalSaved(activeId) === false,
  "saved is never INFERRED from saved artists, archive rows or last-opened");

S.saveFestival(otherId);
check(S.isFestivalSaved(otherId) === true, "saved: an explicit save persists");
check(store["active_festival_id"] === activeId,
  "saving does not change the ACTIVE festival");
check(S.readSavedFestivals().length === 1 && !S.isFestivalSaved(activeId),
  "saving one festival does not save another");
// Versioned shape, so a later migration can tell a shape change from corruption.
const rawSaved = JSON.parse(store["plursky_saved_festivals_v1"]);
check(rawSaved && rawSaved.v === 1 && Array.isArray(rawSaved.ids),
  `saved: stored as a versioned { v, ids } record (got ${store["plursky_saved_festivals_v1"]})`);
// Idempotent, and unsave is clean.
S.saveFestival(otherId); S.saveFestival(otherId);
check(S.readSavedFestivals().length === 1, "saved: saving twice does not duplicate a row");
S.unsaveFestival(otherId);
check(S.isFestivalSaved(otherId) === false && S.readSavedFestivals().length === 0,
  "saved: unsave removes it");
check(store["active_festival_id"] === activeId,
  "unsaving does not change the ACTIVE festival");
S.toggleSavedFestival(otherId);
check(S.isFestivalSaved(otherId) === true, "saved: toggle saves an unsaved festival");
S.toggleSavedFestival(otherId);
check(S.isFestivalSaved(otherId) === false, "saved: toggle unsaves a saved festival");
// A corrupt value reads as empty, never as a crash or a phantom row.
store["plursky_saved_festivals_v1"] = "{not json";
check(S.readSavedFestivals().length === 0, "saved: a corrupt value degrades to empty");
delete store["plursky_saved_festivals_v1"];

// ── 2. The ONE migration auto-saves nothing ───────────────────────────────
delete store["plursky_landing_migrated_v1"];
store["active_festival_id"] = activeId;
const mig = S.runLandingMigration();
check(mig.ran === true, "migration: runs once on an unmigrated install");
check(Array.isArray(mig.autoSaved) && mig.autoSaved.length === 0,
  `migration: auto-saves NOTHING (got ${JSON.stringify(mig.autoSaved)})`);
check(S.readSavedFestivals().length === 0,
  "migration: the old active festival does NOT become a saved festival");
check(store["active_festival_id"] === activeId,
  "migration: the old active festival id is preserved as continuity input");
check(S.runLandingMigration().ran === false,
  "migration: does not run a second time");

// ── 3. Root routing ───────────────────────────────────────────────────────
const P = (qs) => new URLSearchParams(qs);
check(S.landingShouldOpenGeneral(P("")) === true,
  "routing: a plain launch with no deep link shows General Home");
check(S.landingShouldOpenGeneral(P("utm_source=x&fbclid=y")) === true,
  "routing: tracking params are not a destination");
for (const [qs, why] of [
  ["f=acl-2026", "?f= enters the named festival"],
  ["festival=acl-2026", "?festival= enters the named festival"],
  ["artist=k9", "?artist= is a destination"],
  ["tab=memories", "?tab= is a destination"],
  ["stage=kinetic", "?stage= is a destination"],
  ["crew=ABC123", "?crew= is a destination"],
  ["lineup=k9,k11", "?lineup= is a destination"],
]) {
  check(S.landingShouldOpenGeneral(P(qs)) === false, `routing: ${why}`);
}
// A stored active festival is NOT a destination — this is the whole wave.
store["active_festival_id"] = activeId;
store["active_festival_explicit"] = "1";
check(S.landingShouldOpenGeneral(P("")) === true,
  "routing: a stored active festival does NOT keep auto-opening that festival");

// ── 4. Exact-festival memory counts ───────────────────────────────────────
const all = {
  1: [
    { id: "a", photoId: "p1", _fingerprint: "fp_1_a.jpg", festivalId: activeId },
    { id: "b", photoId: "p2", _fingerprint: "fp_1_b.jpg", festivalId: activeId },
    // Same media, two records — must count once.
    { id: "b2", photoId: "p3", _fingerprint: "fp_1_b.jpg", festivalId: activeId },
    { id: "c", photoId: "p4", _fingerprint: "fp_1_c.jpg", festivalId: otherId },
    // Legacy, unstamped. Belongs to NOBODY until it is attributed.
    { id: "d", photoId: "p5", _fingerprint: "fp_1_d.jpg" },
  ],
};
check(S.momentsForFestival(all, activeId).length === 3,
  `counts: exact festivalId match only (got ${S.momentsForFestival(all, activeId).length})`);
check(S.momentsForFestival(all, otherId).length === 1,
  "counts: the other festival gets its own one record");
check(!S.momentsForFestival(all, activeId).some(m => m.id === "d"),
  "counts: an UNSTAMPED legacy moment is never attributed to a festival card");
check(S.unattributedMoments(all).length === 1 && S.unattributedMoments(all)[0].id === "d",
  "counts: the unstamped moment is surfaced separately, not dropped");
check(S.festivalMemoryCount(activeId, all) === 2,
  `counts: the card shows UNIQUE media, deduped (expected 2, got ${S.festivalMemoryCount(activeId, all)})`);
check(S.festivalMemoryCount(otherId, all) === 1,
  "counts: no cross-festival leakage into the other card");
// The last-festival pointer must not make an unstamped record count anywhere.
store["plursky_last_festival_id"] = activeId;
check(S.festivalMemoryCount(activeId, all) === 2,
  "counts: the last-festival pointer does not let an unstamped record inflate a card");
check(S.festivalMemoryCount("a-festival-that-does-not-exist", all) === 0,
  "counts: an unknown festival counts zero, never a fallback total");

// ── 5. Per-festival view state is per festival ────────────────────────────
S.writeFestivalView(activeId, { filter: "clips", scroll: 420, collapsed: [2] });
S.writeFestivalView(otherId, { filter: "sets", scroll: 0 });
check(S.readFestivalView(activeId).filter === "clips" && S.readFestivalView(activeId).scroll === 420,
  "view state: a festival's filter and scroll survive a return to General Home");
check(S.readFestivalView(otherId).filter === "sets",
  "view state: two festivals never share a filter");
check(S.readFestivalView(activeId).collapsed.join(",") === "2",
  "view state: day-collapse survives");
check(S.isFestivalSaved(activeId) === false && S.isFestivalSaved(otherId) === false,
  "view state: remembering where you were does NOT implicitly save the festival");

// ── 6. Browse covers every registry entry exactly once ────────────────────
const now = Date.now();
const ordered = S._sortFestivalsForSwitcher(registry, now);
check(ordered.length === registry.length,
  `browse: ordering keeps every registry entry (${registry.length} in, ${ordered.length} out)`);
const seen = new Set(ordered.map(f => f.config.id));
check(seen.size === registry.length,
  `browse: every entry appears EXACTLY once (${seen.size} unique of ${registry.length})`);
const phases = ["live", "upcoming", "tba", "ended"];
const binned = phases.reduce((n, p) => n + ordered.filter(f => S._festivalPhase(f, now) === p).length, 0);
check(binned === registry.length,
  `browse: the four phase groups partition the registry (${binned} of ${registry.length})`);

// ── 7. A landing row makes no source-unsafe claim ─────────────────────────
// No distance, ETA, set time or availability claim may reach a landing card.
const banned = /\bmin\b|\bwalk|\bETA\b|\baway\b|\bmiles?\b|\bkm\b/i;
let claims = 0;
for (const f of registry) {
  const st = S._landingFestivalState(f, now);
  if (banned.test(st.label)) { claims++; console.log(`  ✗  landing row for ${f.config.id} claims "${st.label}"`); }
}
check(claims === 0, "landing rows make no distance/walk/ETA claim");
const gated = registry.find(f => !f.available && !f.previewOnly);
if (gated) {
  const st = S._landingFestivalState(gated, now);
  check(st.locked === true, `landing: a gated festival (${gated.config.id}) is locked, not enterable`);
  check(!/happening now/i.test(st.label), "landing: a gated festival never reads as live");
}

if (failed) { console.log(`\n  ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} checks`);
