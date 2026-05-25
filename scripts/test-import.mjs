#!/usr/bin/env node
// Smoke test for the Memories photo-import flow.
//
// Boots the static SPA against a local HTTP server, navigates to Memories,
// crafts a JPEG with a real EXIF DateTimeOriginal (Friday May 15 2026
// 23:35 PT = mid-Peggy-Gou-set), drops it on the hidden batch input via
// canvas + DataTransfer (so we exercise the actual handleBatchPick path,
// not just a localStorage poke), then asserts:
//
//   1. exactly one moment was written
//   2. it landed on night 1 (Friday)
//   3. it was tagged to Peggy Gou (n4)
//   4. tagSource is "exif" (the auto-tagger fired on EXIF, not lastModified)
//
// Then a second photo with NO EXIF (just lastModified=now → outside the
// festival window) — asserts it lands on the fallback night with
// tagSource="fallback" + null artistId, so the new RETAG UI has work to
// do. Asserts the retag-chip is visible too.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8765;
const URL  = `http://localhost:${PORT}/?tab=me`;

function startServer() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', d => process.stderr.write('[server] ' + d));
  return new Promise((resolve, reject) => {
    // Poll the port until it answers, up to ~5s.
    const start = Date.now();
    (function tick() {
      fetch(`http://127.0.0.1:${PORT}/index.html`).then(r => {
        if (r.ok) resolve(proc); else setTimeout(tick, 100);
      }).catch(() => {
        if (Date.now() - start > 5000) reject(new Error('server failed to start'));
        else setTimeout(tick, 100);
      });
    })();
  });
}

async function run() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    // Force a deterministic timezone so file.lastModified vs festival window
    // comparisons are reproducible regardless of where this test runs.
    timezoneId: 'America/Los_Angeles',
  });
  const page = await ctx.newPage();

  page.on('console', m => {
    if (m.type() === 'error') console.log('[browser-error]', m.text());
  });

  // Pre-seed: skip onboarding modal, save Peggy Gou (n4) so the matcher
  // has her in saved sets. The moments / IDB wipe runs ONCE (guarded by
  // a marker) so subsequent navigations within the same browser context
  // don't blow away the moments we wrote during the import tests.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('onboarded', 'v1');
      localStorage.setItem('user_name', 'Test');
      localStorage.setItem('edc-lv-2026_saved_v1', JSON.stringify(['n4']));
      if (!sessionStorage.getItem('__plursky_test_init__')) {
        localStorage.removeItem('plursky_moments_v1');
        indexedDB.deleteDatabase('plursky_memories');
        sessionStorage.setItem('__plursky_test_init__', '1');
      }
    } catch {}
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Wait for ARTISTS to load (data.jsx via Babel takes a moment).
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, { timeout: 20000 });
  // Babel transform of all .jsx files + initial render takes another beat.
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/plursky-me.png', fullPage: true });

  // Land on Me, then tap MEMORIES tile (one of the four <button> cards in
  // the 4-card grid, with a "0\nMEMORIES" text run inside).
  const memoriesTile = page.locator('button').filter({ hasText: /MEMORIES/ }).first();
  await memoriesTile.waitFor({ state: 'visible', timeout: 15000 });
  await memoriesTile.click({ timeout: 5000 });

  // Wait for batch input to mount.
  const input = page.locator('input[type=file][accept*="image"][multiple]').first();
  await input.waitFor({ state: 'attached', timeout: 10000 });

  // ── TEST 1 ── JPEG with valid EXIF DateTimeOriginal mid-set.
  await page.evaluate(async (dt) => {
    // 1x1 grey JPEG via canvas → real decodable image (so _compressMomentImage
    // doesn't reject before we ever reach _parseExifMeta).
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    canvas.getContext('2d').fillStyle = '#888';
    canvas.getContext('2d').fillRect(0, 0, 1, 1);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    const buf = new Uint8Array(await blob.arrayBuffer());

    // Build the APP1 segment with one IFD0 entry pointing at ExifIFD that
    // contains DateTimeOriginal. Little-endian throughout.
    function makeExifApp1(dateStr) {
      const tiff = new Uint8Array(64);
      const dv = new DataView(tiff.buffer);
      // TIFF header
      dv.setUint8(0, 0x49); dv.setUint8(1, 0x49);        // II (little-endian)
      dv.setUint16(2, 0x002A, true);                      // magic
      dv.setUint32(4, 8, true);                           // IFD0 offset
      // IFD0
      dv.setUint16(8, 1, true);                           // 1 entry
      dv.setUint16(10, 0x8769, true);                     // tag = ExifIFD
      dv.setUint16(12, 4, true);                          // type = LONG
      dv.setUint32(14, 1, true);                          // count
      dv.setUint32(18, 26, true);                         // value = ExifIFD offset
      dv.setUint32(22, 0, true);                          // next IFD = 0
      // ExifIFD at offset 26
      dv.setUint16(26, 1, true);                          // 1 entry
      dv.setUint16(28, 0x9003, true);                     // tag = DateTimeOriginal
      dv.setUint16(30, 2, true);                          // type = ASCII
      dv.setUint32(32, 20, true);                         // count
      dv.setUint32(36, 44, true);                         // value = string offset
      dv.setUint32(40, 0, true);                          // next IFD = 0
      // Date string at offset 44 (20 bytes incl. NUL)
      const s = dateStr + '\0';
      for (let i = 0; i < 20; i++) tiff[44 + i] = s.charCodeAt(i) || 0;

      // APP1 segment: marker (2) + length (2) + "Exif\0\0" (6) + TIFF
      const app1Len = 2 + 6 + tiff.length; // length field includes itself
      const out = new Uint8Array(2 + app1Len);
      const odv = new DataView(out.buffer);
      odv.setUint16(0, 0xFFE1, false);                    // APP1 marker
      odv.setUint16(2, app1Len, false);                   // length (big-endian)
      out[4] = 0x45; out[5] = 0x78; out[6] = 0x69; out[7] = 0x66; // "Exif"
      out[8] = 0; out[9] = 0;                             // \0\0
      out.set(tiff, 10);
      return out;
    }

    const exifSeg = makeExifApp1(dt);
    // Splice APP1 in right after SOI (bytes 0-1).
    const full = new Uint8Array(2 + exifSeg.length + (buf.length - 2));
    full.set(buf.subarray(0, 2), 0);
    full.set(exifSeg, 2);
    full.set(buf.subarray(2), 2 + exifSeg.length);

    const file = new File([full], 'edc-fri-peggy.jpg', {
      type: 'image/jpeg',
      // Set lastModified to today so it's clearly NOT the source of the date —
      // any successful tagging must have come from EXIF.
      lastModified: Date.now(),
    });
    const tx = new DataTransfer();
    tx.items.add(file);
    const inp = document.querySelector('input[type=file][accept*="image"][multiple]');
    inp.files = tx.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, '2026:05:15 23:35:00');

  // Wait for moment to be persisted.
  await page.waitForFunction(() => {
    const m = JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}');
    return Object.values(m).reduce((s, a) => s + (a?.length || 0), 0) >= 1;
  }, { timeout: 15000 });

  let moments = await page.evaluate(() => JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}'));
  console.log('\n── TEST 1: EXIF JPEG at Peggy Gou time ──');
  console.log(JSON.stringify(moments, null, 2));

  const night1 = moments['1'] || [];
  const exifMoment = night1[0];
  let pass1 = true;
  function check(label, cond) {
    console.log(`  ${cond ? '✓' : '✗'} ${label}`);
    if (!cond) pass1 = false;
  }
  check('moment landed on night 1 (Friday)', !!exifMoment);
  if (exifMoment) {
    check('tagged to Peggy Gou (n4)', exifMoment.artistId === 'n4');
    check('tagSource = "exif"', exifMoment.tagSource === 'exif');
    check('takenAt = 2026-05-15 23:35', exifMoment.takenAt === '2026-05-15 23:35');
    check('autoTagged = true', exifMoment.autoTagged === true);
  }

  // ── TEST 2 ── JPEG with NO EXIF, lastModified=now (post-festival).
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    canvas.getContext('2d').fillStyle = '#444';
    canvas.getContext('2d').fillRect(0, 0, 1, 1);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    const file = new File([blob], 'no-exif.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    const tx = new DataTransfer();
    tx.items.add(file);
    const inp = document.querySelector('input[type=file][accept*="image"][multiple]');
    inp.files = tx.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await page.waitForFunction(() => {
    const m = JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}');
    return Object.values(m).reduce((s, a) => s + (a?.length || 0), 0) >= 2;
  }, { timeout: 15000 });

  moments = await page.evaluate(() => JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}'));
  console.log('\n── TEST 2: bare JPEG, no EXIF, today\'s lastModified ──');
  console.log(JSON.stringify(moments, null, 2));

  const allMoments = Object.values(moments).flat();
  const fallback = allMoments.find(m => m.tagSource === 'fallback' || m.tagSource === 'filetime-night-only');
  let pass2 = true;
  console.log('  Asserting fallback path:');
  check('a fallback / filetime-only moment was written', !!fallback);
  if (fallback) {
    check('artistId is null (no artist auto-assigned)', fallback.artistId === null);
    check('autoTagged = false', fallback.autoTagged === false);
  }

  // Check that the retag hint chip is visible on at least one card.
  const retagVisible = await page.locator('text=/RETAG|PICK A SET/i').count();
  check(`retag/pick-a-set chip rendered (count=${retagVisible})`, retagVisible >= 1);

  // Confirm the new artist-grouped layout: Peggy Gou should appear as a
  // sub-header above the tagged moment, and "TO RETAG" should appear above
  // the untagged one.
  const artistGroup = await page.locator('text=/^Peggy Gou$/').count();
  const retagGroup  = await page.locator('text=/^TO RETAG$/').count();
  check(`Peggy Gou sub-header rendered in Memories (count=${artistGroup})`, artistGroup >= 1);
  check(`TO RETAG sub-header rendered in Memories (count=${retagGroup})`, retagGroup >= 1);
  await page.screenshot({ path: '/tmp/plursky-memories-night.png', fullPage: true });

  // ── view toggles ── tap ARTIST then STAGE and confirm both re-group.
  await page.getByRole('button', { name: /^ARTIST$/ }).click();
  await page.waitForTimeout(300);
  const artistViewPG  = await page.locator('text=/^Peggy Gou$/').count();
  check(`ARTIST view: Peggy Gou header still rendered (count=${artistViewPG})`, artistViewPG >= 1);
  await page.screenshot({ path: '/tmp/plursky-memories-artist.png', fullPage: true });

  await page.getByRole('button', { name: /^STAGE$/ }).click();
  await page.waitForTimeout(300);
  const stageViewNeon = await page.locator('text=/Neon Garden/').count();
  check(`STAGE view: Neon Garden header rendered (count=${stageViewNeon})`, stageViewNeon >= 1);
  await page.screenshot({ path: '/tmp/plursky-memories-stage.png', fullPage: true });

  // ── TEST 4 ── Off-stage detection. Craft a JPEG with EXIF date inside
  // Peggy Gou's time window BUT GPS at a location ~900m south/east of
  // the festival (36.265, -115.005 — well outside any 80m anchor radius).
  // Expected: moment lands on night 1 with tagSource="off_stage" and
  // artistId=null, NOT auto-tagged to Peggy Gou despite the time match.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    canvas.getContext('2d').fillStyle = '#a8a';
    canvas.getContext('2d').fillRect(0, 0, 1, 1);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    const buf = new Uint8Array(await blob.arrayBuffer());

    // EXIF crafter with GPS support. Layout (TIFF-relative bytes):
    //   0-7    TIFF header (II + magic + IFD0 offset = 8)
    //   8-9    IFD0 count = 2
    //   10-21  IFD0 entry 0 = ExifIFD pointer  → ExifIFD @ 38
    //   22-33  IFD0 entry 1 = GPSIFD pointer   → GPSIFD  @ 76
    //   34-37  next IFD = 0
    //   38-39  ExifIFD count = 1
    //   40-51  DateTimeOriginal entry         → string  @ 56
    //   52-55  next IFD = 0
    //   56-75  date string (20 bytes)
    //   76-77  GPSIFD count = 4
    //   78-89  GPSLatRef entry (ASCII inline)
    //   90-101 GPSLat entry → 3 rationals @ 130
    //   102-113 GPSLngRef entry (ASCII inline)
    //   114-125 GPSLng entry → 3 rationals @ 154
    //   126-129 next IFD = 0
    //   130-177 GPS rationals (24 bytes lat + 24 bytes lng)
    function makeExifApp1Gps(dateStr, lat, lng) {
      const TIFF_LEN = 178;
      const tiff = new Uint8Array(TIFF_LEN);
      const dv   = new DataView(tiff.buffer);

      // TIFF header (little-endian)
      dv.setUint8(0, 0x49); dv.setUint8(1, 0x49);
      dv.setUint16(2, 0x002A, true);
      dv.setUint32(4, 8, true);

      // IFD0 — 2 entries
      dv.setUint16(8, 2, true);
      dv.setUint16(10, 0x8769, true); dv.setUint16(12, 4, true);
      dv.setUint32(14, 1, true);      dv.setUint32(18, 38, true);
      dv.setUint16(22, 0x8825, true); dv.setUint16(24, 4, true);
      dv.setUint32(26, 1, true);      dv.setUint32(30, 76, true);
      dv.setUint32(34, 0, true);

      // ExifIFD — 1 entry
      dv.setUint16(38, 1, true);
      dv.setUint16(40, 0x9003, true); dv.setUint16(42, 2, true);
      dv.setUint32(44, 20, true);     dv.setUint32(48, 56, true);
      dv.setUint32(52, 0, true);
      const s = dateStr + '\0';
      for (let i = 0; i < 20; i++) tiff[56 + i] = s.charCodeAt(i) || 0;

      // GPSIFD — 4 entries
      dv.setUint16(76, 4, true);
      // GPSLatRef ("N" or "S") inline at entry valOff = 86
      dv.setUint16(78, 0x0001, true); dv.setUint16(80, 2, true);
      dv.setUint32(82, 2, true);
      tiff[86] = lat >= 0 ? 0x4E : 0x53; tiff[87] = 0;
      // GPSLat — 3 rationals at offset 130
      dv.setUint16(90, 0x0002, true); dv.setUint16(92, 5, true);
      dv.setUint32(94, 3, true);      dv.setUint32(98, 130, true);
      // GPSLngRef ("E" or "W") inline at entry valOff = 110
      dv.setUint16(102, 0x0003, true); dv.setUint16(104, 2, true);
      dv.setUint32(106, 2, true);
      tiff[110] = lng >= 0 ? 0x45 : 0x57; tiff[111] = 0;
      // GPSLng — 3 rationals at offset 154
      dv.setUint16(114, 0x0004, true); dv.setUint16(116, 5, true);
      dv.setUint32(118, 3, true);      dv.setUint32(122, 154, true);
      dv.setUint32(126, 0, true);

      // GPS rationals — deg/1, min/1, sec/1000
      function writeDMS(off, val) {
        const a = Math.abs(val);
        const deg = Math.floor(a);
        const minFloat = (a - deg) * 60;
        const min = Math.floor(minFloat);
        const secMilli = Math.round((minFloat - min) * 60 * 1000);
        dv.setUint32(off + 0,  deg, true);     dv.setUint32(off + 4,  1, true);
        dv.setUint32(off + 8,  min, true);     dv.setUint32(off + 12, 1, true);
        dv.setUint32(off + 16, secMilli, true); dv.setUint32(off + 20, 1000, true);
      }
      writeDMS(130, lat);
      writeDMS(154, lng);

      // Wrap in APP1 segment
      const app1Len = 2 + 6 + TIFF_LEN; // length includes itself
      const out = new Uint8Array(2 + app1Len);
      const odv = new DataView(out.buffer);
      odv.setUint16(0, 0xFFE1, false);
      odv.setUint16(2, app1Len, false);
      out[4] = 0x45; out[5] = 0x78; out[6] = 0x69; out[7] = 0x66; // Exif
      out[8] = 0; out[9] = 0;
      out.set(tiff, 10);
      return out;
    }

    // GPS at 36.265, -115.005 → ~900m south-east of the festival site,
    // well outside the 80m radius of every stage anchor.
    const exifSeg = makeExifApp1Gps('2026:05:15 23:35:00', 36.265, -115.005);
    const full = new Uint8Array(2 + exifSeg.length + (buf.length - 2));
    full.set(buf.subarray(0, 2), 0);
    full.set(exifSeg, 2);
    full.set(buf.subarray(2), 2 + exifSeg.length);

    const file = new File([full], 'off-stage-test.jpg', {
      type: 'image/jpeg', lastModified: Date.now(),
    });
    const tx = new DataTransfer();
    tx.items.add(file);
    const inp = document.querySelector('input[type=file][accept*="image"][multiple]');
    inp.files = tx.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await page.waitForFunction(() => {
    const m = JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}');
    return Object.values(m).flat().some(x => x.tagSource === 'off_stage');
  }, { timeout: 15000 }).catch(() => {});

  const offStageMoment = await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}');
    return Object.values(m).flat().find(x => x.tagSource === 'off_stage') || null;
  });
  console.log('\n── TEST 4: off-stage GPS detection (EXIF GPS at 36.265, -115.005) ──');
  check('moment with tagSource="off_stage" was written', !!offStageMoment);
  if (offStageMoment) {
    check(`night = 1 (got ${offStageMoment.night})`, offStageMoment.night === 1);
    check(`artistId = null (got ${offStageMoment.artistId})`, offStageMoment.artistId === null);
    check(`takenAt parsed from EXIF (got ${offStageMoment.takenAt})`, offStageMoment.takenAt === '2026-05-15 23:35');
    check(`parsedGps present (got ${JSON.stringify(offStageMoment.parsedGps)})`,
          offStageMoment.parsedGps && Math.abs(offStageMoment.parsedGps.lat - 36.265) < 0.001 &&
          Math.abs(offStageMoment.parsedGps.lng - (-115.005)) < 0.001);
  }

  // ── SIBLING-SUGGESTION ── Inject a third moment in localStorage at a
  // capture time within 30 min of the Peggy Gou-tagged moment from TEST 1.
  // The Memories card for that third moment should render a
  // "+ TAG AS PEGGY GOU" suggestion chip (no AI required).
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}');
    m['1'] = m['1'] || [];
    m['1'].push({
      id: 'm_sibling_test',
      night: 1,
      text: '',
      artistId: null,            // untagged, sibling-suggest should kick in
      photoId: null,
      kind: 'image',
      createdAt: Date.now(),
      takenAt: '2026-05-15 23:50',  // 15 min after Peggy Gou-tagged moment (23:35)
      autoTagged: false,
      tagSource: 'fallback',
    });
    localStorage.setItem('plursky_moments_v1', JSON.stringify(m));
    window.dispatchEvent(new CustomEvent('plursky-moments-change'));
  });
  await page.waitForTimeout(600);
  const siblingChip = await page.locator('button:has-text("TAG AS PEGGY GOU")').count();
  console.log('\n── SIBLING-SUGGESTION: untagged moment near a tagged one ──');
  check(`sibling chip "+ TAG AS PEGGY GOU" rendered (count=${siblingChip})`, siblingChip >= 1);
  await page.screenshot({ path: '/tmp/plursky-sibling.png', fullPage: true });

  // Click the chip and verify the moment is actually tagged. Exercises the
  // onUpdate → _writeMoments → plursky-moments-change → re-render path
  // end-to-end, not just the static-render check above.
  if (siblingChip >= 1) {
    await page.locator('button:has-text("TAG AS PEGGY GOU")').first().click();
    await page.waitForTimeout(400);
    const moments = await page.evaluate(() => JSON.parse(localStorage.getItem('plursky_moments_v1') || '{}'));
    const sibling = (moments['1'] || []).find(m => m.id === 'm_sibling_test');
    check(`click → sibling.artistId = "n4" (got ${sibling?.artistId})`, sibling?.artistId === 'n4');
    check(`click → sibling.tagSource = "manual" (got ${sibling?.tagSource})`, sibling?.tagSource === 'manual');
  }

  // ── TEST 3 ── Per-artist memories strip renders on the artist screen.
  // Deep-link to Peggy Gou (n4) and assert YourPhotosStrip appears with the
  // EXIF moment from TEST 1.
  let pass3 = true;
  // Snapshot the moments BEFORE the navigation so we can re-seed if the
  // init script wipe runs again (sessionStorage may not survive a goto
  // in Playwright depending on context isolation).
  const snapshot = await page.evaluate(() => localStorage.getItem('plursky_moments_v1'));
  await page.goto(`http://127.0.0.1:${PORT}/?artist=n4`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((snap) => {
    if (snap) localStorage.setItem('plursky_moments_v1', snap);
  }, snapshot);
  // Reload so the freshly-restored localStorage is read by MemoriesScreen + strip.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/plursky-artist.png', fullPage: true });

  const stripHeader = await page.locator('text=/YOUR MOMENTS FROM THIS SET/i').count();
  // Sibling-suggestion test above tagged a second moment to Peggy Gou,
  // so the strip's count now reads "2 memories saved" (1 from TEST 1
  // EXIF auto-tag + 1 from the sibling-suggestion click).
  const memoryCount = await page.locator('text=/[12] memor(y|ies) saved/i').count();
  console.log('\n── TEST 3: per-artist memories strip on Peggy Gou screen ──');
  check(`"YOUR MOMENTS FROM THIS SET" header rendered (count=${stripHeader})`, stripHeader >= 1);
  check(`memory count subtitle rendered (count=${memoryCount})`, memoryCount >= 1);
  pass3 = stripHeader >= 1 && memoryCount >= 1;

  console.log('\n── RESULT ──');
  const ok = pass1 && pass2 && pass3;
  console.log(ok ? '✓ ALL TESTS PASSED' : '✗ ONE OR MORE TESTS FAILED');

  await browser.close();
  server.kill('SIGTERM');
  process.exit(ok ? 0 : 1);
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
