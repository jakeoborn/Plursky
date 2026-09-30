#!/usr/bin/env node
// Festival essentials: entry age, camping, official tickets.
//
// Three layers:
//   1. The accessor (data.jsx festivalEssentials) on SYNTHETIC configs, so a
//      festival's data changing can never flip this test.
//   2. A readback of every registry festival against the committed ledger of
//      verified values (data/festival-essentials.json). This is what fails when
//      a verified `false` becomes unknown, when an unknown becomes a value
//      nobody sourced, or when an entry age appears copied from alcoholAge.
//   3. Provenance on the live data: every value has a first-party source for
//      the right edition, and no resale or aggregator URL is anywhere near it.

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { REG, festivalEssentials, entryAgeLabel, campingLabel } = loadRegistry(root);
let fails = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { fails++; console.error(`  ✗ ${msg}`); } };

// ── 1. Accessor ─────────────────────────────────────────────────────────
const NOW = Date.parse('2026-09-26T12:00:00Z');
const T = 'https://example-festival.frontgatetickets.com/';
const fx = (o = {}) => ({ id: 'fx-2026', year: 2026, endMs: Date.parse('2026-12-01T00:00:00Z'), ...o });
const on = (o = {}) => fx({ officialEvent: { tickets: T }, essentialsSources: { tickets: { url: T, state: 'on-sale', observedAt: '2026-09-20', edition: '2026', ...o } } });

check(festivalEssentials(fx({ policies: { alcoholAge: 21 } }), NOW).entryAge === null, 'alcoholAge 21 alone gives entry age UNKNOWN, never 21+');
check(festivalEssentials(fx({ policies: { alcoholAge: 21, minimumAge: 18 } }), NOW).entryAge === 18, 'entry age reads minimumAge, not alcoholAge');
check(festivalEssentials(fx({ policies: {} }), NOW).camping === null, 'no camping field is UNKNOWN, not false');
check(festivalEssentials(fx({ policies: { camping: false } }), NOW).camping === false, 'a sourced false stays false');
check(festivalEssentials(fx({ policies: { camping: 'no' } }), NOW).camping === null, 'a non-boolean camping value is not coerced');
check(festivalEssentials(fx({ policies: { minimumAge: 0 } }), NOW).entryAge === 0 && entryAgeLabel(0) === 'All ages', 'minimumAge 0 reads "All ages"');
check(entryAgeLabel(18) === 'Entry 18+' && entryAgeLabel(null) === null, 'labels: "Entry 18+"; unknown prints nothing');
check(campingLabel(null) === null && campingLabel(false) === 'No camping', 'camping labels: unknown prints nothing');
check(festivalEssentials(on(), NOW).tickets === T, 'control: a fresh on-sale primary link shows');
check(festivalEssentials(on({ state: 'sold-out' }), NOW).tickets === null, 'sold out: no ticket CTA');
check(festivalEssentials(on({ observedAt: '2026-07-01' }), NOW).tickets === null, 'a stale check (> 45 days) sells nothing');
check(festivalEssentials(on({ url: 'https://resale.example.com/' }), NOW).tickets === null, 'the source must vouch for the SAME url');
check(festivalEssentials({ ...on(), endMs: Date.parse('2026-09-01T00:00:00Z') }, NOW).tickets === null
  && festivalEssentials({ ...on(), endMs: Date.parse('2026-09-01T00:00:00Z') }, NOW).ticketState === 'ended', 'an ended festival: no CTA, state "ended"');

// ── 2. Readback against the verified ledger ────────────────────────────
const ledger = JSON.parse(readFileSync(path.join(root, 'data', 'festival-essentials.json'), 'utf8'));
const ids = REG.map(e => e.config.id);
check(Object.keys(ledger.festivals).sort().join() === [...ids].sort().join(),
  `the ledger covers exactly the ${ids.length} registry festivals`);
for (const e of REG) {
  const c = e.config, got = festivalEssentials(c, NOW), want = ledger.festivals[c.id] || {};
  check(got.entryAge === (want.entryAge ?? null), `${c.id}: entry age ${got.entryAge} ≠ ledger ${want.entryAge ?? null}`);
  check(got.camping === (want.camping ?? null), `${c.id}: camping ${got.camping} ≠ ledger ${want.camping ?? null}`);
  check((c.officialEvent?.tickets || null) === (want.tickets ?? null), `${c.id}: tickets URL ≠ ledger`);
  // Conflation guard on real data: an entry age equal to the alcohol age must
  // be sourced by its OWN record, not borrowed.
  if (got.entryAge != null) check(!!c.essentialsSources?.minimumAge?.url, `${c.id}: entry age ${got.entryAge} has no source of its own`);
}

// ── 3. Provenance ──────────────────────────────────────────────────────
const NOT_FIRST_PARTY = /musicfestivalwizard|stubhub|vividseats|seatgeek|tickpick|viagogo|gametime|festivalticker|jambase|wikipedia|reddit/i;
for (const e of REG) {
  const c = e.config, p = c.policies || {}, s = c.essentialsSources || {};
  const year = String(c.year ?? (c.id.match(/(\d{4})$/) || [])[1]);
  for (const [field, has] of [['minimumAge', p.minimumAge != null], ['camping', typeof p.camping === 'boolean'], ['tickets', !!s.tickets]]) {
    const src = s[field];
    if (!has) { check(!src, `${c.id}: essentialsSources.${field} with no value to source`); continue; }
    check(src && /^https:\/\//.test(src.url || ''), `${c.id}: ${field} needs an https source url`);
    check(src && /^\d{4}-\d{2}-\d{2}$/.test(src.observedAt || ''), `${c.id}: ${field} needs observedAt YYYY-MM-DD`);
    check(src && String(src.edition) === year, `${c.id}: ${field} source is for edition ${src && src.edition}, festival is ${year}`);
    check(src && !NOT_FIRST_PARTY.test(src.url || ''), `${c.id}: ${field} source is not first-party (${src && src.url})`);
  }
  if (s.tickets) {
    check(s.tickets.url === c.officialEvent?.tickets, `${c.id}: tickets source vouches for a different URL than officialEvent.tickets`);
    check(['on-sale', 'sold-out', 'ended', 'not-yet-on-sale'].includes(s.tickets.state), `${c.id}: tickets state "${s.tickets.state}"`);
  }
  if (c.officialEvent?.tickets) check(!NOT_FIRST_PARTY.test(c.officialEvent.tickets), `${c.id}: officialEvent.tickets is resale/aggregator`);
}

console.log(fails ? `✗ festival essentials: ${fails} of ${checks} checks failed` : `✓ festival essentials: ${checks} checks (accessor, ${ids.length}-festival readback, provenance)`);
process.exit(fails ? 1 : 0);
