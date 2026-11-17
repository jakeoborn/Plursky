#!/usr/bin/env node
// III Points accent pops (Item 3, option B): on the charcoal/chalk base, the
// festival's own print-ledger accent (yellow, with pink as the second colour)
// reaches beyond the poster's thin rule — the Today hero's fold band and
// stamp, the section headers, the map chrome and the selected stage chip —
// for a festival whose ledger row opts in (`print.pops: true`), and nowhere
// else. Proved in the running app, both modes, at 390 and 320, on fixtures:
//   · the gate: <html data-fest-pop> and --fp-acc come from festivalPops(),
//     which reads the ledger row (no hex in the gate), only for III Points
//   · every pop paints the ledger's own hex (accent, or accent2 on the stamp)
//   · text ON an accent fill meets WCAG AA (4.5:1) in Dark AND Light; a
//     section header's text meets AA against its sheet (the accent is the
//     rule under it; it is text colour only in Dark, where it reads)
//   · the poster itself stays the paper with the accent as its ≤4px rule
//   · control: a festival with a verified accent but no opt-in (EDC Las
//     Vegas) renders the base: no attribute, ink fold band, unfilled stamp,
//     undecorated headers, ink-filled selected chips, no header rule
//   · the artist page, with and without a ledger portrait, rules its headers
// Usage: node scripts/test-iiip-accent-pops.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
import { wireVendor } from './lib/vendor-cdn.mjs';

const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });

const INK = { light: 'rgb(32, 35, 35)', dark: 'rgb(242, 243, 235)' };
// key, festival, pinned clock (pre-festival, so the full poster prints), pops expected
const FIXTURES = [
  ['iii', 'iii-points-2026', '2026-10-09T18:00:00Z', true],
  ['control-edc', 'edc-lv-2026', '2026-05-01T18:00:00Z', false],
];

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.env.NP_ROOT || process.cwd(), stdio: 'ignore' });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const open = async ({ fid, at, pick, width }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: pick });
    await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`), r => r.abort());
    await wireVendor(ctx);
    await ctx.clock.install({ time: new Date(at) });
    await ctx.addInitScript(({ fid, pick }) => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', fid); localStorage.setItem('active_festival_explicit', '1');
      localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('setup_banner_dismissed', '1'); localStorage.setItem('notif_nudge_dismissed', '1');
      localStorage.setItem('plursky_pid', 'accent-pops-gate'); localStorage.setItem('plursky.appearance', pick);
      if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity, addEventListener() {}, removeEventListener() {} });
    }, { fid, pick });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    return { ctx, page, errors };
  };
  const go = async (page, query, ready) => {
    await page.goto(`http://127.0.0.1:${PORT}/index.html?${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ready, { timeout: 60000 });
    await page.clock.runFor(1500); await page.waitForTimeout(300);
  };

  // Shared in-page helpers: hex → rgb string, WCAG contrast of two computed colours,
  // and the effective background behind an element (first non-transparent ancestor).
  const HELPERS = `
    window.__ap = {
      rgb(hex) { const n = parseInt(hex.slice(1), 16); return 'rgb(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')'; },
      parse(c) { const m = String(c).match(/[\\d.]+/g) || []; return m.slice(0, 4).map(Number); },
      lum(c) { const [r, g, b] = this.parse(c); return [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); },
      ratio(a, b) { const x = this.lum(a), y = this.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); },
      bg(el) { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const p = this.parse(c); if (p.length && (p.length < 4 || p[3] > 0.99)) return c; } return getComputedStyle(document.body).backgroundColor; },
    };`;

  for (const [key, fid, at, pops] of FIXTURES) {
    for (const pick of ['light', 'dark']) {
      for (const width of [390, 320]) {
        const tag = `${key} ${pick} ${width}`;
        const { ctx, page, errors } = await open({ fid, at, pick, width });
        try {
          // ── Today: the hero (fold band, stamp, poster rule) and the section eyebrow
          await go(page, 'tab=home', '[data-night-print] [data-np-poster]');
          await page.addScriptTag({ content: HELPERS });
          const t = await page.evaluate(() => {
            const A = window.__ap, root = document.documentElement;
            const p = window.FESTIVAL_CONFIG?.print || {};
            const fp = typeof window.festivalPops === 'function' ? window.festivalPops() : null;
            const poster = document.querySelector('[data-np-poster]'), cut = poster?.querySelector('.np-cut'), stamp = poster?.querySelector('.np-stamp');
            const cutText = cut ? [...cut.querySelectorAll('b, span')].filter(e => e.textContent.trim()) : [];
            const eyebrow = document.querySelector('[data-np-claim] > .np-mono, [data-np-saved] > div:first-child > .np-mono');
            const ecs = eyebrow && getComputedStyle(eyebrow);
            return {
              fid: window.FESTIVAL_CONFIG?.id, mode: root.getAttribute('data-mode'),
              attr: root.getAttribute('data-fest-pop'), varAcc: getComputedStyle(root).getPropertyValue('--fp-acc').trim(),
              varAcc2: getComputedStyle(root).getPropertyValue('--fp-acc2').trim(),
              ledger: { acc: p.accent || null, acc2: p.accent2 || null, accRgb: p.accent ? A.rgb(p.accent) : null, acc2Rgb: p.accent2 ? A.rgb(p.accent2) : null, pops: p.pops === true },
              fp,
              posterBg: poster && getComputedStyle(poster).backgroundColor, paper: getComputedStyle(document.querySelector('[data-night-print]')).backgroundColor,
              ruleW: poster && parseFloat(getComputedStyle(poster).borderTopWidth), ruleC: poster && getComputedStyle(poster).borderTopColor,
              cutBg: cut && getComputedStyle(cut).backgroundColor,
              cutAA: cutText.map(e => ({ t: e.textContent.trim().slice(0, 30), r: A.ratio(getComputedStyle(e).color, A.bg(e)) })),
              stampBg: stamp && getComputedStyle(stamp).backgroundColor,
              stampAA: stamp ? A.ratio(getComputedStyle(stamp).color, A.bg(stamp)) : null,
              eyebrow: eyebrow ? { text: eyebrow.textContent.trim(), deco: ecs.textDecorationLine, decoC: ecs.textDecorationColor, color: ecs.color, aa: A.ratio(ecs.color, A.bg(eyebrow)) } : null,
            };
          });
          check(t.fid === fid, `${tag}: mounted ${t.fid}, want ${fid}`);
          check(t.mode === pick, `${tag}: mode is ${t.mode}`);
          check(t.posterBg === t.paper, `${tag}: the poster is ${t.posterBg}, the sheet ${t.paper} (the base stays the paper)`);
          check(t.ruleW > 0 && t.ruleW <= 4 && t.ruleC === t.ledger.accRgb, `${tag}: poster rule ${t.ruleW}px ${t.ruleC} (want the ledger accent ${t.ledger.accRgb}, ≤4px)`);
          if (pops) {
            check(t.ledger.pops, `${tag}: the ledger row does not opt in (print.pops)`);
            check(t.attr === 'on', `${tag}: <html data-fest-pop> is ${t.attr}, want "on"`);
            check(!!t.fp && t.fp.acc === t.ledger.acc, `${tag}: festivalPops() gives ${JSON.stringify(t.fp)}, ledger accent ${t.ledger.acc}`);
            check(t.varAcc.toUpperCase() === String(t.ledger.acc).toUpperCase(), `${tag}: --fp-acc is "${t.varAcc}", ledger ${t.ledger.acc}`);
            check(t.cutBg === t.ledger.accRgb, `${tag}: the hero fold band is ${t.cutBg}, want the accent fill ${t.ledger.accRgb}`);
            check(t.cutAA.length > 0 && t.cutAA.every(x => x.r >= 4.5), `${tag}: fold band text on the accent: ${JSON.stringify(t.cutAA)} (want ≥4.5)`);
            check(t.stampBg === (t.ledger.acc2Rgb || t.ledger.accRgb), `${tag}: the stamp is ${t.stampBg}, want the second accent ${t.ledger.acc2Rgb}`);
            check(t.stampAA >= 4.5, `${tag}: stamp text on the accent reads ${t.stampAA?.toFixed(2)}:1 (want ≥4.5)`);
            check(t.eyebrow && /underline/.test(t.eyebrow.deco) && t.eyebrow.decoC === t.ledger.accRgb, `${tag}: the section eyebrow is not ruled in the accent: ${JSON.stringify(t.eyebrow)}`);
            check(t.eyebrow && t.eyebrow.aa >= 4.5, `${tag}: the section eyebrow reads ${t.eyebrow?.aa?.toFixed(2)}:1 on its sheet (want ≥4.5)`);
            if (pick === 'light') check(t.eyebrow && t.eyebrow.color === INK.light, `${tag}: in Light the eyebrow must stay ink (yellow on chalk fails), is ${t.eyebrow?.color}`);
          } else {
            check(!t.ledger.pops, `${tag}: the control's ledger row opts in`);
            check(t.attr == null, `${tag}: <html data-fest-pop> is ${t.attr} on a festival that does not opt in`);
            check(t.fp == null, `${tag}: festivalPops() is ${JSON.stringify(t.fp)} on a festival that does not opt in`);
            check(t.cutBg === INK[pick], `${tag}: the fold band is ${t.cutBg}, want the base ink ${INK[pick]}`);
            check(t.stampBg === 'rgba(0, 0, 0, 0)', `${tag}: the stamp is filled ${t.stampBg} on the base`);
            check(t.eyebrow && t.eyebrow.deco === 'none', `${tag}: the base eyebrow is decorated: ${JSON.stringify(t.eyebrow)}`);
          }

          // ── Map chrome: the header's rule and the selected category chip
          await go(page, 'tab=map', '[data-map-header]');
          await page.addScriptTag({ content: HELPERS });
          const m = await page.evaluate(() => {
            const A = window.__ap, hdr = document.querySelector('[data-map-header]');
            const sel = document.querySelector('[data-map-cat][aria-checked="true"] > span');
            return { shadow: getComputedStyle(hdr).boxShadow, selBg: sel && getComputedStyle(sel).backgroundColor, selAA: sel ? A.ratio(getComputedStyle(sel).color, A.bg(sel)) : null, title: hdr.querySelector('h1')?.textContent };
          });
          check(m.title === 'Map', `${tag}: the map header's title is ${m.title}`);
          check(m.selAA >= 4.5, `${tag}: the selected map chip reads ${m.selAA?.toFixed(2)}:1 (want ≥4.5)`);
          if (pops) {
            check(m.shadow.includes(t.ledger.accRgb), `${tag}: the map header carries no accent rule (box-shadow ${m.shadow})`);
            check(m.selBg === t.ledger.accRgb, `${tag}: the selected map chip is ${m.selBg}, want the accent ${t.ledger.accRgb}`);
          } else {
            check(m.shadow === 'none', `${tag}: the base map header has a shadow ${m.shadow}`);
            check(m.selBg === INK[pick], `${tag}: the base selected map chip is ${m.selBg}, want ink ${INK[pick]}`);
          }

          // ── Stage chips: the open lineup header's stage rows (one stage picked), then
          // the folded header's stage pills (the same pick). "Visible" means hit-tested:
          // the element is in the viewport AND is what a tap at its centre reaches.
          await go(page, 'tab=lineup', '[data-lineup-scroll]');
          await page.addScriptTag({ content: HELPERS + `
            window.__ap.hit = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return false;
              const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === e || e.contains(t)); };
            window.__ap.picked = (sel) => { const A = window.__ap; const el = [...document.querySelectorAll(sel)].find(A.hit); if (!el) return null;
              const c = getComputedStyle(el); return { bg: c.backgroundColor, aa: A.ratio(c.color, A.bg(el)), text: el.textContent.trim() }; };` });
          const row = await page.evaluate(() => { const el = [...document.querySelectorAll('[data-overview-stage]')].find(window.__ap.hit); if (!el) return null; el.click(); return el.dataset.overviewStage; });
          check(!!row, `${tag}: the open lineup header shows no stage row a tap can reach`);
          if (row) {
            await page.waitForTimeout(250);
            const s = await page.evaluate(() => window.__ap.picked('[data-overview-stage][aria-pressed="true"] > span:last-child'));
            check(!!s, `${tag}: the picked stage row is not on screen after the tap`);
            if (s) {
              check(s.aa >= 4.5, `${tag}: the picked stage row "${s.text}" reads ${s.aa.toFixed(2)}:1 (want ≥4.5)`);
              if (pops) check(s.bg === t.ledger.accRgb, `${tag}: the picked stage row is ${s.bg}, want the accent ${t.ledger.accRgb}`);
              else check(s.bg === 'rgba(0, 0, 0, 0)', `${tag}: the base picked stage row is filled ${s.bg}`);
            }
            const off = await page.evaluate(() => window.__ap.picked('[data-overview-stage][aria-pressed="false"] > span:last-child'));
            check(!off || off.bg === 'rgba(0, 0, 0, 0)', `${tag}: an unpicked stage row is filled ${off && off.bg}`);
            // Clear the pick (a second tap), fold the header over the full list (the fold
            // answers real input only, and only while the list can still scroll), then pick
            // a stage from the folded header's pills.
            await page.evaluate((id) => document.querySelector(`[data-overview-stage="${id}"]`).click(), row);
            // The tap holds the header open for 400ms on the app's clock, which is pinned here.
            await page.clock.runFor(1000); await page.waitForTimeout(250);
            // A thumb, as scripts/test-lineup-readability.mjs drives it: small wheel steps
            // at the list's centre with the clock moving between them; CSS transitions run on real time.
            const box = await page.locator('[data-lineup-scroll]').first().boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 300));
            for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 100); await page.clock.runFor(40); }
            await page.clock.runFor(400); await page.waitForTimeout(600);
            const pill = await page.evaluate(() => { const first = document.querySelector('[data-lineup-compact] [data-mini-stage]'); if (!first) return null;
              // The strip leads with the view chips and scrolls sideways inside itself: bring the first stage in.
              const strip = first.closest('[data-lineup-mini]'); strip.scrollLeft += first.getBoundingClientRect().left - strip.getBoundingClientRect().left - 20;
              const el = [...document.querySelectorAll('[data-lineup-compact] [data-mini-stage]')].find(window.__ap.hit); if (!el) return null; el.click(); return el.dataset.miniStage; });
            check(!!pill, `${tag}: the folded header shows no stage pill a tap can reach`);
            await page.waitForTimeout(300);
            // The tap was hit-tested above. A pick that narrows the list below a fold's worth
            // unfolds the header (the open header's row then shows the pick), so the pill is
            // measured by its computed style, shown or not.
            const p = await page.evaluate(() => { const A = window.__ap, el = document.querySelector('[data-lineup-compact] [data-mini-stage][aria-pressed="true"] > span'); if (!el) return null;
              const c = getComputedStyle(el); return { bg: c.backgroundColor, aa: A.ratio(c.color, A.bg(el)), text: el.textContent.trim() }; });
            check(!!p, `${tag}: the folded header shows no picked stage pill`);
            if (p) {
              check(p.aa >= 4.5, `${tag}: the picked stage pill "${p.text}" reads ${p.aa.toFixed(2)}:1 (want ≥4.5)`);
              if (pops) check(p.bg === t.ledger.accRgb, `${tag}: the picked stage pill is ${p.bg}, want the accent ${t.ledger.accRgb}`);
              else check(p.bg === INK[pick], `${tag}: the base picked stage pill is ${p.bg}, want ink ${INK[pick]}`);
            }
          }

          // ── Artist page, with and without a ledger portrait (390 only): its section headers
          if (width === 390) {
            const ids = await page.evaluate(() => {
              const withP = ARTISTS.find(a => a.stage && getPermanentArtistImage(a.name));
              const without = ARTISTS.find(a => a.stage && !getPermanentArtistImage(a.name) && !/\s(b2b|x|&)\s/i.test(a.name));
              return { withP: withP?.id || null, without: without?.id || null };
            });
            for (const [label, id] of [['portrait', ids.withP], ['no portrait', ids.without]]) {
              if (!id) { check(!pops, `${tag}: no ${label} act on the lineup to open`); continue; }
              await go(page, `tab=lineup&artist=${encodeURIComponent(id)}`, '.duo-sect');
              await page.addScriptTag({ content: HELPERS });
              const a = await page.evaluate(() => {
                const A = window.__ap;
                return [...document.querySelectorAll('.duo-sect')].filter(e => e.getClientRects().length).map(e => { const c = getComputedStyle(e); return { t: e.textContent.trim().slice(0, 30), deco: c.textDecorationLine, decoC: c.textDecorationColor, aa: A.ratio(c.color, A.bg(e)) }; });
              });
              check(a.length > 0, `${tag} artist (${label}): no section header`);
              check(a.every(x => x.aa >= 4.5), `${tag} artist (${label}): a section header fails AA: ${JSON.stringify(a)}`);
              if (pops) check(a.every(x => /underline/.test(x.deco) && x.decoC === t.ledger.accRgb), `${tag} artist (${label}): headers not ruled in the accent: ${JSON.stringify(a)}`);
              else check(a.every(x => x.deco === 'none'), `${tag} artist (${label}): base headers decorated: ${JSON.stringify(a)}`);
            }
          }
          check(errors.length === 0, `${tag}: page errors ${JSON.stringify(errors)}`);
        } finally { await ctx.close(); }
      }
    }
  }
} catch (e) {
  problems.push(`harness: ${e && e.stack || e}`);
} finally {
  if (browser) await browser.close();
  server.kill();
}

if (problems.length) {
  console.error(`  ✗ III Points accent pops: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.error(`    ✗ ${p}`);
  process.exit(1);
}
console.log(`  ✓ III Points accent pops: ${checks} checks — ledger-gated hero fill, stamp, section rule, map chrome, stage chip; AA on every accent fill in both modes at 390 and 320; EDC Las Vegas (accent, no opt-in) renders the base`);
