#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {stageProgrammingFor} from './lib/festival-page-data.mjs';
import {loadRegistry} from './lib/load-registry.mjs';
import {festivalFingerprint} from './lib/sitemap-fingerprint.mjs';
const data=stageProgrammingFor('iii-points-2026'),page=readFileSync('f/iii-points-2026/index.html','utf8');
const rows=data.stages.flatMap(s=>s.days.flatMap(d=>d.rows.map(r=>({...r,stage:s.name,day:d.day}))));
const sheet=readFileSync('docs/qa/reports/iii-points-2026-set-times/official.tsv','utf8').trim().split('\n').slice(1).map(l=>{let [day,stage,start,end,name]=l.split('\t');return {day:+day,stage:stage.toUpperCase(),start,end,name};});
assert.equal(data.stages.length,13);assert.equal(rows.length,231);assert.ok(rows.every(r=>r.start&&r.end));
const sorted=x=>x.map(r=>JSON.stringify([r.day,r.stage,r.start,r.end,r.name])).sort();assert.deepEqual(sorted(rows),sorted(sheet));
const night=t=>{let [h,m]=t.split(':').map(Number);return (h<8?h+24:h)*60+m;};
for(const stage of data.stages)for(const day of stage.days){const sets=[...day.rows].sort((a,b)=>night(a.start)-night(b.start));for(let i=1;i<sets.length;i++)assert.ok(night(sets[i].start)>=night(sets[i-1].end),stage.name);}
assert.match(data.source.sha256,/^[a-f0-9]{64}$/);assert.match(data.source.evidence,/screenshot/);
const section=page.split('<section aria-labelledby="stage-programming-h"')[1].split('</section>')[0];
assert.equal((section.match(/<time>/g)||[]).length,231);assert.equal((section.match(/<li>/g)||[]).length,231);assert.equal((section.match(/<details class="program-stage"/g)||[]).length,26);
assert.doesNotMatch(section,/running order, not set times|End times are not supplied|Club Space/);assert.match(section,/Friday 12:00 AM is early Saturday/);assert.match(section,/supplied screenshot/);
assert.ok(rows.some(r=>r.name==='Homicide Jenny'&&r.day===2&&r.start==='19:00'&&r.end==='19:30'));
assert.equal(rows.find(r=>r.name==='Loukeman').end,'18:05');
assert.equal(rows.find(r=>r.name==='Dude Skywalker').day,1);assert.equal(rows.find(r=>r.name==='Jeremy Ismael').day,2);
const {REG,DS,scheduleActs,eventDates}=loadRegistry(process.cwd()),entry=REG.find(e=>e.config.id==='iii-points-2026');
assert.equal(DS['iii-points-2026'].artists.length,229);assert.ok(DS['iii-points-2026'].artists.every(a=>!a.start),'website-only directive must not change app clocks');
const deps={DS,scheduleActs,eventDates,TODAY:'2026-10-05'},file='data/programming/iii-points-2026.json',original=readFileSync(file,'utf8'),before=festivalFingerprint(entry,deps);
try{const changed=JSON.parse(original);changed.stages[0].days[0].rows[0].end='05:00';writeFileSync(file,JSON.stringify(changed));assert.notEqual(festivalFingerprint(entry,deps),before);}finally{writeFileSync(file,original);}
assert.equal(stageProgrammingFor('acl-2026'),null);
console.log('✓ III Points website: 231 exact sheet intervals, 26 blocks, non-overlap, end-time fingerprint mutant; app unchanged');
