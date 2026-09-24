#!/usr/bin/env node
// Gate: an existing festival stamp is replaced automatically ONLY when a stored
// provenance field proves the machine wrote it as a fallback. Every other
// contradiction keeps the stamp and goes to Needs Review.
//
// WHY. #213's sweep and #215's recovery only stamp an EMPTY festivalId, so a
// moment mis-stamped before them stays mis-stamped, and _activeMoments() hides
// a moment whose festivalId is not the current festival. #216's first head
// fixed that by overwriting any stamped record whose capture time had exactly
// one other claimant, unless tagSource was "manual"/"unknown". The lane review
// blocked it: tagSource says how the ARTIST was found, not who wrote
// festivalId, and capture time proves a conflict, not authorship. A user's
// correction with tagSource "exif" would have been overwritten.
//
// THE RULE (_reconcileFestivalStamps):
//   · festivalStampSource "active-fallback" (or no stored source and
//     festivalAttribution "unresolved", which only #213/#215 write) + one
//     claimant that disagrees + trusted capture time -> festivalId, night and
//     bucket corrected together
//   · any other disagreement (user, unknown/absent, several or no claimants,
//     unverified capture time) -> stamp, night and bucket unchanged, and a
//     festivalReview record that puts the moment in NEEDS REVIEW
//   · every write path now stores festivalStampSource beside festivalId
//
// Runs the COMPILED build/spotify.js in a vm, so this grades what ships.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.PROVENANCE_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");
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
const REAL   = "edc-lv-2026";      // where the contradicted clips were actually shot
const AMBIG  = "portola-2026";     // shares its weekend with another festival

const pad = (v) => String(v).padStart(2, "0");
const takenAtForNight = (cfg, night) => {
  const x = cfg?.dayDates?.[night];
  return x ? `${x.y}-${pad(x.m + 1)}-${pad(x.d)} 22:00` : null;
};
const nights = (cfg) => Object.keys(cfg?.dayDates || {}).map(Number).sort((a, b) => a - b);

// ── Corpus liveness (magnitude, not non-emptiness) ─────────────────────────
const probe = boot();
const DS = probe.run("_DATA_SETS") || {};
if (Object.keys(DS).length < 15) dead(`_DATA_SETS has ${Object.keys(DS).length} entries — festival modules did not load`);
if (probe.run("typeof _maybeAutoArchive") !== "function") dead("_maybeAutoArchive not reachable from build/spotify.js");
if (probe.run("typeof _festivalClaimantsFor") !== "function") dead("_festivalClaimantsFor not reachable — wrong base?");
const cfgOf = (id) => DS[id]?.config || {};
const pfn = probe.run("_photoFestivalNight");
const partsOf = probe.run("_momentTakenAtToDateParts");
const claimants = (t) => t ? Object.keys(DS).filter(id => pfn(partsOf(t), cfgOf(id), null) != null) : [];

const NIGHT_REAL = nights(cfgOf(REAL)).pop();       // LAST night: a night that defaults to 1 cannot pass
const T_WRONG = takenAtForNight(cfgOf(REAL), NIGHT_REAL);
const T_RIGHT = takenAtForNight(cfgOf(ACTIVE), nights(cfgOf(ACTIVE))[0]);
const T_AMBIG = takenAtForNight(cfgOf(AMBIG), nights(cfgOf(AMBIG))[0]);
const T_NONE  = "2026-03-03 12:00";                 // no festival runs that day
for (const [k, v] of Object.entries({ T_WRONG, T_RIGHT, T_AMBIG })) if (!v) dead(`fixture ${k} is ${v} — dayDates shape changed`);
const cW = claimants(T_WRONG), cR = claimants(T_RIGHT), cA = claimants(T_AMBIG), cN = claimants(T_NONE);
if (!(cW.length === 1 && cW[0] === REAL)) dead(`T_WRONG claimants [${cW}] — expected exactly [${REAL}]`);
if (!(cR.length === 1 && cR[0] === ACTIVE)) dead(`T_RIGHT claimants [${cR}] — expected exactly [${ACTIVE}]`);
if (cA.length < 2) dead(`T_AMBIG has ${cA.length} claimant(s) — expected 2+`);
if (cN.length !== 0) dead(`T_NONE is claimed by [${cN}] — pick another date`);
if (NIGHT_REAL === 1) dead(`${REAL} has one night — the night fixture cannot discriminate`);
console.log(`  · active=${ACTIVE}; contradicted clips shot ${T_WRONG} (${REAL} night ${NIGHT_REAL}); ambiguous ${cA.join(" + ")}`);

// ── Fixtures ───────────────────────────────────────────────────────────────
// Every record sits in bucket "1", stamped ACTIVE. Only takenAt and the stamp
// provenance differ, so the pass can only pass by reading those two.
const base = (id, extra) => ({ id, night: 1, festivalId: ACTIVE, text: `note ${id}`, favorite: true, createdAt: 1, ...extra });
const seed = { 1: [
  // 1. user-corrected stamp, machine-looking tagSource, no stored provenance
  base("f1-user-exif",   { takenAt: T_WRONG, artistId: "x1", tagSource: "exif" }),
  // 2. explicit user provenance
  base("f2-user",        { takenAt: T_WRONG, artistId: "x2", tagSource: "exif", festivalStampSource: "user" }),
  // 3. unknown provenance, machine tagSource
  base("f3-unknown",     { takenAt: T_WRONG, artistId: null, tagSource: "fallback" }),
  // 4. explicit legacy-machine provenance, one claimant: auto-repaired (as is 8)
  base("f4-machine",     { takenAt: T_WRONG, artistId: "x4", tagSource: "exif", festivalStampSource: "active-fallback", festivalAttribution: "unresolved" }),
  // 5. machine provenance but two claimants
  base("f5-machine-amb", { takenAt: T_AMBIG, artistId: null, festivalStampSource: "active-fallback" }),
  // machine provenance, unique claimant, but the capture time is an mtime guess
  base("f-unverified",   { takenAt: T_WRONG, dateUnverified: true, festivalStampSource: "active-fallback" }),
  // machine provenance, no claimant at all
  base("f-none",         { takenAt: T_NONE, festivalStampSource: "active-fallback" }),
  // 8. no stored source, but "unresolved": only #213/#215 write that marker,
  // and always beside a machine fallback stamp (lane ruling 2026-09-24)
  base("f8-legacy-unres", { takenAt: T_WRONG, artistId: "x8", festivalAttribution: "unresolved" }),
  // a stored source wins over the marker
  base("f9-unres-user",   { takenAt: T_WRONG, festivalAttribution: "unresolved", festivalStampSource: "user" }),
  // the marker does not relax the other conditions
  base("f10-unres-unverified", { takenAt: T_WRONG, dateUnverified: true, festivalAttribution: "unresolved" }),
  // correct stamp: must come out byte-identical
  base("f-right",        { takenAt: T_RIGHT, artistId: "x9", tagSource: "exif" }),
  // correct stamp carrying a stale review: the review is dropped
  base("f-stale",        { takenAt: T_RIGHT, festivalReview: { reason: "unproven-stamp" } }),
]};
const before = JSON.parse(JSON.stringify(seed));
const beforeById = Object.fromEntries(before[1].map(m => [m.id, m]));

function runPass(storeJson, { dropSet } = {}) {
  const p = boot({ [MOMENTS_KEY]: storeJson, plursky_last_festival_id: ACTIVE });
  if (dropSet) p.run(`delete _DATA_SETS[${JSON.stringify(dropSet)}];`);
  p.run(`window.FESTIVAL_CONFIG = _DATA_SETS[${JSON.stringify(ACTIVE)}].config;`);
  p.run("_archiveCheckDone = false; _maybeAutoArchive();");
  return p;
}
const p = runPass(JSON.stringify(seed));
const after = JSON.parse(p.store[MOMENTS_KEY] || "{}");
const where = {}, byId = {};
for (const [b, arr] of Object.entries(after)) for (const m of arr || []) { byId[m.id] = m; (where[m.id] ||= []).push(b); }
for (const id of Object.keys(beforeById)) if (!byId[id]) dead(`fixture ${id} vanished from the store`);

const stripReview = (m) => { const { festivalReview, ...rest } = m; return JSON.stringify(rest); };
const kept = (id) => stripReview(byId[id]) === JSON.stringify(beforeById[id]) && where[id].join() === "1";

// CONTROL: the pass ran and did something. Every "unchanged" rule passes on a no-op.
check(byId["f4-machine"].festivalId !== ACTIVE || !!byId["f1-user-exif"].festivalReview,
  "CONTROL: the pass changed nothing — every preserve rule below would pass by doing nothing");

// 1–3: no proof of machine authorship -> preserved AND in review
for (const [id, src] of [["f1-user-exif", "unknown"], ["f2-user", "user"], ["f3-unknown", "unknown"]]) {
  check(kept(id), `${id}: festivalId, night, bucket and every other field must be unchanged — got ${JSON.stringify(byId[id])} in bucket ${where[id]}`);
  const r = byId[id].festivalReview || {};
  check(r.reason === "unproven-stamp" && r.existingFestivalId === ACTIVE && r.claimant === REAL
    && JSON.stringify(r.candidates) === JSON.stringify([REAL]) && r.takenAt === T_WRONG && r.stampSource === src,
    `${id}: must enter Needs Review with reason, existing id, claimant, candidates, capture time and stamp source "${src}" — got ${JSON.stringify(byId[id].festivalReview ?? null)}`);
}

// 4: proven machine stamp -> festivalId, night and bucket move together
const f4 = byId["f4-machine"];
check(f4.festivalId === REAL, `f4-machine: stamp source "active-fallback" + sole claimant ${REAL} must be corrected — got ${f4.festivalId}`);
check(String(f4.night) === String(NIGHT_REAL), `f4-machine: night must be recomputed from ${REAL}'s calendar (${NIGHT_REAL}) — got ${f4.night}`);
check(where["f4-machine"].join() === String(NIGHT_REAL), `f4-machine: must move to bucket ${NIGHT_REAL} and leave bucket 1 — found in [${where["f4-machine"]}]`);
check(f4.festivalAttribution === "capture-time" && f4.festivalStampSource === "capture-time" && !f4.festivalReview,
  `f4-machine: a correction must say it came from capture time and carry no review — got ${JSON.stringify({ a: f4.festivalAttribution, s: f4.festivalStampSource, r: f4.festivalReview })}`);
check(f4.id === "f4-machine" && f4.text === beforeById["f4-machine"].text && f4.favorite === true && f4.artistId === "x4" && f4.tagSource === "exif",
  `f4-machine: identity and unrelated fields must survive the repair — got ${JSON.stringify(f4)}`);

// 8: legacy "unresolved" with no stored source is corrected like "active-fallback"
const f8 = byId["f8-legacy-unres"];
check(f8.festivalId === REAL && String(f8.night) === String(NIGHT_REAL) && where["f8-legacy-unres"].join() === String(NIGHT_REAL)
  && f8.festivalAttribution === "capture-time" && f8.festivalStampSource === "capture-time" && !f8.festivalReview && f8.artistId === "x8",
  `f8-legacy-unres: festivalAttribution "unresolved" with no stored source + sole claimant must be corrected (id, night, bucket) — got ${JSON.stringify(f8)} in bucket ${where["f8-legacy-unres"]}`);
check(kept("f9-unres-user") && byId["f9-unres-user"].festivalReview?.stampSource === "user",
  `f9-unres-user: a stored "user" source must win over the "unresolved" marker — got ${JSON.stringify(byId["f9-unres-user"])}`);
check(kept("f10-unres-unverified") && byId["f10-unres-unverified"].festivalReview?.reason === "unverified-capture-time",
  `f10-unres-unverified: the marker must not relax the trusted-capture-time condition — got ${JSON.stringify(byId["f10-unres-unverified"])}`);

// 5 + the other machine-stamped conflicts that cannot be proved
for (const [id, reason] of [["f5-machine-amb", "multiple-claimants"], ["f-unverified", "unverified-capture-time"], ["f-none", "no-claimant"]]) {
  check(kept(id), `${id}: must stay where it is — got ${JSON.stringify(byId[id])} in bucket ${where[id]}`);
  const r = byId[id].festivalReview || {};
  check(r.reason === reason && r.stampSource === "active-fallback",
    `${id}: must enter Needs Review as "${reason}" — got ${JSON.stringify(byId[id].festivalReview ?? null)}`);
}
check(JSON.stringify(byId["f5-machine-amb"].festivalReview?.candidates) === JSON.stringify(cA) && byId["f5-machine-amb"].festivalReview?.claimant === null,
  `f5-machine-amb: review must list every candidate and name no claimant — got ${JSON.stringify(byId["f5-machine-amb"].festivalReview)}`);

// Agreement: untouched, and a stale review is dropped
check(JSON.stringify(byId["f-right"]) === JSON.stringify(beforeById["f-right"]) && where["f-right"].join() === "1",
  `f-right: a stamp its own capture time confirms must come out byte-identical — got ${JSON.stringify(byId["f-right"])}`);
check(!("festivalReview" in byId["f-stale"]), `f-stale: a review on a stamp that now agrees must be dropped — got ${JSON.stringify(byId["f-stale"].festivalReview)}`);

// Count conserved
const count = (all) => Object.values(all).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
check(count(after) === count(before), `moment count changed ${count(before)} → ${count(after)}`);

// 6: idempotent — a second boot over the output changes nothing
const p2 = runPass(p.store[MOMENTS_KEY]);
check(p2.store[MOMENTS_KEY] === p.store[MOMENTS_KEY], "second boot changed the store — the pass is not a fixed point and would sync on every launch");

// Needs Review surface: the grouping the night view renders puts every
// reviewed moment in needsReview, once, and nowhere else.
const g = p.run("_groupNightMoments")({ moments: after["1"], attendedSet: [], artists: [{ id: "x9", start: "20:00" }], toMin: () => 0 });
const reviewed = after["1"].filter(m => m.festivalReview).map(m => m.id);
const inReview = g.needsReview.map(m => m.id);
const elsewhere = [...[...g.byArtist.values()].flat(), ...g.untagged].map(m => m.id);
check(reviewed.length >= 6 && reviewed.every(id => inReview.includes(id)),
  `Needs Review must show every moment with a festival review — reviewed [${reviewed}], shown [${inReview}]`);
check(reviewed.every(id => !elsewhere.includes(id)), `a reviewed moment must not also render in a set or Between Sets — found [${reviewed.filter(id => elsewhere.includes(id))}]`);
check(elsewhere.includes("f-right"), "f-right (agreeing, lineup artist) must still render under its set");

// 7: the write path persists provenance, and that alone makes a record repairable.
// Boot A cannot see REAL yet (as when a festival's data ships later), so the
// sweep stamps the active festival as a fallback. Boot B can, and repairs it.
// The record has no tagSource at all.
const fresh = { 1: [{ id: "f7-new", night: 1, takenAt: T_WRONG, createdAt: 7 }] };
const pa = runPass(JSON.stringify(fresh), { dropSet: REAL });
const a7 = JSON.parse(pa.store[MOMENTS_KEY])["1"]?.find(m => m.id === "f7-new");
check(a7?.festivalId === ACTIVE && a7?.festivalStampSource === "active-fallback",
  `f7: the sweep's fallback stamp must record festivalStampSource "active-fallback" — got ${JSON.stringify(a7)}`);
const pb = runPass(pa.store[MOMENTS_KEY]);
const b7all = JSON.parse(pb.store[MOMENTS_KEY]);
const b7 = (b7all[String(NIGHT_REAL)] || []).find(m => m.id === "f7-new");
check(b7?.festivalId === REAL && String(b7?.night) === String(NIGHT_REAL) && !("tagSource" in b7) && !(b7all["1"] || []).some(m => m.id === "f7-new"),
  `f7: a record the write path marked machine-stamped must later be repaired from provenance alone — got ${JSON.stringify(b7all)}`);

// Every festivalId write in the source stores its provenance beside it.
const src = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
const lines = src.split("\n");
const writes = lines.map((l, i) => [l, i]).filter(([l]) => /^\s*(m\.festivalId\s*=|festivalId:\s)/.test(l));
check(writes.length >= 6, `expected at least 6 festivalId write sites in spotify.jsx — found ${writes.length}; the detector is broken`);
for (const [l, i] of writes) {
  const near = lines.slice(i, i + 8).join("\n");
  check(/festivalStampSource/.test(near), `spotify.jsx:${i + 1} writes festivalId without festivalStampSource within 8 lines: ${l.trim()}`);
}
check(/festivalStampSource:\s*matched\.festivalId\s*\?\s*"capture-time"\s*:\s*"active-fallback"/.test(src),
  "import must stamp active-fallback exactly when the matcher resolved no festival");

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED — an existing festival stamp is not handled by its provenance.`);
  process.exit(1);
}
console.log(`  ✓ festival stamp provenance: only proven machine stamps are corrected, the rest go to Needs Review (${checks} checks)`);
