#!/usr/bin/env node
// Memories v2 — the organized-library contract.
//
// Guards four things the v2 spec calls out, against the REAL compiled code in
// build/spotify.js (a vm, same harness as test-memories-grouping.mjs) so this
// grades the shipped functions rather than a re-implementation of them:
//
//   1. PEAK SEMANTICS. The old `_peakWindow` returned only the observed
//      capture span while the card hardcoded "N moments in 20 minutes". Five
//      clips shot inside one minute were reported as twenty minutes of
//      events. The analysis window and the observed span are two numbers and
//      both must come back.
//
//   2. MEDIA-IDENTITY DEDUPE. Two RECORDS pointing at one piece of media must
//      not inflate a count or render twice — in the peak or in a set card.
//
//   3. NO DUPLICATE HERO. `_GroupHeroThumb` drew the cover, then the cover was
//      prepended to `orderedMoments` and drawn AGAIN as a full row. A set card
//      shows its best shot once.
//
//   4. REACHABILITY SURVIVES DEDUPE. #210's invariant is that every counted
//      record is reachable exactly once. Deduping for display must not turn a
//      duplicate record into a new orphan, so the records dropped from the
//      canonical list are kept in that group's `duplicates`.
//
// Fixtures come from REAL registry data (a live artist id, a real
// cross-festival id), never invented strings.
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
const S = vm.runInContext(
  `({ _buildLibraryDay, _filterLibraryDay, _peakWindow, _dedupeByMedia, _mediaIdentity,
      _dedupeLibrary, _libraryGroupChrome,
      _LIBRARY_FILTERS, _DATA_SETS, ARTISTS, FESTIVAL_CONFIG })`, ctx);

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── Harness positive control ───────────────────────────────────────────────
// Without this, a vm that never reached the shipped code would report every
// assertion below as a finding, and a dead harness would read as a row of
// real failures.
for (const fn of ["_buildLibraryDay", "_filterLibraryDay", "_peakWindow", "_dedupeByMedia", "_mediaIdentity"]) {
  if (typeof S[fn] !== "function") {
    console.log(`  ✗  HARNESS DEAD: ${fn} not reachable from build/spotify.js`);
    process.exit(1);
  }
}
const ARTISTS = (S.ARTISTS || []).filter(a => a.start);
const festIds = Object.keys(S._DATA_SETS || {});
if (ARTISTS.length < 2 || festIds.length < 2) {
  console.log(`  ✗  HARNESS DEAD: timed ARTISTS=${ARTISTS.length} festivals=${festIds.length}`);
  process.exit(1);
}

const activeId = S.FESTIVAL_CONFIG && S.FESTIVAL_CONFIG.id;
const A1 = ARTISTS[0], A2 = ARTISTS[1];
const otherFest = festIds.find(i => i !== activeId && (S._DATA_SETS[i].artists || []).length > 0);
const crossArtist = S._DATA_SETS[otherFest].artists[0];
check(!(S.ARTISTS || []).some(a => a.id === crossArtist.id),
  `fixture sanity: cross-festival id ${crossArtist.id} must be absent from the active lineup`);

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const T0 = Date.UTC(2026, 4, 16, 22, 0, 0);
const at = (secs) => new Date(T0 + secs * 1000).toISOString();

// ── 1. Peak semantics: window duration and observed span are different ─────
// Five captures inside ONE minute, looked at through a twenty-minute window.
const tight = [0, 10, 20, 30, 45].map((s, i) => ({
  id: `tight-${i}`, photoId: `p-tight-${i}`, artistId: A1.id, takenAt: at(s),
}));
const peak = S._peakWindow(tight, 20 * 60000);
check(!!peak, "peak: five clustered captures produce a peak window");
if (peak) {
  check(peak.windowMs === 20 * 60000,
    `peak: analysis window must be returned (got ${peak.windowMs})`);
  check(typeof peak.spanMs === "number" && peak.spanMs === 45000,
    `peak: observed capture span must be returned separately (expected 45000, got ${peak.spanMs})`);
  check(peak.spanMs < peak.windowMs,
    "peak: a 45-second burst must NOT report the analysis window as its span");
  check(peak.items.length === 5, `peak: counts every unique capture (got ${peak.items.length})`);
}

// ── 2. Dedupe by stable media identity ─────────────────────────────────────
// Same `_fingerprint` on two records — the app's own duplicate key.
const dupPair = [
  { id: "rec-a", photoId: "blob-a", _fingerprint: "fp_1234_img_5484.heic", artistId: A1.id, takenAt: at(0) },
  { id: "rec-b", photoId: "blob-b", _fingerprint: "fp_1234_img_5484.heic", artistId: A1.id, takenAt: at(5) },
];
check(S._mediaIdentity(dupPair[0]) === S._mediaIdentity(dupPair[1]),
  "dedupe: two records sharing a fingerprint share one media identity");
const deduped = S._dedupeByMedia(dupPair);
check(deduped.length === 1, `dedupe: collapses to one canonical record (got ${deduped.length})`);
check(deduped[0].id === "rec-a", "dedupe: first record in capture order is canonical");
check(deduped.duplicateCount === 1, `dedupe: reports the duplicate count (got ${deduped.duplicateCount})`);

// A duplicate must not inflate the peak. Three unique + one duplicate = 3.
const peakDupes = S._peakWindow([
  ...[0, 10, 20].map((s, i) => ({ id: `u-${i}`, photoId: `pu-${i}`, _fingerprint: `fp_1_u${i}.jpg`, takenAt: at(s) })),
  { id: "u-dup", photoId: "pu-dup", _fingerprint: "fp_1_u0.jpg", takenAt: at(12) },
], 20 * 60000);
check(peakDupes && peakDupes.items.length === 3,
  `dedupe: a duplicate record must not inflate the peak count (got ${peakDupes && peakDupes.items.length})`);

// ── 2b. One media identity, one tile — ACROSS groups, not just within ─────
// Dedupe keys on media identity; grouping partitions RECORDS. So two records
// holding the same photo can land in DIFFERENT groups — a re-import tagged to
// another artist, or a clip recovered onto another night beside the original.
// A per-group dedupe sees one copy per group, keeps it, draws it and counts
// it, and the same photo is on screen twice under a header that says one.
if (typeof S._dedupeLibrary !== "function") {
  check(false, "HARNESS DEAD: _dedupeLibrary not reachable from build/spotify.js");
} else {
  const SPLIT = "fp_split_one_photo.jpg";
  const split = [
    { id: "s-set",    photoId: "sp1", _fingerprint: SPLIT, artistId: A1.id,          takenAt: at(0)   },
    { id: "s-loose",  photoId: "sp2", _fingerprint: SPLIT, artistId: null,           takenAt: at(30)  },
    { id: "s-review", photoId: "sp3", _fingerprint: SPLIT, artistId: crossArtist.id, takenAt: at(60)  },
    { id: "s-other",  photoId: "sp4", _fingerprint: "fp_split_other.jpg", artistId: A1.id, takenAt: at(90) },
  ];
  // Control: without day-wide dedupe these DO land in three different groups.
  const naive = S._buildLibraryDay({ moments: split, attendedSet: new Set([A1.id]), artists: S.ARTISTS, toMin });
  check(naive.counts.moments === 4,
    `split control: ungrouped, the same photo really does reach 3 groups (got ${naive.counts.moments} — if this is 2 the fixture stopped exercising the bug)`);

  const lib = S._dedupeLibrary({ 1: split });
  check(lib.unique === 2,
    `split: the library counts one photo once, however many groups claim it (expected 2, got ${lib.unique})`);
  const dayS = S._buildLibraryDay({
    moments: lib.byNight[1], attendedSet: new Set([A1.id]), artists: S.ARTISTS, toMin,
    dupsFor: (id) => lib.dupsByCanonical.get(id) || [],
  });
  check(dayS.counts.moments === 2,
    `split: the day summary agrees with the library total (expected 2, got ${dayS.counts.moments})`);
  const drawn = dayS.groups.flatMap(g => g.media.map(m => m._fingerprint));
  check(drawn.filter(f => f === SPLIT).length === 1,
    `split: the photo is DRAWN exactly once across every group (got ${drawn.filter(f => f === SPLIT).length})`);
  // #210: a record in no group at all is an orphan. The losers stay attached
  // to the record that won, so nothing becomes unreachable.
  const reachable = new Set(dayS.groups.flatMap(g => [...g.media, ...g.duplicates].map(m => m.id)));
  for (const r of split) {
    check(reachable.has(r.id), `split: ${r.id} stays reachable (parked as a duplicate, never orphaned)`);
  }
  check(dayS.counts.duplicates === 2,
    `split: both losing records are accounted for (got ${dayS.counts.duplicates})`);
}

// ── 2c. Evidence outranks a guess for the SAME media, in either order ─────
// Deduping picks ONE record to speak for a piece of media. When the losing
// record was chosen by array order alone, the answer to "is this confirmed?"
// depended on storage order: a photo held by an auto-archived guess
// (festivalAttribution:"unresolved") and by a capture-time-proven record read
// as CONFIRMED when the proof came first and as UNCONFIRMED when it did not —
// and the festival's own card, which dedupes and THEN drops guesses, threw the
// proof away with the guess and reported zero. Both orders are fixtures here
// because only one of them was ever broken.
if (typeof S._dedupeLibrary !== "function") {
  check(false, "HARNESS DEAD: _dedupeLibrary not reachable from build/spotify.js");
} else {
  const ORD = "fp_order_one_photo.jpg";
  const rec = (id, attribution) => ({
    id, photoId: id, _fingerprint: ORD, artistId: A1.id, takenAt: at(0),
    festivalId: activeId, festivalAttribution: attribution,
  });
  const guess = () => rec("o-guess", "unresolved");
  const proof = () => rec("o-proof", "capture-time");
  for (const [name, arr] of [["guess first", [guess(), proof()]], ["proof first", [proof(), guess()]]]) {
    const one = S._dedupeByMedia(arr);
    check(one.length === 1 && one[0].id === "o-proof",
      `order (${name}): the PROVEN record speaks for the media, not the earlier one (got ${one.map(m => m.id).join(",")})`);
    const lib = S._dedupeLibrary({ 1: arr });
    const kept = lib.byNight[1].map(m => m.id).join(",");
    check(lib.unique === 1 && kept === "o-proof",
      `order (${name}): the library keeps the proof and parks the guess (got "${kept}")`);
    const unconfirmed = Object.values(lib.byNight)
      .reduce((n, a) => n + a.filter(m => m.festivalAttribution === "unresolved").length, 0);
    check(unconfirmed === 0,
      `order (${name}): the header does not call proven media unconfirmed (got ${unconfirmed})`);
    check((lib.dupsByCanonical.get("o-proof") || []).map(m => m.id).join(",") === "o-guess",
      `order (${name}): the superseded guess stays reachable as a duplicate (#210)`);
  }
  // The winner is chosen across the whole library, then placed. A winner that
  // gets swapped in during the walk lands in the LOSING record's night, which
  // would file a photo under a night it was never captured on.
  for (const [name, all] of [
    ["guess on night 1", { 1: [guess()], 2: [proof()] }],
    ["proof on night 1", { 1: [proof()], 2: [guess()] }],
  ]) {
    const lib = S._dedupeLibrary(all);
    const where = Object.keys(lib.byNight).filter(n => lib.byNight[n].some(m => m.id === "o-proof")).join(",");
    const home = Object.keys(all).find(n => all[n][0].id === "o-proof");
    check(lib.unique === 1 && where === home,
      `order (${name}): the surviving record stays on its OWN night (expected ${home}, got "${where}")`);
  }
}

// ── 3/4. The library day: counts, one hero, reachability ───────────────────
const attended = new Set([A1.id, A2.id]);
const records = [
  // A1: three unique clips plus one duplicate of the first.
  { id: "a1-1", photoId: "b1", _fingerprint: "fp_9_one.jpg",   artistId: A1.id, takenAt: at(0)  },
  { id: "a1-2", photoId: "b2", _fingerprint: "fp_9_two.jpg",   artistId: A1.id, takenAt: at(60), favorite: true },
  { id: "a1-3", photoId: "b3", _fingerprint: "fp_9_three.jpg", artistId: A1.id, takenAt: at(120) },
  { id: "a1-dup", photoId: "b4", _fingerprint: "fp_9_one.jpg", artistId: A1.id, takenAt: at(180) },
  // A2: attended, filmed nothing.
  // Between Sets: genuinely unassigned.
  { id: "loose-1", photoId: "b5", _fingerprint: "fp_9_five.jpg", artistId: null, takenAt: at(240) },
  // Needs Review: tagged to a set THIS festival cannot resolve.
  { id: "cross-1", photoId: "b6", _fingerprint: "fp_9_six.jpg", artistId: crossArtist.id, takenAt: at(300) },
];
const day = S._buildLibraryDay({ moments: records, attendedSet: attended, artists: S.ARTISTS, toMin });

check(day.counts.sets === 2, `library: two attended sets in the spine (got ${day.counts.sets})`);
// 3 unique for A1 + 0 for A2 + 1 between + 1 review = 5 unique media.
check(day.counts.moments === 5,
  `library: header counts UNIQUE media, duplicate excluded (expected 5, got ${day.counts.moments})`);
check(day.counts.duplicates === 1, `library: the duplicate record is accounted for (got ${day.counts.duplicates})`);

const setA1 = day.sets.find(s => s.artistId === A1.id);
const setA2 = day.sets.find(s => s.artistId === A2.id);
check(!!setA1 && !!setA2, "library: both attended sets produce a bounded card");
check(setA2 && setA2.attendedOnly === true && setA2.count === 0,
  "library: an attended set with no media is a compact card, not an empty row");
check(setA1 && setA1.count === 3, `library: A1's card counts 3 unique clips (got ${setA1 && setA1.count})`);

// The hero is the cover, and is NOT also in the stack.
check(setA1 && setA1.hero && setA1.hero.id === "a1-2",
  "library: the favourite is picked as the cover");
check(setA1 && !setA1.stack.some(m => m.id === setA1.hero.id),
  "no duplicate hero: the cover must NOT reappear as a row in its own stack");
check(setA1 && setA1.stack.length === setA1.count - 1,
  `no duplicate hero: stack is every clip except the cover (got ${setA1 && setA1.stack.length})`);
check(setA1 && setA1.ordered.length === setA1.count && setA1.ordered[0].id === setA1.hero.id,
  "no duplicate hero: the lightbox order leads with the cover and counts it once");

// Needs Review stays distinct from Between Sets — #210's ruling, unchanged.
check(day.between.count === 1 && day.between.media[0].id === "loose-1",
  "library: Between Sets holds only truly unassigned media");
check(day.review.count === 1 && day.review.media[0].id === "cross-1",
  "library: an unresolvable set id goes to Needs Review, never Between Sets");
check(!day.between.media.some(m => m.id === "cross-1"),
  "library: Needs Review is NOT folded into Between Sets");

// Reachability: every RECORD lands somewhere exactly once.
const reached = [];
for (const g of day.groups) {
  for (const m of g.ordered) reached.push(m.id);
  for (const m of g.duplicates) reached.push(m.id);
}
const uniqueReached = new Set(reached);
check(reached.length === uniqueReached.size,
  `reachability: no record is reachable twice (${reached.length} slots, ${uniqueReached.size} records)`);
check(uniqueReached.size === records.length,
  `reachability: every record is reachable (expected ${records.length}, got ${uniqueReached.size})`);
// And the header cannot claim a number the groups do not contain.
const renderedUnique = day.groups.reduce((n, g) => n + g.count, 0);
check(renderedUnique === day.counts.moments,
  `reachability: header total === sum of rendered group totals (${day.counts.moments} vs ${renderedUnique})`);

// ── 5. Filters ─────────────────────────────────────────────────────────────
check(Array.isArray(S._LIBRARY_FILTERS) && S._LIBRARY_FILTERS.join(",") === "all,clips,sets,recaps",
  `filters: exactly All / Clips / Sets / Recaps (got ${S._LIBRARY_FILTERS})`);

const clips = S._filterLibraryDay(day, "clips");
check(!clips.sets.some(s => s.count === 0),
  "filter clips: an attended set with no media drops out");
check(clips.counts.moments === 5,
  `filter clips: still every unique clip (expected 5, got ${clips.counts.moments})`);
check(clips.groups.some(g => g.kind === "review"),
  "filter clips: a Needs Review clip is still a clip and stays reachable");

const sets = S._filterLibraryDay(day, "sets");
check(sets.groups.length === 2 && sets.groups.every(g => g.kind === "set"),
  `filter sets: the set spine only, zero-media sets included (got ${sets.groups.length})`);
check(sets.groups.some(g => g.artistId === A2.id),
  "filter sets: the attended-but-unfilmed set is present");

const recaps = S._filterLibraryDay(day, "recaps");
check(recaps.isEmpty && recaps.groups.length === 0,
  "filter recaps: per-day library renders nothing; recaps are a festival artifact");

const all = S._filterLibraryDay(day, "all");
check(all.counts.moments === day.counts.moments && all.groups.length === day.groups.length,
  "filter all: unchanged");

// ── 6. An empty day is empty ───────────────────────────────────────────────
const blank = S._buildLibraryDay({ moments: [], attendedSet: new Set(), artists: S.ARTISTS, toMin });
check(blank.isEmpty === true && blank.counts.moments === 0 && blank.counts.sets === 0,
  "empty day: no sets, no media and nothing to review reports isEmpty");

// ── 7. Needs Review copy says which fact is present (#216's strings) ─────
// Two facts share the group: a set tag this lineup can't resolve, and a
// festival stamp its own capture time contradicts (festivalReview). The
// title and note must name the one(s) present, and never claim the other.
{
  const rv = { festivalReview: { reason: "unproven-stamp" } };
  const g = (media, dup = []) => ({ kind: "review", media, duplicates: dup, count: media.length });
  const c = (grp) => S._libraryGroupChrome(grp);
  const setOnly = c(g([{ id: "a", artistId: "zz" }]));
  check(setOnly.title === "Set not in this festival" && setOnly.note === "Tagged to a set this festival doesn’t have — retag to file it.",
    `needs review, set tags only: unchanged copy — got ${JSON.stringify(setOnly)}`);
  const one = c(g([{ id: "b", ...rv }]));
  check(one.title === "Outside this festival’s dates" && one.note === "Its capture time doesn’t match this festival’s dates. We left it here.",
    `needs review, one festival conflict: singular date copy — got ${JSON.stringify(one)}`);
  const two = c(g([{ id: "b", ...rv }, { id: "c", ...rv }]));
  check(two.title === "Outside this festival’s dates" && two.note === "Their capture times don’t match this festival’s dates. We left them here.",
    `needs review, two festival conflicts: plural date copy — got ${JSON.stringify(two)}`);
  const mixed = c(g([{ id: "a", artistId: "zz" }, { id: "b", ...rv }]));
  check(mixed.title === "Check these clips" && mixed.note === "Some are tagged to a set this festival doesn’t have. Others were shot outside this festival’s dates.",
    `needs review, both facts: mixed copy — got ${JSON.stringify(mixed)}`);
  const dupMixed = c(g([{ id: "a", artistId: "zz" }], [{ id: "b", ...rv }]));
  check(dupMixed.title === "Check these clips",
    `needs review: a festival conflict held only as a duplicate record still counts as present — got ${JSON.stringify(dupMixed)}`);
}

if (failed) { console.log(`\n  ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} checks`);
