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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { plateFor, pastEditionsFor, amenitySummary } from './festival-page-data.mjs';
import { loadEmbedData, selectEmbeds, embedFingerprintInput, embedWindowStart } from './official-embeds.mjs';

export const fp = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

// ── The template is rendered output too ──────────────────────────────────
// This was the one hole in the contract above: every FIELD a page renders was
// hashed, but the page STRUCTURE was not. Edit the stub template — add a
// section, change a sentence — and every page genuinely changes while not one
// fingerprint moves, leaving every <lastmod> frozen over changed content. That
// is the exact one-directional failure the header describes, arriving through
// the one door the field lists structurally cannot watch: a template edit
// reads no new cfg.*/entry.* field, so the coverage detector sees nothing.
//
// The first fix here was a hand-bumped `TEMPLATE_VERSION = 1`. That did NOT
// enforce the contract — it only restated it. A markup edit with a forgotten
// bump still froze every date, which is the same failure one step upstream: a
// rule that depends on someone remembering is not a rule.
//
// So the contribution is DERIVED, and there is nothing left to forget. It is
// the hash of the generator's own render-path source — the same slice the
// coverage detector reads — with whole-line comments and blank lines removed.
//
// The deliberate trade-off: a pure refactor inside that slice (renaming a
// local) moves all festival dates even though no output changed. That is
// OVER-reporting — a redundant recrawl hint — and it is the safe direction.
// Under-reporting tells a crawler "nothing moved here" about a page that did,
// which the header calls worse than shipping no lastmod at all. Comments are
// stripped precisely so documentation edits stay free; scripts/test-sitemap-
// fingerprint.mjs proves both halves (a markup edit moves it, a comment-only
// edit does not).
const GEN_PATH = fileURLToPath(new URL('../gen-festival-pages.mjs', import.meta.url));
const SLICE_START = 'function place(';
const SLICE_END = 'const rows = [];';

// Exported and PURE so the regression test can mutate real source text and
// recompute, rather than trusting an injected value that proves only that the
// field participates in the hash.
export function templateMarkup(source) {
  const from = source.indexOf(SLICE_START);
  const to = source.indexOf(SLICE_END);
  if (from === -1 || to === -1 || to <= from) {
    throw new Error('sitemap-fingerprint: could not slice the render path out of '
      + 'gen-festival-pages.mjs — the anchors moved. Fix this rather than deleting it: '
      + 'without the slice, every festival <lastmod> silently stops tracking the template.');
  }
  return source.slice(from, to).split('\n')
    .map(l => (/^\s*\/\//.test(l) ? '' : l))   // whole-line comments only: "//" also lives inside URLs
    .filter(l => l.trim() !== '')
    .join('\n');
}

export const templateFingerprint = (source) => fp(templateMarkup(source));

let _tplFp = null;
export function currentTemplateFingerprint() {
  if (_tplFp === null) _tplFp = templateFingerprint(readFileSync(GEN_PATH, 'utf8'));
  return _tplFp;
}

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
  // Both gate the "find stages on a live map" clause in the product note.
  // map.jsx picks the real map on mapImage and otherwise falls back to the SVG
  // TopDownMap, so a festival gaining or losing map art changes what the page
  // says about itself. Before this, that clause could change while <lastmod>
  // stayed frozen — the one-directional failure this ledger exists to prevent.
  'mapImage',
  'mapMode',
  'mapSource',       // the map section's official link, its year note, the Sources row
  'hours',           // the Plan-your-day hours line and the Sources row
  'year',            // whether the official map shown is this edition's
  'weekendStartMs',  // weekend headings, per-weekend rows and the weekends answer
  'officialEvent',   // the official-site link in Sources and on a no-lineup page
  'lineupSource',    // the Lineup row in Sources
  'policies',        // entry-age and camping chips (via festivalEssentials)
  'essentialsSources', // their Sources rows and the ticket CTA's state/date
  'endMs',           // an ended festival drops its ticket CTA
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
// embeds an "Other festivals" nav listing the OTHER festivals' id/name/dates
// (rendered as f.config.*, never cfg.*). Hashing the rendered file instead of
// the festival's own content would move EVERY festival's date whenever any
// single festival changed — boilerplate churn is the thing a crawler is least
// interested in hearing about twice. The homepage's own lastmod still
// fingerprints index.html whole, which is where that list legitimately counts.

// The exact object that gets hashed. Exported separately from the hash so the
// test can diff WHICH field moved instead of only that something did.
// `templateFp` is an override for the regression test only; production always
// derives it from the generator source on disk.
export function fingerprintInput(entry, { DS, scheduleActs, eventDates, TODAY, templateFp, festivalEssentials }) {
  const cfg = entry.config;
  const ds = DS[cfg.id] || {};
  const d = eventDates(cfg);
  return {
    template: templateFp || currentTemplateFingerprint(),
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
    // Both gate the product note's "find stages on a live map" clause. These
    // must live HERE, in the hash body — adding them to
    // FINGERPRINTED_CONFIG_FIELDS alone silences the coverage detector while
    // changing nothing, because that list feeds the detector, not the hash.
    mapImage: cfg.mapImage || '',
    mapMode: cfg.mapMode || '',
    // The Past status chip and the CTA verb move with the
    // calendar alone. That IS a change a crawler sees, so it belongs in the
    // fingerprint — and it is precisely why the comparison is strict-only.
    isPast: d ? d.end < TODAY : false,
    artists: [...new Set((ds.artists || []).map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    // PRESENCE of coordinates, not their values. The product note's map clause
    // renders only when EVERY stage can be placed, so gaining or losing a
    // coordinate changes the page — but nudging one by a metre does not, and
    // hashing the numbers would redate 25 pages over text that never moved.
    // The coverage detector cannot see this: it audits cfg.*/entry.* only.
    stages: (ds.stages || []).map(s => [s.id, s.name, s.desc || '',
      s.x != null && s.y != null]),
    acts: scheduleActs(ds.artists),
    source: cfg.scheduleSource || null,
    mapSource: cfg.mapSource || null,
    hours: cfg.hours || null,
    year: cfg.year ?? null,
    weekendStartMs: cfg.weekendStartMs || null,
    officialEvent: cfg.officialEvent || null,
    lineupSource: cfg.lineupSource || null,
    policies: cfg.policies || null,
    essentialsSources: cfg.essentialsSources || null,
    endMs: cfg.endMs ?? null,
    // The ticket CTA also moves with the calendar (ended, or its check went
    // stale), so the RESOLVED output is hashed, at the same instant the
    // generator renders it.
    essentials: festivalEssentials ? festivalEssentials(cfg, Date.parse(`${TODAY}T12:00:00Z`)) : null,
    // Page sections fed from outside the registry, through the SAME helpers
    // the generator renders with (scripts/lib/festival-page-data.mjs).
    plate: (() => { const p = plateFor(cfg); return p ? [p.file, p.w, p.h, fp(p.svg)] : null; })(),
    editions: pastEditionsFor(cfg.id),
    amenities: amenitySummary(DS, cfg.id, !!entry.available),
    // The Watch & listen section: the embeds the page shows, in order. A
    // verification that drops or restores one moves the page, and so lastmod.
    embeds: embedFingerprintInput(selectEmbeds(cfg.id, loadEmbedData(), embedWindowStart(cfg, d))),
  };
}

export const festivalFingerprint = (entry, deps) => fp(fingerprintInput(entry, deps));
