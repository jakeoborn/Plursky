#!/usr/bin/env node
// Regression: a moment that was ALREADY stamped with a festival must be
// re-evaluated against its own capture time — once, conservatively, and never
// over a stamp that carries human intent.
//
// THE BUG THIS EXISTS FOR (measured on main 77e3b1f, before this gate):
//   #213 taught the boot sweep to attribute legacy moments from capture time,
//   and #215 taught archive recovery the same. Both deliberately refuse to
//   re-stamp a moment that already has a festivalId:
//
//       if (!m || m.festivalId) continue;   // already attributed: never re-stamp
//
//   That was the right call for those PRs — neither had a rule for overwriting
//   an existing stamp. The consequence is that every moment mis-stamped BEFORE
//   them stays mis-stamped forever. Reproduced with acl-2026 active: a clip
//   shot on edc-lv-2026's last night, claimed by edc-lv-2026 AND NOTHING ELSE,
//   sat stamped acl-2026 with festivalAttribution null. _activeMoments() keeps
//   a moment only when its festivalId is the current one, so that clip is
//   unreachable from the festival it was actually shot at.
//
//   The discriminator matters: a mis-stamped moment and a correctly-stamped one
//   are FIELD-IDENTICAL (same festivalId, attribution null, same tagSource).
//   Only the capture time tells them apart, which is why the rule can be
//   nothing but "what does this record's own timestamp prove?".
//
// THE RULE (founder ruling, 2026-09-17 — deliberately the most conservative
// of the three options put to him):
//   · EXACTLY ONE claimant for the capture time  -> re-stamp, mark "capture-time"
//   · zero or two-plus claimants                 -> leave the stamp ALONE,
//                                                   declare "unresolved" + candidates
//   · tagSource "manual" or "unknown"            -> never touched, at all
//
//   "manual" is the user's own retag; "unknown" is the user answering "I don't
//   know" — the one answer a machine must not overwrite with a guess. Those are
//   the only two markers of human intent in the tagSource vocabulary (measured:
//   manual, unknown, fallback, song-recovered, video-shazam, archive-recovered).
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
const REAL   = "edc-lv-2026";       // the festival the mis-stamped clip was shot at
const AMBIG  = "portola-2026";      // shares its weekend with crssd-fall-2026

const pad = (v) => String(v).padStart(2, "0");
function takenAtForNight(cfg, night) {
  const x = cfg?.dayDates?.[night];
  return x ? `${x.y}-${pad(x.m + 1)}-${pad(x.d)} 22:00` : null;
}
const firstNight = (cfg) => Object.keys(cfg?.dayDates || {}).map(Number).sort((a, b) => a - b)[0];
const lastNight  = (cfg) => Object.keys(cfg?.dayDates || {}).map(Number).sort((a, b) => a - b).pop();

// ── Corpus liveness, asserting MAGNITUDE not non-emptiness ────────────────
// A probe that loaded only build/data.js once reported 11 registry rows and 4
// data sets and called it "non-empty" — on a corpus 4/18ths present. Floors are
// well under the real counts (18 sets, 25 rows) so ordinary churn never trips
// them, but a loader that silently half-loads does.
const probe = boot();
const DS = probe.run("_DATA_SETS") || {};
const REG = probe.run("FESTIVALS_REGISTRY || []") || [];
if (Object.keys(DS).length < 15) dead(`_DATA_SETS has ${Object.keys(DS).length} entries — festival modules did not load`);
if (REG.length < 20) dead(`registry has ${REG.length} rows — festival modules did not load`);
if (probe.run("typeof _maybeAutoArchive") !== "function") dead("_maybeAutoArchive not reachable from build/spotify.js");
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
// The mis-stamped clip uses REAL's LAST night, so a night recomputation that
// silently defaults to night 1 cannot pass by coincidence.
const NIGHT_REAL = lastNight(cfgOf(REAL));
const T_WRONG  = takenAtForNight(cfgOf(REAL), NIGHT_REAL);
const T_RIGHT  = takenAtForNight(cfgOf(ACTIVE), firstNight(cfgOf(ACTIVE)));
const T_AMBIG  = takenAtForNight(cfgOf(AMBIG), firstNight(cfgOf(AMBIG)));
for (const [k, v] of Object.entries({ T_WRONG, T_RIGHT, T_AMBIG })) if (!v) dead(`fixture ${k} is ${v} — dayDates shape changed`);

// ── Fixture premises, asserted rather than assumed ────────────────────────
const cWrong = claimants(T_WRONG), cRight = claimants(T_RIGHT), cAmbig = claimants(T_AMBIG);
if (!(cWrong.length === 1 && cWrong[0] === REAL)) dead(`wrong-fixture claimants = [${cWrong}] — expected exactly [${REAL}]`);
if (!(cRight.length === 1 && cRight[0] === ACTIVE)) dead(`right-fixture claimants = [${cRight}] — expected exactly [${ACTIVE}]`);
if (cAmbig.length < 2) dead(`ambiguous fixture has ${cAmbig.length} claimant(s) — expected 2+`);
if (NIGHT_REAL === 1) dead(`${REAL} has only one night — the night fixture cannot discriminate`);
if (pfn(partsOf(T_WRONG), cfgOf(ACTIVE), null) != null) dead(`${ACTIVE} also claims the wrong-fixture time — it cannot isolate the bug`);

console.log(`  · active=${ACTIVE}; mis-stamped clip shot ${T_WRONG} (${REAL} night ${NIGHT_REAL})`);
console.log(`  · ambiguous fixture claimed by ${cAmbig.join(" + ")}`);

// ── Fixtures ──────────────────────────────────────────────────────────────
// m-wrong and m-right are FIELD-IDENTICAL apart from takenAt. That is the
// point: if the pass keyed off anything but capture time it would either move
// both or neither.
const seed = {
  1: [
    { id: "m-wrong",  night: 1, takenAt: T_WRONG, festivalId: ACTIVE, artistId: "x1", tagSource: "exif",    createdAt: 1 },
    { id: "m-right",  night: 1, takenAt: T_RIGHT, festivalId: ACTIVE, artistId: "x2", tagSource: "exif",    createdAt: 2 },
    { id: "m-manual", night: 1, takenAt: T_WRONG, festivalId: ACTIVE, artistId: "x3", tagSource: "manual",  createdAt: 3 },
    { id: "m-unknown",night: 1, takenAt: T_WRONG, festivalId: ACTIVE, artistId: null, tagSource: "unknown", createdAt: 4 },
    { id: "m-ambig",  night: 1, takenAt: T_AMBIG, festivalId: ACTIVE, artistId: "x5", tagSource: "exif",    createdAt: 5 },
  ],
};
const before = JSON.parse(JSON.stringify(seed));
const beforeById = {};
for (const arr of Object.values(before)) for (const m of arr || []) beforeById[m.id] = m;

const p = boot({
  [MOMENTS_KEY]: JSON.stringify(seed),
  plursky_last_festival_id: ACTIVE,
});
p.run(`window.FESTIVAL_CONFIG = _DATA_SETS[${JSON.stringify(ACTIVE)}].config;`);
p.run("_archiveCheckDone = false; _maybeAutoArchive();");

const after = JSON.parse(p.store[MOMENTS_KEY] || "{}");
const byId = {};
for (const arr of Object.values(after)) for (const m of arr || []) byId[m.id] = m;
for (const id of ["m-wrong", "m-right", "m-manual", "m-unknown", "m-ambig"]) {
  if (!byId[id]) dead(`fixture ${id} vanished from the store — the pass dropped a moment`);
}

// ── CONTROL: the pass actually ran ────────────────────────────────────────
// Every rule below except A would pass if the pass did nothing at all. This
// asserts at least one record was touched, so a no-op cannot look like a green.
check(byId["m-wrong"].festivalId !== ACTIVE || byId["m-wrong"].festivalAttribution != null,
  `CONTROL: the correcting pass made no change to m-wrong at all — every other rule here would pass by doing nothing`);

// ── Rule A: the provable mis-stamp is corrected, from capture time ────────
check(byId["m-wrong"].festivalId === REAL,
  `m-wrong: its own capture time ${T_WRONG} is claimed only by [${REAL}], so it must be re-stamped — got ${JSON.stringify(byId["m-wrong"].festivalId)}`);
check(byId["m-wrong"].festivalAttribution === "capture-time",
  `m-wrong: a correction proven from the record's own timestamp must be marked "capture-time" — got ${JSON.stringify(byId["m-wrong"].festivalAttribution ?? null)}`);

// ── Rule B: a correct stamp is left completely alone ──────────────────────
// Field-identical to m-wrong apart from takenAt, so this is what proves the
// pass is keyed on capture time and not on "attribution is null".
check(byId["m-right"].festivalId === ACTIVE,
  `m-right: already sits in the festival its own capture time proves, so it must not move — got ${JSON.stringify(byId["m-right"].festivalId)}`);
check(JSON.stringify(byId["m-right"]) === JSON.stringify(beforeById["m-right"]),
  `m-right: a correctly-stamped moment must come out byte-identical — got ${JSON.stringify(byId["m-right"])}`);

// ── Rule C: human intent is never overwritten ─────────────────────────────
check(JSON.stringify(byId["m-manual"]) === JSON.stringify(beforeById["m-manual"]),
  `m-manual: tagSource "manual" is the user's own retag and must never be re-stamped — got ${JSON.stringify(byId["m-manual"])}`);
check(JSON.stringify(byId["m-unknown"]) === JSON.stringify(beforeById["m-unknown"]),
  `m-unknown: tagSource "unknown" is the user answering "I don't know" — a machine must not overwrite it with a guess — got ${JSON.stringify(byId["m-unknown"])}`);

// ── Rule D: ambiguity is declared, never guessed ──────────────────────────
check(byId["m-ambig"].festivalId === ACTIVE,
  `m-ambig: claimed by ${cAmbig.length} festivals, so it must stay exactly where it has always been visible — got ${JSON.stringify(byId["m-ambig"].festivalId)}`);
check(byId["m-ambig"].festivalAttribution === "unresolved",
  `m-ambig: claimed by ${cAmbig.length} festivals, so the attribution must be DECLARED unresolved — got ${JSON.stringify(byId["m-ambig"].festivalAttribution ?? null)}`);
check(Array.isArray(byId["m-ambig"].festivalCandidates) && byId["m-ambig"].festivalCandidates.length === cAmbig.length,
  `m-ambig: an unresolved record must carry its candidate ids so a later pass or a human can settle it — got ${JSON.stringify(byId["m-ambig"].festivalCandidates ?? null)}`);

// ── Rule E: idempotent — a second run changes nothing ─────────────────────
// The pass runs on every boot. If it is not a fixed point, it churns the store
// (and the cloud sync behind _writeMoments) forever.
const p2 = boot({ [MOMENTS_KEY]: p.store[MOMENTS_KEY], plursky_last_festival_id: ACTIVE });
p2.run(`window.FESTIVAL_CONFIG = _DATA_SETS[${JSON.stringify(ACTIVE)}].config;`);
p2.run("_archiveCheckDone = false; _maybeAutoArchive();");
check(p2.store[MOMENTS_KEY] === p.store[MOMENTS_KEY],
  `second run changed the store — the correcting pass is not idempotent and will churn on every boot`);

// ── Rule F: the moment count is conserved ─────────────────────────────────
const countOf = (all) => Object.values(all).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
check(countOf(after) === countOf(before),
  `moment count changed ${countOf(before)} → ${countOf(after)} — a correcting pass must never add or drop a record`);

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED — a mis-stamped moment is not being corrected from its own capture time.`);
  process.exit(1);
}
console.log(`  ✓ mis-stamped correction: provable stamps corrected, human intent and ambiguity untouched (${checks} checks)`);
