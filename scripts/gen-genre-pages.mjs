#!/usr/bin/env node
// Genre hub pages, /genres/ and /genres/<slug>/ (SPEC-206 A).
//
//   node scripts/gen-genre-pages.mjs          write genres/, sitemap-genres.xml
//   node scripts/gen-genre-pages.mjs --check  exit 1 when anything differs from a fresh build
//
// Ruling (Jake, 2026-11-15): Part A ships EDC only. Genres come only from
// Plursky's own lineup data, never invented and never from a third-party
// guide. A festival whose genre fields are not part of that ruling gets no hub
// entry and no sitemap row. So GENRE_FESTIVALS is an allowlist, not a scan:
// other data sets carry genre strings, but their source is not recorded, and
// adding one here needs a ruling first.
//
// Rules (asserted by scripts/test-genre-pages.mjs):
//   1. An act's genre string "A / B" counts toward A and toward B; an act with
//      no genre is never assigned one.
//   2. A genre gets a page only with MIN_ACTS distinct acts or more; smaller
//      genres are listed on the index without a page.
//   3. Festivals on a genre page rank by that genre's act count.
//   4. Every page carries "Festival sources last checked on <date>" from
//      checkedOn(), the same predicate the /f/ pages use.
//   6. The intro names exactly the lineups the page counts.
//   5. <lastmod> moves only when a page's content changes (genres/lastmod.json).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadRegistry } from './lib/load-registry.mjs';
import { checkedOn } from './lib/festival-page-data.mjs';

const GENRE_FESTIVALS = ['edc-lv-2026'];
const MIN_ACTS = 3;
const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');
const ORIGIN = 'https://plursky.com';
const OUT = path.join(ROOT, 'genres');
const TODAY = new Date().toISOString().slice(0, 10);

const { REG, DS } = loadRegistry(ROOT);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = g => g.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const splitGenre = s => String(s || '').split(/\s*\/\s*/).map(x => x.trim()).filter(x => x && x !== '—' && x !== '-');

// genre -> festival id -> Set of act names
const tally = new Map(), label = new Map();
for (const fid of GENRE_FESTIVALS) {
  for (const a of DS[fid]?.artists || []) for (const g of splitGenre(a.genre)) {
    const k = slug(g); if (!k) continue;
    if (!label.has(k)) label.set(k, g);
    if (!tally.has(k)) tally.set(k, new Map());
    const m = tally.get(k); if (!m.has(fid)) m.set(fid, new Set()); m.get(fid).add(a.name);
  }
}
const acts = k => new Set([...tally.get(k).values()].flatMap(s => [...s])).size;
const genres = [...tally.keys()].sort((x, y) => acts(y) - acts(x) || label.get(x).localeCompare(label.get(y)));
const paged = genres.filter(k => acts(k) >= MIN_ACTS);
const cfgOf = id => REG.find(e => e.config.id === id)?.config || {};
const stampOf = ids => ids.map(id => checkedOn(cfgOf(id))).filter(Boolean).sort().pop() || null;
// The date is the NEWEST read of a festival source (site, lineup, schedule,
// map), not of the genre tags (Plursky's own), and older sources were read
// earlier, so it says "last checked", never "checked against the sources".
const stampHtml = d => d ? `  <p class="checked">Festival sources last checked on <time datetime="${d}">${d}</time>; each festival's page lists its sources.</p>\n` : '';
// Name exactly the lineups a page counts, never a vaguer "festival lineups".
const namesOf = ids => { const n = ids.map(id => cfgOf(id).name); return n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`; };
const lineupOf = ids => `the ${namesOf(ids)} lineup${ids.length === 1 ? '' : 's'}`;

// Other data sets DO carry genre strings; they are left out because their
// genre source is not recorded (Instinct #481 review), so never say "not tagged".
const NOTE = `Genres here are Plursky's own tags on the ${GENRE_FESTIVALS.map(id => esc(cfgOf(id).name)).join(', ')} lineup. Only ${GENRE_FESTIVALS.map(id => esc(cfgOf(id).name)).join(', ')} is included; genre tags for other festivals have not been source-verified for these pages.`;
const CSS = `<style>
  :root { color-scheme:dark; --paper:#151C1D; --paper-2:#1E2829; --ink:#F2F3EB; --text-2:#B9C4BE; --text-3:#A6B4AF; --line:rgba(242,243,235,.15); --signal:#88D7C8; --flare:#FFC545;
          --f-ui:Sora,-apple-system,BlinkMacSystemFont,'Helvetica Neue',system-ui,sans-serif; }
  @font-face { font-family:Sora; font-style:normal; font-weight:400 600; font-display:swap; src:url(/fonts/sora-latin.woff2) format("woff2"); }
  * { box-sizing:border-box; } html { background:var(--paper); -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--paper); color:var(--ink); font:400 16px/1.6 var(--f-ui); -webkit-font-smoothing:antialiased; overflow-x:hidden; }
  a { color:var(--signal); text-underline-offset:3px; }
  .wrap { max-width:880px; margin:0 auto; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); }
  .top { border-bottom:3px solid var(--signal); } .top .wrap { display:flex; align-items:center; min-height:60px; }
  .wordmark { color:var(--ink); font-weight:600; font-size:14px; letter-spacing:.14em; text-decoration:none; } .wordmark sup { font-size:8px; }
  .top nav { margin-left:auto; } .btn { display:inline-flex; align-items:center; min-height:40px; padding:0 16px; border-radius:4px; background:var(--signal); color:#152624; text-decoration:none; font-weight:600; font-size:13px; }
  .hero { padding:28px 0 22px; border-bottom:1px solid var(--line); }
  nav.crumbs { font-size:12px; color:var(--text-3); margin:0 0 18px; } nav.crumbs a { color:var(--text-3); }
  h1 { font-size:clamp(30px,6vw,52px); font-weight:600; line-height:1.05; letter-spacing:-.02em; margin:0 0 12px; }
  .intro { font-size:18px; margin:0 0 8px; max-width:44ch; } .checked, .note { color:var(--text-2); font-size:14px; }
  h2 { font-size:clamp(21px,3vw,26px); font-weight:600; margin:40px 0 10px; padding-top:22px; border-top:1px solid var(--line); }
  h2::before { content:""; display:block; width:28px; height:3px; background:var(--flare); margin:0 0 14px; }
  ol.rank, ul.acts, ul.genres { padding-left:22px; } ul.acts { columns:2 200px; column-gap:24px; } ul.genres { columns:2 220px; }
  li { padding:4px 0; break-inside:avoid; } .n { color:var(--text-2); font-size:14px; }
  footer { margin-top:48px; padding-top:18px; border-top:1px solid var(--line); color:var(--text-2); font-size:14px; } footer a { color:var(--text-2); }
</style>`;

function shell({ title, desc, url, ld, body }, lastmod) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Plursky">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${ORIGIN}/og-card.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151C1D">
${CSS}
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body>
<header class="top"><div class="wrap"><a class="wordmark" href="/welcome/">PLURSKY<sup>®</sup></a><nav aria-label="Plursky"><a class="btn" href="https://apps.apple.com/us/app/plursky-live/id6768888507">Get the app</a></nav></div></header>
${body}
<footer class="wrap">${lastmod ? `<p>Last updated <time datetime="${lastmod}">${lastmod}</time>.</p>` : ''}<p><a href="/genres/">All genres</a> · <a href="/welcome/#festivals">All festivals</a></p></footer>
</body>
</html>
`;
}

function genrePage(k) {
  const g = label.get(k), m = tally.get(k);
  const ranked = [...m].sort((x, y) => y[1].size - x[1].size || cfgOf(x[0]).name.localeCompare(cfgOf(y[0]).name));
  const n = acts(k);
  const url = `${ORIGIN}/genres/${k}/`;
  const body = `<main>
<div class="hero"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Plursky</a> › <a href="/genres/">Genres</a> › <span aria-current="page">${esc(g)}</span></nav>
  <h1>${esc(g)}</h1>
  <p class="intro">${n} ${esc(g)} act${n === 1 ? '' : 's'} on ${esc(lineupOf(ranked.map(r => r[0])))}, by Plursky's own genre tags.</p>
${stampHtml(stampOf(ranked.map(r => r[0])))}</div></div>
<div class="wrap">
  <section aria-labelledby="fest-h">
    <h2 id="fest-h">Where ${esc(g)} acts are billed</h2>
    <ol class="rank">
${ranked.map(([fid, s]) => `      <li><a href="/f/${esc(fid)}/">${esc(cfgOf(fid).name)}</a> <span class="n">${s.size} act${s.size === 1 ? '' : 's'}</span></li>`).join('\n')}
    </ol>
  </section>
${ranked.map(([fid, s]) => `  <section aria-labelledby="acts-${esc(fid)}">
    <h2 id="acts-${esc(fid)}">${esc(g)} at ${esc(cfgOf(fid).name)}</h2>
    <ul class="acts">
${[...s].sort((x, y) => x.localeCompare(y, 'en', { sensitivity: 'base' })).map(a => `      <li>${esc(a)}</li>`).join('\n')}
    </ul>
  </section>`).join('\n')}
  <p class="note">${NOTE}</p>
</div>
</main>`;
  return { title: `${g} acts at festivals · Plursky`, desc: `${n} ${g} acts on ${lineupOf(ranked.map(r => r[0]))}, by Plursky's own genre tags.`, url,
    ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${g} at festivals`, url }, body };
}

function indexPage() {
  const body = `<main>
<div class="hero"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Plursky</a> › <span aria-current="page">Genres</span></nav>
  <h1>Genres</h1>
  <p class="intro">${genres.length} genres on ${esc(lineupOf(GENRE_FESTIVALS))}, by Plursky's own genre tags.</p>
${stampHtml(stampOf(GENRE_FESTIVALS))}</div></div>
<div class="wrap">
  <section aria-labelledby="g-h">
    <h2 id="g-h">All genres</h2>
    <ul class="genres">
${genres.map(k => `      <li>${paged.includes(k) ? `<a href="/genres/${k}/">${esc(label.get(k))}</a>` : esc(label.get(k))} <span class="n">${acts(k)} act${acts(k) === 1 ? '' : 's'}</span></li>`).join('\n')}
    </ul>
    <p class="note">Genres with fewer than ${MIN_ACTS} acts are listed without a page.</p>
  </section>
  <p class="note">${NOTE}</p>
</div>
</main>`;
  return { title: 'Festival genres · Plursky', desc: `${genres.length} genres on ${lineupOf(GENRE_FESTIVALS)}, by Plursky's own genre tags.`, url: `${ORIGIN}/genres/`,
    ld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Genres', url: `${ORIGIN}/genres/` }, body };
}

const LEDGER = path.join(OUT, 'lastmod.json');
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
const next = {}, files = new Map(), rows = [];
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const emit = (rel, model, k) => {
  const h = hash(shell(model, null)), d = ledger[k]?.h === h ? ledger[k].d : TODAY;
  next[k] = { h, d }; files.set(rel, shell(model, d)); rows.push([model.url, d]);
};
emit('index.html', indexPage(), '_index');
for (const k of paged) emit(`${k}/index.html`, genrePage(k), k);
files.set('lastmod.json', JSON.stringify(next, null, 1) + '\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}
</urlset>
`;

if (CHECK) {
  let bad = 0;
  for (const [rel, body] of files) { const p = path.join(OUT, rel); if (!existsSync(p) || readFileSync(p, 'utf8') !== body) { bad++; console.error(`[genres] ✗ stale: genres/${rel}`); } }
  if (existsSync(OUT)) for (const d of readdirSync(OUT, { withFileTypes: true })) if (d.isDirectory() && !files.has(`${d.name}/index.html`)) { bad++; console.error(`[genres] ✗ orphan: genres/${d.name}/`); }
  const sm = path.join(ROOT, 'sitemap-genres.xml');
  if (!existsSync(sm) || readFileSync(sm, 'utf8') !== sitemap) { bad++; console.error('[genres] ✗ stale: sitemap-genres.xml'); }
  if (bad) { console.error(`[genres] ✗ ${bad} file(s) differ. Run: node scripts/gen-genre-pages.mjs`); process.exit(1); }
  console.log(`[genres] ✓ ${paged.length} genre pages + index + sitemap are current`);
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });
for (const d of readdirSync(OUT, { withFileTypes: true })) if (d.isDirectory() && !files.has(`${d.name}/index.html`)) rmSync(path.join(OUT, d.name), { recursive: true });
for (const [rel, body] of files) { const p = path.join(OUT, rel); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, body); }
writeFileSync(path.join(ROOT, 'sitemap-genres.xml'), sitemap);
console.log(`[genres] ${genres.length} genres from ${GENRE_FESTIVALS.join(', ')}: ${paged.length} pages (${MIN_ACTS}+ acts), ${genres.length - paged.length} listed without a page`);
