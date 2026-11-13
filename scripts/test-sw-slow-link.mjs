#!/usr/bin/env node
// The service worker's own-origin path on a slow-but-alive connection.
//
// A festival connection rarely fails outright; it crawls. sw.js used to fetch
// the app's own files network-first with no deadline and fall back to the
// cache only on a FAILURE, so a reopened lineup waited ~90 s on emulated slow
// 3G with every byte already cached (#458 field matrix, 80 slow-3G cells).
// This gate boots the real index.html with the real sw.js against a local
// server that can hold every own-origin response open, and asserts:
//   1. held network + warm cache → the app mounts from the saved copy fast;
//   2. a fast network still wins (deploys propagate): a fresh index.html is
//      what the page gets when the server answers inside the deadline;
//   3. a slow network loses the race but still refreshes the cache in the
//      background, so the NEXT open has the new copy;
//   4. offline still opens from the cache;
//   5. negative control: the same held-network open on main's previous sw.js
//      (network-first, no deadline) shows no readable row, so (1) measures the fix;
//   6. negative control: the static SEO fallback in index.html is not "ready".
// "Ready" everywhere = a visible, React-rendered [data-set-name] row.
// Usage: node scripts/test-sw-slow-link.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { wireVendor } from './lib/vendor-cdn.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW_NEW = readFileSync(join(ROOT, 'sw.js'));
// The pre-fix own-origin handler, rebuilt from this sw.js so the control
// tracks the current precache list: only the own-origin respondWith changes.
const SW_OLD = (() => {
  const s = SW_NEW.toString('utf8');
  const out = s.replace(/  e\.respondWith\(ownOrigin\(e, req\)\);/, `  e.respondWith(
    fetch(req, { cache: 'no-store' }).then(resp => {
      if (resp && resp.status === 200)
        caches.open(CACHE).then(c => c.put(req, resp.clone()));
      return resp;
    }).catch(() =>
      caches.match(req).then(c => c || caches.match('./index.html'))
    )
  );`);
  if (out === s) throw new Error('negative control: could not find e.respondWith(ownOrigin(e, req)) in sw.js');
  return Buffer.from(out);
})();

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log(`  ✓ ${msg}`); } else { fails++; console.log(`  ✗ ${msg}`); } };

// mode: 'normal' answers at once; 'hold' never answers an own-origin request
// (a crawl that outlasts any test); 'slow' answers after SLOW_MS; 'static'
// answers everything except scripts (404), so only index.html's static SEO
// fallback can paint into #root.
const SLOW_MS = 6000;
function startServer(swBody) {
  const held = [];
  const state = { marker: 'm0', held: 0, _mode: 'normal',
    get mode() { return this._mode; },
    // Leaving 'hold' drops the held sockets: the browser keeps only six
    // HTTP/1.1 connections per host, and six held ones would queue every
    // later request behind them.
    set mode(m) { this._mode = m; while (held.length) held.pop().destroy(); } };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(ROOT, path);
    const send = () => {
      if (path === '/sw.js') {
        res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
        return res.end(swBody);
      }
      if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      let body = readFileSync(file);
      if (path === '/index.html') body = Buffer.from(body.toString('utf8').replace('</head>', `<meta name="sw-test" content="${state.marker}"></head>`));
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    };
    // The worker script itself always answers: the browser's update check is
    // not what this gate measures.
    if (state.mode === 'static' && path !== '/sw.js' && extname(path) === '.js') { res.writeHead(404); return res.end(); }
    if (path === '/sw.js' || state.mode === 'normal' || state.mode === 'static') return send();
    if (state.mode === 'slow') return void setTimeout(send, SLOW_MS);
    state.held++; held.push(res.socket); // 'hold': leave it open
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, state, port: server.address().port })));
}

const SEED = () => {
  localStorage.setItem('onboarded', 'v1');
  localStorage.setItem('plursky_display_name', 'Test');
  for (const k of ['cloud_nudge_seen', 'ft_guide_seen', 'notif_nudge_dismissed', 'plursky_recap_seen_v1']) localStorage.setItem(k, '1');
  // A festival with timed sets, so "ready" can mean a readable set row.
  localStorage.setItem('active_festival_id', 'acl-2026'); localStorage.setItem('active_festival_explicit', '1');
};
const APP_URL = (port) => `http://127.0.0.1:${port}/index.html?tab=lineup`;
// Ready = a React-rendered set row a thumb can read: index.html ships a static
// SEO fallback inside #root, so "root has children" is true before any script
// runs and proves nothing (the merge lane caught exactly that on 304e9fa0).
// Readable also means opaque: rows fade in, and a row at 10% opacity has
// height and text but cannot be read.
const READABLE = () => [...document.querySelectorAll('[data-set-name]')].some(e => {
  const b = e.getBoundingClientRect();
  if (!(b.height > 0 && b.top < innerHeight && e.textContent.trim())) return false;
  let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity;
  return o >= 0.9;
});
const rootHasChildren = () => document.getElementById('root')?.childElementCount > 0;
const mounted = (p, timeout) => p.waitForFunction(READABLE, null, { timeout }).then(() => true, () => false);
// Poll an async page predicate. (waitForFunction takes the Promise an async
// predicate returns as truthy and passes at once, before the worker exists.)
async function until(p, fn, timeout, arg) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await p.evaluate(fn, arg).catch(() => false)) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}
const marker = (p) => p.evaluate(() => document.querySelector('meta[name="sw-test"]')?.content || null).catch(() => null);

// Every open navigates to the lineup URL: the app rewrites its own URL after
// boot (drops ?tab=), so a bare reload would land on the festival picker.
// Warm a context: first visit online, worker installed, controlling, and the
// app shell + compiled app in its cache.
async function warm(browser, port) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  await wireVendor(ctx);
  await ctx.addInitScript(SEED);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP_URL(port), { waitUntil: 'domcontentloaded' });
  const up = await mounted(p, 30000);
  const cached = await until(p, async () => {
    if (!navigator.serviceWorker.controller) return false;
    const keys = await caches.keys(); const app = keys.find(k => /^plursky-v/.test(k)); if (!app) return false;
    const c = await caches.open(app); const ks = (await c.keys()).map(r => r.url);
    return ks.some(u => /\/index\.html$/.test(u)) && ks.some(u => /build\/app\.js\?v=/.test(u));
  }, 60000);
  if (!cached) throw new Error('warm: the worker never took control with index.html + build/app.js cached');
  return { ctx, p, errs, up };
}

// Same launch as the repo's other browser gates: CI has system Chrome, not Playwright's bundled build.
const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  // ── the fix ──
  {
    const { server, state, port } = await startServer(SW_NEW);
    const { ctx, p, errs, up } = await warm(browser, port);
    ok(up, 'first visit mounts and the worker caches the app');

    // 2. fast network wins: a new index.html marker reaches the page.
    state.marker = 'm1';
    await p.goto(APP_URL(port), { waitUntil: 'domcontentloaded' });
    ok(await mounted(p, 20000) && await marker(p) === 'm1', 'a network inside the deadline still serves the fresh index.html (deploys propagate)');

    // 1. held network: the saved copy answers.
    state.mode = 'hold'; state.marker = 'm2';
    const t0 = Date.now();
    await p.goto(APP_URL(port), { waitUntil: 'commit', timeout: 30000 }).catch(() => {});
    const fast = await mounted(p, 20000);
    const ms = Date.now() - t0;
    ok(fast, `held network + warm cache: a readable set row from the saved copy (${ms} ms)`);
    if (process.env.SW_SHOT) await p.screenshot({ path: process.env.SW_SHOT });
    ok(await marker(p) === 'm1', 'the held open shows the saved index.html, not a half-loaded one');
    ok(state.held > 0, `the server really held own-origin requests (${state.held})`);

    // 3. slow network: loses the race, refreshes the cache behind it.
    state.mode = 'slow'; state.marker = 'm3';
    await p.goto(APP_URL(port), { waitUntil: 'commit', timeout: 30000 }).catch(() => {});
    ok(await mounted(p, 20000) && await marker(p) === 'm1', 'a slow network loses to the saved copy');
    const refreshed = await until(p, async (url) => {
      const r = await caches.match(url);
      return !!r && (await r.text()).includes('content="m3"');
    }, SLOW_MS + 15000, APP_URL(port));
    ok(refreshed, 'the slow download finished in the background and refreshed the saved index.html');
    state.mode = 'hold';
    await p.goto(APP_URL(port), { waitUntil: 'commit', timeout: 30000 }).catch(() => {});
    ok(await mounted(p, 20000) && await marker(p) === 'm3', 'the next open (network held again) shows the refreshed copy');

    // 4. offline still opens.
    state.mode = 'normal';
    await ctx.setOffline(true);
    await p.goto(APP_URL(port), { waitUntil: 'commit', timeout: 30000 }).catch(() => {});
    ok(await mounted(p, 20000), 'offline: the app opens from the cache');
    await ctx.setOffline(false);

    ok(errs.length === 0, `no page errors${errs.length ? ` (${errs.slice(0, 2).join(' | ')})` : ''}`);
    await ctx.close();
    server.closeAllConnections(); server.close();
  }

  // ── 5. negative control: the pre-fix handler ──
  {
    const { server, state, port } = await startServer(SW_OLD);
    const { ctx, p, up } = await warm(browser, port);
    state.mode = 'hold';
    await p.goto(APP_URL(port), { waitUntil: 'commit', timeout: 15000 }).catch(() => {});
    const mountedOld = up && await mounted(p, 15000);
    ok(up && !mountedOld, 'negative control: main\'s previous network-first handler shows no readable set row on a held network (the gate can tell)');
    await ctx.close();
    server.closeAllConnections(); server.close();
  }

  // ── 6. negative control: the static fallback alone is not "ready" ──
  {
    const { server, state, port } = await startServer(SW_NEW);
    state.mode = 'static';
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await wireVendor(ctx);
    await ctx.addInitScript(SEED);
    const p = await ctx.newPage();
    await p.goto(APP_URL(port), { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);
    const fallback = await p.evaluate(rootHasChildren);
    const ready = await mounted(p, 3000);
    ok(fallback && !ready, `negative control: with no app scripts, #root holds only the static fallback (children: ${fallback}) and the ready check stays false (${ready})`);
    await ctx.close();
    server.closeAllConnections(); server.close();
  }
} finally {
  await browser.close();
}

console.log(fails ? `\n✗ sw slow link: ${fails} failed, ${passes} passed` : `\n✓ sw slow link: ${passes} checks — a warm app opens from its saved copy on a held network, a fast network still wins, a slow one refreshes behind it, offline opens; the old handler fails the same open`);
process.exit(fails ? 1 : 0);
