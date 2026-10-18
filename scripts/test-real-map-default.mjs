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
//   7. Nothing pins, routes or navigates to a poster coordinate: on Ultra a
//      crew member sharing only a stage gets no marker, meet-at-stage (crew
//      HEAD OVER) and a rally with no lat/lng are text-only with no meet pin
//      and no route, and a saved stage offers no GO HERE. Summerfest is the
//      control: the same steps DO pin, route and offer GO HERE.
//   8. The opening camera frames the grounds (ACL opened ~600 m off them),
//      and a real fix at ACL's AMEX and Miller Lite stages reads on-site (the
//      old centre put both outside the 644 m radius: OFF-SITE, no dot).
//   f73 ruling: with GPS off, the demo "you" dot shows only where checked
//      geometry places it; on unchecked festivals it is hidden.
// MapLibre comes from unpkg (pinned 4.7.1, like React here); basemap tiles are
// stubbed with a blank tile so the gate never depends on Esri or OpenFreeMap.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";

import { wireVendor } from "./lib/vendor-cdn.mjs";
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
const tag0 = C => C.fix ? `${C.fid}@${C.fix.stage}` : C.fid;
const CASES = [
  { fid: "summerfest-2026",  at: "2026-06-19T23:00:00Z", pins: true,  overlay: "checked" },
  // Outside Lands is wide east-west: its edge stages are where a pan limit
  // that ignores the opening view clipped a name off-screen.
  { fid: "outside-lands-2026", at: "2026-08-08T23:00:00Z", pins: true, overlay: "checked" },
  // Ultra's is the longest posture label; at 393 pt it is the one that fits
  // beside a shrinking title and printed over it. III Points runs at 320 pt.
  { fid: "ultra-miami-2026", at: "2026-03-28T23:00:00Z", pins: false, overlay: "unchecked" },
  { fid: "iii-points-2026",  at: "2026-10-17T02:00:00Z", pins: false, overlay: "unchecked", w: 320, lock: true },
  // ACL: no venue box or footprint, and its configured centre is off the park.
  { fid: "acl-2026",         at: "2026-10-10T22:00:00Z", pins: false, overlay: "unchecked", fix: { stage: "amex",   latitude: 30.267233, longitude: -97.763236 } },
  { fid: "acl-2026",         at: "2026-10-10T22:00:00Z", pins: false, overlay: "unchecked", fix: { stage: "miller", latitude: 30.269017, longitude: -97.769316 }, only: "fix" },
];
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  // ONLY=<festival id> runs one festival's cases (local triage; verify runs all).
  for (const C of CASES.filter(c => !process.env.ONLY || c.fid === process.env.ONLY)) {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: C.w || 393, height: 852 },
      ...(C.fix ? { geolocation: { latitude: C.fix.latitude, longitude: C.fix.longitude, accuracy: 8 }, permissions: ["geolocation"] } : {}) });
    await wireVendor(ctx);   // React, ReactDOM, supabase-js from scripts/vendor/, never the live CDN
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
    // Before MapScreen mounts: crew presence and rallies are fed by the test
    // (Supabase is not reachable here), and one stage is already saved.
    await page.evaluate(() => {
      const st = (window.STAGES || []).find(s => Number.isFinite(s.x) && Number.isFinite(s.y));
      window.__gateStage = st ? { id: st.id, name: st.name, x: st.x, y: st.y } : null;
      window.sbOnPresenceChange = cb => { window.__presCb = cb; return () => {}; };
      window.sbOnRally = cb => { window.__rallyCb = cb; return () => {}; };
      window.sbGetMyPresId = () => "gate-me";
      if (st) localStorage.setItem("plursky_saved_stages_v1", JSON.stringify([st.id]));
    });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Map")?.click());
    const up = await page.waitForFunction(() => !!window.__plurskyRealMap && [...document.querySelectorAll(".maplibregl-marker")].some(m => m.querySelector(".plursky-avatar-halo")),
      null, { timeout: 90000 }).then(() => true, () => false);
    check(up, `${C.fid}: the real map is the default and finishes loading`);
    if (!up) { await ctx.close(); continue; }
    if (C.overlay !== "none") await page.waitForFunction(() => !!window.__plurskyRealMap.getLayer("official-map"), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.clock.runFor(100);   // the opening declutter frame runs on the fake clock too
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
    // 8. the opening view frames the grounds (real-world sources only)
    const gr = await page.evaluate(() => {
      // The grounds from the config itself, not from the code under test:
      // surveyed footprint, else the venue box, else the anchors' measured lat/lng.
      const cfg = window.FESTIVAL_CONFIG, fp = cfg.venue?.footprint || cfg.footprint, fb = cfg.venue?.festivalBounds;
      const g = fp?.length >= 3 ? fp.map(([la, lo]) => [lo, la])
        : fb ? [[fb.west, fb.south], [fb.east, fb.north]]
        : (cfg.gpsAnchors || []).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lng)).map(a => [a.lng, a.lat]);
      const map = window.__plurskyRealMap;
      const c = map.getCenter(), box = map.getContainer().getBoundingClientRect();
      const lats = g.map(p => p[1]), lngs = g.map(p => p[0]);
      const pad = 0.0015; // ~150 m
      const centreIn = g.length >= 2 && c.lat >= Math.min(...lats) - pad && c.lat <= Math.max(...lats) + pad && c.lng >= Math.min(...lngs) - pad && c.lng <= Math.max(...lngs) + pad;
      const off = g.filter(p => { const q = map.project(p); return q.x < 0 || q.y < 0 || q.x > box.width || q.y > box.height; }).length;
      return { n: g.length, centreIn, off, c: [+c.lat.toFixed(5), +c.lng.toFixed(5)] };
    });
    check(gr.n >= 2, `${C.fid}: no grounds to frame (${gr.n} points)`);
    check(gr.centreIn, `${C.fid}: opening view centred off the grounds (${gr.c})`);
    if (!C.pins) check(gr.off === 0, `${C.fid}: ${gr.off} of ${gr.n} grounds points off screen at the opening view`);
    // f73: the demo dot only where checked geometry places it. (GPS starts on;
    // with no permission granted the dot is the demo position.)
    const you = () => page.evaluate(() => document.querySelector("[data-realmap-you]")?.getAttribute("data-realmap-you") || "missing");
    const gpsText = () => page.evaluate(() => document.querySelector('button[aria-label="Toggle GPS"]')?.innerText.trim());
    if (!C.fix) {
      const you0 = await you();
      check(you0 === (C.pins ? "shown" : "hidden"), `${C.fid}: demo "you" dot with no fix is ${you0} (want ${C.pins ? "shown" : "hidden"})`);
    } else {
      // 8: a real fix on a measured stage reads on-site, and its dot shows.
      // A fresh fix right before reading: Chrome's watchPosition raises TIMEOUT
      // 15 s after the last update when an emulated fix never moves, and the
      // map load can take longer than that on a busy machine.
      await ctx.setGeolocation({ latitude: C.fix.latitude + 1e-6, longitude: C.fix.longitude, accuracy: 8 });
      const label = await page.waitForFunction(() => {
        const t = document.querySelector('button[aria-label="Toggle GPS"]')?.innerText.trim();
        return t === "LIVE" || t === "OFF-SITE" ? t : null;   // the on-site verdict, not a transient state
      }, null, { timeout: 15000 }).then(h => h.jsonValue(), async () => `timeout (pill "${await gpsText()}")`);
      check(label === "LIVE", `${tag0(C)}: a real fix at ${C.fix.stage} reads "${label}" (want LIVE, not OFF-SITE)`);
      check(await you() === "shown", `${tag0(C)}: the live dot at ${C.fix.stage} is ${await you()}`);
      // GPS off → the dot falls back to the demo position, which ACL cannot place.
      await page.click('button[aria-label="Toggle GPS"]'); await page.waitForTimeout(500);
      check(await gpsText() === "OFF" && await you() === "hidden", `${tag0(C)}: GPS off leaves the dot ${await you()} (pill "${await gpsText()}"), want hidden`);
    }
    if (C.only === "fix") { check(!errors.length, `${tag0(C)}: no page errors (${errors.slice(0, 2).join(" | ")})`); await ctx.close(); continue; }
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
    // A camera move animates on requestAnimationFrame, and this context runs
    // on the FAKE clock (ctx.clock.install above): the page's rAF fires only
    // when Playwright's clock ticks, which lags real time when this Mac is
    // loaded. A real-time wait after the move then reads the pills before the
    // declutter frame the last move queued has run (verify on this Mac:
    // Outside Lands 4 → 4, Summerfest 6 → 6, both green alone; a calm probe
    // showed the count still moving only when the fake clock advanced). So:
    // wait until the map says it has stopped (bounded, so a map that never
    // settles still fails), then advance the fake clock itself so the queued
    // frame runs, whatever the wall clock is doing.
    const settled = async () => { await page.waitForFunction(() => !window.__plurskyRealMap.isMoving(), null, { timeout: 15000 }).catch(() => {}); await page.clock.runFor(100); };
    const z0 = await z();
    await page.click('button[aria-label="Zoom in"]'); await settled();
    const z1 = await z();
    check(z1 > z0 + 0.5, `${tag}: + zooms the real map (${z0.toFixed(2)} → ${z1.toFixed(2)})`);
    if (C.pins) {
      const more = await page.evaluate(() => [...document.querySelectorAll("[data-realmap-stage]")].filter(p => getComputedStyle(p).visibility !== "hidden").length);
      check(r.shown.length === r.stages || more > r.shown.length, `${tag}: zooming in brings hidden names back (${r.shown.length} → ${more} of ${r.stages})`);
    }
    const resetShown = await page.locator('button[aria-label="Reset zoom"]').count();
    check(resetShown === 1, `${tag}: Reset appears once the camera moved`);
    // Two steps out (each animates, so wait between): one past the opening zoom.
    await page.click('button[aria-label="Zoom out"]'); await settled();
    await page.click('button[aria-label="Zoom out"]'); await settled();
    const z2 = await z();
    check(z2 < z1 - 0.5, `${tag}: − zooms the real map out (${z1.toFixed(2)} → ${z2.toFixed(2)})`);
    if (await page.locator('button[aria-label="Reset zoom"]').count()) { await page.click('button[aria-label="Reset zoom"]'); await settled(); }
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
    // 7. targets from poster art: none on unchecked festivals; Summerfest is the control.
    if (C.fid === "summerfest-2026" || C.fid === "ultra-miami-2026") {
      const want = C.pins;   // checked geometry places; unchecked must not
      const st = await page.evaluate(() => window.__gateStage);
      const state = () => page.evaluate(() => {
        const map = window.__plurskyRealMap, ms = [...document.querySelectorAll(".maplibregl-marker")];
        const route = map.getSource("route")?.serialize?.().data;
        return {
          crew: ms.filter(m => /GATE AVA|GATE BO/.test(m.textContent)).length,
          halos: ms.filter(m => m.querySelector(".plursky-avatar-halo")).length,
          route: route?.geometry?.coordinates?.length || 0,
          textOnly: !!document.querySelector("[data-meet-text-only]"),
          sheet: (document.querySelector("[data-meet-text-only]") || {}).innerText || "",
          body: document.body.innerText,
        };
      });
      const base = await state();
      // Crew sharing only a stage.
      await page.evaluate(st => window.__presCb({ "gate-a": { name: "Gate Ava", color: "#e85d2e", stageId: st.id, ts: Date.now() },
        "gate-b": { name: "Gate Bo", color: "#4ade80", stageId: st.id, ts: Date.now() } }), st);
      await page.waitForTimeout(400);
      const crew = await state();
      check(want ? crew.crew === 2 : crew.crew === 0, `${tag}: stage-only crew markers ${crew.crew} (want ${want ? 2 : 0})`);
      // Meet at the stage they gathered at.
      const head = page.locator("button", { hasText: "HEAD OVER" });
      check(await head.count() === 1, `${tag}: crew-gathered HEAD OVER offered`);
      if (await head.count()) {
        await head.first().click(); await page.waitForTimeout(500);
        const m = await state();
        check(want ? m.halos === base.halos + 1 : m.halos === base.halos, `${tag}: meet-at-stage pin ${m.halos - base.halos} (want ${want ? 1 : 0})`);
        check(want ? m.route === 2 : m.route === 0, `${tag}: meet-at-stage route has ${m.route} points (want ${want ? 2 : 0})`);
        check(m.textOnly === !want, `${tag}: meet-at-stage card text-only = ${m.textOnly}`);
        if (!want) {
          check(m.sheet.includes(st.name) && !/Unsurveyed|ETA|ROUTE PREVIEW|LIVE/i.test(m.sheet), `${tag}: text-only card names the stage, no ETA/route/Unsurveyed ("${m.sheet.replace(/\s+/g, " ").slice(0, 120)}")`);
          check(!/RALLY CREW/.test(m.body), `${tag}: no RALLY CREW for a text-only target`);
        }
        await page.locator("button", { hasText: "CANCEL" }).first().click().catch(() => {}); await page.waitForTimeout(300);
      }
      // A rally with no lat/lng (an older client sends poster x/y).
      await page.evaluate(st => window.__rallyCb({ rallyId: "gate-r1", fromName: "Gate Ava", x: st.x, y: st.y, label: st.name }), st);
      await page.waitForTimeout(300);
      const rh = page.locator("button", { hasText: "HEAD OVER" });
      if (await rh.count()) {
        await rh.first().click(); await page.waitForTimeout(500);
        const m = await state();
        check(want ? m.halos === base.halos + 1 : m.halos === base.halos, `${tag}: rally pin ${m.halos - base.halos} (want ${want ? 1 : 0})`);
        check(want ? m.route === 2 : m.route === 0, `${tag}: rally route has ${m.route} points (want ${want ? 2 : 0})`);
        check(m.textOnly === !want, `${tag}: rally card text-only = ${m.textOnly}`);
        await page.locator("button", { hasText: "CANCEL" }).first().click().catch(() => {}); await page.waitForTimeout(300);
      } else check(false, `${tag}: rally banner never offered HEAD OVER`);
      // Saved spot → stage card → GO HERE.
      await page.locator('input[placeholder="Search stages or artists…"]').focus(); await page.waitForTimeout(300);
      const spot = page.locator(`button[aria-label="Open ${st.name}"]`);
      check(await spot.count() >= 1, `${tag}: saved spot for ${st.name} offered`);
      if (await spot.count()) {
        await spot.first().click(); await page.waitForTimeout(600);
        const go = await page.locator("button", { hasText: /^Go here$/ }).count();
        const none = await page.locator("[data-stage-no-route]").count();
        check(want ? go === 1 && none === 0 : go === 0 && none === 1, `${tag}: saved stage GO HERE ${go}, no-route note ${none}`);
        if (want && go) {
          await page.locator("button", { hasText: /^Go here$/ }).first().click(); await page.waitForTimeout(400);
          check(/Routing to/i.test(await page.evaluate(() => document.body.innerText)), `${tag}: control — GO HERE routes`);
        }
        const s2 = await state();
        check(want ? s2.route === 2 : s2.route === 0, `${tag}: selected stage route has ${s2.route} points (want ${want ? 2 : 0})`);
      }
    }
    // Item 1 (Oct 16 spec): a lockToFootprint festival's map cannot leave the
    // site. A pan to downtown Miami (~2.7 km south) is refused, a zoom out to
    // the whole region is held, and a pan inside the site still moves (control).
    if (C.lock) {
      const lk = await page.evaluate(() => {
        const map = window.__plurskyRealMap, fp = window.FESTIVAL_CONFIG.venue.footprint;
        const lats = fp.map(p => p[0]), lngs = fp.map(p => p[1]);
        const box = { s: Math.min(...lats), n: Math.max(...lats), w: Math.min(...lngs), e: Math.max(...lngs) };
        // jumpTo applies maxBounds/minZoom synchronously; no wait (the page clock is fake).
        const inner = { lng: (box.w + box.e) / 2, lat: (box.s + box.n) / 2 };
        map.jumpTo({ center: { lng: -80.1937, lat: 25.7743 } });   // downtown Miami
        const c1 = map.getCenter();
        map.jumpTo({ center: inner });                               // back to the site's centre
        const c0 = map.getCenter();
        map.jumpTo({ zoom: 3 });
        return { box, inner, c0: { lng: c0.lng, lat: c0.lat }, c1: { lng: c1.lng, lat: c1.lat }, zoom: map.getZoom(), minZoom: map.getMinZoom() };
      });
      const m = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180));
      check(m(lk.c0, lk.inner) < 30 && m(lk.c0, lk.c1) > 50, `${tag}: control — a pan to the site's centre moves the map there (${Math.round(m(lk.c0, lk.inner))} m off target, moved ${Math.round(m(lk.c0, lk.c1))} m)`);
      const nearest = { lat: Math.min(Math.max(lk.c1.lat, lk.box.s), lk.box.n), lng: Math.min(Math.max(lk.c1.lng, lk.box.w), lk.box.e) };
      check(m(lk.c1, nearest) < 400, `${tag}: a pan to downtown Miami is refused (centre ${Math.round(m(lk.c1, nearest))} m from the site, limit 400 m)`);
      check(lk.minZoom > 10 && lk.zoom >= lk.minZoom, `${tag}: zooming out to the region is held at minZoom ${lk.minZoom.toFixed(2)} (got ${lk.zoom.toFixed(2)})`);
    }
    check(!errors.length, `${tag}: no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`✗ real map default: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ real map default (rendered): ${checks} checks across ${CASES.length} festivals`);
