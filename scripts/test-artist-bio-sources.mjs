#!/usr/bin/env node
// Every hand-written artist bio is bound to a source (data/artist-bios/sources.json).
//
// A bundled bio is either the generated schedule line ("Playing EDC Las Vegas
// 2026.") or an entry here whose text matches the rendered bio exactly, with at
// least one https source of a named kind and the passage it supports. A social
// link, a stream page or a bare homepage cannot certify a bio: an artist's
// Instagram proves the account exists, not the sentence. Scope: edc-lv-2026,
// the one edition with hand-written bios (Nocturnal's come verbatim from its
// official profiles).
import { readFileSync } from 'node:fs';
import { loadRegistry } from './lib/load-registry.mjs';

const KINDS = new Set(['artist', 'label', 'agency', 'interview']);
const SOCIAL = /(^|\.)(instagram|facebook|x|twitter|tiktok|soundcloud|spotify|youtube|linktr)\.(com|ee)$/i;

export function entryProblems(key, entry, renderedBio) {
  const out = [];
  if (!entry || typeof entry.bio !== 'string') return [`${key}: no entry`];
  if (entry.bio !== renderedBio) out.push(`${key}: ledger bio differs from the rendered bio`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.observedAt || '')) out.push(`${key}: observedAt is not a date`);
  const srcs = Array.isArray(entry.sources) ? entry.sources : [];
  if (!srcs.length) out.push(`${key}: no sources`);
  for (const s of srcs) {
    let host = '';
    try { const u = new URL(s.url); if (u.protocol !== 'https:') out.push(`${key}: ${s.url} is not https`); host = u.hostname; }
    catch { out.push(`${key}: ${s.url} is not a URL`); continue; }
    if (SOCIAL.test(host)) out.push(`${key}: ${host} is a social/stream link, not a source for prose`);
    if (!KINDS.has(s.kind)) out.push(`${key}: source kind "${s.kind}" is not one of ${[...KINDS]}`);
    if (!s.supports || String(s.supports).trim().length < 12) out.push(`${key}: source has no supported passage`);
  }
  return out;
}

let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else { fail++; console.error(`  ✗ ${msg}`); } };

// Negative controls on a fixture: each bad entry must be refused.
const good = { bio: 'B', observedAt: '2026-10-12', sources: [{ url: 'https://label.example/artist', kind: 'label', supports: 'founded the label in 2015' }] };
check(entryProblems('fx', good, 'B').length === 0, 'a bound entry passes');
check(entryProblems('fx', good, 'C').length > 0, 'a bio that drifted from its ledger text is refused');
check(entryProblems('fx', { ...good, sources: [] }, 'B').length > 0, 'an entry with no source is refused');
check(entryProblems('fx', { ...good, sources: [{ ...good.sources[0], url: 'https://www.instagram.com/someone' }] }, 'B').length > 0, 'an Instagram link cannot certify prose');
check(entryProblems('fx', { ...good, sources: [{ ...good.sources[0], url: 'https://open.spotify.com/artist/1' }] }, 'B').length > 0, 'a Spotify page cannot certify prose');
check(entryProblems('fx', { ...good, sources: [{ ...good.sources[0], url: 'http://label.example/artist' }] }, 'B').length > 0, 'plain http is refused');
check(entryProblems('fx', { ...good, sources: [{ ...good.sources[0], kind: 'fan wiki' }] }, 'B').length > 0, 'an unnamed source kind is refused');
check(entryProblems('fx', { ...good, sources: [{ ...good.sources[0], supports: '' }] }, 'B').length > 0, 'a source without the passage it supports is refused');
check(entryProblems('fx', { ...good, observedAt: 'today' }, 'B').length > 0, 'an undated entry is refused');

// The real data.
const ledger = JSON.parse(readFileSync('data/artist-bios/sources.json', 'utf8'));
const { DS } = loadRegistry(process.cwd());
const edc = DS['edc-lv-2026'].artists;
const GENERATED = /^Playing EDC Las Vegas 2026\./;
const handWritten = edc.filter(a => !GENERATED.test(String(a.bio || '')));
check(handWritten.length === 8, `positive control: edc-lv-2026 has 8 hand-written bios (${handWritten.length})`);
for (const a of handWritten) {
  const key = `edc-lv-2026:${a.id}`;
  const probs = entryProblems(key, ledger[key], a.bio);
  check(probs.length === 0, probs.join('; ') || key);
}
for (const key of Object.keys(ledger)) {
  const [ed, id] = key.split(':');
  check(!!(DS[ed] && DS[ed].artists.some(a => a.id === id)), `${key}: ledger entry names a billing that exists`);
}

console.log(`artist bio sources: ${pass} passed, ${fail} failed`);
if (fail) { console.error(`✗ artist bio sources: ${fail} of ${pass + fail} checks failed`); process.exit(1); }
