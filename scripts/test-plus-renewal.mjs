#!/usr/bin/env node
// test-plus-renewal.mjs: the save and cancel states of an ACTIVE Plursky+
// subscription (SPEC-212 W4) on the real compiled app, with a mocked
// Capacitor bridge standing in for RevenueCat's CustomerInfo.
//
// It proves:
//   1. The state, on fixture receipts: no entitlement, Season Pass, Monthly
//      renewing, Monthly cancelled (renewal off), a billing issue, Annual,
//      an unknown product, a missing willRenew. Only a subscription gets
//      renewal words; nothing invents a date the store did not return.
//   2. The words: renewing names the store's date; ending is the save
//      message (when it stops and how to turn renewal back on); billing says
//      to update the payment method. No price in any of them.
//   3. In the app: the Me row shows each state from the bridge's receipt,
//      the button is a link to Apple's own subscription page (nothing in the
//      app cancels or blocks cancelling), the save view is logged once with
//      its state, and the stored snapshot holds only state, date and plan.
//      A lapse clears it and the row goes back to the paywall entry.
//   4. Layout: 393 and 320, default and 200% text, nothing past the edge and
//      the button at least 44 px tall.
//   5. Mutations: each rule nudged in the compiled source must fail a check.
//
//   PLURSKY_RENEWAL_SHOTS=<dir> node scripts/test-plus-renewal.mjs
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = process.cwd();
const SHOTS = process.env.PLURSKY_RENEWAL_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SPOTIFY = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

const MONTHLY = "plursky_plus_monthly", ANNUAL = "plursky_plus_annual", SEASON = "plursky_season_pass_2026";
const NOW = Date.UTC(2026, 10, 18, 18);
const DAY = 86400000;
const iso = ms => new Date(ms).toISOString();
const ENDS = NOW + 12 * DAY;   // Nov 30 2026
const ent = (o) => ({ entitlements: { active: { plus: { identifier: "plus", isActive: true, ...o } } } });
const FIX = {
  none:     { entitlements: { active: {} } },
  season:   ent({ productIdentifier: SEASON, expirationDate: null, willRenew: false }),
  renewing: ent({ productIdentifier: MONTHLY, expirationDate: iso(ENDS), willRenew: true }),
  ending:   ent({ productIdentifier: MONTHLY, expirationDate: iso(ENDS), willRenew: false, unsubscribeDetectedAt: iso(NOW - DAY) }),
  billing:  ent({ productIdentifier: MONTHLY, expirationDate: iso(ENDS), willRenew: true, billingIssueDetectedAt: iso(NOW - DAY) }),
  annual:   ent({ productIdentifier: ANNUAL, expirationDate: iso(ENDS), willRenew: true }),
  unknown:  ent({ productIdentifier: "plursky_mystery", expirationDate: iso(ENDS), willRenew: false }),
  noRenew:  ent({ productIdentifier: MONTHLY, expirationDate: iso(ENDS) }),
};

// Runs in the page before any app script: RevenueCat answers with the
// fixture; a later push (the update listener) can swap it.
function installBridge(customer) {
  let listener = null;
  window.__rcPush = c => listener && listener(c);
  const Purchases = {
    configure: async () => ({}),
    getAppUserID: async () => ({ appUserID: "$RCAnonymousID:test" }),
    getCustomerInfo: async () => ({ customerInfo: customer }),
    addCustomerInfoUpdateListener: async cb => { listener = cb; return "listener"; },
    getOfferings: async () => ({ current: null, all: {} }),
    restorePurchases: async () => ({ customerInfo: customer }),
  };
  const stub = new Proxy({}, { get: (_, k) => k === "then" ? undefined : async () => ({ remove() {} }) });
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: n => n === "Purchases",
    Plugins: new Proxy({ Purchases }, { get: (t, k) => t[k] || stub }) };
}

const PORT = await port();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
let browser;

async function runAll(spotifySrc, { shots = false } = {}) {
  const fails = [];
  let checks = 0;
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
  const open = async (customer, { width = 393 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: shots ? 3 : 1, timezoneId: "America/Chicago", serviceWorkers: "block" });
    if (spotifySrc !== SPOTIFY) await ctx.route(/\/build\/spotify\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: spotifySrc }));
    await ctx.addInitScript(`(${installBridge.toString()})(${JSON.stringify(customer)})`);
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
      localStorage.setItem("active_festival_id", "edc-lv-2026"); localStorage.setItem("active_festival_explicit", "1");
      localStorage.setItem("cloud_nudge_seen", "1");
    });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(NOW));
    const errors = []; page.on("pageerror", e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/?tab=me`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => typeof plusRenewalState === "function" && typeof MeScreen === "function", null, { timeout: 30000 });
    await sleep(700);   // RevenueCat answers after the first paint
    return { ctx, page, errors };
  };

  // ── 1+2. Pure rules, in the page ──
  {
    const { ctx, page } = await open(FIX.none);
    const r = await page.evaluate(F => Object.fromEntries(Object.entries(F).map(([k, v]) => {
      const s = plusRenewalState(v); return [k, { s, c: plusRenewalCopy(s) }];
    })), FIX);
    ok(r.none.s === null, `no entitlement has no renewal state (${JSON.stringify(r.none.s)})`);
    ok(r.season.s && r.season.s.state === "lasting" && r.season.c.line === "Active · thank you" && !r.season.c.cta, `the Season Pass gets no renewal words (${JSON.stringify(r.season)})`);
    ok(r.renewing.s && r.renewing.s.state === "renewing" && r.renewing.s.untilMs === ENDS, `Monthly renewing (${JSON.stringify(r.renewing.s)})`);
    ok(r.renewing.c.line === "Monthly · renews Nov 30" && !r.renewing.c.note && r.renewing.c.cta === "Manage", `renewing words (${JSON.stringify(r.renewing.c)})`);
    ok(r.ending.s && r.ending.s.state === "ending", `cancelled Monthly is ending (${JSON.stringify(r.ending.s)})`);
    ok(r.ending.c.line === "Monthly · ends Nov 30" && /stops on Nov 30/.test(r.ending.c.note || "") && /turn renewal back on/.test(r.ending.c.note || "") && r.ending.c.cta === "Keep Plursky+",
      `the save message says when it stops and how to keep it (${JSON.stringify(r.ending.c)})`);
    ok(r.billing.s && r.billing.s.state === "billing", `a billing issue wins over willRenew (${JSON.stringify(r.billing.s)})`);
    ok(/payment issue/.test(r.billing.c.line) && /Update your payment method/.test(r.billing.c.note || "") && r.billing.c.cta === "Update payment", `billing words (${JSON.stringify(r.billing.c)})`);
    ok(r.annual.s && r.annual.s.state === "renewing" && r.annual.c.line === "Annual · renews Nov 30", `Annual renewing (${JSON.stringify(r.annual.c)})`);
    ok(r.unknown.s && r.unknown.s.state === "lasting", `an unknown product gets no renewal words (${JSON.stringify(r.unknown.s)})`);
    ok(r.noRenew.s && r.noRenew.s.state === "lasting", `a missing willRenew is not read as cancelled (${JSON.stringify(r.noRenew.s)})`);
    const words = JSON.stringify(Object.values(r).map(x => x.c));
    ok(!/[$€£¥]|\d+\.\d\d/.test(words), `no price in any state's words (${words})`);
    await ctx.close();
  }

  // ── 3+4. In the app ──
  for (const k of ["renewing", "ending", "billing", "season"]) {
    const { ctx, page, errors } = await open(FIX[k]);
    const row = page.locator("[data-plus-active]");
    ok(await row.count() === 1, `${k}: the active row is not shown`);
    if (await row.count() !== 1) { await ctx.close(); continue; }
    const want = k === "season" ? "lasting" : k;
    ok(await row.getAttribute("data-plus-active") === want, `${k}: row state is ${await row.getAttribute("data-plus-active")}`);
    const link = page.locator("[data-plus-manage]");
    if (k === "season") ok(await link.count() === 0, "the Season Pass row has a manage button");
    else {
      ok(await link.count() === 1 && await link.getAttribute("href") === "https://apps.apple.com/account/subscriptions", `${k}: the button is not a link to Apple's subscription page`);
      ok(await link.getAttribute("target") === "_blank", `${k}: the link opens inside the app`);
    }
    const snap = await page.evaluate(() => JSON.parse(localStorage.getItem("plursky_plus_renewal_v1") || "null"));
    ok(snap && Object.keys(snap).sort().join(",") === "plan,state,untilMs", `${k}: the stored snapshot holds more than state, date and plan (${JSON.stringify(snap)})`);
    const ev = JSON.parse(await page.evaluate(() => localStorage.getItem("plursky_plus_events") || "[]")).filter(e => e.name === "plus_save_view");
    if (k === "ending" || k === "billing") ok(ev.length === 1 && ev[0].trigger === k, `${k}: plus_save_view not logged once with its state (${JSON.stringify(ev)})`);
    else ok(ev.length === 0, `${k}: a save view logged without a save message`);
    ok(!errors.length, `${k}: page errors: ${errors.join(" | ")}`);
    if (k === "ending") {
      // Renewal turned back on, pushed by RevenueCat: the save message goes.
      await page.evaluate(c => window.__rcPush(c), FIX.renewing); await sleep(300);
      ok(await row.getAttribute("data-plus-active") === "renewing" && await page.locator("[data-plus-save-note]").count() === 0, "renewal back on: the save message stays");
      // Lapsed: the snapshot clears and the row is the paywall entry again.
      await page.evaluate(c => window.__rcPush(c), FIX.none); await sleep(300);
      ok(await page.evaluate(() => localStorage.getItem("plursky_plus_renewal_v1")) === null, "a lapse leaves the renewal snapshot behind");
      ok(await page.locator("[data-plus-active]").count() === 0, "a lapse leaves the active row up");
    }
    await ctx.close();
  }
  for (const k of ["renewing", "ending", "billing"]) for (const w of [393, 320]) for (const big of [false, true]) {
    if (!shots && !(k === "ending")) continue;   // the save state carries the most text; the rest only for pixels
    const { ctx, page } = await open(FIX[k], { width: w });
    if (big) await page.evaluate(() => {
      const els = [...document.body.querySelectorAll("*")]; const sz = els.map(e => parseFloat(getComputedStyle(e).fontSize));
      els.forEach((e, i) => { if (sz[i]) e.style.setProperty("font-size", (sz[i] * 2) + "px", "important"); });
    });
    await sleep(300);
    const row = page.locator("[data-plus-active]");
    await row.scrollIntoViewIfNeeded().catch(() => {}); await sleep(200);
    const over = await page.evaluate(w => [...document.querySelectorAll("[data-plus-active], [data-plus-active] *")].map(e => e.getBoundingClientRect()).filter(r => r.width && (r.right > w + 0.5 || r.left < -0.5)).length, w);
    ok(over === 0, `${k} @${w}${big ? " 200%" : ""}: ${over} element(s) of the row run past the screen`);
    const h = await page.locator("[data-plus-manage]").evaluate(e => e.getBoundingClientRect().height).catch(() => 0);
    ok(h >= 44, `${k} @${w}${big ? " 200%" : ""}: the button is ${h}px tall`);
    if (shots) await row.screenshot({ path: join(SHOTS, `plus-${k}-${w}${big ? "-200" : ""}.png`) });
    await ctx.close();
  }
  return { checks, fails };
}

let failed = 0;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const base = await runAll(SPOTIFY, { shots: !!SHOTS });
  for (const f of base.fails) console.log(`  ✗  ${f}`);
  failed += base.fails.length;

  // ── 5. Mutations ──
  const MUT = [
    ["if (ent.willRenew === false) return {", "if (false) return {"],                                              // a cancel reads as renewing
    ["if (!plan || !Number.isFinite(until)) return {", "if (!Number.isFinite(until)) return {"],                    // the pass gets renewal words
    ["if (ent.billingIssueDetectedAt) return {", "if (false) return {"],                                           // billing issue hidden
    ['var PLUS_MANAGE_URL = "https://apps.apple.com/account/subscriptions";', 'var PLUS_MANAGE_URL = "#plus";'],    // a button that stays in the app
    ["_setPlusRenewal(plusRenewalState(info));", "_setPlusRenewal(info?.entitlements?.active?.plus || null);"],    // the whole entitlement stored
    ['if (ent.willRenew === true) return {', 'if (ent.willRenew !== false) return {'],                              // a missing willRenew read as renewing
    ['window.addEventListener("plursky-plus-change", plusBump);', ""],                                               // Me keeps a lapsed row up
  ];
  let caught = 0;
  for (const [from, to] of MUT) {
    const n = SPOTIFY.split(from).length - 1;
    if (n !== 1) { failed++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
    let r;
    try { r = (await runAll(SPOTIFY.replace(from, to))).fails.length; } catch { r = 1; }
    if (r > 0) caught++; else { failed++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
  }
  console.log(`${failed ? "✗" : "✓"} plus renewal states: ${base.checks - base.fails.length}/${base.checks} checks, ${caught}/${MUT.length} mutations caught`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
