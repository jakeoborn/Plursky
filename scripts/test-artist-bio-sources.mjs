#!/usr/bin/env node
// Every hand-written artist bio is bound to a source (data/artist-bios/sources.json).
//
// A bundled bio is either the generated schedule line ("Playing EDC Las Vegas
// 2026.") or an entry here whose text matches the rendered bio exactly, with at
// least one https source of a named kind, its date and the exact passage it
// supports. Entries are reviewed synthesis: a short paraphrase checked against
// those passages, never official copy (officialArtistProfiles stays verbatim). A social
// link, a stream page or a bare homepage cannot certify a bio: an artist's
// Instagram proves the account exists, not the sentence. Scope: edc-lv-2026,
// the one edition with hand-written bios (Nocturnal's come verbatim from its
// official profiles).
//
// What this gate can and cannot prove. It checks drift (ledger text = rendered
// text), provenance shape, and binding to the row: every source URL names the
// act, and every proper noun, number and quoted title in the bio appears in an
// excerpt. It runs offline, so it cannot show an excerpt is really on the page
// or that the passages support the sentence; that is the reviewer's row-by-row
// ledger check against the fetched sources.
import { readFileSync } from 'node:fs';
import { loadRegistry } from './lib/load-registry.mjs';

const KINDS = new Set(['artist', 'label', 'agency', 'interview']);
const SOCIAL = /(^|\.)(instagram|facebook|x|twitter|tiktok|soundcloud|spotify|youtube|linktr)\.(com|ee)$/i;

// "Armin van Buuren (Sunrise Set)" -> "arminvanbuuren": the billing's act, minus its set label.
export const actSlug = name => String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').toLowerCase().replace(/[^a-z0-9]/g, '');
// Proper nouns, numbers and quoted titles: the bio's checkable specifics.
export function bioTerms(bio) {
  const STOP = new Set(['The', 'A', 'An', 'And', 'Of']);
  const titles = [...String(bio).matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const words = String(bio).replace(/"[^"]+"/g, ' ').split(/[^A-Za-z0-9]+/).filter(w => w.length >= 2 && (/^[A-Z]/.test(w) || /^\d+$/.test(w)) && !STOP.has(w));
  return [...titles, ...words];
}

export function entryProblems(key, entry, renderedBio, actName) {
  const out = [];
  if (!entry || typeof entry.bio !== 'string') return [`${key}: no entry`];
  if (entry.bio !== renderedBio) out.push(`${key}: ledger bio differs from the rendered bio`);
  if (entry.classification !== 'reviewed_synthesis') out.push(`${key}: classification must be reviewed_synthesis (a paraphrase is never official copy)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt || '')) out.push(`${key}: reviewedAt is not a date`);
  const srcs = Array.isArray(entry.sources) ? entry.sources : [];
  if (!srcs.length) out.push(`${key}: no sources`);
  for (const s of srcs) {
    let host = '';
    try { const u = new URL(s.url); if (u.protocol !== 'https:') out.push(`${key}: ${s.url} is not https`); host = u.hostname; }
    catch { out.push(`${key}: ${s.url} is not a URL`); continue; }
    if (SOCIAL.test(host)) out.push(`${key}: ${host} is a social/stream link, not a source for prose`);
    if (!KINDS.has(s.kind)) out.push(`${key}: source kind "${s.kind}" is not one of ${[...KINDS]}`);
    if (!s.excerpt || String(s.excerpt).trim().length < 12 || /\.\.\.|…/.test(s.excerpt)) out.push(`${key}: source needs an exact, unelided excerpt`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.observedAt || '')) out.push(`${key}: source observedAt is not a date`);
    const slug = actSlug(actName);
    if (!slug || !(host + new URL(s.url).pathname).toLowerCase().replace(/[^a-z0-9]/g, '').includes(slug)) out.push(`${key}: ${s.url} does not name the act "${actName}"`);
  }
  const said = srcs.map(s => String(s.excerpt || '')).join(' ').toLowerCase();
  for (const t of bioTerms(entry.bio)) if (!said.includes(t.toLowerCase())) out.push(`${key}: "${t}" in the bio appears in no excerpt`);
  return out;
}

let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else { fail++; console.error(`  ✗ ${msg}`); } };

// Negative controls on a fixture: each bad entry must be refused.
const B = 'Founder of Kestrel Records since 2015.', ACT = 'Fixture Act (Sunrise Set)';
const good = { bio: B, classification: 'reviewed_synthesis', reviewedAt: '2026-10-12', sources: [{ url: 'https://label.example/artists/fixture-act', kind: 'label', observedAt: '2026-10-12', excerpt: 'Fixture Act, founder of Kestrel Records, has run the label since 2015.' }] };
const ep = (e, bio = B, act = ACT) => entryProblems('fx', e, bio, act);
const withSrc = patch => ({ ...good, sources: [{ ...good.sources[0], ...patch }] });
check(ep(good).length === 0, `a bound entry passes (${ep(good).join('; ')})`);
check(ep(good, 'C').length > 0, 'a bio that drifted from its ledger text is refused');
check(ep(withSrc({ url: 'https://unrelated.example/', excerpt: 'Welcome to our homepage, browse the full catalogue.' })).length > 0, 'an unrelated https homepage with an unrelated excerpt is refused');
check(ep(withSrc({ url: 'https://unrelated.example/' })).length > 0, 'a source URL that does not name the act is refused, even with a fitting excerpt');
check(ep(withSrc({ excerpt: 'Fixture Act toured widely and released several records.' })).length > 0, 'an excerpt on the right page that names none of the bio\'s specifics is refused');
check(ep(withSrc({ excerpt: 'Fixture Act, founder of Kestrel Records, has run the label since 2016.' })).length > 0, 'a year the excerpts do not state is refused');
check(ep({ ...good, bio: 'The act behind "Kestrel Song".' }, 'The act behind "Kestrel Song".').length > 0, 'a quoted title the excerpts do not state is refused');
check(ep(good, B, 'Other Act').length > 0, 'a ledger row checked against a different billing is refused');
check(ep({ ...good, sources: [] }).length > 0, 'an entry with no source is refused');
check(ep(withSrc({ url: 'https://www.instagram.com/someone' })).length > 0, 'an Instagram link cannot certify prose');
check(ep(withSrc({ url: 'https://open.spotify.com/artist/1' })).length > 0, 'a Spotify page cannot certify prose');
check(ep(withSrc({ url: 'http://label.example/artist' })).length > 0, 'plain http is refused');
check(ep(withSrc({ kind: 'fan wiki' })).length > 0, 'an unnamed source kind is refused');
check(ep(withSrc({ excerpt: '' })).length > 0, 'a source without the passage it supports is refused');
check(ep(withSrc({ excerpt: 'founded ... in 2015' })).length > 0, 'an elided excerpt is refused');
check(ep({ ...good, classification: 'official_profile' }).length > 0, 'a paraphrase cannot be classed as official copy');
check(ep(withSrc({ observedAt: '' })).length > 0, 'an undated source is refused');
check(ep({ ...good, reviewedAt: 'today' }).length > 0, 'an unreviewed entry is refused');

// The real data.
const ledger = JSON.parse(readFileSync('data/artist-bios/sources.json', 'utf8'));
const { DS } = loadRegistry(process.cwd());
const edc = DS['edc-lv-2026'].artists;
const GENERATED = /^Playing EDC Las Vegas 2026\./;
const handWritten = edc.filter(a => !GENERATED.test(String(a.bio || '')));
check(handWritten.length === 8, `positive control: edc-lv-2026 has 8 hand-written bios (${handWritten.length})`);
for (const a of handWritten) {
  const key = `edc-lv-2026:${a.id}`;
  const probs = entryProblems(key, ledger[key], a.bio, a.name);
  check(probs.length === 0, probs.join('; ') || key);
}
for (const key of Object.keys(ledger)) {
  const [ed, id] = key.split(':');
  check(!!(DS[ed] && DS[ed].artists.some(a => a.id === id)), `${key}: ledger entry names a billing that exists`);
}

console.log(`artist bio sources: ${pass} passed, ${fail} failed`);
if (fail) { console.error(`✗ artist bio sources: ${fail} of ${pass + fail} checks failed`); process.exit(1); }
