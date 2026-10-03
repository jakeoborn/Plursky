import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
const licenses = new Set(['CC0-1.0', 'Public-Domain', 'CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-2.0', 'CC-BY-SA-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-2.0', 'Press-Grant']);
const cleanText = v => typeof v === 'string' && !!v.trim() && !/[<>\u0000-\u001f]/.test(v);
const https = v => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };
export function validatePhoto(rec, root) {
  const fail = reason => { throw new Error(`Artist photo: ${reason}`); };
  if (!rec || !cleanText(rec.artist) || !cleanText(rec.author)) fail('artist/author required');
  if (!['commons', 'press-kit'].includes(rec.source)) fail('source not permitted');
  if (!licenses.has(rec.license) || !https(rec.licenseUrl) || !https(rec.sourceUrl)) fail('license/source evidence required');
  if (!cleanText(rec.reviewedBy) || !/^\d{4}-\d{2}-\d{2}T/.test(rec.reviewedAt || '') || !Number.isFinite(Date.parse(rec.reviewedAt))) fail('review receipt required');
  if (rec.source === 'commons' && new URL(rec.sourceUrl).hostname !== 'commons.wikimedia.org') fail('Commons source mismatch');
  if (rec.source === 'commons' && rec.license === 'Press-Grant') fail('Commons license mismatch');
  if (rec.source === 'press-kit' && (rec.license !== 'Press-Grant' || !https(rec.grantUrl) || !cleanText(rec.grantText))) fail('explicit press grant required');
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
    const row = validatePhoto(rec, root), key = row.artist.trim().toLowerCase();
    if (names.has(key)) throw new Error('Duplicate artist photo: ' + key);
    names.add(key); out[key] = row;
  }
  return out;
}
