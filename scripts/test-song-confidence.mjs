#!/usr/bin/env node
// Regression: a moment's song estimate comes from the moment's OWN festival
// (its tracklists, day dates and time zone), cached per festival, and a
// tracklist cue measured from the scheduled start is "likely", never "exact".
// Before this, an EDC moment viewed while ACL was active queried ACL's
// tracklists, the cache was keyed by artist name alone, takenAt was read in
// the viewer's zone, and a cue position wore the EXACT badge.
// Tracklists are stubbed per festival_id; no network, no personal media.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reservePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(e=>e?reject(e):resolve(a.port));});});
const FEST='edc-lv-2026', ACTIVE='acl-2026';
const TRACKS=[{timeMs:0,title:'Opener'},{timeMs:10*60000,title:'Ten'},{timeMs:20*60000,title:'Twenty'}];
const PORT=await reservePort();
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  // The same moment viewed from the festival's zone and from the far side of the world.
  const run=async timezoneId=>{
    const ctx=await browser.newContext({timezoneId,serviceWorkers:'block'});
    await ctx.addInitScript(a=>{localStorage.setItem('onboarded','v1');localStorage.setItem('active_festival_id',a);localStorage.setItem('active_festival_explicit','1');},ACTIVE);
    const asked=[];
    await ctx.route(/supabase\.co\/rest\/v1\/tracklists/,route=>{
      const fid=(new URL(route.request().url()).searchParams.get('festival_id')||'').replace(/^eq\./,'');
      asked.push(fid);
      route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(fid===FEST?[{tracks:TRACKS,source:'1001tracklists',source_url:'https://example.test/tl'}]:[])});
    });
    const page=await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof _matchSongAtTime==='function'&&typeof _resolveMomentSong==='function'&&typeof _checkinTakenAt==='function'&&window._DATA_SETS&&Array.isArray(window.ARTISTS)&&window.ARTISTS.length>0,null,{timeout:30000});
    const r=await page.evaluate(async FEST=>{
      window.fetchSetlists=async()=>[]; // no setlist.fm fallback here
      const ds=window._DATA_SETS[FEST], cfg=ds.config, hhmm=/^\d{1,2}:\d{2}$/;
      const a=ds.artists.find(x=>hhmm.test(x.start||'')&&hhmm.test(x.end||'')&&cfg.dayDates&&cfg.dayDates[x.day]);
      const startMs=_wallMs(cfg.dayDates[a.day],a.start,cfg.tz);
      const takenAt=_checkinTakenAt(cfg,startMs+15*60000); // the festival's wall clock, 15 min into the set
      const data=await _getTracklistForArtist(a.name,FEST);
      const past=data?_matchSongAtTime(a,data,takenAt,FEST):null;
      const live=data?_matchSongAtTime(a,data,startMs+15*60000,FEST):null;
      const recap=await _resolveMomentSong({artistId:a.id,festivalId:FEST,takenAt});
      const other=await _getTracklistForArtist(a.name); // same name, the ACTIVE festival
      return {active:window.FESTIVAL_CONFIG.id,artist:a.name,takenAt,past,live,recap,other:other?other.source:null,
        label:typeof _songConfidenceLabel==='function'?_songConfidenceLabel(past&&past.confidence):null};
    },FEST);
    await ctx.close();
    return {...r,asked,timezoneId};
  };
  const runs=[await run('America/Los_Angeles'),await run('Asia/Tokyo')];
  await browser.close();
  const problems=[];
  for(const r of runs){
    const at=`[${r.timezoneId}, ${r.artist} @ ${r.takenAt}]`;
    if(r.active!==ACTIVE){problems.push(`${at} setup: active festival is ${r.active}, expected ${ACTIVE}`);continue;}
    if(!r.asked.includes(FEST))problems.push(`${at} the moment's festival (${FEST}) was never queried; asked: ${r.asked.join(',')||'none'}`);
    if(r.past?.song!=='Ten')problems.push(`${at} wrong or no song for a past-festival moment: ${JSON.stringify(r.past)}`);
    if(r.past&&r.past.confidence!=='likely')problems.push(`${at} a tracklist cue is labelled "${r.past.confidence}", must be "likely"`);
    if(r.label!=='LIKELY')problems.push(`${at} badge reads ${r.label}, must read LIKELY`);
    if(r.live?.song!=='Ten')problems.push(`${at} an instant (live "now") mapped to ${JSON.stringify(r.live)}`);
    if(r.recap?.title!=='Ten'||r.recap?.confidence!=='likely')problems.push(`${at} recap song ${JSON.stringify(r.recap)}, expected Ten / likely`);
    if(r.other!==null)problems.push(`${at} the active festival reused the other festival's cached tracklist (${r.other})`);
  }
  if(problems.length){console.error('✗ song confidence:\n  '+problems.join('\n  '));process.exit(1);}
  console.log('✓ song estimates read the moment\'s own festival (cached per festival, same answer in LA and Tokyo); a tracklist cue is LIKELY, never EXACT');
} finally {server.kill('SIGTERM');}
