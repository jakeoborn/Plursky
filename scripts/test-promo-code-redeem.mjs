#!/usr/bin/env node
// Gate: offer-code redemption on the paywall (SPEC-183 2b), shipped OFF.
//
// Runs the real compiled app in Chrome and mounts the real PlusSheet:
//   1. Shipped build: PROMO_CODE_REDEEM_ON is false, the plans step shows
//      no code entry, and _redeemOfferCode never touches the plugin, even on
//      a (stubbed) native bridge.
//   2. Flag-on build (served mutated): "Redeem code" sits in the
//      Restore/Terms/Privacy row, is at least 44 px tall, and the row stays
//      inside the sheet at 393 and 320 px.
//   3. Flag-on on a stubbed native bridge: Apple's sheet opens exactly once,
//      then the entitlement is re-read; success follows the entitlement, a
//      plugin error comes back as an error, never a success.
// Mutants on the served build must turn it red.
//
//   node scripts/test-promo-code-redeem.mjs [--shots <dir>]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = process.cwd();
const SHOTS = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const SPOTIFY = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const FLAG = /var PROMO_CODE_REDEEM_ON = false;/;
const ON = t => t.replace(FLAG, "var PROMO_CODE_REDEEM_ON = true;");
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });

const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await serverReady(`http://127.0.0.1:${PORT}/index.html`);
const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function open(spotify, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
  await wireVendor(ctx);
  await ctx.addInitScript(() => {
    localStorage.setItem("onboarded", "v1");
    localStorage.setItem("active_festival_id", "acl-2026");
    localStorage.setItem("active_festival_explicit", "1");
    localStorage.setItem("artist_images_v1", "{}");
  });
  await ctx.route(/api\.spotify\.com|itunes\.apple\.com|theaudiodb\.com/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  if (spotify !== SPOTIFY) await ctx.route(/\/build\/spotify\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: spotify }));
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => logs.push(m.text()));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof PlusSheet === "function" && document.getElementById("root")?.children.length > 0, null, { timeout: 60000 });
  return { ctx, page, errors, logs };
}

// Mounts the real PlusSheet and steps to the plans screen.
async function plans(page) {
  await page.evaluate(() => {
    const host = document.createElement("div"); host.id = "plus-probe"; document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(PlusSheet, { feature: "cloud backup", onClose() {} }));
  });
  const see = page.getByRole("button", { name: "See plans" });
  await see.waitFor({ timeout: 10000 });
  await see.click();
  await page.getByRole("button", { name: "Restore purchases" }).waitFor({ timeout: 10000 });
  // Let the sheet's fade-in finish so a screenshot shows it, not the page below.
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
}

// Stubs a native bridge and drives _redeemOfferCode directly.
function native(page, { active, sheetThrows = false }) {
  return page.evaluate(async ({ active, sheetThrows }) => {
    const calls = [];
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Purchases: {
      presentCodeRedemptionSheet: async () => { calls.push("sheet"); if (sheetThrows) throw new Error("sheet failed"); },
      getCustomerInfo: async () => { calls.push("info"); return { customerInfo: { entitlements: { active: active ? { plus: { isActive: true } } : {} } } }; },
    } } };
    _rcInitialized = true;
    const r = await _redeemOfferCode();
    return { r, calls };
  }, { active, sheetThrows });
}

async function run(spotify, { shots = null } = {}) {
  const fails = []; let n = 0;
  const c = (ok, msg) => { n++; if (!ok) fails.push(msg); };

  // ── shipped / as served ─────────────────────────────────────────────────
  {
    const { ctx, page, errors } = await open(spotify, 393);
    const on = await page.evaluate(() => PROMO_CODE_REDEEM_ON);
    await plans(page);
    const has = await page.locator("[data-redeem-code]").count();
    {
      c(on === false, "PROMO_CODE_REDEEM_ON ships false");
      c(has === 0, `shipped: no code entry on the plans step (found ${has})`);
      const off = await native(page, { active: true });
      c(off.calls.length === 0 && off.r.unsupported === true && !off.r.success, `shipped: _redeemOfferCode never calls the plugin (calls ${off.calls})`);
      if (shots) await page.screenshot({ path: join(shots, "paywall-plans-flag-off-393.png") });
    }
    c(errors.length === 0, `no page errors (${errors.join(" | ")})`);
    await ctx.close();
  }

  // ── flag on ─────────────────────────────────────────────────────────────
  // A build whose flag line is already on (a mutant) is used as-is.
  const onBuild = FLAG.test(spotify) ? ON(spotify) : spotify;
  for (const width of [393, 320]) {
    const { ctx, page, errors, logs } = await open(onBuild, width);
    await plans(page);
    const btn = page.locator("[data-redeem-code]");
    c((await btn.count()) === 1, `flag on @${width}: exactly one code entry (found ${await btn.count()})`);
    if (await btn.count()) {
      c((await btn.textContent()).trim() === "Redeem code", `flag on @${width}: label reads "Redeem code"`);
      const box = await btn.boundingBox();
      c(box && box.height >= 44, `flag on @${width}: tap target ≥ 44 px (got ${box?.height})`);
      const fits = await page.evaluate(() => {
        const b = document.querySelector("[data-redeem-code]"), row = b.parentElement, dlg = b.closest('[role="dialog"]');
        const r = row.getBoundingClientRect(), d = dlg.getBoundingClientRect();
        const kids = [...row.children].map(k => k.getBoundingClientRect());
        return { inside: kids.every(k => k.left >= d.left - 0.5 && k.right <= d.right + 0.5), scroll: row.scrollWidth <= row.clientWidth + 1, rowW: r.width };
      });
      c(fits.inside && fits.scroll, `flag on @${width}: the Restore/Redeem/Terms/Privacy row stays inside the sheet`);
      c(/Restore purchases/.test(await btn.evaluate(b => b.parentElement.textContent)), `flag on @${width}: it sits in the Restore row`);
      const rows = await page.evaluate(() => {
        const row = document.querySelector("[data-redeem-code]").parentElement;
        const top = (re) => { const el = [...row.children].find(k => re.test(k.textContent)); return el ? Math.round(el.getBoundingClientRect().top) : null; };
        return { restore: top(/^Restore purchases$/), redeem: top(/^Redeem code$/), terms: top(/^Terms$/), privacy: top(/^Privacy$/) };
      });
      c(rows.restore != null && rows.restore === rows.redeem && rows.terms === rows.privacy && rows.terms > rows.restore,
        `flag on @${width}: two rows, Restore · Redeem over Terms · Privacy (tops ${JSON.stringify(rows)})`);
      if (shots) await page.screenshot({ path: join(shots, `paywall-plans-redeem-code-${width}.png`) });
      await btn.click();
      await page.waitForTimeout(300);
      c(logs.some(l => /would open Apple's offer-code sheet/.test(l)), `flag on @${width}: dev host tap takes the dev path, not a purchase`);
      c(!(await page.locator('[role="alert"]').count()), `flag on @${width}: no error line after a dev-host tap`);
    }
    if (width === 393) {
      const ok = await native(page, { active: true });
      c(JSON.stringify(ok.calls) === '["sheet","info"]', `native: sheet opens once, then the entitlement is re-read (calls ${ok.calls})`);
      c(ok.r.success === true, "native: success when the entitlement is active after the sheet");
      const no = await native(page, { active: false });
      c(no.r.success === false && !no.r.error, "native: no entitlement after the sheet = quiet no-success");
      const bad = await native(page, { active: true, sheetThrows: true });
      c(bad.r.success === false && /sheet failed/.test(bad.r.error || ""), "native: a sheet error is an error, never a success");
    }
    c(errors.length === 0, `flag on @${width}: no page errors (${errors.join(" | ")})`);
    await ctx.close();
  }
  return { n, fails };
}

let exit = 1;
try {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const base = await run(SPOTIFY, { shots: SHOTS });
  if (!FLAG.test(SPOTIFY)) base.fails.push("positive control: the flag line is in build/spotify.js to flip");
  for (const f of base.fails) console.log(`  ✗  ${f}`);
  const MUTANTS = [
    ["flag shipped on", ON(SPOTIFY)],
    ["entry not gated on the flag", SPOTIFY.replace(/_codeRedeemAvailable\(\) && \/\*#__PURE__\*\//, "true && /*#__PURE__*/").replace(/_codeRedeemAvailable\(\) && React/, "true && React")],
    ["no entitlement re-read", SPOTIFY.replace(/var \{\s*customerInfo\s*\} = await _withTimeout\(Purchases\.getCustomerInfo\(\), 15000, "Entitlement check"\);/, "var customerInfo = { entitlements: { active: { plus: 1 } } };")],
    ["plugin called with the flag off", SPOTIFY.replace(/if \(!PROMO_CODE_REDEEM_ON\) return \{\s*success: false,\s*unsupported: true\s*\};/, "")],
  ];
  let caught = 0;
  for (const [name, text] of MUTANTS) {
    if (text === SPOTIFY) { console.log(`  ✗  mutant "${name}" did not land (pattern stale)`); continue; }
    const r = await run(text);
    if (r.fails.length) caught++; else console.log(`  ✗  mutant "${name}" survived`);
  }
  console.log(`  promo code redeem: ${base.n} checks, ${caught}/${MUTANTS.length} mutants caught`);
  if (!base.fails.length && caught === MUTANTS.length) { console.log("  ✓ offer-code entry ships off and stays in the paywall row"); exit = 0; }
} finally {
  await browser.close(); server.kill();
}
process.exit(exit);
