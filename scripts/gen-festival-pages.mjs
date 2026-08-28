#!/usr/bin/env node
// Generates the crawlable per-festival stubs at /f/<id>/index.html, plus
// sitemap.xml, by reading FESTIVALS_REGISTRY + _DATA_SETS straight out of
// data.jsx. Run it whenever a lineup or a registry entry changes:
//
//     node scripts/gen-festival-pages.mjs
//
// Why generated and not hand-written: plursky.com is a client-rendered SPA on
// GitHub Pages, so crawlers see an empty #root. These stubs are the only real
// HTML a crawler can index for a festival. Keeping them derived from data.jsx
// means a new festival in the registry gets a page, a sitemap entry and JSON-LD
// for free, and an edited lineup never leaves a stale page behind.
//
// data.jsx is a browser script (top-level consts + a window export), so it is
// evaluated in a VM with a window shim rather than imported.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://plursky.com';
const OUT_DIR = path.join(root, 'f');

// ── Load the registry out of data.jsx ────────────────────────────────
const ctx = {
  window: {}, console, Date, Math, JSON, Object, Array, String, Number,
  isNaN, parseInt, parseFloat, fetch: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
vm.createContext(ctx);
// Wave-1 festivals live in data/festivals/*.js and register themselves on
// window.PLURSKY_FESTIVALS. Run them first, the same order index.html uses, or
// the registry data.jsx builds here is missing five festivals and their /f/
// pages silently stop being generated.
const festivalModules = readdirSync(path.join(root, 'data', 'festivals'))
  .filter(f => f.endsWith('.js')).sort()
  .map(f => readFileSync(path.join(root, 'data', 'festivals', f), 'utf8'))
  .join('\n');
vm.runInContext(
  festivalModules + '\n' +
  readFileSync(path.join(root, 'data.jsx'), 'utf8') +
  '\n;__out = { REG: FESTIVALS_REGISTRY, DS: _DATA_SETS };',
  ctx,
);
const { REG, DS } = ctx.__out;

// ── Helpers ──────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MONTHS = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };

// Parse the registry's VISIBLE `dates` string ("Sep 18–20, 2026",
// "Oct 2–4 & 9–11, 2026"). Deliberately not startMs/endMs or dayDates:
//   - endMs is the close time, which lands a day past the last festival day
//   - Lost Lands' dayDates starts on early-entry Sep 16 while the public
//     dates are Sep 18–20
//   - ACL's dayDates covers weekend 1 only
//   - the two preview entries have neither
// schema.org also wants JSON-LD dates to match what the page visibly says,
// and `dates` IS what the page says. dayDates is the fallback.
function eventDates(cfg) {
  const m = /^([A-Z][a-z]{2}) (\d+)[–-](\d+)(?: & (\d+)[–-](\d+))?, (\d{4})$/.exec(cfg.dates || '');
  if (m) {
    const mo = String(MONTHS[m[1]]).padStart(2, '0'), y = m[6];
    return {
      start: `${y}-${mo}-${String(m[2]).padStart(2, '0')}`,
      end:   `${y}-${mo}-${String(m[5] || m[3]).padStart(2, '0')}`,
    };
  }
  const dd = cfg.dayDates && Object.values(cfg.dayDates);
  if (dd && dd.length) {
    const f = (d) => `${d.y}-${String(d.m + 1).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    return { start: f(dd[0]), end: f(dd[dd.length - 1]) };
  }
  return null;
}

const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','Nevada','Texas','California','Florida','Michigan','Ohio']);

// "Legend Valley · Thornville, OH" -> venue + PostalAddress parts.
// `entry.region` supplies the country when the location string omits it
// ("Tinker Field · Orlando" gives a locality but no country).
function place(cfg, region) {
  const [venueRaw, whereRaw] = String(cfg.location || '').split('·').map(s => (s || '').trim());
  const venue = venueRaw || cfg.locationShort || cfg.name;
  const parts = (whereRaw || '').split(',').map(s => s.trim()).filter(Boolean);
  const addr = {};
  if (parts.length >= 2) {
    addr.addressLocality = parts[0];
    const tail = parts[1];
    if (US_STATES.has(tail)) { addr.addressRegion = tail; addr.addressCountry = 'US'; }
    else addr.addressCountry = tail;
  } else if (parts.length === 1) {
    if (US_STATES.has(parts[0])) { addr.addressRegion = parts[0]; addr.addressCountry = 'US'; }
    else addr.addressLocality = parts[0];
  }
  if (!addr.addressCountry && region === 'North America') addr.addressCountry = 'US';
  return { venue, addr };
}

const TODAY = new Date().toISOString().slice(0, 10);

// ── Page template ────────────────────────────────────────────────────
function stub(entry) {
  const cfg = entry.config;
  const id = cfg.id;
  const url = `${ORIGIN}/f/${id}/`;
  const ds = DS[id];
  const artists = (ds?.artists || []);
  // De-duplicate by NAME: the same act can hold several set slots.
  const names = [...new Set(artists.map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const dates = eventDates(cfg);
  const { venue, addr } = place(cfg, entry.region);
  const isPast = dates ? dates.end < TODAY : false;
  const where = cfg.location || '';

  const desc = names.length
    ? `${cfg.name} lineup — ${names.length} artists at ${venue}, ${cfg.dates}. Build your schedule, map the stages and share your weekend with Plursky.`
    : `${cfg.name} at ${venue}, ${cfg.dates}. Build your schedule, map the stages and share your weekend with Plursky.`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MusicFestival',
    name: cfg.name,
    url,
    ...(dates ? { startDate: dates.start, endDate: dates.end } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: desc,
    location: { '@type': 'Place', name: venue, ...(Object.keys(addr).length ? { address: { '@type': 'PostalAddress', ...addr } } : {}) },
    // performer is emitted ONLY when the names are also visible on the page
    // below — structured data that isn't in the rendered content is a
    // Google structured-data violation.
    ...(names.length ? { performer: names.map(n => ({ '@type': 'MusicGroup', name: n })) } : {}),
    ...(cfg.brand ? { organizer: { '@type': 'Organization', name: cfg.brand } } : {}),
  };

  const lineupSection = names.length ? `
  <section aria-labelledby="lineup-h">
    <h2 id="lineup-h">${esc(cfg.name)} lineup</h2>
    <p>${names.length} artists announced.</p>
    <ul class="lineup">
${names.map(n => `      <li>${esc(n)}</li>`).join('\n')}
    </ul>
${cfg.setTimesProvisional ? `    <p class="note">Stage assignments and set times for ${esc(cfg.name)} have not been published yet. Plursky adds the official schedule as soon as it drops.</p>` : ''}
  </section>` : `
  <section>
    <h2>${esc(cfg.name)} lineup</h2>
    <p>The ${esc(cfg.name)} lineup has not been announced yet. Plursky adds it as soon as it drops.</p>
  </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cfg.name)} — Lineup, Map &amp; Schedule · Plursky</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Plursky">
<meta property="og:title" content="${esc(cfg.name)} — Lineup, Map &amp; Schedule">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/og-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(cfg.name)} — Lineup, Map &amp; Schedule">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ORIGIN}/og-card.png">
<link rel="icon" type="image/png" href="/apple-touch-icon.png">
<style>
  :root { --ink:#f7ede0; --bg:#12100e; --muted:rgba(247,237,224,0.62); --line:rgba(247,237,224,0.14); --ember:#e85d2e; }
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:var(--bg); color:var(--ink);
         font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; line-height:1.6; }
  main { max-width:760px; margin:0 auto; }
  h1 { font-size:clamp(26px,5vw,40px); line-height:1.15; margin:0 0 8px; }
  h2 { font-size:18px; margin:32px 0 8px; }
  .meta { color:var(--muted); margin:0 0 20px; }
  .note { color:var(--muted); font-size:14px; }
  .cta { display:inline-block; margin:20px 0 8px; padding:12px 22px; border-radius:12px;
         background:linear-gradient(135deg,#6D28D9,var(--ember)); color:#fff; text-decoration:none; font-weight:700; }
  ul.lineup { list-style:none; padding:0; margin:12px 0 0;
              display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:2px 16px; }
  ul.lineup li { padding:3px 0; border-bottom:1px solid var(--line); font-size:14px; }
  nav.other { margin-top:40px; }
  nav.other a { color:var(--ink); }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:14px; }
  a { color:var(--ember); }
</style>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body>
<main>
  <h1>${esc(cfg.name)}</h1>
  <p class="meta">${esc(cfg.dates)}${where ? ' · ' + esc(where) : ''}${isPast ? ' · This festival has ended.' : ''}</p>
  <p>${esc(cfg.tagline || '')}</p>

  <a class="cta" href="/?f=${esc(id)}">${entry.available ? (isPast ? 'Relive it in Plursky' : 'Plan your weekend in Plursky') : 'Open Plursky'}</a>
  <p class="note">Plursky is a free festival companion — build a personal schedule from the official lineup, find stages on a live map, meet your crew, and turn the weekend into a shareable recap.</p>
${entry.available ? '' : `  <p class="note">${esc(cfg.name)} is not switchable in the app yet — it goes live once the official schedule is published. The link above opens Plursky on the current festival.</p>`}
${lineupSection}

  <nav class="other" aria-labelledby="other-h">
    <h2 id="other-h">Other festivals on Plursky</h2>
    <ul>
${REG.filter(f => f.config.id !== id).map(f => `      <li><a href="/f/${f.config.id}/">${esc(f.config.name)}</a> — ${esc(f.config.dates)}</li>`).join('\n')}
    </ul>
  </nav>

  <footer>
    <a href="/">Plursky</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a>
  </footer>
</main>
</body>
</html>
`;
}

// ── Emit ─────────────────────────────────────────────────────────────
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const rows = [];
for (const entry of REG) {
  const id = entry.config.id;
  const dir = path.join(OUT_DIR, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), stub(entry));
  const n = new Set((DS[id]?.artists || []).map(a => a.name)).size;
  const d = eventDates(entry.config);
  rows.push({ id, artists: n, dates: d ? `${d.start}..${d.end}` : 'NO DATES' });
  console.log(`[gen] f/${id}/index.html  artists=${n}  ${d ? d.start + '..' + d.end : 'NO DATES'}`);
}

// sitemap — generated here so it can never drift from the pages above.
const urls = [
  { loc: `${ORIGIN}/`, pri: '1.0' },
  ...REG.map(f => ({ loc: `${ORIGIN}/f/${f.config.id}/`, pri: '0.8' })),
  { loc: `${ORIGIN}/terms.html`, pri: '0.3' },
  { loc: `${ORIGIN}/privacy.html`, pri: '0.3' },
];
writeFileSync(path.join(root, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`);
console.log(`[gen] sitemap.xml  ${urls.length} urls`);
// index.html carries the same festival list twice (static shell + <noscript>).
// Regenerate both between their markers so adding a festival to the registry
// can never leave the homepage listing a stale set.
const INDEX = path.join(root, 'index.html');
let idx = readFileSync(INDEX, 'utf8');
const listHtml = (indent) => REG.map(f =>
  `${indent}<li><a href="/f/${f.config.id}/">${esc(f.config.name)}</a> — ${esc(f.config.dates)} · ${esc(f.config.location || '')}</li>`
).join('\n');

for (const [marker, indent] of [['FESTIVAL-LIST', '        '], ['NOSCRIPT-LIST', '        ']]) {
  const re = new RegExp(`(<!-- ${marker}:START -->)[\\s\\S]*?(<!-- ${marker}:END -->)`);
  if (!re.test(idx)) throw new Error(`index.html is missing the ${marker} markers`);
  idx = idx.replace(re, `$1\n${listHtml(indent)}\n${indent}$2`);
}
writeFileSync(INDEX, idx);
console.log(`[gen] index.html festival lists refreshed (${REG.length} entries x2)`);

console.log(`[gen] done — ${rows.length} festival pages`);
