#!/usr/bin/env node
// #302 first slice: print the public geo-evidence inventory and the human
// re-survey queue. Read-only; not in verify.
//
//   node scripts/geo-evidence-inventory.mjs [YYYY-MM-DD] [--json]
//
// The date fixes waiver expiry so two runs on the same tree agree.
import { loadBrowser } from './lib/load-browser.mjs';
import { loadRegistry } from './lib/load-registry.mjs';
import { inventoryFestival, loadWaivers, resurveyQueue, DISPOSITION as D } from './lib/geo-evidence.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const today = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);
const app = loadBrowser(ROOT);
const { DS, REG } = loadRegistry(ROOT);
const waivers = loadWaivers(ROOT);

const ids = Object.keys(DS).sort();
const festivals = ids.filter(id => (DS[id].stages || []).length)
  .map(id => inventoryFestival(id, DS[id].config, DS[id].stages, app, waivers, today));
const noStages = ids.filter(id => !(DS[id].stages || []).length);
const noDataSet = REG.map(r => r.config.id).filter(id => !DS[id]).sort();
const queue = resurveyQueue(festivals);
const pairs = festivals.flatMap(f => f.stageRows);
const count = d => pairs.filter(p => p.disposition === d).length;

if (args.includes('--json')) {
  console.log(JSON.stringify({ today, festivals, noStages, noDataSet, queue }, null, 2));
  process.exit(0);
}
console.log(`geo evidence inventory, ${today}`);
console.log(`  ${REG.length} registry festivals · ${ids.length} data sets · ${festivals.length} with stages · ${noStages.length} data sets with no stages · ${noDataSet.length} festivals with no data set`);
console.log(`  ${pairs.length} stage/edition pairs: ${count(D.CONSISTENT)} ${D.CONSISTENT} · ${count(D.CONFLICT)} ${D.CONFLICT} · ${count(D.NOT_EVIDENCE)} ${D.NOT_EVIDENCE} · ${count(D.INSUFFICIENT)} ${D.INSUFFICIENT}`);
console.log('');
console.log('  festival                      stages anchors measured verified  waiver');
for (const f of festivals) {
  const w = f.waivers.map(x => `${x.kind} → ${x.expires}${x.expired ? ' EXPIRED' : ''}`).join(', ') || '-';
  const orphan = f.orphanAnchors.length ? `  ⚠ anchor for missing stage: ${f.orphanAnchors.join(', ')}` : '';
  console.log(`  ${f.festivalId.padEnd(30)}${String(f.stages).padStart(6)}${String(f.anchors).padStart(8)}${String(f.evidenceAnchors).padStart(9)}  ${(f.geometryVerified ? 'yes' : 'no').padEnd(8)}${w}${orphan}`);
}
console.log('');
console.log(`  re-survey queue (human only, ${queue.length} stages), top 15:`);
for (const q of queue.slice(0, 15)) {
  const r = q.worstResidualM != null ? ` ${q.worstResidualM} m off the art` : '';
  console.log(`  ${String(q.rank).padStart(3)}. ${q.festivalId} / ${q.stageId}: ${q.disposition}${r}${q.waiverExpires ? ` (waiver ${q.waiverExpires})` : ''}`);
}
