#!/usr/bin/env node
// SPEC-182 census gate: data/historical/census/coverage-2010-2026.tsv.
//
// `occurred` means a source dated AFTER the edition says it ran. A capture of
// the festival's own page before (or during) the event proves it was
// SCHEDULED, not that it happened, and a note that admits the occurrence was
// assumed, inferred or only pre-event cannot sit on an `occurred` row. Those
// rows are `scheduled_unverified` ("scheduled, occurrence unverified"), with
// their evidence and dates kept.
//
// Rules, per row:
//   1. The header and the lifecycle vocabulary are exact.
//   2. occurred: the source's date (fetched / capture timestamp) is on or after
//      the edition's last printed day; with no printed dates, after the year.
//   3. occurred: the note admits no assumption (ADMISSION below).
//   4. scheduled_unverified: dates or an evidence URL are kept, and the row
//      really fails rule 2 or 3 (no row is demoted without a reason).
// Then mutants on the TSV text, each of which must be caught.
//
//   node scripts/test-coverage-census.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data", "historical", "census", "coverage-2010-2026.tsv");
const HEADER = "family\tyear\tlifecycle\tdates\tvenue\tevidence_url\tevidence_kind\tfetched\theld_record\theld_sets\theld_timed_sets\theld_stage_pins\tnote";
const LIFECYCLES = new Set(["occurred", "scheduled_unverified", "partly_canceled", "canceled", "not_founded", "hiatus", "pending", "unresearched"]);
// A note that says the occurrence itself was not shown. "Page path assumed" or
// "venue assumed" are about other fields and are not admissions.
export const ADMISSION = /occurrence (?:was )?assumed|assumed[^.;]*\b(?:ran|held|occurred|happened)\b|(?<!rather than )\binferred\b|\bsame inference\b|\bimpl(?:y|ies)\b[^.;]*\bran\b|pre-event (?:capture|only|source|poster)|not a report that|no post-event report|not proven/i;

export function parse(text) {
  const lines = text.replace(/\n$/, "").split("\n");
  const cols = lines[0].split("\t");
  return { header: lines[0], rows: lines.slice(1).map(l => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v]))) };
}
const lastDay = d => (d.match(/\d{4}-\d{2}-\d{2}/g) || []).sort().at(-1)?.replace(/-/g, "") || null;
const sourceDay = f => (f.replace(/\D/g, "").slice(0, 8) || null);
// Why an `occurred` claim is not supported, or null when it is.
export function occurredProblem(r) {
  const src = sourceDay(r.fetched || "");
  const end = lastDay(r.dates || "");
  if (!src) return "the source has no date";
  if (end && src < end) return `the source (${src}) predates the last day (${end})`;
  if (!end && src < `${+r.year + 1}0101`) return `no printed dates and the source (${src}) is inside ${r.year}`;
  if (ADMISSION.test(r.note || "")) return `the note admits it: "${ADMISSION.exec(r.note)[0]}"`;
  return null;
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
];
let caught = 0;
for (const [name, text] of MUTANTS) {
  if (!text || text === TEXT) { all.push(`mutant "${name}" did not apply`); continue; }
  if (check(text).fails.length) caught++; else all.push(`mutant "${name}" survived`);
}

console.log(`  census: ${base.n} checks, ${caught}/${MUTANTS.length} mutants caught · ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
if (all.length) { for (const f of all.slice(0, 40)) console.log(`  ✗ ${f}`); if (all.length > 40) console.log(`  … ${all.length - 40} more`); process.exit(1); }
console.log("  ✓ every occurred row has a post-event dated source and admits no assumption");
