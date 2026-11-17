// ef-scheduler-schedule.mjs — Electric Forest's official Scheduler for 2014
// and 2015 (scheduler.electricforestfestival.com in 2014,
// electricforestfestival.com/scheduler/ in 2015), read from an archived
// capture. Format "ef-scheduler".
//
// The page prints a tab per day ("June 25", data-target "2015-06-25") and one
// container per day (class "date-2015-06-25") holding:
//   - an hour axis ("4:00pm", "5:00pm" …) and `data-date-min`, the axis's
//     first minute written as a UTC epoch of the festival's wall clock;
//   - one stage label per row (`<div class="stage-label" title="Tripolee">`);
//   - one row per stage, in the labels' order, each set an
//     `<a class="timeslot minute-N" style="left: Lpx; width: Wpx;"
//     title="Dabin - 4:00pm - 4:45pm">` with the same name and range printed
//     inside it.
// A block's left edge is its start on the axis and its width its length, at
// one scale for the whole page. So each set's printed start must sit where
// its block starts, which settles am and pm (and the day past midnight), and
// its printed length must equal both its width and its `minute-N` class. A
// set whose block disagrees with its printed range is returned in
// `misprints`, never as a set. A block drawn twice in the same place is one
// set (`repeats` keeps the second).

import { plain } from "./ef-schedule.mjs";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
// "6:45pm" → minutes since midnight; null if not a clock time.
const clock = t => {
  const m = /^(\d{1,2}):(\d{2})(am|pm)$/i.exec(String(t).trim());
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) return null;
  return (+m[1] % 12 + (m[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + +m[2];
};
const attr = (tag, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag); return m ? m[1] : null; };

// `programme` names non-music entries the festival printed in a music
// stage's row (a brewery tasting beside a set): they are returned as sets for
// the build to drop, and are left out of the overlap check.
export function parseEfScheduler(html, { year, programme = [] } = {}) {
  const prog = new Set(programme);
  // The day tabs: data-target is the date, the link prints "June 25".
  const tabs = [...html.matchAll(/<a\b[^>]*class="date-switcher[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map(m => {
    const date = attr(m[0], "data-target"), label = plain(m[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error(`a day tab "${label}" names no date`);
    const lm = /^([A-Za-z]+) (\d{1,2})$/.exec(label), mo = lm ? MONTHS.indexOf(lm[1].toLowerCase()) + 1 : 0;
    if (!mo || `${date.slice(0, 4)}-${pad(mo)}-${pad(+lm[2])}` !== date) throw new Error(`the day tab "${label}" does not print its date ${date}`);
    if (year && !date.startsWith(`${year}-`)) throw new Error(`the day tab ${date} is not in ${year}`);
    return { date, label };
  });
  if (!tabs.length) throw new Error("the page prints no day tab");
  if (new Set(tabs.map(t => t.date)).size !== tabs.length) throw new Error("the page prints a day tab twice");

  // One container per day, in the tabs' order.
  const starts = [...html.matchAll(/<div class="container date-(\d{4}-\d{2}-\d{2})[^"]*"[^>]*>/g)];
  if (starts.map(m => m[1]).join() !== tabs.map(t => t.date).join())
    throw new Error(`the page draws days ${starts.map(m => m[1]).join(", ")}, its tabs print ${tabs.map(t => t.date).join(", ")}`);

  const scales = new Set(), days = [];
  starts.forEach((m, i) => {
    const date = m[1], tab = tabs[i];
    const body = html.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : undefined);
    const min = +attr(m[0], "data-date-min"), max = +attr(m[0], "data-date-max");
    if (!min || !max || max <= min) throw new Error(`${date}: no axis range`);
    const axis = new Date(min * 1000).toISOString();
    // The axis starts on the day itself, after 6 AM.
    if (axis.slice(0, 10) !== date || +axis.slice(11, 13) < 6) throw new Error(`${date}: the axis starts at ${axis.slice(0, 16)}`);
    const axisStart = +axis.slice(11, 13) * 60 + +axis.slice(14, 16);
    const firstHour = /<div class="time-gauge[^"]*">\s*<div>([^<]+)<\/div>/.exec(body);
    if (!firstHour || clock(firstHour[1]) !== axisStart) throw new Error(`${date}: the axis prints "${firstHour?.[1]}", its data starts at ${hhmm(axisStart)}`);
    const stages = [...body.matchAll(/<div class="stage-label" title="([^"]*)">/g)].map(x => plain(x[1]));
    if (!stages.length || new Set(stages).size !== stages.length) throw new Error(`${date}: stage labels ${stages.join(", ")}`);
    const sched = body.indexOf('<div class="schedule">');
    if (sched < 0) throw new Error(`${date}: no schedule`);
    const rows = body.slice(sched).split(/<div class="row clearfix">/).slice(1);
    if (rows.length !== stages.length) throw new Error(`${date}: ${rows.length} rows for ${stages.length} stage labels`);

    const sets = [], misprints = [];
    rows.forEach((row, r) => {
      const stage = stages[r];
      for (const a of row.matchAll(/<a\b[^>]*class="timeslot minute-(\d+)"[^>]*>[\s\S]*?<\/a>/g)) {
        const tag = /^<a\b[^>]*>/.exec(a[0])[0];
        const title = plain(attr(tag, "title") ?? ""), name = plain(/<div class="timeslot-title">([\s\S]*?)<\/div>/.exec(a[0])?.[1] ?? "");
        // A block may print its range only in its title (2015's Silent Disco
        // channels); the title then carries it after the name.
        const inner = /<div class="timeslot-time">([\s\S]*?)<\/div>/.exec(a[0]);
        const range = inner ? plain(inner[1]) : title.startsWith(`${name} - `) ? title.slice(name.length + 3) : "";
        const where = `${date} ${stage} "${name}"`;
        if (!name) throw new Error(`${date} ${stage}: a block with no name`);
        if (title !== `${name} - ${range}`) throw new Error(`${where}: its title "${title}" is not its name and range "${range}"`);
        const rm = /^(\S+) - (\S+)$/.exec(range), s = rm && clock(rm[1]), e = rm && clock(rm[2]);
        if (s === null || e === null || !rm) throw new Error(`${where}: cannot read the range "${range}"`);
        const len = (e - s + 1440) % 1440, mins = +a[1];
        const st = /left:\s*(\d+(?:\.\d+)?)px;\s*width:\s*(\d+(?:\.\d+)?)px/.exec(attr(tag, "style") ?? "");
        if (!st) throw new Error(`${where}: no place on the axis`);
        const left = +st[1], width = +st[2];
        if (!mins || !width) throw new Error(`${where}: a block of ${mins} minutes, ${width}px`);
        const scale = width / mins;
        scales.add(scale);
        const at = axisStart + left / scale;           // minutes past the day's midnight
        const printedAt = s < 6 * 60 ? s + 1440 : s; // before 6 AM is the night of this day
        if (len !== mins || Math.abs(at - printedAt) > 0.01) {
          misprints.push({ stage, artist: name, printed: range, start: hhmm(s), end: hhmm(e), misprint: `the block starts at ${hhmm(Math.round(at))} and runs ${mins} minutes` });
          continue;
        }
        sets.push({ stage, start: hhmm(printedAt), end: hhmm(printedAt + len), artist: name, printed: range, at: printedAt, len });
      }
    });
    // Two sets on one stage never overlap. A block drawn twice in the same
    // place (same act, start and length: 2014's Cosby Sweater) is one set,
    // and the repeat is kept for the ledger.
    const byStage = sets.filter(x => !prog.has(x.artist)).sort((a, b) => a.stage.localeCompare(b.stage) || a.at - b.at || a.artist.localeCompare(b.artist));
    const repeats = [];
    for (let k = 1; k < byStage.length; k++) {
      const p = byStage[k - 1], q = byStage[k];
      if (p.stage !== q.stage) continue;
      if (q.artist === p.artist && q.at === p.at && q.len === p.len) { repeats.push(q); byStage.splice(k--, 1); continue; }
      if (q.at < p.at + p.len) throw new Error(`${date} ${q.stage}: "${q.artist}" at ${q.start} starts before "${p.artist}" ends at ${p.end}`);
    }
    sets.splice(0, sets.length, ...sets.filter(x => !repeats.includes(x)));
    const weekday = WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()];
    days.push({ date, label: tab.label, weekday, axisStart: hhmm(axisStart), stages, sets: sets.map(({ at, len, ...x }) => x), misprints,
      repeats: repeats.map(({ at, len, ...x }) => x) });
  });
  if (scales.size !== 1) throw new Error(`the blocks are drawn at ${scales.size} scales (${[...scales].join(", ")} px per minute)`);
  for (let i = 1; i < days.length; i++)
    if (new Date(days[i].date + "T12:00:00Z") - new Date(days[i - 1].date + "T12:00:00Z") !== 864e5) throw new Error(`the page prints ${days[i - 1].date} and then ${days[i].date}`);
  return { days, scale: [...scales][0] };
}
