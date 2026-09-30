#!/usr/bin/env node
// test-weekend-photo-tag.mjs — photo tagging respects a two-weekend festival
// (lane ruling 2026-09-23, issue #225).
//
// ACL's dayDates describe weekend one; weekendStartMs says the days repeat.
// The photo matcher read dayDates only and never read an act's `weekend`, so:
//   - every weekend-2 photo was outside the festival window: no night, no set;
//   - a weekend-1 photo could be tagged to, or offered, a weekend-2-only act.
//
// This gate runs the SHIPPED build (build/data.js + build/photo-tag.js) in a
// vm and proves:
//   1. a weekend-2 photo during every weekend-2 act gets that act's night and
//      is tagged to or offered that act, never a weekend-1-only one;
//   2. a weekend-1 photo is never tagged to or offered a weekend-2-only act;
//   3. a "both" act matches on both weekends;
//   4. saved/attended matching rejects a wrong-weekend act;
//   5. single-weekend festivals are untouched: a fixed EDC LV sample recorded
//      from main's build, and the whole fleet with the weekend code cut out;
//   6. mutations: dropping the weekend filter, or the weekend-2 night
//      resolution, from the compiled matcher each break a check above.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEST_DIR = join(ROOT, "data", "festivals");
const MODS = readdirSync(FEST_DIR).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(FEST_DIR, f), "utf8")).join("\n");
const BUILD = n => readFileSync(join(ROOT, "build", `${n}.js`), "utf8");

function boot(dataSrc, photoTagSrc) {
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
  vm.runInContext(dataSrc, ctx, { filename: "build/data.js" });
  vm.runInContext(photoTagSrc, ctx, { filename: "build/photo-tag.js" });
  return ctx;
}

let checks = 0, mutations = 0;
const fails = [];
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };

const toMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const SHIFTS = cfg => {
  const w = cfg.weekendStartMs;
  return w ? { W1: 0, W2: w.W2 - w.W1 } : { W1: 0 };
};
// A photo `plus` minutes into act `a`, on weekend `wk`, with no GPS: the
// wall clock a phone at the festival would stamp, as EXIF gives it.
const photoFor = (C, ds, a, wk, plus = 10, extra = {}) => {
  const cfg = ds.config;
  const utc = cfg.dayDates[a.day].midnightUtc + SHIFTS(cfg)[wk] + (toMin(a.start) + plus) * 60000;
  return { date: C._wallClockFromUtc(utc, cfg), ...extra };
};
const match = (C, ds, a, wk, { plus = 10, saved = [], attended = [], gps } = {}) =>
  C._matchArtistForPhoto(photoFor(C, ds, a, wk, plus, gps || {}), saved, attended, ds);
const offered = r => new Set([r.artistId, ...(r.alternatives || [])].filter(Boolean));

// The two-weekend checks, run against any build. Returns the failures only.
function weekendChecks(C) {
  const out = [];
  let n = 0;
  const t = (cond, msg) => { n++; if (!cond) out.push(msg); };
  const ds = { id: "acl-2026", ...C._DATA_SETS["acl-2026"] };
  const A = ds.artists;
  const byId = Object.fromEntries(A.map(a => [a.id, a]));
  const plays = (id, wk) => { const a = byId[id]; return !a.weekend || a.weekend === "both" || a.weekend === wk; };
  // 1. weekend 2: every act that plays W2 (W2-only and "both")
  let w2Photos = 0, w2Night = 0, w2Own = 0;
  for (const a of A.filter(x => plays(x.id, "W2"))) {
    const r = match(C, ds, a, "W2"); w2Photos++;
    if (r.night === a.day) w2Night++;
    if (offered(r).has(a.id)) w2Own++;
    const bad = [...offered(r)].filter(id => !plays(id, "W2"));
    t(!bad.length, `W2 photo during ${a.id} offered weekend-1-only act(s) ${bad.join(",")}`);
  }
  t(w2Night === w2Photos, `weekend 2: ${w2Photos - w2Night} of ${w2Photos} photos got the wrong night or none`);
  t(w2Own === w2Photos, `weekend 2: ${w2Photos - w2Own} of ${w2Photos} photos were neither tagged to nor offered their own act`);
  // 2. weekend 1: never a W2-only act, tagged or offered
  let w1Bad = 0, w1Own = 0, w1Photos = 0;
  for (const a of A.filter(x => plays(x.id, "W1"))) {
    const r = match(C, ds, a, "W1"); w1Photos++;
    if (offered(r).has(a.id)) w1Own++;
    if ([...offered(r)].some(id => !plays(id, "W1"))) w1Bad++;
  }
  t(w1Bad === 0, `weekend 1: ${w1Bad} of ${w1Photos} photos were tagged to or offered a weekend-2-only act`);
  t(w1Own === w1Photos, `weekend 1: ${w1Photos - w1Own} of ${w1Photos} photos were neither tagged to nor offered their own act`);
  // A W2-only act tagged outright (it is the time-nearest act on W2).
  const soloW2 = A.find(a => a.weekend === "W2" && match(C, ds, a, "W2").artistId === a.id);
  t(!!soloW2, "no weekend-2-only act is ever tagged outright on weekend 2");
  // 3. a "both" act matches on both weekends
  const both = A.find(a => a.weekend === "both" && match(C, ds, a, "W1").artistId === a.id);
  t(!!both, "no 'both' act is tagged outright on weekend 1 (fixture)");
  if (both) {
    const r2 = match(C, ds, both, "W2");
    t(r2.artistId === both.id && r2.night === both.day, `'both' act ${both.id} on weekend 2 was ${r2.reason}/${r2.artistId}/night ${r2.night}`);
  }
  // 4. saved/attended: a saved W2-only act must not claim a weekend-1 photo in its slot
  const w2only = A.find(a => a.weekend === "W2");
  for (const [label, opts] of [["saved", { saved: [w2only.id] }], ["attended", { attended: [w2only.id] }]]) {
    const r1 = match(C, ds, w2only, "W1", opts);
    t(r1.artistId !== w2only.id && !offered(r1).has(w2only.id),
      `${label} weekend-2-only ${w2only.id} claimed a weekend-1 photo (${r1.reason})`);
    const r2 = match(C, ds, w2only, "W2", opts);
    t(r2.artistId === w2only.id && r2.reason === `${label}_set_time`,
      `${label} weekend-2-only ${w2only.id} did not claim its own weekend-2 photo (${r2.reason}/${r2.artistId})`);
  }
  return { out, n, w1Photos, w2Photos };
}

const DATA = BUILD("data"), PT = BUILD("photo-tag");
const live = boot(DATA, PT);
if (typeof live._matchArtistForPhoto !== "function" || !live._DATA_SETS?.["acl-2026"]?.config?.weekendStartMs)
  { console.error("  ✗ HARNESS DEAD: the compiled matcher or ACL weekends did not load"); process.exit(1); }

const res = weekendChecks(live);
for (const f of res.out) fails.push(f);
checks += res.n;

// 5. single-weekend festivals are untouched.
// 5a. EDC LV, a fixed sample recorded from main's compiled build (62aca38)
//     before this change: no GPS, a late photo, a saved set, and GPS at two
//     stage anchors.
const EDC_SAMPLE = [
  { act: "k1",   plus: 10, want: { reason: "matched", artistId: "k1", night: 1, ambiguous: true } },
  { act: "k26",  plus: 10, want: { reason: "matched", artistId: "k26", night: 3, ambiguous: true } },
  { act: "n9",   plus: 70, want: { reason: "matched", artistId: "q13", night: 2, ambiguous: true } },
  { act: "c19",  plus: 10, saved: true, want: { reason: "saved_set_time", artistId: "c19", night: 2, ambiguous: false } },
  { act: "k6",   plus: 10, gps: "kinetic", want: { reason: "off_stage", artistId: null, night: 1, ambiguous: false } },
  { act: "cg14", plus: 10, gps: "quantum", want: { reason: "matched", artistId: "q14", night: 2, ambiguous: true } },
];
{
  const ds = { id: "edc-lv-2026", ...live._DATA_SETS["edc-lv-2026"] };
  for (const c of EDC_SAMPLE) {
    const a = ds.artists.find(x => x.id === c.act), g = c.gps && ds.config.gpsAnchors.find(x => x.stageId === c.gps);
    if (!a || (c.gps && !g)) { ok(false, `EDC LV sample ${c.act}: fixture act or anchor missing`); continue; }
    const r = match(live, ds, a, "W1", { plus: c.plus, saved: c.saved ? [a.id] : [], gps: g ? { lat: g.lat, lng: g.lng, acc: 10 } : undefined });
    const got = { reason: r.reason, artistId: r.artistId, night: r.night, ambiguous: !!r.ambiguous };
    ok(JSON.stringify(got) === JSON.stringify(c.want), `EDC LV ${c.act} changed: ${JSON.stringify(got)}, main gave ${JSON.stringify(c.want)}`);
  }
}
// 5b. Every single-weekend festival: the shipped matcher and the same matcher
//     with its weekend handling cut out return identical results, so the
//     weekend code is a no-op wherever weekendStartMs is absent. (This build
//     matched main's on all 1,560 samples when it was written; comparing to a
//     frozen build would go stale with every lineup edit.)
const WEEKEND_CUTS = [[".filter(a => actPlaysWeekend(a, nw.weekend))", ""], ["festivalWeekendShifts(cfg)", "[{ weekend: null, shift: 0 }]"]];
const base = boot(DATA, WEEKEND_CUTS.reduce((src, [f, t]) => src.replace(f, t), PT));
function fleetDiff(L) {
  let sample = 0, same = 0;
  const diffs = [];
  for (const [id, raw] of Object.entries(L._DATA_SETS)) {
    if (raw.config?.weekendStartMs || !raw.config?.dayDates) continue;
    const dsL = { id, ...raw }, dsB = { id, ...base._DATA_SETS[id] };
    const acts = (raw.artists || []).filter(a => a.start && a.end && raw.config.dayDates[a.day]).slice(0, 40);
    const anchor = (raw.config.gpsAnchors || [])[0];
    for (const a of acts) for (const opts of [{}, { saved: [a.id] }, { plus: 70 },
        anchor ? { gps: { lat: anchor.lat, lng: anchor.lng, acc: 10 } } : null].filter(Boolean)) {
      sample++;
      const l = JSON.stringify(match(L, dsL, a, "W1", opts)), b = JSON.stringify(match(base, dsB, a, "W1", opts));
      if (l === b) same++; else if (diffs.length < 5) diffs.push(`${id}/${a.id}/${JSON.stringify(opts)}`);
    }
  }
  return { sample, same, diffs };
}
const fleet = fleetDiff(live);
ok(fleet.sample > 200, `single-weekend sample too small (${fleet.sample}); the harness is not walking the fleet`);
ok(fleet.same === fleet.sample, `weekend handling changed single-weekend results on ${fleet.sample - fleet.same} of ${fleet.sample}: ${fleet.diffs.join(" · ")}`);

// 6. mutations on the compiled matcher
const mustBreak = (label, from, to) => {
  mutations++;
  if (!PT.includes(from)) { fails.push(`mutation anchor missing: ${label}`); return; }
  const r = weekendChecks(boot(DATA, PT.replace(from, to)));
  ok(r.out.length > 0, `mutation not caught: ${label}`);
};
mustBreak("drop the weekend filter", ".filter(a => actPlaysWeekend(a, nw.weekend))", "");
mustBreak("drop weekend-2 night resolution", "festivalWeekendShifts(cfg)", "[{ weekend: null, shift: 0 }]");
// And 5b can fail: shift every set window by an hour, which a single-weekend
// festival must notice.
{
  mutations++;
  const from = "dm.midnightUtc + nw.shift;";
  if (!PT.includes(from)) fails.push("mutation anchor missing: shift single-weekend set windows");
  else { const f = fleetDiff(boot(DATA, PT.replace(from, "dm.midnightUtc + nw.shift + 3600000;")));
         ok(f.same < f.sample, "mutation not caught: shifting set windows left every single-weekend result unchanged"); }
}

if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} weekend photo-tag checks failed`); process.exit(1); }
console.log(`  ✓ Weekend photo tagging: ACL W1 ${res.w1Photos} + W2 ${res.w2Photos} photos on their own weekend's acts, ` +
  `'both' matches both, saved/attended reject the wrong weekend, EDC LV sample as on main, ${fleet.sample} single-weekend samples unchanged by the weekend code, ` +
  `${checks} checks (${mutations} mutations, each caught)`);
