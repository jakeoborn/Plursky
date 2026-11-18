// tml-cms-schedule.mjs — Tomorrowland's own line-up day pages for 2010 to
// 2012 (tomorrowland.be/cms/en/line-up/<weekday> in 2010 and 2011,
// tomorrowland.be/line-up/<weekday> in 2012), read from an archived capture.
// Format "tml-cms".
//
// One page per festival day, a Drupal view. Its day tabs print each day as
// "Saturday 24 july" (no year), the page's own day being the tab marked
// class="currentactive". Under the tabs, each stage is an <h5> heading (its
// name as text, after an icon; 2011's capture also draws it with Cufón, whose
// text is the same name) followed by its sets, newest first:
//   - 2010, 2011: <div class="left artist"><a …>Dirty South</a></div>
//     <div class="left play"><span class="date-display-single">23:30</span>
//     &nbsp;&gt;&nbsp;<span class="date-display-single">01:00</span></div>;
//   - 2012: <div class="left artist"><a …>Skrillex</a></div><div class="left
//     lineup_right_wrapper"><div class="play lineup_right_time">21:30&nbsp;
//     &gt;&nbsp;23:00</div>.
// Every act heading must carry exactly one range. Times are 24-hour and the
// music runs from about noon to 1 AM, so a time before 6 AM is the day's night.
//
// The title prints no year: a tab's date must be its weekday's own in the
// edition's year (as the 2013-2016 day pages, tml-drupal), and the tabs must be
// consecutive days. A block printed across two or more whole sets on its
// stage (an all-day MC such as "MC Stretch", 12:00 > 01:00 over every Mainstage
// set, or a live percussionist over the DJs) is not a set of its own
// (`overlays`). A block named as its own stage ("Samsung Galaxy Island
// Friday", the "Radio Ultra Modern" broadcast) names no act (`stageBlocks`); a
// stage left with nothing else is `blank`. A range that runs backwards or over
// eight hours, or two sets printed on one stage at once (each of them), come
// back in `misprints`, never as sets. The same act printed twice with the same
// range on one stage is one set (`repeats`).

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ENT = { "&amp;": "&", "&nbsp;": " ", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&rsquo;": "’", "&lsquo;": "‘", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…", "&lt;": "<", "&gt;": ">" };
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<canvas[\s\S]*?<\/canvas>/gi, "").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();
const NIGHT = 6 * 60;

// The date a tab names in `year`, or null: "Saturday 24 july", the weekday the
// date's own.
export function printedDate(label, year) {
  const m = /^([A-Za-z]+) (\d{1,2}) ([A-Za-z]+)$/.exec(String(label || "").trim());
  const mo = m ? MONTHS.indexOf(m[3].toLowerCase()) + 1 : 0;
  if (!mo || !year) return null;
  const iso = `${year}-${pad(mo)}-${pad(+m[2])}`, d = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return WEEKDAYS[d.getUTCDay()] === m[1].toLowerCase() ? iso : null;
}

// "23:30 > 01:00" → [start, end] in minutes since the day's midnight, a time
// before 6 AM being the night; null unless two 24-hour times.
const range = s => {
  const m = /^(\d{2}):(\d{2}) > (\d{2}):(\d{2})$/.exec(s);
  if (!m || +m[1] > 23 || +m[3] > 23 || +m[2] > 59 || +m[4] > 59) return null;
  const at = (h, mi) => { const v = h * 60 + mi; return v < NIGHT ? v + 1440 : v; };
  return [at(+m[1], +m[2]), at(+m[3], +m[4])];
};

export function parseTmlCms(html, { year } = {}) {
  if (!/<title>\s*Tomorrowland\s*<\/title>/i.test(html)) throw new Error("tml-cms: not a Tomorrowland page (title)");
  if (!/class="[^"]*\bpage-line-up\b/.test(html)) throw new Error("tml-cms: not a line-up page (body class)");
  // Day tabs: <a href=… [class="currentactive"] title="Saturday 24 july">.
  const tabs = [...html.matchAll(/<(?:div|li) class="left tab292">\s*<a\b([^>]*)>/g)].map(m => {
    const title = /\btitle="([^"]*)"/.exec(m[1])?.[1], current = /\bclass="currentactive"/.test(m[1]);
    const date = printedDate(title, year);
    if (!date) throw new Error(`tml-cms: day tab "${title}" is not a date of ${year} on its own weekday`);
    return { label: title, date, current };
  });
  if (!tabs.length) throw new Error("tml-cms: no day tabs");
  tabs.forEach((t, i) => { if (i && Date.parse(t.date) - Date.parse(tabs[i - 1].date) !== 864e5) throw new Error(`tml-cms: day tabs skip from ${tabs[i - 1].date} to ${t.date}`); });
  const cur = tabs.filter(t => t.current);
  if (cur.length !== 1) throw new Error(`tml-cms: ${cur.length} current day tabs`);
  const { label, date } = cur[0];
  const weekday = label.split(" ")[0].toLowerCase();

  // The schedule: from the first stage heading to the end of the view.
  const i0 = html.indexOf('<span class="title-content-coverlineup">');
  if (i0 < 0) throw new Error("tml-cms: no stage heading");
  const body = html.slice(html.lastIndexOf("<h5", i0));
  const heads = (body.match(/class="left artist"/g) || []).length;
  const tokens = [...body.matchAll(/<h5\b[^>]*>([\s\S]*?)<\/h5>|<div class="left artist">([\s\S]*?)<\/div>\s*<div class="left (?:play|lineup_right_wrapper)">\s*(?:<div class="play lineup_right_time">)?([\s\S]*?)<\/div>/g)];
  const stages = [], rows = [];
  let stage = null, template = null;
  for (const t of tokens) {
    if (t[1] != null) {
      if (!/title-content-coverlineup/.test(t[1])) continue;
      stage = plain(t[1]);
      if (!stage) throw new Error("tml-cms: a stage heading with no name");
      if (stages.includes(stage)) throw new Error(`tml-cms: stage "${stage}" printed twice`);
      stages.push(stage); continue;
    }
    if (!stage) throw new Error("tml-cms: a set before any stage");
    const tpl = /date-display-single/.test(t[3]) ? "2010" : "2012";
    if (template && tpl !== template) throw new Error("tml-cms: two templates on one page");
    template = tpl;
    if (tpl === "2010" && (t[3].match(/date-display-single/g) || []).length !== 2) throw new Error(`tml-cms: ${plain(t[2])} does not print two times`);
    const printed = plain(t[3]), artist = plain(t[2]), r = range(printed);
    if (!artist) throw new Error(`tml-cms: a set on ${stage} with no act`);
    if (!r) throw new Error(`tml-cms: ${artist} on ${stage} prints "${printed}", not a 24-hour range`);
    rows.push({ stage, artist, printed, start: r[0], end: r[1] });
  }
  if (rows.length !== heads) throw new Error(`tml-cms: ${heads} act headings but ${rows.length} ranges read`);
  const sets = [], misprints = [], overlays = [], stageBlocks = [];
  let repeats = 0;
  for (const s of stages) {
    let on = rows.filter(r => r.stage === s);
    // A block named as its own stage ("Samsung Galaxy Island Friday", "Radio
    // Ultra Modern") names no act.
    const named = r => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( (on )?(friday|saturday|sunday)!?)?$`, "i").test(r.artist);
    for (const r of on.filter(named)) stageBlocks.push({ stage: s, start: hhmm(r.start), end: hhmm(r.end), artist: r.artist, printed: r.printed });
    on = on.filter(r => !named(r));
    // A block printed across two or more whole sets on its stage (an all-day
    // MC, a live percussionist over the DJs) is not a set of its own.
    const over = on.filter(r => on.filter(x => x.start >= r.start && x.end <= r.end && x.end - x.start < r.end - r.start).length >= 2);
    for (const r of over) overlays.push({ stage: s, start: hhmm(r.start), end: hhmm(r.end), artist: r.artist, printed: r.printed });
    on = on.filter(r => !over.includes(r));
    const kept = [];
    for (const r of on) {
      if (kept.some(k => k.artist === r.artist && k.start === r.start && k.end === r.end)) { repeats++; continue; }
      kept.push(r);
    }
    const bad = new Map();
    for (const r of kept) {
      if (r.end <= r.start) bad.set(r, "the range runs backwards");
      else if (r.end - r.start > 480) bad.set(r, "the range runs over eight hours");
    }
    // Two acts printed in one stage's time: neither can be confirmed.
    for (const a of kept) for (const b of kept) if (a !== b && a.end > a.start && b.end > b.start && a.start < b.end && b.start < a.end && !bad.has(a)) bad.set(a, "printed while another set on the stage is still on");
    for (const r of kept) {
      const x = { stage: s, start: hhmm(r.start), end: hhmm(r.end), artist: r.artist, printed: r.printed };
      if (bad.has(r)) misprints.push({ ...x, misprint: bad.get(r) }); else sets.push({ ...x, at: r.start });
    }
  }
  const blank = stages.filter(s => !sets.some(r => r.stage === s) && !misprints.some(r => r.stage === s));
  sets.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || a.at - b.at);
  return { template, label, date, weekday, tabs: tabs.map(t => t.label), stages: stages.filter(x => !blank.includes(x)), blank, overlays, stageBlocks, repeats,
    sets: sets.map(({ at, ...x }) => x), misprints };
}
