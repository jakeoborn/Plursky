#!/usr/bin/env node
// The /f/ page status chip, on real registry festivals at pinned dates.
//
// Two shapes have to come out right and they pull in opposite directions:
//   - a festival whose day split is unpublished (one dayDates bucket under a
//     two-day printed range) is "Happening now" on EVERY printed day. On main
//     at 7bbd76a III Points read "This weekend" on Oct 17, its second day;
//   - a festival that runs in blocks is NOT "Happening now" in the gap (ACL,
//     Oct 5-8; Summerfest between its three runs).
// The event days are computed here, independently of the generator, from
// dayDates and the weekend shifts.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';
import { pageStatus } from './lib/festival-page-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { REG, eventDates, weekendShifts } = loadRegistry(ROOT);
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const cfgOf = id => (REG.find(e => e.config.id === id) || {}).config;
const daysOf = cfg => {
  const out = new Set();
  for (const e of Object.values(cfg.dayDates || {}))
    for (const { shift } of weekendShifts(cfg)) out.add(new Date(Date.UTC(e.y, e.m, e.d) + shift).toISOString().slice(0, 10));
  return [...out];
};
const statusAt = (status, cfg, today) => status(eventDates(cfg), daysOf(cfg), today, Object.keys(cfg.dayDates || {}).length);

// id → { date: expected }. Dates are the festival's own, read off the registry.
const CASES = {
  'iii-points-2026':       { '2026-10-09': 'upcoming', '2026-10-15': 'soon', '2026-10-16': 'live', '2026-10-17': 'live', '2026-10-18': 'past' },
  'dreamstate-socal-2026': { '2026-11-19': 'soon', '2026-11-20': 'live', '2026-11-21': 'live', '2026-11-22': 'past' },
  'countdown-nye-2026':    { '2026-12-30': 'soon', '2026-12-31': 'live', '2027-01-01': 'live', '2027-01-02': 'past' },
  'acl-2026':              { '2026-10-01': 'soon', '2026-10-02': 'live', '2026-10-04': 'live', '2026-10-05': 'soon', '2026-10-07': 'soon',
                             '2026-10-08': 'soon', '2026-10-09': 'live', '2026-10-11': 'live', '2026-10-12': 'past' },
};
const run = (status) => {
  const wrong = [];
  for (const [id, byDate] of Object.entries(CASES)) {
    const cfg = cfgOf(id);
    if (!cfg) { wrong.push(`${id}: not in the registry`); continue; }
    for (const [today, want] of Object.entries(byDate)) {
      const got = statusAt(status, cfg, today);
      if (got !== want) wrong.push(`${id} on ${today}: ${got}, want ${want}`);
    }
  }
  return wrong;
};

// The fixtures are the shapes they are named for. At least two must still be
// single-bucket: III Points gets its official day split in its own PR, after
// which it is a two-day control here (its pinned dates read the same).
const dates = id => eventDates(cfgOf(id));
const single = ['iii-points-2026', 'dreamstate-socal-2026', 'countdown-nye-2026'].filter(id => {
  const cfg = cfgOf(id), d = cfg && dates(id);
  return cfg && Object.keys(cfg.dayDates || {}).length === 1 && d && d.end > d.start;
});
check(single.length >= 2, `at least two single-bucket festivals with a multi-day printed range (${single.join(', ') || 'none'})`);
check(daysOf(cfgOf('acl-2026')).length === 6 && dates('acl-2026').start === '2026-10-02' && dates('acl-2026').end === '2026-10-11',
  `acl-2026 runs six days inside Oct 2-11 (${daysOf(cfgOf('acl-2026')).sort().join(', ')})`);
const total = Object.values(CASES).reduce((n, c) => n + Object.keys(c).length, 0);

for (const w of run(pageStatus)) check(false, w);
checks += total - run(pageStatus).length;

// Mutations: each must get at least one pinned date wrong.
const literal = (d, days, today) => pageStatus(d, days, today, 99);              // single-bucket rule off: main's behaviour
const spanOnly = (d, days, today) => (today > d.end ? 'past' : today >= d.start ? 'live' : pageStatus(d, days, today, 1)); // live across the whole printed range
const mLiteral = run(literal), mSpan = run(spanOnly);
check(mLiteral.length > 0 && mLiteral.every(w => /iii-points|dreamstate|countdown/.test(w)), `mutation: without the single-bucket rule, second days read wrong (${mLiteral.length}: ${mLiteral[0] || 'none'})`);
check(mSpan.some(w => /acl-2026 on 2026-10-0[5-8]/.test(w)), `mutation: live across the printed range puts ACL's gap week live (${mSpan.length}: ${mSpan.find(w => /acl/.test(w)) || 'none'})`);

console.log(`  ${failed ? '✗' : '✓'}  page status: ${checks - failed}/${checks} checks (${total} pinned dates, ${single.length} single-bucket, 2 mutations)`);
process.exit(failed ? 1 : 0);
