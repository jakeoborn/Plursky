#!/usr/bin/env node
// Lineup list for humans, in the running app.
//   Header: a downward scroll past a small threshold folds the WHOLE filter
//   header (title, days, weekend, show row, search, count) into one compact
//   bar that names the selection; an upward scroll or a tap on the bar brings
//   it back; the list's scroll position never jumps; tiny scrolls do nothing;
//   folded controls are inert; reduced motion drops the animation; GRID
//   behaves the same on its own scroller.
//   Rows: the artist name is the loudest text; no "· —" placeholder or
//   dangling separator; no "Weekend N" when one weekend is selected; meta text
//   meets WCAG AA; save buttons are 44px and vertically centred.
// The clock is pinned to a live ACL Weekend 1 evening. No network.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch {} await sleep(100); }
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const open = async ({ fid = 'acl-2026', at = '2026-10-03T01:30:00Z', view = 'list', width = 393, reduced = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await ctx.clock.install({ time: new Date(at) });
    await ctx.addInitScript(({ fid, view }) => {
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', fid); localStorage.setItem('active_festival_explicit', '1');
      localStorage.setItem('plursky_lineup_view', view); localStorage.setItem('cloud_nudge_seen', '1');
    }, { fid, view });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${fid}&tab=lineup`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && document.querySelector('[data-lineup-filters]') && document.querySelector('[data-lineup-scroll]'), fid, { timeout: 60000 });
    await page.clock.runFor(2500);
    return { ctx, page };
  };
  const state = (page) => page.evaluate(() => {
    const f = document.querySelector('[data-lineup-filters]'), c = document.querySelector('[data-lineup-compact]');
    const sc = document.querySelector('[data-grid-scroll]') && localStorage.getItem('plursky_lineup_view') === 'grid' ? document.querySelector('[data-grid-scroll]') : document.querySelector('[data-lineup-scroll]');
    return {
      collapsed: f?.dataset.collapsed === '1', filtersH: f ? f.getBoundingClientRect().height : -1, compactH: c ? c.getBoundingClientRect().height : -1,
      filtersInert: f?.hasAttribute('inert'), compactInert: c?.hasAttribute('inert'),
      summary: c?.querySelector('[data-lineup-expand]')?.textContent.trim(), scrollTop: sc ? sc.scrollTop : -1,
      transition: f ? getComputedStyle(f).transitionDuration : null,
    };
  });
  // A thumb: small wheel steps with the clock moving between them.
  const drag = async (page, dy, steps = 6, sel = '[data-lineup-scroll]') => {
    const box = await page.locator(sel).first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 300));
    const tops = [];
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, dy / steps);
      await page.clock.runFor(40);
      tops.push(await page.evaluate(s => document.querySelector(s).scrollTop, sel));
    }
    await page.clock.runFor(400); await page.waitForTimeout(350);
    tops.push(await page.evaluate(s => document.querySelector(s).scrollTop, sel));
    return tops;
  };

  // ── Header, LIST ─────────────────────────────────────────────────────────
  try {
    const { ctx, page } = await open();
    let s = await state(page);
    check(!s.collapsed && s.filtersH > 200, `list opens with the full header (collapsed=${s.collapsed}, ${s.filtersH}px)`);
    check(s.compactH < 1 && s.compactInert, `the compact bar is hidden and inert while the header is open (${s.compactH}px, inert=${s.compactInert})`);
    // A tiny scroll must not fold it.
    await drag(page, 30, 3);
    s = await state(page);
    check(!s.collapsed, 'a 30px scroll folds the header (no threshold)');
    // A real downward drag folds everything into one bar.
    const t0 = (await state(page)).scrollTop;
    const tops = await drag(page, 700, 8);
    const maxTop = await page.evaluate(() => { const e = document.querySelector('[data-lineup-scroll]'); return e.scrollHeight - e.clientHeight; });
    s = await state(page);
    check(s.collapsed, 'a downward scroll past the threshold does not fold the header');
    check(s.filtersH < 1, `folded header still takes ${s.filtersH}px`);
    check(s.compactH >= 44 && s.compactH <= 56, `compact bar is ${s.compactH}px, spec says ~44–52px`);
    check(s.filtersInert && !s.compactInert, `folded controls are not inert (filters inert=${s.filtersInert}, bar inert=${s.compactInert})`);
    check(s.summary === 'Fri 2 · Weekend 1 · All stages', `compact bar reads "${s.summary}", expected "Fri 2 · Weekend 1 · All stages"`);
    // No jump: the list's own scroll position only ever moved the way the thumb did.
    const back = tops.findIndex((t, i) => i > 0 && t < tops[i - 1] - 2);
    check(back === -1, `list scroll position jumped backwards while folding: ${tops.join(',')}`);
    // And it moved by exactly what the thumb scrolled: a fold that shifts the
    // list, even when later scrolling hides it, shows up as a shortfall.
    const moved = tops[tops.length - 1] - t0;
    check(Math.abs(moved - 700) <= 4 || tops[tops.length - 1] >= maxTop - 1, `list moved ${moved}px for a 700px scroll while folding (${t0} → ${tops.join(',')})`);
    const settled = s.scrollTop; await page.clock.runFor(600); await page.waitForTimeout(300);
    check(Math.abs((await state(page)).scrollTop - settled) <= 1, 'list scroll position drifted after the header folded');
    // Tap the bar: back, same list position.
    const before = (await state(page)).scrollTop;
    await page.click('[data-lineup-expand]'); await page.clock.runFor(500); await page.waitForTimeout(350);
    s = await state(page);
    check(!s.collapsed && s.filtersH > 200, 'a tap on the compact bar does not bring the header back');
    check(Math.abs(s.scrollTop - before) <= 1, `list scroll position jumped on expand: ${before} → ${s.scrollTop}`);
    // Fold again, then an upward scroll brings it back.
    await drag(page, 500, 6);
    check((await state(page)).collapsed, 'header did not fold again on a second downward scroll');
    await drag(page, -120, 4);
    check(!(await state(page)).collapsed, 'an upward scroll does not bring the header back');
    // Search from the bar focuses the search input.
    await drag(page, 500, 6);
    await page.click('[data-lineup-search-open]'); await page.clock.runFor(400); await page.waitForTimeout(350);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    check(focused === 'Search the lineup', `the bar's search button does not focus search (focused: ${focused})`);
    await ctx.close();
  } catch (err) { check(false, `Header, LIST block threw: ${String(err.message || err).split("\n")[0]}`); }

  // ── Reduced motion ───────────────────────────────────────────────────────
  try {
    const { ctx, page } = await open({ reduced: true });
    const s = await state(page);
    // index.html's global reduced-motion rule forces 0.01ms on everything;
    // anything under a millisecond is "no animation".
    check(parseFloat(s.transition) < 0.001, `reduced motion still animates the header (${s.transition})`);
    await ctx.close();
  } catch (err) { check(false, `Reduced motion block threw: ${String(err.message || err).split("\n")[0]}`); }

  // ── GRID: same behaviour on its own scroller ─────────────────────────────
  try {
    const { ctx, page } = await open({ view: 'grid' });
    await page.waitForFunction(() => !!document.querySelector('[data-grid-scroll]'), null, { timeout: 20000 });
    await page.waitForTimeout(500); // CSS transitions run on real time, not the pinned clock
    let s = await state(page);
    check(s.collapsed && s.compactH >= 44, `grid does not open with the compact bar (collapsed=${s.collapsed}, bar ${s.compactH}px)`);
    await page.click('[data-lineup-expand]'); await page.clock.runFor(500); await page.waitForTimeout(350);
    check(!(await state(page)).collapsed, 'grid: a tap on the bar does not open the header');
    // The grid opens scrolled to NOW, near the end of its range; start at the
    // top so a downward drag has room, like a user reading from the first set.
    await page.evaluate(() => { document.querySelector('[data-grid-scroll]').scrollTop = 0; });
    await page.clock.runFor(300); await page.waitForTimeout(300);
    await drag(page, 700, 8, '[data-grid-scroll]');
    check((await state(page)).collapsed, 'grid: a downward scroll on the grid does not fold the header');
    await drag(page, -150, 4, '[data-grid-scroll]');
    check(!(await state(page)).collapsed, 'grid: an upward scroll does not bring the header back');
    await ctx.close();
  } catch (err) { check(false, `GRID block threw: ${String(err.message || err).split("\n")[0]}`); }

  // ── Rows ─────────────────────────────────────────────────────────────────
  for (const width of [320, 393]) {
    const { ctx, page } = await open({ width });
    const r = await page.evaluate(() => {
      const rgba = (c) => { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
      const lumRGB = ([r, g, b]) => { const [R, G, B] = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; };
      // A translucent text colour is what it composites to over its ground.
      const ratio = (fg, bg) => {
        const B = rgba(bg), F = rgba(fg);
        const mixed = [0, 1, 2].map(i => F[i] * F[3] + B[i] * (1 - F[3]));
        const [x, y] = [lumRGB(mixed), lumRGB(B)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const rows = [...document.querySelectorAll('[data-lineup-scroll] [data-set-name]')].map(n => n.closest('[data-animate]'));
      const data = (window.ARTISTS || []).filter(a => a.day === 1);
      return {
        rows: rows.length,
        placeholderInData: data.filter(a => /^[-–—]$/.test(String(a.genre || '').trim())).length,
        weekendScopedInData: data.filter(a => a.weekend === 'W1' || a.weekend === 'W2').length,
        metas: rows.map(r => r.querySelector('[data-set-meta]').textContent),
        rowText: rows.map(r => r.innerText),
        contrast: rows.slice(0, 6).map(r => { const m = r.querySelector('[data-set-meta]'); return ratio(getComputedStyle(m).color, bgOf(m)); }),
        nameVsTime: rows.slice(0, 6).map(r => {
          const n = getComputedStyle(r.querySelector('[data-set-name]')), t = getComputedStyle(r.querySelector('[data-set-time] div'));
          return { name: parseFloat(n.fontSize), nameW: +n.fontWeight, time: parseFloat(t.fontSize) };
        }),
        saves: rows.slice(0, 8).map(r => {
          const b = r.querySelector('button[aria-pressed]').getBoundingClientRect(), rb = r.getBoundingClientRect();
          return { w: b.width, h: b.height, off: Math.abs((b.top + b.height / 2) - (rb.top + rb.height / 2)), rowH: rb.height };
        }),
        dots: rows.slice(0, 6).map(r => getComputedStyle(r.querySelector('[data-set-meta] span')).backgroundColor),
      };
    });
    const at = `[${width}px ACL W1 Fri]`;
    check(r.rows > 10, `${at} only ${r.rows} rows rendered`);
    check(r.placeholderInData > 0, `${at} control: the data has no "—" genre placeholders, so the rule is untested`);
    check(r.weekendScopedInData > 0, `${at} control: no weekend-scoped sets in the data, so the label rule is untested`);
    for (const m of r.metas) check(!/(^|·)\s*[-–—]\s*(·|$)|·\s*·|^\s*·|·\s*$/.test(m.trim()) && !/—/.test(m), `${at} meta line carries a placeholder or dangling separator: "${m}"`);
    check(!r.rowText.some(t => /\bWeekend [12]\b/.test(t)), `${at} a row repeats "Weekend N" while one weekend is selected`);
    for (const c of r.contrast) check(c >= 4.5, `${at} meta text contrast ${c.toFixed(2)} is under WCAG AA 4.5`);
    for (const x of r.nameVsTime) check(x.name > x.time && x.nameW >= 700, `${at} artist name (${x.name}px/${x.nameW}) is not the loudest text (time ${x.time}px)`);
    for (const s of r.saves) {
      check(Math.round(s.w) >= 44 && Math.round(s.h) >= 44, `${at} save button ${s.w}x${s.h} is under 44px`);
      check(s.off <= 2, `${at} save button is ${s.off.toFixed(1)}px off the row's vertical centre`);
      check(s.rowH >= 64, `${at} row height ${s.rowH} under the 64px rhythm`);
    }
    // Jake's standing call (2026-09-13): stage colours only on the map.
    check(new Set(r.dots).size === 1, `${at} row dots carry stage colours (${[...new Set(r.dots)].join(' ')}); stage colours are map-only`);
    await ctx.close();
  }

  // ── A single-weekend festival: summary has no weekend, rows unchanged ────
  try {
    const { ctx, page } = await open({ fid: 'edc-lv-2026', at: '2026-05-16T05:30:00Z' });
    await drag(page, 700, 8);
    const s = await state(page);
    check(s.collapsed && s.summary === 'Fri 15 · All stages', `EDC compact bar reads "${s.summary}", expected "Fri 15 · All stages"`);
    await ctx.close();
  } catch (err) { check(false, `A single-weekend festival block threw: ${String(err.message || err).split("\n")[0]}`); }
  await browser.close();
} finally { server.kill(); }

if (problems.length) {
  console.log(`  ✗ lineup readability: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log('    ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ lineup readability: ${checks} checks — header folds and returns without a jump, rows read`);
