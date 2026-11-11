#!/usr/bin/env node
// SPEC-178 map pins, in the real app on the real map (MapLibre from
// scripts/vendor/, tiles and style stubbed, nothing from the live network).
//
//   D1 every tagged item with GPS is one pin; no-GPS and untagged items are
//      absent (no placeholder, no estimate).
//   D2 each pin renders within its recorded accuracy radius of its capture fix.
//   D3 two shots metres apart cluster at the opening zoom; zoomed in, they split.
//   D4 tap a pin → that item opens full screen with its tag: night, stage, artist.
//   D5 tap a cluster → its items open (the cluster's items, nothing else).
//   D6 a tap never moves the camera (a camera move fetches tiles around where
//      the photo was taken, and a tile URL is a location).
//   D7 network: no request during boot, map, taps or toggle carries a fixture
//      coordinate, and nothing goes to Supabase.
//   D8 the Layers toggle empties the source; on again restores it.
//   D9 no GPS anywhere → empty source, the map otherwise unchanged, no errors.
//   P  timing: map "load" and pins-drawn with 0 vs 300 pins (printed, and a
//      loose ceiling so a pathological regression fails).
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
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPo6OgAAAM0AZnBrMCxAAAAAElFTkSuQmCC", "base64");
const BLANK_STYLE = JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#888" } }] });
const FID = "edc-orlando-2026", AT = "2026-11-09T15:00:00Z";
const BOOT = `http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`;
// After the weekend the tab bar swaps Map for Memories, so the gate opens the
// map by its deep link (?tab=map), which every phase accepts.
const BASE = `http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=map`;

// Fixture coordinates: distinctive digits so a leak is greppable in any URL or body.
const A = { lat: 28.5291731, lng: -81.4048917, acc: 8 };     // two shots ~3 m apart
const B = { lat: 28.5291953, lng: -81.4048702, acc: 12 };
const C = { lat: 28.5323377, lng: -81.4021991, acc: 25 };    // ~450 m away
const LEAKS = ["28.529", "81.404", "28.532", "81.402", "5291731", "4048917", "5323377"];

function haversineM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function newCtx(browser) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
  await ctx.route(/server\.arcgisonline\.com|tiles\.openfreemap\.org\/planet/, r => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
  await ctx.route(/tiles\.openfreemap\.org\/styles\//, r => r.fulfill({ status: 200, contentType: "application/json", body: BLANK_STYLE }));
  await wireVendor(ctx);
  await ctx.clock.install({ time: new Date(AT) });
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    localStorage.removeItem("plursky_use_realmap");
  }, FID);
  return ctx;
}

// Seeds moments shaped exactly as the import loop writes them. Artists are
// picked from the live lineup: three timed sets on nights 2 and 3.
async function seed(page, mode) {
  return page.evaluate(({ fid, A, B, C, mode }) => {
    const timed = ARTISTS.filter(a => a.start && a.end && (a.day === 2 || a.day === 3) && STAGES.some(s => s.id === a.stage));
    const [a1, a2, a3] = [timed[0], timed.find(x => x.id !== timed[0].id && x.stage !== timed[0].stage) || timed[1], timed[2]];
    const mk = (id, artist, gps, extra = {}) => ({
      id, night: artist ? artist.day : 2, text: "", artistId: artist ? artist.id : null, photoId: `p_${id}`, posterId: null,
      kind: "photo", duration: null, createdAt: 1, takenAt: "2026-11-07 22:45:00", takenAtSource: "exif",
      autoTagged: !!artist, tagSource: artist ? "exif" : "fallback", festivalId: fid, festivalStampSource: "capture-time",
      parsedGps: gps ? { lat: gps.lat, lng: gps.lng } : null, gpsAccM: gps ? gps.acc : null, hasGps: !!gps, ...extra,
    });
    let list;
    if (mode === "none") list = [mk("m_nogps", a1, null), mk("m_untagged", null, A)];
    else if (mode === "many") list = Array.from({ length: 300 }, (_, i) => mk(`m_${i}`, timed[i % timed.length], { lat: A.lat + (i % 20) * 2e-4, lng: A.lng + Math.floor(i / 20) * 2e-4, acc: 10 }));
    else list = [
      mk("m_a", a1, A), mk("m_b", a2, B), mk("m_c", a3, C, { kind: "video" }),
      mk("m_nogps", a1, null), mk("m_untagged", null, A),
    ];
    const byNight = {};
    for (const m of list) (byNight[m.night] = byNight[m.night] || []).push(m);
    localStorage.setItem("plursky_moments_v1", JSON.stringify(byNight));
    const cfg = window.FESTIVAL_CONFIG;
    const nm = n => (cfg.dayDates?.[n]?.name || cfg.dayDates?.[n]?.short);
    const st = a => STAGES.find(s => s.id === a.stage)?.name;
    return { a1: { id: a1.id, name: a1.name, stage: st(a1), night: nm(a1.day) }, a2: { id: a2.id, name: a2.name, stage: st(a2), night: nm(a2.day) }, a3: { id: a3.id, name: a3.name } };
  }, { fid: FID, A, B, C, mode });
}

async function openMap(page) {
  const t0 = Date.now();
  const up = await page.waitForFunction(() => !!window.__plurskyRealMap && window.__plurskyRealMap.loaded?.() && !!window.__plurskyRealMap.getSource("my-moments"),
    null, { timeout: 45000, polling: 100 }).then(() => true, () => false);
  return { up, ms: Date.now() - t0 };
}
const srcCount = page => page.evaluate(() => {
  const d = window.__plurskyRealMap?.getSource("my-moments")?.serialize?.().data;
  return d && d.features ? d.features.length : -1;
});
const camera = page => page.evaluate(() => { const m = window.__plurskyRealMap; const c = m.getCenter(); return { lng: +c.lng.toFixed(7), lat: +c.lat.toFixed(7), z: +m.getZoom().toFixed(4) }; });
// Screen point of a lat/lng inside the page.
const screenOf = (page, ll) => page.evaluate(ll => {
  const m = window.__plurskyRealMap; const p = m.project([ll.lng, ll.lat]); const r = m.getContainer().getBoundingClientRect();
  return { x: r.left + p.x, y: r.top + p.y };
}, ll);
const waitIdle = page => page.evaluate(() => new Promise(res => { const m = window.__plurskyRealMap; if (!m.isMoving() && m.areTilesLoaded()) setTimeout(res, 150); else m.once("idle", () => setTimeout(res, 150)); }));
const lightboxText = page => page.evaluate(() => document.body.innerText);

let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // ── Main fixture ─────────────────────────────────────────────────────────
  {
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const reqs = [];
    page.on("request", r => reqs.push({ url: r.url(), body: r.postData() || "" }));
    await page.goto(BOOT, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    const who = await seed(page, "main");
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    const { up } = await openMap(page);
    check(up, "the real map loads with the my-moments source");
    if (up) {
      await waitIdle(page);
      // D1
      const ids = await page.evaluate(() => window.__plurskyRealMap.getSource("my-moments").serialize().data.features.map(f => f.properties.id).sort());
      check(JSON.stringify(ids) === '["m_a","m_b","m_c"]', `D1 pins = the three tagged GPS items, no placeholder for m_nogps, none for m_untagged (got ${ids.join(",")})`);
      // D3 + D2: at the opening zoom A and B (3 m apart) share one cluster.
      const z0 = await camera(page);
      const openClusters = await page.evaluate(() => window.__plurskyRealMap.queryRenderedFeatures({ layers: ["my-moments-cluster"] }).map(f => f.properties.point_count));
      check(openClusters.includes(2), `D3 the two shots 3 m apart cluster at the opening zoom (cluster sizes: ${openClusters.join(",") || "none"})`);
      // Zoom in (the TEST moves the camera, not the app) so all three render as points.
      await page.evaluate(ll => window.__plurskyRealMap.jumpTo({ center: [ll.lng, ll.lat], zoom: 22 }), A);
      await waitIdle(page);
      const pts = await page.evaluate(() => window.__plurskyRealMap.queryRenderedFeatures({ layers: ["my-moments-point"] }).map(f => ({ id: f.properties.id, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })));
      const fx = { m_a: A, m_b: B };
      for (const id of ["m_a", "m_b"]) {
        const p = pts.find(x => x.id === id);
        const d = p ? haversineM(p, fx[id]) : Infinity;
        check(p && d <= fx[id].acc, `D2 ${id} renders within its ${fx[id].acc} m accuracy radius (off by ${Number.isFinite(d) ? d.toFixed(2) : "∞"} m)`);
      }
      check(pts.some(p => p.id === "m_a") && pts.some(p => p.id === "m_b"), "D3 zoomed in, the cluster splits into its two pins");
      // D4: tap m_a's pin. Pan first so the pin is OFF centre: a tap that
      // re-centred on the pin would then show up in D6 (the positive control).
      await page.evaluate(() => window.__plurskyRealMap.panBy([0, 80], { animate: false }));
      await waitIdle(page);
      const camBefore = await camera(page);
      const at = await screenOf(page, A);
      // A and B are 3 m apart; at z22 they are ~50 px apart, so this hits A alone.
      await page.mouse.click(at.x, at.y);
      const opened = await page.waitForFunction(n => document.body.innerText.includes(n), who.a1.name, { timeout: 8000 }).then(() => true, () => false);
      const txt = await lightboxText(page);
      check(opened, `D4 tapping the pin opens the item with its artist (${who.a1.name})`);
      check(!!who.a1.stage && txt.includes(who.a1.stage), `D4 …its stage (${who.a1.stage})`);
      check(!!who.a1.night && txt.includes(who.a1.night), `D4 …and its night (${who.a1.night})`);
      // D6
      const camAfter = await camera(page);
      check(JSON.stringify(camBefore) === JSON.stringify(camAfter), `D6 a pin tap does not move the camera (${JSON.stringify(camBefore)} → ${JSON.stringify(camAfter)})`);
      // Close the viewer.
      await page.keyboard.press("Escape");
      await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^(close|×|✕)$/i.test((x.getAttribute("aria-label") || x.innerText || "").trim())); b && b.click(); });
      await page.waitForTimeout(300);
      // D5: back to the opening view, tap the 2-cluster.
      // Centre the cluster (the test's camera move) so no sheet or control covers it.
      await page.evaluate(([ll, z]) => window.__plurskyRealMap.jumpTo({ center: [ll.lng, ll.lat], zoom: z }), [A, z0.z]);
      await waitIdle(page);
      const cl = await page.evaluate(() => {
        const f = window.__plurskyRealMap.queryRenderedFeatures({ layers: ["my-moments-cluster"] }).find(x => x.properties.point_count === 2);
        return f ? { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] } : null;
      });
      if (cl) {
        await page.evaluate(() => window.__plurskyRealMap.panBy([0, 60], { animate: false }));
        await waitIdle(page);
        const camB = await camera(page);
        const pt0 = await screenOf(page, cl);
        await page.mouse.click(pt0.x, pt0.y);
        const ok5 = await page.waitForFunction(([n1, n2]) => document.body.innerText.includes(n1) || document.body.innerText.includes(n2), [who.a1.name, who.a2.name], { timeout: 8000 }).then(() => true, () => false);
        check(ok5, "D5 tapping the cluster opens its items");
        const t5 = await lightboxText(page);
        check(!t5.includes(who.a3.name) || who.a3.name === who.a1.name || who.a3.name === who.a2.name, "D5 …and not the far-away item");
        check(JSON.stringify(camB) === JSON.stringify(await camera(page)), "D6 a cluster tap does not move the camera");
      } else check(false, "D5 a 2-cluster is on screen to tap");
      // D8: the Layers row, tapped the way a person would.
      await page.evaluate(() => document.querySelector('button[aria-label="Map layers"]')?.click());
      const row = await page.waitForFunction(() => [...document.querySelectorAll('[role="button"]')].find(e => e.innerText.trim() === "My photos & videos"), null, { timeout: 5000 }).then(() => true, () => false);
      check(row, "D8 the Layers menu has a My photos & videos row");
      await page.evaluate(() => [...document.querySelectorAll('[role="button"]')].find(e => e.innerText.trim() === "My photos & videos")?.click());
      await page.waitForTimeout(400);
      check((await srcCount(page)) === 0, "D8 turning the row off empties the pin source at once");
      check(await page.evaluate(() => localStorage.getItem("plursky_map_mypins")) === "0", "D8 the choice is remembered");
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
      const off = await openMap(page);
      check(off.up && (await srcCount(page)) === 0, "D8 with My photos & videos off, the source is empty");
      await page.evaluate(() => { localStorage.removeItem("plursky_map_mypins"); });
      // D7: every request so far.
      const leaked = reqs.filter(r => LEAKS.some(l => r.url.includes(l) || r.body.includes(l)));
      check(leaked.length === 0, `D7 no request carries a fixture coordinate (${leaked.slice(0, 2).map(r => r.url.slice(0, 120)).join(" | ")})`);
      // The viewer's existing song-guess lookup (tracklists / proxy-setlist,
      // keyed by artist name + festival id, the same calls Memories makes) is
      // the only Supabase traffic allowed; it carries no coordinate (above)
      // and no moment id, and nothing is written (no POST/PATCH/upsert).
      const sb = reqs.filter(r => /supabase\.co/.test(r.url));
      const sbOther = sb.filter(r => !/\/rest\/v1\/tracklists\?|functions\.supabase\.co\/proxy-setlist\?/.test(r.url));
      check(sbOther.length === 0, `D7 no Supabase call beyond the viewer's tracklist lookup (${sbOther.slice(0, 3).map(r => r.url.slice(0, 140)).join(" | ")})`);
      check(!sb.some(r => /m_a|m_b|m_c|p_m_/.test(r.url + r.body)), "D7 no Supabase call carries a moment id");
      check(!sb.some(r => r.body), "D7 nothing is written to Supabase (no request body)");
      console.log(`  · requests observed: ${reqs.length} (none carrying a coordinate)`);
    }
    check(!errors.length, `no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }

  // ── D9: no GPS anywhere ──────────────────────────────────────────────────
  {
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(BOOT, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    await seed(page, "none");
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    const r = await openMap(page);
    check(r.up && (await srcCount(page)) === 0, "D9 no GPS → the pin source is empty (no placeholder)");
    const drawn = r.up ? await page.evaluate(() => window.__plurskyRealMap.queryRenderedFeatures({ layers: ["my-moments-point", "my-moments-cluster"].filter(id => window.__plurskyRealMap.getLayer(id)) }).length) : -1;
    check(drawn === 0, `D9 nothing is drawn (${drawn})`);
    check(!errors.length, `D9 no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }

  // ── P: timing, 0 vs 300 pins ─────────────────────────────────────────────
  {
    const times = {};
    for (const mode of ["none", "many"]) {
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const ctx = await newCtx(browser);
        const page = await ctx.newPage();
        await page.goto(BOOT, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
        await seed(page, mode);
        const t0 = Date.now();
        await page.goto(BASE, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
        const boot = Date.now() - t0;
        const r = await openMap(page);
        if (r.up) await waitIdle(page);
        const n = await srcCount(page);
        runs.push({ boot, map: r.ms, n });
        await ctx.close();
      }
      const med = k => runs.map(x => x[k]).sort((a, b) => a - b)[1];
      times[mode] = { boot: med("boot"), map: med("map"), n: runs[0].n };
    }
    console.log(`  · P cold boot median: ${times.none.boot} ms (0 pins) vs ${times.many.boot} ms (300 pins)`);
    console.log(`  · P map ready median: ${times.none.map} ms (0 pins) vs ${times.many.map} ms (${times.many.n} pins)`);
    check(times.many.n === 300, `P the 300-pin fixture draws 300 (${times.many.n})`);
    check(times.many.map < times.none.map + 3000, `P 300 pins add under 3 s to map ready (+${times.many.map - times.none.map} ms)`);
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`test-map-pins-browser: ${checks - failed}/${checks} passed`);
process.exit(failed ? 1 : 0);
