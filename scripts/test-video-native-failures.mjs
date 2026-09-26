#!/usr/bin/env node
// Native picker failure classes. Three picked clips through the mocked
// PHPicker bridge: one whose read fails (404, an iCloud-only item), one whose
// SAVE fails (IndexedDB quota), one that lands. Only the read failure may be
// reported as "couldn't be read" with the iCloud hint; a full disk is not an
// iCloud download problem.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
const reserve=()=>new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const port=await reserve(), server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser, fail=0;
const check=(ok,msg)=>{console.log(`${ok?'✓':'✗'} ${msg}`);if(!ok)fail++;};
try {
 if(!await serverReady(`http://127.0.0.1:${port}/index.html`))throw new Error('local server did not become ready');
 const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const ctx=await browser.newContext({timezoneId:'America/Los_Angeles',viewport:{width:393,height:852}});
 await ctx.addInitScript(()=>{localStorage.setItem('onboarded','v1');localStorage.setItem('user_name','Test');localStorage.setItem('active_festival_id','edc-lv-2026');localStorage.setItem('active_festival_explicit','1');localStorage.removeItem('plursky_moments_v1');indexedDB.deleteDatabase('plursky_memories');});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/?tab=me`);
 await page.waitForFunction(()=>Array.isArray(window.ARTISTS)&&window.ARTISTS.length>0,null,{timeout:30000});
 await page.locator('button').filter({hasText:/MEMORIES/}).first().click();
 await page.locator('input[type=file][multiple]').first().waitFor({state:'attached'});
 const buffer=readFileSync('scripts/fixtures/video-import-h264.mp4');
 const hooked=await page.evaluate(({bytes})=>{
  const data=Uint8Array.from(bytes), original=window.fetch.bind(window);
  window.fetch=async(url,...a)=>{const u=String(url);
   if(u.includes('/native-video/0.mp4'))return new Response('',{status:404});
   if(u.includes('/native-video/'))return new Response(new Blob([data],{type:'video/mp4'}),{status:200});
   return original(url,...a);};
  // The first MEDIA save (clip 1's video; clip 0 never gets this far) hits a full disk.
  const put=window._putPhoto; let first=true;
  window._putPhoto=async(id,blob)=>{if(first&&blob&&/^video\//.test(blob.type||'')){first=false;const e=new Error('The quota has been exceeded.');e.name='QuotaExceededError';throw e;}return put(id,blob);};
  window.__USE_NATIVE_PICKER__=true;
  window.Capacitor={isNativePlatform:()=>true,convertFileSrc:p=>p,Plugins:{FilePicker:{pickMedia:async()=>({files:[0,1,2].map(i=>({path:`/native-video/${i}.mp4`,name:`native-${i}.mp4`,mimeType:'video/mp4',size:data.length}))})}}};
  return typeof put==='function';
 },{bytes:[...buffer]});
 check(hooked,'_putPhoto is a global the save path calls (hook installed)');
 await page.getByRole('button',{name:/Import from camera roll/i}).first().click();
 await page.waitForFunction(()=>/couldn.t be read|Nothing could be read/.test(document.body.innerText),null,{timeout:30000}).catch(()=>{});
 await page.waitForTimeout(800);
 const r=await page.evaluate(()=>({text:document.body.innerText,moments:Object.values(JSON.parse(localStorage.getItem('plursky_moments_v1')||'{}')).flat().length}));
 check(r.moments===1,`exactly one clip landed (got ${r.moments})`);
 check(/\b1 item couldn.t be read/.test(r.text),'banner counts ONLY the read failure: "1 item couldn’t be read"');
 check(!/\b2 items couldn.t be read/.test(r.text),'the quota failure is not reported as unreadable');
 check(errors.length===0,`no page errors (${errors.join(' | ')||'none'})`);
} catch(e){console.log('✗ harness error:',e.message);fail++;}
finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');}
console.log(fail?`✗ test-video-native-failures: ${fail} failed`:'✓ test-video-native-failures: all passed');
process.exit(fail?1:0);
