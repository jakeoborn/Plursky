#!/usr/bin/env node
// A test waiting on the scratch http.server must read each probe's body:
// checking only the status of an awaited fetch leaves the response paused, and when python's
// http.server closes the connection, Node's fetch (undici) can crash with
// `assert(!this.paused)` from a socket event that no try/catch reaches (CI run
// 36089778095). Use serverReady() from scripts/lib/server-ready.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverReady } from './lib/server-ready.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BAD = /\(\s*await\s+fetch\s*\([^;]*?\)\s*\)\s*\.ok\b/;
// The same probe as a promise chain: fetch(...).then(r => r.ok) or
// .then(r => { if (r.ok) ... }), across lines, with no body read before .ok.
// A fetch inside page.evaluate runs in the browser, not Node's undici, so it is
// not this crash.
const BAD_THEN = /\bfetch\s*\([^;]*?\)\s*\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*(?:\{\s*(?:if\s*\(\s*!?\s*)?)?\1\.ok\b/g;
const thenHits = src => [...src.matchAll(BAD_THEN)].map(m => src.slice(0, m.index).split('\n').length)
  .filter(n => !/page\.evaluate\s*\(/.test(src.split('\n')[n - 1]));
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

// Control: the pattern matches the shape that crashed, and not the helper's.
check(BAD.test("try { if ((await fetch(BASE + PAGE)).ok) break; } catch {}"), 'control: the pattern misses the probe that crashed');
check(BAD.test("if((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok)break;"), 'control: the pattern misses the compact form');
check(!BAD.test("const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return true;"), 'control: the pattern flags a probe that reads its body');
check(thenHits("fetch(`http://127.0.0.1:${PORT}/index.html`).then(r => {\n  if (r.ok) resolve(proc); else setTimeout(tick, 100);\n});").length === 1, 'control: the .then pattern misses the multi-line probe (test-import #546)');
check(thenHits("fetch(url).then(r => r.ok)").length === 1, 'control: the .then pattern misses the one-line form');
check(thenHits("fetch(url).then(r => r.arrayBuffer().then(() => r.ok))").length === 0, 'control: the .then pattern flags a probe that reads its body');
check(thenHits("await page.evaluate(p => fetch(p).then(r => r.ok, () => false), plate)").length === 0, 'control: the .then pattern flags a browser-side fetch in page.evaluate');

const files = readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.mjs')).map(f => `scripts/${f}`)
  .concat(readdirSync(path.join(ROOT, 'scripts/lib')).filter(f => f.endsWith('.mjs')).map(f => `scripts/lib/${f}`));
check(files.length > 20, `control: only ${files.length} scripts read`);
for (const f of files.filter(f => f !== 'scripts/test-readiness-probe.mjs')) { // this file holds the bad shape as fixtures
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  const hit = src.split('\n').findIndex(l => BAD.test(l));
  check(hit === -1, `${f}:${hit + 1} checks a fetch status without reading the body; use serverReady() from scripts/lib/server-ready.mjs`);
  for (const n of thenHits(src)) check(false, `${f}:${n} checks a fetch status in .then() without reading the body; use serverReady() from scripts/lib/server-ready.mjs`);
}
// The helper itself gives up (false) on a port nothing listens on.
check(await serverReady('http://127.0.0.1:9/', { tries: 2, delayMs: 10 }) === false, 'serverReady reported a dead port as ready');

if (problems.length) {
  console.log(`  ✗ readiness probe: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log('    ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ readiness probe: ${checks} checks (${files.length} scripts; every server probe reads its body)`);
