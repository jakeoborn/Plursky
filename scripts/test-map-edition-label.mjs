#!/usr/bin/env node
// Map screen: a plate drawn for another edition says whose map it is.
//
// Escape Halloween 2026 ships its official 2025 map on purpose (the 2026 page
// still shows it: mapSource.mapYear). Main's posture label says what the map
// on screen can claim (POSTER_TIER); it never said whose art it was, so last
// year's layout read as this festival's. Wherever a plate drawn for another
// edition is ON SCREEN, the label now names that edition first.
//
// The rule is tested on a FIXTURE: `mapArtYear` is set on ACL in the page, so
// it keeps testing after Escape's own field is dropped at the flip. ACL ships
// art with anchors at tier "unchecked", so both of its maps draw the art:
//   drawn map  — "OFFICIAL MAP" → "2025 MAP · OFFICIAL MAP"
//   real map   — "NOT TO SCALE · STAGES PENDING" → prefixed the same way
// Escape itself is opened once on each map with its live config: its art has
// no anchors (tier "none"), so the drawn map reads "2025 MAP · LAYOUT ONLY"
// and the real map, which draws no art, stays "VENUE MAP · STAGES PENDING".
//
// Cases: no mapArtYear (control), mapArtYear equal to the festival's year,
// and mapArtYear a year behind. The long label is then measured at 280, 320
// and 393 px: it must not overlap the title, leave the header or be clipped.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";
import { loadRegistry } from "./lib/load-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── Every festival that ships another edition's art says so ───────────────
// A festival's own map page can still be showing last year's map
// (`mapSource.mapYear`, recorded when the page was checked). Art shipped while
// that is true cannot be this year's official map, so the config has to name
// the art's year. Escape Halloween 2026 shipped its 2025 map for weeks with
// no label in the app; this is the rule that would have caught it.
{
  const { REG } = loadRegistry(ROOT);
  const unlabelled = list => list.map(e => e.config).filter(c => c.mapImage && c.mapSource && c.mapSource.mapYear != null
    && c.mapSource.mapYear !== c.year && c.mapArtYear !== c.mapSource.mapYear).map(c => c.id);
  const declared = REG.map(e => e.config).filter(c => c.mapArtYear != null);
  check(unlabelled(REG).length === 0, `a festival whose map page shows another year's map ships that art unlabelled: ${unlabelled(REG).join(", ")}`);
  check(declared.every(c => c.mapImage && Number.isInteger(c.mapArtYear) && c.mapArtYear < c.year),
    `mapArtYear is an earlier year, on a festival that ships art (${declared.map(c => `${c.id} ${c.mapArtYear}`).join(", ")})`);
  const esc = REG.find(e => e.config.id === "escape-halloween-2026");
  check(esc && esc.config.mapArtYear === 2025 && esc.config.mapSource?.mapYear === 2025 && esc.config.year === 2026,
    `escape-halloween-2026 names its 2025 art (mapArtYear ${esc?.config.mapArtYear}, map page showed ${esc?.config.mapSource?.mapYear})`);
  // Mutation: the field dropped from Escape must be flagged.
  const stripped = REG.map(e => (e.config.id === "escape-halloween-2026" ? { ...e, config: { ...e.config, mapArtYear: undefined } } : e));
  check(unlabelled(stripped).join() === "escape-halloween-2026", `mutation: Escape without mapArtYear is caught (${unlabelled(stripped).join(", ") || "nothing flagged"})`);
}

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  // Opens `fid`'s map at `when`, on the drawn map or the real one, with
  // `mapArtYear` forced to `artYear` (undefined = absent, KEEP = untouched).
  const KEEP = Symbol("keep");
  const ACL = { fid: "acl-2026", when: "2026-10-10T20:00:00-05:00" };
  const ESC = { fid: "escape-halloween-2026", when: "2026-10-30T20:00:00-07:00" };
  const open = async (width, artYear, { fid, when } = ACL, real = false) => {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 700 } });
    // A festival's tab bar has a Map only while it runs: pin Date (not
    // timers) to a live evening so this does not rot with the calendar.
    await ctx.clock.setFixedTime(new Date(when));
    await ctx.addInitScript(([fid, real]) => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("plursky_use_realmap", real ? "1" : "0");
    }, [fid, real]);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${fid}&tab=lineup`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window._pushNav === "function", fid, { timeout: 60000 });
    const year = await page.evaluate(([keep, y]) => {
      if (keep) return window.FESTIVAL_CONFIG.year;
      if (y === null) delete window.FESTIVAL_CONFIG.mapArtYear; else window.FESTIVAL_CONFIG.mapArtYear = y;
      return window.FESTIVAL_CONFIG.year;
    }, [artYear === KEEP, artYear === KEEP || artYear === undefined ? null : artYear]);
    // The map mounts after the field is set, so its label is computed from it.
    await page.evaluate(() => window.setTab ? window.setTab("map") : [...document.querySelectorAll("button")].find(b => /^map$/i.test(b.innerText.trim()) || b.getAttribute("aria-label") === "Map")?.click());
    await page.waitForSelector("[data-map-posture]", { timeout: 30000 });
    await page.waitForTimeout(1200);
    const s = await page.evaluate(() => {
      // Main's board header: back · title · posture label, on solid ground
      // above the map (no floating left column, no GPS pill any more).
      const span = document.querySelector("[data-map-posture]"), head = span.closest("[data-map-header]");
      const r = span.getBoundingClientRect(), host = head.getBoundingClientRect();
      const title = head.querySelector("h1").getBoundingClientRect();
      const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        text: span.textContent.trim(), realMap: !!document.querySelector(".maplibregl-map"), left: r.left, right: r.right, top: r.top, bottom: r.bottom,
        clipped: span.scrollWidth > span.clientWidth + 1 || span.scrollHeight > span.clientHeight + 1,
        overTitle: overlaps(r, title),
        hostLeft: host.left, hostRight: host.right, vw: window.innerWidth,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    await ctx.close();
    return { ...s, year, errors };
  };

  const control = await open(393, undefined);
  check(control.errors.length === 0, `control: the map throws nothing (${JSON.stringify(control.errors)})`);
  check(control.text === "OFFICIAL MAP", `control: drawn map, art on its own edition reads OFFICIAL MAP (got "${control.text}")`);
  const same = await open(393, control.year);
  check(same.text === "OFFICIAL MAP", `a mapArtYear equal to the festival's year changes nothing (got "${same.text}")`);
  const realControl = await open(393, undefined, ACL, true);
  check(realControl.realMap, "control: the real map mounted (else the real-map cases test nothing)");
  check(realControl.text === "NOT TO SCALE · STAGES PENDING", `control: real map, unchecked art reads NOT TO SCALE · STAGES PENDING (got "${realControl.text}")`);

  const prev = control.year - 1;
  const cases = [
    { width: 393, real: false, label: `${prev} MAP · OFFICIAL MAP` },
    { width: 393, real: true, label: `${prev} MAP · NOT TO SCALE · STAGES PENDING` },
    { width: 320, real: true, label: `${prev} MAP · NOT TO SCALE · STAGES PENDING` },
    { width: 280, real: true, label: `${prev} MAP · NOT TO SCALE · STAGES PENDING` },
  ];
  for (const { width, real, label } of cases) {
    const s = await open(width, prev, ACL, real);
    const at = `${width}px ${real ? "real" : "drawn"} map`;
    check(s.errors.length === 0, `${at}: the map throws nothing (${JSON.stringify(s.errors)})`);
    check(s.text === label, `${at}: last year's art reads "${label}" (got "${s.text}")`);
    check(!s.clipped, `${at}: none of the label is clipped`);
    check(!s.overTitle, `${at}: the label does not overlap the "Map" title`);
    check(s.left >= s.hostLeft && s.right <= s.hostRight, `${at}: the label is inside the header (left ${s.left}, right ${s.right.toFixed(1)}, header ${s.hostLeft}-${s.hostRight})`);
    check(s.right <= s.vw, `${at}: the label ends on screen (right ${s.right.toFixed(1)}, viewport ${s.vw})`);
    check(!s.pageOverflow, `${at}: no horizontal page scroll`);
  }

  // Escape as shipped: art without anchors (tier "none").
  const escDrawn = await open(320, KEEP, ESC, false);
  check(escDrawn.errors.length === 0, `Escape drawn map throws nothing (${JSON.stringify(escDrawn.errors)})`);
  check(escDrawn.text === "2025 MAP · LAYOUT ONLY", `Escape drawn map names its 2025 art (got "${escDrawn.text}")`);
  const escReal = await open(320, KEEP, ESC, true);
  check(escReal.realMap, "Escape real map mounted");
  check(escReal.text === "VENUE MAP · STAGES PENDING", `Escape real map draws no art, so no art year (got "${escReal.text}")`);
  await browser.close();
} finally {
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  map edition label: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
