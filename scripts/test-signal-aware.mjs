#!/usr/bin/env node
// Battery / signal-aware mode (15-feature program #5).
//   1. Policy (vm on the REAL chrome.jsx / supabase.jsx source slices):
//      _bsLowSignal is true on 2G, slow-2G or Data Saver, or after 2 queued
//      crew sends in 5 minutes; never when offline (that is OFFLINE); one
//      queued send is not enough, a delivered send clears it, and queued sends
//      older than 5 minutes drop out. plurskyNetSaver = battery saver OR weak
//      signal. The crew heartbeat is 20s, 60s under the saver.
//   2. App (headless Chrome, Supabase blocked): the heartbeat really schedules
//      at 60s under a weak signal and 20s after it clears; the status strip
//      shows WEAK SIGNAL from emulated 2G (CDP) and from queued sends, not on
//      a good line, and OFFLINE (not WEAK SIGNAL) when offline; the Battery
//      Saver card says what weak signal changes, and no longer promises a
//      2 AM trigger the code doesn't have.
//   3. Static: the data export reads the battery saver's real key; the
//      auto-backup effect asks plurskyNetSaver.
//   4. Mutations on the policy slices must each fail a check.
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = readFileSync(join(ROOT, "chrome.jsx"), "utf8");
const SUPA = readFileSync(join(ROOT, "supabase.jsx"), "utf8");
const SPOT = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
const slice = (src, from, to) => { const i = src.indexOf(from), j = src.indexOf(to, i); return i >= 0 && j > i ? src.slice(i, j) : ""; };
const POLICY = slice(CHROME, "const _BS_FAIL_WINDOW_MS", "\n}\n\nfunction _bsHasFestivalContext") + "\n}\n";
const HB = slice(SUPA, "const PRES_HEARTBEAT_MS", "\nfunction _startPresenceHeartbeat");

function unit(policySrc, hbSrc) {
  let checks = 0, failed = 0; const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const mk = () => {
    const ctx = { navigator: { onLine: true }, Date, _BS: { active: false, net: { effectiveType: null, saveData: false, failTs: [] }, listeners: new Set() } };
    vm.createContext(ctx);
    vm.runInContext(policySrc + "\n" + hbSrc + "\n;globalThis.F = { _bsLowSignal, plurskyNetSaver, plurskyNoteNetQueued, _presHeartbeatMs, PRES_HEARTBEAT_MS, PRES_HEARTBEAT_SAVER_MS };", ctx);
    return ctx;
  };
  let c = mk();
  check(c.F._bsLowSignal() === false && c.F.plurskyNetSaver() === false, "a good line: no weak signal, no saver");
  check(c.F._presHeartbeatMs() === 20000, "heartbeat 20s on a good line");
  for (const t of ["2g", "slow-2g"]) { c = mk(); c._BS.net.effectiveType = t; check(c.F._bsLowSignal() === true, `${t} is a weak signal`); }
  c = mk(); c._BS.net.effectiveType = "3g"; check(c.F._bsLowSignal() === false, "3G is not a weak signal");
  c = mk(); c._BS.net.saveData = true; check(c.F._bsLowSignal() === true, "Data Saver is a weak signal");
  c = mk(); c._BS.net.effectiveType = "2g"; c.navigator.onLine = false; check(c.F._bsLowSignal() === false, "offline is OFFLINE, not weak signal");
  c = mk(); c.F.plurskyNoteNetQueued(true); check(c.F._bsLowSignal() === false, "one queued send is not a weak signal");
  c.F.plurskyNoteNetQueued(true); check(c.F._bsLowSignal() === true, "two queued sends in 5 min are a weak signal");
  check(c.F._presHeartbeatMs() === 60000, "heartbeat 60s under a weak signal");
  c.F.plurskyNoteNetQueued(false); check(c.F._bsLowSignal() === false, "a delivered send clears it");
  c = mk(); c._BS.net.failTs = [Date.now() - 6 * 60e3, Date.now() - 5.5 * 60e3]; check(c.F._bsLowSignal() === false, "queued sends older than 5 min drop out");
  c.F.plurskyNoteNetQueued(true); check(c._BS.net.failTs.length === 1, "old queued sends are pruned on the next one");
  let fired = 0; c._BS.listeners.add(() => fired++); c.F.plurskyNoteNetQueued(true); check(fired === 1, "a queued send notifies the saver listeners (the strip re-renders)");
  c = mk(); c._BS.active = true; check(c.F.plurskyNetSaver() === true && c.F._presHeartbeatMs() === 60000, "battery saver alone also stretches the heartbeat");
  check(c.F.PRES_HEARTBEAT_SAVER_MS < 90000, "the saver heartbeat stays inside the 90s stale cutoff");
  return { checks, failed, fails };
}

const base = POLICY.length > 200 && HB.length > 100 ? unit(POLICY, HB) : { checks: 1, failed: 1, fails: ["policy slices not found"] };
for (const f of base.fails) console.log(`  ✗  ${f}`);
const MUT = [
  [POLICY, "POLICY", 'n.effectiveType === "2g"', 'n.effectiveType === "3g"'],
  [POLICY, "POLICY", "n.saveData || ", ""],
  [POLICY, "POLICY", ".length >= 2", ".length >= 1"],
  [POLICY, "POLICY", "now - t < _BS_FAIL_WINDOW_MS).length", "true).length"],
  [POLICY, "POLICY", 'navigator.onLine === false) return false;', 'navigator.onLine === false) {}'],
  [POLICY, "POLICY", "queued ? [..._BS.net.failTs.filter(t => now - t < _BS_FAIL_WINDOW_MS), now] : []", "queued ? [..._BS.net.failTs.filter(t => now - t < _BS_FAIL_WINDOW_MS), now] : _BS.net.failTs"],
  [POLICY, "POLICY", "return !!_BS.active || _bsLowSignal();", "return _bsLowSignal();"],
  [HB, "HB", "PRES_HEARTBEAT_SAVER_MS = 60000", "PRES_HEARTBEAT_SAVER_MS = 120000"],
];
let caught = 0, mutFail = 0;
for (const [src, which, from, to] of MUT) {
  const n = src.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  const m = src.replace(from, to);
  let r; try { r = which === "POLICY" ? unit(m, HB) : unit(POLICY, m); } catch { r = { failed: 1 }; }
  if (r.failed > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}

// Static
let statFail = 0, statN = 0;
const sCheck = (ok, msg) => { statN++; if (!ok) { statFail++; console.log(`  ✗  ${msg}`); } };
const code = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const exportFn = slice(code(SUPA), "async function sbExportUserData", "const json = JSON.stringify(payload");
sCheck(/const BATTERY_SAVER_KEY = "battery_saver_mode";/.test(CHROME), "positive control: the battery saver's key is battery_saver_mode");
sCheck(exportFn.length > 300 && /batterySaver:\s*safeLs\("battery_saver_mode"\)/.test(exportFn) && !/plursky_battery_saver/.test(exportFn), "the export reads the battery saver's real key");
const autoFx = slice(code(SPOT), "if (!autoOn || !_isPlusSub() || !_onWifi()", "_backupMyWeekend()");
sCheck(autoFx.length > 0 && /plurskyNetSaver\(\)\) return;/.test(autoFx), "auto-backup waits under plurskyNetSaver");
sCheck(/_heartbeatId = setTimeout\(beat, _presHeartbeatMs\(\)\)/.test(code(SUPA)) && !/_heartbeatId = setInterval/.test(code(SUPA)), "the heartbeat re-reads the policy every beat");

// App
let appChecks = 0, appFail = 0;
const aCheck = (ok, msg) => { appChecks++; if (!ok) { appFail++; console.log(`  ✗  ${msg}`); } };
const { chromium } = await import("playwright");
const { serverReady } = await import("./lib/server-ready.mjs");
const { wireVendor } = await import("./lib/vendor-cdn.mjs");
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "edc-lv-2026";
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
  await wireVendor(ctx);
  await ctx.route(/supabase\.co/, r => r.abort());
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    localStorage.setItem("battery_saver_mode", "off");
  }, FID);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.plurskyNetSaver === "function" && typeof window.StatusStrip === "function", FID, { timeout: 60000 });
  await page.evaluate(() => {
    const host = document.createElement("div"); host.id = "__t"; host.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483000;background:var(--paper)"; document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement("div", null, React.createElement(StatusStrip), React.createElement(BatterySaverCard)));
  });
  await page.waitForTimeout(300);
  const weak = () => page.locator("#__t [data-status-weak-signal]").count();
  const strip = () => page.locator("#__t").innerText();
  aCheck(await weak() === 0 && await page.evaluate(() => plurskyNetSaver()) === false, "a good line: no WEAK SIGNAL, no saver");
  aCheck(!/2 AM/.test(await strip()) && /crew location updates slow to once a minute/.test(await strip()), "the saver card says what weak signal changes and drops the 2 AM promise");
  // Heartbeat really reschedules on the policy.
  const hbDelays = () => page.evaluate(() => {
    const seen = []; const real = window.setTimeout;
    window.setTimeout = (fn, ms, ...a) => { seen.push(ms); return real(fn, ms, ...a); };
    try { _startPresenceHeartbeat(); } finally { window.setTimeout = real; _stopPresenceHeartbeat(); }
    return seen;
  });
  aCheck(JSON.stringify(await hbDelays()) === "[20000]", "the heartbeat schedules at 20s on a good line");
  // Queued sends → weak signal (works without navigator.connection, e.g. iOS).
  await page.evaluate(() => { plurskyNoteNetQueued(true); plurskyNoteNetQueued(true); });
  await page.waitForTimeout(200);
  aCheck(await weak() === 1, "two queued crew sends → WEAK SIGNAL in the strip");
  aCheck(/Weak signal now/.test(await strip()), "the saver card says weak signal now");
  aCheck(JSON.stringify(await hbDelays()) === "[60000]", "the heartbeat schedules at 60s under a weak signal");
  await page.evaluate(() => plurskyNoteNetQueued(false)); await page.waitForTimeout(200);
  aCheck(await weak() === 0 && JSON.stringify(await hbDelays()) === "[20000]", "a delivered send clears it and the heartbeat is back to 20s");
  // Emulated 2G through the browser's own connection signal.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 1800, downloadThroughput: 6000, uploadThroughput: 6000, connectionType: "cellular2g" });
  await page.waitForFunction(() => ["2g", "slow-2g"].includes(navigator.connection?.effectiveType), null, { timeout: 10000 }).catch(() => {});
  const et = await page.evaluate(() => navigator.connection?.effectiveType || null);
  await page.waitForTimeout(300);
  aCheck(["2g", "slow-2g"].includes(et) && await weak() === 1, `emulated 2G (effectiveType ${et}) → WEAK SIGNAL`);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.waitForFunction(() => !["2g", "slow-2g"].includes(navigator.connection?.effectiveType), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  aCheck(await weak() === 0, "back on a good line → no WEAK SIGNAL");
  await page.evaluate(() => { plurskyNoteNetQueued(true); plurskyNoteNetQueued(true); });
  await ctx.setOffline(true); await page.waitForTimeout(300);
  aCheck(await weak() === 0 && /OFFLINE/.test(await strip()), "offline shows OFFLINE, not WEAK SIGNAL");
  await ctx.setOffline(false); await page.waitForTimeout(300);
  aCheck(await weak() === 0, "coming back online clears the queued-send count");
  if (process.env.SHOT_DIR) {
    await page.evaluate(() => { plurskyNoteNetQueued(true); plurskyNoteNetQueued(true); }); await page.waitForTimeout(200);
    await page.screenshot({ path: join(process.env.SHOT_DIR, "signal-aware.png") });
  }
  aCheck(errors.length === 0, `no page errors (${errors.slice(0, 2).join(" | ")})`);
  await browser.close();
} finally { server.kill(); }

const failed = base.failed + mutFail + statFail + appFail;
console.log(`${failed ? "✗" : "✓"} signal-aware: ${base.checks - base.failed}/${base.checks} policy checks, ${statN - statFail}/${statN} static, ${appChecks - appFail}/${appChecks} app checks, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
