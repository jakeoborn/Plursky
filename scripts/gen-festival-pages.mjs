#!/usr/bin/env node
// Generates the crawlable per-festival stubs at /f/<id>/index.html, plus
// sitemap.xml, by reading FESTIVALS_REGISTRY + _DATA_SETS straight out of
// data.jsx. Run it whenever a lineup or a registry entry changes:
//
//     node scripts/gen-festival-pages.mjs
//
// Why generated and not hand-written: plursky.com is a client-rendered SPA on
// GitHub Pages, so crawlers see an empty #root. These stubs are the only real
// HTML a crawler can index for a festival. Keeping them derived from data.jsx
// means a new festival in the registry gets a page, a sitemap entry and JSON-LD
// for free, and an edited lineup never leaves a stale page behind.
//
// data.jsx is a browser script (top-level consts + a window export), so it is
// evaluated in a VM with a window shim rather than imported.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';
import { fp, festivalFingerprint } from './lib/sitemap-fingerprint.mjs';
import { plateFor, pastEditionsFor, amenitySummary, isPlaceholderStage, hoursLine, editionHours, pageStatus, stageProgrammingFor } from './lib/festival-page-data.mjs';
import { loadEmbedData, selectEmbeds, embedsSection, embedWindowStart } from './lib/official-embeds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://plursky.com';
const OUT_DIR = path.join(root, 'f');
const EMBEDS = loadEmbedData(root);

// ── Load the registry out of data.jsx ────────────────────────────────
// scripts/lib/load-registry.mjs runs data/festivals/*.js before data.jsx, the
// same order index.html uses; without the modules the registry is missing
// festivals and their /f/ pages silently stop being generated.
// Each stub renders the festival's real schedule inline (day then stage,
// from the same _scheduleActs data schedule.json ships) and links the App
// Store install path, so "<festival> set times" queries land on substance.
const { REG, DS, scheduleActs, eventDates, weekendShifts, actPlaysWeekend } = loadRegistry(root);

// ── Helpers ──────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// eventDates(cfg) parses the registry's VISIBLE `dates` string. It lives in
// data.jsx as _festivalEventDates (the festival switcher orders by it too) and
// arrives here through loadRegistry. Pages deliberately read `dates`, not
// startMs/endMs or dayDates:
//   - endMs is the close time, which lands a day past the last festival day
//   - Lost Lands' dayDates starts on early-entry Sep 16 while the public
//     dates are Sep 18–20
//   - ACL's dayDates covers weekend 1 only
//   - the two preview entries have neither
// schema.org also wants JSON-LD dates to match what the page visibly says,
// and `dates` IS what the page says. dayDates is the fallback.

const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','Nevada','Texas','California','Florida','Michigan','Ohio']);

// "Legend Valley · Thornville, OH" -> venue + PostalAddress parts.
// `entry.region` supplies the country when the location string omits it
// ("Tinker Field · Orlando" gives a locality but no country).
// Edition skin (festival config): the page's title block in the festival's own
// look, matching the app's Today header band. Colours only; no artwork.
function editionHeadOpen(cfg) {
  const k = cfg.editionSkin;
  if (!k) return '';
  const v = (n, x) => `${n}:${String(x).replace(/[;"<>]/g, '')}`;
  return `  <header class="edition" style="${[v('--ed-band', k.band), v('--ed-ink', k.ink), v('--ed-chip', k.chip), v('--ed-wire', k.wire)].join(';')}">\n`;
}

function place(cfg, region) {
  const [venueRaw, whereRaw] = String(cfg.location || '').split('·').map(s => (s || '').trim());
  const venue = venueRaw || cfg.locationShort || cfg.name;
  const parts = (whereRaw || '').split(',').map(s => s.trim()).filter(Boolean);
  const addr = {};
  if (parts.length >= 2) {
    addr.addressLocality = parts[0];
    const tail = parts[1];
    if (US_STATES.has(tail)) { addr.addressRegion = tail; addr.addressCountry = 'US'; }
    else addr.addressCountry = tail;
  } else if (parts.length === 1) {
    if (US_STATES.has(parts[0])) { addr.addressRegion = parts[0]; addr.addressCountry = 'US'; }
    else addr.addressLocality = parts[0];
  }
  if (!addr.addressCountry && region === 'North America') addr.addressCountry = 'US';
  return { venue, addr };
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DAY_MS = 86400000;
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayMs = (e) => Date.UTC(e.y, e.m, e.d);

// dayDates months are 0-indexed (m:8 = September). Date label for a schedule
// day; days outside the registry's public `dates` span are early-entry (Lost
// Lands days 1-2 are Sep 16-17 pre-party days while the public dates are
// Sep 18-20) and say so, because the page must never claim a festival day
// the public dates don't. `shift` moves a weekend-1 day onto a later weekend
// (ACL's dayDates carry weekend 1 only); it is always whole weeks, so the
// weekday name still holds.
function dayLabel(dd, d, dates, shift = 0, short = false) {
  const e = (dd || {})[d];
  if (!e) return { label: `Day ${d}`, ymd: null };
  const at = new Date(dayMs(e) + shift);
  const month = short ? SHORT_MONTHS[at.getUTCMonth()] : MONTH_NAMES[at.getUTCMonth()];
  let label = `${short ? e.name.slice(0, 3) : e.name}, ${month} ${at.getUTCDate()}`;
  const ymd = at.toISOString().slice(0, 10);
  if (dates && (ymd < dates.start || ymd > dates.end)) label += ' (early entry)';
  return { label, ymd };
}

// ── Weekends ─────────────────────────────────────────────────────────
// A festival runs as one block of days or as several weekends. Two data shapes
// say "several", and both are read, never inferred from a name:
//   - weekendStartMs (ACL): the same days repeat per weekend, and each act's
//     `weekend` says which it plays, via data.jsx's actPlaysWeekend;
//   - dayDates with a calendar gap (Summerfest's three Thu–Sat blocks): each
//     block is its own weekend and owns its own days.
function weekendBlocks(cfg) {
  const dd = cfg.dayDates || {};
  const days = Object.keys(dd).map(Number).sort((a, b) => a - b);
  const shifts = weekendShifts(cfg);
  if (shifts.length > 1) return shifts.map((s, i) => ({ key: s.weekend, n: i + 1, shift: s.shift, days }));
  const blocks = [];
  for (const d of days) {
    const b = blocks[blocks.length - 1];
    if (b && dayMs(dd[d]) - dayMs(dd[b.days[b.days.length - 1]]) <= DAY_MS) b.days.push(d);
    else blocks.push({ key: null, n: blocks.length + 1, shift: 0, days: [d] });
  }
  return blocks.length ? blocks : [{ key: null, n: 1, shift: 0, days: [] }];
}

// Which acts a block holds. One block holds every act, whatever its day.
const inBlock = (blocks, b) => (a) => b.key ? actPlaysWeekend(a, b.key)
  : blocks.length > 1 ? b.days.includes(a.day) : true;

function blockRange(cfg, b) {
  const dd = cfg.dayDates || {};
  const at = (d) => new Date(dayMs(dd[d]) + b.shift);
  const a = at(b.days[0]), z = at(b.days[b.days.length - 1]);
  return a.getUTCMonth() === z.getUTCMonth()
    ? `${SHORT_MONTHS[a.getUTCMonth()]} ${a.getUTCDate()}–${z.getUTCDate()}`
    : `${SHORT_MONTHS[a.getUTCMonth()]} ${a.getUTCDate()} – ${SHORT_MONTHS[z.getUTCMonth()]} ${z.getUTCDate()}`;
}

// Every set row has an anchor, so the lineup can link a name to its slot.
const setId = (b, a) => `set-${b.key ? b.key.toLowerCase() + '-' : ''}${String(a.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;

// ── Status ───────────────────────────────────────────────────────────
// From the visible dates and the real event days only. Between ACL's two
// weekends is not "happening now": nothing is playing.
const STATUS_LABEL = { upcoming: 'Upcoming', soon: 'This weekend', live: 'Happening now', past: 'Past' };
function eventDaySet(cfg) {
  const out = new Set();
  for (const b of weekendBlocks(cfg)) for (const d of b.days) {
    const e = (cfg.dayDates || {})[d];
    if (e) out.add(new Date(dayMs(e) + b.shift).toISOString().slice(0, 10));
  }
  return out;
}
function statusOf(cfg, today) {
  const dates = eventDates(cfg);
  if (!dates) return null;
  return pageStatus(dates, [...eventDaySet(cfg)], today, Object.keys(cfg.dayDates || {}).length);
}

// The schedule grid: the same acts schedule.json ships, grouped (weekend,)
// day, then stage, rendered INLINE at build time (never client-fetched)
// because these stubs are the only HTML a crawler sees. Source honesty mirrors
// the data: an unofficial scheduleSource says so on the page rather than
// letting the page overclaim.
function scheduleGrid(entry, dates, blocks) {
  const cfg = entry.config;
  const stages = DS[cfg.id]?.stages || [];
  const acts = scheduleActs(DS[cfg.id]?.artists).filter(a => a.start && a.start !== '');
  if (!acts.length) return '';
  const stageIx = (sid) => { const i = stages.findIndex(t => t.id === sid); return i === -1 ? stages.length : i; };
  const stageName = (sid) => stages.find(t => t.id === sid)?.name
    || String(sid || 'Other').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const multi = blocks.length > 1;
  const [hDay, hStage] = multi ? ['h4', 'h5'] : ['h3', 'h4'];
  const body = blocks.map(b => {
    const bActs = acts.filter(inBlock(blocks, b));
    if (!bActs.length) return '';
    const days = [...new Set(bActs.map(a => a.day))].sort((x, y) => x - y);
    const head = multi ? `    <h3 id="weekend-${b.n}">Weekend ${b.n} · ${esc(blockRange(cfg, b))}</h3>\n` : '';
    return head + days.map(d => {
      const { label, ymd } = dayLabel(cfg.dayDates, d, dates, b.shift);
      const dayActs = bActs.filter(a => a.day === d);
      const stageIds = [...new Set(dayActs.map(a => a.stage))].sort((x, y) => stageIx(x) - stageIx(y));
      return `    <${hDay}>${esc(label)}</${hDay}>\n` + stageIds.map(st => {
        const sets = dayActs.filter(a => a.stage === st)
          .sort((a, b2) => String(a.start).localeCompare(String(b2.start)));
        return `    <${hStage}>${esc(stageName(st))}</${hStage}>\n    <ul class="sets">\n` +
          sets.map(a => `      <li id="${setId(b, a)}"><time${ymd ? ` datetime="${ymd}T${esc(a.start)}"` : ''}>${esc(a.start)}${a.end ? ' – ' + esc(a.end) : ''}</time> <span>${esc(a.name)}</span></li>`).join('\n') +
          `\n    </ul>`;
      }).join('\n');
    }).join('\n');
  }).filter(Boolean).join('\n');
  const src = cfg.scheduleSource;
  const srcNote = src && src.official === true
    ? `Official set times${src.observedAt ? `, confirmed ${esc(src.observedAt)}` : ''}.`
    // Bounded to OUR provenance and OUR behaviour. "the moment it drops" said the
    // official grid had not dropped — a publisher-state claim we cannot source.
    : 'Set times gathered from community sources. Plursky shows the official schedule once it has one.';
  return `
  <section aria-labelledby="schedule-h">
    <h2 id="schedule-h">${esc(cfg.name)} schedule &amp; set times</h2>
    <p class="note">${srcNote}${cfg.tzAbbr ? ` All times local (${esc(cfg.tzAbbr)}).` : ''}</p>
${body}
  </section>`;
}

// Only a page that renders the section carries its styles, so the other
// festival pages (and their sitemap lastmod) do not move.
const STAGE_PROGRAMMING_CSS = `  details.program-stage { margin:10px 0; border:1px solid var(--line); border-radius:10px; padding:0 14px; }
  details.program-stage summary { cursor:pointer; font-weight:650; min-height:44px; padding:12px 0; overflow-wrap:anywhere; }
  details.program-stage ol { padding-left:24px; }
  details.program-stage li { padding:6px 0; overflow-wrap:anywhere; }
  details.program-stage time { font-variant-numeric:tabular-nums; font-weight:650; }
`;

// Official stage/day running order is not a full clock-time schedule.
function stageProgrammingSection(entry) {
  const data = stageProgrammingFor(entry.config.id);
  if (!data) return '';
  const localClock = hm => { const [h,m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`; };
  return `
  <section aria-labelledby="stage-programming-h" class="stage-programming">
    <h2 id="stage-programming-h">Friday &amp; Saturday stage schedules</h2>
    <p class="note">Set times from the III Points-branded grids supplied on October 5. Both days, 13 stages and 231 intervals. The source is the supplied screenshot, not a clock-time page on the official website.</p>
    <p class="note">Times are local to Miami (EDT). Midnight belongs to the preceding festival night: Friday 12:00 AM is early Saturday; Saturday 12:00 AM is early Sunday. The venue map is still pending.</p>
    <p class="note"><a href="${esc(data.source.url)}">III Points official site</a> · source: attendee-supplied III Points-branded set-time grid · checked ${esc(data.source.observedAt)}</p>
${[1,2].map(day => `    <h3>${day === 1 ? 'Friday, October 16' : 'Saturday, October 17'}</h3>
` + data.stages.map(stage => {
    const block = stage.days.find(d => d.day === day);
    if (!block) return '';
    const timed = block.rows.some(r => r.start);
    return `    <details class="program-stage"${stage.id === '444' ? ' open' : ''}>
      <summary>${esc(stage.name)} · ${timed ? 'Set times' : 'Running order'} · ${block.rows.length} sets</summary>
      <ol>
` + block.rows.map(row => `        <li>${row.start ? `<time>${esc(localClock(row.start))}${row.end ? ' - '+esc(localClock(row.end)) : ''}</time> · ` : ''}${esc(row.name)}</li>`).join('\n') + `
      </ol>
    </details>`;
  }).join('\n')).join('\n')}
  </section>`;
}

// ── Map ──────────────────────────────────────────────────────────────
// Two things may appear, and nothing else: a plate Plursky generated (an SVG
// drawn from our own coordinates, captioned with its OWN <desc>, so its limits
// travel with it), and a link to the festival's own map page as recorded in
// the festival module with the year that page showed. Official patron-map art
// is never embedded — official publication establishes provenance, not reuse
// rights. With neither, there is no section.
function mapSection(entry, plate) {
  const cfg = entry.config;
  const src = cfg.mapSource;
  if (!plate && !(src && src.url)) return '';
  // The plate is drawn from the same 0–100 stage coordinates the app uses, so
  // each stage's name sits on its own dot. A stage with no coordinates cannot
  // be on the plate, and the caption says so instead of letting it vanish.
  const stages = (DS[cfg.id]?.stages || []).filter(s => !isPlaceholderStage(s));
  const placed = stages.filter(s => s.x != null && s.y != null);
  const unplaced = stages.filter(s => s.x == null || s.y == null);
  const fig = plate ? `
    <figure class="plate">
      <div class="platebox">
        <img src="/${esc(plate.file)}" width="${plate.w}" height="${plate.h}" loading="lazy" decoding="async" alt="${esc(cfg.name)} site plate: Plursky's abstract stage layout, not the official festival map">
${placed.map((s, i) => `        <span class="pin" style="left:${+s.x}%;top:${+s.y}%" aria-hidden="true">${i + 1}</span>`).join('\n')}
      </div>
      <ol class="platekey">
${placed.map(s => `        <li>${esc(s.name)}</li>`).join('\n')}
      </ol>
      <figcaption>${esc(plate.desc)}${unplaced.length ? ` ${unplaced.map(s => esc(s.name)).join(', ')} ${unplaced.length === 1 ? 'has' : 'have'} no position on this plate.` : ''}</figcaption>
    </figure>` : '';
  let link = '';
  if (src && src.url) {
    const label = src.mapYear === cfg.year ? `Official ${cfg.name} map` : `Official ${cfg.brand || cfg.name} festival map page`;
    const yearNote = src.mapYear == null
      ? ` Plursky could not confirm which year's map it shows (checked ${esc(src.observedAt)}).`
      : src.mapYear !== cfg.year ? ` When checked on ${esc(src.observedAt)} it showed the ${src.mapYear} map.` : '';
    link = `
    <p><a href="${esc(src.url)}" rel="noopener">${esc(label)}</a>, on the festival's own site.${yearNote}</p>`;
  }
  return `
  <section aria-labelledby="map-h">
    <h2 id="map-h">${esc(cfg.name)} map</h2>${fig}${link}
  </section>`;
}

// ── Lineup ───────────────────────────────────────────────────────────
// Every act, A–Z, with what the data PROVES about it and nothing more:
//   - day, only for a festival with more than one dated day (a one-day
//     dayDates is a bucket, not a day split);
//   - stage, only a real one (never the "Schedule TBA" placeholder);
//   - the time, as a link to its row in the set-times grid.
// No billing tiers: `tier` in the data is display weight derived from start
// hours, not the order a poster printed.
function lineupSection(entry, blocks, dates, names, hasTimes) {
  const cfg = entry.config;
  const artists = DS[cfg.id]?.artists || [];
  if (!names.length) {
    const site = cfg.officialEvent && cfg.officialEvent.website;
    return `
  <section aria-labelledby="lineup-h">
    <h2 id="lineup-h">${esc(cfg.name)} lineup</h2>
    <p>Plursky does not have a lineup for ${esc(cfg.name)} yet.${site ? ` The festival's own site: <a href="${esc(site)}" rel="noopener">${esc(site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>.` : ''}</p>
  </section>`;
  }
  const dd = cfg.dayDates || {};
  const daySplit = Object.keys(dd).length > 1;
  const real = new Map((DS[cfg.id]?.stages || []).filter(s => !isPlaceholderStage(s)).map(s => [s.id, s]));
  const multi = blocks.length > 1;
  const slots = (a) => blocks.filter(b => inBlock(blocks, b)(a)).map(b => [
    multi ? `Weekend ${b.n}` : '',
    daySplit && dd[a.day] ? esc(dayLabel(dd, a.day, dates, b.shift, true).label) : '',
    real.has(a.stage) ? esc(real.get(a.stage).name) : '',
    a.start ? `<a href="#${setId(b, a)}">${esc(a.start)}</a>` : '',
  ].filter(Boolean).join(' · ')).filter(Boolean);
  const rows = names.map(n => {
    const s = artists.filter(a => a.name === n).flatMap(slots);
    return `      <li><span class="act">${esc(n)}</span>${s.length ? ` <span class="slots">${s.join('; ')}</span>` : ''}</li>`;
  });
  return `
  <section aria-labelledby="lineup-h">
    <h2 id="lineup-h">${esc(cfg.name)} lineup</h2>
    <p>${names.length} artists announced.</p>
${hasTimes ? '' : `    <p class="note">Plursky does not have stage assignments or set times for every act at ${esc(cfg.name)} yet; each row shows what it has.</p>\n`}    <ul class="lineup">
${rows.slice(0, LINEUP_SHOWN).join('\n')}
    </ul>
${rows.length > LINEUP_SHOWN ? `    <details class="more">
      <summary>Show all ${rows.length} artists</summary>
      <ul class="lineup">
${rows.slice(LINEUP_SHOWN).map(r => '  ' + r).join('\n')}
      </ul>
    </details>
` : ''}  </section>`;
}

// A page for humans: the first rows read at a glance and the rest sit one tap
// away. The collapsed rows stay in the HTML, so search engines and the
// JSON-LD performer list still see every name.
const LINEUP_SHOWN = 20;
const OTHERS_SHOWN = 4;

// "Stages" — real per-festival stage content (name + description + how many
// sets each day), so "<festival> stages" queries land on substance.
function stagesSection(entry, blocks, dates) {
  const cfg = entry.config;
  const stages = (DS[cfg.id]?.stages || []).filter(s => !isPlaceholderStage(s));
  if (!stages.length) return '';
  // DATA-BOUNDED BY REQUIREMENT. The old sentence read "The Plursky app carries
  // a live map of <venue> with every stage, water station and amenity" and it
  // rendered on all 15 stage-bearing pages. That is THREE separate claims, none
  // of them checked against the data behind the page:
  //   • "a live map"      — geometryVerifiedFor() is true for 3 festivals, not
  //                         15. ACL is deliberately blind (its stage coords are
  //                         poster art, src:"poster", which the predicate
  //                         explicitly refuses as evidence).
  //   • "water station"   — 6 of these festivals carry ZERO amenities, so zero
  //                         water stations.
  //   • "amenity"         — same 6, and this section renders no amenity list at
  //                         all, so even a non-empty array is not shown here.
  // A rendered stage list proves the stage list. It proves nothing about map
  // accuracy or amenity coverage, so the copy now states only that. Anything
  // stronger has to prove the corresponding fact per festival.
  const acts = scheduleActs(DS[cfg.id]?.artists);
  const timed = acts.filter(a => a.start);
  const count = (st) => {
    if (timed.length) {
      return blocks.flatMap(b => {
        const bActs = timed.filter(a => a.stage === st && inBlock(blocks, b)(a));
        return [...new Set(bActs.map(a => a.day))].sort((x, y) => x - y)
          .map(d => `${dayLabel(cfg.dayDates, d, dates, b.shift, true).label}: ${bActs.filter(a => a.day === d).length}`);
      }).join(' · ');
    }
    const n = acts.filter(a => a.stage === st).length;
    return n ? `${n} act${n === 1 ? '' : 's'}` : '';
  };
  const n = stages.length;
  return `
  <section aria-labelledby="stages-h">
    <h2 id="stages-h">${esc(cfg.name)} stages</h2>
    <p>Plursky has ${n} stage${n === 1 ? '' : 's'} for ${esc(cfg.name)}${cfg.locationShort ? ` at ${esc(cfg.locationShort)}` : ''}, each one listed below${timed.length ? ' with its sets per day' : ''}.</p>
    <ul class="stagelist">
${stages.map(st => { const c = count(st.id); return `      <li><strong>${esc(st.name)}</strong>${st.desc ? ` · ${esc(st.desc)}` : ''}${c ? `<br><span class="counts">${esc(c)}</span>` : ''}</li>`; }).join('\n')}
    </ul>
  </section>`;
}

// ── Plan your day ─────────────────────────────────────────────────────
// Amenity TYPES the app carries, and nothing positional: no walk times,
// distances, leave-by or transition verdicts on any page, because
// geometryVerifiedFor() holds for 3 festivals and a crawlable page cannot
// show the gate the app shows. Hours print only from cfg.hours, which exists
// only where the festival's own page publishes them (with its URL and the
// date it was read), and only through editionHours(): the quoted dated block
// must be this edition's. Everywhere else there is no hours line at all.
function planSection(entry, amenities) {
  const cfg = entry.config;
  const eh = editionHours(cfg), hours = hoursLine(eh);
  if (!amenities.length && !hours) return '';
  return `
  <section aria-labelledby="plan-h">
    <h2 id="plan-h">Plan your day at ${esc(cfg.name)}</h2>
${hours ? `    <p class="hours">${esc(hours)} <span class="note">Per the <a href="${esc(eh.url)}" rel="noopener">official hours page</a>, checked ${esc(eh.observedAt)}.</span></p>\n` : ''}${amenities.length ? `    <p>Amenities Plursky lists for ${esc(cfg.name)}: ${amenities.map(([k, v]) => `${esc(k)} (${v})`).join(' · ')}.</p>\n` : ''}  </section>`;
}

// ── Past editions ─────────────────────────────────────────────────────
// Past Festivals is the read-only archive; this page is only an index into it.
// Each link opens that edition in Plursky (?tab=past&edition=<id>).
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ymdLabel(a, b) {
  if (!a) return '';
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = (b || a).split('-').map(Number);
  if (a === (b || a)) return `${MON[ma - 1]} ${da}, ${ya}`;
  if (ya === yb && ma === mb) return `${MON[ma - 1]} ${da}–${db}, ${ya}`;
  return ya === yb ? `${MON[ma - 1]} ${da} – ${MON[mb - 1]} ${db}, ${ya}` : `${MON[ma - 1]} ${da}, ${ya} – ${MON[mb - 1]} ${db}, ${yb}`;
}
const editionHref = e => `/?tab=past&amp;edition=${esc(e.id)}`;
function editionSummary(e) {
  return e.lineupOnly
    ? `${e.artists} artists from the official lineup. Set times not verified for this edition.`
    : `${e.sets} sets on ${e.stages} stages, with the day, stage and time the festival's official schedule printed.`;
}

// A festival not open in Plursky yet (a gated entry, usually next year's)
// leads with its newest past edition instead of an empty page: clearly a
// past edition, with its own dates and the date its source was archived, and
// kept apart from everything this page says about the upcoming edition.
function lookBackSection(entry, editions) {
  if (entry.available || !editions.length) return '';
  const e = editions[0];
  return `
  <section class="lookback" aria-labelledby="lookback-h" style="border:1px solid var(--line);border-radius:12px;padding:4px 16px 8px;margin:8px 0 0">
    <h2 id="lookback-h" style="margin-top:12px">Look back: ${e.year}</h2>
    <p class="meta"><span class="chip chip-past">Past edition</span>${esc(e.name)} · ${ymdLabel(e.first, e.last)}</p>
    <p>${editionSummary(e)}${e.archived ? ` <span class="note">Official source archived ${ymdLabel(e.archived)}.</span>` : ''}</p>
    <p><a href="${editionHref(e)}">Open ${esc(e.name)} in Plursky</a></p>
    <p class="note">This is the ${e.year} edition. Nothing here is ${esc(entry.config.name)}'s lineup or schedule.</p>
  </section>`;
}

function pastSection(entry, editions) {
  const rest = entry.available ? editions : editions.slice(1);
  if (!rest.length) return '';
  const cfg = entry.config;
  return `
  <section aria-labelledby="past-h">
    <h2 id="past-h">${entry.available ? 'Past editions' : 'Earlier editions'} of ${esc(cfg.brand || cfg.name)}</h2>
    <ul>
${rest.map(e => `      <li><a href="${editionHref(e)}">${esc(e.name)}</a> — ${ymdLabel(e.first, e.last)}${e.artists != null ? `, ${e.artists} artists` : ''}${e.sets != null ? `, ${e.sets} sets` : ''}${e.lineupOnly ? ', set times not verified' : ''}</li>`).join('\n')}
    </ul>
    <p class="note">Each link opens that edition in Past Festivals in Plursky.</p>
  </section>`;
}

// ── Answers, and the FAQPage that mirrors them ───────────────────────
// ONE array drives BOTH the visible <dl> and the FAQPage JSON-LD, so a
// question cannot be claimed in structured data without being answered in the
// rendered content. That is the same rule the `performer` block follows, and
// Google treats a mismatch as a structured-data violation — building the two
// from one source makes the violation unrepresentable rather than merely
// forbidden.
//
// Every answer is built from values that are already in the sitemap
// fingerprint, so an answer cannot go stale behind a frozen <lastmod>.
// Nothing here is written by hand per festival: a sentence nobody can source
// is a sentence this page does not get to say.
function faqItems(entry, { names, hasTimes, stages, blocks, plate }) {
  const cfg = entry.config;
  const where = cfg.location || '';
  const items = [];

  items.push({
    q: `When and where is ${cfg.name}?`,
    a: `${cfg.name} takes place ${cfg.dates}${where ? ` at ${where}` : ''}.`,
  });

  // Asked only when the day data itself holds more than one weekend.
  if (blocks.length > 1 && blocks.every(b => b.days.length)) {
    items.push({
      q: `How many weekends is ${cfg.name}?`,
      a: `${cfg.name} runs over ${blocks.length} weekends: ${blocks.map(b => blockRange(cfg, b)).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
    });
  }

  // The schedule answer is gated on the SAME `hasTimes` the page renders from,
  // so "yes, times are published" and an actual grid can never disagree. A
  // festival with no times gets the honest answer, not a softer one.
  if (stageProgrammingFor(cfg.id)?.scope === 'official-set-times') {
    // Provenance follows scheduleSource, like every other festival's answer:
    // this sentence said "community sources" after the source went official.
    const src = cfg.scheduleSource;
    items.push({q: `Have the ${cfg.name} set times been announced?`, a: src && src.official === true
      ? `Yes. Both days of the stage timetable are on this page: 231 sets on 13 stages, from the official set times${src.observedAt ? ` confirmed ${src.observedAt}` : ''}.`
      : 'Yes. Both days of the stage timetable are on this page: 231 sets on 13 stages, transcribed from the III Points-branded screenshot supplied October 5, gathered from community sources.'});
  } else if (hasTimes) {
    const src = cfg.scheduleSource;
    items.push({
      q: `Have the ${cfg.name} set times been announced?`,
      a: src && src.official === true
        ? `Yes. The full ${cfg.name} schedule is on this page, day by day and stage by stage${src.observedAt ? `, from the official times confirmed ${src.observedAt}` : ''}.`
        // Stops at where OUR times came from. "until the official grid is
        // published" asserted the publisher had not published one — the same
        // defect class as reporting our data absence as their silence.
        : `Yes. The full ${cfg.name} schedule is on this page, day by day and stage by stage, gathered from community sources.`,
    });
  } else if (names.length) {
    // NEUTRAL BY REQUIREMENT. `hasTimes === false` proves only that Plursky has
    // no ingested set times — it is NOT evidence about what the festival has or
    // has not published. Reporting our own data absence as publisher state is a
    // claim we cannot source, on 25 crawlable pages at once. This answer may say
    // what Plursky has; it may not say what the festival has done.
    items.push({
      q: `Have the ${cfg.name} set times been announced?`,
      a: `Plursky does not have set times for ${cfg.name} yet. The announced lineup is listed on this page; the schedule will appear here when it is available.`,
    });
  }

  if (names.length) {
    items.push({
      q: `Who is playing ${cfg.name}?`,
      a: `${names.length} artists are announced for ${cfg.name}, and every one of them is listed on this page.`,
    });
  }

  // Only asked when stagesSection() actually renders a stage list — III Points
  // carries 0 stages, so its page never claims a number it cannot show.
  if (stages.length) {
    items.push({
      q: `How many stages does ${cfg.name} have?`,
      // Ends at what this page actually shows. `stages.length` proves a stage
      // list exists; it proves nothing about what the app maps, so the answer
      // does not claim it.
      a: `${cfg.name} has ${stages.length} stage${stages.length === 1 ? '' : 's'}${cfg.locationShort ? ` at ${cfg.locationShort}` : ''}, each one listed on this page.`,
    });
  }

  // Answered from what the map section actually renders: the plate's own
  // caption, or the official page with the year it showed.
  const src = cfg.mapSource;
  if (plate) {
    items.push({
      q: `Is there a map for ${cfg.name}?`,
      a: `This page shows Plursky's ${cfg.name} site plate. ${plate.desc}`,
    });
  } else if (src && src.url) {
    items.push({
      q: `Is there a map for ${cfg.name}?`,
      a: src.mapYear === cfg.year
        ? `Yes. This page links the official ${cfg.name} map on the festival's own site.`
        : `This page links the festival's own map page${src.mapYear == null ? '' : `, which showed the ${src.mapYear} map when Plursky checked it on ${src.observedAt}`}.`,
    });
  }

  return items;
}

function answersSection(entry, items) {
  if (!items.length) return '';
  return `
  <section aria-labelledby="answers-h">
    <h2 id="answers-h">${esc(entry.config.name)} — quick answers</h2>
    <dl class="answers">
${items.map(it => `      <dt>${esc(it.q)}</dt>\n      <dd>${esc(it.a)}</dd>`).join('\n')}
    </dl>
  </section>`;
}

const TODAY = new Date().toISOString().slice(0, 10);

// Other festivals, nearest in time first, eight at most. A festival with no
// dates sorts last rather than guessing where it belongs.
function otherFestivals(entry) {
  const at = (f) => { const d = eventDates(f.config); return d ? Date.parse(d.start) : null; };
  const me = at(entry);
  return REG.filter(f => f.config.id !== entry.config.id)
    .map(f => ({ f, gap: me == null || at(f) == null ? Infinity : Math.abs(at(f) - me) }))
    .sort((x, y) => x.gap - y.gap || x.f.config.name.localeCompare(y.f.config.name))
    .slice(0, 8).map(x => x.f);
}

// ── Page template ────────────────────────────────────────────────────
function stub(entry, statusOverride, lastmod) {
  const cfg = entry.config;
  const id = cfg.id;
  const url = `${ORIGIN}/f/${id}/`;
  const ds = DS[id];
  const artists = (ds?.artists || []);
  // De-duplicate by NAME: the same act can hold several set slots.
  const names = [...new Set(artists.map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const dates = eventDates(cfg);
  const { venue, addr } = place(cfg, entry.region);
  const status = statusOverride !== undefined ? statusOverride : statusOf(cfg, TODAY);
  const isPast = status === 'past';
  const where = cfg.location || '';
  const hasTimes = scheduleActs(DS[id]?.artists).some(a => a.start && a.start !== '');
  const stages = (ds?.stages || []).filter(s => !isPlaceholderStage(s));
  const blocks = weekendBlocks(cfg);
  const plate = plateFor(cfg);
  const editions = pastEditionsFor(id);
  const amenities = amenitySummary(DS, id, entry.available);
  const mapHtml = mapSection(entry, plate);
  const indexable = names.length > 0;
  // The title promises only the sections this page renders.
  const promised = [hasTimes && 'Set Times', names.length && 'Lineup', mapHtml && 'Map'].filter(Boolean);
  const titleTail = promised.length
    ? promised.join(', ').replace(/, ([^,]*)$/, ' &amp; $1')
    : 'Dates &amp; Venue';
  // Does THIS festival's data back "find stages on a live map"?
  // map.jsx picks the real map on `mapImage && gpsAnchors.length >= 3` and
  // otherwise falls back to the SVG TopDownMap — which, with no placed stages,
  // "would render an empty plate with no stages and no art" (map.jsx:1933).
  // So the clause needs BOTH map art and stages that can actually be placed.
  // Preview entries (0 stages) and art-without-coordinates festivals get the
  // clause dropped: the copy never outruns the data.
  const allStages = ds?.stages || [];
  const mapBacked = allStages.length > 0
    && allStages.every(s => s && s.x != null && s.y != null)
    && !!(cfg.mapImage || cfg.mapMode);
  const answers = faqItems(entry, { names, hasTimes, stages, blocks, plate });
  const watchHtml = embedsSection(cfg.name, selectEmbeds(id, EMBEDS, embedWindowStart(cfg, dates)));

  const desc = hasTimes
    ? `${cfg.name} set times and lineup — ${names.length} artists at ${venue}, ${cfg.dates}. Full schedule by day and stage. Plan your weekend with Plursky.`
    : names.length
      ? `${cfg.name} lineup — ${names.length} artists at ${venue}, ${cfg.dates}. Build your schedule and share your weekend with Plursky.`
      : `${cfg.name} at ${venue}, ${cfg.dates}. Build your schedule and share your weekend with Plursky.`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: cfg.name,
    url,
    ...(dates ? { startDate: dates.start, endDate: dates.end } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: desc,
    location: { '@type': 'Place', name: venue, ...(Object.keys(addr).length ? { address: { '@type': 'PostalAddress', ...addr } } : {}) },
    // Only an image that is ours: the plate. Card art is official photography
    // and patron maps are official art; neither is licensed to us.
    ...(plate ? { image: `${ORIGIN}/${plate.file}` } : {}),
    // performer is emitted ONLY when the names are also visible on the page
    // below — structured data that isn't in the rendered content is a
    // Google structured-data violation.
    ...(names.length ? { performer: names.map(n => ({ '@type': 'MusicGroup', name: n })) } : {}),
    ...(cfg.brand ? { organizer: { '@type': 'Organization', name: cfg.brand } } : {}),
  };

  // Built from `answers`, the same array answersSection() renders below.
  const faqLd = answers.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: answers.map(it => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  } : null;

  // Mirrors the visible breadcrumb at the top of <main>.
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Plursky', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Festivals', item: `${ORIGIN}/#festivals` },
      { '@type': 'ListItem', position: 3, name: cfg.name, item: url },
    ],
  };

  // The next edition, once the registry carries one.
  const base = id.replace(/-\d{4}$/, '');
  const next = isPast ? REG.find(f => f.config.id !== id && f.config.id.replace(/-\d{4}$/, '') === base
    && (eventDates(f.config)?.start || '') > (dates?.end || '')) : null;

  const src = cfg.scheduleSource;
  const site = cfg.officialEvent && cfg.officialEvent.website;
  const sources = [
    site && `      <li>Official site: <a href="${esc(site)}" rel="noopener">${esc(site)}</a></li>`,
    // The lineup's own source. Lineup-only festivals had NO source line at all
    // (III Points listed 218 acts citing nothing); a festival whose set times
    // came from the same page is already cited by the Set times row.
    cfg.lineupSource && cfg.lineupSource.url && `      <li>Lineup: <a href="${esc(cfg.lineupSource.url)}" rel="noopener">${esc(cfg.lineupSource.url)}</a> (${cfg.lineupSource.official === true ? 'official' : 'community source'}${cfg.lineupSource.observedAt ? `, read ${esc(cfg.lineupSource.observedAt)}` : ''})</li>`,
    src && src.url && `      <li>Set times: <a href="${esc(src.url)}" rel="noopener">${esc(src.url)}</a> (${src.official === true ? 'official' : 'community source'}${src.observedAt ? `, checked ${esc(src.observedAt)}` : ''})</li>`,
    cfg.mapSource && cfg.mapSource.url && `      <li>Map: <a href="${esc(cfg.mapSource.url)}" rel="noopener">${esc(cfg.mapSource.url)}</a> (official, checked ${esc(cfg.mapSource.observedAt)})</li>`,
    editionHours(cfg)?.url && `      <li>Hours: <a href="${esc(cfg.hours.url)}" rel="noopener">${esc(cfg.hours.url)}</a> (official, checked ${esc(cfg.hours.observedAt)})</li>`,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cfg.name)} — ${titleTail} · Plursky</title>
<meta name="description" content="${esc(desc)}">
${indexable ? '' : '<meta name="robots" content="noindex">\n'}<link rel="canonical" href="${url}">
<meta name="apple-itunes-app" content="app-id=6768888507">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Plursky">
<meta property="og:title" content="${esc(cfg.name)} — ${titleTail}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/og-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(cfg.name)} — ${titleTail}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ORIGIN}/og-card.png">
<link rel="icon" type="image/png" href="/apple-touch-icon.png">
<style>
  /* The app's board tokens (index.html), both modes: Dark by default, Light when
     the reader's system asks for it. --ember is kept as the name of the link /
     accent-text role so the rules below did not have to move. */
  :root { color-scheme:dark light;
          --ink:#F3F0FA; --bg:#07060B; --muted:#ABA4BB; --line:#221E2B; --ember:#B7A3FF; --panel:#19161F;
          --acc:#9474FF; --on-acc:#0B0816; --target:rgba(148,116,255,.16); }
  @media (prefers-color-scheme: light) {
    :root { --ink:#14121C; --bg:#F4F3F8; --muted:#565266; --line:#E6E3EE; --ember:#4A2BFF; --panel:#FFFFFF;
            --acc:#4A2BFF; --on-acc:#FFFFFF; --target:rgba(74,43,255,.10); }
  }
  @font-face { font-family:"Martian Mono"; font-style:normal; font-weight:300 600; font-display:swap;
               src:url(/fonts/martian-mono-latin.woff2) format("woff2"); unicode-range:U+0000-00FF; }
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:var(--bg); color:var(--ink);
         font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,'Segoe UI',sans-serif; line-height:1.6; }
  main { max-width:760px; margin:0 auto; }
  nav.crumbs { font-size:13px; color:var(--muted); margin:0 0 16px; }
  nav.crumbs a { color:var(--muted); }
  h1 { font-size:clamp(26px,5vw,40px); line-height:1.15; margin:0 0 8px; text-wrap:balance; }
  h2 { font-size:18px; margin:32px 0 8px; }
  .meta { color:var(--muted); margin:0 0 20px; }
  .chip { display:inline-block; margin-right:8px; padding:1px 10px; border-radius:999px; border:1px solid var(--line);
          color:var(--ink); font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
  .chip-live, .chip-soon { border-color:var(--ember); color:var(--ember); }
  .note { color:var(--muted); font-size:14px; }
  figure { margin:16px 0; }
  figure img { display:block; width:100%; height:auto; max-width:100%; border-radius:12px; background:var(--panel); }
  .platebox { position:relative; max-width:520px; }
  .pin { position:absolute; transform:translate(-50%,-50%); width:20px; height:20px; border-radius:50%;
         display:flex; align-items:center; justify-content:center; background:var(--bg);
         border:1px solid var(--ink); color:var(--ink); font-size:11px; font-weight:700; pointer-events:none; }
  ol.platekey { margin:8px 0 0; padding-left:22px; font-size:13px; columns:2; column-gap:20px; }
  figcaption { color:var(--muted); font-size:13px; margin-top:6px; }
  .cta { display:inline-block; margin:20px 0 8px; padding:12px 22px; border-radius:12px;
         background:var(--acc); color:var(--on-acc); text-decoration:none; font-weight:700; }
  ul.lineup { list-style:none; padding:0; margin:12px 0 0; }
  ul.lineup li { padding:5px 0; border-bottom:1px solid var(--line); font-size:14px; display:flex; flex-wrap:wrap; gap:2px 12px; }
  ul.lineup .act { font-weight:600; }
  ul.lineup .slots { color:var(--muted); overflow-wrap:anywhere; }
  h3 { font-size:16px; margin:24px 0 4px; }
  h4 { font-size:13px; margin:16px 0 4px; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; }
  h5 { font-size:12px; margin:12px 0 4px; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; }
  ul.sets { list-style:none; padding:0; margin:4px 0 0; }
  ul.sets li { padding:3px 0; border-bottom:1px solid var(--line); font-size:14px; display:flex; gap:12px; scroll-margin-top:16px; }
  ul.sets li:target { background:var(--target); }
  ul.sets li time { color:var(--muted); font-family:"Martian Mono",ui-monospace,'SF Mono',Menlo,monospace; font-size:13px; letter-spacing:-0.01em; font-variant-numeric:tabular-nums; min-width:116px; flex:none; }
  ul.stagelist { list-style:none; padding:0; margin:8px 0 0; }
  ul.stagelist li { padding:6px 0; border-bottom:1px solid var(--line); font-size:14px; }
  ul.stagelist .counts { color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
  dl.answers { margin:12px 0 0; }
  dl.answers dt { font-weight:700; font-size:15px; margin:16px 0 4px; }
  dl.answers dd { margin:0; color:var(--muted); font-size:14px; }
  p.ctas { display:flex; flex-wrap:wrap; align-items:center; gap:8px 18px; margin:20px 0 8px; }
  p.ctas .cta { margin:0; }
  a.cta-secondary { font-weight:600; white-space:nowrap; }
  nav.other { margin-top:40px; }
  nav.other a { color:var(--ink); }
${stageProgrammingFor(entry.config.id) ? STAGE_PROGRAMMING_CSS : ''}  section.sources ul { padding-left:18px; font-size:13px; color:var(--muted); overflow-wrap:anywhere; }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:14px; }
  a { color:var(--ember); }
  details.more { margin:4px 0 0; }
  details.more > summary { cursor:pointer; color:var(--ember); font-weight:600; font-size:14px; padding:10px 0; min-height:44px; display:flex; align-items:center; }
  details.more[open] > summary { color:var(--muted); }
  section.watch .embed { margin:16px 0 20px; }
  section.watch .yt { position:relative; aspect-ratio:16/9; width:100%; min-height:200px; background:var(--panel); border-radius:12px; overflow:hidden; }
  section.watch .yt iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  /* Instagram's embed.js stamps an inline 326px min-width on its iframe. On a
     320px phone that ran 26px past the screen and cut off "View profile", so
     the iframe is held to its column; Instagram's own layout reflows to fit.
     The scroll box stays as a backstop for anything else a script inserts. */
  section.watch .embed-ig { overflow-x:auto; max-width:100%; }
  section.watch .embed-ig iframe { min-width:0 !important; width:100% !important; max-width:100% !important; box-sizing:border-box; }
  /* And nothing a third-party script inserts may widen the page, even for a
     frame mid-hydration (seen once at 320px: 346px for a moment). */
  section.watch { overflow-x:clip; }
  section.watch .embed-ig blockquote, section.watch .embed-x blockquote { margin:0; min-height:420px; background:var(--panel); border-radius:12px; padding:16px; max-width:540px; }
  section.watch .embed-x blockquote { min-height:260px; }
  /* Tap-to-load: until tapped, a social post is a compact card with its type,
     date, one button and the notice; nothing from Instagram or X is requested.
     The blockquote stays empty and hidden until the tap fills it. */
  section.watch blockquote.tap-embed { display:none; }
  section.watch .embed-tap { background:var(--panel); border-radius:12px; padding:16px; max-width:540px; box-sizing:border-box; }
  section.watch .embed-what { color:var(--ink); font-size:15px; font-weight:600; margin:0 0 10px; }
  section.watch .embed-load { min-height:44px; padding:10px 16px; border-radius:10px; border:1px solid var(--ember); background:transparent; color:var(--ember); font:inherit; font-weight:600; font-size:15px; cursor:pointer; }
  section.watch .embed-tap-note { color:var(--muted); font-size:13px; margin:8px 0 0; }
  section.watch figure.tapped .embed-tap { display:none; }
  section.watch .embed-sp iframe { display:block; border:0; border-radius:12px; min-height:352px; }
  section.watch .embed-cap { color:var(--muted); font-size:13px; margin:6px 0 0; }
  header.edition { background:var(--ed-band); color:var(--ed-ink); border:1.5px dashed var(--ed-wire); border-radius:16px; padding:18px 18px 14px; margin:8px 0 18px; }
  header.edition h1, header.edition p { color:var(--ed-ink); }
  header.edition h1 { margin-top:0; }
  header.edition .meta { display:inline-block; background:var(--ed-chip); border:1.5px dashed var(--ed-ink); padding:4px 8px; }
  header.edition .chip { background:var(--ed-ink); color:var(--ed-chip); border-color:var(--ed-ink); }
  header.edition p:last-child { margin-bottom:0; }
</style>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
${faqLd ? `<script type="application/ld+json">
${JSON.stringify(faqLd, null, 2)}
</script>
` : ''}<script type="application/ld+json">
${JSON.stringify(crumbLd, null, 2)}
</script>
</head>
<body>
<main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Plursky</a> › <a href="/#festivals">Festivals</a> › <span aria-current="page">${esc(cfg.name)}</span></nav>
${editionHeadOpen(cfg)}  <h1>${esc(cfg.name)}</h1>
  <p class="meta">${status ? `<span class="chip chip-${status}">${STATUS_LABEL[status]}</span>` : ''}${esc(cfg.dates)}${where ? ' · ' + esc(where) : ''}</p>
  <p>${esc(cfg.tagline || '')}</p>${cfg.editionSkin ? '\n  </header>' : ''}${lookBackSection(entry, editions)}
${answersSection(entry, answers)}${watchHtml}
${mapHtml}
${scheduleGrid(entry, dates, blocks)}${stageProgrammingSection(entry)}
${lineupSection(entry, blocks, dates, names, hasTimes)}
${stagesSection(entry, blocks, dates)}
${planSection(entry, amenities)}
${pastSection(entry, editions)}

  <section aria-labelledby="app-h">
    <h2 id="app-h">Get the app</h2>
    <p class="ctas">
      <a class="cta" href="https://apps.apple.com/us/app/plursky-live/id6768888507">Get the Plursky app for iPhone</a>
      <a class="cta-secondary" href="/?f=${esc(id)}">${entry.available ? (isPast ? 'Relive it in the browser' : 'Open in your browser') : 'Open Plursky in the browser'}</a>
    </p>
    <p class="note">Plursky is a free festival companion — build a personal schedule from the official lineup, ${mapBacked ? 'find stages on a live map, ' : ''}meet your crew, and turn the weekend into a shareable recap.</p>
${entry.available
  ? (entry.scheduleTBA
      ? (cfg.id === 'iii-points-2026' ? `    <p class="note">The full stage timetable is on this website. The app uses the same stage timetable.</p>\n` : `    <p class="note">${esc(cfg.name)} is open in the app — the full lineup is in. Set times appear as soon as the festival publishes them.</p>\n`)
      : '')
  : `    <p class="note">${esc(cfg.name)} is not switchable in the app yet — it goes live once the official schedule is published. The links above open Plursky on the current festival.</p>\n`}${isPast && entry.available ? `    <p><a href="/?f=${esc(id)}&amp;tab=memories">Your ${esc(cfg.name)} Memories in Plursky</a>${next ? ` · Next edition: <a href="/f/${esc(next.config.id)}/">${esc(next.config.name)}</a>` : ''}</p>\n` : ''}  </section>

  <nav class="other" aria-labelledby="other-h">
    <h2 id="other-h">Other festivals on Plursky</h2>
${(() => {
  const li = otherFestivals(entry).map(f => `      <li><a href="/f/${f.config.id}/">${esc(f.config.name)}</a> — ${esc(f.config.dates)}</li>`);
  return `    <ul>\n${li.slice(0, OTHERS_SHOWN).join('\n')}\n    </ul>\n` + (li.length > OTHERS_SHOWN
    ? `    <details class="more">\n      <summary>Show ${li.length - OTHERS_SHOWN} more</summary>\n      <ul>\n${li.slice(OTHERS_SHOWN).map(r => '  ' + r).join('\n')}\n      </ul>\n    </details>\n` : '');
})()}
  </nav>

  <section class="sources" aria-labelledby="sources-h">
    <h2 id="sources-h">Sources</h2>
${sources.length ? `    <ul>\n${sources.join('\n')}\n    </ul>\n` : ''}${lastmod ? `    <p class="note">Last updated <time class="updated" datetime="${lastmod}">${lastmod}</time>.</p>\n` : ''}  </section>

  <footer>
    <a href="/">Plursky</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a>
  </footer>
</main>
</body>
</html>
`;
}

// ── Emit ─────────────────────────────────────────────────────────────
// --check writes NOTHING. It regenerates in memory and reports any committed
// file that no longer matches, so verify.mjs can gate this the way it gates
// the precompiled bundles. Born from PR #106: Portola flipped to
// available:true, nobody re-ran this script, and /f/portola-2026/ kept telling
// plursky.com visitors "not switchable in the app yet" — a public, crawlable,
// FALSE claim about a live festival, with no gate to catch it.
//
// sitemap <lastmod> is stamped with TODAY, so it drifts every single day on
// its own. Comparing it raw would make this gate cry wolf daily and train
// everyone to ignore it, so lastmod is normalised out of the comparison. The
// URL SET still gets compared, which is the part that carries meaning.
//
// There are TWO modes, because there are two rot paths and only one of them
// belongs to a pull request:
//
//   --check         CHANGE-driven. Someone edited the registry or a lineup and
//                   did not regenerate. That is the PR author's to fix, so it
//                   blocks the PR. Runs from verify.mjs.
//   --check-strict  TIME-driven. Nothing changed but the calendar; a festival
//                   ended and its page should start saying so. No commit
//                   exists to hang that on, so it must NOT fail an unrelated
//                   PR — it is owned by the scheduled workflow instead.
//
// The page text that moves on its own is the status chip (Upcoming / This
// weekend / Happening now / Past, from statusOf) and the CTA verb that follows
// Past. Rather than regex them out of the comparison and risk masking a real
// edit to those strings, --check renders the stub under EVERY status and
// accepts any. Every other difference — a name, a date range, a lineup, an
// availability flip — still fails, because only the status is allowed to vary.
//
// Without this, the tree that is green today goes red on 2026-09-21 with no
// commit in between: Lost Lands and Nocturnal both end on Sep 20. Verified by
// running this script against an unchanged tree with TODAY pinned forward.
const CHECK_STRICT = process.argv.includes('--check-strict');
const CHECK = CHECK_STRICT || process.argv.includes('--check');
const drift = [];
// lastmod is a content fingerprint now (see the sitemap block below), so it no
// longer drifts on its own and CAN be compared — but only by the strict mode.
// A festival ending moves its page's content, and so its fingerprint, with no
// commit behind it; comparing that in --check would fail an unrelated PR for
// the calendar, which is the exact wolf the two-mode split exists to avoid.
// So --check still normalises lastmod away here, and --check-strict — the
// scheduled job that owns the clock — is where the festival dates have to
// actually be current. A page's "Last updated" line IS its sitemap lastmod,
// so it is normalised by the same rule and for the same reason.
//
// The homepage, terms and privacy rows are different: their fingerprints are
// of committed files only (index.html, terms.html, privacy.html), with no
// calendar input, so only a commit can move them. --check holds those rows'
// ledger entries AND their sitemap <lastmod> to the committed values (see
// COMMIT_ROWS, after the sitemap is built). Before that, a cache-bust in
// index.html moved the homepage fingerprint, passed every PR's verify, and
// turned the scheduled strict job red on main after the merge. That check
// lives outside this render slice on purpose: code here feeds
// templateFingerprint, and moving it would re-date every festival page.
const norm = (t, f) => CHECK_STRICT ? t
  : f === 'sitemap.xml' ? t.replace(/<lastmod>[^<]*<\/lastmod>/g, '<lastmod>-</lastmod>')
  : /^f\/[^/]+\/index\.html$/.test(f) ? t.replace(/<time class="updated" datetime="[^"]*">[^<]*<\/time>/g, '<time class="updated">-</time>')
  : t;
// strictOnly: a file whose whole job is to carry dates across runs moves on the
// calendar for the same reason the dates do, so the PR-facing --check skips it
// entirely rather than normalise half of it away.
function emit(abs, content, alsoAccept, strictOnly) {
  const rel = path.relative(root, abs);
  if (!CHECK) { writeFileSync(abs, content); return; }
  if (strictOnly && !CHECK_STRICT) return;
  const cur = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (cur === null) { drift.push(`${rel} (missing)`); return; }
  const ok = norm(cur, rel) === norm(content, rel)
    || (!CHECK_STRICT && [].concat(alsoAccept || []).some(alt => norm(cur, rel) === norm(alt, rel)));
  if (!ok) drift.push(rel);
}

if (!CHECK) {
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
}

// ── Schedule feed ────────────────────────────────────────────────────
// /f/<id>/schedule.json for every LIVE festival: the schedule exactly as this
// build ships it, plus where it came from. The app has no runtime schedule
// fetch, so iOS only learns of a change through an App Store build; this file
// is what a client reads to see one without a build (#115 Schedule Sync).
// Derived here so it can never disagree with the bundle, and gated by --check
// like the pages. No app version and no date inside — only the schedule and
// its source — so the same schedule always produces the same bytes, and
// `scheduleHash` lets a client tell "nothing changed" without diffing.
// TBA ("" times) and stage: null are valid states and pass through as-is.
function scheduleFeed(entry) {
  const cfg = entry.config;
  // data.jsx's _scheduleActs — the app diffs against this exact shape.
  const acts = scheduleActs(DS[cfg.id]?.artists);
  const hash = createHash('sha256').update(JSON.stringify(acts)).digest('hex').slice(0, 16);
  return `{\n  "festivalId": ${JSON.stringify(cfg.id)},\n  "source": ${JSON.stringify(cfg.scheduleSource || null)},\n` +
         `  "scheduleHash": "${hash}",\n  "acts": [\n${acts.map(o => '    ' + JSON.stringify(o)).join(',\n')}\n  ]\n}\n`;
}

const rows = [];
// The ledger is read BEFORE the pages are rendered, because each page prints
// its own lastmod as "Last updated". The fingerprint is of the page's source
// content, not the rendered file, so there is no cycle.
const LEDGER = path.join(root, 'sitemap-lastmod.json');
const SITEMAP = path.join(root, 'sitemap.xml');
const fileFp = (rel) => fp(existsSync(path.join(root, rel)) ? readFileSync(path.join(root, rel), 'utf8') : null);
// Which source fields are hashed, which are deliberately not, and why, all
// live in scripts/lib/sitemap-fingerprint.mjs — shared with
// scripts/test-sitemap-fingerprint.mjs so the generator and its regression
// mutants hash through one function rather than two copies of a rule.
const festivalFp = (entry) => festivalFingerprint(entry, { DS, scheduleActs, eventDates, TODAY });

// First run has no ledger. Seeding from the sitemap already committed keeps
// every published date that is still true, rather than announcing that all 28
// pages changed at once on the day this shipped — which would be false for the
// ended festivals sitting honestly at 2026-08-28. Seeding can only ever
// UNDERSTATE recency: a page whose content moved before this landed keeps its
// old date until its next real change. ACL is the one that matters there, and
// the answer-block work in this same lane is that change.
const prevLedger = (() => {
  if (existsSync(LEDGER)) return JSON.parse(readFileSync(LEDGER, 'utf8'));
  const seeded = {};
  if (existsSync(SITEMAP)) {
    for (const m of readFileSync(SITEMAP, 'utf8')
         .matchAll(/<loc>([^<]*)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(m[2])) seeded[m[1]] = { fp: null, lastmod: m[2] };
    }
  }
  return seeded;
})();
const ledger = {};
const lastmodFor = (loc, fingerprint) => {
  const was = prevLedger[loc];
  // A seeded row has no fingerprint yet: adopt its published date and record
  // the fingerprint, rather than read "unknown" as "changed".
  const lastmod = was && (was.fp === null || was.fp === fingerprint) ? was.lastmod : TODAY;
  ledger[loc] = { fp: fingerprint, lastmod };
  return lastmod;
};

const festivalLastmod = new Map();
const STATUSES = ['upcoming', 'soon', 'live', 'past'];
for (const entry of REG) {
  const id = entry.config.id;
  const dir = path.join(OUT_DIR, id);
  if (!CHECK) mkdirSync(dir, { recursive: true });
  const loc = `${ORIGIN}/f/${id}/`;
  const lastmod = lastmodFor(loc, festivalFp(entry));
  festivalLastmod.set(id, lastmod);
  // The alternates are the same page under every other status chip — see the
  // two-modes note above: the chip moves with the calendar, not with a commit.
  // Ignored by --check-strict.
  const status = statusOf(entry.config, TODAY);
  emit(path.join(dir, 'index.html'), stub(entry, status, lastmod),
       CHECK && !CHECK_STRICT && status ? STATUSES.filter(x => x !== status).map(x => stub(entry, x, lastmod)) : null);
  // Every open festival ships a feed, INCLUDING one whose set times are still
  // pending. A blank feed is not a fabricated one: `source` is null and each
  // act carries start "" / end "", which is a first-class state throughout —
  // _scheduleActs preserves it, diffSchedule has fixtures for TBA in both
  // directions, and test-schedule-diff requires the file for every available
  // festival. It is also the MECHANISM that spots the times arriving: the app
  // compares its bundled fingerprint against this feed, so suppressing it
  // would blind schedule-change detection for exactly the five festivals
  // whose schedules are about to drop.
  if (entry.available) emit(path.join(dir, 'schedule.json'), scheduleFeed(entry));
  const n = new Set((DS[id]?.artists || []).map(a => a.name)).size;
  const d = eventDates(entry.config);
  rows.push({ id, artists: n, dates: d ? `${d.start}..${d.end}` : 'NO DATES' });
  if (!CHECK) console.log(`[gen] f/${id}/index.html  artists=${n}  ${d ? d.start + '..' + d.end : 'NO DATES'}`);
}

// index.html carries the same festival list twice (static shell + <noscript>).
// Regenerate both between their markers so adding a festival to the registry
// can never leave the homepage listing a stale set.
// Built BEFORE the sitemap: the homepage's own lastmod is a fingerprint of
// this exact content, so the content has to exist before the sitemap does.
const INDEX = path.join(root, 'index.html');
let idx = readFileSync(INDEX, 'utf8');
// Descriptive anchor text: "<festival> set times" once a schedule exists,
// "<festival> lineup" until then. The bare name told a crawler nothing about
// what the target page answers, and it is the homepage — the highest-authority
// internal link surface on the site. The verb tracks `a.start` rather than a
// hand-kept list, so an anchor cannot promise set times a page does not carry.
const anchorText = (f) => {
  const timed = scheduleActs(DS[f.config.id]?.artists).some(a => a.start && a.start !== '');
  return `${f.config.name} ${timed ? 'set times' : 'lineup'}`;
};
const listHtml = (indent) => REG.map(f =>
  `${indent}<li><a href="/f/${f.config.id}/">${esc(anchorText(f))}</a> — ${esc(f.config.dates)} · ${esc(f.config.location || '')}</li>`
).join('\n');

for (const [marker, indent] of [['FESTIVAL-LIST', '        '], ['NOSCRIPT-LIST', '        ']]) {
  const re = new RegExp(`(<!-- ${marker}:START -->)[\\s\\S]*?(<!-- ${marker}:END -->)`);
  if (!re.test(idx)) throw new Error(`index.html is missing the ${marker} markers`);
  idx = idx.replace(re, `$1\n${listHtml(indent)}\n${indent}$2`);
}
emit(INDEX, idx);
if (!CHECK) console.log(`[gen] index.html festival lists refreshed (${REG.length} entries x2)`);

// ── sitemap lastmod — a content fingerprint, not a clock ──────────────
// Generated here so the sitemap can never drift from the pages above.
//
// What this replaces, and why both of its halves were wrong:
//   - a festival with a schedule was pinned to `scheduleSource.observedAt`,
//     so ACL sat frozen at 2026-09-04 while its page kept changing under it;
//   - everything else was stamped TODAY, so 17 of 28 URLs re-announced
//     themselves daily with nothing behind it. That is exactly why the
//     comparison above had to throw lastmod away: the value was noise.
// Google treats lastmod as a hint and discounts a sitemap that cries wolf, so
// the noise was not free — it was spending the signal ACL and III Points need
// before Oct 2 and Oct 16.
//
// Each URL now carries a fingerprint of its OWN indexable content, and
// sitemap-lastmod.json remembers the date that fingerprint first appeared.
// Unchanged content keeps its stored date, so running this twice is
// byte-identical and no date moves on its own; changed content takes TODAY,
// which is the honest answer to "when did this page last change?".
//
// Deliberately the festival's own content and NOT the rendered stub: every
// stub embeds an "Other festivals" nav, so hashing the file would move all 26
// festival dates whenever any single festival changed. Boilerplate churn is
// the thing a crawler is least interested in being told about twice.
//
// The ledger is STATE, and it is committed next to the content it describes,
// exactly like sitemap.xml. That is what keeps the dates coherent: a revert
// carries the ledger back with it. Revert the content WITHOUT the ledger and
// the fingerprint has genuinely moved twice, so the page reads as changed
// today — right by the rules, and a real trap when testing by hand.
const urls = [
  { loc: `${ORIGIN}/`, pri: '1.0', lastmod: lastmodFor(`${ORIGIN}/`, fp(idx)) },
  // A page with no lineup is noindex, so it stays out of the sitemap until it
  // has one; its ledger row is kept so its date survives the wait.
  ...REG.filter(f => (DS[f.config.id]?.artists || []).some(a => a.name))
    .map(f => ({ loc: `${ORIGIN}/f/${f.config.id}/`, pri: '0.8', lastmod: festivalLastmod.get(f.config.id) })),
  { loc: `${ORIGIN}/terms.html`, pri: '0.3', lastmod: lastmodFor(`${ORIGIN}/terms.html`, fileFp('terms.html')) },
  { loc: `${ORIGIN}/privacy.html`, pri: '0.3', lastmod: lastmodFor(`${ORIGIN}/privacy.html`, fileFp('privacy.html')) },
];
emit(SITEMAP,
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`);
emit(LEDGER, JSON.stringify(ledger, null, 2) + '\n', null, true);
// The rows no calendar can move. --check holds each one to what is committed:
// its ledger fingerprint and date, and its <lastmod> in sitemap.xml. The
// festival rows stay strict-only (see norm above).
const COMMIT_ROWS = [`${ORIGIN}/`, `${ORIGIN}/terms.html`, `${ORIGIN}/privacy.html`];
if (CHECK && !CHECK_STRICT) {
  const committed = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
  const published = {};
  if (existsSync(SITEMAP)) for (const m of readFileSync(SITEMAP, 'utf8')
       .matchAll(/<loc>([^<]*)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)) published[m[1]] = m[2];
  for (const loc of COMMIT_ROWS) {
    const was = committed[loc], now = ledger[loc], path_ = loc.slice(ORIGIN.length);
    if (!was || was.fp !== now.fp || was.lastmod !== now.lastmod)
      drift.push(`sitemap-lastmod.json (${path_}: fingerprint ${was ? was.fp : 'missing'}, content is ${now.fp})`);
    if (published[loc] !== now.lastmod)
      drift.push(`sitemap.xml (${path_}: <lastmod> ${published[loc] || 'missing'}, should be ${now.lastmod})`);
  }
}
if (!CHECK) console.log(`[gen] sitemap.xml  ${urls.length} urls  (${urls.filter(u => u.lastmod === TODAY).length} dated ${TODAY})`);

// A festival retired from the registry leaves its directory behind. The
// non-check path wipes f/ and rebuilds, so it never noticed; check mode built
// the expected files and looked at nothing else, so a page for a festival the
// app no longer knows about stayed live and crawlable indefinitely.
if (CHECK && existsSync(OUT_DIR)) {
  const known = new Set(REG.map(e => e.config.id));
  for (const name of readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (!name.isDirectory() || known.has(name.name)) continue;
    drift.push(`f/${name.name}/ (obsolete — no longer in the registry)`);
  }
}

if (CHECK) {
  if (drift.length) {
    console.error(`[gen] STALE — ${drift.length} generated file(s) no longer match the registry:`);
    for (const f of drift) console.error(`  ✗ ${f}`);
    console.error('[gen] fix: node scripts/gen-festival-pages.mjs');
    process.exit(1);
  }
  console.log(`[gen] ✓ ${rows.length} festival page(s) + sitemap + index lists are current`
    + (CHECK_STRICT ? ' (strict — the calendar is included)' : ' (registry content; the calendar is the scheduled job\'s)'));
} else {
  console.log(`[gen] done — ${rows.length} festival pages`);
}
