#!/usr/bin/env node
// October 5 grid supersedes the historical July/September day split.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(readFileSync('data/festivals/iii-points-2026.js','utf8'),ctx);
const m=ctx.window.PLURSKY_FESTIVALS['iii-points-2026'];
const data=JSON.parse(readFileSync('data/programming/iii-points-2026.json','utf8'));
const rows=data.stages.flatMap(s=>s.days.flatMap(d=>d.rows.map(r=>({...r,day:d.day,stage:s.id}))));
function validate(acts){assert.equal(acts.length,231);for(const r of rows){let a=acts.find(a=>a.id===r.actId);assert.ok(a,r.name);for(const f of ['name','day','stage','start','end'])assert.equal(a[f],r[f],r.name+' '+f);assert.ok(!a.provisional&&!a.unscheduled,r.name);}}
validate(m.artists);
for(const field of ['start','end','day','stage']){let acts=JSON.parse(JSON.stringify(m.artists));acts[0][field]=field==='day'?3:field==='stage'?'invented':'05:00';assert.throws(()=>validate(acts),field+' mutant');}
assert.equal(m.stages.length,13);assert.ok(m.stages.every(s=>!['x','y','lat','lng'].some(k=>k in s)));
assert.equal(m.config.mapMode,'real');assert.equal(m.amenities.length,0);assert.equal(m.registry.scheduleTBA,false);
assert.equal(m.artists.find(a=>a.id==='iiip-dude-skywalker').day,1);assert.equal(m.artists.find(a=>a.id==='iiip-jeremy-ismael').day,2);
assert.equal(m.artists.find(a=>a.id==='iiip-loukeman').end,'18:05');
assert.ok(!m.artists.some(a=>['iiip-fakemink','iiip-nick-leon-b2b-safety-tranc'].includes(a.id)));
assert.equal(m.artists.find(a=>a.name==='Villu').id,'iiip-santiago-villu');
assert.equal(m.config.dayDates[1].d,16);assert.equal(m.config.dayDates[2].d,17);
// Exercise the app's real clock and clash helpers, independently deriving
// UTC instants from the printed date/clock (Miami UTC-4, pre-08:00 next day).
const modules=readdirSync('data/festivals').filter(f=>f.endsWith('.js')).sort().map(f=>readFileSync('data/festivals/'+f,'utf8')).join('\n');
const source=modules+'\n'+readFileSync('data.jsx','utf8');
const at=(r,time)=>{const [h,min]=time.split(':').map(Number);return Date.UTC(2026,9,15+r.day+(h<8?1:0),h+4,min);};
for(const iso of ['2026-10-16T22:30:00Z','2026-10-17T04:15:00Z','2026-10-17T08:30:00Z','2026-10-17T21:15:00Z','2026-10-18T04:15:00Z','2026-10-18T09:00:00Z','2026-10-15T04:15:00Z']){
 const ms=Date.parse(iso);class ClockDate extends Date{static now(){return ms;}}
 const store={active_festival_id:'iii-points-2026',active_festival_explicit:'1'};
 const c={window:{},console,Intl,Date:ClockDate,fetch:()=>{},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]}};
 vm.createContext(c);vm.runInContext(source+'\n;__live=[...NOW.liveIds].sort();__clash=_schedClash;',c);
 const want=rows.filter(r=>ms>=at(r,r.start)&&ms<at(r,r.end)).map(r=>r.actId).sort();
 assert.equal(JSON.stringify(c.__live),JSON.stringify(want),iso);
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j];const overlap=a.day===b.day&&at(a,a.start)<at(b,b.end)&&at(b,b.start)<at(a,a.end);
  assert.equal(c.__clash(a,b),overlap,a.name+' / '+b.name);
 }
}
console.log('✓ III clock: seven date/overnight scenarios; all 26,565 pairwise clashes match independent interval math');
console.log('✓ III Points app231 intervals, four mutants, no invented map, stable surviving IDs');
