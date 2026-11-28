#!/usr/bin/env node
// Every browser gate that boots the real app serves React, ReactDOM and
// supabase from scripts/vendor/ (wireVendor), never the live CDN.
//
// Why: index.html pins those scripts to unpkg/jsdelivr. A gate that lets them
// load live depends on the network and the CDN's latency, so under load it
// fails with "ReactDOM is not defined" and passes alone (f16, Season Pass
// rescue, 2026-11-28). wireVendor serves the vendored copies, SRI-checked
// against the same pins, so a gate exercises our code and nothing else.
//
// Rule: a scripts/test-*.mjs that opens the local app (a goto to
// http://127.0.0.1:<port>/ with index.html, a query string or the root) must
// call wireVendor( at least once per browser.newContext( call.
// A gate that never loads index.html (setContent, a static page) is out of scope.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'scripts');
const BOOTS_APP = /127\.0\.0\.1:\$\{\w+\}\/(?:index\.html|\?|`)/;
const count = (s, re) => (s.match(re) || []).length;

export function audit(files) {
  const bad = [], wired = [];
  for (const [name, src] of files) {
    if (name === 'test-vendor-wired.mjs' || !BOOTS_APP.test(src)) continue;
    const ctxs = count(src, /browser\.newContext\(/g), wires = count(src, /\bwireVendor\(/g);
    if (!ctxs) continue;
    if (wires < ctxs) bad.push(`${name}: ${ctxs} browser context(s), ${wires} wireVendor call(s)`);
    else wired.push(name);
  }
  return { bad, wired };
}

const files = readdirSync(DIR).filter((f) => /^test-.*\.mjs$/.test(f)).map((f) => [f, readFileSync(join(DIR, f), 'utf8')]);
const { bad, wired } = audit(files);

// Controls: the rule must fire on an unwired app gate and stay quiet on a
// setContent-only gate, or a pass below means nothing.
const neg = audit([['x.mjs', "const ctx = await browser.newContext({});\nawait page.goto(`http://127.0.0.1:${PORT}/index.html`);"]]);
const out = audit([['y.mjs', "const ctx = await browser.newContext({});\nawait page.setContent(html);"]]);
const ctl = neg.bad.length === 1 && out.bad.length === 0 && out.wired.length === 0;

if (!ctl) { console.log('✗ vendor wired: the detector controls failed (it no longer tells an unwired app gate from a static one)'); process.exit(1); }
if (bad.length) {
  console.log(`✗ vendor wired: ${bad.length} browser gate(s) load the app's CDN scripts live. Add \`await wireVendor(ctx)\` after each newContext (import from ./lib/vendor-cdn.mjs):`);
  for (const b of bad) console.log(`  ✗ ${b}`);
  process.exit(1);
}
console.log(`  ✓ vendor wired: ${wired.length} app-booting browser gates serve React/ReactDOM/supabase from scripts/vendor/ (2 detector controls passed)`);
