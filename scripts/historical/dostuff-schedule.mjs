// dostuff-schedule.mjs — the official schedule grid that Outside Lands
// (lineup.sfoutsidelands.com) and Lollapalooza 2012 (lineup.lollapalooza.com)
// ran on DoStuff Media's lineup platform, as archived by the Wayback Machine,
// into rows. Format "dostuff-grid".
//
// Each page prints ONE day ("/events/2013/08/10"): a tab row naming every day
// ("Saturday, August 10", the current one marked), a stage header per column
// whose class carries the date ("ds-venue-column-265732-20130810"), an hour
// axis of 15-minute rows printed with NO am/pm ("12:00" … "10:00"), and one
// block per set, placed on that axis (`top`, `height` in px) and printing its
// own range, again with no am/pm ("1:00 - 1:50").
//
// The meridiem is never guessed ("obviously afternoon"), as with ACL's grid
// (ruling A). It is READ OFF THE SAME SITE: each act's own page on the lineup
// site prints its set with a meridiem ("Friday Aug 9 7:10 PM on Lands End",
// parseDoStuffBand). One such page per day is the day's anchor:
//
//   1. the page's scale (px per minute) is the axis row height per 15 min,
//      and every block's place must match its printed start and length;
//   2. a block's minutes past the axis's first row come from its `top`;
//   3. the anchor act's printed clock time, minus its block's minutes past
//      the axis, fixes the axis's first row in 24-hour time (and must be a
//      reading of that row's printed label, "12:00" → 00:00 or 12:00);
//   4. every start is that axis start plus its block's minutes, and must be
//      a reading of its own printed start; every end likewise.
//
// A block whose place disagrees with its printed range is a misprint: kept
// apart, never a set.

const plain = s => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&#0?39;|&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘")
  .replace(/&quot;|&#8220;|&#8221;/g, "\"").replace(/&#8211;|&ndash;/g, "–").replace(/&nbsp;|&#160;/g, " ")
  .replace(/&eacute;/g, "é").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/\s+/g, " ").trim();

const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim()); return m && +m[1] >= 1 && +m[1] <= 12 && +m[2] < 60 ? [+m[1], +m[2]] : null; };
// Both 24-hour readings of a printed clock time with no meridiem, in minutes.
export const readings = ([h, m]) => [(h % 12) * 60 + m, ((h % 12) + 12) * 60 + m];
export const fmt = min => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
// The page lays a block at top = minutes × scale and height = minutes × scale − 1
// (a 1 px rule between blocks); a place within this is the printed time.
export const TOLERANCE_PX = 1.5;

// The festivals whose lineup site this is, by the name the page's title
// prints. Outside Lands' titles print the year ("Outside Lands 2013");
// Lollapalooza's 2012 title prints the name alone, and its year is then the
// day tab's own.
export const FESTIVALS = { "Outside Lands": "outside-lands", "Lollapalooza": "lollapalooza" };
const titled = title => {
  const m = /^(.+?)(?: (20\d\d))?$/.exec(title);
  const festival = m && FESTIVALS[m[1]];
  return festival ? { festival, titleYear: m[2] ? +m[2] : null } : null;
};

// One day page → { title, festival, year, label, date, tabs, stages, axis, scale, blocks, misprints }.
// Blocks carry minutes past the axis's first row (`offset`, `length`), not
// clock times: those need the day's anchor (timeDay).
export function parseDoStuff(html) {
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
  const named = titled(title);
  if (!named) throw new Error(`not a schedule page of ${Object.keys(FESTIVALS).join(" or ")} (title "${title}")`);
  const { festival, titleYear } = named;
  const grid = /<div class="ds-schedule[^"]*">([\s\S]*?)<\/table>/.exec(html)?.[1];
  if (!grid) throw new Error("no schedule grid");
  // Two layouts. From 2012 a tab row names every day ("Saturday, August 10",
  // the current one marked), each stage header's class carries the date and
  // each axis row its height. Lollapalooza 2011's older one prints the days
  // as a drop-down, the current day as plain text and the others as links
  // ("Fri, Aug 5"), plain stage headers in column order and an axis with no
  // heights; the year is then the title's, and the grid's "dayN" class must
  // be the current day's date.
  const older = !/<ul class="ds-schedule-days">/.test(html) && /<div class="fl-vb-drop">/.test(html);
  let tabs, date, label, stages, columns;
  if (!older) {
    const tabsHtml = /<ul class="ds-schedule-days">([\s\S]*?)<\/ul>/.exec(html)?.[1];
    if (!tabsHtml) throw new Error("no day tabs");
    tabs = [...tabsHtml.matchAll(/<li class="([^"]*)">\s*<a href="[^"]*?\/events\/(\d{4})\/(\d{2})\/(\d{2})\/?">([^<]+)<\/a>/g)]
      .map(m => ({ current: /ds-schedule-days-current-date/.test(m[1]), date: `${m[2]}-${m[3]}-${m[4]}`, label: plain(m[5]) }));
    const cur = tabs.filter(t => t.current);
    if (cur.length !== 1) throw new Error(`${cur.length} current day tabs`);
    ({ date, label } = cur[0]);
    // The tab prints the weekday and date; both must be the date's own.
    const lm = /^([A-Za-z]+), ([A-Za-z]+) (\d{1,2})$/.exec(label);
    const d = new Date(date + "T12:00:00Z");
    if (!lm || lm[1] !== d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
      || MONTHS.indexOf(lm[2].toLowerCase()) !== d.getUTCMonth() || +lm[3] !== d.getUTCDate()) throw new Error(`day tab "${label}" is not ${date}`);
    const ymd = date.replaceAll("-", "");
    const heads = [...grid.matchAll(/<th class="ds-venue-column-(\d+)-(\d{8})">([\s\S]*?)<\/th>/g)].map(m => ({ id: m[1], ymd: m[2], name: plain(m[3]) }));
    if (!heads.length) throw new Error("no stage columns");
    for (const h of heads) if (h.ymd !== ymd) throw new Error(`stage ${h.name} is printed for ${h.ymd}, the tab for ${date}`);
    stages = heads.map(h => h.name);
    columns = [...grid.matchAll(/<td class="ds-stage[^"]*ds-venue-column-(\d+)-\d{8}">([\s\S]*?)<\/td>/g)].map(m => {
      const h = heads.find(x => x.id === m[1]);
      if (!h) throw new Error(`a column for stage ${m[1]} has no header`);
      return { stage: h.name, html: m[2] };
    });
  } else {
    if (titleYear === null) throw new Error(`the older layout's title "${title}" prints no year`);
    const drop = /<div class="fl-vb-drop">([\s\S]*?)<\/div>\s*<\/div>/.exec(html)?.[1] || "";
    const dated = (lab, href) => {
      const lm = /^([A-Za-z]{3}), ([A-Za-z]{3}) (\d{1,2})$/.exec(lab), mo = lm ? MONTHS.findIndex(x => x.slice(0, 3) === lm[2].toLowerCase()) : -1;
      if (!lm || mo < 0) throw new Error(`day tab "${lab}" is not a weekday and date`);
      const dt = `${titleYear}-${String(mo + 1).padStart(2, "0")}-${lm[3].padStart(2, "0")}`;
      const d = new Date(dt + "T12:00:00Z");
      if (isNaN(d) || d.getUTCMonth() !== mo || WEEKDAYS[d.getUTCDay()].slice(0, 3) !== lm[1]) throw new Error(`day tab "${lab}" is not ${dt}`);
      if (href !== null && href !== dt) throw new Error(`day tab "${lab}" links to ${href}`);
      return dt;
    };
    const curs = [...drop.matchAll(/<span>([^<]+)<\/span>/g)].map(m => plain(m[1]));
    if (curs.length !== 1) throw new Error(`${curs.length} current day tabs`);
    label = curs[0]; date = dated(label, null);
    tabs = [{ current: true, date, label }, ...[...drop.matchAll(/<a href="[^"]*?\/events\/(\d{4})\/(\d{2})\/(\d{2})\/?">([^<]+)<\/a>/g)]
      .map(m => ({ current: false, date: dated(plain(m[4]), `${m[1]}-${m[2]}-${m[3]}`), label: plain(m[4]) }))].sort((a, b) => a.date.localeCompare(b.date));
    if (new Set(tabs.map(t => t.date)).size !== tabs.length) throw new Error("a day tab is printed twice");
    const dayClass = /<div class="ds-schedule[^"]*\bday(\d+)\b/.exec(html)?.[1];
    if (+dayClass !== +date.slice(8)) throw new Error(`the grid is marked day ${dayClass}, its tab prints ${date}`);
    const header = /<tr class="ds-schedule-header">([\s\S]*?)<\/tr>/.exec(grid)?.[1] || "";
    stages = [...header.matchAll(/<th(?: class="([^"]*)")?>([\s\S]*?)<\/th>/g)].filter(m => m[1] !== "ds-time").map(m => plain(m[2]));
    if (!stages.length || stages.some(x => !x) || new Set(stages).size !== stages.length) throw new Error(`stage headers ${stages.join(", ")}`);
    columns = [...grid.matchAll(/<td class="ds-stage ds-stage(\d+)">([\s\S]*?)<\/td>/g)].map((m, i) => {
      if (+m[1] !== i + 1) throw new Error(`column ${i + 1} is marked ds-stage${m[1]}`);
      return { stage: stages[i], html: m[2] };
    });
    if (columns.length !== stages.length) throw new Error(`${columns.length} columns for ${stages.length} stage headers`);
  }
  const year = +date.slice(0, 4);
  if (titleYear !== null && titleYear !== year) throw new Error(`day ${date} is not in ${title}`);
  // The axis: 15-minute rows, each a printed label and a height in px.
  const rows = older
    ? [...(/<ul class="fl-schedule-times">([\s\S]*?)<\/ul>/.exec(grid)?.[1] || "").matchAll(/<li>\s*([\d:]+)\s*<\/li>/g)].map(m => ({ height: null, label: m[1].trim() }))
    : [...grid.matchAll(/<li style="height: ([\d.]+)px;[^"]*" class="ds-schedule-row-(\d+)">\s*([\d:]+)\s*<\/li>/g)].map(m => ({ height: +m[1], label: m[3].trim() }));
  if (rows.length < 2) throw new Error("no hour axis");
  const step = rows.map(r => hm(r.label));
  if (step.some(x => !x)) throw new Error(`an axis label is not a clock time (${rows.map(r => r.label).join(" ")})`);
  for (let i = 1; i < step.length; i++) {
    const a = (step[i - 1][0] % 12) * 60 + step[i - 1][1], b = (step[i][0] % 12) * 60 + step[i][1];
    if ((b - a + 720) % 720 !== 15) throw new Error(`axis steps ${rows[i - 1].label} → ${rows[i].label}, not 15 minutes`);
  }
  const BOX = /<div [^>]*?class="ds-event-box[^"]*"[^>]*?\sid="(\d+)"[^>]*?\sstyle="top:(-?[\d.]+)px;height:(-?[\d.]+)px[\s\S]*?<strong class="ds-event-title"[^>]*>([\s\S]*?)<\/strong>\s*<span class="ds-time-range"[^>]*>([\s\S]*?)<\/span>/g;
  let scale;
  if (!older) {
    const hs = new Set(rows.map(r => r.height));
    if (hs.size !== 1) throw new Error(`axis rows are not one height (${[...hs].join(", ")} px)`);
    scale = (rows[0].height + 1) / 15;
  } else {
    // The older axis prints no row heights: the scale is the one that the
    // blocks themselves keep, height + 1 px per printed minute, and at least
    // three blocks in four must keep it exactly.
    const per = new Map();
    for (const c of columns) for (const b of c.html.matchAll(BOX)) {
      const pm = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(plain(b[5])), a = pm && hm(pm[1]), z = pm && hm(pm[2]);
      const dur = a && z && ((((z[0] % 12) * 60 + z[1]) - ((a[0] % 12) * 60 + a[1])) + 720) % 720;
      if (dur) { const k = (+b[3] + 1) / dur; per.set(k, (per.get(k) || 0) + 1); }
    }
    const all = [...per.values()].reduce((x, y) => x + y, 0), best = [...per].sort((x, y) => y[1] - x[1])[0];
    if (!best || best[1] * 4 < all * 3) throw new Error(`the blocks keep no one scale (${[...per].map(([k, n]) => `${k} px/min ×${n}`).join(", ")})`);
    scale = best[0];
  }
  const blocks = [], misprints = [];
  for (const { stage: name, html: col } of columns) {
    const stage = { name };
    for (const b of col.matchAll(BOX)) {
      const slug = /href="[^"]*\/band\/([^"/?#]+)"/.exec(b[4])?.[1] || null;
      const artist = plain(b[4]), printed = plain(b[5]);
      const x = { id: b[1], stage: stage.name, artist, slug, printed, top: +b[2], height: +b[3] };
      const pm = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(printed);
      const a = pm && hm(pm[1]), z = pm && hm(pm[2]);
      const offset = Math.round(x.top / scale), length = Math.round((x.height + 1) / scale);
      if (!a || !z) { misprints.push({ ...x, misprint: "no printed range" }); continue; }
      // The block's place must read as its printed start and length, modulo 12 h.
      const first = (step[0][0] % 12) * 60 + step[0][1];
      const startOk = Math.abs(x.top - offset * scale) <= TOLERANCE_PX && ((first + offset) % 720) === ((a[0] % 12) * 60 + a[1]);
      const dur = ((((z[0] % 12) * 60 + z[1]) - ((a[0] % 12) * 60 + a[1])) + 720) % 720;
      const lenOk = Math.abs((x.height + 1) - dur * scale) <= TOLERANCE_PX;
      if (!startOk || !lenOk) { misprints.push({ ...x, misprint: !startOk ? `block sits at ${fmt((first + offset) % 720)} on the axis` : `block is ${length} min long, the range ${dur}` }); continue; }
      blocks.push({ ...x, offset, length: dur });
    }
  }
  // Every block on the grid is read: a set or a misprint, never skipped.
  const printedBlocks = (grid.match(/class="ds-event-box[ "]/g) || []).length;
  if (printedBlocks !== blocks.length + misprints.length) throw new Error(`the grid prints ${printedBlocks} blocks, ${blocks.length + misprints.length} were read`);
  // Below the grid the older layout lists autograph signings (the f.y.e.
  // Autograph Tent), each with its own clock time: not sets, never read as
  // any, only counted for the ledger.
  const lower = [...(/<div class="ds-schedule-lower">([\s\S]*)$/.exec(grid)?.[1] || "").matchAll(/<div class="ds-event-lower-time">/g)].length;
  return { title, festival, year, label, date, tabs, stages, lower, axis: { first: rows[0].label, last: rows.at(-1).label, rows: rows.length }, scale, blocks, misprints };
}

// An act's page → { title, festival, year, sets }, its printed sets
// [{ date, printed, text, minutes, stage }]. The title names the act "at" the
// festival ("Dev at Lollapalooza", "Muse at Outside Lands 2013"); `year` is
// null when it prints none, and each set's date is then the page's word.
// Two layouts. Through 2014 a "Playing" block prints each set as a linked
// date and time, then its stage: "<a …/events/2013/08/09>Friday Aug 9 7:10 PM</a>
// on Lands End" (Lollapalooza 2011's older page prints the day and stage,
// then the linked time: "Sunday, Aug. 7 / Music Unlimited / 4:00pm"). From 2015 the performance block prints each set as one linked
// heading, "Friday, August 7, 7:55 PM", with the stage after the time from
// 2017 ("Friday, August 11, 8:05 PM Lands End") and no stage before that.
// `text` is the line as the page prints it; the printed weekday, month and
// day must be the date its link names.
export function parseDoStuffBand(html) {
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
  const sets = [];
  const clock = (printed) => {
    const t = /(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(printed);
    if (!t) throw new Error(`"${printed}" prints no clock time with AM/PM`);
    return ((+t[1] % 12) + (t[3].toUpperCase() === "P" ? 12 : 0)) * 60 + +t[2];
  };
  const sameDay = (date, wd, mon, dd, text) => {
    const d = new Date(date + "T12:00:00Z");
    if (wd !== WEEKDAYS[d.getUTCDay()] || mon.slice(0, 3).toLowerCase() !== MONTHS[d.getUTCMonth()].slice(0, 3) || +dd !== d.getUTCDate())
      throw new Error(`"${text}" is not the date its link names (${date})`);
  };
  const box = /<div class="ds-arrange ds-performance-location">\s*<h2>Playing<\/h2>\s*<p>([\s\S]*?)<\/p>/.exec(html)?.[1];
  const older = [...html.matchAll(/<div class="fl-time">\s*<p>([^<]+)<br\s*\/?>([^<]+)<\/p>\s*<a href="[^"]*\/events\/(\d{4})\/(\d{2})\/(\d{2})\/?">\s*<strong>\s*(\d{1,2}:\d{2})\s*<span>([ap]m)<\/span>\s*<\/strong>/gi)];
  if (older.length) {
    // Lollapalooza 2011: "Sunday, Aug. 7" and the stage, then the linked
    // time "4:00pm".
    for (const m of older) {
      const day = plain(m[1]), stage = plain(m[2]), date = `${m[3]}-${m[4]}-${m[5]}`, printed = `${day} ${m[6]}${m[7]}`;
      const w = /^([A-Za-z]+), ([A-Za-z]{3})\.? (\d{1,2})$/.exec(day);
      if (!w) throw new Error(`"${day}" prints no weekday and date`);
      sameDay(date, w[1], w[2], w[3], day);
      sets.push({ date, printed, text: `${printed} on ${stage}`, minutes: clock(`${m[6]} ${m[7]}`), stage });
    }
  } else if (box) {
    for (const m of box.matchAll(/<a href="[^"]*\/events\/(\d{4})\/(\d{2})\/(\d{2})\/?">([^<]+)<\/a>\s*on\s*([^<]+?)\s*(?:<br\s*\/?>|$)/g)) {
      const printed = plain(m[4]), stage = plain(m[5]), date = `${m[1]}-${m[2]}-${m[3]}`;
      const w = /^([A-Za-z]+) ([A-Za-z]{3}) (\d{1,2}) /.exec(printed);
      if (!w) throw new Error(`"${printed}" prints no weekday and date`);
      sameDay(date, w[1], w[2], w[3], printed);
      sets.push({ date, printed, text: `${printed} on ${stage}`, minutes: clock(printed), stage });
    }
  } else {
    const blk = /<div class="ds-arrange ds-performance-location">([\s\S]*?)<\/div>/.exec(html)?.[1];
    if (!blk) throw new Error(`no performance block on the act's page (${title})`);
    for (const m of blk.matchAll(/<h2>\s*<a href="[^"]*\/events\/(\d{4})\/(\d{2})\/(\d{2})\/?">([\s\S]*?)<\/a>\s*<\/h2>/g)) {
      const text = plain(m[4]), date = `${m[1]}-${m[2]}-${m[3]}`;
      const w = /^([A-Za-z]+), ([A-Za-z]+) (\d{1,2}), (\d{1,2}:\d{2} [AP]M)(?: (.+))?$/.exec(text);
      if (!w) throw new Error(`"${text}" is not a weekday, date and clock time`);
      sameDay(date, w[1], w[2], w[3], text);
      sets.push({ date, printed: `${w[1]}, ${w[2]} ${w[3]}, ${w[4]}`, text, minutes: clock(w[4]), stage: w[5] || null });
    }
  }
  if (!sets.length) throw new Error(`the act's page prints no set (${title})`);
  const at = / at (.+)$/.exec(title), named = at && titled(at[1]);
  if (!named) throw new Error(`not an act's page at ${Object.keys(FESTIVALS).join(" or ")} (title "${title}")`);
  return { title, festival: named.festival, year: named.titleYear, sets };
}

// A parsed day + its anchor act's page (+ the anchor block's slug) → the day's
// timed sets: [{stage, start, end, artist, printed}]. Throws if the anchor does
// not fix the axis, or if any set's clock time is not a reading of its print.
export function timeDay(day, band, slug) {
  const mine = day.blocks.filter(b => b.slug === slug);
  const on = band.sets.filter(s => s.date === day.date);
  if (mine.length !== 1 || on.length !== 1) throw new Error(`anchor ${slug}: ${mine.length} block(s) on the grid, ${on.length} set(s) on its page for ${day.date}`);
  // Before 2017 the newer act pages print no stage: the act's one block on
  // that day's grid is then its set. A stage the page does print must match.
  if (on[0].stage !== null && on[0].stage !== mine[0].stage) throw new Error(`anchor ${slug}: its page prints ${on[0].stage}, the grid ${mine[0].stage}`);
  const axisStart = on[0].minutes - mine[0].offset;
  if (!readings(hm(day.axis.first)).includes(axisStart)) throw new Error(`anchor ${slug} puts the axis's first row at ${fmt(axisStart)}, not a reading of "${day.axis.first}"`);
  return {
    axisStart: fmt(axisStart), anchor: { slug, printed: on[0].printed, text: on[0].text, stage: mine[0].stage },
    sets: day.blocks.map(b => {
      const s = axisStart + b.offset, e = s + b.length;
      const [pa, pz] = b.printed.split(/\s*-\s*/).map(hm);
      if (!readings(pa).includes(s % 1440) || !readings(pz).includes(e % 1440)) throw new Error(`${b.artist}: ${fmt(s)}-${fmt(e)} is not a reading of "${b.printed}"`);
      return { stage: b.stage, start: fmt(s), end: fmt(e), artist: b.artist, printed: b.printed };
    }),
  };
}
