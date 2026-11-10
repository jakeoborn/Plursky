#!/usr/bin/env node
// Commons photo pipeline: finds an openly licensed portrait for every artist
// in the catalog and adds it to the reviewed photo ledger, at scale.
//
// WHERE A PHOTO MAY COME FROM. Only Wikimedia Commons, through the artist's
// own Wikidata item (its "image" statement, P18), under a license the ledger
// already admits (scripts/lib/artist-photo-ledger.mjs). Nothing is scraped
// from search results, socials, Spotify or press pages: Spotify art stays the
// 24 h, connected-user path in chrome.jsx and never enters the ledger.
//
// HOW A PHOTO IS TIED TO THE RIGHT PERSON. A wrong face is worse than
// initials, so a match has to clear every rule, or the artist keeps initials:
//   1. the Wikidata item's English label or an alias has the SAME artist key
//      as the billing (data/artist-key.js), not a fuzzy match;
//   2. the item carries a music-database identifier (MusicBrainz, Discogs,
//      Spotify, Apple Music, Last.fm, Beatport, SoundCloud), so it is a
//      musical act and not a namesake;
//   3. exactly ONE search result clears 1 and 2. Two is ambiguous: skipped;
//   4. it has an image, the Commons file's license maps onto the ledger's
//      allow-list, and its author credit fits the 32-character credit line.
// Each row records the Wikidata item it came from, so any match can be
// re-checked by hand, and the run report lists every skip and its reason.
//
// The sandbox that writes most of this repo's code cannot reach Wikimedia,
// so this runs in GitHub Actions (.github/workflows/commons-photos.yml).
//
// Usage:
//   node scripts/find-commons-photos.mjs --all            every registry artist
//   node scripts/find-commons-photos.mjs --festival <id>  one festival module
//   --limit N       first N artists only      --dry-run   report, write nothing
//   --width N       thumbnail width (480)     --report <path.json>
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../data/artist-key.js';

const { artistKey } = globalThis.PlurskyArtistKey;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LEDGER = join(ROOT, 'data/artist-photos/ledger.json');
// Generic, per Wikimedia's User-Agent policy (a name and what it does).
const UA = 'ArtistPhotoLedgerBot/1.0 (openly licensed artist portraits; low rate)';

// Music databases: an item with one of these is a musical act.
// P434 MusicBrainz artist, P1953 Discogs artist, P1902 Spotify artist,
// P2850 Apple Music artist, P3192 Last.fm.
export const MUSIC_IDS = ['P434', 'P1953', 'P1902', 'P2850', 'P3192'];

// Commons LicenseShortName → ledger license id. Anything else is skipped.
const LICENSE_MAP = new Map([
  ['CC0', 'CC0-1.0'], ['CC0 1.0', 'CC0-1.0'],
  ['CC BY 2.0', 'CC-BY-2.0'], ['CC BY 3.0', 'CC-BY-3.0'], ['CC BY 4.0', 'CC-BY-4.0'],
  ['CC BY-SA 2.0', 'CC-BY-SA-2.0'], ['CC BY-SA 3.0', 'CC-BY-SA-3.0'], ['CC BY-SA 4.0', 'CC-BY-SA-4.0'],
  ['CC BY-SA 3.0 DE', 'CC-BY-SA-3.0-DE'],
]);
const LICENSE_URL = {
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY-2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC-BY-3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA-2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC-BY-SA-3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC-BY-SA-3.0-DE': 'https://creativecommons.org/licenses/by-sa/3.0/de/',
};
export function mapLicense(shortName) {
  const k = String(shortName || '').replace(/\s+/g, ' ').trim().replace(/\bde$/i, 'DE');
  const id = LICENSE_MAP.get(k);
  return id ? { license: id, licenseUrl: LICENSE_URL[id] } : null;
}

// Commons "Artist" is HTML ("<a href=...>Jane Doe</a>"). Text only, one line,
// and it must fit the 32-character credit line or the photo is skipped:
// a credit is never invented or cut mid-name.
export function cleanAuthor(html) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || /^unknown/i.test(text)) return null;
  if (text.length <= 32) return text;
  // "Jane Doe (talk)" or "Jane Doe, Flickr" — the name before the aside.
  const head = text.split(/\s[(\[]|,\s|\sfrom\s/)[0].trim();
  return head && head.length <= 32 ? head : null;
}

const claimIds = (ent, p) => ((ent.claims || {})[p] || [])
  .filter(c => c.rank !== 'deprecated' && c.mainsnak && c.mainsnak.snaktype === 'value')
  .sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred'))
  .map(c => c.mainsnak.datavalue.value);
const names = ent => [
  ...Object.values(ent.labels || {}).map(l => l.value),
  ...Object.values(ent.aliases || {}).flat().map(a => a.value),
];

// The match rule (1-3 above), pure so the gate can test it.
export function pickEntity(billing, entities) {
  const key = artistKey(billing);
  const ok = entities.filter(e => e && !e.missing
    && names(e).some(n => artistKey(n) === key)
    && MUSIC_IDS.some(p => claimIds(e, p).length));
  if (ok.length !== 1) return { entity: null, reason: ok.length ? 'ambiguous' : 'no-music-item' };
  const image = claimIds(ok[0], 'P18')[0];
  return image ? { entity: ok[0], image } : { entity: null, reason: 'no-image', qid: ok[0].id };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Wikimedia rate limits (2026): a client without contact details in its
// User-Agent gets 10 requests a minute. Every Wikimedia request goes through
// here, one at a time, at least GAP ms apart, honouring Retry-After.
let GAP = 6500, nextAt = 0;
async function wmFetch(url) {
  let last = '';
  for (let i = 0; i < 6; i++) {
    const wait = nextAt - Date.now();
    if (wait > 0) await sleep(wait);
    nextAt = Date.now() + GAP;
    const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(e => { last = 'network: ' + e.message; return null; });
    if (res && res.ok) return res;
    let backoff = 5000 * 2 ** i;
    if (res) {
      last = res.status + ' ' + (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
      const ra = +res.headers.get('retry-after');
      if (ra > 0) backoff = Math.max(backoff, ra * 1000);
      if (res.status !== 429 && res.status < 500) break;
    }
    nextAt = Date.now() + backoff;
  }
  throw new Error('request failed (' + last + '): ' + url.slice(0, 120));
}
async function api(base, params) {
  const url = base + '?' + new URLSearchParams({ format: 'json', maxlag: '5', ...params });
  for (let i = 0; i < 5; i++) {
    const j = await (await wmFetch(url)).json();
    if (!j.error || j.error.code !== 'maxlag') return j;
    nextAt = Date.now() + 5000 * (i + 1);
  }
  throw new Error('maxlag persisted: ' + url.slice(0, 120));
}
const WD = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

function loadArtists(args) {
  if (args.festival) {
    globalThis.window = globalThis.window || globalThis;
    window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
    const file = join(ROOT, 'data/festivals', args.festival + '.js');
    // eslint-disable-next-line no-new-func
    new Function(readFileSync(file, 'utf8'))();
    const f = window.PLURSKY_FESTIVALS[args.festival];
    return [...new Set(f.artists.map(a => a.name))].map(name => ({ key: artistKey(name), name }));
  }
  const reg = JSON.parse(readFileSync(join(ROOT, 'data/artists/registry.json'), 'utf8'));
  return reg.filter(r => r.kind === 'performer').map(r => ({ key: r.key, name: r.name, aliases: r.aliases || [] }));
}

function parseArgs(argv) {
  const a = { width: 480 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--all') a.all = true;
    else if (v === '--dry-run') a.dry = true;
    else if (v === '--festival') a.festival = argv[++i];
    else if (v === '--limit') a.limit = +argv[++i];
    else if (v === '--offset') a.offset = +argv[++i];
    else if (v === '--gap') a.gap = +argv[++i];
    else if (v === '--width') a.width = +argv[++i];
    else if (v === '--report') a.report = argv[++i];
  }
  if (!a.all && !a.festival) throw new Error('pass --all or --festival <id>');
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  const have = new Set(ledger.map(r => artistKey(r.artist)));
  let artists = loadArtists(args).filter(a => !have.has(a.key));
  // A billing that names several acts never gets one face.
  artists = artists.filter(a => !/\sb[23]b\s|\s[x×]\s|\spresents\s|\svs\.?\s/i.test(a.name));
  if (args.gap) GAP = args.gap;
  if (args.offset || args.limit) artists = artists.slice(args.offset || 0, args.limit ? (args.offset || 0) + args.limit : undefined);
  const skips = {}, added = [];
  const skip = (a, reason, extra = {}) => { (skips[reason] ||= []).push({ artist: a.name, ...extra }); };

  // 1. Search each billing (the API has no batch search). ~5 requests/s.
  const cands = new Map();
  for (const a of artists) {
    const j = await api(WD, { action: 'wbsearchentities', search: a.name, language: 'en', uselang: 'en', type: 'item', limit: '7' });
    cands.set(a.key, (j.search || []).map(s => s.id));
  }
  // 2. Fetch every candidate item, 50 per request.
  const ids = [...new Set([...cands.values()].flat())], ents = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const j = await api(WD, { action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|aliases|claims', languages: 'en' });
    for (const [id, e] of Object.entries(j.entities || {})) ents.set(id, e);
  }
  // 3. Apply the match rule.
  const matched = [];
  for (const a of artists) {
    const r = pickEntity(a.name, (cands.get(a.key) || []).map(id => ents.get(id)));
    if (!r.entity) { skip(a, r.reason, r.qid ? { wikidata: r.qid } : {}); continue; }
    matched.push({ a, qid: r.entity.id, file: r.image });
  }
  // 4. Read each file's license and author from Commons, 50 per request.
  const info = new Map();
  for (let i = 0; i < matched.length; i += 50) {
    const titles = matched.slice(i, i + 50).map(m => 'File:' + m.file);
    const j = await api(COMMONS, { action: 'query', titles: titles.join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: String(args.width) });
    const norm = new Map((j.query?.normalized || []).map(n => [n.to, n.from]));
    for (const p of Object.values(j.query?.pages || {})) info.set((norm.get(p.title) || p.title).replace(/^File:/, ''), p);
  }
  const imgDir = join(ROOT, 'artist-photos');
  mkdirSync(imgDir, { recursive: true });
  for (const m of matched) {
    const page = info.get(m.file) || info.get(m.file.replace(/_/g, ' '));
    const ii = page && page.imageinfo && page.imageinfo[0];
    if (!ii || !ii.thumburl) { skip(m.a, 'no-file', { wikidata: m.qid }); continue; }
    if (!/^image\/(jpeg|png|webp|tiff)$/.test(ii.mime || '')) { skip(m.a, 'not-a-photo', { wikidata: m.qid, mime: ii.mime }); continue; }
    const md = ii.extmetadata || {};
    const lic = mapLicense(md.LicenseShortName?.value);
    if (!lic) { skip(m.a, 'license-not-admitted', { wikidata: m.qid, license: md.LicenseShortName?.value || null }); continue; }
    const author = cleanAuthor(md.Artist?.value);
    if (!author) { skip(m.a, 'no-usable-credit', { wikidata: m.qid }); continue; }
    const sourceUrl = 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(page.title.replace(/^File:/, '').replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')');
    const asset = 'artist-photos/' + m.a.key + '.webp';
    if (args.dry) { added.push({ artist: m.a.name, wikidata: m.qid, license: lic.license, author, sourceUrl }); continue; }
    const res = await wmFetch(ii.thumburl).catch(() => null);
    if (!res) { skip(m.a, 'download-failed', { wikidata: m.qid }); continue; }
    const tmp = join(imgDir, '.' + m.a.key + '.src');
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    try { execFileSync('cwebp', ['-quiet', '-q', '78', '-metadata', 'none', tmp, '-o', join(ROOT, asset)]); }
    catch { skip(m.a, 'convert-failed', { wikidata: m.qid }); continue; }
    finally { try { unlinkSync(tmp); } catch {} }
    const bytes = readFileSync(join(ROOT, asset));
    added.push({
      artist: m.a.name, author, source: 'commons', ...lic, sourceUrl,
      reviewedBy: 'Commons pipeline: Wikidata match', reviewedAt: new Date().toISOString(),
      allowExport: false, asset, sha256: createHash('sha256').update(bytes).digest('hex'),
      changes: `Wikimedia ${args.width}px thumbnail, converted to WebP. Display may crop and overlay.`,
      wikidata: m.qid,
    });
  }
  if (!args.dry) writeFileSync(LEDGER, JSON.stringify([...ledger, ...added], null, 2) + '\n');
  const report = {
    ranAt: new Date().toISOString(), scope: args.festival || 'registry', width: args.width,
    considered: artists.length, added: added.length,
    skipped: Object.fromEntries(Object.entries(skips).map(([k, v]) => [k, v.length])),
    addedRows: added.map(r => ({ artist: r.artist, wikidata: r.wikidata, license: r.license, author: r.author })),
    skips,
  };
  if (args.report) { mkdirSync(dirname(join(ROOT, args.report)), { recursive: true }); writeFileSync(join(ROOT, args.report), JSON.stringify(report, null, 1) + '\n'); }
  console.log(`[commons] considered ${report.considered}, added ${report.added}, skipped ${JSON.stringify(report.skipped)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error(e); process.exit(1); });
}
