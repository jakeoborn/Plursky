// insomniac-music-schedule.mjs — EDC Las Vegas's own music page for 2012 and
// 2013 (electricdaisycarnival.com/LasVegas/music.php?stage=all in 2012,
// electricdaisycarnival.com/music.php in 2013), read from an archived
// capture. Format "insomniac-music".
//
// One page prints every day, sorted by stage. Two templates:
//   - 2012: <div class="stage-group group"> per stage, its name in
//     <h3 class="all-stage-title">, then one <div class="lineup-day friday">
//     per day with its heading in <h2> ("Friday - June 8th", no year), an
//     optional host (<h3 class="sponsor">Hosted By: Size Matters</h3>) and,
//     per set, <h3 class="no-date"><a …artist.php?id=N>Fedde le Grand</a></h3>
//     <p class="set-time">4:30AM - 5:30AM</p>;
//   - 2013: after <!-- STAGE SORT -->, <div class="stage clearfix stage-all
//     stage-<slug>"> per stage, its name in <h3>, then one <div class="day">
//     per day with its heading in <h5> ("Fri - June 21st", sometimes followed
//     by a host logo, <div class="host hard">) and, per set, a <div
//     class="artist"> that prints the act and range twice: <h3><span>Borgore
//     <br><em>4:30AM - 5:30AM</em></span></h3> and <h4>Borgore<br><span>4:30AM
//     - 5:30AM</span></h4>. The two readings must agree.
// Both print stages in the page's own stage menu, which must be the stages
// the page sorts by, in the same order (a stage with no set is checked, not
// read). The page's title (2012) or description (2013, "… Sunday June 23rd
// 2013 …") must name Electric Daisy Carnival and the year, and the page must
// name Las Vegas (its title, or its own og:url path).
//
// The music runs from the evening to 5:30 AM, so a time before noon is that
// day's night (12:30AM on "Friday" is early Saturday). Every range prints its
// own am or pm. A range that runs backwards or over eight hours, or two sets
// printed on one stage at once, come back in `misprints`, never as sets. The
// same act printed twice with the same range on one stage and day is one set
// (`repeats` counts the second). A day's host is a label, not a set.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ENT = { "&amp;": "&", "&nbsp;": " ", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&rsquo;": "’", "&lsquo;": "‘", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…", "&eacute;": "é", "&lt;": "<", "&gt;": ">" };
const pad = n => String(n).padStart(2, "0");
const hhmm = v => `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();
const weekdayOf = iso => WEEKDAYS[new Date(iso + "T12:00:00Z").getUTCDay()];
// "4:30AM" → minutes since midnight; null unless a 12-hour clock with am/pm.
const clock = t => {
  const m = /^(\d{1,2}):(\d{2}) ?([AP]M)$/i.exec(String(t).trim());
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) return null;
  return (+m[1] % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + +m[2];
};

// The date a day heading names in `year`, or null: "Friday - June 8th" or
// "Fri - June 21st", the weekday (whole or its first three letters) the
// date's own.
export function printedDate(label, year) {
  const m = /^([A-Za-z]{3,9}) - ([A-Za-z]+) (\d{1,2})(st|nd|rd|th)$/.exec(String(label || "").trim());
  const mo = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
  if (!mo || !year) return null;
  const iso = `${year}-${pad(mo)}-${pad(+m[3])}`, d = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  const sfx = +m[3] % 10 === 1 && +m[3] !== 11 ? "st" : +m[3] % 10 === 2 && +m[3] !== 12 ? "nd" : +m[3] % 10 === 3 && +m[3] !== 13 ? "rd" : "th";
  if (m[4] !== sfx) return null;
  const wd = weekdayOf(iso), w = m[1].toLowerCase();
  return w === wd || (w.length === 3 && wd.startsWith(w)) ? iso : null;
}

// One page → { template, title, yearFrom, place, stages, blank, days: [{ date, label,
// weekday, hosts, sets, misprints, repeats }] }.
export function parseInsomniacMusic(html, { year } = {}) {
  if (!year) throw new Error("no year");
  const title = plain(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "");
  const desc = plain(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "");
  const namesYear = s => /Electric Daisy Carnival/.test(s) && new RegExp(`\\b${year}\\b`).test(s);
  const yearFrom = namesYear(title) ? "the page's title" : namesYear(desc) ? "the page's description" : null;
  if (!yearFrom) throw new Error(`neither the page's title nor its description names Electric Daisy Carnival ${year}: "${title}" / "${desc}"`);
  const ogUrl = /<meta property="og:url" content="([^"]*)"/.exec(html)?.[1] ?? "";
  const place = /Las Vegas/.test(title) ? "the page's title" : /\/LasVegas\//i.test(ogUrl) ? "the page's own og:url" : null;
  if (!place) throw new Error(`the page does not name Las Vegas (title "${title}", og:url "${ogUrl}")`);

  let template, groups, menu;
  if (html.includes('<div class="stage-group group">')) {
    template = "2012";
    const nav = /<ul id="lineup-nav">([\s\S]*?)<\/ul>/.exec(html);
    menu = nav ? [...nav[1].matchAll(/music\.php\?stage=(?!all)[\w-]+">([\s\S]*?)<\/a>/g)].map(x => plain(x[1])) : [];
    const at = [...html.matchAll(/<div class="stage-group group">/g)];
    groups = at.map((g, i) => {
      const seg = html.slice(g.index, i + 1 < at.length ? at[i + 1].index : html.indexOf("<!-- end #lineup-inner -->", g.index) >>> 0 || undefined);
      const stage = plain(/<h3 class="all-stage-title">([\s\S]*?)<\/h3>/.exec(seg)?.[1] ?? "");
      const dh = [...seg.matchAll(/<div class="lineup-day ([\w-]+)">/g)];
      const days = dh.map((d, k) => {
        const body = seg.slice(d.index, k + 1 < dh.length ? dh[k + 1].index : undefined);
        const label = plain(/<h2>([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? "");
        const hosts = [...body.matchAll(/<h3 class="sponsor">([\s\S]*?)<\/h3>/g)].map(x => plain(x[1]).replace(/^Hosted By:\s*/i, ""));
        const h3s = [...body.matchAll(/<h3 class="([\w -]*)">([\s\S]*?)<\/h3>/g)].filter(x => x[1] !== "sponsor");
        const blocks = [...body.matchAll(/<h3 class="no-date">([\s\S]*?)<\/h3>\s*<p class="set-time">([\s\S]*?)<\/p>/g)]
          .map(x => ({ artist: plain(x[1]), printed: plain(x[2]) }));
        if (h3s.length !== blocks.length) throw new Error(`${stage} "${label}": ${h3s.length} act heading(s) but ${blocks.length} with a set time`);
        return { label, cls: d[1], hosts, blocks };
      });
      return { stage, days };
    });
  } else {
    const st = html.indexOf("<!-- STAGE SORT -->");
    if (st < 0) throw new Error("no stage sort");
    template = "2013";
    const ctl = html.slice(0, st);
    menu = [...ctl.matchAll(/class="stage stage-(?!all")[\w-]+" data-filter="stage-">([\s\S]*?)<\/a>/g)].map(x => plain(x[1]));
    const body = html.slice(st);
    const at = [...body.matchAll(/<div class="stage clearfix stage-all stage-([\w-]+)">/g)];
    groups = at.map((g, i) => {
      const seg = body.slice(g.index, i + 1 < at.length ? at[i + 1].index : body.indexOf("<!-- END STAGE SORT", g.index) >>> 0 || undefined);
      const stage = plain(/<h3>([\s\S]*?)<\/h3>/.exec(seg)?.[1] ?? "");
      const dh = [...seg.matchAll(/<div class="day">/g)];
      const days = dh.map((d, k) => {
        const part = seg.slice(d.index, k + 1 < dh.length ? dh[k + 1].index : undefined);
        const h5 = /<h5>([\s\S]*?)<\/h5>/.exec(part)?.[1] ?? "";
        const hosts = [...h5.matchAll(/<div class="host ([\w-]+)">/g)].map(x => x[1]);
        const label = plain(h5.replace(/<div class="host[\s\S]*?<\/div>/g, ""));
        const arts = part.split(/<div class="artist">/).slice(1);
        const blocks = arts.map(a => {
          const top = /<h3>\s*<span>([\s\S]*?)<br\s*\/?>\s*<em>([\s\S]*?)<\/em>/.exec(a);
          const bot = /<h4>([\s\S]*?)<br\s*\/?>\s*<span>([\s\S]*?)<\/span>/.exec(a);
          if (!top || !bot) throw new Error(`${stage} "${label}": an act block without ${top ? "its second" : "its first"} reading`);
          const r = [plain(top[1]), plain(top[2])], s = [plain(bot[1]), plain(bot[2])];
          return { artist: r[0], printed: r[1], ...(r.join("|") !== s.join("|") && { disagree: `${r.join(" ")} / ${s.join(" ")}` }) };
        });
        return { label, hosts, blocks };
      });
      return { stage, days };
    });
  }
  if (!groups.length) throw new Error("no stages");
  const names = groups.map(g => g.stage);
  if (names.some(s => !s) || new Set(names).size !== names.length) throw new Error(`stage names ${names.join(", ")}`);
  if (menu.join("|") !== names.join("|")) throw new Error(`the stage menu (${menu.join(", ")}) is not the stages the page sorts by (${names.join(", ")})`);

  // Every stage prints the same days, in the same order.
  const labels = groups[0].days.map(d => d.label);
  if (!labels.length) throw new Error(`${names[0]}: no days`);
  for (const g of groups) if (g.days.map(d => d.label).join("|") !== labels.join("|")) throw new Error(`${g.stage} prints days ${g.days.map(d => d.label).join(", ")}, not ${labels.join(", ")}`);
  const dates = labels.map(l => { const d = printedDate(l, year); if (!d) throw new Error(`the day heading "${l}" names no date in ${year}`); return d; });
  if (new Set(dates).size !== dates.length) throw new Error("the page prints a day twice");
  for (let i = 1; i < dates.length; i++)
    if (new Date(dates[i] + "T12:00:00Z") - new Date(dates[i - 1] + "T12:00:00Z") !== 864e5) throw new Error(`the page prints ${dates[i - 1]} and then ${dates[i]}`);
  if (template === "2012") for (const g of groups) g.days.forEach((d, i) => { if (d.cls !== weekdayOf(dates[i])) throw new Error(`${g.stage} "${d.label}": its day class is "${d.cls}"`); });

  const blank = groups.filter(g => g.days.every(d => !d.blocks.length)).map(g => g.stage);
  const days = dates.map((date, i) => {
    const sets = [], misprints = [], hosts = [];
    let repeats = 0;
    for (const g of groups) {
      const d = g.days[i], stage = g.stage;
      for (const h of d.hosts) hosts.push(`${stage}: ${h}`);
      const read = [];
      for (const b of d.blocks) {
        const where = `${date} ${stage} "${b.artist}"`;
        if (!b.artist) throw new Error(`${date} ${stage}: an act with no name`);
        if (b.disagree) { misprints.push({ stage, artist: b.artist, printed: b.printed, misprint: `the block prints two readings (${b.disagree})` }); continue; }
        const rm = /^(\d{1,2}:\d{2} ?[AP]M) ?- ?(\d{1,2}:\d{2} ?[AP]M)$/i.exec(b.printed);
        let a = rm && clock(rm[1]), e = rm && clock(rm[2]);
        if (a === null || e === null) throw new Error(`${where}: cannot read the range "${b.printed}"`);
        if (a < 720) a += 1440;            // before noon is this day's night
        if (e < 720) e += 1440;
        if (e <= a || e - a > 480) { misprints.push({ stage, artist: b.artist, printed: b.printed, misprint: e <= a ? "the range runs backwards" : "the range runs over eight hours" }); continue; }
        if (read.some(x => x.artist === b.artist && x.printed === b.printed)) { repeats++; continue; }
        read.push({ stage, artist: b.artist, printed: b.printed, a, e });
      }
      // Two sets on one stage at once: neither time can be confirmed.
      const bad = new Set();
      for (const x of read) for (const y of read) if (x !== y && x.a < y.e && y.a < x.e) { bad.add(x); bad.add(y); }
      for (const x of read.sort((p, q) => p.a - q.a)) {
        if (bad.has(x)) misprints.push({ stage, artist: x.artist, printed: x.printed, misprint: "printed while another set on the stage is still on" });
        else sets.push({ stage, start: hhmm(x.a), end: hhmm(x.e), artist: x.artist, printed: x.printed });
      }
    }
    return { date, label: labels[i], weekday: weekdayOf(date), hosts, sets, misprints, repeats };
  });
  if (!days.some(d => d.sets.length)) throw new Error("no sets");
  return { template, title, yearFrom, place, stages: names, blank, days };
}
