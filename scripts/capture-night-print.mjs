// Night Print pixels: Today in each lifecycle state, at 390 and 320, Dark
// and Light, on labelled fixtures. Usage:
//   node scripts/capture-night-print.mjs <outDir> [stateKey ...]
// Runs against the CURRENT tree (run build.mjs first), or against another
// checkout with NP_ROOT=<dir> (its Today may predate the print: NP_BEFORE=1
// then waits on the root instead of the print). The clock is pinned
// per state; the festival and the saved sets are seeded in localStorage.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { serverReady } from './lib/server-ready.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fontEvidence, faceEvidence, heroEvidence, ledgerActs } from './lib/print-evidence.mjs';
import { join } from 'node:path';

const out = process.argv[2]; const ONLY = process.argv.slice(3);
if (!out) { console.error('usage: capture-night-print.mjs <outDir> [state...]'); process.exit(2); }
mkdirSync(out, { recursive: true });
// Every shot is matched to the exact commit of the tree it was built from, with the rendered fonts and
// the faces' sources beside it (evidence.json): the review reads the production target, not the source page.
const HEAD = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const DIRTY = execSync('git status --porcelain -- . ":!dist"', { encoding: 'utf8' }).trim() !== '';
const evidence = [];
export const STATES = [
  // key, festival, clock, saved ids, extra localStorage, note
  ['pre-empty',  'edc-lv-2026', '2026-05-01T18:00:00Z', [], {}, 'EDC LV, 14 days out, nothing saved'],
  ['pre-saved',  'edc-lv-2026', '2026-05-01T18:00:00Z', ['k15', 'k16', 'q17', 'bp8', 'n4', 'k1'], {}, 'EDC LV, 14 days out, six saved'],
  ['day-empty',  'edc-lv-2026', '2026-05-17T07:50:00Z', [], {}, 'EDC LV night 2, 00:50 PDT, nothing saved'],
  ['day-saved',  'edc-lv-2026', '2026-05-17T07:50:00Z', ['k15', 'k16', 'q17', 'bp8'], {}, 'EDC LV night 2, John Summit live, a clash next'],
  ['post',       'edc-lv-2026', '2026-06-01T18:00:00Z', ['k15', 'k16', 'q17', 'bp8'], { plursky_attended_v1: JSON.stringify({ 1: ['k15'] }) }, 'EDC LV, two weeks after'],
  ['iii-pre',    'iii-points-2026', '2026-10-09T18:00:00Z', [], {}, 'III Points, a week out: the Roman word'],
  ['decadence',  'decadence-colorado-2026', '2026-10-09T18:00:00Z', [], {}, 'Decadence Colorado: two long words, set times pending'],
  ['nocturnal',  'nocturnal-wonderland-2026', '2026-08-01T18:00:00Z', [], {}, 'Nocturnal Wonderland: the longest word'],
  ['neutral',    'summerfest-2026', '2026-06-01T18:00:00Z', [], {}, 'Summerfest: no verified accent, neutral print'],
  ['acl-w2',     'acl-2026', '2026-10-12T01:30:00Z', [], {}, 'ACL Weekend 2, last night (Sun Oct 11, 8:30pm CDT): the stamp dated for Weekend 2, ACL\'s own Basics'],
].filter(([k]) => !ONLY.length || ONLY.includes(k));
const HEROES = !ONLY.length || ONLY.includes('heroes');
const heroes = [];

const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.env.NP_ROOT || process.cwd(), stdio: 'ignore' });
let browser; const failed = [];
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const [key, fid, at, saved, extra, note] of STATES) {
    for (const pick of ['dark', 'light']) for (const width of [390, 320]) {
      const shoot = async () => {
        let ctx;
        try {
        ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: pick, deviceScaleFactor: 2 });
        await ctx.clock.install({ time: new Date(at) });
        // Outside hosts stay reachable: React and Babel come from a CDN.
        const forecast = { fetchedAt: Date.parse(at), data: [{ name: 'Tonight', startTime: new Date(Date.parse(at)).toISOString(), endTime: new Date(Date.parse(at) + 12 * 3600000).toISOString(), temperature: 71, temperatureUnit: 'F', windSpeed: '10 mph', windDirection: 'SW', shortForecast: 'Clear', detailedForecast: 'Clear' }] };
        const hourly = { fetchedAt: Date.parse(at), data: Array.from({ length: 12 }, (_, i) => ({ startTime: new Date(Date.parse(at) + i * 3600000).toISOString(), temperature: 70 + i, temperatureUnit: 'F', shortForecast: 'Clear', windSpeed: '5 mph', probabilityOfPrecipitation: 0 })) };
        await ctx.addInitScript(({ fid, pick, saved, extra, forecast, hourly }) => {
          if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
          // The forecast from the app's own cache, so Sun & weather prints values offline.
          localStorage.setItem(`forecast_${fid}`, JSON.stringify(forecast)); localStorage.setItem(`forecast_hourly_${fid}`, JSON.stringify(hourly));
          localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', fid); localStorage.setItem('active_festival_explicit', '1');
          localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('setup_banner_dismissed', '1'); localStorage.setItem('notif_nudge_dismissed', '1');
          localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(saved));
          localStorage.setItem('ping_code', 'ECHO'); localStorage.setItem('plursky_pid', 'night-print');
          localStorage.setItem('plursky.appearance', pick);
          for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
          if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity, addEventListener() {}, removeEventListener() {} });
        }, { fid, pick, saved, extra, forecast, hourly });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.goto(`http://127.0.0.1:${PORT}/index.html?tab=home`, { waitUntil: 'load' });
        await page.waitForSelector(process.env.NP_BEFORE ? '#root > *' : '[data-night-print]', { timeout: 20000 });
        await page.waitForTimeout(1500);
        const got = await page.evaluate(() => window.FESTIVAL_CONFIG?.id);
        if (got !== fid) throw new Error(`fixture ${key} asked for ${fid} but ${got} mounted`);
        const file = join(out, `${key}-${pick}-${width}.png`);
        // The scroller is the page: capture it tall so the whole sheet shows.
        const h = await page.evaluate(() => { const el = document.querySelector('[data-night-print]') || [...document.querySelectorAll('#root *')].find(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight); return el ? el.scrollHeight : document.body.scrollHeight; });
        // The frame is the sheet plus the bar, exactly: slack under the sheet would read as a tail.
        const bar = await page.evaluate(() => Math.round(document.querySelector('button[aria-current="page"]')?.parentElement?.getBoundingClientRect().height || 0));
        await page.setViewportSize({ width, height: Math.min(Math.max(852, h + bar), 6000) });
        await page.waitForTimeout(400);
        const h2 = await page.evaluate(() => { const el = document.querySelector('[data-night-print]'); return el ? el.scrollHeight : 0; });
        if (h2 && h2 !== h) { await page.setViewportSize({ width, height: Math.min(Math.max(852, h2 + bar), 6000) }); await page.waitForTimeout(300); }
        await page.screenshot({ path: file, fullPage: false });
        { const fonts = await fontEvidence(page); const faces = await faceEvidence(page);
          evidence.push({ shot: `${key}-${pick}-${width}.png`, festival: fid, clock: at, mode: pick, width, fonts, ...faces }); }
        console.log(`${key} ${pick} ${width}: ${file} (${h}px)${errors.length ? ' PAGE ERRORS: ' + errors.join(' | ') : ''}  — ${note}`);
        // On the night, the board unfolded too (every stage, every pair, every portrait the ledger holds).
        if (await page.$('[data-duo-stages-toggle][aria-expanded="false"]')) {
          await page.click('[data-duo-stages-toggle]'); await page.waitForTimeout(500);
          const h3 = await page.evaluate(() => { const el = document.querySelector('[data-night-print]'); return el ? el.scrollHeight : 0; });
          await page.setViewportSize({ width, height: Math.min(Math.max(852, h3 + bar), 6000) }); await page.waitForTimeout(400);
          const af = join(out, `${key}-allstages-${pick}-${width}.png`);
          await page.screenshot({ path: af, fullPage: false });
          { const fonts = await fontEvidence(page); const faces = await faceEvidence(page);
            evidence.push({ shot: `${key}-allstages-${pick}-${width}.png`, festival: fid, clock: at, mode: pick, width, fonts, ...faces }); }
          console.log(`${key} allstages ${pick} ${width}: ${af} (${h3}px)`);
          await page.click('[data-duo-stages-toggle]'); await page.waitForTimeout(300);
        }
        // The sheets, on the first fixture only: Basics, Alerts, Sun & weather, each settled
        // at the device height so the tab bar relation shows (NP_SHEETS=0 skips them).
        if (key === 'pre-empty' && process.env.NP_SHEETS !== '0' && !process.env.NP_BEFORE) {
          await page.setViewportSize({ width, height: 852 }); await page.waitForTimeout(300);
          for (const [sheet, sel] of [['basics', '[data-np-link=basics]'], ['alerts', '[data-np-link=alerts]'], ['tonight', '[data-np-link=tonight]']]) {
            await page.click(sel); await page.waitForTimeout(900);
            const sf = join(out, `${key}-${sheet}-${pick}-${width}.png`);
            await page.screenshot({ path: sf, fullPage: false });
            console.log(`${key} ${sheet} ${pick} ${width}: ${sf}`);
            await page.keyboard.press('Escape'); await page.waitForTimeout(400);
          }
        }
        } finally { await ctx?.close(); }
      };
      let ok = false;
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        try { await shoot(); ok = true; }
        catch (e) { console.log(`${key} ${pick} ${width}: attempt ${attempt} failed: ${String(e.message || e).split('\n')[0]}`); }
      }
      if (!ok) failed.push(`${key} ${pick} ${width}`);
    }
  }
  if (failed.length) { console.error(`✗ ${failed.length} capture(s) failed twice: ${failed.join(', ')}`); process.exitCode = 1; }
  if (HEROES) {
    const cmp = await browser.newPage();
    const seed = async (ctx, fid, pick) => ctx.addInitScript(({ fid, pick }) => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', fid); localStorage.setItem('active_festival_explicit', '1');
      localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('setup_banner_dismissed', '1'); localStorage.setItem('notif_nudge_dismissed', '1');
      localStorage.setItem('ping_code', 'ECHO'); localStorage.setItem('plursky_pid', 'night-print'); localStorage.setItem('plursky.appearance', pick);
      if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity, addEventListener() {}, removeEventListener() {} });
    }, { fid, pick });
    const probeCtx = await browser.newContext({ viewport: { width: 390, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await probeCtx.clock.install({ time: new Date('2026-05-01T18:00:00Z') }); await seed(probeCtx, 'edc-lv-2026', 'dark');
    const probe = await probeCtx.newPage(); await probe.goto(`http://127.0.0.1:${PORT}/index.html?tab=home`, { waitUntil: 'load' });
    await probe.waitForSelector('[data-night-print]', { timeout: 20000 });
    const acts = await ledgerActs(probe); await probeCtx.close();
    for (const a of acts) for (const pick of ['dark', 'light']) for (const width of [390, 320]) {
      let ctx;
      try {
        ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: pick, deviceScaleFactor: 2 });
        await ctx.clock.install({ time: new Date('2026-05-01T18:00:00Z') }); await seed(ctx, a.fid, pick);
        const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
        await page.goto(`http://127.0.0.1:${PORT}/index.html?tab=lineup&artist=${encodeURIComponent(a.id)}`, { waitUntil: 'load' });
        await page.waitForSelector('[data-artist-hero]', { timeout: 20000 });
        await page.waitForFunction(() => document.querySelector('[data-artist-hero]')?.dataset.artistHero === 'photo', null, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(800);
        const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const file = join(out, `hero-${slug}-${a.fid}-${pick}-${width}.png`);
        const ev = await heroEvidence(page, cmp);
        await page.screenshot({ path: file, fullPage: false });
        heroes.push({ shot: `hero-${slug}-${a.fid}-${pick}-${width}.png`, act: a.name, id: a.id, festival: a.fid, mode: pick, width, hero: ev ? ev.kind : 'none', asset: a.asset, labels: ev ? ev.labels : [], errors });
        const low = (ev ? ev.labels : []).filter(l => l.ratio < l.floor);
        console.log(`hero ${a.name} ${a.fid} ${pick} ${width}: ${file} (${ev ? ev.kind : 'no hero'}; ${ev ? ev.labels.map(l => `${l.label} ${l.ratio}`).join(', ') : ''})${low.length ? ' BELOW AA: ' + low.map(l => l.label).join(',') : ''}${errors.length ? ' PAGE ERRORS: ' + errors.join(' | ') : ''}`);
      } catch (err) { failed.push(`hero ${a.name} ${pick} ${width}: ${String(err.message || err).split('\n')[0]}`); console.log(`hero ${a.name} ${pick} ${width}: FAILED ${String(err.message || err).split('\n')[0]}`); }
      await ctx?.close();
    }
    await cmp.close();
  }
  // The summary is built after the hero shots so evidence.json carries their rows (round 8 wrote heroes: 0).
  const summary = {
    head: HEAD, dirty: DIRTY, root: process.env.NP_ROOT || '.', capturedAt: new Date().toISOString(),
    fonts: { anton: evidence.every(e => e.fonts.loaded.anton), spaceGrotesk: evidence.every(e => e.fonts.loaded.grotesk),
      samples: evidence.reduce((n, e) => n + e.fonts.samples.filter(s => !s.absent).length, 0),
      wrong: evidence.flatMap(e => e.fonts.samples.filter(s => !s.absent && !s.ok).map(s => `${e.shot} ${s.sel.split(',')[0]} → ${s.rendered}`)) },
    portraits: [...new Map(evidence.flatMap(e => e.faces.filter(f => f.loaded).map(f => [f.name, f.ledger])))].map(([name, l]) => ({ name, ...l })),
    initials: [...new Set(evidence.flatMap(e => e.faces.filter(f => !f.loaded).map(f => f.name)))],
    pairs: [...new Set(evidence.flatMap(e => e.pairs.map(p => p.name)))],
    // The artist heroes over the ledger portraits: every label's contrast against the pixels behind it,
    // and the lowest ratio seen per label across every shot.
    heroes: { shots: heroes.length, acts: [...new Set(heroes.map(h => h.act))], photo: heroes.filter(h => h.hero === 'photo').length,
      labels: heroes.reduce((n, h) => n + h.labels.length, 0), belowAA: heroes.flatMap(h => h.labels.filter(l => l.ratio < l.floor).map(l => `${h.shot} ${l.label} ${l.ratio}:1`)),
      minByLabel: Object.fromEntries(['back', 'day', 'genre', 'stage', 'name'].map(k => [k, Math.min(...heroes.flatMap(h => h.labels.filter(l => l.label === k).map(l => l.ratio)), Infinity)])),
      rows: heroes },
    shots: evidence,
  };
  writeFileSync(join(out, 'evidence.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`evidence.json: head ${HEAD.slice(0, 7)}${DIRTY ? ' (dirty tree)' : ''}, root ${summary.root}; Anton ${summary.fonts.anton}, Space Grotesk ${summary.fonts.spaceGrotesk}, ${summary.fonts.samples} samples, ${summary.fonts.wrong.length} wrong; portraits ${summary.portraits.map(p => p.name).join(', ') || 'none'}; initials ${summary.initials.join(', ') || 'none'}; heroes ${summary.heroes.shots} shots, ${summary.heroes.labels} labels, ${summary.heroes.belowAA.length} below AA, min ${JSON.stringify(summary.heroes.minByLabel)}`);
} finally { await browser?.close(); server.kill(); }
