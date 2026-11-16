#!/usr/bin/env node
// Gate: the /genres/ pages (SPEC-206 A) hold to the ruling: EDC only, our own
// tags only, nothing guessed. Derived from the data here, not from the
// generator's helpers.
//   - only allowlisted festivals appear on a genre page (EDC Las Vegas 2026);
//   - a genre page lists exactly the acts whose own genre string names it;
//   - a page exists exactly for each genre with 3+ acts;
//   - the stamp is the newest recorded read of a listed source (as on /f/);
//   - the intro's count and named lineup match the data;
//   - sitemap-genres.xml lists exactly the pages, and robots.txt points at it.
// Each check then meets a mutation it has to catch.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';
import { editionHours } from './lib/festival-page-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'genres');
const ALLOW = ['edc-lv-2026'];
const { REG, DS } = loadRegistry(ROOT);
let checks = 0, failed = 0;
const fail = m => { checks++; failed++; console.log(`  ✗  ${m}`); };
const ok = () => { checks++; };
if (!existsSync(DIR) || !(DS['edc-lv-2026']?.artists || []).length) { console.log('  ✗  HARNESS DEAD: genres/ or the EDC Las Vegas 2026 lineup is missing'); process.exit(1); }

const slug = g => g.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const want = new Map();
for (const fid of ALLOW) for (const a of DS[fid].artists) for (const g of String(a.genre || '').split('/').map(s => s.trim()).filter(s => s && s !== '—')) {
  const k = slug(g); if (!want.has(k)) want.set(k, new Set()); want.get(k).add(a.name);
}
const cfg = id => REG.find(e => e.config.id === id).config;
const reads = c => [c.officialEvent?.website && c.officialEvent, c.lineupSource, c.scheduleSource, c.mapSource, editionHours(c)]
  .filter(s => s && (s.url || s.website) && /^\d{4}-\d{2}-\d{2}$/.test(String(s.observedAt || ''))).map(s => s.observedAt).sort();
const stamp = ALLOW.flatMap(id => reads(cfg(id))).sort().pop();
const others = REG.filter(e => !ALLOW.includes(e.config.id)).map(e => e.config.name);
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function checkPage(k, html) {
  const out = [];
  const listed = new Set([...html.matchAll(/<ul class="acts">([\s\S]*?)<\/ul>/g)].flatMap(m => [...m[1].matchAll(/<li>([^<]*)<\/li>/g)].map(x => decode(x[1]))));
  const exp = want.get(k) || new Set();
  for (const a of exp) if (!listed.has(a)) { out.push(`${k}: ${a} is tagged ${k} but not listed`); break; }
  for (const a of listed) if (!exp.has(a)) { out.push(`${k}: ${a} is listed but its genre does not name ${k}`); break; }
  const rank = (html.match(/<ol class="rank">([\s\S]*?)<\/ol>/) || [])[1] || '';
  for (const n of others) if (rank.includes(`>${n}<`)) { out.push(`${k}: ${n} ranked, but only ${ALLOW.join(', ')} is ruled in`); break; }
  const s = html.match(/<p class="checked">Festival sources last checked on <time datetime="([^"]+)">/);
  if (!s) out.push(`${k}: no "Festival sources last checked on" stamp`); else if (s[1] !== stamp) out.push(`${k}: "checked on ${s[1]}", the newest recorded read is ${stamp}`);
  // The intro is a count and a scope claim: the count is this genre's acts and
  // the scope names exactly the ruled-in lineups (never a vaguer plural).
  const intro = decode((html.match(/<p class="intro">([^<]*)<\/p>/) || [])[1] || '');
  const n = (want.get(k) || new Set()).size;
  const scope = `on the ${ALLOW.map(id => cfg(id).name).join(' and ')} lineup, by Plursky's own genre tags.`;
  if (!intro.startsWith(`${n} `) || !intro.endsWith(scope)) out.push(`${k}: intro "${intro}" is not "${n} ... ${scope}"`);
  // Other data sets carry genre strings (excluded only for missing provenance),
  // so a page may never call them untagged, and must say why they are out.
  if (/not tagged/i.test(html)) out.push(`${k}: says other festivals are "not tagged" (they carry genre strings; their source is not recorded)`);
  if (!html.includes('have not been source-verified for these pages')) out.push(`${k}: missing the source-verification note`);
  return out;
}

const dirs = new Set(readdirSync(DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name));
for (const [k, s] of want) { if ((s.size >= 3) !== dirs.has(k)) fail(`${k}: ${s.size} acts, page ${dirs.has(k) ? 'exists' : 'missing'}`); else ok(); }
for (const k of dirs) if (!want.has(k)) fail(`${k}: a page for a genre no allowlisted act carries`);
for (const k of dirs) { const p = checkPage(k, readFileSync(join(DIR, k, 'index.html'), 'utf8')); if (p.length) p.forEach(fail); else ok(); }
const idx = readFileSync(join(DIR, 'index.html'), 'utf8');
if (!idx.includes(`datetime="${stamp}"`)) fail('genres/ index: stamp is not the newest recorded read'); else ok();
if (!decode(idx).includes(`${want.size} genres on the ${ALLOW.map(id => cfg(id).name).join(' and ')} lineup, by Plursky's own genre tags.`)) fail('genres/ index: intro count or named lineup does not match the data'); else ok();
if (/not tagged/i.test(idx) || !idx.includes('have not been source-verified for these pages')) fail('genres/ index: the other-festivals note is missing or says "not tagged"'); else ok();
const sm = existsSync(join(ROOT, 'sitemap-genres.xml')) ? readFileSync(join(ROOT, 'sitemap-genres.xml'), 'utf8') : '';
const locs = new Set([...sm.matchAll(/<loc>https:\/\/plursky\.com\/genres\/([^<]*)<\/loc>/g)].map(m => m[1].replace(/\/$/, '')));
if (!(locs.has('') && locs.size === dirs.size + 1 && [...dirs].every(d => locs.has(d)))) fail(`sitemap-genres.xml lists ${locs.size} URLs for ${dirs.size} pages + the index`); else ok();
if (!/^Sitemap: https:\/\/plursky\.com\/sitemap-genres\.xml$/m.test(readFileSync(join(ROOT, 'robots.txt'), 'utf8'))) fail('robots.txt does not point at sitemap-genres.xml'); else ok();

const base = readFileSync(join(DIR, 'trance', 'index.html'), 'utf8');
const mutants = [
  ['an untagged act listed', h => h.replace('<ul class="acts">', '<ul class="acts">\n      <li>Some Guessed Act</li>')],
  ['a tagged act dropped', h => h.replace(/\n      <li>Darude<\/li>/, '')],
  ['a festival outside the ruling ranked', h => h.replace('<ol class="rank">', `<ol class="rank">\n      <li><a href="/f/x/">${others[0]}</a> 3 acts</li>`)],
  ['the stamp moved past the last read', h => h.replace(/(<p class="checked">Festival sources last checked on <time datetime=")[^"]+/, '$12099-01-01')],
  ['the old vague "festival lineups Plursky has tagged" intro back', h => h.replace(/(<p class="intro">\d+ [^<]*? acts?) on [^<]*<\/p>/, '$1 on festival lineups Plursky has tagged.</p>')],
  ['an inflated act count in the intro', h => h.replace(/<p class="intro">(\d+)/, (m, d) => `<p class="intro">${+d + 5}`)],
  ['the old "not tagged yet" sentence back', h => h.replace(/Only [^<]*? is included; genre tags for other festivals have not been source-verified for these pages\./g, 'Other festivals are not tagged yet, so they are not counted.')],
  ['the stamp dropped', h => h.replace(/  <p class="checked">[^\n]*\n/, '')],
];
let caught = 0;
for (const [label, mut] of mutants) { const m = mut(base); if (m === base) fail(`mutation "${label}" did not land`); else if (checkPage('trance', m).length) { caught++; ok(); } else fail(`mutation "${label}": NOT caught`); }
if (failed) { console.log(`  ✗ genre pages: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ genre pages: ${checks} checks, ${dirs.size} pages from ${ALLOW.join(', ')} (${want.size} genres); ${caught}/${mutants.length} mutations caught`);
