#!/usr/bin/env node
// Real basemap, end to end: two live fixes at III Points render apart and at
// their raw positions, and a meet pin dropped on the basemap lands where it
// was dropped. Hand-run (needs OpenFreeMap tiles + unpkg MapLibre, so it is not
// in verify; the pure half is scripts/test-real-map-raw-gps.mjs).
//   node scripts/e2e-real-map-raw-gps.mjs
// Marker positions are read back from each marker's rendered transform through
// map.unproject, so this measures where MapLibre drew it, not what the code meant.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";

import { wireVendor } from "./lib/vendor-cdn.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; console.log(`  ${ok ? "✓" : "✗"}  ${msg}`); if (!ok) failed++; }
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "iii-points-2026";
const AT = "2026-10-17T02:00:00Z"; // Fri Oct 16, 10 pm EDT: inside III Points
const A = [25.7980, -80.2027], B = [25.7980, -80.2005], PIN = [25.7985, -80.2010];
const meters = (a, b) => { const R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const TOL_M = 3;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 },
    geolocation: { latitude: A[0], longitude: A[1], accuracy: 8 }, permissions: ["geolocation"] });
  await wireVendor(ctx);   // React, ReactDOM, supabase-js from scripts/vendor/, never the live CDN
  await ctx.clock.install({ time: new Date(AT) });
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    // Lets the test fire a position error into the page's live watchers.
    const g = navigator.geolocation, w = g.watchPosition.bind(g), errs = new Map();
    g.watchPosition = (ok, err, o) => { const id = w(ok, err, o); errs.set(id, err); return id; };
    const c = g.clearWatch.bind(g); g.clearWatch = (id) => { errs.delete(id); c(id); };
    window.__geoFail = (code) => errs.forEach((e) => e && e({ code, message: "e2e" }));
  }, FID);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
  check(true, `loaded ${FID}`);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
  await page.waitForFunction(() => !!window.__plurskyRealMap, null, { timeout: 60000 });
  // The avatar marker is added on the map's "load" (style + first tiles), which
  // can land well after the first tile makes the map usable.
  const hasAvatar = await page.waitForFunction(() => [...document.querySelectorAll(".maplibregl-marker")].some(m => m.querySelector(".plursky-avatar-halo")), null, { timeout: 90000 }).then(() => true, () => false);
  check(hasAvatar, "avatar marker rendered on the basemap");
  const settled = await page.evaluate(async () => { const m = window.__plurskyRealMap; let n = 0; const f = () => n++; m.on("styledata", f); await new Promise(r => setTimeout(r, 2000)); m.off("styledata", f); return { n, loaded: m.loaded() }; });
  check(settled.n <= 2 && settled.loaded, `the map settles: ${settled.n} styledata in 2 s idle, loaded=${settled.loaded} (main looped ~125)`);
  // Read a marker's on-screen centre back into lat/lng. width picks which:
  // the avatar wrap is 18 px, the meet pin 22 px.
  const read = (w) => page.evaluate((w) => {
    const map = window.__plurskyRealMap;
    const el = [...document.querySelectorAll(".maplibregl-marker")].find(m => m.querySelector(".plursky-avatar-halo") && Math.round(m.getBoundingClientRect().width) === w);
    if (!el) return null;
    // The marker's own translate is the point MapLibre projected it to (anchor
    // centre). Its bounding box is not: the meet pin's box is taller than its dot.
    const t = el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    if (!t) return null;
    const ll = map.unproject([+t[1], +t[2]]);
    return [ll.lat, ll.lng];
  }, w);
  const settle = async (want, w) => { let got = null; for (let i = 0; i < 40; i++) { got = await read(w); if (got && meters(got, want) < TOL_M) break; await page.waitForTimeout(500); } return got; };
  // Centre the camera so both fixes are on screen.
  await page.evaluate(([lat, lng]) => window.__plurskyRealMap.jumpTo({ center: [lng, lat], zoom: 17 }), [25.7980, -80.2016]);
  const gotA = await settle(A, 18);
  check(!!gotA && meters(gotA, A) < TOL_M, `fix A rendered ${gotA ? meters(gotA, A).toFixed(1) : "—"} m from raw input (≤ ${TOL_M} m)`);
  await ctx.setGeolocation({ latitude: B[0], longitude: B[1], accuracy: 8 });
  const gotB = await settle(B, 18);
  check(!!gotB && meters(gotB, B) < TOL_M, `fix B rendered ${gotB ? meters(gotB, B).toFixed(1) : "—"} m from raw input (≤ ${TOL_M} m)`);
  check(!!gotA && !!gotB && meters(gotA, gotB) > 200, `the two fixes render ${gotA && gotB ? meters(gotA, gotB).toFixed(0) : "—"} m apart (input ${meters(A, B).toFixed(0)} m)`);
  const C = await page.evaluate(() => [window.FESTIVAL_CONFIG.gps.lat, window.FESTIVAL_CONFIG.gps.lng]);
  check(!!gotB && meters(gotB, C) > 50, `the live dot is not on the venue centroid (${gotB ? meters(gotB, C).toFixed(0) : "—"} m away)`);
  // Meet pin: enter meet mode, click the basemap at PIN, read the pin back.
  const entered = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Meet up"); b?.click(); return !!b; });
  check(entered, "Meet up button found");
  await page.waitForTimeout(800);
  await page.evaluate(([lat, lng]) => { const map = window.__plurskyRealMap; map.fire("click", { lngLat: new window.maplibregl.LngLat(lng, lat), point: map.project([lng, lat]), originalEvent: {} }); }, PIN);
  const gotPin = await settle(PIN, 22);
  if (!gotPin || meters(gotPin, PIN) >= TOL_M) console.log("    diag:", JSON.stringify(await page.evaluate(() => { const m = window.__plurskyRealMap; return { moving: m.isMoving(), zoom: m.getZoom(), center: m.getCenter(), pitch: m.getPitch(), bearing: m.getBearing(), markers: [...document.querySelectorAll(".maplibregl-marker")].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.left), Math.round(r.top), e.style.transform.slice(0, 80)]; }) }; })));
  check(!!gotPin && meters(gotPin, PIN) < TOL_M, `meet pin rendered ${gotPin ? meters(gotPin, PIN).toFixed(1) : "—"} m from where it was dropped (≤ ${TOL_M} m)`);
  // LIVE only while the fix is: GPS OFF, a position error and a stale fix all
  // drop the meet card to ROUTE PREVIEW (#310 review: OFF kept "ROUTING LIVE").
  const card = () => page.evaluate(() => { const t = document.body.innerText; return /YOUR LOCATION LIVE/.test(t) ? "live" : /ROUTE PREVIEW/.test(t) ? "preview" : /ROUTING LIVE/.test(t) ? "old-live" : "none"; });
  const until = async (want) => { let got; for (let i = 0; i < 20; i++) { got = await card(); if (got === want) break; await page.waitForTimeout(250); } return got; };
  const gpsPill = () => page.evaluate(() => { const b = document.querySelector('button[data-map-locate]'); b?.click(); return !!b; });
  let st = await until("live");
  check(st === "live", `live fix + meet pin: card says YOUR LOCATION LIVE (${st})`);
  check(await gpsPill(), "GPS toggle found");
  st = await until("preview");
  const offPill = await page.evaluate(() => document.querySelector('button[data-map-locate]')?.innerText.trim());
  check(st === "preview" && /^Show me on the map/.test(offPill || ""), `live fix -> GPS OFF: card ${st}, pill ${offPill}`);
  await gpsPill();
  st = await until("live");
  check(st === "live", `GPS back ON: card ${st}`);
  await page.evaluate(() => window.__geoFail(2));
  st = await until("preview");
  check(st === "preview", `live fix -> position error: card ${st}`);
  await ctx.setGeolocation({ latitude: A[0], longitude: A[1], accuracy: 8 });
  st = await until("live");
  check(st === "live", `a new fix after the error: card ${st}`);
  await page.clock.fastForward(65000);
  st = await until("preview");
  const stalePill = await page.evaluate(() => document.querySelector('button[data-map-locate]')?.innerText.trim());
  check(st === "preview" && stalePill === "NO FIX", `live fix -> 65 s with no update: card ${st}, pill ${stalePill}`);
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 2).join(" | ")}` : ""}`);
  await page.screenshot({ path: process.env.SHOT || "/dev/null" }).catch(() => {});
  await browser.close();
} finally { server.kill(); }
console.log(failed ? `✗ e2e real map raw GPS: ${failed} of ${checks} failed` : `✓ e2e real map raw GPS: ${checks} checks`);
process.exit(failed ? 1 : 0);
