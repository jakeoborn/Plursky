#!/usr/bin/env node
// Set-clash solver (15-feature program #1): clashSuggestion on the REAL
// compiled build/data.js in a vm, on a synthetic lineup only, so a lineup
// flip can never move it.
//   1. Plays again: only one act of the pair has a later timed set the user
//      can reach (same weekend) → keep the other. Earlier nights, the other
//      weekend and untimed repeats never count. Both repeating → next rule.
//   2. Your music: only one is in the Spotify matches → keep it.
//   3. Split: the middle switch gives each set 30+ min → split there.
//   4. Nothing separates the pair → null. Tier never decides (it is a time
//      slot in most lineups, not a billing).
//   5. Order: every case runs as (a, b) and (b, a) and must agree.
//   6. Mutations: each rule nudged in the compiled source must fail a check.
// The UI wiring (lineup.jsx ConflictResolver) is gated statically on code
// lines: the suggestion row reads clashSuggestion and applies it through the
// same keep/split paths the manual buttons use.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
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
  // toNightMin lives in lineup.jsx (a component file); the solver calls it at
  // run time. This is the same body, checked against lineup.jsx below.
  vm.runInContext(TONIGHT_SRC, ctx);
  vm.runInContext(src, ctx, { filename: "build/data.js" });
  return vm.runInContext(`({ clashSuggestion, clashPlaysAgain })`, ctx);
}
const LINEUP_SRC = readFileSync(join(ROOT, "lineup.jsx"), "utf8");
const TONIGHT_SRC = (LINEUP_SRC.match(/^function toNightMin\(hhmm\) \{[\s\S]*?\n\}/m) || [""])[0];

const act = (id, name, day, start, end, extra = {}) => ({ id, name, day, stage: "main", start, end, ...extra });
const DAY = { 1: "Fri", 2: "Sat", 3: "Sun" };
const dayLabel = d => DAY[d];

function run(F) {
  let checks = 0, failed = 0; const fails = [];
  const check = (ok, msg) => { checks++; if (!ok) { failed++; fails.push(msg); } };
  // Every suggestion is asked for in both orders; the answers must agree.
  const S = (a, b, ctx = {}) => {
    const c = { lineup: ctx.lineup || [a, b], matchedIds: ctx.matchedIds || [], dayLabel };
    const x = F.clashSuggestion(a, b, c), y = F.clashSuggestion(b, a, c);
    check(JSON.stringify(x) === JSON.stringify(y), `order: (a,b) and (b,a) agree for ${a.id}/${b.id} (${JSON.stringify(x)} vs ${JSON.stringify(y)})`);
    return x;
  };

  // A pair too tight to split: 22:00–22:30 and 22:20–23:00 (range
  // 22:20..22:25, so the first set gets 25 min at most).
  const A = act("a1", "Alpha", 1, "22:00", "22:30"), B = act("b1", "Bravo", 1, "22:20", "23:00");

  // ── 1. plays again ──
  {
    const again = act("a2", "Alpha", 2, "21:00", "22:00");
    const r = S(A, B, { lineup: [A, B, again] });
    check(r && r.kind === "keep" && r.keepId === "b1" && r.dropId === "a1" && r.rule === "plays-again", `Alpha plays again Sat → keep Bravo (got ${JSON.stringify(r)})`);
    check(r && /Keep Bravo\. Alpha plays again Sat at 9:00 PM\./.test(r.reason), `reason names the act, the day and the time (got "${r && r.reason}")`);
    const name = act("a2", "  alpha ", 2, "21:00", "22:00");
    check((S(A, B, { lineup: [A, B, name] }) || {}).rule === "plays-again", "name match ignores case and outer spaces");
    const both = [A, B, again, act("b2", "Bravo", 3, "20:00", "21:00")];
    check((S(A, B, { lineup: both }) || {}).rule !== "plays-again", "both play again → not decided by plays-again");
    const A2 = act("a3", "Alpha", 2, "22:00", "22:30"), B2 = act("b3", "Bravo", 2, "22:20", "23:00");
    check(S(A2, B2, { lineup: [A2, B2, act("a4", "Alpha", 1, "21:00", "22:00")] }) === null, "an EARLIER night never counts (it may be over)");
    const w1 = { ...A, weekend: "W1" }, w1b = { ...B, weekend: "W1" };
    check(S(w1, w1b, { lineup: [w1, w1b, act("a2", "Alpha", 2, "21:00", "22:00", { weekend: "W2" })] }) === null, "a repeat on the other weekend never counts");
    check((S(w1, w1b, { lineup: [w1, w1b, act("a2", "Alpha", 2, "21:00", "22:00", { weekend: "both" })] }) || {}).rule === "plays-again", "a both-weekend repeat counts");
    check(S(A, B, { lineup: [A, B, act("a2", "Alpha", 2, null, null)] }) === null, "an untimed repeat never counts");
    check(S(A, B, { lineup: [A, B, act("a2", "Alpha", 1, "23:30", "23:59")] }) === null, "a second set the SAME night is not 'plays again'");
    const two = [A, B, act("a9", "Alpha", 3, "20:00", "21:00"), act("a2", "Alpha", 2, "21:00", "22:00")];
    check(/Sat at 9:00 PM/.test((S(A, B, { lineup: two }) || {}).reason || ""), "the soonest repeat is named, whatever the array order");
  }

  // ── 2. your music ──
  {
    const r = S(A, B, { matchedIds: ["b1"] });
    check(r && r.kind === "keep" && r.keepId === "b1" && r.rule === "your-music", `only Bravo matched → keep Bravo (got ${JSON.stringify(r)})`);
    check(r && /Keep Bravo\. It is in your Spotify artists\./.test(r.reason), "reason says Spotify");
    check(S(A, B, { matchedIds: ["a1", "b1"] }) === null, "both matched → not decided by music");
    // Order of rules: plays-again first (keeping the other one loses nothing).
    const r2 = S(A, B, { lineup: [A, B, act("a2", "Alpha", 2, "21:00", "22:00")], matchedIds: ["a1"] });
    check(r2 && r2.rule === "plays-again" && r2.keepId === "b1", "plays-again outranks your-music (matched Alpha is seen Sat instead)");
  }

  // ── 3. split ──
  {
    const C = act("c1", "Charlie", 1, "22:00", "23:30"), D = act("d1", "Delta", 1, "22:30", "00:30");
    const r = S(C, D);
    // range 22:30..23:30, middle 23:00 → 60 and 90.
    check(r && r.kind === "split" && r.switchMin === (23 * 60) && r.firstId === "c1" && r.secondId === "d1", `split at 11:00 PM (got ${JSON.stringify(r)})`);
    check(r && /Split: Charlie until 11:00 PM, then Delta \(60 and 90 min\)\./.test(r.reason), `split reason (got "${r && r.reason}")`);
    const E = act("e1", "Echo", 1, "22:00", "22:40"), G = act("g1", "Golf", 1, "22:20", "23:00");
    const r30 = S(E, G); // range 22:20..22:35, middle 22:27.5 → grid 22:30 → 30 and 30
    check(r30 && r30.kind === "split" && r30.switchMin === 22 * 60 + 30, `exactly 30 + 30 min splits (got ${JSON.stringify(r30)})`);
    check(S(A, B) === null, "a split leaving under 30 min for one set is not suggested");
    const M1 = act("m1", "Mike", 1, "00:30", "02:00"), M2 = act("m2", "Nova", 1, "01:00", "03:00");
    const rm = S(M1, M2); // range 01:00..02:00 → 01:30, 60 and 90
    check(rm && rm.kind === "split" && rm.switchMin === (25 * 60 + 30), `after midnight splits on night minutes (got ${JSON.stringify(rm)})`);
    const P = act("p1", "Papa", 1, "22:00", "23:00"), Q = act("q1", "Quebec", 1, "22:00", "23:00");
    const rq = S(P, Q);
    check(rq && rq.kind === "split" && rq.firstId === "p1", `same start and end: a split exists and the first is the lower id (got ${JSON.stringify(rq)})`);
    check((S(C, D, { matchedIds: ["d1"] }) || {}).rule === "your-music", "your-music outranks split");
  }

  // ── 4. nothing separates ──
  {
    check(S({ ...A, tier: 3 }, { ...B, tier: 1 }) === null, "tier never decides");
    check(F.clashSuggestion(A, A, { lineup: [A], matchedIds: [], dayLabel }) === null, "the same act twice → null");
    check(F.clashSuggestion(null, B, { lineup: [B], matchedIds: [], dayLabel }) === null, "a missing act → null");
    const U = act("u1", "Uniform", 1, null, null);
    check(S(U, B) === null, "an untimed act → no split, null");
  }
  return { checks, failed, fails };
}

let staticChecks = 0, staticFail = 0;
const sCheck = (ok, msg) => { staticChecks++; if (!ok) { staticFail++; console.log(`  ✗  ${msg}`); } };
sCheck(TONIGHT_SRC.includes("(h < 8 ? h + 24 : h) * 60 + m"), "lineup.jsx toNightMin is the body this test loads");
const code = LINEUP_SRC.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const resolver = (code.match(/function ConflictResolver\([\s\S]*?\n\}\n/) || [""])[0];
sCheck(/const sug = clashSuggestion\(a, b\);/.test(resolver), "ConflictResolver asks clashSuggestion for the pair on screen");
sCheck(/sug\.kind === "keep"\) onKeep\(sug\.keepId, sug\.dropId\)/.test(resolver), "a keep suggestion goes through onKeep (the manual Keep this path)");
sCheck(/else splitNight\(a, b, sug\.switchMin\)/.test(resolver), "a split suggestion goes through splitNight (the Split the night path)");
sCheck(/\{sug && \(/.test(resolver), "no suggestion → no row");

const base = run(load(DATA));
for (const f of base.fails) console.log(`  ✗  ${f}`);

// ── 6. Mutations ──
const MUT = [
  ["CLASH_SPLIT_MIN_MIN = 30", "CLASH_SPLIT_MIN_MIN = 25"],
  ["x.day > a.day && _attendSameWeekend(a, x)", "x.day !== a.day && _attendSameWeekend(a, x)"],
  ["x.day > a.day && _attendSameWeekend(a, x)", "x.day > a.day && true"],
  ["!!againA !== !!againB", "againA || againB"],
  ["mA !== mB", "mA || mB"],
  ["(r.lo + r.hi) / 2", "r.lo"],
  ["x.start && x.end && _clashName(x) === n", "_clashName(x) === n"],
  ["toNightMin(x.end) - toNightMin(y.end) || String(x.id).localeCompare(String(y.id))", "toNightMin(x.end) - toNightMin(y.end)"],
];
let caught = 0, mutFail = 0;
for (const [from, to] of MUT) {
  const n = DATA.split(from).length - 1;
  if (n !== 1) { mutFail++; console.log(`  ✗  mutation target not found exactly once (${n}): ${from}`); continue; }
  let r;
  try { r = run(load(DATA.replace(from, to))); } catch { r = { failed: 1 }; }
  if (r.failed > 0) caught++; else { mutFail++; console.log(`  ✗  mutation survived: ${from} → ${to}`); }
}
const failed = base.failed + mutFail + staticFail;
console.log(`${failed ? "✗" : "✓"} clash solver: ${base.checks - base.failed}/${base.checks} checks, ${staticChecks - staticFail}/${staticChecks} static, ${caught}/${MUT.length} mutations caught`);
process.exit(failed ? 1 : 0);
