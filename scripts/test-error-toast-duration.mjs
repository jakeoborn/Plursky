#!/usr/bin/env node
// Finding f26: a share failure toast must stay long enough to read. The
// global toast's 1600 ms default suits a quick "Saved"; the two-line failure
// ("The share card took too long to make. Try again.") was gone first.
//
// Runs the real compiled app in Chrome: the real App (real ToastHost) and the
// real MomentLightbox, the clip's media never arrives, Share is tapped. When
// the timeout toast appears, then 4.5 s later, it must still be PAINTED: a
// screenshot of its box with it shown must differ from the same box with it
// hidden (real pixels, not just the DOM). It must also leave by 8 s, and a
// plain quick confirm must still leave within ~2 s. At 393 and 320 px.
// Mutants on the served build must turn the gate red.
//
//   node scripts/test-error-toast-duration.mjs [--shots <dir>]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = process.cwd();
const SHOTS = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const APP = readFileSync(join(ROOT, "build", "app.js"), "utf8");
const SPOTIFY = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const READ_AT_MS = 4500, GONE_BY_MS = 8000, QUICK_GONE_MS = 2200;
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await serverReady(`http://127.0.0.1:${PORT}/index.html`);
const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

const findToast = re => !![...document.querySelectorAll('[role="status"]')].find(e => new RegExp(re).test(e.textContent));

// Share of pixels that differ between two PNGs of the same box, decoded in
// the page (no PNG library in the repo).
async function diffShare(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const px = i => { const k = document.createElement("canvas"); k.width = i.width; k.height = i.height; const g = k.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const da = px(ia), db = px(ib); let diff = 0;
    for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 30) diff++;
    return diff / (da.length / 4);
  }, [`data:image/png;base64,${a.toString("base64")}`, `data:image/png;base64,${b.toString("base64")}`]);
}

async function run({ app = APP, spotify = SPOTIFY, width = 393, shot = null } = {}) {
  const fails = []; let n = 0;
  const c = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
  await wireVendor(ctx);
  await ctx.addInitScript(() => {
    localStorage.setItem("onboarded", "v1");
    localStorage.setItem("active_festival_id", "acl-2026");
    localStorage.setItem("active_festival_explicit", "1");
    localStorage.setItem("artist_images_v1", "{}");
  });
  await ctx.route(/api\.spotify\.com|itunes\.apple\.com|theaudiodb\.com/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  if (app !== APP) await ctx.route(/\/build\/app\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: app }));
  if (spotify !== SPOTIFY) await ctx.route(/\/build\/spotify\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: spotify }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof MomentLightbox === "function" && typeof window.plurskyToast === "function"
      && document.getElementById("root")?.children.length > 0 && (window.ARTISTS || []).length > 0, null, { timeout: 60000 });
    // A plain quick confirm keeps its short life.
    await page.evaluate(() => window.plurskyToast("Saved"));
    await page.waitForFunction(findToast, "^Saved$", { timeout: 3000 });
    await sleep(QUICK_GONE_MS);
    c(!(await page.evaluate(findToast, "^Saved$")), `a plain confirm still leaves within ${QUICK_GONE_MS} ms`);
    // Mount the real lightbox where the screens render, next to ToastHost.
    await page.evaluate(() => window.plurskyToast("probe", { duration: 200 }));
    await page.waitForFunction(re => { const s = [...document.querySelectorAll('[role="status"]')].find(e => new RegExp(re).test(e.textContent));
      if (!s) return false; s.parentElement.parentElement.setAttribute("data-toast-parent", "1"); return true; }, "^probe$", { timeout: 5000 });
    await page.waitForFunction(re => ![...document.querySelectorAll('[role="status"]')].some(e => new RegExp(re).test(e.textContent)), "^probe$", { timeout: 5000 });
    await page.evaluate(() => {
      window._getPhoto = () => new Promise(() => {});
      const host = document.querySelector("[data-toast-parent]");
      const lb = document.createElement("div"); lb.id = "lb"; host.insertBefore(lb, host.firstChild);
      const clip = { id: "c1", festivalId: "acl-2026", night: 1, kind: "video", photoId: "never", takenAt: "2026-10-02 20:00", artistId: window.ARTISTS[0].id, tagSource: "time" };
      ReactDOM.createRoot(lb).render(React.createElement(MomentLightbox, { moments: [clip], index: 0, onClose() {}, onIndexChange() {}, onUpdate() {} }));
    });
    const share = page.getByRole("button", { name: /Share this moment/ });
    await share.waitFor({ timeout: 10000 });
    await share.click();
    const shown = await page.waitForFunction(findToast, "took too long", { timeout: 15000, polling: 50 }).then(() => true, () => false);
    c(shown, "the share failure shows its toast");
    if (shown) {
      const t0 = Date.now();
      await sleep(READ_AT_MS - (Date.now() - t0));
      const box = await page.evaluate(re => { const s = [...document.querySelectorAll('[role="status"]')].find(e => new RegExp(re).test(e.textContent));
        if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height, lines: Math.round(r.height / parseFloat(getComputedStyle(s).lineHeight)) }; }, "took too long");
      c(!!box, `the failure toast is still on screen ${READ_AT_MS} ms after it appeared`);
      if (box) {
        const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, width - box.x), height: box.height };
        const on = await page.screenshot({ clip, animations: "disabled" });
        if (shot) await page.screenshot({ path: shot, animations: "disabled" });
        await page.evaluate(re => { const s = [...document.querySelectorAll('[role="status"]')].find(e => new RegExp(re).test(e.textContent)); s.style.visibility = "hidden"; }, "took too long");
        const off = await page.screenshot({ clip, animations: "disabled" });
        await page.evaluate(re => { const s = [...document.querySelectorAll('[role="status"]')].find(e => new RegExp(re).test(e.textContent)); if (s) s.style.visibility = ""; }, "took too long");
        const d = await diffShare(page, on, off);
        c(d > 0.05, `at ${READ_AT_MS} ms the toast is painted: ${(d * 100).toFixed(1)}% of its box differs from the box without it`);
        if (width === 320) c(box.lines >= 2, `control: at 320 px the message wraps to two lines (${box.lines})`);
      }
      const gone = await page.waitForFunction(re => !document.querySelector('[role="status"]') || ![...document.querySelectorAll('[role="status"]')].some(e => new RegExp(re).test(e.textContent)),
        "took too long", { timeout: Math.max(1, GONE_BY_MS - (Date.now() - t0)), polling: 100 }).then(() => true, () => false);
      c(gone, `the failure toast leaves by ${GONE_BY_MS} ms`);
    }
    c(!errors.length, `no page errors (${errors.slice(0, 2).join(" | ")})`);
  } catch (e) { fails.push(`threw: ${e.message.split("\n")[0]}`); }
  await ctx.close();
  return { n, fails };
}

const all = []; let checks = 0, caught = 0;
const MUTANTS = [
  ["error toasts back to the 1600 ms default", "app", [/var TOAST_ERROR_MS = 6000;/, "var TOAST_ERROR_MS = 1600;"]],
  ["the lightbox share failure not marked as an error", "spotify", [/(var why = _shareMomentFailText\(res\);\s*if \(why\) window\.plurskyToast\?\.\(why), \{\s*error: true\s*\}\);/, "$1);"]],
];
try {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  for (const w of [393, 320]) {
    const r = await run({ width: w, shot: SHOTS ? join(SHOTS, `share-error-toast-${w}-at-4500ms.png`) : null });
    checks += r.n; all.push(...r.fails.map(f => `${w}px: ${f}`));
  }
  for (const [name, which, [re, rep]] of MUTANTS) {
    const src = which === "app" ? APP : SPOTIFY;
    if (!re.test(src)) { all.push(`mutant "${name}" did not apply (pattern missing)`); continue; }
    const r = await run({ [which]: src.replace(re, rep), width: 393 });
    if (r.fails.length) { caught++; console.log(`  mutant "${name}" caught: ${r.fails[0]}`); } else all.push(`mutant "${name}" survived`);
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`  error-toast-duration: ${checks} checks, ${caught}/${MUTANTS.length} mutants caught`);
if (all.length) { for (const f of all) console.log(`  ✗ ${f}`); process.exit(1); }
console.log("  ✓ a share failure stays on screen long enough to read, and still leaves");
