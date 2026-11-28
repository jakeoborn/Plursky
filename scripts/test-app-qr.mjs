#!/usr/bin/env node
// Gate for the desktop App Store QR on festival pages.
//   1. app-qr.svg is the exact file that was decoded (jsQR, at full size and
//      at the 112 px it renders) to https://apps.apple.com/us/app/plursky-live/id6768888507.
//      A QR that does not scan is worse than none, so the bytes are pinned:
//      regenerate it, decode it again, then update APP_QR_SHA256.
//   2. Every generated festival page carries exactly one figure.appqr inside
//      its "Get the app" section, pointing at /app-qr.svg with alt text.
//   3. The figure is hidden by default and shown only to a fine pointer that
//      can hover on a wide screen: a phone already has the App Store link.
// Mutants (no figure, figure shown by default, phone-visible query, wrong
// image) must each fail.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_QR_SHA256 = '4d1159ebd6b7a08af8266ee0f1d9b35477ab13118c6505a7e395e7ad047d756f';
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const FIG = '<figure class="appqr"><img src="/app-qr.svg"';
function problems(html) {
  const out = [];
  const figs = html.split('<figure class="appqr">').length - 1;
  if (figs !== 1) out.push(`${figs} appqr figures, want 1`);
  const app = html.indexOf('<section aria-labelledby="app-h">');
  const at = html.indexOf(FIG);
  const end = app < 0 ? -1 : html.indexOf('</section>', app);
  if (at < 0) out.push('no appqr figure pointing at /app-qr.svg');
  else if (!(app >= 0 && at > app && at < end)) out.push('appqr figure is outside the Get the app section');
  if (at >= 0 && !/<figure class="appqr"><img [^>]*alt="[^"]{8,}"/.test(html)) out.push('appqr image has no alt text');
  if (!/figure\.appqr \{ display:none;/.test(html)) out.push('appqr is not hidden by default');
  const shows = [...html.matchAll(/@media ([^{]*)\{ figure\.appqr \{ display:flex; \} \}/g)].map(m => m[1]);
  if (shows.length !== 1) out.push(`${shows.length} rules show appqr, want 1`);
  else if (!(/\(hover:hover\)/.test(shows[0]) && /\(pointer:fine\)/.test(shows[0]))) out.push(`appqr shows under "${shows[0].trim()}", not only for a hovering fine pointer`);
  return out;
}

const svgPath = join(ROOT, 'app-qr.svg');
check(existsSync(svgPath), 'app-qr.svg exists');
if (existsSync(svgPath)) {
  const svg = readFileSync(svgPath);
  check(createHash('sha256').update(svg).digest('hex') === APP_QR_SHA256, 'app-qr.svg is the decoded file (sha256 pinned; re-decode before changing it)');
}

const dir = join(ROOT, 'f');
const pages = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(dir, d.name, 'index.html'))).map(d => d.name);
check(pages.length >= 50, `found ${pages.length} festival pages (the scan broke?)`);
let clean = 0;
for (const id of pages) {
  const ps = problems(readFileSync(join(dir, id, 'index.html'), 'utf8'));
  for (const p of ps) check(false, `f/${id}: ${p}`);
  if (!ps.length) clean++;
}
check(clean === pages.length, `${clean}/${pages.length} festival pages carry the desktop QR correctly`);

// Mutants on one real page: each must be caught.
const sample = readFileSync(join(dir, pages[0], 'index.html'), 'utf8');
const MUTANTS = [
  ['no figure', s => s.replace(/<figure class="appqr">.*?<\/figure>\n?/, '')],
  ['shown by default', s => s.replace('figure.appqr { display:none;', 'figure.appqr { display:flex;')],
  ['shown on phones', s => s.replace('@media (hover:hover) and (pointer:fine) and (min-width:720px) { figure.appqr', '@media (min-width:320px) { figure.appqr')],
  ['wrong image', s => s.replace('<img src="/app-qr.svg"', '<img src="/og-card.png"')],
];
let caught = 0;
for (const [name, mutate] of MUTANTS) {
  const m = mutate(sample);
  if (m === sample) { check(false, `mutant "${name}" no longer applies: update the test`); continue; }
  const killed = problems(m).length > 0;
  check(killed, `mutant "${name}" must be caught`);
  if (killed) caught++;
}

if (failed) { console.log(`✗ app QR: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ app QR: ${checks} checks (decoded file pinned, ${pages.length} festival pages, desktop only; ${caught}/${MUTANTS.length} mutants caught)`);
