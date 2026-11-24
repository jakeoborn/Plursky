#!/usr/bin/env node
// Pixels for Your weekend (SPEC-200 Build 3): the sheet on the real app, at
// 393 and 320, default text and 200% text (every resolved font size doubled,
// as test-memories-a11y does it). Evidence is seeded on this browser only,
// on real Ultra acts' own windows: a full set, half a set, a photo, your own
// Full answer, a 3-minute walk-by (left out) and "I wasn't there" (left out).
//
//   node scripts/capture-your-weekend.mjs <out-dir>
//
// Also fails (exit 1) if anything in the sheet runs past the screen's edge,
// if the sheet shows a set it should leave out, or says Missed.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2];
if (!OUT) { console.error("usage: node scripts/capture-your-weekend.mjs <out-dir>"); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "ultra-miami-2026";
const AFTER = Date.UTC(2026, 2, 30, 16, 0);         // Mon Mar 30 2026, the day after Ultra
let bad = 0;
const check = (ok, msg) => { if (!ok) { bad++; console.log(`  ✗  ${msg}`); } };
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const width of [393, 320]) for (const big of [false, true]) {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 852 }, deviceScaleFactor: 2 });
    await wireVendor(ctx);
    await ctx.route(/supabase\.co/, r => r.abort());
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("battery_saver_mode", "off");
      localStorage.setItem("plursky_flag_your_weekend", "on");
    }, FID);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(AFTER));
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.YourWeekendSheet === "function", FID, { timeout: 60000 });
    const picked = await page.evaluate(() => {
      const cfg = window.FESTIVAL_CONFIG;
      const acts = (window.ARTISTS || []).filter(a => a.stage && attendTimeClass(a) !== "blank")
        .map(a => ({ a, w: attendSetWindowMs(a, cfg, []) })).filter(x => x.w && x.w.endMs - x.w.startMs >= 45 * 60000)
        .sort((x, y) => x.w.startMs - y.w.startMs);
      // Six acts on distinct stages, spread over the nights.
      const out = [], used = new Set();
      for (const x of acts) { const k = `${x.a.day}:${x.a.stage}`; if (out.length < 6 && !used.has(k) && !out.some(o => Math.abs(o.w.startMs - x.w.startMs) < 2 * 3600000 && o.a.day === x.a.day)) { used.add(k); out.push(x); } }
      const [full, half, photo, hand, walk, absent] = out;
      const runs = {};
      const add = (stage, from, to) => (runs[stage] = runs[stage] || []).push({ from, to, src: "gps" });
      add(full.a.stage, full.w.startMs - 2 * 60000, full.w.endMs + 2 * 60000);
      add(half.a.stage, half.w.startMs + 5 * 60000, half.w.startMs + 5 * 60000 + (half.w.endMs - half.w.startMs) / 2);
      add(walk.a.stage, walk.w.startMs + 20 * 60000, walk.w.startMs + 23 * 60000);
      add(absent.a.stage, absent.w.startMs, absent.w.endMs);
      localStorage.setItem("plursky_set_intervals_v1", JSON.stringify({ [cfg.id]: { last: null, runs } }));
      localStorage.setItem("plursky_set_taps_v1", JSON.stringify({ [cfg.id]: [{ ms: photo.w.startMs + 25 * 60000, stageId: photo.a.stage }] }));
      localStorage.setItem("plursky_set_manual_v1", JSON.stringify({ [cfg.id]: { [hand.a.id]: "full", [absent.a.id]: "absent" } }));
      return { full: full.a.id, half: half.a.id, photo: photo.a.id, hand: hand.a.id, walk: walk.a.id, absent: absent.a.id };
    });
    await page.evaluate(() => {
      const host = document.createElement("div"); host.id = "__t"; document.body.appendChild(host);
      ReactDOM.createRoot(host).render(React.createElement(YourWeekendSheet, { onClose: () => {} }));
    });
    await page.waitForSelector("[data-your-weekend-summary]", { timeout: 15000 });
    await page.waitForTimeout(500);
    if (big) {
      await page.evaluate(() => {
        const els = [...document.body.querySelectorAll("*")]; const sz = els.map(e => parseFloat(getComputedStyle(e).fontSize));
        els.forEach((e, i) => { if (sz[i]) e.style.setProperty("font-size", (sz[i] * 2) + "px", "important"); });
      });
      await page.waitForTimeout(300);
    }
    const tag = `@${width}${big ? " 200%" : ""}`;
    const shown = await page.$$eval("[data-your-weekend-set]", els => els.map(e => e.getAttribute("data-your-weekend-set")));
    for (const k of ["full", "half", "photo", "hand"]) check(shown.includes(picked[k]), `${tag} ${k} set is shown`);
    for (const k of ["walk", "absent"]) check(!shown.includes(picked[k]), `${tag} ${k} set is left out`);
    const text = await page.locator("[data-your-weekend-summary]").evaluate(e => e.closest("[role=dialog]")?.innerText || document.body.innerText);
    check(!/Missed/i.test(text), `${tag} says Missed`);
    const over = await page.evaluate(w => [...document.querySelectorAll("[data-your-weekend-set], [data-your-weekend-set] *")]
      .map(e => e.getBoundingClientRect()).filter(r => r.width && (r.right > w + 0.5 || r.left < -0.5)).length, width);
    check(over === 0, `${tag} ${over} element(s) run past the screen edge`);
    check(errors.length === 0, `${tag} page errors: ${errors.join(" | ")}`);
    await page.screenshot({ path: join(OUT, `your-weekend-${width}${big ? "-200" : ""}.png`), fullPage: false });
    console.log(`  ${tag}: ${shown.length} set(s) shown`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
console.log(`${bad ? "✗" : "✓"} your weekend capture → ${OUT}`);
process.exit(bad ? 1 : 0);
