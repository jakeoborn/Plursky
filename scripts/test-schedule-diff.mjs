#!/usr/bin/env node
// Schedule Sync diff engine — diffSchedule, applyScheduleDiff and _wallMs.
//
// Runs data.jsx itself in a vm (the same load gen-festival-pages uses). No browser.
//   1. One fixture act per change kind, each alone, plus TBA both ways, a null
//      stage, "9:00" vs "09:00", a rename, and a post-midnight move that must
//      read +60 minutes, not -1380.
//   2. DST: Escape Halloween's real config. Oct 31 → Nov 1 falls back at 02:00,
//      so 03:00 that night is 11:00Z, where midnightUtc + hours said 10:00Z.
//   3. Every live festival: _wallMs equals the plain before-08:00 sum for every
//      timed act (no live night crosses a transition today), the bundled
//      schedule diffs to zero against its committed f/<id>/schedule.json, and a
//      stage move + cancellation + addition come back as exactly those three,
//      deterministically, with apply idempotent and diff(apply(old), new) empty.
//   4. A duplicate act id throws instead of silently shadowing one act.
import vm from "node:vm";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = {
  window: {}, console, Date, Math, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat, Intl,
  fetch: () => {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
vm.createContext(ctx);
const mods = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
vm.runInContext(mods + "\n" + readFileSync(join(ROOT, "data.jsx"), "utf8") +
  "\n;__out = { REG: FESTIVALS_REGISTRY, DS: _DATA_SETS, diffSchedule, applyScheduleDiff, _wallMs, _scheduleActs, _cfgActDayDate };", ctx);
const { REG, DS, diffSchedule, applyScheduleDiff, _wallMs, _scheduleActs, _cfgActDayDate } = ctx.__out;

let checks = 0, failed = 0;
// vm objects live in another realm, so compare by JSON, never deepEqual.
const js = v => JSON.stringify(v);
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

// ── 1. Fixtures ─────────────────────────────────────────────────────────────
const H = 3600000;
const cfg = {
  tz: "America/Los_Angeles",
  dayDates: { 1: { midnightUtc: Date.UTC(2026, 4, 15, 7) }, 2: { midnightUtc: Date.UTC(2026, 4, 16, 7) } },
  weekendStartMs: { W1: Date.UTC(2026, 4, 15, 7), W2: Date.UTC(2026, 4, 22, 7) },
};
const act = (id, day, stage, start, end, extra = {}) => ({ id, name: id.toUpperCase(), day, stage, start, end, ...extra });
const OLD = [
  act("day", 1, "s1", "21:00", "22:00"),
  act("stage", 1, "s1", "21:00", "22:00"),
  act("start", 1, "s1", "20:00", "22:00"),
  act("end", 1, "s1", "22:00", "23:00"),
  act("gone", 1, "s1", "18:00", "19:00"),
  act("tba", 1, "s2", "", ""),
  act("nostage", 1, null, "19:00", "20:00"),
  act("same", 1, null, "9:00", "10:00"),
  act("latenight", 1, "s1", "23:30", "00:30"),
  act("wk", 1, "s1", "20:00", "21:00", { weekend: "W1" }),
  act("pulled", 2, "s1", "21:00", "22:00"),
  act("both", 2, "s1", "21:00", "22:00"),
  act("renamed", 2, "s1", "18:00", "19:00"),
];
const NEW = [
  act("day", 2, "s1", "21:00", "22:00"),
  act("stage", 1, "s2", "21:00", "22:00"),
  act("start", 1, "s1", "20:30", "22:00"),
  act("end", 1, "s1", "22:00", "23:30"),
  act("tba", 1, "s2", "19:00", "20:00"),
  act("nostage", 1, "s3", "19:00", "20:00"),
  act("same", 1, null, "09:00", "10:00"),
  act("latenight", 1, "s1", "00:30", "01:30"),
  act("wk", 1, "s1", "20:00", "21:00", { weekend: "W2" }),
  act("pulled", 2, "s1", "", "22:00"),
  act("both", 2, "s4", "22:00", "23:00"),
  { ...act("renamed", 2, "s1", "18:00", "19:00"), name: "RENAMED B2B" },
  act("new", 2, "s2", "17:00", "18:00"),
];
const d = diffSchedule(OLD, NEW, cfg);
const row = Object.fromEntries(d.changes.map(c => [c.id, c]));
const WANT = {
  day: [["day"], 1440], stage: [["stage"], 0], start: [["start"], 30], end: [["end"], 0],
  gone: [["cancelled"], null], tba: [["start", "end"], null], nostage: [["stage"], 0],
  latenight: [["start", "end"], 60], wk: [["weekend"], 7 * 1440], pulled: [["start"], null],
  both: [["stage", "start", "end"], 60], new: [["added"], null],
};
for (const [id, [kinds, delta]] of Object.entries(WANT)) {
  check(row[id] && js(row[id].kinds) === js(kinds), `${id}: kinds ${js(row[id]?.kinds)}, want ${js(kinds)}`);
  check(row[id] && row[id].startDeltaMin === delta, `${id}: startDeltaMin ${row[id]?.startDeltaMin}, want ${delta}`);
}
check(!row.same, `"9:00" vs "09:00" with a null stage both sides must be unchanged`);
check(!row.renamed, `a rename alone is not a schedule change`);
check(d.changes.length === Object.keys(WANT).length, `${d.changes.length} change rows, want ${Object.keys(WANT).length}`);
check(js(d.counts) === js({ day: 1, stage: 3, start: 5, end: 4, weekend: 1, cancelled: 1, added: 1 }), `counts ${js(d.counts)}`);
check(d.unchanged === 2, `unchanged ${d.unchanged}, want 2`);
check(row.gone.after === null && row.new.before === null, `cancelled has no after, added has no before`);
check(row.tba.before.start === "" && row.nostage.before.stage === null, `TBA and null stage are carried as values`);
const applied = applyScheduleDiff(OLD, d);
check(diffSchedule(applied, NEW, cfg).changes.length === 0, `fixture: diff(apply(old, d), new) is not empty`);
check(js(applyScheduleDiff(applied, d)) === js(applied), `fixture: applying the diff twice changed the result`);
check(applied.find(a => a.id === "wk")?.weekend === "W2" && !("weekend" in applied.find(a => a.id === "day")),
  `weekend is set where the feed has one and absent where it does not`);
console.log(`  ✓ fixtures: every change kind alone, TBA both ways, null stage, zero-padding, rename, post-midnight +60`);

// ── 2. DST night — Escape Halloween's real config ──────────────────────────
{
  const esc = REG.find(e => e.config.id === "escape-halloween-2026")?.config;
  check(!!esc, "escape-halloween-2026 is no longer in the registry — pick another DST-crossing fixture");
  if (esc) {
    const oct31 = esc.dayDates[2], oct30 = esc.dayDates[1];
    const plain = (dd, hhmm) => { const [h, m] = hhmm.split(":").map(Number); return dd.midnightUtc + ((h < 8 ? h + 24 : h) * 60 + m) * 60000; };
    check(_wallMs(oct31, "23:00", esc.tz) === Date.UTC(2026, 10, 1, 6, 0), `Oct 31 23:00 PDT must be Nov 1 06:00Z`);
    check(_wallMs(oct31, "01:30", esc.tz) === Date.UTC(2026, 10, 1, 8, 30), `Nov 1 01:30 (first, PDT) must be 08:30Z`);
    check(_wallMs(oct31, "03:00", esc.tz) === Date.UTC(2026, 10, 1, 11, 0), `Nov 1 03:00 PST must be 11:00Z`);
    check(plain(oct31, "03:00") === Date.UTC(2026, 10, 1, 10, 0), `positive control: the plain sum is an hour early at 03:00`);
    check(_wallMs(oct30, "03:00", esc.tz) === plain(oct30, "03:00"), `a night with no transition must equal the plain sum`);
    const dd = diffSchedule([act("x", 2, "s", "01:30", "02:30")], [act("x", 2, "s", "03:00", "04:00")], esc);
    check(dd.changes[0]?.startDeltaMin === 150, `01:30 → 03:00 across fall-back is +150 min, got ${dd.changes[0]?.startDeltaMin}`);
    console.log(`  ✓ DST: Escape's Oct 31 night resolves 03:00 to 11:00Z and a move across the fall-back reads +150 min`);
  }
}

// ── 3. Every live festival ──────────────────────────────────────────────────
{
  let festivals = 0, timed = 0;
  for (const e of REG.filter(x => x.available)) {
    const c = e.config, id = c.id;
    const acts = _scheduleActs(DS[id]?.artists);
    check(acts.length > 0, `${id}: live with no acts`);
    for (const a of acts) {
      if (!a.start) continue;
      const dd = _cfgActDayDate(c, a), [h, m] = a.start.split(":").map(Number);
      const plain = dd.midnightUtc + ((h < 8 ? h + 24 : h) * 60 + m) * 60000;
      timed++;
      check(_wallMs(dd, a.start, c.tz) === plain, `${id} ${a.id} ${a.start}: _wallMs moved a set on a night with no transition`);
    }
    const feedPath = join(ROOT, "f", id, "schedule.json");
    check(existsSync(feedPath), `${id}: no committed f/${id}/schedule.json`);
    if (existsSync(feedPath)) {
      const feed = JSON.parse(readFileSync(feedPath, "utf8"));
      check(js(feed.acts) === js(acts), `${id}: committed feed acts differ from _scheduleActs (run gen-festival-pages)`);
      check(diffSchedule(acts, feed.acts, c).changes.length === 0, `${id}: bundled schedule vs its own feed is not an empty diff`);
    }
    const self = diffSchedule(acts, acts, c);
    check(self.changes.length === 0 && self.unchanged === acts.length, `${id}: diff(x, x) is not empty`);

    const moved = acts.map((a, i) => (i === 0 ? { ...a, stage: "__moved" } : a)).slice(0, -1)
      .concat([{ id: "__added", name: "ADDED", day: acts[0].day, stage: null, start: "", end: "" }]);
    const dm = diffSchedule(acts, moved, c);
    check(js(dm.counts) === js({ day: 0, stage: 1, start: 0, end: 0, weekend: 0, cancelled: 1, added: 1 }), `${id}: mutation counts ${js(dm.counts)}`);
    check(js(diffSchedule(acts, moved, c)) === js(dm), `${id}: the same inputs gave a different diff`);
    const once = applyScheduleDiff(acts, dm);
    check(diffSchedule(once, moved, c).changes.length === 0, `${id}: diff(apply(old, d), new) is not empty`);
    check(js(applyScheduleDiff(once, dm)) === js(once), `${id}: applying the diff twice changed the result`);
    festivals++;
  }
  check(festivals >= 12, `only ${festivals} live festivals — expected at least 12`);
  console.log(`  ✓ ${festivals} live festivals: ${timed} timed sets unmoved by _wallMs, bundled = feed, mutation exact, apply idempotent`);
}

// ── 4. Duplicate ids ────────────────────────────────────────────────────────
{
  let threw = false;
  try { diffSchedule([act("x", 1, "s", "", "")], [act("x", 1, "s", "", ""), act("x", 2, "s", "", "")], cfg); } catch { threw = true; }
  check(threw, `a duplicate act id in the new schedule must throw`);
  console.log(`  ✓ a duplicate act id throws`);
}

if (failed) { console.log(`  ✗  ${failed} of ${checks} schedule-diff checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} schedule-diff checks`);
