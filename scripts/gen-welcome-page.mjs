#!/usr/bin/env node
// Generates /welcome/index.html, the marketing landing and web onboarding,
// from scripts/templates/welcome.html plus the festival registry.
//
//     node scripts/gen-welcome-page.mjs           # write welcome/index.html
//     node scripts/gen-welcome-page.mjs --check   # exit 1 if it is stale
//
// Why generated: the page lists upcoming festivals and counts down to the next
// gates. Hand-copying names, dates and accents would drift from data.jsx the
// first time a festival is added or moved. Only dates go in, never "today":
// the page decides what is upcoming in the browser, so the committed file only
// changes when the registry does and --check stays stable day to day.
//
// The onboarding reads each festival's lineup from the generated
// /f/<id>/schedule.json (gen-festival-pages.mjs), so act ids match the ones
// the app saves under `<festivalId>_saved_v1`.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';
import { pastEditionsFor } from './lib/festival-page-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(root, 'scripts', 'templates', 'welcome.html');
const OUT = path.join(root, 'welcome', 'index.html');
const MARK = '/*__WELCOME_DATA__*/null';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const { REG, DS, eventDates } = loadRegistry(root);

// "May 15–17, 2026" -> "May 15–17"; a span across months keeps both.
function shortDates(start, end, fallback) {
  if (!start) return fallback || 'Dates TBA';
  const [, sm, sd] = start.split('-').map(Number);
  const [, em, ed] = (end || start).split('-').map(Number);
  if (start === end || !end) return `${MON[sm - 1]} ${sd}`;
  return sm === em ? `${MON[sm - 1]} ${sd}–${ed}` : `${MON[sm - 1]} ${sd} – ${MON[em - 1]} ${ed}`;
}

const festivals = REG.map((e) => {
  const c = e.config || {};
  let d = null;
  try { d = eventDates(c); } catch { d = null; }
  const start = d && d.start ? d.start : null;
  const end = d && d.end ? d.end : null;
  const ds = DS[c.id];
  return {
    id: c.id,
    name: c.name,
    short: c.shortName || String(c.name || '').replace(/\s+20\d\d$/, ''),
    location: c.location || '',
    dates: c.dates || 'Dates TBA',
    datesShort: shortDates(start, end, c.dates),
    start,
    end,
    startMs: typeof c.startMs === 'number' ? c.startMs : null,
    accent: e.accent || null,
    available: !!e.available && !!ds,
    scheduleTBA: !!e.scheduleTBA,
    hasSchedule: existsSync(path.join(root, 'f', c.id, 'schedule.json')),
    // Its own page (gen-festival-pages), and the earlier years the Past
    // Festivals library holds for it, newest first. Each year opens in the app
    // at ?tab=past&edition=<id>, the same link the festival page uses.
    page: existsSync(path.join(root, 'f', c.id, 'index.html')) ? `/f/${c.id}/` : null,
    past: pastEditionsFor(c.id, root).map((p) => ({ id: p.id, name: p.name, year: p.year, first: p.first, last: p.last, lineupOnly: !!p.lineupOnly })),
    stages: (ds && Array.isArray(ds.stages) ? ds.stages : [])
      .filter((s) => s && s.name && s.color)
      .map((s) => ({ name: s.name, color: s.color })),
  };
}).filter((f) => f.id && f.name);

const template = readFileSync(TEMPLATE, 'utf8');
if (!template.includes(MARK)) {
  console.error(`✗ ${path.relative(root, TEMPLATE)} lost its ${MARK} marker`);
  process.exit(1);
}
// Escape "<" so no festival string can close the <script> it is inlined into.
const json = JSON.stringify({ festivals }).replace(/</g, '\\u003c');
const html = template.replace(MARK, json);

if (process.argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== html) {
    console.error('✗ welcome/index.html is stale. Run: node scripts/gen-welcome-page.mjs');
    process.exit(1);
  }
  console.log(`✓ welcome/index.html current (${festivals.length} festivals)`);
} else {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  console.log(`[welcome] wrote welcome/index.html (${festivals.length} festivals, ${festivals.filter((f) => f.available && f.hasSchedule).length} open)`);
}
