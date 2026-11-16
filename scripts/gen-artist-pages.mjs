#!/usr/bin/env node
// Public artist pages, /artists/<key>/ (SPEC-206 B; artist repository spec §6, M7).
//
//   node scripts/gen-artist-pages.mjs          write artists/, sitemap-artists.xml
//   node scripts/gen-artist-pages.mjs --check  exit 1 when anything differs from a fresh build
//
// Everything comes from files already in the repo, never from the web:
//   data/artists/careers.json   billings per artist (the in-app career arc's data)
//   data/artists/registry.json  kind, parents and projects ("also plays as")
//   data.jsx registry            festival names, venues, zones, set-time sources
//   data/artist-photos.js        the photo ledger (documented-reuse rows only)
//
// Rules (each one is asserted by scripts/test-artist-pages.mjs):
//   1. One page per registry key. Keys already fold case, accents and style
//      variants (Fcukers / FCUKERS), and b2b billings are one set with several
//      performers, so the dedupe is the registry's, not redone here.
//   2. A key under review (careers `pending`) gets no page.
//   3. Thin content: a page is generated only for a performer with a timed
//      2026 set or billings at two or more festival editions. The rest are
//      listed in the build report, not generated (no noindex shells).
//   4. Archived billings carry "as published <date>"; untimed ones read
//      "billed, time TBA". The page never says final, complete, confirmed,
//      every set or all sets.
//   5. A photo shows only from a ledger row with a recorded licence, with its
//      credit line. Otherwise the letter tile.
//   6. No bios, no news, no popularity, no user data. Official links wait for
//      the links ledger (§6.4), which does not exist yet, so there are none
//      and no sameAs.
//   7. <lastmod> moves only when the artist's own page content changes, kept
//      in artists/lastmod.json, never on a version bump.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { loadRegistry } from './lib/load-registry.mjs';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');
const ORIGIN = 'https://plursky.com';
const OUT = path.join(ROOT, 'artists');
const LEDGER = path.join(OUT, 'lastmod.json');
const TODAY = new Date().toISOString().slice(0, 10);

const careers = JSON.parse(readFileSync(path.join(ROOT, 'data/artists/careers.json'), 'utf8'));
const registry = JSON.parse(readFileSync(path.join(ROOT, 'data/artists/registry.json'), 'utf8'));
const regByKey = new Map(registry.map(r => [r.key, r]));
const { REG } = loadRegistry(ROOT);
const cfgOf = new Map(REG.map(e => [e.config.id, e]));
const photoCtx = { window: {} };
vm.runInNewContext(readFileSync(path.join(ROOT, 'data/artist-photos.js'), 'utf8'), photoCtx);
const PHOTOS = photoCtx.window.PLURSKY_ARTIST_PHOTOS || {};
const hasFestPage = id => existsSync(path.join(ROOT, 'f', id, 'index.html'));

// careers billing row: [id, festIdx, date, stage, start, end, setTag, role, closing,
//   mainStage, partners, published, openEnd, liveId, date2?]
const B = r => ({ id: r[0], fest: careers.festivals[r[1]], date: r[2], stage: r[3], start: r[4], end: r[5], setTag: r[6],
  role: r[7], partners: r[10] || [], published: r[11], openEnd: !!r[12], liveId: r[13] });

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = d => { const [y, m, dd] = String(d).split('-').map(Number); return y && m && dd ? `${MON[m - 1]} ${dd}, ${y}` : ''; };
const clock = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const nameOf = k => careers.artists[k]?.n || careers.names[k] || k;

// Rule 2 and rule 3.
function pageEligible(key, a) {
  if (!a || a.pending) return { ok: false, why: 'under review' };
  const bs = a.b.map(B);
  const timed26 = bs.some(b => b.fest?.year === 2026 && b.start);
  const editions = new Set(bs.map(b => b.fest?.id)).size;
  return timed26 || editions >= 2 ? { ok: true } : { ok: false, why: 'one edition, no timed 2026 set' };
}

const keys = Object.keys(careers.artists).sort();
const pages = [], skipped = { 'under review': 0, 'one edition, no timed 2026 set': 0 };
for (const k of keys) {
  const e = pageEligible(k, careers.artists[k]);
  if (e.ok) pages.push(k); else skipped[e.why]++;
}
const onSite = new Set(pages);

function photoFor(key) {
  const p = PHOTOS[key];
  return p && p.license && p.licenseUrl && p.author && p.sourceUrl && p.asset ? p : null;
}

function setLine(b) {
  const time = b.start ? `${clock(b.start)}${b.end && !b.openEnd ? `–${clock(b.end)}` : ''}` : 'billed, time TBA';
  return [b.stage, time].filter(Boolean).join(' · ');
}

function artistPage(key) {
  const a = careers.artists[key], r = regByKey.get(key) || {};
  const name = a.n, bs = a.b.map(B);
  const now = bs.filter(b => b.fest?.year === 2026);
  const past = bs.filter(b => b.fest?.year < 2026);
  const later = bs.filter(b => b.fest?.year > 2026);
  const fest26 = [...new Map(now.map(b => [b.fest.id, b.fest])).values()];
  // "set times" only where a 2026 row is actually timed; untimed billings
  // are a lineup, not a schedule (Instinct #480 review: 65 pages overclaimed).
  const timed26 = now.some(b => b.start);
  const label26 = timed26 ? '2026 set times' : '2026 lineup';
  const title = fest26.length
    ? `${name} ${timed26 ? 'set times 2026' : '2026 lineup'}: ${fest26.map(f => f.name.replace(/ 2026$/, '')).join(', ')} · Plursky`
    : `${name} festival history · Plursky`;
  const eds = new Set(bs.map(b => b.fest.id)).size;
  const years = past.map(b => b.fest.year).filter(Boolean);
  const intro = fest26.length
    ? `${name} is billed at ${fest26.map(f => f.name.replace(/ 2026$/, '')).join(', ').replace(/, ([^,]*)$/, ' and $1')} in 2026.`
    : years.length
      ? `${name} is billed at ${eds} festival editions in Plursky's records, ${Math.min(...years)} to ${Math.max(...years)}.`
      : `${name} is billed at ${eds} upcoming festival editions in Plursky's records.`;

  // 1. 2026 sets, one block per festival, with its zone and source line.
  const block26 = fest26.map(f => {
    const e = cfgOf.get(f.id), cfg = e?.config || {};
    const rows = now.filter(b => b.fest.id === f.id);
    const src = cfg.scheduleSource || cfg.lineupSource;
    const srcLine = src?.url
      ? `${cfg.scheduleSource?.url && rows.some(b => b.start) ? 'Set times' : 'Lineup'} from <a href="${esc(src.url)}" rel="noopener">${src.official === true ? 'the official site' : 'a community source'}</a>${src.observedAt ? `, checked ${esc(src.observedAt)}` : ''}.`
      : '';
    const head = hasFestPage(f.id) ? `<a href="/f/${esc(f.id)}/">${esc(f.name)}</a>` : esc(f.name);
    return `    <h3>${head}</h3>
    <ul class="sets">
${rows.map(b => `      <li><time datetime="${esc(b.date)}">${esc(dayLabel(b.date))}</time><span>${esc(setLine(b))}${cfg.tzAbbr && b.start ? ` <span class="tz">${esc(cfg.tzAbbr)}</span>` : ''}${b.partners.length ? ` <span class="with">with ${b.partners.map(link).join(', ')}</span>` : ''}</span></li>`).join('\n')}
    </ul>
${srcLine ? `    <p class="note">${srcLine}</p>\n` : ''}`;
  }).join('');

  // Editions after 2026: lineups announced, listed as billed.
  const upcoming = later.length ? `    <ul class="sets">
${later.map(b => `      <li><time datetime="${esc(b.date)}">${esc(dayLabel(b.date))}</time><span><strong>${hasFestPage(b.fest.id) ? `<a href="/f/${esc(b.fest.id)}/">${esc(b.fest.name)}</a>` : esc(b.fest.name)}</strong> · ${esc(setLine(b))}</span></li>`).join('\n')}
    </ul>
` : '';

  // 2. History by year, newest first. Archived rows carry their snapshot date.
  const byYear = new Map();
  for (const b of past) { const y = b.fest.year; if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(b); }
  const archived = past.some(b => b.published);
  const history = [...byYear.keys()].sort((x, y) => y - x).map(y => `    <h3>${y}</h3>
    <ul class="sets">
${byYear.get(y).map(b => `      <li><time datetime="${esc(b.date)}">${esc(dayLabel(b.date))}</time><span><strong>${hasFestPage(b.fest.id) ? `<a href="/f/${esc(b.fest.id)}/">${esc(b.fest.name)}</a>` : esc(b.fest.name)}</strong> · ${esc(setLine(b))}${b.published ? ` · <span class="pub">as published ${esc(dayLabel(b.published))}</span>` : ''}${b.partners.length ? ` <span class="with">with ${b.partners.map(link).join(', ')}</span>` : ''}</span></li>`).join('\n')}
    </ul>
`).join('');

  // 3. Billed partners (b2b and co-billed sets), most shared first.
  const pc = new Map();
  for (const b of bs) for (const p of b.partners) pc.set(p, (pc.get(p) || 0) + 1);
  const partners = [...pc].sort((x, y) => y[1] - x[1] || nameOf(x[0]).localeCompare(nameOf(y[0])));
  const also = [...(r.parents || []), ...(r.projects || [])].filter(k => k !== key);

  const photo = photoFor(key);
  const tile = `<div class="tile" aria-hidden="true">${esc((name.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase())}</div>`;
  const pic = photo
    ? `<figure class="pic"><img src="/${esc(photo.asset)}" alt="${esc(name)}" width="160" height="160" loading="eager"><figcaption>Photo: ${esc(photo.author)}, <a href="${esc(photo.sourceUrl)}" rel="noopener">source</a>, <a href="${esc(photo.licenseUrl)}" rel="noopener">${esc(photo.license.replace(/-/g, ' '))}</a>. ${esc(photo.changes || '')}</figcaption></figure>`
    : tile;
  const open = now.find(b => b.liveId && cfgOf.get(b.fest.id)?.available);
  const openHref = open ? `/?f=${esc(open.fest.id)}&amp;artist=${esc(open.liveId)}` : '/';

  const url = `${ORIGIN}/artists/${key}/`;
  const ld = { '@context': 'https://schema.org', '@type': 'MusicGroup', name, url };
  const events = now.filter(b => b.start).map(b => {
    const cfg = cfgOf.get(b.fest.id)?.config || {};
    const off = Number.isFinite(cfg.utcOffsetHours) ? cfg.utcOffsetHours : null;
    if (off == null || !cfg.location) return null;
    // A set after midnight belongs to the festival day it is billed on.
    const [h] = b.start.split(':').map(Number);
    const d = new Date(`${b.date}T00:00:00Z`); if (h < 8) d.setUTCDate(d.getUTCDate() + 1);
    const sign = off < 0 ? '-' : '+', oh = String(Math.floor(Math.abs(off))).padStart(2, '0'), om = String(Math.round((Math.abs(off) % 1) * 60)).padStart(2, '0');
    return { '@type': 'MusicEvent', name: `${name} at ${b.fest.name}`, startDate: `${d.toISOString().slice(0, 10)}T${b.start}:00${sign}${oh}:${om}`,
      eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: cfg.locationShort || cfg.location, address: cfg.location },
      performer: { '@type': 'MusicGroup', name } };
  }).filter(Boolean);
  if (events.length) ld.event = events;
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Plursky', item: `${ORIGIN}/` },
    { '@type': 'ListItem', position: 2, name: 'Artists', item: `${ORIGIN}/artists/` },
    { '@type': 'ListItem', position: 3, name, item: url }] };

  const body = `<main>
<div class="hero"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Plursky</a> › <a href="/artists/">Artists</a> › <span aria-current="page">${esc(name)}</span></nav>
  <div class="head">${pic}<div>
  <h1>${esc(name)}</h1>
  <p class="intro">${esc(intro)}</p>
${also.length ? `  <p class="note">Also billed as ${also.map(link).join(', ')}.</p>\n` : ''}  <p class="go"><a class="btn primary" href="${openHref}">Open in Plursky</a></p>
  </div></div>
</div></div>
<div class="wrap">
${block26 ? `  <section aria-labelledby="now-h">\n    <h2 id="now-h">${label26}</h2>\n${block26}  </section>\n` : ''}${upcoming ? `  <section aria-labelledby="next-h">\n    <h2 id="next-h">Upcoming</h2>\n${upcoming}  </section>\n` : ''}${history ? `  <section aria-labelledby="hist-h">\n    <h2 id="hist-h">Festival history in Plursky's records</h2>\n${history}  </section>\n` : ''}${partners.length ? `  <section aria-labelledby="with-h">\n    <h2 id="with-h">Billed with</h2>\n    <ul class="partners">\n${partners.map(([k, n]) => `      <li>${link(k)} <span class="note">${n} set${n === 1 ? '' : 's'}</span></li>`).join('\n')}\n    </ul>\n  </section>\n` : ''}${archived ? `  <p class="note foot">Past schedules are snapshots of the festivals' official pages as archived on the dates shown, not final schedules.</p>\n` : ''}  <footer><p><a href="/artists/">All artists</a> · <a href="/welcome/#festivals">All festivals</a> · <a href="https://apps.apple.com/us/app/plursky-live/id6768888507">Get the app</a></p></footer>
</div>
</main>`;
  return { title, desc: intro, url, ld: [ld, crumbs], body };
}

function link(k) { return onSite.has(k) ? `<a href="/artists/${esc(k)}/">${esc(nameOf(k))}</a>` : esc(nameOf(k)); }

function shell({ title, desc, url, ld, body }, lastmod) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta name="theme-color" content="#151C1D">
<link rel="stylesheet" href="/artists/artists.css">
${ld.map(x => `<script type="application/ld+json">\n${JSON.stringify(x, null, 2)}\n</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap"><a class="wordmark" href="/welcome/">PLURSKY<sup>®</sup></a><nav aria-label="Plursky"><a class="lnk" href="/artists/">Artists</a><a class="btn primary" href="https://apps.apple.com/us/app/plursky-live/id6768888507">Get the app</a></nav></div></header>
${body.replace('<footer><p>', `<footer>${lastmod ? `<p class="note">Last updated <time datetime="${lastmod}">${lastmod}</time>.</p>` : ''}<p>`)}
</body>
</html>
`;
}

function indexPage() {
  const groups = new Map();
  for (const k of pages) {
    const n = nameOf(k), c = (n.normalize('NFD').match(/[A-Za-z]/) || ['#'])[0].toUpperCase();
    const g = /[A-Z]/.test(c) && /^[^\p{L}]*[A-Za-z]/u.test(n.normalize('NFD')) ? c : '#';
    if (!groups.has(g)) groups.set(g, []); groups.get(g).push(k);
  }
  const order = [...groups.keys()].sort((x, y) => (x === '#') - (y === '#') || x.localeCompare(y));
  const body = `<main>
<div class="hero"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Plursky</a> › <span aria-current="page">Artists</span></nav>
  <h1>Artists</h1>
  <p class="intro">${pages.length} artists with a 2026 set time or billings at two or more festival editions in Plursky's records.</p>
  <nav class="letters" aria-label="Jump to letter">${order.map(g => `<a href="#l-${g === '#' ? 'num' : g}">${g}</a>`).join('')}</nav>
</div></div>
<div class="wrap">
${order.map(g => `  <section aria-labelledby="l-${g === '#' ? 'num' : g}">
    <h2 id="l-${g === '#' ? 'num' : g}">${g}</h2>
    <ul class="az">
${groups.get(g).sort((x, y) => nameOf(x).localeCompare(nameOf(y), 'en', { sensitivity: 'base' }) || x.localeCompare(y)).map(k => `      <li><a href="/artists/${esc(k)}/">${esc(nameOf(k))}</a></li>`).join('\n')}
    </ul>
  </section>`).join('\n')}
  <footer><p><a href="/welcome/#festivals">All festivals</a> · <a href="https://apps.apple.com/us/app/plursky-live/id6768888507">Get the app</a></p></footer>
</div>
</main>`;
  return { title: 'Festival artists and set times · Plursky', desc: `${pages.length} festival artists with their set times and festival history in Plursky's records.`,
    url: `${ORIGIN}/artists/`, ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Artists', url: `${ORIGIN}/artists/` }], body };
}

const CSS = `/* Generated by scripts/gen-artist-pages.mjs. The /f/ pages' print: Sora, charcoal paper, signal teal. */
@font-face { font-family:Sora; font-style:normal; font-weight:400 600; font-display:swap; src:url(/fonts/sora-latin.woff2) format("woff2"); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
@font-face { font-family:Sora; font-style:normal; font-weight:400 600; font-display:swap; src:url(/fonts/sora-latin-ext.woff2) format("woff2"); unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF; }
:root { color-scheme:dark; --paper:#151C1D; --paper-2:#1E2829; --ink:#F2F3EB; --text-2:#B9C4BE; --text-3:#A6B4AF; --line:rgba(242,243,235,.15); --line-2:rgba(242,243,235,.25);
        --signal:#88D7C8; --on-signal:#152624; --flare:#FFC545; --f-ui:Sora,-apple-system,BlinkMacSystemFont,'Helvetica Neue',system-ui,sans-serif; }
* { box-sizing:border-box; }
html { background:var(--paper); -webkit-text-size-adjust:100%; }
body { margin:0; background:var(--paper); color:var(--ink); font:400 16px/1.6 var(--f-ui); -webkit-font-smoothing:antialiased; overflow-x:hidden; }
:focus-visible { outline:2px solid var(--signal); outline-offset:3px; }
a { color:var(--signal); text-underline-offset:3px; }
.wrap { max-width:880px; margin:0 auto; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); }
.top { position:sticky; top:0; z-index:20; background:var(--paper); border-bottom:3px solid var(--signal); }
.top .wrap { display:flex; align-items:center; gap:16px; min-height:60px; }
.wordmark { color:var(--ink); font-weight:600; font-size:14px; letter-spacing:.14em; text-decoration:none; }
.wordmark sup { font-size:8px; letter-spacing:0; margin-left:2px; }
.top nav { margin-left:auto; display:flex; align-items:center; gap:22px; }
.top nav a.lnk { color:var(--text-2); text-decoration:none; font-size:12px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; }
.btn { display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:0 16px; border-radius:4px; border:1px solid var(--line-2); color:var(--ink); text-decoration:none; font-weight:600; font-size:13px; white-space:nowrap; }
.btn.primary { background:var(--signal); border-color:var(--signal); color:var(--on-signal); }
.hero { padding:28px 0 26px; border-bottom:1px solid var(--line); }
nav.crumbs { font-size:12px; color:var(--text-3); margin:0 0 18px; }
nav.crumbs a { color:var(--text-3); }
.head { display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap; }
.tile { width:120px; height:120px; flex:none; border-radius:8px; background:var(--paper-2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:52px; font-weight:600; color:var(--text-2); }
figure.pic { margin:0; width:160px; flex:none; }
figure.pic img { display:block; width:160px; height:160px; object-fit:cover; border-radius:8px; background:var(--paper-2); }
figure.pic figcaption { color:var(--text-3); font-size:11px; line-height:1.4; margin-top:6px; overflow-wrap:anywhere; }
h1 { font-size:clamp(30px,6vw,52px); font-weight:600; line-height:1.05; letter-spacing:-.02em; margin:0 0 12px; overflow-wrap:anywhere; }
.intro { font-size:18px; margin:0 0 8px; max-width:40ch; }
.go { margin:18px 0 0; }
.go .btn { min-height:48px; padding:0 20px; font-size:15px; }
h2 { font-size:clamp(21px,3vw,26px); font-weight:600; margin:44px 0 10px; padding-top:22px; border-top:1px solid var(--line); }
h2::before { content:""; display:block; width:28px; height:3px; background:var(--flare); margin:0 0 14px; }
h3 { font-size:18px; font-weight:600; margin:26px 0 6px; }
.note { color:var(--text-2); font-size:14px; }
.foot { margin-top:36px; }
ul.sets { list-style:none; padding:0; margin:4px 0 0; border-top:1px solid var(--line); }
ul.sets li { padding:9px 4px; border-bottom:1px solid var(--line); font-size:15px; display:flex; gap:14px; }
ul.sets li time { color:var(--text-3); font-size:13px; font-weight:500; font-variant-numeric:tabular-nums; min-width:104px; flex:none; padding-top:1px; }
.tz, .pub, .with { color:var(--text-2); font-size:13px; }
ul.partners { padding-left:18px; columns:2 220px; }
ul.partners li { padding:4px 0; break-inside:avoid; }
nav.letters { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
nav.letters a { min-width:36px; min-height:36px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--line); border-radius:4px; text-decoration:none; font-weight:600; font-size:14px; }
ul.az { list-style:none; padding:0; columns:3 200px; column-gap:24px; }
ul.az li { padding:4px 0; break-inside:avoid; font-size:15px; }
ul.az a { color:var(--ink); text-decoration:none; }
ul.az a:hover { color:var(--signal); text-decoration:underline; }
footer { margin-top:48px; padding-top:18px; border-top:1px solid var(--line); color:var(--text-2); font-size:14px; }
footer a { color:var(--text-2); }
@media (max-width:640px) { .top nav a.lnk { display:none; } .tile { width:84px; height:84px; font-size:38px; } figure.pic, figure.pic img { width:120px; } figure.pic img { height:120px; } }
`;

// ── Build, with a content-fingerprinted lastmod per page ─────────────
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
const nextLedger = {};
const files = new Map();
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const emitPage = (rel, model, k) => {
  const h = hash(shell(model, null));
  const prev = ledger[k];
  const lastmod = prev && prev.h === h ? prev.d : TODAY;
  nextLedger[k] = { h, d: lastmod };
  files.set(rel, shell(model, lastmod));
  return lastmod;
};
const rows = [];
rows.push([`${ORIGIN}/artists/`, emitPage('index.html', indexPage(), '_index')]);
for (const k of pages) rows.push([`${ORIGIN}/artists/${k}/`, emitPage(`${k}/index.html`, artistPage(k), k)]);
files.set('artists.css', CSS);
files.set('lastmod.json', JSON.stringify(nextLedger, null, 0).replace(/},"/g, '},\n"') + '\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}
</urlset>
`;

if (CHECK) {
  // In --check, a page whose content is unchanged keeps its committed lastmod,
  // so any difference is a real one.
  let bad = 0;
  const want = new Set([...files.keys()]);
  for (const [rel, body] of files) {
    const p = path.join(OUT, rel);
    if (!existsSync(p) || readFileSync(p, 'utf8') !== body) { if (bad++ < 5) console.error(`[artists] ✗ stale: artists/${rel}`); }
  }
  if (existsSync(OUT)) for (const d of readdirSync(OUT, { withFileTypes: true })) {
    if (d.isDirectory() && !want.has(`${d.name}/index.html`)) { if (bad++ < 5) console.error(`[artists] ✗ orphan: artists/${d.name}/`); }
  }
  const sm = path.join(ROOT, 'sitemap-artists.xml');
  if (!existsSync(sm) || readFileSync(sm, 'utf8') !== sitemap) { bad++; console.error('[artists] ✗ stale: sitemap-artists.xml'); }
  if (bad) { console.error(`[artists] ✗ ${bad} file(s) differ. Run: node scripts/gen-artist-pages.mjs`); process.exit(1); }
  console.log(`[artists] ✓ ${pages.length} artist pages + index + sitemap are current`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const want = new Set([...files.keys()].map(r => r.split('/')[0]));
for (const d of readdirSync(OUT, { withFileTypes: true })) if (d.isDirectory() && !want.has(d.name)) rmSync(path.join(OUT, d.name), { recursive: true });
for (const [rel, body] of files) { const p = path.join(OUT, rel); mkdirSync(path.dirname(p), { recursive: true }); if (!existsSync(p) || readFileSync(p, 'utf8') !== body) writeFileSync(p, body); }
writeFileSync(path.join(ROOT, 'sitemap-artists.xml'), sitemap);
console.log(`[artists] ${pages.length} artist pages + index · not generated: ${skipped['under review']} under review, ${skipped['one edition, no timed 2026 set']} with one edition and no timed 2026 set`);
