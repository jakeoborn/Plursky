#!/usr/bin/env node
// test-scan-my-weekend.mjs: the pure half of "Scan my weekend" (v475).
//
// The iPhone app now reads the festival's nights straight from the photo
// library (PhotoScan plugin) instead of a hand pick in PHPicker, which strips
// GPS without full access and caps a pick at 50. The plugin only lists and
// exports; which ranges to ask for, which assets to keep and how each becomes
// matcher input live in photo-tag.jsx. This gate runs the SHIPPED build
// (build/data.js + build/photo-tag.js) in a vm and proves:
//   1. the query ranges cover every festival night window and nothing else:
//      ACL's two weekends are two separate asks, never the week between;
//      EDC LV's mornings between nights are left out;
//   2. an asset taken during ANY act, on either weekend, is kept by the
//      scan AND tagged by the matcher exactly as the same instant is tagged
//      through the existing EXIF path (same night, same act, same offers);
//   3. an asset's GPS fix and accuracy reach the matcher; 0,0, a negative
//      accuracy and a missing time are refused;
//   4. already-imported ids are skipped and counted, outside-night assets are
//      counted, and what is kept comes back oldest first;
//      import chunks hold up to 20 photos, and a video always goes alone;
//   5. the remembered-id store round-trips, de-duplicates, survives corrupt
//      storage and is capped with the oldest dropped first;
//   6. the import loop takes the library's meta instead of re-reading EXIF;
//   7. mutations: merging the ranges into one envelope, or dropping the
//      already-imported skip, each fail a check above.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEST_DIR = join(ROOT, "data", "festivals");
const MODS = readdirSync(FEST_DIR).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(FEST_DIR, f), "utf8")).join("\n");
const BUILD = n => readFileSync(join(ROOT, "build", `${n}.js`), "utf8");

function boot(dataSrc, photoTagSrc, store = {}) {
  const noop = () => {};
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
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
  return { C: ctx, store };
}

const H = 3600000;
const toMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const shiftOf = (cfg, wk) => (wk && cfg.weekendStartMs ? cfg.weekendStartMs[wk] - cfg.weekendStartMs.W1 : 0);
const actUtc = (cfg, a, wk, plus = 10) => cfg.dayDates[a.day].midnightUtc + shiftOf(cfg, wk) + (toMin(a.start) + plus) * 60000;
const inRanges = (ranges, ms) => ranges.some(r => ms >= r.startMs && ms <= r.endMs);
const offered = r => [r.artistId, ...(r.alternatives || [])].filter(Boolean).sort().join(",");

// Every check, against any build. Returns { fails, n }.
function scanChecks(C, store) {
  const fails = [];
  let n = 0;
  const t = (cond, msg) => { n++; if (!cond) fails.push(msg); };
  const acl = { id: "acl-2026", ...C._DATA_SETS["acl-2026"] };
  const edc = { id: "edc-lv-2026", ...C._DATA_SETS["edc-lv-2026"] };

  // ── 1. ranges ──────────────────────────────────────────────────────────
  for (const ds of [acl, edc]) {
    const cfg = ds.config;
    const ranges = C._scanQueryRanges(cfg);
    const wins = C._scanNightWindows(cfg);
    t(ranges.length > 0, `${ds.id}: no query ranges`);
    for (let i = 1; i < ranges.length; i++) t(ranges[i].startMs > ranges[i - 1].endMs, `${ds.id}: ranges ${i - 1} and ${i} overlap`);
    // Each night window is inside a range, and every range is made of windows.
    for (const w of wins) t(ranges.some(r => w.startMs >= r.startMs && w.endMs <= r.endMs), `${ds.id}: night ${w.night}${w.weekend ? " " + w.weekend : ""} is not covered`);
    const covered = ranges.reduce((s, r) => s + (r.endMs - r.startMs), 0);
    const union = wins.reduce((s, w) => s + (w.endMs - w.startMs), 0);
    t(covered <= union, `${ds.id}: ranges cover ${((covered - union) / H).toFixed(1)} h more than the nights do`);
    // Every instant the matcher puts on a night is inside a range, minute by
    // minute across the whole envelope, and nothing else is.
    const lo = ranges[0].startMs - 6 * H, hi = ranges[ranges.length - 1].endMs + 6 * H;
    let inside = 0, mismatch = 0;
    for (let ms = lo; ms <= hi; ms += 60000) {
      const night = !!C._photoFestivalNightWeekend(null, cfg, ms);
      if (night) inside++;
      if (night !== inRanges(ranges, ms)) mismatch++;
    }
    t(inside > 0 && mismatch === 0, `${ds.id}: ${mismatch} minutes disagree between the scan ranges and the matcher's nights`);
  }
  const aclRanges = C._scanQueryRanges(acl.config);
  const wk = acl.config.weekendStartMs;
  t(aclRanges.length >= 2, `ACL: the two weekends were one ask (${aclRanges.length} range)`);
  const midweek = wk.W1 + (wk.W2 - wk.W1) / 2;
  t(!inRanges(aclRanges, midweek), "ACL: the week between the weekends is scanned");
  const edcRanges = C._scanQueryRanges(edc.config);
  const morning = edc.config.dayDates[2].midnightUtc + 9 * H; // 09:00 local between nights
  t(!inRanges(edcRanges, morning), "EDC LV: 09:00 between nights is scanned");

  // ── 2. every act, both paths agree ─────────────────────────────────────
  for (const ds of [acl, edc]) {
    const cfg = ds.config;
    const ranges = C._scanQueryRanges(cfg);
    const weekends = cfg.weekendStartMs ? ["W1", "W2"] : [null];
    let total = 0, kept = 0, same = 0, sameNight = 0;
    const firstBad = [];
    for (const w of weekends) {
      for (const a of ds.artists) {
        if (w && a.weekend && a.weekend !== "both" && a.weekend !== w) continue;
        if (!cfg.dayDates[a.day] || !a.start) continue;
        const ms = actUtc(cfg, a, w);
        total++;
        const asset = { id: `x-${a.id}-${w}`, mediaType: "image", createdMs: ms };
        const pick = C._scanPickAssets([asset], cfg, new Set());
        if (pick.keep.length === 1 && inRanges(ranges, ms)) kept++;
        const viaScan = C._matchArtistForPhoto(C._photoKitAssetMeta(asset, cfg), [], [], ds);
        const viaExif = C._matchArtistForPhoto({ date: C._wallClockFromUtc(ms, cfg) }, [], [], ds);
        if (viaScan.night === viaExif.night && viaScan.night === a.day) sameNight++;
        if (viaScan.night === viaExif.night && offered(viaScan) === offered(viaExif)) same++;
        else if (firstBad.length < 3) firstBad.push(`${a.id}: ${offered(viaScan)} vs ${offered(viaExif)}`);
      }
    }
    t(total > 20, `${ds.id}: fixture too small (${total} acts)`);
    t(kept === total, `${ds.id}: ${total - kept} of ${total} act-time assets were not kept by the scan`);
    t(sameNight === total, `${ds.id}: ${total - sameNight} of ${total} act-time assets got the wrong night`);
    t(same === total, `${ds.id}: ${total - same} of ${total} act-time assets tagged differently from the EXIF path (${firstBad.join("; ")})`);
  }

  // ── 3. meta from one asset ─────────────────────────────────────────────
  const cfg = edc.config;
  const a0 = edc.artists.find(a => cfg.dayDates[a.day] && a.start);
  const ms0 = actUtc(cfg, a0, null);
  const m = C._photoKitAssetMeta({ id: "g", createdMs: ms0, lat: 36.27, lng: -115.01, acc: 8 }, cfg);
  t(m && m.rawUtcMs === ms0, "rawUtcMs is not the asset's own instant");
  t(m && m.lat === 36.27 && m.lng === -115.01 && m.acc === 8, `GPS fix or accuracy lost (${JSON.stringify(m)})`);
  t(m && m.timestampSource === "photokit" && m.locationSource === "photokit-gps", "sources not marked photokit");
  t(m && JSON.stringify(m.date) === JSON.stringify(C._wallClockFromUtc(ms0, cfg)), "wall clock is not the festival-local one");
  const z = C._photoKitAssetMeta({ id: "z", createdMs: ms0, lat: 0, lng: 0, acc: 5 }, cfg);
  t(z && z.lat === null && z.lng === null && z.acc === null && z.locationSource === "none", "0,0 was treated as a place");
  const neg = C._photoKitAssetMeta({ id: "n", createdMs: ms0, lat: 36.27, lng: -115.01, acc: -1 }, cfg);
  t(neg && neg.lat === 36.27 && neg.acc === null, "a negative accuracy was kept");
  t(C._photoKitAssetMeta({ id: "t" }, cfg) === null, "an asset with no time produced meta");
  t(C._photoKitAssetMeta({ id: "t", createdMs: "nope" }, cfg) === null, "an asset with a junk time produced meta");

  // ── 4. picking ─────────────────────────────────────────────────────────
  const assets = [
    { id: "late", createdMs: ms0 + 20 * 60000 },
    { id: "seen", createdMs: ms0 + 5 * 60000 },
    { id: "early", createdMs: ms0 },
    { id: "out", createdMs: morning },
    { createdMs: ms0 },
  ];
  const p = C._scanPickAssets(assets, cfg, new Set(["seen"]));
  t(p.keep.map(x => x.id).join(",") === "early,late", `kept ${p.keep.map(x => x.id).join(",")}, want early,late`);
  t(p.already === 1, `already-imported count ${p.already}, want 1`);
  t(p.outside === 1, `outside-night count ${p.outside}, want 1`);
  const p2 = C._scanPickAssets(assets, cfg, ["seen"]);
  t(p2.keep.length === 2, "an array of seen ids is not honoured");

  // Chunks: videos alone, photos up to 20, order kept.
  const seq = [...Array(45)].map((_, i) => ({ id: `p${i}`, mediaType: (i === 7 || i === 8 || i === 30) ? "video" : "image" }));
  const ch = C._scanChunks(seq);
  t(ch.flat().map(x => x.id).join(",") === seq.map(x => x.id).join(","), "chunking lost or reordered assets");
  t(ch.every(c => !c.some(x => x.mediaType === "video") || c.length === 1), "a video shared a chunk");
  t(ch.every(c => c.length <= 20), "a chunk held more than 20 photos");
  t(ch.length === 7, `45 assets with 3 videos made ${ch.length} chunks, want 7`);

  // ── 5. remembered ids ──────────────────────────────────────────────────
  for (const k of Object.keys(store)) delete store[k];
  t(C._scanSeenRead().size === 0, "fresh store is not empty");
  C._scanSeenAdd(["a", "b", "a"]);
  C._scanSeenAdd(["b", "c", 7]);
  t([...C._scanSeenRead()].join(",") === "a,b,c", `store holds ${[...C._scanSeenRead()].join(",")}, want a,b,c`);
  store.plursky_scan_seen_v1 = "{not json";
  t(C._scanSeenRead().size === 0, "corrupt storage did not read as empty");
  for (const k of Object.keys(store)) delete store[k];
  const many = Array.from({ length: 20005 }, (_, i) => `id${i}`);
  const len = C._scanSeenAdd(many);
  const back = C._scanSeenRead();
  t(len === 20000 && back.size === 20000, `cap not applied (${back.size})`);
  t(!back.has("id0") && back.has("id20004"), "the cap did not drop the oldest first");
  for (const k of Object.keys(store)) delete store[k];

  return { fails, n };
}

let checks = 0, mutations = 0;
const fails = [];
const DATA = BUILD("data"), PT = BUILD("photo-tag");
const live = boot(DATA, PT);
if (typeof live.C._scanQueryRanges !== "function" || !live.C._DATA_SETS?.["acl-2026"]?.config?.weekendStartMs)
  { console.error("  ✗ HARNESS DEAD: the compiled scan helpers or ACL weekends did not load"); process.exit(1); }
const res = scanChecks(live.C, live.store);
checks += res.n; fails.push(...res.fails);

// ── 6. the import loop takes the library's meta ──────────────────────────
{
  const SP = BUILD("spotify");
  checks++;
  // Compiled output: whitespace is normalised so a reformat cannot hide it.
  const flat = SP.replace(/\s+/g, " ");
  if (!/(?:var|const|let) pk = f\.photoKitMeta \|\| null;/.test(flat) || !/pk \? null : await _parseExifMeta\(f\)/.test(flat)
      || !/pk \? \{ \.\.\.pk, takenAtSource: "photokit" \} : _metaFromFile\(f, exif\)/.test(flat))
    fails.push("processImportedFiles no longer uses a scanned file's own meta");
  checks++;
  if (!/photokit: \{ text: "AUTO · PHOTO LIBRARY"/.test(flat)) fails.push("the photokit tag source has no card label");
}

// ── 7. mutations ─────────────────────────────────────────────────────────
for (const [label, from, to] of [
  ["ranges merged into one envelope", "if (last && w.startMs <= last.endMs)", "if (last)"],
  ["already-imported skip dropped", "if (seen.has(a.id)) {", "if (false) {"],
]) {
  if (!PT.includes(from)) { fails.push(`mutation "${label}": anchor not found in build/photo-tag.js`); continue; }
  const m = boot(DATA, PT.replace(from, to));
  const r = scanChecks(m.C, m.store);
  mutations++;
  if (!r.fails.length) fails.push(`mutation "${label}" was not caught`);
}

if (fails.length) {
  for (const f of fails) console.log(`  ✗  ${f}`);
  console.log(`\n✗ ${fails.length} of ${checks + mutations} Scan my weekend checks failed`);
  process.exit(1);
}
console.log(`  ✓ ${checks} Scan my weekend checks · ${mutations} mutations caught`);
