// defqon-schedule.mjs — Defqon.1's own festival timetable for 2015
// (defqon1.nl/en/timetable/, a WordPress page), read from an archived
// capture. Format "defqon-areas".
//
// The page prints the whole weekend at once:
//
//   A filter bar: one checkbox per day and per area (<input type="checkbox"
//     value=".blue" id="blue">, the id naming the area: "red", "uv",
//     "afterparty" for ".after", "closing").
//   One <section class="d"> per part of the weekend, headed with its
//     weekday, date and hours ("Friday • 19 June 2015 • 20:00 - 01:00"), or
//     with no date for the night after a day ("Afterparty • 23:00 – 04:00").
//   Under each section, one <article class="area <area> … <weekday> …">
//     per area: its genre heading (<h2>Hardstyle</h2>) and a list, one <li>
//     per set (<span class="start">20:00</span> - <span
//     class="end">21:00</span> and <h3 class="name">Max Enforcer</h3>, the
//     24-hour clock), plus its host (<h3 class="name">Hosted by
//     Villain</h3>, no time), which is the area's MC, never a set. An area
//     that holds no music (a chill-out, a café) prints a paragraph and no
//     set. The closing prints one range for the whole area in its heading
//     ("Sunday from 20.00 till 23.00 at the Red") over acts with no time of
//     their own: a block, returned in `bills`, never as sets.
//
// The stage is the area as the filter names it (".blue" → "Blue", ".uv" →
// "UV", ".after" → "Afterparty"), because the genre heading is not unique
// (Friday's Blue and Saturday's UV both print "Hardstyle"). Every set's day
// is its article's own weekday class: a dated section's articles must carry
// that section's weekday, and an undated section (the afterparty) is the
// night of the dated day its articles name. Times before 6 AM are that
// night's.
//
// Throws on anything it cannot confirm: a title that is not the edition's
// timetable, an area the filter bar does not offer, an article whose weekday
// is not its section's or names no dated day, an <li> that is neither a set,
// a host nor an area's description, a range that is not HH:MM - HH:MM, or a
// stage's sets printed out of order or overlapping.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
  "&#8211;": "–", "&#8216;": "‘", "&#8217;": "’", "&#8220;": "“", "&#8221;": "”" };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// A section heading ("Friday • 19 June 2015 • 20:00 - 01:00") as its date,
// or null: the weekday must fall on that date, and the printed year must be
// `year`.
export function headerDate(printed, year) {
  const m = /^([A-Z][a-z]+) • (\d{1,2}) ([A-Z][a-z]+) (\d{4}) • \d{2}:\d{2} [-–] \d{2}:\d{2}$/.exec(String(printed || "").trim());
  if (!m || +m[4] !== +year || !MONTHS.includes(m[3])) return null;
  const date = `${m[4]}-${pad(MONTHS.indexOf(m[3]) + 1)}-${pad(+m[2])}`;
  const d = new Date(date + "T12:00:00Z");
  return d.toISOString().slice(0, 10) === date && WEEKDAYS[d.getUTCDay()] === m[1] ? date : null;
}

// The area's name as the filter bar's id prints it.
const stageName = id => id === "uv" ? "UV" : id[0].toUpperCase() + id.slice(1);

export function parseDefqonAreas(html, { year, rolloverHour = 6 } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  if (title !== `Timetable - Defqon.1 ${year}`) throw new Error(`defqon-areas: the page is titled "${title}", not the Defqon.1 ${year} timetable`);
  // The filter bar: area keys (".blue") to their ids ("blue").
  const filters = new Map([...text.matchAll(/<input type="checkbox" value="\.([a-z-]+)" id="([a-z-]+)">/g)].map(m => [m[1], m[2]]));
  const weekdays = ["friday", "saturday", "sunday"].filter(w => filters.get(w) === w);
  if (!weekdays.length) throw new Error("defqon-areas: the filter bar offers no day");
  const sections = text.split('<section class="d">').slice(1);
  if (!sections.length) throw new Error("defqon-areas: no timetable section");
  const days = [], night = [], areas = [], noSets = [], hosts = [], bills = [];
  for (const sec of sections) {
    const head = plain(/<header class="[^"]*\bday\b[^"]*"><div class="inn"><h2>([\s\S]*?)<\/h2>/.exec(sec)?.[1] || "");
    if (!head) throw new Error("defqon-areas: a section with no heading");
    const date = headerDate(head, year);
    let weekday = null;
    if (date) {
      weekday = WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()].toLowerCase();
      if (days.some(d => d.date === date)) throw new Error(`defqon-areas: ${date} is headed twice`);
      days.push({ date, label: head, weekday, sets: [] });
    } else if (!/^[A-Z][A-Za-z ]+ • \d{2}:\d{2} [-–] \d{2}:\d{2}$/.test(head)) throw new Error(`defqon-areas: the heading "${head}" is neither a dated day nor an undated night`);
    const arts = [...sec.matchAll(/<article class="area ([^"]+)">([\s\S]*?)<\/article>/g)];
    if (!arts.length) throw new Error(`defqon-areas: "${head}" prints no area`);
    for (const [, cls, body] of arts) {
      const classes = cls.split(/\s+/), key = classes[0];
      const own = classes.filter(c => weekdays.includes(c));
      if (own.length !== 1) throw new Error(`defqon-areas: the area "${cls}" under "${head}" names ${own.length} days`);
      if (weekday && own[0] !== weekday) throw new Error(`defqon-areas: the area "${cls}" is under "${head}" but names ${own[0]}`);
      const heading = plain(/<h2>([\s\S]*?)<\/h2>/.exec(body)?.[1] || "");
      if (!heading) throw new Error(`defqon-areas: the area "${cls}" under "${head}" has no heading`);
      const items = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);
      const timed = items.filter(li => /class="start"/.test(li));
      const id = filters.get(key);
      if (!timed.length) {
        // An area with no music: its description, nothing else.
        if (items.length === 1 && /^\s*<p>[\s\S]*<\/p>\s*$/.test(items[0])) { noSets.push({ weekday: own[0], heading }); continue; }
        // A block (the closing): one range for the whole area, in its
        // heading, over acts that print no time of their own.
        const b = /^([A-Z][a-z]+) from (\d{2})\.(\d{2}) till (\d{2})\.(\d{2}) at the ([A-Z][a-z]+)$/.exec(heading);
        const names = items.map(li => plain(/^\s*<h3 class="name">([\s\S]*?)<\/h3>\s*$/.exec(li)?.[1] || ""));
        if (!b || !id || b[1].toLowerCase() !== own[0] || names.some(n => !n)) throw new Error(`defqon-areas: the area "${heading}" under "${head}" prints no set and is neither a description nor a block`);
        const acts = names.filter(n => !/^Hosted by \S/.test(n));
        if (!acts.length) throw new Error(`defqon-areas: the block "${heading}" names no act`);
        bills.push({ weekday: own[0], stage: stageName(id), heading, start: `${b[2]}:${b[3]}`, end: `${b[4]}:${b[5]}`, at: b[6], acts,
          hosts: names.filter(n => /^Hosted by \S/.test(n)) });
        continue;
      }
      if (!id) throw new Error(`defqon-areas: the area "${key}" (${heading}) is not one the filter bar offers`);
      const stage = stageName(id);
      areas.push({ weekday: own[0], section: head, stage, heading });
      const sets = [];
      for (const li of items) {
        const name = plain(/<h3 class="name">([\s\S]*?)<\/h3>/.exec(li)?.[1] || "");
        if (!/class="start"/.test(li)) {
          if (/^Hosted by \S/.test(name) && !/<time/.test(li)) { hosts.push({ weekday: own[0], stage, host: name }); continue; }
          throw new Error(`defqon-areas: "${plain(li)}" on ${stage} is neither a set nor its host`);
        }
        const r = /<span class="start">([^<]*)<\/span>\s*-\s*<span class="end">([^<]*)<\/span>/.exec(li);
        if (!r || !HHMM.test(r[1]) || !HHMM.test(r[2])) throw new Error(`defqon-areas: "${plain(li)}" on ${stage} is not printed HH:MM - HH:MM`);
        if (!name) throw new Error(`defqon-areas: a set on ${stage} at ${r[1]} names no act`);
        sets.push({ stage, start: r[1], end: r[2], artist: name });
      }
      // In order and never overlapping, on the night's clock.
      const mins = t => { const [h, m] = t.split(":").map(Number); return (h < rolloverHour ? h + 24 : h) * 60 + m; };
      for (const [i, x] of sets.entries()) {
        if (mins(x.end) <= mins(x.start)) throw new Error(`defqon-areas: ${x.artist} on ${stage} ends ${x.end}, not after its start ${x.start}`);
        if (i && mins(x.start) < mins(sets[i - 1].end)) throw new Error(`defqon-areas: ${x.artist} on ${stage} starts ${x.start}, before ${sets[i - 1].artist} ends ${sets[i - 1].end}`);
      }
      (weekday ? days.at(-1).sets : night).push(...sets.map(x => ({ ...x, weekday: own[0] })));
    }
  }
  // An undated night belongs to the dated day its areas name.
  for (const x of night) {
    const d = days.find(y => y.weekday === x.weekday);
    if (!d) throw new Error(`defqon-areas: ${x.artist} is on the night of ${x.weekday}, a day the page does not date`);
    d.sets.push(x);
  }
  const stages = [...new Set(areas.map(a => a.stage))];
  const dateOf = w => days.find(d => d.weekday === w)?.date;
  for (const b of bills) if (!dateOf(b.weekday)) throw new Error(`defqon-areas: the block "${b.heading}" is on ${b.weekday}, a day the page does not date`);
  return { title, filters: [...filters.values()], areas, noSets, hosts,
    bills: bills.map(({ weekday, ...b }) => ({ date: dateOf(weekday), ...b })),
    days: days.map(d => ({ date: d.date, label: d.label, sets: d.sets.map(({ weekday, ...x }) => x) })), stages };
}
