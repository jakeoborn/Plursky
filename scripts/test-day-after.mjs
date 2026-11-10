#!/usr/bin/env node
// Day-after cards (row 9): "the story of the night" on a festival page.
//   A. the committed records validate, none is published, and no committed
//      /f/ page carries a card
//   B. fail closed: every way a record can go wrong stops it (not official,
//      wrong festival/day, not a recap, stale verification, markup or links in
//      copy, an act the schedule does not have on that day, missing sign-offs)
//   C. timing: a published card shows from 08:00 festival-local the day after,
//      never before; draft / review / withdrawn never show; DST-safe
//   D. render: link-only (no iframe, no script), every link is a verified
//      official post with rel=noopener noreferrer, set times come from the
//      schedule, "Curated by Plursky" on every card
//   E. a real browser: the cards inside the real EDC Orlando page at 320 and
//      393, Dark and Light: no overflow, 44px link targets, zero requests to
//      any platform. DAY_AFTER_SHOTS=<dir> also writes the four screenshots.
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './lib/day-after.mjs';
import { loadEmbedData } from './lib/official-embeds.mjs';
import { loadRegistry } from './lib/load-registry.mjs';
import { fingerprintInput } from './lib/sitemap-fingerprint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

const { REG, DS, scheduleActs, eventDates } = loadRegistry(root);
const EMBEDS = loadEmbedData(root);
const DATA = D.loadDayAfter(root);
const FID = 'edc-orlando-2026';
const cfgOf = fid => REG.find(f => f.config.id === fid)?.config;
const ctxFor = fid => ({ cfg: cfgOf(fid), acts: scheduleActs(DS[fid]?.artists), embeds: EMBEDS });
const cfg = cfgOf(FID);
const clone = o => JSON.parse(JSON.stringify(o));
const publish = r => ({ ...clone(r), status: 'published', claimCheck: { by: 'fixture', at: '2026-11-09' }, approval: { by: 'fixture', at: '2026-11-09' }, publishedAt: '2026-11-09' });

// ── A. Committed data ───────────────────────────────────────────────────
let threw = null;
try { D.assertDayAfter(DATA, ctxFor); } catch (e) { threw = e.message; }
check(threw === null, `committed day-after records do not validate: ${threw}`);
const recs = DATA[FID] || [];
check(recs.length === 3 && recs.map(r => r.day).join() === '1,2,3', `expected EDC Orlando drafts for days 1-3, got ${recs.map(r => r.day)}`);
const all = Object.entries(DATA).filter(([k]) => !k.startsWith('_')).flatMap(([, l]) => l);
check(all.every(r => r.status !== 'published'), 'a committed record is published; this PR ships drafts only');
check(D.selectDayAfter(FID, DATA, cfg, Date.UTC(2030, 0, 1)).length === 0, 'a committed draft would render');
const fdir = path.join(root, 'f');
const pages = readdirSync(fdir).filter(d => existsSync(path.join(fdir, d, 'index.html')));
const withCard = pages.filter(d => /id="day-after"|class="da-card"|section\.day-after/.test(readFileSync(path.join(fdir, d, 'index.html'), 'utf8')));
check(pages.length > 20 && withCard.length === 0, `committed /f/ pages carrying a day-after card or its CSS: ${withCard.join(', ') || 'none'} (of ${pages.length})`);
const fpIn = fingerprintInput(REG.find(f => f.config.id === FID), { DS, scheduleActs, eventDates, TODAY: '2026-11-09', NOW_MS: Date.UTC(2030, 0, 1) });
check(!('dayAfter' in fpIn), 'a page with no card added a dayAfter key to its sitemap fingerprint');

// The generator places the card right before Watch, with its CSS only when shown.
const gen = readFileSync(path.join(root, 'scripts/gen-festival-pages.mjs'), 'utf8');
check(gen.includes('${dayAfterHtml}${watchHtml}'), 'generator no longer renders the card before Watch');
check(gen.includes("${dayAfterHtml ? DAY_AFTER_CSS : ''}"), 'generator emits the card CSS on pages without a card');
check(/assertDayAfter\(DAY_AFTER,/.test(gen), 'generator no longer validates every record');

// ── B. Fail closed ──────────────────────────────────────────────────────
const d1 = recs.find(r => r.day === 1), d2 = recs.find(r => r.day === 2), d3 = recs.find(r => r.day === 3);
const errsOf = (rec, fid = FID, ctx = ctxFor(fid)) => D.validateDayAfter(fid, rec, ctx);
check(errsOf(d1).length === 0 && errsOf(d2).length === 0 && errsOf(d3).length === 0, 'a committed draft has errors');
check(errsOf(publish(d2)).length === 0, `a signed-off copy of day 2 is rejected: ${errsOf(publish(d2))}`);
const ACL_URL = (EMBEDS.curated['acl-2026'] || [])[0]?.url;
const ANNOUNCE = EMBEDS.curated[FID].find(e => e.kind !== 'recap')?.url;
const mut = (label, edit, want) => {
  const r = clone(d2); edit(r);
  const errs = errsOf(r);
  check(errs.some(e => want.test(e)), `${label}: not caught (${errs.join('; ') || 'no errors'})`);
};
mut('unknown status', r => { r.status = 'live'; }, /unknown status/);
mut('a day the festival lacks', r => { r.day = 9; }, /not a edc-orlando-2026 festival day/);
mut('markup in the title', r => { r.title = 'Kaskade <b>closes</b>'; }, /title contains markup/);
mut('a link in a caption', r => { r.chapters[0].caption = 'See https://example.com'; }, /contains a link/);
mut('a source that is not on record', r => { r.chapters[1].sources = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ']; }, /not an official post on record/);
mut('another festival\'s official post', r => { r.chapters[1].sources = [ACL_URL]; }, /not an official post on record for edc-orlando-2026/);
mut('another day\'s recap', r => { r.chapters[1].sources = ['https://www.youtube.com/watch?v=fqvmqwXxyns']; }, /not an official recap of day 2/);
mut('an official post that is not a recap', r => { r.chapters[1].sources = [ANNOUNCE]; }, /not an official recap of day 2/);
mut('an act not on that day', r => { r.chapters[0].artist = 'Maddix'; }, /Maddix has no timed set on day 2/);
mut('the post names a different act', r => { r.chapters[0].artist = 'Disco Lines'; }, /official post for Kaskade, not Disco Lines/);
mut('the same source twice', r => { r.chapters[1].sources = [...r.chapters[0].sources]; }, /already used/);
mut('too many chapters', r => { r.chapters = Array(7).fill(r.chapters[1]).map(c => ({ ...c, sources: [] })); }, /chapters must be 1-6/);
mut('an unknown field', r => { r.embedHtml = '<iframe>'; }, /unknown field embedHtml/);
mut('an unknown chapter field', r => { r.chapters[0].image = 'x.jpg'; }, /unknown field image/);
mut('no drafter', r => { delete r.drafted; }, /drafted needs/);
mut('published without the claim check', r => { Object.assign(r, publish(r)); delete r.claimCheck; }, /claimCheck needs/);
mut('published without the approval', r => { Object.assign(r, publish(r)); delete r.approval; }, /approval needs/);
mut('published without a date', r => { Object.assign(r, publish(r)); r.publishedAt = 'today'; }, /publishedAt/);
mut('withdrawn without a reason', r => { Object.assign(r, publish(r)); r.status = 'withdrawn'; }, /withdrawnReason is missing/);
{
  // A verification for a different record (account edited after the check).
  const curated = clone(EMBEDS.curated);
  curated[FID].find(e => e.url === d2.chapters[0].sources[0]).officialAccount = 'https://twitter.com/someone_else';
  const errs = errsOf(d2, FID, { ...ctxFor(FID), embeds: { curated, verified: EMBEDS.verified } });
  check(errs.some(e => /fails the official-post check|no current verification/.test(e)), `an edited official record kept its verification: ${errs}`);
  const verified = clone(EMBEDS.verified); verified.results[d2.chapters[1].sources[0]].ok = false;
  check(errsOf(d2, FID, { ...ctxFor(FID), embeds: { curated: EMBEDS.curated, verified } }).some(e => /no current verification/.test(e)), 'a post whose last check failed is accepted');
}
{
  let msg = '';
  try { D.assertDayAfter({ [FID]: [publish(d2), { ...publish(d2), id: 'edco-dup' }] }, ctxFor); } catch (e) { msg = e.message; }
  check(/two published recaps for day 2/.test(msg), 'two published cards for one day are accepted');
  msg = '';
  try { D.assertDayAfter({ [FID]: [{ ...clone(d1), title: '<script>' }] }, ctxFor); } catch (e) { msg = e.message; }
  check(/title contains markup/.test(msg), 'a bad DRAFT does not stop the build');
  msg = '';
  try { D.assertDayAfter({ 'no-such-fest': [clone(d1)] }, ctxFor); } catch (e) { msg = e.message; }
  check(/not in the registry/.test(msg), 'a record for an unknown festival is accepted');
}

// ── C. Timing ───────────────────────────────────────────────────────────
check(D.zonedToUtc('America/New_York', 2026, 10, 1, 8) === Date.UTC(2026, 10, 1, 13), 'NY 08:00 on Nov 1 2026 (EST after fall-back) is not 13:00Z');
check(D.zonedToUtc('America/New_York', 2026, 2, 8, 8) === Date.UTC(2026, 2, 8, 12), 'NY 08:00 on Mar 8 2026 (EDT after spring-forward) is not 12:00Z');
check(D.zonedToUtc('America/Chicago', 2026, 9, 3, 8) === Date.UTC(2026, 9, 3, 13), 'Chicago 08:00 on Oct 3 2026 (CDT) is not 13:00Z');
check(D.zonedToUtc('America/New_York', 2026, 10, 31, 8) === Date.UTC(2026, 11, 1, 13), 'day overflow (Nov 31 = Dec 1) is wrong');
check(D.morningAfterMs(cfg, 1) === Date.UTC(2026, 10, 7, 13), `EDC Orlando day 1 morning-after = ${new Date(D.morningAfterMs(cfg, 1)).toISOString()}, want 2026-11-07T13:00Z`);
check(D.morningAfterMs(cfg, 3) === Date.UTC(2026, 10, 9, 13), 'EDC Orlando day 3 morning-after is not Nov 9 08:00 EST');
const pubData = { [FID]: recs.map(publish) };
const shownAt = ms => D.selectDayAfter(FID, pubData, cfg, ms).map(r => r.day).join();
check(shownAt(Date.UTC(2026, 10, 7, 12, 59)) === '', 'day 1 shows before 08:00 local the next morning');
check(shownAt(Date.UTC(2026, 10, 7, 13, 0)) === '1', 'day 1 does not show at 08:00 local the next morning');
check(shownAt(Date.UTC(2026, 10, 8, 13, 0)) === '1,2', 'days 1-2 do not show on Nov 8 08:00 local');
check(shownAt(Date.UTC(2026, 10, 9, 13, 0)) === '1,2,3', 'all three days do not show on Nov 9 08:00 local');
for (const st of ['draft', 'review', 'withdrawn']) {
  const r = { ...publish(d1), status: st, ...(st === 'withdrawn' ? { withdrawnReason: 'fixture' } : {}) };
  check(D.selectDayAfter(FID, { [FID]: [r] }, cfg, Date.UTC(2030, 0, 1)).length === 0, `a ${st} record renders`);
}
{
  const r = publish(d1); delete r.approval;
  check(D.selectDayAfter(FID, { [FID]: [r] }, cfg, Date.UTC(2030, 0, 1)).length === 0, 'a published record without approval renders');
}

// ── D. Render ───────────────────────────────────────────────────────────
const dates = eventDates(cfg);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayTitle = d => { const e = cfg.dayDates[d]; return `${e.name}, ${MONTHS[e.m]} ${e.d}`; };
const stageName = sid => (DS[FID].stages || []).find(t => t.id === sid)?.name || sid;
const shown = D.selectDayAfter(FID, pubData, cfg, Date.UTC(2026, 10, 9, 13));
const html = D.dayAfterSection(cfg.name, shown, { cfg, acts: scheduleActs(DS[FID].artists), embeds: EMBEDS, dayTitle, stageName });
check(D.dayAfterSection(cfg.name, [], { cfg }) === '', 'no cards still renders a section');
check(!/<iframe|<script|<img|<video|<blockquote/i.test(html), 'a card renders a player, script or media (link-only)');
const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)];
const official = new Set(EMBEDS.curated[FID].filter(e => e.kind === 'recap').map(e => e.url));
check(hrefs.length === 6, `expected 6 source links across days 1-3, got ${hrefs.length}`);
check(hrefs.every(m => official.has(m[1])), 'a card links something that is not an official recap post');
check(hrefs.every(m => /rel="noopener noreferrer"/.test(m[0])), 'a source link lacks rel=noopener noreferrer');
check((html.match(/Curated by Plursky/g) || []).length === 3, 'a card lacks the "Curated by Plursky" label');
check(/Scheduled: kineticFIELD · 10:31 PM – 12:00 AM/.test(html), 'Kaskade\'s set line is not the schedule\'s kineticFIELD 10:31 PM – 12:00 AM, marked Scheduled');
// Instinct's claim check (Nov 9): set times rest on the official schedule, not
// on the post, so every set line says "Scheduled" and no copy says an act DID
// close or play a slot.
check((html.match(/class="da-set">/g) || []).length === (html.match(/class="da-set">Scheduled: /g) || []).length, 'a set line is not marked Scheduled');
check(!/\bcloses\b|\bclosed kineticFIELD|had the last set|(?<!scheduled for )the last set on/i.test(html), 'card copy states a set as fact (closes / had the last set) instead of scheduled');
check(/circuitGROUNDS · 7:45 PM – 8:45 PM/.test(html) && /circuitGROUNDS · 9:50 PM – 10:55 PM/.test(html), 'Maddix/ATLiens set lines are not from the schedule');
check(/Friday&#39;s story/.test(html) && /Sunday, November 8/.test(html), 'card day labels are wrong');
check(/@Insomniac, official account/.test(html) && /@EDC_Orlando, official account/.test(html), 'source accounts are not named');
check(/&quot;EDC Orlando 2026 \| Day 1 Recap&quot;/.test(html), 'copy is not HTML-escaped');
check(!/official (partner|sponsor)|presented by/i.test(html), 'a card implies official status');

// ── E. Real browser ─────────────────────────────────────────────────────
const pageHtml = readFileSync(path.join(fdir, FID, 'index.html'), 'utf8')
  .replace('</style>', `${D.DAY_AFTER_CSS}\n</style>`)
  .replace('\n  <section id="watch"', `${html}\n  <section id="watch"`);
check(pageHtml.includes('id="day-after"') && pageHtml.indexOf('id="day-after"') < pageHtml.indexOf('id="watch"'), 'fixture page did not place the cards before Watch');
// The network check is about the cards: Watch's lazy YouTube players are
// test-official-embeds' / test-embeds-tap's subject, so the browser page drops
// that section (and its loader) and keeps everything else on the real page.
const browserHtml = pageHtml.replace(/\n  <section id="watch"[\s\S]*?\n  <\/section>/, '');
check(!browserHtml.includes('id="watch"') && browserHtml.includes('id="day-after"'), 'could not isolate the cards from Watch');
const shotDir = process.env.DAY_AFTER_SHOTS;
let browserNote = 'skipped';
try {
  const { chromium } = await import('playwright');
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    if (shotDir) mkdirSync(shotDir, { recursive: true });
    for (const width of [320, 393]) for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const platformHits = [];
      await page.route('**/*', route => {
        const u = route.request().url();
        if (/youtube|youtu\.be|ytimg|twitter|x\.com|twimg|instagram|cdninstagram|fbcdn|tiktok|snapchat/i.test(u)) platformHits.push(u);
        return u.startsWith('data:') ? route.continue() : route.abort();
      });
      await page.setContent(browserHtml, { waitUntil: 'load' });
      const m = await page.evaluate(() => {
        const sec = document.getElementById('day-after');
        sec.scrollIntoView();
        const docOver = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const cards = [...sec.querySelectorAll('.da-card')];
        const over = cards.filter(c => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > window.innerWidth + 0.5).length;
        const links = [...sec.querySelectorAll('a.da-src')];
        const small = links.filter(a => a.getBoundingClientRect().height < 44 || a.getBoundingClientRect().right > window.innerWidth + 0.5).length;
        const bg = getComputedStyle(cards[0]).backgroundColor, fg = getComputedStyle(cards[0]).color;
        const caps = [...sec.querySelectorAll('h4')].filter(h => getComputedStyle(h).textTransform !== 'none').length;
        return { caps, docOver, cards: cards.length, over, links: links.length, small, bg, fg, top: sec.getBoundingClientRect().top + window.scrollY };
      });
      const tag = `${width} ${scheme}`;
      check(m.cards === 3 && m.links === 6, `${tag}: rendered ${m.cards} cards / ${m.links} links`);
      check(m.docOver <= 0, `${tag}: page scrolls sideways by ${m.docOver}px`);
      check(m.over === 0, `${tag}: ${m.over} card(s) overflow`);
      check(m.small === 0, `${tag}: ${m.small} link(s) under 44px or off-screen`);
      check(m.bg !== m.fg, `${tag}: card text matches its background`);
      check(m.caps === 0, `${tag}: ${m.caps} chapter title(s) are case-transformed (stage names like kineticFIELD must keep their case)`);
      check(platformHits.length === 0, `${tag}: requested a platform before any tap: ${platformHits.slice(0, 3).join(', ')}`);
      if (shotDir) {
        const sec = await page.$('#day-after');
        await sec.screenshot({ path: path.join(shotDir, `day-after-${width}-${scheme}.png`) });
        checks++;
      }
      await ctx.close();
    }
    browserNote = `320/393 × Dark/Light${shotDir ? `, shots in ${shotDir}` : ''}`;
  } finally { await browser.close(); }
} catch (e) {
  check(false, `browser run failed: ${e.message}`);
}

if (problems.length) {
  console.log(`  ✗ day-after cards: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log('    ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ day-after cards: ${checks} checks (${recs.length} drafts, 0 published, 0 pages with a card; browser ${browserNote})`);
