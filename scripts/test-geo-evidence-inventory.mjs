#!/usr/bin/env node
// #302 first slice: checks for scripts/lib/geo-evidence.mjs against the REAL
// shipped festival data. Standalone, not in verify. It proves the inventory
// reads the app's own geometry predicate and the verify.mjs waiver tables
// faithfully, and that the three bad states the spec names (wrong anchor
// basis, expired waiver, missing stage) each change the output.
import { readFileSync } from 'node:fs';
import { loadBrowser } from './lib/load-browser.mjs';
import { loadRegistry } from './lib/load-registry.mjs';
import { inventoryFestival, loadWaivers, resurveyQueue, readWaiverTable, EVIDENCE_SRC, DISPOSITION as D } from './lib/geo-evidence.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const TODAY = '2026-11-22';
const app = loadBrowser(ROOT);
const { DS } = loadRegistry(ROOT);
const waivers = loadWaivers(ROOT);
const clone = o => JSON.parse(JSON.stringify(o));
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗ ${msg}`); } };

const withStages = Object.keys(DS).sort().filter(id => (DS[id].stages || []).length);
const inv = (lib = { inventoryFestival }, today = TODAY, ds = DS) =>
  withStages.map(id => lib.inventoryFestival(id, ds[id].config, ds[id].stages, app, waivers, today));
const fest = inv();
const by = Object.fromEntries(fest.map(f => [f.festivalId, f]));

// Universe: the spec's floor is 100 stage/edition pairs across >= 3 festivals.
const pairs = fest.flatMap(f => f.stageRows);
check(pairs.length >= 100 && fest.length >= 3, `pairs ${pairs.length} across ${fest.length} festivals (floor 100 / 3)`);
check(new Set(pairs.map(p => `${p.festivalId}|${p.stageId}`)).size === pairs.length, 'every stage/edition pair appears once');
check(pairs.every(p => Object.values(D).includes(p.disposition)), 'every pair has a known disposition');

// Faithful to the app: geometryVerified is the app's predicate, and a festival
// it passes has at least one stage the inventory calls consistent off a
// NON-basis anchor (that is what the predicate checks).
for (const f of fest) {
  check(f.geometryVerified === !!app.geometryVerifiedFor(f.festivalId, DS[f.festivalId].config, DS[f.festivalId].stages), `${f.festivalId}: geometryVerified matches the app`);
  if (f.geometryVerified) check(f.stageRows.some(s => s.disposition === D.CONSISTENT && s.anchors.some(a => !a.basis)), `${f.festivalId}: verified but no non-basis consistent stage`);
}
check(fest.filter(f => f.geometryVerified).length >= 1, 'at least one shipped festival passes geometry (control)');
check([...EVIDENCE_SRC].sort().join() === 'crowd,osm', 'evidence sources are osm and crowd, as in geometryVerifiedFor');

// Waivers come from verify.mjs, every one of them, with its own expiry.
const vsrc = readFileSync(new URL('./verify.mjs', import.meta.url), 'utf8');
for (const [kind, table] of [['registration', waivers.registration], ['art', waivers.art]]) {
  check(Object.keys(table).length >= 1, `${kind} waiver table read (control)`);
  for (const [id, w] of Object.entries(table)) {
    check(vsrc.includes(`"${id}": {`), `${kind} waiver ${id} is in verify.mjs`);
    const f = by[id];
    check(f && f.waivers.some(x => x.kind === kind && x.expires === w.expires && !x.expired), `${id}: ${kind} waiver ${w.expires} reported live on ${TODAY}`);
  }
}
let threw = false; try { readWaiverTable('const X = 1;', 'REGISTRATION_WAIVERS'); } catch { threw = true; }
check(threw, 'a missing waiver table throws instead of reading as empty');

// No coordinates leave the inventory: it reports provenance and residuals, never lat/lng.
const json = JSON.stringify({ fest, q: resurveyQueue(fest) });
check(!/"(lat|lng|latitude|longitude)"\s*:/.test(json), 'output carries no coordinates');
check(JSON.stringify(inv()) === JSON.stringify(fest), 'two runs on the same tree are identical');

// Queue: human candidates only, consistent stages never queued, deterministic
// tie-break (fixture both orders).
const q = resurveyQueue(fest);
check(q.length === pairs.filter(p => p.disposition !== D.CONSISTENT).length, 'queue holds every non-consistent pair and nothing else');
check(JSON.stringify(resurveyQueue([...fest].reverse())) === JSON.stringify(q), 'queue order does not depend on input order');

// ── The three bad states the spec names, each on a cloned data set ──────────
// 1. Wrong anchor basis: a verified festival whose basis turns into poster reads must stop verifying.
const vid = fest.find(f => f.geometryVerified).festivalId;
{
  const ds = clone(DS); ds[vid].config.gpsAnchors.slice(0, 3).forEach(a => { a.src = 'poster'; });
  const f = inventoryFestival(vid, ds[vid].config, ds[vid].stages, app, waivers, TODAY);
  check(!f.geometryVerified && f.basisEvidence === 0, `${vid}: poster basis still verifies`);
  check(!f.stageRows.some(s => s.disposition === D.CONSISTENT && s.anchors.every(a => a.basis)), `${vid}: a poster-basis stage still reads consistent`);
}
// 2. Expired waiver: the day after the earliest expiry, that waiver reads EXPIRED.
{
  const all = fest.flatMap(f => f.waivers.map(w => ({ id: f.festivalId, ...w })));
  const first = all.sort((a, b) => a.expires.localeCompare(b.expires))[0];
  const next = new Date(Date.parse(first.expires) + 864e5).toISOString().slice(0, 10);
  const f = inventoryFestival(first.id, DS[first.id].config, DS[first.id].stages, app, waivers, next);
  check(f.waivers.find(w => w.kind === first.kind).expired, `${first.id}: ${first.kind} waiver not expired on ${next}`);
}
// 3. Missing stage: drop an anchored stage; its anchor must surface as an orphan.
{
  const f0 = fest.find(f => f.anchors >= 4);
  const ds = clone(DS); const gone = ds[f0.festivalId].config.gpsAnchors[3].stageId;
  ds[f0.festivalId].stages = ds[f0.festivalId].stages.filter(s => s.id !== gone);
  const f = inventoryFestival(f0.festivalId, ds[f0.festivalId].config, ds[f0.festivalId].stages, app, waivers, TODAY);
  check(f.orphanAnchors.includes(gone), `${f0.festivalId}: missing stage ${gone} not reported`);
}
// 4. A measured non-basis anchor moved ~1.1 km must read as a conflict.
{
  const ds = clone(DS); const a = ds[vid].config.gpsAnchors.find((x, i) => i >= 3 && EVIDENCE_SRC.has(x.src));
  a.lat += 0.01;
  const f = inventoryFestival(vid, ds[vid].config, ds[vid].stages, app, waivers, TODAY);
  check(f.stageRows.find(s => s.stageId === a.stageId).disposition === D.CONFLICT, `${vid}/${a.stageId}: moved anchor not a conflict`);
}

// Source mutations: each rule removed must change the real inventory.
const src = readFileSync(new URL('./lib/geo-evidence.mjs', import.meta.url), 'utf8');
const MUTANTS = [
  ['tolerance', 'a.residualM > tol);', 'a.residualM > tol * 100);'],
  ['verified basis', '(a.basis && verified)', 'a.basis'],
  ['conflict', 'disposition = ok && !bad ?', 'disposition = ok ?'],
  ['poster is not evidence', "export const EVIDENCE_SRC = new Set(['osm', 'crowd']);", "export const EVIDENCE_SRC = new Set(['osm', 'crowd', 'poster']);"],
  ['unanchored', 'if (!own.length) disposition = DISPOSITION.INSUFFICIENT;', 'if (!own.length) disposition = DISPOSITION.NOT_EVIDENCE;'],
];
const base = JSON.stringify(fest.map(f => f.stageRows));
let caught = 0;
for (const [name, from, to] of MUTANTS) {
  if (!src.includes(from)) { check(false, `mutation ${name}: pattern not found`); continue; }
  const M = await import('data:text/javascript;base64,' + Buffer.from(src.replace(from, to)).toString('base64'));
  if (JSON.stringify(inv(M).map(f => f.stageRows)) !== base) caught++;
  else check(false, `mutation ${name} survived: the real data cannot tell it apart`);
}

const n = d => pairs.filter(p => p.disposition === d).length;
console.log(failed ? `  ✗ ${failed} of ${checks} failed`
  : `  ✓ geo evidence inventory: ${checks} checks, ${pairs.length} stage/edition pairs across ${fest.length} festivals (${n(D.CONSISTENT)} consistent, ${n(D.CONFLICT)} conflict, ${n(D.NOT_EVIDENCE)} review, ${n(D.INSUFFICIENT)} insufficient), ${caught}/${MUTANTS.length} mutations caught`);
process.exit(failed ? 1 : 0);
