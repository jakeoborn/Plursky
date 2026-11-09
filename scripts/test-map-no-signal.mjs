#!/usr/bin/env node
// L7: the map tab says it works with no signal — only where that is true.
// Plursky could already draw a festival's map offline (the service worker
// precaches every ground plate; a saved street pack covers a mapMode:"real"
// festival) but never said so, and offline it said "No network connection".
//   1. The locate button is "Show me on the map" (the one GPS toggle,
//      relabelled — no second button, no new permission flow). Off, it carries
//      "Works with no signal" exactly when _mapCachedOffline(cfg) holds: the
//      festival's plate is in Cache Storage (the real worker's install, not a
//      seeded cache) or a pack is saved.
//   2. Offline, a plate festival's fallback note says OFFLINE — FESTIVAL MAP
//      SHOWN and the plate still resolves; a mapMode:"real" festival with
//      nothing cached says so on its card and carries no "no signal" line.
// Plate festivals: III Points 2026 and Escape Halloween 2026. Negative: CRSSD
// Fall 2026 (mapMode "real", no plate, no pack). Offline is context.setOffline.
// L7_SHOTS=<dir> also captures 390/320 × Dark/Light, online and offline.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.L7_SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPo6OgAAAM0AZnBrMCxAAAAAElFTkSuQmCC", "base64");
const BLANK_STYLE = JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#888" } }] });

const PLATES = [
  { fid: "iii-points-2026",       at: "2026-10-17T02:00:00Z" },
  { fid: "escape-halloween-2026", at: "2026-10-31T05:00:00Z" },
];
const REAL = { fid: "crssd-fall-2026", at: "2026-09-27T01:00:00Z" };

async function newCtx(browser, { fid, at, sw, width = 390, mode = "dark" }) {
  const ctx = await browser.newContext({ serviceWorkers: sw ? "allow" : "block", viewport: { width, height: 844 }, colorScheme: mode, reducedMotion: "reduce" });
  await ctx.route(/server\.arcgisonline\.com|tiles\.openfreemap\.org\/planet/, r => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
  await ctx.route(/tiles\.openfreemap\.org\/styles\//, r => r.fulfill({ status: 200, contentType: "application/json", body: BLANK_STYLE }));
  await wireVendor(ctx);
  await ctx.addInitScript(([fid, mode]) => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    if (!localStorage.getItem("plursky.appearance")) localStorage.setItem("plursky.appearance", mode);   // a later pick sticks
  }, [fid, mode]);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(at) });
  page.__errors = []; page.on("pageerror", e => page.__errors.push(e.message));
  return { ctx, page };
}

const URL_FOR = fid => `http://127.0.0.1:${PORT}/index.html?f=${fid}&tab=lineup`;
async function boot(page, fid, reload = false) {
  // Always the festival URL: a bare reload lands on the festival picker once
  // the app has rewritten the address. Offline, the worker answers with its
  // cached index.html.
  await page.goto(URL_FOR(fid), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(f => window.FESTIVAL_CONFIG?.id === f, fid, { timeout: 60000 });
}
// After a reload the nav paints a beat after FESTIVAL_CONFIG is set (slower
// when the worker serves the page): click Map until the Map screen is up.
async function clickMap(page) {
  await page.waitForFunction(() => {
    if (document.querySelector("[data-map-header]")) return true;
    [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click();
    return false;
  }, null, { timeout: 30000, polling: 500 }).catch(() => {});
}
async function openMapGpsOff(page) {
  await clickMap(page);
  if (!await page.waitForSelector("button[data-map-locate]", { timeout: 20000 }).then(() => true, () => false)) return;
  if (await page.getAttribute("button[data-map-locate]", "data-map-locate") === "on") await page.click("button[data-map-locate]");
  await page.waitForSelector('button[data-map-locate="off"]', { timeout: 5000 }).catch(() => {});
}
const locate = page => page.evaluate(() => {
  const b = document.querySelector("button[data-map-locate]");
  return b ? { state: b.getAttribute("data-map-locate"), name: b.getAttribute("aria-label"), text: b.innerText.trim(),
    count: document.querySelectorAll("button[data-map-locate]").length } : null;
});
const noSignalLine = (page, timeout = 15000) => page.waitForFunction(() =>
  document.querySelector("[data-map-no-signal]")?.textContent === "Works with no signal", null, { timeout, polling: 250 }).then(() => true, () => false);
async function shoot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // ── Plate festivals, with the real service worker ─────────────────────────
  for (const C of PLATES) {
    const { ctx, page } = await newCtx(browser, { ...C, sw: true });
    await boot(page, C.fid);
    const plate = await page.evaluate(() => window.FESTIVAL_CONFIG.mapImage);
    check(!!plate && await page.evaluate(() => window.FESTIVAL_CONFIG.mapMode !== "real"), `${C.fid}: the fixture festival draws a ground plate (${plate})`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    const inCache = await page.waitForFunction(p => caches.match(new URL(p, location.href).href).then(r => !!r), plate, { timeout: 60000, polling: 500 }).then(() => true, () => false);
    check(inCache, `${C.fid}: the worker's install put ${plate} in Cache Storage`);
    // The worker controls the page before anything is asserted offline.
    await boot(page, C.fid, true);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});

    await openMapGpsOff(page);
    const on = await locate(page);
    check(on && on.count === 1, `${C.fid}: one locate button on the map (${on?.count ?? 0})`);
    check(on?.name === "Show me on the map" && /^Show me on the map/.test(on?.text || ""), `${C.fid}: the locate button reads "Show me on the map" (name "${on?.name}", text "${on?.text}")`);
    check(await noSignalLine(page), `${C.fid}: online, GPS off — "Works with no signal" under it`);
    await shoot(page, `${C.fid}-390-dark-online`);

    // Radio off. The app reloads from the worker; the real map cannot start,
    // so the festival map is shown and the note says why.
    await ctx.setOffline(true);
    await boot(page, C.fid, true);
    check(await page.evaluate(() => navigator.onLine === false), `${C.fid}: the page is offline`);
    await clickMap(page);
    const note = await page.waitForFunction(() => /^Offline — festival map shown$/.test(document.querySelector("[data-map-fallback-note]")?.textContent || ""), null, { timeout: 20000, polling: 200 }).then(() => true, () => false);
    check(note, `${C.fid}: offline note reads "Offline — festival map shown" (in the header)`);
    check(!/no network connection|check your connection/i.test(await page.evaluate(() => document.body.innerText)), `${C.fid}: no "no network" / "check your connection" wording`);
    check(await page.evaluate(p => fetch(p).then(r => r.ok, () => false), plate), `${C.fid}: offline, the plate still resolves (${plate})`);
    await shoot(page, `${C.fid}-390-dark-offline`);
    await openMapGpsOff(page);
    check(await noSignalLine(page), `${C.fid}: offline, GPS off — "Works with no signal" still under it`);
    check(!page.__errors.length, `${C.fid}: no page errors (${page.__errors.slice(0, 2).join(" | ")})`);

    if (SHOTS) {
      for (const [w, mode] of [[390, "light"], [320, "dark"], [320, "light"]]) {
        await page.evaluate(m => localStorage.setItem("plursky.appearance", m), mode);
        await page.setViewportSize({ width: w, height: 844 });
        for (const net of ["online", "offline"]) {
          await ctx.setOffline(net === "offline");
          await page.evaluate(() => sessionStorage.removeItem("plursky_realmap_failed"));
          await boot(page, C.fid, true);
          await openMapGpsOff(page);
          await noSignalLine(page);
          if (net === "offline") await page.waitForFunction(() => /^Offline — festival map shown$/.test(document.querySelector("[data-map-fallback-note]")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
          await shoot(page, `${C.fid}-${w}-${mode}-${net}`);
        }
      }
      // The 390 dark offline shot above shows the note with GPS on; one more
      // with GPS off so both copy changes sit in one frame.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => localStorage.setItem("plursky.appearance", "dark"));
    }
    await ctx.close();
  }

  // ── A mapMode:"real" festival with nothing cached: no promise ─────────────
  {
    const { ctx, page } = await newCtx(browser, { ...REAL, sw: true });
    await boot(page, REAL.fid);
    check(await page.evaluate(() => window.FESTIVAL_CONFIG.mapMode === "real" && !window.FESTIVAL_CONFIG.mapImage), `${REAL.fid}: the fixture festival is mapMode "real" with no plate`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await boot(page, REAL.fid, true);
    await openMapGpsOff(page);
    const l = await locate(page);
    check(/^Show me on the map/.test(l?.text || ""), `${REAL.fid}: the locate button reads "Show me on the map" ("${l?.text}")`);
    check(!(await noSignalLine(page, 4000)), `${REAL.fid}: no "Works with no signal" — nothing for this map is cached`);
    // The same predicate says yes the moment a pack is saved for it.
    const withPack = await page.evaluate(async fid => {
      if (typeof _mapCachedOffline !== "function") return false;
      const k = "plursky_packs_v1", was = localStorage.getItem(k);
      localStorage.setItem(k, JSON.stringify({ [fid]: { id: fid } }));
      const yes = await _mapCachedOffline(window.FESTIVAL_CONFIG);
      if (was === null) localStorage.removeItem(k); else localStorage.setItem(k, was);
      return yes && !(await _mapCachedOffline(window.FESTIVAL_CONFIG));
    }, REAL.fid);
    check(withPack, `${REAL.fid}: a saved pack turns the predicate on, and removing it turns it off`);
    await ctx.setOffline(true);
    await boot(page, REAL.fid, true);
    await clickMap(page);
    const card = await page.waitForFunction(() => /Offline — no cached map for this festival yet/.test(document.querySelector("[data-realmap-err]")?.textContent || ""),
      null, { timeout: 30000, polling: 250 }).then(() => true, () => false);
    check(card, `${REAL.fid}: offline, the card says "Offline — no cached map for this festival yet"`);
    await shoot(page, `${REAL.fid}-390-dark-offline`);
    await openMapGpsOff(page);
    check(!(await noSignalLine(page, 3000)), `${REAL.fid}: offline, still no "Works with no signal"`);
    check(!page.__errors.length, `${REAL.fid}: no page errors (${page.__errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}

if (failed) { console.log(`✗ map no signal: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ map no signal: ${checks} checks ("Show me on the map"; "Works with no signal" only where the plate is in the worker's cache or a pack is saved; offline notes say offline)`);
