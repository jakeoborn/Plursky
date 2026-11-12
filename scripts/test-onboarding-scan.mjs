#!/usr/bin/env node
// test-onboarding-scan.mjs: the first-run scan (2026-11-11).
//
// Jake: "The landing page for a new user should direct them directly to scan
// as 1st thing they do", "Yes add photos and videos". A fresh install opens
// on a screen that offers to look through the photo library for every
// festival since 2010 (the same finder as Memories' "Scan past festivals").
//
// This drives the REAL app in headless Chrome. Only native plugins are
// stubbed: PhotoScan lists a fake library and exports canvas JPEGs. ACL 2026
// is the active festival; the library holds two on-site Lollapalooza 2025
// photos, one 3 km away, and one Das Energi 2019 photo (a calendar-only year).
//   found    the first screen is the scan; "Scan" finds 2 festivals and 3
//            shots; "Add them to Memories" lands in Memories and imports all
//            3 on the past-scan card, asking iOS for access exactly once
//   empty    nothing found: straight to "Where are you raving next?", no
//            "no photos" dead end
//   denied   access refused: straight to the festival list
//   skip     "Skip for now" never asks for access and goes to the list
//   web      no library: the screen points to the iPhone app, then the story
// Mutants on the served build must each turn the run red.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const reservePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.once("error", reject);
  s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); });
});
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: process.cwd(), stdio: "ignore" });
const SRC = {
  app: readFileSync("build/app.js", "utf8"),
  spotify: readFileSync("build/spotify.js", "utf8"),
  photoTag: readFileSync("build/photo-tag.js", "utf8"),
};
const FILES = { app: "app", spotify: "spotify", photoTag: "photo-tag" };
const SHOT = process.env.ONB_SCAN_SHOT || "";
const DLG = '[role=dialog][aria-label="Welcome to Plursky"]';
const APP_STORE = "https://apps.apple.com/us/app/plursky-live/id6768888507";

async function scenario(browser, build, { name, native = true, access = "authorized", lib = "full", path = "/", shots = false }, t) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: "America/Chicago" });
  try {
    await wireVendor(ctx);
    await ctx.route(/api\.spotify\.com|itunes\.apple\.com|theaudiodb\.com/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    for (const [key, file] of Object.entries(FILES)) {
      if (build[key] !== SRC[key]) await ctx.route(new RegExp(`/build/${file}\\.js`), r => r.fulfill({ status: 200, contentType: "application/javascript", body: build[key] }));
    }
    // A fresh install: nothing stored, never onboarded.
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem("__seeded")) {
        sessionStorage.setItem("__seeded", "1");
        localStorage.clear();
        indexedDB.deleteDatabase("plursky_memories");
      }
      localStorage.setItem("active_festival_id", "acl-2026"); localStorage.setItem("active_festival_explicit", "1");
    });
    if (native) {
      await ctx.addInitScript((access) => {
        window.__lib = [];
        window.__blobs = {};
        window.__access = 0;
        const PhotoScan = {
          requestAccess: async () => { window.__access++; return { status: access }; },
          scan: async ({ startMs, endMs }) => ({ assets: window.__lib.filter(a => a.createdMs >= startMs && a.createdMs <= endMs)
            .map(({ id, createdMs, mediaType, lat, lng, acc }) => ({ id, createdMs, mediaType, lat, lng, acc })) }),
          export: async ({ id }) => {
            const a = window.__lib.find(x => x.id === id);
            return { path: window.__blobs[id], name: a.name, mimeType: "image/jpeg" };
          },
          discard: async () => ({}),
        };
        const cap = { isNativePlatform: () => true, getPlatform: () => "ios", convertFileSrc: p => p,
                      Plugins: { PhotoScan, Share: { share: async () => ({}) } } };
        Object.defineProperty(window, "Capacitor", { configurable: true, get: () => cap, set: () => {} });
      }, access);
    }
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.FESTIVAL_CONFIG?.id === "acl-2026" && Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
    await page.locator(DLG).waitFor({ timeout: 20000 });
    const first = await page.evaluate((sel) => document.querySelector(sel)?.querySelector("[data-onb-scan]")?.getAttribute("data-onb-scan") || null, DLG);
    t(first === "ask", `${name}: the first screen is not the scan (data-onb-scan=${first})`);
    const dlgText = () => page.evaluate((sel) => document.querySelector(sel)?.innerText || "", DLG);
    const shot = async (label) => { if (shots && SHOT) await page.screenshot({ path: `${SHOT}/onb-scan-${label}-393.png` }); };
    await shot(`${name}-ask`);
    const toList = async () => {
      await page.waitForFunction((sel) => /Where are you raving next\?/.test(document.querySelector(sel)?.innerText || ""), DLG, { timeout: 60000 }).catch(() => {});
      return dlgText();
    };

    if (!native) {
      const href = await page.locator("[data-onb-scan-app]").getAttribute("href").catch(() => null);
      t(href === APP_STORE, `${name}: the scan screen does not point to the iPhone app (href ${href})`);
      t((await page.locator("[data-onb-scan-start]").count()) === 0, `${name}: the web offers a scan it cannot run`);
      await page.locator("[data-onb-scan-skip]").click();
      await page.waitForTimeout(400);
      const txt = await dlgText();
      // The story's first page is the editorial plan page (#250), not the old "1 / 3".
      t(/01 \/ THE PLAN/.test(txt) && /Your night\./.test(txt), `${name}: "Continue on the web" did not open the story ("${txt.slice(0, 80)}")`);
      t(errs.length === 0, `${name}: page errors ${errs.slice(0, 2).join(" | ")}`);
      return;
    }

    // The fake library, built against the real festival-year calendar.
    if (lib === "full") {
      const n = await page.evaluate(async () => {
        const index = await _histFetch("index.json");
        const cal = await _histFetch("scan-calendar.json");
        const targets = _histScanTargets(index, null, cal);
        const lol = targets.find(x => x.entry.id === "lollapalooza-2025").cfg;
        const das = targets.find(x => x.entry.id === "das-energi-2019");
        const at = (h, m) => lol.dayDates[1].midnightUtc + (h * 60 + m) * 60000;
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
        const c2 = canvas.getContext("2d");
        const jpeg = (i) => { c2.fillStyle = `hsl(${(i * 67) % 360},70%,45%)`; c2.fillRect(0, 0, 64, 64);
          return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9)); };
        const rows = [
          ["in-1", at(17, 20), lol.gps.lat, lol.gps.lng],
          ["in-2", at(21, 30), lol.gps.lat + 0.001, lol.gps.lng],
          ["away", at(17, 22), lol.gps.lat + 0.027, lol.gps.lng],
        ];
        if (das && !das.inLibrary) rows.push(["das", das.cfg.dayDates[1].midnightUtc + 22 * 3600000, das.cfg.gps.lat, das.cfg.gps.lng]);
        for (let i = 0; i < rows.length; i++) {
          const [id, createdMs, lat, lng] = rows[i];
          window.__blobs[id] = URL.createObjectURL(await jpeg(i));
          window.__lib.push({ id, createdMs, mediaType: "image", name: `IMG_${3000 + i}.jpg`, lat, lng, acc: 10 });
        }
        return window.__lib.length;
      });
      t(n === 4, `${name}: fixture library ${n} (want 4; Das Energi 2019 must be calendar-only)`);
    }

    if (name === "skip") {
      await page.locator("[data-onb-scan-skip]").click();
      const txt = await toList();
      t(/Where are you raving next\?/.test(txt), `${name}: skip did not reach the festival list ("${txt.slice(0, 80)}")`);
      t(await page.evaluate(() => window.__access) === 0, `${name}: skipping still asked for photo access`);
      t(errs.length === 0, `${name}: page errors ${errs.slice(0, 2).join(" | ")}`);
      return;
    }

    await page.locator("[data-onb-scan-start]").click();
    if (name.startsWith("found")) {
      await page.locator('[data-onb-scan="found"]').waitFor({ timeout: 120000 }).catch(() => {});
      const txt = await dlgText();
      const years = await page.$$eval("[data-onb-scan-year]", els => els.map(e => e.getAttribute("data-onb-scan-year")));
      t(JSON.stringify(years) === JSON.stringify(["lollapalooza-2025", "das-energi-2019"]), `${name}: years listed ${JSON.stringify(years)} (want Lollapalooza 2025 then Das Energi 2019)`);
      t(/You were there 2 times\./.test(txt) && /Found 3 photos\./.test(txt), `${name}: found screen says "${txt.replace(/\s+/g, " ").slice(0, 160)}"`);
      const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}")).length);
      t(stored === 0, `${name}: something was imported before "Add them to Memories" (${stored} nights)`);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      t(w <= 393, `${name}: found screen scrolls sideways (${w})`);
      await shot(name);
      await page.locator("[data-onb-scan-add]").click();
      await page.waitForFunction(() => /Imported \d+ from past|No new photos from past|Couldn.t finish/.test(document.querySelector("[data-scan-past-card]")?.textContent || ""), null, { timeout: 120000 }).catch(() => {});
      const card = (await page.locator("[data-scan-past-card]").textContent().catch(() => "")) || "";
      t(/Imported 3 from past festivals/.test(card), `${name}: Memories card says "${card.slice(0, 160)}"`);
      t(await page.locator(DLG).count() === 0, `${name}: the welcome dialog is still up after "Add them to Memories"`);
      t(await page.evaluate(() => window.__access) === 1, `${name}: photo access asked ${await page.evaluate(() => window.__access)} times (want 1)`);
      t(await page.evaluate(() => localStorage.getItem("onboarded")) === "v1", `${name}: first run not recorded as done`);
      const moments = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}")).flat());
      const ids = moments.map(m => m.festivalId).sort().join(",");
      t(ids === "das-energi-2019,lollapalooza-2025,lollapalooza-2025", `${name}: moments filed under ${ids}`);
      await shot(`${name}-imported`);
      // Pure: a video counts as a video.
      const line = await page.evaluate(() => {
        const s = _pastScanSummary([{ t: { entry: { id: "a-2019", name: "A 2019", year: 2019 } }, keep: [{ mediaType: "image" }, { mediaType: "video" }] },
                                    { t: { entry: { id: "b-2022", name: "B 2022", year: 2022 } }, keep: [{ mediaType: "image" }] }]);
        return { photos: s.photos, videos: s.videos, first: s.years[0].id };
      });
      t(line.photos === 2 && line.videos === 1 && line.first === "b-2022", `summary: ${JSON.stringify(line)} (want 2 photos, 1 video, newest first)`);
    } else {
      const txt = await toList();
      t(/Where are you raving next\?/.test(txt), `${name}: did not go straight to the festival list ("${txt.replace(/\s+/g, " ").slice(0, 120)}")`);
      t(!/No new photos|No photos|nothing found/i.test(txt), `${name}: a "no photos" dead end is shown`);
      t(await page.evaluate(() => window.__access) === 1, `${name}: photo access asked ${await page.evaluate(() => window.__access)} times (want 1)`);
      await shot(name);
    }
    t(errs.length === 0, `${name}: page errors ${errs.slice(0, 2).join(" | ")}`);
  } catch (e) {
    t(false, `${name}: threw ${String(e?.message || e).slice(0, 300)}`);
  } finally {
    await ctx.close();
  }
}

// found-on-memories: a fresh install opened from a ?tab=memories link. The
// Memories screen is already mounted under the welcome dialog, so it does not
// remount when "Add them to Memories" closes it, and must still import.
const SCENARIOS = [
  { name: "found" },
  { name: "found-on-memories", path: "/?tab=memories" },
  { name: "empty", lib: "empty" },
  { name: "denied", access: "denied" },
  { name: "skip" },
  { name: "web", native: false },
];
async function run(browser, build, { shots = false, only = null } = {}) {
  const fails = [];
  let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  for (const sc of SCENARIOS) if (!only || only.includes(sc.name)) await scenario(browser, build, { ...sc, shots }, t);
  return { n, fails };
}

let exit = 1;
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  if (SHOT) mkdirSync(SHOT, { recursive: true });
  const base = await run(browser, SRC, { shots: true });
  for (const f of base.fails) console.log(`  ✗  ${f}`);
  const mut = (key, from, to) => ({ ...SRC, [key]: SRC[key].replace(from, to) });
  // Each mutant runs only the scenario that should catch it, so the gate stays
  // inside its time budget.
  const MUTANTS = [
    ["story first, scan not first", mut("app", 'React.useState("scan")', "React.useState(0)"), ["skip"]],
    ["nothing found leaves the user on the scan screen", mut("app", /if \(!sum\.total\) \{\s*onNext\(\);\s*return;\s*\}/, "if (!sum.total) { return; }"), ["empty"]],
    ["Memories ignores what the first run found", mut("spotify", "var handed = _pastScanHandoffTake();", "var handed = null;"), ["found"]],
    ["Memories does not import on arrival", mut("spotify", /onHandoff\(\);\s*window\.addEventListener/, "window.addEventListener"), ["found"]],
    ["an open Memories screen is not told", mut("photoTag", 'if (result) window.dispatchEvent(new Event("plursky:past-scan-handoff"));', ""), ["found-on-memories"]],
  ];
  let caught = 0;
  for (const [name, build, only] of MUTANTS) {
    if (JSON.stringify(build) === JSON.stringify(SRC)) { console.log(`  ✗  mutant "${name}" did not land (pattern stale)`); continue; }
    const r = await run(browser, build, { only });
    if (r.fails.length) { caught++; console.log(`  · mutant "${name}" caught: ${r.fails[0].slice(0, 140)}`); } else console.log(`  ✗  mutant "${name}" survived`);
  }
  console.log(`  onboarding scan: ${base.n} checks, ${caught}/${MUTANTS.length} mutants caught`);
  if (!base.fails.length && caught === MUTANTS.length) { console.log("  ✓ a new user's first screen is the photo and video scan"); exit = 0; }
} catch (e) {
  console.log(`  ✗  ${e?.stack || e}`);
} finally {
  await browser?.close().catch(() => {});
  server.kill();
  process.exit(exit);
}
