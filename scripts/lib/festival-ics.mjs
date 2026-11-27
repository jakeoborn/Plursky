// Subscribable festival calendars: /f/<id>/schedule.ics.
//
// One VEVENT per timed set, from the same acts the page's schedule grid and
// schedule.json ship, so the three can never disagree. A person subscribes
// once (webcal://) and their calendar app re-reads the file on its own, so a
// set-time change lands without anyone re-exporting anything.
//
// Rules, each one tested in scripts/test-festival-ics.mjs:
//   - Times are wall-clock in the festival's IANA zone, written as UTC (…Z),
//     so no VTIMEZONE block is needed and DST nights resolve once, here.
//   - A set starting before 08:00 belongs to the NIGHT of its festival day,
//     i.e. the next calendar date. Same rule as data.jsx's _wallMs.
//   - An end at or before its start rolls over ONE CIVIL DAY in the festival's
//     zone (22:00 – 08:30 sunrise), never a fixed 24 h: across a DST night a
//     fixed 24 h lands an hour off (lane III, #619: Oct 31 22:00 – 08:30 New
//     York gave 12:30Z, not 13:30Z).
//   - A set with no time (TBA, or "unconfirmed": the sources disagree) is left
//     out, never given a guessed slot. A set with no end has no DTEND: a
//     zero-length event is honest, an invented hour is not.
//   - Bytes are deterministic: DTSTAMP is the page's own lastmod, never "now",
//     so `gen-festival-pages.mjs --check` can hold the file to its source.
//   - Lines end CRLF and fold at 75 octets (RFC 5545 §3.1).
import { zonedToUtc } from './day-after.mjs';

export const LATE_NIGHT_HOUR = 8;

export const icsEscape = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Fold one content line at 75 octets without splitting a UTF-8 sequence.
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '', curLen = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (curLen + n > limit) { out.push(cur); cur = ''; curLen = 0; limit = 74; } // continuation lines lose 1 to the leading space
    cur += ch; curLen += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n) => String(n).padStart(2, '0');
export const icsUtc = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

// Festival-day date (YYYY-MM-DD) + "HH:MM" in tz → UTC ms, or null.
// addDays moves the wall-clock date, so the result stays HH:MM local.
export function setMs(ymd, hhmm, tz, addDays = 0) {
  const t = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!t || !d || !tz) return null;
  const h = +t[1], m = +t[2];
  return zonedToUtc(tz, +d[1], +d[2] - 1, +d[3] + addDays + (h < LATE_NIGHT_HOUR ? 1 : 0), h, m);
}

// sets: [{ uid, ymd, start, end, name, stage, url }] — already filtered to the
// block/day they play. cal: { id, name, tz, location, url, stamp (YYYY-MM-DD) }.
export function festivalIcs(cal, sets) {
  const stamp = `${cal.stamp.replace(/-/g, '')}T000000Z`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plursky//Festival set times//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`${cal.name} set times · Plursky`)}`,
    `X-WR-TIMEZONE:${cal.tz}`,
    `X-WR-CALDESC:${icsEscape(`Every timed set at ${cal.name}. Updates itself when the schedule changes. ${cal.url}`)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  const events = [];
  for (const s of sets) {
    const startMs = setMs(s.ymd, s.start, cal.tz);
    if (startMs == null) continue;
    let endMs = s.end ? setMs(s.ymd, s.end, cal.tz) : null;
    if (endMs != null && endMs <= startMs) endMs = setMs(s.ymd, s.end, cal.tz, 1);
    events.push({ s, startMs, endMs });
  }
  // Chronological, then by uid: array order never decides.
  events.sort((a, b) => a.startMs - b.startMs || (a.s.uid < b.s.uid ? -1 : a.s.uid > b.s.uid ? 1 : 0));
  for (const { s, startMs, endMs } of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsUtc(startMs)}`,
      ...(endMs != null ? [`DTEND:${icsUtc(endMs)}`] : []),
      `SUMMARY:${icsEscape(s.stage ? `${s.name} · ${s.stage}` : s.name)}`,
      `LOCATION:${icsEscape([s.stage, cal.location].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${icsEscape(`${cal.name}${s.stage ? ' · ' + s.stage : ''}\n${s.url}`)}`,
      `URL:${s.url}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(foldLine).join('\r\n') + '\r\n', events: events.length };
}
