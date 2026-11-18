// dostuff-embed-schedule.mjs — read an official festival lineup widget's
// embed script (format "dostuff-embed"): https://<site>.dostff.co/embeds/lineup.js,
// the script the festival's own lineup page loads into its <div id="ds-fest">
// (Outside Lands 2022-2025, sfoutsidelands.com/lineup/).
//
// The script sets `window._fest_options = {…}` on one line: the festival's
// name, its first and last day (start_date, end_date), its time zone, and the
// widget's first grouping ("Interactive Lineup"), whose lineups list artists,
// each with the performances the widget draws under that artist:
//
//   { "id": 14081, "start": "2023-08-11T20:40:00.000-07:00",
//     "end": "2023-08-11T21:55:00.000-07:00", "stage": "Lands End",
//     "name": "Kendrick Lamar" }
//
// A performance shared by two artists (a b2b set, a feature) appears under
// each of them with the same id; it is one set, billed as its own `name`.
// Every start and end carries its UTC offset, which must be the festival's
// time zone's offset at that instant, so the clock time is the printed one.
// The day is the start's local date (before `rolloverHour`, the night of the
// day above), and must be one of the widget's own run of days.
//
// Throws on anything it cannot confirm: no options line, a performance with
// no start, end or stage, an end not after its start, one id carrying two
// different sets, a wrong offset, a day outside the run, two sets on one
// stage at once.

const ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00(?:\.000)?([+-]\d{2}:\d{2})$/;

// The zone's UTC offset ("-07:00") at the instant `iso` names.
function zoneOffset(iso, timezone) {
  const t = Date.parse(iso);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(t)).map(p => [p.type, p.value]));
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const min = Math.round((local - t) / 60000), sign = min < 0 ? "-" : "+", a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

const nextDate = (date, n) => new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export function readFestOptions(text) {
  const m = /window\._fest_options\s*=\s*/.exec(String(text));
  if (!m) throw new Error("dostuff-embed: no window._fest_options in the script");
  const from = m.index + m[0].length, to = text.indexOf("\n", from);
  try { return JSON.parse(text.slice(from, to < 0 ? undefined : to).trim().replace(/;$/, "")); }
  catch (e) { throw new Error(`dostuff-embed: window._fest_options is not one line of JSON (${e.message})`); }
}

export function parseDoStuffEmbed(text, { rolloverHour = 6 } = {}) {
  const o = readFestOptions(text);
  const { name, start_date: startDate, end_date: endDate, timezone } = o;
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "") || endDate < startDate)
    throw new Error(`dostuff-embed: the options print no name or run of days (${name}, ${startDate} to ${endDate})`);
  if (!timezone) throw new Error("dostuff-embed: the options print no time zone");
  const run = [];
  for (let d = startDate; d <= endDate; d = nextDate(d, 1)) run.push(d);
  const g = o.initial_grouping;
  if (!g || !Array.isArray(g.lineups)) throw new Error("dostuff-embed: no initial grouping of lineups");
  const byId = new Map(), billedUnder = new Map();
  let artists = 0;
  for (const l of g.lineups) for (const a of l.artists || []) {
    artists++;
    for (const p of a.performances || []) {
      const prev = byId.get(p.id);
      if (prev && JSON.stringify(prev) !== JSON.stringify(p)) throw new Error(`dostuff-embed: performance ${p.id} is drawn as two different sets`);
      byId.set(p.id, p);
      (billedUnder.get(p.id) || billedUnder.set(p.id, new Set()).get(p.id)).add(String(a.name).trim());
    }
  }
  const sets = [];
  for (const p of byId.values()) {
    const s = ISO.exec(p.start || ""), e = ISO.exec(p.end || ""), billing = String(p.name || "").trim(), stage = String(p.stage || "").trim();
    if (!s || !e) throw new Error(`dostuff-embed: performance ${p.id} (${billing}) prints "${p.start}" to "${p.end}", not two times with their offsets`);
    if (!billing || !stage) throw new Error(`dostuff-embed: performance ${p.id} has no name or no stage`);
    for (const [x, iso] of [[s, p.start], [e, p.end]])
      if (x[4] !== zoneOffset(iso, timezone)) throw new Error(`dostuff-embed: ${billing} prints ${iso}, whose offset is not ${timezone}'s`);
    if (Date.parse(p.end) <= Date.parse(p.start)) throw new Error(`dostuff-embed: ${billing} ends at or before its start (${p.start} to ${p.end})`);
    if (Date.parse(p.end) - Date.parse(p.start) > 12 * 36e5) throw new Error(`dostuff-embed: ${billing} runs over twelve hours`);
    const date = +s[2] < rolloverHour ? nextDate(s[1], -1) : s[1];
    if (!run.includes(date)) throw new Error(`dostuff-embed: ${billing} starts ${p.start}, on ${date}, outside the run ${startDate} to ${endDate}`);
    sets.push({ id: p.id, date, stage, start: `${s[2]}:${s[3]}`, end: `${e[2]}:${e[3]}`, artist: billing,
      billedUnder: [...billedUnder.get(p.id)].sort(), startIso: p.start, endIso: p.end });
  }
  sets.sort((a, b) => a.date.localeCompare(b.date) || a.stage.localeCompare(b.stage) || a.startIso.localeCompare(b.startIso));
  for (let i = 1; i < sets.length; i++) {
    const a = sets[i - 1], b = sets[i];
    if (a.stage === b.stage && Date.parse(b.startIso) < Date.parse(a.endIso)) throw new Error(`dostuff-embed: ${a.artist} and ${b.artist} overlap on ${a.stage}`);
  }
  const days = run.map(date => ({ date, sets: sets.filter(x => x.date === date) }));
  return { name, startDate, endDate, run, timezone, grouping: g.name, lineups: g.lineups.map(l => l.name),
    artists, performances: sets.length, stages: [...new Set(sets.map(x => x.stage))], days, sets };
}
