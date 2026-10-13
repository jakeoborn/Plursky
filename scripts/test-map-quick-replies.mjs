#!/usr/bin/env node
// Map chat quick replies, in the running app: a smart chip names the artist
// in full. Until this gate the tag was `name.slice(0, 8)`, so "Sabrina
// Carpenter LIVE" read "SABRINA  LIVE" and a b2b lost its second act.
//   1. buildSmartReplies keeps the whole name, LIVE and "in N min" alike.
//   2. The real MessageDrawer at 320px, clock pinned to a live ACL Weekend 1
//      evening, one saved set on stage now and one starting within 90 min:
//      each smart chip carries the full name, sits inside the row's width
//      (the row scrolls sideways, so a chip wider than the row can never be
//      read whole) and clips no text. Then every name is made longer than
//      the screen and the same must hold.
// No network. The drawer is mounted directly; demo friends need a crew.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const fid = 'acl-2026';
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, serviceWorkers: 'block' });
  await ctx.clock.install({ time: new Date('2026-10-03T01:30:00Z') });
  await ctx.addInitScript(fid => {
    localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', fid);
    localStorage.setItem('active_festival_explicit', '1'); localStorage.setItem('cloud_nudge_seen', '1');
  }, fid);
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${fid}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof MessageDrawer === 'function' && document.querySelector('#root')?.children.length, fid, { timeout: 60000 });
  await page.clock.runFor(1500);

  // Fixture: one set on stage now, one starting within 90 minutes, from the
  // real lineup and the real clock (findNextSavedSet, not a stub).
  const fx = await page.evaluate(() => {
    const live = ARTISTS.find(a => findNextSavedSet([a.id])?.isLive);
    const soon = ARTISTS.find(a => { const n = findNextSavedSet([a.id]); return n && !n.isLive && n.minsUntil > 0 && n.minsUntil <= 90; });
    const stage = STAGES[0];
    return { live: live && { id: live.id, name: live.name }, soon: soon && { id: soon.id, name: soon.name }, stage: stage && stage.id, night: NOW.night };
  });
  check(fx.live && fx.soon && fx.stage, `fixture: a live set and a set within 90 min on ACL night ${fx.night} (${JSON.stringify(fx)})`);

  if (fx.live && fx.soon) {
    // 1. The builder.
    const tags = await page.evaluate(({ live, soon }) => {
      const a = ARTISTS.find(x => x.id === live.id), b = ARTISTS.find(x => x.id === soon.id);
      return [buildSmartReplies({ nextSavedSet: { artist: a, isLive: true } }),
              buildSmartReplies({ nextSavedSet: { artist: b, isLive: false, minsUntil: 42 } })].map(r => r.map(x => x.tag));
    }, fx);
    check(tags[0].includes(`${fx.live.name.toUpperCase()} LIVE`), `LIVE tag keeps "${fx.live.name}" whole: ${JSON.stringify(tags[0])}`);
    check(tags[1].includes(`${fx.soon.name.toUpperCase()} 42M`), `"in N min" tag keeps "${fx.soon.name}" whole: ${JSON.stringify(tags[1])}`);

    // 2. The drawer, as rendered.
    const measure = (savedId) => page.evaluate(({ savedId, stage }) => {
      let host = document.getElementById('qr-host');
      if (host) { host._root.unmount(); host.remove(); }
      host = document.createElement('div'); host.id = 'qr-host'; document.body.appendChild(host);
      host._root = ReactDOM.createRoot(host);
      ReactDOM.flushSync(() => host._root.render(React.createElement(MessageDrawer, {
        friend: { id: 'qr-test', name: 'Kai', color: '#6D28D9', stage, lastSeen: Date.now() },
        saved: [savedId], avatarStage: stage, onClose() {}, onSwitchToMeet() {},
      })));
      const chips = [...host.querySelectorAll('[data-quick-reply="smart"]')];
      const row = chips[0]?.parentElement;
      const rr = row?.getBoundingClientRect();
      const cs = row && getComputedStyle(row);
      const inner = rr ? { l: rr.left + parseFloat(cs.paddingLeft), r: rr.right - parseFloat(cs.paddingRight) } : null;
      return chips.map(c => {
        const b = c.getBoundingClientRect();
        const rg = document.createRange(); rg.selectNodeContents(c);
        const rects = [...rg.getClientRects()];
        return {
          text: c.textContent, w: b.width, rowW: inner ? inner.r - inner.l : 0,
          clipX: c.scrollWidth - c.clientWidth, clipY: c.scrollHeight - c.clientHeight,
          textOut: rects.some(t => t.left < b.left - 0.5 || t.right > b.right + 0.5 || t.top < b.top - 0.5 || t.bottom > b.bottom + 0.5),
        };
      });
    }, { savedId, stage: fx.stage });
    const pass = async (label) => {
      for (const [set, suffix] of [[fx.live, 'LIVE'], [fx.soon, 'M']]) {
        const name = await page.evaluate(id => ARTISTS.find(a => a.id === id).name, set.id);
        await page.clock.runFor(100);
        const chips = await measure(set.id);
        const chip = chips.find(c => c.text.toUpperCase().includes(name.toUpperCase()));
        check(!!chip, `${label}: a smart chip names "${name}" in full (${suffix}); chips: ${JSON.stringify(chips.map(c => c.text))}`);
        if (!chip) continue;
        check(chip.w <= chip.rowW + 0.5, `${label}: "${name}" chip is ${chip.w.toFixed(1)}px, wider than the ${chip.rowW.toFixed(1)}px row`);
        check(chip.clipX <= 0 && chip.clipY <= 0 && !chip.textOut, `${label}: "${name}" chip clips its text (x ${chip.clipX}, y ${chip.clipY}, out ${chip.textOut})`);
      }
    };
    await pass('320px');
    await page.evaluate(ids => { for (const a of ARTISTS) if (ids.includes(a.id)) a.name += ' b2b Interplanetary Criminal (Sunrise Set)'; }, [fx.live.id, fx.soon.id]);
    await pass('320px, names longer than the screen');
    const n = await page.evaluate(() => document.querySelectorAll('#qr-host [data-quick-reply="stock"]').length);
    check(n === 6, `the six stock replies still render beside the smart chips (${n})`);
  }
  await browser.close();
} finally { server.kill(); }

if (problems.length) { for (const p of problems) console.log(`  ✗  ${p}`); console.log(`✗ map quick replies: ${problems.length} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓  map quick replies: ${checks} checks`);
