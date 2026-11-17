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
//   1. the Wikidata item's English label has the SAME artist key as the
//      billing (data/artist-key.js), not a fuzzy match. An alias counts only
//      for a key of 4+ characters ("Q" is an alias of Quincy Jones, "SJ" of
//      Super Junior; neither is that act);
//   2. the item is a musical act: a human (P31 Q5) with a music occupation
//      (DJ, musician, singer, rapper, producer...), or a musical group. A
//      music-database id alone is not enough: an emperor, an architect and
//      an orchestra hall all carry MusicBrainz ids (the Nov 2026 catalog
//      run's spot check), and a fictional character can be a "singer";
//   3. exactly ONE search result clears 1 and 2. Two is ambiguous: skipped;
//   4. it has an image, the Commons file's license maps onto the ledger's
//      allow-list, and its author credit fits the 32-character credit line;
//   5. the Commons file page carries no permission, deletion or dispute flag
//      (commonsFlag below): an open deletion request, "no permission since",
//      a copyright-violation or no-source/no-license tag, or a crop extracted
//      from a file Commons has deleted. The license field can read clean while
//      the page says the file is going away (#419, Nov 2026: Gallant, R3hab,
//      Fujii Kaze, KATSEYE; Evan Giia was dropped by ruling, not by a flag). --recheck drops any ledger row whose
//      file has picked up a flag since, hand-reviewed rows included.
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
//   --recheck       re-hold every pipeline row to the current match rules
//   --names <file>  find again the artists listed in a run report's rows
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
export const MUSIC_IDS = ['P434', 'P1953', 'P1902', 'P2850', 'P3192', 'P1728', 'P2722', 'P3040', 'P3283', 'P2373'];
// Or the item says what it is: a music occupation (DJ, musician, record
// producer, singer, composer, singer-songwriter, rapper) or a musical group.
// (+ songwriter, vocalist)
export const MUSIC_OCC = ['Q130857', 'Q639669', 'Q183945', 'Q177220', 'Q36834', 'Q488205', 'Q2252262', 'Q855091', 'Q753110', 'Q2643890'];
// musical group, musical ensemble, rock band, musical duo, girl group, boy band
export const MUSIC_GROUP = ['Q215380', 'Q2088357', 'Q5741069', 'Q9212979', 'Q641066', 'Q216337'];
// Or the item's own English description says it is a musical act ("British DJ
// and record producer", "American indie pop band"). Wikidata types many acts
// as a "musical project", a pseudonym or a human with no occupation, so the
// description catches what the type lists miss. Anything that describes a
// work, a place, an organisation or a fictional character never counts.
export const MUSIC_DESC = /\b(dj|disc jockey|musician|singer|rapper|record producer|music producer|songwriter|composer|vocalist|drummer|guitarist|bassist|pianist|keyboardist|band|musical (duo|trio|group|act|project|ensemble)|(girl|boy|pop|rock|idol|vocal|hip[- ]hop|electronic|music) (group|duo|trio)|duo|trio)\b/i;
export const NOT_ACT_DESC = /\b(fictional|character|album|song|single|ep by|film|series|episode|venue|hall|festival|record label|label|building|club|street|town|city|village|river|company|brand|software|video game|genre|instrument|family name|given name|surname|comedy)\b/i;
// Items a person found to be the wrong face. Never used, whatever the rules
// say (data/artist-photos/hold.json).
const HOLD_FILE = join(ROOT, 'data/artist-photos/hold.json');
export const loadHold = () => { try { return new Set(JSON.parse(readFileSync(HOLD_FILE, 'utf8')).wikidata || []); } catch { return new Set(); } };
const HUMAN = 'Q5';

// Commons LicenseShortName → ledger license id. Anything else is skipped.
const LICENSE_MAP = new Map([
  ['CC0', 'CC0-1.0'], ['CC0 1.0', 'CC0-1.0'],
  ['CC BY 2.0', 'CC-BY-2.0'], ['CC BY 3.0', 'CC-BY-3.0'], ['CC BY 4.0', 'CC-BY-4.0'],
  ['CC BY-SA 2.0', 'CC-BY-SA-2.0'], ['CC BY-SA 3.0', 'CC-BY-SA-3.0'], ['CC BY-SA 4.0', 'CC-BY-SA-4.0'],
  ['CC BY-SA 3.0 DE', 'CC-BY-SA-3.0-DE'],
  ['Public domain', 'Public-Domain'],
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
  'Public-Domain': 'https://creativecommons.org/publicdomain/mark/1.0/',
};
export function mapLicense(shortName) {
  const k = String(shortName || '').replace(/\s+/g, ' ').trim().replace(/\bde$/i, 'DE');
  const id = LICENSE_MAP.get(k);
  return id ? { license: id, licenseUrl: LICENSE_URL[id] } : null;
}

// Rule 5. A Commons file page's own flags, read from its templates and
// categories (the API's prop=templates|categories). Templates are what an
// editor places; the categories they add are the fallback. Returns
// { reason, detail } for a flagged page, null for a clean one. Matched against
// the live pages of the five #419 files (Nov 2026), not guessed.
const FLAG_TEMPLATES = [
  [/^Template:(Delete|Deletion template tag|Speedy ?delete|SD|Speedydelete)$/i, 'commons-deletion-request'],
  [/^Template:(No permission since|Permission pending|OTRS pending|Wait for permission)$/i, 'commons-missing-permission'],
  [/^Template:(Copyvio|Copyright violation|Dw no source since|Derivative work)$/i, 'commons-copyright-dispute'],
  [/^Template:(Disputed|Dispute|Disputed license|License dispute)$/i, 'commons-copyright-dispute'],
  [/^Template:(No source since|No license since|No license|No source)$/i, 'commons-no-source-or-license'],
  [/^Template:Extracted from deleted$/i, 'commons-source-deleted'],
];
const FLAG_CATEGORIES = [
  [/^Category:Deletion requests\b|^Category:Candidates for speedy deletion|^Category:Other speedy deletions/i, 'commons-deletion-request'],
  [/^Category:(All )?Media missing permission|^Category:Items with OTRS permission pending|^Category:Items with VRT permission pending/i, 'commons-missing-permission'],
  [/^Category:(Copyright violations|Possible copyright violations|Disputed|Media with disputed)/i, 'commons-copyright-dispute'],
  [/^Category:(All )?Media without a (source|license)|^Category:Images without (source|license)/i, 'commons-no-source-or-license'],
  // NOT "Files with broken file links": that category only says the page links
  // a missing file, which can be a deleted copy made FROM it (Gesaffelstein's
  // crop) or a stray link (Evan Giia's "TestPhoto2.jpg"). A deleted SOURCE is
  // the "Extracted from deleted" template above.
];
export function commonsFlag(page) {
  if (!page) return null;
  if (page.missing !== undefined) return { reason: 'commons-file-missing', detail: page.title || '' };
  for (const t of page.templates || []) for (const [re, reason] of FLAG_TEMPLATES) if (re.test(t.title)) return { reason, detail: t.title };
  for (const c of page.categories || []) for (const [re, reason] of FLAG_CATEGORIES) if (re.test(c.title)) return { reason, detail: c.title };
  return null;
}
// Templates and categories for up to 50 file titles per request, following
// the API's continuation (one busy page can spill the 500-row limit).
async function flagPages(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    let cont = {};
    for (let n = 0; n < 20; n++) {
      const j = await api(COMMONS, { action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'templates|categories', tllimit: 'max', cllimit: 'max', ...cont });
      const norm = new Map((j.query?.normalized || []).map(x => [x.to, x.from]));
      for (const p of Object.values(j.query?.pages || {})) {
        const key = (norm.get(p.title) || p.title).replace(/^File:/, '').replace(/_/g, ' ');
        const have = out.get(key) || { title: p.title, templates: [], categories: [] };
        if (p.missing !== undefined) have.missing = '';
        have.templates.push(...(p.templates || [])); have.categories.push(...(p.categories || []));
        out.set(key, have);
      }
      if (!j.continue) break;
      const { continue: _c, ...rest } = j.continue; cont = { ...rest, continue: j.continue.continue };
    }
  }
  return out;
}
const fileTitleOf = sourceUrl => { const m = /\/wiki\/File:(.+)$/.exec(sourceUrl || ''); return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null; };

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
const label = ent => (ent.labels && ent.labels.en && ent.labels.en.value) || '';
const aliases = ent => Object.values(ent.aliases || {}).flat().map(a => a.value);
const describe = ent => (ent.descriptions && ent.descriptions.en && ent.descriptions.en.value) || '';

// Rule 1 for one item.
export function namesBilling(billing, ent) {
  const key = artistKey(billing);
  if (artistKey(label(ent)) === key) return true;
  // "O.A.R. (band)": a label's own disambiguation does not change the name.
  if (artistKey(label(ent).replace(/\s*\([^)]*\)\s*$/, '')) === key) return true;
  // An alias of three letters or more (P!nk, Djo, FKJ). One or two letters
  // ("Q", "SJ") name too many things to stand for anyone.
  return key.replace(/-/g, '').length >= 3 && aliases(ent).some(n => artistKey(n) === key);
}
// Rule 2 for one item.
export function isMusicAct(ent) {
  const qids = p => claimIds(ent, p).map(v => v && v.id).filter(Boolean);
  const kinds = qids('P31');
  if (kinds.some(q => MUSIC_GROUP.includes(q))) return true;
  if (kinds.includes(HUMAN) && qids('P106').some(q => MUSIC_OCC.includes(q))) return true;
  const d = describe(ent);
  return MUSIC_DESC.test(d) && !NOT_ACT_DESC.test(d);
}

// The match rule (1-3 above), pure so the gate can test it.
export function pickEntity(billing, entities, hold = new Set()) {
  const named = entities.filter(e => e && !e.missing && !hold.has(e.id) && namesBilling(billing, e));
  if (!named.length) return { entity: null, reason: 'no-item' };
  const ok = named.filter(isMusicAct);
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
  const url = base + '?' + new URLSearchParams({ format: 'json', maxlag: '20', ...params });
  // maxlag: the servers ask bots to pause while replication is behind. Reads
  // here use 20 s, since Wikidata's lag often sits near 10 s for long spells.
  // Wikidata often lags for minutes, so wait it out (up to ~10 minutes).
  for (let i = 0; i < 40; i++) {
    const j = await (await wmFetch(url)).json();
    if (!j.error || j.error.code !== 'maxlag') return j;
    if (i % 6 === 0) console.log(`maxlag: ${j.error.lag ?? '?'} s behind, waiting`);
    nextAt = Date.now() + 15000;
  }
  throw new Error('maxlag persisted: ' + url.slice(0, 120));
}
const WD = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

function loadArtists(args) {
  if (args.names) {
    // A run report's rows (e.g. recheck.json): find these artists again.
    const rows = JSON.parse(readFileSync(join(ROOT, args.names), 'utf8')).rows || [];
    return [...new Set(rows.map(r => r.artist))].map(name => ({ key: artistKey(name), name }));
  }
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
    else if (v === '--recheck') a.recheck = true;
    else if (v === '--names') a.names = argv[++i];
  }
  if (!a.all && !a.festival && !a.recheck && !a.names) throw new Error('pass --all, --festival <id>, --names <report.json> or --recheck');
  return a;
}

// --recheck: hold every pipeline row already in the ledger to the current
// rules 1 and 2, by its recorded Wikidata item, and drop (row and asset) any
// that no longer clears them. Hand-reviewed rows are never touched.
async function recheck(args) {
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  const pipeline = ledger.filter(r => /^Commons pipeline/.test(r.reviewedBy || '') && r.wikidata);
  if (args.gap) GAP = args.gap;
  const ents = new Map(), ids = [...new Set(pipeline.map(r => r.wikidata))];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await api(WD, { action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|aliases|claims|descriptions', languages: 'en' });
    for (const [id, e] of Object.entries(j.entities || {})) ents.set(id, e);
  }
  const dropped = [], kept = [], hold = loadHold();
  for (const r of pipeline) {
    const e = ents.get(r.wikidata);
    if (!e || e.missing === '') continue;   // not fetched: leave it, report nothing
    kept.push({ artist: r.artist, wikidata: r.wikidata, description: describe(e) });
    const reason = hold.has(r.wikidata) ? 'held' : !namesBilling(r.artist, e) ? 'no-item' : !isMusicAct(e) ? 'no-music-item' : null;
    if (reason) dropped.push({ artist: r.artist, wikidata: r.wikidata, reason, asset: r.asset, description: describe(e) });
  }
  // Rule 5 holds for every Commons row, hand-reviewed ones too: a deletion
  // request or a missing permission is the file's status, not a matching call.
  const commonsRows = ledger.filter(r => r.source === 'commons' && fileTitleOf(r.sourceUrl));
  const flags = await flagPages([...new Set(commonsRows.map(r => fileTitleOf(r.sourceUrl)))].map(t => 'File:' + t));
  for (const r of commonsRows) {
    const page = flags.get(fileTitleOf(r.sourceUrl));
    if (!page) continue;   // not fetched: leave it, report nothing
    const flag = commonsFlag(page);
    if (flag && !dropped.some(d => d.asset === r.asset)) dropped.push({ artist: r.artist, wikidata: r.wikidata || null, reason: flag.reason, flag: flag.detail, asset: r.asset, reviewedBy: r.reviewedBy || null });
  }
  const gone = new Set(dropped.map(d => d.asset));
  const flaggedAssets = new Set(dropped.filter(d => /^commons-/.test(d.reason)).map(d => d.asset));
  if (!args.dry) {
    writeFileSync(LEDGER, JSON.stringify(ledger.filter(r => !gone.has(r.asset) || (!/^Commons pipeline/.test(r.reviewedBy || '') && !flaggedAssets.has(r.asset))), null, 2) + '\n');
    for (const a of gone) { try { unlinkSync(join(ROOT, a)); } catch {} }
  }
  const report = { ranAt: new Date().toISOString(), scope: 'recheck', checked: pipeline.length, commonsChecked: commonsRows.length, dropped: dropped.length,
    byReason: dropped.reduce((m, d) => (m[d.reason] = (m[d.reason] || 0) + 1, m), {}), rows: dropped,
    // Every row's item description, so a person can look the faces over.
    kept: kept.filter(k => !dropped.some(d => d.wikidata === k.wikidata && d.artist === k.artist)) };
  if (args.report) { mkdirSync(dirname(join(ROOT, args.report)), { recursive: true }); writeFileSync(join(ROOT, args.report), JSON.stringify(report, null, 1) + '\n'); }
  console.log(`[commons] recheck: ${report.checked} pipeline rows, ${report.commonsChecked} Commons pages, dropped ${report.dropped} ${JSON.stringify(report.byReason)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.recheck) return recheck(args);
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  const have = new Set(ledger.map(r => artistKey(r.artist)));
  // Slice the stable source order first, so --offset means the same artists
  // however many photos earlier chunks added to the ledger.
  const all = loadArtists(args);
  const from = args.offset || 0, to = args.limit ? from + args.limit : all.length;
  let artists = all.slice(from, to).filter(a => !have.has(a.key));
  // A billing that names several acts never gets one face.
  artists = artists.filter(a => !/\sb[23]b\s|\s[x×]\s|\spresents\s|\svs\.?\s/i.test(a.name));
  if (args.gap) GAP = args.gap;
  const skips = {}, added = [], hold = loadHold();
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
    const j = await api(WD, { action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|aliases|claims|descriptions', languages: 'en' });
    for (const [id, e] of Object.entries(j.entities || {})) ents.set(id, e);
  }
  // 3. Apply the match rule.
  const matched = [];
  for (const a of artists) {
    const r = pickEntity(a.name, (cands.get(a.key) || []).map(id => ents.get(id)), hold);
    if (!r.entity) { skip(a, r.reason, r.qid ? { wikidata: r.qid } : {}); continue; }
    matched.push({ a, qid: r.entity.id, file: r.image, description: describe(r.entity) });
  }
  // 4. Read each file's license and author from Commons, 50 per request.
  const info = new Map();
  for (let i = 0; i < matched.length; i += 50) {
    const titles = matched.slice(i, i + 50).map(m => 'File:' + m.file);
    const j = await api(COMMONS, { action: 'query', titles: titles.join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: String(args.width) });
    const norm = new Map((j.query?.normalized || []).map(n => [n.to, n.from]));
    for (const p of Object.values(j.query?.pages || {})) info.set((norm.get(p.title) || p.title).replace(/^File:/, ''), p);
  }
  const flags = await flagPages(matched.map(m => 'File:' + m.file));
  const imgDir = join(ROOT, 'artist-photos'), descs = new Map();
  mkdirSync(imgDir, { recursive: true });
  for (const m of matched) {
    const page = info.get(m.file) || info.get(m.file.replace(/_/g, ' '));
    const ii = page && page.imageinfo && page.imageinfo[0];
    if (!ii || !ii.thumburl) { skip(m.a, 'no-file', { wikidata: m.qid }); continue; }
    if (!/^image\/(jpeg|png|webp|tiff)$/.test(ii.mime || '')) { skip(m.a, 'not-a-photo', { wikidata: m.qid, mime: ii.mime }); continue; }
    const fp = flags.get(m.file.replace(/_/g, ' ')) || flags.get(page.title.replace(/^File:/, ''));
    if (!fp) { skip(m.a, 'commons-flags-unread', { wikidata: m.qid }); continue; }
    const flag = commonsFlag(fp);
    if (flag) { skip(m.a, flag.reason, { wikidata: m.qid, flag: flag.detail }); continue; }
    const md = ii.extmetadata || {};
    const lic = mapLicense(md.LicenseShortName?.value);
    if (!lic) { skip(m.a, 'license-not-admitted', { wikidata: m.qid, license: md.LicenseShortName?.value || null }); continue; }
    const author = cleanAuthor(md.Artist?.value);
    if (!author) { skip(m.a, 'no-usable-credit', { wikidata: m.qid }); continue; }
    const sourceUrl = 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(page.title.replace(/^File:/, '').replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')');
    const asset = 'artist-photos/' + m.a.key + '.webp';
    if (args.dry) { added.push({ artist: m.a.name, wikidata: m.qid, license: lic.license, author, sourceUrl, description: m.description }); continue; }
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
    descs.set(m.a.name, m.description);
  }
  if (!args.dry) writeFileSync(LEDGER, JSON.stringify([...ledger, ...added], null, 2) + '\n');
  const report = {
    ranAt: new Date().toISOString(), scope: args.festival || 'registry', width: args.width,
    total: all.length, offset: from, nextOffset: to < all.length ? to : null,
    considered: artists.length, added: added.length,
    skipped: Object.fromEntries(Object.entries(skips).map(([k, v]) => [k, v.length])),
    addedRows: added.map(r => ({ artist: r.artist, wikidata: r.wikidata, license: r.license, author: r.author, description: r.description || descs.get(r.artist) || '' })),
    skips,
  };
  if (args.report) { mkdirSync(dirname(join(ROOT, args.report)), { recursive: true }); writeFileSync(join(ROOT, args.report), JSON.stringify(report, null, 1) + '\n'); }
  console.log(`[commons] considered ${report.considered}, added ${report.added}, skipped ${JSON.stringify(report.skipped)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error(e); process.exit(1); });
}
