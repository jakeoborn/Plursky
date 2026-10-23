#!/usr/bin/env node
// Artists directory gate (artist repository, M5). In Dark and Light at 393
// and 320: the directory opens at ?tab=artists, every name renders in full (no
// clipping, no sideways scroll), the list is WINDOWED (a few dozen rows in
// the DOM out of ~2,500), the scrubber jumps to a letter, search finds an
// artist and a project's members, Playing 2026 narrows the list, the sheet
// lists exactly the registry's billings, a key under review says it may be
// more than one act, a name billed only through a project reads "Also plays
// as" and is never Playing 2026 on the project's billing, the festival chip
// scopes and widens it, Me carries the one entry (an "Artists" row that opens
// the directory with Me lit, and back returns to Me) while Lineup carries none,
// and the slice is never precached. No network beyond
// the local server (the script CDNs come from scripts/vendor/).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
import { wireVendor } from './lib/vendor-cdn.mjs';

const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const DIR = JSON.parse(readFileSync('data/artists/directory.json', 'utf8'));
const AT = '2026-10-06T17:00:00Z';
const WIDE = process.env.AD_FONT || null;

// Static: the slice is shipped but never precached.
const sw = readFileSync('sw.js', 'utf8');
check(!/artists\/directory\.json/.test(sw), 'sw.js precaches the directory slice (it loads on demand)');
check(/'data\/artists\/directory\.json'/.test(readFileSync('scripts/build.mjs', 'utf8')), 'the build does not ship data/artists/directory.json');
check(DIR.artists.length >= 2400, `control: directory has ${DIR.artists.length} artists`);

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) {
    const tag = `${scheme} ${width}`;
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
    try {
      if (WIDE) await ctx.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `*{font-family:${f} !important}`; document.head.appendChild(st); }); }, WIDE);
      await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${PORT}/`), r => r.abort());
      await wireVendor(ctx);   // React, ReactDOM, supabase-js from scripts/vendor/, never the live CDN (newest route wins)
      await ctx.clock.install({ time: new Date(AT) });
      await ctx.addInitScript(({ scheme }) => {
        localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', 'acl-2026'); localStorage.setItem('active_festival_explicit', '1');
        localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
        localStorage.setItem('plursky_display_name', '');   // quick-name ask already skipped: Me opens unobstructed
      }, { scheme });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html?f=acl-2026&tab=artists`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('[data-artist-row]'), null, { timeout: 30000 });
      await page.clock.runFor(400); await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-artist-row]')];
        const cut = rows.filter(b => { const n = b.querySelector('.duo-name'); return n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > b.getBoundingClientRect().right - 32; }).map(b => b.dataset.artistRow);
        return { rows: rows.length, cut, count: document.querySelector('[data-artists-count]')?.textContent.trim(),
          title: document.querySelector('h1')?.textContent.trim(), letters: [...document.querySelectorAll('[data-artists-scrubber] button')].map(b => b.textContent),
          overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(r.title === 'Artists', `${tag}: directory title is "${r.title}"`);
      check(r.count === `${DIR.artists.filter(a => a.b.length || a.p).length.toLocaleString('en-US')} artists`, `${tag}: count reads "${r.count}"`);
      check(r.rows > 5 && r.rows < 80, `${tag}: ${r.rows} rows in the DOM (want a window, not the whole list)`);
      check(!r.cut.length, `${tag}: names cut: ${r.cut.slice(0, 5)}`);
      check(r.letters.length >= 20 && r.letters.includes('A') && r.letters.includes('Z'), `${tag}: scrubber letters ${r.letters.join('')}`);
      check(!r.overflowX, `${tag}: the directory scrolls sideways`);
      // The scrubber jumps to a letter.
      await page.click('[data-artists-scrubber] button[aria-label="Artists starting with S"]'); await page.clock.runFor(200); await page.waitForTimeout(200);
      const s = await page.evaluate(() => { const sc = document.querySelector('[data-artists-scroll]'), r0 = sc.getBoundingClientRect(); const h = [...document.querySelectorAll('[data-dir-letter]')].find(e => { const b = e.getBoundingClientRect(); return b.bottom > r0.top + 1 && b.top < r0.bottom; }); return h ? h.dataset.dirLetter : null; });
      check(s === 'S', `${tag}: the S button shows section ${s}`);
      // The longest names are whole when they scroll in: search them one at a time.
      for (const a of [...DIR.artists].sort((x, y) => y.n.length - x.n.length).slice(0, 3)) {
        await page.fill('input[aria-label="Search artists"]', a.n); await page.clock.runFor(200); await page.waitForTimeout(150);
        const c = await page.evaluate(k => { const b = document.querySelector(`[data-artist-row="${CSS.escape(k)}"]`); if (!b) return 'missing'; const n = b.querySelector('.duo-name'); return n.scrollWidth > n.clientWidth + 1 ? 'cut' : n.textContent; }, a.k);
        check(c === a.n, `${tag}: "${a.n}" renders as ${JSON.stringify(c)}`);
      }
      // Search reaches a project's members: "Boys Noize" finds DOG BLOOD with its members line.
      await page.fill('input[aria-label="Search artists"]', 'boys noize'); await page.clock.runFor(200); await page.waitForTimeout(150);
      const dog = await page.evaluate(() => document.querySelector('[data-artist-row="dog-blood"]')?.innerText.replace(/\s+/g, ' ') || null);
      check(dog && /Boys Noize · Skrillex/.test(dog), `${tag}: "boys noize" does not find DOG BLOOD with its members: ${dog}`);
      // The sheet lists exactly the registry's billings for an artist.
      const want = DIR.artists.find(a => a.k === 'cloonee');
      const DIRF = DIR.festivals.map(f => f.brand);
      await page.fill('input[aria-label="Search artists"]', 'Cloonee'); await page.clock.runFor(200); await page.waitForTimeout(150);
      await page.click('[data-artist-row="cloonee"]'); await page.clock.runFor(300); await page.waitForTimeout(200);
      const sh = await page.evaluate(() => ({ n: document.querySelectorAll('[data-artist-sheet] [data-artist-billing]').length, title: document.querySelector('[role=dialog]')?.getAttribute('aria-label') }));
      check(sh.title === 'Cloonee' && sh.n === want.b.length, `${tag}: Cloonee's sheet lists ${sh.n} billings, registry has ${want.b.length}`);
      // Festivals count brands, not editions: EDC LV 2025 and 2026 are one.
      const cl = await page.evaluate(() => document.querySelector('[data-artist-row="cloonee"]')?.innerText || '');
      const brands = new Set(want.b.map(b => DIRF[b[0]]));
      check(new RegExp(`^${brands.size} festivals`, 'm').test(cl), `${tag}: Cloonee reads "${cl.replace(/\s+/g, ' ')}", want ${brands.size} festivals`);
      await page.keyboard.press('Escape'); await page.clock.runFor(200);
      // A key under review never reads as one career.
      await page.fill('input[aria-label="Search artists"]', 'klo'); await page.clock.runFor(200); await page.waitForTimeout(150);
      const klo = await page.evaluate(() => document.querySelector('[data-artist-row="klo"]')?.innerText || '');
      check(/may be more than one act/.test(klo), `${tag}: klo (pending) reads "${klo.replace(/\s+/g, ' ')}"`);
      await page.click('[data-artist-row="klo"]'); await page.clock.runFor(300); await page.waitForTimeout(150);
      check(await page.evaluate(() => !!document.querySelector('[data-artist-sheet-pending]')), `${tag}: klo's sheet has no "may be more than one act" note`);
      await page.keyboard.press('Escape'); await page.clock.runFor(200);
      // Playing 2026 narrows to artists with a set still to come.
      await page.fill('input[aria-label="Search artists"]', ''); await page.click('[data-artists-playing]'); await page.clock.runFor(300); await page.waitForTimeout(150);
      const today = AT.slice(0, 10);
      // A billing's next date: its own, or an ACL "both" act's second weekend (b[8]).
      const upcoming = b => (b[1] && b[1] >= today ? b[1] : b[8] && b[8] >= today ? b[8] : null);
      const wantPlaying = DIR.artists.filter(a => a.b.some(b => { const d = upcoming(b); return d && d.startsWith(today.slice(0, 4)); })).length;
      const both = DIR.artists.filter(a => a.b.some(b => b[8]) && !a.b.some(b => b[1] && b[1] >= today)).length;
      check(both >= 30, `control: ${both} artists play only ACL's second weekend from here (want the W1+W2 "both" acts)`);
      const pc = await page.evaluate(() => document.querySelector('[data-artists-count]')?.textContent.trim());
      check(wantPlaying > 100 && pc === `${wantPlaying.toLocaleString('en-US')} artists`, `${tag}: Playing 2026 reads "${pc}", want ${wantPlaying}`);
      // ACL bills Charli xcx once for both weekends: W1 (Oct 2) has passed,
      // W2 (Oct 9) has not, so she is Playing 2026 with "next: …, Oct 9".
      await page.fill('input[aria-label="Search artists"]', 'charli xcx'); await page.clock.runFor(200); await page.waitForTimeout(150);
      const cx = await page.evaluate(() => document.querySelector('[data-artist-row="charli-xcx"]')?.innerText.replace(/\s+/g, ' ').trim() || null);
      check(cx && /next: .*Oct 9/.test(cx), `${tag}: Playing 2026 + Charli xcx reads ${JSON.stringify(cx)} (want her ACL W2 date, Oct 9)`);
      // Parents-only records (a name billed only through a project) are listed
      // with "Also plays as", and are never Playing 2026 on the project's
      // billing: Bryan Kearney plays 2026 only as Key4050.
      const bk = DIR.artists.find(a => a.k === 'bryan-kearney');
      check(bk && !bk.b.length && bk.p?.includes('Key4050'), `control: bryan-kearney is parents-only in the registry: ${JSON.stringify(bk)}`);
      await page.fill('input[aria-label="Search artists"]', 'kearney'); await page.clock.runFor(200); await page.waitForTimeout(150);
      const pk = await page.evaluate(() => [...document.querySelectorAll('[data-artist-row]')].map(b => b.dataset.artistRow));
      check(pk.includes('key4050') && !pk.includes('bryan-kearney'), `${tag}: Playing 2026 + "kearney" lists ${JSON.stringify(pk)} (want Key4050, not Bryan Kearney)`);
      await page.click('[data-artists-playing]'); await page.clock.runFor(200); await page.waitForTimeout(150);
      const bkRow = await page.evaluate(() => document.querySelector('[data-artist-row="bryan-kearney"]')?.innerText.replace(/\s+/g, ' ').trim() || null);
      check(bkRow && /Also plays as Key4050/.test(bkRow) && !/2026|next:/.test(bkRow), `${tag}: Bryan Kearney reads ${JSON.stringify(bkRow)}`);
      const poAll = DIR.artists.filter(a => !a.b.length && a.p).length;
      check(poAll > 0, `control: ${poAll} parents-only records`);

      // The festival chip scopes the list to one festival and widens it again.
      const FI = DIR.festivals.findIndex(f => f.id === 'acl-2026');
      const wantAll = DIR.artists.filter(a => a.b.some(b => b[0] === FI)).length;
      await page.fill('input[aria-label="Search artists"]', ''); await page.selectOption('[data-artists-festival]', String(FI)); await page.clock.runFor(300); await page.waitForTimeout(150);
      const subs = await page.evaluate(() => document.querySelector('h1')?.parentElement?.innerText.replace(/\s+/g, ' ').trim());
      check(/At one festival/i.test(subs) && !/every festival/i.test(subs), `${tag}: the scoped header reads "${subs}" (want "At one festival"; the chip names it)`);
      const sc2 = await page.evaluate(() => document.querySelector('[data-artists-count]')?.textContent.trim());
      check(wantAll > 100 && wantAll < DIR.artists.length && sc2 === `${wantAll} artists`, `${tag}: the scoped directory reads "${sc2}", want ${wantAll} (ACL 2026 only)`);
      await page.selectOption('[data-artists-festival]', ''); await page.clock.runFor(300); await page.waitForTimeout(150);
      const sc3 = await page.evaluate(() => document.querySelector('[data-artists-count]')?.textContent.trim());
      check(sc3 === r.count, `${tag}: the Festival chip does not widen the scope: "${sc3}", want "${r.count}"`);
      // The directory is entered from Me (B6 spec section 5, settled
      // 2026-10-22), so Me stays lit on it.
      const lit = await page.evaluate(() => [...document.querySelectorAll('button[aria-current="page"]')].map(b => b.textContent.trim()).join('|'));
      check(lit === 'Me', `${tag}: the directory lights "${lit}" in the tab bar (want Me)`);
      // A sparse scrubber keeps its letters together at a fixed pitch instead of
      // spreading them over the full height beside unrelated rows, and a press
      // on the last letter still shows that letter's section.
      let sparse = null;
      for (const q of ['lorde', 'charli', 'four tet', 'skrillex', 'peggy', 'fred again', 'disclosure', 'kaytranada']) {
        await page.fill('input[aria-label="Search artists"]', q); await page.clock.runFor(300); await page.waitForTimeout(150);
        const sp = await page.evaluate(() => { const bs = [...document.querySelectorAll('[data-artists-scrubber] button')];
          const cs = bs.map(b => { const r = b.getBoundingClientRect(); return r.top + r.height / 2; });
          return { q: document.querySelector('input[aria-label="Search artists"]').value, letters: bs.map(b => b.textContent), maxGap: Math.max(...cs.slice(1).map((c, k) => c - cs[k])) }; });
        if (sp.letters.length >= 2 && sp.letters.length <= 5) { sparse = sp; break; }
      }
      check(!!sparse, `${tag}: control: no search gave a 2–5 letter scrubber`);
      if (sparse) {
        check(sparse.maxGap <= 24, `${tag}: "${sparse.q}" spreads ${sparse.letters.join('')} ${Math.round(sparse.maxGap)}px apart (want ≤ 24px)`);
        const last = sparse.letters[sparse.letters.length - 1];
        await page.click(`[data-artists-scrubber] button[aria-label^="Artists starting with ${last === '#' ? 'a number' : last}"]`); await page.clock.runFor(200); await page.waitForTimeout(200);
        const shown = await page.evaluate(() => { const sc = document.querySelector('[data-artists-scroll]'), top = sc.getBoundingClientRect().top;
          const h = [...document.querySelectorAll('[data-dir-letter]')].find(e => Math.abs(e.getBoundingClientRect().top - top) < 4) || [...document.querySelectorAll('[data-dir-letter]')].filter(e => e.getBoundingClientRect().top <= top + 4).pop();
          return h?.dataset.dirLetter || null; });
        // A short list may not scroll far enough to put the last section on top;
        // then it must at least be on screen.
        const visible = await page.evaluate(L => { const sc = document.querySelector('[data-artists-scroll]').getBoundingClientRect(); const h = document.querySelector(`[data-dir-letter="${L}"]`); if (!h) return false; const r = h.getBoundingClientRect(); return r.top >= sc.top - 1 && r.bottom <= sc.bottom + 1; }, last);
        check(shown === last || visible, `${tag}: pressing ${last} on the sparse scrubber shows ${shown}`);
      }
      // Drag on the full scrubber: the press point picks the nearest letter.
      await page.fill('input[aria-label="Search artists"]', ''); await page.clock.runFor(300); await page.waitForTimeout(150);
      const mBox = await page.evaluate(() => { const b = document.querySelector('[data-artists-scrubber] button[aria-label="Artists starting with M"]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      const scr = await page.locator('[data-artists-scrubber]').boundingBox();
      await page.mouse.move(scr.x + scr.width / 2, scr.y + 2); await page.mouse.down(); await page.mouse.move(mBox.x, mBox.y, { steps: 4 }); await page.mouse.up();
      await page.clock.runFor(200); await page.waitForTimeout(200);
      const dragged = await page.evaluate(() => { const sc = document.querySelector('[data-artists-scroll]'), top = sc.getBoundingClientRect().top;
        return [...document.querySelectorAll('[data-dir-letter]')].filter(e => e.getBoundingClientRect().top <= top + 4).pop()?.dataset.dirLetter || null; });
      check(dragged === 'M', `${tag}: a drag ending on M shows section ${dragged}`);
      for (const t of ['me', 'lineup']) {
        await page.goto(`http://127.0.0.1:${PORT}/index.html?f=acl-2026&tab=${t}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0, null, { timeout: 60000 });
        await page.clock.runFor(1500); await page.waitForTimeout(200);
        if (t === 'lineup') { await page.click('[data-lineup-search-toggle]'); await page.clock.runFor(300); await page.fill('input[aria-label="Search the lineup"]', 'charli'); await page.clock.runFor(300); await page.waitForTimeout(150); }
        const entry = await page.evaluate(() => !!document.querySelector('[data-artists-entry], [data-lineup-artists-entry]') || /Artist history/.test(document.body.innerText));
        if (t === 'lineup') { check(!entry, `${tag}: lineup carries a directory entry (the one entry is on Me)`); continue; }
        const row = await page.evaluate(() => { const b = document.querySelector('[data-artists-entry]'); if (!b) return null; const r = b.getBoundingClientRect();
          return { text: b.innerText.replace(/\s+/g, ' ').trim(), h: r.height, fits: r.left >= 0 && r.right <= innerWidth, cut: [...b.querySelectorAll('span')].some(s => s.scrollWidth > s.clientWidth + 1) }; });
        check(!!row && /^Artists Every festival$/.test(row.text), `${tag}: Me's directory row reads ${JSON.stringify(row?.text)} (want "Artists" / "Every festival")`);
        check(!!row && row.h >= 44 && row.fits && !row.cut, `${tag}: Me's directory row is ${row?.h}px tall, fits ${row?.fits}, cut ${row?.cut}`);
        if (!row) continue;
        await page.click('[data-artists-entry]'); await page.clock.runFor(400); await page.waitForTimeout(200);
        const opened = await page.evaluate(() => ({ title: document.querySelector('h1')?.textContent.trim(), lit: [...document.querySelectorAll('button[aria-current="page"]')].map(b => b.textContent.trim()).join('|') }));
        check(opened.title === 'Artists' && opened.lit === 'Me', `${tag}: the Me row opens ${JSON.stringify(opened)} (want the directory with Me lit)`);
        await page.click('button[aria-label="Back"]'); await page.clock.runFor(400); await page.waitForTimeout(200);
        const back = await page.evaluate(() => !!document.querySelector('[data-artists-entry]'));
        check(back, `${tag}: back from the directory does not return to Me`);
      }
    } catch (err) { check(false, `${tag} threw: ${String(err.message || err).split('\n')[0]}`); }
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }

if (problems.length) {
  console.log(`  ✗ artist directory: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  process.exit(1);
}
console.log(`  ✓ artist directory: ${checks} checks — opens at ?tab=artists and from Me's row, windowed, names in full, scrubber, search, sheet = registry, pending keys honest, never precached`);
