#!/usr/bin/env node
// Quick name: a local name before any sign-in, and proof it is what the crew
// sees.
//   · a fresh install that opens Me is asked "What should Plursky call you?"
//     (never in onboarding), and the answer lands in plursky_display_name
//   · crew presence (Go live), the picks a crew join shares, and the crew
//     recaps (Share our weekend, Showdown) all carry that name, signed out
//   · skipping is remembered: no ask on reload, none on a crew join
//   · a name already set means no ask at all
//   · a first crew join asks when the ask is still due
//   · Apple sign-in (native path, stubbed plugin + stubbed Supabase) keeps a
//     typed name and fills Apple's first name only when no name is set; the
//     account row says "name stays yours" when they differ
//   · a Spotify profile without a display name never shows its raw id
//   · the existing name edit on Me (Add your name) still writes the name
// Supabase is stubbed at the function boundary and every outside request is
// refused: nothing here reaches the network.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
import { wireVendor } from './lib/vendor-cdn.mjs';

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); console.log(`  ${ok ? '✓' : '✗'} ${msg}`); };

const FID = 'edc-lv-2026', AT = '2026-05-17T07:50:00Z';
const SHEET = '[data-quick-name]';

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const open = async ({ extra = {}, query = 'tab=me', ready = '[data-appearance-row]' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await ctx.route((u) => new URL(u.toString()).hostname !== '127.0.0.1', (r) => r.abort());
    await wireVendor(ctx);
    await ctx.clock.install({ time: new Date(AT) });
    await ctx.addInitScript(({ FID, extra }) => {
      if (sessionStorage.getItem('__seeded')) return;   // a reload must see what the app stored
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', FID); localStorage.setItem('active_festival_explicit', '1');
      localStorage.setItem('plursky_use_realmap', '0'); localStorage.setItem('cloud_nudge_seen', '1');
      localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(['k15', 'k16']));
      localStorage.setItem('plursky_pid', 'quick-name-test');
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    }, { FID, extra });
    await ctx.addInitScript(() => { if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ level: 1, charging: true, chargingTime: 0, dischargingTime: Infinity, addEventListener() {}, removeEventListener() {} }); });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(([fid, sel]) => window.FESTIVAL_CONFIG?.id === fid && document.querySelector(sel), [FID, ready], { timeout: 60000 });
    await page.waitForTimeout(400);
    // Supabase at the function boundary: record what each door would send.
    await page.evaluate(() => {
      window.__sent = { presence: [], group: [], collage: [], showdown: [] };
      window.sbPresenceJoin = (p) => { window.__sent.presence.push(p); };
      window.sbPresenceRefresh = () => {};
      window.sbGroupUpdate = () => {};
      window.sbGroupJoin = (code, p, onChange) => {
        window.__sent.group.push(p);
        onChange(new Map([[p.pid, { name: p.name, artistIds: p.artistIds }], ['friend-1', { name: 'Remi', artistIds: ['k15'] }]]));
        return () => {};
      };
      window._shareCrewCollage = async (o) => { window.__sent.collage.push(o.crewNames); };
      window._shareCrewComparison = async (myName) => { window.__sent.showdown.push(myName); };
    });
    return { ctx, page, errors };
  };
  const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
  const sheetShown = (page) => page.locator(SHEET).isVisible().catch(() => false);
  const startCrew = async (page) => {
    await page.getByRole('button', { name: /Crew Mode/ }).click();
    await page.getByRole('button', { name: /START CREW/ }).click();
  };

  // 1. Fresh install, open Me: asked, answer stored, every door shows it.
  {
    console.log('fresh install → open Me');
    const { ctx, page, errors } = await open();
    await page.waitForSelector(SHEET, { timeout: 5000 }).catch(() => {});
    check(await sheetShown(page), 'opening Me on a fresh install shows the quick-name ask');
    check(await page.getByText('What should Plursky call you?').isVisible().catch(() => false), 'the ask reads "What should Plursky call you?"');
    check(await ls(page, 'plursky_display_name') === null, 'nothing is stored before an answer');
    if (await sheetShown(page)) {
      await page.fill('[data-quick-name-input]', 'Makayla');
      await page.click('[data-quick-name-save]');
    }
    await page.waitForTimeout(300);
    check(!(await sheetShown(page)), 'Save closes the ask');
    check(await ls(page, 'plursky_display_name') === 'Makayla', `stored in plursky_display_name (got ${JSON.stringify(await ls(page, 'plursky_display_name'))})`);
    check(await page.locator('.duo-name', { hasText: 'Makayla' }).count() > 0, 'the Me header shows Makayla');
    check(await page.getByText('Makayla', { exact: true }).count() >= 2, 'the crew presence card shows Makayla (it was mounted before the answer)');
    // Crew presence: Go live broadcasts the local name.
    await page.getByRole('button', { name: 'Go live' }).click().catch(() => {});
    // Crew join: the picks a crew sees carry the local name; then the recaps.
    await startCrew(page);
    await page.waitForTimeout(300);
    check(!(await sheetShown(page)), 'a crew join after an answer does not ask again');
    await page.getByRole('button', { name: /SHARE OUR WEEKEND/ }).click().catch(() => {});
    await page.getByRole('button', { name: /SHOWDOWN VS REMI/ }).click().catch(() => {});
    await page.waitForTimeout(200);
    const sent = await page.evaluate(() => window.__sent);
    check(sent.presence[0]?.name === 'Makayla', `crew presence (Go live) sends Makayla (got ${JSON.stringify(sent.presence[0]?.name)})`);
    check(sent.group[0]?.name === 'Makayla', `crew join shares picks as Makayla (got ${JSON.stringify(sent.group[0]?.name)})`);
    check(sent.collage[0]?.[0] === 'Makayla', `crew recap (Share our weekend) names Makayla (got ${JSON.stringify(sent.collage[0])})`);
    check(sent.showdown[0] === 'Makayla', `crew recap (Showdown) names Makayla (got ${JSON.stringify(sent.showdown[0])})`);

    // Apple sign-in, native path, both stubbed: a typed name stays.
    const claim = await page.evaluate(async () => {
      window.Capacitor = { isNativePlatform: () => true, Plugins: { SignInWithApple: { authorize: async () => ({ response: { identityToken: 'stub', givenName: 'Avery', familyName: 'Stone' } }) } } };
      _sb.auth.signInWithIdToken = async () => ({ data: {}, error: null });
      _sb.auth.updateUser = async () => ({ data: {}, error: null });
      const kept = await sbSignInWithApple();
      const afterKept = localStorage.getItem('plursky_display_name');
      const stays = plurskyNameStaysYours('Avery Stone');
      const same = plurskyNameStaysYours('Makayla Stone');
      localStorage.removeItem('plursky_display_name');
      const filled = await sbSignInWithApple();
      return { kept: kept.error, afterKept, stays, same, filled: filled.error, afterFilled: localStorage.getItem('plursky_display_name') };
    });
    check(claim.kept === null && claim.afterKept === 'Makayla', `Apple sign-in keeps the local name (got ${JSON.stringify(claim.afterKept)}, error ${JSON.stringify(claim.kept)})`);
    check(claim.stays === true && claim.same === false, `"name stays yours" shows only when the names differ (differ=${claim.stays}, same=${claim.same})`);
    check(claim.filled === null && claim.afterFilled === 'Avery', `with no local name, Apple's first name fills it (got ${JSON.stringify(claim.afterFilled)})`);
    check(errors.length === 0, `no page errors (${errors.join(' / ')})`);
    await ctx.close();
  }

  // 2. Skip is remembered: no ask on reload, none on a crew join.
  {
    console.log('skip');
    const { ctx, page, errors } = await open();
    await page.waitForSelector(SHEET, { timeout: 5000 }).catch(() => {});
    if (await sheetShown(page)) await page.click('[data-quick-name-skip]');
    await page.waitForTimeout(300);
    check(!(await sheetShown(page)), 'Not now closes the ask');
    check(await ls(page, 'plursky_display_name') === '', `a skip is remembered in the existing key, as an empty name (got ${JSON.stringify(await ls(page, 'plursky_display_name'))})`);
    check(await page.locator('[data-me-add-name]').count() === 1, 'after a skip Me still offers "Add your name"');
    // The app rewrites its URL once booted, so reopen Me by its deep link.
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=me`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-appearance-row]', { state: 'attached', timeout: 60000 });
    await page.waitForTimeout(800);
    check(!(await sheetShown(page)), 'reopening Me after a skip does not ask again');
    await page.evaluate(() => { window.sbGroupUpdate = () => {}; window.sbPresenceRefresh = () => {}; window.__g = null; window.sbGroupJoin = (c, p) => { window.__g = p; return () => {}; }; });
    await startCrew(page);
    await page.waitForTimeout(300);
    check(!(await sheetShown(page)) && (await page.evaluate(() => window.__g?.name)) === 'Me', 'a crew join after a skip does not ask, and joins as "Me"');
    // The name edit that was already on Me is unchanged.
    page.once('dialog', d => d.accept('Kai'));
    await page.click('[data-me-add-name]');
    await page.waitForTimeout(200);
    check(await ls(page, 'plursky_display_name') === 'Kai', 'the existing "Add your name" edit still writes the name');
    check(errors.length === 0, `no page errors (${errors.join(' / ')})`);
    await ctx.close();
  }

  // 3. A name already set: no ask.
  {
    console.log('existing local name');
    const { ctx, page } = await open({ extra: { plursky_display_name: 'Jo' } });
    await page.waitForTimeout(800);
    check(!(await sheetShown(page)), 'a set name means no ask');
    await ctx.close();
    const legacy = await open({ extra: { user_name: 'Lee' } });
    await legacy.page.waitForTimeout(800);
    check(!(await sheetShown(legacy.page)), 'a name from the older Personalize key means no ask');
    await legacy.ctx.close();
  }

  // 4. First crew join asks when the ask is still due.
  {
    console.log('first crew join');
    const { ctx, page } = await open({ query: 'tab=me' });
    await page.waitForSelector(SHEET, { timeout: 5000 }).catch(() => {});
    // Close the Me ask without the skip flag landing, as if Me never asked.
    if (await sheetShown(page)) await page.click('[data-quick-name-skip]');
    await page.evaluate(() => localStorage.removeItem('plursky_display_name'));
    await startCrew(page);
    await page.waitForSelector(SHEET, { timeout: 5000 }).catch(() => {});
    check(await sheetShown(page), 'a first crew join with no name asks');
    if (await sheetShown(page)) { await page.fill('[data-quick-name-input]', 'Makayla'); await page.click('[data-quick-name-save]'); }
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => window.__sent.group[0]?.name);
    check(g === 'Makayla', `the join waits for the answer and shares as Makayla (got ${JSON.stringify(g)})`);
    await ctx.close();
  }

  // 5. Spotify without a display name never shows its id.
  {
    console.log('spotify id');
    const { ctx, page } = await open({ extra: { plursky_display_name: '', spotify_profile: JSON.stringify({ id: '31xq7zabc', name: '31xq7zabc', image: null }) } });
    const n = await page.evaluate(() => getSpotifyProfileSync()?.name ?? null);
    check(n === null, `a cached profile whose name is its id reads as no name (got ${JSON.stringify(n)})`);
    check(await page.getByText('31xq7zabc').count() === 0, 'the raw Spotify id is not shown on Me');
    await ctx.close();
  }
} finally {
  await browser?.close();
  server.kill();
}

console.log(`\nquick name: ${checks - problems.length}/${checks} checks passed`);
if (problems.length) { for (const p of problems) console.log(`  ✗ ${p}`); process.exit(1); }
