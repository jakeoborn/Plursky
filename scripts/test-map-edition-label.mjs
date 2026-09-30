#!/usr/bin/env node
// Map screen: a plate drawn for another edition says whose map it is.
//
// EDC Orlando 2026 opened on 2026-09-30 over the official 2025 map (founder
// ruling: "use 2025 and say we are waiting for official 2026 map"). The map
// screen's posture pill used to read "OFFICIAL MAP" for any festival with art
// and three anchors, which is true of the art and false of the festival.
//
// A FIXTURE, not EDC Orlando's live data: `mapArtYear` is set on the active
// festival in the page, so this keeps testing the rule after EDC Orlando's
// own 2026 map lands and its field is dropped. What EDC Orlando itself ships
// is locked in scripts/test-georef-map.mjs.
//
// Cases: no mapArtYear (control), mapArtYear equal to the festival's year,
// and mapArtYear a year behind. The long label is then measured at 280, 320
// and 393 px: it must not run under the control column or onto the
// GPS-denied pill, and none of its text may be clipped.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";
import { loadRegistry } from "./lib/load-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── Every festival that ships another edition's art says so ───────────────
// A festival's own map page can still be showing last year's map
// (`mapSource.mapYear`, recorded when the page was checked). Art shipped while
// that is true cannot be this year's official map, so the config has to name
// the art's year. Escape Halloween 2026 shipped its 2025 map for weeks with
// no label in the app; this is the rule that would have caught it.
{
  const { REG } = loadRegistry(ROOT);
  const unlabelled = list => list.map(e => e.config).filter(c => c.mapImage && c.mapSource && c.mapSource.mapYear != null
    && c.mapSource.mapYear !== c.year && c.mapArtYear !== c.mapSource.mapYear).map(c => c.id);
  const declared = REG.map(e => e.config).filter(c => c.mapArtYear != null);
  check(unlabelled(REG).length === 0, `a festival whose map page shows another year's map ships that art unlabelled: ${unlabelled(REG).join(", ")}`);
  check(declared.every(c => c.mapImage && Number.isInteger(c.mapArtYear) && c.mapArtYear < c.year),
    `mapArtYear is an earlier year, on a festival that ships art (${declared.map(c => `${c.id} ${c.mapArtYear}`).join(", ")})`);
  const esc = REG.find(e => e.config.id === "escape-halloween-2026");
  check(esc && esc.config.mapArtYear === 2025 && esc.config.mapSource?.mapYear === 2025 && esc.config.year === 2026,
    `escape-halloween-2026 names its 2025 art (mapArtYear ${esc?.config.mapArtYear}, map page showed ${esc?.config.mapSource?.mapYear})`);
  // Mutation: the field dropped from Escape must be flagged.
  const stripped = REG.map(e => (e.config.id === "escape-halloween-2026" ? { ...e, config: { ...e.config, mapArtYear: undefined } } : e));
  check(unlabelled(stripped).join() === "escape-halloween-2026", `mutation: Escape without mapArtYear is caught (${unlabelled(stripped).join(", ") || "nothing flagged"})`);
}

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const FID = "acl-2026";

  // Opens the map with `mapArtYear` forced to `artYear` (undefined = absent).
  const open = async (width, artYear) => {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 700 } });
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    }, FID);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window._pushNav === "function", FID, { timeout: 60000 });
    const year = await page.evaluate(y => {
      if (y === undefined) delete window.FESTIVAL_CONFIG.mapArtYear; else window.FESTIVAL_CONFIG.mapArtYear = y;
      return window.FESTIVAL_CONFIG.year;
    }, artYear);
    // The map mounts after the field is set, so its label is computed from it.
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
    await page.waitForSelector("[data-map-posture]", { timeout: 30000 });
    await page.waitForTimeout(1200);
    const s = await page.evaluate(() => {
      const box = document.querySelector("[data-map-posture]"), span = box.querySelector("span");
      const r = box.getBoundingClientRect(), host = box.parentElement.getBoundingClientRect();
      const rect = e => { const q = e.getBoundingClientRect(); return { left: q.left, right: q.right, top: q.top, bottom: q.bottom }; };
      // The control column: every button in the top-right of the map.
      const controls = [...box.parentElement.querySelectorAll("button")].map(rect)
        .filter(q => q.right > q.left && q.left > host.left + host.width / 2 && q.top < host.top + 260);
      const gps = [...box.parentElement.querySelectorAll("span")].find(e => /GPS DENIED/.test(e.textContent));
      return {
        text: span.textContent.trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom,
        clipped: span.scrollWidth > span.clientWidth + 1 || span.scrollHeight > span.clientHeight + 1,
        controlLeft: controls.length ? Math.min(...controls.map(q => q.left)) : null, controls: controls.length,
        gpsTop: gps ? gps.parentElement.getBoundingClientRect().top : null,
        hostLeft: host.left, hostRight: host.right, vw: window.innerWidth,
      };
    });
    await ctx.close();
    return { ...s, year, errors };
  };

  const control = await open(393, undefined);
  check(control.errors.length === 0, `control: the map throws nothing (${JSON.stringify(control.errors)})`);
  check(control.text === "OFFICIAL MAP", `control: a festival on its own map reads OFFICIAL MAP (got "${control.text}")`);
  const same = await open(393, control.year);
  check(same.text === "OFFICIAL MAP", `a mapArtYear equal to the festival's year changes nothing (got "${same.text}")`);

  const LABEL = `${control.year - 1} MAP · OFFICIAL ${control.year} MAP PENDING`;
  for (const width of [393, 320, 280]) {
    const s = await open(width, control.year - 1);
    check(s.errors.length === 0, `${width}px: the map throws nothing (${JSON.stringify(s.errors)})`);
    check(s.text === LABEL, `${width}px: last year's art reads "${LABEL}" (got "${s.text}")`);
    check(!s.clipped, `${width}px: none of the label is clipped`);
    check(s.controls >= 2 && s.controlLeft != null, `${width}px: the control column was found (${s.controls} buttons)`);
    check(s.controlLeft != null && s.right <= s.controlLeft - 4, `${width}px: the label ends left of the control column (label right ${s.right.toFixed(1)}, controls from ${s.controlLeft})`);
    check(s.left >= s.hostLeft && s.right <= s.hostRight, `${width}px: the label is inside the map (left ${s.left}, right ${s.right.toFixed(1)}, map ${s.hostLeft}-${s.hostRight})`);
    // Headless Chromium denies geolocation, so the pill is on screen here.
    check(s.gpsTop != null, `${width}px: the GPS-denied pill is on screen to be measured against`);
    check(s.gpsTop != null && s.bottom <= s.gpsTop - 2, `${width}px: the label ends above the GPS-denied pill (label bottom ${s.bottom.toFixed(1)}, pill top ${s.gpsTop})`);
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  map edition label: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
