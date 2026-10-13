#!/usr/bin/env node
// The PR-facing `gen-festival-pages.mjs --check` must catch a stale homepage,
// terms or privacy row: those fingerprints come from committed files only, so
// no calendar can move them and only the PR that moved them can fix them.
//
// The failure it guards: a cache-bust edits index.html's ?v= strings, which
// moves the homepage fingerprint. Plain --check skipped sitemap-lastmod.json
// and normalised every <lastmod> away, so the PR passed verify and the
// scheduled --check-strict job went red on main after the merge (#258's
// v376 restack, 2026-09-29).
//
// Each case runs the real generator in a scratch copy of the tracked tree, so
// nothing in the checkout is touched. Controls prove the calendar-owned
// festival rows are still tolerated by plain --check.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
const fails = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'plursky-sitemap-'));
  for (const f of files) {
    mkdirSync(path.join(dir, path.dirname(f)), { recursive: true });
    try { cpSync(path.join(ROOT, f), path.join(dir, f)); } catch {}   // a tracked file deleted in the worktree
  }
  return dir;
}
const gen = (dir, ...args) => {
  const r = spawnSync(process.execPath, ['scripts/gen-festival-pages.mjs', ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const edit = (dir, rel, fn) => writeFileSync(path.join(dir, rel), fn(readFileSync(path.join(dir, rel), 'utf8')));
const ledger = dir => JSON.parse(readFileSync(path.join(dir, 'sitemap-lastmod.json'), 'utf8'));
const ORIGIN = 'https://plursky.com';

const cases = [
  ['the tree as committed', () => {}, 0, null],
  ['index.html cache-bust without regenerating', dir => edit(dir, 'index.html', t => {
      const n = t.replace(/\?v=v\d+/g, '?v=v999');
      if (n === t) throw new Error('fixture: index.html has no ?v= string to bump');
      return n;
    }), 1, /sitemap-lastmod\.json \(\/: fingerprint/],
  ['terms.html edited without regenerating', dir => edit(dir, 'terms.html', t => t + '\n<!-- edited -->\n'), 1, /sitemap-lastmod\.json \(\/terms\.html:/],
  ['privacy.html edited without regenerating', dir => edit(dir, 'privacy.html', t => t + '\n<!-- edited -->\n'), 1, /sitemap-lastmod\.json \(\/privacy\.html:/],
  ['homepage <lastmod> in sitemap.xml hand-edited', dir => edit(dir, 'sitemap.xml', t =>
      t.replace(new RegExp(`(<loc>${ORIGIN}/</loc>\\s*<lastmod>)[^<]*`), '$12000-01-01')), 1, /sitemap\.xml \(\/: <lastmod> 2000-01-01/],
  ['homepage ledger date hand-edited', dir => edit(dir, 'sitemap-lastmod.json', t => {
      const j = JSON.parse(t); j[`${ORIGIN}/`].lastmod = '2000-01-01'; return JSON.stringify(j, null, 2) + '\n';
    }), 1, /sitemap\.xml \(\/: <lastmod> \d{4}-\d\d-\d\d, should be 2000-01-01/],
  // Controls: the calendar-owned festival rows stay strict-only.
  ['control: a festival <lastmod> in sitemap.xml differs', dir => edit(dir, 'sitemap.xml', t =>
      t.replace(/(<loc>[^<]*\/f\/[^<]*<\/loc>\s*<lastmod>)[^<]*/, '$12000-01-01')), 0, null],
  ['control: a festival ledger row differs', dir => edit(dir, 'sitemap-lastmod.json', t => {
      const j = JSON.parse(t); const k = Object.keys(j).find(x => x.includes('/f/'));
      j[k] = { fp: '0000000000000000', lastmod: '2000-01-01' }; return JSON.stringify(j, null, 2) + '\n';
    }), 0, null],
];

for (const [label, mutate, want, pattern] of cases) {
  const dir = fixture();
  try {
    mutate(dir);
    const r = gen(dir, '--check');
    ok(r.code === want, `${label}: --check exited ${r.code}, want ${want}\n${r.out.trim()}`);
    if (pattern) ok(pattern.test(r.out), `${label}: --check did not name the stale row (${pattern})\n${r.out.trim()}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Regenerating a cache-bust fixes it: only the homepage row moves, and every
// other published date is preserved.
{
  const dir = fixture();
  try {
    const before = ledger(dir);
    edit(dir, 'index.html', t => t.replace(/\?v=v\d+/g, '?v=v999'));
    const g = gen(dir);
    ok(g.code === 0, `regenerate after a cache-bust failed:\n${g.out.trim()}`);
    const after = ledger(dir);
    const moved = Object.keys(after).filter(k => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    ok(moved.length === 1 && moved[0] === `${ORIGIN}/`, `a cache-bust regenerate moved ${JSON.stringify(moved)}, want only the homepage row`);
    ok(after[`${ORIGIN}/`].fp !== before[`${ORIGIN}/`].fp, 'the homepage fingerprint did not move with the cache-bust');
    const r = gen(dir, '--check');
    ok(r.code === 0, `--check after regenerating still fails:\n${r.out.trim()}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`);
  console.error(`  ${fails.length} of ${checks} sitemap commit-row checks failed`);
  process.exit(1);
}
console.log(`  ✓ sitemap commit rows: plain --check catches a stale homepage/terms/privacy fingerprint or <lastmod>, festival rows stay strict-only, a regenerate moves only the homepage row, ${checks} checks`);
