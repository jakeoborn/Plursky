#!/usr/bin/env node
// Saved sets the lineup still carries: one view, and storage keeps every id.
//
// An official lineup can drop an act after someone saved it (CRSSD Fall 2026
// lost Skepta Más Tiempo between two official renderings). The saved id then
// outlives its act. Lane ruling 2026-09-27: every saved-set surface (counts,
// Search, Saved by day, sharing, reminders, crew broadcast) reads ONE view,
// savedInLineup(), and NO id is deleted: storage and the cloud row keep
// orphans until an explicit data-retention decision.
//
// The four regressions the ruling named:
//   1. removed act: counted and shown nowhere, still stored
//   2. removed-then-readded act: comes back saved, in its saved position
//   3. cloud sign-in union merge: an orphan on either side survives the merge
//   4. zero saved live acts: every surface reads as "nothing saved"
//
// Part A grades the shipped functions (build/data.js, build/supabase.js) in a
// vm. Part B loads the running app with a stored orphan and reads what the
// user sees, then saves a set and reads storage back. Part C is the detector:
// a raw saved-list COUNT outside the sync effects fails, so the next surface
// cannot quietly count orphans again.
import vm from "node:vm";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Part A: the shipped functions ──────────────────────────────────────────
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const noop = () => {};
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
  CustomEvent: function CustomEvent(type) { this.type = type; },
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
// supabase.js builds its client at eval time; a stub client that never answers.
ctx.supabase = { createClient: () => new Proxy({}, { get: () => new Proxy(() => new Promise(noop), { get: () => () => new Promise(noop) }) }) };
ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
vm.createContext(ctx);
vm.runInContext(MODS, ctx);
for (const n of ["data", "supabase"]) {
  vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
}
const F = vm.runInContext(`({ savedInLineup: typeof savedInLineup === "function" ? savedInLineup : null,
  mergeCloudSaved: typeof mergeCloudSaved === "function" ? mergeCloudSaved : null })`, ctx);
if (!F.savedInLineup || !F.mergeCloudSaved) {
  console.log(`  ✗  HARNESS DEAD: savedInLineup ${!!F.savedInLineup}, mergeCloudSaved ${!!F.mergeCloudSaved}`);
  process.exit(1);
}
const lineup = ctx.ARTISTS;
if (!Array.isArray(lineup) || lineup.length < 3) { console.log("  ✗  HARNESS DEAD: no active lineup"); process.exit(1); }
const [A, B, C] = lineup.map(a => a.id);
const GONE = "fixture-act-the-lineup-dropped";
check(!lineup.some(a => a.id === GONE), "fixture sanity: the orphan id is not in the lineup");

// 1. removed act
{
  const stored = [A, GONE, B];
  const snapshot = [...stored];
  const view = F.savedInLineup(stored);
  check(same(view, [A, B]), `1. removed act: the view drops it, keeps saved order (got ${JSON.stringify(view)})`);
  check(same(stored, snapshot), "1. removed act: the stored list is not mutated");
}
// 2. removed-then-readded: the same stored list, the act back in the lineup
{
  const stored = [A, GONE, B];
  const back = { ...lineup[2], id: GONE, name: "Fixture Returning Act" };
  ctx.ARTISTS = [...lineup, back];
  const view = F.savedInLineup(stored);
  ctx.ARTISTS = lineup;
  check(same(view, [A, GONE, B]), `2. readded act: comes back saved, in its saved position (got ${JSON.stringify(view)})`);
  check(same(F.savedInLineup(stored), [A, B]), "2. readded act: dropping it again hides it again (no cached view)");
}
// 3. cloud sign-in union merge
{
  const cloud = { updated_at: "2026-09-27T12:00:00.000Z", artist_ids: [B, GONE] };
  const merged = F.mergeCloudSaved([A], cloud, {});
  check(merged.includes(GONE), "3. union merge: an orphan held only by the cloud survives the merge");
  check(merged.includes(A) && merged.includes(B), "3. union merge: local and cloud live ids both survive");
  check(same(F.savedInLineup(merged), [A, B]), "3. union merge: the view of the merged list shows only live acts");
  const localOrphan = F.mergeCloudSaved([GONE, A], { updated_at: cloud.updated_at, artist_ids: [B] }, {});
  check(localOrphan.includes(GONE), "3. union merge: an orphan held only locally survives the merge");
  // The existing tombstone rule is unchanged: a removal newer than the row wins.
  const tomb = F.mergeCloudSaved([A], cloud, { [B]: "2026-09-27T13:00:00.000Z" });
  check(!tomb.includes(B), "3. union merge: a tombstone newer than the cloud row still removes the id");
  const oldTomb = F.mergeCloudSaved([A], cloud, { [B]: "2026-09-27T11:00:00.000Z" });
  check(oldTomb.includes(B), "3. union merge: a tombstone older than the cloud row does not");
}
// 4. zero saved live acts
{
  check(same(F.savedInLineup([GONE]), []), "4. zero live: an orphan-only list reads as empty");
  check(same(F.savedInLineup([]), []) && same(F.savedInLineup(undefined), []) && same(F.savedInLineup(null), []),
    "4. zero live: empty / missing lists read as empty");
}
check(same(F.savedInLineup([C]), [C]), "control: a live id passes through");

// ── Part B: the running app ────────────────────────────────────────────────
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "acl-2026";
const ORPHAN = `${FID}-fixture-dropped-act`;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const open = async (saved, tab, extra = "") => {
    const bctx = await browser.newContext({ viewport: { width: 393, height: 844 }, serviceWorkers: "block" });
    await bctx.clock.install({ time: new Date("2026-09-28T18:00:00Z") });
    await bctx.addInitScript(({ FID, saved }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", FID);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("plursky_lineup_view", "list");
      localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(saved));
    }, { FID, saved });
    const page = await bctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=${tab}${extra}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.plurskyOpenSearch === "function", FID, { timeout: 60000 });
    await page.clock.runFor(2500);
    return { bctx, page };
  };
  const liveIds = await (async () => {
    const { bctx, page } = await open([], "home");
    const ids = await page.evaluate(() => window.activeLineup().filter(a => a.day != null && a.start).slice(0, 3).map(a => a.id));
    const hasOrphan = await page.evaluate(id => window.ARTISTS.some(a => a.id === id), ORPHAN);
    await bctx.close();
    check(!hasOrphan, "app fixture sanity: the orphan id is not in ACL's lineup");
    return ids;
  })();
  const [L1, L2] = liveIds;
  const stored = page => page.evaluate(fid => JSON.parse(localStorage.getItem(`${fid}_saved_v1`) || "null"), FID);
  const searchHeader = async page => {
    await page.evaluate(() => window.plurskyOpenSearch());
    await page.clock.runFor(400);
    return page.evaluate(() => (document.body.innerText.match(/YOUR LINEUP · (\d+) SETS?/) || [])[1] ?? null);
  };
  // Me's Plan action: its count, or 0 when it shows none (a zero is never
  // printed). null only when the action is missing.
  const meSaved = page => page.evaluate(() => {
    const b = document.querySelector("[data-me-action=saved]");
    if (!b) return null;
    const m = b.innerText.match(/(\d+)/);
    return m ? +m[1] : 0;
  });

  // 1. removed act, in the app
  {
    const { bctx, page } = await open([L1, ORPHAN], "me");
    check(await meSaved(page) === 1, `B1. Me counts 1 saved set with one live + one orphan (got ${await meSaved(page)})`);
    check(await searchHeader(page) === "1", "B1. Search reads YOUR LINEUP · 1 SETS, not 2");
    check(same(await stored(page), [L1, ORPHAN]), "B1. loading and reading did not delete the orphan from storage");
    // Crew showdown, both sides: a crew member on an older build can still
    // broadcast an orphan. Same orphan on both sides: counted raw it reads
    // SETS SAVED 2/2 and IN COMMON 1; through the view, 1/1 and 0.
    const rows = await page.evaluate(async ({ L1, L2, ORPHAN }) => {
      const drawn = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t) { drawn.push(String(t)); return orig.apply(this, arguments); };
      try { await window._renderCrewComparison("Me", { saved: [L1, ORPHAN] }, "Friend", [L2, ORPHAN]); }
      finally { CanvasRenderingContext2D.prototype.fillText = orig; }
      const at = label => { const i = drawn.indexOf(label); return i < 0 ? null : [drawn[i + 1], drawn[i + 2]]; };
      return { saved: at("SETS SAVED"), common: at("IN COMMON"), unique: at("UNIQUE PICKS") };
    }, { L1, L2, ORPHAN });
    check(same(rows.saved, ["1", "1"]), `B1c. crew showdown SETS SAVED counts live acts on both sides (got ${JSON.stringify(rows.saved)})`);
    check(same(rows.common, ["0", "0"]), `B1c. crew showdown IN COMMON ignores a shared orphan (got ${JSON.stringify(rows.common)})`);
    check(same(rows.unique, ["1", "1"]), `B1c. crew showdown UNIQUE PICKS counts live acts only (got ${JSON.stringify(rows.unique)})`);
    await bctx.close();
  }
  // 1b. a save written while an orphan is stored keeps the orphan
  {
    const { bctx, page } = await open([L1, ORPHAN], "lineup", `&artist=${encodeURIComponent(L2)}`);
    const btn = page.getByRole("button", { name: "Add to lineup", exact: true }).first();
    if (await btn.count()) {
      await btn.click();
      await page.clock.runFor(1500);
      const after = await stored(page);
      check(Array.isArray(after) && after.includes(ORPHAN) && after.includes(L1) && after.includes(L2),
        `B1b. saving another set keeps the orphan in storage (got ${JSON.stringify(after)})`);
    } else {
      check(false, `B1b. harness: no "Add to lineup" button on ${L2}'s artist screen`);
    }
    await bctx.close();
  }
  // 1d. Build My Night: the wizard counts and shares the view, writes raw.
  {
    const { bctx, page } = await open([L1, L2, ORPHAN], "lineup");
    const btn = page.getByRole("button", { name: /My night$/ }).first();
    if (await btn.count()) {
      await btn.click();
      await page.clock.runFor(500);
      const n = await page.evaluate(() => (document.body.innerText.match(/(\d+) SETS SAVED/) || [])[1] ?? null);
      check(n === "2", `B1d. Build My Night reads 2 SETS SAVED with two live + one orphan (got ${n})`);
    } else {
      check(false, "B1d. harness: no My night action on the lineup with two live saves");
    }
    check(same(await stored(page), [L1, L2, ORPHAN]), "B1d. opening the wizard did not delete the orphan");
    await bctx.close();
  }
  // 4. zero saved live acts, in the app
  {
    const { bctx, page } = await open([ORPHAN], "me");
    check(await meSaved(page) === 0, `B4. Me counts 0 saved sets with only an orphan stored (got ${await meSaved(page)})`);
    check(await searchHeader(page) === null, "B4. Search shows no YOUR LINEUP block with only an orphan stored");
    check(same(await stored(page), [ORPHAN]), "B4. the orphan-only list is still in storage");
    await bctx.close();
  }
  // Control: the Search header does count live saves (the reader is not blind).
  {
    const { bctx, page } = await open([L1, L2], "home");
    check(await searchHeader(page) === "2", "control: Search reads YOUR LINEUP · 2 SETS with two live saves");
    await bctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}

// ── Part C: the detector ───────────────────────────────────────────────────
// A COUNT of the raw saved list is how an orphan reaches the screen ("1 saved
// set" over an empty list). Only the sync effects in app.jsx may read it:
// they gate a push of the raw list, which must include orphans.
const ALLOW = new Set(["app.jsx:!state.saved.length) return;", "app.jsx:} else if (state.saved.length) {"]);
const offenders = [];
for (const f of readdirSync(ROOT).filter(f => f.endsWith(".jsx"))) {
  readFileSync(join(ROOT, f), "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    if (!/\bsaved\??\.length\b/.test(code) || !/state\.saved|myState\.saved/.test(code)) return;
    const key = `${f}:${code.trim().replace(/^if \(/, "")}`;
    if (![...ALLOW].some(a => key.startsWith(a.split(":")[0] + ":") && key.includes(a.split(":").slice(1).join(":")))) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
  });
}
check(offenders.length === 0, `C. raw saved-list counts outside the sync effects:\n     ${offenders.join("\n     ")}`);

console.log(`  ${failed ? "✗" : "✓"}  saved-set lineup view: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
