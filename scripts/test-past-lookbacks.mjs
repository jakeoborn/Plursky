#!/usr/bin/env node
// test-past-lookbacks.mjs — a festival's past editions, on the festival
// itself (verify gate, after the Past Festivals UI gate).
//
// A gated registry entry (next year's festival, nothing to open yet) whose
// earlier edition is in the library opens that edition as a clearly labelled
// look-back instead of sitting disabled; an entry with no edition stays
// disabled with no placeholder. It proves, reading every expectation from
// data/historical and the registry:
//   - the /f/ page of a qualified stub leads with "Look back: <year>", a Past
//     edition chip, the edition's own dates, its archive date and a link that
//     opens that edition; no other stub page has one; no page lists an
//     edition of its own year or later;
//   - in the app, the stub row reads "Look back: <year>" and opens the edition
//     directly, without switching festival or touching the plan, and Back
//     returns where the user was, not to the library;
//   - an edition of the stub's own year or later is never offered (injected);
//   - a lineup-only look-back says its set times are not verified (injected,
//     since no real one exists yet);
//   - ?tab=past&edition=<id> opens that edition; an unknown id says so;
//   - Home lists the active festival's past editions, and nothing when it has
//     none; a library that fails to load leaves every stub disabled and Home
//     unchanged, with no error on the page;
//   - nothing scrolls sideways at 393pt.
//
//   PLURSKY_PAST_SHOTS=<dir> node scripts/test-past-lookbacks.mjs   # also writes screenshots
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from "./lib/server-ready.mjs";
import { pastEditionsFor } from "./lib/festival-page-data.mjs";
import { loadRegistry } from "./lib/load-registry.mjs";

const ROOT = process.cwd();
const H = p => JSON.parse(readFileSync(join(ROOT, "data/historical", p), "utf8"));
const INDEX = H("index.json");
const SHOTS = process.env.PLURSKY_PAST_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const fails = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

// The registry, read the way the generator reads it.
const { REG } = loadRegistry(ROOT);
const stubs = REG.filter(f => !f.available && !f.previewOnly);
const yearOf = id => +(/-(\d{4})$/.exec(id) || [])[1];
const baseOf = id => id.replace(/-\d{4}$/, "");
const lookBackOf = id => INDEX.editions.filter(e => e.festivalId === baseOf(id) && e.year < yearOf(id)).sort((a, b) => b.year - a.year)[0] || null;
const qualified = stubs.filter(f => lookBackOf(f.config.id));
const unqualified = stubs.filter(f => !lookBackOf(f.config.id));
ok(stubs.length >= 6, `expected the gated stubs in the registry, found ${stubs.length}`);
ok(qualified.length >= 1, "no gated stub has a past edition in the library; this gate would pass vacuously");

// ── 1. the /f/ pages ──
for (const f of REG) {
  const id = f.config.id, html = readFileSync(join(ROOT, `f/${id}/index.html`), "utf8");
  const listed = pastEditionsFor(id);
  ok(listed.every(e => e.year < yearOf(id)), `/f/${id}/ lists an edition from its own year or later: ${listed.map(e => e.id).join(", ")}`);
  const lb = !f.available ? lookBackOf(id) : null;
  const section = (/<section class="lookback"[\s\S]*?<\/section>/.exec(html) || [])[0];
  if (!lb) { ok(!section, `/f/${id}/ has a look-back panel but no qualified past edition`); continue; }
  ok(!!section, `/f/${id}/ has no look-back panel for ${lb.id}`);
  if (!section) continue;
  ok(section.includes(`Look back: ${lb.year}</h2>`), `/f/${id}/ look-back is not headed "Look back: ${lb.year}"`);
  ok(section.includes(`<span class="chip chip-past">Past edition</span>${lb.name}`), `/f/${id}/ look-back does not name ${lb.name} as a Past edition`);
  ok(section.includes(`href="/?tab=past&amp;edition=${lb.id}"`), `/f/${id}/ look-back does not link to ${lb.id}`);
  ok(/Official source archived [A-Z][a-z]{2} \d+, \d{4}\./.test(section), `/f/${id}/ look-back does not say when its source was archived`);
  ok(lb.completeness === "lineup_only" ? section.includes("Set times not verified for this edition") : section.includes(`${lb.counts.sets} sets on ${lb.counts.stages} stages`),
    `/f/${id}/ look-back misstates what the ${lb.year} record holds`);
  ok(html.indexOf('class="lookback"') < html.indexOf('id="answers-h"'), `/f/${id}/ look-back is not the first thing after the header`);
  // The 2026 lineup is never presented as the stub's own: the JSON-LD
  // performer list names none of the edition's artists.
  const ed = H(`editions/${lb.id}.json`);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
  ok(!ed.artists.slice(0, 20).some(a => ld.includes(JSON.stringify(a.name))), `/f/${id}/ JSON-LD carries ${lb.year} artists under the ${yearOf(id)} event`);
}

// A lineup-only look-back and a same-year/later edition, injected: the app
// must say "not verified" for the first and never offer the second.
const U = unqualified[0]?.config.id;
const FX_YEAR = U ? yearOf(U) - 1 : 2026;
const FX = U && {
  id: `${baseOf(U)}-${FX_YEAR}`, festivalId: baseOf(U), name: `${unqualified[0].config.brand || "Fixture"} ${FX_YEAR}`, year: FX_YEAR, timezone: "America/Chicago", rolloverHour: 6,
  completeness: "lineup_only", days: [{ day: 1, date: `${FX_YEAR}-04-10`, label: "Friday" }], stages: [], sets: [],
  artists: ["FIXTURE ONE", "FIXTURE TWO"].map((n, i) => ({ id: `fx:a${i}`, name: n, key: `a${i}`, performers: [`a${i}`] })),
  provenance: { extractionMethod: "structured_html", official: "https://example.invalid/lineup", captures: [] },
};
const FX_META = FX && { id: FX.id, festivalId: FX.festivalId, festivalName: FX.name.replace(/\s+\d{4}$/, ""), name: FX.name, year: FX.year, timezone: FX.timezone,
  completeness: "lineup_only", days: FX.days, counts: { stages: 0, artists: 2, sets: 0 } };
const Q = qualified[0]?.config;
const SAME_YEAR = Q && { ...INDEX.editions.find(e => e.id === lookBackOf(Q.id).id), id: `${baseOf(Q.id)}-${yearOf(Q.id)}`, name: `${Q.brand} ${yearOf(Q.id)}`, year: yearOf(Q.id) };

const PORT = await port();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const newCtx = async (active = "edc-lv-2026") => {
    const c = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: "America/Chicago", serviceWorkers: "block" });
    await c.addInitScript(a => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
      localStorage.setItem("active_festival_id", a); localStorage.setItem("active_festival_explicit", "1");
      localStorage.setItem(`${a}_saved_v1`, JSON.stringify(["n4"]));
      localStorage.setItem("cloud_nudge_seen", "1");
    }, active);
    return c;
  };
  const errorsOf = page => { const e = []; page.on("pageerror", x => e.push(String(x))); return e; };
  const ready = page => page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
  const noSideScroll = async (page, where) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
    [...document.querySelectorAll("section, ul, nav")].every(el => el.scrollWidth <= el.clientWidth + 1)), `${where}: something scrolls sideways at 393pt`);
  const shot = async (page, name) => { if (SHOTS) { await sleep(400); await page.screenshot({ path: join(SHOTS, `${name}.png`) }); } };
  const openSwitcher = async page => {
    await page.getByRole("button", { name: /switch festival/ }).first().click();
    await page.getByRole("dialog").first().waitFor({ timeout: 10000 });
  };
  const stubRow = (page, cfg) => page.getByRole("button", { name: new RegExp(`^${cfg.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });

  // ── 2. switcher: a qualified stub opens its look-back ──
  try {

    const c = await newCtx();
    await c.route("**/data/historical/index.json", async r => {
      const resp = await r.fetch(); const j = await resp.json();
      await r.fulfill({ response: resp, json: { editions: [...j.editions, ...(FX_META ? [FX_META] : []), ...(SAME_YEAR ? [SAME_YEAR] : [])] } });
    });
    if (FX) await c.route(`**/data/historical/editions/${FX.id}.json`, r => r.fulfill({ json: FX }));
    const page = await c.newPage(), errors = errorsOf(page);
    await page.goto(`http://127.0.0.1:${PORT}/?tab=home`, { waitUntil: "domcontentloaded" });
    await ready(page);
    const before = await page.evaluate(() => ({ fest: FESTIVAL_CONFIG.id, active: localStorage.getItem("active_festival_id"), saved: localStorage.getItem("edc-lv-2026_saved_v1") }));
    await openSwitcher(page);
    for (const f of qualified) {
      const lb = lookBackOf(f.config.id), row = stubRow(page, f.config);
      await row.waitFor({ timeout: 10000 });
      await page.waitForFunction(n => [...document.querySelectorAll("button")].some(b => b.textContent.startsWith(n) && !b.disabled), f.config.name, { timeout: 10000 }).catch(() => {});
      ok(await row.isEnabled(), `${f.config.id}: the stub row is still disabled although ${lb.id} is in the library`);
      ok((await row.textContent()).includes(`Look back: ${lb.year}`), `${f.config.id}: the stub row does not read "Look back: ${lb.year}"`);
      ok(!(await row.textContent()).includes(`Look back: ${yearOf(f.config.id)}`), `${f.config.id}: the stub row offers an edition of its own year`);
    }
    for (const f of unqualified) {
      const row = stubRow(page, f.config);
      if (!(await row.count())) continue;
      const text = await row.textContent(), fx = FX && f.config.id === U;
      if (fx) { ok(await row.isEnabled() && text.includes(`Look back: ${FX_YEAR}`), `${f.config.id}: an injected ${FX_YEAR} lineup-only edition is not offered`); continue; }
      ok(await row.isDisabled(), `${f.config.id}: a stub with no past edition is enabled`);
      ok(!/Look back/.test(text), `${f.config.id}: a stub with no past edition offers a look-back`);
    }
    await noSideScroll(page, "switcher");


    const lb = lookBackOf(Q.id), ed = H(`editions/${lb.id}.json`);
    await stubRow(page, Q).click();
    await page.locator("[data-edition-status]").waitFor({ timeout: 10000 });
    await page.locator("[data-stage]").first().waitFor({ timeout: 10000 });
    const status = await page.locator("[data-edition-status]").textContent();
    ok(status.startsWith("Past edition · ") && status.includes(String(lb.year)) && /source archived [A-Z][a-z]{2} \d+, \d{4}/.test(status),
      `the look-back does not say Past edition, its dates and its archive date: "${status}"`);
    ok(await page.getByText(`Official ${lb.year} schedule · archived`, { exact: true }).count() === 1, `the look-back is not labelled as the official ${lb.year} schedule`);
    ok(await page.getByText(String(yearOf(Q.id))).count() === 0, `the ${lb.year} look-back shows the year ${yearOf(Q.id)}`);
    const d1 = ed.sets.filter(s => s.day === 1).length;
    ok(await page.locator("[data-stage] li").count() === d1, `the look-back renders ${await page.locator("[data-stage] li").count()} day-1 sets, the edition has ${d1}`);
    await noSideScroll(page, "look-back edition");
    await shot(page, "lookback-2-edition");
    await page.getByRole("button", { name: "Back" }).click();
    await sleep(300);
    ok(await page.getByRole("heading", { name: "Past festivals", level: 1 }).count() === 0, "Back from a look-back opened on a festival lands in the library, not where the user was");
    ok(await page.locator("[data-edition-status]").count() === 0, "Back did not leave the look-back");
    const after = await page.evaluate(() => ({ fest: FESTIVAL_CONFIG.id, active: localStorage.getItem("active_festival_id"), saved: localStorage.getItem("edc-lv-2026_saved_v1") }));
    ok(JSON.stringify(after) === JSON.stringify(before), `opening a look-back changed the live app: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);

    if (FX) {
      await openSwitcher(page);
      await stubRow(page, unqualified[0].config).click();
      await page.getByRole("list", { name: "Lineup" }).waitFor({ timeout: 10000 });
      ok(await page.getByText(/^Set times not verified for this edition/).count() === 1, "a lineup-only look-back does not say its set times are not verified");
      ok(await page.getByText(/\d:\d\d [AP]M/).count() === 0, "a lineup-only look-back shows a time");
      await shot(page, "lookback-3-FIXTURE-lineup-only");
    }
    ok(!errors.length, `page errors: ${errors.join(" | ")}`);
    await c.close();
  } catch (e) { ok(false, `switcher: ${String(e.message || e).split("\n")[0]}`); }

  // ── 3. deep links ──
  try {

    const c = await newCtx();
    const page = await c.newPage(), errors = errorsOf(page);
    const lb = lookBackOf(Q.id);
    // The real library, nothing injected: the switcher as a user sees it.
    await page.goto(`http://127.0.0.1:${PORT}/?tab=home`, { waitUntil: "domcontentloaded" });
    await ready(page);
    await openSwitcher(page);
    await page.waitForFunction(n => [...document.querySelectorAll("button")].some(b => b.textContent.startsWith(n) && !b.disabled), Q.name, { timeout: 10000 }).catch(() => {});
    await stubRow(page, Q).scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, "lookback-1-switcher");
    await page.goto(`http://127.0.0.1:${PORT}/?tab=past&edition=${lb.id}`, { waitUntil: "domcontentloaded" });
    await ready(page);
    await page.locator("[data-edition-status]").waitFor({ timeout: 15000 }).catch(() => {});
    ok(await page.getByText(`Official ${lb.year} schedule · archived`, { exact: true }).count() === 1, `?tab=past&edition=${lb.id} does not open that edition`);
    await page.goto(`http://127.0.0.1:${PORT}/?tab=past&edition=${baseOf(Q.id)}-1999`, { waitUntil: "domcontentloaded" });
    await ready(page);
    await page.getByText("That edition isn't in the library.").waitFor({ timeout: 15000 }).catch(() => {});
    ok(await page.getByText("That edition isn't in the library.").count() === 1, "an unknown edition id does not say it is not in the library");
    ok(!errors.length, `page errors: ${errors.join(" | ")}`);
    await c.close();
  } catch (e) { ok(false, `deep links: ${String(e.message || e).split("\n")[0]}`); }

  // ── 4. Home: the active festival's past editions, or nothing ──
  try {

    const withEd = REG.find(f => f.available && pastEditionsFor(f.config.id).length);
    const without = REG.find(f => f.available && !pastEditionsFor(f.config.id).length && !f.config.id.startsWith("edc-orlando"));
    for (const [f, want] of [[withEd, true], [without, false]]) {
      if (!f) { ok(false, `no available festival ${want ? "with" : "without"} past editions to test Home on`); continue; }
      const c = await newCtx(f.config.id);
      const page = await c.newPage(), errors = errorsOf(page);
      await page.goto(`http://127.0.0.1:${PORT}/?tab=home`, { waitUntil: "domcontentloaded" });
      await ready(page);
      const eds = pastEditionsFor(f.config.id);
      if (want) {
        await page.getByRole("heading", { name: "Past editions" }).waitFor({ timeout: 15000 }).catch(() => {});
        for (const e of eds) ok(await page.getByRole("button", { name: new RegExp(`^Look back: ${e.year}`) }).count() === 1, `${f.config.id} Home does not offer "Look back: ${e.year}"`);
        await page.getByRole("heading", { name: "Past editions" }).scrollIntoViewIfNeeded().catch(() => {});
        await noSideScroll(page, `${f.config.id} Home`);
        await shot(page, "lookback-4-home");
      } else {
        await sleep(2500);
        ok(await page.getByRole("heading", { name: "Past editions" }).count() === 0, `${f.config.id} Home shows a Past editions section with no edition`);
      }
      ok(!errors.length, `${f.config.id} Home page errors: ${errors.join(" | ")}`);
      await c.close();
    }
  } catch (e) { ok(false, `Home: ${String(e.message || e).split("\n")[0]}`); }

  // ── 5. the library does not load: nothing pretends ──
  try {

    const c = await newCtx();
    await c.route("**/data/historical/index.json", r => r.abort());
    const page = await c.newPage(), errors = errorsOf(page);
    await page.goto(`http://127.0.0.1:${PORT}/?tab=home`, { waitUntil: "domcontentloaded" });
    await ready(page);
    await openSwitcher(page);
    await sleep(1500);
    for (const f of stubs) {
      const row = stubRow(page, f.config);
      if (!(await row.count())) continue;
      ok(await row.isDisabled() && !/Look back/.test(await row.textContent()), `${f.config.id}: with the library unreachable, the stub row is enabled or offers a look-back`);
    }
    ok(!errors.length, `page errors with the library unreachable: ${errors.join(" | ")}`);
    await c.close();
  } catch (e) { ok(false, `the library: ${String(e.message || e).split("\n")[0]}`); }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} past look-back checks failed`); process.exit(1); }
console.log(`  ✓ Past look-backs: ${qualified.length} of ${stubs.length} gated stubs open a past edition (${qualified.map(f => f.config.id).join(", ")}), ${unqualified.length} stay gated, ${checks} checks`);
