#!/usr/bin/env node
// test-past-edition-scan.mjs: "Scan past festivals" (2026-11-07).
//
// Jake: "the photo video scan can do any festival in the past if in users
// photo gallery and if in our catalog". This drives the REAL app in headless
// Chrome (index.html, the real Memories screen, the real import handler, the
// real moment store, the real Past Festivals page). Only the native plugins
// are stubbed: PhotoScan lists a fake library and exports canvas JPEGs.
//
// ACL 2026 is the active festival. The library holds Lollapalooza 2025 day 1
// (Thu 2025-07-31, Grant Park, America/Chicago):
//   in-1   on site, 17:20 (sets on several stages)          → imported
//   in-2   on site, 21:30 (Tyler, the Creator's open-ended close) → imported
//   away   3 km from Grant Park, 17:20                     → skipped
//   nogps  no fix, 17:20                                   → skipped
//   early  on site, 11:30 (first set 12:00, window 11:45)  → skipped
// Checks: 2 moments, both stamped lollapalooza-2025 (never the active ACL),
// the card names the edition and opens its page, the page lists exactly its
// own photos, overlapping-set guesses are labelled as guesses, and a second
// scan adds nothing. Pure checks cover the helpers. Mutants on the served
// build must each turn the run red.
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
  spotify: readFileSync("build/spotify.js", "utf8"),
  photoTag: readFileSync("build/photo-tag.js", "utf8"),
  historical: readFileSync("build/historical.js", "utf8"),
};
const ED = "lollapalooza-2025";
const SHOT = process.env.PAST_SCAN_SHOT || "";

async function run(browser, build, { shots = false } = {}) {
  const fails = [];
  let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: "America/Chicago" });
  try {
    await wireVendor(ctx);
    await ctx.route(/api\.spotify\.com|itunes\.apple\.com|theaudiodb\.com/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    for (const [key, file] of [["spotify", "spotify"], ["photoTag", "photo-tag"], ["historical", "historical"]]) {
      if (build[key] !== SRC[key]) await ctx.route(new RegExp(`/build/${file}\\.js`), r => r.fulfill({ status: 200, contentType: "application/javascript", body: build[key] }));
    }
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem("__seeded")) {
        sessionStorage.setItem("__seeded", "1");
        localStorage.clear();
        indexedDB.deleteDatabase("plursky_memories");
      }
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
      localStorage.setItem("active_festival_id", "acl-2026"); localStorage.setItem("active_festival_explicit", "1");
    });
    await ctx.addInitScript(() => {
      window.__lib = [];
      window.__blobs = {};
      window.__scanCalls = 0;
      const PhotoScan = {
        requestAccess: async () => ({ status: "authorized" }),
        scan: async ({ startMs, endMs }) => {
          window.__scanCalls++;
          return { assets: window.__lib.filter(a => a.createdMs >= startMs && a.createdMs <= endMs)
            .map(({ id, createdMs, mediaType, lat, lng, acc }) => ({ id, createdMs, mediaType, lat, lng, acc })) };
        },
        export: async ({ id }) => {
          const a = window.__lib.find(x => x.id === id);
          return { path: window.__blobs[id], name: a.name, mimeType: "image/jpeg" };
        },
        discard: async () => ({}),
      };
      const cap = { isNativePlatform: () => true, getPlatform: () => "ios", convertFileSrc: p => p,
                    Plugins: { PhotoScan, Share: { share: async () => ({}) } } };
      Object.defineProperty(window, "Capacitor", { configurable: true, get: () => cap, set: () => {} });
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/?tab=me`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.FESTIVAL_CONFIG?.id === "acl-2026" && Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });

    // ── Pure: the catalog becomes scan targets ─────────────────────────────
    const pure = await page.evaluate(async (ED) => {
      const index = await _histFetch("index.json");
      const targets = _histScanTargets(index);
      const ids = targets.map(x => x.entry.id);
      const lolla = targets.find(x => x.entry.id === ED);
      const cfg = lolla?.cfg;
      const edition = await _histFetch(`editions/${ED}.json`);
      const rows = _histEditionArtists(edition);
      const timed = edition.sets.filter(s => /^\d{1,2}:\d{2}$/.test(s.start || ""));
      const openEnd = edition.sets.filter(s => s.start && !s.end);
      const tyler = rows.find(r => r.id === `${ED}:tyler-the-creator` && r.day === 1);
      const g = cfg?.gps || {};
      const ds = cfg ? _histDataSet(edition, cfg) : null;
      // 17:20 local on day 1 = 22:20 UTC (CDT, UTC-5).
      const ms = Date.UTC(2025, 6, 31, 22, 20);
      const match = ds ? _matchArtistForPhoto(_photoKitAssetMeta({ createdMs: ms, lat: g.lat, lng: g.lng, acc: 10 }, cfg), [], [], ds) : null;
      return {
        n: targets.length,
        hasLolla: !!lolla,
        bw: ids.filter(id => /^beyond-wonderland/.test(id)),
        canceled: ids.filter(id => (index.editions.find(e => e.id === id) || {}).status === "canceled"),
        sorted: targets.every((x, i) => i === 0 || targets[i - 1].entry.year <= x.entry.year),
        d1: cfg?.dayDates?.[1]?.midnightUtc, d4: cfg?.dayDates?.[4]?.midnightUtc, historical: cfg?.historical,
        onSite: cfg ? _histAssetOnSite({ lat: g.lat, lng: g.lng, acc: 10 }, cfg) : null,
        away: cfg ? _histAssetOnSite({ lat: g.lat + 0.027, lng: g.lng, acc: 10 }, cfg) : null,
        sloppyAway: cfg ? _histAssetOnSite({ lat: g.lat + 0.027, lng: g.lng, acc: 5000 }, cfg) : null,
        noFix: cfg ? _histAssetOnSite({ lat: null, lng: null }, cfg) : null,
        zero: cfg ? _histAssetOnSite({ lat: 0, lng: 0, acc: 5 }, cfg) : null,
        rows: rows.length, timed: timed.length, openEnd: openEnd.length,
        badEnd: rows.filter(r => _hhmmNightMin(r.end) == null || _hhmmNightMin(r.end) <= _hhmmNightMin(r.start)).length,
        tyler: tyler ? { end: tyler.end, printed: tyler.endPrinted } : null,
        match: match ? { festivalId: match.festivalId, night: match.night, artistId: match.artistId, reason: match.reason } : null,
      };
    }, ED);
    t(pure.hasLolla && pure.n >= 20, `targets: ${pure.n}, Lollapalooza 2025 listed ${pure.hasLolla}`);
    t(pure.bw.length === 0, `targets: Beyond Wonderland has no sourced footprint, yet listed ${pure.bw.join(",")}`);
    t(pure.canceled.length === 0, `targets: canceled editions listed ${pure.canceled.join(",")}`);
    t(pure.sorted, "targets: not oldest first");
    t(pure.d1 === Date.UTC(2025, 6, 31, 5) && pure.d4 === Date.UTC(2025, 7, 3, 5), `config: day 1 midnight ${pure.d1}, day 4 ${pure.d4} (want local midnight CDT)`);
    t(pure.historical === true, "config: not marked historical");
    t(pure.onSite === true && pure.away === false, `on site: Grant Park ${pure.onSite}, 3 km away ${pure.away}`);
    t(pure.sloppyAway === false, "on site: a 5 km error radius let a 3 km-away fix in (error must cap at the margin)");
    t(pure.noFix === false && pure.zero === false, `on site: no fix ${pure.noFix}, 0,0 ${pure.zero} (both must be false)`);
    t(pure.rows === pure.timed && pure.badEnd === 0, `rows: ${pure.rows} of ${pure.timed} timed sets, ${pure.badEnd} without a usable end`);
    t(pure.openEnd >= 4 && pure.tyler?.end === "22:00" && pure.tyler?.printed === false, `open end: Tyler day 1 ${JSON.stringify(pure.tyler)} (want 22:00, not printed)`);
    t(pure.match?.festivalId === ED && pure.match?.night === 1 && !!pure.match?.artistId?.startsWith(`${ED}:`), `matcher with ds: ${JSON.stringify(pure.match)}`);

    // ── The library ────────────────────────────────────────────────────────
    // Rebuilt after every reload: the init script starts each page empty.
    const makeLib = () => page.evaluate(async (ED) => {
      const index = await _histFetch("index.json");
      const cfg = _histScanTargets(index).find(x => x.entry.id === ED).cfg;
      const g = cfg.gps;
      const at = (h, m) => cfg.dayDates[1].midnightUtc + (h * 60 + m) * 60000;
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
      const c2 = canvas.getContext("2d");
      const jpeg = (i) => { c2.fillStyle = `hsl(${(i * 67) % 360},70%,45%)`; c2.fillRect(0, 0, 64, 64); c2.fillStyle = "#fff"; c2.fillText(String(i), 8, 30);
        return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9)); };
      const rows = [
        ["in-1", at(17, 20), g.lat, g.lng, 10],
        ["in-2", at(21, 30), g.lat + 0.001, g.lng, 8],
        ["away", at(17, 22), g.lat + 0.027, g.lng, 10],
        ["nogps", at(17, 24), null, null, null],
        ["early", at(11, 30), g.lat, g.lng, 10],
      ];
      for (let i = 0; i < rows.length; i++) {
        const [id, createdMs, lat, lng, acc] = rows[i];
        window.__blobs[id] = URL.createObjectURL(await jpeg(i));
        window.__lib.push({ id, createdMs, mediaType: "image", name: `IMG_${2000 + i}.jpg`, lat, lng, acc });
      }
      return window.__lib.length;
    }, ED);
    const lib = await makeLib();
    t(lib === 5, `fixture: library ${lib}`);

    const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}"));
    const flat = (all) => Object.values(all).flatMap(arr => Array.isArray(arr) ? arr : []);
    const scanPast = async (label) => {
      const btn = page.locator("[data-scan-past]");
      if (!(await btn.count())) {
        const mem = page.locator("[data-me-action=memories]").first();
        await mem.waitFor({ timeout: 30000 });
        await mem.click();
      }
      await btn.waitFor({ timeout: 20000 });
      await page.waitForFunction(() => !document.querySelector("[data-scan-past]")?.disabled, null, { timeout: 60000 });
      await btn.click();
      await page.waitForFunction(() => {
        const c = document.querySelector("[data-scan-past-card]");
        return /Imported \d+ from past|No new photos from past|Couldn.t finish/.test(c?.textContent || "");
      }, null, { timeout: 120000 });
      const msg = await page.locator("[data-scan-past-card]").textContent();
      if (shots && SHOT) {
        await page.locator("[data-scan-past-card]").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOT}/past-scan-${label}-393.png` });
      }
      return msg || "";
    };

    // ── Scan 1 ────────────────────────────────────────────────────────────
    const msg1 = await scanPast("card");
    const m1 = flat(await store());
    const mine = m1.filter(m => m.festivalId === ED);
    t(/Imported 2 from past festivals/.test(msg1), `scan 1: card says "${msg1.slice(0, 160)}"`);
    t(m1.length === 2 && mine.length === 2, `scan 1: ${m1.length} moments stored, ${mine.length} stamped ${ED} (want 2 and 2)`);
    t(mine.every(m => m.festivalStampSource === "past-edition"), `scan 1: stamp source ${mine.map(m => m.festivalStampSource).join(",")} (want past-edition)`);
    t(mine.every(m => !m.artistId || m.artistId.startsWith(`${ED}:`)), `scan 1: an act from another lineup ${mine.map(m => m.artistId).join(",")}`);
    const tylerMoment = mine.find(m => /T21:3/.test(m.takenAt || "") || m.artistId === `${ED}:tyler-the-creator`);
    t(!!tylerMoment, `scan 1: no moment at 21:30 (takenAt ${mine.map(m => m.takenAt).join(", ")})`);
    const openBtn = page.locator(`[data-scan-past-open="${ED}"]`);
    t((await openBtn.count()) === 1 && /Lollapalooza 2025 · 2/.test((await openBtn.textContent()) || ""), "scan 1: no 'Lollapalooza 2025 · 2' button on the card");
    const toastElsewhere = await page.evaluate(() => /saved under|filed under|went to/i.test(document.body.innerText) && /Lollapalooza/.test(document.body.innerText) && !!document.querySelector("[data-toast]"));
    t(!toastElsewhere, "scan 1: the live scan's 'elsewhere' toast fired for a past edition");
    const box = await page.locator("[data-scan-past-card]").boundingBox();
    t(!!box && box.x >= 0 && box.x + box.width <= 393 + 0.5, `scan 1: card overflows 393 (${JSON.stringify(box)})`);

    // A live ACL moment the edition page must NOT list.
    await page.evaluate(() => {
      const all = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
      all["1"] = [...(all["1"] || []), { id: "seeded-acl", festivalId: "acl-2026", takenAt: "2026-10-09T20:00:00", artistId: null, type: "photo" }];
      localStorage.setItem("plursky_moments_v1", JSON.stringify(all));
    });

    // ── The edition page ───────────────────────────────────────────────────
    await openBtn.click();
    const sec = page.locator("[data-edition-your-photos]");
    await sec.waitFor({ timeout: 30000 }).catch(() => {});
    const head = (await sec.count()) ? ((await sec.locator("h2").textContent()) || "") : "";
    const tiles = await page.locator("[data-edition-photo]").count();
    t(/Your photos · 2/.test(head) && tiles === 2, `edition page: "${head}", ${tiles} tiles (want 2)`);
    const labels = await page.$$eval("[data-edition-photo-act]", els => els.map(e => ({ kind: e.getAttribute("data-edition-photo-act"), text: e.textContent })));
    const byId = new Map(mine.map(m => [m.id, m]));
    const wantKinds = mine.map(m => !m.artistId ? "none" : (m.tagAmbiguous || m.tagSuggested) ? "guess" : "sure").sort();
    t(JSON.stringify(labels.map(l => l.kind).sort()) === JSON.stringify(wantKinds), `edition page: labels ${JSON.stringify(labels)} vs moments ${JSON.stringify(wantKinds)}`);
    t(labels.every(l => l.kind !== "guess" || /^Maybe /.test(l.text)), `edition page: a guess not worded as one ${JSON.stringify(labels)}`);
    if (shots && SHOT) {
      await sec.scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${SHOT}/past-scan-edition-393.png` });
      await page.setViewportSize({ width: 320, height: 700 });
      await page.waitForTimeout(400);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      t(w <= 320, `edition page: scrolls sideways at 320 (${w})`);
      await sec.scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${SHOT}/past-scan-edition-320.png` });
      await page.setViewportSize({ width: 393, height: 852 });
    }
    void byId;

    // ── Scan 2: nothing new ────────────────────────────────────────────────
    await page.goto(`http://127.0.0.1:${PORT}/?tab=me`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.FESTIVAL_CONFIG?.id === "acl-2026", null, { timeout: 30000 });
    t((await makeLib()) === 5, "scan 2: library not rebuilt");
    // Let boot-time passes (stamp reconcile, cloud restore) settle first, so
    // the comparison below measures the scan and nothing else.
    const mem = page.locator("[data-me-action=memories]").first();
    await mem.waitFor({ timeout: 30000 }); await mem.click();
    await page.locator("[data-scan-past]").waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const boot = flat(await store()).filter(m => m.festivalId === ED);
    t(boot.length === 2 && boot.every(m => !m.festivalReview), `reload: past moments ${boot.length}, flagged for review ${boot.filter(m => m.festivalReview).map(m => m.festivalReview.reason).join(",")}`);
    const before = JSON.stringify(await store());
    const msg2 = await scanPast("again");
    const after = JSON.stringify(await store());
    t(/No new photos from past festivals/.test(msg2) && /2 were already imported/.test(msg2), `scan 2: card says "${msg2.slice(0, 160)}"`);
    if (before !== after && process.env.PAST_SCAN_DEBUG) console.log("DEBUG before", before.slice(0, 1500), "\nDEBUG after", after.slice(0, 1500), "\nDEBUG seen", await page.evaluate(() => localStorage.getItem("plursky_scan_seen_v1")));
    t(before === after, "scan 2: the moment store changed");
    t(errs.length === 0, `page errors: ${errs.slice(0, 3).join(" | ")}`);
  } catch (e) {
    fails.push(`run threw: ${String(e?.message || e).slice(0, 300)}`);
  } finally {
    await ctx.close();
  }
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
  const MUTANTS = [
    ["GPS gate removed", mut("spotify", "assets.filter(a => _histAssetOnSite(a, t.cfg))", "assets.filter(a => true)")],
    ["edition data set not passed to the matcher", mut("spotify", "_matchArtistForPhoto(meta, savedIds, attendedIds, opts.ds || undefined)", "_matchArtistForPhoto(meta, savedIds, attendedIds)")],
    ["edition page lists every moment", mut("historical", "m.festivalId === editionId", "m.festivalId")],
    ["reconciler flags past stamps", mut("spotify", 'if (m.festivalStampSource === "past-edition") continue;', "")],
    ["open-ended closing sets dropped", mut("photoTag", "if (close[_s.day] == null || close[_s.day] <= st) continue;", "continue;")],
  ];
  let caught = 0;
  for (const [name, build] of MUTANTS) {
    if (JSON.stringify(build) === JSON.stringify(SRC)) { console.log(`  ✗  mutant "${name}" did not land (pattern stale)`); continue; }
    const r = await run(browser, build);
    if (r.fails.length) { caught++; console.log(`  · mutant "${name}" caught: ${r.fails[0].slice(0, 140)}`); } else console.log(`  ✗  mutant "${name}" survived`);
  }
  console.log(`  past-edition scan: ${base.n} checks, ${caught}/${MUTANTS.length} mutants caught`);
  if (!base.fails.length && caught === MUTANTS.length) { console.log("  ✓ past festivals scan on-site photos into their own edition"); exit = 0; }
} catch (e) {
  console.log(`  ✗  ${e?.stack || e}`);
} finally {
  await browser?.close();
  server.kill();
}
process.exit(exit);
