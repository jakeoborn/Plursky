// dostuff-embed-schedule.mjs — read an official festival lineup widget's
// embed script (format "dostuff-embed"): https://<site>.dostff.co/embeds/lineup.js,
// the script the festival's own lineup page loads into its <div id="ds-fest">
// (Outside Lands 2018-2019 and 2022-2025, sfoutsidelands.com/lineup/; Lightning in a
// Bottle 2018-2019, lightninginabottle.org/lineup/).
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
// When the options print `"show_performance_titles": false` (Lightning in a
// Bottle 2019), the widget draws each set under its act's name and never its
// title, so the set is billed as that act (Outside Lands 2018-2019 and 2022-2025 and
// Lightning in a Bottle 2019); a set drawn under several acts is billed as
// its title, the festival's one name for the shared set. Two performances
// with the same stage, start, end and billing are one set drawn twice.
// Every start and end carries its UTC offset, which must be the festival's
// time zone's offset at that instant, so the clock time is the printed one.
// The day is the start's local date (before `rolloverHour`, the night of the
// day above), and must be one of the widget's own run of days.
//
// Throws on anything it cannot confirm: no options line, a performance with
// no start, end or stage, an end not after its start, one id carrying two
// different sets, a wrong offset, a day outside the run, two sets on one
// stage at once.

// The official lineup page that loads each festival's widget, and how far
// apart the page's capture and the script's may be (seconds, script minus
// page). The script hosts are one per year (sfosl19.dostff.co,
// lib2018.dostff.co), and the archived pages and scripts are often days
// apart, so the page must have been captured within a month of the script
// and must load that very script: by its own <script src> (pageLoadsScript),
// or through the site's own script (`via`, Outside Lands 2019, whose lineup
// page is an app shell: its main.js adds the widget's <script> on the lineup
// route), captured within a day of the page on the page's own host
// (scriptSetsSrc).
const MONTH = 31 * 86400;
export const EMBED_PAGES = {
  "outside-lands": { page: /^https?:\/\/(www\.)?sfoutsidelands\.com\/lineup\/$/, minGap: -MONTH, maxGap: MONTH, label: "captured within a month of the script" },
  "lightning-in-a-bottle": { page: /^https?:\/\/(www\.)?lightninginabottle\.org\/lineup\/$/, minGap: -MONTH, maxGap: MONTH, label: "captured within a month of the script" },
};
const tsSec = ts => /^\d{14}$/.test(ts || "") ? Date.parse(ts.replace(/(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/, "$1-$2-$3T$4:$5:$6Z")) / 1000 : NaN;
const hostOf = u => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };
// Whether `embeddedBy` (an archived page, and the site script it loads the
// widget through, if any) is the festival's official lineup page captured
// close enough to the script's capture `ts`.
export function embedPageOk(festivalId, ts, embeddedBy) {
  const rule = EMBED_PAGES[festivalId], eb = embeddedBy || {}, gap = tsSec(ts) - tsSec(eb.captureTimestamp);
  if (!rule || !rule.page.test(eb.url || "") || !(gap >= rule.minGap && gap <= rule.maxGap)) return false;
  if (!eb.via) return true;
  const v = eb.via, vgap = Math.abs(tsSec(v.captureTimestamp) - tsSec(eb.captureTimestamp));
  return hostOf(v.url) === hostOf(eb.url) && /^https?:\/\/[^/]+\/[^?#]+\.js(\?[^#]*)?$/.test(v.url || "") && vgap <= 86400;
}
// The page's <script src> values, each as the address it loads. A page read
// as rendered from the archive resolves a site-relative src ("/assets/…")
// against the archive's own host, so a web.archive.org address that is not a
// /web/ capture link is that path on the page's own host.
function scriptSrcs(html, pageUrl) {
  return [...String(html).matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m => {
    let src = m[1].replace(/&amp;/g, "&");
    const arch = /^(?:https?:)?\/\/web\.archive\.org(\/(?!web\/).*)$/.exec(src);
    if (arch && pageUrl) src = new URL(arch[1], pageUrl).href;
    else if (pageUrl && !/^(https?:)?\/\//.test(src)) src = new URL(src, pageUrl).href;
    return src.replace(/^https?:/, "");
  });
}
// Whether a page's HTML loads the script at `scriptUrl` (its own <script src>).
export function pageLoadsScript(html, scriptUrl, pageUrl) {
  const bare = String(scriptUrl).replace(/^https?:/, "");
  return scriptSrcs(html, pageUrl).some(src => src === bare);
}
// Whether a site script sets a <script>'s src to `scriptUrl`: it must hold the
// address whole as a string literal, as main.js's setAttribute("src", "…").
export function scriptSetsSrc(js, scriptUrl) {
  const u = String(scriptUrl);
  return [`"${u}"`, `'${u}'`].some(q => String(js).includes(q)) && /\bsetAttribute\(\s*["']src["']\s*,\s*["']/.test(String(js));
}

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
  const byAct = o.show_performance_titles === false, sets = [], drawnTwice = [];
  for (const p of byId.values()) {
    const under = [...billedUnder.get(p.id)], title = String(p.name || "").trim();
    let billing = title;
    if (byAct && under.length === 1) billing = under[0];
    const s = ISO.exec(p.start || ""), e = ISO.exec(p.end || ""), stage = String(p.stage || "").trim();
    if (!s || !e) throw new Error(`dostuff-embed: performance ${p.id} (${billing}) prints "${p.start}" to "${p.end}", not two times with their offsets`);
    if (!billing || !stage) throw new Error(`dostuff-embed: performance ${p.id} has no name or no stage`);
    for (const [x, iso] of [[s, p.start], [e, p.end]])
      if (x[4] !== zoneOffset(iso, timezone)) throw new Error(`dostuff-embed: ${billing} prints ${iso}, whose offset is not ${timezone}'s`);
    if (Date.parse(p.end) <= Date.parse(p.start)) throw new Error(`dostuff-embed: ${billing} ends at or before its start (${p.start} to ${p.end})`);
    if (Date.parse(p.end) - Date.parse(p.start) > 12 * 36e5) throw new Error(`dostuff-embed: ${billing} runs over twelve hours`);
    const date = +s[2] < rolloverHour ? nextDate(s[1], -1) : s[1];
    if (!run.includes(date)) throw new Error(`dostuff-embed: ${billing} starts ${p.start}, on ${date}, outside the run ${startDate} to ${endDate}`);
    const set = { id: p.id, date, stage, start: `${s[2]}:${s[3]}`, end: `${e[2]}:${e[3]}`, artist: billing,
      billedUnder: under.sort(), startIso: p.start, endIso: p.end, ...(billing !== title && { title }) };
    const twin = sets.find(x => x.stage === stage && x.startIso === p.start && x.endIso === p.end && x.artist === billing);
    if (twin) { drawnTwice.push(set); continue; }
    sets.push(set);
  }
  sets.sort((a, b) => a.date.localeCompare(b.date) || a.stage.localeCompare(b.stage) || a.startIso.localeCompare(b.startIso));
  for (let i = 1; i < sets.length; i++) {
    const a = sets[i - 1], b = sets[i];
    if (a.stage === b.stage && Date.parse(b.startIso) < Date.parse(a.endIso)) throw new Error(`dostuff-embed: ${a.artist} and ${b.artist} overlap on ${a.stage}`);
  }
  const days = run.map(date => ({ date, sets: sets.filter(x => x.date === date) }));
  return { name, startDate, endDate, run, timezone, grouping: g.name, lineups: g.lineups.map(l => l.name), byAct,
    artists, performances: sets.length, stages: [...new Set(sets.map(x => x.stage))], days, sets, drawnTwice,
    // The run's days the widget prints a set on (a gate day before the music,
    // or a last morning after it, prints none).
    setDays: days.filter(d => d.sets.length).map(d => d.date) };
}
