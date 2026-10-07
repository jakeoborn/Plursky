#!/usr/bin/env node
// Attendance is festival-scoped. Night keys are bare day numbers, so the old
// single map (plursky_attended_v1) put EDC's night-1 sets and ACL's night-1
// sets in one bucket and every reader counted both. This boots the real app
// with a legacy map holding both festivals' night-1 sets plus an id no set
// bills, and proves: migration attributes each row to the festival that bills
// it; the active festival reads only its own; a write lands in the artist's
// festival; an archive snapshot holds only its festival; the unknown row is
// kept but never shown; and a reload under the other festival flips the view.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
const reservePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(e=>e?reject(e):resolve(a.port));});});
const PORT=await reservePort();
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
let failures=0, passes=0;
const check=(name,ok,detail)=>{ if(ok){passes++;console.log(`  ✓ ${name}`);} else {failures++;console.log(`  ✗ ${name}${detail?` — ${detail}`:''}`);} };
const ACL='acl-2026', EDC='edc-lv-2026';
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const ctx=await browser.newContext({serviceWorkers:'block'});
  const page=await ctx.newPage();
  const boot=async(fid)=>{
    await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(f=>typeof getAllAttended==='function'&&typeof getAttendedStore==='function'&&window._DATA_SETS&&window.FESTIVAL_CONFIG?.id===f,fid,{timeout:30000});
  };
  // Pick fixture ids from the real data sets (first night-1 act of each).
  await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window._DATA_SETS&&Object.keys(window._DATA_SETS).length>3,null,{timeout:30000});
  const ids=await page.evaluate(({ACL,EDC})=>{
    const pick=(f,n)=>window._DATA_SETS[f].artists.filter(a=>String(a.day)==='1').slice(0,n).map(a=>a.id);
    return {acl:pick(ACL,2),edc:pick(EDC,2)};
  },{ACL,EDC});
  check('fixtures: two night-1 acts at each festival',ids.acl.length===2&&ids.edc.length===2,JSON.stringify(ids));
  const legacy={'1':[ids.acl[0],ids.edc[0],'no-such-artist-zz']};
  await page.evaluate(({legacy,ACL})=>{localStorage.clear();localStorage.setItem('onboarded','v1');localStorage.setItem('active_festival_id',ACL);localStorage.setItem('active_festival_explicit','1');localStorage.setItem('plursky_attended_v1',JSON.stringify(legacy));},{legacy,ACL});
  await boot(ACL);
  let r=await page.evaluate(()=>({mine:getAllAttended(),store:getAttendedStore(),count:getAttendedCount(),v1:localStorage.getItem('plursky_attended_v1')}));
  check('ACL reads only its own night-1 set',JSON.stringify(r.mine)===JSON.stringify({'1':[ids.acl[0]]}),JSON.stringify(r.mine));
  check('ACL count excludes EDC attendance',r.count===1,String(r.count));
  check('migration: the EDC row lands in EDC',JSON.stringify(r.store[EDC])===JSON.stringify({'1':[ids.edc[0]]}),JSON.stringify(r.store));
  check('migration: an unbilled id is kept, unattributed, not on ACL',JSON.stringify(r.store._unattributed)===JSON.stringify({'1':['no-such-artist-zz']}));
  check('migration leaves the v1 map in place',r.v1===JSON.stringify(legacy));
  // Writes go to the festival that bills the artist, whichever festival is active.
  r=await page.evaluate(({ids})=>{markAttended('1',ids.acl[1],'manual');markAttended('1',ids.edc[1],'shazam');return {mine:getAllAttended(),edc:getAllAttended('edc-lv-2026'),night:[...getAttendedForNight('1')]};},{ids});
  check('a write for an ACL act lands in ACL',r.mine['1'].includes(ids.acl[1]));
  check('a write for an EDC act while ACL is active lands in EDC, not ACL',r.edc['1'].includes(ids.edc[1])&&!r.mine['1'].includes(ids.edc[1]),JSON.stringify(r));
  check('night 1 on ACL holds only ACL acts',r.night.every(id=>ids.acl.includes(id))&&r.night.length===2,JSON.stringify(r.night));
  r=await page.evaluate(({ids})=>{unmarkAttended('1',ids.edc[1]);return getAllAttended('edc-lv-2026');},{ids});
  check('unmark removes from the artist\'s festival',!r['1'].includes(ids.edc[1]));
  // Archive snapshot of EDC carries EDC attendance only.
  r=await page.evaluate(()=>{localStorage.removeItem('plursky_festival_archive_v1');archiveFestival('edc-lv-2026','EDC',{});return JSON.parse(localStorage.getItem('plursky_festival_archive_v1')||'{}')['edc-lv-2026']?.attended;});
  check('EDC archive snapshot holds EDC attendance only',JSON.stringify(r)===JSON.stringify({'1':[ids.edc[0]]}),JSON.stringify(r));
  // Reload under EDC: the view flips, nothing re-migrates over the v2 store.
  await page.evaluate(()=>{localStorage.setItem('active_festival_id','edc-lv-2026');});
  await boot(EDC);
  r=await page.evaluate(()=>({mine:getAllAttended(),acl:getAllAttended('acl-2026')}));
  check('reload under EDC reads only EDC',JSON.stringify(r.mine)===JSON.stringify({'1':[ids.edc[0]]}),JSON.stringify(r.mine));
  check('ACL attendance survives the switch',r.acl['1']?.length===2,JSON.stringify(r.acl));
  await browser.close();
} finally { server.kill(); }
console.log(`Attended scope: ${passes} passed, ${failures} failed`);
process.exit(failures?1:0);
