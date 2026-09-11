#!/usr/bin/env node
// #116 lineup GRID e2e (run by hand, like e2e-offline-packs; needs Playwright Chromium).
// Usage: node scripts/e2e-lineup-grid.mjs <repo root> <screenshot dir> <tag>
import { spawn } from "node:child_process";
import { join } from "node:path";
import { createRequire } from "node:module";
const [ROOT, OUT, TAG] = process.argv.slice(2);
const { chromium } = createRequire(join(ROOT, "package.json"))("playwright");
const PORT = "8799", ORIGIN = `http://localhost:${PORT}`;
const server = spawn("python3", ["-m", "http.server", PORT, "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));
const browser = await chromium.launch();
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗ ${msg}`); } else console.log(`  ✓ ${msg}`); };
const FAB = 'button[aria-label="Search artists, stages, genres"]';
async function open(w, h, view, day) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(v => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
    localStorage.setItem("active_festival_id", "lost-lands-2026"); localStorage.setItem("active_festival_explicit", "1");
    localStorage.setItem("plursky_lineup_view", v); localStorage.setItem("lost-lands-2026_saved_v1", "[]");
  }, view);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`${ORIGIN}/?tab=lineup&day=${day}`, { waitUntil: "load" });
  await page.waitForSelector(view === "grid" ? "[data-grid-scroll]" : "[data-lineup-scroll]", { timeout: 20000 });
  await page.waitForTimeout(900);
  return { ctx, page, errors };
}
const geo = page => page.evaluate(() => {
  const g = document.querySelector("[data-grid-scroll]"), lead = document.querySelector("[data-grid-lead]");
  const head = g && g.querySelector("[data-stage-head]");      // not button[title]: SURPRISE in the lead has a title too
  const tab = document.querySelector('button[aria-current="page"]');
  const r = e => e && e.getBoundingClientRect();
  const scrollers = [...document.querySelectorAll("*")].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1).length;
  return { vh: innerHeight, docH: document.documentElement.scrollHeight, gridTop: r(g) && Math.round(r(g).top), gridBottom: r(g) && Math.round(r(g).bottom),
    leadTop: lead ? Math.round(r(lead).top) : null, leadBottom: lead ? Math.round(r(lead).bottom) : null, leadLeft: lead ? Math.round(r(lead).left) : null, leadH: lead ? lead.offsetHeight : 0,
    headTop: head ? Math.round(r(head).top) : null, headLeft: head ? Math.round(r(head).left) : null,
    tabTop: tab ? Math.round(r(tab.parentElement).top) : null, fab: !!document.querySelector('button[aria-label="Search artists, stages, genres"]'),
    saveDay: !!document.querySelector("[data-save-day]"), scrollers, scrollTop: g && g.scrollTop, scrollH: g && g.scrollHeight, clientH: g && g.clientHeight };
});
try {
  for (const [w, h, day] of [[375, 812, 1], [390, 844, 1], [430, 932, 1], [390, 844, 4]]) {
    const { ctx, page, errors } = await open(w, h, "grid", day);
    const k = `${w}x${h} day${day}`;
    const g0 = await geo(page);
    console.log(`  ${TAG} ${k} top`, JSON.stringify(g0));
    await page.screenshot({ path: join(OUT, `${TAG}-${w}x${h}-d${day}-top.png`) });
    check(g0.docH === g0.vh, `${k}: document = viewport (${g0.docH}/${g0.vh})`);
    check(g0.scrollers === 1, `${k}: exactly one vertical scroller (${g0.scrollers})`);
    check(!g0.fab, `${k}: no floating Search pill over the grid`);
    check(g0.leadH > 0 && g0.leadTop === g0.gridTop && g0.headTop >= g0.leadBottom - 1, `${k}: utility stack sits above the stage headers inside the grid`);
    await page.mouse.move(w / 2, h * 0.6);
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(70); }
    await page.waitForTimeout(400);
    const g1 = await geo(page);
    console.log(`  ${TAG} ${k} scrolled`, JSON.stringify(g1));
    await page.screenshot({ path: join(OUT, `${TAG}-${w}x${h}-d${day}-scrolled.png`) });
    check(g1.leadBottom <= g1.gridTop && Math.abs(g1.headTop - g1.gridTop) <= 1, `${k}: stack scrolled away, stage headers pinned at the grid top`);
    await page.evaluate(() => { document.querySelector("[data-grid-scroll]").scrollTop = 0; });
    await page.waitForTimeout(200);
    const g2 = await geo(page);
    check(g2.leadTop === g2.gridTop, `${k}: back at the top the stack is back`);
    const pans = await page.evaluate(() => { const g = document.querySelector("[data-grid-scroll]"); return g.scrollWidth > g.clientWidth + 1; });
    await page.evaluate(() => { document.querySelector("[data-grid-scroll]").scrollLeft = 300; });
    await page.waitForTimeout(200);
    const g3 = await geo(page);
    // A day whose stages all fit (Wednesday: 2) has nothing to pan; the stages
    // spread to fill the width instead. Only an overflowing day can pan.
    if (pans) check(g3.leadLeft === g2.leadLeft && g3.headLeft < g2.headLeft, `${k}: a horizontal pan leaves the stack and moves the stage headers (${g2.headLeft}→${g3.headLeft})`);
    else check(g3.leadLeft === g2.leadLeft && g3.headLeft === g2.headLeft, `${k}: every stage fits, so nothing pans and nothing moves`);
    await page.evaluate(() => { document.querySelector("[data-grid-scroll]").scrollLeft = 0; });
    await page.click('input[aria-label="Search the lineup"]');
    await page.keyboard.type("ca");
    await page.waitForTimeout(250);
    const focus = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label") + "|" + document.activeElement.value);
    check(focus === "Search the lineup|ca", `${k}: typing in grid search keeps focus (${focus})`);
    await page.evaluate(() => { const g = document.querySelector("[data-grid-scroll]"); g.scrollTop = g.scrollHeight; });
    await page.waitForTimeout(250);
    const g4 = await geo(page);
    check(g4.gridBottom <= g4.tabTop && g4.scrollTop + g4.clientH >= g4.scrollH - 1, `${k}: the last hour is reachable above the tab bar (grid bottom ${g4.gridBottom}, tab top ${g4.tabTop})`);
    if (day === 4) check(g0.saveDay, `${k}: Save-the-Day row shows on a day with top picks`);
    check(errors.length === 0, `${k}: no page errors ${errors.slice(0, 1)}`);
    await ctx.close();
  }
  const { ctx, page, errors } = await open(390, 844, "list", 1);
  const l = await page.evaluate(() => {
    const s = document.querySelector('input[aria-label="Search the lineup"]'), list = document.querySelector("[data-lineup-scroll]");
    return { search: !!s, above: s && list && s.getBoundingClientRect().bottom <= list.getBoundingClientRect().top + 1,
             fab: !!document.querySelector('button[aria-label="Search artists, stages, genres"]'), lead: !!document.querySelector("[data-grid-lead]") };
  });
  check(l.search && l.above && l.fab && !l.lead, `list mode unchanged: search above the list, Search pill present, no grid lead (${JSON.stringify(l)})`);
  await page.screenshot({ path: join(OUT, `${TAG}-390x844-list.png`) });
  check(errors.length === 0, "list: no page errors");
  await ctx.close();
} catch (e) { failed++; console.log("  threw:", String(e).split("\n")[0]); }
finally { await browser.close(); server.kill(); }
console.log(failed ? `  ✗ ${failed} of ${checks} failed` : `  ✓ ${checks} checks`);
process.exit(failed ? 1 : 0);
