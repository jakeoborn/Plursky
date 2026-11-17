// myscheduler-schedule.mjs — Outside Lands' official schedule planner for
// 2010 and 2011 (myscheduler.sfoutsidelands.com, built by Gupta Media), read
// from an archived capture. Format "myscheduler-data".
//
// The page draws its grid in the browser from data written into the page
// itself: `festivalStart = Date.parseExact("2011-08-12", "yyyy-MM-dd")`, a
// `var venueMap = { 1: {id: 1, line1: "Lands End", line2: 'Polo Field', …},
// … };` of stages and a `var entityMap = { 39: { id: 39, venueId: 1, line1:
// 'New Orleans Klezmer Allstars', line2: '', start: '2011-08-12 12:00:00',
// duration: 50, … }, … };` of sets. A set's start is the festival's wall
// clock with its date (the page renders it "h:mm tt"), and its duration is in
// minutes, so every set has a start, an end and a stage, with no reading of
// am/pm. 2011's page writes the same two maps twice, and the copies must
// agree.
//
// A set is entityMap's line1, as written. line2 is a subtitle the page prints
// under it: on the music stages it is empty; a stage whose sets carry one
// (2011's Barbary: "Vau de Vire Variety Show") comes back with it, for the
// caller to rule on. An entry with no stage or no start ("DJ Proof" in 2011)
// is not drawn on the grid: it comes back in `unscheduled`, never as a set.
// An entry marked `copy` (a second showing of the same act, `primaryId` its
// first) is a set of its own: it prints its own start.

const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// A JS literal value as the page writes it: a quoted string (with \' and \\
// escapes), null, true, false or an integer.
function literal(v, where) {
  v = v.trim();
  const q = /^(['"])((?:[^\\]|\\.)*)\1$/s.exec(v);
  if (q) return q[2].replace(/\\(.)/g, "$1");
  if (v === "null") return null;
  if (v === "true" || v === "false") return v === "true";
  if (/^-?\d+$/.test(v)) return +v;
  throw new Error(`${where}: cannot read the value ${v.slice(0, 40)}`);
}

// The fields of one `{ key: value, … }` object, in order, read token by token
// so that a comma or brace inside a quoted string is never a separator.
function fields(body, where) {
  const out = {}, re = /\s*(\w+)\s*:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[^,'"]*?)\s*(?:,|$)/sy;
  let m;
  while (re.lastIndex < body.length && (m = re.exec(body))) {
    if (!m[0].trim()) break;
    if (m[1] in out) throw new Error(`${where}: field ${m[1]} written twice`);
    out[m[1]] = literal(m[2], `${where} ${m[1]}`);
  }
  if (body.slice(re.lastIndex).trim()) throw new Error(`${where}: cannot read "${body.slice(re.lastIndex, re.lastIndex + 40).trim()}"`);
  return out;
}

// Every `N: { … }` entry of a `var <name> = { … };` map, keyed by N, which
// must be the entry's own id. A quoted string never closes an entry.
function readMap(src, name) {
  const at = src.indexOf(`var ${name} = {`);
  if (at < 0) return null;
  let i = at + `var ${name} = {`.length;
  const map = new Map();
  for (;;) {
    const head = /\s*(?:(\d+)\s*:\s*\{|\}\s*;)/y; head.lastIndex = i;
    const h = head.exec(src);
    if (!h) throw new Error(`${name}: cannot read the map at "${src.slice(i, i + 40).trim()}"`);
    i = head.lastIndex;
    if (!h[1]) break;
    let j = i, quote = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (quote) { if (c === "\\") j++; else if (c === quote) quote = null; }
      else if (c === "'" || c === '"') quote = c;
      else if (c === "}") break;
    }
    const rec = fields(src.slice(i, j), `${name} ${h[1]}`);
    if (rec.id !== +h[1]) throw new Error(`${name} ${h[1]}: its id is ${rec.id}`);
    if (map.has(+h[1])) throw new Error(`${name} ${h[1]}: written twice`);
    map.set(+h[1], rec);
    const sep = /\s*,?/y; sep.lastIndex = j + 1; sep.exec(src); i = sep.lastIndex;
  }
  return { map, end: i };
}

// Every copy of a map the page writes; they must all be the same.
function onlyMap(html, name) {
  const copies = [];
  let rest = html, off = 0;
  for (;;) {
    const r = readMap(rest, name);
    if (!r) break;
    copies.push(r.map);
    rest = rest.slice(r.end); off += r.end;
  }
  if (!copies.length) throw new Error(`no ${name} on the page`);
  const json = m => JSON.stringify([...m.entries()]);
  if (copies.some(c => json(c) !== json(copies[0]))) throw new Error(`the page writes ${name} ${copies.length} times, and the copies differ`);
  return copies[0];
}

const plainName = s => String(s).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function parseMyScheduler(html, { year } = {}) {
  const starts = [...html.matchAll(/festivalStart = Date\.parseExact\("(\d{4}-\d{2}-\d{2})", "yyyy-MM-dd"\)/g)].map(m => m[1]);
  if (!starts.length) throw new Error("the page writes no festivalStart");
  if (new Set(starts).size !== 1) throw new Error(`the page writes festivalStart as ${[...new Set(starts)].join(" and ")}`);
  const festivalStart = starts[0];
  if (year && !festivalStart.startsWith(`${year}-`)) throw new Error(`festivalStart ${festivalStart} is not in ${year}`);
  const venues = onlyMap(html, "venueMap"), entities = onlyMap(html, "entityMap");
  for (const [id, v] of venues) if (typeof v.line1 !== "string" || !plainName(v.line1)) throw new Error(`venueMap ${id}: no stage name`);
  const names = [...venues.values()].map(v => plainName(v.line1));
  if (new Set(names).size !== names.length) throw new Error(`venueMap names a stage twice: ${names.join(", ")}`);

  const byDate = new Map(), unscheduled = [];
  for (const [id, e] of entities) {
    const where = `entityMap ${id}`;
    const billing = plainName(e.line1 ?? "");
    if (!billing) throw new Error(`${where}: no billing`);
    if (e.start === null || e.venueId === null) { unscheduled.push(billing); continue; }
    const v = venues.get(e.venueId);
    if (!v) throw new Error(`${where}: venueId ${e.venueId} is not in venueMap`);
    const t = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):00$/.exec(String(e.start));
    if (!t) throw new Error(`${where}: start "${e.start}" is not a wall-clock time`);
    const dur = e.duration;
    if (!Number.isInteger(dur) || dur < 5 || dur > 360) throw new Error(`${where}: a duration of ${dur} minutes`);
    // Music runs from noon into the night: a start before 6 AM would belong
    // to the day before, which no page here prints.
    if (+t[2] < 6 || +t[2] > 23 || +t[3] > 59) throw new Error(`${where}: starts at ${t[2]}:${t[3]}`);
    const start = +t[2] * 60 + +t[3];
    const set = { id, stage: plainName(v.line1), start: hhmm(start), end: hhmm(start + dur), artist: billing, duration: dur, printedStart: e.start,
      ...(plainName(e.line2 ?? "") && { subtitle: plainName(e.line2) }), ...(plainName(e.line3 ?? "") && { subtitle3: plainName(e.line3) }),
      ...(e.copy === true && { copyOf: e.primaryId }) };
    if (e.copy === true && !entities.has(e.primaryId)) throw new Error(`${where}: a copy of ${e.primaryId}, which is not in entityMap`);
    if (!byDate.has(t[1])) byDate.set(t[1], []);
    byDate.get(t[1]).push(set);
  }
  const dates = [...byDate.keys()].sort();
  if (!dates.length) throw new Error("the page schedules no set");
  if (dates[0] !== festivalStart) throw new Error(`the first day with sets is ${dates[0]}, festivalStart is ${festivalStart}`);
  const days = dates.map((date, i) => {
    const prev = i && new Date(dates[i - 1] + "T12:00:00Z"), cur = new Date(date + "T12:00:00Z");
    if (i && (cur - prev) !== 864e5) throw new Error(`the page schedules ${dates[i - 1]} and then ${date}, with no day between them`);
    const sets = byDate.get(date).sort((a, b) => a.stage.localeCompare(b.stage) || a.start.localeCompare(b.start));
    // Two sets on one stage never overlap.
    for (let k = 1; k < sets.length; k++)
      if (sets[k].stage === sets[k - 1].stage && sets[k].start < sets[k - 1].end)
        throw new Error(`${date} ${sets[k].stage}: "${sets[k].artist}" at ${sets[k].start} starts before "${sets[k - 1].artist}" ends at ${sets[k - 1].end}`);
    const first = sets.map(x => x.printedStart).sort()[0];
    return { date, label: date, weekday: WEEKDAYS[cur.getUTCDay()], firstStart: first, stages: [...new Set(sets.map(x => x.stage))], sets };
  });
  return { festivalStart, stages: names, days, unscheduled: unscheduled.sort() };
}

// The 2010 page's capture comes back with a few letters it cannot decode,
// each written as a run of U+FFFD ("Janelle Mon��e"). A billing is
// restored only by a name the receipt gives that matches it exactly, each
// such run standing for one non-ASCII letter: every other character is the
// page's. Returns the name, or null if it is not such a reading.
export const UNDECODED = /�+/g;
export function restoreBilling(printed, name) {
  if (!/\uFFFD/.test(printed)) return null;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("^" + printed.split(UNDECODED).map(esc).join("[^\\x00-\\x7F\\uFFFD]") + "$", "u");
  return re.test(name) ? name : null;
}

// Every set of the page with its billing restored by the receipt's names.
// Each undecodable billing must be restored by exactly one name, and each
// name must restore at least one billing.
export function restoreSets(page, names = []) {
  const used = new Set(), restored = [];
  const days = page.days.map(d => ({ ...d, sets: d.sets.map(x => {
    if (!/�/.test(x.artist)) return x;
    const hits = names.filter(n => restoreBilling(x.artist, n));
    if (hits.length !== 1) throw new Error(`${d.date} ${x.stage} ${x.start}: "${x.artist}" has letters the capture cannot decode, and ${hits.length} restored name(s) read it`);
    used.add(hits[0]); restored.push({ printed: x.artist, as: hits[0] });
    return { ...x, artist: hits[0], undecoded: x.artist };
  }) }));
  const idle = names.filter(n => !used.has(n));
  if (idle.length) throw new Error(`restored name(s) reading no billing on the page: ${idle.join(", ")}`);
  return { ...page, days, restored };
}
