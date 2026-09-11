#!/usr/bin/env node
// Live Set Check-in (TestFlight trial) — the pure half, on the REAL compiled
// code (build/data.js + build/photo-tag.js + build/spotify.js) in a vm, plus
// static checks on the native plugin. No browser, no device.
//   1. Night + active sets from the festival clock: before and after
//      midnight, a set that crosses midnight, before gates.
//   2. GPS → stage only on good evidence: fresh, ±100 m, ≤200 m from the
//      nearest stage, ≥35 m clear of the runner-up. Anything else, no stage.
//   3. Schedule picks the set: one at the trusted stage, or one festival-wide
//      with no trusted stage; otherwise the user chooses. Never array order.
//   4. CHANGE SET offers the set on now plus its neighbours, per stage.
//   5. The saved moment: metadata only, no coordinates, Shazam's artist
//      never becomes the performer, a no-match still checks in.
//   6. Another festival's config works from any active festival, on the
//      weekend the clock says (ACL W2 from a Lost Lands session).
//   7. The trial gate is closed outside debug/TestFlight native builds.
//   8. The native plugin: one live call at a time, cancel(), stop on
//      resign/interruption, a cancellable 12 s timer, no release logging,
//      no file writes on the live path, no background audio mode.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const noop = () => {};
const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                    classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
const store = { active_festival_id: "lost-lands-2026", active_festival_explicit: "1" };
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
for (const n of ["data", "photo-tag", "spotify"]) vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
const S = vm.runInContext(`({ resolveLiveCheckin, _checkinGps, _checkinChoices, _checkinMoment, _checkinNight, _checkinActive,
  _liveCheckinTrialAllowed, _liveCheckinTrialOn, _momentNeedsReview, _TAG_SOURCE_LABEL, _DATA_SETS, resolvedStageAnchors, _haversineMeters })`, ctx);

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const H = 3600000, M = 60000, M_PER_DEG = 111195;

// Fixture: EDC Las Vegas — overnight sets, nine stages, every stage anchored.
const EDC = S._DATA_SETS["edc-lv-2026"];
const ecfg = EDC.config, eacts = EDC.artists, eanch = S.resolvedStageAnchors(ecfg);
check(ecfg.tz === "America/Los_Angeles" && eanch.length >= 5, `EDC fixture: tz ${ecfg.tz}, ${eanch.length} anchors`);
// Independent oracle: festival-local minutes on the night, naive (EDC's
// May dates cross no DST change), with the after-midnight +24h rule.
const nightMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const oracle = (n, localMin) => eacts.filter(a => a.day === n && a.start && a.end && nightMin(a.start) <= localMin && localMin < nightMin(a.end)).map(a => a.id).sort();
const at = (n, localMin) => ecfg.dayDates[n].midnightUtc + localMin * M;
const ids = list => list.map(a => a.id).sort().join(",");
const fixAt = (stageId, extra = {}) => { const a = eanch.find(x => x.stageId === stageId); return { lat: a.lat, lng: a.lng, accuracy: 10, ...extra }; };
const clearStage = stageId => { const a = eanch.find(x => x.stageId === stageId); return eanch.filter(x => x !== a).every(x => S._haversineMeters(a.lat, a.lng, x.lat, x.lng) >= 60); };

// ── 1. Night + active sets from the clock ──────────────────────────────────
const T1 = at(1, 22 * 60 + 30), T2 = at(2, 25 * 60 + 30);
{
  const r1 = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: null });
  check(r1.night === 1 && ids(r1.active) === oracle(1, 22 * 60 + 30).join(","), `22:30 night 1: ${r1.active.length} sets on (oracle ${oracle(1, 1350).length})`);
  check(r1.active.length > 1, "22:30 night 1 has overlapping stages (fixture sanity)");
  const r2 = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T2, fix: null });
  check(r2.night === 2 && ids(r2.active) === oracle(2, 25 * 60 + 30).join(","), `01:30 after night 2 stays night 2, not 3 (${r2.night}, ${r2.active.length} sets)`);
  const cross = eacts.find(a => a.start && a.end && +a.start.slice(0, 2) >= 20 && +a.end.slice(0, 2) < 8 && nightMin(a.end) > 24 * 60);
  check(!!cross, "fixture has a set crossing midnight");
  if (cross) {
    const r = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: at(cross.day, nightMin(cross.end) - 10), fix: null });
    check(r.active.some(a => a.id === cross.id) && r.night === cross.day, `${cross.name} ${cross.start}–${cross.end}: on 10 min before its end, night ${cross.day}`);
    const after = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: at(cross.day, nightMin(cross.end)), fix: null });
    check(!after.active.some(a => a.id === cross.id), "…and off at its end minute ([start, end))");
  }
  const pre = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: at(1, 15 * 60), fix: null });
  check(pre.active.length === 0 && pre.night === 1 && pre.basis === "choose" && pre.reason === "no-active-set" && pre.artistId === null,
    `15:00 before gates: no set, night ${pre.night}, ${pre.reason}`);
  check(S._checkinNight(ecfg, at(1, 9 * 60)) === null && S._checkinNight(ecfg, ecfg.dayDates[3].midnightUtc + 31 * H) === null, "09:00 and after the last morning are no festival night");
  console.log(`  ✓ clock: nights, overnight sets, before gates (22:30 ${r1.active.length} on, 01:30 ${r2.active.length} on)`);
}

// ── 2 + 3. GPS evidence and the proposal ───────────────────────────────────
const soloStage = (() => {
  const on = eacts.filter(a => oracle(1, 1350).includes(a.id));
  return eanch.map(a => a.stageId).find(s => on.filter(a => a.stage === s).length === 1 && clearStage(s));
})();
check(!!soloStage, `fixture: a clear stage with exactly one set at 22:30 (${soloStage})`);
const soloAct = eacts.find(a => oracle(1, 1350).includes(a.id) && a.stage === soloStage);
{
  const ok = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: fixAt(soloStage, { timestamp: T1 - 2000 }) });
  check(ok.gps.status === "trusted" && ok.stageId === soloStage && ok.artistId === soloAct.id && ok.basis === "gps-schedule",
    `at the ${soloStage} anchor: ${ok.gps.status} → ${ok.artistId} (${ok.basis})`);
  const several = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: null });
  check(several.artistId === null && several.basis === "choose" && several.reason === "several-active", `no GPS, ${several.active.length} sets on → choose, nothing picked`);
  const denied = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: { denied: true } });
  check(denied.gps.status === "denied" && denied.artistId === null && denied.stageId === null, "location denied → no stage, nothing picked");
  const coarse = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: fixAt(soloStage, { accuracy: 150 }) });
  check(coarse.gps.status === "coarse" && coarse.stageId === null && coarse.artistId === null, `±150 m at the anchor → ${coarse.gps.status}, nothing picked`);
  const noAcc = S._checkinGps(eanch, fixAt(soloStage, { accuracy: undefined }), T1);
  check(noAcc.status === "coarse", "no reported accuracy → coarse");
  const edge = S._checkinGps(eanch, fixAt(soloStage, { accuracy: 100 }), T1);
  check(edge.status === "trusted", "±100 m exactly → trusted");
  const stale = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: fixAt(soloStage, { timestamp: T1 - 20000 }) });
  check(stale.gps.status === "stale" && stale.artistId === null, "a 20 s old fix → stale, nothing picked");
  const far = fixAt(soloStage); far.lat += 5000 / M_PER_DEG;
  const out = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: far });
  check(out.gps.status === "outside" && out.stageId === null && out.artistId === null && Math.round(out.gps.distM) > 4000, `5 km off → outside (${Math.round(out.gps.distM)} m)`);
  // Margin on synthetic anchors 100 m apart, north of each other.
  const A = { stageId: "a", lat: 36, lng: -115 }, B = { stageId: "b", lat: 36 + 100 / M_PER_DEG, lng: -115 };
  const north = m => ({ lat: 36 + m / M_PER_DEG, lng: -115, accuracy: 5 });
  const g32 = S._checkinGps([A, B], north(32), 0), g33 = S._checkinGps([A, B], north(33), 0), g50 = S._checkinGps([A, B], north(50), 0);
  check(g32.status === "trusted" && g32.stageId === "a", `32 m from A, 68 from B (margin ${g32.marginM.toFixed(1)}) → trusted A`);
  check(g33.status === "ambiguous" && !g33.stageId, `33 m from A, 67 from B (margin ${g33.marginM.toFixed(1)}) → ambiguous`);
  check(g50.status === "ambiguous", "midway → ambiguous");
  check(S._checkinGps([], north(0), 0).status === "no-anchors", "a festival with no stage positions → no-anchors");
  // A trusted stage with nothing on it never borrows a set from elsewhere.
  const emptyStage = eanch.map(a => a.stageId).find(s => clearStage(s) && !eacts.some(a => a.stage === s && oracle(1, 1350).includes(a.id)));
  if (emptyStage) {
    const e = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: fixAt(emptyStage) });
    check(e.stageId === emptyStage && e.artistId === null && e.reason === "no-set-at-stage", `trusted ${emptyStage} with no set on → stage kept, no set`);
  }
  // Exactly one set festival-wide and no trusted stage → schedule-only.
  const one = [soloAct];
  const so = S.resolveLiveCheckin({ cfg: ecfg, artists: one, anchors: eanch, atMs: T1, fix: null });
  check(so.artistId === soloAct.id && so.basis === "schedule-only" && so.stageId === null, "one set on festival-wide, no GPS → schedule-only proposal");
  // Two sets at the same trusted stage → choose, never array order.
  const twin = { ...soloAct, id: "twin", name: "Twin" };
  const tw = S.resolveLiveCheckin({ cfg: ecfg, artists: [soloAct, twin], anchors: eanch, atMs: T1, fix: fixAt(soloStage) });
  const twR = S.resolveLiveCheckin({ cfg: ecfg, artists: [twin, soloAct], anchors: eanch, atMs: T1, fix: fixAt(soloStage) });
  check(tw.artistId === null && twR.artistId === null && tw.reason === "several-at-stage", "two sets at one stage → choose, in either array order");
  console.log(`  ✓ GPS: trusted/denied/coarse/stale/outside/ambiguous/no-anchors; proposal never guesses`);
}

// ── 4. CHANGE SET choices ──────────────────────────────────────────────────
{
  const groups = S._checkinChoices(ecfg, eacts, T1, 1, soloStage);
  const rows = groups.flatMap(g => g.rows);
  const onNow = oracle(1, 1350);
  check(groups[0] && groups[0].stageId === soloStage, `the trusted stage leads (${groups[0] && groups[0].stageId})`);
  check(groups.every(g => g.rows.length >= 1 && g.rows.length <= 3), `≤3 rows per stage (${groups.map(g => g.rows.length).join("/")})`);
  check(onNow.every(id => rows.some(r => r.act.id === id && r.now)), `every set on now is offered and marked (${onNow.length})`);
  check(rows.every(r => r.act.day === 1), "night 1 only");
  const ok = groups.every(g => {
    const all = eacts.filter(a => a.day === 1 && a.stage === g.stageId).sort((x, y) => nightMin(x.start) - nightMin(y.start));
    const idx = g.rows.map(r => all.findIndex(a => a.id === r.act.id));
    return idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  });
  check(ok, "each stage's rows are consecutive slots (the set on now and its neighbours)");
  check(rows.length < eacts.filter(a => a.day === 1).length, `a slice, not the lineup (${rows.length} of ${eacts.filter(a => a.day === 1).length})`);
  console.log(`  ✓ CHANGE SET: ${groups.length} stages, ${rows.length} rows, trusted stage first`);
}

// ── 5. The saved moment ────────────────────────────────────────────────────
{
  const res = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: fixAt(soloStage, { accuracy: 12.4 }) });
  const other = eacts.find(a => oracle(1, 1350).includes(a.id) && a.id !== soloAct.id);
  const matched = { outcome: "matched", title: "Some Track", artist: other.name, appleMusicID: "123", artworkURL: "https://x/a.jpg", ms: 4200 };
  const sel = { artistId: res.artistId, stageId: res.stageId, source: res.basis, night: res.night };
  const m = S._checkinMoment({ cfg: ecfg, res, sel, song: matched, startedAt: T1, now: T1 + 9000, rand: () => 0.5 });
  check(m.artistId === soloAct.id && m.songCapture.artist === other.name, `Shazam named ${other.name}; the performer stays ${soloAct.name}`);
  check(m.kind === "checkin" && m.festivalId === "edc-lv-2026" && m.night === 1 && m.stageId === soloStage, "kind/festival/night/stage");
  check(m.tagSource === "live-gps-schedule" && m.autoTagged === true && m.needsRetag === false && m.locationSource === "gps-live", `tagSource ${m.tagSource}`);
  check(m.gpsAccM === 12 && m.gpsDistanceM === 0 && Number.isInteger(m.gpsStageMarginM), `rounded GPS metrics (${m.gpsAccM}, ${m.gpsDistanceM}, ${m.gpsStageMarginM})`);
  check(m.songCapture.source === "live-shazam" && m.songCapture.song === `${other.name} — Some Track` && m.shazamOutcome === "matched" && m.matchDurationMs === 4200, "song metadata + recap's .song");
  const exp = new Date(T1 + ecfg.utcOffsetHours * H).toISOString().replace("T", " ").slice(0, 19);
  check(m.takenAt === exp && m.takenAtSource === "live-checkin", `takenAt is festival-local ${m.takenAt}`);
  const m2 = S._checkinMoment({ cfg: ecfg, res: S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T2, fix: null }), sel: {}, song: null, startedAt: T2 });
  check(m2.takenAt === new Date(T2 + ecfg.utcOffsetHours * H).toISOString().replace("T", " ").slice(0, 19) && m2.night === 2, `01:30 check-in: takenAt ${m2.takenAt}, night 2`);
  // Privacy: plain JSON, no coordinates or media anywhere in it.
  const keys = []; (function walk(o) { for (const [k, v] of Object.entries(o)) { keys.push(k); if (v && typeof v === "object") walk(v); } })(m);
  check(!keys.some(k => /^(lat|lng|lon|latitude|longitude|coords|position|audio|blob|buffer|base64|data)$/i.test(k)), `no coordinate/media keys (${keys.length} keys)`);
  check(JSON.stringify(JSON.parse(JSON.stringify(m))) === JSON.stringify(m) && m.photoId === null && m.nativePath === null && m.hasGps === false, "plain JSON, no photo, no file, hasGps false");
  const js = JSON.stringify(m), fx = fixAt(soloStage);
  check(!js.includes(String(fx.lat).slice(0, 7)) && !js.includes(String(fx.lng).slice(0, 8)), "the fix's coordinates appear nowhere in the moment");
  // No Shazam match still checks in.
  const nm = S._checkinMoment({ cfg: ecfg, res, sel, song: { outcome: "no-match", ms: 12000 }, startedAt: T1 });
  check(nm.artistId === soloAct.id && nm.songCapture === null && nm.shazamOutcome === "no-match" && nm.matchDurationMs === 12000, "no-match: set still saved, no song");
  const off = S._checkinMoment({ cfg: ecfg, res, sel, song: { outcome: "offline", ms: 9000 }, startedAt: T1 });
  check(off.shazamOutcome === "offline" && off.songCapture === null, "offline: outcome recorded, no song");
  // Unresolved: needs review, and Shazam cannot fill the gap.
  const open = S.resolveLiveCheckin({ cfg: ecfg, artists: eacts, anchors: eanch, atMs: T1, fix: null });
  const um = S._checkinMoment({ cfg: ecfg, res: open, sel: { artistId: null, stageId: null, source: open.basis, night: open.night }, song: { ...matched, artist: soloAct.name }, startedAt: T1 });
  check(um.artistId === null && um.needsRetag === true && um.tagSource === "live-manual-or-unresolved" && S._momentNeedsReview(um), "unresolved + Shazam names a lineup act → still no performer, needs review");
  check(!S._momentNeedsReview(m), "a resolved check-in is not in the review list");
  // A manual pick is recorded as one, with the proposal kept for the trial sheet.
  const mp = S._checkinMoment({ cfg: ecfg, res, sel: { artistId: other.id, stageId: other.stage, source: "manual", night: 1 }, song: null, startedAt: T1 });
  check(mp.artistId === other.id && mp.tagSource === "live-manual" && mp.autoTagged === false && mp.proposedArtistId === soloAct.id && mp.proposedStageId === soloStage, "manual correction: live-manual, proposal kept");
  const so = S._checkinMoment({ cfg: ecfg, res: { ...open, artistId: soloAct.id, basis: "schedule-only" }, sel: { artistId: soloAct.id, source: "schedule-only", night: 1 }, song: null, startedAt: T1 });
  check(so.tagSource === "live-schedule-only" && so.locationSource === "none", "schedule-only tag");
  for (const t of ["live-gps-schedule", "live-schedule-only", "live-manual", "live-manual-or-unresolved"]) check(!!S._TAG_SOURCE_LABEL[t], `MomentCard has a label for ${t}`);
  console.log("  ✓ moment: metadata only, performer never from Shazam, no-match/offline/unresolved/manual");
}

// ── 6. Another festival, the weekend the clock says ────────────────────────
{
  const ACL = S._DATA_SETS["acl-2026"], acfg = ACL.config, w = acfg.weekendStartMs;
  check(ctx.FESTIVAL_CONFIG.id === "lost-lands-2026" && w && w.W2 > w.W1, `session is ${ctx.FESTIVAL_CONFIG.id}; ACL has two weekends`);
  const shift = w.W2 - w.W1;
  const day = a => { const h = +a.start.slice(0, 2); return a.start && a.end && h >= 12 && h < 19; };
  const both = ACL.artists.find(a => a.weekend !== "W1" && a.weekend !== "W2" && day(a)) || ACL.artists.find(a => a.weekend === "W2" && day(a));
  const w1only = ACL.artists.find(a => a.weekend === "W1" && day(a));
  check(!!both, `fixture: an ACL daytime act on W2 (${both && both.name} ${both && both.start}, ${both && (both.weekend || "both")})`);
  const tW2 = acfg.dayDates[both.day].midnightUtc + shift + (nightMin(both.start) + 10) * M;
  const r = S.resolveLiveCheckin({ cfg: acfg, artists: ACL.artists, anchors: S.resolvedStageAnchors(acfg), atMs: tW2, fix: null });
  check(r.active.some(a => a.id === both.id) && r.night === both.day, `W2 ${both.start}+10: ${both.name} on, night ${r.night}`);
  check(r.active.every(a => a.weekend !== "W1"), `no W1-only act on during W2 (${r.active.length} on)`);
  if (w1only) {
    const tW1 = acfg.dayDates[w1only.day].midnightUtc + (nightMin(w1only.start) + 10) * M;
    const r1 = S.resolveLiveCheckin({ cfg: acfg, artists: ACL.artists, anchors: [], atMs: tW1, fix: null });
    const r1w2 = S.resolveLiveCheckin({ cfg: acfg, artists: ACL.artists, anchors: [], atMs: tW1 + shift, fix: null });
    check(r1.active.some(a => a.id === w1only.id) && !r1w2.active.some(a => a.id === w1only.id), `${w1only.name} (W1 only): on in W1, off a week later`);
  }
  const m = S._checkinMoment({ cfg: acfg, res: r, sel: { artistId: both.id, source: "manual", night: both.day }, song: null, startedAt: tW2 });
  const exp = new Date(tW2 + acfg.utcOffsetHours * H).toISOString().replace("T", " ").slice(0, 19);
  check(m.festivalId === "acl-2026" && m.takenAt === exp && m.takenAt.startsWith("2026-10-"), `ACL W2 moment: ${m.takenAt}, festival acl-2026`);
  const ll = S._DATA_SETS["lost-lands-2026"];
  const llAct = ll.artists.find(a => a.start && a.end && a.stage);
  const lr = S.resolveLiveCheckin({ cfg: ll.config, artists: ll.artists, anchors: S.resolvedStageAnchors(ll.config), atMs: ll.config.dayDates[llAct.day].midnightUtc + (nightMin(llAct.start) + 5) * M, fix: { lat: 40, lng: -83, accuracy: 5 } });
  check(lr.gps.status === "no-anchors" && lr.stageId === null && lr.active.some(a => a.id === llAct.id), "Lost Lands (no stage positions): GPS never trusted, schedule still works");
  console.log(`  ✓ festivals: ACL W2 from a Lost Lands session, W1-only acts stay on W1, no-anchor festival`);
}

// ── 7. Trial gate ──────────────────────────────────────────────────────────
{
  const T = S._liveCheckinTrialAllowed;
  const table = [["debug", null, true], ["testflight", null, true], ["testflight", "1", true], ["testflight", "0", false],
                 ["debug", "0", false], ["appstore", null, false], ["appstore", "1", false], [undefined, "1", false], ["", null, false]];
  for (const [ch, st, want] of table) check(T(ch, st) === want, `channel ${ch} / key ${st} → ${want}`);
  const run = async (setup) => { vm.runInContext("_liveTrialPromise = null", ctx); setup(); return S._liveCheckinTrialOn(); };
  const web = await run(() => { delete ctx.Capacitor; ctx.ShazamPlugin = null; });
  const old = await run(() => { ctx.Capacitor = { isNativePlatform: () => true }; ctx.ShazamPlugin = { buildChannel: () => Promise.reject(Object.assign(new Error("not implemented"), { code: "UNIMPLEMENTED" })) }; });
  const store_ = await run(() => { ctx.ShazamPlugin = { buildChannel: async () => ({ channel: "appstore" }) }; });
  const tf = await run(() => { ctx.ShazamPlugin = { buildChannel: async () => ({ channel: "testflight" }) }; });
  store.plursky_live_checkin_trial_v1 = "0";
  const tfOff = await run(() => {});
  delete store.plursky_live_checkin_trial_v1;
  check(web === false && old === false && store_ === false && tf === true && tfOff === false,
    `runtime gate: web ${web}, pre-trial build ${old}, App Store ${store_}, TestFlight ${tf}, TestFlight opted out ${tfOff}`);
  delete ctx.Capacitor; ctx.ShazamPlugin = null; vm.runInContext("_liveTrialPromise = null", ctx);
  console.log("  ✓ trial gate: only debug/TestFlight native builds, key can opt out");
}

// ── 8. Native plugin + app config (static) ─────────────────────────────────
{
  const sw = readFileSync(join(ROOT, "ios/App/App/ShazamPlugin.swift"), "utf8");
  const plist = readFileSync(join(ROOT, "ios/App/App/Info.plist"), "utf8");
  const methods = (sw.match(/pluginMethods[^=]*=\s*\[([\s\S]*?)\n\s*\]/) || ["", ""])[1];
  check(/name: "cancel"/.test(methods) && /name: "buildChannel"/.test(methods) && /name: "identify"/.test(methods), "plugin exports identify, cancel, buildChannel");
  check(/if liveCall != nil \{\s*call\.reject\([^)]*"BUSY"\)/.test(sw), "a second live call is rejected BUSY, not swapped in");
  check(/willResignActiveNotification/.test(sw) && /AVAudioSession\.interruptionNotification/.test(sw), "resign-active and interruption stop the attempt");
  check(/DispatchWorkItem/.test(sw) && /liveTimeout\?\.cancel\(\)/.test(sw) && /asyncAfter\(deadline: \.now\(\) \+ 12, execute:/.test(sw), "12 s timeout is a cancellable work item");
  const live = sw.slice(sw.indexOf("// MARK: - Live mic"), sw.indexOf("// MARK: - SHSessionDelegate"));
  check(live.length > 500 && !/AVAudioFile|FileManager|\.write\(|NSTemporaryDirectory/.test(live), "the live path writes no file");
  const teardown = live.slice(live.indexOf("private func teardownLive"));
  check(/liveCall = nil/.test(teardown) && /removeTap\(onBus: 0\)/.test(teardown) && /engine\.stop\(\)/.test(teardown) && /setActive\(false/.test(teardown) && /removeObserver/.test(teardown),
    "teardown clears the call, removes the tap, stops the engine, deactivates the session, drops observers");
  // The pending identify() call is resolved in exactly one place, finishLive;
  // cancel() only answers its own call. Two rejects: BUSY and a start failure.
  check((live.match(/call\.resolve\(payload\)/g) || []).length === 1 && !/liveCall[?!]\.resolve/.test(live)
    && (live.match(/call\.reject\(/g) || []).length === 2, "identify() resolves only in finishLive; rejects only BUSY and start failure");
  const prints = sw.match(/\bprint\(/g) || [];
  check(prints.length === 1 && /#if DEBUG\s*\n\s*print\(/.test(sw), `one print, inside #if DEBUG (${prints.length})`);
  check(!/<key>UIBackgroundModes<\/key>[\s\S]{0,200}<string>audio<\/string>/.test(plist), "no background audio mode");
  check(/<key>NSMicrophoneUsageDescription<\/key>/.test(plist) && /<key>NSLocationWhenInUseUsageDescription<\/key>/.test(plist) && !/NSLocationAlwaysAndWhenInUseUsageDescription/.test(plist),
    "microphone + when-in-use location strings; no always-location");
  const spot = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
  check(spot.includes("if (!trialLive && (!isFestivalLive || !liveState.stage)) return null;"), "outside the trial the bar's show rule is unchanged");
  console.log("  ✓ native: BUSY guard, cancel, resign/interruption stop, cancellable 12 s timer, no file, no release log, no background audio");
}

if (failed) { console.log(`  ✗  ${failed} of ${checks} live check-in checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} live check-in checks`);
