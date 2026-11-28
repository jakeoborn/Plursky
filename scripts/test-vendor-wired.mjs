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
// http://127.0.0.1:<port>/ with index.html, a query string or the root) must,
// for EVERY `<v> = await browser.newContext(...)`, run `await wireVendor(<v>)`
// on that same variable before the next newContext. Counting is done on code
// only: comments and string/template contents are blanked first, so a comment
// or a string that mentions wireVendor wires nothing. A newContext whose
// result is not assigned to a variable cannot be paired and fails.
// A gate that never loads index.html (setContent, a static page) is out of scope.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'scripts');
const BOOTS_APP = /127\.0\.0\.1:\$\{\w+\}\/(?:index\.html|\?|`)/;

// Blank comments and the contents of strings, templates and regex literals
// (same length, newlines kept), leaving ${...} expressions inside templates as
// code. A `/` starts a regex literal when the previous code character cannot
// end an expression.
export function codeOnly(src) {
  const out = src.split('');
  const blank = (i) => { if (out[i] !== '\n') out[i] = ' '; };
  const stack = []; // template nesting: each entry counts open braces inside ${...}
  let i = 0, prev = '';
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (stack.length && stack[stack.length - 1] === 0 && c === '}') { stack.pop(); i++; i = template(i); continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') blank(i++); continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; while (i < end) blank(i++); continue; }
    if (c === '"' || c === "'") { i++; while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') blank(i++); blank(i++); } i++; prev = 'x'; continue; }
    if (c === '`') { i = template(i + 1); continue; }
    if (c === '/' && !/[\w$)\].]/.test(prev)) {
      i++; let cls = false;
      while (i < src.length && src[i] !== '\n') { const d = src[i]; if (d === '\\') { blank(i++); blank(i++); continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; blank(i++); }
      i++; prev = 'x'; continue;
    }
    if (stack.length) { if (c === '{') stack[stack.length - 1]++; else if (c === '}') stack[stack.length - 1]--; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
  // Inside a template from i: blank text until the closing backtick or a ${.
  function template(j) {
    while (j < src.length) {
      if (src[j] === '\\') { blank(j++); blank(j++); continue; }
      if (src[j] === '`') { prev = 'x'; return j + 1; }
      if (src[j] === '$' && src[j + 1] === '{') { stack.push(0); prev = '{'; return j + 2; }
      blank(j++);
    }
    return j;
  }
}

// Pair each newContext with an awaited wireVendor on the same variable,
// between it and the next newContext. Returns the problems found.
export function pairing(code) {
  const problems = [];
  const all = [...code.matchAll(/browser\.newContext\(/g)].map((m) => m.index);
  const assigned = [...code.matchAll(/(?:\b(?:const|let|var)\s+)?\b([A-Za-z_$][\w$]*)\s*=\s*await\s+browser\.newContext\(/g)]
    .map((m) => ({ v: m[1], at: m.index + m[0].length }));
  if (assigned.length !== all.length) problems.push(`${all.length - assigned.length} newContext( call(s) not assigned to a variable, so they cannot be paired with wireVendor`);
  assigned.forEach((a, k) => {
    // a.at is the end of this context's own `browser.newContext(`, so the
    // window closes at the first newContext that starts after it.
    const end = all.find((x) => x >= a.at) ?? code.length;
    const span = code.slice(a.at, end);
    const re = new RegExp(`\\bawait\\s+wireVendor\\(\\s*${a.v.replace(/\$/g, '\\$')}\\s*[,)]`);
    if (!re.test(span)) problems.push(`context ${k + 1} (${a.v}) has no \`await wireVendor(${a.v})\` before the next newContext`);
  });
  return problems;
}

export function audit(files) {
  const bad = [], wired = [];
  for (const [name, src] of files) {
    if (name === 'test-vendor-wired.mjs' || !BOOTS_APP.test(src)) continue;
    const code = codeOnly(src);
    if (!/browser\.newContext\(/.test(code)) continue;
    const problems = pairing(code);
    if (problems.length) bad.push(`${name}: ${problems.join('; ')}`); else wired.push(name);
  }
  return { bad, wired };
}

const files = readdirSync(DIR).filter((f) => /^test-.*\.mjs$/.test(f)).map((f) => [f, readFileSync(join(DIR, f), 'utf8')]);
const { bad, wired } = audit(files);

// Controls: each must come out as stated, or a pass below means nothing.
const GOTO = "await page.goto(`http://127.0.0.1:${PORT}/index.html`);\n";
const CONTROLS = [
  ['an unwired app gate is flagged', 'bad', "const ctx = await browser.newContext({});\n" + GOTO],
  ['a setContent gate is skipped', 'skip', "const ctx = await browser.newContext({});\nawait page.setContent(html);"],
  ['wiring that is only a comment is flagged', 'bad', "const ctx = await browser.newContext({});\n// await wireVendor(ctx);\n/* await wireVendor(ctx) */\n" + GOTO],
  ['wiring that is only a string is flagged', 'bad', "const ctx = await browser.newContext({});\nconst s = 'await wireVendor(ctx)'; const t = `await wireVendor(ctx)`;\n" + GOTO],
  ['context 1 wired twice and context 2 unwired is flagged', 'bad', "const a = await browser.newContext({});\nawait wireVendor(a);\nawait wireVendor(a);\nconst b = await browser.newContext({});\n" + GOTO],
  ['wiring the wrong variable is flagged', 'bad', "const a = await browser.newContext({});\nawait wireVendor(other);\n" + GOTO],
  ['an unassigned newContext is flagged', 'bad', "await wireVendor(ctx);\n(await browser.newContext({})).newPage();\n" + GOTO],
  ['context A used unwired, then B created, then both wired is flagged', 'bad', "const a = await browser.newContext({});\nconst pa = await a.newPage();\n" + GOTO + "const b = await browser.newContext({});\nawait wireVendor(a);\nawait wireVendor(b);\n"],
  ['three contexts each wired pass', 'ok', "const a = await browser.newContext({});\nawait wireVendor(a);\nconst b = await browser.newContext({});\nawait wireVendor(b);\nconst c = await browser.newContext({});\nawait wireVendor(c);\n" + GOTO],
  ['two contexts each wired pass', 'ok', "const a = await browser.newContext({ x: 1 });\nawait wireVendor(a);\nconst b=await browser.newContext({});\nawait wireVendor(b); // done\n" + GOTO],
  ['a regex literal with // does not hide code', 'ok', "const r = /https:\\/\\//; const ctx = await browser.newContext({});\nawait wireVendor(ctx);\n" + GOTO],
];
const ctlFails = [];
for (const [label, want, src] of CONTROLS) {
  const r = audit([['ctl.mjs', src]]);
  const got = r.bad.length ? 'bad' : r.wired.length ? 'ok' : 'skip';
  if (got !== want) ctlFails.push(`${label} (want ${want}, got ${got})`);
}
if (ctlFails.length) {
  console.log(`✗ vendor wired: ${ctlFails.length} detector control(s) failed:`);
  for (const c of ctlFails) console.log(`  ✗ ${c}`);
  process.exit(1);
}
if (bad.length) {
  console.log(`✗ vendor wired: ${bad.length} browser gate(s) load the app's CDN scripts live. Add \`await wireVendor(ctx)\` after each newContext (import from ./lib/vendor-cdn.mjs):`);
  for (const b of bad) console.log(`  ✗ ${b}`);
  process.exit(1);
}
console.log(`  ✓ vendor wired: ${wired.length} app-booting browser gates wire every context to scripts/vendor/ (${CONTROLS.length} detector controls passed)`);
