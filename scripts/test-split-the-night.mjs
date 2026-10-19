#!/usr/bin/env node
// L3 (Oct 16 spec), Jake's exact case on III Points 2026, Friday night:
// Vintage Culture B2B Max Styler 02:00–04:00 (Isotropic) and PAWSA 02:30–04:00
// (Mind Melt) are both saved — a real 2:30–4:00 overlap. Rendered in the app:
//   banner   a full overlap reads "1 clash", never "tight transition" (the
//            old banner counted conflicts as tight transitions);
//   split    Resolve → Split the night → switch 3:00 → Split here clears the
//            clash on both rows, the banner, the alert and the Lineup day chip,
//            and the rows say "2:00 AM → you leave 3:00 AM" / "You arrive 3:00 AM";
//   persist  a reload keeps the split;
//   reset    Reset restores both whole sets and the clash comes back;
//   keepboth Keep both dismisses the banner; rows read "overlap accepted", no red.
// Controls: the same steps on a pair that does NOT overlap change nothing.
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
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "iii-points-2026", AT = "2026-10-17T05:00:00Z";          // Fri night, 1:00 AM ET
const VC = "iiip-max-styler-b2b-vintage-cul", PW = "iiip-pawsa";
const URL = `http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`;

try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 900 } });
  await wireVendor(ctx);
  await ctx.clock.install({ time: new Date(AT) });
  // Seed once (not on every load): the reload step must read what the app wrote.
  await ctx.addInitScript(([fid, ids]) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(ids));
  }, [FID, [VC, PW]]);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  const boot = async () => {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    await page.clock.runFor(1200);
  };
  const openNight = async () => {
    const b = page.locator('[aria-label="Follow your night: open my night"]');
    await b.first().click({ timeout: 20000 }); await page.clock.runFor(600); await page.waitForTimeout(300);
  };
  const read = () => page.evaluate(([vc, pw]) => {
    const t = document.body.innerText;
    const row = id => document.querySelector(`[data-attend-window="${id}"]`)?.innerText || "";
    const pa = ARTISTS.find(a => a.id === pw), va = ARTISTS.find(a => a.id === vc);
    return {
      banner: document.querySelector("[data-plan-banner]")?.innerText || "",
      tightWord: /tight transition/i.test(document.querySelector("[data-plan-banner]")?.innerText || ""),
      clashWord: (t.match(/· clash/g) || []).length,
      accepted: document.querySelectorAll("[data-overlap-accepted]").length,
      vcRow: row(vc), pwRow: row(pw),
      pred: { clash: setsClash(va, pa), acc: setsOverlapAccepted(va, pa) },
      alerts: computeAlerts([vc, pw], 1, "01:00").filter(x => x.kind === "conflict").length,
    };
  }, [VC, PW]);

  await boot(); await openNight();
  let r = await read();
  check(r.pred.clash, "fixture: the two saved sets clash (2:30–4:00 overlap)");
  check(/^1 clash$/.test(r.banner) && !r.tightWord, `banner says "1 clash", not tight transitions (got "${r.banner}")`);
  check(r.alerts === 1, `one conflict alert before the split (got ${r.alerts})`);

  // Split at 3:00 through the UI.
  await page.locator("button", { hasText: /^Resolve$/ }).first().click(); await page.clock.runFor(300);
  await page.locator("button", { hasText: /^Split the night$/ }).first().click(); await page.clock.runFor(300);
  const sheet = await page.locator("[data-split-sheet]").count();
  check(sheet === 1, "Split the night opens the split picker (it used to jump to the Map)");
  const preview0 = await page.locator("[data-split-time]").first().innerText().catch(() => "");
  check(/2:30/.test(preview0), `default switch is the later set's start, 2:30 (got "${preview0}")`);
  await page.locator("#split-switch").evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }, 27 * 60);
  await page.clock.runFor(200);
  const prev = await page.locator("[data-split-preview]").innerText();
  check(/2:00 AM–3:00 AM/.test(prev) && /3:00 AM–4:00 AM/.test(prev), `live preview shows the split before confirm (${prev.replace(/\n/g, " | ")})`);
  await page.locator("[data-split-confirm]").click(); await page.clock.runFor(500); await page.waitForTimeout(200);
  r = await read();
  check(!r.pred.clash && r.clashWord === 0, `after the split there is no clash (predicate ${r.pred.clash}, "· clash" ×${r.clashWord})`);
  // The row leads with when you arrive, the time its countdown counts to.
  const lead = await page.evaluate(pw => { const row = document.querySelector(`[data-attend-window="${pw}"]`); let el = row; while (el && !el.querySelector(".duo-data")) el = el.parentElement; return el?.querySelector(".duo-data")?.textContent.trim() || ""; }, PW);
  check(lead === "3:00 AM", `after the split PAWSA's row leads with its arrival, 3:00 AM (got "${lead}")`);
  check(!/clash/i.test(r.banner), `the banner no longer counts a clash (got "${r.banner}")`);
  check(r.alerts === 0, `no conflict alert after the split (got ${r.alerts})`);
  check(/2:00 AM → you leave 3:00 AM/.test(r.vcRow), `Vintage Culture row: "2:00 AM → you leave 3:00 AM" (got "${r.vcRow}")`);
  check(/You arrive 3:00 AM/.test(r.pwRow), `PAWSA row: "You arrive 3:00 AM" (got "${r.pwRow}")`);

  // Lineup's day chip counts no clash either.
  const chipClash = await page.evaluate(() => {
    let n = 0; const s = ARTISTS.filter(a => a.day === 1 && ["iiip-max-styler-b2b-vintage-cul", "iiip-pawsa"].includes(a.id));
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) if (setsClash(s[i], s[j])) n++;
    return n;
  });
  check(chipClash === 0, `Lineup's clash count for the day is 0 (got ${chipClash})`);

  // Persistence across a reload.
  await boot(); await openNight();
  r = await read();
  check(!r.pred.clash && /you leave 3:00 AM/.test(r.vcRow) && /You arrive 3:00 AM/.test(r.pwRow), "the split survives a reload");

  // A half-split never outlives its partner: with Vintage Culture no longer
  // saved, PAWSA reads as its whole set again (any removal path).
  const orphan = await page.evaluate(([fid, vc, pw]) => {
    const k = `${fid}_saved_v1`, keep = localStorage.getItem(k);
    localStorage.setItem(k, JSON.stringify([pw]));
    const w = attendWindow(ARTISTS.find(a => a.id === pw));
    localStorage.setItem(k, keep);
    return { partial: w.partial, back: attendWindow(ARTISTS.find(a => a.id === pw)).partial };
  }, [FID, VC, PW]);
  check(!orphan.partial && orphan.back, `unsaving one half drops the other half's window (partial ${orphan.partial}; restored ${orphan.back})`);

  // Reset restores the whole sets and the clash.
  await page.locator(`[data-attend-window="${VC}"] [data-attend-reset]`).click(); await page.clock.runFor(400);
  r = await read();
  check(r.pred.clash && r.vcRow === "" && r.pwRow === "" && /^1 clash$/.test(r.banner), `Reset restores both sets and the clash (clash ${r.pred.clash}, banner "${r.banner}")`);

  // Keep both: accepted, no alarm.
  await page.locator("button", { hasText: /^Resolve$/ }).first().click(); await page.clock.runFor(300);
  await page.locator("button", { hasText: /^Keep both$/ }).first().click(); await page.clock.runFor(400);
  r = await read();
  check(!r.pred.clash && r.pred.acc, "Keep both: the pair is accepted, not a clash");
  check(r.banner === "" && r.clashWord === 0 && r.accepted >= 1, `Keep both: no banner, no red, "overlap accepted" on the row (banner "${r.banner}", accepted ×${r.accepted})`);
  check(r.alerts === 0, `Keep both: no conflict alert (got ${r.alerts})`);

  // Control: two sets that do not overlap never clash, before or after.
  const ctl = await page.evaluate(() => {
    const day1 = ARTISTS.filter(a => a.day === 1 && a.start && a.end && a.stage === "mind-melt").sort((x, y) => toNightMin(x.start) - toNightMin(y.start));
    const [x, y] = day1; return x && y ? { clash: setsClash(x, y), raw: overlaps(x, y) } : null;
  });
  check(ctl && !ctl.raw && !ctl.clash, "control: back-to-back sets on one stage are not a clash");
  check(!errors.length, `no page errors (${errors.slice(0, 2).join(" | ")})`);
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`✗ split the night: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ split the night: ${checks} checks (split clears the clash everywhere, persists, resets; keep-both accepts; banner counts clashes)`);
