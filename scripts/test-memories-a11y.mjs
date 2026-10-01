#!/usr/bin/env node
// Memories v2 + General Landing — accessibility and large-text contract.
//
// Four failure classes this caught on the way in, each of which the automated
// pan/clip checks alone were blind to:
//   · a flex child with the default min-width:auto pushing the header 170px
//     wider than the screen at 200% text;
//   · a px line-height that cannot scale, so a 56px title laid out on a 34px
//     line and printed straight through the eyebrow above it (the glyphs
//     spill OUTSIDE the box, so neither clipping nor rect overlap sees it —
//     hence the explicit line-height >= font-size check);
//   · a fixed-height status strip a scaled clock spilled out of;
//   · a Memories screen with no h1/h2 at all, so VoiceOver's heading rotor
//     had nothing to land on;
//   · words broken INSIDE themselves ("Memorie / s", "Impor / t", "Toda / y",
//     #275's QA). Nothing overflows and nothing clips, so only a per-character
//     line check sees it. It runs in this Mac's fonts AND in Verdana, the wide
//     face the runner's fallback fonts behave like.
//
// The doubling SNAPSHOTS every resolved size first and then writes 2x. The
// first loop read each size after its parent had already been doubled, so an
// inherited size doubled twice or more (126 of 163 elements; the title went
// 28 -> 112px) and "200%" was really 2x-8x.
//
// The 200% pass DOUBLES every resolved font size. That is a proxy, not the
// real thing: Plursky styles in px with no text-size-adjust, rem units or
// Apple text styles, so iOS Dynamic Type does not currently scale the app's
// text at all. Device evidence is still required; this gate keeps the layout
// honest for the day the typography does scale. Renders the two
// flagship surfaces with every inline font-size DOUBLED (the app styles in px,
// so browser font scaling is inert — this is the honest in-browser proxy for
// iOS Dynamic Type at 200%), then measures clipping, pan and target size.
// It also records the theme and reduced-motion facts rather than assuming them.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { serverReady } from './lib/server-ready.mjs';
const OUT = process.env.PIXEL_OUT || '/tmp/pixels-v341';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rp = () => new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const a = s.address(); const p = a.port; s.close(e => e ? rej(e) : res(p)); }); });
const PORT = await rp();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
const ART = ['n4', 'k1', 'k6'];
const iso = (d, h, m) => `2026-05-${String(15 + d - 1).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const RICH = JSON.stringify({ 1: [
  { kind: 'photo', festivalId: 'edc-lv-2026', createdAt: 1, id: 'r1', night: 1, photoId: 'p0', _fingerprint: 'r1', artistId: ART[0], takenAt: iso(1, 22, 30) },
  { kind: 'photo', festivalId: 'edc-lv-2026', createdAt: 2, id: 'r2', night: 1, photoId: 'p1', _fingerprint: 'r2', artistId: ART[0], takenAt: iso(1, 22, 36) },
  { kind: 'photo', festivalId: 'edc-lv-2026', createdAt: 3, id: 'r3', night: 1, photoId: 'p2', _fingerprint: 'r3', artistId: ART[1], takenAt: iso(1, 23, 30) },
  { kind: 'photo', festivalId: 'edc-lv-2026', createdAt: 4, id: 'r4', night: 1, photoId: 'p3', _fingerprint: 'r4', artistId: null, takenAt: iso(1, 23, 55) },
  { kind: 'photo', festivalId: 'edc-lv-2026', createdAt: 5, id: 'r5', night: 1, photoId: 'p4', _fingerprint: 'r5', artistId: 'gone-set', takenAt: iso(1, 23, 58) },
] });

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };
const note = (msg) => console.log(`  · ${msg}`);

async function open(browser, { url, width, big, reduced, themePref, font }) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block',
    reducedMotion: reduced ? 'reduce' : 'no-preference', timezoneId: 'America/Los_Angeles',
  });
  await ctx.addInitScript(([rich, pref]) => {
    localStorage.setItem('onboarded', 'v1'); localStorage.setItem('user_name', 'Jake');
    for (const k of ['cloud_nudge_seen', 'ft_guide_seen', 'notif_nudge_dismissed', 'plursky_recap_seen_v1']) localStorage.setItem(k, '1');
    localStorage.setItem('active_festival_id', 'edc-lv-2026');
    localStorage.setItem('active_festival_explicit', '1');
    localStorage.setItem('plursky_last_festival_id', 'edc-lv-2026');
    localStorage.setItem('plursky_landing_migrated_v1', '1');
    localStorage.setItem('plursky_memories_view_v1', 'library');
    localStorage.setItem('plursky_moments_v1', rich);
    localStorage.setItem('plursky_attended_v1', JSON.stringify({ 1: ['n4', 'k1', 'k6'] }));
    localStorage.setItem('edc-lv-2026_saved_v1', JSON.stringify(['n4', 'k1', 'k6']));
    localStorage.setItem('plursky_saved_festivals_v1', JSON.stringify({ v: 1, ids: ['edc-lv-2026', 'acl-2026'] }));
    if (pref) localStorage.setItem('theme_pref', pref);
  }, [RICH, themePref || null]);
  if (font) await ctx.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `*{font-family:${f} !important}`; document.head.appendChild(st); }); }, font);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
  await sleep(1300);
  if (big) {
    // Double every RESOLVED font size. The app styles in px, so a browser
    // font-size preference does nothing — this reproduces what iOS Dynamic
    // Type at ~200% does to the layout, which is what the gate is about.
    // Snapshot first, then write: reading as you go doubles an inherited
    // size again for every ancestor already doubled.
    await page.evaluate(() => {
      const els = [...document.body.querySelectorAll('*')];
      const sizes = els.map(el => parseFloat(getComputedStyle(el).fontSize));
      els.forEach((el, i) => { if (sizes[i]) el.style.setProperty('font-size', (sizes[i] * 2) + 'px', 'important'); });
    });
    await sleep(700);
  }
  return { ctx, page };
}

const audit = (page) => page.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
  const tappable = [...document.querySelectorAll('button,[role=tab],a,input')].filter(vis);
  // Clipping: an element whose CONTENT is taller/wider than its box AND which
  // hides the overflow is losing text the user cannot get to by scrolling.
  const clipped = [...document.querySelectorAll('*')].filter(e => {
    const s = getComputedStyle(e);
    if (s.overflow === 'visible' || s.overflowY === 'auto' || s.overflowY === 'scroll') return false;
    if (!e.innerText || !e.innerText.trim()) return false;
    return e.scrollHeight > e.clientHeight + 2;
  }).map(e => `${e.tagName}[ov=${getComputedStyle(e).overflow}] ${e.clientHeight}<${e.scrollHeight} :: ${e.innerText.trim().slice(0, 30).replace(/\n/g,'|')}`);
  return {
    docPan: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    worstPan: Math.max(0, ...[...document.querySelectorAll('*')].filter(e => getComputedStyle(e).overflowX === 'visible').map(e => e.scrollWidth - e.clientWidth)),
    panWho: [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).overflowX === 'visible' && e.scrollWidth - e.clientWidth > 1)
      .map(e => `${e.tagName}[${e.className||''}] +${e.scrollWidth - e.clientWidth} cw=${e.clientWidth} :: ${(e.innerText||'').slice(0,40).replace(/\n/g,'|')}`).slice(0, 6),
    small: tappable.filter(e => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; })
      .map(e => `${(e.innerText || e.getAttribute('aria-label') || '?').trim().slice(0, 24)}`),
    clipped: clipped.slice(0, 6),
    // Overlap: two LEAF text nodes whose boxes intersect are printing on top
    // of each other. A fixed px line-height with a scaled font does exactly
    // this, and neither the clip nor the pan check can see it.
    overlaps: (() => {
      // Compare only text that shares a SCROLL CONTEXT. Scrolled content
      // passing behind the fixed bottom nav is the platform's own overlay
      // behaviour, not two labels colliding — and the list can be scrolled
      // clear of the bar, which the clearance check covers separately. Two
      // leaves inside the SAME container overlapping is the real layout bug.
      const scroller = [...document.querySelectorAll('*')].find(e => {
        const s = getComputedStyle(e);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight;
      });
      const ctxOf = (e) => (scroller && scroller.contains(e)) ? 'scroll' : 'chrome';
      const leaves = [...document.querySelectorAll('h1,h2,h3,p,span,div')]
        .filter(e => vis(e) && e.children.length === 0 && (e.textContent || '').trim().length > 1)
        .map(e => ({ r: e.getBoundingClientRect(), t: (e.textContent || '').trim().slice(0, 20), c: ctxOf(e) }))
        .filter(x => x.r.height > 2 && x.r.top > -200 && x.r.top < innerHeight);
      const hits = [];
      for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
        if (leaves[i].c !== leaves[j].c) continue;
        const a = leaves[i].r, b = leaves[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 4 && oy > 4) hits.push(`"${leaves[i].t}" x "${leaves[j].t}"`);
      }
      return [...new Set(hits)].slice(0, 5);
    })(),
    // A px line-height cannot scale with the font. When the resolved
    // line-height is SMALLER than the font size, consecutive lines print on
    // top of each other — and the glyphs spill outside the box, so neither
    // the clip check nor the rect-overlap check can see it.
    tightLines: [...document.querySelectorAll('*')].filter(e => {
      if (!vis(e) || e.children.length) return false;
      const t = (e.textContent || '').trim(); if (t.length < 2) return false;
      const st = getComputedStyle(e);
      const fs = parseFloat(st.fontSize), lh = parseFloat(st.lineHeight);
      return fs > 0 && lh > 0 && lh < fs;
    }).map(e => `${(e.textContent || '').trim().slice(0, 22)} [${getComputedStyle(e).fontSize}/${getComputedStyle(e).lineHeight}]`).slice(0, 12),
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(h => h.innerText.trim().slice(0, 26)),
    // The screen actually mounted, so a capture is labelled by what it shows
    // (a bad deep link silently lands on Today).
    h1: [...document.querySelectorAll('h1')].filter(vis).map(h => h.innerText.trim()),
    currentTab: (document.querySelector('[aria-current=page]')?.innerText || '').trim(),
    // A word whose letters sit on more than one line was broken inside itself.
    midWord: (() => {
      const bad = [];
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const n = tw.currentNode, el = n.parentElement;
        if (!el || !vis(el)) continue;
        const re = /[A-Za-z]{2,}/g; let m;
        while ((m = re.exec(n.data))) {
          let prev = null, broke = false;
          for (let k = m.index; k < m.index + m[0].length; k++) {
            const rg = document.createRange(); rg.setStart(n, k); rg.setEnd(n, k + 1);
            const rc = rg.getClientRects()[0]; if (!rc) continue;
            if (prev !== null && rc.top > prev + 2) broke = true;
            prev = rc.top;
          }
          if (broke) bad.push(m[0]);
        }
      }
      return [...new Set(bad)].slice(0, 8);
    })(),
    // Text cut off inside its own box: an ellipsis (or a hard clip) on a line
    // that is wider than the box holding it.
    cutOff: [...document.querySelectorAll('*')].filter(e => {
      if (!vis(e) || !(e.textContent || '').trim()) return false;
      const s = getComputedStyle(e);
      if (s.overflowX === 'visible' || s.overflowX === 'auto' || s.overflowX === 'scroll') return false;
      return s.textOverflow === 'ellipsis' || s.whiteSpace === 'nowrap' ? e.scrollWidth > e.clientWidth + 1 : false;
    }).map(e => (e.textContent || '').trim().slice(0, 30)).slice(0, 6),
    unlabelled: tappable.filter(e => !(e.innerText || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title'))
      .map(e => e.outerHTML.slice(0, 60)),
    themeClass: document.documentElement.className,
    mode: document.documentElement.getAttribute('data-mode'),
  };
});

try {
  await serverReady(BASE + 'index.html', { tries: 60 });
  // The repo's existing convention (see test-import-toast.mjs): use the
  // system Chrome where one exists — the runner has one and does NOT have
  // playwright's own download — and fall back to the bundled build locally.
  //
  // The two do not lay text out identically, because the runner has none of
  // this Mac's fonts. That is handled by MEASURING WITH MARGIN (the 280px
  // pass below) rather than by hoping the binaries agree.
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // ── 200% text on both flagship surfaces ─────────────────────────────────
  // 280 is below any shipping iPhone. It is here as MARGIN: the runner has
  // none of this Mac's fonts, so the same string lays out wider there, and a
  // 320-only pass locally was not predictive — CI overflowed by 37px on a
  // layout that wrapped cleanly here. 12.5% of extra squeeze comfortably
  // covers the few percent a fallback font costs.
  // Each pass also runs in Verdana: a wide face like the runner's fallbacks,
  // and the fonts #275's QA captured "Memorie / s" in. A layout that holds
  // whole words only in this Mac's fonts is not a fix.
  for (const [label, url] of [['landing', BASE], ['memories', BASE + '?tab=memories']]) {
    for (const font of [null, 'Verdana']) for (const width of [393, 320, 280]) {
      const { ctx, page } = await open(browser, { url, width, big: true, font });
      const a = await audit(page);
      const tag = `${label}${font ? '-wide' : ''}`;
      if (label === 'memories') check(a.h1.includes('Memories') && a.currentTab === 'Memories',
        `${tag} @${width}: the Memories screen is what mounted (h1 ${JSON.stringify(a.h1)}, tab "${a.currentTab}")`);
      await page.screenshot({ path: join(OUT, `${tag}-largetext__${width}.png`) });
      check(a.docPan <= 0, `${tag} @${width} 200% text: no horizontal document pan (got ${a.docPan})`);
      check(a.worstPan <= 1, `${tag} @${width} 200% text: no nested pan (got ${a.worstPan}) ${JSON.stringify(a.panWho)}`);
      check(a.clipped.length === 0, `${tag} @${width} 200% text: nothing clipped (${JSON.stringify(a.clipped)})`);
      check(a.small.length === 0, `${tag} @${width} 200% text: every target ≥44 (${JSON.stringify(a.small)})`);
      check(a.overlaps.length === 0, `${tag} @${width} 200% text: no text prints over other text (${JSON.stringify(a.overlaps)})`);
      check(a.tightLines.length === 0, `${tag} @${width} 200% text: no line-height smaller than its font (${JSON.stringify(a.tightLines)})`);
      check(a.midWord.length === 0, `${tag} @${width} 200% text: no word breaks inside itself (${JSON.stringify(a.midWord)})`);
      check(a.cutOff.length === 0, `${tag} @${width} 200% text: no text cut off inside its box (${JSON.stringify(a.cutOff)})`);
      await ctx.close();
    }
  }

  // ── Target size + labelling at normal type ───────────────────────────────
  for (const [label, url] of [['landing', BASE], ['memories', BASE + '?tab=memories']]) {
    const { ctx, page } = await open(browser, { url, width: 393 });
    const a = await audit(page);
    check(a.small.length === 0, `${label}: every target ≥44x44 (${JSON.stringify(a.small)})`);
    check(a.unlabelled.length === 0, `${label}: every control has an accessible name (${JSON.stringify(a.unlabelled)})`);
    check(a.midWord.length === 0, `${label}: no word breaks inside itself at normal type (${JSON.stringify(a.midWord)})`);
    check(a.cutOff.length === 0, `${label}: no text cut off inside its box at normal type (${JSON.stringify(a.cutOff)})`);
    // VoiceOver order proxy: headings must read top-down in a sensible order.
    note(`${label} heading order: ${JSON.stringify(a.headings)}`);
    check(a.headings.length > 0, `${label}: has headings for VoiceOver rotor navigation`);
    await ctx.close();
  }

  // ── The photo viewer never prints a broken value ────────────────────────
  // The fixture's takenAt values are ISO instants, not the "YYYY-MM-DD HH:MM"
  // wall clock the importer writes. The viewer split on a space, found none,
  // and printed "12:undefined AM" under the artist name.
  {
    const { ctx, page } = await open(browser, { url: BASE + '?tab=memories', width: 393 });
    const opener = page.locator('button[aria-label^="Open "]').first();
    const found = await opener.count();
    check(found > 0, 'viewer: the library draws a cover to open (fixture sanity)');
    if (found) {
      await opener.click();
      await sleep(600);
      const bad = await page.evaluate(() => (document.body.innerText.match(/[^\n]*\b(undefined|NaN|null)\b[^\n]*/g) || []).slice(0, 3));
      check(bad.length === 0, `viewer: no rendered text reads undefined/NaN/null (${JSON.stringify(bad)})`);
    }
    await ctx.close();
  }

  // ── Theme: recorded, not assumed ─────────────────────────────────────────
  const classes = [];
  for (const pref of ['auto', 'light', 'dark']) {
    const { ctx, page } = await open(browser, { url: BASE + '?tab=memories', width: 393, themePref: pref });
    const a = await audit(page);
    classes.push(`${pref}->${a.themeClass}|${a.mode}`);
    await ctx.close();
  }
  note(`theme pref -> <html> class: ${classes.join(', ')}`);
  // Appearance (lane ruling 2026-09-26): one system in two modes, resolved by
  // window.PlurskyAppearance from its OWN key. The retired v267 theme_pref is
  // ignored: every old value keeps the structural Field shell class and lands
  // in whatever mode the iPhone reports (this context's default, light), so
  // an old "dark" landing in Light is the proof it was ignored. Other classes
  // may sit on <html> too (#116's app-live, which the old 60s theme tick used
  // to wipe).
  const parsed = classes.map(c => { const [pref, rest] = c.split('->'); const [cls, mode] = rest.split('|'); return { pref, cls: cls.split(/\s+/), mode }; });
  check(parsed.every(p => p.cls.includes('theme-field') && p.mode === 'light'),
    `theme: the retired theme_pref must be ignored (Field shell, the iPhone's mode) (got ${classes.join(', ')})`);

  // ── Reduced motion is honoured globally ──────────────────────────────────
  {
    const { ctx, page } = await open(browser, { url: BASE + '?tab=memories', width: 393, reduced: true });
    const slow = await page.evaluate(() => [...document.querySelectorAll('*')]
      .filter(e => { const s = getComputedStyle(e); return parseFloat(s.transitionDuration) > 0.05 || parseFloat(s.animationDuration) > 0.05; }).length);
    check(slow === 0, `reduced motion: no element keeps a >50ms transition or animation (found ${slow})`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`\n  ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} accessibility checks`);
