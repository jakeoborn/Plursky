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
//      inactive (_migrateShareState) until a fresh tap; one this build started
//      (stageOnly: 2) is left alone. Past expiresAt the presence layer itself
//      stops: the heartbeat, loc-req and rally paths and the expiry timer each
//      leave and persist active:false. The crew channel and both payloads are
//      festival-scoped: the same crew code at two festivals never crosses, and
//      with no crew code nothing joins at all.
//   7. Rendered (fake channel layer under the real client): a share started
//      on Map that expires while on Today stops; leaving Map and coming back
//      keeps a fresh share; a legacy share loads inactive.
//   8. Mutations on the compiled source must each fail a check.
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

function loadSupa(src, fid = "fixture-fest", pid = "p_me") {
  const store = { plursky_group_code: "TST123", plursky_pid: pid };
  const client = fakeClient();
  const timers = [], intervals = [];
  let saver = false;
  const ctx = {
    plurskyNetSaver: () => saver,
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].live = false; },
    setInterval: (fn, ms) => { intervals.push({ fn, ms, live: true }); return 1000 + intervals.length; },
    clearInterval: id => { if (intervals[id - 1001]) intervals[id - 1001].live = false; },
    URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:", origin: "http://x" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, createElement: () => ({ style: {} }), head: { appendChild: noop }, body: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    supabase: { createClient: () => client }, FESTIVAL_CONFIG: { id: fid },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "build/supabase.js" });
  const F = vm.runInContext(`({ _crewLocPayload, _crewShareActive, sbPresenceJoin, sbPresenceUpdate, sbPresenceLeave,
    sbBroadcastRally, sbOnRally, joinStagePresence, leaveStagePresence, peers: () => sbGetPresSnap() })`, ctx);
  F.chans = client.chans; F.timers = timers; F.intervals = intervals; F.store = store;
  F.setSaver = v => { saver = !!v; };
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
  const crewCh = () => F.chans.filter(c => c.name === "crew-TST123:fixture-fest").pop();
  const stageChs = () => F.chans.filter(c => /^stage:/.test(c.name));
  const live = () => stageChs().filter(c => !c.unsub);
  const lastLoc = () => { const m = (crewCh()?.sends || []).filter(x => x.event === "loc").pop(); return m && m.payload; };
  F.setShare({ active: true, expiresAt: Date.now() + 3600e3 });
  F.sbPresenceJoin({ name: "Sam", stageId: "kinetic" });
  check(!!crewCh(), "sharing joins the crew channel");
  check(live().length === 1 && live()[0].name === "stage:crew-TST123:fixture-fest:kinetic",
    `the headcount joins my declared stage on a festival + crew channel (got ${live().map(c => c.name)})`);
  check(live()[0]?.tracked.length === 1, "the headcount tracks me once on that channel");
  // Rally: stage id only, on send.
  const sent = F.sbBroadcastRally({ label: "Meet at kinetic", stageId: "kinetic", x: 41, y: 37, gps: { lat: 28.5, lng: -81.4 } });
  const rs = (crewCh()?.sends || []).filter(x => x.event === "rally").pop();
  check(sent === true && rs && rs.payload.stageId === "kinetic" && rs.payload.label === "Meet at kinetic", `a rally sends its stage and label (got ${JSON.stringify(rs && rs.payload)})`);
  check(rs && Object.keys(rs.payload).sort().join() === "fid,fromName,fromPid,label,rallyId,stageId,ts" && rs.payload.fid === "fixture-fest", `a rally sends no position, and names its festival (keys ${rs && Object.keys(rs.payload)})`);
  check(rs && !/28\.5|81\.4|"x"|"y"|gps/.test(JSON.stringify(rs.payload)), "no coordinate value is in the rally payload");
  const nSends = crewCh().sends.length;
  check(F.sbBroadcastRally({ label: "Here", stageId: null, gps: { lat: 28.5, lng: -81.4 } }) === false && crewCh().sends.length === nSends, "a rally with no stage is not sent");
  // Rally: stage id only, on receive (a crewmate on an older version sends x/y/gps).
  let got = "none"; const off = F.sbOnRally(r => { got = r; });
  crewCh().handlers.rally({ payload: { rallyId: "r1", fid: "fixture-fest", fromPid: "p_other", fromName: "Bo", stageId: "circuit", label: "Old", x: 5, y: 6, gps: { lat: 28.5, lng: -81.4 } } });
  check(got && got.stageId === "circuit" && !("gps" in got) && !("x" in got) && !("y" in got), `an accepted rally keeps no position (got ${JSON.stringify(got)})`);
  got = "none";
  crewCh().handlers.rally({ payload: { rallyId: "r2", fid: "fixture-fest", fromPid: "p_other", label: "Pin", x: 5, y: 6, gps: { lat: 28.5, lng: -81.4 } } });
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
  check(live().length === 0 && !!crewCh()?.unsub, "an expired share joins no headcount, leaves the old one and stops broadcasting");
  F.setShare({ active: true, expiresAt: Date.now() + 3600e3 });
  F.sbPresenceJoin({ name: "Sam", stageId: "kinetic" });
  check(live().length === 1, "a fresh Start → the headcount re-joins");
  F.sbPresenceLeave();
  check(live().length === 0, "Stop leaves the headcount");
  F.setShare({ active: false });
  F.joinStagePresence("kinetic");
  check(live().length === 0, "not sharing → a direct join is refused");

  // #376 finding 5: expiry is the presence layer's own, from any tab.
  const expire = () => F.setShare({ active: true, stageOnly: 2, expiresAt: Date.now() - 1000 });
  const restart = () => { F.setShare({ active: true, stageOnly: 2, expiresAt: Date.now() + 3600e3 }); F.sbPresenceJoin({ name: "Sam", stageId: "kinetic" }); return crewCh(); };
  const stopped = (ch, n, why) => {
    const st = JSON.parse(F.store.plursky_share_state || "null");
    check(ch.unsub && ch.sends.filter(x => x.event === "loc").length === n && live().length === 0 && st && st.active === false,
      `${why}: past expiresAt it stops, leaves the headcount and saves active:false (unsub ${ch.unsub}, locs ${ch.sends.filter(x => x.event === "loc").length}/${n}, headcount ${live().length}, saved ${JSON.stringify(st)})`);
  };
  // Timers are told apart by what they are: the expiry timer's delay is the
  // share's remaining time; a heartbeat beat is one 20s/60s period (#5 made it
  // a setTimeout chain so each beat re-reads the saver policy). Firing a timer
  // spends it, as a real setTimeout does.
  const fire = t => { if (t) { t.live = false; t.fn(); } };
  const isBeat = t => t.ms === 20000 || t.ms === 60000;
  const beats = () => F.timers.filter(t => t.live && isBeat(t));
  const locs = ch => ch.sends.filter(x => x.event === "loc").length;
  const expiryTimers = () => {
    const exp = (JSON.parse(F.store.plursky_share_state || "null") || {}).expiresAt;
    return F.timers.filter(t => t.live && !isBeat(t) && exp && Math.abs(t.ms - (exp - Date.now())) < 1000);
  };
  const noneLeft = why => check(beats().length === 0 && F.intervals.every(t => !t.live) && expiryTimers().length === 0,
    `${why}: nothing is left scheduled (beats ${beats().length}, intervals ${F.intervals.filter(t => t.live).length})`);
  F.setSaver(false);
  let ch = restart();
  const ex = expiryTimers();
  check(ex.length === 1 && ex[0].ms > 3590e3 && ex[0].ms < 3601e3, `joining arms one expiry timer for the share's remaining time (got ${ex.map(t => t.ms)})`);
  let n = locs(ch);
  expire(); fire(ex[0]);
  stopped(ch, n, "the expiry timer");
  noneLeft("the expiry timer");
  // The heartbeat runs as a chain: each beat announces once and leaves exactly one next beat.
  ch = restart(); n = locs(ch);
  let chain = true;
  for (let i = 0; i < 3; i++) {
    const b = beats();
    if (b.length !== 1 || b[0].ms !== 20000) { chain = false; break; }
    fire(b[0]);
    if (locs(ch) !== n + i + 1) { chain = false; break; }
  }
  check(chain && beats().length === 1, `sharing runs the heartbeat: every 20s it announces and schedules exactly one next beat (beats ${beats().map(t => t.ms)}, locs ${locs(ch) - n})`);
  n = locs(ch);
  expire(); fire(beats()[0]);
  stopped(ch, n, "the 20s heartbeat");
  noneLeft("the 20s heartbeat");
  // Stretched to 60s on battery saver / a weak signal: expiry still stops it.
  F.setSaver(true);
  ch = restart();
  check(beats().length === 1 && beats()[0].ms === 60000, `on battery saver the heartbeat stretches to 60s (got ${beats().map(t => t.ms)})`);
  fire(beats()[0]);
  n = locs(ch);
  check(beats().length === 1 && beats()[0].ms === 60000, "a 60s beat schedules the next at 60s");
  expire(); fire(beats()[0]);
  stopped(ch, n, "the 60s heartbeat");
  noneLeft("the 60s heartbeat");
  // A saver-policy change lands mid-share: the next beat picks it up, and expiry still stops it.
  F.setSaver(false);
  ch = restart();
  F.setSaver(true); fire(beats()[0]);
  const stretched = beats().map(t => t.ms);
  F.setSaver(false); fire(beats()[0]);
  const recovered = beats().map(t => t.ms);
  check(stretched.join() === "60000" && recovered.join() === "20000", `a saver change mid-share takes effect on the next beat, both ways (got ${stretched} then ${recovered})`);
  F.setSaver(true); fire(beats()[0]);
  n = locs(ch);
  expire(); fire(beats()[0]);
  stopped(ch, n, "the heartbeat after a mid-share saver change");
  noneLeft("the heartbeat after a mid-share saver change");
  F.setSaver(false);
  ch = restart(); n = ch.sends.filter(x => x.event === "loc").length;
  expire(); ch.handlers["loc-req"] && ch.handlers["loc-req"]({ payload: { pid: "p_other" } });
  stopped(ch, n, "a crewmate's loc-req");
  ch = restart(); n = ch.sends.filter(x => x.event === "loc").length;
  expire(); F.sbBroadcastRally({ label: "Meet", stageId: "kinetic" });
  check(ch.sends.filter(x => x.event === "rally").length === 0, "past expiresAt a rally is not sent");
  stopped(ch, n, "calling a rally");
  const before = F.timers.length;
  ch = restart();
  const armed = F.timers.slice(before).filter(t => t.ms > 3590e3);
  const beatBeforeStop = beats();
  F.sbPresenceLeave();
  check(armed.length === 1 && !armed[0].live, `Stop clears the expiry timer (armed ${armed.length}, live ${armed.map(t => t.live)})`);
  check(beatBeforeStop.length === 1 && beats().length === 0, "Stop clears the pending beat");
  // A beat already firing when Stop lands (its callback overtaken) schedules nothing.
  ch = restart();
  const late = beats()[0];
  F.sbPresenceLeave(); F.setShare({ active: true, stageOnly: 2, expiresAt: Date.now() + 3600e3 });
  fire(late);
  check(beats().length === 0, "a beat overtaken by Stop schedules no next beat");
  F.setShare(null);
}

// #376 finding 7: two festivals, the same crew code and the same stage id.
function festivals(check) {
  const vegas = loadSupa(SUPA_CUR, "edc-lv-2026", "p_vegas"), orl = loadSupa(SUPA_CUR, "edc-orlando-2026", "p_orl"), orl2 = loadSupa(SUPA_CUR, "edc-orlando-2026", "p_orl2");
  for (const F of [vegas, orl, orl2]) { F.setShare({ active: true, stageOnly: 2, expiresAt: Date.now() + 3600e3 }); F.sbPresenceJoin({ name: "Sam", stageId: "kinetic" }); }
  const cv = vegas.chans.find(c => /^crew-/.test(c.name)), co = orl.chans.find(c => /^crew-/.test(c.name)), co2 = orl2.chans.find(c => /^crew-/.test(c.name));
  check(cv && co && cv.name !== co.name && co.name === co2.name, `the same crew code at two festivals is two channels (${cv && cv.name} / ${co && co.name})`);
  let seen = null; orl.sbOnRally(r => { seen = r; });
  const vLoc = cv.sends.filter(x => x.event === "loc").pop().payload, o2Loc = co2.sends.filter(x => x.event === "loc").pop().payload;
  check(vLoc.fid === "edc-lv-2026", "a loc names its festival");
  // Delivered anyway (a stale channel, an old build): Orlando must not keep it.
  co.handlers.loc({ payload: vLoc });
  co.handlers.loc({ payload: o2Loc });
  const peers = orl.peers();
  check(!peers.p_vegas, `a Vegas loc never lands at Orlando's kinetic (snapshot ${Object.keys(peers)})`);
  check(!!peers.p_orl2 && peers.p_orl2.stageId === "kinetic", "an Orlando crewmate's loc is kept (control)");
  vegas.sbBroadcastRally({ label: "Meet", stageId: "kinetic" });
  co.handlers.rally({ payload: cv.sends.filter(x => x.event === "rally").pop().payload });
  check(seen === null, "a Vegas rally is not shown at Orlando");
  orl2.sbBroadcastRally({ label: "Meet", stageId: "kinetic" });
  co.handlers.rally({ payload: co2.sends.filter(x => x.event === "rally").pop().payload });
  check(seen && seen.stageId === "kinetic", "an Orlando rally is shown at Orlando (control)");
  const none = loadSupa(SUPA_CUR, "edc-lv-2026", "p_none"); delete none.store.plursky_group_code;
  none.setShare({ active: true, stageOnly: 2, expiresAt: Date.now() + 3600e3 });
  none.sbPresenceJoin({ name: "Sam", stageId: "kinetic" });
  check(none.chans.length === 0, `no crew code → no channel at all (got ${none.chans.map(c => c.name)})`);
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
  festivals(check);
  const old = migrate({ active: true, includeGps: true, includeStage: false, token: "tok", expiresAt: T + 3600e3, label: "x" });
  check(old.active === false && old.includeGps === false && old.includeStage === true && old.token === undefined && old.expiresAt === T + 3600e3,
    `a share saved before stage-only sharing comes back inactive, stage-only, no token (got ${JSON.stringify(old)})`);
  check(migrate(null) === null, "no saved share → none");
  const fresh = migrate({ active: true, includeGps: false, includeStage: true, stageOnly: 2, expiresAt: T + 3600e3 });
  check(fresh.active === true && fresh.expiresAt === T + 3600e3, `a share this build started survives a remount (got ${JSON.stringify(fresh)})`);

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

let SUPA_CUR = SUPA;
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
  ["supa", "return crew ? `stage:${crew}:${stageId}` : null;", "return `stage:${stageId}`;"],
  ["supa", "if (!_sb || !stageId || !_crewShareActive()) {", "if (!_sb || !stageId) {"],
  ["supa", "  _myLoc = null;\n  leaveStagePresence();\n", "  _myLoc = null;\n"],
  ["supa", "arg && Object.prototype.hasOwnProperty.call(arg, \"stageId\") ? {\n    stageId: arg.stageId || null\n  } : {\n    stageId: _myLoc.stageId\n  };", "{\n    stageId: (arg || {}).stageId ?? _myLoc.stageId\n  };"],
  ["supa", "    ts: Date.now()\n  };\n  _syncStageHeadcount();\n  _presSnap", "    ts: Date.now()\n  };\n  _presSnap"],
  ["supa", "  _syncStageHeadcount();\n  _armShareExpiry();\n", "  _armShareExpiry();\n"],
  ["map", "return { ...s, active: false, includeGps: false,", "return { ...s, includeGps: false,"],
  // #376 findings 5-7: expiry in the presence layer, fresh shares survive a remount, festival scope.
  ["supa", "if (!_presCh || !_myLoc || !_presenceGuard()) return;", "if (!_presCh || !_myLoc) return;"],
  ["supa", "if (!_presCh || !_myRally || !_presenceGuard()) return;", "if (!_presCh || !_myRally) return;"],
  ["supa", "  _syncStageHeadcount();\n  _armShareExpiry();\n", "  _syncStageHeadcount();\n"],
  ["supa", "    if (s && s.active) localStorage.setItem(\"plursky_share_state\", JSON.stringify({\n      ...s,\n      active: false\n    }));", ""],
  ["map", "if (!s || s.stageOnly === 2) return s;", "if (!s) return s;"],
  ["supa", "return code && fid ? `crew-${code}:${fid}` : null;", "return code && fid ? `crew-${code}` : null;"],
  ["supa", "payload.pid === _presMyId || payload.fid !== _crewFid()) return;", "payload.pid === _presMyId) return;"],
  ["supa", "if (!r || r.fid !== _crewFid()) return;", "if (!r) return;"],
  ["supa", "return code && fid ? `crew-${code}:${fid}` : null;", "return `crew-${code}:${fid}`;"],
  // #5 heartbeat chain: negative control (expiry broken: the beat keeps rescheduling past expiresAt), and the saver period.
  ["supa", "if (gen === _heartbeatGen) _heartbeatId = setTimeout(beat, _presHeartbeatMs());", "_heartbeatId = setTimeout(beat, _presHeartbeatMs());"],
  ["supa", "plurskyNetSaver() ? PRES_HEARTBEAT_SAVER_MS : PRES_HEARTBEAT_MS", "PRES_HEARTBEAT_MS"],
];
let caught = 0, mutFail = 0;
for (const [which, from, to] of MUT) {
  const src = which === "supa" ? SUPA : MAPSRC;
  const n = src.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  let r;
  SUPA_CUR = which === "supa" ? SUPA.replace(from, to) : SUPA;
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

// ── Rendered: the share's life across tabs (#376 findings 5 and 6) ──
// The real app with the real supabase-js client, whose .channel() is swapped
// for an in-page fake that records names, sends and unsubscribes.
let tabChecks = 0, tabFail = 0, tabMutCaught = 0, tabMutTotal = 0;
const tCheck = (ok, msg) => { tabChecks++; if (!ok) { tabFail++; console.log(`  ✗  ${msg}`); } };
async function tabRun(seed, supaBody, mapBody, clock) {
  const PORT2 = await reservePort();
  const srv = spawn("python3", ["-m", "http.server", String(PORT2), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
  try {
    await serverReady(`http://127.0.0.1:${PORT2}/index.html`);
    const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
    await wireVendor(ctx);
    await ctx.route(/supabase\.co/, r => r.abort());
    if (supaBody) await ctx.route(/\/build\/supabase\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: supaBody }));
    if (mapBody) await ctx.route(/\/build\/map\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: mapBody }));
    await ctx.addInitScript(([fid, seed]) => {
      if (!sessionStorage.getItem("__seeded")) {
        sessionStorage.setItem("__seeded", "1");
        localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
        localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
        localStorage.setItem("plursky_group_code", "TST123");
        localStorage.setItem("status_me", JSON.stringify({ stage: "kinetic", ts: Date.now() }));
        const sh = { ...seed }; if (sh.expiresIn) { sh.expiresAt = Date.now() + sh.expiresIn; delete sh.expiresIn; }
        localStorage.setItem("plursky_share_state", JSON.stringify(sh));
      }
      window.__chans = [];
      let real;
      Object.defineProperty(window, "supabase", { configurable: true,
        set(v) { real = v; },
        get() {
          if (!real) return real;
          return { ...real, createClient: (...a) => {
            const c = real.createClient(...a);
            c.channel = (name) => {
              const ch = { name, sends: [], unsub: false, handlers: {},
                on(t, f, cb) { ch.handlers[(f && f.event) || t] = cb; return ch; },
                subscribe(cb) { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; },
                send(m) { ch.sends.push({ event: m.event, payload: m.payload, t: Date.now() }); },
                track() { return Promise.resolve(); }, unsubscribe() { ch.unsub = true; }, presenceState: () => ({}) };
              window.__chans.push(ch); return ch;
            };
            c.removeChannel = (ch) => { if (ch) ch.unsub = true; };
            return c;
          } };
        } });
    }, [FID, seed]);
    const page = await ctx.newPage();
    if (clock) await page.clock.install();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT2}/index.html?f=${FID}&tab=map`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.sbPresenceJoin === "function", FID, { timeout: 60000 });
    const st = () => page.evaluate(() => ({
      share: JSON.parse(localStorage.getItem("plursky_share_state") || "null"),
      chans: window.__chans.filter(c => /^(crew|stage):/.test(c.name) || /^crew-/.test(c.name)).map(c => ({ name: c.name, unsub: c.unsub,
        locs: c.sends.filter(x => x.event === "loc").map(x => x.t), byes: c.sends.filter(x => x.event === "loc-bye").length })),
      now: Date.now(),
    }));
    // The app's deep-link handler: an in-app tab switch (MapScreen unmounts), no reload.
    const tab = async (id) => { await page.evaluate(t => window.plurskyApplyUrlParams(`?tab=${t}`), id); await page.waitForTimeout(600); };
    return { page, st, tab, errors, done: async () => { await ctx.close(); await browser.close(); } };
  } catch (e) { srv.kill(); throw e; }
  finally { setTimeout(() => srv.kill(), 0); }
}
const crewName = `crew-TST123:${FID}`, stageName = `stage:crew-TST123:${FID}:kinetic`;
async function expiryScenario(supaBody) {
  const R = await tabRun({ active: true, includeGps: false, includeStage: true, stageOnly: 2, expiresIn: 9000 }, supaBody);
  try {
    await R.page.waitForFunction(n => window.__chans.some(c => c.name === n && c.sends.some(x => x.event === "loc")), crewName, { timeout: 8000 }).catch(() => {});
    const a = await R.st();
    const live0 = a.chans.filter(c => !c.unsub);
    await R.tab("home");
    const exp = a.share && a.share.expiresAt;
    await R.page.waitForTimeout(Math.max(0, exp - Date.now()) + 1500);
    const b = await R.st();
    return { a, b, live0, exp, errors: R.errors };
  } finally { await R.done(); }
}
try {
  const E = await expiryScenario(null);
  tCheck(E.live0.some(c => c.name === crewName && c.locs.length) && E.live0.some(c => c.name === stageName), `on Map a stage-only share joins the festival+crew channel and headcount (got ${JSON.stringify(E.live0.map(c => c.name))})`);
  tCheck(E.b.share && E.b.share.active === false, `on Today past expiresAt the saved share is active:false (got ${JSON.stringify(E.b.share)})`);
  tCheck(E.b.chans.every(c => c.unsub), `on Today past expiresAt the crew channel and headcount are left (${JSON.stringify(E.b.chans.map(c => [c.name, c.unsub]))})`);
  tCheck(E.b.chans.every(c => c.locs.every(t => t <= E.exp + 100)), "no loc is sent after expiresAt");
  tCheck(E.errors.length === 0, `tab-away: no page errors (${E.errors.slice(0, 2).join(" | ")})`);
  // Rendered mutant: no presence-layer expiry timer → the share outlives Map.
  tabMutTotal++;
  const target = "  _syncStageHeadcount();\n  _armShareExpiry();\n";
  if (SUPA.split(target).length === 2) {
    const M = await expiryScenario(SUPA.replace(target, "  _syncStageHeadcount();\n"));
    if (!(M.b.share && M.b.share.active === false && M.b.chans.every(c => c.unsub))) tabMutCaught++;
    else console.log("  ✗  rendered mutation survived: no _armShareExpiry()");
  } else console.log("  ✗  rendered mutation target not found");

  // The heartbeat chain on a faked page clock: 20s beats, 60s once the saver
  // policy flips mid-share, 20s again when it clears. Then the phone sleeps
  // through expiresAt (wall clock jumps, timers don't fire), so the next beat
  // is the first to see it: it must leave, and nothing may beat after it.
  const clockScenario = async (supaBody) => {
    const R = await tabRun({ active: true, includeGps: false, includeStage: true, stageOnly: 2, expiresIn: 3600e3 }, supaBody, null, true);
    try {
      await R.page.waitForFunction(n => window.__chans.some(c => c.name === n && c.sends.some(x => x.event === "loc")), crewName, { timeout: 8000 }).catch(() => {});
      await R.tab("home");
      await R.page.evaluate(() => {
        window.__beats = []; window.__saver = false;
        const f = window._broadcastMyLoc;
        window._broadcastMyLoc = (...a) => { window.__beats.push(Date.now()); return f(...a); };
        window.plurskyNetSaver = () => window.__saver;
      });
      const beatsSince = (t) => R.page.evaluate(t => window.__beats.filter(x => x > t), t);
      const gaps = (b) => b.slice(1).map((t, i) => t - b[i]);
      const now = () => R.page.evaluate(() => Date.now());
      const t0 = await now();
      await R.page.clock.runFor(100000);
      const g20 = gaps(await beatsSince(t0));
      await R.page.evaluate(() => { window.__saver = true; });
      const t1 = await now();
      await R.page.clock.runFor(200000);
      const g60 = gaps(await beatsSince(t1));
      await R.page.evaluate(() => { window.__saver = false; });
      const t2 = await now();
      await R.page.clock.runFor(130000);
      const gBack = gaps(await beatsSince(t2));
      const a = await R.st();
      await R.page.clock.setSystemTime(a.share.expiresAt + 5000);
      const t3 = await now();
      await R.page.clock.runFor(200000);
      const after = await beatsSince(t3);
      const b = await R.st();
      return { g20, g60, gBack, a, b, after, t3, errors: R.errors };
    } finally { await R.done(); }
  };
  const near = (g, ms) => Math.abs(g - ms) <= 1000;
  {
    const C = await clockScenario(null);
    tCheck(C.g20.length >= 3 && C.g20.every(g => near(g, 20000)), `page clock: the heartbeat beats every 20s (gaps ${JSON.stringify(C.g20)})`);
    tCheck(C.g60.length >= 2 && C.g60.slice(1).every(g => near(g, 60000)), `page clock: a saver change mid-share stretches the beats to 60s (gaps ${JSON.stringify(C.g60)})`);
    tCheck(C.gBack.length >= 2 && near(C.gBack[C.gBack.length - 1], 20000), `page clock: when the saver clears the beats return to 20s (gaps ${JSON.stringify(C.gBack)})`);
    tCheck(C.a.share && C.a.share.active === true, `page clock: the share is still active before expiresAt (got ${JSON.stringify(C.a.share)})`);
    tCheck(C.after.length === 1, `page clock: past expiresAt one beat finds it and the heartbeat stops (beats after the jump: ${C.after.length})`);
    tCheck(C.b.share && C.b.share.active === false, `page clock: past expiresAt the saved share is active:false (got ${JSON.stringify(C.b.share)})`);
    tCheck(C.b.chans.every(c => c.unsub), `page clock: past expiresAt the crew channel and headcount are left (${JSON.stringify(C.b.chans.map(c => [c.name, c.unsub]))})`);
    tCheck(C.b.chans.every(c => c.locs.every(t => t < C.t3)), "page clock: no loc is sent after expiresAt");
    tCheck(C.errors.length === 0, `page clock: no page errors (${C.errors.slice(0, 2).join(" | ")})`);
  }
  // Rendered negative control: the beat reschedules after the guard left.
  tabMutTotal++;
  const gt = "if (gen === _heartbeatGen) _heartbeatId = setTimeout(beat, _presHeartbeatMs());";
  if (SUPA.split(gt).length === 2) {
    const M = await clockScenario(SUPA.replace(gt, "_heartbeatId = setTimeout(beat, _presHeartbeatMs());"));
    if (M.after.length !== 1) tabMutCaught++;
    else console.log("  ✗  rendered mutation survived: heartbeat reschedules past expiresAt");
  } else console.log("  ✗  rendered mutation target not found (heartbeat gen)");
  // Rendered mutant: the beat ignores the saver policy.
  tabMutTotal++;
  const st = "plurskyNetSaver() ? PRES_HEARTBEAT_SAVER_MS : PRES_HEARTBEAT_MS";
  if (SUPA.split(st).length === 2) {
    const M = await clockScenario(SUPA.replace(st, "PRES_HEARTBEAT_MS"));
    if (!(M.g60.length >= 2 && M.g60.slice(1).every(g => near(g, 60000)))) tabMutCaught++;
    else console.log("  ✗  rendered mutation survived: heartbeat ignores the saver");
  } else console.log("  ✗  rendered mutation target not found (saver)");

  const remount = async (mapBody) => {
    const R = await tabRun({ active: true, includeGps: false, includeStage: true, stageOnly: 2, expiresIn: 3600e3 }, null, mapBody);
    try {
      await R.page.waitForFunction(n => window.__chans.some(c => c.name === n && c.sends.some(x => x.event === "loc")), crewName, { timeout: 8000 }).catch(() => {});
      await R.tab("home"); await R.tab("map"); await R.page.waitForTimeout(1200);
      const b = await R.st();
      return { b, crews: b.chans.filter(c => c.name === crewName), errors: R.errors };
    } finally { await R.done(); }
  };
  {
    const { b, crews, errors } = await remount(null);
    tCheck(b.share && b.share.active === true, `Map → Today → Map keeps a fresh share active (got ${JSON.stringify(b.share)})`);
    tCheck(crews.length >= 1 && !crews[crews.length - 1].unsub && crews.every(c => c.byes === 0), `…and it keeps broadcasting, with no loc-bye (${JSON.stringify(crews)})`);
    tCheck(errors.length === 0, `remount: no page errors (${errors.slice(0, 2).join(" | ")})`);
  }
  // Rendered mutant: the migration resets every share, as 1fd14e2 did.
  tabMutTotal++;
  const MAPJS = readFileSync(join(ROOT, "build", "map.js"), "utf8"), mt = "if (!s || s.stageOnly === 2) return s;";
  if (MAPJS.split(mt).length === 2) {
    const M = await remount(MAPJS.replace(mt, "if (!s) return s;"));
    if (!(M.b.share && M.b.share.active === true)) tabMutCaught++;
    else console.log("  ✗  rendered mutation survived: migration resets a fresh share");
  } else console.log("  ✗  rendered mutation target not found (map)");

  const L = await tabRun({ active: true, includeGps: true, includeStage: false, token: "old-link", expiresIn: 3600e3 });
  try {
    await L.page.waitForTimeout(2500);
    const b = await L.st();
    tCheck(b.share && b.share.active === false && b.share.includeGps === false && !b.share.token, `a legacy share loads inactive, GPS off, no token (got ${JSON.stringify(b.share)})`);
    tCheck(!b.chans.some(c => c.name === crewName && c.locs.length), "…and broadcasts nothing");
  } finally { await L.done(); }
} catch (e) { tCheck(false, `rendered tab run: ${e.message.split("\n")[0]}`); }

// ── Rendered: two festivals, one crew code, one stage id (#376 finding 7) ──
// Three real app pages share one in-test broadcast bus keyed by channel name:
// ACL and Lollapalooza both have a "titos" stage; a second Lollapalooza page
// is the same-festival control. Nothing may cross festivals; the control must.
async function crossFest(supaBody) {
  const PORT3 = await reservePort();
  const srv = spawn("python3", ["-m", "http.server", String(PORT3), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  let browser;
  try {
    await serverReady(`http://127.0.0.1:${PORT3}/index.html`);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const pages = [];
    const deliver = async (from, name, msg) => {
      for (const p of pages) if (p !== from) await p.evaluate(([n, m]) => window.__busDeliver(n, m), [name, msg]).catch(() => {});
    };
    const open = async (fid, pid) => {
      const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
      await wireVendor(ctx);
      await ctx.route(/supabase\.co/, r => r.abort());
      if (supaBody) await ctx.route(/\/build\/supabase\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: supaBody }));
      await ctx.addInitScript(([fid, pid]) => {
        localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
        localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
        localStorage.setItem("plursky_group_code", "TST123"); localStorage.setItem("plursky_pid", pid);
        localStorage.setItem("status_me", JSON.stringify({ stage: "titos", ts: Date.now() }));
        localStorage.setItem("plursky_share_state", JSON.stringify({ active: true, includeGps: false, includeStage: true, stageOnly: 2, expiresAt: Date.now() + 3600e3 }));
        window.__chans = []; window.__rallies = [];
        window.__busDeliver = (name, msg) => {
          for (const ch of window.__chans) if (ch.name === name && !ch.unsub && ch.handlers[msg.event]) ch.handlers[msg.event](msg);
        };
        let real;
        Object.defineProperty(window, "supabase", { configurable: true,
          set(v) { real = v; },
          get() {
            if (!real) return real;
            return { ...real, createClient: (...a) => {
              const c = real.createClient(...a);
              c.channel = (name) => {
                const ch = { name, unsub: false, handlers: {},
                  on(t, f, cb) { ch.handlers[(f && f.event) || t] = cb; return ch; },
                  subscribe(cb) { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return ch; },
                  send(m) { if (!ch.unsub) window.__busSend(name, { type: m.type, event: m.event, payload: m.payload }); },
                  track() { return Promise.resolve(); }, unsubscribe() { ch.unsub = true; }, presenceState: () => ({}) };
                window.__chans.push(ch); return ch;
              };
              c.removeChannel = (ch) => { if (ch) ch.unsub = true; };
              return c;
            } };
          } });
      }, [fid, pid]);
      const page = await ctx.newPage();
      const errors = []; page.on("pageerror", e => errors.push(e.message));
      await page.exposeFunction("__busSend", (name, msg) => deliver(page, name, msg));
      pages.push(page);
      await page.goto(`http://127.0.0.1:${PORT3}/index.html?f=${fid}&tab=map`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.sbPresenceJoin === "function", fid, { timeout: 60000 });
      await page.evaluate(() => window.sbOnRally(r => window.__rallies.push(r)));
      return { page, errors };
    };
    const acl = await open("acl-2026", "p_acl");
    const lol = await open("lollapalooza-2026", "p_lol");
    const lol2 = await open("lollapalooza-2026", "p_lol2");
    // Everyone re-announces on join; give the bus a beat, then ACL calls a rally at titos.
    await lol2.page.waitForTimeout(2500);
    await acl.page.evaluate(() => window.sbBroadcastRally({ label: "Meet", stageId: "titos" }));
    await lol2.page.evaluate(() => window.sbBroadcastRally({ label: "Meet", stageId: "titos" }));
    await lol2.page.waitForTimeout(1200);
    const read = p => p.evaluate(() => ({ snap: Object.keys(window.sbGetPresSnap()), rallies: window.__rallies.filter(Boolean).map(r => r.fromPid) }));
    return { acl: await read(acl.page), lol: await read(lol.page), lol2: await read(lol2.page),
      errors: [...acl.errors, ...lol.errors, ...lol2.errors] };
  } finally { if (browser) await browser.close(); srv.kill(); }
}
try {
  const X = await crossFest(null);
  tCheck(X.lol.snap.includes("p_lol2") && X.lol2.snap.includes("p_lol"), `control: two Lollapalooza crewmates see each other (lol ${X.lol.snap}, lol2 ${X.lol2.snap})`);
  tCheck(X.lol.rallies.includes("p_lol2"), `control: a Lollapalooza rally reaches the Lollapalooza crewmate (got ${X.lol.rallies})`);
  tCheck(!X.lol.snap.includes("p_acl") && !X.lol2.snap.includes("p_acl") && !X.acl.snap.includes("p_lol") && !X.acl.snap.includes("p_lol2"),
    `same crew code, same "titos" stage, two festivals: no loc crosses (acl ${X.acl.snap} · lol ${X.lol.snap} · lol2 ${X.lol2.snap})`);
  tCheck(!X.lol.rallies.includes("p_acl") && !X.lol2.rallies.includes("p_acl") && !X.acl.rallies.some(p => /^p_lol/.test(p)),
    `…and no rally crosses (acl ${X.acl.rallies} · lol ${X.lol.rallies})`);
  tCheck(X.errors.length === 0, `cross-festival: no page errors (${X.errors.slice(0, 2).join(" | ")})`);
  // Rendered mutant: 1fd14e2's crew channel (no festival in the name) and no fid check on receive.
  tabMutTotal++;
  const SUPAJS = readFileSync(join(ROOT, "build", "supabase.js"), "utf8");
  const swaps = [["return code && fid ? `crew-${code}:${fid}` : null;", "return code ? `crew-${code}` : null;"],
    ["payload.pid === _presMyId || payload.fid !== _crewFid()) return;", "payload.pid === _presMyId) return;"],
    ["if (!r || r.fid !== _crewFid()) return;", "if (!r) return;"]];
  if (swaps.every(([f]) => SUPAJS.split(f).length === 2)) {
    const M = await crossFest(swaps.reduce((s, [f, t]) => s.replace(f, t), SUPAJS));
    if (M.lol.snap.includes("p_acl") || M.acl.snap.includes("p_lol") || M.lol.rallies.includes("p_acl")) tabMutCaught++;
    else console.log(`  ✗  rendered mutation survived: unscoped crew channel (lol ${M.lol.snap} · rallies ${M.lol.rallies})`);
  } else console.log("  ✗  rendered mutation target not found (cross-festival)");
} catch (e) { tCheck(false, `rendered cross-festival run: ${e.message.split("\n")[0]}`); }

// ── Rendered: the sharing pill fits beside the map controls at 320 and 390 ──
// Centred at top 46 it covered the Stylized/Satellite toggle at 390 and
// wrapped over it at 320. One line, clear of the toggle and the right column.
async function pillRun(width, mapBody) {
  const PORT4 = await reservePort();
  const srv = spawn("python3", ["-m", "http.server", String(PORT4), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  let browser;
  try {
    await serverReady(`http://127.0.0.1:${PORT4}/index.html`);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 760 } });
    await wireVendor(ctx);
    await ctx.route(/supabase\.co/, r => r.abort());
    if (mapBody) await ctx.route(/\/build\/map\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: mapBody }));
    await ctx.addInitScript(fid => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("plursky_group_code", "TST123");
      localStorage.setItem("status_me", JSON.stringify({ stage: "kinetic", ts: Date.now() }));
      localStorage.setItem("plursky_share_state", JSON.stringify({ active: true, includeGps: false, includeStage: true, stageOnly: 2, expiresAt: Date.now() + 3600e3 }));
    }, FID);
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT4}/index.html?f=${FID}&tab=map`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-sharing-pill], [aria-label^='Stop sharing']", { timeout: 60000 });
    await page.waitForSelector("[data-realmap-style-switch]", { timeout: 30000 });
    await page.waitForTimeout(400);
    return await page.evaluate(() => {
      const r = el => el && el.getBoundingClientRect();
      const pill = r(document.querySelector("[data-sharing-pill], [aria-label^='Stop sharing']"));
      const label = document.querySelector("[data-sharing-pill] .mono, [aria-label^='Stop sharing'] .mono");
      const sw = r(document.querySelector("[data-realmap-style-switch]"));
      const lh = label ? parseFloat(getComputedStyle(label).lineHeight) || 12 : 0;
      const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const right = [...document.querySelectorAll("button")].map(r).filter(b => b.width && b.left > window.innerWidth * 0.6 && b.top < 300);
      return { overlapSwitch: hit(pill, sw), overlapRight: right.some(b => hit(pill, b)),
        oneLine: !!label && label.getBoundingClientRect().height < lh * 1.6, text: label && label.textContent };
    });
  } finally { if (browser) await browser.close(); srv.kill(); }
}
try {
  for (const w of [320, 390]) {
    const P = await pillRun(w);
    tCheck(!P.overlapSwitch && !P.overlapRight && P.oneLine, `${w}px: the sharing pill is one line and clear of the map controls (${JSON.stringify(P)})`);
    tCheck(/STAGE/.test(P.text || ""), `${w}px: the pill says it shares the stage (got "${P.text}")`);
  }
  tabMutTotal++;
  const MAPJS = readFileSync(join(ROOT, "build", "map.js"), "utf8"), pt = 'top: 98,\n      left: 10,\n      whiteSpace: "nowrap",';
  if (MAPJS.split(pt).length === 2) {
    const M = await pillRun(320, MAPJS.replace(pt, 'top: 46,\n      left: "50%",\n      transform: "translateX(-50%)",'));
    if (M.overlapSwitch || M.overlapRight || !M.oneLine) tabMutCaught++;
    else console.log(`  ✗  rendered mutation survived: centred pill (${JSON.stringify(M)})`);
  } else console.log("  ✗  rendered mutation target not found (pill)");
} catch (e) { tCheck(false, `rendered pill run: ${e.message.split("\n")[0]}`); }

const failed = base.failed + mutFail + statFail + appFail + tabFail + (tabMutTotal - tabMutCaught);
console.log(`${failed ? "✗" : "✓"} crew radar: ${base.checks - base.failed}/${base.checks} unit checks, ${stat.length - statFail}/${stat.length} static, ${appChecks - appFail}/${appChecks} app checks, ${tabChecks - tabFail}/${tabChecks} tab checks, ${caught}/${MUT.length} mutations + ${tabMutCaught}/${tabMutTotal} rendered caught`);
process.exit(failed ? 1 : 0);
