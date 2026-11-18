// sonar-schedule.mjs — Sónar Barcelona's own timetable page
// (sonar.es/en/<year>/schedules), read from an archived capture. Format
// "sonar-calendar".
//
// One page prints the whole edition. Its <title> names the edition
// ("Concerts Timetable - Sónar Barcelona 2018", "Schedule - Sónar Barcelona
// 2016") or, from mid-2019, the page alone ("Timetables", "Schedules"); the
// header logo then names it (<h1 class="no-text">Sonar Sónar Barcelona
// 2019</h1>). The site keeps every year's pages under its own year in the
// path, and the page must name the year asked for.
//
// Each session of the festival is one calendar the page draws as a grid:
//
//   <h3>Thursday 18 | Sónar by Day </h3>
//   <div id="calendar_20190718_dia" class="calendar_mod …"
//        data-events="[{title, start, end, allDay, timezone, column, link_artist, …}]"
//        data-columns="[{id, name, timezone, …}]"
//        data-date="20190718" data-init-hour="13" data-end-hour="00"
//        data-timezone="dia">
//
// "dia" is Sónar by Day, "nit" Sónar by Night. A calendar's date is its own
// data-date, and its id repeats it; its heading, the nearest <h3> before it,
// prints that date's weekday and day of the month and the session's name. The
// grid's columns are the stages, by id; every event sits in one of them and
// prints a start and an end on the 24-hour clock ("13:00", "14:30"). A night
// calendar runs past midnight: its grid starts at data-init-hour and ends at
// data-end-hour the next morning, and a set starting after midnight is still
// that night's (the day of the calendar's date). A set must start and end
// inside its calendar's hours, end after it starts, and, within a stage, not
// overlap the next one.
//
// A stage named in `programme` (Sónar+D's talks, masterclasses and
// installations in 2022: Stage+D, Lounge+D, SonarÀgora, SonarMàtica,
// SonarExtra) is read but not held to the grid's hours or to the overlap
// rule: its entries are returned with `programme: true` for the gather to
// exclude. Anything else it cannot confirm throws.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const unent = s => String(s).replace(/&(?:amp|quot|#0?39|lt|gt|nbsp);/g, e => ENT[e] ?? e);
const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SESSION = { dia: "Sónar by Day", nit: "Sónar by Night" };
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const mins = t => { const m = HHMM.exec(t); return m ? +m[1] * 60 + +m[2] : NaN; };
const pad = n => String(n).padStart(2, "0");

export function parseSonarSchedule(html, { year, programme = [] } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  const logo = plain(/<h1 class="no-text">([\s\S]*?)<\/h1>/.exec(text)?.[1] || "");
  const named = [title, logo].map(x => /Sónar Barcelona (\d{4})\b/.exec(x)?.[1]).filter(Boolean);
  if (!named.length) throw new Error(`sonar-calendar: neither the title ("${title}") nor the logo ("${logo}") names a Sónar Barcelona edition`);
  if (named.some(y => +y !== year)) throw new Error(`sonar-calendar: the page names Sónar Barcelona ${named.join(" and ")}, not ${year}`);

  const seen = new Map(), sessions = [];
  for (const m of text.matchAll(/<div id="(calendar_(\d{8})_(dia|nit))"([^>]*)>/g)) {
    const [, id, idDate, tz, rest] = m;
    const a = Object.fromEntries([...rest.matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]]));
    if (seen.has(id)) { if (seen.get(id) !== m[0]) throw new Error(`sonar-calendar: ${id} is drawn twice, differently`); continue; }
    seen.set(id, m[0]);
    if (a["data-date"] !== idDate || a["data-timezone"] !== tz) throw new Error(`sonar-calendar: ${id} prints date ${a["data-date"]} and session ${a["data-timezone"]}`);
    const date = `${idDate.slice(0, 4)}-${idDate.slice(4, 6)}-${idDate.slice(6)}`;
    if (+idDate.slice(0, 4) !== year) throw new Error(`sonar-calendar: ${id} is dated ${date}, not in ${year}`);
    // Its heading: the last <h3> before the calendar.
    const before = text.slice(0, m.index), h = before.lastIndexOf("<h3");
    const heading = h < 0 ? "" : plain(before.slice(h).replace(/^<h3[^>]*>/, "").split(/<\/h3>/)[0]);
    const wd = WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()], dom = +idDate.slice(6);
    if (heading !== `${wd} ${dom} | ${SESSION[tz]}`) throw new Error(`sonar-calendar: ${id} is headed "${heading}", not "${wd} ${dom} | ${SESSION[tz]}"`);
    const init = +a["data-init-hour"], endH = +a["data-end-hour"];
    if (!(init >= 0 && init < 24 && endH >= 0 && endH < 24)) throw new Error(`sonar-calendar: ${id} prints hours ${a["data-init-hour"]} to ${a["data-end-hour"]}`);
    let events, columns;
    try { events = JSON.parse(unent(a["data-events"] ?? "")); columns = JSON.parse(unent(a["data-columns"] ?? "")); }
    catch (e) { throw new Error(`sonar-calendar: ${id}'s events or columns are not JSON (${e.message})`); }
    const stageOf = new Map(columns.map(c => [String(c.id), plain(c.name)]));
    if (stageOf.size !== columns.length || [...stageOf.values()].some(x => !x)) throw new Error(`sonar-calendar: ${id} prints a column twice or with no name`);
    if (new Set(stageOf.values()).size !== stageOf.size) throw new Error(`sonar-calendar: ${id} names two columns the same`);
    // Minutes on the calendar's own clock: a night calendar's morning hours
    // carry on past 24:00.
    const wraps = endH <= init, from = init * 60, to = (wraps ? endH + 24 : endH === 0 ? 24 : endH) * 60;
    const onGrid = t => { const v = mins(t); return wraps && v < from ? v + 1440 : v; };
    const sets = [];
    for (const e of events) {
      const stage = stageOf.get(String(e.column)), artist = plain(e.title || "");
      if (!stage) throw new Error(`sonar-calendar: ${id}: "${artist}" sits in column ${e.column}, which the calendar does not print`);
      if (!artist) throw new Error(`sonar-calendar: ${id}: an event on ${stage} prints no title`);
      if (e.allDay !== false || e.timezone !== tz) throw new Error(`sonar-calendar: ${id}: ${artist} is printed all-day or in another session (${e.allDay}, ${e.timezone})`);
      if (!HHMM.test(e.start || "") || !HHMM.test(e.end || "")) throw new Error(`sonar-calendar: ${id}: ${artist} prints "${e.start}" to "${e.end}", not two 24-hour times`);
      const prog = programme.includes(stage);
      let a0 = onGrid(e.start), b0 = onGrid(e.end);
      if (b0 <= a0) b0 += 1440;
      if (!prog) {
        if (a0 < from || b0 > to) throw new Error(`sonar-calendar: ${id}: ${artist} (${e.start} to ${e.end}) runs outside the calendar's ${pad(init)}:00 to ${pad(endH)}:00`);
        if (b0 - a0 > 12 * 60) throw new Error(`sonar-calendar: ${id}: ${artist} runs over twelve hours`);
      }
      sets.push({ date, session: tz, stage, start: e.start, end: e.end, artist, link: e.link_artist || "", from: a0, to: b0, ...(prog && { programme: true }) });
    }
    for (const st of new Set(sets.map(x => x.stage))) {
      if (programme.includes(st)) continue;
      const on = sets.filter(x => x.stage === st).sort((x, y) => x.from - y.from);
      for (let i = 1; i < on.length; i++) if (on[i].from < on[i - 1].to) throw new Error(`sonar-calendar: ${id}: ${on[i - 1].artist} and ${on[i].artist} overlap on ${st}`);
    }
    sessions.push({ id, date, session: tz, label: heading, hours: `${pad(init)}:00 to ${pad(endH)}:00`, stages: [...stageOf.values()], sets });
  }
  if (!sessions.length) throw new Error("sonar-calendar: the page draws no calendar");
  const dates = [...new Set(sessions.map(x => x.date))].sort();
  // A day is printed as its sessions' headings, Day before Night.
  const days = dates.map(date => {
    const ss = sessions.filter(x => x.date === date).sort((x, y) => x.session.localeCompare(y.session));
    return { date, label: ss.map(x => x.label).join(" · "), sessions: ss.map(x => x.id), sets: ss.flatMap(x => x.sets) };
  });
  return { title, logo, sessions, days, stages: [...new Set(sessions.flatMap(x => x.stages))] };
}
