#!/usr/bin/env node
// Summerfest 2026 pulls su24, the wrong-stage copy of Stephan Jenkins (su45).
//
// Someone who saved su24, or tagged a moment to it, still holds that id after
// the pull. This runs the REAL id against the REAL lineup, in the running app,
// rather than inferring from code what happens to it:
//   A. the module no longer bills su24, keeps su45, and carries su24's re-add
//      line verbatim;
//   B. a saved su24 alone: Me 0, Search no YOUR LINEUP block, storage still
//      holds it, the cloud push still carries it;
//   C. su24 + su45 + one more live save: Me 2 and Search 2, nothing deleted,
//      the push carries all three;
//   D. a moment tagged su24 lands in Needs Review (not on the set spine, not
//      in Between Sets), while a moment tagged su45 stays on the spine;
//   E. su24 re-added from its comment line: Me counts it again, its moment
//      leaves Needs Review, and nothing was re-saved.
// No migration runs here: moving su24's saves to su45 is a separate change.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FID = "summerfest-2026";
const GONE = "su24", KEEP = "su45";
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── A. the module ──────────────────────────────────────────────────────────
const MOD = readFileSync(join(ROOT, "data", "festivals", `${FID}.js`), "utf8");
const READD = `mk("${GONE}", "Stephan Jenkins of Third Eye Blind", "Rock", "aurora", 1, "14:00", "15:05")`;
check(!new RegExp(`^\\s*mk\\("${GONE}"`, "m").test(MOD), "A. su24 is not billed in the module");
check(new RegExp(`^\\s*mk\\("${KEEP}",\\s*"Stephan Jenkins of Third Eye Blind"`, "m").test(MOD), "A. su45 (AmFam House) is still billed");
check(MOD.includes(`// Re-add: ${READD}`), "A. harness: su24's re-add line is recorded in the module");

// ── B–E. the running app ───────────────────────────────────────────────────
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // rebill: serve the module with su24's recorded re-add line put back.
  const open = async (saved, tab, { rebill = false } = {}) => {
    const bctx = await browser.newContext({ viewport: { width: 393, height: 844 }, serviceWorkers: "block" });
    await bctx.clock.install({ time: new Date("2026-10-12T18:00:00Z") });
    if (rebill) {
      await bctx.route(new RegExp(`/data/festivals/${FID}\\.js`), async route => {
        const body = (await (await route.fetch()).text())
          .replace(/^(\s*)(mk\("su45",[^\n]*\n)/m, (m, ind) => `${ind}${READD},\n${m}`);
        await route.fulfill({ status: 200, contentType: "application/javascript", body });
      });
    }
    await bctx.addInitScript(({ FID, saved }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", FID);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("plursky_lineup_view", "list");
      localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(saved));
    }, { FID, saved });
    const page = await bctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=${tab}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.plurskyOpenSearch === "function"
      && typeof window.sbPush === "function" && typeof window._groupNightMoments === "function", FID, { timeout: 60000 });
    await page.evaluate(() => {
      window.__pushed = [];
      window.sbGetUser = async () => ({ id: "fixture-user" });
      window.sbPush = async ids => { window.__pushed.push([...ids]); };
    });
    await page.clock.runFor(4000);
    return { bctx, page };
  };
  const stored = page => page.evaluate(fid => JSON.parse(localStorage.getItem(`${fid}_saved_v1`) || "null"), FID);
  const pushed = page => page.evaluate(() => window.__pushed.at(-1) || null);
  const searchHeader = async page => {
    await page.evaluate(() => window.plurskyOpenSearch());
    await page.clock.runFor(400);
    return page.evaluate(() => (document.body.innerText.match(/YOUR LINEUP · (\d+) SETS?/) || [])[1] ?? null);
  };
  const meSaved = page => page.evaluate(() => {
    const b = document.querySelector("[data-me-action=saved]");
    if (!b) return null;
    const m = b.innerText.match(/(\d+)/);
    return m ? +m[1] : 0;
  });
  // The grouping Memories renders, on the lineup the app actually loaded.
  const groups = page => page.evaluate(({ GONE, KEEP }) => {
    const moments = [
      { id: "m-gone", artistId: GONE, festivalId: "summerfest-2026", night: 1, ts: Date.parse("2026-06-18T19:10:00Z") },
      { id: "m-keep", artistId: KEEP, festivalId: "summerfest-2026", night: 1, ts: Date.parse("2026-06-18T19:20:00Z") },
    ];
    const g = window._groupNightMoments({ moments, attendedSet: [], artists: window.ARTISTS, toMin: window.toNightMin });
    return { spine: g.spineIds, review: g.needsReview.map(m => m.id), between: g.untagged.map(m => m.id) };
  }, { GONE, KEEP });

  const other = await (async () => {
    const { bctx, page } = await open([], "home");
    const r = await page.evaluate(({ GONE, KEEP }) => ({
      gone: window.ARTISTS.some(a => a.id === GONE),
      keep: window.ARTISTS.some(a => a.id === KEEP),
      other: window.activeLineup().find(a => a.day != null && a.start && a.id !== KEEP)?.id || null,
    }), { GONE, KEEP });
    await bctx.close();
    check(!r.gone, "B. app sanity: the running Summerfest lineup does not bill su24");
    check(r.keep, "B. app sanity: the running Summerfest lineup bills su45");
    check(!!r.other, "B. harness: a second timed Summerfest act to save");
    return r.other;
  })();

  // B. su24 alone
  {
    const { bctx, page } = await open([GONE], "me");
    check(await meSaved(page) === 0, `B. Me reads 0 saved sets with only su24 stored (got ${await meSaved(page)})`);
    check(await searchHeader(page) === null, "B. Search shows no YOUR LINEUP block with only su24 stored");
    check(same(await stored(page), [GONE]), "B. storage still holds su24");
    check(same(await pushed(page), [GONE]), `B. the cloud push still carries su24 (got ${JSON.stringify(await pushed(page))})`);
    await bctx.close();
  }

  // C. su24 + su45 + one more
  {
    const { bctx, page } = await open([KEEP, GONE, other], "me");
    check(await meSaved(page) === 2, `C. Me reads 2 saved sets with su45 + su24 + one live (got ${await meSaved(page)})`);
    check(await searchHeader(page) === "2", "C. Search reads YOUR LINEUP · 2 SETS, not 3");
    check(same(await stored(page), [KEEP, GONE, other]), "C. storage keeps all three ids, in saved order");
    check(same(await pushed(page), [KEEP, GONE, other]), `C. the cloud push carries all three (got ${JSON.stringify(await pushed(page))})`);
    await bctx.close();
  }

  // D. moments
  {
    const { bctx, page } = await open([], "memories");
    const g = await groups(page);
    check(same(g.review, ["m-gone"]), `D. the su24 moment is in Needs Review, alone (got ${JSON.stringify(g.review)})`);
    check(!g.spine.includes(GONE), "D. su24 is not on the set spine");
    check(g.spine.includes(KEEP), "D. su45's moment keeps its set on the spine");
    check(!g.between.includes("m-gone"), "D. the su24 moment is not filed under Between Sets");
    await bctx.close();
  }

  // E. re-added
  {
    const { bctx, page } = await open([GONE], "me", { rebill: true });
    const billed = await page.evaluate(id => window.ARTISTS.some(a => a.id === id), GONE);
    check(billed, "E. harness: the re-added lineup carries su24");
    check(await meSaved(page) === 1, `E. re-added: Me reads 1 saved set again (got ${await meSaved(page)})`);
    const g = await groups(page);
    check(g.review.length === 0 && g.spine.includes(GONE), `E. re-added: the su24 moment is back on the spine (review ${JSON.stringify(g.review)})`);
    check(same(await stored(page), [GONE]), "E. re-added: the same stored id, nothing re-saved");
    await bctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}

console.log(`  ${failed ? "✗" : "✓"}  Summerfest su24 removal: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
