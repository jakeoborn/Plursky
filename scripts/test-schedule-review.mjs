#!/usr/bin/env node
// Schedule Sync step 3 — the overlay and the impact review.
//
// Runs data.jsx itself in a vm, one fresh realm per "launch" over a shared
// localStorage, because confirming an update reloads the app and the overlay
// only takes effect at boot. No browser.
//   1. Every live festival's committed feed reviews as up to date and writes
//      nothing.
//   2. A mutated Lost Lands feed: a saved set moved onto another saved set, a
//      saved set cancelled, a saved set moved to a stage this build has never
//      heard of, an unsaved set moved, one act added. The review names exactly
//      the saved changes, the one NEW clash, the two reminders that move or
//      go, and the one cancelled id that leaves the plan.
//   3. Confirm → relaunch: the lineup IS the feed, the added act carries the
//      fields the lineup reads unguarded, the bundle is kept, and the same
//      feed now reviews as up to date. A later feed replaces the overlay
//      instead of stacking; the bundle's own feed clears it; an overlay built
//      for another bundle, or unreadable storage, is dropped at boot.
//   4. The clash rule: weekends, days, TBA.
//   5. Native reminders: the first schedule after a relaunch cancels the
//      persisted slate, so an alert for a set no longer in the plan cannot fire.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const DATA = readFileSync(join(ROOT, "data.jsx"), "utf8");

const lsOver = store => ({ getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
// One app launch: a fresh realm over the given storage, the way a reload is.
function boot(store) {
  const ctx = { window: {}, console, Intl, fetch: () => {}, localStorage: lsOver(store) };
  vm.createContext(ctx);
  vm.runInContext(MODS + "\n" + DATA + "\n;__out = { REG: FESTIVALS_REGISTRY, DS: _DATA_SETS, scheduleReview, " +
    "applyScheduleReview, _scheduleActs, _schedClash, KEY: _SCHED_OVERLAY_KEY };", ctx);
  return { ...ctx.__out, W: ctx.window };
}

let checks = 0, failed = 0;
const js = v => JSON.stringify(v);                    // vm objects are another realm
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const feedOf = fid => JSON.parse(readFileSync(join(ROOT, "f", fid, "schedule.json"), "utf8"));

// ── 1. Committed feeds are current ──────────────────────────────────────────
{
  const store = {};
  const B = boot(store);
  let n = 0;
  for (const e of B.REG.filter(x => x.available)) {
    const r = B.scheduleReview(e.config.id, feedOf(e.config.id), { saved: [], now: 0 });
    check(r.upToDate === true && r.stored.changes.length === 0, `${e.config.id}: its own feed must review as up to date`);
    n++;
  }
  check(n >= 12, `only ${n} live festivals (12 at v310)`);
  check(Object.keys(store).length === 0, `a review wrote storage: ${Object.keys(store)}`);
  console.log(`  ✓ ${n} live festivals: the committed feed reviews as up to date, nothing written`);
}

// ── 2. A mutated feed ───────────────────────────────────────────────────────
const FID = "lost-lands-2026";
const nightMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const store = { active_festival_id: FID };
const B1 = boot(store);
const cfg = B1.DS[FID].config;
const bundle = B1._scheduleActs(B1.DS[FID].artists);
check(B1.W.FESTIVAL_CONFIG.id === FID, "the fixture festival must be active");
// Four timed sets on one day that do not overlap, earliest first.
const byDay = {};
for (const a of bundle) if (a.start && a.end) (byDay[a.day] = byDay[a.day] || []).push(a);
const pick = [];
for (const a of Object.values(byDay).sort((x, y) => y.length - x.length)[0].sort((x, y) => nightMin(x.start) - nightMin(y.start)))
  if (!pick.length || nightMin(a.start) >= nightMin(pick[pick.length - 1].end)) pick.push(a);
const [a1, a2, a3, a4] = pick;
check(pick.length >= 5, `need 5 non-overlapping sets on one day, found ${pick.length}`);
const u = pick[4];                                    // timed, not saved
// A saved set that ALREADY clashes with a2 in the bundle. That pair is not
// new, so it must not be listed; a1 moving onto a2's slot makes a1|pre new.
// (Its pairs with a3 and a4, if any, exist before and after: never new.)
const pre = bundle.find(a => a.day === a2.day && !pick.includes(a) && B1._schedClash(a, a2) && !B1._schedClash(a, a1));
check(!!pre, "need a bundled set that already clashes with a2 but not with a1");
const SAVED = [a1.id, a2.id, a3.id, a4.id, pre.id];
const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const ADDED = { id: "llnew1", name: "Surprise Guest", day: a1.day, stage: a1.stage, start: "23:10", end: "23:50" };
const mutate = acts => acts.filter(a => a.id !== a3.id).map(a =>
  a.id === a1.id ? { ...a, start: a2.start, end: a2.end } :
  a.id === a4.id ? { ...a, stage: "stage-this-build-never-heard-of" } :
  a.id === u.id  ? { ...a, start: hhmm(nightMin(u.start) + 30), end: hhmm(nightMin(u.end) + 30) } : a).concat([ADDED]);
const FEED = { festivalId: FID, source: { url: "https://example.org/x", observedAt: "2026-09-12", official: false },
               scheduleHash: "mutated-1", acts: mutate(bundle) };
const before = cfg.dayDates[1].midnightUtc - 86400000;
const R = B1.scheduleReview(FID, FEED, { saved: SAVED, now: before, remindersOn: true, leadMin: 15 });
{
  const ids = cs => cs.map(c => c.id).sort().join(",");
  check(R.upToDate === false, "a mutated feed must not read as up to date");
  check(ids(R.shown.changes) === [a1.id, a3.id, a4.id, u.id, ADDED.id].sort().join(","), `changes ${ids(R.shown.changes)}`);
  check(js(R.shown.counts) === js({ day: 0, stage: 1, start: 2, end: 2, weekend: 0, cancelled: 1, added: 1 }), `counts ${js(R.shown.counts)}`);
  check(ids(R.savedChanges) === [a1.id, a3.id, a4.id].sort().join(","), `saved changes ${ids(R.savedChanges)}`);
  check(R.savedChanges.find(c => c.id === a4.id).after.stage === null, "an unknown feed stage must read as unassigned");
  const pair = (x, y) => [x, y].sort().join("|");
  check(js(R.clashes.map(p => pair(p[0].id, p[1].id)).sort()) === js([pair(a1.id, a2.id), pair(a1.id, pre.id)].sort()),
    `clashes ${js(R.clashes.map(p => p.map(a => a.id)))} (the pre-existing ${pair(a2.id, pre.id)} must not be listed)`);
  const rem = Object.fromEntries(R.reminders.map(x => [x.id, x]));
  check(R.reminders.length === 2, `reminders ${js(R.reminders)}`);
  check(rem[a1.id] && rem[a1.id].from > before && rem[a1.id].to > rem[a1.id].from, `a1's reminder must move later: ${js(rem[a1.id])}`);
  check(rem[a3.id] && rem[a3.id].from > before && rem[a3.id].to === null, `a3's reminder must go: ${js(rem[a3.id])}`);
  check(js(R.dropSaved) === js([a3.id]), `dropSaved ${js(R.dropSaved)}`);
  const off = B1.scheduleReview(FID, FEED, { saved: SAVED, now: before, remindersOn: false });
  check(off.reminders.length === 0 && off.clashes.length === 2, "reminders off must list no reminders and still list the clashes");
  const after = B1.scheduleReview(FID, FEED, { saved: SAVED, now: cfg.endMs + 86400000, remindersOn: true });
  check(after.reminders.length === 0, "after the festival no reminder can move");
  check(B1.scheduleReview(FID, { ...FEED, festivalId: "acl-2026" }, {}).error === "bad-feed", "another festival's feed must be refused");
  check(!(B1.KEY in store), "reviewing must not write the overlay");
  console.log(`  ✓ review: ${R.shown.changes.length} changes, ${R.savedChanges.length} in the plan, 2 new clashes (the old one unlisted), 2 reminders, 1 leaves the plan`);
}

// ── 3. Confirm → relaunch ───────────────────────────────────────────────────
{
  const kept = B1.applyScheduleReview(R, SAVED);
  check(js(kept) === js([a1.id, a2.id, a4.id, pre.id]), `saved after apply ${js(kept)}`);
  const first = store[B1.KEY];
  B1.applyScheduleReview(R, SAVED);
  check(JSON.parse(store[B1.KEY])[FID].diff && js(JSON.parse(store[B1.KEY])[FID].diff) === js(JSON.parse(first)[FID].diff), "applying twice must store the same diff");

  const B2 = boot(store);
  const A = Object.fromEntries(B2.W.ARTISTS.map(a => [a.id, a]));
  check(A[a1.id].start === a2.start && A[a1.id].end === a2.end, "relaunch: the moved set must be at its new time");
  check(!A[a3.id], "relaunch: the cancelled set must be gone from the lineup");
  check(A[a4.id].stage === null, "relaunch: the unknown stage must be unassigned");
  const n = A[ADDED.id];
  check(n && typeof n.genre === "string" && typeof n.img === "string" && typeof n.tier === "number" && typeof n.bio === "string",
    `relaunch: the added act needs genre/img/tier/bio: ${js(n)}`);
  check(A[a2.id].genre === B1.DS[FID].artists.find(a => a.id === a2.id).genre, "relaunch: untouched fields must survive");
  check(B2.DS[FID].bundledArtists.length === bundle.length, "relaunch: the bundle must be kept");
  check(B2.scheduleReview(FID, FEED, { saved: kept, now: before }).upToDate === true, "relaunch: the same feed must now be up to date");

  // A later feed: shown is only the new delta, stored is bundle → feed.
  const FEED3 = { ...FEED, scheduleHash: "mutated-3", acts: FEED.acts.map(a => (a.id === a2.id ? { ...a, end: hhmm(nightMin(a2.end) + 15) } : a)) };
  const R3 = B2.scheduleReview(FID, FEED3, { saved: kept, now: before });
  check(js(R3.shown.changes.map(c => c.id)) === js([a2.id]) && R3.stored.changes.length === 6, `later feed: shown ${R3.shown.changes.length}, stored ${R3.stored.changes.length}`);
  const s3 = { ...store };
  B2.applyScheduleReview(R3, kept);
  const B3 = boot(store);
  check(B3.scheduleReview(FID, FEED3, { now: before }).upToDate === true, "later feed: after relaunch the lineup must equal it, not stack on the first");

  // Back to the bundle's own feed: the overlay clears.
  const R4 = B3.scheduleReview(FID, feedOf(FID), { saved: kept, now: before });
  check(R4.shown.changes.length === 6 && R4.stored.changes.length === 0, `bundle feed: shown ${R4.shown.changes.length}, stored ${R4.stored.changes.length}`);
  B3.applyScheduleReview(R4, kept);
  check(!(B3.KEY in store), "the bundle's own feed must clear the overlay");
  check(js(B3._scheduleActs(boot(store).W.ARTISTS)) === js(bundle), "cleared: the lineup must be the bundle again");

  // An overlay computed against another bundle, and unreadable storage.
  const stale = { ...s3, [B1.KEY]: JSON.stringify({ [FID]: { ...JSON.parse(s3[B1.KEY])[FID], base: "0000:1" } }) };
  const B5 = boot(stale);
  check(js(B5._scheduleActs(B5.W.ARTISTS)) === js(bundle) && !(B1.KEY in stale), "an overlay for another bundle must be dropped at boot");
  const junk = { active_festival_id: FID, [B1.KEY]: "{nope" };
  check(js(B5._scheduleActs(boot(junk).W.ARTISTS)) === js(bundle), "unreadable overlay storage must boot the bundle");
  console.log("  ✓ confirm → relaunch: the lineup is the feed, a later feed replaces it, the bundle's feed clears it, a foreign overlay is dropped");
}

// ── 4. Clash rule ───────────────────────────────────────────────────────────
{
  const s = (id, extra) => ({ id, day: 1, start: "21:00", end: "22:00", ...extra });
  check(B1._schedClash(s("a"), s("b")) === true, "same slot must clash");
  check(B1._schedClash(s("a", { weekend: "W1" }), s("b", { weekend: "W2" })) === false, "W1 and W2 must not clash");
  check(B1._schedClash(s("a", { weekend: "both" }), s("b", { weekend: "W2" })) === true, "both and W2 must clash");
  check(B1._schedClash(s("a"), s("b", { day: 2 })) === false, "different days must not clash");
  check(B1._schedClash(s("a"), s("b", { start: "", end: "" })) === false, "a TBA set cannot clash");
  check(B1._schedClash(s("a", { start: "23:30", end: "00:30" }), s("b", { start: "00:00", end: "01:00" })) === true, "past midnight is the same night");
  check(B1._schedClash(s("a"), s("b", { start: "22:00", end: "23:00" })) === false, "back to back is not a clash");
  console.log("  ✓ clash rule: weekends, days, TBA, past midnight, back to back");
}

// ── 5. Native reminders after a relaunch ────────────────────────────────────
{
  const noop = () => {};
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const ls = { reminders_v1: JSON.stringify([{ id: "gone", notifId: 424242, fireMs: Date.now() + 3600000 }]) };
  const cancelled = [];
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: lsOver(ls), sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: {
      cancel: o => { cancelled.push(...o.notifications.map(x => x.id)); return Promise.resolve(); },
      schedule: () => Promise.resolve() } } },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  for (const n of ["data", "chrome"]) vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
  vm.runInContext("scheduleReminders({ saved: [] }, () => {})", ctx);
  check(cancelled.includes(424242), `the first native schedule after a relaunch must cancel the persisted slate (cancelled ${js(cancelled)})`);
  console.log("  ✓ native reminders: the persisted slate is cancelled on the first schedule after a relaunch");
}

if (failed) { console.log(`  ✗  ${failed} of ${checks} schedule-review checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} schedule-review checks`);
