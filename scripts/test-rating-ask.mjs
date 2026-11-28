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
// Mutants (no gap, web allowed, recap on first visit) must each fail.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const spotify = readFileSync(join(ROOT, 'spotify.jsx'), 'utf8');
const lineup = readFileSync(join(ROOT, 'lineup.jsx'), 'utf8');
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const a = spotify.indexOf('const RATING_ASK_GAP_MS'), endMark = spotify.indexOf('function _maybeAutoRatingPromptOnRecap()');
const b = spotify.indexOf('\n}\n', endMark) + 3;
check(a > 0 && endMark > a && b > endMark, 'found the rating throttle in spotify.jsx');
const block = spotify.slice(a, b);
const DAY = 24 * 3600 * 1000;

function harness(src, native) {
  const store = new Map(), asks = [];
  let now = Date.UTC(2026, 10, 28);
  const ctx = {
    window: { Capacitor: { isNativePlatform: () => native } },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    Date: { now: () => now }, parseInt, String,
    setTimeout: fn => fn(),
    requestRating: async () => { asks.push(now); return { ok: true }; },
  };
  vm.createContext(ctx);
  vm.runInContext(`${src}\n;globalThis.ask = _maybeAskForRating; globalThis.recap = _maybeAutoRatingPromptOnRecap;`, ctx);
  return { ctx, store, asks, advance: d => { now += d * DAY; } };
}

function suite(src, tag = '') {
  const before = failed;
  let h = harness(src, false);
  check(h.ctx.ask('tenth-save') === false && h.asks.length === 0, `${tag}web: never asks`);
  h = harness(src, true);
  check(h.ctx.ask('tenth-save') === true && h.asks.length === 1 && h.store.get('plursky_rating_prompted_reason') === 'tenth-save', `${tag}native, first moment: asks once and records why`);
  h.advance(119);
  check(h.ctx.ask('plus-purchase') === false && h.asks.length === 1, `${tag}a second moment 119 days later: no ask`);
  h.advance(2);
  check(h.ctx.ask('plus-purchase') === true && h.asks.length === 2, `${tag}121 days after the last ask: asks again`);
  h = harness(src, true);
  h.ctx.recap();
  check(h.asks.length === 0, `${tag}Recap 1st visit: no ask`);
  h.ctx.recap();
  check(h.asks.length === 1, `${tag}Recap 2nd visit: asks`);
  return failed - before;
}
suite(block);

check(/if \(!has && !hasConflict && liveNext === 10 && typeof _maybeAskForRating === "function"\) \{\n\s+_maybeAskForRating\("tenth-save"/.test(lineup), 'lineup.jsx toggleSave asks only on a new, clash-free 10th save');
check(/const bought = !!customerInfo\?\.entitlements\?\.active\?\.\[RC_ENTITLEMENT\];\n[^\n]*\n\s+if \(bought\) _maybeAskForRating\("plus-purchase"/.test(spotify), 'the purchase path asks only when the entitlement was granted');
check((spotify.match(/_maybeAskForRating\(/g) || []).length === 3 && (lineup.match(/_maybeAskForRating\(/g) || []).length === 1, 'exactly the known ask sites call the throttle (definition, recap, purchase; 10th save)');

const MUTANTS = [
  ['no gap between asks', 'if (last && Date.now() - last < RATING_ASK_GAP_MS) return false;', ''],
  ['asks on web', 'if (!window.Capacitor?.isNativePlatform?.()) return false;', ''],
  ['Recap asks on its first visit', 'if (visits < 2) return;', ''],
];
let caught = 0;
for (const [name, from, to] of MUTANTS) {
  if (!block.includes(from)) { check(false, `mutant "${name}" no longer applies: update the test`); continue; }
  const [c0, f0] = [checks, failed];
  const log = console.log; console.log = () => {};
  const killed = suite(block.replace(from, to), `[${name}] `) > 0;
  console.log = log; checks = c0; failed = f0;
  check(killed, `mutant "${name}" must fail the suite`);
  if (killed) caught++;
}

if (failed) { console.log(`  ✗ rating asks: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ rating asks: ${checks} checks (native only, one ask per 120 days across recap / 10th save / Plus purchase; ${caught}/${MUTANTS.length} mutants caught)`);
