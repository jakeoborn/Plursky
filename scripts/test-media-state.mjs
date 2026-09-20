#!/usr/bin/env node
// Memories v2 — the media state machine, end to end in the running app.
//
// THE BUG THIS EXISTS FOR: useMomentPhoto held `url = null` forever when the
// local IndexedDB lookup AND the cloud restore both came back empty. Every
// thumbnail reads "no url yet" as "still loading", so a photo this device
// will never have shimmered as a grey skeleton until the user gave up. There
// was no state that meant "this is not coming".
//
// Three runs, one per outcome, each asserting the designed TERMINAL state
// renders and that no skeleton survives:
//
//   1. no local blob, no cloud path        -> unavailable   ("Missing")
//   2. no local blob, cloud call REJECTS   -> offline       ("Offline")
//      — and this is decided by the REJECTION, not navigator.onLine, so the
//        run stays nominally online to prove the two are not equated.
//   3. no local blob, cloud answers "no"   -> unavailable   ("Missing")
//      — an answered "I don't have it" is genuinely gone, not retryable.
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

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

// One moment, real shape, pointing at a photoId that has no blob anywhere.
const SEED = {
  "1": [{
    id: "ghost-1", night: 1, photoId: "blob-that-does-not-exist",
    _fingerprint: "fp_1_ghost.jpg", artistId: null, kind: "photo",
    takenAt: "2026-05-16T05:30:00.000Z", createdAt: 1779000000000,
    festivalId: "edc-lv-2026",
  }],
};

async function run(browser, label, cloudScript, expectLabel, expectWord) {
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  await ctx.addInitScript((seed) => {
    localStorage.setItem('onboarded', 'v1');
    localStorage.setItem('user_name', 'Test');
    localStorage.setItem('active_festival_id', 'edc-lv-2026');
    localStorage.setItem('active_festival_explicit', '1');
    localStorage.setItem('plursky_moments_v1', seed);
    localStorage.setItem('plursky_last_festival_id', 'edc-lv-2026');
    localStorage.setItem('plursky_memories_view_v1', 'library');
    indexedDB.deleteDatabase('plursky_memories');
  }, JSON.stringify(SEED));
  const page = await ctx.newPage();
  // Land on ME first, install the stub, THEN navigate in-page to Memories.
  //
  // Why not stub in an init script: supabase.jsx declares
  // `function sbDownloadMomentMedia` at top level, which is a global binding.
  // Pre-defining a NON-CONFIGURABLE property of that name makes the whole
  // file fail to instantiate with "Identifier ... has already been declared",
  // so the run would be grading an app with supabase.js missing. Assigning
  // after load is the honest override — a function declaration's global
  // property is writable — and an in-page navigation mounts the media hooks
  // fresh against it, where a full page load would re-run supabase.jsx and
  // put the real implementation back.
  await page.goto(`http://127.0.0.1:${PORT}/?tab=me`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
  // Positive control: prove supabase.jsx actually INSTANTIATED before we
  // override one of its functions. The previous stub silently broke that file,
  // which would have made every run take the "no cloud path" branch and the
  // "cloud rejects" case pass for entirely the wrong reason.
  const sbLive = await page.evaluate(() => typeof window.sbPresenceJoin === 'function' && typeof window.sbOnAuthChange === 'function');
  check(sbLive, `${label}: supabase.jsx loaded (harness control — the override must not break the app)`);
  await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    window.sbDownloadMomentMedia = eval(src);
  }, cloudScript);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(e => (e.textContent || '').trim() === 'Memories');
    if (b) b.click();
  });
  await sleep(1500);

  // The designed terminal state, read off the accessible label so this grades
  // what a screen reader is told, not an internal flag.
  let got = null;
  try {
    await page.waitForFunction((needle) => [...document.querySelectorAll('[role=img]')]
      .some(e => (e.getAttribute('aria-label') || '').includes(needle)), expectLabel, { timeout: 20000, polling: 150 });
    got = true;
  } catch { got = false; }
  const labels = await page.evaluate(() => [...document.querySelectorAll('[role=img]')].map(e => e.getAttribute('aria-label')));
  check(got, `${label}: media reaches the designed "${expectLabel}" state (saw ${JSON.stringify(labels)})`);

  const word = await page.evaluate((w) => document.body.innerText.includes(w), expectWord);
  check(word, `${label}: the tile says "${expectWord}" in words, not just a colour`);

  // And nothing is left shimmering. A .skel that survives the settle IS the
  // permanent-skeleton bug.
  const skels = await page.evaluate(() => document.querySelectorAll('.skel').length);
  check(skels === 0, `${label}: no permanent skeleton remains (found ${skels})`);

  // navigator.onLine stays true in every run, so an "offline" verdict can
  // only have come from the request outcome.
  const online = await page.evaluate(() => navigator.onLine);
  check(online === true, `${label}: the page is nominally ONLINE, so the state came from the request, not navigator.onLine`);

  // The offline case is the only retryable one, so it — and only it — must
  // offer the explicit retry the spec asks for. An `unavailable` is a settled
  // answer and must NOT invite the user to keep asking.
  const banner = await page.evaluate(() => {
    const t = document.body.innerText;
    return { copy: /unavailable offline · retry when connected/i.test(t),
             btn: [...document.querySelectorAll('button')].some(b => (b.textContent || '').trim() === 'Retry') };
  });
  if (expectWord === 'Offline') {
    check(banner.copy, `${label}: says "unavailable offline · retry when connected"`);
    check(banner.btn, `${label}: offers an explicit Retry`);
  } else {
    check(!banner.btn, `${label}: a settled "unavailable" does NOT offer a retry`);
  }

  await ctx.close();
}

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch {} await sleep(100); }
  // channel:'chrome' — the bundled Chromium cannot decode iPhone HEVC and the
  // rest of this suite standardised on the real browser for media work.
  // The repo's existing convention (see test-import-toast.mjs): use the
  // system Chrome where one exists — the runner has one and does NOT have
  // playwright's own download — and fall back to the bundled build locally.
  //
  // The two do not lay text out identically, because the runner has none of
  // this Mac's fonts. That is handled by MEASURING WITH MARGIN (the 280px
  // pass below) rather than by hoping the binaries agree.
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  await run(browser, 'no cloud path',
    '(null)',
    'media unavailable', 'Missing');

  await run(browser, 'cloud REJECTS',
    '(() => Promise.reject(new Error("network")))',
    'unavailable offline, retry when connected', 'Offline');

  await run(browser, 'cloud answers no',
    '(() => Promise.resolve(null))',
    'media unavailable', 'Missing');

  await browser.close();
} finally {
  server.kill();
}
if (failed) { console.log(`\n  ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} checks — every failed lookup reaches a designed terminal state`);
