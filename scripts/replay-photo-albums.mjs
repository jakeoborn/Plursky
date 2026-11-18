#!/usr/bin/env node
// Photo-album attendance replay (SPEC-212 W6). A camera roll goes through the
// app's own path and is scored against what you say you saw:
//
//   photo (wall-clock time, GPS, accuracy)
//     -> _matchArtistForPhoto   (photo-tag.jsx: festival night, fix gate, set window)
//     -> attendMomentPoints     (data.jsx: only trusted stage-GPS tags at MEASURED stages)
//     -> attendanceVerdict      (data.jsx: what the set-attendance card would say)
//
// The compiled build/ files run in a vm. Nothing here changes the engine or
// the data, and no coordinate is printed.
//
//   node scripts/replay-photo-albums.mjs --synthetic-edc            # the reference corpus below
//   node scripts/replay-photo-albums.mjs --self-test                # reference + broken fixtures
//   node scripts/replay-photo-albums.mjs --album photos.json --truth truth.json [--fid edc-lv-2026] [--json]
//
// A real album: export with exiftool (wall clock, no zone, the way the phone wrote it):
//   exiftool -json -n -DateTimeOriginal -GPSLatitude -GPSLongitude -GPSHPositioningError <dir> > photos.json
// Plain records work too: [{ id, takenAt: "2026-05-15 23:41:07", lat, lng, accM }].
// truth.json: the sets you were at, from memory or your own notes:
//   { "fid": "edc-lv-2026", "sets": ["<artist id>", ...] }
//
// SCORE. A set you were at is RESOLVED when the engine says caught AND the
// evidence sits within 10 minutes of the set's own window. A set the engine
// marks caught that is not in truth is a FALSE set. The SPEC-212 W3 gate is
// 17 of 20 (85%) resolved; below it attendance stays TestFlight-only.
//
// THE SYNTHETIC EDC CORPUS. It is modelled on the EDC 2026 ground truth
// (SPEC-212 W6): the empirical kinetic anchor 36.27399, -115.00718 and a
// 15-set corpus where 13 resolve. These are NOT Jake's photos: 15 real
// kinetic/circuit sets from the shipped timetable, 2-6 photos each, scattered
// inside the crowd (40 m) at 5-35 m accuracy. The two misses are built from
// the two failure modes the fix gate is designed to refuse:
//   coarse  every photo at 150 m accuracy (no satellite fix): the gate refuses it
//   back    every photo 170 m behind the stage: past the gate's 140 m reach
// Exit 1 unless the corpus gives exactly 13/15 resolved and 0 false sets.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const JSON_OUT = argv.includes("--json");
const M = 60000, WITHIN_MS = 10 * M, GATE = 0.85;

// ── The shipped engine, in a vm ──
const noop = () => {};
function loadEngine() {
  const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
    .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = {};
  const ctx = {
    console: { log: noop, warn: noop, error: noop, info: noop, debug: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, TextDecoder, TextEncoder, DataView, Uint8Array, ArrayBuffer, Blob: function Blob() {},
    location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
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
  vm.runInContext(readFileSync(join(ROOT, "build", "photo-tag.js"), "utf8"), ctx, { filename: "build/photo-tag.js" });
  return vm.runInContext(`({ ds: _DATA_SETS, match: _matchArtistForPhoto, points: attendMomentPoints,
    verdict: attendanceVerdict, label: attendanceVerdictLabel, win: attendSetWindowMs, timeClass: attendTimeClass,
    measured: attendEvidenceAnchors })`, ctx);
}

// ── Album records → the tagger's input ──
function readPhotos(raw) {
  const out = [];
  for (const [i, r] of (Array.isArray(raw) ? raw : []).entries()) {
    const when = r.takenAt || r.DateTimeOriginal || null;
    const t = /^(\d{4})[-:](\d{2})[-:](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(when || "");
    const lat = r.lat ?? r.GPSLatitude, lng = r.lng ?? r.GPSLongitude;
    const acc = r.accM ?? r.GPSHPositioningError ?? null;
    out.push({
      id: String(r.id ?? r.SourceFile ?? `photo-${i + 1}`),
      date: t ? { yr: +t[1], mo: +t[2], dy: +t[3], hh: +t[4], mm: +t[5], ss: +(t[6] || 0) } : null,
      takenAt: t ? `${t[1]}-${t[2]}-${t[3]} ${t[4]}:${t[5]}:${t[6] || "00"}` : null,
      lat: typeof lat === "number" ? lat : null, lng: typeof lng === "number" ? lng : null,
      acc: typeof acc === "number" && acc > 0 ? acc : null,
    });
  }
  return out;
}

// ── Replay + score ──
export function replay(E, fid, photos, truthIds) {
  const ds = E.ds[fid];
  if (!ds) throw new Error(`unknown festival id: ${fid}`);
  const cfg = ds.config, byId = new Map(ds.artists.map(a => [a.id, a]));
  const reasons = {};
  const moments = [];
  for (const p of photos) {
    if (!p.date) { reasons.no_date = (reasons.no_date || 0) + 1; continue; }
    const r = E.match({ date: p.date, lat: p.lat, lng: p.lng, rawUtcMs: null, acc: p.acc }, [], [], { ...ds, id: fid });
    const why = r.artistId ? (r.ambiguous ? "tagged_ambiguous" : r.reason) : (r.reason || "untagged");
    reasons[why] = (reasons[why] || 0) + 1;
    if (!r.artistId) continue;
    moments.push({ id: p.id, festivalId: fid, artistId: r.artistId, autoTagged: true, tagAmbiguous: !!r.ambiguous,
      matchEvidence: r.evidence || "", takenAt: p.takenAt, kind: "photo" });
  }
  const pts = E.points(moments, cfg, ds.artists);
  const measured = new Set(E.measured(cfg).map(a => a.stageId));
  const judge = a => {
    const v = E.verdict(a, pts, cfg);
    const w = E.win(a, cfg, []);
    const near = !!(v.caught && v.span && w && v.span.to >= w.startMs - WITHIN_MS && v.span.from <= w.endMs + WITHIN_MS);
    return { id: a.id, name: a.name, stage: a.stage, day: a.day, set: `${a.start}-${a.end}`, measuredStage: measured.has(a.stage),
      verdict: v.verdict, label: E.label(v), caught: !!v.caught, resolved: near };
  };
  const truth = new Set(truthIds);
  const sets = [...truth].map(id => byId.get(id) ? judge(byId.get(id)) : { id, missing: true, resolved: false });
  const caughtIds = new Set(Object.values(pts).flat().map(p => moments.find(m => m.id === p.momentId)?.artistId).filter(Boolean));
  const falseSets = [...caughtIds].filter(id => !truth.has(id)).map(id => judge(byId.get(id))).filter(s => s.caught);
  const resolved = sets.filter(s => s.resolved).length;
  return { fid, photos: photos.length, tagged: moments.length, reasons, sets, resolved, total: sets.length, falseSets };
}

// ── The synthetic EDC corpus ──
const KINETIC_EMPIRICAL = { lat: 36.27399, lng: -115.00718 };
export function syntheticEdc(E, { shiftM = 0 } = {}) {
  const fid = "edc-lv-2026", ds = E.ds[fid], cfg = ds.config;
  const circuit = (cfg.crowdAnchors || []).find(c => c.stageId === "circuit");
  const centre = { kinetic: KINETIC_EMPIRICAL, circuit: { lat: circuit.lat, lng: circuit.lng } };
  const mLat = 111320, mLng = lat => 111320 * Math.cos(lat * Math.PI / 180);
  const at = (c, north, east) => ({ lat: c.lat + north / mLat, lng: c.lng + east / mLng(c.lat) });
  // Deterministic scatter, so a run is the same run every time.
  let seed = 212; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const acts = ds.artists.filter(a => (a.stage === "kinetic" || a.stage === "circuit") && E.timeClass(a) === "settled")
    .map(a => ({ a, w: E.win(a, cfg, []) })).filter(x => x.w && x.w.endMs - x.w.startMs >= 45 * M)
    .sort((x, y) => x.w.startMs - y.w.startMs || String(x.a.id).localeCompare(String(y.a.id)));
  // 15 sets, alternating stages, never two at once.
  const picked = [];
  for (const x of acts) {
    if (picked.length >= 15) break;
    const last = picked[picked.length - 1];
    if (last && (x.a.stage === last.a.stage || x.w.startMs < last.w.endMs)) continue;
    picked.push(x);
  }
  const wall = ms => {   // UTC instant -> the festival wall clock, as a phone writes it
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: cfg.tz, hourCycle: "h23", year: "numeric",
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms)).map(q => [q.type, q.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
  };
  const photos = [], mode = {};
  picked.forEach((x, i) => {
    const kind = i === 4 ? "coarse" : i === 9 ? "back" : "crowd";
    mode[x.a.id] = kind;
    const n = 2 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const ms = x.w.startMs + Math.round((0.1 + 0.8 * rnd()) * (x.w.endMs - x.w.startMs));
      const north = kind === "back" ? -170 : (rnd() * 2 - 1) * 40;
      const east = kind === "back" ? 0 : (rnd() * 2 - 1) * 40;
      const p = at(centre[x.a.stage], north + shiftM, east);
      photos.push({ id: `${x.a.id}#${k + 1}`, takenAt: wall(ms), lat: p.lat, lng: p.lng,
        accM: kind === "coarse" ? 150 : 5 + Math.round(rnd() * 30) });
    }
  });
  return { fid, photos, truth: picked.map(x => x.a.id), mode };
}

function print(r, title) {
  console.log(`▸ ${title}: ${r.photos} photo(s), ${r.tagged} tagged`);
  console.log(`  tagger: ${Object.entries(r.reasons).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  for (const s of r.sets) {
    if (s.missing) { console.log(`  ✗  ${s.id}: not in this festival's lineup`); continue; }
    console.log(`  ${s.resolved ? "✓" : "✗"}  ${s.name} · ${s.stage}${s.measuredStage ? "" : " (no measured position)"} · day ${s.day} · ${s.set} -> ${s.verdict}${s.label ? ` ("${s.label}")` : ""}`);
  }
  for (const s of r.falseSets) console.log(`  !  false set: ${s.name} · ${s.stage} · day ${s.day} -> ${s.verdict}`);
  console.log(`  ${r.resolved}/${r.total} resolved within 10 min, ${r.falseSets.length} false set(s); gate ${Math.ceil(GATE * r.total)}/${r.total} (85%)`);
}

const main = async () => {
  const E = loadEngine();
  if (argv.includes("--synthetic-edc") || argv.includes("--self-test")) {
    const c = syntheticEdc(E, { shiftM: Number(arg("--shift")) || 0 });   // --shift <m>: move every photo north, to explore
    const r = replay(E, c.fid, readPhotos(c.photos), c.truth);
    const ok = r.total === 15 && r.resolved === 13 && r.falseSets.length === 0
      && r.sets.every(s => s.resolved === (c.mode[s.id] === "crowd"));
    if (JSON_OUT) console.log(JSON.stringify({ ...r, mode: c.mode }, null, 1)); else print(r, "EDC 2026 synthetic corpus (modelled, not real photos)");
    let bad = ok ? 0 : 1;
    if (!ok) console.log("  ✗  expected exactly 13/15 resolved (the two built misses), 0 false sets");
    if (argv.includes("--self-test")) {
      // Broken fixtures: each must move the score, or the harness is blind.
      const broken = [
        // Moves the "back" set's photos (170 m south) to 30 m from the stage, so that one rightly resolves.
        ["every photo 200 m north of its stage", () => { const b = syntheticEdc(E, { shiftM: 200 }); const r2 = replay(E, b.fid, readPhotos(b.photos), b.truth); r2.mode = b.mode; return r2; },
          x => x.falseSets.length === 0 && x.sets.every(s => s.resolved === (x.mode[s.id] === "back"))],
        ["photos with no time", () => { const b = syntheticEdc(E); return replay(E, b.fid, readPhotos(b.photos.map(p => ({ ...p, takenAt: null }))), b.truth); }, x => x.resolved === 0 && x.reasons.no_date === x.photos],
        ["truth names a set you never shot", () => { const b = syntheticEdc(E); const extra = E.ds[b.fid].artists.find(a => a.stage === "kinetic" && !b.truth.includes(a.id)); return replay(E, b.fid, readPhotos(b.photos), [...b.truth, extra.id]); }, x => x.total === 16 && x.resolved === 13],
        ["a set dropped from truth shows up as false", () => { const b = syntheticEdc(E); return replay(E, b.fid, readPhotos(b.photos), b.truth.slice(1)); }, x => x.falseSets.length === 1],
        ["camera clock two hours off", () => { const b = syntheticEdc(E); const off = b.photos.map(p => { const [d, t] = p.takenAt.split(" "); const h = (+t.slice(0, 2) + 2) % 24; return { ...p, takenAt: `${d} ${String(h).padStart(2, "0")}${t.slice(2)}` }; }); return replay(E, b.fid, readPhotos(off), b.truth); }, x => x.resolved < 13],
      ];
      let caught = 0;
      for (const [name, run, expect] of broken) {
        let r2; try { r2 = run(); } catch (e) { r2 = null; }
        const hit = !!r2 && expect(r2);
        if (hit) caught++; else bad++;
        console.log(`  ${hit ? "✓" : "✗"}  broken fixture: ${name}${r2 ? ` -> ${r2.resolved}/${r2.total}, ${r2.falseSets.length} false` : " (threw)"}`);
      }
      console.log(`${bad ? "✗" : "✓"} photo-album replay: reference ${r.resolved}/${r.total}, ${caught}/${broken.length} broken fixtures caught`);
    }
    process.exit(bad ? 1 : 0);
  }
  const albumPath = arg("--album"), truthPath = arg("--truth");
  if (!albumPath || !truthPath) { console.error("usage: --synthetic-edc | --self-test | --album photos.json --truth truth.json [--fid id] [--json]"); process.exit(2); }
  const truth = JSON.parse(readFileSync(truthPath, "utf8"));
  const fid = arg("--fid") || truth.fid;
  const r = replay(E, fid, readPhotos(JSON.parse(readFileSync(albumPath, "utf8"))), truth.sets || []);
  if (JSON_OUT) console.log(JSON.stringify(r, null, 1)); else print(r, `${fid} album`);
  process.exit(r.total && r.resolved / r.total >= GATE ? 0 : 1);
};
main().catch(e => { console.error(e.stack || String(e)); process.exit(2); });
