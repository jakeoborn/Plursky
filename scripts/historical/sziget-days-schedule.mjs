// sziget-days-schedule.mjs — Sziget's own day-by-day programme page
// (sziget.hu/festival_english/programs/-/days?day=<date>&stages[]=<id>…), read
// from an archived capture. Format "sziget-days".
//
// One page prints one day on the stages its address selects. The page has
// three parts, all inside its <div class="cikk">:
//
//   <table class="dailyDaySelector">: one tab per day of the festival week,
//     "August 14.<br>Saturday" (no year), each linking to the same page for
//     its own day; the page's own day is the <td class="selected"> tab, and
//     its link carries the date (day=2010-08-14).
//   The stage picker: a checkbox per stage the programme can draw
//     (<input name="stages[]" value="1441" checked><label>Main Stage</label>),
//     checked for the stages the page draws, and a plain link for a venue the
//     grid never draws.
//   <div class="prg_szinpad">: the grid. Its header row prints one <th> per
//     checked stage; each row after it starts with the
//     time a set starts (<td class="time">15:00</td>, 24-hour clock), then one
//     cell per stage not still covered from above: an empty cell
//     (class="prprogramcellaures") or a set (<td rowspan="N"><a
//     href=".../programs/helyszin/<slug>.<stage id>.html#p<id>">Act (UK)</a>).
//
// A set prints its start alone. Its rowspan reaches only as far as the grid's
// next row on which that stage is empty or starts another set, which is not a
// printed end, so every set is an open end. The rows run in time order and
// may wrap past midnight once: a set after midnight is that night's.
//
// Throws on anything it cannot confirm: no selected tab or more than one, a
// tab outside the year, headers that are not the checked stages, a set whose
// link names another stage than its column, a cell left over or missing in a
// row, a rowspan past the grid's end, times out of order.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const unent = s => String(s).replace(/&(?:amp|quot|#0?39|lt|gt|nbsp);/g, e => ENT[e] ?? e);
const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const pad = n => String(n).padStart(2, "0");

// A tab's label ("August 14. Saturday") as a date in `year`, or null when its
// weekday does not fall on that date.
export function tabDate(label, year) {
  const m = /^([A-Z][a-z]+) (\d{1,2})\. ([A-Z][a-z]+)$/.exec(String(label));
  if (!m || !MONTHS.includes(m[1])) return null;
  const date = `${year}-${pad(MONTHS.indexOf(m[1]) + 1)}-${pad(+m[2])}`;
  const d = new Date(date + "T12:00:00Z");
  return d.toISOString().slice(0, 10) === date && WEEKDAYS[d.getUTCDay()] === m[3] ? date : null;
}

export function parseSzigetDays(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  if (title !== "Sziget.hu - Programs") throw new Error(`sziget-days: the page is titled "${title}", not Sziget.hu's programme`);
  const template = /\/templates\/(sziget\d{4}[a-z]?)\//.exec(text)?.[1] || "";
  if (!template) throw new Error("sziget-days: the page is not drawn on a Sziget template");

  // The day tabs.
  const sel = /<table class="dailyDaySelector">([\s\S]*?)<\/table>/.exec(text);
  if (!sel) throw new Error("sziget-days: no day tabs");
  const tabs = [...sel[1].matchAll(/<td( class="selected")?>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/td>/g)].map(m => {
    const href = unent(m[2]), label = plain(m[3].replace(/<br\s*\/?>/gi, " "));
    const day = /\/festival_english\/programs\/-\/days\?day=(\d{4}-\d{2}-\d{2})&/.exec(href)?.[1];
    if (!day) throw new Error(`sziget-days: the tab "${label}" does not link to Sziget's English day programme`);
    const date = tabDate(label, year);
    if (date !== day) throw new Error(`sziget-days: the tab "${label}" links to ${day}, not a day in ${year} it prints`);
    return { date, label, selected: !!m[1] };
  });
  if (!tabs.length || (sel[1].match(/<td/g) || []).length !== tabs.length) throw new Error("sziget-days: a day tab could not be read");
  for (let i = 1; i < tabs.length; i++)
    if (Date.parse(tabs[i].date) - Date.parse(tabs[i - 1].date) !== 864e5) throw new Error(`sziget-days: the tabs ${tabs[i - 1].label} and ${tabs[i].label} are not consecutive days`);
  const own = tabs.filter(t => t.selected);
  if (own.length !== 1) throw new Error(`sziget-days: ${own.length} tabs are selected`);
  const { date, label } = own[0];

  // The stage picker.
  const form = /<form id="dailyForm">([\s\S]*?)<\/form>/.exec(text)?.[1];
  if (!form) throw new Error("sziget-days: no stage picker");
  const picker = [...form.matchAll(/<input type="checkbox" name="stages\[\]" value="(\d+)" id="loc(\d+)"( checked="checked")?>\s*<label for="loc(\d+)">([^<]*)<\/label>/g)].map(m => {
    if (m[1] !== m[2] || m[2] !== m[4]) throw new Error(`sziget-days: the picker's stage ${m[1]} is labelled for ${m[4]}`);
    return { id: m[1], name: plain(m[5]), checked: !!m[3] };
  });
  if ((form.match(/name="stages\[\]"/g) || []).length !== picker.length) throw new Error("sziget-days: a stage in the picker could not be read");
  const venues = [...form.matchAll(/<a [^>]*href="[^"]*\/programs\/helyszin\/[^"]+\.(\d+)\.html"[^>]*>([^<]*)<\/a>/g)].map(m => plain(m[2]));
  const shown = picker.filter(p => p.checked);
  if (!shown.length) throw new Error("sziget-days: the picker checks no stage");

  // The grid.
  const grid = /<div class="prg_szinpad">\s*<table[^>]*>([\s\S]*?)<\/table>/.exec(text)?.[1];
  if (!grid) throw new Error("sziget-days: no programme grid");
  const trs = [...grid.matchAll(/<tr class="([^"]*)">([\s\S]*?)<\/tr>/g)];
  if (trs[0]?.[1] !== "tableheader") throw new Error("sziget-days: the grid has no header row");
  const heads = [...trs[0][2].matchAll(/<th>([\s\S]*?)<\/th>/g)].map(m => plain(m[1]));
  // Its columns are the checked stages, each once (2011's grid draws them in
  // another order than the picker lists them).
  const cols = heads.map(h => shown.find(s => s.name === h));
  if (cols.some(c => !c) || new Set(cols).size !== shown.length || heads.length !== shown.length) throw new Error(`sziget-days: the grid's columns (${heads.join(", ")}) are not the checked stages (${shown.map(s => s.name).join(", ")})`);
  const rows = trs.slice(1).filter(m => m[1] !== "tablesep");
  if (trs.slice(1).some(m => !/^(tablesep|row[01])$/.test(m[1]))) throw new Error("sziget-days: a grid row of an unknown kind");

  const n = cols.length, cover = new Array(n).fill(0), sets = [], bills = [];
  let last = -1, wrapped = false;
  for (const [ri, [, , body]] of rows.entries()) {
    const t = /^\s*<td class="time" valign="middle">([^<]*)<\/td>/.exec(body);
    if (!t || !HHMM.test(t[1].trim())) throw new Error(`sziget-days: grid row ${ri + 1} prints no start time`);
    const [, h, mi] = HHMM.exec(t[1].trim()), start = `${pad(+h)}:${mi}`;
    let v = +h * 60 + +mi;
    // The one wrap past midnight: a morning time after an evening one.
    if (!wrapped && last >= 0 && v < last) { if (v >= 12 * 60) throw new Error(`sziget-days: the row at ${start} is not after the row above`); wrapped = true; }
    if (wrapped) v += 1440;
    if (v <= last) throw new Error(`sziget-days: the row at ${start} is not after the row above`);
    last = v;
    const cells = [...body.slice(t[0].length).matchAll(/<td( class="prprogramcellaures")?( rowspan="(\d+)")?>([\s\S]*?)<\/td>/g)];
    if (body.slice(t[0].length).replace(/<td[\s\S]*?<\/td>/g, "").trim()) throw new Error(`sziget-days: the row at ${start} holds something other than cells`);
    let ci = 0;
    for (let col = 0; col < n; col++) {
      if (cover[col] > 0) { cover[col]--; continue; }
      const c = cells[ci++];
      if (!c) throw new Error(`sziget-days: the row at ${start} has no cell for ${cols[col].name}`);
      if (c[1]) { if (c[2] || plain(c[4])) throw new Error(`sziget-days: an empty cell at ${start} on ${cols[col].name} prints something`); continue; }
      const span = +c[3];
      if (!(span >= 1) || ri + span > rows.length) throw new Error(`sziget-days: the set at ${start} on ${cols[col].name} spans ${c[3]} rows past the grid`);
      // A cell is one programme entry (one #p id). Most name one act; a
      // night's bill names several under the entry's one start (2011's Burn
      // Party Arena: "Richie Hawtin (CAN) pres. … / Marc Houle (CAN) live /
      // …"), which gives none of them a time of its own: it is returned as a
      // bill, never as sets.
      const links = [...c[4].matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>/g)];
      const refs = new Set(links.map(l => unent(l[1])));
      if (!links.length || refs.size !== 1 || plain(c[4].replace(/<a [\s\S]*?<\/a>/g, ""))) throw new Error(`sziget-days: the entry at ${start} on ${cols[col].name} is not one linked programme entry`);
      const st = /\/programs\/helyszin\/[^/"]+\.(\d+)\.html#p\d+$/.exec([...refs][0])?.[1];
      const lines = links.flatMap(l => l[2].split(/<\/?p[^>]*>|<br\s*\/?>/i).map(plain).filter(Boolean));
      if (st !== cols[col].id) throw new Error(`sziget-days: "${lines.join(" / ")}" at ${start} links to stage ${st}, its column is ${cols[col].name} (${cols[col].id})`);
      if (!lines.length) throw new Error(`sziget-days: the entry at ${start} on ${cols[col].name} names no act`);
      if (lines.length > 1) bills.push({ stage: cols[col].name, start, lines, printed: start, rows: span });
      else sets.push({ stage: cols[col].name, start, end: "", artist: lines[0], openEnd: true, printed: start, rows: span, at: v });
      cover[col] = span - 1;
    }
    if (ci !== cells.length) throw new Error(`sziget-days: the row at ${start} has ${cells.length - ci} cell(s) left over`);
  }
  if (cover.some(x => x > 0)) throw new Error("sziget-days: a set spans past the grid");
  return { title, template, date, label, tabs: tabs.map(t => t.label), tabDates: tabs.map(t => t.date), stages: cols.map(s => s.name),
    stageIds: cols.map(s => s.id), unshown: picker.filter(p => !p.checked).map(p => p.name), venues, rows: rows.length, sets, bills };
}
