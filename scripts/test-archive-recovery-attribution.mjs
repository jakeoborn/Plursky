#!/usr/bin/env node
// Regression: a video recovered from the archive must take its festival — and
// its night — from its OWN capture time, not from whichever festival is on
// screen.
//
// THE BUG THIS EXISTS FOR (measured on main 682d15f, before this gate):
//   _recoverCurrentVideoMomentsFromArchive() pulls a fingerprint-matched video
//   out of the archive, COPIES the archived record's real takenAt onto it
//   (spotify.jsx:7651) — and then ignores that evidence three times over:
//
//     :7644  needsRecovery is judged by _photoFestivalNight(parsed) with no
//            config, which falls back to window.FESTIVAL_CONFIG. A clip from any
//            other festival is unplaceable by the ACTIVE one, so it always looks
//            broken and always "needs recovery".
//     :7654  recoveredNight is computed the same active-festival-only way, so
//            the night bucket inherits the assumption.
//     :7660  `if (!m.festivalId) m.festivalId = cur;` — the attribution itself.
//
//   Reproduced with acl-2026 active: a clip whose recovered takenAt is claimed
//   by edc-lv-2026 AND NOTHING ELSE was stamped `acl-2026`, with
//   festivalAttribution null — not a declared guess, a fact-shaped stamp.
//
//   One precision, because the charge matters: the lookup searches only
//   archive[cur].moments, so `= cur` PROPAGATES the archive bucket's prior
//   attribution rather than inventing a fresh one. That bucket was filled by
//   whichever festival was on screen, which #213 established is not evidence.
//
// THE RULE: capture-time evidence, or a DECLARED unresolved. Never a guess
// wearing the shape of evidence.
//
// Runs build/spotify.js in a vm so this grades the SHIPPED function.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEST_DIR = join(ROOT, "data", "festivals");
const MODS = readdirSync(FEST_DIR).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(FEST_DIR, f), "utf8")).join("\n");

const MOMENTS_KEY = "plursky_moments_v1";
const ARCHIVE_KEY = "plursky_festival_archive_v1";

function boot(seed = {}) {
  const noop = () => {};
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = { ...seed };
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, Date, Math, JSON,
    location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
    indexedDB: { open: () => ({}) },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  for (const n of ["data", "photo-tag", "spotify"]) {
    vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
  }
  return { ctx, store, run: (src) => vm.runInContext(src, ctx) };
}

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
function dead(msg) { console.log(`  ✗  HARNESS DEAD: ${msg}`); process.exit(1); }

const ACTIVE = "acl-2026";
const REAL   = "edc-lv-2026";       // where the cross-festival clip was shot
const AMBIG  = "portola-2026";      // shares its weekend with crssd-fall-2026

// A takenAt string built from dayDates {y, m (0-based), d}. Epoch-free: no
// parsing and no timezone guessed on the test's side.
const pad = (v) => String(v).padStart(2, "0");
function takenAtForNight(cfg, night) {
  const x = cfg?.dayDates?.[night];
  return x ? `${x.y}-${pad(x.m + 1)}-${pad(x.d)} 22:00` : null;
}
const firstNight = (cfg) => Object.keys(cfg?.dayDates || {}).map(Number).sort((a, b) => a - b)[0];
const lastNight  = (cfg) => Object.keys(cfg?.dayDates || {}).map(Number).sort((a, b) => a - b).pop();

const probe = boot();
const DS = probe.run("_DATA_SETS") || {};
const REG = probe.run("FESTIVALS_REGISTRY || []") || [];
if (Object.keys(DS).length < 15) dead(`_DATA_SETS has ${Object.keys(DS).length} entries — festival modules did not load`);
if (REG.length < 20) dead(`registry has ${REG.length} rows — festival modules did not load`);
if (probe.run("typeof _recoverCurrentVideoMomentsFromArchive") !== "function") dead("recovery fn not reachable from build/spotify.js");
if (probe.run("typeof _festivalClaimantsFor") !== "function") dead("_festivalClaimantsFor not reachable — wrong base?");

const cfgOf = (id) => DS[id]?.config || {};
const pfn = probe.run("_photoFestivalNight");
const partsOf = probe.run("_momentTakenAtToDateParts");
const claimants = (takenAt) => {
  if (!takenAt) return [];
  const d = partsOf(takenAt);
  return Object.keys(DS).filter(id => pfn(d, cfgOf(id), null) != null);
};

// ── Fixture instants ──────────────────────────────────────────────────────
// The cross-festival clip uses REAL's LAST night, not its first. That is the
// discriminator for the night bucket: the archived record carries no `night`,
// so the old code falls through to _photoFestivalNight(recoveredDate) against
// the ACTIVE festival, gets null, and keeps the seeded (wrong) bucket. A fixture
// on night 1 would let a broken night computation pass by coincidence.
const NIGHT_REAL = lastNight(cfgOf(REAL));
const T_CROSS = takenAtForNight(cfgOf(REAL), NIGHT_REAL);
const T_ACTIVE = takenAtForNight(cfgOf(ACTIVE), firstNight(cfgOf(ACTIVE)));
const T_AMBIG = takenAtForNight(cfgOf(AMBIG), firstNight(cfgOf(AMBIG)));
for (const [k, v] of Object.entries({ T_CROSS, T_ACTIVE, T_AMBIG })) if (!v) dead(`fixture ${k} is ${v} — dayDates shape changed`);

// ── Fixture premises, asserted rather than assumed ────────────────────────
const cCross = claimants(T_CROSS), cActive = claimants(T_ACTIVE), cAmbig = claimants(T_AMBIG);
if (!(cCross.length === 1 && cCross[0] === REAL)) dead(`cross fixture claimants = [${cCross}] — expected exactly [${REAL}]`);
if (!(cActive.length === 1 && cActive[0] === ACTIVE)) dead(`active fixture claimants = [${cActive}] — expected exactly [${ACTIVE}]`);
if (cAmbig.length < 2) dead(`ambiguous fixture has ${cAmbig.length} claimant(s) — expected 2+`);
// The night discriminator must actually discriminate.
if (NIGHT_REAL === 1) dead(`${REAL} has only one night — the night fixture cannot discriminate`);
if (pfn(partsOf(T_CROSS), cfgOf(ACTIVE), null) != null) dead(`${ACTIVE} also claims the cross fixture — it cannot isolate the bug`);

const FP = (n) => `v1_104857${n}_img_54${n}.mov`;
const SEEDED_NIGHT = 1;   // deliberately wrong for T_CROSS

const archive = {
  [ACTIVE]: {
    moments: {
      1: [
        // No `night` field: forces the old code down the active-festival path.
        { id: "a-cross",  kind: "video", artistId: "k1", takenAt: T_CROSS,  _fingerprint: FP(1) },
        { id: "a-active", kind: "video", artistId: "k2", takenAt: T_ACTIVE, _fingerprint: FP(2) },
        { id: "a-ambig",  kind: "video", artistId: "k3", takenAt: T_AMBIG,  _fingerprint: FP(3) },
        { id: "a-owned",  kind: "video", artistId: "k4", takenAt: T_CROSS,  _fingerprint: FP(4) },
        // Deliberately a DIFFERENT takenAt from its live counterpart, so a
        // recovery that should never have run rewrites the clip's capture time
        // visibly instead of being a no-op.
        { id: "a-good",   kind: "video", artistId: "k9", takenAt: T_ACTIVE, _fingerprint: FP(5) },
      ],
    },
  },
};
const moments = {
  [SEEDED_NIGHT]: [
    { id: "m-cross",  kind: "video", night: SEEDED_NIGHT, artistId: null, takenAt: null, tagSource: "fallback", needsRetag: true, _fingerprint: FP(1), createdAt: 1 },
    { id: "m-active", kind: "video", night: SEEDED_NIGHT, artistId: null, takenAt: null, tagSource: "fallback", needsRetag: true, _fingerprint: FP(2), createdAt: 2 },
    { id: "m-ambig",  kind: "video", night: SEEDED_NIGHT, artistId: null, takenAt: null, tagSource: "fallback", needsRetag: true, _fingerprint: FP(3), createdAt: 3 },
    // Already attributed to the ACTIVE festival. #213's rule: never re-stamp an
    // existing festivalId. Kept deliberately, and stated in the PR — this fix
    // corrects future recoveries, not moments already mis-stamped.
    { id: "m-owned",  kind: "video", night: SEEDED_NIGHT, artistId: null, takenAt: null, tagSource: "fallback", needsRetag: true, _fingerprint: FP(4), createdAt: 4, festivalId: ACTIVE },
    // Already GOOD for its own festival: real capture time, artist resolved, not
    // a fallback, not flagged. Nothing here needs recovering — but the ACTIVE
    // festival cannot place its time, which is precisely what the old
    // `needsRecovery` test mistook for "broken".
    { id: "m-good",   kind: "video", night: NIGHT_REAL,   artistId: "k9",  takenAt: T_CROSS, tagSource: "auto", needsRetag: false, _fingerprint: FP(5), createdAt: 5 },
  ],
};

const { run } = boot({
  active_festival_id: ACTIVE,
  [MOMENTS_KEY]: JSON.stringify(moments),
  [ARCHIVE_KEY]: JSON.stringify(archive),
});

const gotActive = run("FESTIVAL_CONFIG && FESTIVAL_CONFIG.id");
if (gotActive !== ACTIVE) dead(`asked for active=${ACTIVE}, loader gave ${gotActive}`);

run("_videoArchiveRecoveryDone = false; _recoverCurrentVideoMomentsFromArchive();");

const after = JSON.parse(run(`localStorage.getItem(${JSON.stringify(MOMENTS_KEY)})`) || "{}");
const byId = {};
for (const [night, arr] of Object.entries(after)) {
  for (const m of (Array.isArray(arr) ? arr : [])) if (m?.id) byId[m.id] = { ...m, _bucket: Number(night) };
}

// ── CONTROL: recovery must have FIRED ─────────────────────────────────────
// If the fingerprint did not match, the function does nothing and every rule
// below would "pass" because no work happened — a fact about the fixture, not
// the code.
const fired = ["m-cross", "m-active", "m-ambig"].filter(id => byId[id]?.takenAtSource === "archive-recovered");
if (fired.length !== 3) dead(`recovery fired for ${fired.length}/3 unstamped clips (${fired.join(",") || "none"}) — fixture did not exercise the code`);
if (!byId["m-cross"] || !byId["m-active"] || !byId["m-ambig"] || !byId["m-owned"]) dead("a seeded moment vanished entirely");

console.log(`  · active=${ACTIVE}, cross clip shot ${T_CROSS} (${REAL} night ${NIGHT_REAL}), seeded bucket ${SEEDED_NIGHT}`);
console.log(`  · ambiguous fixture claimed by ${cAmbig.join(" + ")}`);

// ── Rule A: nothing is presented as attributed unless the evidence says so ──
for (const id of ["m-cross", "m-active", "m-ambig"]) {
  const m = byId[id];
  if (m.festivalAttribution === "unresolved") continue;   // a DECLARED guess is not a silent one
  const c = claimants(m.takenAt);
  check(m.festivalId != null && c.includes(m.festivalId),
    `${id}: stamped ${JSON.stringify(m.festivalId)} but its own capture time ${m.takenAt} is claimed by [${c.join(", ") || "nobody"}]`);
}

// ── Rule A2: a provable record must NOT hide behind "unresolved" ───────────
// Without this, marking everything unresolved would buy a trivial pass.
for (const id of ["m-cross", "m-active"]) {
  const m = byId[id];
  check(m.festivalAttribution !== "unresolved",
    `${id}: capture time is claimed by exactly one festival, so it must be attributed from evidence, not filed unresolved`);
}

// ── Rule B: the cross-festival clip goes to the festival that claims it ────
check(byId["m-cross"].festivalId === REAL,
  `m-cross: expected festivalId ${REAL} (its recovered capture time's only claimant), got ${JSON.stringify(byId["m-cross"].festivalId)}`);
check(byId["m-cross"].festivalAttribution === "capture-time",
  `m-cross: expected festivalAttribution "capture-time", got ${JSON.stringify(byId["m-cross"].festivalAttribution ?? null)}`);

// ── Rule C: the night comes from the ATTRIBUTED festival's own config ──────
// The archived record has no `night`, so this is where the active-festival
// fallback at :7654 shows up as a wrong bucket.
check(byId["m-cross"].night === NIGHT_REAL && byId["m-cross"]._bucket === NIGHT_REAL,
  `m-cross: expected night ${NIGHT_REAL} from ${REAL}'s own dayDates, got night=${JSON.stringify(byId["m-cross"].night)} in bucket ${byId["m-cross"]._bucket}`);

// ── Rule D: an unprovable record is DECLARED, and stays visible ────────────
check(byId["m-ambig"].festivalAttribution === "unresolved",
  `m-ambig: claimed by ${cAmbig.length} festivals, so it must be declared unresolved, got ${JSON.stringify(byId["m-ambig"].festivalAttribution ?? null)}`);
check(byId["m-ambig"].festivalId != null,
  `m-ambig: must keep a festivalId so it stays reachable — evicting it would be a second data-loss bug`);

// ── Rule E: positive control — the active festival's own clip still works ──
check(byId["m-active"].festivalId === ACTIVE,
  `m-active: a clip genuinely shot at the active festival must stay ${ACTIVE}, got ${JSON.stringify(byId["m-active"].festivalId)}`);

// ── Rule F: an existing festivalId is never overwritten ───────────────────
check(byId["m-owned"].festivalId === ACTIVE,
  `m-owned: an already-attributed moment must not be re-stamped, got ${JSON.stringify(byId["m-owned"].festivalId)}`);

// ── Rule G: a clip that is already fine is left alone ─────────────────────
// "Needs recovery" must mean "no festival we know of can place this time", not
// "the festival on screen cannot place it". Without this, every clip from every
// other festival is permanently a recovery candidate, and its good metadata gets
// overwritten from the archive — which is why a-good carries a different
// takenAt: if recovery wrongly runs, the capture time visibly changes.
check(byId["m-good"].takenAtSource !== "archive-recovered",
  `m-good: already placeable by its own festival and fully tagged, so recovery must not run — takenAtSource=${JSON.stringify(byId["m-good"].takenAtSource ?? null)}`);
check(byId["m-good"].takenAt === T_CROSS,
  `m-good: its own capture time must survive — expected ${T_CROSS}, got ${JSON.stringify(byId["m-good"].takenAt)}`);

console.log(failed === 0
  ? `  ✓ archive recovery: festival and night from the clip's own capture time, ambiguity declared (${checks} checks)`
  : `  ${failed} of ${checks} checks failed`);
process.exit(failed === 0 ? 0 : 1);
