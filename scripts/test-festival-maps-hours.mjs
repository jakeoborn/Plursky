#!/usr/bin/env node
// Official festival maps and hours, exactly as ruled (DATA ruling, observed
// 2026-09-24). Offline: reads the registry and the committed /f/ pages.
//   · every mapSource and every hours value carries its source URL (https,
//     first-party) and the date it was read
//   · the SET of festivals with a map link / with hours is exactly the ruled
//     set: a festival with no published value has no field, and a held one
//     (Portola: conflicting doors; EDC Orlando: gated; Decadence: 2025 page;
//     Beyond SoCal: TBA) can only gain one through a new ruling here
//   · each page prints its hours line and Sources row, and no other page does
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';
import { hoursLine } from './lib/festival-page-data.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0; const problems = [];
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

const MAPS = {
  'edc-lv-2026': ['https://lasvegas.edc.com/festival-map/', 2026],
  'acl-2026': ['https://support.aclfestival.com/hc/en-us/articles/4405399774484-Festival-Map', null],
  'crssd-fall-2026': ['https://www.crssdfest.com/map', 2025],
  'escape-halloween-2026': ['https://escapehalloween.com/festival-map/', 2025],
  'hard-summer-2026': ['https://www.hardsummer.com/festival-map/', 2026],
  'electric-forest-2027': ['https://www.electricforestfestival.com/maps', 2026],
  'governors-ball-2026': ['https://support.govball.com/hc/en-us/articles/11579732251284-Is-there-a-current-festival-map', 2026],
  'outside-lands-2026': ['https://www.sfoutsidelands.com/info', 2026],
  'coachella-2027': ['https://www.coachella.com/maps', 2026],
  'summerfest-2026': ['https://www.summerfest.com/about/', 2026],
};
const HOURS = {
  'outside-lands-2026': ['https://www.sfoutsidelands.com/info', 'Gates open 11:00 AM; music starts 12:00 PM.'],
  'nocturnal-wonderland-2026': ['https://www.nocturnalwonderland.com/guide/hours-and-info/', 'Festival hours: 3:00 PM – 12:00 AM each day.'],
  'countdown-nye-2026': ['https://countdownnye.com/guide/hours-and-info/', 'Festival hours: 4:00 PM – 2:00 AM.'],
  'dreamstate-socal-2026': ['https://socal.dreamstateusa.com/guide/hours-and-info/', 'Event hours: 4:00 PM – 1:00 AM.'],
};
const HELD = ['portola-2026', 'edc-orlando-2026', 'decadence-colorado-2026', 'beyond-wonderland-socal-2027'];
const DATE = /^\d{4}-\d{2}-\d{2}$/, HM = /^([01]\d|2[0-3]):[0-5]\d$/;

const { REG } = loadRegistry(ROOT);
const byId = Object.fromEntries(REG.map(e => [e.config.id, e]));
check(Object.keys(MAPS).concat(Object.keys(HOURS), HELD).every(id => byId[id]), `control: a ruled festival id is missing from the registry: ${Object.keys(MAPS).concat(Object.keys(HOURS), HELD).filter(id => !byId[id]).join(', ')}`);

for (const e of REG) {
  const { id, mapSource: m, hours: h } = e.config;
  // Maps
  check(!!m === !!MAPS[id], `${id}: ${m ? 'has a map link the ruling does not give it' : 'is missing its ruled map link'}`);
  if (m) {
    check(/^https:\/\//.test(m.url) && DATE.test(m.observedAt || ''), `${id}: mapSource without an https URL and observedAt date: ${JSON.stringify(m)}`);
    if (MAPS[id]) check(m.url === MAPS[id][0] && (m.mapYear ?? null) === MAPS[id][1], `${id}: mapSource ${m.url} (${m.mapYear}) is not the ruled ${MAPS[id][0]} (${MAPS[id][1]})`);
  }
  // Hours
  check(!!h === !!HOURS[id], `${id}: ${h ? 'has hours the ruling does not give it' : 'is missing its ruled hours'}`);
  if (h) {
    check(/^https:\/\//.test(h.url) && DATE.test(h.observedAt || ''), `${id}: hours without an https URL and observedAt date: ${JSON.stringify(h)}`);
    check(HM.test(h.open) && (h.close == null || HM.test(h.close)) && (h.musicStart == null || HM.test(h.musicStart)), `${id}: hours not in 24h HH:MM: ${JSON.stringify(h)}`);
    check(['Gates', 'Festival', 'Event'].includes(h.label), `${id}: hours label "${h.label}" is not one the official pages use`);
    if (HOURS[id]) {
      check(h.url === HOURS[id][0], `${id}: hours cite ${h.url}, not the ruled ${HOURS[id][0]}`);
      check(hoursLine(h) === HOURS[id][1], `${id}: hours read "${hoursLine(h)}", want "${HOURS[id][1]}"`);
    }
  }
  if (HELD.includes(id)) check(!h, `${id}: held by the ruling, but carries hours`);

  // The page
  const html = readFileSync(path.join(ROOT, 'f', id, 'index.html'), 'utf8');
  const line = (html.match(/<p class="hours">([\s\S]*?)<\/p>/) || [])[1];
  const row = html.includes('<li>Hours: <a ');
  if (HOURS[id]) {
    check(!!line && line.startsWith(HOURS[id][1].replace(/&/g, '&amp;')), `${id}: the page does not print its hours line (${line})`);
    check(!!line && line.includes(`href="${HOURS[id][0]}"`) && line.includes('checked 2026-09-24'), `${id}: the hours line does not cite its source and date`);
    check(row && html.includes(`<li>Hours: <a href="${HOURS[id][0]}"`), `${id}: Sources has no Hours row`);
  } else {
    check(!line && !row, `${id}: a page with no ruled hours prints an hours line or row`);
  }
  if (MAPS[id]) check(html.includes(`<li>Map: <a href="${MAPS[id][0].replace(/&/g, '&amp;')}"`), `${id}: Sources has no Map row for ${MAPS[id][0]}`);
}

// The clock: midnight and noon are the two a formatter gets wrong.
check(hoursLine({ label: 'Festival', open: '12:00', close: '00:00', url: 'https://x' }) === 'Festival hours: 12:00 PM – 12:00 AM.', 'clock: noon/midnight mislabelled');
check(hoursLine({ label: 'Festival', open: '12:00', close: '00:00' }) === '', 'an hours value with no source URL still prints');

if (problems.length) {
  console.log(`  ✗ festival maps & hours: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log('    ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ festival maps & hours: ${checks} checks (${Object.keys(MAPS).length} map links, ${Object.keys(HOURS).length} festivals with hours, ${HELD.length} held)`);
