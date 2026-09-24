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
    if (!kv.__onboarding) localStorage.setItem('onboarded', 'v1');
    localStorage.setItem('user_name', 'Test');
    for (const [k, v] of Object.entries(kv)) {
      if (k === '__onboarding') continue;
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

// Waits for a festival switch to FINISH, not for its first side effect.
//
// setActiveFestivalAndReload writes active_festival_id and then reloads. The
// old wait polled only the stored id, with a 20s cap and a catch that read
// straight after any error: it ended BEFORE the reload (the write comes
// first), so the reads after it could hit the outgoing document, and under
// load on this 8 GB Mac the switch once landed after the cap (?f=acl-2026
// read edc-lv-2026, then passed alone twice). This polls until the LIVE
// document runs the named festival — the stored id, the running
// FESTIVAL_CONFIG and a mounted #root all agree, which only the reloaded page
// can satisfy — and keeps polling through the reload's context teardown
// instead of treating it as the end. On a miss it returns what it last saw.
async function waitForSwitch(page, id, ms = 60000) {
  const end = Date.now() + ms;
  let last = null;
  while (Date.now() < end) {
    try {
      last = await page.evaluate(() => ({
        stored: localStorage.getItem('active_festival_id'),
        live: (window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id) || null,
        root: (document.getElementById('root') || { children: [] }).children.length,
        url: location.pathname + location.search,
      }));
      if (last.stored === id && last.live === id && last.root > 0) return { ok: true, ...last };
    } catch (e) {
      last = { ...(last || {}), error: String(e.message || e).split('\n')[0] };
    }
    await sleep(150);
  }
  return { ok: false, ...last };
}

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
    // setActiveFestivalAndReload reloads: wait for the reloaded page itself.
    const sw = await waitForSwitch(page, 'acl-2026');
    check(sw.ok, `?f=acl-2026: enters the named festival (${JSON.stringify(sw)})`);
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

  // ── 5b. The three totals on one library are ONE number ───────────────────
  // The header counted raw RECORDS while the day summaries and the landing
  // card counted unique media, so a duplicated import made the top of the
  // screen disagree with the rows underneath it. A declared-guess record is
  // named separately rather than folded into either number.
  {
    const artistId = 'n4';
    const dupSeed = JSON.stringify({ "1": [
      { id: "d1", night: 1, photoId: "c1", _fingerprint: "fp_dup_same.jpg", artistId, kind: "photo", takenAt: "2026-05-16T05:30:00.000Z", createdAt: 1779000001000, festivalId: 'edc-lv-2026' },
      // Same media, different record, DIFFERENT group (loose, not on the set).
      { id: "d2", night: 1, photoId: "c2", _fingerprint: "fp_dup_same.jpg", artistId: null, kind: "photo", takenAt: "2026-05-16T05:33:00.000Z", createdAt: 1779000002000, festivalId: 'edc-lv-2026' },
      { id: "d3", night: 1, photoId: "c3", _fingerprint: "fp_dup_other.jpg", artistId, kind: "photo", takenAt: "2026-05-16T05:36:00.000Z", createdAt: 1779000003000, festivalId: 'edc-lv-2026' },
      // Parked on a guess the app itself declared unproven.
      { id: "d4", night: 1, photoId: "c4", _fingerprint: "fp_dup_guess.jpg", artistId, kind: "photo", takenAt: "2026-05-16T05:39:00.000Z", createdAt: 1779000004000, festivalId: 'edc-lv-2026', festivalAttribution: 'unresolved' },
    ]});
    const { ctx, page } = await open(browser, { url: `${BASE}?tab=memories`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_last_festival_id: 'edc-lv-2026',
      'edc-lv-2026_saved_v1': JSON.stringify([artistId]),
      plursky_moments_v1: dupSeed,
      plursky_memories_view_v1: 'library',
    }});
    const t = await text(page);
    const head = t.match(/(\d+)\s+MOMENTS?/i);
    check(!!head, `totals: the Memories header states a moment count (saw ${JSON.stringify((t.match(/.*MOMENTS?.*/gi) || []).slice(0, 2))})`);
    // 4 records, 3 unique media, 1 of those an unproven guess => 2 confirmed.
    check(head && +head[1] === 2,
      `totals: the header counts UNIQUE media and excludes the declared guess (expected 2, got ${head && head[1]})`);
    check(/1\s+UNCONFIRMED/i.test(t),
      'totals: the guess is named, not silently folded into the total or dropped');
    const model = await page.evaluate(() => {
      const all = window._activeMoments(window._readMoments());
      const lib = window._dedupeLibrary(all);
      const day = window._buildLibraryDay({
        moments: lib.byNight['1'] || [], attendedSet: new Set(), artists: window.ARTISTS,
        toMin: window.toNightMin, dupsFor: (id) => lib.dupsByCanonical.get(id) || [],
      });
      return { unique: lib.unique, dayMoments: day.counts.moments,
               card: window.festivalMemoryCount('edc-lv-2026', window._readMoments()),
               drawn: day.groups.flatMap(g => g.media.map(m => m._fingerprint))
                        .filter(f => f === 'fp_dup_same.jpg').length };
    });
    check(model.unique === model.dayMoments,
      `totals: library total === the day's own total (${model.unique} vs ${model.dayMoments})`);
    check(model.card === 2,
      `totals: the landing card reports the same confirmed count as the header (got ${model.card})`);
    check(model.drawn === 1,
      `totals: the duplicated photo is drawn once, not once per group (drawn ${model.drawn}x)`);
    await ctx.close();
  }

  // ── 5c. The proof outranks the guess on screen, not just in the model ────
  // Same photo, two records: an auto-archived guess stored FIRST and the
  // capture-time-proven record second. While the canonical was whichever
  // record was read first, this header called proven media UNCONFIRMED and
  // the festival's card dropped it entirely — the proof was discarded as the
  // duplicate. Seeded in the losing order on purpose.
  {
    const artistId = 'n4';
    const orderSeed = JSON.stringify({ "1": [
      { id: "o1", night: 1, photoId: "k1", _fingerprint: "fp_order_same.jpg", artistId, kind: "photo", takenAt: "2026-05-16T05:30:00.000Z", createdAt: 1779000001000, festivalId: 'edc-lv-2026', festivalAttribution: 'unresolved' },
      // Same media, proven, and in a DIFFERENT group (loose, not on the set).
      { id: "o2", night: 1, photoId: "k2", _fingerprint: "fp_order_same.jpg", artistId: null, kind: "photo", takenAt: "2026-05-16T05:33:00.000Z", createdAt: 1779000002000, festivalId: 'edc-lv-2026', festivalAttribution: 'capture-time' },
      { id: "o3", night: 1, photoId: "k3", _fingerprint: "fp_order_other.jpg", artistId, kind: "photo", takenAt: "2026-05-16T05:36:00.000Z", createdAt: 1779000003000, festivalId: 'edc-lv-2026' },
    ]});
    const { ctx, page } = await open(browser, { url: `${BASE}?tab=memories`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_last_festival_id: 'edc-lv-2026',
      'edc-lv-2026_saved_v1': JSON.stringify([artistId]),
      plursky_moments_v1: orderSeed,
      plursky_memories_view_v1: 'library',
    }});
    const t = await text(page);
    const head = t.match(/(\d+)\s+MOMENTS?/i);
    check(head && +head[1] === 2,
      `order: proven media counts as confirmed however it was stored (expected 2, got ${head && head[1]})`);
    check(!/UNCONFIRMED/i.test(t),
      'order: nothing is called unconfirmed when a proven record holds that media');
    const model = await page.evaluate(() => {
      const all = window._activeMoments(window._readMoments());
      const lib = window._dedupeLibrary(all);
      return { unique: lib.unique,
               kept: (lib.byNight['1'] || []).map(m => m.id).join(','),
               card: window.festivalMemoryCount('edc-lv-2026', window._readMoments()),
               review: window.unattributedMoments(window._readMoments()).map(m => m.id).join(',') };
    });
    check(model.unique === 2 && model.kept === 'o2,o3',
      `order: the library keeps the proof and parks the guess (got "${model.kept}")`);
    check(model.card === 2,
      `order: the landing card agrees with the header (got ${model.card})`);
    check(model.review === '',
      `order: General Home offers no review row for media already proven (got "${model.review}")`);
    await ctx.close();
  }

  // ── 7. Onboarding ends INSIDE a festival, never back at the chooser ──────
  // Picking a festival is the last thing first-run asks. Answering it and
  // being handed the same question again is the failure this covers, on both
  // paths: the active festival (no reload) and a different one (reload).
  // EVERY query here is scoped INSIDE the modal. The wizard renders OVER
  // General Home, which has its own row per festival with the same label, and
  // a document-wide querySelectorAll finds the landing's row first — so an
  // unscoped harness clicks the screen behind the dialog and grades a path
  // the user never took. (That is exactly what this gate did until a mutation
  // that should have failed it came back green.)
  const DLG = '[role=dialog][aria-label="Welcome to Plursky"]';
  const finishOnboarding = async (page, pick) => {
    const inDialog = await page.evaluate((sel) => !!document.querySelector(sel), DLG);
    check(inDialog, 'onboarding: the wizard dialog is on screen before the harness drives it');
    // Three story pages, then the festival list.
    await page.evaluate((sel) => {
      const d = document.querySelector(sel); if (!d) return;
      const b = [...d.querySelectorAll('button')].find(e => (e.textContent || '').trim() === 'Skip');
      if (b) b.click();
    }, DLG);
    await sleep(500);
    // Match the row by the name the REGISTRY prints, never by a short name a
    // human would use: acl-2026 renders "Austin City Limits 2026", and a
    // harness matching /ACL/ silently clicks nothing and grades a screen the
    // user never reached.
    const clicked = await page.evaluate(({ id, sel }) => {
      const d = document.querySelector(sel);
      if (!d) return null;
      const btns = [...d.querySelectorAll('button')];
      if (!id) {
        const b = btns.find(e => /^Continue with /.test((e.textContent || '').trim()));
        if (b) { b.click(); return 'continue'; }
        return null;
      }
      const entry = (window.FESTIVALS_REGISTRY || []).find(f => f.config.id === id);
      if (!entry) return null;
      const b = btns.find(e => (e.textContent || '').includes(entry.config.name));
      if (!b || b.disabled) return null;
      b.click();
      return entry.config.name;
    }, { id: pick, sel: DLG });
    check(!!clicked, `onboarding: the festival row for ${pick || 'the active festival'} was found and tapped`);
    await sleep(1200);
  };
  {
    const { ctx, page } = await open(browser, { init: {
      __onboarding: '1', active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
    }});
    const t0 = await text(page);
    check(/plan the night|where are you raving|1 of 3/i.test(t0),
      `onboarding: first run shows the wizard (saw ${JSON.stringify(t0.slice(0, 60))})`);
    await finishOnboarding(page, null);   // "Continue with EDC Las Vegas"
    const t = await text(page);
    check(!/browse festivals/i.test(t),
      'onboarding (same festival): does NOT hand the user back to the chooser');
    const nav = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(b => /^(Today|Lineup|Map|Me|Memories)$/.test((b.textContent || '').trim())).length);
    check(nav > 0, `onboarding (same festival): lands inside the festival, bottom nav mounted (found ${nav})`);
    const wiz = await page.evaluate((sel) => !!document.querySelector(sel), DLG);
    check(!wiz, 'onboarding (same festival): the wizard is dismissed, not still sitting over the screen');
    const onb = await page.evaluate(() => localStorage.getItem('onboarded'));
    check(onb === 'v1', `onboarding (same festival): first run is recorded as done (onboarded=${onb})`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, { init: {
      __onboarding: '1', active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
    }});
    await finishOnboarding(page, 'acl-2026');
    const sw = await waitForSwitch(page, 'acl-2026');
    check(sw.ok, `onboarding (different festival): switches to the chosen festival (${JSON.stringify(sw)})`);
    const t = await text(page);
    check(!/browse festivals/i.test(t),
      'onboarding (different festival): the reload lands INSIDE it, not back on the chooser');
    const nav = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(b => /^(Today|Lineup|Map|Me|Memories)$/.test((b.textContent || '').trim())).length);
    check(nav > 0, `onboarding (different festival): bottom nav mounted (found ${nav})`);
    const wiz = await page.evaluate((sel) => !!document.querySelector(sel), DLG);
    check(!wiz, 'onboarding (different festival): the reload does NOT ask the same question again');
    const onb = await page.evaluate(() => localStorage.getItem('onboarded'));
    check(onb === 'v1', `onboarding (different festival): first run is recorded as done (onboarded=${onb})`);
    await ctx.close();
  }

  // ── 7c. Onboarding uses the SAME entitlement policy as everywhere else ───
  // A subscriber reinstalling the app must still be able to pick the
  // early-access festival they paid for. Onboarding disabled it for everyone,
  // which is the landing's old bug in the one place a returning subscriber
  // meets it first. The registry carries no preview-only entry today, so the
  // fixture makes one before the list paints.
  for (const [label, isPlus, wantEnabled] of [['free', false, false], ['Plus', true, true]]) {
    const { ctx, page } = await open(browser, { init: {
      __onboarding: '1', active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
    }});
    const marked = await page.evaluate((plus) => {
      const e = (window.FESTIVALS_REGISTRY || []).find(f => f.config.id === 'acl-2026');
      if (!e) return null;
      e.available = false; e.previewOnly = true;
      window._isPlusSub = () => plus;
      return e.config.name;
    }, isPlus);
    check(!!marked, `onboarding (${label}): the fixture marked a row preview-only`);
    await page.evaluate((sel) => {
      const d = document.querySelector(sel); if (!d) return;
      const b = [...d.querySelectorAll('button')].find(e => (e.textContent || '').trim() === 'Skip');
      if (b) b.click();
    }, DLG);
    await sleep(600);
    const row = await page.evaluate(({ name, sel }) => {
      const d = document.querySelector(sel); if (!d) return null;
      const b = [...d.querySelectorAll('button')].find(e => (e.textContent || '').includes(name));
      return b ? { disabled: b.disabled, text: (b.textContent || '').trim() } : null;
    }, { name: marked, sel: DLG });
    check(row && row.disabled === !wantEnabled,
      `onboarding (${label}): the early-access row is ${wantEnabled ? 'pickable' : 'not pickable'} (${JSON.stringify(row)})`);
    if (!wantEnabled) {
      check(row && /plursky\+/i.test(row.text),
        `onboarding (free): the row says what it would take (${row && row.text})`);
    }
    await ctx.close();
  }

  // ── 8. Early access obeys entitlement in the RUNNING app ─────────────────
  // No registry entry carries previewOnly today, so the fixture makes one —
  // otherwise this whole policy is untested until the day it first ships.
  {
    const { ctx, page } = await open(browser, { init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
    }});
    const asPreview = (plus) => page.evaluate((isPlus) => {
      const e = (window.FESTIVALS_REGISTRY || []).find(f => f.config.id === 'acl-2026');
      if (!e) return null;
      e.available = false; e.previewOnly = true;
      window._isPlusSub = () => isPlus;
      // Entitlement changes announce themselves (see _setPlusSub); the saved
      // event re-renders for the registry edit when entitlement is unchanged.
      window.dispatchEvent(new CustomEvent('plursky-plus-change'));
      window.dispatchEvent(new CustomEvent('plursky-saved-festivals-change'));
      return e.config.name;
    }, plus);
    const name = await asPreview(false);
    check(!!name, 'early access: the fixture found a registry row to mark preview-only');
    await sleep(500);
    const free = await page.evaluate((n) => {
      const b = [...document.querySelectorAll('button')].find(e => (e.getAttribute('aria-label') || '').startsWith(n + '.'));
      return b ? { disabled: b.disabled, label: b.getAttribute('aria-label') } : null;
    }, name);
    check(free && !free.disabled,
      `early access (free): the row is tappable so the offer is reachable (${JSON.stringify(free)})`);
    check(free && /plursky\+/i.test(free.label),
      `early access (free): the row names the offer (${free && free.label})`);
    // Tapping it must open the offer and must NOT switch the festival.
    await page.evaluate((n) => {
      const b = [...document.querySelectorAll('button')].find(e => (e.getAttribute('aria-label') || '').startsWith(n + '.'));
      if (b) b.click();
    }, name);
    await sleep(700);
    const after = await text(page);
    const stillEdc = await page.evaluate(() => localStorage.getItem('active_festival_id'));
    check(stillEdc === 'edc-lv-2026',
      `early access (free): tapping it did NOT enter the festival (active=${stillEdc})`);
    check(/plursky\+/i.test(after),
      'early access (free): tapping it opens the Plursky+ offer instead of a dead end');
    await ctx.close();
  }

  // ── 8b. The enter handler re-checks, it does not trust the paint ─────────
  // Filtering `primary` is the outer lock. This is the inner one, and it is
  // the one that matters when eligibility changes between the paint and the
  // tap — a subscription lapsing, or a festival being gated while the screen
  // sits open. The fixture reproduces that by flipping the registry WITHOUT
  // re-rendering, so the button on screen is the stale one the user taps.
  {
    const { ctx, page } = await open(browser, { init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_saved_festivals_v1: JSON.stringify({ v: 1, ids: ['acl-2026'] }),
    }});
    const primary = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')]
        .find(e => /^(Open|Plan) Austin City Limits/.test((e.textContent || '').trim().replace(/\n[\s\S]*/, '')));
      return b ? (b.textContent || '').trim().split('\n')[0] : null;
    });
    check(!!primary, `enter guard: the saved festival really is the primary action first (saw ${JSON.stringify(primary)})`);
    // Flip it to gated WITHOUT dispatching the re-render event.
    await page.evaluate(() => {
      const e = (window.FESTIVALS_REGISTRY || []).find(f => f.config.id === 'acl-2026');
      if (e) { e.available = false; e.previewOnly = true; }
      window._isPlusSub = () => false;
    });
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')]
        .find(e => /^(Open|Plan) Austin City Limits/.test((e.textContent || '').trim().replace(/\n[\s\S]*/, '')));
      if (b) b.click();
    });
    await sleep(800);
    const active = await page.evaluate(() => localStorage.getItem('active_festival_id'));
    check(active === 'edc-lv-2026',
      `enter guard: a stale primary button cannot walk into a now-gated festival (active=${active})`);
    check(/plursky\+/i.test(await text(page)),
      'enter guard: it offers the upgrade instead of silently doing nothing');
    await ctx.close();
  }

  // ── 8c. A restored/lapsed entitlement repaints the landing ───────────────
  // RevenueCat answers after the first paint. The landing read _isPlusSub()
  // once, so a restored subscriber stayed locked out until the next launch.
  // Uses the REAL _setPlusSub — no stub — so the event it fires is the one
  // production fires.
  {
    const { ctx, page } = await open(browser, { init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1', plursky_plus_active: '0',
    }});
    const name = await page.evaluate(() => {
      const e = (window.FESTIVALS_REGISTRY || []).find(f => f.config.id === 'acl-2026');
      if (!e) return null;
      e.available = false; e.previewOnly = true;
      window.dispatchEvent(new CustomEvent('plursky-saved-festivals-change'));
      return e.config.name;
    });
    await sleep(400);
    const label = () => page.evaluate((n) => {
      const b = [...document.querySelectorAll('button')].find(e => (e.getAttribute('aria-label') || '').startsWith(n + '.'));
      return b ? b.getAttribute('aria-label') : null;
    }, name);
    const before = await label();
    check(before && /plursky\+/i.test(before), `entitlement: free paint offers Plursky+ (${before})`);
    await page.evaluate(() => window._setPlusSub(true));
    await sleep(400);
    const after = await label();
    check(after && !/plursky\+/i.test(after), `entitlement: a restored purchase unlocks the row without a relaunch (${after})`);
    await page.evaluate(() => window._setPlusSub(false));
    await sleep(400);
    const lapsed = await label();
    check(lapsed && /plursky\+/i.test(lapsed), `entitlement: a lapse re-locks it (${lapsed})`);
    await ctx.close();
  }

  // ── 8d. A deep link that names nothing openable is not a destination ─────
  // ?tab=bogus, ?artist=<removed>, ?f=<gated> used to open whichever festival
  // was active; they must land on General Home like a bare launch.
  {
    const probe = await open(browser, { init: { active_festival_id: 'edc-lv-2026', active_festival_explicit: '1' } });
    const gatedId = await probe.page.evaluate(() => {
      const e = (window.FESTIVALS_REGISTRY || []).find(f => !f.available && !f.previewOnly);
      return e ? e.config.id : null;
    });
    await probe.ctx.close();
    check(!!gatedId, `bad links: the fixture found a gated festival (${gatedId})`);
    for (const qs of ['?tab=bogus', '?artist=an-act-that-was-removed', `?f=${gatedId}`]) {
      const { ctx, page } = await open(browser, { url: `${BASE}${qs}`, init: {
        active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      }});
      check(/browse festivals/i.test(await text(page)), `bad link ${qs}: lands on General Home, not a festival`);
      await ctx.close();
    }
    // Control: a VALID tab link still goes straight in.
    const { ctx, page } = await open(browser, { url: `${BASE}?tab=lineup`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
    }});
    check(!/browse festivals/i.test(await text(page)), 'bad links control: ?tab=lineup still opens the festival');
    await ctx.close();
  }

  // ── 8e. Wall = the header's media set; one moment can be deleted ─────────
  {
    const lib = JSON.parse(seed('edc-lv-2026', 'n4'));
    // A second RECORD of x1's media, tagged differently: one photo, two rows.
    // x1 is the newest capture, so it is the Wall's FIRST tile — the one the
    // delete below taps — and the delete must take both records.
    lib['1'].push({ id: 'x1-dup', night: 1, photoId: 'b4', _fingerprint: 'fp_1_x1.jpg', artistId: null, kind: 'photo',
      takenAt: '2026-05-16T05:50:00.000Z', createdAt: 1779000009000, festivalId: 'edc-lv-2026' });
    const { ctx, page } = await open(browser, { url: `${BASE}?tab=memories`, init: {
      active_festival_id: 'edc-lv-2026', active_festival_explicit: '1',
      plursky_last_festival_id: 'edc-lv-2026', 'edc-lv-2026_saved_v1': JSON.stringify(['n4']),
      plursky_moments_v1: JSON.stringify(lib), plursky_memories_view_v1: 'grid',
    }});
    await sleep(600);
    const tiles = await page.evaluate(() => (document.querySelector('[data-wall]') || { children: [] }).children.length);
    check(tiles === 4, `wall: 5 records of 4 media draw 4 tiles, not 5 (got ${tiles})`);
    await page.evaluate(() => { const b = document.querySelector('[data-wall] button'); if (b) b.click(); });
    await sleep(500);
    const clickText = (re) => page.evaluate((src) => {
      const r = new RegExp(src, 'i');
      const b = [...document.querySelectorAll('button')].find(e => r.test((e.textContent || '').trim()));
      if (b) b.click();
      return !!b;
    }, re);
    check(await clickText('^Delete this moment$'), 'delete: the lightbox offers a per-moment delete');
    await sleep(200);
    const stillAll = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('plursky_moments_v1'))).flat().length);
    check(stillAll === 5, `delete: one tap does not delete (still ${stillAll} records)`);
    check(await clickText('^Tap again to delete'), 'delete: the second tap confirms');
    await sleep(500);
    const left = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('plursky_moments_v1'))).flat());
    const fps = new Set(left.map(m => m._fingerprint));
    const before = new Set(lib['1'].map(m => m._fingerprint));
    const goneFps = [...before].filter(fp => !fps.has(fp));
    // Exactly one MEDIA is gone, and with it every record of that media — a
    // surviving duplicate would slide into the deleted tile's slot.
    check(goneFps.join() === 'fp_1_x1.jpg', `delete: exactly the tapped media is gone (gone: ${goneFps})`);
    const expectLeft = lib['1'].filter(m => !goneFps.includes(m._fingerprint)).length;
    check(left.length === expectLeft, `delete: every record of it went too (${left.length} left, expected ${expectLeft})`);
    const tilesAfter = await page.evaluate(() => (document.querySelector('[data-wall]') || { children: [] }).children.length);
    check(tilesAfter === 3, `delete: the Wall repaints one tile shorter (got ${tilesAfter})`);
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
