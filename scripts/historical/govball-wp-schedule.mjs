// govball-wp-schedule.mjs — Governors Ball's own schedule page for 2011 and
// 2012 (governorsballmusicfestival.com/lineup/schedule/, a WordPress page
// template), read from an archived capture. Format "govball-wp".
//
// The page draws one grid per day, each made of:
//   - a header: the day's heading (2012: <div class="stage-heading">SATURDAY
//     6/23</div>; 2011, a one-day festival, prints none) and one <h2> per
//     stage, in column order ("Big Apple Stage", "HYPE MACHINE<br>STAGE");
//   - an hour axis (<div … time-column> of "12:00 PM", "1:00 PM" …, one hour
//     apart);
//   - one column per stage (2011 <div id="main-stage-column">, 2012 <div
//     class="hypem-column">), each holding that stage's blocks in running
//     order (<div class="main-stage-block reptar">, <div class="hypem-block
//     avs">): a name in <h2> and a range in <h3>, "12:50 pm - 1:25 pm",
//     sometimes after a label (<h3 class="headline">Headline Set By</h3>).
// Every time prints its own am or pm, so nothing about the meridiem is read
// or guessed. A range whose end is "???" (2011's Pretty Lights, the night's
// last set) is an open end, allowed only on a column's last block. A range
// that cannot be a set on the day (it runs backwards, runs over six hours, or
// starts off the page's own axis by more than an hour) is a misprint: it
// comes back in `misprints`, never as a set, and is never read another way
// (2012's "Turf War 11:45 pm - 12:10 pm"). A column's sets must run in order
// with no overlap.
//
// The day: a heading prints the weekday and month/day; a page with no
// heading must say in its own description that the festival is one day and
// print that day ("A one-day, two-stage festival … on Saturday, June 18th,
// 2011"). The description must name the year either way.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ENT = { "&amp;": "&", "&nbsp;": " ", "&#039;": "'", "&quot;": '"', "&rsquo;": "’", "&lsquo;": "‘", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…" };
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();
const weekdayOf = iso => WEEKDAYS[new Date(iso + "T12:00:00Z").getUTCDay()];
// "12:50 pm" → minutes since midnight; null if not a clock time with am/pm.
const clock = t => {
  const m = /^(\d{1,2}):(\d{2}) ?([ap]m)$/i.exec(String(t).trim());
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) return null;
  return (+m[1] % 12 + (m[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + +m[2];
};

// The date a day's printed label names in `year`, or null. "SATURDAY 6/23"
// (a heading) or "Saturday, June 18th, 2011" (a one-day page's description).
export function printedDate(label, year) {
  let m = /^([A-Za-z]+) (\d{1,2})\/(\d{1,2})$/.exec(label || ""), iso, wd;
  if (m) { iso = `${year}-${pad(+m[2])}-${pad(+m[3])}`; wd = m[1]; }
  else if ((m = /^([A-Za-z]+), ([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)?, (\d{4})$/.exec(label || ""))) {
    const mo = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    if (!mo || +m[4] !== year) return null;
    iso = `${year}-${pad(mo)}-${pad(+m[3])}`; wd = m[1];
  } else return null;
  if (Number.isNaN(new Date(iso + "T12:00:00Z").getTime()) || new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) !== iso) return null;
  return weekdayOf(iso) === wd.toLowerCase() ? iso : null;
}

export function parseGovBallWp(html, { year } = {}) {
  if (!year) throw new Error("no year");
  const desc = plain(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "");
  if (!new RegExp(`\\b${year}\\b`).test(desc)) throw new Error(`the page's description does not name ${year}: "${desc}"`);
  const from = html.indexOf('<div id="schedule">');
  if (from < 0) throw new Error("no schedule");
  const to = html.indexOf("<!-- END main-content -->", from);
  const grid = html.slice(from, to < 0 ? undefined : to);
  const heads = [...grid.matchAll(/<div (?:id="schedule-header"|class="schedule-header[^"]*")>/g)];
  if (!heads.length) throw new Error("no day header");

  const days = heads.map((h, i) => {
    const body = grid.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : undefined);
    const axisAt = body.search(/<div (?:id|class)="time-column">/);
    if (axisAt < 0) throw new Error(`day ${i + 1}: no hour axis`);
    const head = body.slice(0, axisAt);
    // The day: its heading, or the one day a heading-less page describes.
    const heading = /<div class="stage-heading">([\s\S]*?)<\/div>/.exec(head);
    let label, date, dateFrom;
    if (heading) {
      label = plain(heading[1]); date = printedDate(label, year); dateFrom = "the day's heading";
      if (!date) throw new Error(`day ${i + 1}: the heading "${label}" names no date in ${year}`);
    } else {
      const one = /\bone-day\b.*?\bon ([A-Za-z]+, [A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?, \d{4})/.exec(desc);
      if (heads.length !== 1 || !one) throw new Error(`day ${i + 1}: prints no heading, and the page does not describe a one-day festival`);
      label = one[1]; date = printedDate(label, year); dateFrom = "the page's description";
      if (!date) throw new Error(`the description's "${label}" names no date in ${year}`);
    }
    const stages = [...head.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map(x => plain(x[1]));
    if (!stages.length || stages.some(s => !s) || new Set(stages).size !== stages.length) throw new Error(`${date}: stage headers ${stages.join(", ")}`);

    // The hour axis: one label an hour, in order.
    const rest = body.slice(axisAt);
    const cols = [...rest.matchAll(/<div (?:id|class)="([\w-]+)-column">/g)];
    const hours = [...rest.slice(0, cols[1]?.index ?? undefined).matchAll(/<h3>([^<]*)<\/h3>/g)].map(x => clock(x[1]));
    if (cols[0]?.[1] !== "time" || hours.length < 2 || hours.some(v => v === null) || hours.some((v, k) => k && v !== hours[k - 1] + 60))
      throw new Error(`${date}: the hour axis does not read hour by hour`);
    const axisFirst = hours[0], axisLast = hours.at(-1);

    const columns = cols.slice(1);
    if (columns.length !== stages.length) throw new Error(`${date}: ${columns.length} columns for ${stages.length} stage headers`);
    const sets = [], misprints = [];
    columns.forEach((c, k) => {
      const stage = stages[k], prefix = c[1];
      const seg = rest.slice(c.index, k + 1 < columns.length ? columns[k + 1].index : undefined);
      const blocks = [...seg.matchAll(/<div class="([\w-]+)-block\b[^"]*">([\s\S]*?)<\/div>/g)];
      if (!blocks.length) throw new Error(`${date} ${stage}: no blocks`);
      let prev = null;
      blocks.forEach((b, n) => {
        if (b[1] !== prefix) throw new Error(`${date} ${stage}: a ${b[1]} block in the ${prefix} column`);
        const names = [...b[2].matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map(x => plain(x[1]));
        const ranges = [...b[2].matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(x => plain(x[1]));
        const labels = [...b[2].matchAll(/<h3 class="headline">([\s\S]*?)<\/h3>/g)].map(x => plain(x[1]));
        if (names.length !== 1 || !names[0] || ranges.length !== 1) throw new Error(`${date} ${stage}: a block with ${names.length} name(s) and ${ranges.length} range(s)`);
        const artist = names[0], printed = ranges[0], where = `${date} ${stage} "${artist}"`;
        const rm = /^(\d{1,2}:\d{2} ?[ap]m) ?- ?(\d{1,2}:\d{2} ?[ap]m|\?\?\?)$/i.exec(printed);
        const s = rm && clock(rm[1]), open = rm?.[2] === "???", e = rm && !open ? clock(rm[2]) : null;
        if (s === null || (!open && e === null)) throw new Error(`${where}: cannot read the range "${printed}"`);
        if (open && n !== blocks.length - 1) throw new Error(`${where}: an open end ("${printed}") on a block that is not its column's last`);
        const len = open ? null : e - s;
        if ((len !== null && (len <= 0 || len > 360)) || s < axisFirst - 60 || s > axisLast + 60) {
          misprints.push({ stage, artist, printed, misprint: len !== null && (len <= 0 || len > 360) ? "the range does not run forward within the day" : `the start is off the page's axis (${hhmm(axisFirst)}-${hhmm(axisLast)})` });
          return;
        }
        if (prev && s < prev.at + prev.len) throw new Error(`${where}: starts at ${hhmm(s)}, before "${prev.artist}" ends at ${hhmm(prev.at + prev.len)}`);
        prev = { artist, at: s, len: len ?? 0 };
        sets.push({ stage, start: hhmm(s), end: open ? "" : hhmm(e), artist, printed, ...(open && { openEnd: true }), ...(labels.length && { label: labels.join(" ") }) });
      });
    });
    return { date, label, dateFrom, weekday: weekdayOf(date), stages, axis: `${hhmm(axisFirst)}-${hhmm(axisLast)}`, sets, misprints };
  });
  if (new Set(days.map(d => d.date)).size !== days.length) throw new Error("the page prints a day twice");
  for (let i = 1; i < days.length; i++)
    if (new Date(days[i].date + "T12:00:00Z") - new Date(days[i - 1].date + "T12:00:00Z") !== 864e5) throw new Error(`the page prints ${days[i - 1].date} and then ${days[i].date}`);
  return { days, description: desc };
}
