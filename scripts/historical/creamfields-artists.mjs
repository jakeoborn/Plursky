// creamfields-artists.mjs — Creamfields' own Artists page (creamfields.com
// /artists, 2017-2019 site), read from an archived capture, as a LINEUP: who
// plays which day, and on which stage where the page pairs them. No times.
//
// The page prints the whole A-Z at once, whatever its /page/N address says
// (pages 2 and 3 of June 2017 hold the same 230 names): a filter bar with the
// festival's days ("Thursday" … "Sunday", weekday names only, no dates) and
// one block per act:
//
//   <div class="item [featured] friday saturday A"> — the days the act plays,
//     as the filter's weekday classes, and its A-Z letter;
//   <span class="name">Armin Van Buuren</span>;
//   <h4>Playing:</h4> then one <a class="playing" href="…/lineup/armada">
//     Armada</a> per stage, or none.
//
// An act on ONE day is billed on that day at each stage it lists. An act on
// two or more days lists its stages without saying which day each is (Armin
// van Buuren 2017: Friday and Saturday, Armada and South Stage), so it is
// billed on each day with no stage, and the pairing it did not print is
// returned in `unpaired` for the ledger.
//
// The page prints no dates. The weekday classes name days; their dates must be
// proved elsewhere (the festival's home page title in the same year).
//
// Throws on anything it cannot confirm: a title that is not "[cinch presents]
// Creamfields <year> | Artists", no day filter, an act with no name, an act on no day or on a day
// the filter does not offer, or a block class it does not know.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&#8211;": "–", "&#8217;": "’", "&#8216;": "‘" };
const MARK = { uml: "̈", acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", ring: "̊" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
// A slash the site's template escaped as "\/" ("Steel Yard Presents s\/stem")
// is the slash it prints.
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\\\//g, "/").replace(/\s+/g, " ").trim();
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const cap = w => w[0].toUpperCase() + w.slice(1);

export function parseCreamfieldsArtists(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  // 2021-2022 the festival was billed "cinch presents Creamfields <year>".
  if (title !== `Creamfields ${year} | Artists` && title !== `cinch presents Creamfields ${year} | Artists`) throw new Error(`creamfields-artists: the title "${title}" is not Creamfields ${year} | Artists`);
  // The day filter, in the page's order.
  const filter = [...text.matchAll(/<input type="checkbox" data-filter="and" name="(\w+)" id="\w+" value="\w+">/g)].map(m => m[1])
    .filter(d => WEEKDAYS.includes(cap(d))).map(cap);
  if (!filter.length) throw new Error("creamfields-artists: no day filter");
  if (new Set(filter).size !== filter.length) throw new Error(`creamfields-artists: the day filter prints a day twice (${filter.join(", ")})`);
  const blocks = text.split(/<div class="item /).slice(1);
  if (!blocks.length) throw new Error("creamfields-artists: no act");
  const acts = [];
  for (const b of blocks) {
    // "featured", then the act's days, then its key: its A-Z letter
    // (2017-2019, 2022) or its whole name in capitals (2021).
    const cls = plain(b.slice(0, b.indexOf('"'))).split(/\s+/).filter(Boolean);
    const name = plain(/<span class="name[^"]*">([\s\S]*?)<\/span>/.exec(b)?.[1] || "");
    if (!name) throw new Error(`creamfields-artists: an act (${cls.join(" ")}) has no name`);
    const featured = cls[0] === "featured", rest = cls.slice(featured ? 1 : 0), days = [];
    while (rest.length && WEEKDAYS.includes(cap(rest[0]))) {
      const d = cap(rest.shift());
      if (!filter.includes(d)) throw new Error(`creamfields-artists: ${name} plays ${d}, a day the filter does not offer`);
      days.push(d);
    }
    // The template capitalises ASCII letters only ("KöLSCH"), and cut a name
    // that opens with a letter outside ASCII to its first byte, which the page
    // shows as "\uFFFD" (Ørjan Nilsen 2019).
    const key = rest.join(" "), up = s => s.replace(/[a-z]/g, c => c.toUpperCase());
    if (key !== up(name) && key !== up(name[0]) && !(key === "\uFFFD" && /^[^\x00-\x7f]/.test(name)))
      throw new Error(`creamfields-artists: ${name} carries a class "${key}" the page does not explain`);
    if (!days.length) throw new Error(`creamfields-artists: ${name} plays no day`);
    // The block ends before the next one; take its Playing links only.
    const body = b.split(/<\/article>/)[0];
    const stages = [...body.matchAll(/<a class="playing" href="[^"]*">([\s\S]*?)<\/a>/g)].map(m => plain(m[1]));
    if (stages.some(s => !s)) throw new Error(`creamfields-artists: ${name} lists a stage with no name`);
    acts.push({ artist: name, days, stages, featured });
  }
  return { title, filter, acts };
}

// The page's acts as rows (artist, weekday, stage), and the pairings it left
// unprinted.
//
// A stage printed in two spellings that differ only in case (2018's
// "Sub_aural" ten times and "Sub_Aural" once) is one stage, billed under the
// spelling the page prints most (the first printed, on a tie); `folded` lists
// each spelling it replaced.
//
// WordPress titles a stage page the site had not published "Private: <name>"
// (2019's "Private: Blow", 2021's "Private: Pepsi Max"); the prefix is the
// CMS's, not the stage's, so it is dropped before folding.
const unprivate = s => s.replace(/^Private: (?=\S)/, "");
export function creamfieldsRows(page) {
  const rows = [], unpaired = [], seen = new Set(), count = new Map();
  for (const a of page.acts) for (const s of a.stages) count.set(unprivate(s), (count.get(unprivate(s)) || 0) + 1);
  const spelling = new Map(), folded = [];
  for (const [s, n] of count) {
    const k = s.toLowerCase(), best = spelling.get(k);
    if (!best || n > count.get(best)) spelling.set(k, s);
  }
  const printed = new Set(page.acts.flatMap(a => a.stages));
  const stageOf = s => spelling.get(unprivate(s).toLowerCase());
  for (const s of printed) if (stageOf(s) !== s) folded.push({ printed: s, billedAs: stageOf(s) });
  // An act printed in two blocks whose names differ only in case (2018's
  // "Ilan Bluestone" and "ILAN BLUESTONE", both Saturday on Generator) is one
  // act, billed under its first spelling; `sameActs` lists each other one.
  const actName = new Map(), sameActs = [];
  for (const a of page.acts) {
    const k = a.artist.toLowerCase();
    if (!actName.has(k)) actName.set(k, a.artist);
    else if (actName.get(k) !== a.artist && !sameActs.some(x => x.printed === a.artist)) sameActs.push({ printed: a.artist, billedAs: actName.get(k) });
  }
  const add = (name, weekday, stage) => { const artist = actName.get(name.toLowerCase()), k = `${artist}\t${weekday}\t${stage}`; if (!seen.has(k)) { seen.add(k); rows.push({ artist, weekday, stage }); } };
  for (const a of page.acts) {
    const stages = [...new Set(a.stages.map(stageOf))];
    if (a.days.length === 1) { for (const s of stages.length ? stages : [""]) add(a.artist, a.days[0], s); continue; }
    for (const d of a.days) add(a.artist, d, "");
    if (stages.length && !unpaired.some(x => x.artist === actName.get(a.artist.toLowerCase()))) unpaired.push({ artist: actName.get(a.artist.toLowerCase()), days: a.days, stages });
  }
  return { rows, unpaired, folded, sameActs };
}
