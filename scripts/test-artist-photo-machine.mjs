#!/usr/bin/env node
// Artist photo machine (machine.jsx + chrome.jsx), in the running app.
//   1. The table is exhaustive: every state × event pair is a handler or a
//      written-down no-op (null). The detector is checked against a copy with
//      a pair removed, and an unhandled pair warns in development.
//   2. Every transition rule, stepped directly: the asks, the cache answers,
//      a lookup's answer only for the request it answers, expiry, a write for
//      this artist in every state, unavailable/offline/error exits, UNMOUNT.
//   3. The hook in the app: a photo written while a lookup is in flight comes
//      up with no second lookup, and the late answer is dropped; another
//      artist's write changes nothing; a name change re-asks (the swatch used
//      to keep the previous act's photo); after unmount nothing is accepted.
//   4. The app boots and opens an artist page with no machine warnings.
//   5. A failed lookup settles: an empty answer ends in unavailable, a rejected
//      one in offline, one that could not be made (no token) in none. After
//      ONLINE a consumer with a lookup looks up again and recovers; one that
//      only looks up on mount (the hero) settles in none: no photo, not a
//      recovery, but not waiting in loading. The real hero, with its Spotify
//      search failing, answering an error or nothing, or with no token,
//      leaves loading.
// Every artist-image network lookup is stubbed empty.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
import { wireVendor } from './lib/vendor-cdn.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });

const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 800 }, serviceWorkers: 'block' });
  await wireVendor(ctx);
  await ctx.addInitScript(() => {
    localStorage.setItem('onboarded', 'v1');
    localStorage.setItem('active_festival_id', 'edc-lv-2026');
    localStorage.setItem('active_festival_explicit', '1');
    localStorage.setItem('artist_images_v1', '{}');
  });
  await ctx.route(/api\.spotify\.com|itunes\.apple\.com|theaudiodb\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  const warns = [], errors = [];
  page.on('console', m => { if (m.type() === 'warning' && /\[machine /.test(m.text())) warns.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const artist = await (async () => {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ARTIST_PHOTO_MACHINE === 'object' && Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0
      && document.getElementById('root')?.children.length > 0, null, { timeout: 60000 });
    return page.evaluate(() => { const a = window.ARTISTS.find(x => x.start && !/\bb2b\b/i.test(x.name) && !getPermanentArtistImage(x.name)); return { id: a.id, name: a.name }; });
  })();

  // ── 1. Exhaustive table ────────────────────────────────────────────────────
  const t = await page.evaluate(() => {
    const M = ARTIST_PHOTO_MACHINE;
    const clone = createMachine({ id: 'gap-probe', initial: M.initial, events: M.events,
      states: Object.fromEntries(Object.entries(M.states).map(([s, row]) => [s, { ...row }])) });
    delete clone.states.loading.CACHE_WRITTEN;
    const seen = [];
    const warn = console.warn; console.warn = (...a) => seen.push(a.join(' '));
    const snap = clone.start({ key: 'k', name: 'x', url: null, source: null, rec: null, req: 1 }, 'loading');
    const after = clone.step(snap, 'CACHE_WRITTEN', { rec: { url: 'u', source: 'spotify' } });
    console.warn = warn;
    return { gaps: machineGaps(M), states: Object.keys(M.states), events: M.events, cloneGaps: machineGaps(clone),
      illegalNoop: after === snap, warned: seen.some(w => /unhandled CACHE_WRITTEN in loading/.test(w)), dev: _machineDev() };
  });
  check(t.gaps.length === 0, `the artist photo table leaves pairs unhandled: ${t.gaps.join(', ')}`);
  check(JSON.stringify(t.states) === JSON.stringify(['none', 'loading', 'ready', 'unavailable', 'offline', 'error']), `states are ${t.states.join(', ')}`);
  check(t.events.length === 12 && ['MOUNT', 'PARAM_CHANGE', 'CACHE_HIT', 'CACHE_MISS', 'FETCH_RESOLVE', 'FETCH_MISS', 'FETCH_REJECT',
    'CACHE_WRITTEN', 'CACHE_EXPIRED', 'RETRY', 'ONLINE', 'UNMOUNT'].every(e => t.events.includes(e)), `events are ${t.events.join(', ')}`);
  check(t.cloneGaps.join() === 'loading × CACHE_WRITTEN', `control: the gap detector missed a removed pair (${t.cloneGaps.join(', ')})`);
  check(t.illegalNoop, 'an unhandled pair changed the snapshot');
  check(t.dev && t.warned, `an unhandled pair did not warn in development (dev=${t.dev})`);

  // ── 2. Transition rules, stepped ───────────────────────────────────────────
  const r = await page.evaluate(() => {
    const M = ARTIST_PHOTO_MACHINE;
    const at = (state, extra = {}) => M.start({ key: 'k', name: 'Act', url: null, source: null, rec: null, req: 3, ...extra }, state);
    const rec = { url: 'https://i.scdn.co/image/a', source: 'spotify' };
    const rec2 = { url: 'https://i.scdn.co/image/b', source: 'spotify' };
    const s = (snap, ev, p) => { const n = M.step(snap, ev, p); return { state: n.state, url: n.ctx.url, source: n.ctx.source, req: n.ctx.req, ask: n.ctx.ask, effect: n.effect, same: n === snap, stopped: n.stopped }; };
    const readyA = at('ready', { url: rec.url, source: 'spotify', rec });
    const stopped = M.step(readyA, 'UNMOUNT');
    return {
      mountName: s(at('none'), 'MOUNT', { key: 'k', name: 'Act' }),
      mountNoName: s(at('none', { name: '' }), 'MOUNT', { key: 'k', name: '' }),
      hit: s(at('loading'), 'CACHE_HIT', { rec }),
      missFetch: s(at('loading'), 'CACHE_MISS', { canFetch: true }),
      missNoFetch: s(at('loading'), 'CACHE_MISS', { canFetch: false }),
      missThrew: s(at('loading'), 'CACHE_MISS', { error: new Error('x') }),
      resolve: s(at('loading'), 'FETCH_RESOLVE', { req: 3, url: rec.url }),
      resolveStale: s(at('loading'), 'FETCH_RESOLVE', { req: 2, url: rec.url }),
      resolveNull: s(at('loading'), 'FETCH_RESOLVE', { req: 3, url: null }),
      miss: s(at('loading'), 'FETCH_MISS', { req: 3 }),
      reject: s(at('loading'), 'FETCH_REJECT', { req: 3 }),
      rejectNoLookup: s(at('loading'), 'FETCH_REJECT', { req: 3, noLookup: true }),
      rejectNoLookupStale: s(at('loading'), 'FETCH_REJECT', { req: 2, noLookup: true }),
      loadingWritten: s(at('loading'), 'CACHE_WRITTEN', { rec }),
      loadingExpired: s(at('loading'), 'CACHE_EXPIRED', { rec: null, canFetch: true }),
      readyWritten: s(readyA, 'CACHE_WRITTEN', { rec: rec2 }),
      readyWrittenEmpty: s(readyA, 'CACHE_WRITTEN', { rec: null }),
      readyLateAnswer: s(readyA, 'FETCH_RESOLVE', { req: 3, url: rec2.url }),
      readyExpiredKept: s(readyA, 'CACHE_EXPIRED', { rec: rec2, canFetch: true }),
      readyExpiredFetch: s(readyA, 'CACHE_EXPIRED', { rec: null, canFetch: true }),
      readyExpiredNone: s(readyA, 'CACHE_EXPIRED', { rec: null, canFetch: false }),
      readyParam: s(readyA, 'PARAM_CHANGE', { key: 'k2', name: 'Other' }),
      unavRetry: s(at('unavailable'), 'RETRY'),
      unavParam: s(at('unavailable'), 'PARAM_CHANGE', { key: 'k2', name: 'Other' }),
      unavWritten: s(at('unavailable'), 'CACHE_WRITTEN', { rec }),
      unavOnline: s(at('unavailable'), 'ONLINE'),
      unavExpired: s(at('unavailable'), 'CACHE_EXPIRED', { rec: null, canFetch: true }),
      offOnline: s(at('offline'), 'ONLINE'),
      offRetry: s(at('offline'), 'RETRY'),
      offWritten: s(at('offline'), 'CACHE_WRITTEN', { rec }),
      errOnline: s(at('error'), 'ONLINE'),
      errRetry: s(at('error'), 'RETRY'),
      errParam: s(at('error'), 'PARAM_CHANGE', { key: 'k2', name: 'Other' }),
      noneWritten: s(at('none'), 'CACHE_WRITTEN', { rec }),
      noneRetry: s(at('none'), 'RETRY'),
      noneRetryNoName: s(at('none', { name: '' }), 'RETRY'),
      noneExpired: s(at('none'), 'CACHE_EXPIRED', { rec: null, canFetch: true }),
      unmount: { stopped: stopped.stopped, after: M.step(stopped, 'CACHE_WRITTEN', { rec: rec2 }) === stopped },
    };
  });
  const is = (o, state, extra = {}) => o && o.state === state && Object.entries(extra).every(([k, v]) => o[k] === v);
  check(is(r.mountName, 'loading', { effect: 'read' }), `none + MOUNT with a name should read the store: ${JSON.stringify(r.mountName)}`);
  check(is(r.mountNoName, 'none'), `none + MOUNT with no name should stay none: ${JSON.stringify(r.mountNoName)}`);
  check(is(r.hit, 'ready', { url: 'https://i.scdn.co/image/a' }), `loading + CACHE_HIT: ${JSON.stringify(r.hit)}`);
  check(is(r.missFetch, 'loading', { effect: 'fetch', req: 4 }), `loading + CACHE_MISS (can fetch) should start request 4: ${JSON.stringify(r.missFetch)}`);
  check(is(r.missNoFetch, 'none'), `loading + CACHE_MISS (cannot fetch) should be none: ${JSON.stringify(r.missNoFetch)}`);
  check(is(r.missThrew, 'error'), `loading + a store that threw should be error: ${JSON.stringify(r.missThrew)}`);
  check(is(r.resolve, 'ready', { source: 'spotify' }), `loading + FETCH_RESOLVE: ${JSON.stringify(r.resolve)}`);
  check(r.resolveStale.same, 'loading took an answer for an older request');
  check(is(r.resolveNull, 'unavailable') && is(r.miss, 'unavailable'), 'an empty answer did not land on unavailable');
  check(is(r.reject, 'offline'), `a rejected lookup did not land on offline: ${JSON.stringify(r.reject)}`);
  check(is(r.rejectNoLookup, 'none') && r.rejectNoLookupStale.same, `a lookup that could not be made (no token) should settle in none, guarded by request: ${JSON.stringify(r.rejectNoLookup)}`);
  check(is(r.loadingWritten, 'ready', { url: 'https://i.scdn.co/image/a' }), `[f24] loading + CACHE_WRITTEN for this artist: ${JSON.stringify(r.loadingWritten)}`);
  check(r.loadingExpired.same, 'loading + CACHE_EXPIRED started a second ask');
  check(is(r.readyWritten, 'ready', { url: 'https://i.scdn.co/image/b', effect: null }), `ready + CACHE_WRITTEN should re-read without loading: ${JSON.stringify(r.readyWritten)}`);
  check(r.readyWrittenEmpty.same, 'ready + a write with nothing showable dropped the held URL');
  check(r.readyLateAnswer.same, 'ready took a late lookup answer over the written entry');
  check(is(r.readyExpiredKept, 'ready', { url: 'https://i.scdn.co/image/b' }), `ready + CACHE_EXPIRED with a showable entry: ${JSON.stringify(r.readyExpiredKept)}`);
  check(is(r.readyExpiredFetch, 'loading', { effect: 'fetch', url: null }), `ready + CACHE_EXPIRED, nothing left, can fetch: ${JSON.stringify(r.readyExpiredFetch)}`);
  check(is(r.readyExpiredNone, 'none', { url: null }), `ready + CACHE_EXPIRED, nothing left, no lookup: ${JSON.stringify(r.readyExpiredNone)}`);
  check(is(r.readyParam, 'loading', { effect: 'read', url: null }), `ready + PARAM_CHANGE should re-ask: ${JSON.stringify(r.readyParam)}`);
  check(is(r.unavRetry, 'loading') && is(r.unavParam, 'loading'), 'unavailable did not leave on RETRY / PARAM_CHANGE');
  check(is(r.unavWritten, 'ready'), 'unavailable + a write for this artist did not show it');
  check(r.unavOnline.same && r.unavExpired.same, 'unavailable left on ONLINE or CACHE_EXPIRED (it was answered: no)');
  check(is(r.offOnline, 'loading') && is(r.offRetry, 'loading'), 'offline did not retry on ONLINE / RETRY');
  check(is(r.mountName, 'loading', { ask: 'mount' }) && is(r.offOnline, 'loading', { ask: 'online', effect: 'read' }) && is(r.offRetry, 'loading', { ask: 'retry' }),
    `a re-read did not carry why it asked (mount ${r.mountName.ask}, online ${r.offOnline.ask}, retry ${r.offRetry.ask})`);
  check(is(r.noneRetry, 'loading', { ask: 'retry' }) && r.noneRetryNoName.same, `none + RETRY: ${JSON.stringify(r.noneRetry)} / no name ${JSON.stringify(r.noneRetryNoName)}`);
  check(is(r.offWritten, 'ready'), 'offline + a write for this artist did not show it');
  check(r.errOnline.same, 'error left on ONLINE (the store threw; the network is not the fix)');
  check(is(r.errRetry, 'loading') && is(r.errParam, 'loading'), 'error did not leave on RETRY / PARAM_CHANGE');
  check(is(r.noneWritten, 'ready') && r.noneExpired.same, 'none: a write should show, an expiry should not ask');
  check(r.unmount.stopped && r.unmount.after, 'UNMOUNT did not stop the machine');

  // ── 3. The hook in the app ─────────────────────────────────────────────────
  // Probe: useArtistPhotoMachine with a lookup the test resolves by hand.
  await page.evaluate(() => {
    window.__ap = { lookups: [], snaps: {} };
    const el = document.createElement('div'); el.id = 'ap-probe'; document.body.appendChild(el);
    window.__apRoot = ReactDOM.createRoot(el);
    window.__apRender = (name, other) => window.__apRoot.render(React.createElement(function Probe() {
      const p = useArtistPhotoMachine(name, { canFetch: () => true, lookup: n => new Promise(res => window.__ap.lookups.push({ n, res })) });
      const q = useArtistPhoto(other);
      window.__ap.snaps.main = { status: p.status, url: p.url };
      return React.createElement('i', { id: 'ap-out', 'data-status': p.status, 'data-url': p.url || '', 'data-other': q || '' });
    }));
  });
  const name = artist.name, other = 'Plursky Probe Other';
  await page.evaluate(({ name, other }) => window.__apRender(name, other), { name, other });
  await sleep(200);
  const read = () => page.evaluate(() => ({ ...document.getElementById('ap-out').dataset, lookups: window.__ap.lookups.length }));
  const m0 = await read();
  check(m0.status === 'loading' && m0.lookups === 1, `control: the probe should be loading with one lookup in flight (${JSON.stringify(m0)})`);
  // Another artist's write: nothing changes.
  await page.evaluate(() => putArtistImage('Plursky Not This Artist', 'https://i.scdn.co/image/other', 'spotify', { spotifyId: 'X' }));
  await sleep(150);
  const m1 = await read();
  check(m1.status === 'loading' && !m1.url && m1.lookups === 1, `another artist's write changed the probe (${JSON.stringify(m1)})`);
  // f24: the queue writes this artist while our lookup is still in flight.
  await page.evaluate(n => putArtistImage(n, 'https://i.scdn.co/image/written', 'spotify', { spotifyId: 'W' }), name);
  await sleep(150);
  const m2 = await read();
  check(m2.status === 'ready' && m2.url === 'https://i.scdn.co/image/written', `[f24] a write during the lookup did not bring the photo up (${JSON.stringify(m2)})`);
  check(m2.lookups === 1, `[f24] the write set off another lookup (${m2.lookups})`);
  // The in-flight lookup answers late with a different URL: dropped.
  await page.evaluate(() => window.__ap.lookups[0].res('https://i.scdn.co/image/late'));
  await sleep(150);
  const m3 = await read();
  check(m3.url === 'https://i.scdn.co/image/written', `a late lookup answer replaced the written photo (${m3.url})`);
  // Name change re-asks: useArtistPhoto for a cached act, then another.
  const two = await page.evaluate(() => {
    const ok = x => x.start && !/\bb2b\b/i.test(x.name) && !getPermanentArtistImage(x.name);
    const [a, b] = window.ARTISTS.filter(ok).slice(5, 7).map(x => x.name);
    putArtistImage(a, 'https://i.scdn.co/image/first', 'spotify', { spotifyId: 'A' });
    putArtistImage(b, 'https://i.scdn.co/image/second', 'spotify', { spotifyId: 'B' });
    return [a, b];
  });
  await page.evaluate(({ name, a }) => window.__apRender(name, a), { name, a: two[0] });
  await sleep(150);
  const n1 = await read();
  await page.evaluate(({ name, b }) => window.__apRender(name, b), { name, b: two[1] });
  await sleep(150);
  const n2 = await read();
  check(n1.other === 'https://i.scdn.co/image/first', `control: useArtistPhoto did not show the first act's cached photo (${n1.other})`);
  check(n2.other === 'https://i.scdn.co/image/second', `useArtistPhoto kept the previous act's photo after the name changed (${n2.other})`);
  // Unmount: later events are not accepted and nothing throws.
  await page.evaluate(() => window.__apRoot.unmount());
  await page.evaluate(n => { putArtistImage(n, 'https://i.scdn.co/image/after', 'spotify', { spotifyId: 'Z' }); window.dispatchEvent(new Event('online')); }, name);
  await sleep(150);

  // ── 5. A failed lookup settles ─────────────────────────────────────────────
  // Swatch-style: a lookup that answers null, and one that rejects then
  // succeeds after ONLINE. Hero-style: no lookup, fetches on mount only, the
  // consumer reports a rejected search with fail().
  const settle = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const el = document.createElement('div'); document.body.appendChild(el);
    const root = ReactDOM.createRoot(el); const out = {}; let calls = 0; let api = null;
    const Probe = ({ id, opts }) => { const p = useArtistPhotoMachine(id, opts); out[id] = p.status; if (id === 'Plursky Hero Probe') api = p; return null; };
    const nullLookup = { canFetch: () => true, lookup: () => Promise.resolve(null) };
    const flaky = { canFetch: () => true, lookup: () => (++calls === 1 ? Promise.reject(new Error('net')) : Promise.resolve('https://i.scdn.co/image/back')) };
    const heroOpts = { canFetch: reason => reason === 'mount' };
    root.render(React.createElement(React.Fragment, null,
      React.createElement(Probe, { id: 'Plursky Null Probe', opts: nullLookup }),
      React.createElement(Probe, { id: 'Plursky Flaky Probe', opts: flaky }),
      React.createElement(Probe, { id: 'Plursky Hero Probe', opts: heroOpts })));
    await wait(150);
    const first = { ...out };
    api.fail(); await wait(100);
    const failed = { ...out };
    window.dispatchEvent(new Event('online')); await wait(150);
    const online = { ...out, calls };
    root.unmount(); el.remove();
    return { first, failed, online };
  });
  check(settle.first['Plursky Null Probe'] === 'unavailable', `a lookup answering null did not settle in unavailable (${settle.first['Plursky Null Probe']})`);
  check(settle.first['Plursky Flaky Probe'] === 'offline', `a rejected lookup did not settle in offline (${settle.first['Plursky Flaky Probe']})`);
  check(settle.first['Plursky Hero Probe'] === 'loading' && settle.failed['Plursky Hero Probe'] === 'offline',
    `control: the hero-style probe should wait in loading, then fail() to offline (${settle.first['Plursky Hero Probe']} → ${settle.failed['Plursky Hero Probe']})`);
  check(settle.online['Plursky Flaky Probe'] === 'ready' && settle.online.calls === 2, `offline + ONLINE did not look up again (${settle.online['Plursky Flaky Probe']}, ${settle.online.calls} lookups)`);
  check(settle.online['Plursky Hero Probe'] === 'none', `after ONLINE the hero-style probe should settle in none (no photo, no search: settled, not recovered), not wait in loading (${settle.online['Plursky Hero Probe']})`);
  check(settle.online['Plursky Null Probe'] === 'unavailable', 'unavailable left on ONLINE');

  // The real hero, Spotify connected: the search fails (network), answers an
  // error status, or answers nothing; or only a refresh token is stored and
  // the refresh is refused (no token). Each leaves loading.
  for (const mode of ['abort', '500', 'empty', 'no-token']) {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await wireVendor(ctx);
    await ctx.addInitScript(() => {
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', 'edc-lv-2026');
      localStorage.setItem('active_festival_explicit', '1'); localStorage.setItem('cloud_nudge_seen', '1');
      localStorage.setItem('artist_images_v1', '{}');
    });
    await ctx.addInitScript(noToken => {
      if (noToken) localStorage.setItem('spotify_refresh_token', 'test-refresh');
      else { localStorage.setItem('spotify_token', 'test-token'); localStorage.setItem('spotify_expires', String(Date.now() + 864e5)); }
    }, mode === 'no-token');
    await ctx.route(/accounts\.spotify\.com/, r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
    await ctx.route(/api\.spotify\.com/, r => mode === 'abort' ? r.abort() : r.fulfill({ status: mode === '500' ? 500 : 200, contentType: 'application/json', body: '{}' }));
    await ctx.route(/itunes\.apple\.com|theaudiodb\.com|supabase\.co/, r => r.abort());
    const pg = await ctx.newPage(); const pw = [];
    pg.on('console', m => { if (/\[machine /.test(m.text())) pw.push(m.text()); });
    await pg.goto(`http://127.0.0.1:${PORT}/index.html?artist=${encodeURIComponent(artist.id)}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => !!document.querySelector('[data-photo-status]'), null, { timeout: 60000 });
    await pg.waitForFunction(() => document.querySelector('[data-photo-status]').getAttribute('data-photo-status') !== 'loading', null, { timeout: 5000 }).catch(() => {});
    const h = await pg.evaluate(() => { const e = document.querySelector('[data-photo-status]'); return { status: e.getAttribute('data-photo-status'), hero: e.getAttribute('data-artist-hero') }; });
    const want = mode === 'abort' ? 'offline' : mode === 'no-token' ? 'none' : 'unavailable';
    check(h.status === want && h.hero === 'gradient', `hero with the search ${mode}: ${h.status}/${h.hero}, expected ${want}/gradient`);
    check(pw.length === 0, `machine warnings with the search ${mode}: ${pw.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  // ── 4. A real artist page, no tripwire ─────────────────────────────────────
  await page.goto(`http://127.0.0.1:${PORT}/index.html?artist=${encodeURIComponent(artist.id)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Back"]'), null, { timeout: 60000 });
  await sleep(800);
  const hero = await page.evaluate(() => document.querySelector('[data-artist-hero]')?.getAttribute('data-artist-hero'));
  check(hero === 'gradient', `control: with no Spotify and no cache the hero should be the gradient (${hero})`);
  check(warns.length === 0, `machine warnings in the app: ${warns.slice(0, 3).join(' | ')}`);
  check(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' | ')}`);
  await browser.close();
} finally { server.kill(); }

if (problems.length) {
  console.log(`  ✗ Artist photo machine: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log('    ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ Artist photo machine: ${checks} checks — table exhaustive, every rule stepped, write-during-mount with no second lookup, a name change re-asks, a failed lookup settles (hero too)`);
