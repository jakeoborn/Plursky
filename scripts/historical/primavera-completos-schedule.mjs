// primavera-completos-schedule.mjs — Primavera Sound's own full timetable
// ("Horarios completos", primaverasound.es/horarios?d=N&l=forum&content=),
// 2016, 2017 and 2019 template, read from an archived capture. Format
// "primavera-completos".
//
// One page prints one day of the whole festival season, Parc del Fòrum and
// the city venues ("Primavera a la Ciutat") side by side:
//   - the heading "Horarios" ("Horaris", "Timetable"; 2019: "Set times"),
//     with "Horarios completos" ("All set times") the active entry of the
//     venue submenu;
//   - a row of day tabs (<div id="title_dias">), one per day with shows, the
//     page's own day the one <span class="rojo"> that is not a link. A tab
//     prints a weekday and a day of the month and nothing else: "MIÉRCOLES 1"
//     in 2016 (Spanish, Catalan or English), "MIÉ-31" in 2017; 2019's print
//     the whole date ("2019-05-30"), which must fall in the edition's year,
//     each tab later than the one before and no more than a week after it.
//     Otherwise the tabs run
//     forward in time, so the row as a whole names its dates: there must be
//     exactly one run of days in the edition's year with the weekdays and
//     days of the month printed, each tab no more than a week after the one
//     before (2016: Monday 30 May to Sunday 5 June, every day; 2017: 3 May to
//     4 June, the days with shows);
//   - a grid (<table id="listaHorarios">) whose first header row groups the
//     columns by venue (<th class="TituloEscenarioforum"> under "PARC DEL
//     FÒRUM", 2019 "Parc del Fòrum", <th class="TituloEscenariociutat"> under
//     "Primavera a la Ciutat"), whose second names one stage per column, each marked with its
//     venue (<th class="escenarioforum">, <th class="escenariociutat">; 2017
//     puts one Fòrum stage after the city's), the same stages repeated in a
//     footer row, then one row every 15 minutes, each opening and closing
//     with its own time (<td class="horaleft">11:30</td> … <td
//     class="horaright"><span>11:30</span></td>) and holding one cell per
//     stage. Past midnight the times carry on (0:00 … 6:30).
// A set is a block in a stage's cell, drawn in that stage's venue:
//   <div class="concertBoxforum KKaddMinutes-N" style="height:Hpx;top:Tpx;">
//     <a href="…2016_artists?id=123" class="artistaAnchor" …>
//     <div class="hora ">(12:00 - 13:30)</div>
//     <div class="2016_artists"> NAME</div></a>   (2017 and 2019: class="artists_2017")
// The name links to the artist's page for the edition's year
// ("2016_artists?id=…"); the year in the name's class is not read, since
// 2019's page still prints 2017's class. The block's printed start
// must be its row's time plus N minutes (0 ≤ N < 15) and, where it prints an
// end, it must be drawn two pixels a minute tall (H = 2 × length). A block
// that prints its start alone ("(18:00)", 2016's minimúsica) is an open end,
// its height not read. Within a Fòrum stage, sets run in order with no
// overlap. Only Parc del Fòrum's stages are the festival site's: the city's
// columns are read (every check above but the overlap holds for them too;
// 2019's Day Pro, a conference, prints two sessions at once on 31 May) and
// returned apart, as `cityStages`, never as sets. Anything else
// throws: nothing on this page is read another way.

import { plain } from "./primavera-horarios-schedule.mjs";

const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;

// Weekdays (Sunday first) in the three languages the page is served in.
const WEEKDAYS = {
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  ca: ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"],
  en: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
};

// Spanish short weekdays, as 2017's tabs print them ("MIÉ-31").
const SHORT = { es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] };

// "MIÉRCOLES 1" (2016) or "MIÉ-31" (2017) → { lang, wd, dom }, or null.
// A whole date ("2019-05-30") is read by tabRun itself.
export function tabDay(label) {
  const m = /^(\S+?)(?: |-)(\d{1,2})$/.exec(String(label || "").trim().toLowerCase());
  if (!m || +m[2] < 1 || +m[2] > 31) return null;
  const short = / /.test(String(label).trim()) ? null : true;
  for (const [lang, names] of Object.entries(short ? SHORT : WEEKDAYS)) {
    const wd = names.indexOf(m[1]);
    if (wd >= 0) return { lang: short ? `${lang}-short` : lang, wd, dom: +m[2] };
  }
  return null;
}

// The dates a row of day tabs names in `year`, or null. The tabs run forward
// in time: 2016's are consecutive days, 2017's list only the days with shows,
// skipping some (Thursday 4 May, then Monday 8 May). Each tab is the first
// day after the one before with its weekday and day of the month, and no more
// than a week after it; exactly one starting day in the year may fit, and all
// the tabs are printed in one language.
export function tabRun(labels, year) {
  const iso = (labels || []).map(l => String(l || "").trim());
  if (iso.length && iso.some(l => /^\d{4}-\d{2}-\d{2}$/.test(l))) {
    const ok = iso.every((l, i) => {
      const d = new Date(l + "T12:00:00Z");
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== l || d.getUTCFullYear() !== year) return false;
      if (!i) return true;
      const gap = (d - new Date(iso[i - 1] + "T12:00:00Z")) / 864e5;
      return gap >= 1 && gap <= 7;
    });
    return ok ? iso : null;
  }
  const days = (labels || []).map(tabDay);
  if (!days.length || days.some(d => !d) || new Set(days.map(d => d.lang)).size !== 1) return null;
  const fits = (d, x) => d.getUTCDay() === x.wd && d.getUTCDate() === x.dom;
  const runs = [];
  for (let t = Date.UTC(year, 0, 1); new Date(t).getUTCFullYear() === year; t += 864e5) {
    if (!fits(new Date(t), days[0])) continue;
    const run = [t];
    for (const x of days.slice(1)) {
      let next = null;
      for (let k = 1; k <= 7; k++) if (fits(new Date(run.at(-1) + k * 864e5), x)) { next = run.at(-1) + k * 864e5; break; }
      if (next === null) break;
      run.push(next);
    }
    if (run.length === days.length && new Date(run.at(-1)).getUTCFullYear() === year) runs.push(run.map(v => new Date(v).toISOString().slice(0, 10)));
  }
  return runs.length === 1 ? runs[0] : null;
}

// "11:30" or "6:30" → minutes, or null.
const clock = t => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};

const VENUES = { forum: "PARC DEL FÒRUM", ciutat: "Primavera a la Ciutat" };

export function parsePrimaveraCompletos(html, { year } = {}) {
  if (!year) throw new Error("no year");
  const heading = plain(/<h1 class="font01">([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
  if (!/^(Horarios|Horaris|Timetable|Set times)$/.test(heading)) throw new Error(`the page's heading "${heading}" is not the timetable's`);
  const active = [...html.matchAll(/<li class="horarios-location active">([\s\S]*?)<\/li>/g)].map(x => plain(x[1]));
  if (active.length !== 1 || !/^(Horarios completos|Horaris complets|Full timetable|All set times)$/.test(active[0])) throw new Error(`the page's venue submenu has "${active.join(", ")}" active, not the full timetable`);

  // The day tabs: every day of the week, the page's own the one marked rojo.
  const tabsAt = html.indexOf('<div id="title_dias"');
  if (tabsAt < 0) throw new Error("no day tabs");
  const tabsHtml = html.slice(tabsAt, html.indexOf("</div>", tabsAt));
  const tabs = [...tabsHtml.matchAll(/<span class="(rojo|)">([\s\S]*?)<\/span>/g)].map(t => ({ on: t[1] === "rojo", link: /<a\b/.test(t[2]), label: plain(t[2]) }));
  if (tabs.length < 1) throw new Error("no day tabs");
  const own = tabs.filter(t => t.on);
  if (own.length !== 1 || own[0].link) throw new Error(`the page marks ${own.length} day tab(s) as its own`);
  if (tabs.some(t => !t.on && !t.link)) throw new Error("a day tab that is neither the page's own nor a link");
  const tabDates = tabRun(tabs.map(t => t.label), year);
  if (!tabDates) throw new Error(`the day tabs "${tabs.map(t => t.label).join(", ")}" name no one run of days in ${year}`);
  const label = own[0].label, date = tabDates[tabs.indexOf(own[0])];

  // The grid: venue groups, then stages, each marked with its venue.
  const tableAt = html.indexOf('<table id="listaHorarios"');
  if (tableAt < 0) throw new Error(`${date}: no timetable`);
  const table = html.slice(tableAt, html.indexOf("</table>", tableAt));
  const heads = [...table.matchAll(/<thead>([\s\S]*?)<\/thead>/g)].map(x => x[1]);
  if (heads.length !== 2) throw new Error(`${date}: ${heads.length} header rows, not a venue row and a stage row`);
  const groups = [...heads[0].matchAll(/<th\b[^>]*class="TituloEscenario(forum|ciutat)"[^>]*>([\s\S]*?)<\/th>/g)].map(x => ({ venue: x[1], title: plain(x[2]) }));
  for (const g of groups) if (g.title && g.title.toUpperCase() !== VENUES[g.venue].toUpperCase()) throw new Error(`${date}: the ${g.venue} columns are headed "${g.title}"`);
  const titled = new Set(groups.filter(g => g.title).map(g => g.venue));
  const cols = [...heads[1].matchAll(/<th class="escenario(forum|ciutat)">([\s\S]*?)<\/th>/g)].map(x => ({ venue: x[1], stage: plain(x[2]) }));
  if (!cols.length || cols.some(c => !c.stage) || new Set(cols.map(c => c.stage)).size !== cols.length) throw new Error(`${date}: stage headers ${cols.map(c => c.stage).join(", ")}`);
  if (!cols.some(c => c.venue === "forum")) throw new Error(`${date}: no Parc del Fòrum stage`);
  for (const v of new Set(cols.map(c => c.venue))) if (!titled.has(v)) throw new Error(`${date}: ${v} stages with no "${VENUES[v]}" heading over them`);
  const stages = cols.map(c => c.stage);
  const body = /<tbody>([\s\S]*)$/.exec(table)?.[1] ?? "";
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(r => r[1]);
  const footer = rows.pop() ?? "";
  const foot = [...footer.matchAll(/<td class="escenario(forum|ciutat)">([\s\S]*?)<\/td>/g)].map(x => `${x[1]}:${plain(x[2])}`);
  if (foot.join("|") !== cols.map(c => `${c.venue}:${c.stage}`).join("|")) throw new Error(`${date}: the footer's stages (${foot.join(", ")}) are not the header's`);
  if (rows.length < 2) throw new Error(`${date}: no time rows`);

  const sets = [], city = [], seen = stages.map(() => null);
  let axis0 = null, prevRow = null;
  rows.forEach((row, n) => {
    const cells = [...row.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)];
    const left = cells.shift(), right = cells.pop();
    if (!/class="horaleft"/.test(left?.[1] || "") || !/class="horaright"/.test(right?.[1] || "")) throw new Error(`${date}: row ${n + 1} does not open and close with its time`);
    const t = clock(plain(left[2]));
    if (t === null || plain(right[2]) !== plain(left[2])) throw new Error(`${date}: row ${n + 1} prints "${plain(left[2])}" and "${plain(right[2])}"`);
    if (prevRow !== null && t !== (prevRow + 15) % 1440) throw new Error(`${date}: row ${n + 1} prints ${hhmm(t)}, not 15 minutes after ${hhmm(prevRow)}`);
    prevRow = t;
    if (axis0 === null) axis0 = t;
    const at = axis0 + n * 15; // minutes from the axis's first day, past midnight carried on
    if (cells.length !== stages.length) throw new Error(`${date} ${hhmm(t)}: ${cells.length} cells for ${stages.length} stages`);
    cells.forEach((c, k) => {
      const { stage, venue } = cols[k];
      const blocks = [...c[2].matchAll(/<div class="concertBox(forum|ciutat) KKaddMinutes-(\d+)" style="height:(\d+)px;top:-?\d+px;">([\s\S]*?)<\/a>/g)];
      if ((c[2].match(/concertBox/g) || []).length !== blocks.length) throw new Error(`${date} ${hhmm(t)} ${stage}: a block this format does not read`);
      for (const b of blocks) {
        const add = +b[2], height = +b[3];
        if (b[1] !== venue) throw new Error(`${date} ${hhmm(t)} ${stage}: a ${b[1]} block in a ${venue} column`);
        const links = [...b[4].matchAll(/<a href="[^"]*?(\d{4})_artists\?id=\d+" class="artistaAnchor"/g)].map(x => +x[1]);
        if ((b[4].match(/<a\b/g) || []).length !== 1 || links.length !== 1) throw new Error(`${date} ${hhmm(t)} ${stage}: a block that does not link to one artist's page`);
        if (links[0] !== year) throw new Error(`${date} ${hhmm(t)} ${stage}: a name linked to ${links[0]}'s artist page, not ${year}'s`);
        const names = [...b[4].matchAll(/<div class="(?:\d{4}_artists|artists_\d{4})">([\s\S]*?)<\/div>/g)].map(x => plain(x[1]));
        const horas = [...b[4].matchAll(/<div class="hora ?">([\s\S]*?)<\/div>/g)].map(x => plain(x[1]));
        if (names.length !== 1 || !names[0] || horas.length !== 1) throw new Error(`${date} ${hhmm(t)} ${stage}: a block with ${names.length} name(s) and ${horas.length} time(s)`);
        const artist = names[0], printed = horas[0], where = `${date} ${stage} "${artist}"`;
        const hm = /^\((\d{1,2}:\d{2})(?: - (\d{1,2}:\d{2}))?\)$/.exec(printed);
        const s = hm && clock(hm[1]), e = hm?.[2] ? clock(hm[2]) : null;
        if (s === null || (hm[2] && e === null)) throw new Error(`${where}: cannot read "${printed}"`);
        if (add >= 15 || s !== (t + add) % 1440) throw new Error(`${where}: prints ${printed}, drawn at ${hhmm(t)} + ${add} minutes`);
        const open = !hm[2], len = open ? null : (e - s + 1440) % 1440;
        if (!open && (len <= 0 || len > 360)) throw new Error(`${where}: "${printed}" does not run forward within the night`);
        if (!open && height !== 2 * len) throw new Error(`${where}: "${printed}" is ${len} minutes, drawn ${height}px tall (not 2px a minute)`);
        const start = at + add, prev = seen[k];
        if (prev && start < prev.end && venue === "forum") throw new Error(`${where}: starts at ${hhmm(start)}, before "${prev.artist}" ends`);
        seen[k] = { artist, end: start + (len ?? 0) };
        (venue === "forum" ? sets : city).push({ stage, start: hhmm(s), end: open ? "" : hhmm(e), artist, printed, ...(open && { openEnd: true }) });
      }
    });
  });
  if (!sets.length) throw new Error(`${date}: no Parc del Fòrum sets`);
  const forumStages = cols.filter(c => c.venue === "forum").map(c => c.stage);
  return { date, label, heading, active: active[0], tabs: tabs.map(t => t.label), tabDates, stages: forumStages,
    cityStages: cols.filter(c => c.venue === "ciutat").map(c => c.stage), citySets: city.length, axis: `${hhmm(axis0)}-${hhmm(prevRow)}`, sets };
}
