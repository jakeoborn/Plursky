import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serverReady } from './lib/server-ready.mjs';
const port = await new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
await serverReady(`http://127.0.0.1:${port}/index.html`);
const executablePath=['/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const outDir=process.argv[2]||join(tmpdir(),'artist-pilot');
mkdirSync(outDir,{recursive:true});
try {
for(const width of [320,393]) for(const mode of ['dark','light']) {
 const c=await browser.newContext({viewport:{width,height:852},serviceWorkers:'block'});
 await c.addInitScript(mode=>{localStorage.setItem('onboarded','v1');localStorage.setItem('active_festival_id','acl-2026');localStorage.setItem('active_festival_explicit','1');localStorage.setItem('plursky.appearance',mode);},mode);
 const p=await c.newPage();
 await p.goto(`http://127.0.0.1:${port}/index.html`);
 await p.waitForFunction(()=>window.ARTISTS?.length && typeof getArtistImage==='function');
 const artist=await p.evaluate(()=>window.ARTISTS.find(x=>x.name.toLowerCase()==='skrillex'));
 console.log('Artist',artist?.id);
 if(!artist) throw new Error('Skrillex not on pilot festival');
 await p.goto(`http://127.0.0.1:${port}/index.html?artist=${artist.id}`);
 await p.waitForSelector('[data-artist-photo-credit="1"]');
 await p.waitForTimeout(1000);
 console.log(width,mode,await p.evaluate(()=>({credit:document.querySelector('[data-artist-photo-credit]').innerText,image:getArtistImage('Skrillex').url,overflow:document.documentElement.scrollWidth>innerWidth})));
 await p.screenshot({path:`${outDir}/${width}-${mode}.png`});await c.close();
}
} finally {await browser.close();server.kill();}
