// tml-drupal-schedule.mjs — Tomorrowland's official day timetable for 2013 to
// 2016 (tomorrowland.com/en/<weekday>-<d>-<month>, a Drupal 7 page, one page
// per day), read from an archived capture. Format "tml-drupal".
//
// A page prints one day: its title (<h1 class="page-title">Saturday/ 27
// July</h1>, no year) and a horizontal grid:
//   - an hour axis, <div class="hours"> of <div class="pull-left"
//     style="width:450px;">12:00</div> …, one label an hour, each hour the
//     same width (the last label may be cut short);
//   - one row per stage, <div class="stage" data-id="N"><div class="artists">,
//     holding slots in order: <div class="time-slot empty" style="width: Wpx">
//     (a gap) or <div class="time-slot performance" style="width:Wpx;"> with
//     the act (<a title="Maxim Lany">Maxim Lany</a>, or plain text) and its
//     range (<span class="time">12:15-13:15</span>, 24-hour, crossing midnight
//     as "23:30-1:00");
//   - the stage names, <div class="stage-logo" data-id="N"> holding an
//     <img alt="Mainstage"> (its alt escaped twice: "Super You&amp;amp;Me") or
//     plain text, matched to the rows by data-id.
// A row is drawn slot after slot at the axis's own pixels per hour: each set
// as wide as its printed length, each gap as wide as the time between one
// set's printed end and the next one's start. A range that disagrees with its
// slot or its gap, or two sets printed on one stage at once (the page then
// draws the later one where the earlier ends), come back in `misprints`,
// never as sets. Times before 6 AM are the day's night. A stage row with no slot, or a name with no row, is checked, not
// read ("More Artists").

const ENT = { "&amp;": "&", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&nbsp;": " ", "&#8217;": "’", "&#8211;": "–", "&lt;": "<", "&gt;": ">" };
const unent = s => s.replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
// "12:15" → minutes; null unless a 24-hour clock time.
const clock = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const width = tag => { const m = /width:\s*(\d+(?:\.\d+)?)px/.exec(tag); return m ? +m[1] : null; };

// "Saturday/ 27 July" or "Friday 26 July" in `year` → "2013-07-27", or null
// when the weekday is not the date's own.
export function titleDate(label, year) {
  const m = /^([A-Za-z]+)\/? (\d{1,2}) ([A-Za-z]+)$/.exec(String(label || "").trim());
  const mo = m ? MONTHS.indexOf(m[3].toLowerCase()) + 1 : 0;
  if (!mo || !year) return null;
  const date = `${year}-${pad(mo)}-${pad(+m[2])}`, d = new Date(date + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  return WEEKDAYS[d.getUTCDay()] === m[1] ? date : null;
}

export function parseTmlDrupal(html, { year } = {}) {
  const title = /<h1 class="page-title">([\s\S]*?)<\/h1>/.exec(html);
  if (!title) throw new Error("no page title");
  const label = plain(title[1]), date = titleDate(label, year);
  if (!date) throw new Error(`the title "${label}" names no date in ${year}`);
  const from = html.indexOf('<div class="stages"'), to = html.indexOf('<div class="wrap stage-titles">', from);
  if (from < 0 || to < 0) throw new Error(`${date}: no timetable`);
  const grid = html.slice(from, to), names = html.slice(to, html.indexOf('<div class="row">', to) >>> 0 || undefined);

  // The axis: one label an hour, every full hour the same width.
  const hours = [...grid.slice(0, grid.indexOf('<div class="stage"')).matchAll(/<div class="pull-left" style="([^"]*)">([^<]*)<\/div>/g)]
    .map(m => ({ w: width(m[1]), at: clock(m[2]) }));
  if (hours.length < 2 || hours.some(h => h.at === null || !h.w)) throw new Error(`${date}: the hour axis does not read`);
  hours.forEach((h, i) => { if (i && (h.at - hours[i - 1].at + 1440) % 1440 !== 60) throw new Error(`${date}: the axis prints ${hhmm(hours[i - 1].at)} and then ${hhmm(h.at)}`); });
  const pxPerHour = hours[0].w;
  if (hours.slice(0, -1).some(h => h.w !== pxPerHour) || hours.at(-1).w > pxPerHour) throw new Error(`${date}: the axis hours are drawn at different widths`);
  const axisStart = hours[0].at, scale = pxPerHour / 60;
  if (axisStart < 6 * 60) throw new Error(`${date}: the axis starts at ${hhmm(axisStart)}`);
  const axisEnd = axisStart + (hours.length - 1) * 60 + hours.at(-1).w / scale;

  // The names, by data-id: an image's alt (escaped twice) or the logo's text.
  const nameOf = new Map();
  for (const m of names.matchAll(/<div class="stage-logo" data-id="(\d+)">([\s\S]*?)<\/div>/g)) {
    const alt = /<img\b[^>]*\balt="([^"]*)"/.exec(m[2]);
    const name = alt ? plain(unent(alt[1])) : plain(m[2]);
    if (!name || nameOf.has(m[1])) throw new Error(`${date}: stage ${m[1]} is named ${nameOf.has(m[1]) ? "twice" : "nothing"}`);
    nameOf.set(m[1], name);
  }

  const rows = [...grid.matchAll(/<div class="stage" data-id="(\d+)">/g)];
  if (rows.map(r => r[1]).join() !== [...nameOf.keys()].join()) throw new Error(`${date}: rows ${rows.map(r => r[1]).join(",")} and names ${[...nameOf.keys()].join(",")} are not the same stages in the same order`);
  const stages = [], sets = [], misprints = [], blank = [];
  rows.forEach((r, i) => {
    const stage = nameOf.get(r[1]);
    const row = grid.slice(r.index, i + 1 < rows.length ? rows[i + 1].index : undefined);
    const slots = [...row.matchAll(/<div class="time-slot (empty|performance)" style="([^"]*)">/g)];
    if (!slots.length) { blank.push(stage); return; }
    stages.push(stage);
    // Walk the row: every gap the page draws must be the time between one
    // set's printed end and the next one's printed start, and every set as
    // wide as its printed length.
    let gap = 0, prevEnd = axisStart, maxEnd = axisStart, prev = null;
    const row_ = [];
    slots.forEach((s, k) => {
      const w = width(s[2]);
      if (!w) throw new Error(`${date} ${stage}: a slot with no width`);
      if (s[1] === "empty") { gap += w; return; }
      const body = row.slice(s.index + s[0].length, k + 1 < slots.length ? slots[k + 1].index : undefined);
      const time = /<span class="time">([^<]*)<\/span>/.exec(body);
      const artist = plain(body.replace(/<span class="time">[\s\S]*?<\/span>/, ""));
      const where = `${date} ${stage} "${artist}"`;
      if (!artist || !time) throw new Error(`${date} ${stage}: a slot with no ${artist ? "time" : "act"}`);
      const printed = plain(time[1]), rm = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(printed);
      let a = rm && clock(rm[1]), b = rm && clock(rm[2]);
      if (a === null || b === null) throw new Error(`${where}: cannot read the range "${printed}"`);
      if (a < 6 * 60) a += 1440;                // before 6 AM is this day's night
      while (b <= a) b += 1440;
      const set = { stage, start: hhmm(a), end: hhmm(b), artist, printed, at: a, minutes: b - a };
      if (b > axisEnd + 0.01 || a < axisStart) set.misprint = `the range is off the page's axis (${hhmm(axisStart)}-${hhmm(Math.round(axisEnd))})`;
      else if (Math.abs(w / scale - (b - a)) > 0.01) set.misprint = `the slot is drawn ${Math.round(w / scale)} minutes wide`;
      else if (a < maxEnd) {
        // Two sets printed on one stage at once: the page draws the later
        // one where the earlier ends, and neither time can be confirmed.
        if (gap) throw new Error(`${where}: drawn after a gap, yet starts before "${prev.artist}" ends`);
        set.misprint = `printed while "${prev.artist}" (${prev.printed}) is still on`;
        if (!prev.misprint) prev.misprint = `printed while "${artist}" (${printed}) is already on`;
      } else if (Math.abs(gap / scale - (a - prevEnd)) > 0.01) set.misprint = `the slot is drawn after a ${Math.round(gap / scale)}-minute gap, not ${a - prevEnd}`;
      gap = 0; prevEnd = b; maxEnd = Math.max(maxEnd, b); prev = set;
      row_.push(set);
    });
    for (const x of row_) {
      const { at, misprint, ...set } = x;
      if (misprint) misprints.push({ ...set, misprint }); else sets.push(set);
    }
  });
  if (!sets.length) throw new Error(`${date}: no sets`);
  return { date, label, weekday: WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()], axis: `${hhmm(axisStart)}-${hhmm(Math.round(axisEnd))}`, pxPerHour, stages, blank, sets, misprints };
}
