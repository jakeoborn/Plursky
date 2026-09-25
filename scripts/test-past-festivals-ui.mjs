#!/usr/bin/env node
// test-past-festivals-ui.mjs — the Past Festivals screens (historical.jsx)
// render the library honestly at phone width (verify gate 1z-c6).
//
// Every expected number is read from data/historical, never typed here, so the
// gate follows the data. It proves: the switcher opens the library without
// changing the active festival or the saved plan; each edition row carries its
// real counts; an edition renders every set of a day under its printed stage,
// sorted across midnight; open-ended closers show no invented end; ACL's six
// days group into two weekends; search spans every day; the provenance sheet
// lists every archived capture; a lineup_only edition (a fixture served by
// route interception, since no real one exists yet) shows names and no times;
// a failed fetch offers a retry; and nothing scrolls sideways at 393pt.
//
//   PLURSKY_PAST_SHOTS=<dir> node scripts/test-past-festivals-ui.mjs   # also writes 6 screenshots
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from './lib/server-ready.mjs';

const ROOT = process.cwd();
const H = p => JSON.parse(readFileSync(join(ROOT, "data/historical", p), "utf8"));
const INDEX = H("index.json");
const ED = Object.fromEntries(INDEX.editions.map(e => [e.id, H(`editions/${e.id}.json`)]));
const SHOTS = process.env.PLURSKY_PAST_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const fails = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

// A lineup_only edition does not exist in the library yet, so the gate brings
// its own: names only, no stages, no sets (the shape validate.mjs enforces).
const FIXTURE = {
  id: "fixture-fest-2024", festivalId: "fixture", name: "Fixture Fest 2024", year: 2024, timezone: "America/Chicago", rolloverHour: 6,
  completeness: "lineup_only", days: [{ day: 1, date: "2024-06-01", label: "Saturday" }], stages: [], sets: [],
  artists: ["ZEBRA KATZ", "ÁRNI & THE LONG NAME THAT HAS TO WRAP AT THREE NINETY THREE", "ALPHA"].map((n, i) => ({ id: `fixture-fest-2024:a${i}`, name: n, key: `a${i}`, performers: [`a${i}`] })),
  provenance: { extractionMethod: "structured_html", official: "https://example.invalid/lineup", captures: [] },
};
const FIXTURE_META = { id: FIXTURE.id, festivalId: "fixture", festivalName: "Fixture Fest", name: FIXTURE.name, year: 2024, timezone: FIXTURE.timezone,
  completeness: "lineup_only", days: FIXTURE.days, counts: { stages: 0, artists: 3, sets: 0 } };

const PORT = await port();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: "America/Chicago", serviceWorkers: "block" });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
    localStorage.setItem("active_festival_id", "edc-lv-2026"); localStorage.setItem("active_festival_explicit", "1");
    localStorage.setItem("edc-lv-2026_saved_v1", JSON.stringify(["n4"]));
    localStorage.setItem("cloud_nudge_seen", "1");
  });
  let failEdition = null;
  await ctx.route("**/data/historical/index.json", async r => {
    const resp = await r.fetch(); const j = await resp.json();
    await r.fulfill({ response: resp, json: { editions: [...j.editions, FIXTURE_META] } });
  });
  await ctx.route(`**/data/historical/editions/${FIXTURE.id}.json`, r => r.fulfill({ json: FIXTURE }));
  await ctx.route("**/data/historical/editions/*.json", r => failEdition && r.request().url().includes(failEdition) ? r.abort() : r.fallback());

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?tab=home`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
  ok(await page.evaluate(() => typeof PastFestivalsScreen === "function" && typeof HistoricalEditionView === "function"), "historical.jsx did not load");
  const before = await page.evaluate(() => ({ fest: FESTIVAL_CONFIG.id, active: localStorage.getItem("active_festival_id"), saved: localStorage.getItem("edc-lv-2026_saved_v1") }));
  const noSideScroll = async where => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
    [...document.querySelectorAll("section, ul, nav")].every(el => el.scrollWidth <= el.clientWidth + 1)), `${where}: something scrolls sideways at 393pt`);
  const shot = async name => { if (SHOTS) { await sleep(400); await page.screenshot({ path: join(SHOTS, `${name}.png`) }); } };

  // ── the door: switcher → library ──
  await page.getByRole("button", { name: /switch festival/ }).first().click();
  const row = page.getByRole("button", { name: /^Past festivals/ });
  await row.waitFor({ timeout: 10000 });
  await row.click();
  await page.getByRole("heading", { name: "Past festivals", level: 1 }).waitFor({ timeout: 10000 });
  await page.getByText(INDEX.editions[0].festivalName, { exact: true }).waitFor({ timeout: 10000 });
  for (const e of INDEX.editions) {
    const want = `${e.days.length} days · ${e.counts.stages} stages · ${e.counts.sets} sets`;
    ok(await page.getByText(want, { exact: true }).count() >= 1, `library row for ${e.id} does not read "${want}"`);
  }
  ok(await page.getByText("3 artists · lineup only", { exact: true }).count() === 1, "the lineup_only row does not say it is lineup only");
  await noSideScroll("library");
  await shot("1-library");

  // ── ACL: two weekends of day tabs, day 1 in full ──
  const acl = ED["acl-2025"];
  await page.getByRole("button", { name: /^Austin City Limits/ }).click();
  await page.getByText("Official 2025 schedule · archived", { exact: true }).waitFor({ timeout: 10000 });
  await page.locator("[data-stage]").first().waitFor({ timeout: 10000 });
  const groups = [...new Set(acl.days.map(d => d.label.split(" · ")[0]))];
  for (const g of groups) ok(await page.getByRole("group", { name: g }).getByRole("button").count() === acl.days.filter(d => d.label.startsWith(g + " · ")).length, `ACL day tabs are not grouped under ${g}`);
  const d1 = acl.sets.filter(s => s.day === 1);
  const d1Stages = acl.stages.filter(st => d1.some(s => s.stageId === st.id));
  ok(await page.locator("[data-stage]").count() === d1Stages.length, `ACL day 1 shows ${await page.locator("[data-stage]").count()} stage sections, data has ${d1Stages.length}`);
  ok(await page.locator("[data-stage] li").count() === d1.length, `ACL day 1 renders ${await page.locator("[data-stage] li").count()} sets, data has ${d1.length}`);
  ok(JSON.stringify(await page.locator("[data-stage] h2").allTextContents()) === JSON.stringify(d1Stages.map(s => s.name)), "stage sections are not in printed order with printed names");
  ok(await page.getByRole("navigation", { name: "Stages" }).getByRole("button").count() === d1Stages.length, "the stage index does not list every stage of the day");
  // No live controls: the only buttons in the scroll body are the stage index.
  ok(await page.locator("[data-stage] button, [data-stage] input").count() === 0, "an archived set row carries a control (save, remind, rate…)");
  ok(await page.getByText(/save|remind|add to plan|live now|up next/i).count() === 0, "an archived edition shows live-schedule copy");
  await noSideScroll("ACL day 1");
  await shot("2-acl-w1-friday");

  // Day 6: every open-ended closer says so and invents no end.
  const d6 = acl.sets.filter(s => s.day === 6);
  await page.getByRole("group", { name: groups[groups.length - 1] }).getByRole("button").last().click();
  await page.waitForFunction(n => document.querySelectorAll("[data-stage] li").length === n, d6.length, { timeout: 5000 }).catch(() => {});
  ok(await page.locator("[data-stage] li").count() === d6.length, `ACL day 6 renders ${await page.locator("[data-stage] li").count()} sets, data has ${d6.length}`);
  ok(await page.getByText("no end time printed", { exact: true }).count() === d6.filter(s => s.openEnd).length, "open-ended closers are not all marked, or a timed set is");

  // ── EDC: overnight sets sort after the evening, not before noon ──
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: /^EDC Las Vegas/ }).click();
  await page.locator("[data-stage]").first().waitFor({ timeout: 10000 });
  const edc = ED["edc-las-vegas-2025"];
  const firstStage = edc.stages.find(st => edc.sets.some(s => s.day === 1 && s.stageId === st.id));
  const times = await page.locator(`[data-stage="${firstStage.id}"] li > div:first-child`).allTextContents();
  const pm = times.findIndex(t => / PM/.test(t)), am = times.findIndex(t => /^(12|[1-5]):\d\d AM/.test(t));
  ok(pm >= 0 && am > pm, `EDC ${firstStage.name}: after-midnight sets are not listed after the evening (${times.slice(0, 3).join(" | ")} …)`);
  await noSideScroll("EDC day 1");
  await shot("3-edc-friday");

  // ── search spans every day ──
  const needle = edc.artists.find(a => edc.sets.filter(s => s.artistId === a.id).length > 1) || edc.artists[0];
  const hits = edc.sets.filter(s => edc.artists.find(a => a.id === s.artistId).name.toLowerCase().includes(needle.name.toLowerCase()));
  await page.getByRole("searchbox", { name: "Search artists" }).fill(needle.name.toLowerCase());
  await page.waitForFunction(() => !document.querySelector("[data-stage]"), null, { timeout: 5000 });
  ok(await page.locator("section li").count() === hits.length, `search "${needle.name}" shows ${await page.locator("section li").count()} sets, data has ${hits.length}`);
  ok(await page.getByRole("group", { name: "Days" }).count() === 0, "day tabs stay up while search spans every day");
  await shot("4-edc-search");
  await page.getByRole("searchbox", { name: "Search artists" }).fill("");

  // ── provenance ──
  await page.getByRole("button", { name: "About this schedule" }).click();
  const sheet = page.getByRole("dialog", { name: "About this schedule" });
  await sheet.waitFor({ timeout: 5000 });
  ok(await sheet.getByRole("link").count() === edc.provenance.captures.length, `provenance lists ${await sheet.getByRole("link").count()} captures, ledger has ${edc.provenance.captures.length}`);
  ok(await sheet.getByText(edc.provenance.official.replace(/^https?:\/\//, "")).count() === 1, "provenance does not name the official source");
  await shot("5-edc-provenance");
  await page.keyboard.press("Escape");

  // ── lineup_only fixture: names, no times, no day tabs ──
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: /^Fixture Fest/ }).click();
  await page.getByText("Official 2024 lineup · archived", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByRole("list", { name: "Lineup" }).waitFor({ timeout: 10000 });
  ok(await page.getByRole("list", { name: "Lineup" }).getByRole("listitem").count() === FIXTURE.artists.length, "lineup_only does not list every artist");
  ok(await page.getByText(/\d:\d\d [AP]M/).count() === 0, "lineup_only shows a time");
  ok(await page.locator("[aria-pressed]").count() === 0, "lineup_only shows day tabs");
  await noSideScroll("lineup_only");
  await shot("6-lineup-only");

  // ── a failed edition fetch offers a retry that recovers ──
  await page.getByRole("button", { name: "Back" }).click();
  failEdition = "hard-summer-2025";
  await page.evaluate(() => { for (const k of Object.keys(_histCache)) if (k.includes("hard-summer")) delete _histCache[k]; });
  await page.getByRole("button", { name: /^HARD Summer/ }).click();
  await page.getByRole("button", { name: "Try again" }).waitFor({ timeout: 10000 });
  failEdition = null;
  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator("[data-stage]").first().waitFor({ timeout: 10000 });
  ok(await page.locator("[data-stage] li").count() === ED["hard-summer-2025"].sets.filter(s => s.day === 1).length, "retry did not load HARD Summer day 1");

  // ── back out: nothing about the live app moved ──
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  const after = await page.evaluate(() => ({ fest: FESTIVAL_CONFIG.id, active: localStorage.getItem("active_festival_id"), saved: localStorage.getItem("edc-lv-2026_saved_v1") }));
  ok(JSON.stringify(after) === JSON.stringify(before), `browsing the library changed the live app: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  ok(await page.getByRole("heading", { name: "Past festivals", level: 1 }).count() === 0, "Back from the library did not return to the app");
  ok(!errors.length, `page errors: ${errors.join(" | ")}`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} Past Festivals UI checks failed`); process.exit(1); }
console.log(`  ✓ Past Festivals UI: ${INDEX.editions.length} editions + a lineup_only fixture render from their files at 393pt, ${checks} checks`);
