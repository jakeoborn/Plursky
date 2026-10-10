// Night Print gate: Today as a ticket / poster, in the running app.
//
// Round 5 (Oct 7 owner steering): bold ticket/poster energy, cream canvas,
// ONE festival accent from a verified first-party source, the four-step
// journey. This gate proves the print on labelled fixtures, in both modes,
// at 390 and 320, under Reduce Motion (the app's default test posture):
//   · the fixture's festival is the one that mounted (a gated id falls back
//     to the default silently), and the page threw nothing
//   · the accent on the poster/strip is the ledger's hex when a print
//     constant reads on it at 3:1, else the neutral ink/paper treatment
//   · every text pair inside the print is WCAG AA for its size, against
//     what is really behind it (layers composited, opacity included)
//   · nothing scrolls sideways; no print block reaches past the viewport
//   · the stamp covers no text; poster words, the claim and journey titles
//     never break inside a word (the fit observer did its job, and the
//     same size with and without Reduce Motion)
//   · every print control is a 44px target with its full label
//   · the four steps carry their phrases and route where they say; the
//     first-set action, the essentials and the tools all land
//   · the essentials survive as type links, by state
//   · the palette ledger covers the whole roster, each row sourced and dated
// Usage: node scripts/test-night-print.mjs [fixtureKey ...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { serverReady } from './lib/server-ready.mjs';
import { existsSync } from 'node:fs';

const ONLY = process.argv.slice(2);
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });

// key, festival, clock, saved ids, extra storage, widths, expected essentials, phase
const FIXTURES = [
  ['pre-empty', 'edc-lv-2026', '2026-05-01T18:00:00Z', [], {}, [390, 320], ['map', 'tonight', 'dontmiss', 'headliners', 'basics', 'alerts'], 'pre'],
  ['pre-saved', 'edc-lv-2026', '2026-05-01T18:00:00Z', ['k15', 'k16', 'q17', 'bp8', 'n4', 'k1', 'k9'], {}, [390, 320], ['map', 'tonight', 'dontmiss', 'headliners', 'basics', 'alerts'], 'pre'],
  ['day-empty', 'edc-lv-2026', '2026-05-17T07:50:00Z', [], {}, [390], ['map', 'tonight', 'dontmiss', 'lastnight', 'upcoming', 'basics', 'alerts'], 'live'],
  ['day-saved', 'edc-lv-2026', '2026-05-17T07:50:00Z', ['k15', 'k16', 'q17', 'bp8'], {}, [390, 320], ['map', 'tonight', 'dontmiss', 'lastnight', 'upcoming', 'basics', 'alerts'], 'live'],
  ['post', 'edc-lv-2026', '2026-06-01T18:00:00Z', ['k15', 'k16', 'q17', 'bp8'], { plursky_attended_v1: JSON.stringify({ 1: ['k15'] }) }, [390], ['map', 'basics', 'alerts'], 'post'],
  ['iii-pre', 'iii-points-2026', '2026-10-09T18:00:00Z', [], {}, [390, 320], ['map', 'tonight', 'dontmiss', 'headliners', 'basics', 'alerts'], 'pre'],
  ['nocturnal', 'nocturnal-wonderland-2026', '2026-08-01T18:00:00Z', [], {}, [390, 320], ['map', 'tonight', 'dontmiss', 'headliners', 'basics', 'alerts'], 'pre'],
  ['neutral', 'summerfest-2026', '2026-06-01T18:00:00Z', [], {}, [390], ['map', 'tonight', 'dontmiss', 'headliners', 'basics', 'alerts'], 'pre'],
].filter(([k]) => !ONLY.length || ONLY.includes(k));

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const open = async ({ fid, at, saved, extra, width, pick, motion = 'reduce' }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 852 }, serviceWorkers: 'block', reducedMotion: motion, colorScheme: pick });
    // Only the app's own CDN scripts leave the box; every other outside call is refused, so the
    // print is measured on fixture data alone.
    await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
    await ctx.clock.install({ time: new Date(at) });
    // A forecast in the app's own cache, dated at the pinned clock, so the Sun & weather
    // sheet prints real values (the live fetch is refused) and their inks can be measured.
    const forecast = { fetchedAt: Date.parse(at), data: [{ name: 'Tonight', startTime: new Date(Date.parse(at)).toISOString(), endTime: new Date(Date.parse(at) + 12 * 3600000).toISOString(), temperature: 71, temperatureUnit: 'F', windSpeed: '10 mph', windDirection: 'SW', shortForecast: 'Clear', detailedForecast: 'Clear' }] };
    const hourly = { fetchedAt: Date.parse(at), data: Array.from({ length: 12 }, (_, i) => ({ startTime: new Date(Date.parse(at) + i * 3600000).toISOString(), temperature: 70 + i, temperatureUnit: 'F', shortForecast: 'Clear', windSpeed: '5 mph', probabilityOfPrecipitation: 0 })) };
    await ctx.addInitScript(({ fid, pick, saved, extra, forecast, hourly }) => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      localStorage.setItem(`forecast_${fid}`, JSON.stringify(forecast)); localStorage.setItem(`forecast_hourly_${fid}`, JSON.stringify(hourly));
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', fid); localStorage.setItem('active_festival_explicit', '1');
      localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('setup_banner_dismissed', '1'); localStorage.setItem('notif_nudge_dismissed', '1');
      localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(saved));
      localStorage.setItem('ping_code', 'ECHO'); localStorage.setItem('plursky_pid', 'night-print-gate');
      localStorage.setItem('plursky.appearance', pick);
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
      if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity, addEventListener() {}, removeEventListener() {} });
    }, { fid, pick, saved, extra, forecast, hourly });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?tab=home`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-night-print]', { timeout: 60000 });
    await page.clock.runFor(1500); await page.waitForTimeout(400);
    return { ctx, page, errors };
  };

  // A drawer (the first-timer guide, the alerts drawer): measured by its dialog name.
  const drawerAudit = (page, label) => page.evaluate((label) => {
    const dlg = [...document.querySelectorAll('[role=dialog]')].find(d => d.getAttribute('aria-label') === label);
    if (!dlg) return null;
    const bar = document.querySelector('button[aria-current="page"]')?.parentElement;
    // A sheet that covers the bar (the field sheet, fixed over the frame) is bounded by the
    // viewport; one that sits inside the screen is bounded by the bar's top edge.
    const br = bar && bar.getBoundingClientRect();
    const under = br && document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    const covered = !!(under && !bar.contains(under));
    const tabTop = bar && !covered ? br.top : window.innerHeight;
    const btn = (b) => { const q = b.getBoundingClientRect(); return { text: b.textContent.trim().slice(0, 24), label: b.getAttribute('aria-label'), w: q.width, h: q.height, bottom: q.bottom }; };
    const buttons = [...dlg.querySelectorAll('button')].map(btn);
    const scroller = [...dlg.querySelectorAll('div')].find(d => /auto|scroll/.test(getComputedStyle(d).overflowY));
    let scrolled = null;
    if (scroller) { scroller.scrollTop = scroller.scrollHeight; scrolled = [...dlg.querySelectorAll('button')].map(btn); scroller.scrollTop = 0; }
    // The sheet's own box is capped by its maxHeight; when the scroller has no flex floor the
    // CONTENT box overflows past it, so the scroller's edge is the one that must clear the bar.
    const content = scroller ? scroller.getBoundingClientRect().bottom : dlg.getBoundingClientRect().bottom;
    return { tabTop, bottom: Math.max(dlg.getBoundingClientRect().bottom, content), buttons, scrolled };
  }, label);
  // The Sun & weather values: each number against the composited backing under it.
  const sheetInks = (page) => page.evaluate(() => {
    const parse = (s) => { const m = s.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return [r, g, b, a]; };
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const backing = (el) => { const r = el.getBoundingClientRect(); const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2); let out = [255, 255, 255]; const layers = []; for (const n of stack) { if (n === el || el.contains(n)) continue; const bg = parse(getComputedStyle(n).backgroundColor); if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; } } for (const l of layers.reverse()) { const a = l[3]; out = [0, 1, 2].map(i => l[i] * a + out[i] * (1 - a)); } return out; };
    const dlg = [...document.querySelectorAll('[role=dialog]')].find(d => d.getAttribute('aria-label') === 'Sun & weather');
    if (!dlg) return null;
    return [...dlg.querySelectorAll('div')].filter(d => !d.children.length && /^(\d+°[FC]|\d{2}:\d{2})$/.test(d.textContent.trim())).map(d => {
      const fg = parse(getComputedStyle(d).color), bg = backing(d); const L1 = lum(fg), L2 = lum(bg);
      return { text: d.textContent.trim(), fg: getComputedStyle(d).color, bg: bg.map(Math.round).join(','), ratio: +((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)).toFixed(2) };
    });
  });

  // Everything measured in one pass, in the page.
  const measure = (page) => page.evaluate(() => {
    const np = document.querySelector('[data-night-print]');
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = '1'] = m[1].split(',').map(s => s.trim()); return [+r, +g, +b, parseFloat(a)]; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (top, under) => { const a = top[3]; return [0, 1, 2].map(i => Math.round(top[i] * a + under[i] * (1 - a))).concat([1]); };
    // What is really behind an element: its ancestors' backgrounds, composited from the first opaque one up.
    const behind = (el) => {
      const layers = []; let n = el.parentElement;
      while (n) {
        // Step 3's plate is a sibling painted under the text, not an ancestor.
        const plate = n.classList.contains('np-j3') ? n.querySelector(':scope > .np-j3-plate') : null;
        const bg = parse(getComputedStyle(plate || n).backgroundColor);
        if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; } n = n.parentElement;
      }
      let base = [238, 233, 217, 1];
      if (!layers.length || layers[layers.length - 1][3] < 1) { const b = parse(getComputedStyle(document.body).backgroundColor); base = b && b[3] >= 1 ? b : base; } else base = layers.pop();
      for (const l of layers.reverse()) base = over(l, base);
      return base;
    };
    const opacityOf = (el) => { let o = 1; let n = el; while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; } return o; };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const aa = [];
    for (const el of np.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.data).join('').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const cs = getComputedStyle(el);
      let fg = parse(cs.color); if (!fg) continue;
      const own = parse(cs.backgroundColor);
      let bg = behind(el); if (own && own[3] > 0) bg = over(own, bg);
      fg = over([fg[0], fg[1], fg[2], fg[3] * opacityOf(el)], bg);
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const ratio = contrast(fg, bg);
      if (ratio < (large ? 3 : 4.5)) aa.push(`"${text.slice(0, 40)}" ${ratio.toFixed(2)}:1 (${size}px/${weight}) fg ${cs.color} on rgb(${bg.slice(0, 3)})`);
    }
    const w = innerWidth;
    const reach = [...np.querySelectorAll('.np-poster, .np-block, .np-journey, .np-util, .np-head, button')].filter(vis)
      .map(el => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.right > w + 1 || r.left < -1)
      .map(({ el, r }) => `${el.className || el.tagName} ${Math.round(r.left)}..${Math.round(r.right)}`);
    const pans = [...np.querySelectorAll('*')].filter(el => { const cs = getComputedStyle(el); return /auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.getBoundingClientRect().height > 40; }).map(el => el.className || el.tagName);
    // Controls: every print control is 44px both ways.
    const small = [...np.querySelectorAll('.np-tool, .np-title[data-switch], .np-act, .np-srow, .np-j, .np-j3, .np-link')].filter(vis)
      .filter(el => !el.closest('.np-j3') || el.classList.contains('np-j3'))
      .map(el => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ el, r }) => `${el.className} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}"`);
    // The stamp covers no text.
    const stamp = np.querySelector('[data-np-stamp]');
    const sr = stamp && stamp.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const covered = !sr ? [] : [...np.querySelector('.np-poster').querySelectorAll('*')].filter(el => vis(el) && !stamp.contains(el) && el !== stamp)
      .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.data.trim())).map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => hit(r, sr)).map(({ el }) => el.textContent.trim().slice(0, 30));
    // Words: one line each, inside their box, never broken inside themselves.
    const broken = [];
    for (const h of np.querySelectorAll('.np-word, .np-strip-word, .np-claim, .np-jt')) {
      if (!vis(h)) continue;
      if (getComputedStyle(h).overflowWrap === 'anywhere') broken.push(`${h.className}: fit gave up ("${h.textContent.trim().slice(0, 30)}")`);
      const box = h.getBoundingClientRect(); const padR = parseFloat(getComputedStyle(h).paddingRight);
      const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const n = tw.currentNode; const re = /[^\s]+/g; let m;
        while ((m = re.exec(n.data))) {
          const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
          const rs = [...rg.getClientRects()]; const r = rg.getBoundingClientRect();
          if (rs.length > 1 && rs[rs.length - 1].top > rs[0].top + 1) broken.push(`${h.className}: "${m[0]}" wraps inside itself`);
          if (r.right > box.right - padR + 1) broken.push(`${h.className}: "${m[0]}" runs past its box by ${Math.round(r.right - (box.right - padR))}px`);
        }
      }
    }
    const word = np.querySelector('.np-word, .np-strip-word');
    const steps = [...np.querySelectorAll('[data-np-step]')].map(b => ({ id: b.dataset.npStep, text: [...b.querySelectorAll('h3 > span, p')].map(e => e.textContent.trim()).join(' '), r: b.getBoundingClientRect() }));
    const links = [...np.querySelectorAll('[data-np-link]')].map(b => b.dataset.npLink);
    const poster = np.querySelector('[data-np-poster], [data-np-strip]');
    const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
    const acc = window.FESTIVAL_CONFIG?.print?.accent || null;
    return {
      fid: window.FESTIVAL_CONFIG?.id, mode: document.documentElement.getAttribute('data-mode'),
      aa, reach, pans, small, covered, broken,
      wordSize: word ? parseFloat(getComputedStyle(word).fontSize) : null, wordText: word ? word.innerText.replace(/\s+/g, ' ') : '',
      steps, links, h1: [...document.querySelectorAll('h1')].filter(vis).map(h => h.innerText.replace(/\s+/g, ' ').trim()),
      posterAccent: poster?.dataset.npAccent, posterBg: poster ? getComputedStyle(poster).backgroundColor : null, accHex: acc, accRgb: acc ? toRgb(acc) : null,
      sideways: document.documentElement.scrollWidth > innerWidth + 1 || np.scrollWidth > np.clientWidth + 1,
      tilt: (() => { const p = np.querySelector('.np-j3-plate'); return p ? getComputedStyle(p).transform : null; })(),
      journeyBox: (() => { const j = np.querySelector('.np-journey'); return j ? getComputedStyle(j).overflowX : null; })(),
    };
  });

  // Home again by the app's own deep link (the seeds are kept: the init script seeds once per session).
  const tabTo = async (page) => { await page.goto(`http://127.0.0.1:${PORT}/index.html?tab=home`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('[data-night-print]', { timeout: 60000 }); await page.clock.runFor(1500); await page.waitForTimeout(300); };
  const h1s = (page) => page.evaluate(() => [...document.querySelectorAll('h1')].filter(h => h.getClientRects().length).map(h => h.innerText.replace(/\s+/g, ' ').trim()));
  const tab = (page) => page.evaluate(() => (document.querySelector('[aria-current=page]')?.innerText || '').trim());
  const dialogs = (page) => page.evaluate(() => [...document.querySelectorAll('[role=dialog]')].map(d => d.getAttribute('aria-label') || ''));

  for (const [key, fid, at, saved, extra, widths, essentials, phase] of FIXTURES) {
    for (const pick of ['dark', 'light']) for (const width of widths) {
      const tag = `${key} ${pick} ${width}`;
      let ctx; let lastStep = 'open';
      try {
        const o = await open({ fid, at, saved, extra, width, pick }); ctx = o.ctx;
        const { page, errors } = o;
        const r = await measure(page);
        check(r.fid === fid, `${tag}: asked for ${fid}, ${r.fid} mounted`);
        check(r.mode === pick, `${tag}: mode is ${r.mode}`);
        check(!errors.length, `${tag}: page errors: ${errors.join(' | ').slice(0, 200)}`);
        check(!r.aa.length, `${tag}: ${r.aa.length} text pair(s) below AA: ${r.aa.slice(0, 4).join('; ')}`);
        check(!r.sideways && !r.pans.length && !r.reach.length, `${tag}: sideways — ${[r.sideways && 'page scrolls', ...r.pans.map(p => 'pans: ' + p), ...r.reach.map(p => 'reaches: ' + p)].filter(Boolean).join('; ').slice(0, 200)}`);
        check(!r.small.length, `${tag}: control(s) under 44px: ${r.small.slice(0, 4).join('; ')}`);
        check(!r.covered.length, `${tag}: the stamp covers: ${r.covered.join(', ')}`);
        check(!r.broken.length, `${tag}: ${r.broken.slice(0, 4).join('; ')}`);
        check(r.steps.length === 4 && r.steps.map(s => s.id).join(',') === 'people,night,playlist,gallery', `${tag}: journey steps are ${r.steps.map(s => s.id).join(',')}`);
        check(r.steps[2]?.text.includes('Build Your Playlist.') && r.steps[3]?.text.includes('Create Your Gallery.') && r.steps[0]?.text.includes('Pick your people.') && r.steps[1]?.text.includes('Follow your night.'),
          `${tag}: journey phrases: ${r.steps.map(s => s.text.slice(0, 30)).join(' | ')}`);
        check(r.links.join(',') === essentials.join(','), `${tag}: essentials are ${r.links.join(',')} (want ${essentials.join(',')})`);
        check(r.tilt && r.tilt !== 'none', `${tag}: Step 3's plate is not tilted (${r.tilt})`);
        check(r.journeyBox === 'hidden', `${tag}: the journey does not clip its overhang (${r.journeyBox})`);
        const want = r.accHex && (await page.evaluate(() => { const s = window.npAccent && window.npAccent(); return s ? s.acc : 'none'; }));
        check(r.posterAccent === (want || 'none'), `${tag}: poster accent is ${r.posterAccent}, ledger says ${want || 'none'}`);
        if (want && want !== 'none') check(r.posterBg === r.accRgb, `${tag}: poster paints ${r.posterBg}, ledger accent is ${r.accRgb}`);
        if (key === 'neutral') check(r.posterAccent === 'none', `${tag}: Summerfest has no verified accent but prints ${r.posterAccent}`);
        check(r.h1.some(t => t.toLowerCase() === (window_name(fid)).toLowerCase()), `${tag}: h1s are ${JSON.stringify(r.h1)}`);
        if (phase === 'pre') check(r.wordSize >= 32, `${tag}: the festival word is ${r.wordSize}px`);
        if (key === 'iii-pre') check(await page.$eval('.np-word .np-roman', e => e.textContent) === 'III', `${tag}: III is not set as the Roman word`);

        // Routing, once per fixture (390 light): every step, the first-set action, the essentials, the tools.
        if (pick === 'light' && width === 390) {
          lastStep = '[data-np-step=playlist]'; await page.click('[data-np-step=playlist]'); await page.waitForTimeout(400);
          check((await h1s(page)).includes('Music'), `${tag}: Build Your Playlist did not open Music: ${JSON.stringify(await h1s(page))}`);
          await tabTo(page);
          lastStep = '[data-np-step=gallery]'; await page.click('[data-np-step=gallery]'); await page.waitForTimeout(400);
          check((await h1s(page)).includes('Memories'), `${tag}: Create Your Gallery did not open Memories: ${JSON.stringify(await h1s(page))}`);
          await tabTo(page);
          lastStep = '[data-np-step=people]'; await page.click('[data-np-step=people]'); await page.waitForTimeout(400);
          check((await tab(page)) === 'Lineup', `${tag}: Pick your people did not open the Lineup (tab "${await tab(page)}")`);
          await tabTo(page);
          lastStep = '[data-np-step=night]'; await page.click('[data-np-step=night]'); await page.waitForTimeout(400);
          if (phase === 'post') check((await h1s(page)).includes('Recap'), `${tag}: Follow your night did not open the Recap after the festival: ${JSON.stringify(await h1s(page))}`);
          else {
            const d = await dialogs(page);
            check(d.includes(phase === 'live' ? 'My night' : 'My saved sets'), `${tag}: Follow your night opened ${JSON.stringify(d)}`);
            await page.keyboard.press('Escape'); await page.waitForTimeout(200);
          }
          if (phase === 'post') { await tabTo(page); }
          if (await page.$('[data-np-claim] .np-act')) {
            lastStep = '[data-np-claim] .np-act'; await page.click('[data-np-claim] .np-act'); await page.waitForTimeout(400);
            check((await tab(page)) === 'Lineup', `${tag}: the first-set action did not open the Lineup`);
            await tabTo(page);
          }
          if (await page.$('[data-np-saved] .np-act')) {
            lastStep = '[data-np-saved] .np-act'; await page.click('[data-np-saved] .np-act'); await page.waitForTimeout(400);
            check((await dialogs(page)).includes('My saved sets'), `${tag}: the all-saved action did not open My saved sets`);
            await page.keyboard.press('Escape'); await page.waitForTimeout(200);
          }
          lastStep = '[data-np-link=map]'; await page.click('[data-np-link=map]'); await page.waitForTimeout(400);
          // After the festival the bar swaps Map for Memories, so the map screen lights no tab; it still opens.
          check(await page.evaluate(() => !document.querySelector('[data-night-print]')) && ((await tab(page)) === 'Map' || phase === 'post'), `${tag}: MAP did not open the map (tab "${await tab(page)}")`);
          await tabTo(page);
          lastStep = '[data-np-link=basics]'; await page.click('[data-np-link=basics]'); await page.waitForTimeout(400);
          const guide = await page.evaluate(() => { const t = (window.FT_SECTIONS || [])[0]?.title; return !!t && document.body.innerText.includes(t); });
          check(guide, `${tag}: BASICS did not open the first-timer guide`);
          // The drawers: a named dialog, every control 44px, the sheet ends above the tab bar, the
          // quick-jump actions clear the bar once scrolled to, and Escape closes it (re-verdict fixes 2 and 3).
          const drawer = async (label, actions) => {
            const a = await drawerAudit(page, label);
            check(!!a, `${tag}: no dialog named "${label}"`);
            if (!a) return;
            const small = a.buttons.filter(b => b.h < 44 || b.w < 44);
            check(!small.length, `${tag}: ${label}: controls under 44px: ${small.map(b => `${b.text || b.label} ${Math.round(b.w)}×${Math.round(b.h)}`).join(', ')}`);
            check(a.buttons.some(b => /^close/i.test(b.label || '')), `${tag}: ${label}: the close control has no accessible name`);
            check(a.bottom <= a.tabTop + .5, `${tag}: ${label}: the sheet runs ${Math.round(a.bottom - a.tabTop)}px under the tab bar`);
            for (const t of actions) {
              const b = (a.scrolled || a.buttons).find(b => b.text === t);
              check(!!b && b.bottom <= a.tabTop - 8, `${tag}: ${label}: ${t} ${b ? `ends ${Math.round(b.bottom - a.tabTop)}px past the tab bar once scrolled` : 'is missing'}`);
            }
            await page.keyboard.press('Escape'); await page.waitForTimeout(300);
            check(!(await drawerAudit(page, label)), `${tag}: ${label}: Escape did not close it`);
          };
          await drawer('The basics', ['Explore map', 'Browse lineup']);
          lastStep = '[data-np-link=alerts]'; await page.click('[data-np-link=alerts]'); await page.waitForTimeout(400);
          check((await dialogs(page)).includes('Alerts'), `${tag}: ALERTS did not open the alerts drawer`);
          lastStep = 'close alerts'; await drawer('Alerts', []);
          if (phase !== 'post') {
            lastStep = '[data-np-link=tonight]'; await page.click('[data-np-link=tonight]'); await page.waitForTimeout(600);
            check((await dialogs(page)).includes('Sun & weather'), `${tag}: SUN & WEATHER did not open its sheet`);
            // Re-verdict fix 1: the sunset / sunrise / temperature values read AA on the card in this mode.
            const inks = await sheetInks(page);
            check(!!inks && inks.length >= 2, `${tag}: Sun & weather printed ${inks ? inks.length : 'no'} value(s) (want the sun times and the temperature)`);
            const low = (inks || []).filter(v => v.ratio < 4.5);
            check(!low.length, `${tag}: Sun & weather values under AA: ${low.map(v => `${v.text} ${v.fg} on ${v.bg} = ${v.ratio}:1`).join('; ')}`);
            await page.keyboard.press('Escape'); await page.waitForTimeout(200);
          }
          lastStep = '.np-tool[aria-label="Offline mode"]'; await page.click('.np-tool[aria-label="Offline mode"]'); await page.waitForTimeout(300);
          check(await page.evaluate(() => document.querySelector('.np-tool[aria-label="Offline mode"]').getAttribute('aria-pressed') === 'true' && /offline mode/i.test(document.body.innerText)), `${tag}: the offline toggle did not take`);
          lastStep = '.np-tool[aria-label="Offline mode"]'; await page.click('.np-tool[aria-label="Offline mode"]'); await page.waitForTimeout(200);
          lastStep = '.np-tool[aria-label^="Search"]'; await page.click('.np-tool[aria-label^="Search"]'); await page.waitForTimeout(400);
          check(!!(await page.$('input[placeholder="Artist, stage, genre, day…"]')), `${tag}: the search tool did not open search`);
          await page.keyboard.press('Escape'); await page.waitForTimeout(200);
          // The switcher: the festival's name opens it.
          lastStep = '.np-title[data-switch]'; await page.click('.np-title[data-switch]'); await page.waitForTimeout(400);
          check(await page.evaluate(() => document.body.innerText.includes('Switch festival') || !!document.querySelector('[role=dialog]')), `${tag}: the festival name did not open the switcher`);
          await page.keyboard.press('Escape');
        }
        // The same print with motion allowed: the fitted size must agree with the Reduce Motion one.
        if (key === 'pre-empty' || key === 'nocturnal' || key === 'neutral') {
          const m2 = await open({ fid, at, saved, extra, width, pick, motion: 'no-preference' });
          const r2 = await measure(m2.page);
          check(Math.abs((r2.wordSize || 0) - (r.wordSize || 0)) < 0.6, `${tag}: the festival word fits at ${r.wordSize}px under Reduce Motion but ${r2.wordSize}px with motion`);
          await m2.ctx.close();
        }
      } catch (err) { check(false, `${tag} threw at ${lastStep}: ${String(err.message || err).split('\n')[0]}`); }
      await ctx?.close();
    }
  }

  // The ledger covers the roster: every registered edition has a print row with a source and a date.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 852 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`) && !/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.toString()), r => r.abort());
    await ctx.addInitScript(() => { localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', 'edc-lv-2026'); localStorage.setItem('active_festival_explicit', '1'); localStorage.setItem('cloud_nudge_seen', '1'); });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?tab=home`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-night-print]', { timeout: 60000 });
    const led = await page.evaluate(() => {
      // The roster is the registry (the 2027 stubs have a config but no data set yet).
      const cfgs = (window.FESTIVALS_REGISTRY || []).filter(f => f && f.config).map(f => f.config);
      const ids = cfgs.map(c => c.id);
      const rows = cfgs.map(c => { const id = c.id; const p = c.print; return { id, has: !!p, hex: p?.accent || null, src: p?.source?.url || null, at: p?.source?.observedAt || null, ok: !!p && ('accent' in p) && !!p.source?.url && /^\d{4}-\d{2}-\d{2}$/.test(p.source?.observedAt || '') && (p.accent === null || /^#[0-9A-F]{6}$/.test(p.accent)) }; });
      const sets = Object.keys(window._DATA_SETS || {});
      return { rows, missingFromSets: sets.filter(id => !ids.includes(id)) };
    });
    const bad = led.rows.filter(r => !r.ok);
    check(led.rows.length >= 25, `ledger: only ${led.rows.length} editions registered (want the roster, 25)`);
    check(!bad.length, `ledger: ${bad.length} edition(s) without a sourced, dated print row: ${bad.map(b => b.id).join(', ')}`);
    check(!led.missingFromSets.length, `ledger: data sets not in the registry: ${led.missingFromSets.join(', ')}`);
    const gaps = led.rows.filter(r => r.ok && r.hex === null).map(r => r.id);
    console.log(`  ledger: ${led.rows.length} editions, ${led.rows.filter(r => r.hex).length} with a first-party accent, ${gaps.length} neutral (${gaps.join(', ') || 'none'})`);
    await ctx.close();
  }
} finally { await browser?.close(); server.kill(); }

function window_name(fid) {
  // The h1 the print must read as: the festival's name without its edition year, as the data spells it.
  const names = { 'edc-lv-2026': 'EDC Las Vegas', 'iii-points-2026': 'III Points', 'nocturnal-wonderland-2026': 'Nocturnal Wonderland', 'summerfest-2026': 'Summerfest' };
  return names[fid] || fid;
}

if (problems.length) {
  console.error(`✗ night print: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ night print: ${checks} checks — every state in both modes at 390 and 320: AA for size, no sideways, stamp clear of text, words whole, 44px controls, four steps routed, essentials as links, the drawers 44px / named / above the bar / Escape, the weather values AA, ledger covers the roster`);
