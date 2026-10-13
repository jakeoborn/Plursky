#!/usr/bin/env node
// Gate for scripts/lib/content-readiness.mjs: the rubric levels, the choice
// precedence, duplicate/identity handling, the field allow-list, and the
// baseline over today's bundled lineups. Offline; no network.
import { loadRegistry } from './lib/load-registry.mjs';
import { ITEM_FIELDS, buildItems, summarize } from './lib/content-readiness.mjs';

let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else { fail++; console.error(`  ✗ ${msg}`); } };

const OFFICIAL = { scheduleSource: { url: 'https://example.org/schedule', observedAt: '2026-09-30', official: true } };
const tpl = (name) => ({ name, bio: `Playing Fixture Fest 2026.`, genre: '—' });
const base = (extra = {}, config = OFFICIAL) => ({
  config,
  artists: [
    { id: 'f1', ...tpl('Alpha'), stage: 'main', day: 1, start: '20:00' },
    { id: 'f2', ...tpl('Bravo'), stage: 'main', day: 1, start: '21:00' },
    { id: 'f3', ...tpl('Charlie'), stage: 'tent', day: 2, start: '20:00' },
    { id: 'x', name: 'Xray', bio: 'Playing Fixture Fest 2026.', genre: '—', stage: 'tent', day: 2, start: '22:00', ...extra },
  ],
});
const item = (d, id = 'x') => buildItems('fx-2026', d).find(i => i.billingId === id);

// ── Rubric levels ──
check(item(base({ day: null })).readiness === 0, 'no day → readiness 0');
check(item(base({ day: null })).choice === 'skip', 'readiness 0 → skip');
check(item(base({}, { scheduleSource: { url: 'u', observedAt: '2026-05', official: false } })).readiness === 1, 'unofficial source → 1');
check(item(base({}, { scheduleSource: { url: 'u', official: true } })).readiness === 1, 'undated official source → 1');
check(item(base({}, {})).readiness === 1, 'no source at all → 1');
check(item(base()).readiness === 2, 'dated official source, template bio → 2');
check(item(base()).choice === 'ready_for_editor_review', 'readiness 2, nothing wrong → ready_for_editor_review');
const prof = { bio: 'Xray grew up in Albany and builds modular techno live.', officialArtistProfiles: [{ bio: 'Xray grew up in Albany and builds modular techno live.' }] };
check(item(base(prof)).readiness === 3, 'official profile bio → 3');
check(item(base({ ...prof, genre: 'Techno', scheduleSources: [{ url: 'grid', observedAt: '2026-09-30' }] })).readiness === 4, 'profile + specific genre + per-act source → 4');
check(item(base({ ...prof, genre: 'Techno' })).readiness === 3, 'no per-act source holds at 3');

// ── Evidence classes ──
check(item(base()).bioEvidence === 'template', 'a shape shared by ≥3 billings is a template');
const prose = { bio: 'Belgian techno queen, mainstage rarity.' };
check(item(base(prose)).bioEvidence === 'unsourced_prose', 'one-off prose with no profile is unsourced');
check(item(base(prose)).choice === 'needs_source', 'unsourced prose is never ready for review');
check(item(base(prose)).semanticEligible === true, 'prose is the only thing a semantic read could use');
check(item(base()).semanticEligible === false, 'a template bio is not semantic-eligible');
check(item(base()).genreEvidence === 'placeholder', '"—" genre is a placeholder');
const allRock = { config: OFFICIAL, artists: ['a', 'b', 'c'].map((id, i) => ({ id, name: id, genre: 'Rock', stage: 's', day: 1, start: `1${i}:00` })) };
check(buildItems('fx', allRock).every(i => i.genreEvidence === 'edition_default'), 'a genre most of the edition carries is the default label');
check(item(base({ provisional: true })).choice === 'needs_source', 'provisional → needs_source');

// ── Duplicates and identity ──
const dup = base(); dup.artists.push({ ...dup.artists[3], id: 'x2' });
check(item(dup).choice === 'conflict' && /duplicate printed row/.test(item(dup).reasons[0]), 'same name/stage/start → duplicate conflict');
check(item(dup).semanticEligible === false, 'a conflict is never semantic-eligible');
const cross = base(); cross.artists.push({ ...cross.artists[3], id: 'x2', stage: 'main' });
check(item(cross).choice === 'conflict' && /identity unresolved/.test(item(cross).reasons[0]), 'same name/start on another stage → identity conflict');
const dupProse = base(prose); dupProse.artists.push({ ...dupProse.artists[3], id: 'x2' });
check(item(dupProse).choice === 'conflict', 'conflict outranks needs_source');
const wk = { config: OFFICIAL, artists: [
  { id: 'w1', name: 'Same', weekend: 'W1', stage: 's', day: 1, start: '20:00' },
  { id: 'w2', name: 'Same', weekend: 'W2', stage: 's', day: 1, start: '20:00' },
  { id: 'd2', name: 'Same', weekend: 'W1', stage: 's', day: 2, start: '20:00' }] };
check(buildItems('fx', wk).every(i => i.choice !== 'conflict'), 'another weekend or day is a repeat billing, not a conflict');
check(new Set(buildItems('fx', wk).map(i => i.key)).size === 3, 'keys stay unique per edition + weekend + id');

// ── Allow-list: user data can never ride along ──
const leaky = base({ exif: { gps: [30, -97] }, savedBy: 'u1', userId: 'u1', notes: 'private', attended: true });
const keys = new Set(buildItems('fx', leaky).flatMap(Object.keys));
check([...keys].every(k => ITEM_FIELDS.includes(k)), `item fields ⊆ allow-list (${[...keys].filter(k => !ITEM_FIELDS.includes(k))})`);
check(!ITEM_FIELDS.some(k => /exif|gps|lat|lng|user|account|email|note|saved|attend|taste|history|photo|media/i.test(k)), 'allow-list names no user-data field');

// ── Baseline over today's bundled lineups ──
const { DS } = loadRegistry(process.cwd());
const items = Object.keys(DS).sort().flatMap(id => buildItems(id, DS[id]));
const s = summarize(items);
check(items.length >= 2000, `baseline covers every billing (${items.length})`);
check(Object.keys(s.editions).length === Object.keys(DS).length, 'every edition is scored');
check(items.every(i => ['ready_for_editor_review', 'needs_source', 'conflict', 'skip'].includes(i.choice)), 'every choice is a named option');
check(items.every(i => i.readiness < 3 || i.bioEvidence === 'official_profile'), 'nothing reaches 3 without an official profile');
check(!items.some(i => i.bioEvidence === 'unsourced_prose' && i.choice === 'ready_for_editor_review'), 'no unsourced prose is ready for review');
const sj = items.filter(i => i.edition === 'summerfest-2026' && /^Stephan Jenkins/.test(i.name));
check(sj.length >= 2 && sj.every(i => i.choice === 'conflict'), 'positive control: the same act on two Summerfest stages at 14:00 is a conflict');
check(items.filter(i => i.edition === 'nocturnal-wonderland-2026' && i.bioEvidence === 'official_profile').length >= 60, 'positive control: Nocturnal official profiles are read');
const again = Object.keys(DS).sort().flatMap(id => buildItems(id, DS[id]));
check(JSON.stringify(again) === JSON.stringify(items), 'deterministic: a second run is identical');

console.log(`content readiness: ${pass} passed, ${fail} failed`);
if (fail) { console.error(`✗ content readiness: ${fail} of ${pass + fail} checks failed`); process.exit(1); }
