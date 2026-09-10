#!/usr/bin/env node
// Focused regression for a mixed photo-import batch: one valid EXIF JPEG lands
// while one unreadable image fails. The toast must acknowledge the landed
// moment and must never claim the whole import failed.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const PORT=8766, URL=`http://127.0.0.1:${PORT}/?tab=me`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
  for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok)break;}catch{} await sleep(100);}
  const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const ctx=await browser.newContext({timezoneId:'America/Los_Angeles'});
  await ctx.addInitScript(()=>{localStorage.setItem('onboarded','v1');localStorage.setItem('user_name','Test');localStorage.setItem('active_festival_id','edc-lv-2026');localStorage.setItem('active_festival_explicit','1');localStorage.setItem('edc-lv-2026_saved_v1',JSON.stringify(['n4']));localStorage.removeItem('plursky_moments_v1');indexedDB.deleteDatabase('plursky_memories');});
  const page=await ctx.newPage(); await page.goto(URL,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>Array.isArray(window.ARTISTS)&&window.ARTISTS.length>0,{timeout:20000}); await sleep(800);
  await page.locator('button').filter({hasText:/MEMORIES/}).first().click();
  await page.locator('input[type=file][multiple]').waitFor({state:'attached'});
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;canvas.getContext('2d').fillRect(0,0,1,1);const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg'));
    const b=new Uint8Array(await blob.arrayBuffer()),t=new Uint8Array(64),d=new DataView(t.buffer);d.setUint8(0,73);d.setUint8(1,73);d.setUint16(2,42,true);d.setUint32(4,8,true);d.setUint16(8,1,true);d.setUint16(10,0x8769,true);d.setUint16(12,4,true);d.setUint32(14,1,true);d.setUint32(18,26,true);d.setUint16(26,1,true);d.setUint16(28,0x9003,true);d.setUint16(30,2,true);d.setUint32(32,20,true);d.setUint32(36,44,true);const s='2026:05:15 23:35:00\0';for(let i=0;i<20;i++)t[44+i]=s.charCodeAt(i)||0;const a=new Uint8Array(74);new DataView(a.buffer).setUint16(0,0xffe1);new DataView(a.buffer).setUint16(2,72);a.set([69,120,105,102,0,0],4);a.set(t,10);const full=new Uint8Array(2+a.length+b.length-2);full.set(b.slice(0,2));full.set(a,2);full.set(b.slice(2),2+a.length);
    const tx=new DataTransfer();tx.items.add(new File([full],'good.jpg',{type:'image/jpeg'}));tx.items.add(new File([new Uint8Array([1,2,3])],'broken.jpg',{type:'image/jpeg'}));const input=document.querySelector('input[type=file][multiple]');input.files=tx.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('plursky_moments_v1')||'{}')['1']?.length===1,{timeout:15000});
  const toast=await page.locator('[role=status]').textContent();
  if((toast||'') !== 'Imported 1 · 1 failed'||/Couldn't import|tap to review/i.test(toast||''))throw new Error(`contradictory toast: ${toast}`);
  console.log('✓ mixed batch landed 1 moment and reported the exact non-action toast "Imported 1 · 1 failed"'); await browser.close();
} finally {server.kill('SIGTERM');}
