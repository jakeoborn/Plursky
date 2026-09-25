#!/usr/bin/env node
// Spotify artist-image compliance, in the running app.
//   0. TheAudioDB and the iTunes Search API are not artist-image sources (lane
//      ruling 2026-09-24): no call to either from app code, no "tadb"/"itunes"
//      cache source, old entries of either pruned at boot, and TheAudioDB's
//      per-artist tadb_<name>_vN keys cleared.
//   1. A share/recap export never draws a Spotify image, and an unknown
//      (pre-v360 bare-string, or old itunes/tadb) entry counts as Spotify.
//      With no other source allowed, the card draws no cached artist image.
//   2. Every artist_images_v1 entry records its source and fetch time; a
//      Spotify entry older than SPOTIFY_IMAGE_TTL_MS is not shown and is
//      dropped; an unknown entry is not shown. One helper owns the key.
//   3. A Spotify-sourced artist hero shows the image uncropped with nothing
//      drawn over it, and the full Spotify logo linking to the artist on
//      Spotify. With no Spotify image, the hero falls to the gradient: no
//      photo, no source label.
//   4. A Spotify image expires while the app stays open: storage, the hero
//      and a mounted useArtistPhoto all let it go at 24 h, whether it came
//      from the cache or was fetched in this session.
// Images are generated in-page as data: URLs; every artist-image network
// lookup is stubbed empty, so no refetch can fill a gap the test expects.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });

const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

// ── Static: one door ────────────────────────────────────────────────────────
// The key string lives only in chrome.jsx's helper; every other file reads
// and writes through getArtistImage / putArtistImage(s).
for (const f of readdirSync('.').filter(f => f.endsWith('.jsx'))) {
  const src = readFileSync(f, 'utf8');
  const hits = (src.match(/["'`]artist_images_v1["'`]/g) || []).length;
  if (f === 'chrome.jsx') check(hits === 1, `chrome.jsx should name artist_images_v1 exactly once (the helper's key), found ${hits}`);
  else check(hits === 0, `${f} touches artist_images_v1 directly (${hits}x); go through getArtistImage/putArtistImage`);
}

// ── Static: TheAudioDB and iTunes artist images are gone ────────────────────
// No TheAudioDB call anywhere in app code; no iTunes ARTIST lookup or artwork
// in the artist-image paths; no "tadb"/"itunes" image source. (spotify-api.jsx
// and spotify.jsx still search iTunes for SONG previews: a separate use,
// reported for a ruling, not an artist photo.)
{
  const app = readdirSync('.').filter(f => f.endsWith('.jsx'));
  // Code lines only: a line that IS a comment may name the services (the
  // notes explaining why they are gone). No regex comment-stripping: a
  // "capacitor://localhost/*" inside a // comment would open a fake block
  // and hide real code.
  const codeLines = src => src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
  const code = Object.fromEntries(app.map(f => [f, codeLines(readFileSync(f, 'utf8'))]));
  check(app.length > 10 && code['chrome.jsx'].includes('putArtistImage'), `control: app code not read (${app.length} .jsx files)`);
  const tadb = app.filter(f => /theaudiodb\.com|fetchAudioDB|["'`]tadb["'`]/i.test(code[f]));
  check(tadb.length === 0, `TheAudioDB is still called or used as a source in ${tadb.join(', ')}`);
  const IMG = ['chrome.jsx', 'artist.jsx', 'home.jsx', 'recap-engine.jsx'];
  const itunes = IMG.filter(f => /itunes\.apple\.com|_fetchItunesPhoto|artworkUrl|["'`]itunes["'`]/i.test(code[f]));
  check(itunes.length === 0, `iTunes is still an artist-image source in ${itunes.join(', ')}`);
  check(/_ARTIST_IMAGE_SOURCES = \["spotify"\];/.test(code['chrome.jsx']), 'the cache allows a source other than spotify');
}

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch {} await sleep(100); }
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const FEST = 'edc-lv-2026';
  const DAY = 24 * 60 * 60 * 1000;

  const newCtx = async (width, seed) => {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await ctx.addInitScript(({ FEST, seed }) => {
      localStorage.setItem('onboarded', 'v1');
      localStorage.setItem('active_festival_id', FEST);
      localStorage.setItem('active_festival_explicit', '1');
      if (seed) localStorage.setItem('artist_images_v1', JSON.stringify(seed));
    }, { FEST, seed });
    // No lookup may refill the cache behind the test's back.
    await ctx.route(/api\.spotify\.com|itunes\.apple\.com|theaudiodb\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    return ctx;
  };
  const boot = async (page, qs = '') => {
    await page.goto(`http://127.0.0.1:${PORT}/index.html${qs}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getArtistImage === 'function' && typeof _heroCardSource === 'function'
      && Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0 && document.getElementById('root')?.children.length > 0, null, { timeout: 60000 });
  };

  // ── 2a. Boot prune: seeded before the app loads ───────────────────────────
  {
    const now = Date.now();
    const seed = {
      'fresh spotify': { url: 'https://i.scdn.co/image/fresh', source: 'spotify', fetchedAt: now - 60000, spotifyId: 'id1' },
      'stale spotify': { url: 'https://i.scdn.co/image/stale', source: 'spotify', fetchedAt: now - DAY - 60000 },
      'legacy string': 'https://i.scdn.co/image/legacy',
      'old tadb':      { url: 'https://r2.theaudiodb.com/x.jpg', source: 'tadb', fetchedAt: now - 60000 },
      'old itunes':    { url: 'https://is1-ssl.mzstatic.com/x.jpg', source: 'itunes', fetchedAt: now - 60000 },
    };
    const ctx = await newCtx(393, seed);
    await ctx.addInitScript(() => { localStorage.setItem('tadb_korolova_v2', '{"data":{"bio":"x"},"fetchedAt":0}'); localStorage.setItem('tadb_note', 'kept'); });
    const page = await ctx.newPage(); await boot(page);
    const r = await page.evaluate(() => ({ store: JSON.parse(localStorage.getItem('artist_images_v1') || '{}'), ttl: SPOTIFY_IMAGE_TTL_MS,
      tadbKey: localStorage.getItem('tadb_korolova_v2'), control: localStorage.getItem('tadb_note') }));
    check(r.ttl === DAY, `SPOTIFY_IMAGE_TTL_MS is ${r.ttl}, the PR states 24 h`);
    check(!!r.store['fresh spotify'], 'boot prune dropped a fresh Spotify entry');
    check(!('stale spotify' in r.store), 'boot prune kept a Spotify entry older than the TTL (stored indefinitely)');
    check(!('legacy string' in r.store), 'boot prune kept an unknown-source legacy entry');
    check(!('old tadb' in r.store), 'boot prune kept a TheAudioDB entry (not a source)');
    check(!('old itunes' in r.store), 'boot prune kept an iTunes entry (not a source)');
    check(r.tadbKey === null, "TheAudioDB's cached lookup (tadb_<name>_v2) survived boot");
    check(r.control === 'kept', 'control: the tadb_ key prune removed a key it does not own');
    await ctx.close();
  }

  // ── 1 + 2b. Helper and share-card behaviour, in-page ──────────────────────
  {
    const ctx = await newCtx(393, null); const page = await ctx.newPage(); await boot(page);
    const r = await page.evaluate(async () => {
      const png = (color) => { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 8, 8); return c.toDataURL('image/png'); };
      const set = (o) => localStorage.setItem('artist_images_v1', JSON.stringify(o));
      const get = () => JSON.parse(localStorage.getItem('artist_images_v1') || '{}');
      const out = {};
      // Writers record source + time (+ id for Spotify).
      set({});
      const t0 = Date.now();
      putArtistImage('Alpha', png('#f00'), 'spotify', { spotifyId: 'sp-alpha' });
      putArtistImage('Beta', png('#0f0'), 'itunes');
      putArtistImage('Gamma', png('#00f'), 'tadb');  // both refused: not sources
      putArtistImages([{ name: 'Delta', url: png('#ff0'), source: 'spotify', spotifyId: 'sp-delta' }]);
      putArtistImage('Epsilon', png('#0ff'), 'somewhere-else');
      const s = get();
      out.recorded = ['alpha', 'delta'].map(k => ({ k, source: s[k]?.source, fresh: s[k]?.fetchedAt >= t0 && s[k]?.fetchedAt <= Date.now(), id: s[k]?.spotifyId || null }));
      out.refused = ['beta', 'gamma', 'epsilon'].filter(k => k in s);
      // ifAbsent keeps a showable entry.
      putArtistImage('Alpha', png('#fff'), 'spotify', { ifAbsent: true, spotifyId: 'other' });
      out.ifAbsentKept = get().alpha.spotifyId === 'sp-alpha';
      // Expiry.
      const now = Date.now(), TTL = SPOTIFY_IMAGE_TTL_MS;
      set({ fresh: { url: 'u1', source: 'spotify', fetchedAt: now - TTL + 60000 },
            expired: { url: 'u2', source: 'spotify', fetchedAt: now - TTL - 1 },
            future: { url: 'u3', source: 'spotify', fetchedAt: now + TTL },
            nodate: { url: 'u4', source: 'spotify' },
            legacy: 'u5', itunes: { url: 'u6', source: 'itunes', fetchedAt: 0 } });
      out.show = Object.fromEntries(['fresh', 'expired', 'future', 'nodate', 'legacy', 'itunes'].map(k => [k, getArtistImage(k)?.url || null]));
      out.share = Object.fromEntries(['fresh', 'legacy', 'itunes'].map(k => [k, getShareableArtistImage(k)?.url || null]));
      // A write prunes: the expired, legacy and iTunes entries are gone afterwards.
      putArtistImage('Zeta', 'u7', 'spotify');
      out.afterWrite = Object.keys(get()).sort();
      // Share card: seeded with images that WOULD load, so only the policy can refuse them.
      const artist = window.ARTISTS[0];
      const ln = artist.name.toLowerCase();
      const card = async (entry) => { set(entry ? { [ln]: entry } : {}); const src = await _heroCardSource(artist); return src ? 'image' : null; };
      out.card = {
        spotifyOnly: await card({ url: png('#f0f'), source: 'spotify', fetchedAt: Date.now(), spotifyId: 'x' }),
        legacyOnly:  await card(png('#f0f')),
        tadb:        await card({ url: png('#0f0'), source: 'tadb', fetchedAt: Date.now() }),
        itunes:      await card({ url: png('#0f0'), source: 'itunes', fetchedAt: Date.now() }),
        // Control: were a source shareable, the card WOULD draw it (so the
        // nulls above are the policy, not a broken card).
        control:     await (async () => { set({}); const real = window.getShareableArtistImage; const url = png('#0f0');
          window.getShareableArtistImage = () => ({ url, source: 'self' });
          try { return (await _heroCardSource(artist)) ? 'image' : null; } finally { window.getShareableArtistImage = real; } })(),
        none:        await card(null),
      };
      out.cardArtist = artist.name;
      return out;
    });
    for (const x of r.recorded) {
      check(!!x.source, `${x.k}: missing after the write, or written with no source`);
      check(x.fresh, `${x.k}: fetchedAt missing or not the write time`);
    }
    check(r.recorded.find(x => x.k === 'alpha').source === 'spotify' && r.recorded.find(x => x.k === 'alpha').id === 'sp-alpha', 'Spotify entry lost its source or artist id');
    check(r.refused.length === 0, `an entry from a source that is not allowed was written: ${r.refused.join(', ')} (itunes, tadb, unknown)`);
    check(r.recorded.find(x => x.k === 'delta').id === 'sp-delta', 'batch Spotify write lost its artist id');
    check(r.ifAbsentKept, 'ifAbsent overwrote a showable entry');
    check(r.show.fresh === 'u1', 'a Spotify entry inside the TTL is not shown');
    check(r.show.expired === null, 'an expired Spotify entry is still shown');
    check(r.show.future === null, 'a Spotify entry dated in the future is shown (clock skew must not extend the TTL)');
    check(r.show.nodate === null, 'a Spotify entry with no fetch time is shown');
    check(r.show.legacy === null, 'an unknown-source legacy entry is shown instead of refetched');
    check(r.show.itunes === null, 'an old iTunes entry is still shown (iTunes is not a source)');
    check(r.share.fresh === null, 'getShareableArtistImage returned a Spotify image');
    check(r.share.legacy === null, 'getShareableArtistImage returned an unknown-source legacy image');
    check(r.share.itunes === null, 'getShareableArtistImage returned an iTunes image');
    check(!r.afterWrite.includes('expired') && !r.afterWrite.includes('legacy') && !r.afterWrite.includes('itunes') && r.afterWrite.includes('zeta'), `a write did not prune expired/unknown/iTunes entries: ${r.afterWrite.join(',')}`);
    check(r.card.spotifyOnly === null, `share card drew a Spotify-sourced image (${r.cardArtist})`);
    check(r.card.legacyOnly === null, `share card drew an unknown-source legacy image (${r.cardArtist})`);
    check(r.card.tadb === null, 'share card drew a TheAudioDB image');
    check(r.card.itunes === null, 'share card drew an iTunes image');
    check(r.card.none === null, 'share card found an image in an empty cache');
    check(r.card.control === 'image', 'control: the share card draws no image even when a shareable one exists, so the refusals prove nothing');
    await ctx.close();
  }

  // ── 3. The hero, rendered ─────────────────────────────────────────────────
  // A 3:2 image: a crop to the old 300px full-bleed box, or a square frame,
  // would change the rendered ratio, so ratio equality proves "uncropped".
  const heroCase = async (width, entryFor) => {
    const ctx = await newCtx(width, null); const page = await ctx.newPage(); await boot(page);
    const artist = await page.evaluate(() => { const a = window.ARTISTS.find(x => x.start && !/\bb2b\b/i.test(x.name)); return { id: a.id, name: a.name }; });
    const img = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#3a6'; g.fillRect(0, 0, 600, 400); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 40); g.fillRect(0, 360, 600, 40); return c.toDataURL('image/png'); });
    await page.evaluate(({ name, entry }) => { localStorage.setItem('artist_images_v1', JSON.stringify(entry ? { [name.toLowerCase()]: entry } : {})); }, { name: artist.name, entry: entryFor(img) });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?artist=${encodeURIComponent(artist.id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('[aria-label="Back"]'), null, { timeout: 60000 });
    await sleep(400);
    const r = await page.evaluate((imgUrl) => {
      const hero = document.querySelector('[data-hero="spotify"]');
      const text = document.body.innerText;
      const bgHits = [...document.querySelectorAll('div')].filter(d => (d.style.backgroundImage || '').includes(imgUrl.slice(0, 60))).length;
      const out = { spotifyHero: !!hero, cachedLabel: /\bCACHED\b/.test(text), oldSpotifyTag: /PHOTO · SPOTIFY/.test(text), bgHits, labels: (text.match(/PHOTO · [A-Z]+/g) || []) };
      if (hero) {
        const im = hero.querySelector('img[data-spotify-image]');
        const ir = im.getBoundingClientRect();
        out.img = { natural: im.naturalWidth / im.naturalHeight, rendered: ir.width / ir.height, radius: getComputedStyle(im).borderTopLeftRadius, fit: getComputedStyle(im).objectFit, w: ir.width, right: ir.right, vw: innerWidth };
        // Nothing may sit on the image: any element whose box intersects it,
        // other than the image and its ancestors, is an overlay.
        const overlaps = [...document.querySelectorAll('body *')].filter(el => {
          if (el === im || el.contains(im)) return false;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
          const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
          return r.left < ir.right - 0.5 && r.right > ir.left + 0.5 && r.top < ir.bottom - 0.5 && r.bottom > ir.top + 0.5;
        });
        out.overlaps = overlaps.slice(0, 5).map(el => el.tagName + (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : '') + ':' + (el.textContent || '').trim().slice(0, 20));
        const a = hero.querySelector('a[data-spotify-attribution]');
        const svg = a && a.querySelector('svg');
        out.link = a ? { href: a.href, target: a.target, paths: svg ? svg.querySelectorAll('path').length : 0, w: svg ? svg.getBoundingClientRect().width : 0, label: a.getAttribute('aria-label') } : null;
        out.parallax = !!(im.closest('[style*="translateY"]'));
      }
      return out;
    }, img);
    return { r, page, ctx, artist };
  };

  const shots = [];
  for (const width of [320, 393]) {
    // Spotify with an artist id.
    {
      const { r, page, ctx, artist } = await heroCase(width, img => ({ url: img, source: 'spotify', fetchedAt: Date.now(), spotifyId: 'TESTID123' }));
      const at = `[${width}px spotify]`;
      check(r.spotifyHero, `${at} a Spotify-sourced image did not get the Spotify hero`);
      if (r.img) {
        check(Math.abs(r.img.rendered - r.img.natural) / r.img.natural < 0.01, `${at} image cropped or stretched: rendered ${r.img.rendered.toFixed(3)} vs natural ${r.img.natural.toFixed(3)}`);
        check(r.img.fit !== 'cover', `${at} image uses object-fit: cover`);
        check(r.img.radius === '4px', `${at} artwork corner radius is ${r.img.radius}, guidelines say 4px on small devices`);
        check(r.img.right <= r.img.vw, `${at} image runs off the screen`);
        check(r.overlaps.length === 0, `${at} something is drawn over the Spotify image: ${r.overlaps.join(' | ')}`);
        check(!r.parallax, `${at} the Spotify image sits in a translated (parallax) layer`);
      }
      check(r.bgHits === 0, `${at} the Spotify image is also painted as a cropped background`);
      check(r.link && r.link.href === 'https://open.spotify.com/artist/TESTID123', `${at} logo link is ${r.link?.href}, expected the artist's Spotify page`);
      check(r.link && r.link.paths === 4, `${at} the Spotify logo is not the full icon + wordmark artwork (${r.link?.paths} paths)`);
      check(r.link && r.link.w >= 70, `${at} Spotify logo renders ${r.link?.w}px wide, under the 70px digital minimum`);
      check(r.link && r.link.target === '_blank', `${at} logo link does not open Spotify outside the app`);
      check(!r.cachedLabel && !r.oldSpotifyTag, `${at} the old "PHOTO · CACHED/SPOTIFY" tag is still on the page`);
      await page.evaluate(() => document.querySelector('[data-hero="spotify"]')?.scrollIntoView());
      shots.push({ file: `spotify-${width}.png`, buf: await page.screenshot({ fullPage: false }), artist: artist.name });
      await ctx.close();
    }
    // Spotify with no id cached: the logo falls back to the artist search.
    {
      const { r, ctx, artist } = await heroCase(width, img => ({ url: img, source: 'spotify', fetchedAt: Date.now() }));
      const want = `https://open.spotify.com/search/${encodeURIComponent(artist.name.replace(/\s*\([^)]*\)\s*$/, ''))}/artists`;
      check(r.link && r.link.href.startsWith('https://open.spotify.com/search/'), `[${width}px spotify, no id] logo link is ${r.link?.href}, expected ${want}`);
      await ctx.close();
    }
    // An old TheAudioDB entry (what used to be the non-Spotify hero): the hero
    // falls to the gradient, with no photo and no source label.
    for (const src of ['tadb', 'itunes']) {
      const { r, page, ctx } = await heroCase(width, img => ({ url: img, source: src, fetchedAt: Date.now() }));
      const at = `[${width}px ${src}]`;
      check(!r.spotifyHero && r.bgHits === 0, `${at} the hero still shows a ${src} image`);
      check(r.labels.length === 0 && !r.cachedLabel, `${at} the gradient hero carries a source label: ${r.labels.join(',')}`);
      if (src === 'tadb') shots.push({ file: `gradient-${width}.png`, buf: await page.screenshot({ fullPage: false }) });
      await ctx.close();
    }
    // Expired Spotify: not shown anywhere on the hero.
    {
      const { r, ctx } = await heroCase(width, img => ({ url: img, source: 'spotify', fetchedAt: Date.now() - 2 * DAY }));
      check(!r.spotifyHero && r.bgHits === 0, `[${width}px expired] an expired Spotify image is still shown`);
      await ctx.close();
    }
  }
  // ── 4. Expiry while the app stays open ────────────────────────────────────
  // (a) A cached entry turns 24 h a moment after the page opens.
  {
    const ctx = await newCtx(393, null); const page = await ctx.newPage(); await boot(page);
    const artist = await page.evaluate(() => { const a = window.ARTISTS.find(x => x.start && !/\bb2b\b/i.test(x.name)); return { id: a.id, name: a.name }; });
    const img = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; c.getContext('2d').fillRect(0, 0, 60, 40); return c.toDataURL('image/png'); });
    await page.evaluate(({ name, img, DAY }) => localStorage.setItem('artist_images_v1', JSON.stringify({ [name.toLowerCase()]: { url: img, source: 'spotify', fetchedAt: Date.now() - DAY + 2500, spotifyId: 'EXP' } })), { name: artist.name, img, DAY });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?artist=${encodeURIComponent(artist.id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('[aria-label="Back"]') && typeof useArtistPhoto === 'function', null, { timeout: 60000 });
    // A mounted useArtistPhoto consumer, the hook ArtistSwatch uses.
    await page.evaluate(name => {
      const el = document.createElement('div'); el.id = 'photo-probe-root'; document.body.appendChild(el);
      ReactDOM.createRoot(el).render(React.createElement(function Probe() { const p = useArtistPhoto(name); return React.createElement('i', { id: 'photo-probe', 'data-p': p ? 'img' : '' }); }));
    }, artist.name);
    await sleep(300);
    const before = await page.evaluate(() => ({ hero: !!document.querySelector('[data-hero="spotify"]'), probe: document.getElementById('photo-probe')?.dataset.p }));
    check(before.hero, '[expiry, cached] control: the Spotify hero was not showing before the entry expired');
    check(before.probe === 'img', '[expiry, cached] control: useArtistPhoto had no image before the entry expired');
    await sleep(3200);
    const after = await page.evaluate(() => ({
      hero: !!document.querySelector('[data-hero="spotify"]'),
      probe: document.getElementById('photo-probe')?.dataset.p,
      stored: Object.keys(JSON.parse(localStorage.getItem('artist_images_v1') || '{}')).length,
    }));
    check(after.stored === 0, '[expiry, cached] the Spotify entry is still in storage after 24 h with the app open');
    check(!after.hero, '[expiry, cached] the artist hero still shows the Spotify image after 24 h with the app open');
    check(after.probe === '', '[expiry, cached] a mounted useArtistPhoto still holds the Spotify image after 24 h');
    await ctx.close();
  }
  // (b) Fetched in this session (the hero's own Spotify search), then the
  // clock runs a day forward with the page still open.
  {
    const ctx = await newCtx(393, null);
    await ctx.clock.install({ time: new Date() });
    await ctx.addInitScript(DAY => { localStorage.setItem('spotify_token', 'test-token'); localStorage.setItem('spotify_expires', String(Date.now() + 10 * DAY)); }, DAY);
    const page = await ctx.newPage(); await boot(page);
    const artist = await page.evaluate(() => { const a = window.ARTISTS.find(x => x.start && !/\bb2b\b/i.test(x.name)); return { id: a.id, name: a.name }; });
    const img = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; c.getContext('2d').fillRect(0, 0, 60, 40); return c.toDataURL('image/png'); });
    // The first search answers with an image; later ones find nothing, so a
    // refetch after expiry cannot put the old image back.
    let served = 0;
    await ctx.route(/api\.spotify\.com\/v1\/search/, r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(served++ ? {} : { artists: { items: [{ name: artist.name, id: 'FETCHED1', images: [{ url: img }] }] } }) }));
    await page.evaluate(() => localStorage.setItem('artist_images_v1', '{}'));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?artist=${encodeURIComponent(artist.id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('[aria-label="Back"]'), null, { timeout: 60000 });
    await page.clock.runFor(2000);
    const before = await page.evaluate(() => !!document.querySelector('[data-hero="spotify"]'));
    check(before && served >= 1, `[expiry, fetched] control: the fetched Spotify image was not showing (searches served: ${served})`);
    await page.clock.fastForward(DAY + 60000);
    await page.clock.runFor(1000);
    const after = await page.evaluate(() => ({ hero: !!document.querySelector('[data-hero="spotify"]'), stored: Object.keys(JSON.parse(localStorage.getItem('artist_images_v1') || '{}')).length }));
    check(after.stored === 0, '[expiry, fetched] the fetched Spotify entry is still in storage a day later');
    check(!after.hero, '[expiry, fetched] the hero still shows an image fetched from Spotify a day ago');
    await ctx.close();
  }
  await browser.close();
  if (process.env.SPOTIFY_SHOTS_DIR) {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync(process.env.SPOTIFY_SHOTS_DIR, { recursive: true });
    for (const s of shots) writeFileSync(`${process.env.SPOTIFY_SHOTS_DIR}/${s.file}`, s.buf);
  }
} finally { server.kill(); }

if (problems.length) {
  console.log(`  ✗ Spotify image compliance: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log('    ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ Spotify image compliance: ${checks} checks`);
