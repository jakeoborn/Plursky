#!/usr/bin/env node
// Map screen: the HTML labels sit on the SVG points they name.
//
// The drawn map is an SVG; the "YOU" label and the stage pills are HTML laid
// over it. Both place a map point (x, y on the 0–100 grid), and they have to
// agree on where that point is on screen. In a portrait container they did
// not: on main at 7bbd76a the YOU label rendered about 85 px above its dot at
// 393x852 (ACL, demo position), and every pill was pulled toward the map's
// middle row. The dot and the pins were right; the HTML layer was wrong.
//
// Measured, not inferred: each HTML element's layout origin (its left/top,
// before its own transform) against the screen position the SVG gives the same
// map point. Pills come from a FIXTURE: `mapPrintsStageNames` forced off on
// the active festival, so this keeps testing pills whichever live festival's
// art prints its own names. The avatar is checked in the demo corner and at a
// mocked GPS fix.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "acl-2026", TOL = 1.5;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const measure = async (width, height, { pills = false, geo = null } = {}) => {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width, height },
      ...(geo ? { geolocation: { latitude: geo[0], longitude: geo[1], accuracy: 8 }, permissions: ["geolocation"] } : {}) });
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    }, FID);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window._pushNav === "function", FID, { timeout: 60000 });
    if (pills) await page.evaluate(() => { window.FESTIVAL_CONFIG.mapPrintsStageNames = false; });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
    await page.waitForSelector("[data-avatar-label]", { timeout: 30000 });
    await page.waitForTimeout(geo ? 3000 : 1500);
    const out = await page.evaluate(() => {
      const overlay = document.querySelector("[data-map-html-overlay]");
      const box = overlay.getBoundingClientRect();
      const svg = overlay.parentElement.querySelector("svg");
      const vb = svg.viewBox.baseVal, m = svg.getScreenCTM();
      // A 0–100 map point on screen, through the SVG's own transform. The map
      // group is shifted down by (viewBox height - 100) / 2.
      const onScreen = (x, y) => { const p = new DOMPoint(x, y + (vb.height - 100) / 2).matrixTransform(m); return [p.x, p.y]; };
      // An HTML child's layout origin: where its left/top put it, before its
      // own transform moves it off the point.
      const origin = el => [box.left + el.offsetLeft, box.top + el.offsetTop];
      const dot = document.querySelector("[data-avatar-dot]").getBoundingClientRect();
      const label = document.querySelector("[data-avatar-label]");
      const stages = (window.STAGES || []).filter(s => typeof s.x === "number" && typeof s.y === "number");
      const pillRows = [...document.querySelectorAll("[data-stage-pill]")].map(el => {
        const st = stages.find(s => `${s.name} stage` === el.getAttribute("aria-label"));
        return st ? { id: st.id, at: origin(el), want: onScreen(st.x, st.y) } : { id: null };
      });
      return { portrait: vb.height > 100, vbH: vb.height, box: [box.width, box.height],
        dot: [dot.left + dot.width / 2, dot.top + dot.height / 2], label: origin(label),
        labelRect: (r => [r.left, r.top, r.right, r.bottom])(label.getBoundingClientRect()), pillRows, live: /LIVE/.test(document.body.innerText) };
    });
    await ctx.close();
    return { ...out, errors };
  };
  const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  for (const [w, h] of [[393, 852], [320, 700]]) {
    const s = await measure(w, h);
    check(s.errors.length === 0, `${w}x${h}: the map throws nothing (${JSON.stringify(s.errors)})`);
    check(s.portrait, `${w}x${h}: the map container is taller than wide, the case this gate exists for (viewBox height ${s.vbH.toFixed(1)})`);
    check(gap(s.label, s.dot) <= TOL, `${w}x${h}: the YOU label is placed on its dot (label origin ${s.label.map(v => v.toFixed(1))}, dot ${s.dot.map(v => v.toFixed(1))}, ${gap(s.label, s.dot).toFixed(1)} px apart)`);
    // What a person sees: the label is the pill just above the dot.
    const [l, t, r, b] = s.labelRect;
    check(l <= s.dot[0] && r >= s.dot[0] && b <= s.dot[1] + 1 && s.dot[1] - b <= 14,
      `${w}x${h}: the YOU label is drawn directly above its dot (label ${[l, t, r, b].map(v => v.toFixed(0))}, dot ${s.dot.map(v => v.toFixed(0))})`);
  }

  // Stage pills, from the fixture.
  {
    const s = await measure(393, 852, { pills: true });
    const placed = s.pillRows.filter(p => p.id);
    check(s.pillRows.length >= 3 && placed.length === s.pillRows.length, `fixture: stage pills render and each names a placed stage (${placed.length} of ${s.pillRows.length})`);
    // The middle row is right even under the old double offset; the test has
    // to include a pill well off it to mean anything.
    const offMid = placed.filter(p => Math.abs(p.want[1] - (s.box[1] / 2 + 24)) > 40);
    check(offMid.length >= 2, `fixture: at least two pills sit well off the map's middle row (${offMid.length})`);
    const worst = placed.reduce((a, p) => (gap(p.at, p.want) > gap(a.at, a.want) ? p : a), placed[0] || { at: [0, 0], want: [0, 0] });
    check(placed.length > 0 && gap(worst.at, worst.want) <= TOL, `every stage pill is anchored on its stage's point (worst ${worst.id}: ${gap(worst.at, worst.want).toFixed(1)} px)`);
  }

  // A real fix: Zilker Park, on site. The label follows the dot there too.
  {
    const s = await measure(393, 852, { geo: [30.2669, -97.7729] });
    check(s.live, "mocked GPS: the map reads LIVE, so the dot is the real position");
    check(gap(s.label, s.dot) <= TOL, `mocked GPS: the YOU label is placed on its dot (${gap(s.label, s.dot).toFixed(1)} px apart)`);
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  map overlay registration: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
