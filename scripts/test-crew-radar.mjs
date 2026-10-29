#!/usr/bin/env node
// Stage-level crew radar (15-feature program #2): "Share with crew" sends the
// stage I picked, never a position, and the Crew chip groups my crew by stage.
//   1. Payload: _crewLocPayload on the REAL compiled build/supabase.js in a vm
//      keeps who / stage / when and drops lat, lng and gps both ways (what I
//      send, and what a crewmate on an older version still sends).
//      _crewShareActive (the stage headcount's opt-in) is true only for an
//      active, unexpired share.
//   2. Radar rows: crewRadarRows sliced from map.jsx — grouped by stage,
//      biggest group first, ties by stage name, names sorted, freshest age;
//      a crewmate with no stage or an unknown stage is left out.
//   3. Static (code lines): no GPS option, no public link, no live_shares
//      write is called from the map; the stage headcount checks the opt-in.
//   4. App (headless Chrome, Supabase blocked): the share sheet has no GPS
//      option and says so; with no stage Start is disabled; with a stage Start
//      saves includeGps:false. The radar renders one row per stage.
//   5. Crew channel, on a fake Supabase client (#376 gaps): a rally sends and
//      accepts only { rallyId, label, stageId, from…, ts } and no rally without
//      a stage; the stage headcount joins only the stage I declared, on a
//      festival + crew channel, re-checks the share on every call and leaves
//      on a cleared stage and on Stop; sbPresenceUpdate({ stageId: null })
//      withdraws my stage. A share saved before stage-only sharing comes back
//      inactive (_migrateShareState) until a fresh tap.
//   6. Mutations on the compiled source must each fail a check.
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

function fakeClient() {
  const chans = [];
  const tolerant = () => new Proxy(function () {}, {
    get: (t, k) => (k === "then" ? undefined : tolerant()), apply: () => tolerant(),
  });
  const client = new Proxy({}, {
    get: (t, k) => {
      if (k === "chans") return chans;
      if (k === "channel") return (name) => {
        const ch = { name, handlers: {}, sends: [], tracked: [], unsub: false,
          on(type, f, cb) { ch.handlers[(f && f.event) || type] = cb; return ch; },
          subscribe(cb) { if (cb) cb("SUBSCRIBED"); return ch; },
          send(m) { ch.sends.push(m); }, track(m) { ch.tracked.push(m); return Promise.resolve(); },
          unsubscribe() { ch.unsub = true; }, presenceState: () => ({}) };
        chans.push(ch); return ch;
      };
      if (k === "removeChannel") return (ch) => { if (ch) ch.unsub = true; };
      if (k === "then") return undefined;
      return tolerant();
    },
  });
  return client;
}

function loadSupa(src) {
  const store = { plursky_group_code: "TST123", plursky_pid: "p_me" };
  const client = fakeClient();
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:", origin: "http://x" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, createElement: () => ({ style: {} }), head: { appendChild: noop }, body: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    supabase: { createClient: () => client }, FESTIVAL_CONFIG: { id: "fixture-fest" },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "build/supabase.js" });
  const F = vm.runInContext(`({ _crewLocPayload, _crewShareActive, sbPresenceJoin, sbPresenceUpdate, sbPresenceLeave,
    sbBroadcastRally, sbOnRally, joinStagePresence, leaveStagePresence })`, ctx);
  F.chans = client.chans;
  F.setShare = v => { if (v == null) delete store.plursky_share_state; else store.plursky_share_state = typeof v === "string" ? v : JSON.stringify(v); };
  return F;
}

function loadRows(src) {
  const a = src.indexOf("function crewRadarRows"), b = src.indexOf("function CrewRadar(");
  if (a < 0 || b < a) throw new Error("crewRadarRows not found");
  const STAGES = [
    { id: "kinetic", name: "kineticFIELD", color: "#f00" },
    { id: "circuit", name: "circuitGROUNDS", color: "#0f0" },
    { id: "bass", name: "bassPOD", color: "#00f" },
  ];
  const ctx = { STAGES, Date, Math, Object, String };
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b), ctx);
  return ctx.crewRadarRows;
}

function loadMigrate(src) {
  const a = src.indexOf("function _migrateShareState"), b = src.indexOf("function crewRadarRows");
  if (a < 0 || b < a) throw new Error("_migrateShareState not found");
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
  return ctx._migrateShareState;
}

// The crew channel and the stage headcount, on the fake client.
function crew(F, check) {
  const crewCh = () => F.chans.filter(c => c.name === "crew-TST123").pop();
  const stageChs = () => F.chans.filter(c => /^stage:/.test(c.name));
  const live = () => stageChs().filter(c => !c.unsub);
  const lastLoc = () => { const m = (crewCh()?.sends || []).filter(x => x.event === "loc").pop(); return m && m.payload; };
  F.setShare({ active: true, expiresAt: Date.now() + 3600e3 });
  F.sbPresenceJoin({ name: "Sam", stageId: "kinetic" });
  check(!!crewCh(), "sharing joins the crew channel");
  check(live().length === 1 && live()[0].name === "stage:fixture-fest:crew-TST123:kinetic",
    `the headcount joins my declared stage on a festival + crew channel (got ${live().map(c => c.name)})`);
  check(live()[0]?.tracked.length === 1, "the headcount tracks me once on that channel");
  // Rally: stage id only, on send.
  const sent = F.sbBroadcastRally({ label: "Meet at kinetic", stageId: "kinetic", x: 41, y: 37, gps: { lat: 28.5, lng: -81.4 } });
  const rs = (crewCh()?.sends || []).filter(x => x.event === "rally").pop();
  check(sent === true && rs && rs.payload.stageId === "kinetic" && rs.payload.label === "Meet at kinetic", `a rally sends its stage and label (got ${JSON.stringify(rs && rs.payload)})`);
  check(rs && Object.keys(rs.payload).sort().join() === "fromName,fromPid,label,rallyId,stageId,ts", `a rally sends no position (keys ${rs && Object.keys(rs.payload)})`);
  check(rs && !/28\.5|81\.4|"x"|"y"|gps/.test(JSON.stringify(rs.payload)), "no coordinate value is in the rally payload");
  const nSends = crewCh().sends.length;
  check(F.sbBroadcastRally({ label: "Here", stageId: null, gps: { lat: 28.5, lng: -81.4 } }) === false && crewCh().sends.length === nSends, "a rally with no stage is not sent");
  // Rally: stage id only, on receive (a crewmate on an older version sends x/y/gps).
  let got = "none"; const off = F.sbOnRally(r => { got = r; });
  crewCh().handlers.rally({ payload: { rallyId: "r1", fromPid: "p_other", fromName: "Bo", stageId: "circuit", label: "Old", x: 5, y: 6, gps: { lat: 28.5, lng: -81.4 } } });
  check(got && got.stageId === "circuit" && !("gps" in got) && !("x" in got) && !("y" in got), `an accepted rally keeps no position (got ${JSON.stringify(got)})`);
  got = "none";
  crewCh().handlers.rally({ payload: { rallyId: "r2", fromPid: "p_other", label: "Pin", x: 5, y: 6, gps: { lat: 28.5, lng: -81.4 } } });
  check(got === "none", "a received rally with no stage is dropped");
  off();
  // Update: a new stage moves the headcount; a missing key keeps it; null withdraws.
  F.sbPresenceUpdate({ stageId: "circuit" });
  check(live().length === 1 && /:circuit$/.test(live()[0].name) && stageChs().some(c => /:kinetic$/.test(c.name) && c.unsub), "a new declared stage moves the headcount");
  F.sbPresenceUpdate({});
  check(lastLoc()?.stageId === "circuit" && live().length === 1, "an update with no stageId key keeps my stage");
  F.sbPresenceUpdate({ stageId: null });
  check(lastLoc() && lastLoc().stageId === null, `a cleared stage withdraws it from the crew (sent ${JSON.stringify(lastLoc())})`);
  check(live().length === 0, "a cleared stage leaves the headcount");
  // Re-checked on every call: the share ended between two picks.
  F.sbPresenceUpdate({ stageId: "bass" });
  check(live().length === 1 && /:bass$/.test(live()[0].name), "picking a stage again re-joins while sharing");
  F.setShare({ active: true, expiresAt: Date.now() - 1000 });
  F.sbPresenceUpdate({ stageId: "kinetic" });
  check(live().length === 0, "an expired share joins no headcount and leaves the old one");
  F.setShare({ active: true, expiresAt: Date.now() + 3600e3 });
  F.sbPresenceUpdate({ stageId: "kinetic" });
  check(live().length === 1, "back to sharing → the headcount re-joins");
  F.sbPresenceLeave();
  check(live().length === 0, "Stop leaves the headcount");
  F.setShare({ active: false });
  F.joinStagePresence("kinetic");
  check(live().length === 0, "not sharing → a direct join is refused");
  F.setShare(null);
}

function unit(F, rows, migrate) {
  let checks = 0, failed = 0; const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  const T = Date.UTC(2026, 10, 7, 2, 40);
  const p = F._crewLocPayload({ pid: "p1", name: "Sam", stageId: "kinetic", color: "#fff", pingCode: "AB12", ts: T,
    gps: { lat: 28.5, lng: -81.4 }, lat: 28.5, lng: -81.4, accuracy: 5 });
  check(p.pid === "p1" && p.name === "Sam" && p.stageId === "kinetic" && p.ts === T && p.pingCode === "AB12", `keeps who, stage and when (got ${JSON.stringify(p)})`);
  check(!("gps" in p) && !("lat" in p) && !("lng" in p) && !("accuracy" in p), `drops every coordinate (got ${JSON.stringify(Object.keys(p))})`);
  check(!/28\.5|81\.4/.test(JSON.stringify(p)), "no coordinate value survives anywhere in the payload");
  check(F._crewLocPayload({ pid: "p2", name: "Bo" }).stageId === null, "no stage → stageId null, not undefined");
  F.setShare(null);
  check(F._crewShareActive() === false, "no share → the headcount does not count me");
  F.setShare({ active: true, expiresAt: Date.now() + 3600e3 });
  check(F._crewShareActive() === true, "an active share → counted");
  F.setShare({ active: true, expiresAt: Date.now() - 1000 });
  check(F._crewShareActive() === false, "an expired share → not counted");
  F.setShare({ active: false });
  check(F._crewShareActive() === false, "a stopped share → not counted");
  F.setShare("{not json");
  check(F._crewShareActive() === false, "an unreadable share → not counted");
  F.setShare(null);
  crew(F, check);
  const old = migrate({ active: true, includeGps: true, includeStage: false, token: "tok", expiresAt: T + 3600e3, label: "x" });
  check(old.active === false && old.includeGps === false && old.includeStage === true && old.token === undefined && old.expiresAt === T + 3600e3,
    `a share saved before stage-only sharing comes back inactive, stage-only, no token (got ${JSON.stringify(old)})`);
  check(migrate(null) === null, "no saved share → none");

  const now = T + 10 * 60e3;
  const r = rows([
    { id: "a", name: "Zed", stageId: "circuit", ts: T },
    { id: "b", name: "Ana", stageId: "kinetic", ts: T + 9 * 60e3 },
    { id: "c", name: "Mo", stageId: "kinetic", ts: T },
    { id: "d", name: "Lu", stageId: "bass", ts: now },
    { id: "e", name: "Nil", stageId: null, ts: now },
    { id: "f", name: "Old", stageId: "gone-stage", ts: now },
  ], now);
  check(r.length === 3, `three stages (got ${r.length})`);
  check(r[0]?.stage.id === "kinetic" && r[0].members.length === 2, "the biggest group comes first");
  check(r[1]?.stage.id === "bass" && r[2]?.stage.id === "circuit", `ties go by stage name (got ${r.map(x => x.stage.id)})`);
  check(r[0]?.members.map(m => m.name).join() === "Ana,Mo", "names are sorted in a row");
  check(r[0]?.minsAgo === 1 && r[1]?.minsAgo === 0 && r[2]?.minsAgo === 10, `age is the freshest member's (got ${r.map(x => x.minsAgo)})`);
  check(!r.some(x => x.members.some(m => m.name === "Nil" || m.name === "Old")), "no stage or an unknown stage → left out");
  check(rows([], now).length === 0 && rows(null, now).length === 0, "no crew → no rows");
  return { checks, failed, fails };
}

const base = unit(loadSupa(SUPA), loadRows(MAPSRC), loadMigrate(MAPSRC));
for (const f of base.fails) console.log(`  ✗  ${f}`);
const MUT = [
  ["supa", "  return {\n    pid: l.pid,\n    name: l.name,", "  return {\n    ...l,\n    pid: l.pid,\n    name: l.name,"],
  ["supa", "stageId: l.stageId || null,\n    color", "stageId: l.stageId,\n    color"],
  ["supa", "return !!(s && s.active && (!s.expiresAt || s.expiresAt > Date.now()));", "return !!(s && s.active);"],
  ["supa", "return !!(s && s.active && (!s.expiresAt || s.expiresAt > Date.now()));", "return !!s;"],
  ["map", "b.members.length - a.members.length || a.stage.name.localeCompare(b.stage.name)", "a.stage.name.localeCompare(b.stage.name)"],
  ["map", "b.members.length - a.members.length || a.stage.name.localeCompare(b.stage.name)", "b.members.length - a.members.length"],
  ["map", "if (!st) continue;", ""],
  ["map", "Math.max(...r.members.map(m => m.ts || 0))", "Math.min(...r.members.map(m => m.ts || 0))"],
  // #376 gaps: rally position, headcount scope / opt-in / Stop, null stage, migration.
  ["supa", "    rallyId: String(r.rallyId),\n", "    ...r,\n    rallyId: String(r.rallyId),\n"],
  ["supa", "var r = _rallyPayload(payload);", "var r = payload;"],
  ["supa", "if (!_presCh || !stageId) return false;", "if (!_presCh) return false;"],
  ["supa", "return `stage:${fid}:${_presChannelName()}:${stageId}`;", "return `stage:${stageId}`;"],
  ["supa", "if (!_sb || !stageId || !_crewShareActive()) {", "if (!_sb || !stageId) {"],
  ["supa", "  _myLoc = null;\n  leaveStagePresence();\n", "  _myLoc = null;\n"],
  ["supa", "arg && Object.prototype.hasOwnProperty.call(arg, \"stageId\") ? {\n    stageId: arg.stageId || null\n  } : {\n    stageId: _myLoc.stageId\n  };", "{\n    stageId: (arg || {}).stageId ?? _myLoc.stageId\n  };"],
  ["supa", "    ts: Date.now()\n  };\n  _syncStageHeadcount();\n  _presSnap", "    ts: Date.now()\n  };\n  _presSnap"],
  ["supa", "  };\n  _syncStageHeadcount();\n  _presCh = _sb.channel", "  };\n  _presCh = _sb.channel"],
  ["map", "return s ? { ...s, active: false, includeGps: false,", "return s ? { ...s, includeGps: false,"],
];
let caught = 0, mutFail = 0;
for (const [which, from, to] of MUT) {
  const src = which === "supa" ? SUPA : MAPSRC;
  const n = src.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  let r;
  try { r = which === "supa" ? unit(loadSupa(SUPA.replace(from, to)), loadRows(MAPSRC), loadMigrate(MAPSRC)) : unit(loadSupa(SUPA), loadRows(MAPSRC.replace(from, to)), loadMigrate(MAPSRC.replace(from, to))); }
  catch { r = { failed: 1 }; }
  if (r.failed > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}

// Static, on code lines only.
let statFail = 0; const stat = [];
const sCheck = (ok, msg) => { stat.push(ok); if (!ok) { statFail++; console.log(`  ✗  ${msg}`); } };
const code = src => src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const mapCode = code(MAPSRC), supaCode = code(readFileSync(join(ROOT, "supabase.jsx"), "utf8"));
const sheet = mapCode.slice(mapCode.indexOf("function ShareLocationSheet"), mapCode.indexOf("function crewRadarRows"));
sCheck(sheet.length > 1000 && !/includeGps:\s*true|setIncludeGps|type="checkbox"/.test(sheet), "the share sheet has no GPS option");
sCheck(!/sbLiveShare|ShareLinkRow|share\.html/.test(mapCode), "the map writes no live_shares row and shows no public link");
sCheck(!/gpsToMap\(e\.gps|f\.gps\b/.test(mapCode) && !/STAGES\[0\]\?\.id \|\| null/.test(mapCode), "the map reads no crewmate GPS and never invents a stage");
const join_ = supaCode.slice(supaCode.indexOf("function joinStagePresence"), supaCode.indexOf("function joinStagePresence") + 200);
sCheck(/!_crewShareActive\(\)\) \{ leaveStagePresence\(\); return; \}/.test(join_), "the stage headcount checks the opt-in first, on every call");
const spotCode = code(readFileSync(join(ROOT, "spotify.jsx"), "utf8"));
sCheck(!/joinStagePresence/.test(spotCode) && !/joinStagePresence/.test(mapCode), "no GPS fix or live-mode stage joins the headcount (only the declared stage does)");
sCheck(!/incomingRally\.(x|y|gps)\b/.test(mapCode) && /stageId: rallyStage\.id, isRally: true/.test(mapCode), "a received rally is placed at its stage on this festival's map");
sCheck((supaCode.match(/_crewLocPayload\(/g) || []).length >= 3, "both the send and the receive go through _crewLocPayload");

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
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
  await wireVendor(ctx);
  await ctx.route(/supabase\.co/, r => r.abort());
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
  }, FID);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.ShareLocationSheet === "function" && typeof window.CrewRadar === "function", FID, { timeout: 60000 });
  const mount = (stage) => page.evaluate(st => {
    document.getElementById("__sheet")?.remove();
    window.__saved = []; window.__picked = 0;
    const host = document.createElement("div"); host.id = "__sheet"; host.style.cssText = "position:fixed;inset:0;z-index:2147483000"; document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(ShareLocationSheet, {
      onClose: () => {}, shareState: null, crewCount: 2, crewCode: "TST123", myStatusStage: st,
      onSave: s => window.__saved.push(s), onStop: () => {}, onPickStage: () => { window.__picked++; },
    }));
  }, stage);
  await mount(null); await page.waitForTimeout(300);
  const start = page.locator("#__sheet [data-share-start]");
  aCheck(await page.locator('#__sheet input[type="checkbox"]').count() === 0, "the share sheet has no GPS checkbox");
  aCheck(/NEVER SEES YOUR GPS/.test(await page.locator("#__sheet [data-share-no-gps]").innerText()), "the sheet says the crew never sees GPS");
  aCheck(await start.isDisabled() && /PICK YOUR STAGE FIRST/.test(await start.innerText()), "no stage → Start is disabled and says pick a stage");
  await start.click({ force: true }); await page.waitForTimeout(100);
  aCheck((await page.evaluate(() => window.__saved)).length === 0, "no stage → nothing is saved");
  await page.locator("#__sheet [data-share-pick-stage]").click(); await page.waitForTimeout(100);
  aCheck(await page.evaluate(() => window.__picked) === 1, "PICK STAGE opens the stage picker");
  const kName = await page.evaluate(() => STAGES.find(s => s.id === "kinetic").name);
  await mount("kinetic"); await page.waitForTimeout(300);
  aCheck((await page.locator("#__sheet [data-share-stage-row]").innerText()).includes(kName.toUpperCase()), "the sheet names the picked stage");
  aCheck(!(await start.isDisabled()) && /START SHARING MY STAGE/.test(await start.innerText()), "with a stage, Start is on");
  await start.click(); await page.waitForTimeout(150);
  const saved = await page.evaluate(() => window.__saved);
  aCheck(saved.length === 1 && saved[0].active === true && saved[0].includeGps === false && saved[0].includeStage === true && !saved[0].token, `Start saves a stage-only share with no link token (got ${JSON.stringify(saved)})`);
  if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, "crew-radar-share-sheet.png") });
  await page.evaluate(() => document.getElementById("__sheet").remove());
  await page.evaluate(() => {
    const now = Date.now();
    const host = document.createElement("div"); host.id = "__radar"; host.style.cssText = "position:fixed;inset:0;z-index:2147483000;padding:16px;background:var(--paper);display:flex;flex-wrap:wrap";
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(CrewRadar, { crewFriends: [
      { id: "a", name: "Ana", stageId: "kinetic", ts: now - 60e3 },
      { id: "b", name: "Mo", stageId: "kinetic", ts: now - 5 * 60e3 },
      { id: "c", name: "Zed", stageId: "circuit", ts: now },
      { id: "d", name: "Nil", stageId: null, ts: now },
    ] }));
  });
  await page.waitForTimeout(300);
  const rowsEl = page.locator("#__radar [data-crew-radar-row]");
  aCheck(await rowsEl.count() === 2, `one radar row per stage (got ${await rowsEl.count()})`);
  const first = await rowsEl.nth(0).innerText();
  aCheck(await rowsEl.nth(0).getAttribute("data-crew-radar-row") === "kinetic" && first.includes(kName) && /Ana, Mo/.test(first) && /2 · 1m/.test(first), `the first row is the biggest group (got "${first.replace(/\n/g, " / ")}")`);
  aCheck(/· now/.test(await rowsEl.nth(1).innerText()), "a just-now share reads now");
  aCheck(!/Nil/.test(await page.locator("#__radar").innerText()), "a crewmate with no stage is not on the radar");
  if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, "crew-radar.png") });
  aCheck(errors.length === 0, `no page errors (${errors.slice(0, 2).join(" | ")})`);
  await ctx.close();
  await browser.close();
} finally { server.kill(); }

const failed = base.failed + mutFail + statFail + appFail;
console.log(`${failed ? "✗" : "✓"} crew radar: ${base.checks - base.failed}/${base.checks} unit checks, ${stat.length - statFail}/${stat.length} static, ${appChecks - appFail}/${appChecks} app checks, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
