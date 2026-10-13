#!/usr/bin/env node
// Gate for scripts/lib/content-readiness.mjs: the rubric levels, the choice
// precedence, duplicate/identity handling, the field allow-list, and the
// baseline over today's bundled lineups. Offline; no network.
import { readFileSync } from 'node:fs';
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
const fxCfg = { ...OFFICIAL, name: 'Fixture Fest 2026' };
check(item(base({ bio: 'Ann, Bo, Cy — played Fixture Fest 2026 on the tent stage.' }, fxCfg)).bioEvidence === 'template', 'a one-off schedule line naming the edition is generated, not prose');
check(item(base({ bio: 'Fixture Fest 2026 regular with a modular rig.' }, fxCfg)).bioEvidence === 'unsourced_prose', 'naming the festival without "plays" is still prose');
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

// ── Showcases: one label, many groups, only where a source says so ──
const DATES = { 1: { y: 2026, m: 5, d: 26 }, 2: { y: 2026, m: 5, d: 27 } };
const show = (day = 1) => ({ config: { ...OFFICIAL, dayDates: DATES }, artists: ['a', 'b', 'c'].map(st => (
  { id: `s-${st}`, name: 'Rock Camp', bio: `Rock Camp's ${st} band covers the classics.`, stage: st, day, start: '12:00' })) });
const SC = { edition: 'fx', name: 'Rock Camp', dates: ['2026-06-26'], source: 'https://example.org/release', publishedAt: '2026-05-18' };
const sc = (d, showcases) => buildItems('fx', d, { showcases });
check(sc(show(), []).every(i => i.choice === 'conflict'), 'no showcase entry: concurrent same-name rows are conflicts');
check(sc(show(), [SC]).every(i => i.choice !== 'conflict' && /showcase/.test(i.reasons[0])), 'a sourced showcase covering the date clears the cross-stage conflict');
check(sc(show(), [SC]).every(i => !i.semanticEligible), 'a showcase label is never semantic-eligible');
check(sc(show(2), [SC]).every(i => i.choice === 'conflict' && /does not cover/.test(i.reasons[0])), 'a date the source does not print stays a conflict');
check(sc(show(), [{ ...SC, edition: 'other' }]).every(i => i.choice === 'conflict'), 'another edition\'s entry is not evidence');
check(sc(show(), [{ ...SC, source: 'http://example.org' }]).every(i => i.choice === 'conflict'), 'an entry without an https source is ignored');
check(sc(show(), [{ ...SC, publishedAt: '' }]).every(i => i.choice === 'conflict'), 'an undated entry is ignored');
const showDup = show(); showDup.artists.push({ ...showDup.artists[0], id: 's-a2' });
check(sc(showDup, [SC]).filter(i => i.stage === 'a').every(i => i.choice === 'conflict'), 'a showcase never excuses a duplicate row on the same stage');

// ── Allow-list: user data can never ride along ──
const leaky = base({ exif: { gps: [30, -97] }, savedBy: 'u1', userId: 'u1', notes: 'private', attended: true });
const keys = new Set(buildItems('fx', leaky).flatMap(Object.keys));
check([...keys].every(k => ITEM_FIELDS.includes(k)), `item fields ⊆ allow-list (${[...keys].filter(k => !ITEM_FIELDS.includes(k))})`);
check(!ITEM_FIELDS.some(k => /exif|gps|lat|lng|user|account|email|note|saved|attend|taste|history|photo|media/i.test(k)), 'allow-list names no user-data field');

// ── Baseline over today's bundled lineups ──
const { DS } = loadRegistry(process.cwd());
const showcases = JSON.parse(readFileSync('data/content-readiness/showcases.json', 'utf8'));
const items = Object.keys(DS).sort().flatMap(id => buildItems(id, DS[id], { showcases }));
const s = summarize(items);
check(items.length >= 2000, `baseline covers every billing (${items.length})`);
check(Object.keys(s.editions).length === Object.keys(DS).length, 'every edition is scored');
check(items.every(i => ['ready_for_editor_review', 'needs_source', 'conflict', 'skip'].includes(i.choice)), 'every choice is a named option');
check(items.every(i => i.readiness < 3 || i.bioEvidence === 'official_profile'), 'nothing reaches 3 without an official profile');
check(!items.some(i => i.bioEvidence === 'unsourced_prose' && i.choice === 'ready_for_editor_review'), 'no unsourced prose is ready for review');
const sj = items.filter(i => i.edition === 'summerfest-2026' && /^Stephan Jenkins/.test(i.name));
check(sj.length === 1 && sj[0].billingId === 'su45' && sj[0].choice !== 'conflict', 'live removal control: su24 absent; su45 retained and not a duplicate conflict');
const restored = structuredClone(DS['summerfest-2026']);
const retained = restored.artists.find(a => a.id === 'su45');
restored.artists.push({ ...retained, id: 'su24', stage: 'bmo' });
check(buildItems('summerfest-2026', restored, { showcases }).filter(i => /^Stephan Jenkins/.test(i.name)).every(i => i.choice === 'conflict'), 'mutation control: restoring a same-time cross-stage row is a conflict');
const sor = items.filter(i => i.edition === 'summerfest-2026' && i.name === 'School of Rock');
check(sor.filter(i => i.day === 5).length === 5 && sor.filter(i => i.day === 5).every(i => i.choice !== 'conflict'), 'positive control: June 26 School of Rock rows are a sourced showcase, not conflicts');
check(sor.filter(i => i.day === 4).length === 5 && sor.filter(i => i.day === 4).every(i => i.choice === 'conflict' && /does not cover/.test(i.reasons[0])), 'June 25 School of Rock stays flagged: the release prints June 26-27');
check(showcases.every(s => /^https:\/\//.test(s.source) && s.publishedAt && s.observedAt && s.statement), 'every showcase entry carries a dated https source and its statement');
const realProse = items.filter(i => i.bioEvidence === 'unsourced_prose').map(i => `${i.edition}:${i.billingId}`).sort();
check(JSON.stringify(realProse) === JSON.stringify(['edc-lv-2026:b7', 'edc-lv-2026:c15', 'edc-lv-2026:c6', 'edc-lv-2026:k18', 'edc-lv-2026:k25', 'edc-lv-2026:k27', 'edc-lv-2026:k9', 'edc-lv-2026:q22']), `positive control: unsourced prose is exactly the eight EDC LV bios (${realProse.join(',')})`);
check(items.filter(i => i.edition === 'nocturnal-wonderland-2026' && i.bioEvidence === 'official_profile').length >= 60, 'positive control: Nocturnal official profiles are read');
const again = Object.keys(DS).sort().flatMap(id => buildItems(id, DS[id], { showcases }));
check(JSON.stringify(again) === JSON.stringify(items), 'deterministic: a second run is identical');

console.log(`content readiness: ${pass} passed, ${fail} failed`);
if (fail) { console.error(`✗ content readiness: ${fail} of ${pass + fail} checks failed`); process.exit(1); }
