// tml-schedule.mjs — Tomorrowland's official line-up page (2017 on),
// /en/festival/line-up/stages/<weekday>-<d>-<month>-<year>, read from an
// archived capture.
//
// One page prints every day of both weekends. Each day is a
// <div class="eventday" data-eventday="Friday 19 July 2019">; inside it a
// .stages list names the stages in order (<h4>Host<span class="stage__location">
// - Location</span></h4>, or just <h4>Mainstage</h4>), then a .performances
// block holds one <ul class="stage__performances"> per stage in the same
// order. Each <li class="performance"> carries data-start / data-end (ISO,
// with offset) and prints the artist and "HH:MM - HH:MM".
//
// A set is the printed artist and range; the data-start/data-end must agree
// with the printed range (same local wall time), or the page is not read.
// A performance with no artist is an empty slot, counted, never a set.
// The stage is the physical stage (see stageFrom below); the host that day
// ("Eric Prydz presents Holosphere") is kept with the stage.

const ENT = { "&amp;": "&", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&nbsp;": " ", "&#8217;": "’", "&#8211;": "–" };
export const plain = s => String(s).replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// "Friday 19 July 2019" → { weekday, date: "2019-07-19" }
// 2018 names its Thursdays "The Gathering 19 July 2018": the weekday is the
// date's own.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function eventDay(label) {
  const m = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|The Gathering) (\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(label.trim());
  const mo = m ? MONTHS.indexOf(m[3].toLowerCase()) + 1 : 0;
  if (!mo) return null;
  const date = `${m[4]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const weekday = WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()];
  if (m[1] !== "The Gathering" && m[1] !== weekday) return null;
  return { weekday, date };
}

// "2019-07-20T20:50:00+02:00" → "20:50" (the wall time printed with it).
const wall = iso => /T(\d{2}:\d{2})/.exec(iso || "")?.[1];

// Which part of a heading names the physical stage changes by year: 2018
// and 2019 print the day's host first and the stage after the dash
// ("Eric Prydz presents Holosphere - Freedom Stage by Budweiser"); 2022 on
// print the stage first and the host after it ("Rose Garden - Rampage").
// `stageFrom` ("location" | "heading") says which, from the receipt; a
// heading with no dash part is the stage either way (2017 prints only that).
export function parseTomorrowland(html, { stageFrom = "location" } = {}) {
  if (!["location", "heading"].includes(stageFrom)) throw new Error(`stageFrom "${stageFrom}"`);
  // The page prints the days a second time further down (a per-day list
  // that the site fills in by script); the timetable is the first run, so
  // reading stops where a day's id repeats.
  const all = [...html.matchAll(/<div class="eventday"[^>]*data-eventday-id="(\d+)"[^>]*data-eventday="([^"]+)"[^>]*>/g)];
  const cut = all.findIndex((m, i) => all.slice(0, i).some(x => x[1] === m[1]));
  const starts = cut < 0 ? all : all.slice(0, cut), end = cut < 0 ? html.length : all[cut].index;
  const days = starts.map((m, i) => {
    const seg = html.slice(m.index, starts[i + 1]?.index ?? end);
    const label = plain(m[2]), d = eventDay(label);
    if (!d) throw new Error(`eventday "${label}": not a weekday and date`);
    const stagesSeg = seg.slice(0, seg.indexOf('<div class="performances">'));
    if (!stagesSeg || stagesSeg.length === seg.length) throw new Error(`${label}: no performances block`);
    const stages = [...stagesSeg.matchAll(/<h4>([\s\S]*?)<\/h4>/g)].map(h => {
      const loc = /<span class="stage__location">([\s\S]*?)<\/span>/.exec(h[1]);
      const heading = plain(h[1].replace(/<span class="stage__location">[\s\S]*?<\/span>/, ""));
      const location = loc ? plain(loc[1]).replace(/^-\s*/, "") : "";
      if (!location) return { name: heading, host: "", heading, location };
      return stageFrom === "location" ? { name: location, host: heading, heading, location } : { name: heading, host: location, heading, location };
    });
    const lists = seg.split(/<ul class="stage__performances">/).slice(1);
    if (lists.length !== stages.length) throw new Error(`${label}: ${stages.length} stage headings, ${lists.length} performance lists`);
    const sets = [], empty = [];
    lists.forEach((l, j) => {
      const body = l.slice(0, l.indexOf("</ul>"));
      for (const p of body.matchAll(/<li class="performance"([^>]*)>([\s\S]*?)<\/li>/g)) {
        const a = /data-start="([^"]*)"/.exec(p[1])?.[1], b = /data-end="([^"]*)"/.exec(p[1])?.[1];
        const artist = /<span class="performance__artist">([\s\S]*?)<\/span>/.exec(p[2]);
        const slot = /<span class="performance__timeslot">([\s\S]*?)<\/span>/.exec(p[2]);
        if (!artist) { empty.push({ stage: stages[j].name, start: wall(a), end: wall(b) }); continue; }
        const printed = slot ? plain(slot[1]) : "";
        const [start, end] = printed.split(/\s*-\s*/);
        if (!/^\d{2}:\d{2}$/.test(start || "") || !/^\d{2}:\d{2}$/.test(end || "")) throw new Error(`${label} ${stages[j].name}: "${plain(artist[1])}" prints "${printed}", not HH:MM - HH:MM`);
        if (wall(a) !== start || wall(b) !== end) throw new Error(`${label} ${stages[j].name}: "${plain(artist[1])}" prints ${printed}, its data says ${a} – ${b}`);
        sets.push({ stage: stages[j].name, start, end, artist: plain(artist[1]) });
      }
    });
    return { label, ...d, stages, sets, empty };
  });
  return { days };
}
