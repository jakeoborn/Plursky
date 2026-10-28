#!/usr/bin/env node
// Licensed artist portraits reach the screens that show them.
//
// The artist screen looks a portrait up by the PRINTED name of the act on
// screen (or one side of a "b2b"), set note and all: getArtistImage(activeName)
// in artist.jsx. That every ledger row is printed by a reachable lineup is
// test-today-print.mjs's heroes check; this gate covers batch 5 itself:
//   1. every batch 5 act resolves to a permanent Commons portrait whose file
//      decodes, whose asset is in sw.js's precache list, and whose name some
//      festival prints;
//   2. two batch 5 acts open on their artist screen with the photo as the hero
//      background and the credit naming the ledger's author.
// Fails on main before batch 5 (no rows for these acts); passes with it.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// Batch 5: Escape Halloween, EDC Orlando and Decadence acts, each also billed at an
// open festival (see the PR's receipt). Ice Cube left the list on 2026-10-26:
// Escape's official lineup dropped him and no other lineup prints him, so his
// portrait left the ledger too (the Today hero gate wants every row reachable).
const BATCH5 = [
  "Steve Aoki", "Zedd", "Excision", "Dimitri Vegas & Like Mike", "Nina Kraviz", "Richie Hawtin",
  "Alok", "Galantis", "Cascada", "Martin Garrix", "Hardwell", "Kaskade",
  "Afrojack", "Alesso", "Alan Walker", "Alison Wonderland", "Deorro", "Boys Noize", "Slander",
  "Marshmello", "DJ Snake", "Lane 8",
];
// [festival, act name as printed] for the artist-screen check. Open festivals
// only: EDC Orlando (where most of the batch plays) is not open until its map
// lands, so Martin Garrix is checked on EDC Las Vegas, where he is also billed.
const SCREENS = [["edc-lv-2026", "Martin Garrix"], ["escape-halloween-2026", "Nina Kraviz"]];

const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
const ledger = JSON.parse(readFileSync(join(ROOT, "data/artist-photos/ledger.json"), "utf8"));

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const boot = async (fid) => {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
    await wireVendor(ctx);
    await ctx.addInitScript(f => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", f);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    }, fid);
    const page = await ctx.newPage();
    // Pinned before Escape Halloween (Oct 30) so no festival is live on the real clock.
    await page.clock.setFixedTime(new Date("2026-10-20T17:00:00Z"));
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${fid}`, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForFunction(f => window.FESTIVAL_CONFIG?.id === f && window.ARTISTS?.length && typeof window._pushNav === "function", fid, { timeout: 60000 });
    } catch (e) {
      const got = await page.evaluate(() => window.FESTIVAL_CONFIG?.id).catch(() => "?");
      throw new Error(`${fid} did not boot (active: ${got}; page errors: ${JSON.stringify(errs.slice(0, 3))})`);
    }
    return { ctx, page };
  };

  // 1: resolution, decode and precache, from one booted page.
  {
    const { ctx, page } = await boot("edc-lv-2026");
    const printed = await page.evaluate(() => {
      const out = new Set();
      for (const ds of Object.values(_DATA_SETS)) for (const a of ds.artists || []) {
        out.add(String(a.name).trim().toLowerCase());
        for (const p of _b2bParts(a.name)) out.add(p.toLowerCase());
      }
      return [...out];
    });
    const names = new Set(printed);
    check(names.size > 1000, `positive control: the data sets print over 1000 act names (got ${names.size})`);
    const res = await page.evaluate(async (list) => {
      const out = {};
      for (const n of list) {
        const rec = getPermanentArtistImage(n);
        let w = 0;
        if (rec) { const img = new Image(); img.src = rec.url; try { await img.decode(); w = img.naturalWidth; } catch {} }
        out[n] = rec ? { source: rec.source, url: rec.url, w } : null;
      }
      return out;
    }, BATCH5);
    for (const n of BATCH5) {
      const r = res[n];
      check(!!r && r.source === "commons", `${n}: resolves to a permanent Commons portrait (got ${JSON.stringify(r)})`);
      check(!!r && r.w >= 600, `${n}: the portrait file decodes at a usable width (got ${r?.w})`);
      check(!!r && sw.includes(`'${r.url}'`), `${n}: the portrait is in sw.js's precache list`);
      check(names.has(n.toLowerCase()), `${n}: printed as an act name in some festival`);
    }
    await ctx.close();
  }

  // 2: the artist screen shows the portrait and its credit.
  for (const [fid, name] of SCREENS) {
    const { ctx, page } = await boot(fid);
    const id = await page.evaluate(n => window.ARTISTS.find(a => a.name === n)?.id, name);
    check(!!id, `${fid}: "${name}" is on the lineup`);
    if (id) {
      await page.evaluate(i => window._pushNav({ artist: i }), id);
      await page.waitForSelector("[data-artist-hero]", { timeout: 15000 }).catch(() => {});
      const s = await page.evaluate(() => ({
        hero: document.querySelector("[data-artist-hero]")?.getAttribute("data-artist-hero"),
        bg: [...document.querySelectorAll("[data-artist-hero] *, [data-artist-hero]")].map(e => e.style.backgroundImage).join(" "),
        credit: document.querySelector("[data-artist-photo-credit]")?.textContent || "",
      }));
      const row = ledger.find(r => r.artist === name);
      check(s.hero === "photo", `${name}: the hero is a photo (got ${s.hero})`);
      check(!!row && s.bg.includes(row.asset), `${name}: the hero background is ${row?.asset}`);
      check(!!row && s.credit.includes(row.author), `${name}: the credit names ${row?.author} (got "${s.credit}")`);
    }
    await ctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  artist photo reach: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
