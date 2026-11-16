#!/usr/bin/env node
// Gate: the public /artists/ pages (SPEC-206 B) say what the data proves, and
// nothing the artist repository spec §6 rules out. Derived from the data here,
// not from the generator's own helpers.
//
//   - a page exists exactly for each key that is not under review and has a
//     timed 2026 set or billings at two or more festival editions;
//   - every billing of that key is a row on its page, and every archived row
//     carries "as published <date>";
//   - the page never says final, complete, confirmed, full schedule, every set
//     or all sets (the spec's one footnote is the exception);
//   - an image appears only for a ledger photo with a recorded licence, and
//     its credit line names the author and the licence;
//   - JSON-LD parses, with no sameAs (no links ledger yet) and no offers;
//   - sitemap-artists.xml lists exactly the generated pages, and robots.txt
//     points at it.
// Then each check meets a mutation, in memory, that it has to catch.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'artists');
const careers = JSON.parse(readFileSync(join(ROOT, 'data/artists/careers.json'), 'utf8'));
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, 'data/artist-photos.js'), 'utf8'), ctx);
const PHOTOS = ctx.window.PLURSKY_ARTIST_PHOTOS || {};

let checks = 0, failed = 0;
const fail = m => { checks++; failed++; console.log(`  ✗  ${m}`); };
const ok = () => { checks++; };
if (!existsSync(DIR) || Object.keys(careers.artists).length < 1000) { console.log('  ✗  HARNESS DEAD: artists/ missing or careers.json is short'); process.exit(1); }

const FOOT = "Past schedules are shown as each festival printed them on its official site or its own social account, as of the dates shown, not final schedules.";
const NEVER = /\b(final|complete|confirmed|official final)\b|full schedule|every set|all sets/i;
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const visible = h => decode(h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const timed26Of = k => careers.artists[k].b.some(r => careers.festivals[r[1]]?.year === 2026 && r[4]);
const want = k => {
  const a = careers.artists[k];
  if (!a || a.pending) return false;
  const timed26 = a.b.some(r => careers.festivals[r[1]]?.year === 2026 && r[4]);
  return timed26 || new Set(a.b.map(r => r[1])).size >= 2;
};

function checkPage(k, html) {
  const out = [], a = careers.artists[k];
  const rows = (html.match(/<ul class="sets">[\s\S]*?<\/ul>/g) || []).join('').match(/<li>/g) || [];
  if (rows.length !== a.b.length) out.push(`${k}: ${rows.length} set rows, the data holds ${a.b.length} billings`);
  const archived = a.b.filter(r => r[11] && careers.festivals[r[1]]?.year < 2026).length;
  const pub = (html.match(/class="pub">as published /g) || []).length;
  if (pub !== archived) out.push(`${k}: ${pub} "as published" labels for ${archived} archived billings`);
  if (archived && !html.includes(FOOT.replace(/'/g, '&#39;')) && !html.includes(FOOT)) out.push(`${k}: archived billings without the snapshot footnote`);
  const text = visible(html).replace(FOOT, '');
  const bad = text.match(NEVER);
  if (bad) out.push(`${k}: says "${bad[0]}"`);
  for (const r of a.b) { const f = careers.festivals[r[1]]; if (f && !text.includes(f.name)) { out.push(`${k}: ${f.name} billing not on the page`); break; } }
  const imgs = html.match(/<img [^>]*>/g) || [];
  const p = PHOTOS[k];
  if (imgs.length) {
    if (!(p && p.license && p.licenseUrl && p.author)) out.push(`${k}: an image with no licensed ledger row`);
    else if (!html.includes(`/${p.asset}`) || !text.includes(`Photo: ${p.author}`) || !html.includes(p.licenseUrl)) out.push(`${k}: image without its credit line`);
  } else if (!/class="tile"/.test(html)) out.push(`${k}: neither a photo nor the letter tile`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch { out.push(`${k}: JSON-LD does not parse`); continue; }
    const s = JSON.stringify(d);
    if (/"sameAs"/.test(s)) out.push(`${k}: sameAs with no links ledger`);
    if (/"offers"/.test(s)) out.push(`${k}: offers in JSON-LD`);
  }
  if (/people saw|you've seen|attended|clips?\b/i.test(text)) out.push(`${k}: personal or popularity copy`);
  // The intro's edition count is a claim: it must equal the data's distinct past editions.
  const m = text.match(/is billed at (\d+) past festival editions? in Plursky's records/);
  if (m) {
    const pastN = new Set(a.b.filter(r => careers.festivals[r[1]]?.year < 2026).map(r => r[1])).size;
    if (+m[1] !== pastN) out.push(`${k}: intro says ${m[1]} past editions, the data holds ${pastN}`);
  }
  // "set times" is a promise: only a page with a timed 2026 row may make it.
  if (!timed26Of(k)) {
    const head = [...(html.match(/<title>[^<]*<\/title>/) || []), ...(html.match(/<h[12][^>]*>[^<]*<\/h[12]>/g) || [])].join(' ');
    if (/set times/i.test(head)) out.push(`${k}: says "set times" with no timed 2026 set`);
  }
  return out;
}

// Coverage both ways.
const dirs = new Set(readdirSync(DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name));
const expected = Object.keys(careers.artists).filter(want);
for (const k of expected) { if (!dirs.has(k)) fail(`${k}: qualifies but has no page`); else ok(); }
for (const k of dirs) { if (!want(k)) fail(`${k}: has a page but ${careers.artists[k]?.pending ? 'is under review' : 'does not meet the thin-content rule'}`); else ok(); }

let pages = 0, withPhoto = 0, withArchive = 0, untimed26 = 0;
for (const k of expected) {
  if (!dirs.has(k)) continue;
  const html = readFileSync(join(DIR, k, 'index.html'), 'utf8');
  pages++; if (!timed26Of(k) && careers.artists[k].b.some(r => careers.festivals[r[1]]?.year === 2026)) untimed26++; if (/<img /.test(html)) withPhoto++; if (/class="pub"/.test(html)) withArchive++;
  const probs = checkPage(k, html);
  if (probs.length) probs.slice(0, 3).forEach(fail); else ok();
}

const sm = existsSync(join(ROOT, 'sitemap-artists.xml')) ? readFileSync(join(ROOT, 'sitemap-artists.xml'), 'utf8') : '';
const locs = new Set([...sm.matchAll(/<loc>https:\/\/plursky\.com\/artists\/([^<]*)<\/loc>/g)].map(m => m[1].replace(/\/$/, '')));
const smOk = locs.has('') && locs.size === dirs.size + 1 && [...dirs].every(d => locs.has(d));
if (!smOk) fail(`sitemap-artists.xml lists ${locs.size} URLs for ${dirs.size} pages + the index`); else ok();
if (!/^Sitemap: https:\/\/plursky\.com\/sitemap-artists\.xml$/m.test(readFileSync(join(ROOT, 'robots.txt'), 'utf8'))) fail('robots.txt does not point at sitemap-artists.xml'); else ok();

// ── Mutations: each must be caught ──────────────────────────────────
const pick = f => expected.find(k => dirs.has(k) && f(k, readFileSync(join(DIR, k, 'index.html'), 'utf8')));
const archivedK = pick((k, h) => /class="pub"/.test(h) && careers.artists[k].b.length > 2);
const tileK = pick((k, h) => /class="tile"/.test(h));
const photoK = pick((k, h) => /<img /.test(h));
const pastOnlyK = pick((k, h) => /is billed at \d+ past festival edition/.test(h));
const untimed26K = pick(k => !timed26Of(k) && careers.artists[k].b.some(r => careers.festivals[r[1]]?.year === 2026));
const read = k => readFileSync(join(DIR, k, 'index.html'), 'utf8');
const mutants = [
  ['a dropped billing row', archivedK, h => h.replace(/\n      <li><time[^\n]*<\/li>/, '')],
  ['an archived row without its snapshot date', archivedK, h => h.replace(/ · <span class="pub">as published [^<]*<\/span>/, '')],
  ['the word "confirmed"', archivedK, h => h.replace('</h1>', '</h1><p>Set times confirmed.</p>')],
  ['an image on a letter-tile artist', tileK, h => h.replace('<div class="tile"', '<img src="/x.webp" alt=""><div class="tile"')],
  ['a photo without its credit line', photoK, h => h.replace(/<figcaption>[\s\S]*?<\/figcaption>/, '')],
  ['sameAs in JSON-LD', archivedK, h => h.replace('"@type": "MusicGroup",', '"@type": "MusicGroup", "sameAs": ["https://example.com"],')],
  ['"set times" on a page with no timed 2026 set', untimed26K, h => h.replace(/<title>([^<]*?) 2026 lineup:/, '<title>$1 set times 2026:')],
  ['an inflated edition count in the intro', pastOnlyK, h => h.replace(/(<p class="intro">[^<]*?is billed at )(\d+)( past festival edition)/, (x, p, n, q) => `${p}${+n + 1}${q}`)],
  ['popularity copy', archivedK, h => h.replace('</h1>', '</h1><p>1,204 people saw this set.</p>')],
];
let caught = 0;
for (const [label, k, mut] of mutants) {
  if (!k) { fail(`mutation "${label}": no fixture page`); continue; }
  const base = read(k), m = mut(base);
  if (m === base) { fail(`mutation "${label}" did not land on ${k}`); continue; }
  if (checkPage(k, m).length) { caught++; ok(); } else fail(`mutation "${label}" on ${k}: NOT caught`);
}
const pendingK = Object.keys(careers.artists).find(k => careers.artists[k].pending);
if (pendingK && !want(pendingK)) { caught++; ok(); } else fail('mutation "a page for a key under review": the coverage rule would not catch it');

if (failed) { console.log(`  ✗ artist pages: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ artist pages: ${checks} checks across ${pages} pages (${withPhoto} with a licensed photo, ${withArchive} with archived billings, ${untimed26} with untimed 2026 billings only; ${caught}/${mutants.length + 1} mutations caught)`);
