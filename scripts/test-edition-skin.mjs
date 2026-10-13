#!/usr/bin/env node
// Edition skin: a festival's own look on the Today header band (and the
// website title block), opt-in per festival config, the same in Dark and
// Light. Proves the skin is on for III Points and off for a control festival,
// that its text clears AA on every gradient stop, that the date chip and the
// circuit traces never collide with the header's tools or the viewport at 320
// and 393, and that the website page carries the same block.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
const reservePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(e=>e?reject(e):resolve(a.port));});});
let failures=0, passes=0;
const check=(name,ok,detail)=>{ if(ok){passes++;} else {failures++;console.log(`  ✗ ${name}${detail?` — ${detail}`:''}`);} };

// WCAG contrast of ink (with alpha, composited) on each band stop.
const hex=h=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const rgba=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return [...hex(s),1];const p=m[1].split(',').map(Number);return [p[0],p[1],p[2],p[3]??1];};
const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*b;};
const over=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
const src=readFileSync('data/festivals/iii-points-2026.js','utf8');
const skinBlock=src.slice(src.indexOf('editionSkin:'), src.indexOf('},', src.indexOf('editionSkin:')));
const stops=[...skinBlock.matchAll(/#[0-9A-Fa-f]{6}(?= \d+%)/g)].map(m=>hex(m[0]));
const inks=['ink','ink2','ink3'].map(k=>skinBlock.match(new RegExp(`\\b${k}: "([^"]+)"`))[1]);
const chip=hex(skinBlock.match(/chip: "([^"]+)"/)[1]);
check('control: the band has 3 gradient stops', stops.length===3, JSON.stringify(stops));
for (const [k,i] of inks.entries()) for (const s of stops) { const r=ratio(over(rgba(i),s),s); check(`ink${k?k+1:''} on ${s} clears AA (4.5)`, r>=4.5, r.toFixed(2)); }
check('chip ink on lime clears AA', ratio(hex(skinBlock.match(/chipInk: "([^"]+)"/)[1]),chip)>=4.5);

const PORT=await reservePort();
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const bands={};
  for (const fid of ['iii-points-2026','acl-2026']) for (const mode of ['dark','light']) for (const w of [393,320]) {
    const tag=`${fid} ${mode} ${w}`;
    const ctx=await browser.newContext({viewport:{width:w,height:800},serviceWorkers:'block'});
    await ctx.addInitScript(({fid,mode})=>{try{Object.defineProperty(navigator,'getBattery',{value:undefined});}catch{}
      localStorage.setItem('onboarded','v1');localStorage.setItem('active_festival_id',fid);localStorage.setItem('active_festival_explicit','1');localStorage.setItem('plursky.appearance',mode);},{fid,mode});
    const page=await ctx.newPage();
    try {
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${fid}&tab=home`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(f=>window.FESTIVAL_CONFIG?.id===f&&document.querySelector('header h1'),fid,{timeout:30000});
      await page.waitForTimeout(600);
      const r=await page.evaluate(()=>{
        const h=document.querySelector('header h1').closest('header');
        const box=e=>{const b=e.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom};};
        const chip=h.querySelector('[data-edition-chip]'), svg=h.querySelector('svg[aria-hidden="true"]:not(button svg)');
        return { on:h.dataset.editionSkin==='on', bg:getComputedStyle(h).backgroundImage, vw:innerWidth,
          chip:chip&&box(chip), svg:svg&&!svg.closest('button')&&box(svg),
          tools:[...h.querySelectorAll('button')].map(box), title:box(h.querySelector('h1')),
          titleInk:getComputedStyle(h.querySelector('h1')).color, sx:document.documentElement.scrollWidth>innerWidth };
      });
      if (fid==='acl-2026') { check(`${tag}: control festival has no edition skin`, !r.on && r.bg==='none', r.bg); }
      else {
        check(`${tag}: skin on`, r.on && /gradient/.test(r.bg), r.bg);
        bands[mode]=r.bg;
        check(`${tag}: title in skin ink`, r.titleInk==='rgb(11, 11, 15)', r.titleInk);
        check(`${tag}: date chip inside the viewport`, r.chip && r.chip.l>=15 && r.chip.r<=r.vw-15, JSON.stringify(r.chip));
        const hit=(a,b)=>a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
        check(`${tag}: circuit traces clear every tool and the title`, r.svg && !r.tools.some(t=>hit(t,r.svg)) && !hit(r.title,r.svg), JSON.stringify({svg:r.svg}));
        check(`${tag}: chip clears the traces`, !hit(r.chip,r.svg));
        check(`${tag}: no sideways scroll`, !r.sx);
      }
    } catch (e) { check(`${tag} threw`, false, String(e.message||e).split('\n')[0]); }
    await ctx.close();
  }
  check('the band is the same in Dark and Light', bands.dark && bands.dark===bands.light, JSON.stringify(bands));
  await browser.close();
} finally { server.kill(); }
const web=readFileSync('f/iii-points-2026/index.html','utf8'), ctl=readFileSync('f/acl-2026/index.html','utf8');
check('website: III Points title block carries the edition', /<header class="edition" style="--ed-band:linear-gradient/.test(web));
check('website: control page has no edition block', !/class="edition"/.test(ctl));
console.log(`  ${failures?'✗':'✓'} edition skin: ${passes} passed, ${failures} failed — III Points band in both modes at 393/320, AA on every stop, no collisions; ACL untouched`);
process.exit(failures?1:0);
