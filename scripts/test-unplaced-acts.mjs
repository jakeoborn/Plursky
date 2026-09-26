#!/usr/bin/env node
// Billed acts that no official schedule has placed, in the running app.
//
// An act can be on a festival's official lineup with NO day: Escape's
// lineup-card acts (no day list names them) and CRSSD's late adds (on the
// lineup page, on neither day graphic). Their data says so with `day: null`
// and `unscheduled: true`. This gate proves the screens that meet them say so
// too, instead of crashing or borrowing a day:
//   1. every such act's artist screen mounts (it used to throw on
//      DAYS.find(...).label and bounce the user to the landing screen),
//      says DAY + SET TIME NOT PUBLISHED, and offers no SCHEDULE link;
//   2. control: a timed act still prints its day and times and the link;
//   0. an act the later lineup page dropped after the day graphic timed it
//      (CRSSD's Skepta Más Tiempo) stays out of the lineup, and its record
//      keeps the full grid row so a re-bill is a one-step re-add;
//   3. the onboarding schedule sample, with CRSSD active, shows only
//      acts that have a day (it put the two day-null acts first, as "—  · Ocean View").
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { serverReady } from './lib/server-ready.mjs';
import { loadRegistry } from './lib/load-registry.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const reservePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const a = s.address(); const p = typeof a === 'object' && a ? a.port : 0; s.close(e => e ? reject(e) : resolve(p)); });
});

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

// Every day-null act on a live festival, straight from the registry.
const { REG, DS } = loadRegistry(process.cwd());
const unplaced = REG.filter(e => e.available).flatMap(e =>
  ((DS[e.config.id] || {}).artists || []).filter(a => a.day == null).map(a => ({ fest: e.config.id, a })));
// Positive control: the corpus this gate exists for. If it finds none, the
// loader or the data changed shape, and a pass would prove nothing.
check(unplaced.some(u => u.fest === 'crssd-fall-2026'), `control: no day-null act found on crssd-fall-2026 (found ${unplaced.length} on ${[...new Set(unplaced.map(u => u.fest))].join(', ') || 'none'})`);
const timed = (DS['crssd-fall-2026']?.artists || []).find(a => a.id === 'crssd-horsegiirl');
check(timed && timed.day === 1 && timed.start === '20:30', `control: crssd-horsegiirl is not the Saturday 20:30 set (${JSON.stringify(timed && { day: timed.day, start: timed.start })})`);

// 0. Removed-after-graphic records, read off the modules themselves.
{
  const ctx = { window: {} }; vm.createContext(ctx);
  for (const f of readdirSync('data/festivals').filter(f => f.endsWith('.js')).sort())
    vm.runInContext(readFileSync(`data/festivals/${f}`, 'utf8'), ctx);
  const mods = ctx.window.PLURSKY_FESTIVALS || {};
  const removed = Object.entries(mods).flatMap(([fid, m]) => (m.removedAfterGraphic || []).map(r => ({ fid, r, m })));
  check(removed.some(({ fid, r }) => fid === 'crssd-fall-2026' && r.id === 'crssd-skepta-mas-tiempo'),
    'control: crssd-fall-2026 has no removed-after-graphic record for crssd-skepta-mas-tiempo');
  for (const { fid, r, m } of removed) {
    const inLineup = m.artists.some(a => a.id === r.id || a.name.toLowerCase() === String(r.name).toLowerCase());
    check(!inLineup, `${fid} ${r.id}: removed after the graphic, but still in the lineup`);
    const inLoaded = ((DS[fid] || {}).artists || []).some(a => a.id === r.id);
    check(!inLoaded, `${fid} ${r.id}: removed after the graphic, but _DATA_SETS still carries it`);
    check(m.stages.some(s => s.id === r.stage) && Number.isInteger(r.day) && /^\d\d:\d\d$/.test(r.start || '') && /^\d\d:\d\d$/.test(r.end || ''),
      `${fid} ${r.id}: record lacks a full grid row (stage/day/start/end) to re-add from`);
    check(/^https:\/\//.test(r.graphic?.url || '') && /^https:\/\//.test(r.removedFrom?.url || '') && r.graphic?.lastModified < r.removedFrom?.lastModified,
      `${fid} ${r.id}: record must cite the graphic and the LATER page that dropped it`);
  }
}

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;

async function open(browser, url, { onboarded = true } = {}) {
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles', viewport: { width: 393, height: 852 } });
  await ctx.addInitScript((ob) => {
    if (localStorage.getItem('__seeded') === '1') return;
    localStorage.setItem('__seeded', '1');
    if (ob) localStorage.setItem('onboarded', 'v1'); else localStorage.removeItem('onboarded');
  }, onboarded);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
  await sleep(1500);
  return { ctx, page, errors };
}

try {
  check(await serverReady(BASE), `server never answered ${BASE}`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    // 1. Every unplaced act's artist screen.
    for (const { fest, a } of unplaced) {
      const { ctx, page, errors } = await open(browser, `${BASE}?f=${fest}&artist=${encodeURIComponent(a.id)}`);
      const body = await page.evaluate(() => document.body.innerText);
      check(!errors.length, `${fest} ${a.id}: artist screen threw: ${errors[0]}`);
      check(body.includes(a.name), `${fest} ${a.id}: artist screen did not mount (no "${a.name}" on screen)`);
      check(body.includes('DAY + SET TIME NOT PUBLISHED'), `${fest} ${a.id}: does not say DAY + SET TIME NOT PUBLISHED`);
      check(!/\bSCHEDULE\b/.test(body), `${fest} ${a.id}: offers a SCHEDULE link to a day it does not have`);
      await ctx.close();
    }

    // 2. Control: a timed act keeps its day, times and link.
    {
      const { ctx, page, errors } = await open(browser, `${BASE}?f=crssd-fall-2026&artist=crssd-horsegiirl`);
      const body = await page.evaluate(() => document.body.innerText);
      check(!errors.length, `control horsegiirl: artist screen threw: ${errors[0]}`);
      check(body.includes('SAT · 8:30 PM–9:45 PM'), 'control horsegiirl: "SAT · 8:30 PM–9:45 PM" missing');
      check(/\bSCHEDULE\b/.test(body), 'control horsegiirl: SCHEDULE link missing');
      check(!body.includes('NOT PUBLISHED'), 'control horsegiirl: a timed act says NOT PUBLISHED');
      await ctx.close();
    }

    // 3. Onboarding sample with CRSSD active: every row has a day.
    {
      const { ctx, page, errors } = await open(browser, `${BASE}?f=crssd-fall-2026`, { onboarded: false });
      await page.getByRole('dialog', { name: 'Welcome to Plursky' }).getByText('Your night.').waitFor({ timeout: 15000 });
      const rows = await page.evaluate(() => {
        const scope = document.querySelector('[role=dialog]') || document.body;
        return [...scope.querySelectorAll('div')].filter(d => /^(Saturday|Sunday)? ?·? ?(Ocean View|City Steps|The Palms)$/.test(d.textContent.trim()) && d.children.length === 0).map(d => d.textContent.trim());
      });
      check(!errors.length, `onboarding: threw: ${errors[0]}`);
      check(rows.length === 3, `onboarding: expected 3 sample rows, found ${rows.length}: ${JSON.stringify(rows)}`);
      check(rows.every(r => /^(Saturday|Sunday) · /.test(r)), `onboarding: a sample row has no day: ${JSON.stringify(rows)}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
} finally { server.kill(); }

if (failed) { console.log(`✗ unplaced acts: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ unplaced acts: ${checks} checks · ${unplaced.length} day-null acts on ${[...new Set(unplaced.map(u => u.fest))].length} live festivals, each artist screen mounts and says so; timed control; onboarding sample`);
