#!/usr/bin/env node
// Self-test for scripts/lib/retry-once.mjs, the Today print hero retry (f4).
//
// The retry must stay a flake fix, never a loosening:
//   1. a timeout then a pass  -> ok, 2 attempts, one onRetry, page reset once;
//   2. a timeout twice        -> NOT ok (the run fails), 2 attempts;
//   3. any other throw        -> NOT ok on the first attempt, no retry;
//   4. a timeout, then a different throw -> NOT ok;
//   5. a clean pass           -> ok, 1 attempt, no reset.
// Plus static pins on test-today-print.mjs: the hero loop goes through runOnce,
// a failed result is a check(false), and the floor still wants every hero
// measured (heroesSeen === heroRuns === acts.length * 4).
// Mutants of the helper (retry twice, retry anything, swallow the last error)
// must each fail this suite.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'scripts/lib/retry-once.mjs');

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const timeout = () => Object.assign(new Error('page.waitForSelector: Timeout 30000ms exceeded.'), { name: 'TimeoutError' });
const gotoTimeout = () => new Error('page.goto: Timeout 30000ms exceeded.\nCall log: ...');
const other = () => new Error('Cannot read properties of null');

async function suite(mod, tag = '') {
  const before = failed;
  const { runOnce, isTimeout } = mod;
  const run = async (script) => {
    let i = 0, retries = 0, resets = 0;
    const res = await runOnce(async () => { const step = script[i++]; if (step) throw step(); },
      { onRetry: () => { retries++; }, onReset: async () => { resets++; } });
    return { ...res, calls: i, retries, resets };
  };
  let r = await run([timeout]);
  check(r.ok && r.attempts === 2 && r.retries === 1 && r.resets === 1, `${tag}timeout then pass: ok after one retry (got ok=${r.ok} attempts=${r.attempts} retries=${r.retries} resets=${r.resets})`);
  r = await run([gotoTimeout]);
  check(r.ok && r.attempts === 2, `${tag}a page.goto timeout is a timeout too (got ok=${r.ok})`);
  r = await run([timeout, timeout]);
  check(!r.ok && r.attempts === 2 && r.calls === 2 && r.retries === 1, `${tag}two timeouts: the hero FAILS after exactly one retry (got ok=${r.ok} attempts=${r.attempts} calls=${r.calls})`);
  r = await run([other]);
  check(!r.ok && r.attempts === 1 && r.calls === 1 && r.retries === 0, `${tag}a non-timeout throw fails at once, no retry (got ok=${r.ok} calls=${r.calls})`);
  r = await run([timeout, other]);
  check(!r.ok && r.calls === 2 && /null/.test(String(r.err?.message)), `${tag}timeout then another throw: fails with the second error (got ok=${r.ok})`);
  r = await run([]);
  check(r.ok && r.attempts === 1 && r.resets === 0 && r.retries === 0, `${tag}a clean pass: one attempt, no reset (got attempts=${r.attempts} resets=${r.resets})`);
  check(isTimeout(timeout()) && isTimeout(gotoTimeout()) && !isTimeout(other()) && !isTimeout(null), `${tag}isTimeout tells a timeout from anything else`);
  // Only Playwright's own timeouts: wording that merely mentions one is another failure.
  check(!isTimeout(new Error('fetch: Timeout 5000ms exceeded.')) && !isTimeout(new Error('waiting failed: Timeout 30000ms exceeded.'))
    && !isTimeout(new Error('a Timeout 30000ms exceeded. somewhere')) && isTimeout(new Error('locator.click: Timeout 5000ms exceeded.')),
    `${tag}isTimeout accepts only a named TimeoutError or Playwright's "<api>.<call>: Timeout Nms exceeded." shape`);
  // Lane III's repro: open() creates a context, then page.goto times out before it returns.
  // The context must be closed before the retry boots a fresh one: 2 created, 2 closed.
  const { ownedContext } = mod;
  const browser = { made: 0, closed: 0, newContext: async () => { browser.made++; let shut = false; return { close: async () => { if (!shut) { shut = true; browser.closed++; } } }; } };
  let booted = null, attempt = 0;
  const open = () => ownedContext(() => browser.newContext(), async ctx => { if (attempt++ === 0) throw gotoTimeout(); return { ctx }; });
  r = await runOnce(async () => { if (!booted) booted = await open(); },
    { onReset: async () => { await booted?.ctx.close().catch(() => {}); booted = null; } });
  await booted?.ctx.close();
  check(r.ok && browser.made === 2 && browser.closed === 2, `${tag}a timeout inside open() closes its context before the retry (got ok=${r.ok} made=${browser.made} closed=${browser.closed})`);
  const kept = { made: 0, closed: 0 };
  const ok2 = await ownedContext(async () => { kept.made++; return { close: async () => { kept.closed++; } }; }, async ctx => ctx);
  check(kept.made === 1 && kept.closed === 0 && ok2, `${tag}a setup that returns hands the context over open (got closed=${kept.closed})`);
  return failed - before;
}

const real = await import(pathToFileURL(LIB).href);
await suite(real);

// Static pins on the gate that uses it.
const gate = readFileSync(join(ROOT, 'scripts/test-today-print.mjs'), 'utf8');
check(/import \{ runOnce, ownedContext \} from '\.\/lib\/retry-once\.mjs'/.test(gate), 'test-today-print imports runOnce and ownedContext');
check(/const res = await runOnce\(async \(\) => \{\n(?:[^\n]*TP_HERO_FAULT[^\n]*\n)?\s+if \(!booted\)/.test(gate), 'the hero render runs inside runOnce');
check(!readFileSync(join(ROOT, 'scripts/verify.mjs'), 'utf8').includes('TP_HERO_FAULT') && /process\.env\.TP_HERO_FAULT \|\| ''/.test(gate), 'the TP_HERO_FAULT seam is off unless set by hand (verify never sets it)');
check(/if \(!res\.ok\) check\(false, `\$\{tag\} threw/.test(gate), 'a hero that still fails is a failed check');
check(gate.includes('heroRuns === acts.length * 4 && heroesSeen === heroRuns'), 'the floor still requires every hero measured');
check(/const open = async \([^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*return ownedContext\(\(\) => browser\.newContext\(/.test(gate), 'open() creates its context through ownedContext, so a throw inside closes it');
check(!/runOnce\([^)]*\{\s*retries:/.test(gate) && (gate.match(/runOnce\(/g) || []).length === 1, 'runOnce is used once, for heroes only');

// Mutants of the helper: each must fail the suite.
const src = readFileSync(LIB, 'utf8');
const MUTANTS = [
  ['retry twice', [['attempt < 2;', 'attempt < 3;'], ['if (attempt === 0 && isTimeout(err))', 'if (attempt < 2 && isTimeout(err))']]],
  ['retry any throw', 'if (attempt === 0 && isTimeout(err))', 'if (attempt === 0)'],
  ['swallow the last error', "return { ok: false, err, attempts: attempt + 1 };", "return { ok: true, attempts: attempt + 1 };"],
  ['no reset before retry', '      await onReset(err);\n', ''],
  ['open() leaks its context', '    await ctx.close().catch(() => {});\n    throw err;', '    throw err;'],
  ['any timeout wording retries', "return PLAYWRIGHT_TIMEOUT.test(String(err.message || ''));", "return /\\bTimeout \\d+ms exceeded\\b/.test(String(err.message || ''));"],
];
const dir = mkdtempSync(join(tmpdir(), 'retry-once-'));
let caught = 0;
try {
  for (const [name, a, b] of MUTANTS) {
    const edits = Array.isArray(a) ? a : [[a, b]];
    if (!edits.every(([from]) => src.includes(from))) { check(false, `mutant "${name}" no longer applies: update the test`); continue; }
    const f = join(dir, `${name.replace(/\W+/g, '-')}.mjs`);
    writeFileSync(f, edits.reduce((t, [from, to]) => t.replace(from, to), src));
    const [c0, f0] = [checks, failed];
    const log = console.log; console.log = () => {};
    const killed = await suite(await import(pathToFileURL(f).href), `[${name}] `) > 0;
    console.log = log; checks = c0; failed = f0;
    check(killed, `mutant "${name}" must fail the suite`);
    if (killed) caught++;
  }
} finally { rmSync(dir, { recursive: true, force: true }); }

if (failed) { console.log(`✗ retry-once: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ retry-once: ${checks} checks (a timed-out hero gets one retry, a second timeout or any other throw fails, every hero still required; ${caught}/${MUTANTS.length} mutants caught)`);
