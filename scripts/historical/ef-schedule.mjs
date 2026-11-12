// ef-schedule.mjs — Electric Forest's official "Artist Schedule" page,
// electricforestfestival.com/set-times.php (2012 and 2013), read from an
// archived capture of its "All Days" view.
//
// The page prints a nav of day tabs ("Thursday - June 28th", no year), then
// one grid per day: <div class="set-stages"> names the day (<h5
// class="set-time-day">Thursday</h5>) and its stages in order (<h3
// class="stage-title stage-number-N">), then <div class="set-times"> holds a
// 15-minute axis (.time-marker, 49 px each with its border) and one
// <div class="stage-block stage-number-N"> per stage.
//
// A stage block holds artist blocks (<a|div class="artist-block ...">, each
// placed with "height: Hpx; top: Tpx"), each printing an artist and
// "6:45pm - 10:15pm". A "format" block (2013's curated "MOVEMENT CURATED EVENT", the
// Silent Disco's channels) holds an optional group title and several
// .artist-link entries, each its own set.
//
// A set is the printed artist and range. Each single artist block is checked
// against its place on the axis: its top must be its start and its height
// its length (49/15 px a minute, with the grid's fixed 2 px top and 5 px
// height insets), or the page is not read. That is what fixes am/pm across
// midnight. A range ending in "Close" or "??" is an open end. An entry whose
// times are not a range at all ("*Forest Stage Bar beginning at 2:30pm") is
// returned in `untimed`, never as a set; a single block whose height
// disagrees with its printed range is returned in `misprints`, never as a set.

const ENT = { "&amp;": "&", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&nbsp;": " ", "&#8217;": "’", "&#8211;": "–" };
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " / ").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PX_PER_MIN = 49 / 15, TOP_INSET = 2, HEIGHT_INSET = 5;

// "Thursday - June 28th" + 2012 → { weekday: "Thursday", date: "2012-06-28" };
// the printed weekday must be the date's own.
export function navDay(label, year) {
  const m = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) - ([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)$/.exec(label.trim());
  const mo = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
  if (!mo) return null;
  const date = `${year}-${String(mo).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()] !== m[1]) return null;
  return { weekday: m[1], date };
}

// "6:45pm" → minutes since midnight; null if not a clock time.
const clock = t => {
  const m = /^(\d{1,2}):(\d{2})(am|pm)$/i.exec(t.trim());
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) return null;
  return (+m[1] % 12 + (m[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + +m[2];
};
const hhmm = v => `${String(Math.floor(v / 60) % 24).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
const OPEN = /^(close|\?\?)$/i;

export function parseElectricForest(html, { year } = {}) {
  if (!/^\d{4}$/.test(String(year))) throw new Error(`year "${year}"`);
  const nav = /<ul class="page-nav set-times-nav">([\s\S]*?)<\/ul>/.exec(html);
  if (!nav) throw new Error("no set-times nav");
  if (!/<li class="first current">All Days<\/li>/.test(nav[1])) throw new Error("not the All Days view");
  const tabs = [...nav[1].matchAll(/<a [^>]*set-times\.php\?day=\d+[^>]*>([^<]+)<\/a>/g)].map(m => {
    const label = plain(m[1]), d = navDay(label, year);
    if (!d) throw new Error(`day tab "${label}": not a weekday and date in ${year}`);
    return { label, ...d };
  });
  const starts = [...html.matchAll(/<div class="set-stages">/g)].map(m => m.index);
  if (starts.length !== tabs.length) throw new Error(`${tabs.length} day tabs, ${starts.length} day grids`);
  const days = starts.map((at, i) => {
    const seg = html.slice(at, starts[i + 1] ?? html.length);
    const weekday = plain(/<h5 class="set-time-day">([\s\S]*?)<\/h5>/.exec(seg)?.[1] || "");
    const tab = tabs[i];
    if (weekday !== tab.weekday) throw new Error(`day grid ${i + 1} prints "${weekday}", its tab "${tab.label}"`);
    const stageNames = new Map([...seg.matchAll(/<h3 class="stage-title stage-number-(\d+)">([\s\S]*?)<\/h3>/g)].map(m => [m[1], plain(m[2])]));
    const marks = [...seg.matchAll(/<div class="time-marker" style="height: (\d+)px;">\s*<span>([^<]*)<\/span>/g)];
    if (!marks.length) throw new Error(`${tab.label}: no time axis`);
    if (marks.some(m => m[1] !== "48")) throw new Error(`${tab.label}: a time marker is not 48 px`);
    const axis0 = clock(marks[0][2]);
    if (axis0 == null) throw new Error(`${tab.label}: axis starts "${marks[0][2]}"`);
    // The axis labels run in 15-minute steps; each is the one before + 15.
    marks.forEach((m, k) => { if (clock(m[2]) !== (axis0 + 15 * k) % 1440) throw new Error(`${tab.label}: axis label ${k + 1} is "${m[2]}"`); });
    // Minutes on the festival night: anything before the axis start is after midnight.
    const night = v => (v < axis0 ? v + 1440 : v);
    const blocks = [...seg.matchAll(/<div class="stage-block stage-number-(\d+)">/g)];
    if (blocks.length !== stageNames.size) throw new Error(`${tab.label}: ${stageNames.size} stage headings, ${blocks.length} stage columns`);
    const sets = [], untimed = [], misprints = [];
    let placed = 0;
    blocks.forEach((b, j) => {
      const stage = stageNames.get(b[1]);
      if (!stage) throw new Error(`${tab.label}: stage column ${b[1]} has no heading`);
      const col = seg.slice(b.index, blocks[j + 1]?.index ?? seg.length);
      // An artist block runs to the next one (or the column's end): a group
      // block nests links and spacer divs, so its own closing tag is not used.
      const opens = [...col.matchAll(/<(?:a|div) [^>]*class="artist-block([^"]*)"[^>]*>/g)];
      const items = opens.map((o, k) => {
        const pos = /style="height: (\d+(?:\.\d+)?)px; top: (\d+(?:\.\d+)?)px;"/.exec(o[0]);
        if (!pos) throw new Error(`${tab.label} ${stage}: an artist block has no place on the axis`);
        return [o[0], o[1], pos[1], pos[2], col.slice(o.index + o[0].length, opens[k + 1]?.index ?? col.length)];
      });
      for (const it of items) {
        const body = it[4], group = /<span class="group-title">([\s\S]*?)<\/span>/.exec(body);
        const entries = [...body.matchAll(/<span class="artist-title[^"]*">([\s\S]*?)<\/span>\s*<span class="artist-times">([\s\S]*?)<\/span>/g)];
        if (!entries.length) throw new Error(`${tab.label} ${stage}: an artist block prints no artist`);
        // Several entries only in a "format" block (a curated group, or 2013's
        // Silent Disco channels), each its own link with its own range.
        if (entries.length > 1 && !/\bformat\b/.test(it[1])) throw new Error(`${tab.label} ${stage}: a plain artist block prints ${entries.length} artists`);
        const read = entries.map(e => {
          const artist = plain(e[1]), printed = plain(e[2]);
          const [a, z, ...rest] = printed.split(/\s+-\s+/);
          const start = clock(a || ""), end = clock(z || ""), open = OPEN.test((z || "").trim());
          if (start == null || rest.length || (end == null && !open)) return { stage, artist, printed, untimed: true };
          const s = night(start);
          let e2 = end == null ? null : night(end);
          if (e2 != null && e2 <= s) throw new Error(`${tab.label} ${stage}: "${artist}" prints ${printed}, which ends before it starts`);
          return { stage, artist, printed, s, e: e2, start: hhmm(start), end: end == null ? "" : hhmm(end), ...(open && { openEnd: true }),
            ...(group && { group: plain(group[1]) }) };
        });
        // A single artist block sits on the axis at its own start and length.
        const first = read.find(r => !r.untimed);
        if (first) {
          const top = +it[3], height = +it[2];
          const wantTop = (first.s - night(axis0)) * PX_PER_MIN + TOP_INSET;
          if (Math.abs(top - wantTop) > 1) throw new Error(`${tab.label} ${stage}: "${first.artist}" prints ${first.printed}, its block sits at ${top}px (that time is ${Math.round(wantTop)}px)`);
          if (read.length === 1 && first.e != null) {
            const wantH = (first.e - first.s) * PX_PER_MIN - HEIGHT_INSET;
            // A block whose length disagrees with its printed range is a
            // misprint: neither reading can be trusted, so it is no set.
            if (Math.abs(height - wantH) > 1.5) {
              const blockEnd = first.s + Math.round((height + HEIGHT_INSET) / PX_PER_MIN);
              Object.assign(first, { misprint: `printed ${first.printed}; its block on the grid runs ${hhmm(first.s % 1440)} to ${hhmm(blockEnd % 1440)}` });
            }
          }
          placed++;
          // A group block spans its entries: each one starts and ends inside it.
          if (read.length > 1) {
            const from = first.s, to = first.s + (height + HEIGHT_INSET) / PX_PER_MIN;
            for (const r of read.filter(r => !r.untimed)) {
              if (r.s < from - 1 || r.s > to + 1 || (r.e != null && r.e > to + 1)) throw new Error(`${tab.label} ${stage}: "${r.artist}" prints ${r.printed}, outside its group block (${hhmm(from % 1440)} to ${hhmm(Math.round(to) % 1440)})`);
            }
          }
        }
        for (const r of read) {
          const { s, e, untimed: u, ...x } = r;
          (u ? untimed : x.misprint ? misprints : sets).push(x);
        }
      }
      // Every artist the column prints was read in a block.
      const printedHere = (col.match(/class="artist-title[\s"]/g) || []).length;
      const readHere = [...sets, ...untimed, ...misprints].filter(x => x.stage === stage).length;
      if (printedHere !== readHere) throw new Error(`${tab.label} ${stage}: prints ${printedHere} artists, ${readHere} read in blocks`);
    });
    return { label: tab.label, weekday, date: tab.date, stages: [...stageNames.values()], sets, untimed, misprints, placed, axis: `${marks[0][2]} … ${marks.at(-1)[2]}` };
  });
  return { days };
}
