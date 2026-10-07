#!/usr/bin/env node
// Apple Music playlist integration: the real createAppleMusicPlaylist in the
// booted app, with api.music.apple.com stubbed at the network layer.
// Proves (1) a song is used only when the catalog CREDITS the billed act or
// the moment's artist (the first search result used to be taken as a
// fallback, seeding a stranger's song); (2) an act or song with no credited
// match is skipped and named, never guessed; (3) every failure carries a
// user-facing sentence with its reason; (4) the request Apple receives holds
// exactly the expected track ids. No network, no Apple account.
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
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const ctx=await browser.newContext({serviceWorkers:'block'});
  await ctx.addInitScript(()=>{localStorage.setItem('onboarded','v1');localStorage.setItem('active_festival_id','acl-2026');localStorage.setItem('active_festival_explicit','1');
    try{Object.defineProperty(navigator,'getBattery',{value:undefined});}catch{}});
  // Catalog stub: term → songs. Mode switches per case through window.__amMode.
  const song=(id,name,artistName)=>({id,type:'songs',attributes:{name,artistName}});
  let mode='ok', posted=null;
  await ctx.route(/api\.music\.apple\.com\/v1\/me\/storefront/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:'us'}]})}));
  await ctx.route(/api\.music\.apple\.com\/v1\/catalog\/us\/search/,r=>{
    if(mode==='search503') return r.fulfill({status:503,body:'{}'});
    const term=new URL(r.request().url()).searchParams.get('term');
    const T={
      'ALPHA': [song('x1','Alpha Song','Somebody Else'),song('a1','One','ALPHA'),song('a2','Two','Guest & ALPHA'),song('a3','Three','ALPHA feat. Guest')],
      'NOMATCH': [song('x2','Nomatch','A Different Act'),song('x3','Nomatch (Cover)','Cover Band')],
      'Ribs Lorde': [song('x4','Ribs','Lorde Tribute Band'),song('l2','Ribs (Live)','Lorde'),song('l1','Ribs','Lorde')],
      'Ghost Song Nobody': [song('x5','Ghost Song','Someone Real')],
    };
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:{songs:{data:T[term]||[]}}})});
  });
  await ctx.route(/api\.music\.apple\.com\/v1\/me\/library\/playlists/,r=>{
    posted=JSON.parse(r.request().postData()||'{}');
    if(mode==='create500') return r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({errors:[{detail:'Upstream unavailable'}]})});
    if(mode==='create401') return r.fulfill({status:401,body:'{}'});
    return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({data:[{id:'p.TEST123'}]})});
  });
  const page=await ctx.newPage();
  const logs=[];
  page.on('console',m=>{ if(m.text().includes('[plursky:applemusic]')) logs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof createAppleMusicPlaylist==='function'&&typeof _amPickArtistSongs==='function'&&Array.isArray(window.ARTISTS)&&window.ARTISTS.length>1,null,{timeout:30000});
  const setup=await page.evaluate(()=>{
    // Two fixture acts in the active lineup, then saved. Names are synthetic so
    // no real catalog result can stand in for them.
    const a=window.ARTISTS[0], b=window.ARTISTS[1];
    a.name='ALPHA'; a.tier=3; b.name='NOMATCH'; b.tier=1;
    localStorage.setItem('am_user_token','test-user-token');
    window._readMoments=()=>({n1:[{confirmedTitle:'Ribs',confirmedArtist:'Lorde'},{confirmedTitle:'Ghost Song',confirmedArtist:'Nobody'},{confirmedTitle:'No Artist'}]});
    return { saved:[a.id,b.id], dev: typeof APPLE_DEV_TOKEN==='string' && APPLE_DEV_TOKEN.length>20 };
  });
  check('developer token is configured',setup.dev);
  const run=async(m,opts={})=>{ mode=m; posted=null; return page.evaluate(async({saved,opts})=>{ localStorage.setItem('am_user_token','test-user-token'); return createAppleMusicPlaylist({saved},opts); },{saved:setup.saved,opts}); };

  // Pure matcher cases.
  const pure=await page.evaluate(()=>{
    const s=(id,name,artistName)=>({id,attributes:{name,artistName}});
    return {
      above:_amPickArtistSongs([s('1','x','Above & Beyond')],'Above & Beyond',5).length,
      b2b:_amPickArtistSongs([s('1','x','Peach'),s('2','y','Shanti Celeste'),s('3','z','Peachy Keen')],'Shanti Celeste B2B Peach',5).map(x=>x.id).join(','),
      collab:_amPickArtistSongs([s('1','x','Fred again.., Skrillex & Four Tet')],'Four Tet',5).length,
      substr:_amPickArtistSongs([s('1','x','Lorde Tribute Band'),s('2','y','Lordes')],'Lorde',5).length,
      diacritic:_amPickArtistSongs([s('1','x','Beyoncé')],'Beyonce',5).length,
      noArtistSong:_amPickMomentSong([s('1','Ribs','Lorde')],'Ribs',''),
      exactFirst:_amPickMomentSong([s('2','Ribs (Live)','Lorde'),s('1','Ribs','Lorde')],'Ribs','Lorde')?.id,
    };
  });
  check('"Above & Beyond" matches its own credit',pure.above===1,JSON.stringify(pure));
  check('a B2B billing matches either side, not a lookalike',pure.b2b==='1,2',pure.b2b);
  check('a multi-artist credit matches one of its artists',pure.collab===1);
  check('a substring is not a credit ("Lorde Tribute Band", "Lordes")',pure.substr===0);
  check('diacritics fold ("Beyoncé" = "Beyonce")',pure.diacritic===1);
  check('a moment song with no artist never matches',pure.noArtistSong===null);
  check('an exact title beats a base-title match',pure.exactFirst==='1',pure.exactFirst);

  // 1. Saved sets: only credited songs; the act with no credited song is skipped and named.
  let r=await run('ok');
  const ids=(posted?.relationships?.tracks?.data||[]).map(t=>t.id).join(',');
  check('saved: Apple receives exactly the credited songs',ids==='a1,a2,a3',ids);
  check('saved: the first (uncredited) search result is never used',!ids.includes('x'));
  check('saved: NOMATCH skipped and named, not guessed',r.ok&&r.missed===1&&r.skipped?.some(x=>x.name==='NOMATCH'&&x.reason==='no_match'),JSON.stringify(r.skipped));
  check('saved: playlist url returned',r.url==='https://music.apple.com/library/playlist/p.TEST123',r.url);

  // 2. Soundtrack: the credited exact title, never the tribute band's or the live cut.
  r=await run('ok',{soundtrack:true});
  const sids=(posted?.relationships?.tracks?.data||[]).map(t=>t.id);
  check('soundtrack: "Ribs" by Lorde resolves to the exact credited song',sids[0]==='l1'&&!sids.includes('x4')&&!sids.includes('l2'),sids.join(','));
  check('soundtrack: an uncredited result is skipped ("Ghost Song")',!sids.includes('x5')&&r.skipped?.some(x=>x.kind==='song'&&x.reason==='no_match'));
  check('soundtrack: a song with no artist is skipped with its reason',r.skipped?.some(x=>x.kind==='song'&&x.reason==='no_artist'));
  check('soundtrack: songsMatched counts only real matches',r.songsMatched===1,String(r.songsMatched));

  // 3. Failures each carry a user-facing sentence with the reason.
  r=await run('create500');
  check('create 500: reason + Apple detail reach the user',r.reason==='create_fail'&&/500/.test(r.userMessage)&&/Upstream unavailable/.test(r.userMessage),r.userMessage);
  r=await run('create401');
  const tokenGone=await page.evaluate(()=>localStorage.getItem('am_user_token'));
  check('create 401: reconnect message, stale token cleared',r.reason==='reconnect'&&/reconnect/i.test(r.userMessage),r.userMessage);
  check('create 401: token removed',tokenGone===null,String(tokenGone));
  r=await run('search503');
  check('every search fails: connection message, not "no songs"',r.reason==='no_tracks'&&r.searchFailed===true&&/connection/i.test(r.userMessage),r.userMessage);
  r=await page.evaluate(async(saved)=>{ localStorage.removeItem('am_user_token'); return createAppleMusicPlaylist({saved},{}); },setup.saved);
  check('not connected (localhost): the reason reaches the user',r.reason==='not_connected'&&/plursky\.com/.test(r.userMessage||''),r.userMessage);
  r=await page.evaluate(async()=>{ localStorage.setItem('am_user_token','t'); return createAppleMusicPlaylist({saved:[]},{}); });
  check('nothing saved: "Save sets first"',r.reason==='empty'&&/save sets/i.test(r.userMessage),r.userMessage);
  // Every reason the code can return has words.
  const reasons=await page.evaluate(()=>['not_configured','not_connected','empty','no_tracks','reconnect','create_fail','mystery'].map(reason=>appleMusicFailureMessage({ok:false,reason,skipped:[]})));
  check('every failure reason has a non-empty sentence',reasons.every(x=>x&&x.length>10),JSON.stringify(reasons));
  check('every outcome is logged with the [plursky:applemusic] tag',logs.filter(l=>/created|failed/.test(l)).length>=7,`${logs.length} log lines`);
  await browser.close();
} finally { server.kill(); }
console.log(`Apple Music playlist: ${passes} passed, ${failures} failed`);
process.exit(failures?1:0);
