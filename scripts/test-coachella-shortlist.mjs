// Coachella 2027 shortlist (SPEC-195 work package C): the untimed lineup a fan
// can actually use, driven through the REAL index.html in headless Chrome.
//
//   node scripts/test-coachella-shortlist.mjs            # 390x844 light + 320x568 dark
//   SHOTS=/some/dir VIEWPORTS=320x568-dark,390x844-light,430x932-dark node scripts/test-coachella-shortlist.mjs
//
// The module ships GATED (available: false); the activation is its own PR.
// This gate serves data/festivals/coachella-2027.js with ONLY that flag flipped
// (route below), so it exercises exactly what the activation PR would open.
//
// Phases:
//   1. Flow (per viewport): asks which weekend, picks W2, accent/case-folded
//      search keeps official spellings, saves 3 across days, Shortlist shows
//      them with no clock time or clash text, share: native ok / cancel is not
//      a success / no share sheet copies; reload keeps W2 + the 3 ids; another
//      festival's saves untouched; no horizontal overflow, no page errors.
//   2. Orphan: a saved id no longer in the lineup stays in storage, is never
//      counted or shared, and a later save keeps it.
//   3. Weekend fixture: one act tagged W1 only; with W2 picked it is not listed
//      and not in the shared text or its count.
//   4. Deep link vs root: ?f=coachella-2027 enters Coachella; a plain root load
//      keeps an existing explicit festival; a new visitor's root is not Coachella.
//   5. Regressions: ACL (two tagged weekends, timed), Dreamstate (untimed, one
//      weekend) and Lights All Night (untimed, no day split) render with no
//      page error or overflow. ACL (timed) keeps the plan row and full share
//      menu; Dreamstate and LAN (untimed) get the shortlist row and its share
//      menu. No festival is asked which weekend except a both-weekends one.
//   6. Offline: a warm revisit (service worker on) reopens the lineup and the
//      shortlist with the network off; a cold first visit offline shows no app
//      at all, so nothing claims a data pack exists.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FID = "coachella-2027";
const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = (process.env.VIEWPORTS || "390x844-light,320x568-dark").split(",").map(v => {
  const [, w, h, scheme] = v.match(/^(\d+)x(\d+)-(light|dark)$/) || [];
  if (!w) throw new Error(`bad viewport ${v}`); return { w: +w, h: +h, scheme };
});
const MOD = readFileSync(join(ROOT, "data/festivals/coachella-2027.js"), "utf8");
const OPEN = MOD.replace("registry: { available: false,", "registry: { available: true,");
if (OPEN === MOD) throw new Error("coachella-2027.js: the gated registry flag moved; update this gate's route");

const PORT = await new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(() => res(a.port)); }); });
const ORIGIN = `http://127.0.0.1:${PORT}`;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));

let checks = 0, failed = 0;
const ok = (c, m) => { checks++; if (!c) failed++; console.log(`  ${c ? "✓" : "✗"} ${m}`); };
const BASE_SEED = { onboarded: "v1", cloud_nudge_seen: "1", ft_guide_seen: "1", notif_nudge_dismissed: "1",
  plursky_recap_seen_v1: "1", plursky_display_name: "", plursky_lineup_view: "list" };
const fakeTime = /\b(1[0-2]|0?\d):[0-5]\d\s?(AM|PM)\b|\b\d{1,2}:\d{2}\b/;

async function context(browser, { w = 390, h = 844, scheme = "light", seed = {}, sw = false, mod = OPEN, offline = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1,
    serviceWorkers: sw ? "allow" : "block", colorScheme: scheme, reducedMotion: "reduce" });
  await wireVendor(ctx);
  await ctx.route(/\/data\/festivals\/coachella-2027\.js/, r =>
    offline && offline.on ? r.abort("internetdisconnected") : r.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: mod }));
  await ctx.addInitScript(([s, theme]) => {
    if (sessionStorage.getItem("__seeded")) return; sessionStorage.setItem("__seeded", "1");
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    if (theme) localStorage.setItem("plursky_theme", theme);
  }, [{ ...BASE_SEED, ...seed }, scheme]);
  return ctx;
}
async function boot(ctx, q, fid = FID) {
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(e.message));
  await p.goto(`${ORIGIN}/index.html${q ? "?" + q : ""}`, { waitUntil: "domcontentloaded" });
  if (fid) await p.waitForFunction(f => window.FESTIVAL_CONFIG?.id === f && document.querySelector("[data-lineup-scroll]"), fid, { timeout: 60000 });
  else await p.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, null, { timeout: 60000 });
  await p.waitForTimeout(1000); return p;
}
// Body text minus the device status line ("FRI · 07:06" is the clock, not a set time).
const txt = p => p.evaluate(() => document.body.innerText.replace(/^[A-Z]{3} · \d{2}:\d{2}$/gm, ""));
const noOverflow = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const shot = (p, tag, n) => SHOTS ? p.screenshot({ path: join(SHOTS, `${tag}-${n}.png`) }) : null;
async function search(p, term) {
  if (!(await p.$("[data-lineup-search] input"))) await p.click("[data-lineup-search-toggle]");
  await p.fill("[data-lineup-search] input", term); await p.waitForTimeout(350);
}
const save = async (p, name) => { await p.locator(`button[aria-label="Save ${name}"]`).first().click(); await p.waitForTimeout(250); };
const savedOf = (p, fid = FID) => p.evaluate(f => JSON.parse(localStorage.getItem(f + "_saved_v1") || "[]"), fid);
const rowNames = p => p.$$eval("[data-set-name]", els => els.map(e => e.textContent.trim()));
async function shareText(p) {
  await p.evaluate(() => { window.__shared = []; navigator.share = async d => { window.__shared.push(d); }; });
  await p.click("[data-share-lineup]"); await p.click('button:has-text("Share shortlist")'); await p.waitForTimeout(400);
  return p.evaluate(() => window.__shared[0]?.text || "");
}

// The CI runner has system Chrome only (no bundled headless shell): use it when present.
const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  // ── 1. The flow, per viewport ──────────────────────────────────────────────
  for (const { w, h, scheme } of VIEWPORTS) {
    const tag = `${w}x${h}-${scheme}`;
    console.log(`▸ flow ${tag}`);
    const ctx = await context(browser, { w, h, scheme, seed: { active_festival_id: FID, active_festival_explicit: "1", "edc-lv-2026_saved_v1": JSON.stringify(["k1"]) } });
    let p = await boot(ctx, `f=${FID}&tab=lineup`);
    await shot(p, tag, "01-ask");
    let t = await txt(p);
    ok(/Which weekend are you going\?/.test(t) && !(await p.$('[data-weekend][aria-selected="true"]')), `${tag}: asks which weekend, neither preselected`);
    ok(/Your shortlist is empty|Set times pending/.test(t) && !fakeTime.test(t), `${tag}: empty state is honest, no clock time on the lineup`);
    ok(await noOverflow(p), `${tag}: no horizontal overflow (asking)`);
    await p.click('[data-weekend="W2"]'); await p.waitForTimeout(450);
    t = await txt(p);
    ok(/SAT\s*17/.test(t) && /Apr 16–18/.test(t) && (await p.$('[data-weekend="W2"][aria-selected="true"]')), `${tag}: Weekend 2 picked, day chips read Apr 16-18`);
    await search(p, "tiesto"); ok(/Tiësto/.test(await txt(p)), `${tag}: 'tiesto' finds Tiësto (official spelling kept)`);
    await shot(p, tag, "02-search"); await save(p, "Tiësto");
    await search(p, "MANESKIN"); ok(/Måneskin/.test(await txt(p)), `${tag}: 'MANESKIN' finds Måneskin`); await save(p, "Måneskin");
    await search(p, "jakob"); ok(/Jakob Nowell and THE CASTLE/.test(await txt(p)), `${tag}: search reaches the day-pending act`); await save(p, "Jakob Nowell and THE CASTLE");
    await p.click('[data-lineup-search] button:has-text("Done")').catch(() => {});
    await p.waitForTimeout(250);
    await p.click('[data-lineup-show="saved"]'); await p.waitForTimeout(450);
    t = await txt(p);
    const rows = await rowNames(p);
    ok(rows.join("|") === "Måneskin|Tiësto|Jakob Nowell and THE CASTLE", `${tag}: Shortlist lists the 3 across days, day pending last (${rows.join("|")})`);
    ok(/Shortlist\s*3/.test(t), `${tag}: Shortlist chip counts 3`);
    ok(!fakeTime.test(t) && !/clash|NaN|undefined/i.test(t), `${tag}: no clock time, clash, NaN or undefined on the shortlist`);
    ok(/Calendar and My night open when set times are announced/.test(t), `${tag}: the timing doors say why they are closed`);
    ok(await noOverflow(p), `${tag}: no horizontal overflow (shortlist)`);
    await shot(p, tag, "03-shortlist");
    await p.evaluate(() => { window.__shared = []; navigator.share = async d => { window.__shared.push(d); }; });
    await p.click("[data-share-lineup]"); await p.waitForTimeout(200);
    const menuBox = await p.locator('button:has-text("Print schedule")').boundingBox();
    ok(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= w + 1, `${tag}: share menu fits the screen`);
    ok(await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /Print schedule/.test(x.textContent)); const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && b.contains(top); }), `${tag}: share menu paints above the list`);
    await shot(p, tag, "04-share-menu");
    await p.click('button:has-text("Share shortlist")'); await p.waitForTimeout(400);
    const shared = await p.evaluate(() => window.__shared[0]?.text || "");
    ok(/^My Coachella 2027 shortlist \(3 artists\)\nWeekend 2 · Apr 16–18, 2027\nSet times not announced/.test(shared), `${tag}: shared text names the festival, Weekend 2 + dates, set times not announced`);
    ok(/SAT · Apr 17\n  Måneskin\n  Tiësto/.test(shared) && /DAY TBA\n  Jakob Nowell and THE CASTLE/.test(shared) && !fakeTime.test(shared), `${tag}: shared text by day, day pending last, no clock time`);
    ok(/Shared/.test(await p.locator("[data-share-lineup]").innerText()), `${tag}: native share success reads Shared`);
    await p.waitForTimeout(2000);
    await p.evaluate(() => { navigator.share = async () => { const e = new Error("cancel"); e.name = "AbortError"; throw e; }; });
    await p.click("[data-share-lineup]"); await p.click('button:has-text("Share shortlist")'); await p.waitForTimeout(400);
    ok(!/Shared|Copied/.test(await p.locator("[data-share-lineup]").innerText()), `${tag}: a cancelled share is not a success`);
    await p.evaluate(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      window.__clip = null; Object.defineProperty(navigator, "clipboard", { value: { writeText: async s => { window.__clip = s; } }, configurable: true }); });
    await p.click("[data-share-lineup]"); await p.click('button:has-text("Share shortlist")'); await p.waitForTimeout(400);
    ok((await p.evaluate(() => window.__clip || "")).startsWith("My Coachella 2027 shortlist (3 artists)"), `${tag}: no share sheet copies the text`);
    ok(/Copied/.test(await p.locator("[data-share-lineup]").innerText()), `${tag}: copy fallback reads Copied`);
    await shot(p, tag, "05-copied");
    ok(p.errs.length === 0, `${tag}: no page errors (${p.errs.slice(0, 2).join(" / ")})`);
    await p.close(); p = await boot(ctx, "tab=lineup");
    ok(await p.evaluate(f => localStorage.getItem(f + "_weekend_v1"), FID) === "W2" && (await p.$('[data-weekend="W2"][aria-selected="true"]')), `${tag}: reload keeps Weekend 2`);
    ok(JSON.stringify(await savedOf(p)) === JSON.stringify(["coa27-tiesto", "coa27-maneskin", "coa27-jakob-nowell-and-the-castle"]), `${tag}: reload keeps the 3 saved ids`);
    ok(await p.evaluate(() => localStorage.getItem("edc-lv-2026_saved_v1")) === JSON.stringify(["k1"]), `${tag}: another festival's saves untouched`);
    await p.close(); await ctx.close();
  }

  // ── 2. Orphan ──────────────────────────────────────────────────────────────
  console.log("▸ orphan saved id");
  {
    const ctx = await context(browser, { seed: { active_festival_id: FID, active_festival_explicit: "1", [`${FID}_weekend_v1`]: "W1",
      [`${FID}_saved_v1`]: JSON.stringify(["coa27-tiesto", "coa27-retired-act"]) } });
    const p = await boot(ctx, `f=${FID}&tab=lineup`);
    await p.click('[data-lineup-show="saved"]'); await p.waitForTimeout(400);
    ok(/Shortlist\s*1\b/.test(await txt(p)) && (await rowNames(p)).join("|") === "Tiësto", "orphan: counted and listed as 1 (Tiësto only)");
    const s = await shareText(p);
    ok(/\(1 artist\)/.test(s) && !/retired/i.test(s), "orphan: never shared");
    await p.click('[data-lineup-show="saved"]').catch(() => {}); await p.waitForTimeout(250);
    await search(p, "maneskin"); await save(p, "Måneskin");
    const ids = await savedOf(p);
    ok(ids.includes("coa27-retired-act") && ids.includes("coa27-maneskin") && ids.includes("coa27-tiesto"), `orphan: kept in storage through a later save (${ids.join(",")})`);
    ok(p.errs.length === 0, `orphan: no page errors (${p.errs.slice(0, 2).join(" / ")})`);
    await ctx.close();
  }

  // ── 3. Weekend-specific fixture ────────────────────────────────────────────
  console.log("▸ weekend fixture (one act W1 only)");
  {
    const anchor = `mk("coa27-tiesto", "Tiësto", `;
    if (!OPEN.includes(anchor)) throw new Error("fixture anchor missing: Tiësto row");
    const mod = OPEN.replace(/^( {4})mk\("coa27-tiesto", "Tiësto", (\d)\),/m, `$1{ ...mk("coa27-tiesto", "Tiësto", $2), weekend: "W1" },`);
    if (mod === OPEN) throw new Error("fixture: could not tag Tiësto");
    const ctx = await context(browser, { mod, seed: { active_festival_id: FID, active_festival_explicit: "1",
      [`${FID}_saved_v1`]: JSON.stringify(["coa27-tiesto", "coa27-maneskin"]) } });
    const p = await boot(ctx, `f=${FID}&tab=lineup`);
    await p.click('[data-weekend="W2"]'); await p.waitForTimeout(400);
    await p.click('[data-lineup-show="saved"]'); await p.waitForTimeout(400);
    const rows = await rowNames(p);
    ok(rows.join("|") === "Måneskin", `fixture: W2 shortlist omits the W1-only act (${rows.join("|")})`);
    const s = await shareText(p);
    ok(/\(1 artist\)/.test(s) && !/Tiësto/.test(s) && /Weekend 2/.test(s), "fixture: W2 shared text omits it and counts 1");
    ok(p.errs.length === 0, `fixture: no page errors (${p.errs.slice(0, 2).join(" / ")})`);
    await ctx.close();
  }

  // ── 4. Deep link vs root ───────────────────────────────────────────────────
  console.log("▸ deep link vs root");
  {
    let ctx = await context(browser, { seed: { active_festival_id: "dreamstate-socal-2026", active_festival_explicit: "1" } });
    let p = await boot(ctx, "tab=lineup", "dreamstate-socal-2026");
    ok(true, "root keeps an existing explicit festival (Dreamstate)");
    await p.close();
    p = await boot(ctx, `f=${FID}&tab=lineup`);
    ok(await p.evaluate(() => window.FESTIVAL_CONFIG.id) === FID, "?f=coachella-2027 enters Coachella");
    await p.close(); await ctx.close();
    ctx = await context(browser);
    p = await boot(ctx, "", null);
    await p.waitForTimeout(800);
    ok(await p.evaluate(f => (window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id) !== f && localStorage.getItem("active_festival_id") !== f, FID), "a new visitor's root load is not Coachella");
    ok(p.errs.length === 0, `root: no page errors (${p.errs.slice(0, 2).join(" / ")})`);
    await ctx.close();
  }

  // ── 5. Regressions on festivals already open ───────────────────────────────
  console.log("▸ regressions");
  for (const [fid, tagged, untimed] of [["acl-2026", true, false], ["dreamstate-socal-2026", false, true], ["lights-all-night-2026", false, true]]) {
    const ctx = await context(browser, { seed: { active_festival_id: fid, active_festival_explicit: "1" } });
    const p = await boot(ctx, `f=${fid}&tab=lineup`, fid);
    const t = await txt(p);
    const rows = (await rowNames(p)).length;
    ok(rows > 0 && p.errs.length === 0 && await noOverflow(p), `${fid}: lineup renders ${rows} rows, no page error, no overflow (${p.errs.slice(0, 1).join("")})`);
    ok(!/Which weekend are you going\?/.test(t), `${fid}: never asks which weekend (not a both-weekends lineup)`);
    ok(tagged === !!(await p.$("[data-weekend]")), `${fid}: weekend tabs ${tagged ? "present" : "absent"}`);
    // The plan row (My night + Calendar, or the untimed note) shows once a save exists.
    await p.locator('button[aria-label^="Save "]').first().click(); await p.waitForTimeout(300);
    await p.click('[data-lineup-show="saved"]').catch(() => {}); await p.waitForTimeout(300);
    const chip = (await p.locator('[data-lineup-show="saved"]').first().innerText()).trim();
    ok(untimed ? !!(await p.$("[data-untimed-note]")) && /^Shortlist/.test(chip)
      : !(await p.$("[data-untimed-note]")) && /^My plan/.test(chip), `${fid}: ${untimed ? "shortlist row (no set times)" : "plan row (timed)"} (chip "${chip}")`);
    const tabs = await p.$$eval('[role="tablist"][aria-label="Festival day"] button', bs => bs.map(b => b.textContent.trim()));
    ok(tabs.length > 0 && !tabs.includes("TBA"), `${fid}: no pending-day TBA chip (${tabs.join(" | ")})`);
    await p.click("[data-share-lineup]").catch(() => {}); await p.waitForTimeout(250);
    ok(untimed ? !!(await p.$('button:has-text("Share shortlist")')) && !(await p.$('button:has-text("Image for stories")'))
      : !!(await p.$('button:has-text("Image for stories")')) && !(await p.$('button:has-text("Share shortlist")')), `${fid}: ${untimed ? "shortlist" : "timed"} share menu`);
    ok(!/NaN|undefined/.test(await txt(p)), `${fid}: no NaN or undefined text`);
    await ctx.close();
  }

  // ── 6. Offline ─────────────────────────────────────────────────────────────
  console.log("▸ offline");
  {
    const offline = { on: false };
    const ctx = await context(browser, { sw: true, offline, seed: { active_festival_id: FID, active_festival_explicit: "1", [`${FID}_weekend_v1`]: "W2",
      [`${FID}_saved_v1`]: JSON.stringify(["coa27-tiesto", "coa27-maneskin"]) } });
    let p = await boot(ctx, `f=${FID}&tab=lineup`);
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    await p.waitForFunction(async () => { const keys = await caches.keys(); for (const k of keys) { const c = await caches.open(k);
      if (await c.match(new Request(location.origin + "/data/festivals/coachella-2027.js"), { ignoreSearch: true })) return true; } return false; }, null, { timeout: 30000, polling: 500 });
    offline.on = true; await ctx.setOffline(true);
    await p.close(); p = await boot(ctx, "tab=lineup");
    await p.click('[data-lineup-show="saved"]'); await p.waitForTimeout(400);
    const rows = await rowNames(p);
    ok(rows.join("|") === "Måneskin|Tiësto" && /Apr 16–18/.test(await txt(p)), `warm offline: lineup + shortlist reopen with W2 (${rows.join("|")})`);
    ok(p.errs.length === 0, `warm offline: no page errors (${p.errs.slice(0, 2).join(" / ")})`);
    await ctx.close();
    const cold = await context(browser, { sw: true, offline: { on: true } });
    await cold.setOffline(true);
    const cp = await cold.newPage();
    let failedNav = false; try { await cp.goto(`${ORIGIN}/index.html?f=${FID}`, { timeout: 15000 }); } catch { failedNav = true; }
    ok(failedNav && !(await cp.evaluate(() => !!document.querySelector("[data-lineup-scroll]")).catch(() => false)), "cold offline first visit: no app loads, nothing claims a data pack");
    await cold.close();
  }
} catch (e) { ok(false, `harness: ${e.message.split("\n")[0]}`); }
finally { await browser.close(); server.kill(); }

if (failed) { console.log(`✗ coachella shortlist: ${failed}/${checks} failed`); process.exit(1); }
console.log(`  ✓ coachella shortlist: ${checks} checks (${VIEWPORTS.length} viewport flow, orphan, W1-only fixture, deep link vs root, ACL/Dreamstate/LAN regressions, warm + cold offline)`);
