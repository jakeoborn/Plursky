#!/usr/bin/env node
// Artist screen: an act with no day (billed, not yet placed by any official
// schedule) renders instead of crashing.
//
// On main at e334e97 every one of Escape Halloween 2026's 20 lineup-card acts
// threw "Cannot read properties of undefined (reading 'label')" on its artist
// screen: DAYS.find(d => d.n === a.day).label with a.day null. The fix (first
// written in #240) says "DAY + SET TIME NOT PUBLISHED", pills "DAY TBA" and
// drops the SCHEDULE jump, which has no day to jump to.
//
// A FIXTURE act, not Escape's live data: Escape's acts gain days the moment
// its set times publish, and a test pinned to them would go vacuous then.
// Cases: no day; a day but no set time; a control act with both.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const FID = "acl-2026";
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 844 } });
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
  }, FID);
  const page = await ctx.newPage();
  // React catches a render crash and logs it, so a pageerror alone misses it.
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /TypeError|Cannot read|is not a function|The above error/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && window.ARTISTS?.length && typeof window._pushNav === "function", FID, { timeout: 60000 });

  const control = await page.evaluate(() => window.ARTISTS.find(a => a.day != null && a.start));
  const fixtures = await page.evaluate(() => {
    const stage = window.STAGES[0].id;
    const base = { stage, genre: "house", tier: 1, img: "linear-gradient(#222,#444)" };
    const noDay  = { ...base, id: "fixture-no-day-act",  name: "Fixture No Day Act",  day: null, start: null, end: null };
    const noTime = { ...base, id: "fixture-no-time-act", name: "Fixture No Time Act", day: window.DAYS[0].n, start: null, end: null };
    window.ARTISTS = [...window.ARTISTS, noDay, noTime];
    return { noDay, noTime };
  });

  const open = async (a) => {
    const before = errors.length;
    await page.evaluate(id => window._pushNav({ artist: id }), a.id);
    await page.waitForTimeout(800);
    const s = await page.evaluate(() => ({
      text: document.body.innerText,
      // The board's chip is sentence case ("Schedule"); the gate is about the jump existing.
      schedule: [...document.querySelectorAll("button")].some(b => /^schedule$/i.test(b.innerText.trim())),
      // Exact text of the hero pill. A substring match let "DAY TBA · —" pass.
      pill: [...document.querySelectorAll("[data-artist-day-pill]")].map(e => e.textContent.trim()),
    }));
    await page.evaluate(() => window._popNav && window._popNav());
    await page.waitForTimeout(300);
    return { ...s, errs: errors.slice(before) };
  };

  const nd = await open(fixtures.noDay);
  check(nd.errs.length === 0, `no-day act: the artist screen throws nothing (got ${JSON.stringify(nd.errs)})`);
  check(nd.text.toUpperCase().includes("FIXTURE NO DAY ACT"), "no-day act: its artist screen renders the act");
  check(nd.text.includes("DAY + SET TIME NOT PUBLISHED"), "no-day act: says the day and set time are not published");
  check(nd.pill.length === 1 && nd.pill[0] === "DAY TBA", `no-day act: the hero pill is exactly "DAY TBA", no separator and no placeholder time (got ${JSON.stringify(nd.pill)})`);
  check(!/DAY null|DAY undefined/.test(nd.text), "no-day act: no 'null'/'undefined' leaks into the copy");
  check(!nd.schedule, "no-day act: no SCHEDULE jump (there is no day to jump to)");

  const nt = await open(fixtures.noTime);
  check(nt.errs.length === 0, `no-time act: the artist screen throws nothing (got ${JSON.stringify(nt.errs)})`);
  check(nt.text.includes("SET TIME NOT PUBLISHED") && !nt.text.includes("DAY + SET TIME NOT PUBLISHED"), "no-time act: names its day and says the set time is not published");
  check(nt.schedule, "no-time act: keeps the SCHEDULE jump to its day");
  check(nt.pill.length === 1 && nt.pill[0] === `DAY ${fixtures.noTime.day}`, `no-time act: the hero pill is exactly its day, no placeholder time (got ${JSON.stringify(nt.pill)})`);

  const c = await open(control);
  check(c.errs.length === 0, "control: a timed act's screen throws nothing");
  check(c.schedule, "control: a timed act keeps its SCHEDULE jump");
  check(!c.text.includes("NOT PUBLISHED"), "control: a timed act shows no 'not published' copy");
  const controlTime = await page.evaluate(t => fmt12(t), control.start);
  check(c.pill.length === 1 && c.pill[0] === `DAY ${control.day} · ${controlTime}`, `control: a timed act keeps its day and time in the pill (got ${JSON.stringify(c.pill)})`);
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  artist no-day: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
