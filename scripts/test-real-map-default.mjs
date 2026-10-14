#!/usr/bin/env node
// The DEFAULT map, rendered: the real basemap with the festival's own map laid
// over it (#313). The four older visual gates pin the drawn art map
// ("plursky_use_realmap" = "0"), so this is the gate that looks at what a user
// actually opens. Instinct's #313 review, all six points:
//   1. Pins only where geometry is checked: Summerfest pins its stages; Ultra
//      (unchecked anchors, art up to 387 m off) and III Points (no anchors)
//      pin none and read STAGES PENDING.
//   2. The + / − / Reset column moves the real map's camera.
//   3. A failed overlay stays off: styledata re-runs the layer setup, and the
//      overlay must not re-add itself after an error. (Control first: with no
//      error, a removed overlay DOES come back on styledata.)
//   4. Summerfest's opening view: no two stage pills overlap, none sits under
//      the style switch.
//   5. Water / Medical chips exist on the real map where amenities are placed,
//      and the chip shows exactly that amenity type.
//   6. (this file) a rendered check of the default path, in verify.
// MapLibre comes from unpkg (pinned 4.7.1, like React here); basemap tiles are
// stubbed with a blank tile so the gate never depends on Esri or OpenFreeMap.
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
// 1×1 grey PNG: a blank basemap tile.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPo6OgAAAM0AZnBrMCxAAAAAElFTkSuQmCC", "base64");
const BLANK_STYLE = JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#888" } }] });

// The map is a during-festival tab, so each case pins the clock inside its festival.
const CASES = [
  { fid: "summerfest-2026",  at: "2026-06-19T23:00:00Z", pins: true,  overlay: "checked" },
  // Outside Lands is wide east-west: its edge stages are where a pan limit
  // that ignores the opening view clipped a name off-screen.
  { fid: "outside-lands-2026", at: "2026-08-08T23:00:00Z", pins: true, overlay: "checked" },
  // Ultra's is the longest posture label; at 393 pt it is the one that fits
  // beside a shrinking title and printed over it. III Points runs at 320 pt.
  { fid: "ultra-miami-2026", at: "2026-03-28T23:00:00Z", pins: false, overlay: "unchecked" },
  { fid: "iii-points-2026",  at: "2026-10-17T02:00:00Z", pins: false, overlay: "none", w: 320 },
];
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const C of CASES) {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: C.w || 393, height: 852 } });
    await ctx.clock.install({ time: new Date(C.at) });
    // Nothing pins the map mode: this is the default a new user gets.
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    }, C.fid);
    await ctx.route(/server\.arcgisonline\.com|tiles\.openfreemap\.org\/planet/, r => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
    await ctx.route(/tiles\.openfreemap\.org\/styles\//, r => r.fulfill({ status: 200, contentType: "application/json", body: BLANK_STYLE }));
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${C.fid}&tab=lineup`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, C.fid, { timeout: 60000 });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
    const up = await page.waitForFunction(() => !!window.__plurskyRealMap && [...document.querySelectorAll(".maplibregl-marker")].some(m => m.querySelector(".plursky-avatar-halo")),
      null, { timeout: 90000 }).then(() => true, () => false);
    check(up, `${C.fid}: the real map is the default and finishes loading`);
    if (!up) { await ctx.close(); continue; }
    if (C.overlay !== "none") await page.waitForFunction(() => !!window.__plurskyRealMap.getLayer("official-map"), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const map = window.__plurskyRealMap, stages = (window.STAGES || []).filter(s => typeof s.x === "number");
      const box = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      // Stage pills are the markers whose text is a stage's name: read by what
      // is drawn, not by an attribute only the new code sets.
      const names = new Map(stages.map(s => [String(s.name).toUpperCase(), s.id]));
      const pills = [...document.querySelectorAll(".maplibregl-marker")].filter(m => names.has(m.textContent.trim()));
      const shown = pills.filter(p => getComputedStyle(p).visibility !== "hidden").map(p => ({ id: names.get(p.textContent.trim()), ...box(p) }));
      const sw = document.querySelector("[data-realmap-style-switch]");
      const container = map.getContainer().getBoundingClientRect();
      return {
        posture: document.querySelector("[data-map-posture]")?.innerText.trim(),
        // The title's TEXT extent: a shrunk h1 box can hide text overflowing it.
        title: (t => { if (!t) return null; const rg = document.createRange(); rg.selectNodeContents(t); const b = rg.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; })(document.querySelector("[data-map-header] h1")),
        postureBox: (t => t ? box(t) : null)(document.querySelector("[data-map-posture]")),
        stages: stages.length, pills: pills.length, shown, sw: sw ? box(sw) : null,
        container: { l: container.left, t: container.top, r: container.right, b: container.bottom },
        layer: !!map.getLayer("official-map"),
        opacity: map.getLayer("official-map") ? map.getPaintProperty("official-map", "raster-opacity") : null,
        chips: [...document.querySelectorAll("[data-map-cat]")].map(b => b.getAttribute("data-map-cat")),
        amen: (window.AMENITIES || []).reduce((o, a) => (o[a.type] = (o[a.type] || 0) + 1, o), {}),
        dots: document.querySelectorAll("[data-realmap-amenity]").length,
      };
    });
    const tag = C.fid;
    check(await page.locator('button[aria-label="Reset zoom"]').count() === 0, `${tag}: Reset is hidden at the opening view (the camera is home)`);
    const cardBefore = await page.evaluate(() => /MAP ERROR/.test(document.body.innerText));
    check(!cardBefore, `${tag}: no error card on the opening view`);
    // 1. pins
    if (C.pins) {
      check(r.pills === r.stages && r.stages > 0, `${tag}: checked geometry pins all ${r.stages} stages (got ${r.pills})`);
      check(r.posture === "OFFICIAL MAP", `${tag}: posture "${r.posture}", expected OFFICIAL MAP`);
    } else {
      check(r.pills === 0, `${tag}: pins OFF (got ${r.pills} stage pills)`);
      check(r.dots === 0, `${tag}: no amenity dots from poster positions (got ${r.dots})`);
      check(/STAGES PENDING/.test(r.posture || ""), `${tag}: posture "${r.posture}" must read STAGES PENDING`);
      if (C.overlay === "unchecked") check(/NOT TO SCALE/.test(r.posture || ""), `${tag}: unchecked art says NOT TO SCALE ("${r.posture}")`);
    }
    const clash = r.title && r.postureBox && r.title.l < r.postureBox.r && r.title.r > r.postureBox.l && r.title.t < r.postureBox.b && r.title.b > r.postureBox.t;
    check(!clash, `${tag}: posture label prints over the "Map" title at ${C.w || 393} pt`);
    // overlay strength follows the tier
    if (C.overlay === "checked") check(r.layer && r.opacity >= 0.75, `${tag}: festival map at full strength (layer ${r.layer}, opacity ${r.opacity})`);
    if (C.overlay === "unchecked") check(r.layer && r.opacity > 0 && r.opacity <= 0.5, `${tag}: festival map faded (layer ${r.layer}, opacity ${r.opacity})`);
    if (C.overlay === "none") check(!r.layer, `${tag}: no festival map drawn`);
    // 4. opening layout
    if (C.pins) {
      const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      const pairs = [];
      for (let i = 0; i < r.shown.length; i++) for (let j = i + 1; j < r.shown.length; j++) if (hit(r.shown[i], r.shown[j])) pairs.push(`${r.shown[i].id}/${r.shown[j].id}`);
      check(!pairs.length, `${tag}: opening view has overlapping stage pills: ${pairs.join(", ")}`);
      const under = r.sw ? r.shown.filter(p => hit(p, r.sw)).map(p => p.id) : [];
      check(!under.length, `${tag}: pills under the style switch: ${under.join(", ")}`);
      const inView = r.shown.filter(p => p.l >= r.container.l && p.r <= r.container.r && p.t >= r.container.t && p.b <= r.container.b);
      // Not every name fits at the zoom that frames the whole site (Outside
      // Lands: 7 names ~170 px wide across 393 pt); the collision pass hides
      // the rest, and zooming in must bring them back.
      check(inView.length >= Math.ceil(r.stages / 2), `${tag}: only ${inView.length} of ${r.stages} stage names readable at the opening view`);
      check(inView.length === r.shown.length, `${tag}: ${r.shown.length - inView.length} shown stage name(s) cut off at the map's edge`);
    }
    // 5. chips
    const wantChips = C.pins ? ["water", "med"].filter(t => r.amen[t]) : [];
    check(C.pins ? wantChips.length === 2 : true, `${tag}: fixture has Water and Medical (${JSON.stringify(r.amen)})`);
    for (const t of ["water", "med"]) check(r.chips.includes(t) === wantChips.includes(t), `${tag}: ${t} chip ${r.chips.includes(t) ? "shown" : "missing"} (chips ${r.chips.join(",")})`);
    if (C.pins) {
      const visDots = () => page.evaluate(() => [...document.querySelectorAll("[data-realmap-amenity]")].filter(e => e.style.display !== "none").map(e => e.getAttribute("data-realmap-amenity")));
      check((await visDots()).length === 0, `${tag}: amenity dots hidden on the Stages chip`);
      for (const t of ["water", "med"]) {
        if (!(await page.locator(`[data-map-cat="${t}"]`).count())) { check(false, `${tag}: no ${t} chip to tap`); continue; }
        await page.click(`[data-map-cat="${t}"]`); await page.waitForTimeout(150);
        const v = await visDots();
        check(v.length === r.amen[t] && v.every(x => x === t), `${tag}: ${t} chip shows its ${r.amen[t]} dots only (got ${v.join(",") || "none"})`);
        const names = await page.evaluate(() => [...document.querySelectorAll("[data-realmap-stage]")].filter(p => getComputedStyle(p).visibility !== "hidden").length);
        check(names === 0, `${tag}: ${t} chip clears the stage names off its dots (${names} still shown)`);
      }
      await page.click(`[data-map-cat="stages"]`); await page.waitForTimeout(150);
      const back = await page.evaluate(() => [...document.querySelectorAll("[data-realmap-stage]")].filter(p => getComputedStyle(p).visibility !== "hidden").length);
      check(back === r.shown.length, `${tag}: Stages chip brings the ${r.shown.length} names back (got ${back})`);
    }
    // 2. zoom column drives the real map
    const z = () => page.evaluate(() => window.__plurskyRealMap.getZoom());
    const z0 = await z();
    await page.click('button[aria-label="Zoom in"]'); await page.waitForTimeout(900);
    const z1 = await z();
    check(z1 > z0 + 0.5, `${tag}: + zooms the real map (${z0.toFixed(2)} → ${z1.toFixed(2)})`);
    if (C.pins) {
      const more = await page.evaluate(() => [...document.querySelectorAll("[data-realmap-stage]")].filter(p => getComputedStyle(p).visibility !== "hidden").length);
      check(r.shown.length === r.stages || more > r.shown.length, `${tag}: zooming in brings hidden names back (${r.shown.length} → ${more} of ${r.stages})`);
    }
    const resetShown = await page.locator('button[aria-label="Reset zoom"]').count();
    check(resetShown === 1, `${tag}: Reset appears once the camera moved`);
    // Two steps out (each animates, so wait between): one past the opening zoom.
    await page.click('button[aria-label="Zoom out"]'); await page.waitForTimeout(900);
    await page.click('button[aria-label="Zoom out"]'); await page.waitForTimeout(900);
    const z2 = await z();
    check(z2 < z1 - 0.5, `${tag}: − zooms the real map out (${z1.toFixed(2)} → ${z2.toFixed(2)})`);
    if (await page.locator('button[aria-label="Reset zoom"]').count()) { await page.click('button[aria-label="Reset zoom"]'); await page.waitForTimeout(1200); }
    else check(false, `${tag}: Reset missing after zooming out past the opening view`);
    const z3 = await z();
    check(Math.abs(z3 - z0) < 0.06, `${tag}: Reset returns to the opening view (${z0.toFixed(2)} vs ${z3.toFixed(2)})`);
    check(await page.locator('button[aria-label="Reset zoom"]').count() === 0, `${tag}: Reset hides at the opening view`);
    // 3. overlay failure latch (on a festival that draws one)
    if (C.overlay !== "none" && r.layer) {
      const back = await page.evaluate(async () => {
        const m = window.__plurskyRealMap;
        m.removeLayer("official-map"); m.removeSource("official-map");
        m.fire("styledata", { dataType: "style" }); await new Promise(res => setTimeout(res, 300));
        return !!m.getLayer("official-map");
      });
      check(back, `${tag}: control — with no failure, styledata re-adds a removed overlay (else the latch check is vacuous)`);
      const latched = await page.evaluate(async () => {
        const m = window.__plurskyRealMap;
        m.fire("error", { sourceId: "official-map", error: new Error("gate: overlay failed") });
        const gone = !m.getLayer("official-map") && !m.getSource("official-map");
        for (let i = 0; i < 3; i++) { m.fire("styledata", { dataType: "style" }); await new Promise(res => setTimeout(res, 200)); }
        return { gone, after: !!m.getLayer("official-map") || !!m.getSource("official-map") };
      });
      check(latched.gone, `${tag}: a failed overlay is dropped`);
      check(!latched.after, `${tag}: a failed overlay does NOT re-add itself on styledata`);
      const card = await page.evaluate(() => { const t = document.body.innerText; const i = t.indexOf("MAP ERROR"); return i < 0 ? null : t.slice(i, i + 160); });
      check(!card, `${tag}: a failed overlay puts no error card over the map (${card})`);
    }
    check(!errors.length, `${tag}: no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`✗ real map default: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ real map default (rendered): ${checks} checks across ${CASES.length} festivals`);
