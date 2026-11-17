#!/usr/bin/env node
// Synthetic attendance replay against a festival's REAL published set times.
//
//   node scripts/replay-attendance.mjs <festival-id> [--json]
//
// Runs the shipped engine (compiled build/data.js, in a vm) end to end:
// raw GPS samples -> stageFixGate (attendQualifyFixes) -> presence runs
// (attendFixesToIntervals) -> attendanceVerdict, on real acts from the
// festival's own timetable. Nothing here changes the engine or the data.
//
// STAGE POSITIONS ARE SYNTHETIC. A festival with no measured stage anchors
// (Tomorrowland Thailand has none) cannot place a fix, so the replay lays
// its stages on a ring, 400 m apart, around the config's centre point, in
// memory only. They are never written to data and never shown in the app;
// they exist so the fix gate has something to measure against. What the
// replay proves is the verdict math on real set windows, not where a stage is.
//
// Cases (each a trace of 30 s samples at 10 m accuracy):
//   full         at the stage from 2 min before the set to 2 min after   -> full
//   thirty       the first 30 minutes of a 60-minute set                 -> partial, ~30 min
//   walkthrough  5 minutes at the stage mid-set                          -> brief (not caught)
//   wrong-stage  the whole set at the next stage on the ring             -> none for this set
//   overnight    full stay at a set that crosses midnight                -> full
// Exit 1 if any verdict differs from the expected one.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fid = process.argv[2];
const JSON_OUT = process.argv.includes("--json");
if (!fid) { console.error("usage: node scripts/replay-attendance.mjs <festival-id> [--json]"); process.exit(2); }

const noop = () => {};
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
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
vm.runInContext(readFileSync(join(ROOT, "build", "data.js"), "utf8"), ctx, { filename: "build/data.js" });
const E = vm.runInContext(`({ ds: _DATA_SETS, attendQualifyFixes, attendFixesToIntervals, attendanceVerdict,
  attendanceVerdictLabel, attendSetWindowMs, attendTimeClass, STAGE_FIX_ATTEND })`, ctx);

const ds = E.ds[fid];
if (!ds) { console.error(`unknown festival id: ${fid}`); process.exit(2); }
const cfg = ds.config;
const centre = cfg.gps;
if (!centre || !Number.isFinite(centre.lat)) { console.error(`${fid}: no config gps centre`); process.exit(2); }

// Synthetic ring: stage i at angle 2πi/n, radius chosen so neighbours are 400 m apart.
const stageIds = ds.stages.map(s => s.id);
const n = stageIds.length, SEP = 400;
const R = n > 1 ? SEP / (2 * Math.sin(Math.PI / n)) : 0;
const mPerDegLat = 111320, mPerDegLng = 111320 * Math.cos(centre.lat * Math.PI / 180);
const pos = {};
stageIds.forEach((id, i) => {
  const t = 2 * Math.PI * i / n;
  pos[id] = { lat: centre.lat + (R * Math.cos(t)) / mPerDegLat, lng: centre.lng + (R * Math.sin(t)) / mPerDegLng };
});
const anchors = stageIds.map(id => ({ stageId: id, ...pos[id], anchorSource: "synthetic" }));

const M = 60000;
const trace = (stageId, fromMs, toMs) => {
  const out = [];
  for (let t = fromMs; t <= toMs; t += 30000) out.push({ lat: pos[stageId].lat, lng: pos[stageId].lng, accuracy: 10, timestamp: t, atMs: t });
  return out;
};
const replay = (a, samples, opts) => {
  const fixes = E.attendQualifyFixes(samples, anchors, E.STAGE_FIX_ATTEND);
  const iv = E.attendFixesToIntervals(fixes);
  const v = E.attendanceVerdict(a, iv, cfg, opts);
  return { v, label: E.attendanceVerdictLabel(v), fixes: fixes.length };
};

// Pick real acts from the timetable.
const timed = ds.artists.filter(a => a.stage && a.start && a.end && E.attendTimeClass(a) === "settled")
  .map(a => ({ a, w: E.attendSetWindowMs(a, cfg, []) })).filter(x => x.w);
if (!timed.length) { console.error(`${fid}: no timed acts with official (settled) times`); process.exit(1); }
const len = x => (x.w.endMs - x.w.startMs) / M;
const crossesMidnight = x => { const [sh] = x.a.start.split(":").map(Number), [eh] = x.a.end.split(":").map(Number); return eh < sh; };
const sixty = timed.find(x => len(x) === 60 && !crossesMidnight(x));
const longer = timed.find(x => len(x) >= 90 && !crossesMidnight(x));
const overnight = timed.find(crossesMidnight);
const nextStage = id => stageIds[(stageIds.indexOf(id) + 1) % n];

const cases = [];
const add = (id, x, samples, expect, check) => {
  if (!x) { cases.push({ id, skipped: "no act of this shape in the timetable" }); return; }
  const r = replay(x.a, samples(x));
  const ok = r.v.verdict === expect && (!check || check(r.v));
  cases.push({ id, act: x.a.name, stage: x.a.stage, day: x.a.day, set: `${x.a.start}-${x.a.end}`, setMin: r.v.setMin,
    verdict: r.v.verdict, minutes: r.v.minutes, label: r.label, expect, ok, fixes: r.fixes });
};
add("full", longer, x => trace(x.a.stage, x.w.startMs - 2 * M, x.w.endMs + 2 * M), "full");
add("thirty", sixty, x => trace(x.a.stage, x.w.startMs, x.w.startMs + 30 * M), "partial", v => v.minutes === 30);
add("walkthrough", longer, x => trace(x.a.stage, x.w.startMs + 40 * M, x.w.startMs + 45 * M), "brief", v => v.caught === false);
add("wrong-stage", longer, x => trace(nextStage(x.a.stage), x.w.startMs - 2 * M, x.w.endMs + 2 * M), "none", v => v.caught === false);
add("overnight", overnight, x => trace(x.a.stage, x.w.startMs - 2 * M, x.w.endMs + 2 * M), "full");

const ran = cases.filter(c => !c.skipped), pass = ran.filter(c => c.ok).length;
if (JSON_OUT) console.log(JSON.stringify({ fid, anchors: "synthetic ring, 400 m apart", cases }, null, 1));
else {
  console.log(`▸ ${fid}: synthetic replay on the real timetable (stage positions synthetic, ${n} stages, ${SEP} m apart)`);
  for (const c of cases) {
    if (c.skipped) { console.log(`  -  ${c.id}: skipped (${c.skipped})`); continue; }
    console.log(`  ${c.ok ? "✓" : "✗"}  ${c.id.padEnd(12)} ${c.act} · ${c.stage} · day ${c.day} · ${c.set} (${c.setMin} min) -> ${c.verdict}` +
      `${c.minutes != null ? `, ${c.minutes} min` : ""}${c.label ? ` ("${c.label}")` : ""}; expected ${c.expect}`);
  }
  console.log(`  ${pass}/${ran.length} verdicts as expected${cases.length > ran.length ? `, ${cases.length - ran.length} skipped` : ""}`);
}
process.exit(pass === ran.length && ran.length > 0 ? 0 : 1);
