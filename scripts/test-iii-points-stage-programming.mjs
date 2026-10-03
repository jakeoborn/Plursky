#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {stageProgrammingFor} from './lib/festival-page-data.mjs';
import {loadRegistry} from './lib/load-registry.mjs';
import {festivalFingerprint} from './lib/sitemap-fingerprint.mjs';
const root=process.cwd(), data=stageProgrammingFor('iii-points-2026',root);
const page=readFileSync('f/iii-points-2026/index.html','utf8');
const rows=data.stages.flatMap(s=>s.days.flatMap(d=>d.rows.map(r=>({...r,stage:s.id,day:d.day}))));
assert.equal(data.source.url,'https://www.iiipoints.com/experience/');
assert.match(data.source.sha256,/^[a-f0-9]{64}$/);
assert.equal(data.stages.length,13);assert.equal(rows.length,231);
const timed=rows.filter(r=>r.start);assert.equal(timed.length,6);
assert.ok(timed.every(r=>r.stage==='444'));assert.ok(rows.every(r=>!('end' in r)));
assert.deepEqual(timed.map(r=>[r.name,r.day,r.start]),[
 ['HEIDI LAWDEN',1,'16:00'],['DJ HARVEY',1,'20:00'],['FLOATING POINTS',1,'00:00'],
 ['WILLIKENS & IVKOVIC',2,'16:00'],['RED AXES',2,'20:00'],['SETH TROXLER',2,'00:00']]);
const section=page.split('<section aria-labelledby="stage-programming-h"')[1].split('</section>')[0];
assert.equal((section.match(/<time>/g)||[]).length,6);
assert.equal((section.match(/<li>/g)||[]).length,231);
assert.equal((section.match(/<details class="program-stage"/g)||[]).length,26);
assert.match(section,/running order, not set times/);assert.match(section,/End times are not supplied/);
assert.match(section,/Friday 12:00 AM is early Saturday/);
assert.doesNotMatch(section,/Club Space|MARATHON|iiipoints\.miami/);
assert.equal(stageProgrammingFor('acl-2026'),null);
const {REG,DS,scheduleActs,eventDates}=loadRegistry(root), entry=REG.find(e=>e.config.id==='iii-points-2026');
const deps={DS,scheduleActs,eventDates,TODAY:'2026-10-03'};
assert.equal((DS['iii-points-2026'].artists||[]).filter(a=>a.start).length,0,'website-only programming must not synthesize app live sets');
assert.ok(entry.available,'preserve existing lineup availability');
const before=festivalFingerprint(entry,deps), file="data/programming/iii-points-2026.json", original=readFileSync(file,"utf8");
// Fingerprint reads the same programming source as rendering, not only app acts.
try { const changed=JSON.parse(original); changed.stages[0].days[0].rows[0].name += " MUTATION"; writeFileSync(file,JSON.stringify(changed)); assert.notEqual(festivalFingerprint(entry,deps),before,"programming names must move page fingerprint"); } finally { writeFileSync(file,original); }
assert.match(page,/Official stage schedule/);
console.log('✓ III Points website programming: 13 stages, 26 day blocks, 231 billings, 6 real starts; app times unchanged');
