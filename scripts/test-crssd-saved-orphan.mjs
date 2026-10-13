#!/usr/bin/env node
// CRSSD Fall 2026's flip drops Skepta Más Tiempo: the real orphan (Codex P2 on #249).
//
// Someone who saved Skepta Más Tiempo while the scaffold billed it still holds
// `crssd-skepta-mas-tiempo` in crssd-fall-2026_saved_v1. The flip must not
// show that as "1 saved set" over an empty lineup, and must not delete it:
// storage and the cloud row keep the id, so a re-bill brings the set back
// saved (lane ruling 2026-09-27, the same view #251 ships as savedInLineup).
//
// test-saved-set-lineup-view.mjs proves the view with a synthetic ACL orphan.
// This runs the REAL id against the REAL flipped lineup, in the running app:
//   A. the id is an orphan of this flip (absent from ARTISTS, recorded in
//      REMOVED_AFTER_GRAPHIC), and the sign-in union keeps it;
//   B. orphan only: Me 0, Search no YOUR LINEUP block, lineup Saved filter
//      empty, storage still holds it, the cloud push still carries it;
//   C. orphan + two live saves: Me 2, Search 2, Build My Night 2 and its
//      share text names only live acts, crew showdown 2/2 with 0 of the
//      orphan in common; storage and cloud push keep all three;
//   D. the act re-billed (its recorded reAdd line put back into the lineup
//      file on the wire): Me and Search count it again, nothing re-saved.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import vm from "node:vm";
import { chromium } from "playwright";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FID = "crssd-fall-2026";
const SKEPTA = "crssd-skepta-mas-tiempo";
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── A. the id is this flip's orphan; the union merge keeps it ──────────────
const MOD = readFileSync(join(ROOT, "data", "festivals", `${FID}.js`), "utf8");
const READD = /mk\("crssd-son-of-son",[^\n]*\n/;
check(READD.test(MOD), "A. harness: the re-add anchor (Son of Son's mk row) is in the lineup file");
check(!new RegExp(`^\\s*mk\\("${SKEPTA}"`, "m").test(MOD), "A. Skepta Más Tiempo is not billed in the flipped lineup");
check(new RegExp(`REMOVED_AFTER_GRAPHIC[\\s\\S]*id: "${SKEPTA}"`).test(MOD), "A. the flip records it in REMOVED_AFTER_GRAPHIC");
{
  const sb = readFileSync(join(ROOT, "build", "supabase.js"), "utf8");
  const m = sb.match(/function mergeCloudSaved[\s\S]*?\n}\n/);
  check(!!m, "A. harness: mergeCloudSaved is in build/supabase.js");
  if (m) {
    const merge = vm.runInNewContext(`(${m[0].trim()})`);
    const row = { updated_at: "2026-09-27T12:00:00.000Z", artist_ids: [SKEPTA] };
    check(merge([], row, {}).includes(SKEPTA), "A. sign-in union: the cloud's Skepta id survives into local");
    check(merge([SKEPTA], { ...row, artist_ids: [] }, {}).includes(SKEPTA), "A. sign-in union: the local Skepta id survives");
  }
}

// ── B–D. the running app ───────────────────────────────────────────────────
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // Opens CRSSD with `saved` stored and a signed-in stub user, then runs the
  // clock past the 3 s cloud-push debounce. rebill: serve the lineup file
  // with Skepta's recorded reAdd row put back.
  const open = async (saved, tab, { rebill = false } = {}) => {
    const bctx = await browser.newContext({ viewport: { width: 393, height: 844 }, serviceWorkers: "block" });
    await bctx.clock.install({ time: new Date("2026-09-28T18:00:00Z") });
    if (rebill) {
      await bctx.route(new RegExp(`/data/festivals/${FID}\\.js`), async route => {
        const body = (await (await route.fetch()).text())
          .replace(READD, m => `${m}    mk("${SKEPTA}", "Skepta Más Tiempo", "citysteps"),\n`);
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
      && typeof window.sbPush === "function", FID, { timeout: 60000 });
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
  // Me's Plan action: its count, or 0 when it shows none (a zero is never
  // printed). null only when the action is missing.
  const meSaved = page => page.evaluate(() => {
    const b = document.querySelector("[data-me-action=saved]");
    if (!b) return null;
    const m = b.innerText.match(/(\d+)/);
    return m ? +m[1] : 0;
  });

  const live = await (async () => {
    const { bctx, page } = await open([], "home");
    const r = await page.evaluate(id => ({
      billed: window.ARTISTS.some(a => a.id === id),
      ids: window.activeLineup().filter(a => a.day != null && a.start).slice(0, 2).map(a => a.id),
    }), SKEPTA);
    await bctx.close();
    check(!r.billed, "B. app sanity: the running CRSSD lineup does not bill Skepta Más Tiempo");
    check(r.ids.length === 2, `B. harness: two timed CRSSD acts to save (got ${JSON.stringify(r.ids)})`);
    return r.ids;
  })();
  const [L1, L2] = live;

  // B. orphan only
  {
    const { bctx, page } = await open([SKEPTA], "me");
    check(await meSaved(page) === 0, `B. Me reads 0 saved sets with only Skepta stored (got ${await meSaved(page)})`);
    check(await searchHeader(page) === null, "B. Search shows no YOUR LINEUP block with only Skepta stored");
    check(same(await stored(page), [SKEPTA]), "B. storage still holds the Skepta id");
    check(same(await pushed(page), [SKEPTA]), `B. the cloud push still carries the Skepta id (got ${JSON.stringify(await pushed(page))})`);
    await bctx.close();
  }
  {
    const { bctx, page } = await open([SKEPTA], "lineup");
    const rows = await page.evaluate(() => {
      const chip = [...document.querySelectorAll("button")].find(b => /^\s*(★\s*)?SAVED\b/i.test(b.innerText));
      if (!chip) return null;
      chip.click();
      return true;
    });
    await page.clock.runFor(600);
    const hasSkepta = await page.evaluate(() => /Skepta/i.test(document.body.innerText));
    if (rows) check(!hasSkepta, "B. lineup Saved filter shows no Skepta card");
    else check(!hasSkepta, "B. lineup shows no Skepta card (no Saved chip to press)");
    await bctx.close();
  }

  // C. orphan + two live saves
  {
    const { bctx, page } = await open([L1, SKEPTA, L2], "me");
    check(await meSaved(page) === 2, `C. Me reads 2 saved sets with two live + Skepta (got ${await meSaved(page)})`);
    check(await searchHeader(page) === "2", "C. Search reads YOUR LINEUP · 2 SETS, not 3");
    const rows = await page.evaluate(async ({ L1, L2, SKEPTA }) => {
      const drawn = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t) { drawn.push(String(t)); return orig.apply(this, arguments); };
      try { await window._renderCrewComparison("Me", { saved: [L1, L2, SKEPTA] }, "Friend", [L1, L2, SKEPTA]); }
      finally { CanvasRenderingContext2D.prototype.fillText = orig; }
      const at = label => { const i = drawn.indexOf(label); return i < 0 ? null : [drawn[i + 1], drawn[i + 2]]; };
      return { saved: at("SETS SAVED"), common: at("IN COMMON") };
    }, { L1, L2, SKEPTA });
    check(same(rows.saved, ["2", "2"]), `C. crew showdown SETS SAVED 2/2, not 3/3 (got ${JSON.stringify(rows.saved)})`);
    check(same(rows.common, ["2", "2"]), `C. crew showdown IN COMMON counts the two live acts only (got ${JSON.stringify(rows.common)})`);
    check(same(await stored(page), [L1, SKEPTA, L2]), "C. storage keeps all three ids, in saved order");
    check(same(await pushed(page), [L1, SKEPTA, L2]), `C. the cloud push carries all three (got ${JSON.stringify(await pushed(page))})`);
    await bctx.close();
  }
  {
    const { bctx, page } = await open([L1, SKEPTA, L2], "lineup");
    await page.evaluate(() => { window.__shared = null; navigator.share = async d => { window.__shared = d.text; }; });
    const btn = page.getByRole("button", { name: /My night$/ }).first();
    if (await btn.count()) {
      await btn.click();
      await page.clock.runFor(500);
      const n = await page.evaluate(() => (document.body.innerText.match(/(\d+) SETS SAVED/) || [])[1] ?? null);
      check(n === "2", `C. Build My Night reads 2 SETS SAVED (got ${n})`);
      await page.getByRole("button", { name: "Share lineup" }).first().click();
      await page.clock.runFor(200);
      const text = await page.evaluate(() => window.__shared);
      check(typeof text === "string" && /\(2 sets\)/.test(text) && !/Skepta/i.test(text),
        `C. Build My Night shares "2 sets" and never names Skepta (got ${JSON.stringify(text && text.split("\n")[0])})`);
    } else {
      check(false, "C. harness: no My night action with two live CRSSD saves");
    }
    check(same(await stored(page), [L1, SKEPTA, L2]), "C. the wizard did not delete the Skepta id");
    await bctx.close();
  }

  // D. re-billed: the same stored ids, the act back in the lineup file
  {
    const { bctx, page } = await open([SKEPTA], "me", { rebill: true });
    const billed = await page.evaluate(id => window.ARTISTS.some(a => a.id === id), SKEPTA);
    check(billed, "D. harness: the re-billed lineup carries Skepta Más Tiempo");
    check(await meSaved(page) === 1, `D. re-billed: Me reads 1 saved set again (got ${await meSaved(page)})`);
    check(await searchHeader(page) === "1", "D. re-billed: Search reads YOUR LINEUP · 1 SETS");
    check(same(await stored(page), [SKEPTA]), "D. re-billed: the same stored id, nothing re-saved");
    await bctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}

console.log(`  ${failed ? "✗" : "✓"}  CRSSD saved orphan (Skepta Más Tiempo): ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
