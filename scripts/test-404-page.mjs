#!/usr/bin/env node
// Gate for 404.html, the page GitHub Pages serves at every missing path.
//   1. noindex, and never listed in any sitemap.
//   2. Every link and asset is root-absolute or https, because the page is
//      served at whatever path was missing (/f/x/y/ would break "artists/").
//   3. Every internal target exists in the repo.
//   4. It carries the Smart App Banner and an App Store link.
// Mutants (relative asset, dead target, indexable, no banner) must each fail.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

function problems(html) {
  const out = [];
  if (!/<meta name="robots" content="noindex">/.test(html)) out.push('not noindex');
  if (!html.includes('<meta name="apple-itunes-app" content="app-id=6768888507">')) out.push('no Smart App Banner');
  if (!html.includes('https://apps.apple.com/us/app/plursky-live/id6768888507')) out.push('no App Store link');
  const refs = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map(m => m[1]);
  if (refs.length < 8) out.push(`only ${refs.length} links found (the scan broke?)`);
  for (const r of refs) {
    if (/^https:\/\//.test(r)) continue;
    if (!r.startsWith('/')) { out.push(`"${r}" is relative`); continue; }
    const p = r.split('#')[0].split('?')[0];
    const file = p.endsWith('/') ? join(ROOT, p, 'index.html') : join(ROOT, p);
    if (!existsSync(file)) out.push(`"${r}" has no file in the repo`);
  }
  return out;
}

const html = readFileSync(join(ROOT, '404.html'), 'utf8');
for (const p of problems(html)) check(false, `404.html: ${p}`);
check(true, '404.html scanned');
for (const sm of ['sitemap.xml', 'sitemap-artists.xml', 'sitemap-genres.xml']) {
  const f = join(ROOT, sm);
  check(!existsSync(f) || !readFileSync(f, 'utf8').includes('/404.html'), `${sm} does not list 404.html`);
}

const MUTANTS = [
  ['a relative stylesheet', h => h.replace('href="/artists/artists.css"', 'href="artists/artists.css"')],
  ['a dead link', h => h.replace('href="/genres/"', 'href="/genre/"')],
  ['indexable', h => h.replace('<meta name="robots" content="noindex">\n', '')],
  ['no banner', h => h.replace(/<meta name="apple-itunes-app"[^>]*>\n/, '')],
];
let caught = 0;
for (const [name, mut] of MUTANTS) {
  const m = mut(html);
  if (m === html) { check(false, `mutant "${name}" no longer applies: update the test`); continue; }
  const killed = problems(m).length > 0;
  check(killed, `mutant "${name}" must fail`);
  if (killed) caught++;
}

if (failed) { console.log(`  ✗ 404 page: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ 404 page: ${checks} checks (noindex, root-absolute links that all resolve, banner + App Store link; ${caught}/${MUTANTS.length} mutants caught)`);
