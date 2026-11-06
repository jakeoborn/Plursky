#!/usr/bin/env node
// SPEC-179 PR B: the photo tagger speaks for a stage only through the one fix
// gate (#366), and "Wrong act? Fix it" searches the clip's own festival with
// stylized names folded. On the REAL compiled photo-tag.js + spotify.js and
// the real III Points 2026 data, with ACL active (so the active lineup is the
// wrong one on purpose):
//   1. A clip at 23:31 on Sat Oct 17 with a precise fix at RC95 is Yousuke
//      Yukimatsu ("¥ØU$UK€ ¥UK1MAT$U", RC95 23:15-00:30), never horsegiirL
//      (Sector 3, 23:30-00:20) — also when horsegiirL is saved or attended.
//      RC95's pin is a poster read, so the tag is flagged and horsegiirL stays
//      offered.
//   2. No fix, a coarse fix (>100 m), an unknown accuracy, or a fix too close
//      to call between two pins makes no stage claim: several acts playing →
//      untagged, every playing act offered, no "latest start wins".
//   3. A precise fix at Sector 3 is horsegiirL (positive control).
//   4. Fix-it: "Yukimatsu", "yousuke", "YUKI MATSU" find the stylized billing in
//      the clip's festival; the active festival's acts are not offered; with no
//      query the matcher's alternatives come first.
// Then mutations on the built source, each of which must be caught.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const DATA_BUILT = readFileSync(join(ROOT, "build", "data.js"), "utf8");
const TAG_BUILT = readFileSync(join(ROOT, "build", "photo-tag.js"), "utf8");
const SPOTIFY_BUILT = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const noop = () => {};

function boot({ data = DATA_BUILT, tag = TAG_BUILT, spotify = SPOTIFY_BUILT } = {}) {
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = { active_festival_id: "acl-2026", active_festival_explicit: "1" };
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: () => 0, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
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
  vm.runInContext(data, ctx, { filename: "build/data.js" });
  vm.runInContext(tag, ctx, { filename: "build/photo-tag.js" });
  vm.runInContext(spotify, ctx, { filename: "build/spotify.js" });
  // lineup.js owns toNightMin; loading the whole screen file here would drag in
  // its UI, so take the one pure helper from it.
  const LINEUP = readFileSync(join(ROOT, "build", "lineup.js"), "utf8");
  const fn = /function toNightMin\([\s\S]*?\n\}/.exec(LINEUP);
  if (!fn) throw new Error("toNightMin not found in build/lineup.js");
  vm.runInContext(fn[0], ctx);
  return ctx;
}

const YUKI = "iiip-u-uk-uk1mat-u", HORSE = "iiip-horsegiirl";

function checks(C) {
  const fails = []; let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  const ds = { id: "iii-points-2026", ...C._DATA_SETS["iii-points-2026"] };
  const cfg = ds.config;
  const yuki = ds.artists.find(a => a.id === YUKI), horse = ds.artists.find(a => a.id === HORSE);
  t(!!yuki && yuki.stage === "rc95" && yuki.start === "23:15" && yuki.day === 2, "fixture: Yukimatsu RC95 23:15 day 2 moved");
  t(!!horse && horse.stage === "sec3" && horse.start === "23:30" && horse.day === 2, "fixture: horsegiirL Sector 3 23:30 day 2 moved");
  t(C.FESTIVAL_CONFIG && C.FESTIVAL_CONFIG.id !== "iii-points-2026", "fixture: III Points must NOT be the active festival here");
  if (!yuki || !horse) return { n, fails };
  const pin = id => C.resolvedStageAnchors(cfg).find(g => g.stageId === id);
  const rc95 = pin("rc95"), sec3 = pin("sec3");
  const ms = cfg.dayDates[2].midnightUtc + (23 * 60 + 31) * 60000;
  const meta = (extra) => ({ date: C._wallClockFromUtc(ms, cfg), rawUtcMs: ms, lat: null, lng: null, acc: null, ...extra });
  const at = (g, acc = 10) => ({ lat: g.lat, lng: g.lng, acc });
  const m = (extra, saved = [], attended = []) => C._matchArtistForPhoto(meta(extra), saved, attended, ds);
  const s = r => JSON.stringify([r.reason, r.artistId, r.ambiguous, (r.alternatives || []).length]);

  // 1. Precise fix at RC95.
  const r1 = m(at(rc95));
  t(r1.artistId === YUKI && r1.reason === "stage_gps_time", `RC95 fix at 23:31 → Yukimatsu (got ${s(r1)})`);
  t(r1.artistId !== HORSE, "RC95 fix at 23:31 must never be horsegiirL");
  t(r1.ambiguous === true && (r1.alternatives || []).includes(HORSE), "poster-read pin: flagged, horsegiirL offered");
  t(r1.gpsGate && r1.gpsGate.status === "trusted" && r1.gpsGate.stageId === "rc95", "the gate's verdict is on the record");
  const r1s = m(at(rc95), [HORSE]);
  t(r1s.artistId === YUKI && /over-saved/.test(r1s.evidence || ""), `RC95 fix beats a saved horsegiirL (got ${s(r1s)})`);
  const r1a = m(at(rc95), [], [HORSE]);
  t(r1a.artistId === YUKI && /over-attended/.test(r1a.evidence || ""), `RC95 fix beats an attended horsegiirL (got ${s(r1a)})`);
  const r1y = m(at(rc95), [YUKI]);
  t(r1y.artistId === YUKI && r1y.reason === "saved_set_time" && r1y.suggested === false, `saved Yukimatsu + RC95 fix is confirmed (got ${s(r1y)})`);

  // 2. No stage claim without a trusted fix.
  for (const [label, extra] of [["no GPS", {}], ["coarse 150 m", at(rc95, 150)], ["unknown accuracy", { lat: rc95.lat, lng: rc95.lng, acc: null }]]) {
    const r = m(extra);
    t(r.artistId === null && r.reason === "several_playing", `${label}: untagged (got ${s(r)})`);
    t((r.alternatives || []).includes(YUKI) && (r.alternatives || []).includes(HORSE), `${label}: both acts offered`);
  }
  {
    // Halfway between RC95 and its nearest neighbour pin: margin < 35 m.
    const others = C.resolvedStageAnchors(cfg).filter(g => g.stageId !== "rc95")
      .map(g => ({ g, d: C._haversineMeters(rc95.lat, rc95.lng, g.lat, g.lng) })).sort((a, b) => a.d - b.d);
    const nb = others[0].g;
    const mid = { lat: (rc95.lat + nb.lat) / 2, lng: (rc95.lng + nb.lng) / 2, acc: 10 };
    const r = m(mid);
    t(r.gpsGate && r.gpsGate.status === "ambiguous", `midpoint RC95/${nb.stageId} is ambiguous (got ${r.gpsGate && r.gpsGate.status})`);
    t(r.artistId !== HORSE && r.reason !== "stage_gps_time", `ambiguous fix makes no stage claim (got ${s(r)})`);
  }
  // 2b. Saved horsegiirL, no GPS: the saved guess stays a suggestion (unchanged).
  const r2s = m({}, [HORSE]);
  t(r2s.artistId === HORSE && r2s.suggested === true, `saved horsegiirL, no GPS → suggestion (got ${s(r2s)})`);

  // 3. Positive control: a precise fix at Sector 3 is horsegiirL.
  const r3 = m(at(sec3));
  t(r3.artistId === HORSE && r3.reason === "stage_gps_time", `Sector 3 fix → horsegiirL (got ${s(r3)})`);

  // 4. Fix-it search.
  t(C.billedNameMatches(yuki.name, "Yukimatsu"), "\"Yukimatsu\" finds the stylized billing");
  t(C.billedNameMatches(yuki.name, "yousuke"), "\"yousuke\" finds it");
  t(C.billedNameMatches(yuki.name, "YUKI MATSU"), "\"YUKI MATSU\" finds it");
  t(!C.billedNameMatches(horse.name, "Yukimatsu"), "\"Yukimatsu\" does not find horsegiirL");
  t(C.billedNameMatches("Kölsch", "kolsch"), "accents fold");
  t(!C.billedNameMatches(yuki.name, ""), "an empty query matches nothing");
  const clip = { id: "c1", festivalId: "iii-points-2026", night: 2, takenAt: C._momentDatePartsToTakenAt(C._wallClockFromUtc(ms, cfg)),
                 tagAlternatives: [YUKI, HORSE] };
  t(/ 23:31$/.test(clip.takenAt || ""), `fixture: clip takenAt is 23:31 local (got ${clip.takenAt})`);
  const found = C._retagOptionsFor(clip, "Yukimatsu").map(a => a.id);
  t(found.includes(YUKI), `Fix-it "Yukimatsu" on a III Points clip finds him (got ${JSON.stringify(found)})`);
  const activeIds = new Set((C.ARTISTS || []).map(a => a.id));
  const anyActive = C._retagOptionsFor(clip, "a").some(a => activeIds.has(a.id) && !ds.artists.some(x => x.id === a.id));
  t(!anyActive, "Fix-it never offers the active festival's acts for a III Points clip");
  const quick = C._retagOptionsFor(clip, "").map(a => a.id);
  t(quick[0] === YUKI && quick[1] === HORSE, `no query: alternatives first (got ${JSON.stringify(quick.slice(0, 3))})`);
  return { n, fails };
}

// Patterns match the COMPILED output.
const MUTANTS = [
  ["no trusted-fix step (GPS ignored again)", "tag", [/if \(trustedStage\) \{/, "if (false) {"]],
  ["latest start wins again", "tag", [/var several = candidates\.slice\(\)\.sort\(\(x, y\) => x\.startMin - y\.startMin/, "var several = candidates.slice().sort((x, y) => y.startMin - x.startMin"],
    (src) => src.replace(/artistId: null,(\s*)night,(\s*)festivalId,(\s*)resolvedBy,(\s*)reason: "several_playing",(\s*)ambiguous: true,(\s*)anchorSource: null,(\s*)alternatives: several/, 'artistId: several[0].a.id,$1night,$2festivalId,$3resolvedBy,$4reason: "several_playing",$5ambiguous: true,$6anchorSource: null,$7alternatives: several')],
  ["the old ±200 m accuracy", "data", [/var STAGE_FIX_PHOTO = \{\s*maxAgeMs: Infinity,\s*maxAccM: 100,/, "var STAGE_FIX_PHOTO = { maxAgeMs: Infinity, maxAccM: 200,"]],
  ["no margin rule", "data", [/maxDistM: 140,\s*minMarginM: 35\s*\};\s*\n(\s*\/\/[^\n]*\n)*\s*function stageFixGate/, (x) => x.replace(/minMarginM: 35/, "minMarginM: 0")]],
  ["stylized letters not folded", "data", [/\.replace\(\/\[¥ø\$€1\]\/g, c => _STYLIZED_LETTERS\[c\]\)/, ""]],
  ["Fix-it searches the active festival", "spotify", [/if \(q\) return lineup\.filter\(a => billedNameMatches\(a\.name, q\)\)/, "if (q) return ARTISTS.filter(a => billedNameMatches(a.name, q))"]],
  ["alternatives not first", "spotify", [/var r = a => rank\.has\(a\.id\) \? rank\.get\(a\.id\) : 1e6;/, "var r = a => 0;"]],
];

const base = checks(boot());
let caught = 0;
const mutantFails = [];
for (const [name, file, [re, rep], extra] of MUTANTS) {
  const src = { tag: TAG_BUILT, data: DATA_BUILT, spotify: SPOTIFY_BUILT }[file];
  if (!re.test(src)) { mutantFails.push(`mutant "${name}" did not apply (pattern missing)`); continue; }
  let mut = src.replace(re, rep);
  if (extra) { const m2 = extra(mut); if (m2 === mut) { mutantFails.push(`mutant "${name}" second edit did not apply`); continue; } mut = m2; }
  let r;
  try { r = checks(boot({ [file]: mut })); } catch (e) { r = { fails: ["threw: " + e.message] }; }
  if (r.fails.length) caught++; else mutantFails.push(`mutant "${name}" survived`);
}
const all = [...base.fails, ...mutantFails];
console.log(`  tagger-trusted-gps: ${base.n} checks, ${caught}/${MUTANTS.length} mutants caught`);
if (all.length) { for (const f of all) console.log(`  ✗ ${f}`); process.exit(1); }
console.log("  ✓ GPS names a stage only through the fix gate: Yukimatsu at RC95 23:31 is never horsegiirL; Fix-it finds stylized names in the clip's own festival");
