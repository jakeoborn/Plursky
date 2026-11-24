// hard-wp-schedule.mjs — HARD Summer's own 2012 home page (hardfest.com/
// hardsummer/), read from an archived capture. Format "hard-wp".
//
// One WordPress page prints both days. Each day is a block
// <div class="friday-sets sets"><h1>FRIDAY</h1>, then an hour grid of
// half-hour labels with their own am or pm, latest first ("1:30am" down to
// "5:00pm"), then one column per stage (<!-- FRIDAY HARD STAGE --> <div
// class="stage hard"><h2 class="stage-name">Hard Stage</h2>), latest set first.
// Each set is drawn as a block whose height is its length and whose top margin
// is the time since the set drawn above it started:
//   <div class="settime" style="margin-top: 40px; height: 120px;"> … <span
//   class="artist-name">BLOC PARTY</span> … <span class="artist-time">11:30 -
//   12:30</span></div>
// A range prints no am or pm: each time is the one reading inside the day's
// grid. The headings print no date: the date of each is the run the page's own
// essential info prints ("Friday, August 3rd & Saturday, August 4th, 2012").
//
// The drawing must agree with every printed range: a block whose height is not
// its length, or that is drawn at a place its column's other blocks do not put
// it (two blocks drawn in each other's place), comes back in `misprints`, never
// as a set, as does a range that runs backwards, over eight hours, or across
// another set on its stage. A column may sit a little high or low on the grid
// (2012's Saturday OWSLA Tent is drawn ten minutes high); that moves no printed
// time and is recorded as the column's top.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ENT = { "&amp;": "&", "&nbsp;": " ", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&rsquo;": "’", "&lsquo;": "‘", "&#8217;": "’", "&#8216;": "‘", "&ndash;": "–", "&#8211;": "–", "&mdash;": "—", "&hellip;": "…", "&lt;": "<", "&gt;": ">" };
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();
const NIGHT = 6 * 60;
const iso = (y, mo, d) => `${y}-${pad(mo)}-${pad(d)}`;
const weekdayOf = date => WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()];

// The run the page prints, "Friday, August 3rd & Saturday, August 4th, 2012",
// as { FRIDAY: "2012-08-03", SATURDAY: "2012-08-04" }; null unless it is two
// consecutive days of `year`, each on its own weekday.
export function readRun(text, year) {
  const m = /([A-Z][a-z]+day), ([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th) & ([A-Z][a-z]+day), ([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th), (\d{4})/.exec(String(text || ""));
  if (!m || +m[7] !== year) return null;
  const out = {};
  for (const [wd, mon, d] of [[m[1], m[2], m[3]], [m[4], m[5], m[6]]]) {
    const mo = MONTHS.indexOf(mon.toLowerCase()) + 1, date = iso(year, mo, +d);
    if (!mo || new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date || weekdayOf(date) !== wd.toLowerCase()) return null;
    out[wd.toUpperCase()] = date;
  }
  const [a, b] = Object.values(out);
  return Object.keys(out).length === 2 && Date.parse(b) - Date.parse(a) === 864e5 ? out : null;
}

// "5:00pm" → minutes since the day's midnight, a time before 6 AM the night's.
const clock = s => {
  const m = /^(\d{1,2}):(\d{2})(am|pm)$/.exec(s);
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) return null;
  const v = (+m[1] % 12 + (m[3] === "pm" ? 12 : 0)) * 60 + +m[2];
  return v < NIGHT ? v + 1440 : v;
};

export function parseHardWp(html, { year } = {}) {
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
  if (!/^HARD Summer\b/.test(title)) throw new Error(`hard-wp: not a HARD Summer page (title "${title}")`);
  const runAt = plain(html).match(/Music is scheduled [^.]*?both days, ([^.]*?\d{4})\./);
  const run = runAt && readRun(runAt[1], year);
  if (!run) throw new Error(`hard-wp: the page prints no two-day run of ${year} ("${runAt?.[1] ?? ""}")`);
  const starts = [...html.matchAll(/<div class="(\w+)-sets sets">/g)];
  if (!starts.length) throw new Error("hard-wp: no day block");
  const days = starts.map((s, i) => {
    const raw = html.slice(s.index, starts[i + 1]?.index ?? html.length);
    const label = /<h1>\s*([A-Za-z]+)\s*<\/h1>/.exec(raw)?.[1];
    if (!label || label.toLowerCase() !== s[1]) throw new Error(`hard-wp: day block "${s[1]}" is headed "${label}"`);
    const date = run[label];
    if (!date) throw new Error(`hard-wp: ${label} is not a day the page's run prints (${Object.keys(run).join(", ")})`);
    // The grid, with commented-out labels left out.
    const live = raw.replace(/<!--(?![^>]*STAGE -->)[\s\S]*?-->/g, "");
    const labels = [...live.matchAll(/<div class="grid-section">\s*<span>([^<]*)<\/span>/g)].map(m => m[1].trim());
    const grid = labels.map(clock);
    if (grid.length < 2 || grid.some(v => v == null)) throw new Error(`hard-wp: ${label}'s grid prints "${labels.join(", ")}"`);
    grid.forEach((v, j) => { if (j && grid[j - 1] - v !== 30) throw new Error(`hard-wp: ${label}'s grid skips from ${labels[j - 1]} to ${labels[j]}`); });
    const lo = grid.at(-1), hi = grid[0] + 30;
    // One reading of "h:mm" inside the grid.
    const read = s => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(s);
      if (!m) return null;
      const r = ["am", "pm"].map(x => clock(`${m[1]}:${m[2]}${x}`)).filter(v => v != null && v >= lo && v <= hi);
      return r.length === 1 ? r[0] : null;
    };
    const cols = [...live.matchAll(/<!-- ([A-Z]+) ([A-Z ]+?) STAGE -->\s*<div class="stage ([a-z0-9-]+)">\s*<h2 class="stage-name">([\s\S]*?)<\/h2>/g)];
    if (!cols.length) throw new Error(`hard-wp: ${label} prints no stage`);
    const stages = [], sets = [], misprints = [], tops = {};
    let ratio = null;
    const blocks = cols.map((c, j) => {
      if (c[1] !== label) throw new Error(`hard-wp: a ${c[1]} stage inside ${label}'s block`);
      const stage = plain(c[4]);
      if (!stage) throw new Error(`hard-wp: a stage on ${label} with no name`);
      if (stages.includes(stage)) throw new Error(`hard-wp: stage "${stage}" printed twice on ${label}`);
      stages.push(stage);
      const body = live.slice(c.index + c[0].length, cols[j + 1]?.index ?? live.length);
      const heads = (body.match(/class="settime"/g) || []).length;
      const list = [...body.matchAll(/<div class="settime" style="margin-top: (\d+)px; height: (\d+)px;">([\s\S]*?)<\/div>/g)].map(b => {
        const names = [...b[3].matchAll(/<span class="artist-name">([\s\S]*?)<\/span>/g)], times = [...b[3].matchAll(/<span class="artist-time">([\s\S]*?)<\/span>/g)];
        if (names.length !== 1 || times.length !== 1) throw new Error(`hard-wp: a block on ${stage} prints ${names.length} name(s) and ${times.length} time(s)`);
        const artist = plain(names[0][1]), printed = plain(times[0][1]);
        const t = /^(\d{1,2}:\d{2}) - (\d{1,2}:\d{2})$/.exec(printed);
        const start = t && read(t[1]), end = t && read(t[2]);
        if (!artist) throw new Error(`hard-wp: a block on ${stage} with no act`);
        if (start == null || end == null) throw new Error(`hard-wp: ${artist} on ${stage} prints "${printed}", not a range inside ${label}'s grid`);
        return { stage, artist, printed, start, end, margin: +b[1], height: +b[2] };
      });
      if (list.length !== heads) throw new Error(`hard-wp: ${heads} blocks on ${stage} but ${list.length} read`);
      return list;
    });
    // The page's scale: the pixels per minute most blocks are drawn at.
    const count = new Map();
    for (const b of blocks.flat()) if (b.end > b.start) { const r = b.height / (b.end - b.start); count.set(r, (count.get(r) || 0) + 1); }
    ratio = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!ratio) throw new Error(`hard-wp: ${label} draws no set`);
    for (const list of blocks) {
      const stage = list[0]?.stage;
      if (!stage) continue;
      // Where each block's printed end puts the column's top; the top most of
      // its blocks agree on is the column's.
      let pos = 0;
      const implied = list.map(b => { pos += b.margin; const top = b.end + pos / ratio; pos += b.height; return top; });
      const n = new Map();
      for (const t of implied) n.set(t, (n.get(t) || 0) + 1);
      const [top, votes] = [...n].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      if (votes < 2 && list.length > 1) throw new Error(`hard-wp: no two blocks on ${stage} (${label}) agree where the column starts`);
      if (top < lo || top > hi) throw new Error(`hard-wp: ${stage} (${label}) is drawn from ${hhmm(top)}, off the grid`);
      tops[stage] = hhmm(top);
      const bad = new Map();
      list.forEach((b, j) => {
        if (b.end <= b.start) bad.set(b, "the range runs backwards");
        else if (b.end - b.start > 480) bad.set(b, "the range runs over eight hours");
        else if (b.height !== ratio * (b.end - b.start)) bad.set(b, `drawn ${b.height / ratio} minutes long`);
        else if (implied[j] !== top) bad.set(b, `drawn ${Math.abs(implied[j] - top)} minutes ${implied[j] > top ? "earlier" : "later"} than its column puts it`);
      });
      for (const a of list) for (const b of list) if (a !== b && !bad.has(a) && !bad.has(b) && a.start < b.end && b.start < a.end) { bad.set(a, "printed while another set on the stage is still on"); bad.set(b, "printed while another set on the stage is still on"); }
      for (const b of list) {
        const x = { stage, start: hhmm(b.start), end: hhmm(b.end), artist: b.artist, printed: b.printed };
        if (bad.has(b)) misprints.push({ ...x, misprint: bad.get(b) }); else sets.push({ ...x, at: b.start });
      }
    }
    sets.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || a.at - b.at);
    return { label, date, weekday: weekdayOf(date), axis: `${hhmm(lo)}-${hhmm(hi)}`, pxPerMinute: ratio, stages, columnTops: tops,
      sets: sets.map(({ at, ...x }) => x), misprints };
  });
  const seen = days.map(d => d.date);
  if (new Set(seen).size !== seen.length) throw new Error("hard-wp: a day printed twice");
  return { title, run: runAt[1], days };
}
