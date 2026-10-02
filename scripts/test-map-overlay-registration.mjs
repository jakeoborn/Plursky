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
  // Every zoom level, read off the rendered PIXELS. Step the map in four
  // times and back out to its floor. At each level the map is panned (a real
  // one-finger touch drag) to bring the dot on screen, then two screenshots
  // are taken: one as drawn, one with the YOU pill hidden, and one more with
  // the dot hidden. The pixels that change are the pill and the dot, so their
  // positions come from the image, not from the layout.
  {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 }, hasTouch: true, reducedMotion: "reduce" });
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    }, FID);
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window._pushNav === "function", FID, { timeout: 60000 });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
    await page.waitForSelector("[data-avatar-label]", { timeout: 30000 });
    // Freeze the demo walk so the dot holds still between the captures.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(1500);
    const zoomBtn = l => page.evaluate(l => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === l)?.click(), l);
    const panDotToCentre = () => page.evaluate(() => {
      const dot = document.querySelector("[data-avatar-dot]").getBoundingClientRect();
      const box = document.querySelector("[data-map-html-overlay]").parentElement.parentElement;
      const r = box.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const from = { x: cx, y: cy }, to = { x: cx + (cx - (dot.left + dot.width / 2)), y: cy + (cy - (dot.top + dot.height / 2)) };
      const t = (x, y) => new Touch({ identifier: 1, target: box, clientX: x, clientY: y });
      box.dispatchEvent(new TouchEvent("touchstart", { touches: [t(from.x, from.y)], changedTouches: [t(from.x, from.y)], bubbles: true, cancelable: true }));
      for (let k = 1; k <= 8; k++) { const x = from.x + (to.x - from.x) * k / 8, y = from.y + (to.y - from.y) * k / 8;
        box.dispatchEvent(new TouchEvent("touchmove", { touches: [t(x, y)], changedTouches: [t(x, y)], bubbles: true, cancelable: true })); }
      box.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t(to.x, to.y)], bubbles: true, cancelable: true }));
    });
    // One capture per level, with the pill filled pure green and the dot
    // pure magenta (a test stylesheet: shapes and positions are untouched),
    // then both are found by colour in the image.
    const locate = async () => {
      await page.evaluate(() => { const st = document.createElement("style"); st.id = "__mark";
        st.textContent = "[data-avatar-label]{background:#00ff00!important;box-shadow:none!important;color:#00ff00!important}" +
          "[data-avatar-dot]{fill:#ff00ff!important;stroke:none!important}"; document.head.appendChild(st); });
      await page.waitForTimeout(150);
      const b64 = (await page.screenshot()).toString("base64");
      await page.evaluate(() => document.getElementById("__mark").remove());
      return page.evaluate(async (b64) => {
        const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
        const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        const x2 = c.getContext("2d"); x2.drawImage(im, 0, 0); const d = x2.getImageData(0, 0, c.width, c.height).data;
        const k = c.width / window.innerWidth;
        const find = (want) => { let l = 1e9, r = -1, t = 1e9, b = -1, n = 0;
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = 4 * (y * c.width + x);
            if (Math.abs(d[i] - want[0]) < 40 && Math.abs(d[i + 1] - want[1]) < 40 && Math.abs(d[i + 2] - want[2]) < 40) { n++; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); } }
          return n ? { n, cx: (l + r) / 2 / k, cy: (t + b) / 2 / k, top: t / k, bottom: b / k, left: l / k, right: r / k } : { n: 0 }; };
        return { pill: find([0, 255, 0]), dot: find([255, 0, 255]) };
      }, b64);
    };
    const zooms = [];
    const probe = async tag => {
      await page.waitForTimeout(700);
      await panDotToCentre(); await page.waitForTimeout(700);
      const z = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector("[data-map-html-overlay]").parentElement).transform).a);
      const { dot, pill } = await locate();
      const onScreen = dot.n > 0 && dot.left >= 0 && dot.right <= 393 && dot.top >= 0 && dot.bottom <= 852;
      check(onScreen && pill.n > 0, `${tag} (zoom ${z.toFixed(2)}): the dot and the YOU pill are both on screen in the capture (dot ${dot.n} px, pill ${pill.n} px)`);
      if (!onScreen || !pill.n) return;
      zooms.push(z);
      check(Math.abs(pill.cx - dot.cx) <= 1.5, `${tag} (zoom ${z.toFixed(2)}): the pill's pixel centre is on the dot's pixel centre (pill ${pill.cx.toFixed(1)}, dot ${dot.cx.toFixed(1)})`);
      // The pill's lower edge sits 5 CSS px above the point, scaled with the
      // map (the pill scales with it); read off pixels, that is 5-8 px per
      // unit of zoom. The bug this gate exists for put it 70+ px away.
      const gap = (dot.cy - pill.bottom) / z;
      check(gap >= 3 && gap <= 10, `${tag} (zoom ${z.toFixed(2)}): the pill sits just above the dot (${(dot.cy - pill.bottom).toFixed(1)} px from its lower edge to the dot's centre, ${gap.toFixed(1)} per unit of zoom)`);
    };
    await probe("start");
    for (let i = 1; i <= 4; i++) { await zoomBtn("Zoom in"); await probe(`in ${i}`); }
    for (let i = 1; i <= 7; i++) { await zoomBtn("Zoom out"); await probe(`out ${i}`); }
    const levels = [...new Set(zooms.map(z => z.toFixed(2)))];
    check(levels.length >= 6 && Math.max(...zooms) >= 3 && Math.min(...zooms) < 1, `the pixel check covered the zoom range (${levels.join(", ")})`);
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  map overlay registration: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
