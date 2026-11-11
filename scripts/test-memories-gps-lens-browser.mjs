#!/usr/bin/env node
// Memories PHOTOS lens in the real app (Memories → "Where this night
// happened" → PHOTOS), real-GPS only.
//   B1 the lens renders, with no poster image under it.
//   B2 the moments on the lens are exactly the ones with a valid fix; a moment
//      with no coordinates never appears (not as a pin, not inside a cluster).
//   B3 on screen, every pair of pins sits at one px-per-metre scale and its
//      true bearing (north up): no position comes from anywhere but the fix.
//   B4 no GPS in the night → the empty state, zero pins.
//   B5 network: no request during boot or the lens carries a fixture coordinate.
//   B6 no page errors. A screenshot is written for the pixel check.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "edc-orlando-2026", AT = "2026-11-09T15:00:00Z";
const URL_ = `http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=memories`;
const SHOT = process.env.GPS_LENS_SHOT || join(tmpdir(), "plursky-memories-gps-lens.png");

// Distinctive digits so a leak is greppable in any URL or body.
const FIX = {
  a: { lat: 28.5291731, lng: -81.4048917 },
  b: { lat: 28.5296113, lng: -81.4040227 },
  c: { lat: 28.5283377, lng: -81.4055991 },
};
const LEAKS = ["28.529", "81.404", "28.528", "81.405", "5291731", "4048917", "5283377"];
const enM = (p, q) => { const R = 6371008.8, k = Math.PI / 180; return { e: (q.lng - p.lng) * k * R * Math.cos(((p.lat + q.lat) / 2) * k), n: (q.lat - p.lat) * k * R }; };

async function newCtx(browser) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
  await wireVendor(ctx);
  await ctx.route(/supabase\.co|server\.arcgisonline\.com|openfreemap\.org/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.clock.install({ time: new Date(AT) });
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    localStorage.setItem("plursky_maplens_mode", "photos");
  }, FID);
  return ctx;
}
async function seed(page, mode) {
  return page.evaluate(({ fid, FIX, mode }) => {
    const timed = ARTISTS.filter(a => a.start && a.end && a.day === 2);
    const mk = (id, artist, gps, extra = {}) => ({
      id, night: 2, text: "", artistId: artist ? artist.id : null, photoId: `p_${id}`, posterId: null, kind: "photo", duration: null,
      createdAt: 1, takenAt: "2026-11-07 22:45:00", takenAtSource: "exif", autoTagged: !!artist, tagSource: artist ? "exif" : "fallback",
      festivalId: fid, festivalStampSource: "capture-time", parsedGps: gps, gpsAccM: gps ? 8 : null, hasGps: !!gps, ...extra,
    });
    const list = mode === "none"
      ? [mk("m_nogps", timed[0], null), mk("m_nogps2", timed[1], null)]
      : [mk("m_a", timed[0], FIX.a), mk("m_b", timed[1], FIX.b, { kind: "video", takenAt: "2026-11-07 23:10:00" }), mk("m_c", null, FIX.c, { takenAt: "2026-11-07 21:05:00" }),
         mk("m_nogps", timed[0], null), mk("m_null", timed[1], { lat: 0, lng: 0 })];
    localStorage.setItem("plursky_moments_v1", JSON.stringify({ 2: list }));
    // Real image blobs, so the pixel check sees thumbnails, not placeholders.
    const hues = { m_a: 330, m_b: 200, m_c: 45, m_nogps: 120, m_nogps2: 260, m_null: 0 };
    return Promise.all(list.map(m => new Promise(res => {
      const c = document.createElement("canvas"); c.width = c.height = 96;
      const g = c.getContext("2d"); g.fillStyle = `hsl(${hues[m.id] || 0},70%,45%)`; g.fillRect(0, 0, 96, 96);
      g.fillStyle = "#fff"; g.font = "bold 22px sans-serif"; g.fillText(m.id.slice(2, 4).toUpperCase(), 30, 56);
      c.toBlob(b => _putPhoto(m.photoId, b).then(res, res), "image/jpeg", 0.8);
    })));
  }, { fid: FID, FIX, mode });
}
async function openLens(page) {
  await page.goto(URL_, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
  const btn = page.getByRole("button", { name: /Where this night happened/ }).first();
  await btn.waitFor({ timeout: 30000 });
  await btn.click();
  await page.waitForSelector("[data-gps-lens], [data-gps-lens-empty]", { timeout: 15000 });
}

let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  {
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const reqs = []; page.on("request", r => reqs.push(`${r.url()} ${r.postData() || ""}`));
    await page.goto(URL_, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    await seed(page, "main");
    await openLens(page);
    const r = await page.evaluate(() => {
      const lens = document.querySelector("[data-gps-lens]");
      if (!lens) return null;
      const box = lens.getBoundingClientRect();
      const pins = [...lens.querySelectorAll("[data-moment-ids]")].map(el => { const b = el.getBoundingClientRect(); return { ids: el.dataset.momentIds.split(","), x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      const img = window.FESTIVAL_CONFIG.mapImage;
      return { pins, html: lens.outerHTML, poster: !!lens.querySelector("image, img[src*='map'], svg image") || (img ? lens.outerHTML.includes(img) : false), box: { w: box.width, h: box.height }, bar: document.querySelector("[data-gps-lens-bar]")?.getAttribute("data-gps-lens-bar") };
    });
    check(!!r, "B1 the PHOTOS lens renders");
    if (r) {
      check(!r.poster, "B1b no poster image under the lens");
      const ids = r.pins.flatMap(p => p.ids).sort();
      check(JSON.stringify(ids) === '["m_a","m_b","m_c"]', `B2 the lens holds exactly the three moments with a fix (got ${ids.join(",")})`);
      check(!/m_nogps|m_null/.test(r.html), "B2b the no-GPS and null-island moments appear nowhere in the lens");
      check(r.pins.length === 3, `B3 setup: three separate pins at this scale (got ${r.pins.length})`);
      if (r.pins.length === 3) {
        const at = Object.fromEntries(r.pins.map(p => [p.ids[0], p]));
        const pairs = [["m_a", "m_b"], ["m_a", "m_c"], ["m_b", "m_c"]];
        const ks = []; let bearing = true;
        for (const [p, q] of pairs) {
          const { e, n } = enM(FIX[p.slice(2)], FIX[q.slice(2)]);
          const dx = at[q].x - at[p].x, dy = at[q].y - at[p].y;
          ks.push(Math.hypot(dx, dy) / Math.hypot(e, n));
          let d = Math.abs(Math.atan2(-dy, dx) - Math.atan2(n, e)); if (d > Math.PI) d = 2 * Math.PI - d;
          if (d > 0.03) bearing = false;
        }
        check(Math.max(...ks) / Math.min(...ks) < 1.03, `B3 one px-per-metre scale across every pair (${ks.map(k => k.toFixed(3)).join(", ")})`);
        check(bearing, "B3b every pair's on-screen bearing is its true bearing, north up");
      }
      check(!!r.bar, "B3c a metric scale bar is drawn");
    }
    const sd = dirname(SHOT); if (!existsSync(sd)) mkdirSync(sd, { recursive: true });
    await page.locator("[data-gps-lens]").locator("..").screenshot({ path: SHOT }).catch(() => {});
    check(!reqs.some(s => LEAKS.some(l => s.includes(l))), "B5 no request carries a fixture coordinate");
    check(!errors.length, `B6 no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  {
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    await seed(page, "none");
    await openLens(page);
    const e = await page.evaluate(() => ({ empty: !!document.querySelector("[data-gps-lens-empty]"), pins: document.querySelectorAll("[data-moment-ids]").length }));
    check(e.empty && e.pins === 0, `B4 no GPS in the night → empty state, zero pins (empty=${e.empty}, pins=${e.pins})`);
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`test-memories-gps-lens-browser: ${checks - failed}/${checks} passed`);
process.exit(failed ? 1 : 0);
