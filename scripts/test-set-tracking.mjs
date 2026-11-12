#!/usr/bin/env node
// Set tracking (set-attendance spec PR 3): the opt-in app-level watcher.
// Pure rules run on the REAL compiled build/data.js in a vm, on a synthetic
// festival (no live data). Static checks read the source's code lines.
//   1. setTrackAppend, one fix at a time, equals attendFixesToIntervals over
//      the same in-order fixes: 400 seeded random walks plus the boundaries.
//   2. What is stored carries no coordinate, even when the raw samples had one.
//   3. Eligibility: measured stages only, live days only.
//   4. Wiring: default off, foreground only, the one fix gate, an off switch
//      in Me, no backup or sync reads the store, no background mode or
//      Always permission in Info.plist.
//   5. Mutations: each rule nudged in the compiled source must fail a check.
//   6. The real app (Ultra 2026, clock fixed on a live day, geolocation
//      stubbed): off by default with no watch, consent → on starts one watch,
//      trusted fixes land as runs with no coordinate, hidden or off stops it.
import vm from "node:vm";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const DATA = readFileSync(join(ROOT, "build", "data.js"), "utf8");
const noop = () => {};

function load(src) {
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = {};
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  vm.runInContext(src, ctx, { filename: "build/data.js" });
  return vm.runInContext(`({ setTrackAppend, setTrackEligibility, attendFixesToIntervals, attendQualifyFixes, ATTEND_GAP_MS })`, ctx);
}

const H = 3600000, M = 60000, D = 86400000;
const MID = Date.UTC(2026, 9, 2, 5);                       // Oct 2 00:00 CDT
// Two measured stages ~400 m apart, one poster-read stage.
const anchors = [
  { stageId: "main", lat: 30.2670, lng: -97.7730, anchorSource: "osm" },
  { stageId: "side", lat: 30.2700, lng: -97.7700, anchorSource: "crowd" },
];
// The registry's shape: gpsAnchors carry src, crowd points sit in crowdAnchors.
const cfgFor = (gpsAnchors, extra = {}) => ({ id: "fixture-fest", tz: "America/Chicago",
  dayDates: { 1: { midnightUtc: MID, m: 9, d: 2 } }, startMs: MID + 12 * H, endMs: MID + 30 * H, gpsAnchors, ...extra });
const MEASURED = [{ stageId: "main", lat: 30.2670, lng: -97.7730, src: "osm" }];
const CROWD = [{ stageId: "side", lat: 30.2700, lng: -97.7700 }];

function fold(S, fixes) { let e = null; for (const f of fixes) e = S.setTrackAppend(e, f); return e || { runs: {} }; }
// Deterministic PRNG (mulberry32) so a failure reproduces.
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function run(S) {
  let checks = 0, failed = 0;
  const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const t0 = MID + 20 * H;

  // ── 1. Incremental runs equal the engine's runs ──────────────────────────
  {
    const r = rng(42);
    let same = 0;
    for (let i = 0; i < 400; i++) {
      const fx = []; let t = t0;
      const n = 2 + Math.floor(r() * 40);
      for (let k = 0; k < n; k++) {
        const u = r();
        t += u < 0.15 ? 0 : u < 0.6 ? Math.floor(r() * 5 * M) : u < 0.8 ? 5 * M + Math.floor(r() * 3) - 1 : Math.floor(r() * 20 * M);
        fx.push({ ms: t, stageId: r() < 0.75 ? "main" : "side" });
      }
      // Same-instant fixes at two stages: the engine sorts them by stage id, the
      // watch delivers them as they come. Drop exact-instant duplicates so the
      // comparison is between two orders the device can produce.
      const dedup = fx.filter((f, k) => k === 0 || f.ms !== fx[k - 1].ms);
      if (JSON.stringify(fold(S, dedup).runs) === JSON.stringify(S.attendFixesToIntervals(dedup))) same++;
      else if (same === i) fails.push(`random walk ${i} differs: ${JSON.stringify(dedup).slice(0, 200)}`);
    }
    check(same === 400, `incremental runs equal attendFixesToIntervals on 400 random walks (${same}/400)`);
    const g = S.ATTEND_GAP_MS;
    const a = fold(S, [{ ms: t0, stageId: "main" }, { ms: t0 + g, stageId: "main" }]).runs.main;
    check(a.length === 1 && a[0].to === t0 + g, "a gap of exactly 5 min extends the run");
    const b = fold(S, [{ ms: t0, stageId: "main" }, { ms: t0 + g + 1, stageId: "main" }]).runs.main;
    check(b.length === 2, "a gap over 5 min starts a new run, the gap is not counted");
    const c = fold(S, [{ ms: t0, stageId: "main" }, { ms: t0 + M, stageId: "side" }, { ms: t0 + 2 * M, stageId: "main" }]).runs;
    check(c.main.length === 2 && c.side.length === 1, "a fix at another stage closes the run");
    const d = fold(S, [{ ms: t0, stageId: "main" }, { ms: t0 + 3 * M, stageId: "main" }, { ms: t0 + M, stageId: "main" }]);
    check(d.runs.main.length === 1 && d.runs.main[0].to === t0 + 3 * M && d.last.ms === t0 + 3 * M, "an older fix is dropped, never reopens or rewinds a run");
    check(fold(S, [{ ms: NaN, stageId: "main" }, { ms: t0 }, null]).runs && Object.keys(fold(S, [{ ms: NaN, stageId: "main" }, { ms: t0 }]).runs).length === 0, "bad fixes are dropped");
    const prev = fold(S, [{ ms: t0, stageId: "main" }]);
    const snap = JSON.stringify(prev);
    S.setTrackAppend(prev, { ms: t0 + M, stageId: "main" });
    check(JSON.stringify(prev) === snap, "setTrackAppend never mutates the stored entry it was given");
  }

  // ── 2. No coordinates stored ─────────────────────────────────────────────
  {
    const samples = [];
    for (let k = 0; k <= 30; k++) samples.push({ lat: 30.26701, lng: -97.77301, accuracy: 8, timestamp: t0 + k * M, atMs: t0 + k * M + 500 });
    const q = S.attendQualifyFixes(samples, anchors);
    check(q.length === 31 && q.every(f => Object.keys(f).sort().join() === "ms,stageId"), "a qualifying fix is { ms, stageId } only");
    const stored = JSON.stringify(fold(S, q));
    check(!/lat|lng|accuracy|30\.267|97\.773/.test(stored), `the stored entry has no coordinate or accuracy (${stored.slice(0, 120)})`);
    const coarse = S.attendQualifyFixes(samples.map(s => ({ ...s, accuracy: 150 })), anchors);
    check(coarse.length === 0, "a coarse fix (±150 m) never reaches the store");
  }

  // ── 3. Eligibility ───────────────────────────────────────────────────────
  {
    const live = MID + 20 * H;
    check(S.setTrackEligibility(cfgFor(MEASURED), live) === "live", "an osm stage + a festival day → live");
    check(S.setTrackEligibility(cfgFor([], { crowdAnchors: CROWD }), live) === "live", "a crowd-measured stage alone → live");
    check(S.setTrackEligibility(cfgFor([]), live) === "no-stages", "no anchors → no-stages");
    check(S.setTrackEligibility(cfgFor([{ stageId: "main", lat: 30.267, lng: -97.773, src: "poster" }, { stageId: "side", lat: 30.27, lng: -97.77 }]), live) === "no-stages", "poster-read or unsourced anchors only → no-stages");
    check(S.setTrackEligibility(cfgFor(MEASURED), MID - 3 * D) === "not-live", "before the festival → not-live");
    check(S.setTrackEligibility(cfgFor(MEASURED), MID + 5 * D) === "ended", "after the festival → ended");
    check(S.setTrackEligibility(null, live) === "no-festival", "no festival → no-festival");
  }
  return { checks, failed, fails };
}

const base = run(load(DATA));
for (const f of base.fails) console.log("  ✗ " + f);

// ── 4. Static wiring (code lines only) ─────────────────────────────────────
const code = f => readFileSync(join(ROOT, f), "utf8").split("\n").filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const chrome = code("chrome.jsx"), app = code("app.jsx"), spot = code("spotify.jsx");
let sChecks = 0, sFailed = 0;
const sCheck = (ok, msg) => { sChecks++; if (!ok) { sFailed++; console.log("  ✗ " + msg); } };
const watcher = (chrome.match(/function SetTrackingWatcher\(\)[\s\S]*?\n}\n/) || [""])[0];
sCheck(!!watcher, "SetTrackingWatcher exists in chrome.jsx");
sCheck(/getSetTracking\(\) === "on"/.test(watcher), "the watcher runs only when the user turned it on (default off)");
sCheck(/document\.visibilityState !== "hidden"/.test(watcher), "the watcher runs only while the page is visible");
sCheck(/setTrackEligibility\(cfg, Date\.now\(\)\) === "live"/.test(watcher), "the watcher runs only on a live festival day with measured stages");
sCheck(/attendQualifyFixes\(/.test(watcher) && /attendEvidenceAnchors\(cfg\)/.test(watcher), "the watcher uses the one fix gate on measured anchors");
sCheck(/clearWatch\(id\)/.test(watcher), "the watcher clears its watch on teardown");
sCheck(/function getSetTracking\(\)[\s\S]{0,200}: null/.test(chrome), "an unset pref reads as never asked (null), not on");
sCheck(/setTrackRecord\(fid, q\[0\]\)/.test(watcher) && !/setTrackRecord\([^)]*(lat|lng|coords)/.test(chrome), "only the qualified { ms, stageId } is recorded");
sCheck(/state\.tab !== "landing" && <SetTrackingWatcher \/>/.test(app), "app.jsx mounts the watcher off General Home only");
sCheck(/<BatterySaverCard \/>\s*<SetTrackingCard \/>/.test(spot), "Me → Settings shows the set-tracking card (the off switch)");
sCheck(/data-set-tracking-off onClick=\{\(\) => setSetTracking\(false\)\}/.test(chrome), "the card's Turn off button switches it off");
sCheck(/data-set-tracking-accept onClick=\{\(\) => \{ setSetTracking\(true\)/.test(chrome) && /data-set-tracking-consent/.test(chrome), "turning it on goes through the consent panel");
sCheck(/Lock the screen and the count pauses/.test(chrome) && /only while Plursky is open/.test(chrome), "the card states the foreground-only limit");
const others = readdirSync(ROOT).filter(f => f.endsWith(".jsx") && f !== "chrome.jsx");
const leak = others.filter(f => /plursky_set_intervals_v1|SET_TRACK_STORE_KEY|getSetTrackIntervals/.test(code(f)));
sCheck(leak.length === 0, `no other file (backup, sync, crew) reads the interval store (${leak.join(", ") || "none"})`);
const plist = readFileSync(join(ROOT, "ios", "App", "App", "Info.plist"), "utf8");
sCheck(!/UIBackgroundModes/.test(plist) && !/NSLocationAlways/.test(plist), "Info.plist has no background mode and no Always permission");
// Positive control: the plist read is real.
sCheck(/NSLocationWhenInUseUsageDescription/.test(plist), "Info.plist read (When-In-Use key present)");

// ── 5. Mutations ───────────────────────────────────────────────────────────
const MUT = [
  ["fix.ms - top.to <= gapMs", "true"],                                    // gap rule gone
  ["e.last.stageId === fix.stageId && top", "top"],                        // another stage no longer closes
  ["if (e.last && fix.ms < e.last.ms) return e;", ""],                     // older fix rewinds
  ["if (!attendEvidenceAnchors(cfg).length) return \"no-stages\";", ""],   // eligibility ignores measured stages
  ["phase === \"live\" ? \"live\"", "phase !== \"ended\" ? \"live\""],     // tracks before the festival
];
let caught = 0, mutFail = 0;
for (const [from, to] of MUT) {
  const n = DATA.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  const r = run(load(DATA.replace(from, to)));
  if (r.failed > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}

// ── 6. The real app ────────────────────────────────────────────────────────
let appChecks = 0, appFail = 0;
const aCheck = (ok, msg) => { appChecks++; if (!ok) { appFail++; console.log(`  ✗  ${msg}`); } };
if (!process.env.SET_TRACKING_SKIP_BROWSER) {
  const { chromium } = await import("playwright");
  const { serverReady } = await import("./lib/server-ready.mjs");
  const { wireVendor } = await import("./lib/vendor-cdn.mjs");
  const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
  const PORT = await reservePort();
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
  const FID = "ultra-miami-2026";
  const LIVE = Date.UTC(2026, 2, 28, 22, 0);          // Sat Mar 28 2026, 6 PM in Miami
  try {
    await serverReady(`http://127.0.0.1:${PORT}/index.html`);
    const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    for (const width of [393, 320]) {
      const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 852 } });
      await wireVendor(ctx);
      await ctx.route(/supabase\.co/, r => r.abort());
      await ctx.addInitScript(fid => {
        localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
        localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
        localStorage.setItem("battery_saver_mode", "off");
        // Live mode (spotify.jsx) runs its own watch on a live day; count only
        // the set-tracking watch, told apart by its callback's source.
        window.__geo = { calls: 0, cleared: 0, cb: null };
        const mine = new Set(); let n = 0;
        Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
          watchPosition: (ok) => { const id = ++n; if (/attendQualifyFixes/.test(String(ok))) { mine.add(id); window.__geo.calls++; window.__geo.cb = ok; } return id; },
          clearWatch: (id) => { if (mine.delete(id)) window.__geo.cleared++; },
          getCurrentPosition: () => {},
        } });
        let hidden = false;
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
        window.__setHidden = (h) => { hidden = h; document.dispatchEvent(new Event("visibilitychange")); };
      }, FID);
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date(LIVE));
      const errors = []; page.on("pageerror", e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.SetTrackingCard === "function", FID, { timeout: 60000 });
      await page.evaluate(() => {
        const host = document.createElement("div"); host.id = "__t"; host.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483000;background:var(--paper);padding:16px"; document.body.appendChild(host);
        ReactDOM.createRoot(host).render(React.createElement(SetTrackingCard));
      });
      await page.waitForTimeout(400);
      const card = page.locator("#__t [data-set-tracking-card]");
      const geo = () => page.evaluate(() => ({ calls: window.__geo.calls, cleared: window.__geo.cleared }));
      const tag = `@${width}`;
      aCheck(await page.evaluate(() => setTrackEligibility(window.FESTIVAL_CONFIG, Date.now())) === "live", `${tag} positive control: Ultra on Mar 28 2026 reads live with measured stages`);
      aCheck(await card.getAttribute("data-set-tracking-state") === "off" && (await geo()).calls === 0, `${tag} default: off, and no location watch started`);
      aCheck(await page.locator("#__t [data-set-tracking-setup]").count() === 1, `${tag} off: a Set up button`);
      await page.locator("#__t [data-set-tracking-setup]").click(); await page.waitForTimeout(200);
      const consent = await page.locator("#__t [data-set-tracking-consent]").innerText().catch(() => "");
      aCheck(/Not recorded:\s*your exact location/.test(consent) && /Nothing leaves this phone/.test(consent) && /only while Plursky is open/.test(consent), `${tag} the consent panel says what is and isn't recorded`);
      aCheck((await geo()).calls === 0, `${tag} opening the consent panel starts nothing`);
      if (process.env.SHOT_DIR || process.env.SET_TRACKING_SHOTS) {
        const dir = process.env.SET_TRACKING_SHOTS || process.env.SHOT_DIR; mkdirSync(dir, { recursive: true });
        await page.locator("#__t").screenshot({ path: join(dir, `set-tracking-consent-${width}.png`) });
      }
      await page.locator("#__t [data-set-tracking-accept]").click(); await page.waitForTimeout(400);
      aCheck(await card.getAttribute("data-set-tracking-state") === "on" && (await geo()).calls === 1, `${tag} Turn on → on, one watch started (${JSON.stringify(await geo())})`);
      aCheck(/Lock the screen and the count pauses/.test(await card.innerText()), `${tag} on: the foreground-only limit is on screen`);
      // Two trusted fixes at the cove stage a minute apart, one coarse fix.
      const cove = await page.evaluate(() => attendEvidenceAnchors(window.FESTIVAL_CONFIG).find(a => a.stageId === "cove"));
      await page.evaluate(([c, t]) => {
        const fx = (lat, lng, acc, ms) => window.__geo.cb({ coords: { latitude: lat, longitude: lng, accuracy: acc }, timestamp: ms });
        fx(c.lat, c.lng, 8, t); fx(c.lat, c.lng, 8, t + 60000); fx(c.lat, c.lng, 400, t + 90000);
      }, [cove, LIVE]);
      await page.waitForTimeout(200);
      const raw = await page.evaluate(() => localStorage.getItem("plursky_set_intervals_v1") || "");
      const st = raw ? JSON.parse(raw) : {};
      const runs = st["ultra-miami-2026"]?.runs?.cove || [];
      aCheck(runs.length === 1 && runs[0].to - runs[0].from === 60000, `${tag} two trusted fixes a minute apart → one 1-min run, the coarse fix ignored (${raw.slice(0, 160)})`);
      aCheck(raw && !/lat|lng|accuracy|25\.77|80\.18/.test(raw), `${tag} the store holds no coordinate`);
      await page.waitForTimeout(100);
      aCheck(await page.locator("#__t [data-set-tracking-clear]").count() === 1, `${tag} with times stored: a Clear button`);
      if (process.env.SHOT_DIR || process.env.SET_TRACKING_SHOTS) {
        const dir = process.env.SET_TRACKING_SHOTS || process.env.SHOT_DIR;
        await page.locator("#__t").screenshot({ path: join(dir, `set-tracking-on-${width}.png`) });
      }
      await page.evaluate(() => window.__setHidden(true)); await page.waitForTimeout(300);
      aCheck((await geo()).cleared === 1, `${tag} page hidden → the watch is cleared`);
      await page.evaluate(() => window.__setHidden(false)); await page.waitForTimeout(300);
      aCheck((await geo()).calls === 2, `${tag} visible again → the watch restarts`);
      await page.locator("#__t [data-set-tracking-off]").click(); await page.waitForTimeout(300);
      aCheck(await card.getAttribute("data-set-tracking-state") === "off" && (await geo()).cleared === 2, `${tag} Turn off → off, the watch is cleared`);
      await page.locator("#__t [data-set-tracking-clear]").click(); await page.waitForTimeout(200);
      aCheck(!JSON.parse(await page.evaluate(() => localStorage.getItem("plursky_set_intervals_v1") || "{}"))["ultra-miami-2026"], `${tag} Clear removes this festival's times`);
      // Off the festival's days the watch never starts, even when on.
      await page.clock.setFixedTime(new Date(Date.UTC(2026, 10, 12, 18)));
      await page.evaluate(() => setSetTracking(true)); await page.waitForTimeout(300);
      aCheck((await geo()).calls === 2 && /is over, so nothing is counting/.test(await card.innerText()), `${tag} on, festival over: no watch, and the card says nothing is counting`);
      await page.clock.setFixedTime(new Date(Date.UTC(2026, 2, 20, 18)));
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("plursky-set-tracking-change"))); await page.waitForTimeout(300);
      aCheck((await geo()).calls === 2 && /starts on .*festival days/.test(await card.innerText()), `${tag} on, a week before: no watch, and the card says when it starts`);
      aCheck(errors.length === 0, `${tag} no page errors (${errors.slice(0, 2).join(" | ")})`);
      await ctx.close();
    }
    await browser.close();
  } finally { server.kill(); }
}

const failed = base.failed + sFailed + mutFail + appFail;
console.log(`${failed ? "✗" : "✓"} set tracking: ${base.checks - base.failed + sChecks - sFailed}/${base.checks + sChecks} checks, ${caught}/${MUT.length} mutations caught, app ${appChecks - appFail}/${appChecks}`);
process.exit(failed ? 1 : 0);
