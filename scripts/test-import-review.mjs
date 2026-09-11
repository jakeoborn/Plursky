#!/usr/bin/env node
// Post-import review — the pure half (spotify.jsx), on the REAL compiled code
// (build/data.js + build/spotify.js) in a vm. No browser.
//   1. _momentNeedsReview: flagged / pick-a-set / nothing assigned need a
//      human; a set, a stage, "between sets" and an explicit Unknown do not.
//   2. _retagPatch: a set clears the stage, a stage clears the set, Unknown
//      clears both and says so; every choice clears the import flags.
//   3. _patchMoments changes exactly the listed ids — never another
//      festival's moment, never the count, never the input.
//   4. _moveMoment is remove-then-insert: one moment out, one in, no copy.
//   5. _reviewLineup reads the MOMENT's festival, night and weekend, not the
//      active festival's.
//   6. The archive-recovery pass leaves an explicit Unknown alone (and still
//      recovers a moment that asks for a pick, so the stub is proven live).
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
// photo-tag holds _photoFestivalNight, which the recovery pass calls. Without
// it the pass throws inside its own try/catch and recovers nothing, which is
// why section 6 carries a control that MUST be recovered.
for (const n of ["data", "photo-tag", "spotify"]) vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
const S = vm.runInContext("({ _momentNeedsReview, _retagPatch, _patchMoments, _moveMoment, _reviewLineup, _DATA_SETS, _recoverCurrentVideoMomentsFromArchive })", ctx);

let checks = 0, failed = 0;
const js = v => JSON.stringify(v);
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── 1. Needs review ─────────────────────────────────────────────────────────
{
  const cases = [
    [{ needsRetag: true, artistId: "a" }, true, "import flagged the time"],
    [{ tagAmbiguous: true, artistId: "a", tagSource: "exif" }, true, "overlapping sets"],
    [{ tagSource: "fallback", artistId: "a" }, true, "fallback source"],
    [{ tagSource: "exif-night-only" }, true, "night known, set not"],
    [{ tagSource: "stage-neighbor", artistId: "a" }, true, "nearby set, verify"],
    [{ tagSource: "exif" }, true, "nothing assigned"],
    [{ tagSource: "exif", artistId: "a" }, false, "a set from EXIF"],
    [{ tagSource: "manual", stageId: "s" }, false, "a stage, set unknown"],
    [{ tagSource: "off_stage" }, false, "between sets (GPS)"],
    [{ tagSource: "unknown" }, false, "explicit Unknown"],
    [{ tagSource: "unknown", needsRetag: true }, false, "explicit Unknown outranks a stale flag"],
  ];
  for (const [m, want, why] of cases) check(S._momentNeedsReview(m) === want, `needs review: ${why} → ${!want ? "no" : "yes"}`);
  check(S._momentNeedsReview(null) === false, "needs review: null");
  console.log(`  ✓ needs-review rule: ${cases.length} tag states`);
}

// ── 2. Patches ──────────────────────────────────────────────────────────────
{
  const flags = { autoTagged: false, needsRetag: false, tagAmbiguous: false };
  check(js(S._retagPatch({ artistId: "x" })) === js({ tagSource: "manual", ...flags, artistId: "x", stageId: null }), "patch: a set clears the stage");
  check(js(S._retagPatch({ stageId: "s" })) === js({ tagSource: "manual", ...flags, artistId: null, stageId: "s" }), "patch: a stage clears the set");
  check(js(S._retagPatch({ unknown: true })) === js({ tagSource: "unknown", ...flags, artistId: null, stageId: null }), "patch: Unknown clears both");
  check(S._retagPatch({}) === null && S._retagPatch(null) === null, "patch: no choice, no patch");
  console.log("  ✓ patch shapes: set · stage · Unknown");
}

// ── 3 + 4. Writes touch exactly what they name ─────────────────────────────
{
  const other = { id: "acl1", night: 2, festivalId: "acl-2026", artistId: null, tagSource: "exif-night-only" };
  const all = { 1: [{ id: "a", night: 1, festivalId: "lost-lands-2026" }, { id: "b", night: 1, festivalId: "lost-lands-2026" }],
                2: [{ id: "c", night: 2, festivalId: "lost-lands-2026" }, other] };
  const before = js(all);
  const p = S._patchMoments(all, ["a", "c"], { artistId: "z" });
  check(js(all) === before, "_patchMoments must not mutate its input");
  check(p[1][0].artistId === "z" && p[2][0].artistId === "z" && p[1][1].artistId === undefined, "_patchMoments: exactly the listed ids");
  check(js(p[2][1]) === js(other), "_patchMoments: another festival's moment is untouched");
  check(js(Object.keys(p)) === js(["1", "2"]) && p[1].length === 2 && p[2].length === 2, "_patchMoments: buckets and counts unchanged");
  const m = S._moveMoment(all, "a", 2, { artistId: "q" });
  const ids = Object.values(m).flat().map(x => x.id).sort();
  check(js(ids) === js(["a", "acl1", "b", "c"]), `_moveMoment: one out, one in (${ids})`);
  check(m[2].find(x => x.id === "a").night === 2 && m[2].find(x => x.id === "a").artistId === "q" && !m[1].some(x => x.id === "a"), "_moveMoment: lands on the new night with the patch");
  check(js(all) === before, "_moveMoment must not mutate its input");
  check(S._moveMoment(all, "nope", 3, {}) === all, "_moveMoment: an unknown id changes nothing");
  console.log("  ✓ writes: exact ids, other festivals untouched, move is one-out-one-in");
}

// ── 5. Lineup comes from the moment's festival ─────────────────────────────
{
  const LL = S._DATA_SETS["lost-lands-2026"].artists, ACL = S._DATA_SETS["acl-2026"].artists;
  const ll = S._reviewLineup({ festivalId: "lost-lands-2026", night: 2, takenAt: "2026-09-17 21:00:00" });
  check(ll.length > 0 && ll.every(a => LL.includes(a) && a.day === 2), `LL night 2: ${ll.length} sets, all LL, all day 2`);
  check(js(S._reviewLineup({ festivalId: "lost-lands-2026", night: 3 }, 2).map(a => a.id)) === js(ll.map(a => a.id)), "an explicit night overrides the moment's");
  const w2 = S._reviewLineup({ festivalId: "acl-2026", night: 1, takenAt: "2026-10-09 18:00:00" });
  check(w2.length > 0 && w2.every(a => ACL.includes(a) && a.day === 1 && a.weekend !== "W1"), `ACL W2 Friday from an LL session: ${w2.length} sets, no W1-only act`);
  const w1 = S._reviewLineup({ festivalId: "acl-2026", night: 1, takenAt: "2026-10-02 18:00:00" });
  check(w1.every(a => a.weekend !== "W2"), "ACL W1 Friday: no W2-only act");
  console.log(`  ✓ lineup: the moment's festival, night and weekend (LL ${ll.length}, ACL W2 ${w2.length}, W1 ${w1.length})`);
}

// ── 6. Archive recovery leaves Unknown alone ───────────────────────────────
{
  const mk = (id, extra) => ({ id, night: 2, kind: "video", _fingerprint: "fp", festivalId: "lost-lands-2026",
                               takenAt: "2026-09-17 21:00:00", artistId: null, ...extra });
  store.plursky_moments_v1 = JSON.stringify({ 2: [mk("u", { tagSource: "unknown" }), mk("p", { tagSource: "video-night-only", needsRetag: true })] });
  ctx._findArchivedVideoMomentForFingerprint = () => ({ takenAt: "2026-09-17 21:05:00", artistId: S._DATA_SETS["lost-lands-2026"].artists[0].id, night: 2 });
  S._recoverCurrentVideoMomentsFromArchive();
  const by = Object.fromEntries(Object.values(JSON.parse(store.plursky_moments_v1)).flat().map(m => [m.id, m]));
  check(by.p.tagSource === "archive-recovered" && !!by.p.artistId, `control: a pick-a-set clip IS recovered (${by.p.tagSource})`);
  check(by.u.tagSource === "unknown" && by.u.artistId === null, `an explicit Unknown is NOT re-guessed (${by.u.tagSource}, ${by.u.artistId})`);
  console.log("  ✓ archive recovery: Unknown kept, a pick-a-set clip still recovered");
}

if (failed) { console.log(`  ✗  ${failed} of ${checks} import-review checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} import-review checks`);
