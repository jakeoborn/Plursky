#!/usr/bin/env node
// Live-site watchdog for plursky.com: walk every sitemap robots.txt names and
// check what a visitor or a crawler actually gets. Read-only: GETs only.
//
// Born 2026-11-26. A real-Chrome crawl of the 79 pages in sitemap.xml found a
// /favicon.ico 404 and two pages with no description, canonical or share card.
// The same crawl never opened /artists/ or /genres/, because it seeded from
// sitemap.xml alone. robots.txt lists three sitemaps. This job reads robots.txt,
// so a sitemap added later is walked without anyone editing this file.
//
//   node scripts/site-watchdog.mjs                       # https://plursky.com
//   node scripts/site-watchdog.mjs --origin http://127.0.0.1:8080
//   node scripts/site-watchdog.mjs --json out.json       # full findings as JSON
//
// A finding is one of:
//   status      a sitemap URL, or an internal link/asset on a page, is not 200
//   noindex     a sitemap URL says noindex (the sitemap asks for it, the page refuses)
//   canonical   an indexable page has no canonical, or one pointing elsewhere
//   title       an indexable page has no <title>
//   description an indexable page has no meta description
//   og          an indexable page has no og:image
//   icon        a page declares no <link rel="icon"> while /favicon.ico is not
//               200, so every browser visit logs a 404 (callback.html, 11-26)
//   robots      robots.txt is missing or names no sitemap
//
// Exit 1 on any finding, 0 when clean, 2 when the site could not be read at all.
// Redirects are followed for links (a moved page that lands is fine) but a
// SITEMAP url must answer 200 itself: a sitemap should list final URLs.
import { writeFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const ORIGIN = (arg('--origin', 'https://plursky.com')).replace(/\/$/, '');
const JSON_OUT = arg('--json', null);
const CONC = Number(arg('--concurrency', 12));
const UA = 'plursky-site-watchdog/1 (+https://plursky.com/)';

const findings = [];
const add = (kind, url, detail) => findings.push({ kind, url, detail });

async function get(url, { redirect = 'follow', tries = 3 } = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { redirect, headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
      const type = res.headers.get('content-type') || '';
      const body = /html|xml|text|json/.test(type) ? await res.text() : (await res.arrayBuffer(), '');
      return { status: res.status, type, body, location: res.headers.get('location') };
    } catch (e) {
      // A network blip is not a site defect: retry, then report it as status 0.
      if (i >= tries) return { status: 0, type: '', body: '', error: String(e.cause?.code || e.name || e) };
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

async function pool(items, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONC, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return m ? decode(m[1] ?? m[2]) : null; };
const metaContent = (html, key, val) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) if ((attr(m[0], key) || '').toLowerCase() === val) return attr(m[0], 'content');
  return null;
};

// Only what the page itself references, in markup: <a href>, <link href>,
// <img src>, <script src>. A script's BODY is code, not markup: /welcome/
// builds hrefs in strings ('<a href="' + editionHref(e.id) + '">'), which read
// as three 404s until script bodies were blanked (the <script src> tag stays).
function refsOf(html, base) {
  const out = new Set();
  const body = html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  for (const m of body.matchAll(/<(a|link|img|script|source)\b[^>]*>/gi)) {
    const tag = m[0], el = m[1].toLowerCase();
    const raw = el === 'a' || el === 'link' ? attr(tag, 'href') : attr(tag, 'src');
    if (!raw || /^(#|mailto:|tel:|javascript:|data:|sms:|itms|webcal:)/i.test(raw)) continue;
    if (el === 'link' && /preconnect|dns-prefetch/i.test(attr(tag, 'rel') || '')) continue;
    let u; try { u = new URL(raw, base); } catch { continue; }
    if (u.origin !== ORIGIN) continue;
    // /cdn-cgi/ is Cloudflare's own path (email obfuscation rewrites a mailto
    // into /cdn-cgi/l/email-protection#…, decoded by Cloudflare's script). It
    // is not in the repo and not ours to fix here.
    if (u.pathname.startsWith('/cdn-cgi/')) continue;
    u.hash = '';
    out.add(u.href);
  }
  return out;
}

// ── 1. robots.txt → sitemaps → URLs ───────────────────────────────────
const robots = await get(`${ORIGIN}/robots.txt`);
if (robots.status !== 200) { add('robots', `${ORIGIN}/robots.txt`, `status ${robots.status}`); }
const sitemaps = [...robots.body.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m => m[1].replace(/^https?:\/\/[^/]+/, ORIGIN));
if (!sitemaps.length) add('robots', `${ORIGIN}/robots.txt`, 'names no Sitemap');

const urls = new Set();
for (const sm of sitemaps) {
  const r = await get(sm);
  if (r.status !== 200) { add('status', sm, `sitemap ${r.status}${r.error ? ' ' + r.error : ''}`); continue; }
  const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => decode(m[1]).replace(/^https?:\/\/[^/]+/, ORIGIN));
  if (!locs.length) add('status', sm, 'sitemap lists no <loc>');
  for (const l of locs) urls.add(l);
}
if (!urls.size) {
  console.log(`✗ site watchdog: could not read any sitemap URL from ${ORIGIN}`);
  for (const f of findings) console.log(`  ✗ ${f.kind} ${f.url} ${f.detail}`);
  process.exit(2);
}

// A browser asks for /favicon.ico on any page that declares no icon. When that
// file is not served, a page without its own icon link is a console 404.
const faviconOk = (await get(`${ORIGIN}/favicon.ico`)).status === 200;

// ── 2. every sitemap URL: status + head ───────────────────────────────
const refs = new Map(); // ref url -> first page that used it
const pages = [...urls];
await pool(pages, async (url) => {
  const r = await get(url, { redirect: 'manual' });
  if (r.status !== 200) { add('status', url, `${r.status}${r.location ? ' -> ' + r.location : ''}${r.error ? ' ' + r.error : ''}`); return; }
  if (!/html/.test(r.type)) return;
  const head = (/<head\b[\s\S]*?<\/head>/i.exec(r.body) || [r.body])[0];
  const robotsMeta = (metaContent(head, 'name', 'robots') || '').toLowerCase();
  if (/noindex/.test(robotsMeta)) { add('noindex', url, `listed in a sitemap but says "${robotsMeta}"`); }
  else {
    const canon = (() => { for (const m of head.matchAll(/<link\b[^>]*>/gi)) if ((attr(m[0], 'rel') || '').toLowerCase() === 'canonical') return attr(m[0], 'href'); return null; })();
    if (!canon) add('canonical', url, 'missing');
    else if (new URL(canon, url).href.replace(/^https?:\/\/[^/]+/, ORIGIN) !== url) add('canonical', url, `points to ${canon}`);
    const title = (/<title>([\s\S]*?)<\/title>/i.exec(head) || [])[1];
    if (!title || !title.trim()) add('title', url, 'missing');
    if (!(metaContent(head, 'name', 'description') || '').trim()) add('description', url, 'missing');
    if (!(metaContent(head, 'property', 'og:image') || '').trim()) add('og', url, 'og:image missing');
  }
  if (!faviconOk && ![...head.matchAll(/<link\b[^>]*>/gi)].some(m => /(^|\s)icon(\s|$)/i.test(attr(m[0], 'rel') || ''))) add('icon', url, 'no <link rel="icon"> and /favicon.ico is not served');
  for (const ref of refsOf(r.body, url)) if (!urls.has(ref) && !refs.has(ref)) refs.set(ref, url);
});

// ── 3. every internal link and asset the pages reference ──────────────
const refList = [...refs.keys()];
await pool(refList, async (ref) => {
  const r = await get(ref);
  if (r.status !== 200) add('status', ref, `${r.status}${r.error ? ' ' + r.error : ''} (linked from ${refs.get(ref)})`);
});

// ── report ─────────────────────────────────────────────────────────────
const byKind = {};
for (const f of findings) (byKind[f.kind] ||= []).push(f);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ origin: ORIGIN, sitemaps, pages: pages.length, refs: refList.length, findings }, null, 2) + '\n');
const summary = `${pages.length} sitemap URL(s) from ${sitemaps.length} sitemap(s), ${refList.length} other internal link(s)/asset(s)`;
if (!findings.length) { console.log(`✓ site watchdog: ${summary}, all 200, every indexable page has title, description, canonical and og:image`); process.exit(0); }
console.log(`✗ site watchdog: ${findings.length} finding(s) over ${summary}`);
for (const [k, list] of Object.entries(byKind)) {
  console.log(`  ${k}: ${list.length}`);
  for (const f of list.slice(0, 25)) console.log(`    ✗ ${f.url} ${f.detail}`);
  if (list.length > 25) console.log(`    … ${list.length - 25} more (--json for all)`);
}
process.exit(1);
