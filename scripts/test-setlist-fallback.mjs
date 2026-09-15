#!/usr/bin/env node
// Regression: the setlist.fm fallback fails closed. A setlist is used for a
// festival's song estimate only when it is affirmatively that edition: played
// on one of the festival's own day dates AND at a venue named by the
// festival's own metadata. Before this, any venue containing a hard-coded EDC
// or ACL name matched every festival, and with no match the artist's most
// recent setlist (setlists[0]) was used anyway, so a Lollapalooza moment could
// wear a LIKELY song from an unrelated show.
// setlist.fm and Supabase are stubbed; no network, no personal media.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reservePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(e=>e?reject(e):resolve(a.port));});});
const ACTIVE='acl-2026', EDC='edc-lv-2026', LOLLA='lollapalooza-2026', NOCT='nocturnal-wonderland-2026';
const PORT=await reservePort();
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
try {
  for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok)break;}catch{} await sleep(100);}
  const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const ctx=await browser.newContext({serviceWorkers:'block'});
  await ctx.addInitScript(a=>{localStorage.setItem('onboarded','v1');localStorage.setItem('active_festival_id',a);localStorage.setItem('active_festival_explicit','1');},ACTIVE);
  // No curated tracklist anywhere, so every lookup reaches the setlist.fm fallback.
  await ctx.route(/supabase\.co\/rest\/v1\/tracklists/,route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof _getTracklistForArtist==='function'&&typeof _getSetlistFmData==='function'&&window._DATA_SETS&&Array.isArray(window.ARTISTS)&&window.ARTISTS.length>0,null,{timeout:30000});
  const r=await page.evaluate(async({EDC,LOLLA,NOCT,ACL})=>{
    const row=(venue,city,date,songs)=>({eventDate:date,venue:{name:venue,city:{name:city}},sets:{set:[{song:songs.map(name=>({name}))}]}});
    const EDC_ROW=row('Las Vegas Motor Speedway','Las Vegas','16-05-2026',['E1','E2']);
    const CLUB_ROW=row('Brooklyn Mirage','Brooklyn','01-08-2026',['C1','C2']);
    const LOLLA_ROW=row('Grant Park','Chicago','31-07-2026',['L1','L2']);
    const LOLLA_2025=row('Grant Park','Chicago','02-08-2025',['Old1']);
    let rows=[];
    window.fetchSetlists=async()=>rows;
    const songs=d=>d?(d.songs||[]).join(','):null;
    const out={setup:[EDC,LOLLA,NOCT].filter(f=>!window._DATA_SETS[f]).map(f=>`${f} not in _DATA_SETS`)};
    // 1. Only an EDC / Motor Speedway row: Lollapalooza and Nocturnal get nothing.
    rows=[EDC_ROW];
    out.edcOnlyLolla=songs(await _getTracklistForArtist('Case One',LOLLA));
    out.edcOnlyNoct=songs(await _getTracklistForArtist('Case One',NOCT));
    // 2. Several rows, none for the requested edition: the first row is not a default.
    rows=[CLUB_ROW,EDC_ROW,LOLLA_2025];
    out.noMatch=songs(await _getTracklistForArtist('Case Two',LOLLA));
    // 3. An affirmative row for the requested edition still resolves.
    rows=[CLUB_ROW,EDC_ROW,LOLLA_ROW];
    out.lolla=songs(await _getTracklistForArtist('Case Three',LOLLA));
    // 4. The same artist at two festivals stays isolated in the cache.
    out.edc=songs(await _getTracklistForArtist('Case Three',EDC));
    out.lollaAgain=songs(await _getTracklistForArtist('Case Three',LOLLA));
    // 5. A festival id with no loaded config never borrows the active festival's metadata.
    out.unknown=songs(await _getSetlistFmData('Case Four','no-such-festival-2026'));
    // 6. ACL runs two weekends; its dayDates are weekend one only. The lookup,
    // cache and timing carry no weekend, so weekend two fails closed, and with
    // both weekends listed (weekend two first) weekend one's setlist is chosen.
    rows=[row('Zilker Park','Austin','10-10-2026',['W2a','W2b'])];
    out.aclW2=songs(await _getSetlistFmData('Case Five',ACL));
    rows=[row('Zilker Park','Austin','10-10-2026',['W2a']),row('Zilker Park','Austin','03-10-2026',['W1a','W1b'])];
    out.aclBoth=songs(await _getSetlistFmData('Case Five',ACL));
    rows=[row('Zilker Park','Austin','03-10-2026',['W1a'])];
    out.aclW1=songs(await _getSetlistFmData('Case Five',ACL));
    rows=[row('Zilker Park','Austin','06-10-2026',['Gap'])];
    out.aclGap=songs(await _getSetlistFmData('Case Five',ACL));
    // 7. A brand or display name is not a venue: ACL Live at The Moody Theater
    // on an ACL festival date is a different room.
    rows=[row('ACL Live at The Moody Theater','Austin','03-10-2026',['Moody'])];
    out.aclMoody=songs(await _getSetlistFmData('Case Six',ACL));
    rows=[row('Austin City Limits Live at The Moody Theater','Austin','10-10-2026',['Moody2'])];
    out.aclMoody2=songs(await _getSetlistFmData('Case Six',ACL));
    // Data gap report: a festival with day dates but no physical venue alias
    // (locationShort / venue.name) can never match, so it gets no setlist estimate.
    out.noAlias=Object.entries(window._DATA_SETS).filter(([,d])=>d&&d.config&&d.config.dayDates&&!(String(d.config.locationShort||'').trim().length>=3||String(d.config.venue?.name||'').trim().length>=3)).map(([id])=>id);
    return out;
  },{EDC,LOLLA,NOCT,ACL:ACTIVE});
  await browser.close();
  const problems=[...r.setup];
  if(r.edcOnlyLolla!==null)problems.push(`an EDC / Motor Speedway setlist was used for ${LOLLA}: ${r.edcOnlyLolla}`);
  if(r.edcOnlyNoct!==null)problems.push(`an EDC / Motor Speedway setlist was used for ${NOCT}: ${r.edcOnlyNoct}`);
  if(r.noMatch!==null)problems.push(`with no ${LOLLA} match, a setlist was still used (setlists[0] default): ${r.noMatch}`);
  if(r.lolla!=='L1,L2')problems.push(`the affirmative ${LOLLA} setlist did not resolve: ${r.lolla}`);
  if(r.edc!=='E1,E2')problems.push(`the affirmative ${EDC} setlist did not resolve for the same artist: ${r.edc}`);
  if(r.lollaAgain!=='L1,L2')problems.push(`the cache mixed festivals for one artist: ${LOLLA} now reads ${r.lollaAgain}`);
  if(r.unknown!==null)problems.push(`an unknown festival id matched a setlist: ${r.unknown}`);
  if(r.aclW2!==null)problems.push(`an ACL weekend-two setlist (Oct 10) was used, but the cache and timing carry no weekend: ${r.aclW2}`);
  if(r.aclBoth!=='W1a,W1b')problems.push(`with both ACL weekends listed, weekend one's setlist was not the one chosen: ${r.aclBoth}`);
  if(r.aclW1!=='W1a')problems.push(`an ACL weekend-one setlist (Zilker Park, Oct 3) did not resolve: ${r.aclW1}`);
  if(r.aclGap!==null)problems.push(`a setlist in ACL's gap week (Oct 6) was used: ${r.aclGap}`);
  if(r.aclMoody!==null||r.aclMoody2!==null)problems.push(`a room named after the brand (ACL Live at The Moody Theater) matched ACL: ${r.aclMoody} / ${r.aclMoody2}`);
  if(r.noAlias.length)console.log(`  note: no physical venue alias, so no setlist estimate: ${r.noAlias.join(', ')}`);
  if(problems.length){console.error('✗ setlist.fm fallback:\n  '+problems.join('\n  '));process.exit(1);}
  console.log('✓ setlist.fm fallback fails closed: a setlist counts only on the festival\'s own dates at its own venue, no first-row default, cached per festival, ACL weekend one only, physical venues only');
} finally {server.kill('SIGTERM');}
