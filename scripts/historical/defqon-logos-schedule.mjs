// defqon-logos-schedule.mjs — Defqon.1's own festival timetable for 2014
// (defqon1.nl/nl/timetable/, a WordPress page), read from an archived
// capture. Format "defqon-logos".
//
// The page prints the whole weekend at once, one box per area and day:
//
//   <div class="area <key> masonry"> with the area's logo as its heading
//     (<h3 class="area-logo"><img … title="Red" alt="Red"></h3>, the logo's
//     title naming the area), the day as its subtitle (<h4>SATURDAY • 28
//     JUNE</h4>, no year) and a list, one <li> per set: the act, the
//     performers' countries in house style ("Coone (BEL)", "Audiofreq &
//     Geck-o (AUS & NLD)") and the range on the 24-hour clock ("20:00
//     21:00"), plus the area's host ("Hosted by Ruffian (NLD)", no time),
//     who is its MC, never a set.
//
// What the page prints that is not a set, each returned on its own:
//
//   - a host ("Hosted by …", "Hosted By …");
//   - a segment of the show with a range but no act ("Endshow", "Power
//     Hour");
//   - a block: one range over several acts with no time of their own
//     (Saturday's Black, "Neophyte Records Bigger than ever Hostile take
//     over: 16:00 20:00 Neophyte, Panic, …"), returned in `bills`;
//   - an area this language's page never translated ("Onze
//     verontschuldigingen, dit bericht is alleen beschikbaar in English."),
//     which prints no list: returned in `untranslated`, its sets unknown.
//
// An act whose name runs over two <li>s ("B-Front & Frequencerz" then
// "presents B-freqz [LIVE] (NLD) 22:00 22:30") is one act: a line with no
// time that is not a host joins the line after it, and is recorded in
// `joined`. The countries are lifted off the act's name ("Coone (BEL)" is
// billed "Coone") and kept in `origins`; one printed without its opening
// bracket ("Toyax NLD)") is lifted the same way and recorded in
// `misprints`. A set whose printed end runs past the start of the next set
// on its area (Sunday's Black: "Buzz Fuzz & Dione 18:15 19:15", then "MD&A
// 19:00 20:00") keeps its start and loses its end (an open end), recorded in
// `endsDropped`: the page cannot say which of the two times is wrong.
//
// The area is its logo's title. Each subtitle's weekday must fall on its date
// in the edition's year; the page's title must name the year's festival.
// Times before the rollover hour are that night's.
//
// Throws on anything it cannot confirm: a title that is not the edition's
// timetable, an area with no logo title or no dated subtitle, one area twice
// on one day, an <li> that is none of the above, a range that is not two
// HH:MM times, a line with no time left at the end of a list, or a set that
// starts before the set above it on its area starts.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
  "&#8211;": "–", "&#8216;": "‘", "&#8217;": "’", "&#8220;": "“", "&#8221;": "”", "&#8226;": "•" };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const pad = n => String(n).padStart(2, "0");
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// An area's subtitle ("SATURDAY • 28 JUNE") as its date in `year`, or null:
// the weekday must fall on that date.
export function subtitleDate(printed, year) {
  const m = /^([A-Z]+) • (\d{1,2}) ([A-Z]+)$/.exec(String(printed || "").trim());
  if (!m || !MONTHS.includes(m[3]) || !WEEKDAYS.includes(m[1])) return null;
  const date = `${year}-${pad(MONTHS.indexOf(m[3]) + 1)}-${pad(+m[2])}`;
  const d = new Date(date + "T12:00:00Z");
  return d.toISOString().slice(0, 10) === date && WEEKDAYS[d.getUTCDay()] === m[1] ? date : null;
}

// Three-letter country codes in house style, one or several: "(NLD)",
// "(AUS & NLD)", "(DEN & NLD/BEL)".
const CODES = "[A-Z]{3}(?:\\s*(?:&|/)\\s*[A-Z]{3})*";
const ORIGIN = new RegExp(`^(.*?)\\s*\\((${CODES})\\)$`);
const ORIGIN_UNOPENED = new RegExp(`^(.*?)\\s+(${CODES})\\)$`);
export const SEGMENTS = /^(?:End ?show|Power Hour)$/i;
const HOST = /^Hosted by \S/i;
const UNTRANSLATED = /alleen beschikbaar in/i;

// "Coone (BEL)" → { name: "Coone", origin: "BEL" }.
function lift(text) {
  let m = ORIGIN.exec(text);
  if (m) return { name: m[1].trim(), origin: m[2] };
  m = ORIGIN_UNOPENED.exec(text);
  if (m) return { name: m[1].trim(), origin: m[2], misprint: `"${m[2]})" printed without its opening bracket` };
  return { name: text, origin: null };
}

export function parseDefqonLogos(html, { year, rolloverHour = 6 } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  if (title !== `Timetable | Defqon.1 Festival ${year}`) throw new Error(`defqon-logos: the page is titled "${title}", not the Defqon.1 ${year} timetable`);
  const boxes = text.split(/<div class="area ([a-z]+(?:-\d+)?) masonry">/);
  if (boxes.length < 3) throw new Error("defqon-logos: no area");
  const days = [], areas = [], hosts = [], bills = [], segments = [], untranslated = [], origins = [], joined = [], misprints = [], endsDropped = [];
  const mins = t => { const [h, m] = t.split(":").map(Number); return (h < rolloverHour ? h + 24 : h) * 60 + m; };
  for (let i = 1; i < boxes.length; i += 2) {
    const key = boxes[i], body = boxes[i + 1].split(/<div class="area-footer">/)[0];
    const logo = /<h3 class="area-logo"><img [^>]*\btitle="([^"]+)"[^>]*><\/h3>/.exec(body);
    if (!logo) throw new Error(`defqon-logos: the area "${key}" has no logo title`);
    const stage = plain(logo[1]);
    const sub = plain(/<div class="subtitle">\s*<h4>([\s\S]*?)<\/h4>/.exec(body)?.[1] || "");
    const date = subtitleDate(sub, year);
    if (!date) throw new Error(`defqon-logos: ${stage}'s subtitle "${sub}" is not a date in ${year}`);
    let day = days.find(d => d.date === date);
    if (!day) days.push(day = { date, label: sub, sets: [] });
    if (day.label !== sub) throw new Error(`defqon-logos: ${date} is headed "${day.label}" and "${sub}"`);
    if (areas.some(a => a.date === date && a.stage === stage)) throw new Error(`defqon-logos: ${stage} is printed twice on ${sub}`);
    const list = /<div class="artists">\s*<ul>([\s\S]*?)<\/ul>/.exec(body);
    if (!list) {
      const words = plain(/<div class="artists">([\s\S]*)$/.exec(body)?.[1] || "");
      if (!UNTRANSLATED.test(words)) throw new Error(`defqon-logos: ${stage} on ${sub} prints no list ("${words.slice(0, 60)}")`);
      untranslated.push({ date, stage, printed: words });
      areas.push({ date, stage, key, untranslated: true });
      continue;
    }
    areas.push({ date, stage, key });
    const items = [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => plain(m[1]));
    if (list[1].replace(/<li>[\s\S]*?<\/li>/g, "").trim()) throw new Error(`defqon-logos: ${stage} on ${sub} lists something outside its <li>s`);
    const sets = [];
    let carry = null;
    for (const li of items) {
      if (!li) throw new Error(`defqon-logos: an empty line on ${stage} on ${sub}`);
      if (HOST.test(li) && !carry) {
        if (/\d{2}:\d{2}/.test(li)) throw new Error(`defqon-logos: the host line "${li}" on ${stage} prints a time`);
        hosts.push({ date, stage, host: lift(li.replace(/^Hosted by /i, "")).name, printed: li });
        continue;
      }
      // A block: a heading ending in a colon, one range, then the acts.
      const b = /^(.+?):\s*(\d{2}:\d{2}) (\d{2}:\d{2}) (.+)$/.exec(li);
      if (b && !carry) {
        if (!HHMM.test(b[2]) || !HHMM.test(b[3])) throw new Error(`defqon-logos: the block "${li}" on ${stage} is not printed HH:MM HH:MM`);
        const acts = b[4].split(/\s*,\s*|\s+&\s+(?=[^,&]+$)/).map(a => a.trim());
        if (acts.length < 2 || acts.some(a => !a || /\d{2}:\d{2}/.test(a))) throw new Error(`defqon-logos: the block "${li}" on ${stage} does not list its acts`);
        bills.push({ date, stage, heading: b[1].trim(), start: b[2], end: b[3], acts });
        sets.push({ block: true, start: b[2], end: b[3], artist: b[1].trim() });
        continue;
      }
      const r = /^(.*?)\s*(\d{1,2}:\d{2}) (\d{1,2}:\d{2})$/.exec(li);
      if (!r) {
        // No time: the first line of an act whose name runs on.
        if (carry) throw new Error(`defqon-logos: "${carry}" and "${li}" on ${stage} both print no time`);
        carry = li;
        continue;
      }
      if (!HHMM.test(r[2]) || !HHMM.test(r[3])) throw new Error(`defqon-logos: "${li}" on ${stage} is not printed HH:MM HH:MM`);
      const whole = carry ? `${carry} ${r[1]}` : r[1];
      if (carry) joined.push({ date, stage, lines: [carry, li], as: whole });
      carry = null;
      if (!whole) throw new Error(`defqon-logos: a set on ${stage} at ${r[2]} names no act`);
      const l = lift(whole);
      if (SEGMENTS.test(l.name)) { segments.push({ date, stage, start: r[2], end: r[3], printed: whole }); sets.push({ segment: true, start: r[2], end: r[3], artist: l.name }); continue; }
      if (l.origin) origins.push({ date, stage, artist: l.name, origin: l.origin });
      if (l.misprint) misprints.push({ date, stage, artist: l.name, printed: whole, misprint: l.misprint });
      sets.push({ stage, start: r[2], end: r[3], artist: l.name });
    }
    if (carry) throw new Error(`defqon-logos: "${carry}" on ${stage} prints no time and no line follows it`);
    // In order on the night's clock; a printed end past the next start is
    // dropped.
    for (const [j, x] of sets.entries()) {
      if (mins(x.end) <= mins(x.start)) throw new Error(`defqon-logos: ${x.artist} on ${stage} ends ${x.end}, not after its start ${x.start}`);
      if (!j) continue;
      const y = sets[j - 1];
      if (mins(x.start) <= mins(y.start)) throw new Error(`defqon-logos: ${x.artist} on ${stage} starts ${x.start}, not after ${y.artist} at ${y.start}`);
      if (mins(x.start) < mins(y.end)) {
        if (y.block || y.segment) throw new Error(`defqon-logos: ${x.artist} on ${stage} starts ${x.start}, inside "${y.artist}" (${y.start} ${y.end})`);
        endsDropped.push({ date, stage, artist: y.artist, printed: `${y.start} ${y.end}`, next: x.artist, nextStart: x.start });
        y.end = ""; y.openEnd = true;
      }
    }
    day.sets.push(...sets.filter(x => !x.block && !x.segment).map(x => ({ stage, start: x.start, end: x.end, artist: x.artist, ...(x.openEnd && { openEnd: true }) })));
  }
  return { title, days, areas, hosts, bills, segments, untranslated, origins, joined, misprints, endsDropped,
    stages: [...new Set(areas.filter(a => !a.untranslated).map(a => a.stage))] };
}
