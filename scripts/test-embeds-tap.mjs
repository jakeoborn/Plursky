#!/usr/bin/env node
// Instagram and X posts on /f/ pages are tap-to-load. In a real browser:
//   · rendering and scrolling the whole page makes NO request to Instagram,
//     Meta's CDNs, X or Twitter
//   · a tap on one post loads that platform's script once and turns THAT
//     post (only) into the platform's embed; the others stay inert
//   · a second post of the same platform reuses the script (no second fetch)
//   · the tapped post's button is gone and focus lands on the post
//   · at 320px the placeholders never widen the page, and neither does a
//     tapped post: the Instagram stub stamps the same inline 326px min-width
//     the real embed.js does, the X stub sizes to its column as widgets.js
//     does (both measured live at 320px), and every rendered post must fit
// The platform scripts are stubbed (CI is offline): each stub hydrates the
// blockquotes carrying the platform's class, exactly as the real script scans.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { serverReady } from './lib/server-ready.mjs';

const PAGE = '/f/acl-2026/'; // 2 Instagram posts and 1 X post
const SOCIAL = /(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net|facebook\.com|facebook\.net|twitter\.com|twimg\.com|x\.com)$/;
const STUB = {
  'https://www.instagram.com/embed.js': `window.instgrm = { Embeds: { process: function () {
    document.querySelectorAll('blockquote.instagram-media').forEach(function (b) {
      var f = document.createElement('iframe'); f.className = 'stub-ig instagram-media instagram-media-rendered'; f.setAttribute('data-src', b.getAttribute('data-instgrm-permalink'));
      f.setAttribute('style', 'background-color: white; border-radius: 3px; border: 1px solid rgb(219, 219, 219); box-shadow: none; display: block; margin: 0px 0px 12px; min-width: 326px; padding: 0px;'); f.height = 613; b.replaceWith(f);
    }); } } }; window.instgrm.Embeds.process();`,
  'https://platform.twitter.com/widgets.js': `window.twttr = { widgets: { load: function (el) {
    (el || document).querySelectorAll('blockquote.twitter-tweet').forEach(function (b) {
      var f = document.createElement('iframe'); f.className = 'stub-x'; f.setAttribute('data-src', b.querySelector('a').href);
      f.setAttribute('style', 'position: static; visibility: visible; width: ' + b.closest('figure').clientWidth + 'px; height: 563px; display: block; flex-grow: 1;'); b.replaceWith(f);
    }); } } }; window.twttr.widgets.load();`,
};

let n = 0; const failures = [];
const check = (ok, msg) => { n++; if (!ok) failures.push(msg); };
const rp = () => new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(e => e ? rej(e) : res(p)); }); });
const PORT = await rp();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}`;

try {
  await serverReady(BASE + PAGE);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const width of [393, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await ctx.newPage();
      const social = [];
      // Every off-box request is recorded before it is answered; only the two
      // platform scripts get a stub, everything else off-box is refused.
      await page.route(u => !u.href.startsWith(BASE), route => {
        const url = route.request().url();
        if (SOCIAL.test(new URL(url).hostname)) social.push(url);
        if (STUB[url]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: STUB[url] });
        return route.abort();
      });
      await page.goto(BASE + PAGE, { waitUntil: 'load' });
      const at = `[${width}]`;
      const counts = await page.evaluate(() => ({
        ig: document.querySelectorAll('figure[data-tap="instagram"]').length,
        x: document.querySelectorAll('figure[data-tap="x"]').length,
      }));
      check(counts.ig >= 2 && counts.x >= 1, `${at} control: ${PAGE} should carry 2+ Instagram and 1+ X posts (got ${counts.ig}/${counts.x})`);

      // Render, then walk the whole page top to bottom like a reader.
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y <= h; y += 400) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(40); }
      await page.evaluate(() => document.getElementById('watch').scrollIntoView());
      await page.waitForTimeout(1200);
      check(social.length === 0, `${at} the page contacted Instagram/X before any tap: ${social.join(', ')}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `${at} the tap-to-load placeholders widen the page by ${overflow}px`);
      const whats = await page.evaluate(() => [...document.querySelectorAll('figure[data-tap] .embed-what')].map(p => ({ t: p.textContent.replace(/\u00a0/g, ' '), shown: p.getClientRects().length > 0, over: p.scrollWidth - p.clientWidth })));
      check(whats.length === counts.ig + counts.x && whats.every(w => w.shown && / · Posted [A-Z][a-z]+ \d{1,2}, \d{4}$/.test(w.t)), `${at} not every untapped post shows its "kind · Posted date" line: ${JSON.stringify(whats)}`);
      check(whats.every(w => w.over <= 0), `${at} a date line overflows its box`);
      const dupes = await page.evaluate(() => [...document.querySelectorAll('figure[data-tap]')].map(f => [...f.querySelectorAll('a')].filter(a => a.getClientRects().length && /View (this post|the original)/.test(a.textContent)).length));
      check(dupes.every(n => n === 1), `${at} a card shows ${JSON.stringify(dupes)} visible links to its post (want 1 each)`);
      const boxes = await page.evaluate(() => [...document.querySelectorAll('blockquote.tap-embed')].map(b => b.getBoundingClientRect().height));
      check(boxes.length > 0 && boxes.every(h => h === 0), `${at} an untapped post draws an empty blockquote box (${JSON.stringify(boxes)}px)`);
      const btnH = await page.evaluate(() => Math.min(...[...document.querySelectorAll('button.embed-load')].map(b => b.getBoundingClientRect().height)));
      check(btnH >= 44, `${at} a load button is ${btnH}px tall (under 44)`);

      // Tap the first Instagram post.
      const igFigs = page.locator('figure[data-tap="instagram"]');
      const firstPermalink = await igFigs.nth(0).locator('blockquote').getAttribute('data-instgrm-permalink');
      await igFigs.nth(0).locator('button.embed-load').click();
      await page.waitForFunction(() => document.querySelectorAll('iframe.stub-ig').length > 0, null, { timeout: 5000 }).catch(() => {});
      const s1 = await page.evaluate(() => ({
        rendered: [...document.querySelectorAll('iframe.stub-ig')].map(f => f.getAttribute('data-src')),
        inert: document.querySelectorAll('figure[data-tap="instagram"] blockquote.tap-embed').length,
        whatVisible: (() => { const w = document.querySelector('figure[data-tap="instagram"].tapped .embed-what'); return !!w && w.getClientRects().length > 0; })(),
        btnVisible: (() => { const b = document.querySelector('figure[data-tap="instagram"] button.embed-load'); return !!b && b.getClientRects().length > 0; })(),
        focusIsFig: document.activeElement && document.activeElement.matches('figure[data-tap="instagram"]'),
      }));
      const igReq = () => social.filter(u => /instagram\.com\/embed\.js/.test(u)).length;
      check(igReq() === 1, `${at} one tap fetched embed.js ${igReq()} times`);
      check(s1.rendered.length === 1 && s1.rendered[0] === firstPermalink, `${at} the tap did not load exactly the tapped post (${JSON.stringify(s1.rendered)})`);
      check(s1.inert === counts.ig - 1, `${at} tapping one Instagram post changed ${counts.ig - s1.inert} posts`);
      check(!s1.whatVisible, `${at} the tapped post still shows its pre-tap date line over the real embed`);
      check(!s1.btnVisible, `${at} the tapped post still shows its load button`);
      check(s1.focusIsFig, `${at} focus did not move to the tapped post`);
      check(social.every(u => /instagram\.com\/embed\.js/.test(u)), `${at} an Instagram tap contacted X: ${social.join(', ')}`);

      // A second Instagram post reuses the script.
      await igFigs.nth(1).locator('button.embed-load').click();
      await page.waitForFunction(() => document.querySelectorAll('iframe.stub-ig').length > 1, null, { timeout: 5000 }).catch(() => {});
      const ig2 = await page.evaluate(() => document.querySelectorAll('iframe.stub-ig').length);
      check(ig2 === 2, `${at} the second Instagram tap rendered ${ig2} posts in total (want 2)`);
      check(igReq() === 1, `${at} the second Instagram tap fetched embed.js again (${igReq()} fetches)`);

      // The X post, by keyboard.
      await page.locator('figure[data-tap="x"] button.embed-load').first().focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelectorAll('iframe.stub-x').length > 0, null, { timeout: 5000 }).catch(() => {});
      const xr = await page.evaluate(() => document.querySelectorAll('iframe.stub-x').length);
      const xReq = social.filter(u => /platform\.twitter\.com\/widgets\.js/.test(u)).length;
      check(xr === 1 && xReq === 1, `${at} the X tap rendered ${xr} posts with ${xReq} script fetches (want 1/1)`);

      // Every tapped post fits: inside its figure, inside the viewport, and the
      // figure never needs a sideways scroll (at 320 the real Instagram iframe
      // ran to x=346 and cut off "View profile").
      const fit = await page.evaluate(() => [...document.querySelectorAll('figure[data-tap] iframe')].map(f => {
        const r = f.getBoundingClientRect(), fig = f.closest('figure'), fr = fig.getBoundingClientRect();
        return { cls: f.className.split(' ')[0], left: Math.round(r.left), right: Math.round(r.right), figRight: Math.round(fr.right), vw: window.innerWidth, figOver: fig.scrollWidth - fig.clientWidth };
      }));
      check(fit.length === 3, `${at} control: 3 tapped posts should be measured (got ${fit.length})`);
      check(fit.every(f => f.right <= f.figRight && f.right <= f.vw && f.left >= 0), `${at} a tapped post runs past its column or the screen: ${JSON.stringify(fit)}`);
      check(fit.every(f => f.figOver <= 0), `${at} a tapped post only fits by scrolling its box sideways: ${JSON.stringify(fit)}`);
      const overAfter = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overAfter <= 0, `${at} the tapped posts widen the page by ${overAfter}px`);
      await ctx.close();
    }
  } finally { await browser.close(); }
} finally { server.kill(); }

if (failures.length) { for (const f of failures) console.error(`  ✗ ${f}`); console.error(`  ✗ embeds tap-to-load: ${failures.length}/${n} checks failed`); process.exit(1); }
console.log(`  ✓ embeds tap-to-load: ${n} checks (no Instagram/X request before a tap; one tap loads one post)`);
