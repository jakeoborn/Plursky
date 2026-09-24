#!/usr/bin/env node
// test-season-rescue.mjs — the $9.99 Season Pass rescue (spotify.jsx PlusGate)
// shows only on its two triggers and fails closed everywhere else.
//
// A mocked Capacitor bridge stands in for StoreKit/RevenueCat. The app code
// under test is the real compiled build: the mock only answers the calls
// PlusGate makes (getOfferings, purchasePackage, restorePurchases, ...), with
// the same shapes @revenuecat/purchases-capacitor 9.x returns, including the
// cancel error ({ code: "1", userCancelled: true }).
//
// It proves:
//   - the first native paywall view shows no rescue; the second does;
//   - cancelling the FULL-PRICE Season Pass shows the rescue at once;
//   - a monthly cancel, a store error and a timeout do not;
//   - the web build and an active Plus never count a view or show a card;
//   - no offering, the remote switch off, no promo product, no price, or a
//     failed lookup all fail closed to the normal, working paywall;
//   - the card's price and button read the store's priceString (a non-USD
//     string proves nothing is hardcoded) and the tap buys the promo package
//     from the "season_rescue" offering;
//   - a rescue purchase unlocks Plus only through the `plus` entitlement;
//     full-price, monthly and restore still work;
//   - each event fires once at its transition, with allowlisted keys only.
//
//   PLURSKY_RESCUE_SHOTS=<dir> node scripts/test-season-rescue.mjs   # 393pt @3x shots
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SHOTS = process.env.PLURSKY_RESCUE_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const fails = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

const SEASON = "plursky_season_pass_2026", MONTHLY = "plursky_plus_monthly", PROMO = "plursky_season_pass_2026_promo";
const ALLOWED = new Set(["name", "at", "entry_feature", "view_number", "is_native", "storefront", "rescue_eligible",
  "rescue_trigger", "product_id", "displayed_price", "trigger", "discount_product_id", "result"]);

// Runs in the page before any app script. `cfg` shapes the store for one scenario.
function installBridge(cfg) {
  if (!cfg.native) return;
  const S = k => JSON.parse(sessionStorage.getItem("__rc_" + k) || "null");
  const W = (k, v) => sessionStorage.setItem("__rc_" + k, JSON.stringify(v));
  const pkg = (id, price) => ({ identifier: id, product: { identifier: id, priceString: price, currencyCode: "USD" } });
  const info = () => ({ entitlements: { active: S("plus") ? { plus: { identifier: "plus" } } : {} } });
  const Purchases = {
    configure: async () => ({}),
    getAppUserID: async () => ({ appUserID: "$RCAnonymousID:test" }),
    getCustomerInfo: async () => ({ customerInfo: info() }),
    addCustomerInfoUpdateListener: async () => "listener",
    getOfferings: async () => {
      if (cfg.offeringsFail) throw { code: "10", message: "Network error" };
      const current = { identifier: "default", availablePackages: [pkg(SEASON_ID, "$14.99"), pkg(MONTHLY_ID, "$4.99")] };
      const all = { default: current };
      if (cfg.rescueOffering) all.season_rescue = {
        identifier: "season_rescue", metadata: cfg.metadata === undefined ? { rescue_enabled: true } : cfg.metadata,
        availablePackages: cfg.promo ? [pkg(PROMO_ID, cfg.price)] : [],
      };
      return { current, all };
    },
    purchasePackage: async ({ aPackage }) => {
      const id = aPackage.product.identifier;
      const calls = S("calls") || []; calls.push(id); W("calls", calls);
      const how = (S("next") || {})[id] || "cancel";
      if (how === "cancel") throw { code: "1", userCancelled: true, message: "Purchase was cancelled." };
      if (how === "error") throw { code: "2", userCancelled: false, message: "There was a problem with the App Store." };
      if (how === "timeout") throw new Error("StoreKit purchase sheet timed out after 45s");
      W("plus", true);
      return { customerInfo: info(), productIdentifier: id };
    },
    restorePurchases: async () => { if (S("owned")) W("plus", true); return { customerInfo: info() }; },
  };
  const stub = new Proxy({}, { get: (_, k) => k === "then" ? undefined : async () => ({ remove() {} }) });
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: n => n === "Purchases",
    Plugins: new Proxy({ Purchases }, { get: (t, k) => t[k] || stub }) };
}

const PORT = await port();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch {} await sleep(100); }
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // One scenario = one fresh context (fresh storage), configured store.
  const open = async (cfg, { plus = false, next = {}, owned = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: SHOTS ? 3 : 1,
      timezoneId: "America/Chicago", serviceWorkers: "block" });
    const src = installBridge.toString().replace(/SEASON_ID/g, JSON.stringify(SEASON)).replace(/MONTHLY_ID/g, JSON.stringify(MONTHLY)).replace(/PROMO_ID/g, JSON.stringify(PROMO));
    await ctx.addInitScript(`(${src})(${JSON.stringify(cfg)})`);
    await ctx.addInitScript(({ plus, next, owned }) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
      localStorage.setItem("active_festival_id", "edc-lv-2026"); localStorage.setItem("active_festival_explicit", "1");
      localStorage.setItem("cloud_nudge_seen", "1");
      if (plus) { localStorage.setItem("plursky_plus_active", "1"); sessionStorage.setItem("__rc_plus", "true"); }
      sessionStorage.setItem("__rc_next", JSON.stringify(next));
      if (owned) sessionStorage.setItem("__rc_owned", "true");
    }, { plus, next, owned });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/?tab=me`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof PlusGate === "function" && typeof _rescueOffer === "function", null, { timeout: 30000 });
    await sleep(600);
    return { ctx, page, errors };
  };
  const row = page => page.getByRole("button", { name: /Plursky Plus — see what's included/ });
  const dialog = page => page.getByRole("dialog", { name: "Plursky+" });
  const openPaywall = async (page, { plans = true } = {}) => {
    await row(page).click();
    await dialog(page).waitFor({ timeout: 10000 });
    if (plans) { await page.getByRole("button", { name: "See plans" }).click(); await page.getByRole("radiogroup", { name: "Choose a plan" }).waitFor(); }
    await sleep(400); // the offer lookup is async
  };
  const closePaywall = async page => { await page.getByRole("button", { name: "Close" }).click(); await dialog(page).waitFor({ state: "detached" }); };
  const card = page => page.getByRole("region", { name: "Festival launch price" });
  const events = page => page.evaluate(() => JSON.parse(localStorage.getItem("plursky_plus_events") || "[]"));
  const rescueRec = page => page.evaluate(() => JSON.parse(localStorage.getItem("plursky_rescue_v1") || "{}"));
  const calls = page => page.evaluate(() => JSON.parse(sessionStorage.getItem("__rc_calls") || "[]"));
  const shot = async (page, name) => { if (SHOTS) { await sleep(300); await page.screenshot({ path: join(SHOTS, `${name}.png`) }); } };
  const LIVE = { native: true, rescueOffering: true, promo: true, price: "$9.99" };

  // ── 1+2. second native view ──
  {
    const { ctx, page, errors } = await open(LIVE);
    await openPaywall(page);
    ok(await card(page).count() === 0, "first native paywall view showed the rescue");
    await shot(page, "1-first-view");
    await closePaywall(page);
    await openPaywall(page);
    ok(await card(page).count() === 1, "second native paywall view did not show the rescue");
    ok(await card(page).getByText("Season Pass · $9.99 one time").count() === 1, "rescue title does not carry the store price");
    ok(await card(page).getByRole("button", { name: "Get Season Pass for $9.99" }).count() === 1, "rescue CTA does not read 'Get Season Pass for {price}'");
    ok(await page.getByRole("radio").count() === 2, "the normal Season Pass and Monthly choices are gone under the rescue");
    ok(await page.getByRole("button", { name: "Restore purchases" }).count() === 1, "Restore is missing under the rescue");
    ok(!/\b(ends?|left|hurry|today|tonight|last chance|limited|expires?|only \d+)\b/i.test(await card(page).innerText()), "rescue implies scarcity or a deadline");
    await shot(page, "2-second-view-rescue");
    const rec = await rescueRec(page);
    const scoped = rec["rc:$RCAnonymousID:test"];
    ok(scoped?.paywallViewCount === 2 && scoped.rescueTrigger === "second_view" && scoped.firstPaywallAt && scoped.rescueEligibleAt,
      `eligibility not recorded per RevenueCat App User ID: ${JSON.stringify(rec)}`);
    const ev = await events(page);
    const views = ev.filter(e => e.name === "plus_paywall_view");
    ok(views.length === 2 && views[0].view_number === 1 && views[1].view_number === 2 && views[0].is_native === true && views[1].rescue_eligible === true,
      `plus_paywall_view trace wrong: ${JSON.stringify(views)}`);
    const rv = ev.filter(e => e.name === "plus_inline_rescue_view");
    ok(rv.length === 1 && rv[0].trigger === "second_view" && rv[0].discount_product_id === PROMO && rv[0].displayed_price === "$9.99",
      `plus_inline_rescue_view trace wrong: ${JSON.stringify(rv)}`);
    ok(ev.every(e => Object.keys(e).every(k => ALLOWED.has(k))) && !/receipt|transaction|customerInfo|appUserID/i.test(JSON.stringify(ev)),
      "an event carries a key outside the allowlist or purchase payload");

    // ── 9. buy the rescue: promo package from season_rescue, Plus via entitlement ──
    await page.evaluate(() => sessionStorage.setItem("__rc_next", JSON.stringify({ plursky_season_pass_2026_promo: "success" })));
    await Promise.all([page.waitForEvent("load"), card(page).getByRole("button", { name: /Get Season Pass for/ }).click()]);
    await page.waitForFunction(() => typeof PlusGate === "function", null, { timeout: 30000 });
    ok((await calls(page)).join() === PROMO, `rescue tap bought ${JSON.stringify(await calls(page))}, not the promo package`);
    ok(await page.evaluate(() => localStorage.getItem("plursky_plus_active")) === "1", "rescue purchase did not unlock Plus");
    const ev2 = await events(page);
    const tail = ev2.filter(e => /purchase|entitlement/.test(e.name)).map(e => `${e.name}:${e.product_id}:${e.result || ""}:${e.rescue_trigger}`);
    ok(JSON.stringify(tail) === JSON.stringify([`plus_purchase_start:${PROMO}::second_view`, `plus_purchase_result:${PROMO}:success:second_view`, `plus_entitlement_active:${PROMO}::second_view`]),
      `rescue purchase trace wrong: ${JSON.stringify(tail)}`);
    ok(ev2.find(e => e.name === "plus_purchase_start")?.displayed_price === "$9.99", "purchase_start did not record the displayed price");
    ok((await rescueRec(page))["rc:$RCAnonymousID:test"]?.rescuePurchased === true, "rescue purchase not recorded");
    ok(!errors.length, `page errors: ${errors.join(" | ")}`);
    await ctx.close();
  }

  // ── 3. full-price Season Pass cancel → rescue at once ──
  {
    const { ctx, page } = await open(LIVE);
    await openPaywall(page);
    await page.getByRole("button", { name: "Get the Season Pass" }).click();
    await card(page).waitFor({ timeout: 5000 }).catch(() => {});
    ok(await card(page).count() === 1, "cancelling the full-price Season Pass did not show the rescue");
    ok(await page.getByRole("alert").count() === 0, "a user cancel was reported as an error");
    await shot(page, "3-cancel-rescue");
    const ev = await events(page);
    const res = ev.filter(e => e.name === "plus_purchase_result");
    ok(res.length === 1 && res[0].result === "cancel" && res[0].product_id === SEASON && res[0].rescue_trigger === null, `season cancel result wrong: ${JSON.stringify(res)}`);
    const rv = ev.filter(e => e.name === "plus_inline_rescue_view");
    ok(rv.length === 1 && rv[0].trigger === "season_purchase_cancel", `cancel-trigger rescue view wrong: ${JSON.stringify(rv)}`);
    ok(ev.filter(e => e.name === "plus_paywall_view").length === 1, "the cancel path counted an extra paywall view");
    await ctx.close();
  }

  // ── 4+5. monthly cancel, store error, timeout: no rescue ──
  for (const [label, choose, how] of [["monthly cancel", "Monthly", "cancel"], ["season error", null, "error"], ["season timeout", null, "timeout"]]) {
    const { ctx, page } = await open(LIVE, { next: { [SEASON]: how, [MONTHLY]: how } });
    await openPaywall(page);
    if (choose) await page.getByRole("radio", { name: new RegExp(choose) }).click();
    await page.getByRole("button", { name: choose ? "Start Monthly" : "Get the Season Pass" }).click();
    await sleep(800);
    ok(await card(page).count() === 0, `${label} showed the rescue`);
    ok(!(await rescueRec(page))["rc:$RCAnonymousID:test"]?.rescueEligibleAt, `${label} made the account rescue-eligible`);
    const res = (await events(page)).filter(e => e.name === "plus_purchase_result");
    ok(res.length === 1 && res[0].result === how, `${label}: purchase_result should be "${how}", got ${JSON.stringify(res)}`);
    if (how !== "cancel") ok(await page.getByRole("alert").count() === 1, `${label} left no error line`);
    if (choose) ok((await events(page)).some(e => e.name === "plus_plan_select" && e.product_id === MONTHLY && e.displayed_price === "$4.99" && e.rescue_eligible === false), "plus_plan_select missing for Monthly");
    await ctx.close();
  }

  // ── 6. fail closed: no offering / switch off / no product / no price / lookup fails ──
  for (const [label, cfg] of [
    ["no season_rescue offering", { ...LIVE, rescueOffering: false }],
    ["remote switch absent", { ...LIVE, metadata: {} }],
    ["remote switch 'true' as a string", { ...LIVE, metadata: { rescue_enabled: "true" } }],
    ["promo product missing", { ...LIVE, promo: false }],
    ["no priceString", { ...LIVE, price: "" }],
    ["offerings lookup fails", { ...LIVE, offeringsFail: true }],
  ]) {
    const { ctx, page } = await open(cfg);
    await openPaywall(page, { plans: false }); await closePaywall(page);
    await openPaywall(page);
    ok(await card(page).count() === 0, `${label}: rescue shown without a live, enabled promo product`);
    if (!cfg.offeringsFail) ok(await page.getByRole("button", { name: "Get the Season Pass" }).isEnabled(), `${label}: the normal paywall stopped working`);
    ok(!(await events(page)).some(e => e.name === "plus_inline_rescue_view"), `${label}: rescue_view fired for a card never shown`);
    await ctx.close();
  }

  // ── the price is the store's string, never a literal ──
  {
    const { ctx, page } = await open({ ...LIVE, price: "€10,99" });
    await openPaywall(page, { plans: false }); await closePaywall(page); await openPaywall(page);
    ok(await card(page).getByRole("button", { name: "Get Season Pass for €10,99" }).count() === 1 && await card(page).getByText(/\$9\.99/).count() === 0,
      "the rescue shows a hardcoded $9.99 instead of the store's priceString");
    await ctx.close();
  }

  // ── 7. web: no StoreKit, no count, no card ──
  {
    const { ctx, page } = await open({ native: false });
    await openPaywall(page, { plans: false }); await closePaywall(page); await openPaywall(page, { plans: false });
    ok(await card(page).count() === 0, "the web build showed the rescue");
    ok(Object.keys(await rescueRec(page)).length === 0, "the web build counted a rescue view");
    const views = (await events(page)).filter(e => e.name === "plus_paywall_view");
    ok(views.length === 2 && views.every(v => v.is_native === false && v.view_number === null), `web paywall_view wrong: ${JSON.stringify(views)}`);
    await ctx.close();
  }

  // ── 8. active Plus: no paywall, no rescue ──
  {
    const { ctx, page } = await open(LIVE, { plus: true });
    ok(await row(page).count() === 0, "an active Plus user still sees the Plursky+ upsell row");
    ok(!(await events(page)).some(e => e.name === "plus_paywall_view"), "an active Plus user logged a paywall view");
    await ctx.close();
  }

  // ── 11. full price, monthly and restore still work ──
  for (const [label, choose, cta, id] of [["full-price Season Pass", null, "Get the Season Pass", SEASON], ["Monthly", "Monthly", "Start Monthly", MONTHLY]]) {
    const { ctx, page } = await open(LIVE, { next: { [id]: "success" } });
    await openPaywall(page);
    if (choose) await page.getByRole("radio", { name: new RegExp(choose) }).click();
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: cta }).click()]);
    await page.waitForFunction(() => typeof PlusGate === "function", null, { timeout: 30000 });
    ok((await calls(page)).join() === id && await page.evaluate(() => localStorage.getItem("plursky_plus_active")) === "1", `${label} purchase no longer unlocks Plus`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(LIVE, { owned: true });
    await openPaywall(page);
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Restore purchases" }).click()]);
    await page.waitForFunction(() => typeof PlusGate === "function", null, { timeout: 30000 });
    ok(await page.evaluate(() => localStorage.getItem("plursky_plus_active")) === "1", "Restore no longer unlocks Plus");
    await ctx.close();
  }
} finally {
  try { await browser?.close(); } catch {}
  server.kill();
}
if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} Season Pass rescue checks failed`); process.exit(1); }
console.log(`  ✓ Season Pass rescue: two triggers only, fail-closed on 6 store states, live price, promo package, full-price/monthly/restore intact, ${checks} checks`);
