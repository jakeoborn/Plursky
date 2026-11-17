#!/usr/bin/env node
// SPEC-179 PR A: a share failure reported while the MomentLightbox is open must
// be SEEN. The toast host sat at zIndex 95 and the lightbox at 200, so the
// "took too long" message was drawn behind the lightbox.
//
// Runs the real compiled app in Chrome: the real App (with its real ToastHost)
// is mounted, the real MomentLightbox is rendered inside the same container the
// screens render into, the clip's media never arrives, and "Share this moment"
// is tapped. After the prep cap the error toast must be in the viewport and be
// the topmost element at its own centre (not covered by the lightbox).
// A static check: no layer in the .jsx sources reaches the toast's layer.
// Mutant: build/app.js served with the old zIndex 95 must turn the gate red.
//
//   node scripts/test-toast-over-modals.mjs [--shots <dir>]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = process.cwd();
const SHOTS = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const APP_BUILT = readFileSync(join(ROOT, "build", "app.js"), "utf8");
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });

const all = []; let checks = 0;
const t = (ok, msg) => { checks++; if (!ok) all.push(msg); };

// ── Static: the toast layer is above every other layer in the sources ──
const APP_JSX = readFileSync(join(ROOT, "app.jsx"), "utf8");
const toastZ = +(/const TOAST_LAYER_Z = (\d+);/.exec(APP_JSX)?.[1] || 0);
t(toastZ > 0, "app.jsx declares TOAST_LAYER_Z");
t(/zIndex: TOAST_LAYER_Z,/.test(APP_JSX), "ToastHost's wrapper uses TOAST_LAYER_Z");
let maxZ = 0, maxAt = "";
for (const f of readdirSync(ROOT).filter(f => f.endsWith(".jsx"))) {
  const lines = readFileSync(join(ROOT, f), "utf8").split("\n");
  lines.forEach((l, i) => { for (const m of l.matchAll(/zIndex:\s*(\d+)/g)) if (+m[1] > maxZ) { maxZ = +m[1]; maxAt = `${f}:${i + 1}`; } });
}
t(maxZ > 1000, `control: the scan finds the high modal layers (max ${maxZ})`);
t(maxZ < toastZ, `every layer sits below the toast (highest ${maxZ} at ${maxAt}, toast ${toastZ})`);

// ── Real mount ──
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await serverReady(`http://127.0.0.1:${PORT}/index.html`);
const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function run(appSrc, { width = 393, shot = null } = {}) {
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
  if (appSrc !== APP_BUILT) await ctx.route(/\/build\/app\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: appSrc }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof MomentLightbox === "function" && typeof window.plurskyToast === "function"
      && document.getElementById("root")?.children.length > 0 && (window.ARTISTS || []).length > 0, null, { timeout: 60000 });
    // Find the container the real ToastHost renders into (the screens'
    // container), then wait for the probe toast to go.
    await page.evaluate(() => window.plurskyToast("probe", { duration: 200 }));
    const found = await page.waitForFunction(() => {
      const s = [...document.querySelectorAll('[role="status"]')].find(e => e.textContent === "probe");
      if (!s) return false;
      s.parentElement.parentElement.setAttribute("data-toast-parent", "1");
      return true;
    }, null, { timeout: 5000 }).then(() => true, () => false);
    c(found, "the real ToastHost renders a toast");
    await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(e => e.textContent === "probe"), null, { timeout: 5000 });
    // The clip's media never arrives, so preparing the card runs into the cap.
    await page.evaluate(() => {
      window._getPhoto = () => new Promise(() => {});
      const host = document.querySelector("[data-toast-parent]");
      const lb = document.createElement("div"); lb.id = "lb";
      host.insertBefore(lb, host.firstChild);
      const a = window.ARTISTS[0];
      const clip = { id: "c1", festivalId: "acl-2026", night: 1, kind: "video", photoId: "never",
        takenAt: "2026-10-02 20:00", artistId: a.id, tagSource: "time" };
      ReactDOM.createRoot(lb).render(React.createElement(MomentLightbox, { moments: [clip], index: 0, onClose() {}, onIndexChange() {}, onUpdate() {} }));
    });
    const share = page.getByRole("button", { name: /Share this moment/ });
    await share.waitFor({ timeout: 10000 });
    await share.click();
    c(await page.getByRole("button", { name: /Preparing/ }).count() === 1, "tapping Share shows Preparing…");
    const shown = await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(e => /took too long/.test(e.textContent)),
      null, { timeout: 15000, polling: 50 }).then(() => true, () => false);
    c(shown, "the prep cap ends in the timeout toast");
    if (shown) {
      await page.waitForTimeout(300); // past the pill's .15s fade-in
      const v = await page.evaluate(() => {
        const s = [...document.querySelectorAll('[role="status"]')].find(e => /took too long/.test(e.textContent));
        const r = s.getBoundingClientRect();
        // The pill is pointer-events:none (taps pass through it), so hit-test
        // with it switched on for the probe only.
        const pe = s.style.pointerEvents; s.style.pointerEvents = "auto";
        const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.top + 6], [r.right - 6, r.bottom - 6]];
        const hits = pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && s.contains(e); });
        s.style.pointerEvents = pe;
        const lbBox = document.querySelector("#lb > *")?.getBoundingClientRect();
        return { text: s.textContent, opacity: getComputedStyle(s).opacity, r: { l: r.left, t: r.top, rr: r.right, b: r.bottom }, hits, vw: innerWidth, vh: innerHeight,
          lbCovers: !!lbBox && lbBox.left <= r.left && lbBox.right >= r.right && lbBox.top <= r.top && lbBox.bottom >= r.bottom };
      });
      c(v.lbCovers, "control: the open lightbox spans the toast's area (so covering is possible)");
      c(v.r.l >= 0 && v.r.t >= 0 && v.r.rr <= v.vw && v.r.b <= v.vh, `the toast is inside the ${width}px viewport`);
      c(v.hits.every(Boolean), `the toast is on top of the lightbox at its centre and corners (${v.hits.join(",")})`);
      c(v.opacity === "1", `the toast is fully opaque once shown (opacity ${v.opacity})`);
      c(/took too long to make/.test(v.text), "the toast carries the timeout words");
      if (shot) await page.screenshot({ path: shot });
    }
    c(await page.getByRole("button", { name: /Share this moment/ }).count() === 1, "the button returns to Share this moment");
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    c(wide <= 0, `no sideways scroll at ${width}px (${wide}px over)`);
    c(!errors.length, `no page errors (${errors.slice(0, 2).join(" | ")})`);
  } catch (e) { fails.push(`threw: ${e.message.split("\n")[0]}`); }
  await ctx.close();
  return { n, fails };
}

let caught = 0;
const MUTANTS = [["toast back at zIndex 95", [/zIndex: TOAST_LAYER_Z,/, "zIndex: 95,"]]];
try {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  for (const w of [393, 320]) {
    const r = await run(APP_BUILT, { width: w, shot: SHOTS ? join(SHOTS, `share-timeout-toast-${w}.png`) : null });
    checks += r.n; all.push(...r.fails.map(f => `${w}px: ${f}`));
  }
  for (const [name, [re, rep]] of MUTANTS) {
    if (!re.test(APP_BUILT)) { all.push(`mutant "${name}" did not apply (pattern missing)`); continue; }
    const r = await run(APP_BUILT.replace(re, rep), { width: 393 });
    if (r.fails.length) { caught++; console.log(`  mutant "${name}" caught: ${r.fails[0]}`); } else all.push(`mutant "${name}" survived`);
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`  toast-over-modals: ${checks} checks, ${caught}/${MUTANTS.length} mutants caught`);
if (all.length) { for (const f of all) console.log(`  ✗ ${f}`); process.exit(1); }
console.log("  ✓ the share-failure toast is drawn above the lightbox and every modal layer");
