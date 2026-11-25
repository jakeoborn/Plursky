#!/usr/bin/env node
// Artist screen: the "Listen" Spotify player.
//
// Spotify's embed player needs no sign-in and sits outside Development Mode's
// five-user cap, so every listener can play an act's top songs from its
// sheet. The gate: nothing loads from Spotify until the tap; a tap on an act
// Spotify has loads the embed for that act's id; a tap on an act it does not
// have says so and offers a search, never somebody else's songs.
//
// Plursky's photo function is stubbed here (no network): it answers one id
// for every real act and nothing for the fixture act.
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

const STUB_ID = "4tZwfgrHOc3mvqYlEYSvVi";
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const FID = "acl-2026";
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 844 } });
  await wireVendor(ctx);
  const spotifyHits = [];
  await ctx.route("**/spotify-artist-image*", route => {
    const name = new URL(route.request().url()).searchParams.get("name") || "";
    const body = /fixture/i.test(name) ? { url: null } : { url: null, spotifyId: STUB_ID, spotifyUrl: "https://open.spotify.com/artist/" + STUB_ID };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await ctx.route("https://open.spotify.com/**", route => { spotifyHits.push(route.request().url()); route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>embed</body></html>" }); });
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
  }, FID);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-20T17:00:00Z"));
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /TypeError|Cannot read|is not a function|The above error/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && window.ARTISTS?.length && typeof window._pushNav === "function", FID, { timeout: 60000 });

  const real = await page.evaluate(() => window.ARTISTS.find(a => a.day != null && a.start));
  const fixture = await page.evaluate(() => {
    const a = { id: "fixture-not-on-spotify", name: "Fixture Not On Spotify", stage: window.STAGES[0].id, genre: "house", tier: 1, img: "linear-gradient(#222,#444)", day: window.DAYS[0].n, start: null, end: null };
    window.ARTISTS = [...window.ARTISTS, a];
    return a;
  });

  const state = () => page.evaluate(() => {
    const box = document.querySelector("[data-spotify-player]");
    const frame = box && box.querySelector("iframe");
    return { phase: box && box.getAttribute("data-spotify-player"), src: frame ? frame.getAttribute("src") : null,
      text: box ? box.innerText : "", search: box ? [...box.querySelectorAll("a")].map(x => x.getAttribute("href")) : [] };
  });
  const tapAndSettle = async () => {
    await page.locator("[data-spotify-player] button").first().scrollIntoViewIfNeeded();
    await page.locator("[data-spotify-player] button").first().click();
    await page.waitForFunction(() => /playing|missing/.test(document.querySelector("[data-spotify-player]")?.getAttribute("data-spotify-player") || ""), null, { timeout: 10000 }).catch(() => {});
    return state();
  };

  // A real act: idle until tapped, then the embed for its id.
  await page.evaluate(id => window._pushNav({ artist: id }), real.id);
  await page.waitForSelector("[data-spotify-player]", { timeout: 10000 }).catch(() => {});
  const before = await state();
  check(before.phase === "idle", `real act: the player starts idle (got ${before.phase})`);
  check(!before.src, "real act: no Spotify iframe before the tap");
  check(spotifyHits.length === 0, `real act: nothing loads from open.spotify.com before the tap (got ${spotifyHits.length})`);
  check(/top songs/i.test(before.text), "real act: the button says it plays the act's top songs");
  const after = await tapAndSettle();
  check(after.phase === "playing", `real act: the tap opens the player (got ${after.phase})`);
  check(after.src === `https://open.spotify.com/embed/artist/${STUB_ID}?utm_source=plursky`, `real act: the embed is the act's own artist page (got ${after.src})`);
  await page.evaluate(() => window._popNav && window._popNav());
  await page.waitForTimeout(300);

  // An act Spotify does not have: a plain note and a search, no embed.
  await page.evaluate(id => window._pushNav({ artist: id }), fixture.id);
  await page.waitForSelector("[data-spotify-player]", { timeout: 10000 }).catch(() => {});
  const miss = await tapAndSettle();
  check(miss.phase === "missing", `missing act: the tap ends on the not-found note (got ${miss.phase})`);
  check(!miss.src, "missing act: no embed is loaded for an act Spotify does not have");
  check(miss.search.some(h => h && h.startsWith("https://open.spotify.com/search/") && h.includes("Fixture")), `missing act: offers a Spotify search for its name (got ${JSON.stringify(miss.search)})`);
  check(errors.length === 0, `the artist screen throws nothing (got ${JSON.stringify(errors)})`);
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  artist spotify player: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
