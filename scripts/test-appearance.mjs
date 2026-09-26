#!/usr/bin/env node
// Appearance: one system, two modes, in the running app.
//   Rules (window.PlurskyAppearance in index.html):
//     · no pick + no iPhone signal → Dark (the default)
//     · no pick → follows the iPhone, live
//     · a pick in Me (Dark / Light) wins, survives a reload and ignores the iPhone
//     · System hands control back to the iPhone
//   Every screen, in BOTH modes:
//     · contrast: every visible text node meets WCAG AA against what is really
//       behind it (4.5:1, or 3:1 at ≥24px or ≥18.66px bold). Behind text on a
//       photo, artwork or gradient the background is measured in PIXELS (the
//       mean colour under the text box, text hidden).
//     · names in full: no truncated artist name, a 3+ chain as "First +N",
//       and every stage by its full name, never its code
//     · text on a photo or artwork keeps one colour in both modes (--media-ink)
//     · no mode leak: a screen toggled into a mode is pixel-identical (within
//       antialiasing) to the same screen loaded fresh in that mode, so nothing
//       stays behind in the other mode's colours.
// The clock is pinned to EDC Las Vegas night 2 (a live night) with a saved
// plan that includes a clash. No network.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const ONLY = process.argv.slice(2);   // optional: screen keys to run

const FID = 'edc-lv-2026', AT = '2026-05-17T07:50:00Z';
// key, url query, extra localStorage, a selector that proves the screen mounted
const SCREENS = [
  ['home',     'tab=home',            {},                                   '#root > *'],
  ['lineup',   'tab=lineup',          { plursky_lineup_view: 'list' },      '[data-lineup-scroll]'],
  ['grid',     'tab=lineup',          { plursky_lineup_view: 'grid' },      '[data-grid-scroll]'],
  ['map',      'tab=map',             {},                                   '#root > *'],
  ['artist',   'tab=lineup&artist=k9', {},                                  '#root > *'],
  ['me',       'tab=me',              {},                                   '[data-appearance-row]'],
  ['memories', 'tab=memories',        {},                                   '#root > *'],
  ['recap',    'tab=recap',           {},                                   '#root > *'],
  ['past',     'tab=past',            {},                                   '#root > *'],
  ['spotify',  'tab=spotify',         {},                                   '#root > *'],
  ['landing',  'tab=landing',         {},                                   '#root > *'],
].filter(([k]) => !ONLY.length || ONLY.includes(k));

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const open = async ({ scheme = 'dark', pick = null, query = 'tab=home', extra = {}, ready = '#root > *', noSignal = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    await ctx.clock.install({ time: new Date(AT) });
    await ctx.addInitScript(({ FID, pick, extra }) => {
      if (sessionStorage.getItem('__seeded')) return;   // seed once: a reload must see what the app stored
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
      localStorage.setItem('cloud_nudge_seen', '1');
      // A real plan: John Summit live, Subtronics and Mathame clashing next, a b2b.
      localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(['k15', 'k16', 'q17', 'bp8']));
      localStorage.setItem('ping_code', 'ECHO'); localStorage.setItem('plursky_pid', 'appearance-test');   // per-install randoms, pinned
      if (pick) localStorage.setItem('plursky.appearance', pick);
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    }, { FID, pick, extra });
    // No signal at all: a browser without prefers-color-scheme. Every real
    // engine reports light or dark, so the only faithful stand-in is none.
    if (noSignal) await ctx.addInitScript(() => { window.matchMedia = undefined; });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(([fid, sel]) => window.FESTIVAL_CONFIG?.id === fid && document.querySelector(sel), [FID, ready], { timeout: 60000 });
    await page.clock.runFor(2500);
    await page.waitForTimeout(300);
    // Settle: offline fetches (tracklists, bios, counts) fail on their own
    // clocks, so a page can still be growing. Wait until the tallest scroller
    // stops changing height three times running (≤ 12 tries).
    let last = -1, same = 0;
    for (let i = 0; i < 12 && same < 3; i++) {
      const h = await page.evaluate(() => Math.max(...[...document.querySelectorAll('*')].map(e => e.scrollHeight)));
      same = h === last ? same + 1 : 0; last = h;
      await page.clock.runFor(500); await page.waitForTimeout(150);
    }
    return { ctx, page, errors };
  };
  const modeOf = (page) => page.evaluate(() => document.documentElement.getAttribute('data-mode'));

  // Contrast audit of what is on screen right now.
  const audit = (page) => page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    const lum = (c) => [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const W = innerWidth, H = innerHeight, out = [];
    let media = 0, measured = 0; const mediaInk = [], mediaBoxes = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg,script,style,noscript,[aria-hidden="true"]')) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
      if (!own.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const rg = document.createRange(); rg.selectNodeContents(el);
      const r = [...rg.getClientRects()].find(q => q.width > 1 && q.height > 1 && q.bottom > 0 && q.top < H && q.right > 0 && q.left < W);
      if (!r) continue;
      const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;   // covered
      // Walk up collecting backgrounds and opacity. A background image
      // (photo or gradient) anywhere below the first opaque fill = on media.
      let op = 1, layers = [], onMedia = false;
      for (let a = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        op *= parseFloat(s.opacity);
        if (s.backgroundImage && s.backgroundImage !== 'none') { onMedia = true; break; }
        if (a.tagName === 'IMG' || a.tagName === 'VIDEO' || a.tagName === 'CANVAS') { onMedia = true; break; }
        const bg = parse(s.backgroundColor);
        if (bg && bg.a > 0) { layers.push(bg); if (bg.a >= 0.999) break; }
      }
      // Something painted UNDER the text box that is not its ancestor (an
      // absolutely positioned photo behind a caption) also means media.
      // Look BELOW the text in the paint stack, stopping at the first opaque
      // fill: a photo or gradient there (not an ancestor) means media.
      if (!onMedia) {
        const stack = document.elementsFromPoint(x, y), i0 = stack.findIndex(u => u === el || el.contains(u));
        for (const u of stack.slice(Math.max(0, i0) + 1)) {
          if (u.contains(el) || el.contains(u)) continue;   // ancestors were walked above
          const us = getComputedStyle(u);
          if (['IMG', 'VIDEO', 'CANVAS'].includes(u.tagName) || us.backgroundImage !== 'none') { onMedia = true; break; }
          const ub = parse(us.backgroundColor); if (ub && ub.a >= 0.999) break;
        }
      }
      if (onMedia) {
        media++;
        const t = own.map(n => n.textContent).join(' ').trim().slice(0, 40);
        mediaInk.push([t, cs.color]);
        const px = parseFloat(cs.fontSize), wt = parseInt(cs.fontWeight) || 400;
        el.setAttribute('data-appearance-media', String(mediaBoxes.length));
        mediaBoxes.push({ t, color: cs.color, op, large: px >= 24 || (px >= 18.66 && wt >= 700), x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(W, r.right) - Math.max(0, r.left), h: Math.min(H, r.bottom) - Math.max(0, r.top) });
        continue;
      }
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      const root = parse(getComputedStyle(document.documentElement).backgroundColor); if (root && root.a > 0) bg = over(root, bg);
      for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
      let fg = parse(cs.color); if (!fg) continue;
      fg = { ...fg, a: fg.a * op };
      if (fg.a < 0.02) continue;
      const fgc = over(fg, bg), cr = ratio(fgc, bg);
      const px = parseFloat(cs.fontSize), wt = parseInt(cs.fontWeight) || 400, large = px >= 24 || (px >= 18.66 && wt >= 700);
      measured++;
      if (cr < (large ? 3 : 4.5)) out.push({ t: own.map(n => n.textContent).join(' ').trim().replace(/\s+/g, ' ').slice(0, 40), cr: +cr.toFixed(2), fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, px, sel: el.tagName.toLowerCase() + (el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : '') });
    }
    return { fails: out, media, measured, mediaInk, mediaBoxes };
  });

  // Names in full (lane ruling 2026-09-26), mode-independent, so run once:
  //   · an artist name is never truncated: no ellipsis, no line clamp that
  //     hides text, no "…" cut after the start of a real name
  //   · a chain of 3+ artists shows as "First +N", never in full
  //   · a stage is never shown by its code (KIN, QNT…)
  const names = (page) => page.evaluate(() => {
    const out = [], W = innerWidth, H = innerHeight;
    const artists = (window.ARTISTS || []).map(a => a.name).filter(Boolean);
    const lower = artists.map(n => n.toLowerCase());
    // A code that is also an ordinary UI word is not a stage reference:
    // BIO is Bionic Jungle's code AND the artist page's Bio tab.
    const WORDS = new Set(['BIO']);
    const codes = new Set((window.STAGES || []).map(s => s.code).filter(c => c && !WORDS.has(c) && !(window.STAGES || []).some(s => s.name === c)));
    const isName = (t) => { const l = t.toLowerCase(); return lower.some(n => l.includes(n)); };
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('script,style,noscript')) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
      if (!own.length) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const t = el.textContent.trim().replace(/\s+/g, ' ');
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      if (isName(t) && ((cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (clamp && el.scrollHeight > el.clientHeight + 1)))
        out.push(`artist name truncated by ${clamp ? 'a line clamp' : 'an ellipsis'}: "${t.slice(0, 40)}"`);
      const cut = t.match(/([^·•|]{3,}?)…/);
      if (cut) { const pre = cut[1].trim().replace(/^[★•·\s]+/, '').toLowerCase(); if (pre.length >= 3 && lower.some(n => n.startsWith(pre) && n !== pre)) out.push(`artist name cut with "…": "${t.slice(0, 40)}"`); }
      if ((t.match(/\bb\d+b\b/gi) || []).length >= 2) out.push(`3+ artist chain shown in full (use the first artist + N): "${t.slice(0, 40)}"`);
      for (const n of own) for (const w of n.textContent.split(/[^A-Za-z0-9]+/)) if (w && codes.has(w)) out.push(`stage shown as its code "${w}": "${t.slice(0, 40)}"`);
    }
    return out;
  });

  // A settled screenshot: async content (a fetched photo, a late count) can
  // land between two captures, which reads as a leak when it is only timing.
  // Retake until two consecutive captures agree (≤ 6 tries).
  // `animations: 'disabled'` stops CSS animations only; SVG <animate>
  // (the map's stage pulses) keeps running, so park every SVG at t=0 too.
  const still = (page) => page.evaluate(() => document.querySelectorAll('svg').forEach(s => { try { s.pauseAnimations(); s.setCurrentTime(0); } catch {} })).then(() => page.screenshot({ animations: 'disabled' }));
  const shot = async (page) => {
    let prev = await still(page);
    for (let i = 0; i < 6; i++) {
      await page.clock.runFor(400); await page.waitForTimeout(250);
      const cur = await still(page);
      if (cur.equals(prev)) return cur;
      prev = cur;
    }
    return prev;
  };
  // The main scroller: the largest vertically scrolling box. Marked so the
  // audit, the fresh shots and the toggled shots all step the SAME element.
  const markScroller = (page) => page.evaluate(() => {
    const sc = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200; }).sort((x, y) => y.clientWidth * y.clientHeight - x.clientWidth * x.clientHeight)[0];
    if (!sc) return 1; sc.setAttribute('data-appearance-scroller', ''); return Math.min(12, Math.ceil(sc.scrollHeight / (sc.clientHeight * 0.8)));
  });
  const scrollTo = async (page, i) => { await page.evaluate(i => { const sc = document.querySelector('[data-appearance-scroller]'); if (sc) sc.scrollTop = i * sc.clientHeight * 0.8; }, i); await page.clock.runFor(300); await page.waitForTimeout(80); };
  // Text ON a photo, artwork or gradient: its background is pixels, not a
  // colour, so measure the pixels. Hide the text, screenshot, and take the
  // mean colour under each text box; the text must meet AA against it.
  const mediaContrast = async (page, boxes) => {
    if (!boxes.length) return [];
    await page.evaluate(() => { for (const e of document.querySelectorAll('[data-appearance-media]')) { e.dataset.appearanceColor = e.style.color; e.dataset.appearanceShadow = e.style.textShadow; e.style.setProperty('color', 'transparent', 'important'); e.style.setProperty('text-shadow', 'none', 'important'); } });
    const png = await page.screenshot({ animations: 'disabled' });
    await page.evaluate(() => { for (const e of document.querySelectorAll('[data-appearance-media]')) { e.style.removeProperty('color'); e.style.removeProperty('text-shadow'); if (e.dataset.appearanceColor) e.style.color = e.dataset.appearanceColor; if (e.dataset.appearanceShadow) e.style.textShadow = e.dataset.appearanceShadow; e.removeAttribute('data-appearance-media'); delete e.dataset.appearanceColor; delete e.dataset.appearanceShadow; } });
    return cmp.evaluate(async ([b64, boxes]) => {
      const i = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + b64; });
      const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const g = k.getContext('2d'); g.drawImage(i, 0, 0);
      const sx = i.width / innerWidth;   // the page's viewport width is what the boxes are in
      const lum = (c) => c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, j) => s + v * [0.2126, 0.7152, 0.0722][j], 0);
      const out = [];
      for (const b of boxes) {
        if (b.w < 2 || b.h < 2) continue;
        const d = g.getImageData(Math.round(b.x * sx), Math.round(b.y * sx), Math.max(1, Math.round(b.w * sx)), Math.max(1, Math.round(b.h * sx))).data;
        let R = 0, G = 0, B = 0, n = 0; for (let q = 0; q < d.length; q += 4) { R += d[q]; G += d[q + 1]; B += d[q + 2]; n++; }
        const bg = [R / n, G / n, B / n];
        const m = b.color.match(/rgba?\(([^)]+)\)/); if (!m) continue;
        const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number), a = (p.length > 3 ? p[3] : 1) * b.op;
        const fg = [0, 1, 2].map(j => p[j] * a + bg[j] * (1 - a));
        const [x, y] = [lum(fg), lum(bg)].sort((u, v) => v - u), cr = (x + 0.05) / (y + 0.05);
        if (cr < (b.large ? 3 : 4.5)) out.push({ t: b.t, cr: +cr.toFixed(2), fg: b.color, bg: `pixels rgb(${bg.map(Math.round).join(',')})`, px: b.large ? 'large' : 'small' });
      }
      return out;
    }, [png.toString('base64'), boxes]);
  };
  const cmp = await browser.newPage();
  await cmp.setViewportSize({ width: 393, height: 852 });
  const diffPx = (a, b) => cmp.evaluate(async ([a, b]) => {
    const im = (s) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const px = (i) => { const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const g = k.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const [i1, i2] = [await im(a), await im(b)]; if (i1.width !== i2.width || i1.height !== i2.height) return { n: 1e9, box: 'size' };
    const [d1, d2] = [px(i1), px(i2)]; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let p = 0; p < d1.length; p += 4) if (Math.max(Math.abs(d1[p] - d2[p]), Math.abs(d1[p + 1] - d2[p + 1]), Math.abs(d1[p + 2] - d2[p + 2])) > 96) {
      n++; const q = p / 4, x = q % i1.width, y = (q / i1.width) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { n, box: n ? `${x0},${y0}–${x1},${y1}` : '' };
  }, [a.toString('base64'), b.toString('base64')]);

  // Layout boxes of every element, for leak evidence: a failure can then say
  // WHICH element moved or changed under the differing box.
  const rects = (page) => page.evaluate(() => [...document.querySelectorAll('body *')].map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { e: e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : ''), x: r.x, y: r.y, w: r.width, h: r.height, font: `${c.fontFamily} ${c.fontSize} ${c.letterSpacing}`, t: (e.childElementCount ? '' : e.textContent || '').slice(0, 24) }; }).filter(r => r.w && r.h));
  const totals = {};
  const nameFails = new Set();
  const onMediaInk = {};   // `${screen}/${mode}` → text → colour, for text on a photo
  for (const [key, query, extra, ready] of SCREENS) {
    for (const mode of ['dark', 'light']) {
      const other = mode === 'dark' ? 'light' : 'dark';
      // fresh in this mode
      const A = await open({ scheme: 'dark', pick: mode, query, extra, ready });
      check((await modeOf(A.page)) === mode, `[${key}] picked ${mode} but the page is ${await modeOf(A.page)}`);
      // Audit the whole screen, not the first viewport: step the main
      // scroller, and keep a settled screenshot of every screenful for the
      // leak check below (a leak below the fold is still a leak).
      const a = { fails: [], media: 0, measured: 0 }, seen = new Set(), fresh = [], freshRects = [];
      onMediaInk[`${key}/${mode}`] = new Map();
      const steps = await markScroller(A.page);
      for (let i = 0; i < steps; i++) {
        if (i) await scrollTo(A.page, i);
        fresh.push(await shot(A.page));
        if (process.env.APPEARANCE_EVIDENCE) freshRects[i] = await rects(A.page);
        const r = await audit(A.page);
        a.media += r.media; a.measured += r.measured;
        for (const [t, c] of r.mediaInk) onMediaInk[`${key}/${mode}`].set(t, c);
        for (const f of await mediaContrast(A.page, r.mediaBoxes)) { const k = f.t + f.fg; if (!seen.has(k)) { seen.add(k); a.fails.push(f); } }
        if (mode === 'dark') for (const x of await names(A.page)) nameFails.add(`[${key}] ${x}`);
        for (const f of r.fails) { const k = f.t + f.fg; if (!seen.has(k)) { seen.add(k); a.fails.push(f); } }
      }
      await A.page.evaluate(() => { const sc = document.querySelector('[data-appearance-scroller]'); if (sc) { sc.scrollTop = 0; sc.removeAttribute('data-appearance-scroller'); } });
      await A.page.clock.runFor(300); await A.page.waitForTimeout(80);
      totals[`${key}/${mode}`] = { measured: a.measured, media: a.media, fails: a.fails.length, steps };
      check(a.measured > 0, `[${key}/${mode}] measured no text at all (the screen did not render?)`);
      for (const f of a.fails) check(false, `[${key}/${mode}] contrast ${f.cr}:1 "${f.t}" (${f.fg} on ${f.bg}, ${f.px}px)`);
      check(!A.errors.length, `[${key}/${mode}] page errors: ${A.errors.join(' | ')}`);
      await A.ctx.close();
      // loaded in the other mode, then toggled into this one
      const B = await open({ scheme: 'dark', pick: other, query, extra, ready });
      await B.page.evaluate(m => window.PlurskyAppearance.set(m), mode);
      await B.page.clock.runFor(500); await B.page.waitForTimeout(250);
      const bSteps = await markScroller(B.page);
      check(bSteps === steps, `[${key}] toggled ${other}→${mode} has ${bSteps} screenfuls, fresh has ${steps}`);
      for (let i = 0; i < Math.min(steps, bSteps); i++) {
        if (i) await scrollTo(B.page, i);
        const toggled = await shot(B.page);
        const { n, box } = await diffPx(toggled, fresh[i]);
        if (n >= 20 && process.env.APPEARANCE_EVIDENCE) {
          const dir = process.env.APPEARANCE_EVIDENCE, tag = `${key}-${other}-to-${mode}-${i + 1}`;
          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}/${tag}-fresh.png`, fresh[i]); writeFileSync(`${dir}/${tag}-toggled.png`, toggled);
          const [bx0, by0, bx1, by1] = box.split(/[,–]/).map(Number), hit = r => r.x <= bx1 && r.x + r.w >= bx0 && r.y <= by1 && r.y + r.h >= by0;
          writeFileSync(`${dir}/${tag}-rects.json`, JSON.stringify({ box, fresh: (freshRects[i] || []).filter(hit), toggled: (await rects(B.page)).filter(hit) }, null, 1));
        }
        // Noise ceiling 20 px. Once the map's SVG pulses were parked and its
        // idle wander honoured Reduce Motion, noise measured 0 px in 10 of 10
        // toggles (it had reached 257 px); the smallest planted leak is 11,221 px.
        check(n < 20, `[${key}] toggled ${other}→${mode} differs from a fresh ${mode} load at ${n} px in ${box} on screenful ${i + 1} (a colour did not follow the mode)`);
      }
      await B.ctx.close();
    }
  }

  for (const x of nameFails) check(false, x);
  // Text on a photo or artwork sits on the picture, not on the mode's ground,
  // so its colour must not change with the mode (use --media-ink).
  for (const [key] of SCREENS) {
    const d = onMediaInk[`${key}/dark`], l = onMediaInk[`${key}/light`];
    if (!d || !l) continue;
    for (const [t, c] of d) if (l.has(t) && l.get(t) !== c) check(false, `[${key}] "${t}" sits on a photo but changes colour with the mode (${c} → ${l.get(t)}); use --media-ink`);
  }
  check(true, 'names audit ran');

  // ── Rules ─────────────────────────────────────────────────────────────────
  {
    const scen = async (scheme, pick, expect, why, noSignal = false) => { const o = await open({ scheme, pick, query: 'tab=me', ready: '[data-appearance-row]', noSignal }); check((await modeOf(o.page)) === expect, `rule: ${why}: expected ${expect}, got ${await modeOf(o.page)}`); return o; };
    (await scen('light', null, 'dark', 'no pick, no iPhone signal → Dark', true)).ctx.close();
    (await scen('dark', null, 'dark', 'no pick, iPhone Dark')).ctx.close();
    (await scen('light', null, 'light', 'no pick, iPhone Light')).ctx.close();
    (await scen('light', 'dark', 'dark', 'picked Dark on a light iPhone')).ctx.close();
    (await scen('dark', 'light', 'light', 'picked Light on a dark iPhone')).ctx.close();
    const { ctx, page } = await scen('dark', null, 'dark', 'fresh install on a dark iPhone');
    await page.click('[data-appearance-row] [data-appearance="light"]');
    check((await modeOf(page)) === 'light', 'rule: tapping Light in Me did not switch');
    check((await page.getAttribute('[data-appearance-row] [data-appearance="light"]', 'aria-checked')) === 'true', 'rule: the Me row does not show Light as picked');
    // The app consumes ?tab= from the URL, so a relaunch is a fresh open of the same address.
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=me`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('[data-appearance-row]', { timeout: 60000 });
    check((await modeOf(page)) === 'light', 'rule: the Light pick did not survive a reload');
    await page.emulateMedia({ colorScheme: 'light' }); await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(150);
    check((await modeOf(page)) === 'light', 'rule: an iPhone change overrode the pick');
    await page.click('[data-appearance-row] [data-appearance="system"]');
    check((await modeOf(page)) === 'dark', 'rule: System did not hand back to the iPhone (dark)');
    await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(150);
    check((await modeOf(page)) === 'light', 'rule: on System, the iPhone flipping to Light was not followed live');
    check(!(await page.evaluate(() => localStorage.getItem('theme_pref'))), 'rule: the retired theme_pref key was written');
    await ctx.close();
  }

  console.log(Object.entries(totals).map(([k, v]) => `  ${k}: ${v.measured} text nodes measured over ${v.steps} screenful(s), ${v.media} on media, ${v.fails} below AA`).join('\n'));
} catch (e) {
  problems.push(`harness: ${e.message}`);
} finally {
  await browser?.close();
  server.kill();
}
if (problems.length) { console.log(`✗ appearance: ${problems.length} of ${checks} checks failed`); problems.forEach(p => console.log('   ' + p)); process.exit(1); }
console.log(`✓ appearance: ${checks} checks`);
