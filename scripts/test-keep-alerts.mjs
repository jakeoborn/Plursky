#!/usr/bin/env node
// L5 Keep alerts, on the L3 fixture (III Points 2026, Friday night):
// Vintage Culture B2B Max Styler 02:00–04:00 and PAWSA 02:30–04:00, both saved,
// a real clash. Reminder lead 30 min. Clock 1:00 AM ET. Web path only: the
// Notification API is stubbed to record what fires.
//   default   saved-only: the reminder slate is the saved sets, no extra row;
//   schedule  Keep this (PAWSA) drops Vintage Culture; its row offers "Keep
//             alerts"; a tap keeps a reminder without saving it (no clash, no
//             banner) and it fires at T-30 (1:30); PAWSA's saved reminder
//             still fires at 2:00;
//   relaunch  the kept reminder survives a reload and still fires;
//   cancel    one tap on the bell cancels: nothing fires for it;
//   keepboth  Keep both leaves both saved with one reminder each and no
//             keep-alerts row; a kept entry for a set saved again is dropped.
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
const KEPT = `${FID}_alerts_kept_v1`, SAVED = `${FID}_saved_v1`;
const MIN = 60000;

let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const open = async (seed = {}) => {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 900 } });
    await wireVendor(ctx);
    await ctx.clock.install({ time: new Date(AT) });
    await ctx.addInitScript(([fid, ids, extra]) => {
      // Web notifications, granted, recorded (the pipeline under test is the
      // app's; only the OS surface is stubbed).
      window.__notes = JSON.parse(sessionStorage.getItem("__notes") || "[]");
      const rec = t => { window.__notes.push(t); sessionStorage.setItem("__notes", JSON.stringify(window.__notes)); };
      function N(title) { rec(title); }
      N.permission = "granted"; N.requestPermission = () => Promise.resolve("granted");
      window.Notification = N;
      try { Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve({ showNotification: t => { rec(t); return Promise.resolve(); } }) }); } catch {}
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("notif_nudge_dismissed", "1");
      localStorage.setItem("plursky_reminder_lead_min", "30");
      localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(ids));
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    }, [FID, [VC, PW], seed]);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const boot = async () => {
      await page.goto(URL, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
      await page.clock.runFor(1200);
      await page.locator('[aria-label="Follow your night: open my night"]').first().click({ timeout: 20000 });
      await page.clock.runFor(600); await page.waitForTimeout(300);
    };
    const read = () => page.evaluate(([vc, pw, fid]) => {
      const ls = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
      const va = ARTISTS.find(a => a.id === vc), pa = ARTISTS.find(a => a.id === pw);
      const saved = ls(`${fid}_saved_v1`) || [];
      return {
        saved, kept: ls(`${fid}_alerts_kept_v1`) || [],
        slate: (ls("reminders_v1") || []).map(r => r.id),
        offer: document.querySelectorAll(`[data-keep-alerts="${vc}"]`).length,
        bell: document.querySelectorAll(`[data-alerts-kept="${vc}"]`).length,
        list: document.querySelectorAll("[data-keep-alerts-list]").length,
        banner: document.querySelector("[data-plan-banner]")?.innerText || "",
        planRows: [...document.querySelectorAll("[data-plan-row]")].map(e => e.getAttribute("data-plan-row")),
        clash: setsClash(va, pa),
        inApp: computeAlerts(saved, 1, "01:35").map(a => a.id),
        notes: window.__notes.slice(),
        vcName: va.name, pwName: pa.name,
      };
    }, [VC, PW, FID]);
    const keepThis = async name => {
      await page.locator("button", { hasText: /^Resolve$/ }).first().click(); await page.clock.runFor(300);
      const row = page.locator('[aria-label="Schedule clash"] > div').filter({ hasText: name });
      await row.locator("button", { hasText: /^Keep this$/ }).click(); await page.clock.runFor(500); await page.waitForTimeout(200);
    };
    return { ctx, page, errors, boot, read, keepThis };
  };
  const names = async page => page.evaluate(([vc, pw]) => [ARTISTS.find(a => a.id === vc).name, ARTISTS.find(a => a.id === pw).name], [VC, PW]);
  const fired = (r, name) => r.notes.filter(t => t.startsWith(name)).length;
  // A missing control is a failed check, not a harness abort, so every
  // scenario still reports.
  const tap = async (page, sel, what) => {
    const n = await page.locator(sel).count();
    check(n === 1, `${what}: control present (${n})`);
    if (n) { await page.locator(sel).first().click(); await page.clock.runFor(400); await page.waitForTimeout(150); }
  };

  // ── default + schedule + relaunch ──
  {
    const s = await open(); await s.boot();
    const [vcName, pwName] = await names(s.page);
    let r = await s.read();
    check(r.clash && /^1 clash$/.test(r.banner), `fixture: the saved pair clashes (banner "${r.banner}")`);
    check(r.slate.length === 2 && r.slate.includes(VC) && r.slate.includes(PW), `default: the reminder slate is the two saved sets (got ${JSON.stringify(r.slate)})`);
    check(r.list === 0 && r.kept.length === 0, "default: no keep-alerts row and nothing kept before a clash is resolved");

    await s.keepThis(pwName);
    r = await s.read();
    check(JSON.stringify(r.saved) === JSON.stringify([PW]), `Keep this PAWSA drops Vintage Culture from saved (got ${JSON.stringify(r.saved)})`);
    check(r.offer === 1 && r.bell === 0, `the dropped set's row offers "Keep alerts" (offer ${r.offer}, bell ${r.bell})`);
    check(!r.slate.includes(VC) && r.slate.includes(PW), `before Keep alerts the dropped set has no reminder (slate ${JSON.stringify(r.slate)})`);

    await tap(s.page, `[data-keep-alerts="${VC}"]`, "Keep alerts");
    r = await s.read();
    check(r.bell === 1 && r.offer === 0, `after Keep alerts the row shows only the bell (bell ${r.bell}, offer ${r.offer})`);
    check(JSON.stringify(r.kept) === JSON.stringify([VC]), `kept list is [Vintage Culture] (got ${JSON.stringify(r.kept)})`);
    check(JSON.stringify(r.saved) === JSON.stringify([PW]), `keeping alerts is not a save (saved ${JSON.stringify(r.saved)})`);
    check(!r.planRows.includes(VC), "the alerts-only set is not a plan row");
    check(!/clash/i.test(r.banner), `keeping alerts never re-adds a clash (banner "${r.banner}")`);
    check(r.slate.includes(VC) && r.slate.includes(PW) && r.slate.length === 2, `reminder slate = PAWSA (saved) + Vintage Culture (kept) (got ${JSON.stringify(r.slate)})`);
    check(r.inApp.includes(`remind_${VC}`) && !r.inApp.some(id => id.startsWith("conflict_")), `in-app alerts at 1:35 carry remind_${VC} and no conflict (got ${JSON.stringify(r.inApp)})`);

    // relaunch: the kept reminder survives a reload.
    await s.boot();
    r = await s.read();
    check(r.bell === 1 && JSON.stringify(r.kept) === JSON.stringify([VC]), `after a reload the bell row is still there (bell ${r.bell}, kept ${JSON.stringify(r.kept)})`);
    check(r.slate.includes(VC), `after a reload the reminder is still on the slate (${JSON.stringify(r.slate)})`);

    // fires at T-30 (1:30 for 2:00); PAWSA (2:30) not yet.
    await s.page.clock.runFor(31 * MIN); await s.page.waitForTimeout(200);
    r = await s.read();
    check(fired(r, vcName) === 1, `Vintage Culture's reminder fired once at T-30 (notes ${JSON.stringify(r.notes)})`);
    check(fired(r, pwName) === 0, "PAWSA's has not fired before its own T-30");
    await s.page.clock.runFor(30 * MIN); await s.page.waitForTimeout(200);
    r = await s.read();
    check(fired(r, pwName) === 1, `saved-set reminder untouched: PAWSA fired at its T-30 (notes ${JSON.stringify(r.notes)})`);
    check(fired(r, vcName) === 1, "Vintage Culture did not fire twice");
    check(s.errors.length === 0, `no page errors (${s.errors.slice(0, 2).join(" | ")})`);
    await s.ctx.close();
  }

  // ── cancel ──
  {
    const s = await open(); await s.boot();
    const [vcName, pwName] = await names(s.page);
    await s.keepThis(pwName);
    await tap(s.page, `[data-keep-alerts="${VC}"]`, "Keep alerts");
    await tap(s.page, `[data-alerts-kept="${VC}"]`, "bell (cancel)");
    let r = await s.read();
    check(r.kept.length === 0 && r.bell === 0 && r.offer === 1, `one tap on the bell cancels (kept ${JSON.stringify(r.kept)}, bell ${r.bell}, offer back ${r.offer})`);
    check(!r.slate.includes(VC) && r.slate.includes(PW), `cancelled reminder leaves the slate; PAWSA stays (${JSON.stringify(r.slate)})`);
    check(!r.inApp.includes(`remind_${VC}`), "cancelled: no in-app reminder either");
    await s.page.clock.runFor(31 * MIN); await s.page.waitForTimeout(200);
    r = await s.read();
    check(fired(r, vcName) === 0, `cancelled reminder never fires (notes ${JSON.stringify(r.notes)})`);
    await s.ctx.close();
  }

  // ── keep both ──
  {
    const s = await open({ [KEPT]: JSON.stringify([VC]) }); await s.boot();
    let r = await s.read();
    check(r.kept.length === 0, `a kept entry for a set that is saved is dropped (kept ${JSON.stringify(r.kept)})`);
    await s.page.locator("button", { hasText: /^Resolve$/ }).first().click(); await s.page.clock.runFor(300);
    await s.page.locator("button", { hasText: /^Keep both$/ }).first().click(); await s.page.clock.runFor(400); await s.page.waitForTimeout(150);
    r = await s.read();
    check(!r.clash && r.banner === "", `Keep both: no clash, no banner (banner "${r.banner}")`);
    check(r.list === 0, "Keep both: no keep-alerts row (both sets stay saved)");
    check(r.slate.length === 2 && new Set(r.slate).size === 2 && r.slate.includes(VC) && r.slate.includes(PW), `Keep both: one reminder per saved set (${JSON.stringify(r.slate)})`);
    check(r.saved.length === 2, "Keep both: both sets stay saved");
    await s.ctx.close();
  }
} catch (e) {
  failed++; console.log(`  ✗  harness: ${e.message.split("\n")[0]}`);
} finally {
  try { await browser?.close(); } catch {}
  server.kill();
}
console.log(`  ${failed ? "✗" : "✓"}  keep alerts: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
