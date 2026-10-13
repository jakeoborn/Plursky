#!/usr/bin/env node
// Artist census: what the billings hold today, the baseline the artist
// registry (M1) must account for row by row.
//   node scripts/artist-census.mjs           print the census as JSON
//   node scripts/artist-census.mjs --write   freeze it to data/artists/census.json
//   node scripts/artist-census.mjs --check   exit 1 when today's data no longer
//                                            matches the frozen census
// A difference is not a bug in itself: lineups change. It means the census
// has to be re-measured (and the numbers it feeds re-read) before the registry
// is built or re-checked against it. Measurement only: nothing in the app reads this.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { loadRegistry } from './lib/load-registry.mjs';
import { slug } from './historical/lib.mjs';

const root = process.cwd();
const FIXTURE = `${root}/data/artists/census.json`;
const { REG, DS } = loadRegistry(root);

const fests = REG.map(e => e.config?.id || e.id);
const withData = fests.filter(id => DS[id]?.artists?.length);
const rows = [];
for (const id of withData) for (const a of DS[id].artists) rows.push({ f: id, name: a.name, start: a.start });

const raw = new Set(rows.map(r => r.name.trim()));
const folded = new Map();
for (const n of raw) { const k = slug(n); if (!folded.has(k)) folded.set(k, new Set()); folded.get(k).add(n); }
const SEPS = { b2b: /\s+b\d+b\s+/i, amp: /\s&\s/, x: /\s[x×]\s/i, presents: /\bpresents\b/i, paren: /\(.*\)/ };
const sepCounts = Object.fromEntries(Object.entries(SEPS).map(([k, re]) => [k, [...raw].filter(n => re.test(n)).length]));

// Performers: a b2b/b3b billing splits into its members; a set tag such as
// "(live)" or "(DJ set)" is not part of the name. "&", "x" and "presents" are
// NOT split here (Walker & Royce is one act); the registry decides those.
const performers = n => n.split(/\s+b\d+b\s+/i).map(s => slug(s.replace(/\s*\((live|dj set|hybrid|live set|dj)\)\s*/ig, ''))).filter(Boolean);
const live = new Map(), timed = new Set();
for (const r of rows) for (const p of performers(r.name)) {
  if (!live.has(p)) live.set(p, new Set());
  live.get(p).add(r.f);
  if (r.start) timed.add(p);
}

const H = `${root}/data/historical/editions`;
const editions = readdirSync(H).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(`${H}/${f}`, 'utf8')));
const hist = new Map();
for (const e of editions) for (const a of e.artists) for (const p of a.performers) {
  if (!hist.has(p)) hist.set(p, new Set());
  hist.get(p).add(e.id);
}
const all = new Map([...live].map(([k, s]) => [k, new Set(s)]));
for (const [k, s] of hist) { if (!all.has(k)) all.set(k, new Set()); for (const e of s) all.get(k).add(e); }
const billingsPerPerformer = {};
for (const s of all.values()) billingsPerPerformer[s.size] = (billingsPerPerformer[s.size] || 0) + 1;

const census = {
  festivalsInRegistry: fests.length,
  festivalsWithLineup: withData.length,
  billingRows2026: rows.length,
  distinctBillingStrings2026: raw.size,
  distinctFolded2026: folded.size,
  spellingGroups: [...folded.values()].filter(s => s.size > 1).map(s => [...s].sort()).sort((a, b) => a[0].localeCompare(b[0])),
  separators2026: sepCounts,
  performers2026: live.size,
  timedPerformers2026: timed.size,
  untimedRows2026: rows.filter(r => !r.start).length,
  archivedEditions: editions.map(e => ({ id: e.id, artists: e.artists.length, sets: e.sets.length })),
  performersArchived: hist.size,
  performersAll: all.size,
  performersArchivedAnd2026: [...live.keys()].filter(k => hist.has(k)).length,
  billingsPerPerformer,
};

const arg = process.argv[2];
if (arg === '--write') {
  mkdirSync(`${root}/data/artists`, { recursive: true });
  writeFileSync(FIXTURE, JSON.stringify(census, null, 1) + '\n');
  console.log(`[census] wrote ${FIXTURE.replace(root + '/', '')}: ${census.performersAll} performers, ${census.billingRows2026} 2026 rows, ${census.archivedEditions.length} editions`);
} else if (arg === '--check') {
  if (!existsSync(FIXTURE)) { console.error('[census] no frozen census: run with --write'); process.exit(1); }
  const was = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const diffs = Object.keys({ ...was, ...census }).filter(k => JSON.stringify(was[k]) !== JSON.stringify(census[k]));
  for (const k of diffs) console.log(`  ✗ ${k}: frozen ${JSON.stringify(was[k]).slice(0, 120)} → now ${JSON.stringify(census[k]).slice(0, 120)}`);
  if (diffs.length) { console.log(`✗ census drifted on ${diffs.length} field(s): re-measure, then --write`); process.exit(1); }
  console.log(`✓ census matches: ${census.performersAll} performers, ${census.billingRows2026} 2026 rows, ${census.archivedEditions.length} editions`);
} else {
  console.log(JSON.stringify(census, null, 1));
}
