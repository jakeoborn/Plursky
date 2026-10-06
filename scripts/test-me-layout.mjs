#!/usr/bin/env node
// Me, as the board draws it, in the running app.
//   · identity: a name, or for an empty account the one action "Add your
//     name" (never a dash standing in for one)
//   · Plan / Memories / Crew / Badges are four round actions on ONE row; a
//     count shows only when there is one (an empty account is not a wall of
//     zeros), and a real count is shown
//   · the Plursky+ entry is fully on screen at scrollTop 0 (App Review 2.1(b):
//     the one paywall entry a fresh install can always reach), unchanged
//   · festival rows keep their title on one line at 320 (side by side with
//     its description, it broke one word per line)
//   · no horizontal overflow
// Both modes, 393 and 320, an empty account and a populated one. No network.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const FID = 'edc-lv-2026', AT = '2026-05-17T07:50:00Z';

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) for (const populated of [false, true]) {
    const tag = `${scheme} ${width} ${populated ? 'populated' : 'empty'}`;
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    try {
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
      await ctx.clock.install({ time: new Date(AT) });
      await ctx.addInitScript(({ FID, scheme, populated }) => {
        if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
        localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
        localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
        if (populated) { localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(['k15', 'k16', 'q17', 'bp8'])); localStorage.setItem('plursky_display_name', 'Test Raver'); }
      }, { FID, scheme, populated });
      await ctx.addInitScript(() => { if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity, addEventListener() {}, removeEventListener() {} }); });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=me`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-me-actions]') && document.querySelector('[data-appearance-row]'), null, { timeout: 60000 });
      await page.clock.runFor(2500); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const vis = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
        const actions = [...document.querySelectorAll('[data-me-action]')].map(b => ({ key: b.dataset.meAction, top: Math.round(b.getBoundingClientRect().top), text: b.innerText.replace(/\s+/g, ' ').trim() }));
        const plus = [...document.querySelectorAll('button')].find(b => /^Plursky Plus/.test(b.getAttribute('aria-label') || '') || /Plursky\+/.test(b.innerText));
        const tab = document.querySelector('nav, [role=tablist]');
        const save = [...document.querySelectorAll('button')].find(b => /Save this festival|^Saved/.test(b.innerText));
        const saveTitle = save ? [...save.querySelectorAll('span')].find(s => /^(Save this festival|Saved)$/.test(s.textContent.trim())) : null;
        const lh = saveTitle ? parseFloat(getComputedStyle(saveTitle).lineHeight) || 20 : 0;
        return {
          dash: [...document.querySelectorAll('.duo-name')].some(n => vis(n) && n.textContent.trim() === '—'),
          addName: !!document.querySelector('[data-me-add-name]'),
          actions,
          plusBottom: plus ? plus.getBoundingClientRect().bottom : null,
          limit: innerHeight - (tab ? tab.getBoundingClientRect().height : 0),
          saveTitleLines: saveTitle ? Math.round(saveTitle.getBoundingClientRect().height / lh) : null,
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
          saved: (window.savedInLineup ? window.savedInLineup(JSON.parse(localStorage.getItem('edc-lv-2026_saved_v1') || '[]')) : []).length,
        };
      });
      check(!r.dash, `${tag}: a dash stands in for the name`);
      check(r.addName === !populated, `${tag}: "Add your name" ${r.addName ? 'shown' : 'missing'} for ${populated ? 'a named' : 'an unnamed'} account`);
      check(r.actions.length === 4 && new Set(r.actions.map(a => a.top)).size === 1, `${tag}: actions are not four on one row: ${JSON.stringify(r.actions)}`);
      check(r.actions.every(a => !/(^|\s)0$/.test(a.text)), `${tag}: an action shows a zero count: ${JSON.stringify(r.actions.map(a => a.text))}`);
      if (populated) check(r.actions.find(a => a.key === 'saved')?.text === `Plan ${r.saved}` && r.saved > 0, `${tag}: Plan does not show the plan's ${r.saved} sets: ${JSON.stringify(r.actions)}`);
      check(r.plusBottom != null && r.plusBottom <= r.limit, `${tag}: the Plursky+ entry is not fully on screen at the top (bottom ${r.plusBottom}, limit ${r.limit})`);
      check(r.saveTitleLines === 1, `${tag}: "Save this festival" runs over ${r.saveTitleLines} lines`);
      check(!r.overflowX, `${tag}: Me scrolls sideways`);
    } catch (err) { check(false, `${tag} threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
if (problems.length) {
  console.log(`  ✗ me layout: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  process.exit(1);
}
console.log(`  ✓ me layout: ${checks} checks — identity, actions without zeros, Plursky+ on screen, festival rows`);
