#!/usr/bin/env node
// Gate: paywall funnel events (SPEC-183 E1).
//
// What it proves, on the REAL compiled build/supabase.js run in a vm against a
// fake Supabase client that records every insert:
//   1. Shipped OFF: PAYWALL_EVENTS_ON is false and logPaywallEvent sends nothing.
//   2. When on, a row carries exactly six keys (event, surface, product_id,
//      offer_id, platform, app_version) and nothing that could identify a
//      person; unknown events and unsafe values are dropped, not stored.
//   3. A wait-capped send never blocks past its cap (the purchase reload).
//   4. The client's event list and columns match the header SQL, and the SQL
//      grants clients INSERT only.
//   5. PlusGate fires shown / accept / decline through the guarded _pwEvent,
//      accept before the reload, and a missing logger can't throw.
// Then it re-runs the checks on mutated builds and expects each to fail.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SB_BUILD = readFileSync(join(ROOT, "build", "supabase.js"), "utf8");
const SB_SRC = readFileSync(join(ROOT, "supabase.jsx"), "utf8");
const SP_BUILD = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const APP_VERSION = (readFileSync(join(ROOT, "index.html"), "utf8").match(/const APP_VERSION = '(v\d+)'/) || [])[1];

const ROW_KEYS = ["event", "surface", "product_id", "offer_id", "platform", "app_version"];
const IDENTIFYING = /user|device|pid|crew|name|email|token|idfa|ip/i;

function load(buildText, { native = false } = {}) {
  const inserts = [];
  const noop = () => {};
  const client = {
    from: table => ({ insert: row => { inserts.push({ table, row }); return Promise.resolve({ error: null }); } }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }), getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: noop,
    storage: { from: () => ({}) }, rpc: async () => ({ data: null }),
  };
  const ctx = {
    console: { log: noop, warn: noop, error: noop, info: noop }, Intl, URL, URLSearchParams, Promise,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, fetch: () => new Promise(noop),
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", onLine: true },
    location: { search: "", hash: "", pathname: "/", origin: "http://x", href: "http://x/" },
    document: { addEventListener: noop, removeEventListener: noop, visibilityState: "visible", createElement: () => ({ style: {} }), body: {}, head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createPortal: () => null }, CustomEvent: function () {},
    supabase: { createClient: () => client },
    Capacitor: { isNativePlatform: () => native },
    APP_VERSION,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  vm.createContext(ctx);
  vm.runInContext(buildText, ctx, { filename: "build/supabase.js" });
  const api = vm.runInContext(`({ on: PAYWALL_EVENTS_ON, names: PAYWALL_EVENT_NAMES, log: logPaywallEvent, row: _paywallEventRow })`, ctx);
  return { ...api, inserts, ctx };
}

const FLAG = /(?:const|var|let) PAYWALL_EVENTS_ON = false;/;
const ON = text => text.replace(FLAG, "var PAYWALL_EVENTS_ON = true;");

// Runs every assertion against (supabase build, supabase source, spotify build).
// Returns the list of failure messages.
async function run(sbBuild, sbSrc, spBuild) {
  const fails = [];
  let n = 0;
  const check = (ok, msg) => { n++; if (!ok) fails.push(msg); };

  // ── 1. shipped off ──────────────────────────────────────────────────────
  const off = load(sbBuild);
  check(off.on === false, "PAYWALL_EVENTS_ON ships false");
  for (const e of off.names) {
    const r = await off.log(e, { surface: "cloud backup", productId: "plursky_plus_monthly" });
    check(r === false, `flag off: logPaywallEvent("${e}") returns false`);
  }
  check(off.inserts.length === 0, `flag off: no insert reaches the client (saw ${off.inserts.length})`);

  // ── 2. when on: exact row shape ─────────────────────────────────────────
  check(FLAG.test(sbBuild), "positive control: the flag line is present to flip");
  const on = load(ON(sbBuild));
  check(on.on === true, "positive control: the flipped build reads the flag as true");
  await on.log("offer_shown", { surface: "cloud backup" });
  await on.log("offer_accept", { surface: "Wrapped export", productId: "plursky_season_pass_2026" });
  check(on.inserts.length === 2, `flag on: two valid events send two rows (saw ${on.inserts.length})`);
  for (const { table, row } of on.inserts) {
    check(table === "paywall_events", `row goes to paywall_events (got ${table})`);
    check(JSON.stringify(Object.keys(row).sort()) === JSON.stringify([...ROW_KEYS].sort()), `row keys are exactly ${ROW_KEYS.join(",")} (got ${Object.keys(row).join(",")})`);
    check(!Object.keys(row).some(k => IDENTIFYING.test(k)), `no identifying key in row (${Object.keys(row).join(",")})`);
  }
  const [shown, accept] = on.inserts.map(i => i.row);
  check(shown?.surface === "cloud_backup" && shown?.product_id === null, "surface is slugged; absent product stays null");
  check(accept?.surface === "wrapped_export" && accept?.product_id === "plursky_season_pass_2026", "accept carries its product id");
  check(shown?.platform === "web" && shown?.app_version === APP_VERSION, `platform web off-native, app_version ${APP_VERSION}`);
  check(load(ON(sbBuild), { native: true }).row("offer_shown", { surface: "x" })?.platform === "ios", "platform ios on native");

  // Unknown events and unsafe values never become stored text.
  const before = on.inserts.length;
  await on.log("purchase_card_number", { surface: "x" });
  await on.log("offer_shown", { surface: "" });
  await on.log("offer_shown", { surface: "!!!" });
  check(on.inserts.length === before, "unknown event, empty or unsluggable surface: nothing sent");
  const bad = on.row("offer_shown", { surface: "a".repeat(99), productId: "jake@example.com", offerId: "Promo Code 50" });
  check(bad?.surface.length === 40, "surface capped at 40");
  check(bad?.product_id === null, "a product id that isn't [a-z0-9_.] is dropped (an email can't ride along)");
  check(bad?.offer_id === null, "an offer id with spaces/caps is dropped");
  check(on.row("offer_shown", { surface: "x", offerId: "a".repeat(41) })?.offer_id === null, "offer id over 40 dropped");

  // ── 3. wait cap ─────────────────────────────────────────────────────────
  const hang = load(ON(sbBuild));
  hang.ctx.supabase = null;
  vm.runInContext(`_sb.from = () => ({ insert: () => new Promise(() => {}) });`, hang.ctx);
  const t0 = Date.now();
  // The test bounds its own wait, so a missing cap fails instead of hanging.
  const capped = await Promise.race([hang.log("offer_accept", { surface: "x" }, 300), new Promise(r => setTimeout(() => r("hung"), 2000))]);
  const dt = Date.now() - t0;
  check(capped === false && dt < 1000, `a hung insert releases at the cap (returned ${capped} after ${dt} ms)`);

  // ── 4. SQL contract ─────────────────────────────────────────────────────
  const tbl = (sbSrc.match(/create table if not exists paywall_events \(([\s\S]*?)\n\);/) || [])[1] || "";
  check(tbl.length > 0, "positive control: paywall_events SQL found in supabase.jsx");
  const sqlEvents = ((tbl.match(/event\s+text not null check \(event in \(([^)]*)\)\)/) || [])[1] || "")
    .split(",").map(s => s.trim().replace(/'/g, "")).filter(Boolean);
  check(JSON.stringify(sqlEvents) === JSON.stringify(off.names), `SQL event list ${sqlEvents} == client ${off.names}`);
  const cols = [...tbl.matchAll(/^\s+([a-z_]+)\s+(?:text|bigint|timestamptz)/gm)].map(m => m[1]);
  check(JSON.stringify(cols.filter(c => c !== "id" && c !== "created_at").sort()) === JSON.stringify([...ROW_KEYS].sort()), `SQL columns match the row (${cols})`);
  check(!cols.some(c => IDENTIFYING.test(c)), `no identifying column (${cols})`);
  check(/alter table paywall_events enable row level security;/.test(sbSrc), "RLS enabled on paywall_events");
  const pol = [...sbSrc.matchAll(/create policy "[^"]*" on paywall_events\s+for (\w+)/g)].map(m => m[1]);
  check(pol.length === 1 && pol[0] === "insert", `clients get INSERT only (policies: ${pol.join(",") || "none"})`);

  // ── 5. wiring in PlusGate ───────────────────────────────────────────────
  const gate = (spBuild.match(/function PlusGate\([\s\S]*?\n}\n/) || [])[0] || "";
  check(gate.length > 0, "positive control: PlusGate found in build/spotify.js");
  check(/_pwEvent\("offer_shown"/.test(gate), "PlusGate fires offer_shown");
  const acc = gate.indexOf('_pwEvent("offer_accept"'), rel = gate.indexOf("window.location.reload()", acc);
  check(acc > 0 && rel > acc && /await _pwEvent\("offer_accept"[^;]*,\s*1500\)/.test(gate), "accept is awaited (1500 ms cap) before the reload");
  check(/if \(result\.cancelled\) _pwEvent\("offer_decline"/.test(gate), "a cancelled sheet fires offer_decline");
  check(!/logPaywallEvent\(/.test(gate), "PlusGate never calls the logger bare");
  const pw = (spBuild.match(/function _pwEvent\([\s\S]*?\n}\n/) || [])[0] || "";
  check(pw.length > 0, "positive control: _pwEvent found");
  let threw = false, got;
  try { got = vm.runInNewContext(`${pw}; _pwEvent("offer_accept", {}, 1500)`, {}); } catch { threw = true; }
  check(!threw && got === false, "with no logger loaded, _pwEvent returns false and doesn't throw");
  let threw2 = false;
  try { vm.runInNewContext(`${pw}; function logPaywallEvent(){ throw new Error("boom") }; _pwEvent("offer_shown", {})`, {}); } catch { threw2 = true; }
  check(!threw2, "a logger that throws is contained");

  return { n, fails };
}

const base = await run(SB_BUILD, SB_SRC, SP_BUILD);
for (const f of base.fails) console.log(`  ✗  ${f}`);

// ── Mutants: each must make the gate fail ─────────────────────────────────
const MUTANTS = [
  ["flag shipped on", () => [ON(SB_BUILD), SB_SRC, SP_BUILD]],
  ["row gains a user id", () => [SB_BUILD.replace(/surface: s,/, "surface: s, user_id: 'u1',"), SB_SRC, SP_BUILD]],
  ["client event list drifts from SQL", () => [SB_BUILD.replace(/"cancel_save"\]/, '"cancel_save", "trial_start"]'), SB_SRC, SP_BUILD]],
  ["SQL grants SELECT", () => [SB_BUILD, SB_SRC.replace(/-- No SELECT, UPDATE or DELETE policy/, 'create policy "read" on paywall_events\n  for select using (true);\n-- No SELECT, UPDATE or DELETE policy'), SP_BUILD]],
  ["product id unvalidated", () => [SB_BUILD.replace(/product_id: id\(productId\)/, "product_id: productId ?? null"), SB_SRC, SP_BUILD]],
  ["no wait cap", () => [SB_BUILD.replace(/return Promise\.race\(\[send, [^\n]*\n/, "return send;\n"), SB_SRC, SP_BUILD]],
  ["accept after reload", () => [SB_BUILD, SB_SRC, SP_BUILD.replace(/await _pwEvent\("offer_accept"[^;]*;/, "")]],
  ["guard removed", () => [SB_BUILD, SB_SRC, SP_BUILD.replace(/try \{\s*return typeof logPaywallEvent === "function" \? logPaywallEvent\(event, fields, waitMs\) : false;\s*\} catch \{\s*return false;\s*\}/, "return logPaywallEvent(event, fields, waitMs);")]],
];
let caught = 0;
for (const [name, make] of MUTANTS) {
  const args = make();
  const landed = args[0] !== SB_BUILD || args[1] !== SB_SRC || args[2] !== SP_BUILD;
  const r = landed ? await run(...args) : { fails: [] };
  if (!landed) console.log(`  ✗  mutant "${name}" did not land (pattern stale)`);
  else if (r.fails.length) caught++;
  else console.log(`  ✗  mutant "${name}" survived`);
}

const ok = base.fails.length === 0 && caught === MUTANTS.length;
console.log(`  paywall events: ${base.n} checks, ${caught}/${MUTANTS.length} mutants caught`);
if (ok) console.log("  ✓ paywall events ship off, carry no identity, and match their table");
process.exit(ok ? 0 : 1);
