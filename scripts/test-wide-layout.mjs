#!/usr/bin/env node
// Wide layout — on a computer-width window the bottom tab bar becomes a side
// rail, reading screens sit in a centred column, the map takes the full
// width, and nothing scrolls sideways. On a phone nothing changes: the bar
// stays at the bottom with its four tabs and none of the rail's extras.
//
// WIDE_SHOTS=<dir> saves a screenshot of each screen checked, so the look
// can be reviewed (sanity.yml uploads them as an artifact).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serverReady } from './lib/server-ready.mjs';
import { wireVendor } from './lib/vendor-cdn.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reservePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const a = s.address(); const p = typeof a === 'object' && a ? a.port : 0; s.close(e => e ? reject(e) : resolve(p)); });
});
const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.WIDE_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const AT = '2026-10-10T23:00:00Z';
const INIT = { active_festival_id: 'edc-lv-2026', active_festival_explicit: '1' };

async function ready(page, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const ok = await page.evaluate(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0
        && (document.getElementById('root') || { children: [] }).children.length > 0);
      if (ok) { await sleep(900); return true; }
    } catch {}
    await sleep(150);
  }
  return false;
}
async function open(browser, url, width, height, scheme = 'dark') {
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles', viewport: { width, height }, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await wireVendor(ctx);
  await ctx.clock.install({ time: new Date(AT) });
  await ctx.addInitScript((kv) => {
    if (localStorage.getItem('__seeded') === '1') return;
    localStorage.setItem('__seeded', '1');
    localStorage.setItem('onboarded', 'v1');
    localStorage.setItem('user_name', 'Test');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, INIT);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready(page);
  return { ctx, page };
}
// A small JPEG beside each PNG, which sanity.yml can print into the job log
// when artifacts cannot be fetched (WIDE_SHOTS_LOG).
const shot = async (page, name) => {
  if (!SHOTS) return;
  try { await page.screenshot({ path: join(SHOTS, `${name}.png`) }); } catch {}
  if (process.env.WIDE_SHOTS_LOG) { try { await page.screenshot({ path: join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 55 }); } catch {} }
};

// Everything the checks need, read in one go.
const measure = (page) => page.evaluate(() => {
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const bar = document.querySelector('.ps-tabbar');
  const view = document.querySelector('.ps-view');
  const shell = document.querySelector('.ps-shell');
  const lit = [...document.querySelectorAll('.ps-tabbar button[aria-current="page"]')]
    .filter(b => getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(b).backgroundColor !== 'transparent')
    .map(b => b.textContent.replace('←', '').trim());
  const se = document.scrollingElement;
  return {
    vw: innerWidth, vh: innerHeight,
    bar: box(bar), barShown: !!bar && getComputedStyle(bar).display !== 'none',
    tabs: bar ? bar.querySelectorAll('button.ps-tab').length : 0,
    head: !!document.querySelector('.ps-rail-head'), more: !!document.querySelector('.ps-rail-more'),
    labels: bar ? [...bar.querySelectorAll('button.ps-tab')].map(b => b.textContent.trim()) : [],
    view: box(view), shell: box(shell), lit,
    docOverflow: se.scrollWidth - se.clientWidth,
    viewOverflow: view ? view.scrollWidth - view.clientWidth : 0,
    search: location.search,
  };
});

try {
  await serverReady(`${BASE}index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // ── 1. A computer: the rail, the column, the full-width map ─────────────
  for (const scheme of ['dark', 'light']) {
    const screens = scheme === 'dark'
      ? [['today', ''], ['lineup', '&tab=lineup'], ['map', '&tab=map'], ['me', '&tab=me'], ['music', '&tab=spotify'], ['artists', '&tab=artists'], ['past', '&tab=past']]
      : [['today', ''], ['lineup', '&tab=lineup']];
    for (const [name, q] of screens) {
      const { ctx, page } = await open(browser, `${BASE}?f=edc-lv-2026${q}`, 1440, 900, scheme);
      const m = await measure(page);
      const tag = `${scheme} 1440 ${name}`;
      check(m.barShown && m.bar && Math.abs(m.bar.w - 240) <= 2 && m.bar.h >= m.vh - 2,
        `${tag}: the tab bar is a full-height side rail (${JSON.stringify(m.bar)})`);
      check(m.shell && m.bar && Math.abs(m.bar.x - m.shell.x) <= 2, `${tag}: the rail sits on the left edge of the app`);
      check(m.head && m.more, `${tag}: the rail shows its brand head and More links`);
      check(m.labels.includes('Lineup') && m.labels.includes('Music') && m.labels.includes('Past festivals'),
        `${tag}: the rail lists the tabs and the More links (${m.labels.join('|')})`);
      if (name === 'map') check(m.view && m.view.w >= 1000, `${tag}: the map takes the full width (${m.view && m.view.w})`);
      else check(m.view && m.view.w <= 900 && m.view.w >= 700, `${tag}: the screen sits in a reading column (${m.view && m.view.w})`);
      check(m.view && m.bar && m.view.x >= m.bar.x + m.bar.w - 1, `${tag}: the screen does not slide under the rail`);
      check(m.docOverflow <= 1 && m.viewOverflow <= 1, `${tag}: nothing scrolls sideways (${m.docOverflow}, ${m.viewOverflow})`);
      check(m.lit.length === 1, `${tag}: exactly one rail item is lit (${m.lit.join('|')})`);
      if (name === 'music') check(m.lit[0] === 'Music', `${tag}: Music is the lit item, not Me (${m.lit.join('|')})`);
      if (name === 'lineup') check(m.lit[0] === 'Lineup', `${tag}: Lineup is lit (${m.lit.join('|')})`);
      await shot(page, `wide-${scheme}-${name}`);
      await ctx.close();
    }
  }

  // ── 2. An artist page keeps the rail; a rail tab leaves the artist ─────
  {
    const { ctx, page } = await open(browser, `${BASE}?f=edc-lv-2026&tab=lineup`, 1440, 900);
    const id = await page.evaluate(() => window.ARTISTS[0].id);
    await page.goto(`${BASE}?f=edc-lv-2026&tab=lineup&artist=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    let m = await measure(page);
    check(m.barShown && m.bar && Math.abs(m.bar.w - 240) <= 2, `1440 artist: the rail stays on an artist page (${JSON.stringify(m.bar)})`);
    check(m.view && m.view.w <= 900, `1440 artist: the artist page sits in the column (${m.view && m.view.w})`);
    check(m.docOverflow <= 1, `1440 artist: nothing scrolls sideways`);
    await shot(page, 'wide-dark-artist');
    // The pinned clock is after EDC, so the rail's tabs are Today / Lineup /
    // Memories / Me; Memories is the one that is not the screen underneath.
    await page.locator('.ps-tabbar button.ps-tab', { hasText: 'Memories' }).first().click();
    await sleep(700);
    m = await measure(page);
    check(/tab=memories/.test(m.search) && !/artist=/.test(m.search), `1440 artist: the rail's Memories leaves the artist page (${m.search})`);
    await page.locator('.ps-rail-all').click();
    await sleep(900);
    const landed = await page.evaluate(() => !document.querySelector('.ps-tabbar') && location.search === '');
    check(landed, 'All festivals in the rail goes to the festival list');
    m = await measure(page);
    check(m.view && m.view.w <= 900 && m.docOverflow <= 1, `1440 festival list: a centred column with no sideways scroll (${m.view && m.view.w})`);
    await shot(page, 'wide-dark-festivals');
    await ctx.close();
  }

  // ── 3. A small laptop still gets the rail and a sensible column ─────────
  {
    const { ctx, page } = await open(browser, `${BASE}?f=edc-lv-2026&tab=lineup`, 1100, 760);
    const m = await measure(page);
    check(m.barShown && m.bar && Math.abs(m.bar.w - 240) <= 2, `1100: the rail is there`);
    check(m.view && m.view.w >= 700 && m.docOverflow <= 1 && m.viewOverflow <= 1, `1100: the column fits beside the rail (${m.view && m.view.w})`);
    await shot(page, 'wide-dark-1100-lineup');
    await ctx.close();
  }

  // ── 4. A phone is unchanged ─────────────────────────────────────────────
  for (const q of ['', '&tab=lineup', '&tab=spotify']) {
    const { ctx, page } = await open(browser, `${BASE}?f=edc-lv-2026${q}`, 393, 852);
    const m = await measure(page);
    const tag = `393 ${q || 'today'}`;
    check(!m.head && !m.more, `${tag}: no rail extras on a phone`);
    check(m.tabs === 4, `${tag}: the bottom bar has its four tabs (${m.tabs})`);
    check(m.bar && Math.abs(m.bar.w - 393) <= 1 && m.bar.y + m.bar.h >= m.vh - 1, `${tag}: the bar runs along the bottom (${JSON.stringify(m.bar)})`);
    check(m.view && Math.abs(m.view.w - 393) <= 1, `${tag}: the screen is full width (${m.view && m.view.w})`);
    if (!q) await shot(page, 'phone-dark-today');
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, `${BASE}?f=edc-lv-2026&tab=lineup`, 393, 852);
    const id = await page.evaluate(() => window.ARTISTS[0].id);
    await page.goto(`${BASE}?f=edc-lv-2026&tab=lineup&artist=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    const m = await measure(page);
    check(!m.bar, `393 artist: an artist page has no tab bar on a phone`);
    await ctx.close();
  }

  await browser.close();
} catch (e) {
  failed++;
  console.log(`  ✗  wide layout crashed — ${String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')}`);
} finally {
  server.kill();
}
if (failed) { console.log(`  ✗ wide layout: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ wide layout: ${checks} checks (side rail, reading column, full-width map, phone unchanged)`);
