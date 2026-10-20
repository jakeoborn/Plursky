#!/usr/bin/env node
// L4: the artist page's colour pops, in the running app.
//   A. Stat cards: the big numbers (Last.fm listeners, scrobbles) are in the
//      accent (--acc-ink) and readable on their card; the labels stay ink-3;
//      the card carries a thin accent rule (--acc-55) along its bottom.
//   B. Link pills: every pill has a brand-colour dot, aria-hidden, before its
//      label; five different dots; the pill itself is unchanged (--paper-2
//      fill, --line-2 outline, label text as before).
//   C. Genre chips: no fill, accent outline (--acc), accent text, AA.
//   D. YOUR MOMENTS with nothing in it: a dashed accent outline, an accent
//      camera glyph (aria-hidden), the invitation copy, and NO content of any
//      kind (no image, video, canvas or background image), still a short row.
// One artist with a Spotify-sourced photo (an in-page image under a Spotify
// cache entry) and one with no photo; Dark and Light; 390 and 320. Last.fm
// stats come from the app's own localStorage cache (fixture values); every
// outside request is refused, so nothing live reaches the page. Clock pinned.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
import { wireVendor } from './lib/vendor-cdn.mjs';

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗ ${msg}`); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FID = 'edc-lv-2026', AT = '2026-05-17T07:50:00Z';
const INVITE = 'Photos and clips from this set will show here.';
const LFM = { listeners: 412345, playcount: 9876543, tags: ['house', 'tech house', 'electronic'], bio: '', similar: [], topTrackNames: [], url: null };

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const kind of ['spotify', 'nophoto']) for (const mode of ['dark', 'light']) for (const width of [390, 320]) {
    const tag = `[${kind} ${mode} ${width}]`;
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: mode });
    // Refuse everything outside first: a route added later runs first, so
    // the vendored React/ReactDOM still load from scripts/vendor/.
    await ctx.route(u => new URL(u.toString()).hostname !== '127.0.0.1', r => r.abort());
    await wireVendor(ctx);
    await ctx.clock.install({ time: new Date(AT) });
    await ctx.addInitScript(({ FID, mode }) => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
      localStorage.setItem('plursky_use_realmap', '0'); localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', mode);
    }, { FID, mode });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length && typeof putArtistImage === 'function', null, { timeout: 60000 });
    // A scheduled solo act with no ledger portrait, so the hero is either the
    // Spotify image we seed or nothing.
    const a = await page.evaluate(({ kind, LFM }) => {
      const led = window.PLURSKY_ARTIST_PHOTOS || {};
      const slug = n => n.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const pool = window.ARTISTS.filter(x => x.start && !/\bb2b\b|\bvs\b|&/i.test(x.name) && !led[slug(x.name)]);
      const a = pool[kind === 'spotify' ? 0 : 5];
      const look = typeof _lookupName === 'function' ? _lookupName(a.name) : a.name;
      localStorage.setItem(`lfm_${look.toLowerCase().replace(/\W+/g, '_')}_v2`, JSON.stringify({ fetchedAt: Date.now(), data: LFM }));
      if (kind === 'spotify') {
        const c = document.createElement('canvas'); c.width = c.height = 300; const g = c.getContext('2d');
        g.fillStyle = '#5a3a6a'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#eee'; g.beginPath(); g.arc(150, 120, 60, 0, 7); g.fill();
        putArtistImage(a.name, c.toDataURL('image/png'), 'spotify', { spotifyId: 'TESTID' });
      }
      return { id: a.id, name: a.name, n: pool.length };
    }, { kind, LFM });
    check(a.n > 5, `${tag} control: fewer than 6 scheduled solo acts without a portrait (${a.n})`);
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup&artist=${encodeURIComponent(a.id)}`, { waitUntil: 'domcontentloaded' });
    const mounted = await page.waitForFunction(() => document.querySelector('[data-artist-moments-empty]') && document.querySelectorAll('.duo-clock').length >= 2,
      null, { timeout: 60000 }).then(() => true, () => false);
    check(mounted, `${tag} ${a.name}: the artist page did not show the empty moments row and the Last.fm stats`);
    if (!mounted) { await ctx.close(); continue; }
    await sleep(400);
    const r = await page.evaluate(() => {
      // Resolve a token the way the page paints it.
      const host = document.querySelector('[data-artist-moments-empty]').parentElement;
      const tok = (t, prop = 'color') => {
        const p = document.createElement('div'); p.style[prop] = `var(${t})`; if (prop === 'borderTopColor') p.style.borderTopStyle = 'solid';
        host.appendChild(p); const v = getComputedStyle(p)[prop]; p.remove(); return v;
      };
      const T = { acc: tok('--acc'), accInk: tok('--acc-ink'), acc55: tok('--acc-55'), ink3: tok('--ink-3'), paper2: tok('--paper-2', 'backgroundColor'), line2: tok('--line-2', 'borderTopColor') };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255, 255, 255)'; };
      const cs = el => getComputedStyle(el);
      // A: numbers inside the Last.fm stat cards.
      const stats = [...document.querySelectorAll('.duo-clock')].filter(n => n.parentElement && /LISTENERS|SCROBBLES/.test(n.parentElement.innerText))
        .map(n => ({ hasAttr: n.hasAttribute('data-artist-stat'), color: cs(n).color, size: parseFloat(cs(n).fontSize), weight: Number(cs(n).fontWeight),
          bg: bgOf(n), label: cs(n.nextElementSibling).color, cardShadow: cs(n.parentElement).boxShadow }));
      // B: the five link pills (the anchors to the five services).
      const pills = [...document.querySelectorAll('a[target="_blank"]:not([data-spotify-attribution])')].filter(x => /open\.spotify\.com|soundcloud\.com\/search|ra\.co\/search|instagram\.com\/explore|x\.com\/search/.test(x.href))
        .map(x => { const d = x.querySelector('[data-brand-dot]'); const dr = d && d.getBoundingClientRect();
          return { text: x.textContent.trim(), bg: cs(x).backgroundColor, border: cs(x).borderTopColor,
            dot: d ? { hidden: d.getAttribute('aria-hidden') === 'true', w: dr.width, h: dr.height, bg: cs(d).backgroundColor, first: x.firstElementChild === d } : null }; });
      // C: genre chips (Last.fm tags here).
      const tagTexts = ['HOUSE', 'TECH HOUSE', 'ELECTRONIC'];
      const chips = [...document.querySelectorAll('span')].filter(s => tagTexts.includes(s.textContent.trim()) && !s.children.length)
        .map(s => ({ bg: cs(s).backgroundColor, border: cs(s).borderTopColor, bw: parseFloat(cs(s).borderTopWidth), color: cs(s).color, ground: bgOf(s.parentElement), size: parseFloat(cs(s).fontSize) }));
      // D: the empty moments row.
      const em = document.querySelector('[data-artist-moments-empty]');
      const glyph = em.querySelector('svg');
      const content = [...em.querySelectorAll('*')].filter(e => /^(IMG|VIDEO|CANVAS|PICTURE)$/.test(e.tagName) || (cs(e).backgroundImage && cs(e).backgroundImage !== 'none'));
      const emd = { text: em.innerText.replace(/\s+/g, ' ').trim(), style: cs(em).borderTopStyle, border: cs(em).borderTopColor, h: em.getBoundingClientRect().height,
        glyph: glyph ? { hidden: glyph.getAttribute('aria-hidden') === 'true', color: cs(glyph).color } : null, content: content.length, ground: bgOf(em), copyColor: cs([...em.querySelectorAll('div')].find(d => d.textContent.trim().startsWith('Photos')) || em).color };
      return { T, stats, pills, chips, emd, hero: !!document.querySelector('[data-hero="spotify"]'), overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const over = (fg, bg) => { const f = rgb(fg), b = rgb(bg), al = f.length > 3 ? f[3] : 1; return f.slice(0, 3).map((v, i) => al * v + (1 - al) * b[i]); };
    const ratio = (fg, bg) => { const x = lum(over(fg, bg)), y = lum(rgb(bg)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const T = r.T;

    check(kind === 'spotify' ? r.hero : !r.hero, `${tag} control: ${kind === 'spotify' ? 'the Spotify-sourced photo did not reach the hero' : 'the no-photo artist shows a Spotify hero'}`);
    // A
    check(r.stats.length === 2, `${tag} A: want the listeners and scrobbles cards, found ${r.stats.length}`);
    for (const s of r.stats) {
      check(s.hasAttr && s.color === T.accInk, `${tag} A: a stat number is ${s.color}, not the accent ${T.accInk}`);
      const need = s.size >= 24 || (s.size >= 18.66 && s.weight >= 700) ? 3 : 4.5, cr = ratio(s.color, s.bg);
      check(cr >= need, `${tag} A: an accent stat number fails AA on its card (${cr.toFixed(2)}:1, need ${need})`);
      check(s.label === T.ink3, `${tag} A: a stat label is ${s.label}, should stay ink-3 ${T.ink3}`);
      check(/inset/.test(s.cardShadow) && s.cardShadow.includes(T.acc55), `${tag} A: the stat card has no accent rule (box-shadow ${s.cardShadow})`);
    }
    // B
    const want = ['Spotify ↗', 'SoundCloud ↗', 'RA ↗', 'Instagram ↗', '𝕏 ↗'];
    check(JSON.stringify(r.pills.map(p => p.text)) === JSON.stringify(want), `${tag} B: pill labels changed or missing (${r.pills.map(p => p.text).join(' | ')})`);
    for (const p of r.pills) {
      check(!!p.dot, `${tag} B: "${p.text}" has no brand dot`);
      if (p.dot) check(p.dot.hidden && p.dot.first && p.dot.w >= 6 && p.dot.w <= 10 && Math.abs(p.dot.w - p.dot.h) < 0.5, `${tag} B: "${p.text}" dot must be a small aria-hidden circle before the label (${JSON.stringify(p.dot)})`);
      check(p.bg === T.paper2 && p.border === T.line2, `${tag} B: "${p.text}" pill chrome changed (${p.bg}, ${p.border})`);
    }
    check(new Set(r.pills.map(p => p.dot?.bg)).size === 5, `${tag} B: the five dots are not five different colours`);
    // C
    check(r.chips.length === 3, `${tag} C: want 3 genre chips, found ${r.chips.length}`);
    for (const c of r.chips) {
      check(/rgba\(0, 0, 0, 0\)|transparent/.test(c.bg), `${tag} C: a genre chip is filled (${c.bg}); outline only`);
      check(c.border === T.acc && c.bw >= 1, `${tag} C: a genre chip outline is ${c.border}, not the accent ${T.acc}`);
      check(c.color === T.accInk, `${tag} C: a genre chip's text is ${c.color}, not the accent ink`);
      const cr = ratio(c.color, c.ground);
      check(cr >= 4.5, `${tag} C: genre chip text fails AA (${cr.toFixed(2)}:1)`);
    }
    // D
    const e = r.emd;
    check(e.text.includes(INVITE), `${tag} D: the empty moments row lost its invitation copy ("${e.text}")`);
    check(e.style === 'dashed' && e.border === T.acc55, `${tag} D: the empty row is not a dashed accent outline (${e.style} ${e.border})`);
    check(!!e.glyph && e.glyph.hidden && e.glyph.color === T.accInk, `${tag} D: no aria-hidden accent camera glyph (${JSON.stringify(e.glyph)})`);
    check(e.content === 0, `${tag} D: the empty row shows ${e.content} image/video/canvas element(s): never fake content`);
    check(e.h <= 96, `${tag} D: the empty row is ${Math.round(e.h)}px tall (a short row, not a card)`);
    const ec = ratio(e.copyColor, e.ground);
    check(ec >= 4.5, `${tag} D: invitation copy fails AA (${ec.toFixed(2)}:1)`);
    check(!r.overflowX, `${tag}: the artist page scrolls sideways`);
    check(!errors.length, `${tag}: page errors (${errors.slice(0, 2).join(' | ')})`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`✗ artist pop: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ artist pop: ${checks} checks (accent stat numbers AA, brand dots on unchanged pills, accent-outline genre chips, dashed invitation row with no content; Spotify-photo and no-photo artists, both modes, 390 and 320)`);
