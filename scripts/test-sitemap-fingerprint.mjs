#!/usr/bin/env node
// Regression mutants for the sitemap content fingerprint.
//
// What this proves, per field class: changing a source field that the festival
// page RENDERS moves that festival's fingerprint and NO other festival's. That
// is the whole promise of the ledger — lastmodFor() is a pure function of
// (stored fp, new fp), so a festival whose fingerprint is unchanged keeps its
// stored date by construction. Proving "exactly one fingerprint moved" is
// therefore proving "exactly one <lastmod> moved, every other url stable".
//
// It also proves the inverse, which is the half that is easy to lose: a config
// field the page does NOT render moves nothing. Without that control a
// fingerprint could pass every positive test by simply hashing the whole
// config, which would reintroduce the daily wolf from the other direction.
//
// And it reads the generator's own render path to catch the defect class
// itself: any cfg.* / entry.* field used by place / dayLabel / scheduleGrid /
// stagesSection / stub / JSON-LD / scheduleFeed that is neither fingerprinted
// nor explicitly excluded fails the gate by name. That is the detector, not
// just the instance — a future field added to the renderer cannot silently
// leave lastmod frozen.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';
import {
  festivalFingerprint, templateFingerprint,
  FINGERPRINTED_CONFIG_FIELDS, FINGERPRINTED_ENTRY_FIELDS,
  EXCLUDED_CONFIG_FIELDS, EXCLUDED_ENTRY_FIELDS,
} from './lib/sitemap-fingerprint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { REG, DS, scheduleActs, eventDates } = loadRegistry(root);

// Pinned, not `new Date()`: the fingerprint's only clock-sensitive field is
// isPast, and a regression test that changes its verdict with the calendar is
// the exact wolf this whole design exists to avoid.
const TODAY = '2026-09-16';
const deps = (ds) => ({ DS: ds || DS, scheduleActs, eventDates, TODAY });

let failures = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++; };
const pass = (msg) => console.log(`  ✓ ${msg}`);

// ── Baseline ──────────────────────────────────────────────────────────
const base = new Map(REG.map(e => [e.config.id, festivalFingerprint(e, deps())]));

// Determinism: the same input twice must hash identically, or every result
// below is noise (Set iteration order, object key order, a stray Date).
for (const e of REG) {
  if (festivalFingerprint(e, deps()) !== base.get(e.config.id)) {
    fail(`fingerprint is not deterministic for ${e.config.id}`);
  }
}
if (!failures) pass(`deterministic across ${REG.length} festivals`);

// ── Helpers ───────────────────────────────────────────────────────────
const cfgPatch = (e, patch) => ({ ...e, config: { ...e.config, ...patch } });
const entPatch = (e, patch) => ({ ...e, ...patch });
const dsPatch = (id, patch) => ({ ...DS, [id]: { ...(DS[id] || {}), ...patch } });

const withCfg = (f) => {
  const e = REG.find(x => x.config[f] != null && x.config[f] !== '');
  if (!e) throw new Error(`no fixture festival carries config.${f}`);
  return e;
};
const withDS = (k) => {
  const e = REG.find(x => (DS[x.config.id]?.[k] || []).length > 0);
  if (!e) throw new Error(`no fixture festival carries a non-empty ${k} set`);
  return e;
};

// Swap one mutated entry into the registry and report which festivals moved.
function moved(mutant, mutDS) {
  const d = deps(mutDS);
  const out = [];
  for (const e of REG) {
    const use = (mutant && e.config.id === mutant.config.id) ? mutant : e;
    if (festivalFingerprint(use, d) !== base.get(e.config.id)) out.push(e.config.id);
  }
  return out;
}

function expectOnly(label, mutant, mutDS) {
  const id = mutant ? mutant.config.id : null;
  const got = moved(mutant, mutDS);
  if (got.length === 1 && got[0] === id) {
    pass(`${label} → moved ${id} only (${REG.length - 1} urls stable)`);
  } else if (!got.length) {
    fail(`${label} → fingerprint did NOT move; the field is rendered but unhashed`);
  } else {
    fail(`${label} → expected only ${id}, moved ${got.length}: ${got.join(', ')}`);
  }
}

function expectNone(label, mutant, mutDS) {
  const got = moved(mutant, mutDS);
  if (!got.length) pass(`${label} → moved nothing, as intended`);
  else fail(`${label} → moved ${got.length} url(s) (${got.join(', ')}) but is not rendered`);
}

// ── 1. Render-driving field classes: each moves exactly its own festival ──
console.log('▸ Render-driving fields move exactly one url');

for (const [label, build] of [
  ['cfg.name', () => { const e = withCfg('name'); return cfgPatch(e, { name: `${e.config.name} MUTANT` }); }],
  ['cfg.dates', () => { const e = withCfg('dates'); return cfgPatch(e, { dates: 'Jan 1–2, 2099' }); }],
  ['cfg.location', () => { const e = withCfg('location'); return cfgPatch(e, { location: 'Mutant Grounds · Nowhere, NV' }); }],
  ['cfg.locationShort', () => { const e = withCfg('locationShort'); return cfgPatch(e, { locationShort: 'MUTANT SHORT' }); }],
  ['cfg.tagline', () => { const e = withCfg('tagline'); return cfgPatch(e, { tagline: 'MUTANT TAGLINE' }); }],
  ['cfg.brand', () => { const e = withCfg('brand'); return cfgPatch(e, { brand: 'MUTANT BRAND' }); }],
  ['cfg.tzAbbr', () => { const e = withCfg('tzAbbr'); return cfgPatch(e, { tzAbbr: 'ZZT' }); }],
  ['cfg.dayDates', () => {
    const e = withCfg('dayDates');
    const dd = e.config.dayDates;
    const k = Object.keys(dd)[0];
    return cfgPatch(e, { dayDates: { ...dd, [k]: { ...dd[k], name: 'Mutantday' } } });
  }],
  ['cfg.setTimesProvisional', () => {
    const e = withCfg('setTimesProvisional');
    return cfgPatch(e, { setTimesProvisional: !e.config.setTimesProvisional });
  }],
  ['cfg.scheduleSource', () => {
    const e = withCfg('scheduleSource');
    return cfgPatch(e, { scheduleSource: { ...e.config.scheduleSource, observedAt: '2099-01-01' } });
  }],
  ['entry.available', () => { const e = REG.find(x => x.available); return entPatch(e, { available: !e.available }); }],
  ['entry.scheduleTBA', () => { const e = REG.find(x => x.scheduleTBA != null); return entPatch(e, { scheduleTBA: !e.scheduleTBA }); }],
  ['entry.region', () => { const e = REG.find(x => x.region); return entPatch(e, { region: 'Mutantia' }); }],
]) {
  try { expectOnly(label, build()); }
  catch (err) { fail(`${label} → fixture error: ${err.message}`); }
}

// Lineup-data classes live in _DATA_SETS, so they mutate DS rather than entry.
try {
  const e = withDS('stages');
  const st = DS[e.config.id].stages;
  expectOnly('stages[].name', e,
    dsPatch(e.config.id, { stages: [{ ...st[0], name: 'MUTANT STAGE' }, ...st.slice(1)] }));
} catch (err) { fail(`stages[].name → fixture error: ${err.message}`); }

try {
  const e = withDS('artists');
  const ar = DS[e.config.id].artists;
  expectOnly('artists[].name', e,
    dsPatch(e.config.id, { artists: [{ ...ar[0], name: 'MUTANT ARTIST' }, ...ar.slice(1)] }));
} catch (err) { fail(`artists[].name → fixture error: ${err.message}`); }

try {
  const e = REG.find(x => (DS[x.config.id]?.artists || []).some(a => a.start));
  if (!e) throw new Error('no festival has a timed act');
  const ar = DS[e.config.id].artists;
  const i = ar.findIndex(a => a.start);
  expectOnly('artists[].start (set time)', e,
    dsPatch(e.config.id, { artists: ar.map((a, n) => n === i ? { ...a, start: '23:59' } : a) }));
} catch (err) { fail(`artists[].start → fixture error: ${err.message}`); }

// ── 2. Negative controls: unrendered config fields move nothing ───────
console.log('▸ Unrendered fields move nothing');

for (const [label, field, value] of [
  ['cfg.venue', 'venue', 'MUTANT VENUE OBJECT'],
  ['cfg.mapImage', 'mapImage', '/mutant-map.png'],
  ['cfg.shortName', 'shortName', 'MUTANT SHORT NAME'],
]) {
  try {
    const e = withCfg(field);
    expectNone(`${label} (not read by the renderer)`, cfgPatch(e, { [field]: value }));
  } catch (err) { fail(`${label} → fixture error: ${err.message}`); }
}

// ── 3. Coverage: the renderer cannot grow a field the hash does not see ──
console.log('▸ Every cfg.*/entry.* in the render path is accounted for');

const gen = readFileSync(path.join(root, 'scripts/gen-festival-pages.mjs'), 'utf8');
const from = gen.indexOf('function place(');
const to = gen.indexOf('const rows = [];');
if (from === -1 || to === -1 || to <= from) {
  fail('could not slice the render path out of gen-festival-pages.mjs — '
     + 'the anchors moved; fix this test rather than deleting it');
} else {
  const region = gen.slice(from, to);
  const seen = new Set();
  for (const m of region.matchAll(/\bcfg\.([A-Za-z_]\w*)/g)) seen.add(`config.${m[1]}`);
  for (const m of region.matchAll(/\bentry\.([A-Za-z_]\w*)/g)) seen.add(`entry.${m[1]}`);

  const known = new Set([
    ...FINGERPRINTED_CONFIG_FIELDS.map(f => `config.${f}`),
    ...Object.keys(EXCLUDED_CONFIG_FIELDS).map(f => `config.${f}`),
    ...FINGERPRINTED_ENTRY_FIELDS.map(f => `entry.${f}`),
    ...Object.keys(EXCLUDED_ENTRY_FIELDS).map(f => `entry.${f}`),
  ]);

  const unknown = [...seen].filter(f => !known.has(f)).sort();
  if (unknown.length) {
    fail(`the render path reads ${unknown.length} field(s) the fingerprint does not account for: `
       + `${unknown.join(', ')} — add each to FINGERPRINTED_* (it changes the page) or to `
       + `EXCLUDED_* with a reason (it does not), in scripts/lib/sitemap-fingerprint.mjs`);
  } else {
    pass(`${seen.size} render-path field(s) all fingerprinted or explicitly excluded`);
  }
}

// ── 4. The TEMPLATE moves every festival url, and nothing else ────────
// The field lists above cannot watch this door: a template edit reads no new
// cfg.*/entry.* field, so section 3 sees nothing while every page changes.
// The first attempt at a fix was a hand-bumped constant, which only restated
// the contract — a forgotten bump still froze all 25 dates. The contribution
// is now DERIVED from the render-path source, and these mutants are what make
// that claim checkable instead of merely asserted.
console.log('▸ A template-only edit moves every festival url and no others');

const realTpl = templateFingerprint(gen);
const TPL_ANCHOR = '<h2 id="answers-h">';
const landed = gen.split(TPL_ANCHOR).length - 1;
if (landed !== 1) {
  fail(`template mutation anchor is not unique (${landed} occurrences) — every result below would be meaningless`);
} else {
  const mutTpl = templateFingerprint(gen.replace(TPL_ANCHOR, '<h2 id="answers-h" data-mutant="1">'));
  if (mutTpl === realTpl) {
    fail('a crawler-visible markup edit did NOT move the template fingerprint — the contract is unenforced');
  } else {
    pass('crawler-visible markup edit moves the template fingerprint');
    const movedIds = REG.filter(e =>
      festivalFingerprint(e, { ...deps(), templateFp: mutTpl }) !== base.get(e.config.id)
    ).map(e => e.config.id);
    if (movedIds.length === REG.length) {
      pass(`template edit moved all ${REG.length} festival urls`);
    } else {
      const missing = REG.map(e => e.config.id).filter(i => !movedIds.includes(i));
      fail(`template edit moved only ${movedIds.length}/${REG.length} festival urls — frozen: ${missing.join(', ')}`);
    }
  }

  // The other direction: documentation must stay free. Without this, the hash
  // would redate 25 urls for a comment edit — crying wolf, which is the exact
  // noise the ledger was built to remove.
  const cmtTpl = templateFingerprint(gen.replace('// ── Page template', '// ── Page template (comment edit)'));
  if (cmtTpl === realTpl) pass('a comment-only edit moves nothing');
  else fail('a comment-only edit MOVED the template fingerprint — 25 urls would be redated for nothing');
}

// The homepage, terms and privacy never pass through fingerprintInput at all —
// they are hashed from file content — so a template edit cannot reach them.
// Proven from the generator's source: recomputing the same input twice and
// finding it unchanged would be vacuous.
for (const needle of ["fileFp('terms.html')", "fileFp('privacy.html')", 'fp(idx)']) {
  if (gen.includes(needle)) pass(`non-festival url hashed from file content — ${needle}`);
  else fail(`the generator no longer hashes a non-festival url via ${needle} — re-prove template isolation`);
}

// ── Verdict ───────────────────────────────────────────────────────────
if (failures) {
  console.error(`[fingerprint] FAILED — ${failures} check(s)`);
  process.exit(1);
}
console.log(`[fingerprint] ✓ ${REG.length} festivals — render-driving fields move one url each, `
  + 'unrendered fields move none, render path fully covered');
