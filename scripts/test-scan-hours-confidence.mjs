#!/usr/bin/env node
// test-scan-hours-confidence.mjs: build 39's scan hours and tag confidence.
//
// Two field findings from Jake's ACL retest (2026-11-05):
//   - a dinner photo during a SAVED Rüfüs Du Sol set was tagged Rüfüs as
//     certain, GPS never consulted, and the review sheet said "all answered";
//   - Scan kept hotel and lunch photos because its night ran 10:30 → 06:30
//     for every festival.
// Jake's hours rule: "15 min before and after … everything else does not get
// scanned", "we can do photos/videos between set", "we have set times in the
// app". This gate runs the SHIPPED build (build/data.js + build/photo-tag.js)
// in a vm and proves:
//   1. windows: every night of every weekend is first set start − 15 min to
//      last set end + 15 min, from the app's own set times, matching an
//      independent computation for every festival in _DATA_SETS;
//   2. edges: 14 min before the first set is kept, 16 min is skipped; the
//      same after the last set, including an overnight close; a photo
//      between two sets is kept;
//   3. DST: a night whose last set ends after the clocks go back gets the
//      true UTC end, not midnight + hours;
//   4. a night with no set times is not scanned, counted and named;
//   5. confidence: a meal clearly away from the venue during a saved set is
//      not that set; coarse or missing GPS leaves the saved set as a
//      SUGGESTION; GPS at the set's own stage confirms it; an attended set
//      stays confirmed even off-venue; overlapping saved sets are ambiguous;
//   6. a suggested tag keeps the moment in the review list, and an off-venue
//      verdict is an answer; a manual pick clears the suggestion;
//   7. picker cancel: FilePicker's "pickFiles canceled." is a cancel; any
//      other rejection is still an error;
//   8. the windows report prints for every festival (set times or none);
//   9. mutations: each guarded behaviour above fails when removed.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEST_DIR = join(ROOT, "data", "festivals");
const MODS = readdirSync(FEST_DIR).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(FEST_DIR, f), "utf8")).join("\n");
const BUILD = n => readFileSync(join(ROOT, "build", `${n}.js`), "utf8");
const SPOTIFY = BUILD("spotify");
const REPORT = process.argv.includes("--report");

function boot(photoTagSrc) {
  const noop = () => {};
  const store = {};
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, Date, Math, JSON, Uint8Array,
    crypto: { getRandomValues: a => a },
    location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
    indexedDB: { open: () => ({}) },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  vm.runInContext(BUILD("data"), ctx);
  vm.runInContext(photoTagSrc, ctx);
  return ctx;
}

// The review predicate and retag patch, lifted out of the SHIPPED spotify.js
// so the check reads the exact code the app runs.
function reviewFns(spotifySrc) {
  const grab = (name) => {
    const i = spotifySrc.indexOf(`function ${name}(`);
    if (i < 0) return "";
    let depth = 0, j = spotifySrc.indexOf("{", i);
    for (let k = j; k < spotifySrc.length; k++) {
      if (spotifySrc[k] === "{") depth++;
      else if (spotifySrc[k] === "}" && --depth === 0) return spotifySrc.slice(i, k + 1);
    }
    return "";
  };
  const ctx = { _REVIEW_WARN: new Set(["fallback", "photokit-night-only"]) };
  vm.createContext(ctx);
  vm.runInContext(`${grab("_momentNeedsReview")}\n${grab("_retagPatch")}\nthis.needs = _momentNeedsReview; this.patch = _retagPatch;`, ctx);
  return ctx;
}

const M = 60000, H = 3600000;
const toMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const TIME = /^\d{1,2}:\d{2}$/;

function checks(C, R) {
  const fails = [];
  let n = 0;
  const t = (cond, msg) => { n++; if (!cond) fails.push(msg); };

  // ── 1. windows match an independent computation, every festival ─────────
  // Outside a DST change, local midnight + hours IS the instant, so this
  // reference is exact for those nights; DST nights are checked in 3.
  const sets = C._DATA_SETS || {};
  let nightsTimed = 0;
  for (const id of Object.keys(sets)) {
    const cfg = sets[id]?.config, artists = sets[id]?.artists || [];
    if (!cfg?.dayDates) continue;
    const wins = C._scanSetWindows(cfg, artists);
    for (const w of wins) {
      const shift = w.weekend && cfg.weekendStartMs ? cfg.weekendStartMs[w.weekend] - cfg.weekendStartMs.W1 : 0;
      const mid = cfg.dayDates[w.night].midnightUtc + shift;
      const acts = artists.filter(a => Number(a.day) === w.night && C.actPlaysWeekend(a, w.weekend) && TIME.test(a.start || "") && TIME.test(a.end || ""));
      if (!acts.length) { t(w.source === "none", `${id} n${w.night}${w.weekend || ""}: no timed acts but source ${w.source}`); continue; }
      const offAt = (ms) => { // is this night clear of a DST change? compare offsets at both ends
        const f = new Intl.DateTimeFormat("en-US", { timeZone: cfg.tz || "UTC", timeZoneName: "shortOffset" });
        return f.format(new Date(ms));
      };
      if (cfg.tz && offAt(mid + 12 * H).slice(-6) !== offAt(mid + 30 * H).slice(-6)) continue;
      const lo = Math.min(...acts.map(a => mid + toMin(a.start) * M)) - 15 * M;
      const hi = Math.max(...acts.map(a => { const e = toMin(a.end), s = toMin(a.start); return mid + (e <= s ? e + 1440 : e) * M; })) + 15 * M;
      nightsTimed++;
      t(w.source === "set-times" && w.startMs === lo && w.endMs === hi,
        `${id} n${w.night}${w.weekend || ""}: window ${new Date(w.startMs).toISOString()}→${new Date(w.endMs).toISOString()}, want ${new Date(lo).toISOString()}→${new Date(hi).toISOString()}`);
    }
  }
  t(nightsTimed >= 20, `only ${nightsTimed} timed nights checked`);

  // ACL has both weekends, each with its own windows.
  const acl = sets["acl-2026"];
  const aclW = C._scanSetWindows(acl.config, acl.artists);
  t(aclW.filter(w => w.weekend === "W1" && w.source === "set-times").length === 3 && aclW.filter(w => w.weekend === "W2" && w.source === "set-times").length === 3,
    `ACL: want 3 timed nights per weekend, got ${JSON.stringify(aclW.map(w => [w.night, w.weekend, w.source]))}`);

  // ── 2. edges, between sets, overnight close ─────────────────────────────
  const pick = (cfg, artists, ms, seen = []) => C._scanPickAssets([{ id: "x", createdMs: ms }], cfg, new Set(seen), artists);
  {
    const w = aclW.find(x => x.weekend === "W2" && x.night === 2);
    const first = w.startMs + 15 * M, last = w.endMs - 15 * M;
    t(pick(acl.config, acl.artists, first - 14 * M).keep.length === 1, "ACL: 14 min before the first set was not kept");
    const early = pick(acl.config, acl.artists, first - 16 * M);
    t(early.keep.length === 0 && early.outsideSets === 1, `ACL: 16 min before the first set was not skipped as outside set times (${JSON.stringify(early)})`);
    t(pick(acl.config, acl.artists, last + 14 * M).keep.length === 1, "ACL: 14 min after the last set was not kept");
    t(pick(acl.config, acl.artists, last + 16 * M).outsideSets === 1, "ACL: 16 min after the last set was not skipped");
    // Lunch at 11:16 on a festival day: on the old 10:30 → 06:30 night, not in set times.
    const lunch = acl.config.dayDates[2].midnightUtc + (acl.config.weekendStartMs.W2 - acl.config.weekendStartMs.W1) + (11 * 60 + 16) * M;
    const l = pick(acl.config, acl.artists, lunch);
    t(l.keep.length === 0 && l.outsideSets === 1, `ACL: an 11:16 lunch photo was kept (${JSON.stringify(l)})`);
    // Between sets: the middle of the biggest gap on one stage that night is
    // still inside the night's window.
    const nightActs = acl.artists.filter(a => a.day === 2 && TIME.test(a.start || "")).sort((a, b) => toMin(a.start) - toMin(b.start));
    const byStage = {};
    for (const a of nightActs) (byStage[a.stage] = byStage[a.stage] || []).push(a);
    let gapMid = null;
    for (const list of Object.values(byStage)) for (let i = 1; i < list.length; i++) {
      const g = toMin(list[i].start) - toMin(list[i - 1].end);
      if (g >= 10 && gapMid == null) gapMid = toMin(list[i - 1].end) + Math.floor(g / 2);
    }
    const gapMs = acl.config.dayDates[2].midnightUtc + (acl.config.weekendStartMs.W2 - acl.config.weekendStartMs.W1) + gapMid * M;
    t(gapMid != null && pick(acl.config, acl.artists, gapMs).keep.length === 1, "ACL: a photo between two sets on a stage was not kept");
  }
  {
    // Overnight: EDC LV closes after 05:00.
    const edc = sets["edc-lv-2026"];
    const w = C._scanSetWindows(edc.config, edc.artists).find(x => x.night === 1);
    const lastEnd = w.endMs - 15 * M;
    const wall = C._wallClockFromUtc(lastEnd, edc.config);
    t(wall.hh < 8, `EDC LV: last set of night 1 should end after midnight, ends ${wall.hh}:${wall.mm}`);
    t(pick(edc.config, edc.artists, lastEnd + 14 * M).keep.length === 1, "EDC LV: 14 min after the overnight close was not kept");
    t(pick(edc.config, edc.artists, lastEnd + 16 * M).keep.length === 0, "EDC LV: 16 min after the overnight close was kept");
  }

  // ── 3. DST: clocks go back at 02:00 on 2026-11-01 in New York ──────────
  {
    const cfg = { id: "dst-test", tz: "America/New_York", dayDates: { 1: { midnightUtc: Date.UTC(2026, 9, 31, 4) } } }; // 2026-10-31 00:00 EDT
    const artists = [{ id: "d1", day: 1, stage: "s", start: "22:00", end: "03:00" }];
    const w = C._scanSetWindows(cfg, artists)[0];
    t(w.startMs === Date.UTC(2026, 10, 1, 2) - 15 * M, `DST: start ${new Date(w.startMs).toISOString()}, want 22:00 EDT − 15`);
    t(w.endMs === Date.UTC(2026, 10, 1, 8) + 15 * M, `DST: end ${new Date(w.endMs).toISOString()}, want 03:00 EST (08:00Z) + 15`);
  }

  // ── 4. a night without set times ────────────────────────────────────────
  {
    const cfg = { id: "gap-test", tz: "America/Chicago", gps: { lat: 30, lng: -97, onSiteRadiusMi: 0.4 },
      dayDates: { 1: { midnightUtc: Date.UTC(2026, 5, 5, 5) }, 2: { midnightUtc: Date.UTC(2026, 5, 6, 5) } } };
    const artists = [{ id: "g1", day: 1, stage: "s", start: "18:00", end: "19:00" }, { id: "g2", day: 2, stage: "s", start: "TBA", end: null }];
    const wins = C._scanSetWindows(cfg, artists);
    t(wins.find(w => w.night === 2)?.source === "none", "a night with only TBA acts got a window");
    const p = C._scanPickAssets([{ id: "y", createdMs: Date.UTC(2026, 5, 7, 2) }], cfg, new Set(), artists); // night 2, 21:00 CDT
    // Jake 2026-11-05: a night with no set times is scanned in full.
    t(p.keep.length === 1 && p.fullNight === 1 && p.outsideSets === 0 && p.untimedNights === 1, `a photo on a night without set times was not kept for a full-night scan (${JSON.stringify(p)})`);
    const seenP = C._scanPickAssets([{ id: "y", createdMs: Date.UTC(2026, 5, 7, 2) }], cfg, new Set(["y"]), artists);
    t(seenP.keep.length === 0 && seenP.already === 1 && seenP.fullNight === 0, "a full-night photo an earlier scan imported came back");
    const p1 = C._scanPickAssets([{ id: "z", createdMs: Date.UTC(2026, 5, 6, 2) }], cfg, new Set(), artists); // night 1, 21:00 CDT, past 19:15
    t(p1.keep.length === 0 && p1.outsideSets === 1, "a timed night lost its hours because another night has none");
    t(p.nightsWithoutSetTimes.some(x => x.night === 2), "the untimed night was not named");
    const rep = C._scanWindowReport(cfg, artists);
    t(rep.find(r => r.night === 2)?.source === "none" && rep.find(r => r.night === 1)?.start === "2026-06-05 17:45", `report rows wrong: ${JSON.stringify(rep)}`);
  }

  // ── 4b. an act whose set time is disputed never moves a boundary ───────
  {
    const cfg = { id: "unres-test", tz: "America/Chicago", dayDates: { 1: { midnightUtc: Date.UTC(2026, 5, 5, 5) }, 2: { midnightUtc: Date.UTC(2026, 5, 6, 5) } } };
    const artists = [
      { id: "u1", day: 1, stage: "s", start: "18:00", end: "19:00" },
      { id: "u2", day: 1, stage: "s", start: "13:00", end: "23:30", timeEvidence: { status: "unresolved" } },
      { id: "u3", day: 2, stage: "s", start: "20:00", end: "21:00", timeEvidence: { status: "unresolved" } },
    ];
    const wins = C._scanSetWindows(cfg, artists);
    const w1 = wins.find(w => w.night === 1);
    t(w1?.startMs === Date.UTC(2026, 5, 5, 23) - 15 * M && w1?.endMs === Date.UTC(2026, 5, 6, 0) + 15 * M && w1?.acts === 1,
      `an unresolved act widened night 1 (${JSON.stringify(w1)})`);
    t(wins.find(w => w.night === 2)?.source === "none", "a night whose only act is unresolved got a window");
  }

  // ── 5. confidence ───────────────────────────────────────────────────────
  {
    const cfg = acl.config;
    const ds = { id: "acl-2026", config: cfg, artists: acl.artists, amenities: acl.amenities || [] };
    const anchors = C.resolvedStageAnchors(cfg);
    const shift = cfg.weekendStartMs.W2 - cfg.weekendStartMs.W1;
    const anchoredAct = acl.artists.find(a => a.day === 2 && TIME.test(a.start || "") && anchors.some(g => g.stageId === a.stage) && C.actPlaysWeekend(a, "W2")
      && toMin(a.end) - toMin(a.start) >= 45);
    const at = cfg.dayDates[2].midnightUtc + shift + (toMin(anchoredAct.start) + 20) * M;
    const meta = (extra) => ({ date: C._wallClockFromUtc(at, cfg), rawUtcMs: at, lat: null, lng: null, acc: null, ...extra });
    const away = { lat: cfg.gps.lat + 0.03, lng: cfg.gps.lng, acc: 10 };          // ~3.3 km north of the site
    const anchor = anchors.find(g => g.stageId === anchoredAct.stage);
    const onStage = { lat: anchor.lat, lng: anchor.lng, acc: 8 };

    const meal = C._matchArtistForPhoto(meta(away), [anchoredAct.id], [], ds);
    t(meal.artistId === null && meal.reason === "off_venue" && meal.night === 2, `meal away from the venue during a saved set: ${JSON.stringify([meal.artistId, meal.reason, meal.night])}`);
    const noGps = C._matchArtistForPhoto(meta({}), [anchoredAct.id], [], ds);
    t(noGps.artistId === anchoredAct.id && noGps.suggested === true && noGps.evidence === "saved+time", `saved set, no GPS: ${JSON.stringify([noGps.artistId, noGps.suggested, noGps.evidence])}`);
    const coarse = C._matchArtistForPhoto(meta({ ...away, acc: 2800 }), [anchoredAct.id], [], ds);
    t(coarse.artistId === anchoredAct.id && coarse.suggested === true, `saved set, coarse GPS: ${JSON.stringify([coarse.artistId, coarse.reason, coarse.suggested])}`);
    const stage = C._matchArtistForPhoto(meta(onStage), [anchoredAct.id], [], ds);
    t(stage.artistId === anchoredAct.id && stage.suggested === false && stage.evidence === "saved+time+stage-gps", `saved set, GPS at its stage: ${JSON.stringify([stage.artistId, stage.suggested, stage.evidence])}`);
    const attended = C._matchArtistForPhoto(meta(away), [], [anchoredAct.id], ds);
    t(attended.artistId === anchoredAct.id && attended.suggested === false && attended.reason === "attended_set_time", `attended set, off-venue GPS: ${JSON.stringify([attended.artistId, attended.reason, attended.suggested])}`);
    // Overlap: two saved sets on different stages both containing the time.
    const other = acl.artists.find(a => a.day === 2 && a.id !== anchoredAct.id && a.stage !== anchoredAct.stage && TIME.test(a.start || "")
      && C.actPlaysWeekend(a, "W2") && toMin(a.start) <= toMin(anchoredAct.start) + 20 && toMin(a.end) >= toMin(anchoredAct.start) + 20);
    t(!!other, "fixture: no overlapping act on another stage");
    if (other) {
      const both = C._matchArtistForPhoto(meta({}), [anchoredAct.id, other.id], [], ds);
      t(both.ambiguous === true && both.suggested === true && (both.alternatives || []).length === 2, `overlapping saved sets: ${JSON.stringify([both.ambiguous, both.suggested, both.alternatives])}`);
    }
    // Unsaved, off-venue: the time matcher does not claim a set either.
    const loose = C._matchArtistForPhoto(meta(away), [], [], ds);
    t(loose.artistId === null && loose.reason === "off_venue", `unsaved, off-venue: ${JSON.stringify([loose.artistId, loose.reason])}`);
    // GPS at ANOTHER stage, real ACL W2 acts (fixed ids; ACL 2026 is over).
    {
      const A = id => acl.artists.find(a => a.id === id);
      const atMin = (night, hh, mm, g) => { const ms = cfg.dayDates[night].midnightUtc + shift + (hh * 60 + mm) * M;
        return { date: C._wallClockFromUtc(ms, cfg), rawUtcMs: ms, lat: g.lat, lng: g.lng, acc: 8 }; };
      const st = id => anchors.find(g => g.stageId === id);
      const ok = A("af02")?.stage === "tmobile" && A("af44")?.stage === "amex" && A("af23")?.stage === "beatbox" && A("af39")?.stage === "snapchat"
        && A("as06")?.stage === "miller" && A("as28")?.stage === "titos" && st("amex") && st("snapchat") && st("miller") && st("beatbox") && st("titos");
      t(!!ok, "fixture: ACL acts or anchors moved");
      // Since 2026-11-12 every ACL stage has a satellite pin. The unpinned-stage
      // paths below still matter (most festivals have unpinned stages), so they
      // run on this ACL with Tito's and BEATBOX unpinned; the real data runs after.
      const unpin = { ...ds, config: { ...cfg, gpsAnchors: cfg.gpsAnchors.filter(g => g.stageId !== "beatbox" && g.stageId !== "titos") } };
      if (ok) {
        // Saved act on an anchored stage (T-Mobile); GPS at Amex while Amex plays: GPS wins.
        const r1 = C._matchArtistForPhoto(atMin(1, 13, 20, st("amex")), ["af02"], [], ds);
        t(r1.artistId === "af44" && !r1.suggested, `GPS at Amex lost to a saved T-Mobile act: ${JSON.stringify([r1.artistId, r1.reason, r1.suggested])}`);
        // Saved act on an UNANCHORED stage (Beatbox); trusted GPS at Snapchat while
        // Snapchat plays. SPEC-179: the trusted fix tags Snapchat's act; Beatbox has
        // no pin, so the tag is flagged and the saved act stays offered.
        const r2 = C._matchArtistForPhoto(atMin(1, 14, 20, st("snapchat")), ["af23"], [], unpin);
        t(r2.artistId === "af39" && r2.ambiguous === true && (r2.alternatives || []).includes("af23")
          && r2.evidence === "trusted-gps+time;over-saved", `GPS at Snapchat vs a saved Beatbox act: ${JSON.stringify([r2.artistId, r2.suggested, r2.ambiguous, r2.alternatives, r2.evidence])}`);
        // SPEC-179: no GPS and several acts playing → untagged, every act offered.
        const r5 = C._matchArtistForPhoto({ ...atMin(1, 14, 20, st("snapchat")), lat: null, lng: null, acc: null }, [], [], unpin);
        t(r5.artistId === null && r5.reason === "several_playing" && (r5.alternatives || []).length > 1 && r5.alternatives.includes("af39") && r5.alternatives.includes("af23"),
          `no GPS, several playing: ${JSON.stringify([r5.artistId, r5.reason, r5.alternatives])}`);
        // Unsaved overlap: GPS at Miller's anchor beats an unanchored stage's act that started nearer the time.
        const r3 = C._matchArtistForPhoto(atMin(2, 14, 5, st("miller")), [], [], unpin);
        t(r3.artistId === "as06" && r3.ambiguous === true, `GPS at Miller lost to unanchored Tito's on start time: ${JSON.stringify([r3.artistId, r3.ambiguous])}`);
        // Positive control: with no GPS, Miller's act is not the tag (SPEC-179: nobody is).
        const r4 = C._matchArtistForPhoto({ ...atMin(2, 14, 5, st("miller")), lat: null, lng: null, acc: null }, [], [], unpin);
        t(r4.artistId !== "as06" || r4.ambiguous === true, `no-GPS overlap control: ${JSON.stringify([r4.artistId, r4.ambiguous])}`);
        // Real ACL, every stage pinned: the same two photos.
        const q2 = C._matchArtistForPhoto(atMin(1, 14, 20, st("snapchat")), ["af23"], [], ds);
        const q3 = C._matchArtistForPhoto(atMin(2, 14, 5, st("miller")), [], [], ds);
        // The trusted fix still tags Snapchat's act over the saved BEATBOX act, and keeps the saved act offered.
        t(q2.artistId === "af39" && (q2.alternatives || []).includes("af23") && q2.evidence === "trusted-gps+time;over-saved",
          `real ACL, GPS at Snapchat vs a saved Beatbox act: ${JSON.stringify([q2.artistId, q2.ambiguous, q2.alternatives, q2.evidence])}`);
        // With Tito's pinned, nothing unpinned overlaps: GPS at Miller is a clean, unflagged tag.
        t(q3.artistId === "as06" && q3.ambiguous === false && q3.suggested === false,
          `real ACL, GPS at Miller with every stage pinned: ${JSON.stringify([q3.artistId, q3.ambiguous, q3.suggested])}`);
      }
    }
    // No footprint, no verdict: nothing invented.
    t(C._offVenueMeters({ ...cfg, gps: null }, away.lat, away.lng, 10) === null, "a festival with no footprint got an off-venue verdict");
    // The footprint is a circle, not the fence: only >500 m past it is "away".
    {
      const R = cfg.gps.onSiteRadiusMi * 1609.34, dLat = m => m / 111320;
      t(C._offVenueMeters(cfg, cfg.gps.lat + dLat(R + 400), cfg.gps.lng, 0) === null, "400 m past the footprint circle was called away from the festival");
      t((C._offVenueMeters(cfg, cfg.gps.lat + dLat(R + 700), cfg.gps.lng, 0) || 0) > 500, "700 m past the footprint circle was not away");
      const edc = C._DATA_SETS["edc-lv-2026"].config;
      t(C._offVenueMeters(edc, 36.265, -115.005, 10) === null, "a point at EDC LV's speedway edge (on site for the map gate) was called away");
    }
  }

  // ── 6. review list ──────────────────────────────────────────────────────
  t(R.needs({ artistId: "a", tagSource: "photokit", tagSuggested: true }) === true, "a suggested tag left the review list");
  t(R.needs({ artistId: "a", tagSource: "photokit", tagSuggested: false }) === false, "a confirmed tag stayed in the review list");
  t(R.needs({ artistId: null, tagSource: "off_venue" }) === false, "an off-venue verdict was treated as a gap");
  t(R.patch({ artistId: "a" })?.tagSuggested === false, "a manual pick did not clear the suggestion");

  // ── 7. picker cancel ────────────────────────────────────────────────────
  t(C._pickerErrorIsCancel(new Error("pickFiles canceled.")) === true, "FilePicker's cancel was an error");
  t(C._pickerErrorIsCancel({ message: "pickMedia canceled." }) === true, "pickMedia cancel was an error");
  t(C._pickerErrorIsCancel("pickFiles canceled.") === true, "string cancel was an error");
  t(C._pickerErrorIsCancel(new Error("The operation couldn’t be completed. (PHPhotosErrorDomain error 3164.)")) === false, "a real failure counted as a cancel");
  t(C._pickerErrorIsCancel(new Error("pickFiles canceled because of a network error")) === false, "a cancel-worded failure counted as a cancel");
  t(C._pickerErrorIsCancel(null) === false, "null counted as a cancel");
  return { fails, n };
}

const shipped = BUILD("photo-tag");
const C = boot(shipped);
const R = reviewFns(SPOTIFY);
const base = checks(C, R);

// Source wiring the vm cannot reach.
const SP = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
const wire = [
  [/if \(_pickerErrorIsCancel\(err\)\) return \{ status: "cancelled" \};/.test(SP), "pickViaNative does not treat a cancel rejection as a cancel"],
  [/matchReason: matched\.reason \|\| null,/.test(SP) && /matchEvidence: matched\.evidence \|\| null,/.test(SP) && /tagSuggested: !!\(matched\.artistId && matched\.suggested\),/.test(SP), "import does not stamp reason, evidence and suggestion"],
  [/const \{ keep, already, outsideSets, untimedNights \} = _scanPickAssets\(/.test(SP), "the scan does not take the skipped counts"],
  [/nights have"\} no set times, scanned in full\./.test(SP) && /\{msg\.note && <p data-scan-untimed-note/.test(SP), "the card does not name full-night scans on their own line"],
  [/_scanSeenAdd\(fileAssets\.filter/.test(SP) && !/_scanSeenAdd\([^)]*outside/.test(SP), "skipped items reach the seen list"],
  [/if \(m\.tagSource === "manual"\) continue;/.test(SP), "archive recovery can re-guess a manual pick"],
];
for (const [ok, msg] of wire) { base.n++; if (!ok) base.fails.push(msg); }

if (REPORT) {
  for (const id of Object.keys(C._DATA_SETS).sort()) {
    const ds = C._DATA_SETS[id];
    if (!ds?.config?.dayDates) continue;
    for (const r of C._scanWindowReport(ds.config, ds.artists)) console.log([id, r.weekend || "-", `night ${r.night}`, r.source, r.start || "", r.end || "", r.acts || ""].join("\t"));
  }
}

// 9. Mutations: each must fail at least one check.
const MUTANTS = [
  ["saved set ignores off-venue GPS", shipped.replace(/if \(!attended\) \{\s*var away = _offVenueMeters/, "if (false) { var away = _offVenueMeters")],
  ["saved + time alone is certain", shipped.replace(/suggested: !attended && !atStage,/, "suggested: false,")],
  ["30-minute buffer", shipped.replace(/_SCAN_SET_BUFFER_MS = 15 \* 60000/, "_SCAN_SET_BUFFER_MS = 30 * 60000")],
  ["no timezone path (midnight + hours)", shipped.replace(/var utc = _zonedWallToUtc\(/, "var utc = null && _zonedWallToUtc(")],
  ["untimed nights left unscanned", shipped.replace(/whole = true;/, "outsideSets++; continue;")],
  ["full-night photos skip the seen list", shipped.replace(/if \(seen\.has\(a\.id\)\) \{(\s*already\+\+;\s*(?:return 0|continue);\s*\}\s*if \(whole\) fullNight\+\+;)/, "if (!whole && seen.has(a.id)) {$1")],
  ["a trusted fix never beats a saved act", shipped.replace(/if \(trustedStage\) \{/, "if (false) {")],
  ["an unpinned overlap under a trusted fix is not flagged", shipped.replace(/var ambiguous = !surveyGrade \|\| unpinned \|\| /, "var ambiguous = !surveyGrade || ")],
  ["latest start wins again", shipped.replace(/artistId: null,(\s*)night,(\s*)festivalId,(\s*)resolvedBy,(\s*)reason: "several_playing",(\s*)ambiguous: true,(\s*)anchorSource: null,(\s*)alternatives: several/, 'artistId: several[several.length - 1].a.id,$1night,$2festivalId,$3resolvedBy,$4reason: "several_playing",$5ambiguous: true,$6anchorSource: null,$7alternatives: several')],
  ["footprint circle edge is the fence", shipped.replace(/return past > _OFF_VENUE_MARGIN_M \? /, "return past > 0 ? ")],
  ["unresolved set times move a window boundary", shipped.replace(/if \(setTimeStatus\(a\) !== "confirmed"\) continue;/, "")],
  ["every picker rejection is a cancel", shipped.replace(/return \/\^pick\(Files\|Media\|Images\|Videos\)\? cancel\(l\)\?ed\\\.\?\$\/i\.test\(msg\);/, "return true;")],
];
const mutantsOut = [];
for (const [name, src] of MUTANTS) {
  if (src === shipped) { base.n++; base.fails.push(`mutant did not apply: ${name}`); continue; }
  let caught;
  try { caught = checks(boot(src), R).fails.length > 0; } catch { caught = true; }
  base.n++;
  if (!caught) base.fails.push(`mutant survived: ${name}`);
  mutantsOut.push(name);
}
// The review predicate's own mutant runs on the spotify source.
{
  const m = SPOTIFY.replace("m.needsRetag || m.tagAmbiguous || m.tagSuggested ||", "m.needsRetag || m.tagAmbiguous ||");
  base.n++;
  if (m === SPOTIFY) base.fails.push("mutant did not apply: review ignores suggestions");
  else if (checks(C, reviewFns(m)).fails.length === 0) base.fails.push("mutant survived: review ignores suggestions");
}

if (base.fails.length) {
  console.log(base.fails.map(f => `    ✗ ${f}`).join("\n"));
  console.log(`  ✗ scan hours + confidence: ${base.fails.length} of ${base.n} checks failed`);
  process.exit(1);
}
console.log(`  ✓ scan hours + confidence: ${base.n} checks (set-time windows ±15 min for every festival night, edges, between sets, overnight, DST, untimed nights scanned in full, off-venue beats a saved guess, stage GPS beats a saved guess, saved + time is a suggestion, picker cancel) · ${MUTANTS.length + 1} mutations caught`);
