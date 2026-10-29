#!/usr/bin/env node
// Lost-friend beacon (15-feature program #4): "Where are you?" → FIND ME
// sends the picked stage to the crew thread on the user's tap, stage id and
// tap time only, and it reads as live for 15 minutes.
//   1. Body: _formatBeaconBody / _parseBeacon round-trip on the REAL compiled
//      build/supabase.js in a vm. The body is festival + stage + time and
//      nothing else (no free text, no lat/lng); no stage, no festival or no
//      time → no body. beaconLiveUntil is tap + 15 min, and a tap time ahead
//      of the clock counts from now.
//   2. App (headless Chrome, Supabase blocked, the send stubbed on window):
//      the sheet with a crew code posts exactly the formatted body for the
//      active festival and reads CREW CAN FIND YOU; without a crew code the
//      button is disabled and nothing posts. In the thread a live beacon names
//      the sender and the stage, "On my way" posts a reply once; an old
//      beacon reads Ended with no reply; mine has no reply; another
//      festival's names that festival. Crewmates' beacons carry report/block.
//   3. Mutations on the compiled source must each fail a check.
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPA = readFileSync(join(ROOT, "build", "supabase.js"), "utf8");
const MAPSRC = readFileSync(join(ROOT, "map.jsx"), "utf8");
const noop = () => {};

function load(src) {
  const store = {};
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:", origin: "http://x" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, createElement: () => ({ style: {} }), head: { appendChild: noop }, body: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    supabase: { createClient: () => null }, FESTIVAL_CONFIG: { id: "fixture-fest" },
    _DATA_SETS: { "edc-orlando-2026": { stages: [{ id: "kinetic" }] } },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "build/supabase.js" });
  return vm.runInContext(`({ _formatBeaconBody, _parseBeacon, beaconLiveUntil, BEACON_TTL_MS, _parseMeetup, _parsePoll })`, ctx);
}

function unit(F) {
  let checks = 0, failed = 0; const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const T = Date.UTC(2026, 10, 7, 2, 40);
  const body = F._formatBeaconBody("kinetic", "edc-orlando-2026", T);
  check(body === `[BEACON edc-orlando-2026 kinetic ${T}]`, `body format (got ${body})`);
  const p = F._parseBeacon(body);
  check(p && p.festivalId === "edc-orlando-2026" && p.stageId === "kinetic" && p.ts === T, `round trip (got ${JSON.stringify(p)})`);
  check(p && Object.keys(p).sort().join() === "festivalId,stageId,ts", "the parsed beacon has exactly festival, stage, time");
  check(F._parseBeacon(`${body} come find me`) === null && F._parseBeacon(`[BEACON edc-orlando-2026 kinetic ${T}] 28.53,-81.40`) === null, "nothing can ride after the beacon (no text, no coordinates)");
  check(F._formatBeaconBody("", "f-1", T) === null && F._formatBeaconBody(null, "f-1", T) === null, "no stage → no body (stage-level only)");
  check(F._formatBeaconBody("kinetic", "", T) === null, "no festival → no body");
  check(F._formatBeaconBody("kinetic", "f-1", "now") === null, "no time → no body");
  check(F._formatBeaconBody("two words", "f-1", T) === null && F._formatBeaconBody("kinetic", "Bad Fest", T) === null, "an id the parser can't read → no body");
  check(F._parseBeacon(`[BEACON f-1 kinetic 12]`) === null, "a short time is not a beacon");
  check(F._parseMeetup(body) === null && F._parsePoll(body) === null, "a beacon is neither a meetup nor a poll");
  check(F._parseBeacon(`[MEETUP f-1 kinetic ${T}] x`) === null, "a meetup is not a beacon");
  check(F.BEACON_TTL_MS === 15 * 60 * 1000, "live for 15 minutes");
  check(F.beaconLiveUntil({ ts: T }, T + 60e3) === T + 15 * 60e3, "live until tap + 15 min");
  check(F._parseBeacon(`[BEACON edc-orlando-2026 amex ${T}]`) === null, "a stage its festival doesn't have is not a beacon");
  check(F._formatBeaconBody("amex", "edc-orlando-2026", T) === null, "…and can't be sent");
  check(F._parseBeacon(`[BEACON zz-fest stage1 ${T}]`)?.festivalId === "zz-fest", "a festival this build doesn't know still parses (named only)");
  check(F.beaconLiveUntil({ ts: T + 3600e3 }, T) === T + 15 * 60e3, "a tap time ahead of the clock counts from now");
  return { checks, failed, fails };
}

const base = unit(load(SUPA));
for (const f of base.fails) console.log(`  ✗  ${f}`);
const MUT = [
  ["(\\d{12,14})\\]$/", "(\\d{2,14})\\]/"],
  ["(\\d{12,14})\\]$/", "(\\d{12,14})\\]/"],
  ["if (!festivalId || !stageId || !Number.isFinite(at)) return null;", "if (!festivalId || !Number.isFinite(at)) return null;"],
  ["return _parseBeacon(body) ? body : null;", "return body;"],
  ["Math.min(b.ts, now) + BEACON_TTL_MS", "b.ts + BEACON_TTL_MS"],
  ["BEACON_TTL_MS = 15 * 60 * 1000;", "BEACON_TTL_MS = 60 * 60 * 1000;"],
  ["if (!m || _meetupStageKnown(m[1], m[2]) === false) return null;", "if (!m) return null;"],
];
let caught = 0, mutFail = 0;
for (const [from, to] of MUT) {
  const n = SUPA.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  let r; try { r = unit(load(SUPA.replace(from, to))); } catch { r = { failed: 1 }; }
  if (r.failed > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}

// Static: the fake local broadcast is gone and the sheet sends no coordinates.
let statFail = 0; const stat = [];
const sCheck = (ok, msg) => { stat.push(ok); if (!ok) { statFail++; console.log(`  ✗  ${msg}`); } };
const codeLines = MAPSRC.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
sCheck(!/broadcastMyLocation/.test(codeLines), "map.jsx no longer writes the fake 'I'm at' threads");
const sheet = codeLines.slice(codeLines.indexOf("function IAmAtSheet"), codeLines.indexOf("function _nextSunriseEpochMs"));
sCheck(sheet.length > 500 && /_formatBeaconBody\(selected, FESTIVAL_CONFIG\.id/.test(sheet), "the sheet formats the beacon from the picked stage");
sCheck(!/\b(lat|lng|latitude|longitude|coords)\b|geolocation/i.test(sheet), "the sheet reads no position");

// ── App ──
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
  for (const withCrew of [true, false]) {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
    await wireVendor(ctx);
    await ctx.route(/supabase\.co/, r => r.abort());
    await ctx.addInitScript(([fid, crew]) => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      if (crew) localStorage.setItem("plursky_group_code", "TST123");
    }, [FID, withCrew]);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.BeaconCard === "function" && typeof window.IAmAtSheet === "function", FID, { timeout: 60000 });
    await page.evaluate(() => {
      window.__sent = [];
      window.sbCrewSendMessage = async (code, pid, name, body) => { window.__sent.push({ code, body }); return { error: null, queued: false }; };
      const host = document.createElement("div"); host.id = "__sheet"; host.style.cssText = "position:fixed;inset:0;z-index:2147483000"; document.body.appendChild(host);
      ReactDOM.createRoot(host).render(React.createElement(IAmAtSheet, { initialStage: "kinetic", onClose: () => {}, onStatusSet: () => {} }));
    });
    await page.waitForTimeout(400);
    const btn = page.locator("#__sheet [data-find-me-send]");
    aCheck(await btn.count() === 1, "the sheet has the FIND ME button");
    if (!withCrew) {
      aCheck(await btn.isDisabled() && /JOIN A CREW FIRST/.test(await btn.innerText()), "no crew code → the button is disabled and says so");
      await btn.click({ force: true }); await page.waitForTimeout(150);
      aCheck((await page.evaluate(() => window.__sent)).length === 0, "no crew code → nothing posts");
      aCheck(errors.length === 0, `no page errors without a crew (${errors.slice(0, 2).join(" | ")})`);
      await ctx.close(); continue;
    }
    aCheck(/NO GPS/.test(await page.locator("#__sheet [data-find-me-note]").innerText()), "the sheet says the crew sees the stage only");
    const t0 = Date.now();
    await btn.click(); await page.waitForTimeout(200);
    const sent = await page.evaluate(() => window.__sent);
    const m = sent.length === 1 && /^\[BEACON edc-lv-2026 kinetic (\d+)\]$/.exec(sent[0].body);
    aCheck(m && sent[0].code === "TST123" && Math.abs(+m[1] - t0) < 5000, `the tap posts exactly one beacon for the picked stage at tap time (got ${JSON.stringify(sent)})`);
    aCheck(/CREW CAN FIND YOU/.test(await btn.innerText()) && await btn.isDisabled(), "the button reads CREW CAN FIND YOU and can't post twice");
    aCheck(JSON.parse(await page.evaluate(() => localStorage.getItem("status_me")) || "{}").stage === "kinetic", "the pick is kept as my status");
    if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, "crew-beacon-sheet.png") });
    await page.evaluate(() => document.getElementById("__sheet").remove());
    const stageName = await page.evaluate(() => STAGES.find(s => s.id === "kinetic").name);
    await page.evaluate(([fid]) => {
      window.__sent = [];
      const now = Date.now();
      const row = (id, body, who, name) => ({ id, sender_pid: who, sender_name: name, body, created_at: new Date().toISOString() });
      const rows = [
        row(1, `[BEACON ${fid} kinetic ${now - 120e3}]`, "p-sam", "Sam"),
        row(2, `[BEACON ${fid} kinetic ${now - 40 * 60e3}]`, "p-sam", "Sam"),
        row(3, `[BEACON ${fid} kinetic ${now}]`, "p-me", "Me"),
        row(4, `[BEACON acl-2026 amex ${now}]`, "p-ana", "Ana"),
      ];
      window.sbCrewFetchMessages = async () => rows;
      window.sbCrewSubscribeMessages = () => () => {};
      const host = document.createElement("div"); host.id = "__chat"; host.style.cssText = "position:fixed;inset:0;z-index:2147483000;overflow:auto;background:var(--paper)"; document.body.appendChild(host);
      ReactDOM.createRoot(host).render(React.createElement(CrewChat, { code: "TST123", myPid: "p-me", myName: "Me" }));
    }, [FID]);
    await page.waitForTimeout(800);
    const cards = page.locator("#__chat [data-crew-beacon]");
    aCheck(await cards.count() === 4, `four beacon cards (got ${await cards.count()})`);
    const t = i => cards.nth(i).innerText();
    aCheck(await cards.nth(0).getAttribute("data-crew-beacon") === "live" && (await t(0)).includes(`Sam is at ${stageName}`) && /Live for 13 more min/.test(await t(0)), `a 2-min-old beacon is live and names Sam and the stage (got "${(await t(0)).replace(/\n/g, " / ")}")`);
    aCheck(await cards.nth(1).getAttribute("data-crew-beacon") === "ended" && /Ended/.test(await t(1)) && await cards.nth(1).locator("[data-crew-beacon-reply]").count() === 0, "a 40-min-old beacon reads Ended, no reply");
    aCheck((await t(2)).includes(`You are at ${stageName}`) && await cards.nth(2).locator("[data-crew-beacon-reply]").count() === 0, "my own beacon has no reply");
    aCheck(/Ana is at ACL/i.test(await t(3)) && await cards.nth(3).locator("[data-crew-beacon-reply]").count() === 0, `another festival's beacon names it, no reply (got "${(await t(3)).replace(/\n/g, " / ")}")`);
    aCheck(await page.locator('#__chat [data-crew-card-moderation="beacon"]').count() === 3, "crewmates' beacons carry report/block, mine none");
    const reply = cards.nth(0).locator("[data-crew-beacon-reply]");
    await reply.click(); await page.waitForTimeout(200);
    const rs = await page.evaluate(() => window.__sent);
    aCheck(rs.length === 1 && rs[0].body === `On my way to ${stageName}` && rs[0].code === "TST123", `On my way posts one reply (got ${JSON.stringify(rs)})`);
    aCheck(await reply.isDisabled() && /Sent: on my way/.test(await reply.innerText()), "the reply can't post twice");
    if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, "crew-beacon-thread.png") });
    aCheck(!/\[BEACON/.test(await page.locator("#__chat").innerText()), "the raw [BEACON …] body never shows");
    aCheck(errors.length === 0, `no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }

const failed = base.failed + mutFail + statFail + appFail;
console.log(`${failed ? "✗" : "✓"} crew beacon: ${base.checks - base.failed}/${base.checks} body checks, ${stat.length - statFail}/${stat.length} static, ${appChecks - appFail}/${appChecks} app checks, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
