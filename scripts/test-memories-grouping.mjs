#!/usr/bin/env node
// Regression: every moment the Memories TIMELINE lens COUNTS must be
// REACHABLE, exactly once, in exactly one rendered group.
//
// THE BUG THIS EXISTS FOR (live on main before this gate):
//   `_groupNightMoments` puts every truthy `artistId` into `byArtist`, then
//   filters the spine to ids present in the ACTIVE festival's ARTISTS. Only a
//   FALSEY artistId reaches `untagged`. So a moment tagged to an artist id the
//   active festival does not know — a stale id, a deleted set, a moment
//   carried over from another festival — lands in neither group and renders
//   NOWHERE, while the day header's "N MOMENTS" and the peak window still
//   count it. The header reads 7; five are reachable.
//
// Runs the REAL compiled code (build/spotify.js) in a vm, the same way
// test-live-set-checkin.mjs does, so this grades the shipped function rather
// than a re-implementation of it.
//
// Fixtures required by the spec: active artist, missing artist, null artist,
// stage-only, and a MIGRATED CROSS-FESTIVAL id taken from a real other
// festival in _DATA_SETS (not an invented string).
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
const store = {};
const ctx = {
  console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
  document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
              createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
  React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
  ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
  CustomEvent: function CustomEvent() {},
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
vm.createContext(ctx);
vm.runInContext(MODS, ctx);
for (const n of ["data", "photo-tag", "spotify"]) {
  vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
}
const S = vm.runInContext(`({ _groupNightMoments, _DATA_SETS, ARTISTS, FESTIVAL_CONFIG })`, ctx);

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── Harness positive control ───────────────────────────────────────────────
// If the vm did not actually reach the shipped code, every reachability
// assertion below would "fail" for the wrong reason and a dead harness would
// masquerade as a row of real findings.
if (typeof S._groupNightMoments !== "function") {
  console.log("  ✗  HARNESS DEAD: _groupNightMoments not reachable from build/spotify.js");
  process.exit(1);
}
const ARTISTS = S.ARTISTS || [];
const festIds = Object.keys(S._DATA_SETS || {});
if (!ARTISTS.length || festIds.length < 2) {
  console.log(`  ✗  HARNESS DEAD: ARTISTS=${ARTISTS.length} festivals=${festIds.length}`);
  process.exit(1);
}

// ── Fixtures, from REAL registry data ──────────────────────────────────────
const activeId = S.FESTIVAL_CONFIG && S.FESTIVAL_CONFIG.id;
const active = ARTISTS.find(a => a.start) || ARTISTS[0];
const otherFest = festIds.find(i => i !== activeId && (S._DATA_SETS[i].artists || []).length > 0);
const crossArtist = S._DATA_SETS[otherFest].artists[0];
check(!ARTISTS.some(a => a.id === crossArtist.id),
  `fixture sanity: cross-festival id ${crossArtist.id} must be absent from the active lineup`);

const moments = [
  { id: "m-active",  artistId: active.id },                    // tagged to a live set
  { id: "m-missing", artistId: "artist-that-does-not-exist" }, // stale/deleted id
  { id: "m-null",    artistId: null },                         // untagged
  { id: "m-stage",   artistId: null, stageId: "some-stage" },  // stage-only, still untagged
  { id: "m-cross",   artistId: crossArtist.id },               // MIGRATED cross-festival id
];
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };

const groups = S._groupNightMoments({
  moments, attendedSet: new Set([active.id]), artists: ARTISTS, toMin,
});

// What the page actually RENDERS: the spine's moments, the Between-sets pile,
// and (after the fix) the recoverable Needs Review group. Reading
// `needsReview` optionally is deliberate — it lets this same test fail before
// the fix and pass after it, without being rewritten in between.
const rendered = [
  ...groups.spineIds.flatMap(id => groups.byArtist.get(id) || []),
  ...(groups.untagged || []),
  ...(groups.needsReview || []),
];
const renderedIds = rendered.map(m => m.id);
const uniq = new Set(renderedIds);

// ── Positive control: a normal tagged moment IS reachable ──────────────────
// Without this, a harness that reported EVERYTHING unreachable would look
// like five true findings instead of one broken test.
check(uniq.has("m-active"), "positive control: a moment tagged to a live set is reachable");

// ── The three-way identity the spec requires ───────────────────────────────
check(renderedIds.length === uniq.size,
  `no duplicate cards: ${renderedIds.length} rendered vs ${uniq.size} unique (${renderedIds.join(",")})`);
check(uniq.size === moments.length,
  `header total ${moments.length} === reachable unique ${uniq.size} — unreachable: ` +
  `[${moments.map(m => m.id).filter(id => !uniq.has(id)).join(", ") || "none"}]`);

for (const m of moments) {
  const n = renderedIds.filter(x => x === m.id).length;
  check(n === 1, `${m.id}: rendered exactly once (actually ${n})`);
}

// ── Provenance: a stale id is NOT silently relabelled as Between Sets ───────
// Spec item 6: "A stale/missing artist id is not automatically Between Sets;
// show it as Needs Review so provenance is not lost."
const untaggedIds = (groups.untagged || []).map(m => m.id);
check(!untaggedIds.includes("m-missing") && !untaggedIds.includes("m-cross"),
  `stale ids must not be dumped into Between Sets (untagged = [${untaggedIds.join(", ")}])`);

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED — counted moments are unreachable in the timeline.`);
  process.exit(1);
}
console.log(`  ✓ memories grouping: ${checks} checks — every counted moment reachable exactly once`);
console.log(`    fixtures: active=${active.id} cross=${crossArtist.id} (from ${otherFest}) active festival=${activeId}`);
