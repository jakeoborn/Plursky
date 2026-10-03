#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadRegistry} from './lib/load-registry.mjs';
const d=loadRegistry(process.cwd()).DS['acl-2026'], old=JSON.parse(fs.readFileSync('docs/qa/reports/acl-2026-music-refresh/base-artist-identities.json'));
let count=0;const ok=(x,m)=>{assert.ok(x,m);count++};
const test=(data)=>{
 const ids=new Set();ok(data.artists.length===136,'136 records');
 for(const a of data.artists){ok(!ids.has(a.id),`unique ${a.id}`);ids.add(a.id);const before=old.find(x=>x.id===a.id);if(before)ok(before.name===a.name,`identity ${a.id}`);ok(a.scheduleSources.length===(a.weekend==='both'?2:1),`sources ${a.id}`);for(const s of a.scheduleSources)ok(s.observedAt==='2026-09-30'&&s.url.includes('9.30.webp')&&s.url.includes(s.weekend==='W2'?'Wk2':'Wk1'),`dated source ${a.id}`);}
 const removed=['as25','as29','au13','au20','au29'];ok(data.removedFromLineup.length===5,'five removals');for(const id of removed){ok(!ids.has(id)&&data.removedFromLineup.some(x=>x.id===id&&old.find(a=>a.id===id).name===x.name),'explicit removal '+id);}
 const expected=[['af49','amex','20:35','22:00','both'],['as09','beatbox','19:30','20:10','both'],['as19','beatbox','15:00','16:15','W1'],['as20','beatbox','15:30','16:15','W2'],['as21','beatbox','17:30','18:30','W1'],['as22','miller','17:15','18:15','W2'],['as23','miller','17:15','18:15','W1'],['as28','titos','14:00','14:45','both'],['au05','tmobile','16:30','17:20','both'],['au06','tmobile','18:20','19:20','both'],['au07','tmobile','20:35','22:00','both'],['au11','miller','17:20','18:20','both'],['au12','miller','19:20','20:35','both'],['au16','bmi','14:15','14:45','W2'],['au21','snapchat','15:30','16:30','W1'],['au23','beatbox','15:30','16:30','W1'],['au-vinny-w1','bmi','12:45','13:15','W1'],['au-jason-scott-w2','bmi','18:00','18:30','W2'],['au-flight-by-nothing-w1','beatbox','14:00','14:45','W1'],['au-girlsweetvoiced','titos','14:00','14:45','both']];
 for(const [id,...slot] of expected){const a=data.artists.find(x=>x.id===id);ok(a&&JSON.stringify([a.stage,a.start,a.end,a.weekend])===JSON.stringify(slot),'printed slot '+id);}
 for(const w of ['W2','W1'])for(const day of [1,2,3])for(const stage of data.stages.filter(x=>x.id!=='bonus').map(x=>x.id)){let acts=data.artists.filter(x=>x.day===day&&x.stage===stage&&(x.weekend===w||x.weekend==='both')).sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<acts.length;i++)ok(acts[i-1].end<=acts[i].start,`no overlap ${w} ${day} ${stage}`);}
};test(d);console.log(`PASS ${count} ACL September30 checks`);
let killed=0;for(const mutate of [x=>x.artists.find(a=>a.id==='as09').name='Fakemink',x=>x.artists.find(a=>a.id==='as22').start='15:30',x=>x.artists.find(a=>a.id==='af49').scheduleSources=[],x=>x.removedFromLineup=[]]){try{let x=structuredClone(d);mutate(x);test(x)}catch{killed++}}assert.equal(killed,4);console.log('PASS 4/4 mutations rejected');
