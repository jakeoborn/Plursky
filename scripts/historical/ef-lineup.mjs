// ef-lineup.mjs — Electric Forest's own lineup page for one edition, read
// from an archived capture, as a LINEUP: who was billed, and nothing more.
// These pages print no day, no stage and no time for any act.
//
// Two templates, both on electricforestfestival.com:
//
//   "drupal" (2011, /lineup/artists): the title prints the edition and its
//     run, "2011 Artist Lineup | Electric Forest Festival :: June 30 - July 3,
//     2011 :: Rothbury, Michigan"; then one artist per grid cell,
//     <div class="views-field-title"><span class="field-content"><a …><h2>
//     The String Cheese Incident</h2></a></span></div>. A live page drew each
//     <h2> with Cufón, so a rendered copy carries the name as one <cufontext>
//     per word inside it; either way the name is the <h2>'s text.
//
//   "wordpress" (2016, /experience/lineup/): the title prints the year only,
//     "2016 Lineup | Electric Forest Festival", the page heading "EF 2016
//     Lineup"; then <section class="full_lineup"> with one list per billing
//     tier (<div class="first_tier lineup-list">, "second_tier" …), each act
//     an <a … class="artist" title="Name">Name</a>.
//
// Throws on anything it cannot confirm: a title that is not either
// template's for `year`, a 2016-template page whose heading is not "EF <year>
// Lineup", a 2011-template run that is not real dates in `year`, no act, an
// act with no name, or an act listed twice.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&#8211;": "–", "&#8217;": "’", "&#8216;": "‘" };
const MARK = { uml: "̈", acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", ring: "̊" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = n => String(n).padStart(2, "0");
const real = d => { const t = new Date(d + "T12:00:00Z"); return !isNaN(t) && t.toISOString().slice(0, 10) === d; };

// "June 30 - July 3, 2011" (or "June 23 - 26, 2016") → every date of the run,
// or null when it is not a run of real dates in `year`.
export function printedRun(printed, year) {
  const m = /^([A-Z][a-z]+) (\d{1,2}) [-–] (?:([A-Z][a-z]+) )?(\d{1,2}), (\d{4})$/.exec(String(printed || "").trim());
  if (!m || +m[5] !== +year) return null;
  const m1 = MONTHS.indexOf(m[1]), m2 = m[3] ? MONTHS.indexOf(m[3]) : m1;
  if (m1 < 0 || m2 < 0) return null;
  const first = `${m[5]}-${pad(m1 + 1)}-${pad(m[2])}`, last = `${m[5]}-${pad(m2 + 1)}-${pad(m[4])}`;
  if (!real(first) || !real(last) || last <= first) return null;
  const out = [];
  for (let t = new Date(first + "T12:00:00Z"); t <= new Date(last + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1)) out.push(t.toISOString().slice(0, 10));
  return out.length <= 7 ? out : null;
}

export function parseEfLineup(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  let template, heading = null, printed = null, run = null, acts;
  const drupal = new RegExp(`^${year} Artist Lineup \\| Electric Forest Festival :: (.+?) :: Rothbury, Michigan$`).exec(title);
  if (drupal) {
    template = "drupal";
    printed = drupal[1];
    run = printedRun(printed, year);
    if (!run) throw new Error(`ef-lineup: the title's run "${printed}" is not dates in ${year}`);
    acts = [...text.matchAll(/<div class="views-field-title"><span class="field-content">([\s\S]*?)<\/span><\/div>/g)]
      .map(([, cell]) => /<h2>([\s\S]*?)<\/h2>/.exec(cell)?.[1] ?? "")
      .map(h => plain(h.replace(/<canvas[\s\S]*?<\/canvas>/g, "")));
  } else if (title === `${year} Lineup | Electric Forest Festival`) {
    template = "wordpress";
    heading = plain(/<div class="pageHeaderInner[^"]*">\s*<h3>([\s\S]*?)<\/h3>/.exec(text)?.[1] || "");
    if (heading !== `EF ${year} Lineup`) throw new Error(`ef-lineup: the page heading "${heading}" is not EF ${year} Lineup`);
    const section = /<section class="full_lineup">([\s\S]*?)<\/section>/.exec(text)?.[1];
    if (!section) throw new Error("ef-lineup: no full_lineup section");
    acts = [...section.matchAll(/<a [^>]*class="artist"[^>]*>([\s\S]*?)<\/a>/g)].map(([, a]) => plain(a));
  } else throw new Error(`ef-lineup: the title "${title}" is not an Electric Forest ${year} lineup page`);
  if (!acts.length) throw new Error(`ef-lineup: the ${year} page names no act`);
  if (acts.some(a => !a)) throw new Error(`ef-lineup: an act on the ${year} page has no name`);
  const dup = acts.find((a, i) => acts.indexOf(a) !== i);
  if (dup) throw new Error(`ef-lineup: ${dup} is listed twice`);
  return { template, title, heading, printed, run, acts };
}
