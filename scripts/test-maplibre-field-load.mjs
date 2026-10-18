#!/usr/bin/env node
// M1 (Oct 16 spec): at III Points Jake's Map tab drew its header and venue
// cards and NO map. Two causes, one gate each:
//   1. The service worker precached React, ReactDOM, supabase-js and the fonts
//      but not MapLibre, which map.jsx loads from unpkg on first Map open — on
//      festival 5G. Static check: every PACK_LIB URL is in sw.js's CDN list.
//   2. On a mapMode:"real" festival (no festival map to fall back to) a load
//      failure showed a 7-second note and then nothing. Offline-at-mount and
//      the boot timeout set no error card at all, and the card's RETRY cleared
//      the card without re-running the map setup. Browser check on CRSSD Fall
//      2026 (mapMode "real"): the library failing AND offline-at-mount each
//      leave a persistent card past the old 7 s, and RETRY brings the map up.
// MapLibre and React come from scripts/vendor/ (wireVendor), never the live CDN.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor, runtimeAssets } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── 1. precache covers PACK_LIB ─────────────────────────────────────────────
const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
const cdnBlock = sw.match(/const CDN = \[([\s\S]*?)\];/);
check(!!cdnBlock, "sw.js: the CDN precache list is found");
const precached = new Set(cdnBlock ? [...cdnBlock[1].matchAll(/'(https:\/\/[^']+)'/g)].map(m => m[1]) : []);
const lib = runtimeAssets(join(ROOT, "map.jsx"));
check(lib.length === 2, `map.jsx: PACK_LIB names a script and a stylesheet (found ${lib.length})`);
for (const a of lib) check(precached.has(a.url), `sw.js precaches ${a.url} (PACK_LIB)`);

// ── 2. REAL_MAP_ONLY failure: persistent card + working RETRY ───────────────
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPo6OgAAAM0AZnBrMCxAAAAAElFTkSuQmCC", "base64");
const BLANK_STYLE = JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#888" } }] });
const FID = "crssd-fall-2026", AT = "2026-09-27T01:00:00Z";
const JS_URL = lib.find(a => /\.js$/.test(a.url))?.url;

const CASES = [
  { name: "library fails to load", block: true },
  { name: "offline at mount", offline: true },
];
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const C of CASES) {
    const tag = `${FID} (${C.name})`;
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
    await ctx.route(/server\.arcgisonline\.com|tiles\.openfreemap\.org\/planet/, r => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
    await ctx.route(/tiles\.openfreemap\.org\/styles\//, r => r.fulfill({ status: 200, contentType: "application/json", body: BLANK_STYLE }));
    await wireVendor(ctx);
    // Registered last, so it wins over wireVendor's MapLibre route until removed.
    const refuse = r => r.abort("internetdisconnected");
    if (C.block) await ctx.route(JS_URL, refuse);
    await ctx.clock.install({ time: new Date(AT) });
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    }, FID);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    check(await page.evaluate(() => window.FESTIVAL_CONFIG.mapMode === "real"), `${tag}: the fixture festival is mapMode "real"`);
    if (C.offline) await ctx.setOffline(true);
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
    const card = await page.waitForFunction(() => /MAP ERROR/.test(document.body.innerText), null, { timeout: 30000 }).then(() => true, () => false);
    check(card, `${tag}: an error card shows`);
    // Past the old 7-second note: the card is still there, with RETRY.
    await page.clock.runFor(9000);
    await page.waitForTimeout(300);
    const later = await page.evaluate(() => ({
      card: /MAP ERROR/.test(document.body.innerText),
      retry: [...document.querySelectorAll("button")].some(b => b.innerText.trim() === "RETRY"),
      note: /CHECK YOUR CONNECTION/.test(document.body.innerText),
    }));
    check(later.card && later.retry, `${tag}: the card and RETRY are still on screen after 9 s`);
    check(!later.note, `${tag}: no transient "check your connection" note`);
    // The network comes back; RETRY brings the map up on the same screen.
    if (C.block) await ctx.unroute(JS_URL, refuse);
    if (C.offline) await ctx.setOffline(false);
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "RETRY")?.click());
    const up = await page.waitForFunction(() => !!window.__plurskyRealMap && window.__plurskyRealMap.loaded?.() && !/MAP ERROR/.test(document.body.innerText),
      null, { timeout: 30000, polling: 250 }).then(() => true, () => false);
    if (!up) await page.clock.runFor(2000);
    const upNow = up || await page.evaluate(() => !!window.__plurskyRealMap && !/MAP ERROR/.test(document.body.innerText));
    check(upNow, `${tag}: RETRY loads the map and clears the card`);
    check(!errors.length, `${tag}: no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}

if (failed) { console.log(`✗ maplibre field load: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ maplibre field load: ${checks} checks (SW precaches PACK_LIB; REAL_MAP_ONLY failure keeps a card, RETRY recovers)`);
