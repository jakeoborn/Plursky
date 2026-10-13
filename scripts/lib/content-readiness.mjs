// Public content readiness: a deterministic baseline over lineup billings.
//
// Scores how well-supported a billing's PUBLIC content is (schedule, its
// source and date, a sourced profile, a specific genre), never an artist's
// quality, popularity or anyone's taste. It reads bundled festival data only:
// no user media, EXIF, GPS, notes, saved/attended sets or account data, and
// no network. The queue it builds is for an editor; nothing here changes what
// the app shows.
//
// Any later semantic scorer runs in shadow against THIS baseline, on the
// items `semanticEligible` marks, and only after a dedupe pass: a billing is
// keyed by edition + weekend + id, and a duplicate printed row is a conflict,
// never merged.
//
// One act billed at the same start on several stages is an identity conflict
// UNLESS a showcase entry (data/content-readiness/showcases.json) covers that
// edition, name and date with a dated first-party source. A showcase is many
// groups under one label (School of Rock: 75+ bands, six stages); the entry is
// evidence for one edition and its printed dates, never a blanket name pass.

export const RUBRIC_VERSION = 'content-readiness/1';

// The only fields an item record may carry. A semantic call's payload is a
// subset of this list (test-content-readiness.mjs proves both).
export const ITEM_FIELDS = Object.freeze([
  'key', 'edition', 'billingId', 'name', 'weekend', 'day', 'start', 'end', 'stage',
  'scheduleSource', 'scheduleObservedAt', 'scheduleOfficial',
  'bioEvidence', 'genreEvidence', 'profileLinks',
  'readiness', 'choice', 'reasons', 'semanticEligible',
]);

const PLACEHOLDER_GENRE = /^(?:—|-|tba|tbd|n\/a)?$/i;

export function normName(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

// A bio is a TEMPLATE when, with the act's own name taken out and digits
// folded, the same text shape recurs across the edition. Generated
// "Playing <festival> 2026." lines all collapse to a handful of shapes;
// prose written for one act does not.
function bioShape(bio, name) {
  let s = String(bio || '');
  if (name) s = s.split(name).join('<N>');
  return s.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 48);
}

function bioEvidence(a, shapeCounts) {
  const bio = String(a.bio || '').trim();
  if (!bio) return 'none';
  const profiles = Array.isArray(a.officialArtistProfiles) ? a.officialArtistProfiles : [];
  if (profiles.some(p => p && p.bio && String(p.bio).trim() === bio)) return 'official_profile';
  if ((shapeCounts.get(bioShape(bio, a.name)) || 0) >= 3) return 'template';
  return 'unsourced_prose';
}

function genreEvidence(a, genreCounts, n) {
  const g = String(a.genre || '').trim();
  if (PLACEHOLDER_GENRE.test(g)) return 'placeholder';
  // A genre carried by most of the edition is the festival's default label.
  return (genreCounts.get(g) || 0) > n / 2 ? 'edition_default' : 'specific';
}

function profileLinks(a) {
  const urls = new Set();
  for (const p of a.officialArtistProfiles || []) if (p && p.url) urls.add(p.url);
  for (const u of Object.values(a.socials || {})) if (typeof u === 'string') urls.add(u);
  if (a.spotifyUrl) urls.add(a.spotifyUrl);
  return urls.size;
}

// Per-act source first (ACL prints one per weekend grid), else the edition's.
function scheduleSource(a, config) {
  const own = Array.isArray(a.scheduleSources) && a.scheduleSources[0];
  if (own && own.url) return { url: own.url, observedAt: own.observedAt || null, official: true, perAct: true };
  const ed = config && config.scheduleSource;
  if (ed && ed.url) return { url: ed.url, observedAt: ed.observedAt || null, official: ed.official === true, perAct: false };
  return null;
}

// evidence_readiness, 0-4:
//   0 missing         no day or stage
//   1 thin            schedule, but its source is unofficial, undated or absent
//   2 usable          schedule from a dated official source
//   3 well-supported  2 + an official artist profile (sourced bio)
//   4 complete        3 + a specific genre + a per-act schedule source
export function scoreItem(f) {
  const hasSchedule = f.day != null && f.day !== '' && !!f.stage;
  if (!hasSchedule) return 0;
  if (!f.scheduleOfficial || !f.scheduleObservedAt) return 1;
  if (f.bioEvidence !== 'official_profile') return 2;
  if (f.genreEvidence !== 'specific' || !f.perActSource) return 3;
  return 4;
}

// The dates a source-backed showcase entry covers for this edition and name.
function showcaseDates(showcases, editionId, name) {
  const hit = (showcases || []).find(s => s && s.edition === editionId
    && normName(s.name) === normName(name)
    && /^https:\/\//.test(s.source || '') && s.publishedAt && Array.isArray(s.dates));
  return hit ? new Set(hit.dates) : null;
}

function isoDay(config, day) {
  const d = config && config.dayDates && config.dayDates[day];
  if (!d) return null;
  return `${d.y}-${String(d.m + 1).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

export function buildItems(editionId, data, { showcases = [] } = {}) {
  const artists = Array.isArray(data && data.artists) ? data.artists : [];
  const config = (data && data.config) || {};
  const n = artists.length;
  const shapeCounts = new Map(), genreCounts = new Map(), rowCounts = new Map(), exactCounts = new Map();
  const rowKey = a => [a.weekend || '', a.day ?? '', a.start || '', normName(a.name)].join('|');
  const exactKey = a => rowKey(a) + '|' + (a.stage || '');
  for (const a of artists) {
    const s = bioShape(a.bio, a.name);
    shapeCounts.set(s, (shapeCounts.get(s) || 0) + 1);
    const g = String(a.genre || '').trim();
    genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    rowCounts.set(rowKey(a), (rowCounts.get(rowKey(a)) || 0) + 1);
    exactCounts.set(exactKey(a), (exactCounts.get(exactKey(a)) || 0) + 1);
  }
  return artists.map(a => {
    const src = scheduleSource(a, config);
    const f = {
      key: `${editionId}:${a.weekend || '-'}:${a.id}`,
      edition: editionId, billingId: String(a.id), name: String(a.name || ''),
      weekend: a.weekend || null, day: a.day ?? null, start: a.start || null, end: a.end || null,
      stage: a.stage || null,
      scheduleSource: src ? src.url : null,
      scheduleObservedAt: src ? src.observedAt : null,
      scheduleOfficial: !!(src && src.official),
      bioEvidence: bioEvidence(a, shapeCounts),
      genreEvidence: genreEvidence(a, genreCounts, n),
      profileLinks: profileLinks(a),
    };
    const reasons = [];
    const exactDup = exactCounts.get(exactKey(a)) > 1;
    const crossStage = !exactDup && rowCounts.get(rowKey(a)) > 1;
    const covered = crossStage && showcaseDates(showcases, editionId, a.name);
    const showcase = !!(covered && covered.has(isoDay(config, a.day)));
    const duplicate = exactDup || (crossStage && !showcase);
    if (exactDup) reasons.push('duplicate printed row: same name, stage and start');
    else if (showcase) reasons.push('source-backed concurrent showcase: one label, several groups and stages');
    else if (covered) reasons.push('same name on several stages at once, on a date the showcase source does not cover');
    else if (crossStage) reasons.push('same name billed at the same start on another stage: identity unresolved');
    if (a.provisional) reasons.push('edition marks this billing provisional');
    if (f.bioEvidence === 'unsourced_prose') reasons.push('bio prose has no source');
    if (!f.scheduleOfficial) reasons.push('schedule source is not official');
    else if (!f.scheduleObservedAt) reasons.push('schedule source has no observed date');
    const readiness = scoreItem({ ...f, perActSource: !!(src && src.perAct) });
    // Fixed precedence: a conflict outranks a missing source, which outranks
    // readiness. Unsourced prose can never be ready for publication review.
    const choice = duplicate ? 'conflict'
      : (a.provisional || f.bioEvidence === 'unsourced_prose' || readiness < 2) ? (readiness === 0 ? 'skip' : 'needs_source')
      : 'ready_for_editor_review';
    // A semantic judgment only has something to read when there is prose,
    // and is only safe on a billing nothing else in the edition shares a row with.
    const semanticEligible = !duplicate && !showcase && (f.bioEvidence === 'official_profile' || f.bioEvidence === 'unsourced_prose');
    return { ...f, readiness, choice, reasons, semanticEligible };
  });
}

export function summarize(items) {
  const by = (k) => items.reduce((m, it) => (m[it[k]] = (m[it[k]] || 0) + 1, m), {});
  const editions = {};
  for (const it of items) {
    const e = editions[it.edition] || (editions[it.edition] = { items: 0, semanticEligible: 0, readiness: {}, choice: {} });
    e.items++; if (it.semanticEligible) e.semanticEligible++;
    e.readiness[it.readiness] = (e.readiness[it.readiness] || 0) + 1;
    e.choice[it.choice] = (e.choice[it.choice] || 0) + 1;
  }
  const eligibleEditions = Object.entries(editions).filter(([, e]) => e.semanticEligible > 0).map(([id]) => id);
  return {
    items: items.length,
    readiness: by('readiness'), choice: by('choice'),
    bioEvidence: by('bioEvidence'), genreEvidence: by('genreEvidence'),
    semanticEligible: items.filter(i => i.semanticEligible).length,
    semanticEligibleEditions: eligibleEditions,
    editions,
  };
}
