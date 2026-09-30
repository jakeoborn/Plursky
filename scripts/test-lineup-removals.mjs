#!/usr/bin/env node
// Acts an official lineup billed and later dropped.
//
// A festival module may export `removedFromLineup`: acts its official lineup
// page billed on an earlier read and no longer bills (III Points 2026 lost
// four between 08-29 and 09-25). The newest official billing wins, so each
// one is OUT of the lineup; the record keeps it so a re-bill is a one-line
// re-add with the same id. This proves, for every record in every module:
//   - the act is absent from the module's artists (by id AND by name) and
//     from the loaded _DATA_SETS, so no screen, count or search shows it;
//   - it cites the page that dropped it, over https, dated AFTER lastSeen;
//   - its reAdd line carries the same id and name.
// Positive control first: III Points' four records must be found, or the
// loader changed shape and a pass would prove nothing.
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { loadRegistry } from './lib/load-registry.mjs';

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const ctx = { window: {} }; vm.createContext(ctx);
for (const f of readdirSync('data/festivals').filter(f => f.endsWith('.js')).sort())
  vm.runInContext(readFileSync(`data/festivals/${f}`, 'utf8'), ctx);
const mods = ctx.window.PLURSKY_FESTIVALS || {};
const { DS } = loadRegistry(process.cwd());

const removed = Object.entries(mods).flatMap(([fid, m]) => (m.removedFromLineup || []).map(r => ({ fid, r, m })));
const iii = removed.filter(x => x.fid === 'iii-points-2026').map(x => x.r.id).sort();
const want = ['iiip-jencarlos', 'iiip-mila-gama-b2b-x3butterfly', 'iiip-mr-brown', 'iiip-ultrathem'];
check(JSON.stringify(iii) === JSON.stringify(want), `control: iii-points-2026 removedFromLineup is ${JSON.stringify(iii)}, expected ${JSON.stringify(want)}`);

const DATE = /^\d{4}-\d\d-\d\d$/;
for (const { fid, r, m } of removed) {
  const name = String(r.name || '').toLowerCase();
  check(!m.artists.some(a => a.id === r.id || a.name.toLowerCase() === name), `${fid} ${r.id}: dropped from the official lineup, but still in the module's artists`);
  check(!((DS[fid] || {}).artists || []).some(a => a.id === r.id), `${fid} ${r.id}: dropped from the official lineup, but _DATA_SETS still carries it`);
  check(/^https:\/\//.test(r.removedFrom?.url || '') && DATE.test(r.lastSeen || '') && DATE.test(r.removedFrom?.observedAt || '')
    && r.lastSeen < r.removedFrom.observedAt, `${fid} ${r.id}: must cite the page that dropped it, dated after lastSeen (${r.lastSeen} → ${r.removedFrom?.observedAt})`);
  check(typeof r.reAdd === 'string' && r.reAdd.includes(`"${r.id}"`) && r.reAdd.includes(`"${r.name}"`), `${fid} ${r.id}: reAdd line must carry the same id and name`);
}

if (failed) { console.log(`✗ lineup removals: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ lineup removals: ${checks} checks · ${removed.length} dropped acts on ${new Set(removed.map(x => x.fid)).size} festival(s), each out of the lineup, cited, and one line from a re-add`);
