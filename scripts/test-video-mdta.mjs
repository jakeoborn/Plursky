#!/usr/bin/env node
// Regression: current iPhones store a video's GPS and its accuracy radius in
// QuickTime `mdta` metadata (moov/meta/keys + ilst), not the legacy ©xyz atom.
// The import parser read only ©xyz, so every modern iPhone clip landed with no
// location and the tagger guessed its stage from the clock alone. The clips
// here are synthetic: built byte by byte, no personal media.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reservePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(e=>e?reject(e):resolve(a.port));});});
const PORT=await reservePort();
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
try {
  for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok)break;}catch{} await sleep(100);}
  const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const ctx=await browser.newContext({timezoneId:'America/Los_Angeles',serviceWorkers:'block'});
  await ctx.addInitScript(()=>{localStorage.setItem('onboarded','v1');localStorage.setItem('active_festival_id','edc-lv-2026');localStorage.setItem('active_festival_explicit','1');});
  const page=await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof _parseExifMeta==='function'&&typeof _matchArtistForPhoto==='function'&&Array.isArray(window.ARTISTS)&&window.ARTISTS.length>0,null,{timeout:30000});
  const r=await page.evaluate(async()=>{
    const enc=s=>new TextEncoder().encode(s);
    const u32=n=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n);return b;};
    const cat=(...parts)=>{const len=parts.reduce((s,p)=>s+p.length,0),o=new Uint8Array(len);let k=0;for(const p of parts){o.set(p,k);k+=p.length;}return o;};
    // Box types are four Latin-1 bytes: '©' is 0xA9, not UTF-8's C2 A9.
    const fourcc=t=>Uint8Array.from(t,c=>c.charCodeAt(0));
    const box=(type,...kids)=>{const body=cat(...kids);return cat(u32(8+body.length),fourcc(type),body);};
    const ftyp=box('ftyp',enc('qt  '),u32(0),enc('qt  '));
    // 2026-05-16 01:20:51 PDT, inside EDC Las Vegas night 1.
    const secs=Date.UTC(2026,4,16,8,20,51)/1000+2082844800;
    const mvhd=box('mvhd',u32(0),u32(secs),u32(secs),new Uint8Array(92));
    // QuickTime metadata: `meta` is NOT a full box, `hdlr` comes first.
    const qtMeta=(items)=>{
      const hdlr=box('hdlr',u32(0),u32(0),enc('mdta'),new Uint8Array(13));
      const keys=box('keys',u32(0),u32(items.length),...items.map(([k])=>cat(u32(8+enc(k).length),enc('mdta'),enc(k))));
      const ilst=box('ilst',...items.map(([,v],i)=>cat(u32(8+16+enc(v).length),u32(i+1),box('data',u32(1),u32(0),enc(v)))));
      return box('meta',hdlr,keys,ilst);
    };
    // A track-level meta numbers ITS keys from 1 as well; it must not leak
    // into the movie-level table. It sits AFTER the movie meta here, so one
    // shared key table would rename key 1 and lose the accuracy.
    const trak=box('trak',qtMeta([['com.apple.quicktime.camera.lens_model','+99.0000+99.0000/']]));
    const modern=cat(ftyp,box('mdat',new Uint8Array(64)),box('moov',mvhd,qtMeta([
      ['com.apple.quicktime.location.accuracy.horizontal','1337.357052'],
      ['com.apple.quicktime.location.ISO6709','+36.2738-115.0070+596.168/'],
    ]),trak));
    const tight=cat(ftyp,box('moov',mvhd,qtMeta([
      ['com.apple.quicktime.location.ISO6709','+36.2739-115.0071+595.571/'],
      ['com.apple.quicktime.location.accuracy.horizontal','4.733599'],
    ])));
    // Older phones: GPS in udta/©xyz (16-bit length + language, then text).
    const xyz=cat(new Uint8Array([0,0x12,0x15,0xc7]),enc('+36.2702-115.0109/'));
    const legacy=cat(ftyp,box('moov',mvhd,box('udta',box('©xyz',xyz))));
    const parse=async(bytes,name)=>_parseExifMeta(new File([bytes],name,{type:'video/quicktime'}));
    const m=await parse(modern,'modern.MOV'),t=await parse(tight,'tight.MOV'),l=await parse(legacy,'legacy.MOV');
    const tag=_matchArtistForPhoto(t,[],[],null),coarse=_matchArtistForPhoto(m,[],[],null);
    return {m,t,l,tag:{reason:tag.reason,ambiguous:!!tag.ambiguous,night:tag.night,gpsRejected:tag.gpsRejected},coarse:{gpsRejected:coarse.gpsRejected,ambiguous:!!coarse.ambiguous}};
  });
  const problems=[];
  const near=(a,b)=>a!=null&&Math.abs(a-b)<1e-6;
  if(!(near(r.m.lat,36.2738)&&near(r.m.lng,-115.007)))problems.push(`mdta GPS not read: ${r.m.lat},${r.m.lng}`);
  if(!near(r.m.acc,1337.357052))problems.push(`mdta accuracy not read (track-level keys must not collide): ${r.m.acc}`);
  if(r.m.locationSource!=='video-mdta')problems.push(`locationSource ${r.m.locationSource}`);
  if(r.m.timestampSource!=='video-mvhd')problems.push(`capture time lost: ${r.m.timestampSource}`);
  if(!(near(r.t.lat,36.2739)&&near(r.t.acc,4.733599)))problems.push(`key order must not matter: ${r.t.lat} acc ${r.t.acc}`);
  if(!(near(r.l.lat,36.2702)&&near(r.l.lng,-115.0109)&&r.l.locationSource==='video-xyz'))problems.push(`legacy ©xyz regressed: ${JSON.stringify(r.l)}`);
  if(!r.coarse.gpsRejected)problems.push('a 1.3 km fix was used for a stage decision');
  if(r.tag.gpsRejected||r.tag.night!==1)problems.push(`tight fix not used for tagging: ${JSON.stringify(r.tag)}`);
  await browser.close();
  if(problems.length){console.error('✗ video mdta GPS:\n  '+problems.join('\n  '));process.exit(1);}
  console.log('✓ iPhone mdta GPS + accuracy read (track keys scoped, any key order); legacy ©xyz still read; a 1.3 km fix is blinded for stages');
} finally {server.kill('SIGTERM');}
