#!/usr/bin/env node
// Regression: the legacy festivalId backfill must ATTRIBUTE FROM EVIDENCE,
// never from whichever festival happened to be on screen.
//
// THE BUG THIS EXISTS FOR (live on main before this gate):
//   _maybeAutoArchive() backfills every pre-v204 moment in ONE sweep with
//   `attribId = lastSeen || cur` — a guess about a mixed bucket, applied to
//   records whose OWN capture time disproves it. Measured 2026-09-17 with ACL
//   active on a first load: a clip shot 2026-05-15 (EDC Las Vegas) and one shot
//   2026-11-06 (EDC Orlando) were both stamped `acl-2026`, whose window is
//   Oct 2-4 & 9-11. _activeMoments() then keeps a moment only when its
//   festivalId is the current one, so switching back to EDC does NOT bring
//   them back, and the pointer advances to `cur` in the same pass — destroying
//   the `lastSeen` evidence a later load would need to correct it.
//   photo-tag.jsx:486 already says it plainly: "that is not a display glitch
//   you can switch away from."
//
// WHY NOT REUSE THE IMPORT-SIDE TRUST PREDICATE: _someFestivalClaimsCaptureTime
// answers only yes/no, deliberately — it cannot name a festival, which is
// precisely what this migration needs it to do.
//
// Its predecessor _anyFestivalNight DID return {festivalId, night}, and both
// fields were unusable here: it filtered through _allDataSets() to
// registry-`available` festivals, so a GATED one like edc-orlando-2026 was
// invisible — the very festival whose clips get orphaned — and it stopped at the
// FIRST claimant with no tie-break, so on the 10 ambiguous night-windows (of 53)
// it attributed by _DATA_SETS declaration order. Neither was a live defect at
// its two call sites, which read only `!= null`; both would have become one the
// moment a caller read `.festivalId`. That return type is now gone rather than
// merely unused, so the trap cannot be re-entered here or anywhere else.
//
// Runs build/spotify.js in a vm so this grades the SHIPPED function.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const MOMENTS_KEY = "plursky_moments_v1";
const POINTER = "plursky_last_festival_id";

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
const fails = [];
function check(ok, msg) { checks++; if (!ok) { failed++; fails.push(msg); console.log(`  ✗  ${msg}`); } }
function dead(msg) { console.log(`  ✗  HARNESS DEAD: ${msg}`); process.exit(1); }

// Day-1 22:00 local, straight from dayDates {y, m (0-based), d}. An epoch-free
// fixture: no parsing, no timezone guesswork on the test's side.
function dayOneTakenAt(cfg) {
  const dd = cfg?.dayDates; if (!dd) return null;
  const n1 = Object.keys(dd).map(Number).sort((a, b) => a - b)[0];
  const x = dd[n1]; if (!x) return null;
  const p = (v) => String(v).padStart(2, "0");
  return `${x.y}-${p(x.m + 1)}-${p(x.d)} 22:00`;
}

const ACTIVE = "acl-2026";
const probe = boot();
if (probe.run("typeof _maybeAutoArchive") !== "function") dead("_maybeAutoArchive not reachable from build/spotify.js");
if (probe.run("typeof _activeMoments") !== "function") dead("_activeMoments not reachable from build/spotify.js");
const DS = probe.run("_DATA_SETS") || {};
const REG = probe.run("FESTIVALS_REGISTRY || []") || [];
if (Object.keys(DS).length < 5) dead(`_DATA_SETS has ${Object.keys(DS).length} entries`);

const cfgOf = (id) => DS[id]?.config || {};
const T = {
  edclv:   dayOneTakenAt(cfgOf("edc-lv-2026")),
  acl:     dayOneTakenAt(cfgOf(ACTIVE)),
  orlando: dayOneTakenAt(cfgOf("edc-orlando-2026")),
  ambig:   dayOneTakenAt(cfgOf("portola-2026")),
};
for (const [k, v] of Object.entries(T)) if (!v) dead(`fixture date for ${k} is ${v} — dayDates shape changed`);

// The gated festival is the whole point of walking _DATA_SETS rather than the
// registry-filtered _allDataSets(). Assert it really IS gated, or this fixture
// silently stops testing anything.
const orlandoGated = !REG.find(f => f?.config?.id === "edc-orlando-2026" && f.available);
check(orlandoGated, "fixture sanity: edc-orlando-2026 must be GATED for the gated-festival case to mean anything");

// Which festivals' night windows claim a given capture time? Computed here from
// _DATA_SETS + the shipped _photoFestivalNight, so the test derives the truth
// independently of whatever the fix does internally.
const pfn = probe.run("_photoFestivalNight");
const partsOf = probe.run("_momentTakenAtToDateParts");
function claimants(takenAt) {
  if (!takenAt) return [];
  const d = partsOf(takenAt);
  return Object.keys(DS).filter(id => pfn(d, cfgOf(id), null) != null);
}

const legacy = {
  1: [
    { id: "m-edclv",   night: 1, artistId: null, takenAt: T.edclv,   photoId: "p1", kind: "photo", createdAt: 1 },
    { id: "m-orlando", night: 1, artistId: null, takenAt: T.orlando, photoId: "p2", kind: "photo", createdAt: 2 },
    { id: "m-ambig",   night: 1, artistId: null, takenAt: T.ambig,   photoId: "p3", kind: "photo", createdAt: 3 },
    { id: "m-nodate",  night: 1, artistId: null, takenAt: null,      photoId: "p4", kind: "photo", createdAt: 4 },
    { id: "m-active",  night: 1, artistId: null, takenAt: T.acl,     photoId: "p5", kind: "photo", createdAt: 5 },
    { id: "m-stamped", night: 1, artistId: null, takenAt: T.edclv,   photoId: "p6", kind: "photo", createdAt: 6, festivalId: "edc-lv-2026" },
  ],
};

const { ctx, store, run } = boot({ active_festival_id: ACTIVE, [MOMENTS_KEY]: JSON.stringify(legacy) });

// ── Harness controls ───────────────────────────────────────────────────────
// A fixture loader that silently returned the DEFAULT festival, or a seed the
// build cannot see, would make every assertion below fail for the wrong reason.
const gotActive = run("FESTIVAL_CONFIG && FESTIVAL_CONFIG.id");
if (gotActive !== ACTIVE) dead(`asked for active=${ACTIVE}, loader gave ${gotActive}`);
const seen = Object.values(run("_readMoments()")).flat().length;
if (seen !== 6) dead(`seeded 6 moments, _readMoments() sees ${seen}`);

run("_maybeAutoArchive()");
const after = JSON.parse(store[MOMENTS_KEY] || "{}");
const byId = Object.fromEntries(Object.values(after).flat().map(m => [m.id, m]));
if (Object.keys(byId).length !== 6) dead(`after migration, ${Object.keys(byId).length} of 6 moments survive`);

// ── Positive control ───────────────────────────────────────────────────────
// A clip actually shot at the ACTIVE festival must be attributed to it. If this
// fails, attribution is broken outright and the findings below are noise.
check(byId["m-active"].festivalId === ACTIVE,
  `positive control: a clip shot at the active festival must be attributed to it (got ${JSON.stringify(byId["m-active"].festivalId)})`);

// ── Rule A — the invariant, shape-agnostic ─────────────────────────────────
// A moment PRESENTED AS ATTRIBUTED may never carry a festival whose night
// windows exclude its own capture time.
//
// ⚠ This rule had no "unresolved" exemption on its first run, and m-ambig failed
// it. The exemption was added AFTER seeing that failure, which is exactly the
// shape of loosening a cap to go green — so it has to justify itself. The spec's
// words are "never SILENTLY assign one mixed legacy bucket to the wrong
// festival". A record whose own data cannot prove an owner still has to live
// somewhere, and evicting it from the festival it has always been visible in
// would be a second data-loss bug stacked on the first. What is forbidden is an
// unproven guess WEARING THE SAME SHAPE AS EVIDENCE. A declared guess is legal;
// a silent one is not. Rule A2 then makes the flag load-bearing, so "mark
// everything unresolved" cannot buy a trivial pass.
for (const m of Object.values(byId)) {
  if (!m.takenAt || !m.festivalId) continue;
  if (m.festivalAttribution === "unresolved") continue;   // a declared guess, not a claim
  const ok = claimants(m.takenAt).includes(m.festivalId);
  check(ok, `${m.id}: stamped ${m.festivalId} as attributed fact, but that festival's dates do not contain ` +
            `takenAt=${m.takenAt} (festivals that DO claim it: [${claimants(m.takenAt).join(", ") || "none"}])`);
}

// ── Rule A2 — the "unresolved" flag must be load-bearing ───────────────────
// Rule A exempts flagged records, so something must stop the fix from flagging
// EVERYTHING and passing trivially. Any record whose capture time is claimed by
// exactly one festival is provable, and must come back evidence-backed.
for (const m of Object.values(byId)) {
  if (!m.takenAt || claimants(m.takenAt).length !== 1) continue;
  check(m.festivalAttribution !== "unresolved",
    `${m.id}: takenAt=${m.takenAt} is claimed by exactly one festival (${claimants(m.takenAt)[0]}), ` +
    `so it must be attributed from that evidence, not filed as unresolved`);
}

// ── Rule B — recovery: a single claimant is proof, including a GATED one ────
check(byId["m-edclv"].festivalId === "edc-lv-2026",
  `m-edclv: capture time ${T.edclv} is claimed only by edc-lv-2026 — expected that stamp, got ${JSON.stringify(byId["m-edclv"].festivalId)}`);
check(byId["m-orlando"].festivalId === "edc-orlando-2026",
  `m-orlando: capture time ${T.orlando} is claimed only by edc-orlando-2026 (GATED) — expected that stamp, got ${JSON.stringify(byId["m-orlando"].festivalId)}. ` +
  `A registry-filtered walk cannot see a gated festival.`);

// ── Rule C — no evidence means no evidence-shaped stamp ────────────────────
// Ambiguous (2+ claimants) and dateless records must be marked as unproven
// rather than silently presented as attributed fact.
const ambigClaims = claimants(T.ambig);
check(ambigClaims.length > 1, `fixture sanity: ${T.ambig} must be claimed by 2+ festivals (got [${ambigClaims.join(", ")}])`);
for (const id of ["m-ambig", "m-nodate"]) {
  const m = byId[id];
  check(m.festivalAttribution === "unresolved",
    `${id}: ownership cannot be proved from its own data, so it must be marked festivalAttribution="unresolved" ` +
    `(got festivalId=${JSON.stringify(m.festivalId)} attribution=${JSON.stringify(m.festivalAttribution)})`);
}

// ── Rule D — an already-attributed record is never re-stamped ──────────────
check(byId["m-stamped"].festivalId === "edc-lv-2026",
  `m-stamped: an existing attribution must not be overwritten (got ${JSON.stringify(byId["m-stamped"].festivalId)})`);

// ── Rule E — reachability, the user-visible consequence ────────────────────
// Attribution only matters because _activeMoments filters on it.
for (const [fid, wantId] of [["edc-lv-2026", "m-edclv"], ["edc-orlando-2026", "m-orlando"]]) {
  run(`FESTIVAL_CONFIG = _DATA_SETS[${JSON.stringify(fid)}].config`);
  const vis = Object.values(run("_activeMoments(_readMoments())")).flat().map(m => m.id);
  check(vis.includes(wantId),
    `with ${fid} active, ${wantId} must be reachable — it was shot there. Visible: [${vis.join(", ") || "nothing"}]`);
}

// ── Rule F — the once-per-load flag must not be burned by an early return ──
// _archiveCheckDone is set BEFORE the `if (!cur) return` guard, so a load where
// FESTIVAL_CONFIG is not ready yet permanently disables migration for that
// session — the flag is consumed by a run that did nothing.
{
  const f = boot({ active_festival_id: ACTIVE, [MOMENTS_KEY]: JSON.stringify(legacy) });
  f.run("FESTIVAL_CONFIG = undefined");
  f.run("_maybeAutoArchive()");
  const burned = f.run("_archiveCheckDone");
  check(burned === false,
    `a run that returned early (no FESTIVAL_CONFIG) must not consume the once-per-load flag (got _archiveCheckDone=${burned})`);
  f.run(`FESTIVAL_CONFIG = _DATA_SETS[${JSON.stringify(ACTIVE)}].config`);
  f.run("_maybeAutoArchive()");
  const got = Object.values(JSON.parse(f.store[MOMENTS_KEY] || "{}")).flat().find(m => m.id === "m-edclv");
  check(got?.festivalId === "edc-lv-2026",
    `after the config arrives, migration must still run (m-edclv festivalId=${JSON.stringify(got?.festivalId)})`);
}

// ── Rule G — the pointer is evidence; never advance past a failed sweep ────
// `plursky_last_festival_id` is the ONLY thing a later load has to attribute the
// records this run could not prove. The old code set it inside the outer try, so
// a backfill that threw (quota, corrupt JSON) still moved it to `cur`: the
// failure was swallowed, the evidence was destroyed, and the next load guessed
// `cur` for everything with nothing left to contradict it.
{
  const f = boot({ active_festival_id: ACTIVE, [MOMENTS_KEY]: JSON.stringify(legacy) });
  // Fail ONLY the moment write, exactly as a storage quota error would.
  const realSet = f.ctx.localStorage.setItem;
  f.ctx.localStorage.setItem = (k, v) => {
    if (k === MOMENTS_KEY) throw new Error("QuotaExceededError (simulated)");
    return realSet(k, v);
  };
  f.run("_maybeAutoArchive()");
  check(f.store[POINTER] == null,
    `the sweep could not write, so the pointer must NOT advance — the unwritten records still need ` +
    `lastSeen to be attributed later (pointer=${JSON.stringify(f.store[POINTER] ?? null)})`);
}

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED — legacy moments are attributed by guess, not by evidence.`);
  process.exit(1);
}
console.log(`  ✓ festival migration: ${checks} checks — legacy moments attributed from their own capture time`);
console.log(`    fixtures: edc-lv=${T.edclv} orlando=${T.orlando} (gated) ambiguous=${T.ambig} active=${ACTIVE}`);
