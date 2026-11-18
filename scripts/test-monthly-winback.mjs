#!/usr/bin/env node
// test-monthly-winback.mjs: the Monthly win-back (SPEC-212 W4) on the real
// compiled app, with a mocked Capacitor bridge standing in for StoreKit and
// RevenueCat 9.x (getOfferings, getCustomerInfo, getEligibleWinBackOffersForPackage,
// purchasePackageWithWinBackOffer, and the native ShazamPlugin.storefront).
//
// It proves:
//   1. Eligibility on fixture customers: active, lapsed inside 90 days,
//      lapsed outside, non-US storefront, unknown storefront, never Monthly,
//      cancelled but not yet expired, the 90-day edge.
//   2. The card's words come from the store: a non-USD offer price and cycles
//      the store returned, and nothing when a field is missing.
//   3. Fail closed in the app: remote switch off, non-US, a build without the
//      storefront method, Apple returning no offer, a lookup that throws, the
//      web build. The normal paywall still renders in every case.
//   4. The card shows, buys Monthly with Apple's own offer object, a cancel
//      leaves the paywall working, and Plus unlocks through the entitlement.
//   5. Mutations: each rule nudged in the compiled source must fail a check.
//
//   PLURSKY_WINBACK_SHOTS=<dir> node scripts/test-monthly-winback.mjs   # default + 200% text, 393 and 320
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = process.cwd();
const SHOTS = process.env.PLURSKY_WINBACK_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SPOTIFY = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

const MONTHLY = "plursky_plus_monthly", SEASON = "plursky_season_pass_2026";
const NOW = Date.UTC(2026, 10, 17, 18);
const DAY = 86400000;
const iso = ms => new Date(ms).toISOString();
const lapsed = days => ({ entitlements: { active: {} }, allExpirationDates: { [MONTHLY]: iso(NOW - days * DAY) } });

// Runs in the page before any app script.
function installBridge(cfg) {
  if (!cfg.native) return;
  const S = k => JSON.parse(sessionStorage.getItem("__rc_" + k) || "null");
  const W = (k, v) => sessionStorage.setItem("__rc_" + k, JSON.stringify(v));
  const pkg = (id, price) => ({ identifier: id, product: { identifier: id, priceString: price, currencyCode: "USD" } });
  const info = () => S("plus") ? { entitlements: { active: { plus: { identifier: "plus" } } }, allExpirationDates: {} } : cfg.customer;
  const Purchases = {
    configure: async () => ({}),
    getAppUserID: async () => ({ appUserID: "$RCAnonymousID:test" }),
    getCustomerInfo: async () => ({ customerInfo: info() }),
    addCustomerInfoUpdateListener: async () => "listener",
    getOfferings: async () => {
      const current = { identifier: "default", metadata: cfg.metadata, availablePackages: [pkg(SEASON_ID, "$14.99"), pkg(MONTHLY_ID, cfg.regular || "$4.99")] };
      const all = { default: current };
      // A Season Pass rescue the user already qualifies for: the win-back
      // must still be the only discount on screen.
      if (cfg.rescue) all.season_rescue = { identifier: "season_rescue", metadata: { rescue_enabled: true },
        availablePackages: [pkg("plursky_season_pass_2026_promo", "$9.99")] };
      return { current, all };
    },
    getEligibleWinBackOffersForPackage: async ({ aPackage }) => {
      W("asked", aPackage.product.identifier);
      if (cfg.offersThrow) throw { code: "16", message: "Win-back offers require iOS 18" };
      return { eligibleWinBackOffers: cfg.offers || [] };
    },
    purchasePackageWithWinBackOffer: async ({ aPackage, winBackOffer }) => {
      W("bought", { id: aPackage.product.identifier, offer: winBackOffer && winBackOffer.identifier });
      const how = S("next") || "cancel";
      if (how === "cancel") throw { code: "1", userCancelled: true, message: "Purchase was cancelled." };
      if (how === "error") throw { code: "2", userCancelled: false, message: "There was a problem with the App Store." };
      W("plus", true);
      return { customerInfo: info(), productIdentifier: aPackage.product.identifier };
    },
    purchasePackage: async () => { throw { code: "1", userCancelled: true, message: "Purchase was cancelled." }; },
    restorePurchases: async () => ({ customerInfo: info() }),
  };
  const stub = new Proxy({}, { get: (_, k) => k === "then" ? undefined : async () => ({ remove() {} }) });
  const plugins = { Purchases };
  if (cfg.storefront !== undefined) plugins.ShazamPlugin = {
    buildChannel: async () => ({ channel: "appstore" }),
    storefront: async () => { if (cfg.storefront === "reject") throw new Error("not implemented"); return { countryCode: cfg.storefront }; },
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: n => n === "Purchases",
    Plugins: new Proxy(plugins, { get: (t, k) => t[k] || stub }) };
}

const OFFER = { identifier: "plus_monthly_winback_50", price: 2.49, priceString: "€2,49", cycles: 3, period: "P1M", periodUnit: "MONTH", periodNumberOfUnits: 1 };
// Three photo moments on EDC night 1: enough for the recap card (it needs 3).
const RECAP_MOMENTS = { 1: [0, 1, 2].map(i => ({ id: `m${i}`, photoId: `p${i}`, night: 1, festivalId: "edc-lv-2026",
  kind: "photo", takenAt: `2026-05-15 2${i}:10:00`, createdAt: Date.UTC(2026, 4, 16, 4 + i) })) };
const LIVE = { native: true, metadata: { winback_enabled: true }, storefront: "USA", customer: lapsed(30), offers: [OFFER], regular: "€4,99", rescue: true };

const PORT = await port();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
let browser;
async function runAll(spotifySrc, { shots = false, layout = false } = {}) {
  const fails = [];
  let checks = 0;
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
  const open = async (cfg, { width = 393, next, tab = "me", seed = {} } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: shots ? 3 : 1, timezoneId: "America/Chicago", serviceWorkers: "block" });
    if (spotifySrc !== SPOTIFY) await ctx.route(/\/build\/spotify\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: spotifySrc }));
    const src = installBridge.toString().replace(/SEASON_ID/g, JSON.stringify(SEASON)).replace(/MONTHLY_ID/g, JSON.stringify(MONTHLY));
    await ctx.addInitScript(`(${src})(${JSON.stringify(cfg)})`);
    await ctx.addInitScript(({ next, seed }) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
      localStorage.setItem("active_festival_id", "edc-lv-2026"); localStorage.setItem("active_festival_explicit", "1");
      localStorage.setItem("cloud_nudge_seen", "1");
      if (next) sessionStorage.setItem("__rc_next", JSON.stringify(next));
      localStorage.setItem("plursky_rescue_v1", JSON.stringify({ "rc:$RCAnonymousID:test": { paywallViewCount: 2, rescueEligibleAt: 1, rescueTrigger: "second_view" } }));
      if (seed.moments) localStorage.setItem("plursky_moments_v1", JSON.stringify(seed.moments));
      if (seed.plus) localStorage.setItem("plursky_plus_active", "1");
    }, { next, seed });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(NOW));
    const errors = []; page.on("pageerror", e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/?tab=${tab}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => typeof PlusGate === "function" && typeof winBackEligibility === "function", null, { timeout: 30000 });
    await sleep(500);
    return { ctx, page, errors };
  };
  const openPaywall = async page => {
    await page.getByRole("button", { name: /Plursky Plus — see what's included/ }).click();
    await page.getByRole("dialog", { name: "Plursky+" }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "See plans" }).click();
    await page.getByRole("radiogroup", { name: "Choose a plan" }).waitFor();
    await sleep(500);   // the offer lookup is async
  };
  const card = page => page.locator("[data-winback]");

  // ── 1+2. Pure rules, in the page ──
  {
    const { ctx, page } = await open({ native: false });
    const E = (c, sf, now = NOW) => page.evaluate(([c, sf, now]) => winBackEligibility(c, sf, now), [c, sf, now]);
    const active = { entitlements: { active: { plus: {} } }, allExpirationDates: { [MONTHLY]: iso(NOW + 10 * DAY) } };
    ok((await E(active, "USA")).reason === "active", "an active subscriber is not offered");
    ok((await E(lapsed(30), "USA")).eligible === true, "lapsed 30 days, US: eligible");
    ok((await E(lapsed(30), "usa")).eligible === true, "storefront code case does not matter");
    ok((await E(lapsed(120), "USA")).reason === "lapsed-too-long", "lapsed 120 days: not offered");
    ok((await E(lapsed(90), "USA")).eligible === true, "exactly 90 days: still inside");
    ok((await E(lapsed(90 + 1 / 1440), "USA")).reason === "lapsed-too-long", "90 days and a minute: outside");
    ok((await E(lapsed(30), "CAN")).reason === "storefront", "non-US storefront: not offered");
    ok((await E(lapsed(30), null)).reason === "unknown-storefront", "unknown storefront: not offered");
    ok((await E({ entitlements: { active: {} }, allExpirationDates: { [SEASON]: iso(NOW - DAY) } }, "USA")).reason === "never-monthly", "never had Monthly: not offered");
    ok((await E({ entitlements: { active: {} }, allExpirationDates: { [MONTHLY]: iso(NOW + DAY) } }, "USA")).reason === "not-lapsed", "cancelled but not expired: not offered yet");
    ok((await E(null, "USA")).eligible === false, "no customer info: not offered");
    const C = o => page.evaluate(o => winBackCopy(o), o);
    const base = { offerPrice: "€2,49", regularPrice: "€4,99", cycles: 3, periodUnit: "MONTH", periodNumberOfUnits: 1 };
    const c = await C(base);
    ok(c && c.line === "€2,49/month for 3 months, then €4,99/month. Cancel anytime." && c.cta === "Resubscribe for €2,49/month", `copy from the store's strings (${JSON.stringify(c)})`);
    ok((await C({ ...base, cycles: 1 }))?.line.startsWith("€2,49/month for 1 month,"), "one cycle reads singular");
    for (const [k, v] of [["offerPrice", ""], ["regularPrice", undefined], ["cycles", 0], ["periodUnit", "WEEK"]])
      ok(await C({ ...base, [k]: v }) === null, `copy is null when ${k} is ${JSON.stringify(v)}`);
    await ctx.close();
  }
  const src = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
  const block = src.slice(src.indexOf("// ── Monthly win-back"), src.indexOf("// Narrow event adapter"));
  ok(!/\$\d|\d+%|50 ?%|\b3 months\b/.test(block.replace(/\/\/.*$/gm, "")), "no price, percent or offer length is written into the win-back code");

  // ── 3. Fail closed ──
  const cases = [
    ["remote switch absent", { ...LIVE, metadata: undefined }],
    ["remote switch not true", { ...LIVE, metadata: { winback_enabled: "true" } }],
    ["non-US storefront", { ...LIVE, storefront: "GBR" }],
    ["build without the storefront method", { ...LIVE, storefront: undefined }],
    ["storefront call rejects", { ...LIVE, storefront: "reject" }],
    ["Apple returns no offer", { ...LIVE, offers: [] }],
    ["offer lookup throws", { ...LIVE, offersThrow: true }],
    ["lapsed outside 90 days", { ...LIVE, customer: lapsed(200) }],
    ["web build", { native: false }],
  ];
  for (const [name, cfg] of cases) {
    const { ctx, page, errors } = await open(cfg);
    if (cfg.native) await openPaywall(page);
    else await page.getByRole("button", { name: /Plursky Plus — see what's included/ }).click().catch(() => {});
    await sleep(300);
    ok(await card(page).count() === 0, `${name}: the card showed`);
    if (cfg.native) ok(await page.getByRole("radiogroup", { name: "Choose a plan" }).getByRole("radio").count() === 2, `${name}: the normal plans are gone`);
    if (name === "non-US storefront") ok(await page.evaluate(() => sessionStorage.getItem("__rc_asked")) === null, "non-US: Apple was not even asked");
    ok(!errors.length, `${name}: page errors ${errors.join(" | ")}`);
    await ctx.close();
  }

  // ── 4. Shows, buys, cancels, unlocks ──
  {
    const { ctx, page, errors } = await open(LIVE);
    await openPaywall(page);
    ok(await card(page).count() === 1, "eligible lapsed US subscriber: no card");
    const t = await card(page).innerText().catch(() => "");
    ok(/€2,49\/month for 3 months, then €4,99\/month/.test(t) && /Resubscribe for €2,49\/month/.test(t), `card text is not the store's (${t})`);
    ok(!/\b(hurry|today|tonight|last chance|limited|expires?)\b/i.test(t), "card implies a deadline");
    ok(await page.getByRole("region", { name: "Festival launch price" }).count() === 0, "two discounts at once");
    const ev = JSON.parse(await page.evaluate(() => localStorage.getItem("plursky_plus_events") || "[]"));
    ok(ev.filter(e => e.name === "plus_winback_view").length === 1, "plus_winback_view not logged once");
    await card(page).locator("[data-winback-buy]").click(); await sleep(400);
    const bought = await page.evaluate(() => JSON.parse(sessionStorage.getItem("__rc_bought") || "null"));
    ok(bought && bought.id === MONTHLY && bought.offer === OFFER.identifier, `bought ${JSON.stringify(bought)}, not Monthly with Apple's offer`);
    ok(await card(page).count() === 1 && await page.getByRole("alert").count() === 0, "a cancel left an error or removed the card");
    ok(!errors.length, `page errors: ${errors.join(" | ")}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(LIVE, { next: "success" });
    await openPaywall(page);
    await Promise.all([page.waitForEvent("load"), card(page).locator("[data-winback-buy]").click()]);
    await page.waitForFunction(() => typeof PlusGate === "function", null, { timeout: 30000 });
    ok(await page.evaluate(() => localStorage.getItem("plursky_plus_active")) === "1", "win-back purchase did not unlock Plus");
    await ctx.close();
  }
  {
    const { ctx, page } = await open(LIVE, { next: "error" });
    await openPaywall(page);
    await card(page).locator("[data-winback-buy]").click(); await sleep(400);
    ok(/problem with the App Store/.test(await page.getByRole("alert").innerText().catch(() => "")), "a store error is not shown in words");
    if (shots) for (const w of [393, 320]) {
      await page.setViewportSize({ width: w, height: 852 });
      await card(page).scrollIntoViewIfNeeded(); await sleep(200);
      await page.screenshot({ path: join(SHOTS, `winback-error-${w}.png`) });
    }
    await ctx.close();
  }
  // ── 6. Retention hooks on the recap card (Home, after the festival) ──
  {
    const { ctx, page } = await open({ native: false });
    const F = (cfg, now) => page.evaluate(([cfg, now]) => recapHookFestivalOver(cfg, now), [cfg, now]);
    ok(await F({ endMs: NOW - DAY }, NOW) === true, "festival closed yesterday: not over");
    ok(await F({ endMs: NOW + DAY }, NOW) === false, "festival closes tomorrow: already over");
    ok(await F({}, NOW) === false && await F(null, NOW) === false, "no endMs: treated as over");
    await ctx.close();
  }
  const recapEyebrow = page => page.getByText(/^(Recap ready|Last night in 15s|Your weekend is ready)$/).first().textContent().catch(() => "");   // textContent: the eyebrow is CSS-uppercased
  const hook = page => page.locator("[data-recap-winback]");
  const HOME = { tab: "home", seed: { moments: RECAP_MOMENTS } };
  {
    const { ctx, page, errors } = await open(LIVE, HOME);
    await sleep(800);
    ok(await hook(page).count() === 1, "lapsed US subscriber on the recap card: no resubscribe row");
    const t = await hook(page).innerText().catch(() => "");
    ok(/Welcome back to Plursky\+/.test(t) && /€2,49\/month for 3 months, then €4,99\/month/.test(t), `recap row text is not the store's (${t})`);
    ok(await recapEyebrow(page) !== "Your weekend is ready", "a lapsed user is told the weekend is ready");
    const ev = JSON.parse(await page.evaluate(() => localStorage.getItem("plursky_plus_events") || "[]"));
    ok(ev.filter(e => e.name === "plus_winback_view" && e.trigger === "recap").length === 1, "recap row view not logged once with trigger recap");
    await hook(page).click();
    await page.getByRole("dialog", { name: "Plursky+" }).waitFor({ timeout: 10000 }).catch(() => {});
    ok(await page.getByRole("dialog", { name: "Plursky+" }).count() === 1, "the recap row does not open Plursky+");
    const seePlans = page.getByRole("button", { name: "See plans" });
    if (await seePlans.count()) await seePlans.click();
    await sleep(600);
    ok(await card(page).count() === 1, "the recap row's sheet does not show the win-back offer");
    ok(!errors.length, `page errors: ${errors.join(" | ")}`);
    if (shots || layout) for (const w of [393, 320]) for (const big of [false, true]) {
      const o = await open(LIVE, { ...HOME, width: w });
      await sleep(800);
      if (big) await o.page.evaluate(() => {
        const els = [...document.body.querySelectorAll("*")]; const sz = els.map(e => parseFloat(getComputedStyle(e).fontSize));
        els.forEach((e, i) => { if (sz[i]) e.style.setProperty("font-size", (sz[i] * 2) + "px", "important"); });
      });
      await sleep(300);
      await hook(o.page).scrollIntoViewIfNeeded().catch(() => {}); await sleep(200);
      const over = await o.page.evaluate(w => [...document.querySelectorAll("[data-recap-winback], [data-recap-winback] *")].map(e => e.getBoundingClientRect()).filter(r => r.width && (r.right > w + 0.5 || r.left < -0.5)).length, w);
      ok(await hook(o.page).count() === 1 && over === 0, `@${w}${big ? " 200%" : ""}: recap row missing or ${over} element(s) run past the screen`);
      if (shots) await o.page.screenshot({ path: join(SHOTS, `recap-winback-${w}${big ? "-200" : ""}.png`) });
      await o.ctx.close();
    }
    await ctx.close();
  }
  for (const [name, cfg] of [
    ["remote switch off", { ...LIVE, metadata: {} }],
    ["non-US storefront", { ...LIVE, storefront: "GBR" }],
    ["lapsed over 90 days", { ...LIVE, customer: lapsed(120) }],
    ["store returned no offer", { ...LIVE, offers: [] }],
  ]) {
    const { ctx, page } = await open(cfg, HOME);
    await sleep(800);
    ok(await page.getByText(/^(Recap ready|Last night in 15s)$/).count() === 1, `${name}: the free recap card is gone`);
    ok(await hook(page).count() === 0, `${name}: resubscribe row shown`);
    await ctx.close();
  }
  {
    const active = { entitlements: { active: { plus: { identifier: "plus" } } }, allExpirationDates: { [MONTHLY]: iso(NOW + 10 * DAY) } };
    const { ctx, page, errors } = await open({ ...LIVE, customer: active }, { tab: "home", seed: { moments: RECAP_MOMENTS, plus: true } });
    await sleep(800);
    ok(await recapEyebrow(page) === "Your weekend is ready", `active Plus after the festival: eyebrow is "${await recapEyebrow(page)}"`);
    ok(await hook(page).count() === 0, "active Plus is shown a resubscribe row");
    ok(!errors.length, `page errors: ${errors.join(" | ")}`);
    if (shots) for (const w of [393, 320]) {
      await page.setViewportSize({ width: w, height: 852 }); await sleep(200);
      await page.getByText("Your weekend is ready").scrollIntoViewIfNeeded().catch(() => {}); await sleep(200);
      await page.screenshot({ path: join(SHOTS, `recap-weekend-ready-${w}.png`) });
    }
    await ctx.close();
  }
  if (shots || layout) for (const w of [393, 320]) for (const big of [false, true]) {
    const { ctx, page } = await open(LIVE, { width: w });
    await openPaywall(page);
    if (big) await page.evaluate(() => {
      const els = [...document.body.querySelectorAll("*")]; const sz = els.map(e => parseFloat(getComputedStyle(e).fontSize));
      els.forEach((e, i) => { if (sz[i]) e.style.setProperty("font-size", (sz[i] * 2) + "px", "important"); });
    });
    await sleep(300);
    await card(page).scrollIntoViewIfNeeded(); await sleep(200);
    const over = await page.evaluate(w => [...document.querySelectorAll("[data-winback], [data-winback] *")].map(e => e.getBoundingClientRect()).filter(r => r.width && (r.right > w + 0.5 || r.left < -0.5)).length, w);
    ok(over === 0, `@${w}${big ? " 200%" : ""}: ${over} element(s) of the card run past the screen`);
    // The plan rows under the card: a store price must never sit on top of the plan name.
    const clash = await page.evaluate(() => [...document.querySelectorAll("[data-plan-price]")].filter(pr => {
      const nm = pr.parentElement?.querySelector("[data-plan-name]"); if (!nm) return false;
      const rg = document.createRange(); rg.selectNodeContents(nm);
      const a = pr.getBoundingClientRect(), b = rg.getBoundingClientRect();   // the text itself, overflow included
      return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    }).length);
    ok(clash === 0, `@${w}${big ? " 200%" : ""}: ${clash} plan price(s) overlap the plan name`);
    if (shots) await page.screenshot({ path: join(SHOTS, `winback-offer-${w}${big ? "-200" : ""}.png`) });
    await ctx.close();
  }
  return { checks, fails };
}

let failed = 0;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const base = await runAll(SPOTIFY, { shots: !!SHOTS, layout: true });
  for (const f of base.fails) console.log(`  ✗  ${f}`);
  failed += base.fails.length;

  // ── 5. Mutations ──
  const MUT = [
    ["if (lapsedDays > WINBACK_MAX_LAPSE_DAYS)", "if (false)"],
    ["if (!WINBACK_STOREFRONTS.includes(storefront.toUpperCase()))", "if (false)"],
    ['if (typeof storefront !== "string" || !storefront)', "if (false)"],
    ["if (customerInfo.entitlements?.active?.[RC_ENTITLEMENT])", "if (false)"],
    ["if (current?.metadata?.winback_enabled !== true) return null;", ""],
    ["var showRescue = !showWinBack && ", "var showRescue = "],
    ["var weekendReady = plusActive && ", "var weekendReady = "],
    ["return Number.isFinite(end) && Number.isFinite(nowMs) && nowMs >= end;", "return true;"],
    ["setWinBack(copy);", 'setWinBack(winBackCopy({ offerPrice: "$2.49", regularPrice: "$4.99", cycles: 3, periodUnit: "MONTH", periodNumberOfUnits: 1 }));'],
  ];
  let caught = 0;
  {
    const from = 'flexWrap: "wrap",\n        alignItems: "center",\n        gap: 12,\n        minHeight: 64';   // the plan row, as build/ prints it
    const n = SPOTIFY.split(from).length - 1;
    if (n !== 1) { failed++; console.log(`  ✗  layout mutation target not found exactly once (${n})`); }
    else {
      const r = await runAll(SPOTIFY.replace(from, from.replace('flexWrap: "wrap",', 'flexWrap: "nowrap",')), { layout: true });
      if (r.fails.some(f => /overlap the plan name/.test(f))) { caught++; console.log("  mutation caught: plan row without wrap"); }
      else { failed++; console.log("  ✗  mutation survived: plan row without wrap"); }
    }
  }
  for (const [from, to] of MUT) {
    const n = SPOTIFY.split(from).length - 1;
    if (n !== 1) { failed++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
    let r;
    try { r = (await runAll(SPOTIFY.replace(from, to))).fails.length; } catch { r = 1; }
    if (r > 0) caught++; else { failed++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
  }
  console.log(`${failed ? "✗" : "✓"} monthly win-back: ${base.checks - base.fails.length}/${base.checks} checks, ${caught}/${MUT.length + 1} mutations caught`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
