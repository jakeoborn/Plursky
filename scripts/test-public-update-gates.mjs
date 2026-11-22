#!/usr/bin/env node
// #303 first slice: the deterministic gates in scripts/lib/public-update-gates.mjs,
// run against REAL festival configs (Coachella 2027's own site, dates and
// lineup ids). Standalone, not in verify. The fixtures below are hand-built
// test cases, NOT the spec's 120 labeled public updates: they prove each gate
// fires for its reason, not that a classifier is accurate.
import { loadRegistry } from './lib/load-registry.mjs';
import { gateUpdate, isOfficialHost, updateKey, REASONS as R } from './lib/public-update-gates.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const { DS } = loadRegistry(ROOT);
const coa = DS['coachella-2027'];
if (!coa || !coa.config.officialEvent || !coa.artists.length) { console.log('  ✗ coachella-2027 config or lineup missing'); process.exit(1); }
const cfg = coa.config, setIds = new Set(coa.artists.map(a => a.id));
const NOW = Date.parse('2027-03-01T18:00:00Z');   // before the edition, inside its window
const A = coa.artists[0].id;
const base = { festivalId: 'coachella-2027', sourceUrl: 'https://www.coachella.com/news/set-times', publishedAt: '2027-03-01T17:00:00Z', expiresAt: '2027-04-19T07:00:00Z' };
let n = 0;
const mk = (over) => ({ id: `u${++n}`, text: `Update ${n}: weekend one gates open at noon.`, ...base, ...over });

// [label, update, expected reasons ([] = accepted)]
const CASES = [
  ['official site, offset time, in window', mk({}), []],
  ['official subdomain', mk({ sourceUrl: 'https://media.coachella.com/notice' }), []],
  ['known set id', mk({ affectedSetIds: [A] }), []],
  ['offset other than Z', mk({ publishedAt: '2027-03-01T09:00:00-08:00' }), []],
  ['http source', mk({ sourceUrl: 'http://www.coachella.com/news' }), [R.BAD_URL]],
  ['look-alike host (suffix without dot)', mk({ sourceUrl: 'https://fakecoachella.com/news' }), [R.UNOFFICIAL]],
  ['resale marketplace', mk({ sourceUrl: 'https://coachella-tickets.example/news' }), [R.UNOFFICIAL]],
  ['social repost is not the site', mk({ sourceUrl: 'https://www.instagram.com/p/abc/' }), [R.UNOFFICIAL]],
  ['other edition', mk({ festivalId: 'coachella-2026' }), [R.WRONG_EDITION]],
  ['unknown set id', mk({ affectedSetIds: ['coa26-not-a-set'] }), [R.UNKNOWN_SET]],
  ['bare local time', mk({ publishedAt: '2027-03-01T09:00:00' }), [R.AMBIGUOUS_TIME]],
  ['future-dated beyond skew', mk({ publishedAt: '2027-03-01T18:30:00Z' }), [R.FUTURE_DATED]],
  ['within clock skew', mk({ publishedAt: '2027-03-01T18:03:00Z' }), []],
  ['expired', mk({ expiresAt: '2027-02-01T00:00:00Z' }), [R.EXPIRED]],
  ['no expiry', mk({ expiresAt: null }), [R.NO_EXPIRY]],
  ['last year\'s post', mk({ publishedAt: '2026-04-12T20:00:00Z' }), [R.OUTSIDE_WINDOW]],
];

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗ ${msg}`); } };
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));

function run(gate = gateUpdate) {
  const seen = new Set(), out = [];
  for (const [label, u, want] of CASES) {
    const got = gate(u, { config: cfg, now: NOW, seen, setIds });
    out.push([label, same(got.reasons, want), got.reasons, want]);
  }
  return out;
}
for (const [label, ok, got, want] of run()) check(ok, `${label}: got [${got}] want [${want}]`);

// Dedup: the same words from the same source are one update, whatever the
// spacing, case or trailing punctuation; a rejected update never blocks a
// later valid one.
{
  const seen = new Set(), c = { config: cfg, now: NOW, seen, setIds };
  const first = gateUpdate(mk({ text: 'Gates open at NOON.' }), c);
  const again = gateUpdate(mk({ text: '  gates   open at noon ' }), c);
  check(first.ok && same(again.reasons, [R.DUPLICATE]), `duplicate after normalising text: ${again.reasons}`);
  const seen2 = new Set(), c2 = { config: cfg, now: NOW, seen: seen2, setIds };
  gateUpdate(mk({ text: 'Shuttle times change.', sourceUrl: 'https://fakecoachella.com/x' }), c2);
  const valid = gateUpdate(mk({ text: 'Shuttle times change.' }), c2);
  check(valid.ok, `a rejected update does not mark its text as seen: ${valid.reasons}`);
  check(updateKey(mk({ text: 'x' })) !== updateKey(mk({ text: 'x', festivalId: 'coachella-2026' })), 'the key includes the edition');
}
check(isOfficialHost('https://coachella.com/a', cfg) && !isOfficialHost('https://notcoachella.com/a', cfg), 'bare apex host passes, look-alike fails');

// Mutations: each gate removed must turn at least one case wrong. A gate no
// fixture can fire is vacuous, and this is the check that says so.
const src = (await import('node:fs')).readFileSync(new URL('./lib/public-update-gates.mjs', import.meta.url), 'utf8');
const MUTANTS = [
  ['identity', "else if (!isOfficialHost(u.sourceUrl, config)) reasons.push(REASONS.UNOFFICIAL);", ''],
  ['subdomain dot', "h.endsWith('.' + site)", 'h.endsWith(site)'],
  ['edition', 'if (u.festivalId !== config.id) reasons.push(REASONS.WRONG_EDITION);', ''],
  ['set ids', 'if (u.affectedSetIds.some(id => !ctx.setIds.has(id))) reasons.push(REASONS.UNKNOWN_SET);', ''],
  ['offset', 'if (!pubOk || !expOk) reasons.push(REASONS.AMBIGUOUS_TIME);', ''],
  ['future', 'if (pub > now + SKEW_MS) reasons.push(REASONS.FUTURE_DATED);', ''],
  ['window', '&& (pub < w.startMs - LEAD_MS || pub > w.endMs + TAIL_MS)) reasons.push(REASONS.OUTSIDE_WINDOW);', '&& false) reasons.push(REASONS.OUTSIDE_WINDOW);'],
  ['expiry', 'else if (expOk && Date.parse(u.expiresAt) <= now) reasons.push(REASONS.EXPIRED);', ''],
  ['https', "u.protocol === 'https:' ?", 'true ?'],
];
let caught = 0;
for (const [name, from, to] of MUTANTS) {
  if (!src.includes(from)) { check(false, `mutation ${name}: pattern not found`); continue; }
  const url = 'data:text/javascript;base64,' + Buffer.from(src.replace(from, to)).toString('base64');
  const M = await import(url);
  const wrong = run(M.gateUpdate).filter(r => !r[1]).length;
  if (wrong > 0) caught++; else check(false, `mutation ${name} survived: no fixture can fire that gate`);
}
console.log(failed ? `  ✗ ${failed} of ${checks} failed` : `  ✓ public update gates: ${checks} checks, ${CASES.length} cases on coachella-2027 (${setIds.size} set ids), ${caught}/${MUTANTS.length} mutations caught`);
process.exit(failed ? 1 : 0);
