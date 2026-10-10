#!/usr/bin/env node
// Me and Today (before the festival), as the board draws them, in the running app.
// ── Me ──
//   · identity: a name, or for an empty account the one action "Add your
//     name" (never a dash standing in for one)
//   · Plan / Memories / Crew / Badges are four round actions on ONE row; a
//     count shows only when there is one (an empty account is not a wall of
//     zeros), and a real count is shown
//   · the Plursky+ entry is fully on screen at scrollTop 0 (App Review 2.1(b):
//     the one paywall entry a fresh install can always reach), unchanged
//   · festival rows keep their title on one line at 320 (side by side with
//     its description, it broke one word per line)
//   · no horizontal overflow
// ── Today, before the festival ──
//   · saved sets are list rows (time, face, full name, day · stage), never a
//     sideways rail of tiles; essentials are a wrapping grid, two columns
//     down to 320; nothing on Today scrolls sideways
// Both modes, 393 and 320, an empty account and a populated one. No network.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const FID = 'edc-lv-2026', AT = '2026-05-17T07:50:00Z';
// SL_FONT=Verdana runs every screen in a wider face, as CI's runner lays text
// out wider than this Mac (names and rows sit on the fit borderline there).
const WIDE = process.env.SL_FONT || null;

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) for (const populated of [false, true]) {
    const tag = `${scheme} ${width} ${populated ? 'populated' : 'empty'}`;
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    if (WIDE) await ctx.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `*{font-family:${f} !important}`; document.head.appendChild(st); }); }, WIDE);
    try {
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
      await ctx.clock.install({ time: new Date(AT) });
      await ctx.addInitScript(({ FID, scheme, populated }) => {
        if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
        localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
        localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
        if (populated) { localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(['k15', 'k16', 'q17', 'bp8'])); localStorage.setItem('plursky_display_name', 'Test Raver'); }
      }, { FID, scheme, populated });
      await ctx.addInitScript(() => { if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity, addEventListener() {}, removeEventListener() {} }); });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=me`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-me-actions]') && document.querySelector('[data-appearance-row]'), null, { timeout: 60000 });
      await page.clock.runFor(2500); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const vis = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
        const actions = [...document.querySelectorAll('[data-me-action]')].map(b => ({ key: b.dataset.meAction, top: Math.round(b.getBoundingClientRect().top), text: b.innerText.replace(/\s+/g, ' ').trim() }));
        const plus = [...document.querySelectorAll('button')].find(b => /^Plursky Plus/.test(b.getAttribute('aria-label') || '') || /Plursky\+/.test(b.innerText));
        const tab = document.querySelector('nav, [role=tablist]');
        const save = [...document.querySelectorAll('button')].find(b => /Save this festival|^Saved/.test(b.innerText));
        const saveTitle = save ? [...save.querySelectorAll('span')].find(s => /^(Save this festival|Saved)$/.test(s.textContent.trim())) : null;
        const lh = saveTitle ? parseFloat(getComputedStyle(saveTitle).lineHeight) || 20 : 0;
        return {
          dash: [...document.querySelectorAll('.duo-name')].some(n => vis(n) && n.textContent.trim() === '—'),
          addName: !!document.querySelector('[data-me-add-name]'),
          actions,
          plusBottom: plus ? plus.getBoundingClientRect().bottom : null,
          limit: innerHeight - (tab ? tab.getBoundingClientRect().height : 0),
          saveTitleLines: saveTitle ? Math.round(saveTitle.getBoundingClientRect().height / lh) : null,
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
          saved: (window.savedInLineup ? window.savedInLineup(JSON.parse(localStorage.getItem('edc-lv-2026_saved_v1') || '[]')) : []).length,
        };
      });
      check(!r.dash, `${tag}: a dash stands in for the name`);
      check(r.addName === !populated, `${tag}: "Add your name" ${r.addName ? 'shown' : 'missing'} for ${populated ? 'a named' : 'an unnamed'} account`);
      check(r.actions.length === 4 && new Set(r.actions.map(a => a.top)).size === 1, `${tag}: actions are not four on one row: ${JSON.stringify(r.actions)}`);
      check(r.actions.every(a => !/(^|\s)0$/.test(a.text)), `${tag}: an action shows a zero count: ${JSON.stringify(r.actions.map(a => a.text))}`);
      if (populated) check(r.actions.find(a => a.key === 'saved')?.text === `Plan ${r.saved}` && r.saved > 0, `${tag}: Plan does not show the plan's ${r.saved} sets: ${JSON.stringify(r.actions)}`);
      check(r.plusBottom != null && r.plusBottom <= r.limit, `${tag}: the Plursky+ entry is not fully on screen at the top (bottom ${r.plusBottom}, limit ${r.limit})`);
      check(r.saveTitleLines === 1, `${tag}: "Save this festival" runs over ${r.saveTitleLines} lines`);
      check(!r.overflowX, `${tag}: Me scrolls sideways`);
    } catch (err) { check(false, `${tag} threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
  // ── Today, before the festival ──
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) {
    const tag = `today upcoming ${scheme} ${width}`;
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    if (WIDE) await ctx.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `*{font-family:${f} !important}`; document.head.appendChild(st); }); }, WIDE);
    try {
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
      await ctx.clock.install({ time: new Date('2026-05-10T18:00:00Z') });
      await ctx.addInitScript(({ FID, scheme }) => {
        if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
        localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
        localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
        localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(['k15', 'k16', 'q17', 'bp8', 'k9', 'n4', 'k1']));
      }, { FID, scheme });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-today-essentials]') && document.querySelector('[data-today-saved]'), null, { timeout: 60000 });
      await page.clock.runFor(2500); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const ess = document.querySelector('[data-today-essentials]'), sv = document.querySelector('[data-today-saved]');
        const pans = [...document.querySelectorAll('#root *')].filter(el => { const cs = getComputedStyle(el); return /auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.getBoundingClientRect().height > 40; }).map(el => el.className || el.tagName);
        const rows = [...sv.querySelectorAll('button[aria-label]')].filter(b => b.querySelector('.duo-name'));
        return {
          cols: new Set([...ess.children].map(c => Math.round(c.getBoundingClientRect().left))).size,
          essOver: ess.scrollWidth > ess.clientWidth + 1,
          pans, rows: rows.length,
          cut: rows.filter(b => { const n = b.querySelector('.duo-name'); return n.scrollWidth > n.clientWidth + 1; }).map(b => b.getAttribute('aria-label')),
          more: [...sv.querySelectorAll('button')].some(b => /^All \d+ saved sets/i.test(b.textContent.trim())),
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      check(r.cols >= 2 && !r.essOver, `${tag}: essentials are ${r.cols} column(s)${r.essOver ? ', and overflow' : ''}`);
      check(!r.pans.length, `${tag}: something on Today scrolls sideways: ${JSON.stringify(r.pans).slice(0, 160)}`);
      check(r.rows === 4 && r.more, `${tag}: saved sets show ${r.rows} rows${r.more ? '' : ' and no "All N saved sets"'} (want 4 of 7 and the link; six or fewer print whole)`);
      check(!r.cut.length, `${tag}: a saved set's name is cut: ${JSON.stringify(r.cut)}`);
      check(!r.overflowX, `${tag}: Today scrolls sideways`);
    } catch (err) { check(false, `${tag} threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
  // ── Artist: schedule and stage first, detail after ──
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) {
    const tag = `artist ${scheme} ${width}`;
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    if (WIDE) await ctx.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `*{font-family:${f} !important}`; document.head.appendChild(st); }); }, WIDE);
    try {
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
      await ctx.clock.install({ time: new Date(AT) });
      await ctx.addInitScript(({ FID, scheme }) => {
        if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
        localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
        localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
      }, { FID, scheme });
      const page = await ctx.newPage();
      // k15 = John Summit, Kinetic Field night 2: a set with one before and one after.
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup&artist=k15`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-artist-set-card]') && document.getElementById('artist-section-bio'), null, { timeout: 60000 });
      await page.clock.runFor(2500); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const a = window.ARTISTS.find(x => x.id === 'k15');
        const tm = t => { const [h, m] = t.split(':').map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
        const night = window.ARTISTS.filter(x => x.stage === a.stage && x.day === a.day && x.start).sort((x, y) => tm(x.start) - tm(y.start));
        const i = night.findIndex(x => x.id === a.id);
        const want = [night[i - 1], a, night[i + 1]].filter(Boolean).map(x => (window.actDisplayName ? window.actDisplayName(x.name) : x.name));
        const sn = document.querySelector('[data-artist-stage-night]');
        const got = sn ? [...sn.querySelectorAll('.duo-name')].map(n => n.textContent.trim()) : [];
        const top = el => el ? el.getBoundingClientRect().top : null;
        return { want, got, card: top(document.querySelector('[data-artist-set-card]')), bio: top(document.getElementById('artist-section-bio')), night: top(sn),
          empty: document.querySelector('[data-artist-moments-empty]')?.getBoundingClientRect().height ?? null,
          overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(r.card != null && r.night != null && r.card < r.night && r.night < r.bio, `${tag}: order is not set card → stage night → bio (${r.card}, ${r.night}, ${r.bio})`);
      check(JSON.stringify(r.got) === JSON.stringify(r.want), `${tag}: stage night lists ${JSON.stringify(r.got)}, schedule says ${JSON.stringify(r.want)}`);
      check(r.got.length === 3, `${tag}: stage night shows ${r.got.length} rows (want before, this set, after)`);
      check(r.empty != null && r.empty <= 96, `${tag}: the empty moments state is ${r.empty}px tall (want a quiet line, not a card)`);
      check(!r.overflowX, `${tag}: Artist scrolls sideways`);
      // Lineup rows ellipsise a long stage name (Jake, 2026-10-06: rows stay
      // one line ≤60px); the set card is where it is read in full. Checked on
      // the festival's longest stage name.
      const longest = await page.evaluate(() => {
        const st = [...window.STAGES].filter(s => window.ARTISTS.some(a => a.stage === s.id && a.start)).sort((x, y) => y.name.length - x.name.length)[0];
        return { id: window.ARTISTS.find(a => a.stage === st.id && a.start).id, name: st.name };
      });
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup&artist=${longest.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-artist-set-card] .duo-headline'), null, { timeout: 60000 });
      await page.clock.runFor(1500); await page.waitForTimeout(200);
      const hd = await page.evaluate(() => { const h = document.querySelector('[data-artist-set-card] .duo-headline'); return { t: h.textContent.trim(), clip: h.scrollWidth > h.clientWidth + 1 || getComputedStyle(h).textOverflow === 'ellipsis' }; });
      check(longest.name.length >= 10 && hd.t === longest.name && !hd.clip, `${tag}: the set card does not show "${longest.name}" in full: ${JSON.stringify(hd)}`);
    } catch (err) { check(false, `${tag} threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
  // ── Map chrome: a header on solid ground, nothing floating in its place ──
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) {
    const tag = `map ${scheme} ${width}`;
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    if (WIDE) await ctx.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `*{font-family:${f} !important}`; document.head.appendChild(st); }); }, WIDE);
    try {
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
      await ctx.clock.install({ time: new Date(AT) });
      await ctx.addInitScript(({ FID, scheme }) => {
        if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
        localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
        localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
      }, { FID, scheme });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=map`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-map-header]'), null, { timeout: 60000 });
      await page.clock.runFor(2500); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const h = document.querySelector('[data-map-header]');
        const posture = h.querySelector('[data-map-posture]')?.textContent.trim();
        const hb = h.getBoundingClientRect();
        // Any other element painting the posture label is a duplicate floating chip.
        const dup = [...document.querySelectorAll('.duo-code')].filter(e => e.textContent.trim() === posture && !h.contains(e)).length;
        const lines = el => el ? Math.round(el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).lineHeight) || 18)) : 0;
        return { title: h.querySelector('h1')?.textContent.trim(), posture, dup, headerBottom: hb.bottom,
          denied: document.querySelector('[data-map-gps-denied]'), deniedLines: lines(document.querySelector('[data-map-gps-denied]')),
          bg: getComputedStyle(h).backgroundColor, overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(r.title === 'Map', `${tag}: map header title is "${r.title}"`);
      check(['OFFICIAL MAP', 'LAYOUT ONLY', 'VENUE MAP · STAGES PENDING'].includes(r.posture), `${tag}: posture label "${r.posture}" is not one of the known labels`);
      check(r.dup === 0, `${tag}: the posture label also floats over the map (${r.dup})`);
      check(!/rgba\(0, 0, 0, 0\)|transparent/.test(r.bg), `${tag}: the map header has no solid ground (${r.bg})`);
      check(!r.overflowX, `${tag}: Map scrolls sideways`);
      if (width === 393) check(r.deniedLines <= 1, `${tag}: the location line runs to ${r.deniedLines} lines`);
      // Category chips (Jake, 2026-10-06): Stages / Water / Medical / Crew, one
      // at a time, every label whole, no sideways scroll. Water and Medical
      // show only that amenity type; Crew shows real presence or says none.
      const chips = () => page.evaluate(() => {
        const g = document.querySelector('[data-map-chips]');
        const cs = g ? [...g.querySelectorAll('[data-map-cat]')] : [];
        const types = [...document.querySelectorAll('[data-amenity]')].map(e => e.dataset.amenity);
        return { labels: cs.map(c => c.textContent.trim()), on: cs.filter(c => c.getAttribute('aria-checked') === 'true').map(c => c.dataset.mapCat),
          cut: cs.filter(c => { const sp = c.querySelector('span'); return sp.scrollWidth > sp.clientWidth + 1; }).length,
          rows: new Set(cs.map(c => Math.round(c.getBoundingClientRect().top))).size,
          inHeader: !!g && !!g.closest('[data-map-header]'), types: [...new Set(types)], n: types.length,
          crew: document.querySelector('[data-map-crew-line]')?.textContent.trim() || null };
      });
      let c = await chips();
      check(JSON.stringify(c.labels) === '["Stages","Water","Medical","Crew"]' && c.inHeader, `${tag}: map chips are ${JSON.stringify(c.labels)} (in header: ${c.inHeader})`);
      check(JSON.stringify(c.on) === '["stages"]' && c.n === 0, `${tag}: the map does not open on Stages alone (on ${JSON.stringify(c.on)}, ${c.n} amenity marks)`);
      check(c.cut === 0 && c.rows === 1, `${tag}: chips cut (${c.cut}) or on ${c.rows} rows`);
      for (const [cat, type] of [['water', 'water'], ['med', 'med']]) {
        await page.click(`[data-map-cat=${cat}]`); await page.clock.runFor(300); await page.waitForTimeout(150);
        c = await chips();
        check(c.n > 0 && JSON.stringify(c.types) === JSON.stringify([type]), `${tag}: ${cat} shows ${JSON.stringify(c.types)} (${c.n} marks)`);
      }
      await page.click('[data-map-cat=crew]'); await page.clock.runFor(300); await page.waitForTimeout(150);
      c = await chips();
      check(c.n === 0 && c.crew === 'No one in your crew is sharing a locationShare with crew', `${tag}: Crew with no one sharing reads "${c.crew}" (${c.n} amenity marks)`);
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${tag}: Map scrolls sideways with Crew open`);
    } catch (err) { check(false, `${tag} threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
  // A festival whose map carries no water or medical points gets no chip for
  // them: never a chip with nothing behind it.
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
      await ctx.clock.install({ time: new Date(AT) });
      await ctx.addInitScript(() => { localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', 'hard-summer-2026'); localStorage.setItem('active_festival_explicit', '1'); localStorage.setItem('cloud_nudge_seen', '1'); });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=hard-summer-2026&tab=map`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-map-chips]') && window.FESTIVAL_CONFIG?.id === 'hard-summer-2026', null, { timeout: 60000 });
      const r = await page.evaluate(() => ({ labels: [...document.querySelectorAll('[data-map-cat]')].map(c => c.textContent.trim()), amen: (window.AMENITIES || []).length }));
      check(r.amen === 0, `control: HARD Summer now has ${r.amen} amenity points, pick a festival without them`);
      check(JSON.stringify(r.labels) === '["Stages","Crew"]', `map chips with no amenity data are ${JSON.stringify(r.labels)}`);
    } catch (err) { check(false, `map chips (no amenities) threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
  // ── Festival switcher: cards size to their content, names in full ──
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) {
    const tag = `switcher ${scheme} ${width}`;
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    if (WIDE) await ctx.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `*{font-family:${f} !important}`; document.head.appendChild(st); }); }, WIDE);
    try {
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
      await ctx.clock.install({ time: new Date('2026-05-10T18:00:00Z') });
      await ctx.addInitScript(({ FID, scheme }) => {
        if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
        localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
        localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
        localStorage.setItem('plursky_switcher_view_v1', 'grid');
      }, { FID, scheme });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('#root button').length > 3, null, { timeout: 60000 });
      await page.clock.runFor(2500);
      await page.locator('button[aria-label*="estival"]').first().click();
      await page.clock.runFor(800); await page.waitForTimeout(300);
      const gridBtn = page.locator('[role=dialog] button', { hasText: /^grid$/i }).first();
      if (await gridBtn.count()) { await gridBtn.click(); await page.clock.runFor(400); await page.waitForTimeout(200); }
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.midnight-festival-grid > button')];
        return cards.map(c => {
          const name = c.querySelector(':scope > div:nth-child(2) > div:first-child');
          const cb = c.getBoundingClientRect();
          // The text block stretches to the card, so measure the TEXT: a range
          // over each child's contents is where the content really ends.
          const inner = [...c.querySelectorAll(':scope > div')].reduce((m, d, i) => { if (i === 0) return Math.max(m, d.getBoundingClientRect().bottom); /* the thumb is a fixed box */ const rg = document.createRange(); rg.selectNodeContents(d); const b = rg.getBoundingClientRect(); return Math.max(m, b.height ? b.bottom : d.getBoundingClientRect().bottom); }, cb.top);
          const pb = parseFloat(getComputedStyle(c).paddingBottom) || 0;
          return { name: name?.textContent.trim(), cut: name ? name.scrollHeight > name.clientHeight + 1 : false, slack: Math.round(cb.bottom - inner),
            top: Math.round(cb.top), h: Math.round(cb.height), need: Math.round(inner - cb.top + pb) };
        });
      });
      // A card is never taller than the tallest content in its row: a fixed
      // floor (the old 258px) made every short row taller than anything in it.
      const rows = new Map(); for (const c of r) rows.set(c.top, Math.max(rows.get(c.top) || 0, c.need));
      const floored = r.filter(c => c.h > rows.get(c.top) + 3);
      check(r.length >= 6, `${tag}: control: only ${r.length} switcher cards`);
      check(!r.some(c => c.cut), `${tag}: a festival name is cut: ${JSON.stringify(r.filter(c => c.cut).map(c => c.name))}`);
      // Rows stretch to their tallest card, so allow that; a fixed floor left
      // 200px+ of empty card.
      check(!floored.length, `${tag}: cards taller than their row's content (a fixed floor): ${JSON.stringify(floored.slice(0, 3).map(c => [c.name, c.h, rows.get(c.top)]))}`);
    } catch (err) { check(false, `${tag} threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
if (problems.length) {
  console.log(`  ✗ screen layout: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  process.exit(1);
}
console.log(`  ✓ screen layout: ${checks} checks — Me (identity, actions without zeros, Plursky+ on screen, festival rows), Today before the festival (saved rows, essentials grid, no sideways scroll), Artist (set card and stage night first), Map (header on solid ground, category chips), switcher (cards fit, names in full)`);
