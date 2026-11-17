#!/usr/bin/env node
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
const reserve=()=>new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const port=await reserve(), server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try {
 if(!await serverReady(`http://127.0.0.1:${port}/index.html`))throw new Error('local server did not become ready');
 const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const ctx=await browser.newContext({timezoneId:'America/Los_Angeles',viewport:{width:393,height:852},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{localStorage.setItem('onboarded','v1');localStorage.setItem('user_name','Test');localStorage.setItem('active_festival_id','edc-lv-2026');localStorage.setItem('active_festival_explicit','1');localStorage.removeItem('plursky_moments_v1');indexedDB.deleteDatabase('plursky_memories');});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/?tab=memories`);await page.waitForFunction(()=>Array.isArray(window.ARTISTS)&&window.ARTISTS.length>0,null,{timeout:30000});

 const input=page.locator('input[type=file][multiple]').first();await input.waitFor({state:'attached'});
 const source=process.env.PLURSKY_VIDEO_FIXTURE || 'scripts/fixtures/video-import-h264.mp4'; const buffer=readFileSync(source);
 // #384 (main) skips a file whose size and first 2 KB match one already in the
 // library, so 20 byte-identical copies are 1 import + 19 duplicates. Give each
 // clip its own size with a trailing MP4 'free' box (ignored by decoders).
 const clipBytes=i=>{const n=8+i+1;const free=Buffer.alloc(n);free.writeUInt32BE(n,0);free.write('free',4,'latin1');return Buffer.concat([buffer,free]);};
 const files=Array.from({length:20},(_,i)=>({name:`clip-${String(i+1).padStart(2,'0')}.mp4`,mimeType:'video/mp4',buffer:clipBytes(i)}));
 const start=Date.now();await input.setInputFiles(files);
 await page.waitForFunction(()=>{const t=document.body.innerText;return /20 need a set|20 tagged|20 failed|20 skipped/.test(t)},null,{timeout:180000});
 const results=await page.evaluate(async()=>{const raw=JSON.parse(localStorage.getItem('plursky_moments_v1')||'{}');const items=Object.values(raw).flat();const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('plursky_memories');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});const stores=[...db.objectStoreNames];let saved=0;for(const item of items){if(!item.photoId)continue;const match=await new Promise(r=>{const req=db.transaction(stores[0],'readonly').objectStore(stores[0]).get(item.photoId);req.onsuccess=()=>r(!!req.result);req.onerror=()=>r(false)});if(match)saved++;}return {moments:items.length,video:items.filter(x=>x.kind==='video').length,saved,stores,batchText:document.body.innerText.match(/✓[^\n]*?(?:tagged|need a set)[^\n]*/)?.[0]||'',needsRetag:items.filter(x=>x.needsRetag).length,poster:items.filter(x=>x.posterId).length};});
 await page.locator('[data-import-review]').waitFor({state:'visible',timeout:5000});
 await page.waitForTimeout(500);
 await page.screenshot({path:'/tmp/plursky-20-video-review.png',fullPage:true});
 await page.locator('[data-import-review]').getByRole('button',{name:/DONE/i}).first().click();
 await page.waitForTimeout(300); await page.screenshot({path:'/tmp/plursky-20-video-wall.png',fullPage:true});
 console.log(JSON.stringify({elapsedSec:(Date.now()-start)/1000,fileCount:20,bytesEach:buffer.length,codec:'H.264 sample',...results,pageErrors:errors},null,2));
 if(results.moments!==20||results.video!==20||results.saved!==20||results.poster!==20||errors.length)process.exitCode=1;
 // Poster regression (sanity 2026-11-10: 19/20 web posters). A frame read right
 // after `seeked` can come back unpainted (nothing drawn, alpha 0). That must be
 // re-read, not judged black: with drawImage drawing NOTHING for the first four
 // video reads (one per candidate time, enough to null every poster before the
 // fix), the poster must still come back. Control: an always-unpainted video
 // still resolves null, so this cannot pass by skipping the check.
 const unpainted=await page.evaluate(async({bytes})=>{const proto=CanvasRenderingContext2D.prototype;const real=proto.drawImage;let skip=0;proto.drawImage=function(src,...a){if(src instanceof HTMLVideoElement&&skip>0){skip--;return;}return real.call(this,src,...a);};
   const blob=new Blob([Uint8Array.from(bytes)],{type:'video/mp4'});
   try{skip=4;const healed=await _videoPosterBlob(blob);skip=1e9;const never=await _videoPosterBlob(blob);return {healed:!!healed,never:!!never};}finally{proto.drawImage=real;}},{bytes:[...buffer]});
 console.log(JSON.stringify({posterUnpaintedRetry:unpainted}));
 if(!unpainted.healed||unpainted.never)process.exitCode=1;
 // The native bridge returns paths. Verify the refactored importer fetches one
 // at a time, commits each video, and does not hold all 20 Blob/File objects.
 const nctx=await browser.newContext({timezoneId:'America/Los_Angeles',viewport:{width:393,height:852},deviceScaleFactor:1});
 await nctx.addInitScript(()=>{localStorage.setItem('onboarded','v1');localStorage.setItem('user_name','Test');localStorage.setItem('active_festival_id','edc-lv-2026');localStorage.setItem('active_festival_explicit','1');localStorage.removeItem('plursky_moments_v1');indexedDB.deleteDatabase('plursky_memories');});
 const native=await nctx.newPage();const nativeErrors=[];native.on('pageerror',e=>nativeErrors.push(e.message));
 let requests=0,maxInFlight=0;
 await native.goto(`http://127.0.0.1:${port}/?tab=memories`);await native.waitForFunction(()=>Array.isArray(window.ARTISTS)&&window.ARTISTS.length>0,null,{timeout:30000});
 await native.locator('input[type=file][multiple]').first().waitFor({state:'attached'});
 await native.evaluate(async ({bytes})=>{const original=window.fetch.bind(window);const data=Uint8Array.from(bytes);const clip=i=>{const n=8+i+1;const out=new Uint8Array(data.length+n);out.set(data);const dv=new DataView(out.buffer);dv.setUint32(data.length,n);out.set([102,114,101,101],data.length+4);return out;};window.__nativeFetch={inFlight:0,max:0,count:0};window.fetch=async (url,...args)=>{if(String(url).includes('/native-video/')){window.__nativeFetch.inFlight++;window.__nativeFetch.count++;window.__nativeFetch.max=Math.max(window.__nativeFetch.max,window.__nativeFetch.inFlight);await new Promise(r=>setTimeout(r,10));window.__nativeFetch.inFlight--;const i=Number((String(url).match(/\/native-video\/(\d+)/)||[])[1]||0);return new Response(new Blob([clip(i)],{type:'video/mp4'}),{status:200});}return original(url,...args)};window.__USE_NATIVE_PICKER__=true;window.Capacitor={isNativePlatform:()=>true,convertFileSrc:p=>p,Plugins:{FilePicker:{pickMedia:async()=>({files:Array.from({length:20},(_,i)=>({path:`/native-video/${i}.mp4`,name:`native-${i}.mp4`,mimeType:'video/mp4',size:data.length+8+i+1}))})}}};},{bytes:[...buffer]});
 await native.getByRole('button',{name:/Import from camera roll/i}).first().click();
 try{await native.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('plursky_moments_v1')||'{}')).flat().length===20,null,{timeout:15000});}catch(e){console.log('native diagnostic',nativeErrors,await native.evaluate(()=>({text:document.body.innerText.slice(0,900), count:Object.values(JSON.parse(localStorage.getItem('plursky_moments_v1')||'{}')).flat().length})));throw e;}
 const nresult=await native.evaluate(()=>{const counts=window.__nativeFetch;const items=Object.values(JSON.parse(localStorage.getItem('plursky_moments_v1')||'{}')).flat();return {moments:items.length,videos:items.filter(x=>x.kind==='video').length,posters:items.filter(x=>x.posterId).length,requests:counts.count,maxInFlight:counts.max};});
 console.log(JSON.stringify({nativeBridgeMock:true,...nresult,nativeErrors},null,2));
 if(nresult.moments!==20||nresult.videos!==20||nresult.posters!==20||nresult.requests!==20||nresult.maxInFlight!==1||nativeErrors.length)process.exitCode=1;
 await nctx.close();
 await browser.close();
}finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');}
