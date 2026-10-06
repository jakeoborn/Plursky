import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
// Runtime keys are artist keys (data/artist-key.js, the function the app's
// lookup calls), so "Tiësto" and "TIËSTO" are one row, and a set-tag billing
// finds its artist's photo. Ledger rows themselves are unchanged.
import '../../data/artist-key.js';
const { artistKey } = globalThis.PlurskyArtistKey;
const licenses = new Set(['CC0-1.0', 'Public-Domain', 'CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-2.0', 'CC-BY-SA-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-2.0', 'Press-Grant']);
const cleanText = v => typeof v === 'string' && !!v.trim() && !/[<>\u0000-\u001f]/.test(v);
const https = v => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };
// A press grant is either published on the granting party's press page (preferred: the page is
// the receipt) or given by email. This ledger ships publicly, so an email grant is documented by
// who granted it (organisation/role, never a person's address), when, the quoted permission and
// the SHA-256 of the archived message, which stays in private storage.
const noAddress = v => cleanText(v) && !/@/.test(v);
function validateGrant(rec, fail) {
  if (rec.license !== 'Press-Grant' || !cleanText(rec.grantText)) fail('explicit press grant required');
  const type = rec.grantType ?? 'press-page';
  if (type === 'press-page') {
    if (!https(rec.grantUrl)) fail('explicit press grant required');
    return;
  }
  if (type !== 'email') fail('grant type not permitted');
  if (rec.grantUrl !== undefined) fail('email grant with a press page should be recorded as press-page');
  if (!noAddress(rec.grantFrom) || !noAddress(rec.grantText)) fail('email grant needs an organisation/role and quoted text, without email addresses');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rec.grantDate || '') && Date.parse(rec.grantDate + 'T00:00:00Z');
  if (!Number.isFinite(day) || day > Date.parse(rec.reviewedAt)) fail('email grant date required, on or before review');
  if (!/^[a-f0-9]{64}$/.test(rec.grantEvidenceSha256 || '')) fail('email grant needs the archived message hash');
}
export function validatePhoto(rec, root) {
  const fail = reason => { throw new Error(`Artist photo: ${reason}`); };
  if (!rec || !cleanText(rec.artist) || !cleanText(rec.author)) fail('artist/author required');
  // The credit prints on one line under the hero; 32 characters fits 320px with margin.
  if (rec.author.length > 32) fail('author credit longer than 32 characters');
  if (!['commons', 'press-kit'].includes(rec.source)) fail('source not permitted');
  if (!licenses.has(rec.license) || !https(rec.licenseUrl) || !https(rec.sourceUrl)) fail('license/source evidence required');
  if (!cleanText(rec.reviewedBy) || !/^\d{4}-\d{2}-\d{2}T/.test(rec.reviewedAt || '') || !Number.isFinite(Date.parse(rec.reviewedAt))) fail('review receipt required');
  if (rec.source === 'commons' && new URL(rec.sourceUrl).hostname !== 'commons.wikimedia.org') fail('Commons source mismatch');
  if (rec.source === 'commons' && rec.license === 'Press-Grant') fail('Commons license mismatch');
  if (rec.source === 'press-kit') validateGrant(rec, fail);
  if (rec.source === 'press-kit' && /instagram\.com|spotify\.com/.test(new URL(rec.sourceUrl).hostname)) fail('platform content is not a press grant');
  if (rec.allowExport !== false) fail('exports remain separately gated');
  if (!/^artist-photos\/[a-z0-9][a-z0-9_-]*\.(webp|png|jpg)$/.test(rec.asset || '')) fail('local asset required');
  const base = resolve(root, 'artist-photos') + sep, file = resolve(root, rec.asset);
  if (!file.startsWith(base)) fail('asset escaped directory');
  const bytes = readFileSync(file);
  if (bytes.length > 1500000) fail('asset exceeds 1.5MB');
  if (!/^[a-f0-9]{64}$/.test(rec.sha256 || '') || createHash('sha256').update(bytes).digest('hex') !== rec.sha256) fail('asset hash mismatch');
  return { ...rec, url: './' + rec.asset };
}
export function validateLedger(records, root) {
  if (!Array.isArray(records)) throw new Error('Artist photo ledger must be an array');
  const out = {}, names = new Set();
  for (const rec of records) {
    const row = validatePhoto(rec, root), key = artistKey(row.artist);
    if (names.has(key)) throw new Error('Duplicate artist photo: ' + key);
    names.add(key); out[key] = row;
  }
  return out;
}
