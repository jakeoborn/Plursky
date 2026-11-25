#!/usr/bin/env node
// Schedule Watch (Plursky+, #115): the automatic check behind the manual
// "Updates" sheet. Drives data.jsx's pure parts in a vm, the way
// test-schedule-review.mjs does, plus static checks on the runner.
//   1. When it is due: 30 days before opening until the end, at most every
//      30 minutes, and right away when the connection comes back after a
//      failed check (but not after a good one).
//   2. What it alerts on: only a schedule that touches the plan (a saved set
//      changes, or a new clash), once per published schedule. A re-read or a
//      dismissal of the same feed stays quiet, and a newer feed alerts again.
//      Unsaved-only changes and an up-to-date feed never alert. A failed read
//      keeps the last alert key, so a recovery cannot re-alert the same feed.
//   3. The runner is Plus-only and changes nothing by itself: it gates on
//      _isPlusSub before fetching, and its only way to apply is the review sheet.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const DATA = readFileSync(join(ROOT, "data.jsx"), "utf8");
const store = {};
const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const ctx = { window: {}, console, Intl, fetch: () => {}, localStorage: ls };
vm.createContext(ctx);
vm.runInContext(MODS + "\n" + DATA + "\n;__out = { REG: FESTIVALS_REGISTRY, DS: _DATA_SETS, scheduleReview, scheduleWatchDue, " +
  "scheduleWatchDecide, scheduleWatchText, scheduleWatchState, scheduleWatchWrite, EVERY: SCHED_WATCH_EVERY_MS, LEAD: SCHED_WATCH_LEAD_MS };", ctx);
const B = ctx.__out;

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };
const js = v => JSON.stringify(v);

// A live festival whose committed feed has at least two timed acts on one day.
const pick = B.REG.filter(e => e.available).map(e => e.config.id).find(fid => {
  const acts = JSON.parse(readFileSync(join(ROOT, "f", fid, "schedule.json"), "utf8")).acts || [];
  return acts.filter(a => a.start).length >= 2;
});
if (!pick) { console.log("  ✗  no live festival with a timed feed to drive the watch"); process.exit(1); }
const fid = pick, cfg = B.DS[fid].config;
const feed = JSON.parse(readFileSync(join(ROOT, "f", fid, "schedule.json"), "utf8"));
const timed = feed.acts.filter(a => a.start);
const [a0, a1] = timed;
const moved = (feedIn, id, start) => ({ ...feedIn, scheduleHash: undefined,
  acts: feedIn.acts.map(a => (a.id === id ? { ...a, start } : a)) });
const other = s => (s === "11:11" ? "11:12" : "11:11");

// ── 1. Due ──────────────────────────────────────────────────────────────────
{
  const open = cfg.startMs, M = 60000;
  check(!B.scheduleWatchDue(cfg, null, open - B.LEAD - M, false), "due 30+ days before opening");
  check(B.scheduleWatchDue(cfg, null, open - B.LEAD + M, false), "not due inside the 30-day lead with no record");
  check(B.scheduleWatchDue(cfg, null, open, false), "not due at opening with no record");
  check(!B.scheduleWatchDue(cfg, null, cfg.endMs + M, false), "due after the festival ended");
  const ok = { attemptAt: open, checkedAt: open, failedAt: null };
  check(!B.scheduleWatchDue(cfg, ok, open + 29 * M, false), "due again inside 30 minutes");
  check(B.scheduleWatchDue(cfg, ok, open + B.EVERY, false), "not due after 30 minutes");
  check(!B.scheduleWatchDue(cfg, ok, open + M, true), "back-online re-check after a GOOD check (would hammer the feed)");
  const bad = { attemptAt: open, checkedAt: open - 999, failedAt: open };
  check(B.scheduleWatchDue(cfg, bad, open + M, true), "no back-online retry after a failed check");
  check(!B.scheduleWatchDue(cfg, bad, open + M, false), "a failed check skipped the 30-minute wait without the connection event");
  check(!B.scheduleWatchDue({ ...cfg, startMs: null }, null, open, false), "due with no festival dates");
}

// ── 2. Decide ───────────────────────────────────────────────────────────────
{
  const now = cfg.startMs;
  const rv = (f, saved) => B.scheduleReview(fid, f, { saved, now: 0 });
  const cur = B.scheduleWatchDecide(rv(feed, [a0.id]), null, now);
  check(cur.alert === null && cur.rec.checkedAt === now && cur.rec.failedAt === null, `up-to-date feed: ${js(cur)}`);

  const f1 = moved(feed, a0.id, other(a0.start));
  const d1 = B.scheduleWatchDecide(rv(f1, [a0.id]), cur.rec, now + 1);
  check(d1.alert && d1.alert.saved === 1 && d1.alert.key.startsWith(fid + ":"), `saved set moved did not alert: ${js(d1.alert)}`);
  const again = B.scheduleWatchDecide(rv(f1, [a0.id]), d1.rec, now + 2);
  check(again.alert === null, "the same published schedule alerted twice");
  const fail = B.scheduleWatchDecide(null, again.rec, now + 3);
  check(fail.alert === null && fail.rec.failedAt === now + 3 && fail.rec.alertedKey === d1.alert.key, `failed read: ${js(fail.rec)}`);
  const back = B.scheduleWatchDecide(rv(f1, [a0.id]), fail.rec, now + 4);
  check(back.alert === null && back.rec.failedAt === null, "recovery re-alerted the same feed");
  const f2 = moved(f1, a0.id, other(other(a0.start)) === a0.start ? "11:13" : other(other(a0.start)));
  const d2 = B.scheduleWatchDecide(rv(f2, [a0.id]), back.rec, now + 5);
  check(d2.alert && d2.alert.key !== d1.alert.key, `a newer schedule did not alert again: ${js(d2.alert)}`);

  const fu = moved(feed, a1.id, other(a1.start));
  const du = B.scheduleWatchDecide(rv(fu, [a0.id]), null, now);
  check(du.alert === null && du.rec.checkedAt === now, `an unsaved-only change alerted: ${js(du.alert)}`);
  const bad = B.scheduleWatchDecide({ error: "bad-feed" }, null, now);
  check(bad.alert === null && bad.rec.failedAt === now, "a bad feed did not count as a failed check");

  B.scheduleWatchWrite(fid, d1.rec);
  check(js(B.scheduleWatchState()[fid]) === js(d1.rec), "the watch record did not round-trip storage");
}

// ── 3. Text ─────────────────────────────────────────────────────────────────
{
  const one = B.scheduleWatchText({ saved: 1, clashes: 0 }, cfg).body;
  const many = B.scheduleWatchText({ saved: 2, clashes: 3 }, cfg).body;
  check(one === "1 of your saved sets changed. Review before anything changes.".replace("sets", "set"), `singular: ${one}`);
  check(many === "2 of your saved sets changed · 3 new clashes. Review before anything changes.", `plural: ${many}`);
}

// ── 4. Runner: Plus-only, applies nothing itself, mounted once ─────────────
{
  const L = readFileSync(join(ROOT, "lineup.jsx"), "utf8");
  const A = readFileSync(join(ROOT, "app.jsx"), "utf8");
  const s = L.indexOf("function ScheduleWatch("), e = L.indexOf("\n// ── Schedule Sync:", s);
  const body = s >= 0 ? L.slice(s, e) : "";
  const gate = body.indexOf("if (!plus || busy.current) return;"), fetchAt = body.indexOf("fetchScheduleFeed(");
  check(s >= 0, "ScheduleWatch is missing from lineup.jsx");
  check(/_isPlusSub\(\)/.test(body) && gate > 0 && fetchAt > gate, "the runner can fetch without a Plus check first");
  check(!/applyScheduleReview|localStorage\.setItem\(`\$\{fid\}_saved_v1/.test(body), "the runner applies or rewrites the plan by itself");
  check(/<ScheduleReviewSheet /.test(body), "the alert does not open the review sheet");
  check((A.match(/<ScheduleWatch /g) || []).length === 1, "App must mount ScheduleWatch exactly once");
}

if (failed) { console.log(`  ${failed} of ${checks} schedule-watch checks failed`); process.exit(1); }
console.log(`  ✓ schedule watch: ${checks} checks — due window + 30-min throttle + back-online retry, one alert per published schedule that touches the plan, Plus-only runner that applies nothing itself (${fid})`);
