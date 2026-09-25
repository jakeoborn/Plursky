#!/usr/bin/env node
// Gate: the /f/<id>/ festival pages say what the data proves, and all of it.
//
//   - every registry festival has a page, and a page with no lineup is noindex
//     and out of the sitemap (an indexable one is in it);
//   - the map section exists iff there is a Plursky plate or a recorded
//     official map page, and the only image on a page is OUR plate — never
//     patron-map art and never festival card art;
//   - a plate numbers every stage that has a position, keys each one, and
//     names any stage it cannot show;
//   - no walk time, distance, leave-by or transition verdict appears on a page
//     whose geometry geometryVerifiedFor() does not verify;
//   - every lineup name in the data is on the page, every set row the data
//     implies is in the grid (per weekend), every lineup link lands on a row;
//   - JSON-LD parses, and its dates are the dates the page shows.
//
// The checks run per page through checkPage(). The same function then meets
// the three mutations the spec names plus the card-art ruling, in memory — an
// embedded official map, festival card art, a dropped act, a walk-time
// sentence — and each has to be caught, so the gate cannot pass by checking
// nothing.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';
import { loadBrowser } from './lib/load-browser.mjs';
import { plateFor, isPlaceholderStage, MAX_PAGE_IMAGE_BYTES } from './lib/festival-page-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const F_DIR = join(ROOT, 'f');

let checks = 0, failed = 0;
const fail = (msg) => { checks++; failed++; console.log(`  ✗  ${msg}`); };
const ok = () => { checks++; };

const decode = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const visibleText = (html) => decode(
  html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
).replace(/\s+/g, ' ').trim();
const section = (html, hid) => {
  const i = html.indexOf(`id="${hid}"`);
  if (i === -1) return null;
  const j = html.indexOf('</section>', i);
  return html.slice(i, j === -1 ? undefined : j);
};

const { REG, DS, scheduleActs, eventDates, weekendShifts, actPlaysWeekend } = loadRegistry(ROOT);
const wc = loadBrowser(ROOT);
if (typeof wc.geometryVerifiedFor !== 'function') {
  console.log('  ✗  HARNESS DEAD: map.jsx must expose geometryVerifiedFor');
  process.exit(1);
}
if (!existsSync(F_DIR) || REG.length < 5) {
  console.log(`  ✗  HARNESS DEAD: f/ missing or registry has ${REG.length} festivals`);
  process.exit(1);
}
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');

// Positional claims a page may make only on verified geometry.
const POSITIONAL = [
  /\b\d+\s*(?:-\s*)?min(?:ute)?s?\s+walk/i, /\bwalk(?:ing)?\s+time/i, /\bwalk\b[^.]{0,30}\bmin/i,
  /\bleave[- ]by\b/i, /\btight\s+transition/i, /\btransition\s+is\s+(?:tight|easy|comfortable)/i,
  /\b\d+(?:\.\d+)?\s*(?:m|km|mi|miles?|meters?|metres?|feet|ft|yards?)\s+(?:away|from|to)\b/i,
  /\bdistance\s+(?:from|to|between)\b/i,
];

// Official patron-map art anywhere in the registry: never an <img> on a page.
const OFFICIAL_ART = new Set(REG.map(e => e.config.mapImage).filter(f => f && !/\.svg$/i.test(f)));

// Rows the set-times grid must hold: one per act per weekend it plays.
function expectedSetRows(cfg) {
  const timed = scheduleActs(DS[cfg.id]?.artists).filter(a => a.start);
  const shifts = weekendShifts(cfg);
  if (shifts.length > 1) return shifts.reduce((n, s) => n + timed.filter(a => actPlaysWeekend(a, s.weekend)).length, 0);
  return timed.length;
}

function checkPage(entry, html, { verified }) {
  const out = [];
  const cfg = entry.config, id = cfg.id;
  const names = [...new Set((DS[id]?.artists || []).map(a => a.name).filter(Boolean))];
  const text = visibleText(html);

  // Index state.
  const noindex = /<meta name="robots" content="noindex">/.test(html);
  if (noindex !== (names.length === 0)) out.push(`noindex=${noindex} but the lineup has ${names.length} names`);

  // Map section iff a plate or an official map page.
  const plate = plateFor(cfg, ROOT);
  const wantMap = !!plate || !!(cfg.mapSource && cfg.mapSource.url);
  const hasMap = /id="map-h"/.test(html);
  if (hasMap !== wantMap) out.push(`map section present=${hasMap}, expected ${wantMap} (plate=${!!plate}, mapSource=${!!cfg.mapSource})`);
  const mapSec = section(html, 'map-h') || '';
  if (/\bmap of\b/i.test(visibleText(mapSec))) out.push('map section says "map of"');

  // Images: our own plate and nothing else. Official festival photos were
  // removed by lane ruling: PROVENANCE.md records where card art came from,
  // not a right to republish it, so festival-art/ never reaches a public page
  // (in-app card art is unaffected).
  const allowed = new Set([plate && `/${plate.file}`].filter(Boolean));
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const src = (/\bsrc="([^"]*)"/.exec(tag) || [])[1] || '';
    const file = src.replace(/^\//, '');
    if (OFFICIAL_ART.has(file)) out.push(`embeds official map art ${src}`);
    if (/^festival-art\//.test(file)) out.push(`embeds festival card art ${src}`);
    if (!allowed.has(src)) out.push(`image ${src} is not this festival's own plate`);
    if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) out.push(`image ${src} has no width/height`);
    if (existsSync(join(ROOT, file)) && statSync(join(ROOT, file)).size > MAX_PAGE_IMAGE_BYTES) out.push(`image ${src} is over the page image budget`);
    if (plate && src === `/${plate.file}` && !/\bloading="lazy"/.test(tag)) out.push('plate image is not lazy');
  }

  // Plate: a numbered marker per positioned stage, a key, and the unplaced named.
  if (plate) {
    const stages = (DS[id]?.stages || []).filter(s => !isPlaceholderStage(s));
    const placed = stages.filter(s => s.x != null && s.y != null);
    const pins = (mapSec.match(/class="pin"/g) || []).length;
    if (pins !== placed.length) out.push(`plate has ${pins} markers for ${placed.length} positioned stages`);
    const key = /<ol class="platekey">([\s\S]*?)<\/ol>/.exec(mapSec);
    const keyed = key ? [...key[1].matchAll(/<li>(.*?)<\/li>/g)].map(x => decode(x[1])) : [];
    if (keyed.join('|') !== placed.map(s => s.name).join('|')) out.push('plate key does not list the positioned stages in marker order');
    const caption = visibleText((/<figcaption>([\s\S]*?)<\/figcaption>/.exec(mapSec) || [])[1] || '');
    if (!caption.startsWith(plate.desc)) out.push('plate caption is not the plate\'s own <desc>');
    for (const s of stages.filter(s => s.x == null || s.y == null)) {
      if (!caption.includes(s.name)) out.push(`stage ${s.name} has no position and the caption does not say so`);
    }
  }

  // Positional claims.
  if (!verified) {
    const hit = POSITIONAL.find(p => p.test(text));
    if (hit) out.push(`positional claim ${hit} on unverified geometry`);
  }

  // Lineup: every name, once, in its own row.
  const lineup = section(html, 'lineup-h') || '';
  const acts = [...lineup.matchAll(/<span class="act">(.*?)<\/span>/g)].map(x => decode(x[1]));
  const missing = names.filter(n => !acts.includes(n));
  if (missing.length) out.push(`lineup is missing ${missing.length} act(s), e.g. ${missing[0]}`);
  if (acts.length !== new Set(acts).size) out.push('lineup repeats a name');
  if (/Schedule TBA/.test(visibleText(lineup))) out.push('lineup shows the placeholder stage');
  // A one-day (or absent) dayDates is a bucket, not a published day split.
  // Read off the slot text, where a day would print, for ANY date shape: a
  // one-day bucket's name is itself a range ("Oct 16–17").
  const slotText = [...lineup.matchAll(/<span class="slots">(.*?)<\/span>/g)].map(x => visibleText(x[1])).join(' ');
  if (Object.keys(cfg.dayDates || {}).length <= 1
      && /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}\b/.test(slotText)) {
    out.push('lineup shows a day for a festival with no day split');
  }

  // Set times: the right number of rows, unique anchors, every lineup link lands.
  const ids = [...html.matchAll(/<li id="(set-[^"]+)"/g)].map(x => x[1]);
  const want = expectedSetRows(cfg);
  if (ids.length !== want) out.push(`set-time grid has ${ids.length} rows, data implies ${want}`);
  if (ids.length !== new Set(ids).size) out.push('set-time anchors are not unique');
  const idSet = new Set(ids);
  const dangling = [...lineup.matchAll(/href="#(set-[^"]+)"/g)].map(x => x[1]).filter(x => !idSet.has(x));
  if (dangling.length) out.push(`${dangling.length} lineup link(s) land nowhere, e.g. #${dangling[0]}`);

  // JSON-LD parses; its dates are the visible dates.
  const lds = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(m => {
    try { return JSON.parse(m[1]); } catch { out.push('a JSON-LD block does not parse'); return null; }
  }).filter(Boolean);
  const ev = lds.find(d => d['@type'] === 'MusicEvent');
  const d = eventDates(cfg);
  if (!ev) out.push('no MusicEvent JSON-LD');
  else if (d && (ev.startDate !== d.start || ev.endDate !== d.end)) out.push(`JSON-LD dates ${ev.startDate}..${ev.endDate} are not the visible ${d.start}..${d.end}`);
  if (!text.includes(decode(cfg.dates))) out.push('the visible dates string is not on the page');
  if (!lds.some(x => x['@type'] === 'BreadcrumbList')) out.push('no BreadcrumbList JSON-LD');
  if (ev && ev.image && !(plate && ev.image.endsWith(`/${plate.file}`))) out.push(`JSON-LD image ${ev.image} is not ours`);

  // Sources: a page that lists acts names where they came from. Lineup-only
  // festivals had no Sources row at all (III Points listed 218 acts citing
  // nothing), so a lineup needs a Lineup row or a Set times row.
  const sources = section(html, 'sources-h') || '';
  const cites = (label) => new RegExp(`<li>${label}: <a href="https?://`).test(sources);
  if (names.length && !cites('Lineup') && !cites('Set times')) out.push('lists acts but Sources names no lineup or set-times source');
  // A preview with no lineup still points at the festival itself: its OWN
  // site, not merely some external link. Once Watch & listen carries
  // Instagram/X links, "any external link" stopped meaning "the festival".
  const site = cfg.officialEvent && cfg.officialEvent.website;
  if (!names.length && !(site && html.includes(`<a href="${site}"`))) out.push('an empty preview links no official site');

  return out;
}

// ── Every registry festival ──────────────────────────────────────────
const verifiedIds = new Set(REG.map(e => e.config.id).filter(id => wc.geometryVerifiedFor(id)));
let plates = 0, links = 0, noindexed = 0, multiWeekend = 0;
for (const entry of REG) {
  const id = entry.config.id;
  const file = join(F_DIR, id, 'index.html');
  if (!existsSync(file)) { fail(`${id}: no page at f/${id}/index.html`); continue; }
  const html = readFileSync(file, 'utf8');
  const problems = checkPage(entry, html, { verified: verifiedIds.has(id) });
  if (problems.length) for (const p of problems) fail(`${id}: ${p}`);
  else ok();
  const loc = `<loc>https://plursky.com/f/${id}/</loc>`;
  const indexable = !/content="noindex"/.test(html);
  if (sitemap.includes(loc) !== indexable) fail(`${id}: in sitemap=${sitemap.includes(loc)} but indexable=${indexable}`);
  else ok();
  if (/class="plate"/.test(html)) plates++;
  if (/id="map-h"/.test(html) && !/class="plate"/.test(html)) links++;
  if (!indexable) noindexed++;
  if (/id="weekend-2"/.test(html)) multiWeekend++;
}
// Every page a directory holds belongs to the registry.
for (const d of readdirSync(F_DIR, { withFileTypes: true })) {
  if (d.isDirectory() && !REG.some(e => e.config.id === d.name)) fail(`f/${d.name}/ has no registry festival`);
}

// Each branch has to be exercised, or its rule is unproven.
for (const [what, n] of [['plate', plates], ['official-map link only', links], ['noindex', noindexed], ['multi-weekend', multiWeekend]]) {
  if (!n) fail(`no page exercised the ${what} branch — its rule is UNPROVEN`); else ok();
}

// ── The mutations the spec names, and a control ──────────────────────
const byId = (id) => REG.find(e => e.config.id === id);
const pageOf = (id) => readFileSync(join(F_DIR, id, 'index.html'), 'utf8');
const unverified = REG.find(e => !verifiedIds.has(e.config.id) && /class="plate"/.test(pageOf(e.config.id)));
const verified = REG.find(e => verifiedIds.has(e.config.id) && existsSync(join(F_DIR, e.config.id, 'index.html')));
const artFestival = REG.find(e => e.config.mapImage && !/\.svg$/i.test(e.config.mapImage));
const withLineup = REG.find(e => (DS[e.config.id]?.artists || []).length > 1);
const WALK = '<p>It is a 12 min walk from the main stage.</p>';
const mutants = [
  ['an embedded official map', artFestival, (h) => h.replace('</main>', `<img src="/${artFestival.config.mapImage}" width="10" height="10">\n</main>`), false],
  // The ruled-out photo coming back: festival card art on a public page.
  ['official festival card art', byId('acl-2026'), (h) => h.replace('</main>', `<img src="/festival-art/acl-2026.webp" width="10" height="10">\n</main>`), false],
  ['a dropped act', withLineup, (h) => h.replace(/\n      <li><span class="act">[^\n]*<\/li>/, ''), false],
  ['a walk-time sentence on unverified geometry', unverified, (h) => h.replace('</main>', `${WALK}\n</main>`), false],
  // A lineup-only page losing its only source line, and a preview losing its
  // only official link.
  ['a lineup-only page with its Lineup source dropped', byId('iii-points-2026'), (h) => h.replace(/\n\s*<li>Lineup: [^\n]*<\/li>/, ''), false],
  ['an empty preview with its official links dropped', byId('coachella-2027'), (h) => h.replace(/<a href="https:\/\/www\.coachella\.com\/"[^>]*>[^<]*<\/a>/g, 'coachella'), false],
  // Control: the same sentence on VERIFIED geometry is not what the rule forbids.
  ['a walk-time sentence on verified geometry', verified, (h) => h.replace('</main>', `${WALK}\n</main>`), true],
];
for (const [label, entry, mutate, shouldPass] of mutants) {
  if (!entry) { fail(`mutation "${label}": no fixture festival — the mutation cannot run`); continue; }
  const id = entry.config.id;
  const base = pageOf(id);
  const mutated = mutate(base);
  if (mutated === base) { fail(`mutation "${label}" did not land on ${id}`); continue; }
  const problems = checkPage(byId(id), mutated, { verified: verifiedIds.has(id) });
  if (shouldPass ? problems.length : !problems.length) {
    fail(`mutation "${label}" on ${id}: ${shouldPass ? 'flagged ' + problems[0] : 'NOT caught'}`);
  } else ok();
}

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED`);
  process.exit(1);
}
console.log(`  ✓ festival pages: ${checks} checks across ${REG.length} pages (plates ${plates}, official-map links ${links}, noindex ${noindexed}, multi-weekend ${multiWeekend}; 6 mutations caught, 1 control passed)`);
