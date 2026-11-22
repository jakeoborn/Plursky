// #303 first slice: the DETERMINISTIC gates a public organizer update must
// pass before any classifier (Snap or otherwise) is allowed to look at it.
//
// Not shipped, not wired into the app, not in verify. Nothing here schedules,
// sends or suppresses a notification; it only answers "is this update even
// eligible to be classified?" with a fixed list of reasons. Spec step 3:
// identity, authenticity, freshness, edition and dedup run FIRST, so a model
// never gets to rule on a stale, duplicate, wrong-edition or unofficial update.
//
// An update is plain data:
//   { id, festivalId, sourceUrl, publishedAt, expiresAt, text, affectedSetIds? }
// publishedAt / expiresAt are ISO strings that MUST carry an offset (Z or
// ±hh:mm): a bare local time is ambiguous across a festival's timezone and
// the reader's, and the spec lists timezone confusion as a failure class.

import { createHash } from 'node:crypto';

export const REASONS = Object.freeze({
  BAD_URL: 'source url is not https',
  UNOFFICIAL: 'source host is not the festival\'s own site',
  NO_OFFICIAL_SITE: 'festival has no official website on record',
  WRONG_EDITION: 'update names a different edition',
  UNKNOWN_SET: 'affected set id is not in this edition',
  AMBIGUOUS_TIME: 'timestamp has no timezone offset',
  FUTURE_DATED: 'published after now',
  EXPIRED: 'expired',
  NO_EXPIRY: 'no expiry',
  OUTSIDE_WINDOW: 'published outside the edition window',
  DUPLICATE: 'duplicate of an update already seen',
});

const OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const SKEW_MS = 5 * 60 * 1000;            // clock skew allowed on publishedAt
const LEAD_MS = 180 * 24 * 3600 * 1000;   // updates may predate the edition by this much
const TAIL_MS = 2 * 24 * 3600 * 1000;     // and follow its end by this much

function hostOf(url) {
  try { const u = new URL(url); return u.protocol === 'https:' ? u.hostname.toLowerCase().replace(/^www\./, '') : null; }
  catch { return null; }
}

// The festival's own host, or a subdomain of it. A host that merely ends with
// the same letters ("fakemexico.edc.com" vs "mexico.edc.com") does not count.
export function isOfficialHost(sourceUrl, config) {
  const site = config && config.officialEvent && hostOf(config.officialEvent.website);
  const h = hostOf(sourceUrl);
  return !!(site && h && (h === site || h.endsWith('.' + site)));
}

// Same words, same source, same edition = same update, whatever the spacing,
// case or trailing punctuation.
export function updateKey(u) {
  const norm = String(u.text || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.!\s]+$/, '').trim();
  return createHash('sha256').update(`${u.festivalId}|${hostOf(u.sourceUrl) || ''}|${norm}`).digest('hex');
}

// ctx: { config, now (ms), seen (Set of updateKey), setIds? (Set of the edition's act ids),
//        window? ({ startMs, endMs }) }. Returns { ok, reasons } and, when ok, records the key in seen.
export function gateUpdate(u, ctx) {
  const { config, now, seen } = ctx;
  const reasons = [];
  if (!hostOf(u.sourceUrl)) reasons.push(REASONS.BAD_URL);
  else if (!(config.officialEvent && config.officialEvent.website)) reasons.push(REASONS.NO_OFFICIAL_SITE);
  else if (!isOfficialHost(u.sourceUrl, config)) reasons.push(REASONS.UNOFFICIAL);

  if (u.festivalId !== config.id) reasons.push(REASONS.WRONG_EDITION);
  if (Array.isArray(u.affectedSetIds) && ctx.setIds) {
    if (u.affectedSetIds.some(id => !ctx.setIds.has(id))) reasons.push(REASONS.UNKNOWN_SET);
  }

  const pubOk = OFFSET_RE.test(String(u.publishedAt || ''));
  const expOk = u.expiresAt == null || OFFSET_RE.test(String(u.expiresAt));
  if (!pubOk || !expOk) reasons.push(REASONS.AMBIGUOUS_TIME);
  if (pubOk) {
    const pub = Date.parse(u.publishedAt);
    if (pub > now + SKEW_MS) reasons.push(REASONS.FUTURE_DATED);
    const w = ctx.window || { startMs: config.startMs, endMs: config.endMs };
    if (typeof w.startMs === 'number' && typeof w.endMs === 'number'
        && (pub < w.startMs - LEAD_MS || pub > w.endMs + TAIL_MS)) reasons.push(REASONS.OUTSIDE_WINDOW);
  }
  if (u.expiresAt == null) reasons.push(REASONS.NO_EXPIRY);
  else if (expOk && Date.parse(u.expiresAt) <= now) reasons.push(REASONS.EXPIRED);

  const key = updateKey(u);
  if (seen.has(key)) reasons.push(REASONS.DUPLICATE);
  const ok = reasons.length === 0;
  if (ok) seen.add(key);   // only an accepted update can make a later one a duplicate
  return { ok, reasons };
}
