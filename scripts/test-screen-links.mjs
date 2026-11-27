#!/usr/bin/env node
// Screen links — every screen has its own address, Back follows it, and a
// refresh or a copied link lands on the same screen.
//
// Graded in the running app, because the contract is between React state and
// the browser's own history: the address is written FROM state, popstate
// writes state back, an in-app back (closing the artist sheet, the lineup/map
// back pill) must step BACK through history rather than stack a new entry,
// and a festival switch must leave the screen it was made from one Back away
// without the outgoing page writing its own ?f= into the address mid-reload.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
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

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

// Same pinned clock as test-landing-routing.mjs, so ACL is enterable.
const AT = '2026-10-10T23:00:00Z';
const INIT = { active_festival_id: 'edc-lv-2026', active_festival_explicit: '1' };

async function open(browser, url) {
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles', viewport: { width: 393, height: 800 } });
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
// The app is up when the lineup is loaded and the root has mounted. Polled
// through reloads, whose context teardown throws mid-evaluate.
async function ready(page, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const ok = await page.evaluate(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0
        && (document.getElementById('root') || { children: [] }).children.length > 0);
      if (ok) { await sleep(700); return true; }
    } catch {}
    await sleep(150);
  }
  return false;
}
const here = (page) => page.evaluate(() => ({
  search: location.search, title: document.title, len: history.length,
  plk: history.state && history.state.plk, fest: window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id,
}));
const param = (h, k) => new URLSearchParams(h.search).get(k);
async function waitFor(page, pred, ms = 8000) {
  const end = Date.now() + ms; let last = null;
  while (Date.now() < end) {
    try { last = await here(page); if (pred(last)) return last; } catch {}
    await sleep(120);
  }
  return last;
}
async function waitForFestival(page, id, ms = 60000) {
  const end = Date.now() + ms; let last = null;
  while (Date.now() < end) {
    try {
      last = await here(page);
      const root = await page.evaluate(() => (document.getElementById('root') || { children: [] }).children.length);
      if (last.fest === id && root > 0) { await sleep(700); return await here(page); }
    } catch {}
    await sleep(150);
  }
  return last;
}

try {
  await serverReady(`${BASE}index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // ── 1. A deep link is rewritten to the full address, not stripped ───────
  {
    const { ctx, page } = await open(browser, `${BASE}?tab=lineup`);
    let h = await waitFor(page, x => param(x, 'tab') === 'lineup');
    check(param(h, 'tab') === 'lineup', `?tab=lineup keeps tab=lineup in the address (${h.search})`);
    check(param(h, 'f') === 'edc-lv-2026', `the address names the festival (${h.search})`);
    check(/^Lineup · .*Plursky$/.test(h.title), `the page title names the screen ("${h.title}")`);

    // ── 2. A tab change is its own entry, and Back returns to it ───────────
    const len0 = h.len;
    await page.evaluate(() => window._pushNav({ tab: 'me', artist: null }));
    h = await waitFor(page, x => param(x, 'tab') === 'me');
    check(param(h, 'tab') === 'me', `moving to Me writes tab=me (${h.search})`);
    check(h.len === len0 + 1, `moving to Me adds one history entry (${len0} → ${h.len})`);
    await page.goBack();
    h = await waitFor(page, x => param(x, 'tab') === 'lineup' && /^Lineup/.test(x.title));
    check(param(h, 'tab') === 'lineup' && /^Lineup/.test(h.title), `browser Back returns to Lineup (${h.search}, "${h.title}")`);
    await page.goForward();
    h = await waitFor(page, x => param(x, 'tab') === 'me' && /^Me ·/.test(x.title));
    check(/^Me ·/.test(h.title), `browser Forward returns to Me ("${h.title}")`);
    await page.goBack();
    h = await waitFor(page, x => /^Lineup/.test(x.title));

    // ── 3. The artist sheet has its own address; closing it steps back ─────
    const a = await page.evaluate(() => ({ id: window.ARTISTS[0].id, name: window.ARTISTS[0].name }));
    await page.evaluate((id) => window._pushNav({ artist: id }), a.id);
    h = await waitFor(page, x => param(x, 'artist') === a.id);
    // history.length counts forward entries too, so it is read AFTER the
    // first open (which replaced the forward Me entry), not before.
    const lenA = h.len;
    check(param(h, 'artist') === a.id, `opening an artist writes artist= (${h.search})`);
    check(h.title.startsWith(a.name), `the title names the artist ("${h.title}")`);
    const plkOpen = h.plk;
    await page.evaluate(() => window._popNav());
    h = await waitFor(page, x => !param(x, 'artist'));
    check(!param(h, 'artist'), `an in-app back closes the artist in the address (${h.search})`);
    check(h.plk === plkOpen - 1, `the in-app back stepped BACK through history (entry ${plkOpen} → ${h.plk})`);

    // Browser Back closes an open sheet too.
    await page.evaluate((id) => window._pushNav({ artist: id }), a.id);
    await waitFor(page, x => param(x, 'artist') === a.id);
    await page.goBack();
    h = await waitFor(page, x => !param(x, 'artist') && /^Lineup/.test(x.title));
    check(!param(h, 'artist') && /^Lineup/.test(h.title), `browser Back closes the artist sheet ("${h.title}")`);
    check(h.len === lenA, `opening, closing and reopening did not pile up entries (${lenA} → ${h.len})`);

    // ── 4. A refresh lands on the same screen ──────────────────────────────
    await page.goForward();
    await waitFor(page, x => param(x, 'artist') === a.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    h = await waitFor(page, x => x.title.startsWith(a.name));
    check(h.title.startsWith(a.name) && param(h, 'artist') === a.id, `refresh reopens the same artist ("${h.title}", ${h.search})`);
    await ctx.close();
  }

  // ── 5. General Home's address stays bare ─────────────────────────────────
  {
    const { ctx, page } = await open(browser, BASE);
    const h = await here(page);
    check(h.search === '', `General Home leaves the address bare (${h.search})`);
    await ctx.close();
  }

  // ── 6. A festival switch is one Back away, and does not bounce ───────────
  {
    const { ctx, page } = await open(browser, `${BASE}?f=edc-lv-2026&tab=lineup`);
    await waitFor(page, x => param(x, 'tab') === 'lineup');
    await page.evaluate(() => setActiveFestivalAndReload('acl-2026'));
    let h = await waitForFestival(page, 'acl-2026');
    check(h && h.fest === 'acl-2026', `the switch lands in ACL (${JSON.stringify(h)})`);
    h = await waitFor(page, x => param(x, 'f') === 'acl-2026');
    check(param(h, 'f') === 'acl-2026', `the address names the new festival (${h && h.search})`);
    await sleep(1500);
    h = await here(page);
    check(h.fest === 'acl-2026', `the switch did not bounce back to the old festival (${h.fest})`);
    await page.goBack();
    h = await waitForFestival(page, 'edc-lv-2026');
    h = await waitFor(page, x => param(x, 'tab') === 'lineup' && x.fest === 'edc-lv-2026', 15000);
    check(h && h.fest === 'edc-lv-2026' && param(h, 'tab') === 'lineup',
      `Back after a switch returns to the old festival's Lineup (${JSON.stringify(h)})`);
    await ctx.close();
  }

  await browser.close();
} catch (e) {
  failed++;
  console.log(`  ✗  screen links crashed — ${String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')}`);
} finally {
  server.kill();
}
if (failed) { console.log(`  ✗ screen links: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ screen links: ${checks} checks (addresses, Back, in-app back, refresh, festival switch)`);
