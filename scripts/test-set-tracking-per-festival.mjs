#!/usr/bin/env node
// Set tracking is opted into PER FESTIVAL (SPEC-212 W3), on the REAL compiled
// build in a vm:
//   1. Never asked reads null for every festival; a yes for one festival is
//      not a yes for another, and the active festival is the default.
//   2. Migration: the old global answer (v1) moves to the festival active at
//      first read, and only that one; v1 is then deleted, so a later festival
//      is asked again. An answer already given for that festival wins.
//   3. No active festival: nothing reads on, nothing is written.
//   4. Wiring: the watcher and the card read the festival they are about.
//   5. Broken fixtures: each rule nudged in the compiled source must fail.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = readFileSync(join(ROOT, "build", "chrome.js"), "utf8");
const SRC = readFileSync(join(ROOT, "chrome.jsx"), "utf8");
const noop = () => {};
const V1 = "plursky_set_tracking_v1", V2 = "plursky_set_tracking_v2";

// Only the pref functions are needed, so they are cut out of the compiled
// build (from the v2 key to the interval store) and run alone.
function prefsBlock(src) {
  const a = src.indexOf("var SET_TRACK_PREF_KEY"), b = src.indexOf("function _readSetTrackStore");
  if (a < 0 || b < a) throw new Error("pref block not found in build/chrome.js");
  return src.slice(a, b);
}
function load(src, activeId, seed = {}) {
  const store = { ...seed };
  const events = [];
  const ctx = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    CustomEvent: function CustomEvent(t) { this.type = t; },
    JSON,
  };
  ctx.window = ctx;
  ctx.dispatchEvent = e => events.push(e.type);
  ctx.FESTIVAL_CONFIG = activeId ? { id: activeId } : null;
  vm.createContext(ctx);
  vm.runInContext(prefsBlock(src), ctx, { filename: "build/chrome.js (prefs)" });
  return { ctx, store, events, use: id => { ctx.FESTIVAL_CONFIG = id ? { id } : null; } };
}

function run(src) {
  const fails = [];
  let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  const G = (ctx, ...a) => vm.runInContext(`getSetTracking(${a.map(x => JSON.stringify(x)).join(",")})`, ctx);
  const S = (ctx, ...a) => vm.runInContext(`setSetTracking(${a.map(x => JSON.stringify(x)).join(",")})`, ctx);

  // 1. Per festival
  {
    const { ctx, store, events, use } = load(src, "edc-lv-2026");
    ok(G(ctx) === null && G(ctx, "acl-2026") === null, "never asked reads null");
    S(ctx, true);
    ok(G(ctx) === "on" && G(ctx, "edc-lv-2026") === "on", "a yes for the active festival reads on");
    ok(G(ctx, "acl-2026") === null, "a yes for EDC turned another festival on");
    use("acl-2026");
    ok(G(ctx) === null, "switching festival did not ask again");
    S(ctx, false);
    ok(G(ctx) === "off" && G(ctx, "edc-lv-2026") === "on", "a no for ACL changed EDC's answer");
    ok(JSON.parse(store[V2])["edc-lv-2026"] === "on" && JSON.parse(store[V2])["acl-2026"] === "off", `v2 store shape (${store[V2]})`);
    ok(events.filter(e => e === "plursky-set-tracking-change").length === 2, "each answer announces the change once");
  }
  // 2. Migration
  {
    const { ctx, store, use } = load(src, "ultra-miami-2026", { [V1]: "on" });
    ok(G(ctx) === "on", "a legacy yes is lost for the festival active at upgrade");
    ok(!(V1 in store), "the legacy key survives migration");
    use("edc-lv-2026");
    ok(G(ctx) === null, "a legacy yes spread to a second festival");
  }
  {
    const { ctx, store } = load(src, "ultra-miami-2026", { [V1]: "off" });
    ok(G(ctx) === "off" && !(V1 in store), "a legacy no does not stay no");
  }
  {
    const { ctx, store } = load(src, "ultra-miami-2026", { [V1]: "on", [V2]: JSON.stringify({ "ultra-miami-2026": "off" }) });
    ok(G(ctx) === "off" && !(V1 in store), "a legacy yes overrode an answer already given for that festival");
  }
  {
    const { ctx, store } = load(src, null, { [V1]: "on" });
    ok(G(ctx) === null && store[V1] === "on", "with no festival active the legacy yes was moved or dropped");
  }
  // 3. No active festival
  {
    const { ctx, store } = load(src, null);
    S(ctx, true);
    ok(G(ctx) === null && !(V2 in store), "with no festival active a yes was written");
  }
  {
    const { ctx } = load(src, "edc-lv-2026", { [V2]: "not json" });
    ok(G(ctx) === null, "a corrupt store reads on");
    const c2 = load(src, "edc-lv-2026", { [V2]: JSON.stringify(["on"]) }).ctx;
    ok(G(c2) === null, "an array store reads on");
  }
  return { checks, fails };
}

const base = run(CHROME);
for (const f of base.fails) console.log(`  ✗  ${f}`);
let failed = base.fails.length;

// 4. Wiring, on code lines of the source
const code = SRC.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const watcher = (code.match(/function SetTrackingWatcher\(\)[\s\S]*?\n}\n/) || [""])[0];
const card = (code.match(/function SetTrackingCard\(\)[\s\S]*?\n}\n/) || [""])[0];
const wire = [
  [/const run = !!fid && getSetTracking\(fid\) === "on"/.test(watcher), "the watcher reads the active festival's own answer"],
  [/const on = !!cfg && getSetTracking\(cfg\.id\) === "on"/.test(card), "the card reads the shown festival's own answer"],
  [/setSetTracking\(true, cfg && cfg\.id\)/.test(card) && /data-set-tracking-off onClick=\{\(\) => setSetTracking\(false, cfg && cfg\.id\)\}/.test(card), "the card writes the shown festival's answer"],
  [/This is for \{name\} only; another festival asks again\./.test(card), "the consent says it is for this festival only"],
  [!/getSetTracking\(\)/.test(watcher + card), "the watcher or the card reads a global answer"],
];
for (const [c, m] of wire) if (!c) { failed++; console.log(`  ✗  ${m}`); }

// 5. Broken fixtures in the compiled source
const MUT = [
  ["var v = _readSetTrackPrefs()[festivalId];", 'var v = Object.values(_readSetTrackPrefs()).includes("on") ? "on" : _readSetTrackPrefs()[festivalId];'],  // a yes anywhere = a yes everywhere
  ["localStorage.removeItem(SET_TRACK_PREF_V1_KEY);", ""],                                                                         // legacy yes spreads
  ["&& !Object.prototype.hasOwnProperty.call(prefs, fid)) prefs[fid] = v1;", ") prefs[fid] = v1;"],                                                                  // legacy overrides an answer
  ["if (!festivalId) return;", 'if (!festivalId) festivalId = "undefined";'],                                                      // writes with no festival
];
let caught = 0;
for (const [from, to] of MUT) {
  const n = CHROME.split(from).length - 1;
  if (n !== 1) { failed++; console.log(`  ✗  broken-fixture target not found exactly once (${n}): ${from}`); continue; }
  let r;
  try { r = run(CHROME.replace(from, to)).fails.length; } catch { r = 1; }
  if (r > 0) caught++; else { failed++; console.log(`  ✗  broken fixture survived: ${from} → ${to}`); }
}
console.log(`${failed ? "✗" : "✓"} set tracking per festival: ${base.checks - base.fails.length}/${base.checks} checks, ${wire.length} wiring checks, ${caught}/${MUT.length} broken fixtures caught`);
process.exit(failed ? 1 : 0);
