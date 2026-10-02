#!/usr/bin/env node
// EDC Orlando: a person standing at each of the site's four corners is drawn
// on that corner of the 2025 map, on screen.
//
// Founder ruling 2026-09-30: fix the art's registration, verified at the four
// corners. scripts/test-georef-map.mjs checks the fit in plate pixels; this
// checks what the app actually draws. For each control point in
// map-sources/edco-map-2025-control-points.json, the browser's position is
// mocked to that street intersection (its OpenStreetMap coordinates), the map
// is opened, and the blue dot's rendered centre is converted to plate pixels
// through the plate image's own on-screen box. It must land within 16 plate
// px of where the art draws the intersection.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CP = JSON.parse(readFileSync(join(ROOT, "map-sources/edco-map-2025-control-points.json"), "utf8"));
const TOL_PX = 16, FID = "edc-orlando-2026";
let checks = 0, failed = 0; const offs = [];
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const c of CP.controlPoints) {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 }, reducedMotion: "reduce",
      geolocation: { latitude: c.lat, longitude: c.lng, accuracy: 5 }, permissions: ["geolocation"] });
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    }, FID);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window._pushNav === "function", FID, { timeout: 60000 });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
    // The avatar's own dot (map.jsx: r 1.8 with a 0.6 white stroke).
    const DOT = 'svg circle[r="1.8"][stroke-width="0.6"]';
    await page.waitForSelector(DOT, { timeout: 30000 });
    await page.waitForFunction(() => /LIVE/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const r = await page.evaluate(([plate, DOT]) => {
      const img = [...document.querySelectorAll("svg image")].find(i => (i.getAttribute("href") || "").includes(plate));
      const dots = document.querySelectorAll(DOT), d = dots[0].getBoundingClientRect(), b = img.getBoundingClientRect();
      return { n: dots.length, live: /LIVE/.test(document.body.innerText), x: (d.left + d.width / 2 - b.left) / b.width, y: (d.top + d.height / 2 - b.top) / b.height };
    }, [CP.plate, DOT]);
    const px = r.x * CP.plateSize[0], py = r.y * CP.plateSize[1], off = Math.hypot(px - c.px, py - c.py);
    check(errors.length === 0, `${c.name}: the map throws nothing (${JSON.stringify(errors)})`);
    check(r.live && r.n === 1, `${c.name}: the position is live and on site, one avatar dot (${r.n})`);
    offs.push(`${c.name.replace(/ \(.*/, "")} ${off.toFixed(1)}`);
    check(off <= TOL_PX, `${c.name}: drawn at (${px.toFixed(0)}, ${py.toFixed(0)}), the art has it at (${c.px}, ${c.py}): ${off.toFixed(1)} px off (limit ${TOL_PX})`);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/edco-corner-${c.name.replace(/[^A-Za-z]+/g, "-").replace(/-+$/, "")}.png` });
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  EDC Orlando corners on screen: ${checks - failed}/${checks} checks (plate px off: ${offs.join("; ")})`);
process.exit(failed ? 1 : 0);
