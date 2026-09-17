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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://plursky.com';
const OUT_DIR = path.join(root, 'f');

// ── Load the registry out of data.jsx ────────────────────────────────
// scripts/lib/load-registry.mjs runs data/festivals/*.js before data.jsx, the
// same order index.html uses; without the modules the registry is missing
// festivals and their /f/ pages silently stop being generated.
// Each stub renders the festival's real schedule inline (day then stage,
// from the same _scheduleActs data schedule.json ships) and links the App
// Store install path, so "<festival> set times" queries land on substance.
const { REG, DS, scheduleActs, eventDates } = loadRegistry(root);

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

// dayDates months are 0-indexed (m:8 = September). Date label for a schedule
// day; days outside the registry's public `dates` span are early-entry (Lost
// Lands days 1-2 are Sep 16-17 pre-party days while the public dates are
// Sep 18-20) and say so, because the page must never claim a festival day
// the public dates don't.
function dayLabel(dd, d, dates) {
  const e = (dd || {})[d];
  if (!e) return `Day ${d}`;
  let label = `${e.name}, ${MONTH_NAMES[e.m]} ${e.d}`;
  const ymd = `${e.y}-${String(e.m + 1).padStart(2, '0')}-${String(e.d).padStart(2, '0')}`;
  if (dates && (ymd < dates.start || ymd > dates.end)) label += ' (early entry)';
  return { label, ymd };
}

// The schedule grid: the same acts schedule.json ships, grouped day then
// stage, rendered INLINE at build time (never client-fetched) because these
// stubs are the only HTML a crawler sees. Source honesty mirrors the data:
// an unofficial scheduleSource says so on the page rather than letting the
// page overclaim.
function scheduleGrid(entry, dates) {
  const cfg = entry.config;
  const stages = DS[cfg.id]?.stages || [];
  const acts = scheduleActs(DS[cfg.id]?.artists).filter(a => a.start && a.start !== '');
  if (!acts.length) return '';
  const stageIx = (sid) => { const i = stages.findIndex(t => t.id === sid); return i === -1 ? stages.length : i; };
  const stageName = (sid) => stages.find(t => t.id === sid)?.name
    || String(sid || 'Other').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const days = [...new Set(acts.map(a => a.day))].sort((a, b) => a - b);
  const blocks = days.map(d => {
    const { label, ymd } = dayLabel(cfg.dayDates, d, dates);
    const dayActs = acts.filter(a => a.day === d);
    const stageIds = [...new Set(dayActs.map(a => a.stage))].sort((x, y) => stageIx(x) - stageIx(y));
    return `    <h3>${esc(label)}</h3>\n` + stageIds.map(st => {
      const sets = dayActs.filter(a => a.stage === st)
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
      return `    <h4>${esc(stageName(st))}</h4>\n    <ul class="sets">\n` +
        sets.map(a => `      <li><time${ymd ? ` datetime="${ymd}T${esc(a.start)}"` : ''}>${esc(a.start)}${a.end ? ' – ' + esc(a.end) : ''}</time> <span>${esc(a.name)}</span></li>`).join('\n') +
        `\n    </ul>`;
    }).join('\n');
  }).join('\n');
  const src = cfg.scheduleSource;
  const srcNote = src && src.official === true
    ? `Official set times${src.observedAt ? `, confirmed ${esc(src.observedAt)}` : ''}.`
    : 'Set times gathered from community sources. Plursky swaps in the official schedule the moment it drops.';
  return `
  <section aria-labelledby="schedule-h">
    <h2 id="schedule-h">${esc(cfg.name)} schedule &amp; set times</h2>
    <p class="note">${srcNote}${cfg.tzAbbr ? ` All times local (${esc(cfg.tzAbbr)}).` : ''}</p>
${blocks}
  </section>`;
}

// "Stages & map" — real per-festival stage content (name + description), so
// "<festival> map" queries land on substance, not a placeholder.
function stagesSection(entry) {
  const cfg = entry.config;
  const stages = DS[cfg.id]?.stages || [];
  if (!stages.length) return '';
  return `
  <section aria-labelledby="stages-h">
    <h2 id="stages-h">${esc(cfg.name)} stages &amp; map</h2>
    <p>The Plursky app carries a live map of ${esc(cfg.locationShort || cfg.name)} with every stage, water station and amenity.</p>
    <ul class="stagelist">
${stages.map(st => `      <li><strong>${esc(st.name)}</strong>${st.desc ? ` · ${esc(st.desc)}` : ''}</li>`).join('\n')}
    </ul>
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
// Every answer is built from registry values that are already in the sitemap
// fingerprint, so an answer cannot go stale behind a frozen <lastmod>.
// Nothing here is written by hand per festival: a sentence nobody can source
// is a sentence this page does not get to say.
function faqItems(entry, { names, hasTimes, stages }) {
  const cfg = entry.config;
  const where = cfg.location || '';
  const items = [];

  items.push({
    q: `When and where is ${cfg.name}?`,
    a: `${cfg.name} takes place ${cfg.dates}${where ? ` at ${where}` : ''}.`,
  });

  // The schedule answer is gated on the SAME `hasTimes` the page renders from,
  // so "yes, times are published" and an actual grid can never disagree. A
  // festival with no times gets the honest answer, not a softer one.
  if (hasTimes) {
    const src = cfg.scheduleSource;
    items.push({
      q: `Have the ${cfg.name} set times been announced?`,
      a: src && src.official === true
        ? `Yes. The full ${cfg.name} schedule is on this page, day by day and stage by stage${src.observedAt ? `, from the official times confirmed ${src.observedAt}` : ''}.`
        : `Yes. The full ${cfg.name} schedule is on this page, day by day and stage by stage, gathered from community sources until the official grid is published.`,
    });
  } else if (names.length) {
    items.push({
      q: `Have the ${cfg.name} set times been announced?`,
      a: `Not yet. The ${cfg.name} lineup is announced and listed on this page, but the festival has not published set times. Plursky adds the schedule as soon as it drops.`,
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
      a: `${cfg.name} has ${stages.length} stage${stages.length === 1 ? '' : 's'}${cfg.locationShort ? ` at ${cfg.locationShort}` : ''}, each one listed on this page and mapped in the Plursky app.`,
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

// ── Page template ────────────────────────────────────────────────────
function stub(entry, isPastOverride) {
  const cfg = entry.config;
  const id = cfg.id;
  const url = `${ORIGIN}/f/${id}/`;
  const ds = DS[id];
  const artists = (ds?.artists || []);
  // De-duplicate by NAME: the same act can hold several set slots.
  const names = [...new Set(artists.map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const dates = eventDates(cfg);
  const { venue, addr } = place(cfg, entry.region);
  const isPast = typeof isPastOverride === 'boolean'
    ? isPastOverride
    : (dates ? dates.end < TODAY : false);
  const where = cfg.location || '';
  const hasTimes = scheduleActs(DS[id]?.artists).some(a => a.start && a.start !== '');
  const titleTail = hasTimes ? 'Set Times, Lineup &amp; Map' : 'Lineup, Map &amp; Schedule';
  const stages = ds?.stages || [];
  const answers = faqItems(entry, { names, hasTimes, stages });

  const desc = hasTimes
    ? `${cfg.name} set times and lineup — ${names.length} artists at ${venue}, ${cfg.dates}. Full schedule by day and stage. Plan your weekend with Plursky.`
    : names.length
      ? `${cfg.name} lineup — ${names.length} artists at ${venue}, ${cfg.dates}. Build your schedule, map the stages and share your weekend with Plursky.`
      : `${cfg.name} at ${venue}, ${cfg.dates}. Build your schedule, map the stages and share your weekend with Plursky.`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MusicFestival',
    name: cfg.name,
    url,
    ...(dates ? { startDate: dates.start, endDate: dates.end } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: desc,
    location: { '@type': 'Place', name: venue, ...(Object.keys(addr).length ? { address: { '@type': 'PostalAddress', ...addr } } : {}) },
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

  const lineupSection = names.length ? `
  <section aria-labelledby="lineup-h">
    <h2 id="lineup-h">${esc(cfg.name)} lineup</h2>
    <p>${names.length} artists announced.</p>
    <ul class="lineup">
${names.map(n => `      <li>${esc(n)}</li>`).join('\n')}
    </ul>
${cfg.setTimesProvisional ? `    <p class="note">Stage assignments and set times for ${esc(cfg.name)} have not been published yet. Plursky adds the official schedule as soon as it drops.</p>` : ''}
  </section>` : `
  <section>
    <h2>${esc(cfg.name)} lineup</h2>
    <p>The ${esc(cfg.name)} lineup has not been announced yet. Plursky adds it as soon as it drops.</p>
  </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cfg.name)} — ${titleTail} · Plursky</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
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
  :root { --ink:#f7ede0; --bg:#12100e; --muted:rgba(247,237,224,0.62); --line:rgba(247,237,224,0.14); --ember:#e85d2e; }
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:var(--bg); color:var(--ink);
         font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; line-height:1.6; }
  main { max-width:760px; margin:0 auto; }
  h1 { font-size:clamp(26px,5vw,40px); line-height:1.15; margin:0 0 8px; }
  h2 { font-size:18px; margin:32px 0 8px; }
  .meta { color:var(--muted); margin:0 0 20px; }
  .note { color:var(--muted); font-size:14px; }
  .cta { display:inline-block; margin:20px 0 8px; padding:12px 22px; border-radius:12px;
         background:linear-gradient(135deg,#6D28D9,var(--ember)); color:#fff; text-decoration:none; font-weight:700; }
  ul.lineup { list-style:none; padding:0; margin:12px 0 0;
              display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:2px 16px; }
  ul.lineup li { padding:3px 0; border-bottom:1px solid var(--line); font-size:14px; }
  h3 { font-size:16px; margin:24px 0 4px; }
  h4 { font-size:13px; margin:16px 0 4px; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; }
  ul.sets { list-style:none; padding:0; margin:4px 0 0; }
  ul.sets li { padding:3px 0; border-bottom:1px solid var(--line); font-size:14px; display:flex; gap:12px; }
  ul.sets li time { color:var(--muted); font-variant-numeric:tabular-nums; min-width:96px; flex:none; }
  ul.stagelist { list-style:none; padding:0; margin:8px 0 0; }
  ul.stagelist li { padding:6px 0; border-bottom:1px solid var(--line); font-size:14px; }
  dl.answers { margin:12px 0 0; }
  dl.answers dt { font-weight:700; font-size:15px; margin:16px 0 4px; }
  dl.answers dd { margin:0; color:var(--muted); font-size:14px; }
  a.cta-secondary { margin-left:14px; font-weight:600; }
  nav.other { margin-top:40px; }
  nav.other a { color:var(--ink); }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:14px; }
  a { color:var(--ember); }
</style>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
${faqLd ? `<script type="application/ld+json">
${JSON.stringify(faqLd, null, 2)}
</script>
` : ''}</head>
<body>
<main>
  <h1>${esc(cfg.name)}</h1>
  <p class="meta">${esc(cfg.dates)}${where ? ' · ' + esc(where) : ''}${isPast ? ' · This festival has ended.' : ''}</p>
  <p>${esc(cfg.tagline || '')}</p>

  <p>
    <a class="cta" href="https://apps.apple.com/us/app/plursky-live/id6768888507">Get the Plursky app for iPhone</a>
    <a class="cta-secondary" href="/?f=${esc(id)}">${entry.available ? (isPast ? 'Relive it in the browser' : 'Open in your browser') : 'Open Plursky in the browser'}</a>
  </p>
  <p class="note">Plursky is a free festival companion — build a personal schedule from the official lineup, find stages on a live map, meet your crew, and turn the weekend into a shareable recap.</p>
${entry.available
  ? (entry.scheduleTBA
      ? `  <p class="note">${esc(cfg.name)} is open in the app — the full lineup is in. Set times appear as soon as the festival publishes them.</p>`
      : '')
  : `  <p class="note">${esc(cfg.name)} is not switchable in the app yet — it goes live once the official schedule is published. The links above open Plursky on the current festival.</p>`}
${answersSection(entry, answers)}
${scheduleGrid(entry, dates)}
${stagesSection(entry)}
${lineupSection}

  <nav class="other" aria-labelledby="other-h">
    <h2 id="other-h">Other festivals on Plursky</h2>
    <ul>
${REG.filter(f => f.config.id !== id).map(f => `      <li><a href="/f/${f.config.id}/">${esc(f.config.name)}</a> — ${esc(f.config.dates)}</li>`).join('\n')}
    </ul>
  </nav>

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
// The page text that moves on its own is the "This festival has ended." line
// and the CTA verb, both derived from `dates.end < TODAY`. Rather than regex
// them out of the comparison and risk masking a real edit to those strings,
// --check renders the stub BOTH ways and accepts either. Every other
// difference — a name, a date range, a lineup, an availability flip — still
// fails, because only the isPast branch is allowed to vary.
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
// So --check still normalises lastmod away, and --check-strict — the scheduled
// job that owns the clock — is where the date has to actually be current.
const norm = (t, f) => (f === 'sitemap.xml' && !CHECK_STRICT)
  ? t.replace(/<lastmod>[^<]*<\/lastmod>/g, '<lastmod>-</lastmod>')
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
    || (!CHECK_STRICT && alsoAccept != null && norm(cur, rel) === norm(alsoAccept, rel));
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
for (const entry of REG) {
  const id = entry.config.id;
  const dir = path.join(OUT_DIR, id);
  if (!CHECK) mkdirSync(dir, { recursive: true });
  // The alternate is the same page on the other side of its end date — see
  // the two-modes note above. Ignored by --check-strict.
  emit(path.join(dir, 'index.html'), stub(entry),
       CHECK && !CHECK_STRICT ? stub(entry, !(eventDates(entry.config)
         ? eventDates(entry.config).end < TODAY : false)) : null);
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

const urls = [
  { loc: `${ORIGIN}/`, pri: '1.0', lastmod: lastmodFor(`${ORIGIN}/`, fp(idx)) },
  ...REG.map(f => ({ loc: `${ORIGIN}/f/${f.config.id}/`, pri: '0.8',
                     lastmod: lastmodFor(`${ORIGIN}/f/${f.config.id}/`, festivalFp(f)) })),
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
