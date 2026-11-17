#!/usr/bin/env node
// Summerfest 2026: ten School of Rock showcase billings whose set times the
// sources dispute. They ship BLANK, with a per-billing evidence record
// (TIME_EVIDENCE in the module, carried edition-scoped onto each act by
// data.jsx), and every surface reads "Set times unconfirmed".
//
// This gate runs the REAL module and the REAL data.jsx in a VM:
//   A. module contract — the ten rows are blank on both sides, the header's
//      UNRESOLVED SET TIMES list equals the record's keys, every key is an act
//      of THIS edition, no act anywhere is half-timed, and the constructor
//      bills an untimed act EXACTLY tier 1 while every timed tier follows the
//      published rule.
//   B. status — setTimeStatus checks evidence first: an act that somehow has
//      times AND an unresolved record still reads "unconfirmed".
//   C. feed — a schedule.json that restores the legacy times changes nothing
//      (they are pinned); the same feed plus one real change yields exactly
//      that change.
//   D. stored overlay — an overlay with the CORRECT base fingerprint that sets
//      su179 to 12:00/15:50 boots blank and unconfirmed; its other change
//      still applies.
//   E. reconciliation — a source-reviewed module edit (record entry, header
//      list and row together) is the one path that confirms a time.
//   F. the schedule-change notice an OLD install sees (its module still holds
//      12:00, and with no record the pin is a no-op, so this is the old
//      review path): exactly ten start+end changes, nothing dropped, no
//      clashes, no reminders, saved ids returned untouched; new-vs-new is up
//      to date; the old overlay is dropped on the new bundle.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FID = "summerfest-2026";
const MODFILE = `${FID}.js`;
const SOR = ["su152", "su157", "su168", "su173", "su179", "su198", "su203", "su214", "su219", "su224"];
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const MODULES = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort();
const SRC = Object.fromEntries(MODULES.map(f => [f, readFileSync(join(ROOT, "data", "festivals", f), "utf8")]));
const DATA = readFileSync(join(ROOT, "data.jsx"), "utf8");

// One boot of the data layer. `mod` overrides the Summerfest module source;
// `store` is localStorage (the schedule overlay lives there).
function boot({ mod = SRC[MODFILE], store = {}, others = {} } = {}) {
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const ctx = { window: {}, console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Object, Array, String, Number,
    isNaN, parseInt, parseFloat, fetch: () => {}, localStorage: ls };
  vm.createContext(ctx);
  const mods = MODULES.map(f => (f === MODFILE ? mod : others[f] || SRC[f])).join("\n");
  vm.runInContext(mods + "\n" + DATA + "\n;__o = { DS: _DATA_SETS, scheduleActs: _scheduleActs, scheduleReview, applyScheduleReview," +
    " diffSchedule, fingerprint: _schedFingerprint, setTimeStatus, pin: _pinUnresolvedTimes, OVERLAY_KEY: _SCHED_OVERLAY_KEY };", ctx);
  return { ...ctx.__o, store, ctx };
}
// The module's own tier rule, lifted out of the IIFE so fixtures can call it.
function constructor(mod) {
  const hh = /const hhmm = [^\n]+\n/.exec(mod)[0];
  const mk = /const mk = \(id[\s\S]*?\n  \};\n/.exec(mod)[0];
  const c = { STAGES: [{ id: "x", color: "#000" }] };
  vm.createContext(c);
  vm.runInContext(hh + mk + "\n;__mk = mk;", c);
  return c.__mk;
}
const evidenceKeys = mod => {
  const m = /const TIME_EVIDENCE = \{([\s\S]*?)\n  \};/.exec(mod);
  return m ? [...m[1].matchAll(/\b([A-Za-z_$][\w$]*):\s*sorEvidence\(/g)].map(x => x[1]) : [];
};
const headerIds = mod => ((/^\/\/ UNRESOLVED SET TIMES: (.*)$/m.exec(mod) || [])[1] || "").trim().split(/\s+/).filter(Boolean);
const partial = a => !!(a.start || "") !== !!(a.end || "");
const ruleTier = start => { const h = parseInt(start, 10); return h >= 21 || h < 6 ? 3 : h >= 18 ? 2 : 1; };

// ── A. module contract ─────────────────────────────────────────────────────
const NOW = boot();
const sf = NOW.DS[FID];
const byId = new Map(sf.artists.map(a => [a.id, a]));
// The module's rows as written, BEFORE data.jsx pins anything: a row that
// regained a time (or lost half of one) must fail here, not be masked by the pin.
const RAW = NOW.ctx.window.PLURSKY_FESTIVALS;
const rawById = new Map(RAW[FID].artists.map(a => [a.id, a]));
check(same(evidenceKeys(SRC[MODFILE]).sort(), [...SOR].sort()), `A. TIME_EVIDENCE lists exactly the ten showcase billings (got ${evidenceKeys(SRC[MODFILE]).join(" ")})`);
check(same(headerIds(SRC[MODFILE]).sort(), evidenceKeys(SRC[MODFILE]).sort()), "A. the header's UNRESOLVED SET TIMES list equals the record's keys");
check(sf.timeEvidence && same(Object.keys(sf.timeEvidence).sort(), [...SOR].sort()), "A. the record reaches _DATA_SETS[summerfest].timeEvidence");
for (const id of Object.keys(sf.timeEvidence || {})) check(byId.has(id), `A. evidence key ${id} is an act of THIS edition`);
for (const id of SOR) {
  const a = byId.get(id), raw = rawById.get(id);
  check(raw && raw.start === "" && raw.end === "", `A. ${id} is written blank on both sides in the module (got "${raw && raw.start}"–"${raw && raw.end}")`);
  check(a && a.tier === 1, `A. ${id} is billed exactly tier 1 (got ${a && a.tier})`);
  check(a && a.timeEvidence === sf.timeEvidence[id], `A. ${id} carries its own edition's record`);
  const e = sf.timeEvidence[id];
  check(e && e.status === "unresolved" && same(e.disputed, ["start", "end"]) && /^\d\d:\d\d$/.test(e.observed.start) && /^\d\d:\d\d$/.test(e.observed.end),
    `A. ${id} record: unresolved, start+end disputed, legacy observation kept`);
  check(e && e.sources.length >= 3 && e.sources.every(s => /^https:\/\//.test(s.url) && /^(first-party|secondary)$/.test(s.role)
    && /^\d{4}-\d\d-\d\d$/.test(s.observedAt) && s.says), `A. ${id} sources carry url, role, observedAt and what they say`);
}
const halfTimed = Object.entries(RAW).flatMap(([fid, d]) => (d.artists || []).filter(partial).map(a => `${fid}/${a.id}`));
check(!halfTimed.length, `A. no act in any edition is half-timed (${halfTimed.slice(0, 5).join(", ")})`);
const others = Object.entries(NOW.DS).filter(([fid, d]) => fid !== FID && ((d.artists || []).some(a => a.timeEvidence) || d.timeEvidence)).map(([f]) => f);
check(!others.length, `A. no other edition carries a time record (${others.join(", ")})`);
const sfTimed = sf.artists.filter(a => a.start && a.end);
const tierOff = sfTimed.filter(a => a.tier !== ruleTier(a.start)).map(a => a.id);
check(!tierOff.length, `A. every timed Summerfest tier follows the published rule (${tierOff.slice(0, 5).join(", ")})`);
const mk = constructor(SRC[MODFILE]);
check(mk("t", "T", "", "x", 1, "", "").tier === 1, "A. constructor: blank start and end → exactly tier 1");
check(mk("t", "T", "", "x", 1, "", "15:00").tier === 1 && partial({ start: "", end: "15:00" }), "A. constructor: blank start / end set → tier 1, and the gate rejects the half-timed row");
check(mk("t", "T", "", "x", 1, "12:00", "").tier === 1 && partial({ start: "12:00", end: "" }), "A. constructor: start set / blank end → tier 1, and the gate rejects the half-timed row");
check(mk("t", "T", "", "x", 1, "21:00", "22:30").tier === 3 && mk("t", "T", "", "x", 1, "04:00", "05:00").tier === 3
  && mk("t", "T", "", "x", 1, "18:30", "19:30").tier === 2 && mk("t", "T", "", "x", 1, "13:00", "14:00").tier === 1,
  "A. constructor: timed tiers unchanged (21:00→3, 04:00→3, 18:30→2, 13:00→1)");

// ── B. status reads evidence first ────────────────────────────────────────
const rec = sf.timeEvidence.su179;
check(NOW.setTimeStatus({ id: "x", start: "12:00", end: "15:50", timeEvidence: rec }) === "unconfirmed", "B. an act with times AND an unresolved record reads unconfirmed");
check(NOW.setTimeStatus({ id: "x", start: "", end: "" }) === "tba", "B. blank with no record reads tba (ordinary TBA unchanged)");
check(NOW.setTimeStatus({ id: "x", start: "13:00", end: "14:00" }) === "confirmed", "B. a timed act reads confirmed");
const feedActs = NOW.scheduleActs(sf.artists);
check(feedActs.filter(a => a.timeStatus === "unconfirmed").length === 10 && feedActs.filter(a => "timeStatus" in a).length === 10,
  "B. schedule.json marks exactly the ten acts timeStatus unconfirmed");

// ── C. a feed cannot restore a disputed time ──────────────────────────────
const legacyFeed = feedActs.map(a => {
  const e = sf.timeEvidence[a.id];
  const o = { ...a };
  delete o.timeStatus;
  return e ? { ...o, start: e.observed.start, end: e.observed.end } : o;
});
const at = Date.parse("2026-10-13T12:00:00Z");
const rv1 = NOW.scheduleReview(FID, { festivalId: FID, acts: legacyFeed }, { now: at, saved: ["su179", "su1"] });
check(rv1.upToDate === true && rv1.shown.changes.length === 0 && rv1.stored.changes.length === 0,
  `C. a feed restoring the ten legacy times is up to date (${rv1.shown && rv1.shown.changes.length} changes)`);
const su1 = sf.artists.find(a => a.id === "su1");
const moved = legacyFeed.map(a => (a.id === "su1" ? { ...a, start: "18:45" } : a));
const rv2 = NOW.scheduleReview(FID, { festivalId: FID, acts: moved }, { now: at, saved: ["su179", "su1"] });
check(rv2.shown.changes.length === 1 && rv2.shown.changes[0].id === "su1" && same(rv2.shown.changes[0].kinds, ["start"]),
  "C. the same feed plus one real change (su1 18:30→18:45) yields exactly that change");
const staged = legacyFeed.map(a => (a.id === "su179" ? { ...a, stage: "generac" } : a));
const rv3 = NOW.scheduleReview(FID, { festivalId: FID, acts: staged }, { now: at, saved: [] });
check(rv3.shown.changes.length === 1 && same(rv3.shown.changes[0].kinds, ["stage"]), "C. a stage move on a disputed act still goes to review (stage only, no time)");
const cancelled = legacyFeed.filter(a => a.id !== "su179");
const rv4 = NOW.scheduleReview(FID, { festivalId: FID, acts: cancelled }, { now: at, saved: ["su179"] });
check(rv4.shown.changes.length === 1 && same(rv4.shown.changes[0].kinds, ["cancelled"]) && same(rv4.dropSaved, ["su179"]),
  "C. a cancellation of a disputed act still goes to review");

// ── D. a stored overlay with the right fingerprint cannot either ──────────
const base = NOW.fingerprint(NOW.scheduleActs(sf.artists));
const planted = NOW.diffSchedule(NOW.scheduleActs(sf.artists),
  feedActs.map(a => (a.id === "su179" ? { ...a, start: "12:00", end: "15:50" } : a.id === "su1" ? { ...a, start: "18:45" } : a)), sf.config);
check(planted.changes.length === 2, "D. harness: the planted diff carries su179's legacy times and one real su1 change");
const store = { [NOW.OVERLAY_KEY]: JSON.stringify({ [FID]: { base, feedHash: "planted", source: null, appliedAt: 0, diff: planted } }) };
const B2 = boot({ store });
const p179 = B2.DS[FID].artists.find(a => a.id === "su179");
const p1 = B2.DS[FID].artists.find(a => a.id === "su1");
check(!!B2.store[B2.OVERLAY_KEY], "D. the planted overlay was accepted (fingerprint matched), not silently dropped");
check(p1 && p1.start === "18:45", "D. the overlay's real change applied (su1 → 18:45)");
check(p179 && p179.start === "" && p179.end === "", `D. su179 boots blank despite the overlay (got ${p179 && p179.start}–${p179 && p179.end})`);
check(p179 && B2.setTimeStatus(p179) === "unconfirmed" && p179.timeEvidence === B2.DS[FID].timeEvidence.su179,
  "D. su179 still reads unconfirmed and carries its record");

// ── E. the reconciliation path ────────────────────────────────────────────
const reconciled = SRC[MODFILE]
  .replace(/^(\/\/ UNRESOLVED SET TIMES: .*?)\s*su179\b/m, "$1")
  .replace(/\n    su179: sorEvidence\(4, "uline", "15:50"\),/, "")
  .replace(/(mk\("su179",[^\n]*?)"", ""\)/, '$1"12:00", "15:00")');
check(!evidenceKeys(reconciled).includes("su179") && !headerIds(reconciled).includes("su179") && same(headerIds(reconciled).sort(), evidenceKeys(reconciled).sort()),
  "E. harness: the reviewed edit removes su179 from the record and the header together");
const B3 = boot({ mod: reconciled });
const r179 = B3.DS[FID].artists.find(a => a.id === "su179");
check(r179 && r179.start === "12:00" && B3.setTimeStatus(r179) === "confirmed" && !r179.timeEvidence, "E. after the reviewed edit su179 reads confirmed, 12:00");
check(B3.DS[FID].artists.filter(a => B3.setTimeStatus(a) === "unconfirmed").length === 9, "E. the other nine stay unconfirmed");

// ── G. edition scoping, with a colliding id ───────────────────────────────
// No other festival shares an id with these ten today, so a lookup that
// ignored the edition would pass on the shipped data. Give another edition an
// act called su179 and prove it keeps its own time.
const OTHER = "governors-ball-2026.js";
const firstId = (/mk\("([^"]+)"/.exec(SRC[OTHER]) || [])[1];
const collide = firstId && SRC[OTHER].replace(`mk("${firstId}"`, 'mk("su179"');
const B5 = boot({ others: { [OTHER]: collide } });
const gb = Object.values(B5.DS).find(d => d !== B5.DS[FID] && (d.artists || []).some(a => a.id === "su179"));
const g179 = gb && gb.artists.find(a => a.id === "su179");
check(!!g179, "G. harness: another edition now has an act with id su179");
check(g179 && g179.start && g179.end && !g179.timeEvidence && B5.setTimeStatus(g179) === "confirmed",
  `G. that edition's su179 keeps its own time and reads confirmed (got ${g179 && g179.start}, ${g179 && B5.setTimeStatus(g179)})`);
check(B5.DS[FID].artists.find(a => a.id === "su179").start === "", "G. Summerfest's su179 is still blank");

// ── F. the notice an old install sees ─────────────────────────────────────
// An old binary bundles the module as it was: the ten rows at their legacy
// times and no record. With no record the pin is a no-op and _scheduleActs
// emits no timeStatus, so this boot runs the old review path.
const legacyMod = SRC[MODFILE]
  .replace(/ timeEvidence: TIME_EVIDENCE,/, "")
  .replace(/mk\("(su\d+)",([^\n]*?)"", ""\)/g, (m, id, mid) => {
    const e = sf.timeEvidence[id];
    return e ? `mk("${id}",${mid}"${e.observed.start}", "${e.observed.end}")` : m;
  });
const oldStore = {};
const OLD = boot({ mod: legacyMod, store: oldStore });
check(OLD.DS[FID].artists.find(a => a.id === "su179").start === "12:00" && !OLD.DS[FID].timeEvidence, "F. harness: the old bundle holds 12:00 and no record");
const saved = ["su179", "su152", "su1", "su45"];
const savedBefore = JSON.stringify(saved);
const nr = OLD.scheduleReview(FID, { festivalId: FID, acts: feedActs }, { now: at, saved, remindersOn: true, leadMin: 15 });
check(nr.shown.changes.length === 10 && nr.shown.changes.every(c => SOR.includes(c.id) && same(c.kinds, ["start", "end"]) && c.after && c.after.start === "" && c.after.end === ""),
  `F. old install: exactly ten changes, each start+end to blank (${nr.shown.changes.map(c => c.id + ":" + c.kinds).join(" ")})`);
check(same(nr.dropSaved, []) && same(nr.clashes, []) && same(nr.reminders, []), "F. old install: nothing dropped, no new clashes, no reminder moves");
check(same(nr.savedChanges.map(c => c.id).sort(), ["su152", "su179"]), "F. old install: the two saved showcases are listed as changed, nothing else");
const after = OLD.applyScheduleReview(nr, saved);
check(JSON.stringify(after) === savedBefore && JSON.stringify(saved) === savedBefore, "F. APPLY returns the saved ids untouched (same ids, same order)");
check(!!oldStore[OLD.OVERLAY_KEY], "F. APPLY stores an overlay only");
const nn = NOW.scheduleReview(FID, { festivalId: FID, acts: feedActs }, { now: at, saved });
check(nn.upToDate === true, "F. new app against the new feed: up to date");
const carried = { [NOW.OVERLAY_KEY]: oldStore[OLD.OVERLAY_KEY] };
const B4 = boot({ store: carried });
check(!B4.store[B4.OVERLAY_KEY], "F. the old install's overlay is dropped on the new bundle (fingerprint moved)");
check(B4.DS[FID].artists.find(a => a.id === "su179").start === "", "F. and su179 is blank on the new bundle");

console.log(`${failed ? "  ✗" : "  ✓"}  Summerfest time evidence: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
