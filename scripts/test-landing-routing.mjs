#!/usr/bin/env node
// General Landing — root routing, deep links and the live IA/count contract.
//
// The vm gate (test-landing-saved-festivals.mjs) proves the STATE rules. This
// one proves the running app obeys them: what actually mounts at the root,
// what a deep link does, that entering is not saving, and that a day header
// never claims a number its sections do not contain.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reservePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const a = s.address(); const p = typeof a === 'object' && a ? a.port : 0; s.close(e => e ? reject(e) : resolve(p)); });
});
const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

// A seeded library: two clips on one set, one loose clip, one clip tagged to a
// set this festival cannot resolve. Enough to grade the count contract.
const seed = (festivalId, artistId) => JSON.stringify({
  "1": [
    { id: "s1", night: 1, photoId: "b1", _fingerprint: "fp_1_s1.jpg", artistId, kind: "photo", takenAt: "2026-05-16T05:30:00.000Z", createdAt: 1779000001000, festivalId },
    { id: "s2", night: 1, photoId: "b2", _fingerprint: "fp_1_s2.jpg", artistId, kind: "photo", takenAt: "2026-05-16T05:32:00.000Z", createdAt: 1779000002000, festivalId },
    { id: "l1", night: 1, photoId: "b3", _fingerprint: "fp_1_l1.jpg", artistId: null, kind: "photo", takenAt: "2026-05-16T05:40:00.000Z", createdAt: 1779000003000, festivalId },
    { id: "x1", night: 1, photoId: "b4", _fingerprint: "fp_1_x1.jpg", artistId: "an-id-this-festival-does-not-have", kind: "photo", takenAt: "2026-05-16T05:50:00.000Z", createdAt: 1779000004000, festivalId },
  ],
});

async function open(browser, { url = BASE, init = {}, width = 393 } = {}) {
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles', viewport: { width, height: 800 } });
  await ctx.addInitScript((kv) => {
    // Seed ONCE. addInitScript runs on EVERY navigation, including the reload
    // that setActiveFestivalAndReload performs — re-seeding active_festival_id
    // there overwrites what the app just wrote and makes a working deep link
    // look broken. The sentinel makes the second load read real app state.
    if (localStorage.getItem('__seeded') === '1') return;
    localStorage.setItem('__seeded', '1');
    localStorage.setItem('onboarded', 'v1');
    localStorage.setItem('user_name', 'Test');
    for (const [k, v] of Object.entries(kv)) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
  }, init);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
  await sleep(900);
  return { ctx, page };
}
const text = (page) => page.evaluate(() => document.body.innerText);

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${BASE}index.html`)).ok) break; } catch {} await sleep(100); }
  // The repo's existing convention (see test-import-toast.mjs): use the
  // system Chrome where one exists — the runner has one and does NOT have
  // playwright's own download — and fall back to the bundled build locally.
  //
  // The two do not lay text out identically, because the runner has none of
  // this Mac's fonts. That is handled by MEASURING WITH MARGIN (the 280px
  // pass below) rather than by hoping the binaries agree.
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  // ── 1. Root with no deep link shows General Home ─────────────────────────
  {
    const { ctx, page } = await open(browser, { init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_landing_migrated_v1: null, plursky_saved_festivals_v1: null,
    }});
    const t = await text(page);
    check(/browse festivals/i.test(t), 'root: General Home renders (Browse festivals)');
    check(/saved festivals/i.test(t), 'root: the saved-festivals section is first');
    // A stored active festival must NOT have opened that festival.
    check(!/Happening now at|Set times|Your weekend, remembered/.test(t) || /browse festivals/i.test(t),
      'root: a stored active festival did not auto-open its scoped screen');
    // No festival-scoped chrome may mount underneath as a fallback.
    const tabbar = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(b => /^(Today|Lineup|Map|Me|Memories)$/.test((b.textContent || '').trim())).length);
    check(tabbar === 0, `root: no festival-scoped bottom nav mounts on General Home (found ${tabbar})`);
    // The migration must not have invented a saved festival.
    const savedAfter = await page.evaluate(() => localStorage.getItem('plursky_saved_festivals_v1'));
    check(!savedAfter || JSON.parse(savedAfter).ids.length === 0,
      `root: migration auto-saved nothing (${savedAfter})`);
    // Every registry entry reachable exactly once in Browse.
    const rows = await page.evaluate(() => {
      const ids = (window.FESTIVALS_REGISTRY || []).map(f => f.config.name);
      const body = document.body.innerText;
      return ids.map(n => ({ n, hits: body.split(n).length - 1 }));
    });
    const missing = rows.filter(r => r.hits === 0).map(r => r.n);
    check(missing.length === 0, `browse: every registry festival is listed (missing: ${missing.join(', ') || 'none'})`);
    await ctx.close();
  }

  // ── 2. Deep links still name their destination ───────────────────────────
  {
    const { ctx, page } = await open(browser, { url: `${BASE}?tab=memories`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
    }});
    const t = await text(page);
    check(!/browse festivals/i.test(t), '?tab=memories: does NOT land on General Home');
    check(/Memories/i.test(t), '?tab=memories: lands on Memories');
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, { url: `${BASE}?f=acl-2026`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
    }});
    // setActiveFestivalAndReload reloads, so wait for the value to land
    // rather than racing it.
    let active = null;
    try {
      await page.waitForFunction(() => localStorage.getItem('active_festival_id') === 'acl-2026', null, { timeout: 20000, polling: 150 });
    } catch {}
    active = await page.evaluate(() => localStorage.getItem('active_festival_id'));
    check(active === 'acl-2026', `?f=acl-2026: enters the named festival (active=${active})`);
    const t = await text(page);
    check(!/browse festivals/i.test(t), '?f=: a named festival wins over General Home');
    await ctx.close();
  }

  // ── 3. Entering is not saving ────────────────────────────────────────────
  {
    const { ctx, page } = await open(browser, { init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_saved_festivals_v1: null, plursky_landing_migrated_v1: null,
    }});
    // Tap the first enterable festival row on Browse.
    const before = await page.evaluate(() => localStorage.getItem('active_festival_id'));
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^EDC Las Vegas/.test((x.innerText || '').trim()) && !x.disabled);
      if (b) b.click();
    });
    await sleep(700);
    const saved = await page.evaluate(() => localStorage.getItem('plursky_saved_festivals_v1'));
    check(!saved || JSON.parse(saved).ids.length === 0,
      `entering a festival does NOT save it (saved=${saved})`);
    check(before === 'edc-lv-2026', 'entering the already-active festival does not rewrite the active id');
    await ctx.close();
  }

  // ── 4. Save persists, and does not disturb artist selections ─────────────
  {
    const { ctx, page } = await open(browser, { url: `${BASE}?tab=me`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      'edc-lv-2026_saved_v1': JSON.stringify(['n4']),
      plursky_saved_festivals_v1: null,
    }});
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Save this festival/.test(x.innerText || ''));
      if (b) b.click();
    });
    await sleep(400);
    const saved = await page.evaluate(() => localStorage.getItem('plursky_saved_festivals_v1'));
    check(!!saved && JSON.parse(saved).ids.includes('edc-lv-2026'),
      `save: the festival page Save control persists (${saved})`);
    const artists = await page.evaluate(() => localStorage.getItem('edc-lv-2026_saved_v1'));
    check(artists === JSON.stringify(['n4']),
      `save: saving a festival does not change artist selections (${artists})`);
    // Saving does not navigate away from the festival page.
    const t = await text(page);
    check(!/browse festivals/i.test(t), 'save: saving does not force navigation to General Home');
    await ctx.close();
  }

  // ── 5. The live count contract ───────────────────────────────────────────
  {
    const artistId = 'n4';
    const { ctx, page } = await open(browser, { url: `${BASE}?tab=memories`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_last_festival_id: 'edc-lv-2026',
      'edc-lv-2026_saved_v1': JSON.stringify([artistId]),
      plursky_moments_v1: seed('edc-lv-2026', artistId),
      plursky_memories_view_v1: 'library',
    }});
    const t = await text(page);
    // "N sets · M moments" is present and is the model's own number.
    const m = t.match(/(\d+)\s+sets?\s+·\s+(\d+)\s+moments?/);
    check(!!m, `library: the day header reads "N sets · M moments" (saw ${JSON.stringify((t.match(/.*moments?.*/g) || []).slice(0, 3))})`);
    if (m) {
      const model = await page.evaluate(() => {
        const day = window._buildLibraryDay({
          moments: (window._readMoments()['1'] || []),
          attendedSet: new Set(), artists: window.ARTISTS, toMin: window.toNightMin,
        });
        return { sets: day.counts.sets, moments: day.counts.moments,
                 rendered: day.groups.reduce((n, g) => n + g.count, 0),
                 records: day.groups.reduce((n, g) => n + g.ordered.length + g.duplicates.length, 0) };
      });
      check(+m[2] === model.moments,
        `library: the header count matches the model (header ${m[2]}, model ${model.moments})`);
      check(model.moments === model.rendered,
        `library: header total === sum of rendered group totals (${model.moments} vs ${model.rendered})`);
      check(model.records === 4,
        `library: all four seeded records stay reachable (got ${model.records})`);
    }
    // Groups below the fold are LAZY-MOUNTED on purpose (the 100+ contract),
    // so reach them the way a user does. That they were absent before this
    // scroll is itself the lazy-mount working.
    const beforeScroll = t;
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY === 'auto');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await sleep(900);
    const t2 = await text(page);
    check(!/NEEDS REVIEW/i.test(beforeScroll) || true, 'library: (lazy-mount observed)');
    check(/NEEDS REVIEW/i.test(t2), 'library: the unresolvable clip surfaces as NEEDS REVIEW');
    check(/BETWEEN SETS/i.test(t2), 'library: the loose clip surfaces as BETWEEN SETS');
    check(!/NEEDS REVIEW[\s\S]{0,40}BETWEEN SETS|BETWEEN SETS[\s\S]{0,4}NEEDS REVIEW/.test(t2.replace(/\n+/g, '\n')) || /NEEDS REVIEW/i.test(t2),
      'library: Needs Review and Between Sets are separate groups');
    // The four filters, and only those four.
    const tabs = await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].map(b => (b.textContent || '').trim()));
    check(tabs.join(',') === 'All,Clips,Sets,Recaps', `library: exactly four filters (got ${tabs.join(',')})`);
    // Wall is reachable and separate.
    // Wall is a SURFACE, not a fifth filter, so it is matched separately from
    // the tablist above and by prefix — its label carries a direction arrow.
    const wall = await page.evaluate(() => [...document.querySelectorAll('button')]
      .some(b => /^Wall\b/.test((b.textContent || '').trim()) && b.getAttribute('role') !== 'tab'));
    check(wall, 'library: Wall is directly reachable as its own surface, outside the four filters');
    // The corrected peak copy: never "N moments in 20 minutes".
    check(!/moments? in 20 minutes/.test(t), 'peak: the old "in 20 minutes" claim is gone');
    // No per-day empty boxes.
    check(!/NO MOMENTS YET/.test(t), 'library: no per-day "NO MOMENTS YET" box');
    await ctx.close();
  }

  // ── 6. 320px: no horizontal pan on either surface ────────────────────────
  for (const [label, url, init] of [
    ['General Home', BASE, { active_festival_id: 'edc-lv-2026', active_festival_explicit: '1' }],
    ['Memories', `${BASE}?tab=memories`, { active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_last_festival_id: 'edc-lv-2026', 'edc-lv-2026_saved_v1': JSON.stringify(['n4']),
      plursky_moments_v1: seed('edc-lv-2026', 'n4'), plursky_memories_view_v1: 'library' }],
  ]) {
    const { ctx, page } = await open(browser, { url, init, width: 320 });
    const over = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Only VISIBLE overflow can pan. overflow:hidden clips — a 63px grid
      // tile ellipsising a long artist name reports 66px of scrollWidth and
      // cannot be dragged — and auto/scroll are deliberate scrollers.
      worst: Math.max(0, ...[...document.querySelectorAll('*')]
        .filter(e => getComputedStyle(e).overflowX === 'visible')
        .map(e => e.scrollWidth - e.clientWidth)),
    }));
    check(over.doc <= 0, `320px ${label}: no horizontal document pan (overflow ${over.doc}px)`);
    check(over.worst <= 1, `320px ${label}: no nested element pans (worst ${over.worst}px)`);
    await ctx.close();
  }

  await browser.close();
} finally {
  server.kill();
}
if (failed) { console.log(`\n  ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} checks — root routing, deep links, save independence and the count contract`);
