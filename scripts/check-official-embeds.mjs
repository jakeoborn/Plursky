#!/usr/bin/env node
// Verifies every curated official embed against the live platforms and
// writes data/official-embeds.verified.json, which is the ONLY thing the page
// generator trusts. Per embed:
//   1. provenance and URL shape are valid (lib validateEmbed);
//   2. accountSourceUrl (the festival's own site) links the official account;
//   3. the platform's oEmbed returns an embed (a dead, private, deleted or
//      embed-disabled post fails here);
//   4. the oEmbed author is that official account.
// A failure is dropped from the pages and listed; it is never shipped as a
// "Video unavailable" box.
//
//   node scripts/check-official-embeds.mjs            verify, write, list failures
//   node scripts/check-official-embeds.mjs --report   verify the COMMITTED pages'
//        embeds without writing; print a Markdown list of failures and exit 1
//        if any. The weekly workflow turns that into an issue.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEmbedData, verifyEmbed, selectEmbeds } from './lib/official-embeds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = process.argv.includes('--report');
const { curated, verified } = loadEmbedData(root);

// One retry on 429/5xx or a network error: a rate-limited oEmbed is not a dead post.
const fetcher = async (url, attempt = 0) => {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; PlurskyEmbedCheck/1.0; +https://plursky.com)' }, signal: AbortSignal.timeout(20000) });
    if ((r.status === 429 || r.status >= 500) && attempt === 0) { await new Promise(res => setTimeout(res, 4000)); return fetcher(url, 1); }
    return { status: r.status, text: await r.text() };
  } catch (err) {
    if (attempt === 0) { await new Promise(res => setTimeout(res, 4000)); return fetcher(url, 1); }
    throw err;
  }
};
// One fetch per official page, not one per embed.
const memo = new Map();
const cached = (url) => { if (!memo.has(url)) memo.set(url, fetcher(url)); return memo.get(url); };

// YouTube playability, asked of the real embedded player in headless Chrome:
// a local page hosts the youtube-nocookie iframe exactly as /f/ pages do, and
// the video counts as playable only once the player shows its play button
// (.ytmCuedOverlayPlayButton in the 2026 player) without YouTube's error screen. A known-embeddable control video runs first;
// if IT fails, the probe is broken and every answer is "could not tell".
import http from 'node:http';
import { existsSync as exists } from 'node:fs';
import { createRequire } from 'node:module';
const CONTROL_VIDEO = 'jNQXAC9IVRw'; // "Me at the zoo", YouTube's first upload
let probe = null;
async function youtubeProbe() {
  if (probe) return probe;
  const { chromium } = createRequire(import.meta.url)('playwright');
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(exists);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : { channel: 'chrome' }) }).catch(() => chromium.launch({ headless: true }));
  const server = http.createServer((req, res) => {
    const id = (req.url.match(/v=([A-Za-z0-9_-]{11})/) || [])[1] || '';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${id}" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media"></iframe>`);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const ask = async (id) => {
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}/?v=${id}`);
      const frame = page.frameLocator('iframe');
      const verdict = await Promise.race([
        frame.locator('.ytp-error').first().waitFor({ state: 'visible', timeout: 20000 }).then(() => false),
        frame.locator('.ytmCuedOverlayPlayButton, .ytp-large-play-button, .ytp-cued-thumbnail-overlay').first().waitFor({ state: 'visible', timeout: 20000 })
          .then(async () => !(await frame.locator('.ytp-error').first().isVisible().catch(() => false))),
      ]).catch(() => null);
      return verdict;
    } finally { await page.close(); }
  };
  const controlOk = await ask(CONTROL_VIDEO);
  probe = {
    playable: async (id) => controlOk === true ? ask(id) : null,
    close: async () => { await browser.close(); server.close(); },
    controlOk,
  };
  return probe;
}
const youtubePlayable = async (id) => (await youtubeProbe()).playable(id);

const today = new Date().toISOString().slice(0, 10);
const results = {};
const failures = [];
// Could not tell (probe blocked, timeout): dropped from pages at build time,
// but never reported as dead.
const unknowns = [];
for (const [fid, list] of Object.entries(curated)) {
  // --report checks what the committed pages show; the default checks all.
  const targets = REPORT
    ? (({ youtube, social, spotify }) => [...youtube, ...social, ...spotify])(selectEmbeds(fid, { curated, verified }))
    : list;
  for (const e of targets) {
    const r = await verifyEmbed(e, cached, { youtubePlayable });
    results[e.url] = { ok: r.ok, reason: r.reason, festival: fid, platform: e.platform, publishedAt: r.publishedAt || null, ...(r.accountName ? { accountName: r.accountName } : {}), checkedAt: today };
    if (!r.ok) (r.unknown ? unknowns : failures).push({ fid, e, reason: r.reason });
  }
}

if (probe) { if (probe.controlOk !== true) console.log('  ! YouTube probe control failed: no video could be confirmed this run'); await probe.close(); }

if (REPORT) {
  if (failures.length) {
    console.log(`## ${failures.length} official embed(s) failed the weekly check (${today})\n`);
    for (const u of unknowns) console.log(`- (could not confirm, not counted) **${u.fid}** · ${u.e.platform} · ${u.e.url} — ${u.reason}`);
    for (const f of failures) console.log(`- **${f.fid}** · ${f.e.platform} · ${f.e.url} — ${f.reason}`);
    console.log('\nRe-run `node scripts/check-official-embeds.mjs && node scripts/gen-festival-pages.mjs` to drop them from the pages, or replace them in data/official-embeds.json.');
    process.exit(1);
  }
  for (const u of unknowns) console.log(`! could not confirm ${u.fid} ${u.e.platform} ${u.e.url} — ${u.reason}`);
  console.log(`✓ no embed on the committed pages is dead (${today})`);
  process.exit(0);
}

writeFileSync(path.join(root, 'data', 'official-embeds.verified.json'),
  JSON.stringify({ checkedAt: today, results: Object.fromEntries(Object.entries(results).sort()) }, null, 2) + '\n');
const ok = Object.values(results).filter(r => r.ok).length;
console.log(`official embeds: ${ok} verified, ${failures.length + unknowns.length} dropped`);
for (const f of [...failures, ...unknowns]) console.log(`  ✗ ${f.fid} ${f.e.platform} ${f.e.url} — ${f.reason}`);
