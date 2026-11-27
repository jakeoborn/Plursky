#!/usr/bin/env node
// Gate for the subscribable festival calendars (/f/<id>/schedule.ics).
//
//   A. Fixtures through scripts/lib/festival-ics.mjs: late-night sets land on
//      the next calendar date, a sunrise end rolls over, TBA is left out, a set
//      with no end gets no DTEND, text is escaped, lines fold at 75 octets
//      without splitting UTF-8, CRLF throughout, input order never decides.
//   B. Every committed calendar against its own page: the page links the
//      calendar exactly when the file exists, every event's URL anchor is a
//      set row on that page, and every event's start AND end, read back in
//      the festival's zone FROM THE REGISTRY, is the very clock time and date
//      that row prints. A row with no end has no DTEND. The calendar's own
//      X-WR-TIMEZONE must name that same zone (lane III, #619: a DTEND moved
//      by 1 minute passed when only starts were compared, and reading the zone
//      back from the file could not catch a wrong zone).
//   C. Mutants of the lib (late-night rule, end rollover, escaping, folding)
//      must each fail A. A gate that cannot fail proves nothing.
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRegistry } from './lib/load-registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'scripts', 'lib', 'festival-ics.mjs');
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const CAL = { id: 'fx', name: 'Fixture Fest, 2026', tz: 'America/Los_Angeles', location: 'Speedway; Nevada', url: 'https://plursky.com/f/fx/', stamp: '2026-11-26' };
const SETS = [
  { uid: 'fx-c@plursky.com', ymd: '2026-05-15', start: '01:00', end: '02:30', name: 'Late Act', stage: 'Neon', url: 'https://plursky.com/f/fx/#c' },
  { uid: 'fx-a@plursky.com', ymd: '2026-05-15', start: '19:00', end: '20:00', name: 'Opener, b2b; Friend', stage: 'Kinetic', url: 'https://plursky.com/f/fx/#a' },
  { uid: 'fx-d@plursky.com', ymd: '2026-05-16', start: '22:00', end: '08:30', name: 'Sunrise Marathon', stage: 'Kinetic', url: 'https://plursky.com/f/fx/#d' },
  { uid: 'fx-e@plursky.com', ymd: '2026-05-15', start: '', end: '', name: 'TBA Act', stage: 'Neon', url: 'https://plursky.com/f/fx/#e' },
  { uid: 'fx-f@plursky.com', ymd: '2026-05-15', start: '21:00', end: '', name: 'Ætherlight Ölüdeniz Ñandú Øresund Śnieżka Žižkov Ūdenshū Ĳsselmeer', stage: 'Bionic', url: 'https://plursky.com/f/fx/#f' },
];
const events = (t) => [...t.matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/g)].map(m => {
  const body = m[1].replace(/\r\n /g, '');
  const get = (k) => (new RegExp(`^${k}[;:]([^\\r\\n]*)`, 'm').exec(body) || [])[1] ?? null;
  return { uid: get('UID'), start: get('DTSTART'), end: get('DTEND'), summary: get('SUMMARY'), url: get('URL'), location: get('LOCATION') };
});

function fixtureChecks(lib, tag = '') {
  const before = failed;
  const { text, events: n } = lib.festivalIcs(CAL, SETS);
  const ev = events(text);
  const by = Object.fromEntries(ev.map(e => [e.uid, e]));
  check(n === 4 && ev.length === 4 && !by['fx-e@plursky.com'], `${tag}A. TBA set left out (4 of 5 events)`);
  check(by['fx-c@plursky.com']?.start === '20260516T080000Z', `${tag}A. Fri 01:00 PDT is Sat May 16 08:00Z, the night of the festival day (${by['fx-c@plursky.com']?.start})`);
  check(by['fx-a@plursky.com']?.start === '20260516T020000Z', `${tag}A. Fri 19:00 PDT is 02:00Z next UTC day`);
  check(by['fx-d@plursky.com']?.end === '20260517T153000Z', `${tag}A. 22:00 to 08:30 sunrise set rolls its end over a day (${by['fx-d@plursky.com']?.end})`);
  check(by['fx-f@plursky.com'] && by['fx-f@plursky.com'].end === null, `${tag}A. no end time -> no DTEND, never an invented hour`);
  check(by['fx-a@plursky.com']?.summary === 'Opener\\, b2b\\; Friend · Kinetic', `${tag}A. commas and semicolons escaped in SUMMARY`);
  check(/X-WR-CALNAME:Fixture Fest\\, 2026/.test(text), `${tag}A. calendar name escaped`);
  check(text.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75), `${tag}A. every physical line <= 75 octets`);
  check(!/[^\r]\n/.test(text) && text.endsWith('\r\n'), `${tag}A. CRLF line endings throughout`);
  check(text.replace(/\r\n /g, '').includes('Ætherlight Ölüdeniz Ñandú Øresund Śnieżka Žižkov Ūdenshū Ĳsselmeer'), `${tag}A. folding never splits a UTF-8 character`);
  check(ev.map(e => e.uid).join() === 'fx-a@plursky.com,fx-f@plursky.com,fx-c@plursky.com,fx-d@plursky.com', `${tag}A. events chronological`);
  check(lib.festivalIcs(CAL, [...SETS].reverse()).text === text, `${tag}A. input order never changes the bytes`);
  check(!/DTSTAMP:(?!20261126T000000Z)/.test(text), `${tag}A. DTSTAMP is the given stamp, never now`);
  return failed - before;
}

// ── A ──
const lib = await import(pathToFileURL(LIB).href);
fixtureChecks(lib);

// ── B ──
// The page prints local clock times; the calendar holds UTC. The zone comes
// from the registry, the source both the page and the calendar are built from.
const { REG } = loadRegistry(ROOT);
const regTz = new Map(REG.map(e => [e.config.id, e.config.tz]));
const tzOf = (t) => (/X-WR-TIMEZONE:(\S+)/.exec(t) || [])[1];
const local = (z, tz) => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(z);
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
};
const nextDay = (ymd) => new Date(Date.parse(ymd + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
let calendars = 0, compared = 0, endsCompared = 0;
for (const id of readdirSync(join(ROOT, 'f')).sort()) {
  const pagePath = join(ROOT, 'f', id, 'index.html');
  if (!existsSync(pagePath)) continue;
  const page = readFileSync(pagePath, 'utf8');
  const icsPath = join(ROOT, 'f', id, 'schedule.ics');
  const has = existsSync(icsPath);
  const linked = page.includes(`href="/f/${id}/schedule.ics"`) && page.includes(`href="webcal://plursky.com/f/${id}/schedule.ics"`);
  check(has === linked, `${id}: calendar ${has ? 'exists' : 'missing'} but the page ${linked ? 'links' : 'does not link'} it`);
  if (!has) continue;
  calendars++;
  const t = readFileSync(icsPath, 'utf8');
  const tz = regTz.get(id);
  check(!!tz, `${id}: the registry gives this festival no tz`);
  check(tzOf(t) === tz, `${id}: calendar says X-WR-TIMEZONE ${tzOf(t)}, registry says ${tz}`);
  if (!tz) continue;
  // "13:15 – 14:00", or "13:15" alone when the set has no end.
  const rows = new Map([...page.matchAll(/<li id="(set-[^"]+)"><time datetime="(\d{4}-\d{2}-\d{2})T([^"]+)">([^<]*)<\/time>/g)]
    .map(m => [m[1], { ymd: m[2], hm: m[3], end: (/–\s*(\d{1,2}:\d{2})\s*$/.exec(m[4]) || [])[1] || null }]));
  const ev = events(t);
  check(ev.length === rows.size, `${id}: ${ev.length} events but ${rows.size} timed set rows on the page`);
  check(new Set(ev.map(e => e.uid)).size === ev.length, `${id}: duplicate UID`);
  for (const e of ev) {
    const anchor = (/#(set-[^#]+)$/.exec(e.url || '') || [])[1];
    const row = rows.get(anchor);
    if (!row) { check(false, `${id}: event ${e.uid} points at #${anchor}, which is not a set row on the page`); continue; }
    const at = local(e.start, tz);
    const h = +row.hm.slice(0, 2);
    const wantYmd = h < lib.LATE_NIGHT_HOUR ? nextDay(row.ymd) : row.ymd;
    compared++;
    if (at.hm !== row.hm.padStart(5, '0') || at.ymd !== wantYmd) check(false, `${id}: ${e.uid} starts ${at.ymd} ${at.hm} ${tz}, page row says ${wantYmd} ${row.hm}`);
    if (!row.end) { if (e.end !== null) check(false, `${id}: ${e.uid} has DTEND ${e.end} but its page row prints no end`); continue; }
    if (!e.end) { check(false, `${id}: ${e.uid} has no DTEND but its page row ends ${row.end}`); continue; }
    // The end is on the start's date, or the next one when it is at or
    // before the start (22:00 – 08:30).
    const endHm = row.end.padStart(5, '0'), wantEndYmd = endHm <= row.hm.padStart(5, '0') ? nextDay(wantYmd) : wantYmd;
    const atEnd = local(e.end, tz);
    endsCompared++;
    if (atEnd.hm !== endHm || atEnd.ymd !== wantEndYmd) check(false, `${id}: ${e.uid} ends ${atEnd.ymd} ${atEnd.hm} ${tz}, page row says ${wantEndYmd} ${endHm}`);
  }
}
check(calendars >= 10, `positive control: at least 10 committed calendars (found ${calendars})`);
check(endsCompared >= 100, `positive control: at least 100 set ends compared (found ${endsCompared})`);

// ── C ──
const dir = mkdtempSync(join(tmpdir(), 'ics-mut-'));
const src = readFileSync(LIB, 'utf8');
const MUTANTS = [
  ['no late-night rule', 'h < LATE_NIGHT_HOUR ? 1 : 0', '0'],
  ['no end rollover', 'if (endMs != null && endMs <= startMs) endMs += 24 * 3600 * 1000;', ''],
  ['no comma escaping', ".replace(/,/g, '\\\\,')", ''],
  ['no folding', 'if (enc.encode(line).length <= 75) return line;', 'return line;'],
];
let caught = 0;
const realLog = console.log;
for (const [name, from, to] of MUTANTS) {
  if (!src.includes(from)) { check(false, `C. mutant "${name}" no longer applies: lib changed, update the test`); continue; }
  const f = join(dir, `mutant-${MUTANTS.findIndex(m => m[0] === name)}.mjs`);
  // The mutant lives in a temp dir, so its one import points at the real lib.
  writeFileSync(f, src.replace(from, to).replace("from './day-after.mjs'", `from '${pathToFileURL(join(ROOT, 'scripts', 'lib', 'day-after.mjs')).href}'`));
  const m = await import(pathToFileURL(f).href);
  const [c0, f0] = [checks, failed];
  console.log = () => {};
  const killed = fixtureChecks(m, `[${name}] `) > 0;
  console.log = realLog;
  checks = c0; failed = f0;
  if (killed) caught++; else check(false, `C. mutant "${name}" survived the fixtures`);
}

if (failed) { console.log(`✗ festival calendars: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ festival calendars: ${checks} checks (${calendars} calendars, ${compared} event starts and ${endsCompared} ends match their page row's date and time; ${caught}/${MUTANTS.length} mutants caught)`);
