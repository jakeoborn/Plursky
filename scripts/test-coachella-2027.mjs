// Coachella 2027 (SPEC-195 work package A): the lineup-only module is the
// official roster and nothing more.
//
//   node scripts/test-coachella-2027.mjs
//
// Pins, on the real data/festivals/coachella-2027.js + data.jsx:
//   - ONE registry entry for coachella-2027 (the old data.jsx stub is gone)
//   - 155 unique billings: Fri 54 / Sat 52 / Sun 48 / day pending 1, no NOYA
//   - no clock time, stage or sun time, and gps is only the venue point: the AEG feed's 10:00-10:30
//     "Coachella" placeholders never enter the data
//   - two weekends in America/Los_Angeles: Apr 9-11 and Apr 16-18 are event
//     days, Apr 12-15 never are, and nothing in the gap is "live"
//   - every act plays both weekends with ONE id (no double count)
//   - gated: not openable, not scheduleTBA-open, never the default festival
// Then each MUTATION below breaks one protected behaviour and the same checks
// must catch it; a gate that stays green under its mutation fails the run.
//
// The roster's provenance (source URLs, ids, hashes, the NOYA call) is in
// the module header; raw evidence lives outside the repo.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MOD = "coachella-2027.js";
const ID = "coachella-2027";

function load(modSrc, dataSrc) {
  const ctx = {
    window: {}, console: { ...console, warn() {} }, Date, Math, JSON, Object, Array, String, Number,
    isNaN, parseInt, parseFloat, fetch: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  vm.createContext(ctx);
  const dir = path.join(ROOT, "data", "festivals");
  const mods = readdirSync(dir).filter(f => f.endsWith(".js")).sort()
    .map(f => (f === MOD ? modSrc : readFileSync(path.join(dir, f), "utf8"))).join("\n");
  vm.runInContext(mods + "\n" + dataSrc +
    "\n;__out = { REG: FESTIVALS_REGISTRY, DS: _DATA_SETS, phase: _festivalPhase, days: _festivalEventDays," +
    " plays: actPlaysWeekend, shifts: festivalWeekendShifts, tba: isScheduleTBA, def: _resolveDefaultFestivalId," +
    " sched: _scheduleActs };", ctx);
  return ctx.__out;
}

const PDT = 7 * 3600000;
const localMidnight = (m, d) => Date.UTC(2027, m, d) + PDT;

function check(modSrc, dataSrc) {
  const bad = [];
  let o;
  try { o = load(modSrc, dataSrc); } catch (e) { return [`load threw: ${e.message}`]; }
  const entries = o.REG.filter(f => f && f.config && f.config.id === ID);
  if (entries.length !== 1) bad.push(`registry has ${entries.length} coachella-2027 entries, want 1`);
  const ds = o.DS[ID];
  if (!ds) return [...bad, "no _DATA_SETS entry"];
  const acts = ds.artists, c = ds.config;

  // Roster
  if (acts.length !== 155) bad.push(`${acts.length} billings, want 155`);
  const ids = new Set(acts.map(a => a.id));
  if (ids.size !== acts.length) bad.push(`${acts.length - ids.size} duplicate ids`);
  if (acts.some(a => !/^coa27-[a-z0-9-]+$/.test(a.id))) bad.push("an id is not coa27-<source slug>");
  const by = d => acts.filter(a => a.day === d).length;
  const split = `${by(1)}/${by(2)}/${by(3)}/${acts.filter(a => a.day == null).length}`;
  if (split !== "54/52/48/1") bad.push(`day split ${split}, want 54/52/48/1`);
  if (acts.some(a => /^noya$/i.test(a.name))) bad.push("NOYA (feed-only, object id -1) was imported");
  const jn = acts.find(a => a.name === "Jakob Nowell and THE CASTLE");
  if (!jn || jn.day != null) bad.push("Jakob Nowell and THE CASTLE must be one act with day: null (sources disagree)");
  if (acts.some(a => a.day != null && ![1, 2, 3].includes(a.day))) bad.push("a day outside 1-3");

  // No placeholders: no clock time, stage, sun time, gps
  for (const a of acts) {
    if (a.start || a.end) { bad.push(`${a.id} carries a time ${a.start}-${a.end}`); break; }
    if (a.stage != null) { bad.push(`${a.id} carries a stage ${a.stage}`); break; }
    if (a.weekend != null) { bad.push(`${a.id} is tagged weekend ${a.weekend}; every act plays both`); break; }
  }
  if (ds.stages.length) bad.push(`${ds.stages.length} stages; none are published`);
  if (c.sunTimes) bad.push("sunTimes present; none are published");
  // gps: the venue point only, the same row the historical scan calendar uses.
  const venueRow = readFileSync(path.join(ROOT, "data/historical/scan-calendar/venues.tsv"), "utf8")
    .split("\n").find(l => l.startsWith("Empire Polo Club\t"));
  const [, vlat, vlng] = (venueRow || "").split("\t");
  if (!c.gps || c.gps.lat !== +vlat || c.gps.lng !== +vlng)
    bad.push(`gps ${JSON.stringify(c.gps)} is not the Empire Polo Club venue row (${vlat}, ${vlng})`);
  const sched = JSON.stringify(o.sched(acts));
  if (/\d{1,2}:\d{2}/.test(sched)) bad.push("the schedule feed carries a clock time");
  if (c.tz !== "America/Los_Angeles") bad.push(`tz ${c.tz}`);

  // Two weekends, the gap never live
  const want = [9, 10, 11, 16, 17, 18].map(d => localMidnight(3, d));
  const got = o.days(c);
  if (JSON.stringify(got) !== JSON.stringify(want))
    bad.push(`event days ${got.map(x => new Date(x - PDT).toISOString().slice(5, 10))}, want 04-09..11 + 04-16..18`);
  const f = { config: c };
  for (const d of [12, 13, 14, 15]) {
    const p = o.phase(f, localMidnight(3, d) + 15 * 3600000);
    if (p === "live") bad.push(`Apr ${d} 15:00 local reads live`);
  }
  for (const d of [9, 17]) {
    const p = o.phase(f, localMidnight(3, d) + 15 * 3600000);
    if (p !== "live") bad.push(`Apr ${d} 15:00 local reads ${p}, want live`);
  }
  const wk = o.shifts(c).map(s => s.weekend).join();
  if (wk !== "W1,W2") bad.push(`weekends ${wk}, want W1,W2`);
  const ws = c.weekendStartMs || {};
  if (ws.W1 !== localMidnight(3, 9) || ws.W2 !== localMidnight(3, 16))
    bad.push("weekendStartMs is not Apr 9 / Apr 16 local midnight");
  const w1 = acts.filter(a => o.plays(a, "W1")).length, w2 = acts.filter(a => o.plays(a, "W2")).length;
  if (w1 !== 155 || w2 !== 155) bad.push(`W1 ${w1} / W2 ${w2} acts, want 155 each`);

  // Saved identity survives a source reorder and one act leaving: a saved id
  // names the same billing in the reordered module, and the removed act's id
  // is simply absent (storage keeps it as an orphan; savedInLineup drops it
  // from counts). Ids from list POSITION would pass every check above.
  const names = list => Object.fromEntries(list.map(a => [a.id, a.name]));
  const mkLines = modSrc.match(/^ {4}mk\(.*$/gm) || [];
  if (mkLines.length) {
    // Row k takes row (n-1-k)'s text; the original last row (now first) is dropped.
    const rev = [...mkLines].reverse(); let k = 0;
    const reordered = modSrc.replace(/^ {4}mk\(.*$\n?/gm, () => (k++ === 0 ? "" : rev[k - 1] + "\n"));
    let o2; try { o2 = load(reordered, dataSrc); } catch (e) { bad.push(`reordered module threw: ${e.message}`); }
    if (o2) {
      const before = names(acts), after = names(o2.DS[ID].artists);
      const dropped = acts.find(a => !(a.id in after));
      const moved = Object.keys(before).filter(id => id in after && after[id] !== before[id]);
      if (moved.length) bad.push(`reorder: ${moved.length} saved ids now name a different billing (e.g. ${moved[0]} ${before[moved[0]]} -> ${after[moved[0]]})`);
      if (!dropped || dropped.name !== before[mkLines[mkLines.length - 1].match(/mk\("([^"]+)"/)[1]]) bad.push("reorder: the removed act is not the one left out");
    }
  } else bad.push("no mk(...) rows to reorder");

  // Gated, never the default
  if (entries[0] && entries[0].available !== false) bad.push("coachella-2027 is openable; activation is its own PR");
  if (o.tba(ID)) bad.push("isScheduleTBA(coachella-2027) is true while gated");
  for (const now of [Date.UTC(2026, 10, 13), localMidnight(3, 10)])
    if (o.def(now) === ID) bad.push(`default festival is coachella-2027 at ${new Date(now).toISOString()}`);
  return bad;
}

const modSrc = readFileSync(path.join(ROOT, "data", "festivals", MOD), "utf8");
const dataSrc = readFileSync(path.join(ROOT, "data.jsx"), "utf8");
const real = check(modSrc, dataSrc);
let failed = 0;
if (real.length) { failed++; for (const b of real) console.log(`  ✗ ${b}`); }

const sub = (s, a, b) => { if (!s.includes(a)) throw new Error(`mutation anchor missing: ${a.slice(0, 60)}`); return s.replace(a, b); };
const STUB = `  {\n    config: { id: "coachella-2027", name: "Coachella 2027", dates: "Apr 9–18, 2027", year: 2027 },\n    available: false, accent: "#ec4899", emoji: "🌵", region: "North America",\n  },\n`;
const MUTATIONS = [
  ["the feed's dummy 10:00-10:30 imported as set times", () => [sub(modSrc, `start: "", end: ""`, `start: "10:00", end: "10:30"`), dataSrc]],
  ["the venue placeholder imported as a stage", () => [sub(modSrc, "stage: null, day,", `stage: "coachella", day,`), dataSrc]],
  ["W1 and W2 swapped", () => [sub(sub(modSrc, "W1: Date.UTC(2027, 3, 9,", "W1: Date.UTC(2027, 3, 16,"), "W2: Date.UTC(2027, 3, 16,", "W2: Date.UTC(2027, 3, 9,"), dataSrc]],
  ["ten consecutive days (weekendStartMs dropped)", () => [sub(modSrc, "weekendStartMs: {", "_weekendStartMs: {"), dataSrc]],
  ["the old data.jsx stub re-added beside the module", () => [modSrc, sub(dataSrc, "  // ── Registry stubs from #113", STUB + "  // ── Registry stubs from #113")]],
  ["NOYA imported from the feed's -1 row", () => [sub(modSrc, "  const ARTISTS = [\n", `  const ARTISTS = [\n    mk("coa27-noya", "NOYA", 1),\n`), dataSrc]],
  ["Jakob Nowell given the feed's Sunday", () => [sub(modSrc, `"Jakob Nowell and THE CASTLE", null)`, `"Jakob Nowell and THE CASTLE", 3)`), dataSrc]],
  ["an act tagged W1-only without a source", () => [sub(modSrc, `mk("coa27-american-football", "American Football", 1)`, `{ ...mk("coa27-american-football", "American Football", 1), weekend: "W1" }`), dataSrc]],
  ["the module opened in its foundation PR", () => [sub(modSrc, "registry: { available: false,", "registry: { available: true,"), dataSrc]],
  ["a made-up venue point", () => [sub(modSrc, "lat: 33.679811", "lat: 33.6810"), dataSrc]],
  ["ids assigned by list position (a reorder moves saved ids)", () => [sub(modSrc, `  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};`, `  ARTISTS.forEach((a, i) => { a.id = "coa27-" + i; });\n  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};`), dataSrc]],
  ["an act dropped", () => [modSrc.replace(/^ {4}mk\("coa27-adam-ten".*\n/m, ""), dataSrc]],
];
let caught = 0;
for (const [name, make] of MUTATIONS) {
  let m;
  try { m = make(); } catch (e) { console.log(`  ✗ mutation "${name}": ${e.message}`); failed++; continue; }
  if (m[0] === modSrc && m[1] === dataSrc) { console.log(`  ✗ mutation "${name}" changed nothing`); failed++; continue; }
  let b;
  try { b = check(...m); } catch (e) { b = [`threw: ${e.message}`]; }
  if (b.length) caught++; else { console.log(`  ✗ mutation "${name}" stayed green`); failed++; }
}
if (failed) { console.log(`✗ coachella-2027: ${failed} failure(s)`); process.exit(1); }
console.log(`  ✓ coachella 2027: 155 billings (Fri 54 / Sat 52 / Sun 48 / pending 1), no times/stages/sun times, gps = the venue row, Apr 9-11 + 16-18 PDT with Apr 12-15 never live, both weekends one id, saved ids stable across a reorder, gated, never default; ${caught}/${MUTATIONS.length} mutations caught`);
