#!/usr/bin/env node
// Regression: "is this a real festival capture time?" is a TRUST question, and
// it must not be answered with a festival identity nobody can justify.
//
// THE SHAPE OF THE BUG (both halves live on main before this gate):
//
//   _anyFestivalNight(date, utcMs) returned {festivalId, night} by walking
//   _allDataSets() and stopping at the FIRST festival whose night window
//   contained the instant.
//
//   1. THE ID AND THE ORDINAL ARE AN ORDERING ACCIDENT. Measured on this tree:
//      10 of the 53 night windows are claimed by TWO festivals running the same
//      weekend — lost-lands/nocturnal, lollapalooza/hard-summer, crssd/portola.
//      On those, "first wins" attributes by _DATA_SETS declaration order and
//      presents it as a fact. Neither field was ever read (spotify.jsx:1446
//      tests `!= null`; :1528 takes `?.night` and then only compares it to
//      null), so this was LATENT, not live — a wrong answer sitting in the
//      return type waiting for the first caller to believe it.
//
//   2. THE GATED HALF IS LIVE. _allDataSets() filters to registry-`available`.
//      That filter is CORRECT for _resolveFestivalForPhoto, which ATTRIBUTES:
//      stamping a moment with a gated id strands it, because
//      getActiveFestivalId() also requires `available`. It is WRONG for a trust
//      question, because availability is a UI concern and says nothing about
//      whether a timestamp is real. edc-orlando-2026 is gated today and is the
//      only gated festival carrying a data module, so a genuine EDC Orlando
//      capture time was rejected as junk at spotify.jsx:1446 and the clip
//      imported as no-date — a real capture time destroyed by a filter that
//      exists to protect attribution.
//
// THE RULE THIS GATE ENFORCES: the trust question returns a BOOLEAN, computed
// over every festival we have data for, gated included. That does not guard the
// mis-attribution path — it removes it, because there is no id left to read.
//
// Runs the SHIPPED build in a vm, so it grades the real functions rather than a
// re-implementation of them.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEST_DIR = join(ROOT, "data", "festivals");
const MOD_FILES = readdirSync(FEST_DIR).filter(f => f.endsWith(".js")).sort();
const MODS = MOD_FILES.map(f => readFileSync(join(FEST_DIR, f), "utf8")).join("\n");

const HOURS = 3600000;

function boot() {
  const noop = () => {};
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = {};
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
  return ctx;
}

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
function dead(msg) { console.log(`  ✗  HARNESS DEAD: ${msg}`); process.exit(1); }

const ctx = boot();
const reg = ctx.FESTIVALS_REGISTRY || [];
const sets = ctx._DATA_SETS || {};
const ids = Object.keys(sets);

// ── HARNESS CONTROLS ──────────────────────────────────────────────────────
// A zero from a filtering walk is a claim about the WALK until a control that
// must match does match. An earlier probe this session loaded only build/data.js
// and reported 11 registry rows / 4 data sets / "0 ambiguous windows" — every
// number a fact about the harness. The control below asserts MAGNITUDE, not
// mere non-emptiness, because non-emptiness passed happily on that broken boot.
if (MOD_FILES.length < 10) dead(`only ${MOD_FILES.length} festival modules found in data/festivals`);
if (reg.length < 20) dead(`registry has ${reg.length} rows (<20) — festival modules did not load`);
if (ids.length < 15) dead(`_DATA_SETS has ${ids.length} keys (<15) — festival modules did not load`);
if (typeof ctx._photoFestivalNight !== "function") dead("_photoFestivalNight is not a function");

const activeId = ctx.FESTIVAL_CONFIG?.id || null;
if (!activeId) dead("no active FESTIVAL_CONFIG.id");

const availableOf = (id) => !!reg.find(f => f?.config?.id === id && f.available);
const nightsOf = (id) => {
  const dd = sets[id]?.config?.dayDates;
  return dd ? Object.keys(dd).map(Number).sort((a, b) => a - b) : [];
};
// An instant genuinely inside a night window: local 22:00 on that night.
// Epoch-free on the test's side — midnightUtc is the data's own anchor, and
// _photoFestivalNight treats utcMs as authoritative, so no timezone is guessed.
const instantFor = (id, night) => {
  const dm = sets[id]?.config?.dayDates?.[night];
  return dm?.midnightUtc == null ? null : dm.midnightUtc + 22 * HOURS;
};
const claimantsOf = (utcMs) => ids.filter(id => {
  const cfg = sets[id]?.config;
  return cfg?.dayDates && ctx._photoFestivalNight(null, cfg, utcMs) != null;
});

// ── FIXTURE 1: claimed ONLY by a GATED festival ───────────────────────────
const GATED = "edc-orlando-2026";
if (!sets[GATED]?.config?.dayDates) dead(`${GATED} has no data module — the gated fixture cannot be built`);
if (availableOf(GATED)) dead(`${GATED} is registry-AVAILABLE on this tree; it can no longer prove the gated case`);
// _allDataSets() always includes the ACTIVE festival regardless of gating, so
// this fixture only tests anything while the active festival is something else.
// Asked-vs-got: without this, a future default-festival change would turn the
// fixture green for entirely the wrong reason.
if (activeId === GATED) dead(`active festival is ${GATED}; the gated fixture would pass trivially`);
const gatedNight = nightsOf(GATED)[0];
const gatedInstant = instantFor(GATED, gatedNight);
if (gatedInstant == null) dead(`${GATED} night ${gatedNight} has no midnightUtc`);
const gatedClaimants = claimantsOf(gatedInstant);
if (gatedClaimants.length !== 1 || gatedClaimants[0] !== GATED) {
  dead(`gated fixture is not gated-only: claimants = [${gatedClaimants.join(", ")}]`);
}

// ── FIXTURE 2: claimed by NOBODY ──────────────────────────────────────────
const allInstants = ids.flatMap(id => nightsOf(id).map(n => instantFor(id, n))).filter(v => v != null);
if (!allInstants.length) dead("no night windows found across _DATA_SETS");
const unclaimedInstant = Math.min(...allInstants) - 365 * 24 * HOURS;
if (claimantsOf(unclaimedInstant).length !== 0) dead("the 'unclaimed' fixture is claimed by something");

// ── FIXTURE 3: claimed by TWO festivals ───────────────────────────────────
let multiInstant = null, multiClaimants = [];
for (const id of ids) {
  for (const n of nightsOf(id)) {
    const t = instantFor(id, n);
    if (t == null) continue;
    const c = claimantsOf(t);
    if (c.length > 1) { multiInstant = t; multiClaimants = c; break; }
  }
  if (multiInstant != null) break;
}
if (multiInstant == null) dead("no multi-claimant night window found — the ambiguity fixture cannot be built");

// ── FIXTURE 4: the ACTIVE festival's own capture time ──────────────────────
const activeInstant = instantFor(activeId, nightsOf(activeId)[0]);
if (activeInstant == null) dead(`active festival ${activeId} has no usable night window`);

console.log(`  · corpus: ${reg.length} registry rows, ${ids.length} data sets, active=${activeId}`);
console.log(`  · gated-only fixture: ${GATED} night ${gatedNight} @ ${new Date(gatedInstant).toISOString()}`);
console.log(`  · multi-claimant fixture: ${multiClaimants.join(" + ")} @ ${new Date(multiInstant).toISOString()}`);

// ── THE PREDICATE ─────────────────────────────────────────────────────────
const PRED = "_someFestivalClaimsCaptureTime";
const pred = ctx[PRED];
check(typeof pred === "function", `${PRED} must exist as a global predicate (found: ${typeof pred})`);

if (typeof pred === "function") {
  // Rule 1 — GATED (the live half). A capture time only a gated festival claims
  // is still a real capture time. Red on main: _allDataSets() filters it out.
  const gatedAnswer = pred(null, gatedInstant);
  check(gatedAnswer === true,
    `a capture time claimed only by GATED ${GATED} must be trusted — got ${JSON.stringify(gatedAnswer)}`);

  // Rule 2 — NOBODY. Stops a trivial `return true` from buying a pass.
  const unclaimedAnswer = pred(null, unclaimedInstant);
  check(unclaimedAnswer === false,
    `a capture time no festival claims must NOT be trusted — got ${JSON.stringify(unclaimedAnswer)}`);

  // Rule 3 — the answer carries NO festival identity. This is the structural
  // rule: on a multi-claimant window there is no honest single id, so the type
  // itself must not be able to express one. Red on main, which returns
  // {festivalId, night} chosen by declaration order.
  const multiAnswer = pred(null, multiInstant);
  check(multiAnswer === true,
    `a capture time claimed by ${multiClaimants.join(" + ")} must be trusted — got ${JSON.stringify(multiAnswer)}`);
  check(typeof multiAnswer === "boolean",
    `the trust answer must be a boolean, never a record carrying a festival id — got ${typeof multiAnswer}: ${JSON.stringify(multiAnswer)}`);

  // Rule 4 — ACTIVE (positive control). Stops a trivial `return false`, and
  // proves the walk still answers the ordinary case the callers depend on.
  const activeAnswer = pred(null, activeInstant);
  check(activeAnswer === true,
    `the ACTIVE festival's own capture time must be trusted — got ${JSON.stringify(activeAnswer)}`);

  // Rule 5 — no date and no instant is not a festival capture time.
  check(pred(null, null) === false, "a moment with neither date nor instant must not be trusted");
}

// ── Rule 6 — the mis-attribution path must be UNREACHABLE, not merely unused ──
// Source-level, deliberately: the point of the rename is that no caller CAN ask
// this question for a festival id. A behavioural check cannot see a path that a
// future edit would reintroduce, so this asserts the old name is gone from both
// the definition and every call site.
const SRC = ["photo-tag.jsx", "spotify.jsx"];
for (const f of SRC) {
  const txt = readFileSync(join(ROOT, f), "utf8");
  // POSITIVE CONTROL for this scan: if the file does not mention the predicate
  // at all, the read or the path is wrong and a "no old name found" result
  // would be a fact about the scan rather than about the file.
  const mentionsPredicate = txt.includes(PRED);
  check(mentionsPredicate, `${f} should reference ${PRED} (control: proves this scan is reading the right file)`);
  if (mentionsPredicate) {
    const stale = txt.split("_anyFestivalNight").length - 1;
    check(stale === 0,
      `${f} still references _anyFestivalNight ${stale}x — the first caller to read .festivalId inherits a silent mis-attribution`);
  }
}

console.log(failed === 0
  ? `  ✓ capture-time trust: boolean answer, gated festivals counted, ${multiClaimants.length}-way ambiguity carries no invented id (${checks} checks)`
  : `  ${failed} of ${checks} checks failed`);
process.exit(failed === 0 ? 0 : 1);
