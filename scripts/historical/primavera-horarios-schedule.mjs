// primavera-horarios-schedule.mjs — Primavera Sound's own timetable page for
// Parc del Fòrum (primaverasound.es/horarios?d=N&l=forum), 2015 template,
// read from an archived capture. Format "primavera-horarios".
//
// One page prints one day:
//   - a heading that names Parc del Fòrum ("Horaris Parc del Fòrum",
//     "Horarios Parc del Fòrum", "Timetable: Parc del Fòrum"), and, where the
//     page draws its venue picker, "forum" selected;
//   - a row of day tabs (<div id="title_dias">), one per festival day, the
//     page's own day the one <span class="rojo"> that is not a link. The page
//     prints them in whichever language it was served in: Catalan ("dimecres
//     27 de maig"), Spanish ("miércoles 27 de mayo") or English ("Wednesday
//     May 27"). No tab prints a year: each tab's weekday must fall on its date
//     in the edition's year, and the tabs must be the edition's days in order;
//   - a grid (<table id="listaHorarios">): one <th class="escenario"> per
//     stage, repeated in a footer row, then one row every 15 minutes, each
//     opening and closing with its own time (<td class="horaleft">16:00</td>
//     … <td class="horaright"><span>16:00</span></td>) and holding one cell
//     per stage. Past midnight the times carry on (0:00, 0:15 … 6:30).
// A set is a block in a stage's cell:
//   <div class="concertBox KKaddMinutes-N" style="height:Hpx;top:Tpx;">
//     <div class="artista">Name</div><div class="hora ">(16:00 - 17:00)</div>
// Its printed start must be its row's time plus N minutes (0 ≤ N < 15), and,
// where it prints an end, the block must be drawn two pixels a minute tall
// (H = 2 × length). A block that prints its start alone ("(03:00)", 2015's
// Zamilska) is an open end, its height not read. The top offset is not read.
// Within a stage, sets run in order with no overlap. Anything else throws:
// nothing on this page is read another way.

const ENT = { "&amp;": "&", "&nbsp;": " ", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&rsquo;": "’", "&lsquo;": "‘", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…" };
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();

// Weekdays (Sunday first) and months in the three languages the page prints.
const WEEKDAYS = {
  ca: ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"],
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  en: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
};
const MONTHS = {
  ca: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
};

// The date a day tab names in `year`, or null: "dimecres 27 de maig",
// "miércoles 27 de mayo" or "Wednesday May 27", its weekday on that date.
export function tabDate(label, year) {
  const s = String(label || "").trim().toLowerCase();
  let lang, wd, day, mo, m;
  if ((m = /^(\S+) (\d{1,2}) de (\S+)$/.exec(s))) {
    lang = ["ca", "es"].find(l => WEEKDAYS[l].includes(m[1]) && MONTHS[l].includes(m[3]));
    if (!lang) return null;
    wd = WEEKDAYS[lang].indexOf(m[1]); day = +m[2]; mo = MONTHS[lang].indexOf(m[3]) + 1;
  } else if ((m = /^([a-z]+) ([a-z]+) (\d{1,2})$/.exec(s))) {
    wd = WEEKDAYS.en.indexOf(m[1]); mo = MONTHS.en.indexOf(m[2]) + 1; day = +m[3];
    if (wd < 0 || !mo) return null;
  } else return null;
  const iso = `${year}-${pad(mo)}-${pad(day)}`, d = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso || d.getUTCDay() !== wd) return null;
  return iso;
}

// "16:00" or "6:30" → minutes, or null.
const clock = t => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};

export function parsePrimaveraHorarios(html, { year } = {}) {
  if (!year) throw new Error("no year");
  const heading = plain(/<h1 class="font01">([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
  if (!/Parc del Fòrum/.test(heading)) throw new Error(`the page's heading "${heading}" does not name Parc del Fòrum`);
  const picker = /<select name="l" id="horarios-escenarios-select">([\s\S]*?)<\/select>/.exec(html)?.[1];
  if (picker !== undefined && !/<option value="forum" selected="selected">/.test(picker)) throw new Error("the page's venue picker does not select forum");

  // The day tabs: every festival day, the page's own the one marked rojo.
  const tabsAt = html.indexOf('<div id="title_dias"');
  if (tabsAt < 0) throw new Error("no day tabs");
  const tabsHtml = html.slice(tabsAt, html.indexOf("</div>", tabsAt));
  const tabs = [...tabsHtml.matchAll(/<span class="(rojo|)">([\s\S]*?)<\/span>/g)].map(t => ({ on: t[1] === "rojo", link: /<a\b/.test(t[2]), label: plain(t[2]) }));
  if (tabs.length < 1) throw new Error("no day tabs");
  const own = tabs.filter(t => t.on);
  if (own.length !== 1 || own[0].link) throw new Error(`the page marks ${own.length} day tab(s) as its own`);
  if (tabs.some(t => !t.on && !t.link)) throw new Error("a day tab that is neither the page's own nor a link");
  const tabDates = tabs.map(t => tabDate(t.label, year));
  const bad = tabs.find((t, i) => !tabDates[i]);
  if (bad) throw new Error(`the day tab "${bad.label}" names no date in ${year}`);
  for (let i = 1; i < tabDates.length; i++)
    if (new Date(tabDates[i] + "T12:00:00Z") - new Date(tabDates[i - 1] + "T12:00:00Z") !== 864e5) throw new Error(`the day tabs print ${tabDates[i - 1]} and then ${tabDates[i]}`);
  const label = own[0].label, date = tabDates[tabs.indexOf(own[0])];

  // The grid.
  const tableAt = html.indexOf('<table id="listaHorarios"');
  if (tableAt < 0) throw new Error(`${date}: no timetable`);
  const table = html.slice(tableAt, html.indexOf("</table>", tableAt));
  const thead = /<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? "";
  const stages = [...thead.matchAll(/<th class="escenario">([\s\S]*?)<\/th>/g)].map(x => plain(x[1]));
  if (!stages.length || stages.some(s => !s) || new Set(stages).size !== stages.length) throw new Error(`${date}: stage headers ${stages.join(", ")}`);
  const body = /<tbody>([\s\S]*)$/.exec(table)?.[1] ?? "";
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(r => r[1]);
  const footer = rows.pop() ?? "";
  const foot = [...footer.matchAll(/<td class="escenario">([\s\S]*?)<\/td>/g)].map(x => plain(x[1]));
  if (foot.join("|") !== stages.join("|")) throw new Error(`${date}: the footer's stages (${foot.join(", ")}) are not the header's`);
  if (rows.length < 2) throw new Error(`${date}: no time rows`);

  const sets = [], seen = stages.map(() => null);
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
      const stage = stages[k];
      const blocks = [...c[2].matchAll(/<div class="concertBox KKaddMinutes-(\d+)" style="height:(\d+)px;top:-?\d+px;">([\s\S]*?)<\/a>/g)];
      if ((c[2].match(/concertBox/g) || []).length !== blocks.length) throw new Error(`${date} ${hhmm(t)} ${stage}: a block this format does not read`);
      for (const b of blocks) {
        const add = +b[1], height = +b[2];
        const names = [...b[3].matchAll(/<div class="artista">([\s\S]*?)<\/div>/g)].map(x => plain(x[1]));
        const horas = [...b[3].matchAll(/<div class="hora ?">([\s\S]*?)<\/div>/g)].map(x => plain(x[1]));
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
        if (prev && start < prev.end) throw new Error(`${where}: starts at ${hhmm(start)}, before "${prev.artist}" ends`);
        seen[k] = { artist, end: start + (len ?? 0) };
        sets.push({ stage, start: hhmm(s), end: open ? "" : hhmm(e), artist, printed, ...(open && { openEnd: true }) });
      }
    });
  });
  if (!sets.length) throw new Error(`${date}: no sets`);
  return { date, label, heading, tabs: tabs.map(t => t.label), tabDates, stages, axis: `${hhmm(axis0)}-${hhmm(prevRow)}`, sets };
}
