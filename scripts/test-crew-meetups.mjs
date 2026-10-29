#!/usr/bin/env node
// Crew meetups (15-feature program #3): a meetup goes to the crew thread on
// the user's tap, stage and time only, and comes back as a card a crewmate
// adds to their own meetups in one tap.
//   1. Body: _formatMeetupBody / _parseMeetup round-trip on the REAL compiled
//      build/supabase.js in a vm. "||" and line breaks in a name or note
//      cannot break the parse; no festival, no name or no time → no body.
//      The body carries festival, stage id, time, name and notes, nothing
//      else (no lat/lng can ride along).
//      Festival scope (#374 review): a row goes out only under its own
//      festival, a legacy row with no festival never does, a stage the
//      festival doesn't have never does, and a body naming one doesn't parse.
//   2. meetupKey: one festival + place + time + name is one meetup, whatever
//      the case or spacing of the name.
//   3. App (headless Chrome, network to Supabase blocked, the send and fetch
//      stubbed on window): MEETUPS sheet → SEND TO CREW posts exactly the
//      formatted body for the active festival and reads SENT; with no crew
//      code there is no button. The crew thread renders the body as a card
//      (stage name, the note), Add puts it in my meetups once, and a second
//      card for the same meetup reads "In your meetups". A card for another
//      festival names it and offers no Add.
//   4. Mutations on the compiled source must each fail a check.
import vm from "node:vm";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPA = readFileSync(join(ROOT, "build", "supabase.js"), "utf8");
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
    _DATA_SETS: {
      "edc-orlando-2026": { stages: [{ id: "kinetic" }, { id: "neon" }] },
      "f-1": { stages: [{ id: "kinetic" }] },
      "acl-2026": { stages: [{ id: "amex" }] },
      // Known here with a valid stage, but an id the body regex can't carry:
      // only the format's own parse-back guard can refuse it.
      "Bad Fest": { stages: [{ id: "kinetic" }] },
    },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "build/supabase.js" });
  return vm.runInContext(`({ _formatMeetupBody, _parseMeetup, meetupKey })`, ctx);
}

function unit(F) {
  let checks = 0, failed = 0; const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const AT = Date.UTC(2026, 10, 7, 2, 40);
  const m = { festivalId: "edc-orlando-2026", name: "Kinetic flag", stageId: "kinetic", atTs: AT, notes: "left of the owl" };
  const m1 = { ...m, festivalId: "f-1" };
  const body = F._formatMeetupBody(m, "edc-orlando-2026");
  check(body === `[MEETUP edc-orlando-2026 kinetic ${AT}] Kinetic flag || left of the owl`, `body format (got ${body})`);
  const p = F._parseMeetup(body);
  check(p && p.festivalId === "edc-orlando-2026" && p.stageId === "kinetic" && p.atTs === AT && p.name === "Kinetic flag" && p.notes === "left of the owl", `round trip (got ${JSON.stringify(p)})`);
  check(p && Object.keys(p).sort().join() === "atTs,festivalId,name,notes,stageId", "the parsed meetup has exactly festival, stage, time, name, notes");
  const g = F._formatMeetupBody({ ...m, lat: 28.53, lng: -81.40, gps: { lat: 1, lng: 2 } }, "edc-orlando-2026");
  check(g === body && !/28\.53|81\.40/.test(g), "coordinates on the meetup never reach the body");
  const noStage = F._formatMeetupBody({ ...m, stageId: null, notes: "" }, "edc-orlando-2026");
  check(noStage === `[MEETUP edc-orlando-2026 - ${AT}] Kinetic flag`, `no stage, no note (got ${noStage})`);
  const pn = F._parseMeetup(noStage);
  check(pn && pn.stageId === null && pn.notes === "", "no stage parses as null, no note as empty");
  const evil = F._formatMeetupBody({ ...m, name: "A || B\nC", notes: "x || y\nz" }, "edc-orlando-2026");
  const pe = F._parseMeetup(evil);
  check(pe && pe.name === "A | B C" && pe.notes === "x | y z", `"||" and line breaks are flattened, the parse holds (got ${JSON.stringify(pe)})`);
  check(F._formatMeetupBody({ ...m1, name: "x".repeat(80), notes: "y".repeat(300) }, "f-1").length <= 500, "the body fits the 500-char message cap");
  check(F._parseMeetup(F._formatMeetupBody({ ...m1, name: "x".repeat(80) }, "f-1")).name.length === 60, "name capped at 60");
  check(F._formatMeetupBody({ ...m1, name: "  " }, "f-1") === null, "no name → no body");
  check(F._formatMeetupBody(m, "") === null, "no festival → no body");
  check(F._formatMeetupBody({ ...m1, atTs: "soon" }, "f-1") === null, "no time → no body");
  check(F._formatMeetupBody({ ...m, festivalId: "Bad Fest" }, "Bad Fest") === null, "a festival id the parser can't read → no body (never an unparseable post)");
  check(F._formatMeetupBody({ ...m1, stageId: "two words" }, "f-1") === null, "a stage id the parser can't read → no body");
  check(F._parseMeetup("[MEETUP edc-orlando-2026 kinetic 12] hi") === null, "a short time is not a meetup");
  check(F._parseMeetup("let's meet at kinetic") === null, "plain chat is not a meetup");
  check(F._parseMeetup(`[POLL abcdef12] q || a || b`) === null, "a poll is not a meetup");
  // Festival scope (#374 review): a row only goes out under its own festival.
  check(F._formatMeetupBody({ ...m, festivalId: "acl-2026", stageId: "amex" }, "edc-orlando-2026") === null, "another festival's meetup never goes out under this festival");
  const { festivalId: _drop, ...legacy } = m;
  check(F._formatMeetupBody(legacy, "edc-orlando-2026") === null, "a legacy row with no festival is never relabelled");
  check(F._formatMeetupBody({ ...m, stageId: "amex" }, "edc-orlando-2026") === null, "a stage this festival doesn't have → no body");
  check(F._formatMeetupBody({ ...m, festivalId: "zz-fest" }, "zz-fest") === null, "a festival this build doesn't know → no body");
  check(F._formatMeetupBody({ ...m, stageId: null }, "edc-orlando-2026") !== null, "no stage stays allowed");
  check(F._parseMeetup(`[MEETUP edc-orlando-2026 amex ${AT}] Wrong`) === null, "a body naming a stage its festival doesn't have is not a meetup");
  const pu = F._parseMeetup(`[MEETUP zz-fest stage1 ${AT}] Elsewhere`);
  check(pu && pu.festivalId === "zz-fest", "a festival this build doesn't know still parses (named, never added)");
  // meetupKey
  check(F.meetupKey(m) === F.meetupKey({ ...m, name: "  KINETIC   flag ", notes: "other" }), "same place, time and name (any case or spacing) is one meetup");
  check(F.meetupKey(m) !== F.meetupKey({ ...m, atTs: AT + 60000 }), "another time is another meetup");
  check(F.meetupKey(m) !== F.meetupKey({ ...m, stageId: "neon" }), "another stage is another meetup");
  check(F.meetupKey(m) !== F.meetupKey({ ...m, festivalId: "acl-2026" }), "another festival is another meetup");
  return { checks, failed, fails };
}

const base = unit(load(SUPA));
for (const f of base.fails) console.log(`  ✗  ${f}`);
const MUT = [
  ['.replace(/\\|\\|/g, "|")', ""],
  ["(\\d{12,14})\\] (.+?)", "(\\d{2,14})\\] (.+?)"],
  ['m[2] === "-" ? null : m[2]', "m[2]"],
  [".toLowerCase()}`", "}`"],
  ["if (m.festivalId !== festivalId || _meetupStageKnown(festivalId, m.stageId) !== true) return null;", "if (_meetupStageKnown(festivalId, m.stageId) !== true) return null;"],
  ["_meetupStageKnown(festivalId, m.stageId) !== true", "_meetupStageKnown(festivalId, m.stageId) === false"],
  ['if (m[2] !== "-" && _meetupStageKnown(m[1], m[2]) === false) return null;', ""],
  ['`${m && m.festivalId || "-"}|${m && m.stageId', '`${m && m.stageId'],
  ["return _parseMeetup(body) ? body : null;", "return body;"],
];
let caught = 0, mutFail = 0;
for (const [from, to] of MUT) {
  const n = SUPA.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  let r; try { r = unit(load(SUPA.replace(from, to))); } catch { r = { failed: 1 }; }
  if (r.failed > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}

// ── 3. App ──
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
      // m1 is this festival's. m-acl was saved at ACL (the #374 review repro:
      // switch festivals, Send must not emit it as this one); m-old is a
      // legacy row with no festival, hidden and never relabelled.
      localStorage.setItem("plursky_meetups_v1", JSON.stringify([
        { id: "m1", festivalId: fid, name: "Kinetic flag", stageId: "kinetic", atTs: Date.now() + 3600e3, notes: "left of the owl", createdAt: 1 },
        { id: "m-acl", festivalId: "acl-2026", name: "Amex flag", stageId: "amex", atTs: Date.now() + 3600e3, notes: "", createdAt: 1 },
        { id: "m-old", name: "Old pin", stageId: "kinetic", atTs: Date.now() + 3600e3, notes: "", createdAt: 1 },
      ]));
    }, [FID, withCrew]);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.MeetupCard === "function", FID, { timeout: 60000 });
    await page.evaluate(() => {
      window.__sent = [];
      window.sbCrewSendMessage = async (code, pid, name, body) => { window.__sent.push({ code, body }); return { error: null, queued: false }; };
    });
    // Open MEETUPS through the map's own sheet, mounted directly (the More
    // menu's position moves with the map chrome; the sheet is what's tested).
    await page.evaluate(() => {
      const host = document.createElement("div"); host.id = "__meet"; host.style.cssText = "position:fixed;inset:0;z-index:2147483000"; document.body.appendChild(host);
      ReactDOM.createRoot(host).render(React.createElement(MeetupsSheet, { onClose: () => {} }));
    });
    await page.waitForTimeout(400);
    const btn = page.locator('[data-meetup-send="m1"]');
    if (!withCrew) {
      aCheck(await btn.count() === 0, "no crew code → no SEND TO CREW button");
      aCheck(errors.length === 0, `no page errors without a crew (${errors.slice(0, 2).join(" | ")})`);
      await ctx.close(); continue;
    }
    aCheck(await btn.count() === 1, "a crew code → SEND TO CREW on the meetup");
    aCheck(await page.locator('[data-meetup-send="m-acl"], [data-meetup-send="m-old"]').count() === 0 && !/Amex flag|Old pin/.test(await page.locator("#__meet").innerText()),
      "another festival's meetup and a legacy unscoped one are not listed here and offer no Send");
    aCheck(await page.evaluate(fid => _formatMeetupBody(JSON.parse(localStorage.getItem("plursky_meetups_v1")).find(m => m.id === "m-acl"), fid), FID) === null,
      "the ACL meetup can't be formatted as this festival's");
    await btn.click(); await page.waitForTimeout(200);
    const sent = await page.evaluate(() => window.__sent);
    const atTs = await page.evaluate(() => JSON.parse(localStorage.getItem("plursky_meetups_v1")).find(m => m.id === "m1").atTs);
    aCheck(sent.length === 1 && sent[0].code === "TST123" && sent[0].body === `[MEETUP ${FID} kinetic ${atTs}] Kinetic flag || left of the owl`, `the tap posts exactly the formatted body (got ${JSON.stringify(sent)})`);
    aCheck(/SENT/.test(await btn.innerText()) && await btn.isDisabled(), "the button reads SENT and can't post twice");
    await page.evaluate(() => document.getElementById("__meet").remove());
    // The crew thread: the same meetup (one already in my list), a new one, and another festival's.
    await page.evaluate(([fid, atTs]) => {
      const row = (id, body, who) => ({ id, sender_pid: who, sender_name: "Sam", body, created_at: new Date().toISOString() });
      const rows = [
        row(1, `[MEETUP ${fid} kinetic ${atTs}] Kinetic flag || left of the owl`, "p-sam"),
        row(2, `[MEETUP ${fid} circuit ${atTs + 1800e3}] Circuit rail || by the speaker`, "p-sam"),
        row(3, `[MEETUP acl-2026 amex ${atTs}] Amex field`, "p-sam"),
        row(4, `[MEETUP ${fid} neon ${atTs}] My own pin`, "p-me"),
        row(5, `[POLL abcdef12] Where after? || Neon || Kinetic`, "p-sam"),
        row(6, `[MEETUP ${fid} honda ${atTs}] Not a stage here`, "p-sam"),
      ];
      window.sbCrewFetchMessages = async () => rows;
      window.sbCrewSubscribeMessages = () => () => {};
      const host = document.createElement("div"); host.id = "__chat"; host.style.cssText = "position:fixed;inset:0;z-index:2147483000;overflow:auto;background:var(--paper)"; document.body.appendChild(host);
      ReactDOM.createRoot(host).render(React.createElement(CrewChat, { code: "TST123", myPid: "p-me", myName: "Me" }));
    }, [FID, atTs]);
    await page.waitForTimeout(800);
    const cards = page.locator("#__chat [data-crew-meetup]");
    aCheck(await cards.count() === 4, `four meetup cards in the thread (got ${await cards.count()})`);
    // Moderation parity: a meetup or poll someone else sent carries the same report/block menu as a bubble; my own doesn't.
    const modMeet = page.locator('#__chat [data-crew-card-moderation="meetup"]');
    aCheck(await modMeet.count() === 3, `Sam's three meetups each carry report/block, mine none (got ${await modMeet.count()})`);
    aCheck(await page.locator('#__chat [data-crew-card-moderation="poll"]').count() === 1, "Sam's poll carries report/block");
    await modMeet.nth(1).locator('button[aria-label="Message options"]').click(); await page.waitForTimeout(150);
    const menuText = await modMeet.nth(1).innerText();
    aCheck(/Report message/.test(menuText) && /Block Sam/.test(menuText), `the meetup menu offers Report and Block (got "${menuText.replace(/\n/g, " / ")}")`);
    await modMeet.nth(1).getByText("CANCEL").click(); await page.waitForTimeout(150);
    const t = i => cards.nth(i).innerText();
    aCheck(/In your meetups/.test(await t(0)), "the meetup already in my list reads 'In your meetups'");
    aCheck(/Circuit rail/.test(await t(1)) && /by the speaker/.test(await t(1)) && /CIRCUIT|Circuit Grounds/i.test(await t(1)), `the new card names the stage and the note (got "${(await t(1)).replace(/\n/g, " / ")}")`);
    aCheck(!/Add to my meetups/.test(await t(2)) && /for ACL/i.test(await t(2)), `another festival's meetup names it and offers no Add (got "${(await t(2)).replace(/\n/g, " / ")}")`);
    await cards.nth(1).locator("[data-crew-meetup-add]").click(); await page.waitForTimeout(200);
    const list = await page.evaluate(() => JSON.parse(localStorage.getItem("plursky_meetups_v1")).map(m => `${m.festivalId}|${m.stageId}|${m.name}`));
    aCheck(list.filter(x => x === `${FID}|circuit|Circuit rail`).length === 1 && list.length === 4, `Add puts it in my meetups once, under this festival (got ${JSON.stringify(list)})`);
    aCheck(/In your meetups/.test(await t(1)), "after Add the card reads 'In your meetups'");
    if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, "crew-meetups-thread.png") });
    aCheck(!/Not a stage here/.test((await Promise.all([...Array(await cards.count()).keys()].map(t))).join(" ")), "a meetup naming a stage this festival doesn't have gets no card");
    aCheck(errors.length === 0, `no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }

const failed = base.failed + mutFail + appFail;
console.log(`${failed ? "✗" : "✓"} crew meetups: ${base.checks - base.failed}/${base.checks} body checks, ${appChecks - appFail}/${appChecks} app checks, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
