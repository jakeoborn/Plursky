#!/usr/bin/env node
// Offline festival packs — the pure half: area, tiles, style rewrite, keys, status.
//
// Runs the REAL compiled code (build/data.js + build/map.js) in a vm. No
// browser, no network — the download/offline/expired end-to-end run is
// scripts/e2e-offline-packs.mjs (it needs OpenFreeMap and unpkg, so it is not
// part of the gate).
//   1. Every festival with a location: the saved area covers the on-site
//      radius, the footprint, and RealMap's pan bounds, with a bounded tile count.
//   2. The style rewrite points every source, glyph and sprite at pack:// and
//      leaves layers and the input alone.
//   3. The key the DOWNLOADER writes equals the key the PROTOCOL reads, for
//      tiles, rasters, URL-encoded glyph fontstacks and @2x sprites.
//   4. Status: none / ready / stale / over, and an ended festival is "over"
//      even when its schedule also moved.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean).map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
const noop = () => {};
const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop, remove: noop } });
const store = {};
const ctx = {
  console: { log: noop, warn: noop, error: noop }, Date, Math, JSON, Object, Array, Promise,
  String, Number, Boolean, Set, Map, WeakMap, Symbol, Proxy, Reflect, RegExp, Error, isNaN, parseInt, parseFloat, isFinite, Intl,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  fetch: () => new Promise(noop), URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
  document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
              createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
              head: { appendChild: noop } },
  React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
  ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
ctx.addEventListener = noop; ctx.removeEventListener = noop;
ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
vm.createContext(ctx);
vm.runInContext(MODS, ctx);
for (const n of ["data", "map"]) vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
const P = vm.runInContext("({ _packBBox, _packTiles, _packStyle, _packKey, _packStatus, _packWindow, REG: FESTIVALS_REGISTRY })", ctx);

let checks = 0, failed = 0;
const js = v => JSON.stringify(v);
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── 1. Area + tiles, every festival with a location ─────────────────────────
{
  const inside = (b, lat, lng) => lat >= b.s && lat <= b.n && lng >= b.w && lng <= b.e;
  let n = 0, maxTiles = 0, worst = "";
  for (const e of P.REG) {
    const c = e.config;
    if (!c || !c.gps || !Number.isFinite(c.gps.lat)) { check(P._packBBox(c) === null, `${c && c.id}: no gps must mean no pack area`); continue; }
    const b = P._packBBox(c);
    const r = Math.max(c.gps.onSiteRadiusMi || 0, 0.25) * 1.609 / 111.32;
    check(inside(b, c.gps.lat + r, c.gps.lng) && inside(b, c.gps.lat - r, c.gps.lng), `${c.id}: area misses the on-site radius`);
    const fp = (c.venue && c.venue.footprint) || c.footprint || [];
    check(fp.every(([la, lo]) => inside(b, la, lo)), `${c.id}: area misses a footprint vertex`);
    const fb = c.venue && c.venue.festivalBounds;
    if (fb) check(inside(b, fb.north + 0.004, fb.west - 0.004) && inside(b, fb.south - 0.004, fb.east + 0.004), `${c.id}: area misses RealMap's pan bounds`);
    const tiles = P._packTiles(b, 10, 14);
    check(tiles.length > 0 && tiles.length <= 120, `${c.id}: ${tiles.length} tiles at z10–14`);
    check(new Set(tiles.map(t => t.join("/"))).size === tiles.length, `${c.id}: duplicate tiles`);
    check([10, 11, 12, 13, 14].every(z => tiles.some(t => t[0] === z)), `${c.id}: a zoom level has no tiles`);
    if (tiles.length > maxTiles) { maxTiles = tiles.length; worst = c.id; }
    n++;
  }
  check(n >= 18, `only ${n} festivals have a pack area (18 at v309: every registry entry with a gps)`);
  // No real festival's pan box reaches past its on-site radius today (EDC's
  // sits inside it), so removing the festivalBounds union went uncaught. A
  // fixture with a tiny radius and a wide pan box proves the union itself.
  const fx = { id: "fixture", gps: { lat: 36, lng: -115, onSiteRadiusMi: 0.1 },
               venue: { festivalBounds: { north: 36.03, south: 35.97, west: -115.03, east: -114.97 } } };
  const fxb = P._packBBox(fx);
  check(inside(fxb, 36.034, -115.034) && inside(fxb, 35.966, -114.966), "a pan box wider than the on-site radius is covered (fixture)");
  console.log(`  ✓ ${n} festivals: area covers radius, footprint and pan bounds; largest ${maxTiles} tiles (${worst})`);
}

// ── 2. Style rewrite ────────────────────────────────────────────────────────
const STYLE = {
  version: 8,
  sources: {
    shade: { type: "raster", tileSize: 256, maxzoom: 6, tiles: ["https://tiles.example/ne/{z}/{x}/{y}.png"] },
    omt: { type: "vector", url: "https://tiles.example/planet" },
  },
  glyphs: "https://tiles.example/fonts/{fontstack}/{range}.pbf",
  sprite: "https://tiles.example/sprites/v1/ofm",
  layers: [{ id: "bg", type: "background" }, { id: "road", type: "line", source: "omt", "source-layer": "transportation" },
           { id: "lbl", type: "symbol", source: "omt", layout: { "text-font": ["Noto Sans Regular", "Noto Sans Bold"] } }],
};
const before = js(STYLE);
const PID = "lost-lands-2026.m1abc";
const S = P._packStyle(STYLE, PID, { maxzoom: 14, attribution: "© OpenMapTiles © OSM" });
check(js(STYLE) === before, "the style rewrite mutated its input");
check(js(S.layers) === js(STYLE.layers), "the style rewrite changed layers");
check(js(S.sources.omt) === js({ type: "vector", tiles: [`pack://${PID}/t/{z}/{x}/{y}`], minzoom: 0, maxzoom: 14, attribution: "© OpenMapTiles © OSM" }), `vector source ${js(S.sources.omt)}`);
check(S.sources.shade.tiles[0] === `pack://${PID}/r/shade/{z}/{x}/{y}` && S.sources.shade.maxzoom === 6, `raster source ${js(S.sources.shade)}`);
check(S.glyphs === `pack://${PID}/g/{fontstack}/{range}` && S.sprite === `pack://${PID}/s/sprite`, "glyphs/sprite not rewritten");
check(!/https?:\/\//.test(js([S.sources.omt.tiles, S.sources.shade.tiles, S.glyphs, S.sprite])), "a remote URL survived the rewrite");
console.log("  ✓ style rewrite: sources, glyphs and sprite point at pack://, layers and input untouched");

// ── 3. Downloader key === protocol key ──────────────────────────────────────
{
  // What downloadFestivalPack writes: "<packId>|<path>".
  const wrote = [`${PID}|t/14/4421/6130`, `${PID}|r/shade/6/17/24`, `${PID}|g/Noto Sans Regular,Noto Sans Bold/0-255`,
                 `${PID}|s/sprite@2x.json`, `${PID}|s/sprite.png`];
  // What MapLibre asks the protocol for, after substituting the saved style's templates.
  const asked = [S.sources.omt.tiles[0].replace("{z}", 14).replace("{x}", 4421).replace("{y}", 6130),
                 S.sources.shade.tiles[0].replace("{z}", 6).replace("{x}", 17).replace("{y}", 24),
                 S.glyphs.replace("{fontstack}", encodeURIComponent("Noto Sans Regular,Noto Sans Bold")).replace("{range}", "0-255"),
                 S.sprite + "@2x.json", S.sprite + ".png"];
  asked.forEach((u, i) => check(P._packKey(u) === wrote[i], `protocol key ${P._packKey(u)} ≠ downloader key ${wrote[i]}`));
  check(P._packKey("https://tiles.example/x") === null && P._packKey("") === null, "a non-pack URL must map to no key");
  console.log("  ✓ downloader and protocol agree on every key kind (tile, raster, encoded fontstack, @2x sprite)");
}

// ── 4. Status ───────────────────────────────────────────────────────────────
{
  const now = Date.UTC(2026, 8, 12);
  const m = { fid: "x", scheduleHash: "aaaa", endMs: Date.UTC(2026, 8, 20), savedAt: now - 3600000 };
  check(P._packStatus(null, { now }) === "none", "no manifest must be none");
  check(P._packStatus(m, { now }) === "ready", "no live hash (offline) must read ready");
  check(P._packStatus(m, { now, liveHash: "aaaa" }) === "ready", "same live hash must read ready");
  check(P._packStatus(m, { now, liveHash: "bbbb" }) === "stale", "moved live hash must read stale");
  check(P._packStatus({ ...m, scheduleHash: null }, { now, liveHash: "bbbb" }) === "ready", "a map-only pack cannot go stale on a schedule");
  check(P._packStatus(m, { now: Date.UTC(2026, 8, 21), liveHash: "bbbb" }) === "over", "an ended festival must read over, even when stale");
  check(P._packStatus({ ...m, endMs: Infinity }, { now: Date.UTC(2030, 0, 1) }) === "ready", "no end date must never expire");
  let dated = 0;
  for (const e of P.REG.filter(x => x.available)) {
    const w = P._packWindow(e.config);
    check(Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start, `${e.config.id}: window ${w.start}..${w.end}`);
    dated++;
  }
  console.log(`  ✓ status none/ready/stale/over; ${dated} live festivals have a finite window`);
}

if (failed) { console.log(`  ✗  ${failed} of ${checks} offline-pack checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} offline-pack checks`);
