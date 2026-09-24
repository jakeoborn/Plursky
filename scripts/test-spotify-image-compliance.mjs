#!/usr/bin/env node
// Spotify artist-image compliance, in the running app.
//   1. A share/recap export never draws a Spotify image: the hero card's
//      fallback takes an iTunes or TheAudioDB entry, never a Spotify one, and
//      an unknown (pre-v360, bare-string) entry counts as Spotify.
//   2. Every artist_images_v1 entry records its source and fetch time; a
//      Spotify entry older than SPOTIFY_IMAGE_TTL_MS is not shown and is
//      dropped; an unknown entry is not shown. One helper owns the key.
//   3. A Spotify-sourced artist hero shows the image uncropped with nothing
//      drawn over it, and the full Spotify logo linking to the artist on
//      Spotify. A non-Spotify hero keeps the full-bleed layout.
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
      'old tadb':      { url: 'https://r2.theaudiodb.com/x.jpg', source: 'tadb', fetchedAt: now - 400 * DAY },
    };
    const ctx = await newCtx(393, seed); const page = await ctx.newPage(); await boot(page);
    const r = await page.evaluate(() => ({ store: JSON.parse(localStorage.getItem('artist_images_v1') || '{}'), ttl: SPOTIFY_IMAGE_TTL_MS }));
    check(r.ttl === DAY, `SPOTIFY_IMAGE_TTL_MS is ${r.ttl}, the PR states 24 h`);
    check(!!r.store['fresh spotify'], 'boot prune dropped a fresh Spotify entry');
    check(!('stale spotify' in r.store), 'boot prune kept a Spotify entry older than the TTL (stored indefinitely)');
    check(!('legacy string' in r.store), 'boot prune kept an unknown-source legacy entry');
    check(!!r.store['old tadb'], 'boot prune dropped a TheAudioDB entry (only Spotify expires)');
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
      putArtistImage('Gamma', png('#00f'), 'tadb');
      putArtistImages([{ name: 'Delta', url: png('#ff0'), source: 'spotify', spotifyId: 'sp-delta' }]);
      putArtistImage('Epsilon', png('#0ff'), 'somewhere-else');
      const s = get();
      out.recorded = ['alpha', 'beta', 'gamma', 'delta'].map(k => ({ k, source: s[k]?.source, fresh: s[k]?.fetchedAt >= t0 && s[k]?.fetchedAt <= Date.now(), id: s[k]?.spotifyId || null }));
      out.unknownSourceWritten = 'epsilon' in s;
      // ifAbsent: TheAudioDB never replaces a showable entry.
      putArtistImage('Alpha', png('#fff'), 'tadb', { ifAbsent: true });
      out.ifAbsentKept = get().alpha.source === 'spotify';
      // Expiry.
      const now = Date.now(), TTL = SPOTIFY_IMAGE_TTL_MS;
      set({ fresh: { url: 'u1', source: 'spotify', fetchedAt: now - TTL + 60000 },
            expired: { url: 'u2', source: 'spotify', fetchedAt: now - TTL - 1 },
            future: { url: 'u3', source: 'spotify', fetchedAt: now + TTL },
            nodate: { url: 'u4', source: 'spotify' },
            legacy: 'u5', itunes: { url: 'u6', source: 'itunes', fetchedAt: 0 } });
      out.show = Object.fromEntries(['fresh', 'expired', 'future', 'nodate', 'legacy', 'itunes'].map(k => [k, getArtistImage(k)?.url || null]));
      out.share = Object.fromEntries(['fresh', 'legacy', 'itunes'].map(k => [k, getShareableArtistImage(k)?.url || null]));
      // A write prunes: the expired entry is gone afterwards.
      putArtistImage('Zeta', 'u7', 'itunes');
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
    check(r.recorded.find(x => x.k === 'beta').source === 'itunes', 'iTunes entry recorded the wrong source');
    check(r.recorded.find(x => x.k === 'gamma').source === 'tadb', 'TheAudioDB entry recorded the wrong source');
    check(r.recorded.find(x => x.k === 'delta').id === 'sp-delta', 'batch Spotify write lost its artist id');
    check(!r.unknownSourceWritten, 'an entry with an unrecognised source was written');
    check(r.ifAbsentKept, 'TheAudioDB overwrote a showable Spotify entry');
    check(r.show.fresh === 'u1', 'a Spotify entry inside the TTL is not shown');
    check(r.show.expired === null, 'an expired Spotify entry is still shown');
    check(r.show.future === null, 'a Spotify entry dated in the future is shown (clock skew must not extend the TTL)');
    check(r.show.nodate === null, 'a Spotify entry with no fetch time is shown');
    check(r.show.legacy === null, 'an unknown-source legacy entry is shown instead of refetched');
    check(r.show.itunes === 'u6', 'an old iTunes entry is hidden (only Spotify expires)');
    check(r.share.fresh === null, 'getShareableArtistImage returned a Spotify image');
    check(r.share.legacy === null, 'getShareableArtistImage returned an unknown-source legacy image');
    check(r.share.itunes === 'u6', 'getShareableArtistImage refused an iTunes image');
    check(!r.afterWrite.includes('expired') && !r.afterWrite.includes('legacy'), `a write did not prune expired/unknown entries: ${r.afterWrite.join(',')}`);
    check(r.card.spotifyOnly === null, `share card drew a Spotify-sourced image (${r.cardArtist})`);
    check(r.card.legacyOnly === null, `share card drew an unknown-source legacy image (${r.cardArtist})`);
    check(r.card.tadb === 'image', 'share card refused a TheAudioDB image (control)');
    check(r.card.itunes === 'image', 'share card refused an iTunes image (control)');
    check(r.card.none === null, 'share card found an image in an empty cache');
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
    // Non-Spotify: unchanged full-bleed hero, honest source label.
    {
      const { r, page, ctx } = await heroCase(width, img => ({ url: img, source: 'tadb', fetchedAt: Date.now() }));
      const at = `[${width}px tadb]`;
      check(!r.spotifyHero, `${at} a TheAudioDB image got the Spotify hero`);
      check(r.bgHits >= 1, `${at} the non-Spotify hero no longer shows its image full-bleed`);
      check(r.labels.includes('PHOTO · THEAUDIODB'), `${at} source label is ${r.labels.join(',') || 'missing'}, expected PHOTO · THEAUDIODB`);
      check(!r.cachedLabel, `${at} the "CACHED" label is still used`);
      shots.push({ file: `tadb-${width}.png`, buf: await page.screenshot({ fullPage: false }) });
      await ctx.close();
    }
    // Expired Spotify: not shown anywhere on the hero.
    {
      const { r, ctx } = await heroCase(width, img => ({ url: img, source: 'spotify', fetchedAt: Date.now() - 2 * DAY }));
      check(!r.spotifyHero && r.bgHits === 0, `[${width}px expired] an expired Spotify image is still shown`);
      await ctx.close();
    }
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
