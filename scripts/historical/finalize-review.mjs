#!/usr/bin/env node
// finalize-review.mjs — reviewed transcriptions → the edition's source sheet
// and its visual-review manifest.
//
//   node scripts/historical/finalize-review.mjs <edition-id> <review-dir> --reviewer "…"
//
// <review-dir> holds, per official day N:
//   <id>-dN.cand.tsv   the OCR candidate rows (assemble-ocr.mjs output)
//   <id>-dN.final.tsv  the rows as confirmed against the graphic's pixels,
//                      one per printed block, including hand-transcribed
//                      footer strips (stage, start, end, artist, openEnd)
//   <id>-dN.note       optional: the header text read off the graphic and any
//                      day-level notice (e.g. Gov Ball's weather delay)
//
// The manifest records, per day, the graphic's hash, the rows confirmed, and
// every place the final differs from OCR (corrections, rows OCR missed, rows
// OCR invented), so a reader can audit exactly what review changed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITIONS } from "./editions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const [id, dir] = argv;
const reviewer = argv[argv.indexOf("--reviewer") + 1];
if (!EDITIONS[id] || !dir || !reviewer) { console.error("usage: finalize-review.mjs <id> <dir> --reviewer <name>"); process.exit(2); }

const tsv = f => {
  const [h, ...ls] = readFileSync(f, "utf8").split("\n").filter(l => l.trim());
  const c = h.split("\t");
  return ls.map(l => Object.fromEntries(l.split("\t").map((v, i) => [c[i], (v ?? "").trim()])));
};
const norm = s => s.toUpperCase().replace(/⚠.*$/, "").replace(/[^A-Z0-9]+/g, "");
const ledger = JSON.parse(readFileSync(join(ROOT, `data/historical/ledger/${id}.json`), "utf8"));

const rows = [], days = [];
for (const d of ledger.days) {
  const base = join(dir, `${id}-d${d.day}`);
  if (!existsSync(base + ".final.tsv")) { console.error(`✗ day ${d.day}: no reviewed sheet`); process.exit(1); }
  const fin = tsv(base + ".final.tsv"), cand = existsSync(base + ".cand.tsv") ? tsv(base + ".cand.tsv") : [];
  const corrections = [], ocrMissed = [], ocrExtra = [];
  const used = new Set();
  for (const f of fin) {
    // Pair a final row with its OCR candidate: same printed start in the same
    // column position first, then the closest name.
    const i = cand.findIndex((c, k) => !used.has(k) && norm(c.artist) === norm(f.artist));
    // Otherwise pair on the printed times (a misread billing or header keeps
    // its times), preferring the same stage column.
    const byTime = (k, c) => !used.has(k) && c.start === f.start && (c.end || "") === (f.end || "");
    let j = i;
    if (j < 0) j = cand.findIndex((c, k) => byTime(k, c) && norm(c.stage) === norm(f.stage));
    if (j < 0) j = cand.findIndex((c, k) => byTime(k, c));
    if (j < 0) { ocrMissed.push(`${f.stage} ${f.start}${f.end ? "-" + f.end : ""} ${f.artist}`); continue; }
    used.add(j);
    const c = cand[j], diffs = [];
    if (c.artist.replace(/\s*⚠.*$/, "") !== f.artist) diffs.push(`artist "${c.artist.replace(/\s*⚠.*$/, "")}" → "${f.artist}"`);
    if (norm(c.stage) !== norm(f.stage)) diffs.push(`stage "${c.stage}" → "${f.stage}"`);
    for (const k of ["start", "end"]) if ((c[k] || "") !== (f[k] || "")) diffs.push(`${k} ${c[k] || "∅"} → ${f[k] || "∅"}`);
    if (diffs.length) corrections.push(`${f.artist}: ${diffs.join("; ")}`);
  }
  cand.forEach((c, k) => { if (!used.has(k)) ocrExtra.push(`${c.stage} ${c.start} ${c.artist}`); });
  const note = existsSync(base + ".note") ? readFileSync(base + ".note", "utf8").trim() : null;
  days.push({ day: d.day, date: d.date, sha256: d.sha256, originalUrl: d.originalUrl, imageArchivedUrl: d.imageArchivedUrl,
    reviewer, reviewedAt: new Date().toISOString(), rowsConfirmed: fin.length, note,
    method: "every block in the graphic compared with its row: billing, stage column, start and end",
    ocrCandidates: cand.length, corrections, ocrMissed, ocrExtra });
  for (const f of fin) rows.push({ day: d.day, ...f });
}

const cols = ["day", "stage", "start", "end", "artist", "openEnd"];
mkdirSync(join(ROOT, "data/historical/review"), { recursive: true });
writeFileSync(join(ROOT, `data/historical/sheets/${id}.tsv`), [cols.join("\t"), ...rows.map(r => cols.map(c => r[c] ?? "").join("\t"))].join("\n") + "\n");
writeFileSync(join(ROOT, `data/historical/review/${id}.json`), JSON.stringify({ id, days }, null, 1) + "\n");
for (const d of days) console.log(`  day ${d.day} ${d.date}: ${d.rowsConfirmed} rows confirmed · OCR ${d.ocrCandidates} · ${d.corrections.length} corrected · ${d.ocrMissed.length} OCR-missed · ${d.ocrExtra.length} OCR-extra`);
