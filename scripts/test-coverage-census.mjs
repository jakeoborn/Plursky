#!/usr/bin/env node
// SPEC-182 census gate: data/historical/census/coverage-2010-2026.tsv.
//
// `occurred` means a source PUBLISHED strictly AFTER the edition's last day
// says it ran. The `published` column is the source's own date: an article's
// publication date, a Wayback copy's capture date (it must match the URL), or
// a Wikipedia revision's own EDIT timestamp ("YYYY-MM-DDTHH:MM:SSZ rev N", never
// the day it was read). The `fetched` column (when we
// read it) never counts: an old pre-event article read today is still
// pre-event. A source published on or before the last day, or with no
// publication date, proves the edition was SCHEDULED, not that it happened,
// and a note that admits the occurrence was assumed, inferred or only
// pre-event cannot sit on an `occurred` row. Those rows are
// `scheduled_unverified` ("scheduled, occurrence unverified"), evidence and
// dates kept.
//
// A date alone is not enough for the two archive kinds (2026-11-06 ruling):
//   · Wikipedia counts only when that revision's text reports the edition as
//     held. The note quotes it: `Revision N (edited TS) reports it: "..."`,
//     and the quote names the year (or is tagged "(range statement)" with
//     years that cover it), uses an occurrence verb or an attendance column,
//     and, in an article shared by several editions, names this one's place.
//   · A Wayback capture counts only when the captured content reports the
//     edition in the past tense: `Capture reports it: "..."`. A set-time page,
//     lineup page or graphic captured after the event is still a schedule.
//
// Rules, per row:
//   1. The header and the lifecycle vocabulary are exact.
//   2. Any row: a Wayback evidence URL's `published` equals its capture date;
//      a Wikipedia row's `published` names the revision read.
//   3. occurred / partly_canceled: `published` is strictly after the last
//      printed day; with no printed dates, after the year; and a Wikipedia or
//      Wayback source carries its quoted report (above).
//   4. occurred / partly_canceled: the note admits no assumption (ADMISSION).
//   5. scheduled_unverified: the evidence URL is kept, and the row really
//      fails rule 3 or 4 (no row is demoted without a reason).
// Then regressions on named rows and mutants on the TSV text, each caught.
//
//   node scripts/test-coverage-census.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data", "historical", "census", "coverage-2010-2026.tsv");
const HEADER = "family\tyear\tlifecycle\tdates\tvenue\tevidence_url\tevidence_kind\tfetched\tpublished\theld_record\theld_sets\theld_timed_sets\theld_stage_pins\tnote";
const LIFECYCLES = new Set(["occurred", "scheduled_unverified", "partly_canceled", "canceled", "not_founded", "hiatus", "pending", "unresearched"]);
// A note that says the occurrence itself was not shown. "Page path assumed" or
// "venue assumed" are about other fields and are not admissions.
export const ADMISSION = /occurrence (?:was )?assumed|assumed[^.;]*\b(?:ran|held|occurred|happened)\b|(?<!rather than )\binferred\b|\bsame inference\b|\bimpl(?:y|ies)\b[^.;]*\bran\b|pre-event (?:capture|only|source|poster)|not a report that|no post-event report|not proven/i;

export function parse(text) {
  const lines = text.replace(/\n$/, "").split("\n");
  const cols = lines[0].split("\t");
  return { header: lines[0], rows: lines.slice(1).map(l => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v]))) };
}
const lastDay = d => (d.match(/\d{4}-\d{2}-\d{2}/g) || []).sort().at(-1) || null;
const pubDay = p => (/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}Z rev \d+)?$/.exec(p || "") || [])[1] || null;
const WIKI_PUB = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) rev (\d+)$/;
// Words that report a held edition (past tense, or a figure only an event has).
export const HELD = /\b(?:was held|were held|held (?:on|at|over|in|from)|took place|happened|attended|attendance|attendees|drew|grossed|featured|headlined|performed|performing|playing|hosted|returned|reverted|debuted|celebrated|saw|was (?:a great success|at|visited|expanded|hosted)|were arrested|were reported|continued to (?:be held|keep)|kept the name|adopted the name|changed its name|staged|marked|occurring|spanning|conclusion of)\b/i;
// Articles that cover several editions: the quote must name this one.
const PLACE = { "edc-lv": /Las Vegas|Vegas/, "edc-orlando": /Orlando|Tinker/, "edc-mexico": /Mexico/, "beyond-wonderland-socal": /San Bernardino|Socal|SoCal/, "beyond-wonderland-gorge": /Gorge|George/ };
const yearsIn = q => (q.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g) || []).map(Number);
// Why a Wikipedia/Wayback source does not report the edition, or null.
export function archiveProblem(r) {
  if (r.evidence_kind === "wikipedia") {
    const m = WIKI_PUB.exec(r.published || ""); if (!m) return "the Wikipedia source is not dated by its revision's edit timestamp";
    const q = new RegExp(`Revision ${m[2]} \\(edited ${m[1]}\\) reports it: "([^"]*(?:"[^"]*)*?)"( \\(range statement\\)| \\(table row, "[^"]+" column\\)| \\(photo caption\\))?\\.(?:\\s|$)`).exec(r.note || "");
    if (!q) return `the note does not quote revision ${m[2]} (edited ${m[1]}) reporting the edition`;
    const [, text, tag = ""] = q; const ys = yearsIn(text), y = Number(r.year);
    if (tag.includes("range")) { const since = /since (\d{4})/.exec(text); if (!(since ? Number(since[1]) <= y : ys.length && Math.min(...ys) <= y && y <= Math.max(...ys))) return `the range quote does not cover ${r.year}`; }
    else if (!ys.includes(y)) return `the quoted passage does not name ${r.year}`;
    if (!tag.includes("table") && !HELD.test(text)) return "the quoted passage does not report the edition as held";
    if (PLACE[r.family] && !PLACE[r.family].test(text)) return `the quoted passage is not about this edition (${r.family})`;
    return null;
  }
  if (/web\.archive\.org\/web\/\d{8}/.test(r.evidence_url || "")) {
    const q = /Capture reports it: "([^"]+)"/.exec(r.note || "");
    if (!q) return "the Wayback capture's content is not quoted reporting the edition in the past tense";
    if (!yearsIn(q[1]).includes(Number(r.year)) || !HELD.test(q[1])) return "the quoted capture text does not report this year's edition in the past tense";
  }
  return null;
}
const capture = u => { const m = /web\.archive\.org\/web\/(\d{4})(\d{2})(\d{2})/.exec(u || ""); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
// Why an `occurred` claim is not supported, or null when it is. Never reads `fetched`.
export function occurredProblem(r) {
  const pub = pubDay(r.published);
  const end = lastDay(r.dates || "");
  if (!pub) return "the source has no publication date";
  if (end && !(pub > end)) return `the source was published ${pub}, not after the last day (${end})`;
  if (!end && !(pub > `${r.year}-12-31`)) return `no printed dates and the source (${pub}) is not after ${r.year}`;
  if (ADMISSION.test(r.note || "")) return `the note admits it: "${ADMISSION.exec(r.note)[0]}"`;
  return archiveProblem(r);
}

export function check(text) {
  const fails = []; let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  const { header, rows } = parse(text);
  t(header === HEADER, "the header is exact");
  t(rows.length === 425, `25 families × 17 years = 425 rows (got ${rows.length})`);
  const seen = new Set();
  for (const r of rows) {
    const id = `${r.family} ${r.year}`;
    if (seen.has(id)) fails.push(`${id}: duplicate row`); seen.add(id);
    if (!LIFECYCLES.has(r.lifecycle)) fails.push(`${id}: unknown lifecycle "${r.lifecycle}"`);
    if (r.published && !pubDay(r.published)) fails.push(`${id}: published "${r.published}" is not YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ rev N`);
    const cap = capture(r.evidence_url);
    if (cap && pubDay(r.published) !== cap) fails.push(`${id}: a Wayback copy is published on its capture date ${cap}, not "${r.published}"`);
    if (r.evidence_kind === "wikipedia" && !WIKI_PUB.test(r.published || "")) fails.push(`${id}: a Wikipedia source is dated by its revision's edit timestamp ("YYYY-MM-DDTHH:MM:SSZ rev N"), not "${r.published}"`);
    // partly_canceled also says the edition ran, so it meets the same bar.
    if (r.lifecycle === "occurred" || r.lifecycle === "partly_canceled") { const p = occurredProblem(r); if (p) fails.push(`${id}: ${r.lifecycle}, but ${p}`); }
    if (r.lifecycle === "scheduled_unverified") {
      if (!r.evidence_url) fails.push(`${id}: scheduled_unverified lost its evidence`);
      if (!occurredProblem(r)) fails.push(`${id}: scheduled_unverified, but its source does prove occurrence`);
    }
  }
  n += rows.length;
  return { n, fails, rows };
}

const TEXT = readFileSync(FILE, "utf8");
const base = check(TEXT);
const all = [...base.fails];
const counts = {};
for (const r of base.rows) counts[r.lifecycle] = (counts[r.lifecycle] || 0) + 1;

// Controls: the rule must see the rows it is about.
const row = (f, y) => base.rows.find(r => r.family === f && r.year === String(y));
const ctl = [
  ["decadence-colorado", 2011, "scheduled_unverified"], ["summerfest", 2026, "scheduled_unverified"], ["acl", 2021, "scheduled_unverified"],
  ["arc", 2024, "scheduled_unverified"], ["countdown-nye", 2021, "scheduled_unverified"],
];
for (const [f, y, want] of ctl) if (row(f, y)?.lifecycle !== want) all.push(`control: ${f} ${y} is ${row(f, y)?.lifecycle}, want ${want}`);
if (!base.rows.some(r => r.lifecycle === "occurred")) all.push("control: some rows still occurred");
// Regressions (2026-11-06 review): three rows the fetch-date gate let through
// on pre-event articles. Each stays occurred only on two agreeing post-event
// dated sources: the evidence row's own `published`, plus a second one named
// with its date in the note, both strictly after the last day.
const TWO = [
  ["electric-forest", 2022, "2022-06-26", "2022-07-08"],
  ["iii-points", 2014, "2014-10-12", "2014-10-17"],
  ["iii-points", 2019, "2019-02-17", "2019-02-26"],
];
for (const [f, y, end, second] of TWO) {
  const r = row(f, y);
  if (r?.lifecycle !== "occurred") { all.push(`regression: ${f} ${y} is ${r?.lifecycle}, want occurred on two post-event sources`); continue; }
  if (!(pubDay(r.published) > end)) all.push(`regression: ${f} ${y} evidence published ${r.published}, not after ${end}`);
  if (!r.note.includes(second) || !(second > end)) all.push(`regression: ${f} ${y} note lacks the second post-event source dated ${second}`);
  if (!/pre-event: /.test(r.note)) all.push(`regression: ${f} ${y} note no longer keeps the earlier pre-event source`);
}
// Same-day and mid-event sources are not post-event.
for (const [f, y] of [["governors-ball", 2016], ["beyond-wonderland-gorge", 2023]])
  if (row(f, y)?.lifecycle !== "scheduled_unverified") all.push(`regression: ${f} ${y} (source published on or before its last day) is ${row(f, y)?.lifecycle}`);
// Regressions (2026-11-06 ruling 2): an archive counts only on what it says.
// Wikipedia rows with no passage for this edition (EDC Orlando 2013 sits in an
// article whose 2013 sentence is about Las Vegas; Lollapalooza 2025's only 2025
// passages are Brasil and India; Nocturnal 2012 is covered only by a format
// line), and Wayback captures that are still schedules (ACL 2014 set times,
// EDC Las Vegas 2024 "Page Not Found", Dreamstate SoCal 2017 lineup under
// Past Highlights) are scheduled_unverified.
for (const [f, y] of [["edc-orlando", 2013], ["lollapalooza", 2025], ["nocturnal-wonderland", 2012], ["acl", 2014], ["edc-lv", 2024], ["dreamstate-socal", 2017]])
  if (row(f, y)?.lifecycle !== "scheduled_unverified") all.push(`regression: ${f} ${y} (the archive does not report it held) is ${row(f, y)?.lifecycle}`);
{ const c = row("coachella", 2017);
  if (c?.published !== "2026-11-04T02:48:15Z rev 1383675426") all.push(`regression: coachella 2017 is dated by its revision's edit timestamp, got "${c?.published}"`);
  if (!/Revision 1383675426 \(edited 2026-11-04T02:48:15Z\) reports it: "The 2017 festival was attended by 250,000 people/.test(c?.note || "")) all.push("regression: coachella 2017 quotes its revision's report"); }
if (base.rows.some(r => (r.lifecycle === "occurred" || r.lifecycle === "partly_canceled") && capture(r.evidence_url) && !/Capture reports it: /.test(r.note)))
  all.push("regression: an occurred row stands on a Wayback capture without a quoted past-tense report");
for (const benign of ["Page path assumed, as for 2016.", "Venue assumed to continue", "so dates left blank rather than inferred."])
  if (ADMISSION.test(benign)) all.push(`control: "${benign}" is not an occurrence admission`);

// Mutants on the TSV text; each must be caught.
const lineOf = (f, y) => TEXT.split("\n").find(l => l.startsWith(`${f}\t${y}\t`));
const swap = (f, y, fn) => { const l = lineOf(f, y); return l ? TEXT.replace(l, fn(l)) : null; };
const okRow = base.rows.find(r => r.lifecycle === "occurred" && r.note && !ADMISSION.test(r.note));
const MUTANTS = [
  ["Decadence 2011 back to occurred", swap("decadence-colorado", 2011, l => l.replace("\tscheduled_unverified\t", "\toccurred\t"))],
  ["ACL 2021 back to occurred", swap("acl", 2021, l => l.replace("\tscheduled_unverified\t", "\toccurred\t"))],
  ["Lollapalooza 2015 (pre-event capture) back to occurred", swap("lollapalooza", 2015, l => l.replace("\tscheduled_unverified\t", "\toccurred\t"))],
  ["an 'occurrence assumed' note on an occurred row", okRow && swap(okRow.family, okRow.year, l => l.replace(/\t([^\t]*)$/, "\t$1 Occurrence assumed."))],
  ["a scheduled_unverified row with its evidence dropped", swap("arc", 2024, l => { const c = l.split("\t"); c[5] = ""; return c.join("\t"); })],
  // The review's case: an old pre-event article, read today.
  ["Electric Forest 2022 on the pre-event WZZM article (published 2022-06-22) with today's fetch date",
    swap("electric-forest", 2022, l => { const c = l.split("\t"); c[5] = "https://www.wzzm13.com/article/news/local/electric-forest-music-festival-returns-after-two-year-hiatus/69-23d67bb1-8398-4a8e-9905-066b8d3ad520"; c[7] = "2026-11-06"; c[8] = "2022-06-22"; return c.join("\t"); })],
  ["III Points 2014 on its set-times article (published 2014-10-06), fetched today",
    swap("iii-points", 2014, l => { const c = l.split("\t"); c[7] = "2026-11-06"; c[8] = "2014-10-06"; return c.join("\t"); })],
  ["Governors Ball 2016 back to partly_canceled on a same-day source", swap("governors-ball", 2016, l => l.replace("\tscheduled_unverified\t", "\tpartly_canceled\t"))],
  ["an occurred row with its publication date blanked (fetch date still post-event)", okRow && swap(okRow.family, okRow.year, l => { const c = l.split("\t"); c[8] = ""; return c.join("\t"); })],
  ["a Wayback row published later than its capture", (() => { const w = base.rows.find(r => capture(r.evidence_url)); return w && swap(w.family, w.year, l => { const c = l.split("\t"); c[8] = "2026-11-06"; return c.join("\t"); }); })()],
  ["a Wikipedia row without its revision id", (() => { const w = base.rows.find(r => r.lifecycle === "occurred" && r.evidence_kind === "wikipedia"); return w && swap(w.family, w.year, l => { const c = l.split("\t"); c[8] = c[8].replace(/ rev \d+$/, ""); return c.join("\t"); }); })()],
  // Ruling 2: Wikipedia by edit timestamp and content; Wayback by past-tense content.
  ["Coachella 2017 dated by the day it was read, not its revision's edit", swap("coachella", 2017, l => l.replace("2026-11-04T02:48:15Z rev 1383675426", "2026-11-06 rev 1383675426"))],
  ["Coachella 2017 given a different edit timestamp than the revision it quotes", swap("coachella", 2017, l => l.replace("\t2026-11-04T02:48:15Z rev", "\t2026-11-06T00:00:00Z rev"))],
  ["EDC Orlando 2013 back to occurred on a revision with no 2013 Orlando passage", swap("edc-orlando", 2013, l => l.replace("\tscheduled_unverified\t", "\toccurred\t"))],
  ["EDC Orlando 2013 occurred on the article's Las Vegas 2013 sentence", swap("edc-orlando", 2013, l => l.replace("\tscheduled_unverified\t", "\toccurred\t").replace(/\t([^\t]*)$/, '\t$1 Revision 1383684436 (edited 2026-11-04T04:12:24Z) reports it: "In 2013, EDC Las Vegas was held June 21–23.".'))],
  ["Nocturnal 2012 occurred on a format line with no occurrence verb", swap("nocturnal-wonderland", 2012, l => l.replace("\tscheduled_unverified\t", "\toccurred\t").replace(/\t([^\t]*)$/, '\t$1 Revision 1383681227 (edited 2026-11-04T03:43:10Z) reports it: "Nocturnal Wonderland is a two-day event (a three-day festival from 2011 to 2016)" (range statement).'))],
  ["ACL 2014 back to occurred on its post-event set-time capture", swap("acl", 2014, l => l.replace("\tscheduled_unverified\t", "\toccurred\t"))],
  ["Dreamstate SoCal 2017 occurred on a capture quote with no past tense", swap("dreamstate-socal", 2017, l => l.replace("\tscheduled_unverified\t", "\toccurred\t").replace(/\t([^\t]*)$/, '\t$1 Capture reports it: "Past Highlights 2017 Lineup View Full Size".'))],
];
let caught = 0;
for (const [name, text] of MUTANTS) {
  if (!text || text === TEXT) { all.push(`mutant "${name}" did not apply`); continue; }
  if (check(text).fails.length) caught++; else all.push(`mutant "${name}" survived`);
}

console.log(`  census: ${base.n} checks, ${caught}/${MUTANTS.length} mutants caught · ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
if (all.length) { for (const f of all.slice(0, 40)) console.log(`  ✗ ${f}`); if (all.length > 40) console.log(`  … ${all.length - 40} more`); process.exit(1); }
console.log("  ✓ every occurred row has a source published after its last day that reports it held (Wikipedia by edit timestamp + quote, Wayback by quoted past-tense content); fetch dates never count");
