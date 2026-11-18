// shambhala-webflow-schedule.mjs — Shambhala's official set-times pages for
// 2024 and 2025 (shambhalamusicfestival.com/set-times/<weekday>, a Webflow
// page, one page per day), read from an archived capture. Format
// "shambhala-webflow".
//
// A page prints one day: its weekday in its title ("Set Times - Friday |
// Shambhala Music Festival 2023", the year a stale template's) and as the
// active day tab (<a href=".../set-times/friday" aria-current="page">), and
// no date. The year it was made in is its own "Last Published:" stamp; the
// date comes from the festival's dated announcement (see datesFromPost).
// The grid:
//   - an hour axis, <div class="time-column"> of <div class="time-marker">10
//     am</div> …, one label an hour from 10 AM;
//   - one column per stage, <div class="playing-times-column [slug]">, named
//     by its heading (<h2 class="stage-heading">Secret Garden</h2>) or its
//     logo's alt (<img alt="The Pagoda stage" class="stage-logo-set">, the
//     word "stage" describing the image, not the name);
//   - in each column, one block per set, <div class="playing-time w-dyn-item"
//     style="top: Npx; min-height: Hpx;">, holding the range three ways: the
//     24-hour clock as data (data-start="22:30"), the printed time ("10:30
//     pm") and the block's place on the axis (top = minutes after the axis
//     starts, at the page's own pixels per hour, rounded down; min-height =
//     length minus 2 px). The act is <h3 class="pt-artist">.
// A block whose three readings disagree, or two different acts drawn in one
// stage's same slot (2024's "P Money x Whiney" and "P Monay x Whiney"), come
// back in `misprints`, never as sets. The same block drawn more than once
// (the CMS repeats a showcase once per performer) is one set, counted in
// `repeats`. A block whose act is printed only as question marks (a mystery
// set) names no act: it comes back in `unnamed`. A set starting before 10 AM
// is the day's night.
//
// A logo's alt can name the wrong stage (2025's Secret Garden column carries
// the Village logo's alt). A column whose name repeats another column's is a
// page error, unless the caller names it with `stageByLogo` ({"secret-garden":
// "Secret Garden"}): the column's class and its logo's file name must both be
// that name's slug.

const ENT = { "&amp;": "&", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&nbsp;": " ", "&#8217;": "’", "&lt;": "<", "&gt;": ">" };
const unent = s => s.replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// "22:30" → minutes; null unless a 24-hour clock time.
const clock24 = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
// "10:30 pm" → minutes; null unless a 12-hour clock time with am/pm.
const clock12 = t => { const m = /^(\d{1,2}):(\d{2}) ?([ap]m)$/i.exec(String(t).trim()); return m && +m[1] >= 1 && +m[1] <= 12 && +m[2] < 60 ? (+m[1] % 12 + (m[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + +m[2] : null; };
// "10 am", "12 PM", "1 Pm" → minutes; null otherwise.
const hourLabel = t => { const m = /^(\d{1,2}) ?([ap]m)$/i.exec(String(t).trim()); return m && +m[1] >= 1 && +m[1] <= 12 ? (+m[1] % 12 + (m[2].toLowerCase() === "pm" ? 12 : 0)) * 60 : null; };

// The festival's dated announcement prints its run, Friday to Monday: "July
// 26-29, 2024" or "July 25th to 28th, 2025". Returns the four set-times days,
// Thursday (the night before the stated run) to Sunday (its night runs into
// the stated Monday), as { Thursday: "2024-07-25", … }, or null unless the run
// is printed for `year`, starts on a Friday and ends on the Monday after.
export function datesFromPost(printed, year) {
  const m = /^([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: ?- ?| to )(\d{1,2})(?:st|nd|rd|th)?, (\d{4})$/.exec(String(printed || "").trim());
  const mo = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (mo < 0 || +m[4] !== year) return null;
  const first = Date.UTC(year, mo, +m[2]), last = Date.UTC(year, mo, +m[3]);
  if (new Date(first).getUTCMonth() !== mo || new Date(first).getUTCDate() !== +m[2] || new Date(last).getUTCDate() !== +m[3]) return null;
  if (new Date(first).getUTCDay() !== 5 || last - first !== 3 * 864e5) return null;
  const at = k => new Date(first + k * 864e5).toISOString().slice(0, 10);
  return { Thursday: at(-1), Friday: at(0), Saturday: at(1), Sunday: at(2) };
}

// The festival's dated announcement, a post on its own blog: every run it
// prints for `year` ("July 26-29, 2024", "July 25th to 28th, 2025") must name
// the same days. Returns { printed, runs, days } (days as datesFromPost).
export function readDatesPost(html, year) {
  const text = plain(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "));
  const runs = [...text.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(?:st|nd|rd|th)?(?: ?- ?| to )\d{1,2}(?:st|nd|rd|th)?, (\d{4})\b/g)]
    .filter(m => +m[1] === year).map(m => m[0]);
  if (!runs.length) throw new Error(`the post prints no run of days in ${year}`);
  const read = runs.map(r => datesFromPost(r, year));
  if (read.some(d => !d)) throw new Error(`the post prints "${runs[read.findIndex(d => !d)]}", not a Friday-to-Monday run in ${year}`);
  if (new Set(read.map(d => JSON.stringify(d))).size !== 1) throw new Error(`the post prints runs that disagree: ${runs.join(" / ")}`);
  return { printed: runs[0], runs: runs.length, days: read[0] };
}

export function parseShambhalaWebflow(html, { year, stageByLogo = {} } = {}) {
  if (!year) throw new Error("no year");
  const title = /<title>Set Times - ([A-Za-z]+) \| Shambhala Music Festival(?: \d{4})?<\/title>/.exec(html);
  if (!title || !WEEKDAYS.includes(title[1])) throw new Error(`the title names no weekday: ${/<title>[^<]*<\/title>/.exec(html)?.[0]}`);
  const weekday = title[1];
  const tab = [...html.matchAll(/<a href="[^"]*\/set-times\/([a-z]+)"[^>]*aria-current="page"[^>]*>/g)].map(m => m[1]);
  if (!tab.length || tab.some(t => t !== weekday.toLowerCase())) throw new Error(`${weekday}: the active day tab is ${tab.join(", ") || "none"}`);
  const pub = /Last Published: ([A-Z][a-z]{2}) ([A-Z][a-z]{2}) (\d{2}) (\d{4}) (\d{2}:\d{2}:\d{2})/.exec(html);
  if (!pub) throw new Error(`${weekday}: no "Last Published" stamp`);
  const published = new Date(`${pub[2]} ${pub[3]}, ${pub[4]} ${pub[5]} UTC`).toISOString().slice(0, 10);
  if (+pub[4] !== year) throw new Error(`${weekday}: last published ${published}, not in ${year}`);

  // The hour axis, one label an hour.
  const axisAt = html.indexOf('<div class="time-column">');
  const gridAt = html.indexOf('<div class="playing-times-grid">', axisAt);
  if (axisAt < 0 || gridAt < 0) throw new Error(`${weekday}: no timetable`);
  const hours = [...html.slice(axisAt, gridAt).matchAll(/<div class="time-marker[^"]*">([^<]*)<\/div>/g)].map(m => hourLabel(m[1]));
  if (hours.length < 2 || hours.some(h => h === null) || hours.some((h, i) => i && (h - hours[i - 1] + 1440) % 1440 !== 60))
    throw new Error(`${weekday}: the hour axis does not read hour by hour`);
  const axisStart = hours[0], axisEnd = axisStart + (hours.length - 1) * 60;
  if (axisStart !== 600) throw new Error(`${weekday}: the axis starts at ${hhmm(axisStart)}, not 10:00`);

  const grid = html.slice(gridAt);
  const cols = [...grid.matchAll(/<div class="playing-times-column(?: ([\w-]+))?">/g)];
  if (!cols.length) throw new Error(`${weekday}: no stage columns`);
  const named = cols.map((c, i) => {
    const body = grid.slice(c.index + c[0].length, i + 1 < cols.length ? cols[i + 1].index : undefined);
    const head = body.slice(0, body.indexOf('<div class="playing-times w-dyn-list">') >>> 0);
    const h2 = /<h2 class="stage-heading">([\s\S]*?)<\/h2>/.exec(head);
    const img = /<img src="([^"]*)"[^>]*\balt="([^"]*)" class="stage-logo-set[^"]*">/.exec(head);
    const name = h2 ? plain(h2[1]) : img ? plain(img[2]).replace(/ stage$/i, "") : "";
    return { cls: c[1] || "", logo: img ? decodeURIComponent(img[1].split("/").pop()) : "", name, body };
  });
  for (const col of named) {
    const as = stageByLogo[col.cls];
    if (as) {
      // The column's class and logo file both spell the name it is given.
      const want = slug(as);
      if (col.cls !== want || !slug(col.logo.replace(/_/g, "-")).includes(want)) throw new Error(`${weekday}: column "${col.cls}" (logo ${col.logo}) is not ${as}`);
      col.printedAs = col.name; col.name = as;
    }
    if (!col.name) throw new Error(`${weekday}: column "${col.cls}" is named nothing`);
  }
  const counts = named.reduce((m, c) => m.set(c.name, (m.get(c.name) || 0) + 1), new Map());
  for (const [n, k] of counts) if (k > 1) throw new Error(`${weekday}: ${k} columns are named "${n}" (${named.filter(c => c.name === n).map(c => c.cls || "-").join(", ")})`);

  const sets = [], misprints = [], repeats = [], unnamed = [], stages = [], blank = [];
  const span = hours.length * 60;            // the last label's hour runs to the grid's end
  const columns = [];
  for (const col of named) {
    // A block's act is its one visible name; a name the page hides
    // (w-condition-invisible, the CMS item's own performer) is not printed.
    const blocks = [...col.body.matchAll(/<div role="listitem" class="playing-time w-dyn-item" style="([^"]*)">([\s\S]*?)<div class="pt-body">((?:<h3 class="pt-artist[^"]*">[^<]*<\/h3>)+)<\/div><\/div>/g)]
      .map(m => { const shown = [...m[3].matchAll(/<h3 class="pt-artist">([^<]*)<\/h3>/g)]; return [m[0], m[1], m[2], shown.length === 1 ? shown[0][1] : null]; });
    if (blocks.length !== (col.body.match(/class="playing-time w-dyn-item"/g) || []).length || blocks.some(b => b[3] === null)) throw new Error(`${weekday} ${col.name}: a block does not read as one shown name`);
    if (!blocks.length) { blank.push(col.name); continue; }
    stages.push(col.name);
    const read = [];
    for (const b of blocks) {
      const artist = plain(b[3]), where = `${weekday} ${col.name} "${artist}"`;
      const top = +(/top: ([\d.]+)px/.exec(b[1])?.[1] ?? NaN), height = +(/min-height: ([\d.]+)px/.exec(b[1])?.[1] ?? NaN);
      const ds = /<div data-start="([^"]*)" class="time">([^<]*)<\/div>/.exec(b[2]), de = /<div data-end="([^"]*)" class="time">([^<]*)<\/div>/.exec(b[2]);
      if (!ds || !de || Number.isNaN(top) || Number.isNaN(height)) throw new Error(`${where}: a block with no range or place`);
      const printed = `${plain(ds[2])} - ${plain(de[2])}`;
      const s = clock24(ds[1]), e = clock24(de[1]);
      if (s === null || e === null) throw new Error(`${where}: cannot read the range "${ds[1]}-${de[1]}"`);
      const a = (s - axisStart + 1440) % 1440, z = (e - axisStart + 1440) % 1440 || 1440;
      const set = { stage: col.name, start: hhmm(s), end: hhmm(e), artist, printed, a, z, top, height };
      if (/^[?\s]*$/.test(artist.replace(/\bB2B\b/gi, ""))) { unnamed.push(set); continue; }
      if (clock12(ds[2]) !== s || clock12(de[2]) !== e) set.misprint = `the printed time "${printed}" is not its data (${ds[1]}-${de[1]})`;
      else if (z <= a || z > span) set.misprint = "the range does not run forward on the page's axis";
      read.push(set);
    }
    columns.push(read);
  }
  // The page's own scale, from its first readable block after 10 AM: every
  // block's place and height must fall on it.
  const first = columns.flat().find(x => !x.misprint && x.a > 0);
  if (!first) throw new Error(`${weekday}: no block to read the page's scale off`);
  const pxPerHour = Math.round(first.top / first.a * 60 * 100) / 100, k = pxPerHour / 60;
  for (const read of columns) {
    for (const x of read) {
      if (x.misprint) continue;
      if (!(x.top >= Math.floor(x.a * k) - 0.01 && x.top <= x.a * k + 0.01)) x.misprint = `the block is drawn at ${x.top}px, not ${x.a * k}px`;
      else if (Math.abs(x.height - ((x.z - x.a) * k - 2)) > 0.01) x.misprint = `the block is drawn ${x.height}px tall, not ${(x.z - x.a) * k - 2}px`;
    }
    // One slot, one act: the same block drawn twice is one set; two acts in
    // one slot, or overlapping slots, are misprints.
    const seen = new Map(), kept = [];
    for (const x of read) {
      const key = `${x.a}|${x.z}|${x.artist}`;
      if (seen.has(key)) { repeats.push(x); continue; }
      seen.set(key, x); kept.push(x);
    }
    kept.sort((p, q) => p.a - q.a || p.z - q.z);
    for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length && kept[j].a < kept[i].z; j++) {
      const p = kept[i], q = kept[j];
      p.misprint ??= `drawn while "${q.artist}" (${q.printed}) is on`;
      q.misprint ??= `drawn while "${p.artist}" (${p.printed}) is on`;
    }
    for (const { a, z, top, height, misprint, ...x } of kept) (misprint ? misprints.push({ ...x, misprint }) : sets.push(x));
  }
  if (!sets.length) throw new Error(`${weekday}: no sets`);
  if (pxPerHour !== 70) throw new Error(`${weekday}: drawn at ${pxPerHour}px an hour, not the 70 every Shambhala 2024-2025 page uses`);
  const strip = ({ a, z, top, height, ...x }) => x;
  return { weekday, published, axis: `${hhmm(axisStart)}-${hhmm(axisEnd)}`, pxPerHour, stages, blank,
    renamed: named.filter(c => c.printedAs !== undefined).map(c => ({ column: c.cls, printed: c.printedAs, as: c.name })),
    sets, misprints, repeats: repeats.map(strip), unnamed: unnamed.map(strip) };
}
