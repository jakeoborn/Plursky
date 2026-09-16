// The content fingerprint behind each sitemap <lastmod>.
//
// Extracted from gen-festival-pages.mjs so the generator and its regression
// test hash through the SAME function. A test that recomputes the fingerprint
// its own way proves only that two copies of a rule agree with each other.
//
// THE CONTRACT: every source field that reaches rendered, crawlable output is
// in the hash. The failure this guards against is quiet and one-directional —
// a field that moves the page but NOT the hash leaves <lastmod> frozen while
// the page changes underneath it. That is worse than shipping no lastmod at
// all: the sitemap is then actively telling a crawler "nothing moved here"
// about a page that did, and a source that has been wrong gets discounted.
//
// scripts/test-sitemap-fingerprint.mjs enforces the contract mechanically — it
// reads the generator's render path and fails on any cfg.* / entry.* field
// that appears in neither list below. Add a field to the renderer without
// adding it here and the gate names it.

import { createHash } from 'node:crypto';

export const fp = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

// entry.config fields that reach rendered output, each with where it lands.
export const FINGERPRINTED_CONFIG_FIELDS = [
  'name',                // <h1>, <title>, og/twitter, JSON-LD name, section headings
  'dates',               // .meta line, meta description, JSON-LD start/endDate via eventDates
  'location',            // .meta line, place() venue + PostalAddress parts
  'locationShort',       // place() venue fallback, and the stagesSection map sentence
  'tagline',             // the lede paragraph
  'brand',               // JSON-LD organizer
  'tzAbbr',              // "All times local (CDT)." on the schedule grid
  'dayDates',            // schedule day headings AND every <time datetime="...">
  'setTimesProvisional', // the "not published yet" note under the lineup
  'scheduleSource',      // the official-vs-community source note
];

// Top-level registry-entry fields that reach rendered output.
export const FINGERPRINTED_ENTRY_FIELDS = [
  'available',   // the CTA verb and the "not switchable yet" note
  'scheduleTBA', // the "set times appear when the festival publishes" note
  'region',      // JSON-LD addressCountry when the location string omits it
];

// Deliberately NOT hashed. Each one is a decision, not an oversight.
export const EXCLUDED_CONFIG_FIELDS = {
  id: 'IS the sitemap <loc>. A changed id is a NEW url with its own ledger row, '
    + 'not a moved date, so hashing it would double-count the same event.',
};

export const EXCLUDED_ENTRY_FIELDS = {
  config: 'the container object itself, not a rendered field',
};

// Also deliberately excluded, and not expressible as a field name: every stub
// embeds an "Other festivals" nav listing the OTHER 25 festivals' id/name/dates
// (rendered as f.config.*, never cfg.*). Hashing the rendered file instead of
// the festival's own content would move all 26 dates whenever any single
// festival changed — boilerplate churn is the thing a crawler is least
// interested in hearing about twice. The homepage's own lastmod still
// fingerprints index.html whole, which is where that list legitimately counts.

// The exact object that gets hashed. Exported separately from the hash so the
// test can diff WHICH field moved instead of only that something did.
export function fingerprintInput(entry, { DS, scheduleActs, eventDates, TODAY }) {
  const cfg = entry.config;
  const ds = DS[cfg.id] || {};
  const d = eventDates(cfg);
  return {
    name: cfg.name,
    dates: cfg.dates,
    location: cfg.location || '',
    locationShort: cfg.locationShort || '',
    tagline: cfg.tagline || '',
    brand: cfg.brand || '',
    tzAbbr: cfg.tzAbbr || '',
    dayDates: cfg.dayDates || null,
    region: entry.region || '',
    available: !!entry.available,
    scheduleTBA: !!entry.scheduleTBA,
    setTimesProvisional: !!cfg.setTimesProvisional,
    // The "This festival has ended." line and the CTA verb move with the
    // calendar alone. That IS a change a crawler sees, so it belongs in the
    // fingerprint — and it is precisely why the comparison is strict-only.
    isPast: d ? d.end < TODAY : false,
    artists: [...new Set((ds.artists || []).map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    stages: (ds.stages || []).map(s => [s.id, s.name, s.desc || '']),
    acts: scheduleActs(ds.artists),
    source: cfg.scheduleSource || null,
  };
}

export const festivalFingerprint = (entry, deps) => fp(fingerprintInput(entry, deps));
