// shambhala-schedule.mjs — Shambhala Music Festival's official schedule page
// (shambhalamusicfestival.com, 2011-2016: /2011-schedule/ … /2016-schedule/,
// /schedule-2014/), read from an archived capture. Format "shambhala-table".
//
// The page prints a row of day tabs (<ul class="tabs"> 2011-2013,
// <ul class="tabList"> 2014-2016: "Thursday" … "Sunday", no date), then one
// <table id="schedule_table"> per tab, in the same order. A table's header
// names the stages (<th id="Pagoda_head">Pagoda</th>); each row is a
// 30-minute slot whose time cell is <td id="time_T">12:00PM</td> (half hours
// print "12:30"), T being the slot's wall time written as a UTC epoch. Each
// stage cell is <td id="pagoda_T" class="…">: a block starts in a cell whose
// class has "top" and ends in one with "bottom"; "open" blocks are sets,
// "closed" blocks print CLOSED, and a bare "top" block is empty.
//
// A set is the billing printed in its block's first cell and the start
// printed under it (<span class="little">10:45PM</span>), which carries its
// own am/pm and must fall inside that cell's half hour. The page prints no
// end time (a block's length is only a 30-minute rounding), so every set is
// open-ended. The day's date is its first slot's, and the tab must name its
// weekday.
//
// A table's last row is the next table's first slot printed again (the same
// T): a set starting there is the next day's first set, and must be printed
// there too. It comes back in `overlap`, never as a set.

const ENT = { "&amp;": "&", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&nbsp;": " ", "&#8217;": "’", "&#8216;": "‘", "&#8211;": "–", "&#8220;": "“", "&#8221;": "”" };
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;

// "10:45PM" → minutes after midnight; null if not a clock time with am/pm.
export function clock(t) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(String(t).trim());
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) return null;
  return (+m[1] % 12 + (m[3].toUpperCase() === "P" ? 12 : 0)) * 60 + +m[2];
}

// The slot's own label: "12:00PM" on the hour, "12:30" on the half hour.
export function slotLabel(min) {
  const h12 = Math.floor(min / 60) % 12 || 12, m = min % 60;
  return m === 0 ? `${h12}:00${min >= 720 ? "PM" : "AM"}` : `${h12}:${pad(m)}`;
}

// A billing that continues the block above it.
const CONTINUES = /^(?:&|vs\.?|ft\.?|feat\.?)\s/i;
// A range printed inside a billing: "Opiuo (1-2:15am)", "(11:40pm-1am)".
const RANGE = /\s*\((\d{1,2})(?::(\d{2}))?(?:\s*([ap])m)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*([ap])m\)\s*$/i;
const circ = (a, b) => { const d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); };

// A billing that prints its own range is read by it: the range is the more
// exact printing (the start under the block is its half hour's). The start's
// am/pm, when the range prints only the end's, is the one reading within 30
// minutes of the block's own start; any other range is not read.
export function withRange(set, blockStart, where) {
  const m = RANGE.exec(set.artist);
  if (!m) return set;
  const mer = (h, mm, ap) => ((+h % 12) + (ap.toLowerCase() === "p" ? 12 : 0)) * 60 + +(mm || 0);
  const end = mer(m[4], m[5], m[6]);
  const starts = (m[3] ? [mer(m[1], m[2], m[3])] : [mer(m[1], m[2], "a"), mer(m[1], m[2], "p")]).filter(v => circ(v, blockStart) <= 30);
  if (starts.length !== 1) throw new Error(`${where}: "${set.artist}" prints a range ${starts.length ? "two starts" : "no start"} near its block's ${hhmm(blockStart)} could mean`);
  const len = (end - starts[0] + 1440) % 1440;
  if (!len || len > 360) throw new Error(`${where}: "${set.artist}" prints a range of ${len} minutes`);
  return { ...set, artist: set.artist.slice(0, m.index).trim(), start: hhmm(starts[0]), end: hhmm(end), openEnd: false, printedRange: m[0].trim() };
}

const CLASS_TOKENS = new Set(["open", "closed", "top", "bottom"]);

function readTable(seg, where) {
  const heads = h => [...h.matchAll(/<th [^>]*id="([^"]+)_head"[^>]*>([\s\S]*?)<\/th>/g)]
    .filter(m => m[1] !== "time").map(m => ({ id: m[1], name: plain(m[2]) }));
  const thead = /<thead>([\s\S]*?)<\/thead>/.exec(seg);
  if (!thead) throw new Error(`${where}: no table head`);
  const stages = heads(thead[1]);
  if (!stages.length) throw new Error(`${where}: no stage headings`);
  for (const s of stages) if (s.id !== s.name) throw new Error(`${where}: heading id "${s.id}" prints "${s.name}"`);
  const body = seg.slice(seg.indexOf("<tbody>"));
  // The head row is printed again every few hours inside the body; each
  // repeat must name the same stages in the same order, and is no slot.
  const trs = [...body.matchAll(/<tr[^>]*>([\s\S]*?)(?=<tr[\s>]|<\/tbody>|$)/g)].map(m => m[1]);
  const slotRows = trs.filter(r => {
    if (!/<th /.test(r)) return true;
    if (JSON.stringify(heads(r)) !== JSON.stringify(stages)) throw new Error(`${where}: a repeated head row names other stages`);
    return false;
  });
  const rows = slotRows.map(r => [null, r]).map((r, i) => {
    const cells = [...r[1].matchAll(/<td id="([a-z0-9]+)_(\d+)"(?: class="([^"]*)")?>([\s\S]*?)<\/td>/g)];
    if (cells[0]?.[1] !== "time") throw new Error(`${where}: row ${i + 1} has no time cell`);
    const T = +cells[0][2], wall = new Date(T * 1000), min = wall.getUTCHours() * 60 + wall.getUTCMinutes();
    if (plain(cells[0][4]) !== slotLabel(min)) throw new Error(`${where}: row ${i + 1} prints "${plain(cells[0][4])}", its slot is ${slotLabel(min)}`);
    const rest = cells.slice(1);
    if (rest.length !== stages.length) throw new Error(`${where}: row ${i + 1} has ${rest.length} stage cells, ${stages.length} stages`);
    return { T, min, date: wall.toISOString().slice(0, 10), cells: rest.map((c, j) => {
      const key = stages[j].id.replace(/\s+/g, "").toLowerCase();
      if (c[1] !== key || +c[2] !== T) throw new Error(`${where}: row ${i + 1} cell ${j + 1} is "${c[1]}_${c[2]}", not ${key}_${T}`);
      const cls = new Set((c[3] || "").split(/\s+/).filter(Boolean));
      for (const k of cls) if (!CLASS_TOKENS.has(k)) throw new Error(`${where}: row ${i + 1} ${stages[j].name}: class "${k}"`);
      if (cls.has("open") && cls.has("closed")) throw new Error(`${where}: row ${i + 1} ${stages[j].name}: open and closed`);
      return { cls, body: c[4] };
    }) };
  });
  if (!rows.length) throw new Error(`${where}: no rows`);
  rows.forEach((r, i) => { if (i && r.T - rows[i - 1].T !== 1800) throw new Error(`${where}: row ${i + 1} is not 30 minutes after row ${i}`); });
  return { stages: stages.map(s => s.name), rows };
}

export function parseShambhala(html, { year } = {}) {
  if (!/^\d{4}$/.test(String(year))) throw new Error(`year "${year}"`);
  const nav = /<ul class="(?:tabs|tabList)">([\s\S]*?)<\/ul>/.exec(html);
  if (!nav) throw new Error("no day tabs");
  const labels = [...nav[1].matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map(m => plain(m[1]));
  const at = [...html.matchAll(/<table [^>]*id="schedule_table"[^>]*>/g)].map(m => m.index);
  if (!labels.length || labels.length !== at.length) throw new Error(`${labels.length} day tabs, ${at.length} schedule tables`);
  const tables = at.map((a, i) => {
    const end = html.indexOf("</table>", a);
    if (end < 0) throw new Error(`table ${i + 1} is not closed`);
    return readTable(html.slice(a, end), labels[i]);
  });
  const days = tables.map((t, i) => {
    const label = labels[i], date = t.rows[0].date;
    if (!WEEKDAYS.includes(label)) throw new Error(`day tab "${label}" is not a weekday`);
    if (WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()] !== label) throw new Error(`day tab "${label}": its table starts on ${date}`);
    if (+date.slice(0, 4) !== +year) throw new Error(`day tab "${label}": ${date} is not in ${year}`);
    const next = tables[i + 1], lastIsNext = next && t.rows.at(-1).T === next.rows[0].T;
    const sets = [], overlap = [];
    let closed = 0, empty = 0;
    const joined = [];
    t.stages.forEach((stage, j) => {
      let inBlock = null, prev = null;
      t.rows.forEach((r, k) => {
        const { cls, body } = r.cells[j], b = body.trim(), w = `${label} ${stage} ${slotLabel(r.min)}`;
        if (cls.has("top")) {
          // A new block's first cell ends the one before: the page does not
          // always print a block's last cell ("bottom").
          inBlock = cls.has("open") ? "open" : cls.has("closed") ? "closed" : "bare";
        } else if (inBlock && (cls.has("open") ? "open" : cls.has("closed") ? "closed" : "bare") !== inBlock) {
          throw new Error(`${w}: a ${inBlock} block continues as "${[...cls].join(" ")}"`);
        } else if (!inBlock && cls.size) {
          throw new Error(`${w}: "${[...cls].join(" ")}" outside a block`);
        }
        if (!cls.has("top")) { if (b) throw new Error(`${w}: prints "${plain(b)}" inside a block`); }
        else if (inBlock === "bare") { if (plain(b)) throw new Error(`${w}: an empty block prints "${plain(b)}"`); empty++; prev = null; }
        else if (inBlock === "closed") { if (plain(b) !== "CLOSED") throw new Error(`${w}: a closed block prints "${plain(b)}"`); closed++; prev = null; }
        else {
          const little = [...b.matchAll(/<span class="little">([\s\S]*?)<\/span>/g)];
          if (little.length !== 1) throw new Error(`${w}: a set prints ${little.length} start times`);
          const printed = plain(little[0][1]), start = clock(printed);
          const artist = plain(b.slice(0, little[0].index) + b.slice(little[0].index + little[0][0].length));
          if (!artist) throw new Error(`${w}: a set with no billing`);
          if (start == null) throw new Error(`${w}: "${artist}" prints start "${printed}"`);
          if (start < r.min || start >= r.min + 30) throw new Error(`${w}: "${artist}" prints ${printed}, outside its half hour`);
          let set = { stage, start: hhmm(start), end: "", artist, openEnd: true, printed, at: start };
          // A billing split over two blocks ("Deeps", then "vs. Wakcutt
          // (12-1:30pm)"): the second continues the first, directly above it.
          if (CONTINUES.test(artist)) {
            // prev is the column's last block when that block is a set.
            if (!prev) throw new Error(`${w}: "${artist}" continues no set directly above it`);
            const into = prev.set;
            joined.push({ stage, artist, printed, joinedTo: into.artist });
            Object.assign(into, withRange({ ...into, artist: `${into.artist} ${artist}`, start: into.start, end: "", openEnd: true }, into.at, w));
            prev = { set: into };
            if (cls.has("bottom")) inBlock = null;
            return;
          }
          set = withRange(set, start, w);
          if (lastIsNext && k === t.rows.length - 1) {
            const n = next.rows[0].cells[next.stages.indexOf(stage)];
            const again = n && n.cls.has("open") && n.cls.has("top") && n.body.trim() === b;
            if (!again) throw new Error(`${w}: "${artist}" starts in the row the next table starts with, and the next table does not print it there`);
            overlap.push(set);
          } else { sets.push(set); prev = { set }; }
        }
        if (cls.has("bottom")) inBlock = null;
      });
      // A block left open at the table's end runs past the page's last slot.
    });
    const clean = x => { const { at, ...y } = x; return y; };
    return { label, weekday: label, date, firstSlot: `time_${t.rows[0].T}`, stages: t.stages, sets: sets.map(clean), overlap: overlap.map(clean), joined, closed, empty,
      axis: `${slotLabel(t.rows[0].min)} … ${slotLabel(t.rows.at(-1).min)}`, slots: t.rows.length, lastRowRepeatsNext: !!lastIsNext };
  });
  return { days };
}
