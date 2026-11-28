#!/usr/bin/env node
// Gate for the App Store rating asks (spotify.jsx _maybeAskForRating).
//
// Plursky had 0 App Store ratings on 2026-11-28 with one ask: a 2nd Recap
// visit. It now also asks on the 10th saved set and after a Plus purchase.
// Every ask goes through one throttle, run here from the real source:
//   1. never on web;
//   2. at most one app-side ask per RATING_ASK_GAP_MS (120 days);
//   3. Recap asks only from its 2nd visit;
//   4. the two new call sites are guarded (a new save, no clash, exactly the
//      10th; a purchase that granted the entitlement).
// 5. the automatic ask is the native sheet or nothing: no App Store fallback,
//    no throttle spent when the plugin is absent, given back when it rejects.
// Mutants (no gap, web allowed, recap on first visit, store fallback, kept
// throttle, no plugin check) must each fail.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const spotify = readFileSync(join(ROOT, 'spotify.jsx'), 'utf8');
const lineup = readFileSync(join(ROOT, 'lineup.jsx'), 'utf8');
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const a = spotify.indexOf('async function requestRating()'), endMark = spotify.indexOf('function _maybeAutoRatingPromptOnRecap()');
const b = spotify.indexOf('\n}\n', endMark) + 3;
check(a > 0 && endMark > a && b > endMark, 'found requestRating and the rating throttle in spotify.jsx');
const block = spotify.slice(a, b);
const DAY = 24 * 3600 * 1000;

// plugin: 'ok' (the review sheet resolves), 'absent' (no InAppReview), 'reject'.
// The REAL requestRating is in the block, with window.open recorded, so a path
// that reaches its App Store fallback shows up as an opened tab.
function harness(src, native, plugin = 'ok') {
  const store = new Map(), asks = [], opened = [], timers = [];
  let now = Date.UTC(2026, 10, 28);
  const InAppReview = plugin === 'absent' ? undefined : {
    requestReview: async () => { asks.push(now); if (plugin === 'reject') throw new Error('review unavailable'); },
  };
  const ctx = {
    window: { Capacitor: { isNativePlatform: () => native, Plugins: { InAppReview } }, open: (u) => { opened.push(u); return {}; } },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    Date: { now: () => now }, parseInt, String, Promise,
    setTimeout: fn => { timers.push(fn); },
    _appStoreUrl: () => 'https://apps.apple.com/app/id6768888507',
  };
  vm.createContext(ctx);
  vm.runInContext(`${src}\n;globalThis.ask = _maybeAskForRating; globalThis.recap = _maybeAutoRatingPromptOnRecap; globalThis.manual = requestRating;`, ctx);
  const flush = async () => { while (timers.length) timers.shift()(); for (let i = 0; i < 10; i++) await null; };
  return { ctx, store, asks, opened, flush, advance: d => { now += d * DAY; } };
}

async function suite(src, tag = '') {
  const before = failed;
  let h = harness(src, false);
  check(h.ctx.ask('tenth-save') === false && (await h.flush(), h.asks.length === 0 && h.opened.length === 0), `${tag}web: never asks`);
  h = harness(src, true);
  const r1 = h.ctx.ask('tenth-save'); await h.flush();
  check(r1 === true && h.asks.length === 1 && h.store.get('plursky_rating_prompted_reason') === 'tenth-save', `${tag}native, first moment: asks once and records why`);
  h.advance(119);
  check(h.ctx.ask('plus-purchase') === false && (await h.flush(), h.asks.length === 1), `${tag}a second moment 119 days later: no ask`);
  h.advance(2);
  check(h.ctx.ask('plus-purchase') === true && (await h.flush(), h.asks.length === 2), `${tag}121 days after the last ask: asks again`);
  h = harness(src, true);
  h.ctx.recap(); await h.flush();
  check(h.asks.length === 0, `${tag}Recap 1st visit: no ask`);
  h.ctx.recap(); await h.flush();
  check(h.asks.length === 1, `${tag}Recap 2nd visit: asks`);
  // Lane III's defect (2026-11-28): plugin absent or rejecting must not open
  // the App Store and must not spend the 120-day throttle.
  h = harness(src, true, 'absent');
  const r2 = h.ctx.ask('plus-purchase'); await h.flush();
  check(r2 === false && h.opened.length === 0 && !h.store.has('plursky_rating_prompted_at'), `${tag}plugin absent: no ask, no App Store tab, throttle untouched (got ret=${r2} opened=${h.opened.length})`);
  h.ctx.recap(); h.ctx.recap(); await h.flush();
  check(h.opened.length === 0 && !h.store.has('plursky_rating_prompted_at'), `${tag}plugin absent: Recap opens no App Store tab either`);
  h = harness(src, true, 'reject');
  h.store.set('plursky_rating_prompted_reason', 'recap');
  const r3 = h.ctx.ask('tenth-save'); await h.flush();
  check(r3 === true && h.asks.length === 1 && h.opened.length === 0 && !h.store.has('plursky_rating_prompted_at') && h.store.get('plursky_rating_prompted_reason') === 'recap',
    `${tag}plugin rejects: no App Store tab, throttle and reason given back (got opened=${h.opened.length} at=${h.store.get('plursky_rating_prompted_at')})`);
  const r4 = h.ctx.ask('plus-purchase'); await h.flush();
  check(r4 === true && h.asks.length === 2, `${tag}after a rejected ask the next moment may ask again`);
  // The manual "Rate" tap keeps its App Store fallback (unchanged).
  h = harness(src, true, 'absent');
  const m = await h.ctx.manual();
  check(m.source === 'web' && h.opened.length === 1, `${tag}manual requestRating with no plugin still opens the App Store (unchanged)`);
  return failed - before;
}
await suite(block);

check(/if \(!has && !hasConflict && liveNext === 10 && typeof _maybeAskForRating === "function"\) \{\n\s+_maybeAskForRating\("tenth-save"/.test(lineup), 'lineup.jsx toggleSave asks only on a new, clash-free 10th save');
check(/const bought = !!customerInfo\?\.entitlements\?\.active\?\.\[RC_ENTITLEMENT\];\n[^\n]*\n\s+if \(bought\) _maybeAskForRating\("plus-purchase"/.test(spotify), 'the purchase path asks only when the entitlement was granted');
check((spotify.match(/_maybeAskForRating\(/g) || []).length === 3 && (lineup.match(/_maybeAskForRating\(/g) || []).length === 1, 'exactly the known ask sites call the throttle (definition, recap, purchase; 10th save)');

const MUTANTS = [
  ['automatic ask falls back to requestRating', 'Promise.resolve().then(() => plugin.requestReview()).catch(giveBack)', 'requestRating().catch(giveBack)'],
  ['rejected ask keeps the throttle', '.catch(giveBack); }, delayMs);', '.catch(() => {}); }, delayMs);'],
  ['plugin check dropped', '    if (!plugin) return false;\n', ''],
  ['no gap between asks', 'if (last && Date.now() - last < RATING_ASK_GAP_MS) return false;', ''],
  ['asks on web', 'return window.Capacitor?.isNativePlatform?.() && typeof', 'return typeof'],
  ['Recap asks on its first visit', 'if (visits < 2) return;', ''],
];
let caught = 0;
for (const [name, from, to] of MUTANTS) {
  if (!block.includes(from)) { check(false, `mutant "${name}" no longer applies: update the test`); continue; }
  const [c0, f0] = [checks, failed];
  const log = console.log; console.log = () => {};
  const killed = (await suite(block.replace(from, to), `[${name}] `)) > 0;
  console.log = log; checks = c0; failed = f0;
  check(killed, `mutant "${name}" must fail the suite`);
  if (killed) caught++;
}

if (failed) { console.log(`  ✗ rating asks: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ rating asks: ${checks} checks (native only, one ask per 120 days across recap / 10th save / Plus purchase; ${caught}/${MUTANTS.length} mutants caught)`);
