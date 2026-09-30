// The /f/<id>/ page inputs that live OUTSIDE the registry: the map plate,
// past editions and the amenity summary. One module, read by BOTH
// gen-festival-pages.mjs (to render) and sitemap-fingerprint.mjs (to hash), so
// a page section can never change without its <lastmod> seeing it.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Anything served on a page image budget: an image over this is not rendered.
export const MAX_PAGE_IMAGE_BYTES = 150 * 1024;

// A stage that exists only to hold acts until the schedule places them
// (EDC Orlando's "Schedule TBA"). It is not a stage the festival has.
export const isPlaceholderStage = (s) => !s || s.id === 'tba' || /^PROVISIONAL\b/.test(s.desc || '');

// A Plursky-generated plate is an SVG we drew from our own coordinates. Every
// other mapImage (jpg/webp) is the festival's patron-map art, which is linked
// to, never embedded: official publication is provenance, not reuse rights.
export function plateFor(cfg, root = ROOT) {
  const file = cfg && cfg.mapImage;
  if (!file || !/\.svg$/i.test(file)) return null;
  const abs = path.join(root, file);
  if (!existsSync(abs)) return null;
  const svg = readFileSync(abs, 'utf8');
  const vb = /viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg);
  const desc = /<desc[^>]*>([\s\S]*?)<\/desc>/.exec(svg);
  if (!vb || !desc) return null;   // a plate that cannot label itself honestly is not shown
  return {
    file, w: Math.round(+vb[1]), h: Math.round(+vb[2]),
    desc: desc[1].replace(/\s+/g, ' ').trim(),
    bytes: Buffer.byteLength(svg), svg,
  };
}

// Past editions held in data/historical, matched on the festival id without
// its year ("acl-2026" -> "acl"), from EARLIER years only, newest first: a
// page never lists its own year or a later one as "past", so a 2026 edition
// cannot appear under a 2027 label as anything but a look-back. The /f/ page
// is an index into Past Festivals, never a copy of it, so only the summary
// travels, plus the date the newest official source was archived.
export function pastEditionsFor(id, root = ROOT) {
  const idx = path.join(root, 'data', 'historical', 'index.json');
  if (!existsSync(idx)) return [];
  const m = /^(.*)-(\d{4})$/.exec(String(id));
  const base = m ? m[1] : String(id), year = m ? +m[2] : Infinity;
  return (JSON.parse(readFileSync(idx, 'utf8')).editions || [])
    .filter(e => e.festivalId === base && e.year < year)
    .map(e => {
      const lineupOnly = e.completeness === 'lineup_only';
      const file = path.join(root, 'data', 'historical', 'editions', `${e.id}.json`);
      const caps = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')).provenance?.captures || []) : [];
      const ts = caps.map(c => c.captureTimestamp || c.pageCapture || c.imageCapture).filter(t => /^\d{8}/.test(t || '')).sort().pop();
      return {
        id: e.id, name: e.name, year: e.year, lineupOnly,
        first: e.days?.[0]?.date ?? null, last: e.days?.[e.days.length - 1]?.date ?? null,
        stages: lineupOnly ? null : e.counts?.stages ?? null,
        artists: e.counts?.artists ?? null,
        // A lineup_only edition has no sets because none were archived, not
        // because the festival had none: it never says "0 sets".
        sets: lineupOnly ? null : e.counts?.sets ?? null,
        archived: ts ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : null,
      };
    })
    .sort((a, b) => b.year - a.year);
}

const AMENITY_LABELS = {
  water: 'Water', toilet: 'Restrooms', med: 'Medical', food: 'Food', info: 'Info',
  charge: 'Charging', locker: 'Lockers', art: 'Art',
};

// The edition gate: hours count only when they quote the official page's own
// dated block (hours.dated, verbatim) and that block is for THIS edition: its
// first year is the edition's year and it names the edition's start day.
// Countdown's page still printed "December 31, 2025 + January 1" for the 2026
// edition; those hours were last year's and must never print.
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function editionStart(dates) {
  const m = String(dates || '').match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\b[\s\S]*?\b(\d{4})\b/);
  return m && MON.includes(m[1].toLowerCase()) ? { mon: m[1].toLowerCase(), day: +m[2], year: +m[3] } : null;
}
export function hoursMatchEdition(h, dates) {
  const ed = editionStart(dates);
  if (!h || !h.dated || !ed) return false;
  const q = String(h.dated), year = (q.match(/\b(?:19|20)\d{2}\b/) || [])[0];
  const days = [...q.matchAll(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\b/g)].filter(m => MON.includes(m[1].toLowerCase()));
  return +year === ed.year && days.some(m => m[1].toLowerCase() === ed.mon && +m[2] === ed.day);
}
export const editionHours = cfg => (cfg && hoursMatchEdition(cfg.hours, cfg.dates) ? cfg.hours : null);

// Amenity TYPES and counts, never positions: a list of what the app carries
// says nothing about where anything is, so it needs no verified geometry.
// Gated festivals are not in the app yet, so their pages list none.
export function amenitySummary(DS, id, available) {
  if (!available) return [];
  const counts = new Map();
  for (const a of (DS[id]?.amenities || [])) {
    const k = AMENITY_LABELS[a && a.type] || null;
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// The Plan-your-day hours line, from cfg.hours only (see gen-festival-pages).
const clock = hm => {
  const [h, m] = String(hm).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export function hoursLine(h) {
  if (!h || !h.url || !h.open) return '';
  const win = h.close ? `${clock(h.open)} – ${clock(h.close)}` : null;
  const main = h.label === 'Gates'
    ? `Gates open ${clock(h.open)}${h.close ? `, close ${clock(h.close)}` : ''}`
    : `${h.label} hours: ${win || `from ${clock(h.open)}`}`;
  return `${main}${h.daily ? ' each day' : ''}${h.musicStart ? `; music starts ${clock(h.musicStart)}` : ''}.`;
}

// ── Status chip ──────────────────────────────────────────────────────
// Upcoming / This weekend / Happening now / Past, from the printed dates
// ({ start, end }, YYYY-MM-DD) and the days the festival actually runs.
// Between two blocks of days (ACL's weekends, Summerfest's three runs) nothing
// is playing, so a gap day is never "live".
//
// `dayBuckets` is how many entries the festival's dayDates has. ONE bucket
// under printed dates that run longer means the day split is not published
// (III Points, Dreamstate, Countdown: every act sits in a single bucket dated
// the first day). That is an unpublished split, not a one-day festival: it
// runs every printed day. Read literally, the second day fell through to
// "This weekend" while the festival was on.
const _DAY_MS = 86400000;
export function pageStatus(dates, eventDays, today, dayBuckets) {
  if (today > dates.end) return 'past';
  let days = eventDays.filter(d => d >= dates.start && d <= dates.end).sort();
  if (dayBuckets === 1 && days.length === 1 && dates.end > dates.start) {
    days = [];
    for (let t = Date.parse(dates.start); t <= Date.parse(dates.end); t += _DAY_MS) days.push(new Date(t).toISOString().slice(0, 10));
  }
  if (days.includes(today) || (!days.length && today >= dates.start)) return 'live';
  const next = days.find(d => d > today) || dates.start;
  return (Date.parse(next) - Date.parse(today)) / _DAY_MS <= 6 ? 'soon' : 'upcoming';
}
