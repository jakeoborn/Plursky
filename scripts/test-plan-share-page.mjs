#!/usr/bin/env node
// plan.html, the public page behind a plan-share link (#74 stage 2). Served
// locally with get_public_share stubbed at the network layer (no real
// Supabase call), it must:
//   - render exactly the payload's sets, grouped by festival night in the
//     festival's own time zone, with the opt-in name in the title;
//   - show one indistinguishable "ended" state for a revoked, expired,
//     malformed or tampered share, and never ask the backend for a bad token;
//   - never render a field the contract would not have built;
//   - carry the App Store CTA with its campaign token.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });

const TOK = "Q".repeat(20) + "-" + "z".repeat(22);
const NOW = "2026-10-05T18:00:00Z";
const PAYLOAD = {
  schemaVersion: 1, kind: "schedule", festivalId: "acl-2026", expiresAt: "2026-10-19T03:00:00.000Z",
  festivalName: "ACL 2026", tz: "America/Chicago", displayName: "Sam",
  sets: [
    // Fri Oct 9 1:00 PM CDT, and a Friday-night set that runs past midnight.
    { id: "af02", artist: "Happy Landing", stage: "Tito's Stage", startsAt: "2026-10-09T18:00:00.000Z", endsAt: "2026-10-09T18:45:00.000Z" },
    { id: "af99", artist: "Late Act", stage: "Honda Stage", startsAt: "2026-10-10T05:30:00.000Z", endsAt: "2026-10-10T06:30:00.000Z" },
    { id: "af05", artist: "Jesse Welles", stage: "Miller Lite", startsAt: "2026-10-10T21:15:00.000Z", endsAt: "2026-10-10T22:15:00.000Z" },
  ],
};
const row = (over = {}) => ({ kind: "schedule", festival_id: "acl-2026", payload: PAYLOAD, display_name: "Sam", expires_at: "2026-10-19T03:00:00+00:00", ...over });

try {
  await serverReady(`http://127.0.0.1:${PORT}/plan.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const open = async (token, reply) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 844 }, serviceWorkers: "block" });
    await wireVendor(ctx);
    await ctx.clock.install({ time: new Date(NOW) });
    const calls = [];
    await ctx.route(/\/rest\/v1\/rpc\/get_public_share/, async route => {
      calls.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: "" }));
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/plan.html?t=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-plan-title], [data-plan-ended]", { timeout: 30000 });
    return { ctx, page, calls };
  };

  { // a live share
    const { ctx, page, calls } = await open(TOK, [row()]);
    check(calls.length === 1 && calls[0].p_token === TOK, `live: one get_public_share call with the token (${JSON.stringify(calls)})`);
    check((await page.$eval("[data-plan-title]", e => e.textContent)) === "Sam’s ACL 2026 plan", "live: the title carries the opt-in name and festival");
    const ids = await page.$$eval("[data-plan-set]", els => els.map(e => e.getAttribute("data-plan-set")));
    check(JSON.stringify(ids) === JSON.stringify(["af02", "af99", "af05"]), `live: exactly the payload's sets, in time order (${JSON.stringify(ids)})`);
    const days = await page.$$eval("[data-plan-day]", els => els.map(e => [e.getAttribute("data-plan-day"), e.querySelectorAll("[data-plan-set]").length, e.querySelector(".eyebrow").textContent]));
    check(JSON.stringify(days) === JSON.stringify([["2026-10-09", 2, "Friday · Oct 9"], ["2026-10-10", 1, "Saturday · Oct 10"]]), `live: nights in the festival's zone, an after-midnight set stays on its night (${JSON.stringify(days)})`);
    const t = await page.$eval("[data-plan-set='af02'] .t", e => e.textContent);
    check(t === "1:00 PM\n– 1:45 PM", `live: times read in festival time (${JSON.stringify(t)})`);
    check((await page.$eval("[data-plan-cta]", e => e.href)) === "https://apps.apple.com/us/app/plursky-live/id6768888507?ct=plan-share", "live: the App Store CTA carries the plan-share campaign");
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "live: no horizontal overflow at 393");
    if (process.env.PLAN_SHARE_SHOTS) await page.screenshot({ path: join(process.env.PLAN_SHARE_SHOTS, "plan-page-393.png"), fullPage: true });
    await ctx.close();
  }
  const endedFor = async (label, token, reply, wantCalls) => {
    const { ctx, page, calls } = await open(token, reply);
    check(await page.$("[data-plan-ended]") !== null && await page.$("[data-plan-set]") === null, `${label}: shows the ended state and no sets`);
    check(/This plan link has ended/.test(await page.textContent("[data-plan-ended]")), `${label}: one indistinguishable ended message`);
    if (wantCalls != null) check(calls.length === wantCalls, `${label}: ${wantCalls} backend call(s) (got ${calls.length})`);
    await ctx.close();
  };
  await endedFor("revoked/unknown (no row)", TOK, [], 1);
  await endedFor("expired row", TOK, [row({ expires_at: "2026-10-01T00:00:00+00:00" })], 1);
  await endedFor("malformed token", "short", [row()], 0);
  await endedFor("row/payload festival mismatch", TOK, [row({ festival_id: "edc-lv-2026" })], 1);
  await endedFor("tampered payload (markup in a name)", TOK, [row({ payload: { ...PAYLOAD, sets: [{ ...PAYLOAD.sets[0], artist: "<img src=x onerror=alert(1)>" }] } })], 1);
  { // extra stored fields never render
    const tampered = { ...PAYLOAD, notes: "PRIVATE NOTE", sets: PAYLOAD.sets.map(s => ({ ...s, lat: 30.2672, notes: "PRIVATE NOTE" })) };
    const { ctx, page } = await open(TOK, [row({ payload: tampered })]);
    const text = await page.textContent("body");
    check(!/PRIVATE NOTE|30\.2672/.test(text), "extra stored fields (notes, coordinates) never render");
    check((await page.$$("[data-plan-set]")).length === 3, "extra stored fields: the allowlisted sets still render");
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }

if (failed) { console.log(`✗ plan page: ${failed}/${checks} checks failed`); process.exit(1); }
console.log(`✓ plan page: ${checks} checks (exact sets by festival night, one ended state, allowlist re-projection, campaign CTA)`);
