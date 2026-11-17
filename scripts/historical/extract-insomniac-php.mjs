#!/usr/bin/env node
// extract-insomniac-php.mjs — a 2011 to 2013 edition's official Insomniac
// lineup page (the lineup.php template), read from the Wayback Machine, into
// a set-times sheet plus a capture ledger.
//
//   node scripts/historical/extract-insomniac-php.mjs nocturnal-wonderland-2012 […]
//
// That template printed every set with its stage and its time, one block per
// stage and day. Each block carries a share title that names the stage and
// the date ("Labyrinth - September 22nd, 2012 - Nocturnal Wonderland"), and a
// page kept earlier years' blocks after it added the next year's. An edition
// takes only the blocks whose printed date is one of its dates, so the date
// is read off the page, block by block, never inferred from the URL.
//
// Every capture in the edition's window is parsed; a capture is valid when it
// prints a block for every edition date and names the festival in each title.
// The FIRST valid capture taken after the edition's last day is used: the
// schedule as it stood once the event was over. Later captures are not
// trusted over it, because the template drew its artist records from a
// database shared across years, and later edits reached back into earlier
// years (Beyond 2012's "Davey Dave" slot reads "DAVID STEVEN" by October;
// Nocturnal 2011's Alesso set is gone by 2013). Every other valid capture is
// diffed against the chosen one, so those changes are ledger findings. An
// unfiled capture between the last day and the chosen one blocks the edition.
//
// A block the page labels as an alphabetical list ("Noct 2013 alpha",
// "Beyond Alpha") is not a stage: its rows print a zero-length time
// ("1:33pm - 1:33pm"). Those rows are left out and listed in the ledger.
//
// Writes data/historical/sheets/<id>.tsv and data/historical/ledger/<id>.json,
// in the structured_html shape build-editions.mjs reads.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { to24 } from "./lib.mjs";
import { EDITIONS } from "./editions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// url is exactly as the capture was requested and filed; window bounds the
// capture listing. festival is the name each block title must print.
export const PHP_EDITIONS = {
  "nocturnal-wonderland-2011": { url: "http://www.nocturnalwonderland.com/lineup.php", window: ["20110101", "20111231"], festival: "Nocturnal Wonderland" },
  "nocturnal-wonderland-2012": { url: "http://nocturnalwonderland.com/nw_2011/CA/lineup.php", window: ["20120101", "20131231"], festival: "Nocturnal Wonderland" },
  "nocturnal-wonderland-2013": { url: "http://nocturnalwonderland.com/nw_2011/CA/lineup.php", window: ["20120101", "20131231"], festival: "Nocturnal Wonderland" },
  "beyond-wonderland-socal-2012": { url: "http://beyondwonderland.com/BW_2012/lineup.php", window: ["20120101", "20121231"], festival: "Beyond Wonderland" },
  "beyond-wonderland-socal-2013": { url: "http://beyondwonderland.com/BW_2012/socal/lineup.php", window: ["20130101", "20131231"], festival: "Beyond Wonderland" },
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const ENT = { amp: "&", quot: '"', "#39": "'", "#039": "'", apos: "'", lt: "<", gt: ">", nbsp: " " };
const unescape = s => s.replace(/&(amp|quot|#0?39|apos|lt|gt|nbsp);/g, (_, k) => ENT[k]);
const clean = s => unescape(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// "September 22nd, 2012" → "2012-09-22", or null.
export function printedDate(s) {
  const m = /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})$/.exec(s.trim());
  const mo = m && MONTHS.indexOf(m[1].toLowerCase());
  if (!m || mo < 0) return null;
  return `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

// Every stage block on the page: { cls, stage, date, festival, sets }.
export function parseBlocks(html) {
  const parts = html.split(/<div class="filter stage ([^"]+)">/);
  const blocks = [];
  for (let i = 1; i < parts.length; i += 2) {
    const cls = parts[i], body = parts[i + 1];
    const t = /p%5Btitle%5D=([^&"]+)&amp;p%5Bsummary%5D/.exec(body);
    const title = t ? unescape(decodeURIComponent(t[1])) : "";
    const tm = /^(.*) - ([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?, \d{4}) - (.*)$/.exec(title);
    const sets = [...body.matchAll(/<a [^>]*class="artist"[^>]*data-slug="([^"]*)"[^>]*data-day="([^"]*)"[^>]*data-stage="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map(m => {
        const h3 = /<h3>([\s\S]*?)<\/h3>/.exec(m[4]), p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(m[4]);
        const printed = p ? clean(p[1]) : "";
        const [a, b] = printed.split(/\s*-\s*/);
        return { slug: m[1], dayClass: m[2], stageClass: m[3], artist: h3 ? clean(h3[1]) : "", printed, start: to24(a || ""), end: to24(b || "") };
      });
    blocks.push({ cls, title, stage: tm ? tm[1].trim() : null, date: tm ? printedDate(tm[2]) : null, festival: tm ? tm[3].trim() : null, sets });
  }
  return blocks;
}

const isAlpha = b => /\balpha\b/i.test(b.stage || "") || /-alpha$/.test(b.cls.split(" ").pop());

// One capture → the edition's rows, or why it does not prove the edition.
export function readEdition(html, want, ed) {
  const dates = ed.dates.map(([d]) => d);
  const mine = parseBlocks(html).filter(b => dates.includes(b.date));
  const problems = [];
  for (const d of dates) if (!mine.some(b => b.date === d && !isAlpha(b) && b.sets.length)) problems.push(`no stage block prints ${d}`);
  for (const b of mine) if (b.festival !== want.festival) problems.push(`block "${b.title}" names ${b.festival}, not ${want.festival}`);
  const rows = [], skipped = [];
  for (const b of mine) {
    const day = dates.indexOf(b.date) + 1;
    for (const s of b.sets) {
      if (isAlpha(b)) { skipped.push({ day, block: b.stage, artist: s.artist, printed: s.printed, reason: "alphabetical list, not a stage: zero-length time" }); continue; }
      if (!s.artist) { problems.push(`a set in "${b.title}" prints no artist`); continue; }
      if (!s.start || !s.end) { problems.push(`${s.artist} in "${b.title}" prints no time ("${s.printed}")`); continue; }
      rows.push({ day, stage: b.stage, start: s.start, end: s.end, artist: s.artist, settimeId: `d${day}:${s.stageClass}:${s.slug}`, timeSource: "printed" });
    }
  }
  return { valid: !problems.length && rows.length > 0, problems, rows, skipped };
}

// "20120925025007" is after an edition whose last day is 2012-09-22.
const lastDay = ed => ed.dates.at(-1)[0].replaceAll("-", "") + "235959";
const pick = (valid, ed) => valid.find(c => c.captureTimestamp > lastDay(ed)) || null;

const key = r => r.settimeId;
function diff(a, b) {
  const A = new Map(a.map(r => [key(r), r])), B = new Map(b.map(r => [key(r), r]));
  const out = [];
  for (const [k, r] of A) if (!B.has(k)) out.push(`only in chosen: ${r.artist} ${r.stage} ${r.start}-${r.end}`);
  for (const [k, r] of B) {
    const x = A.get(k);
    if (!x) { out.push(`only in other: ${r.artist} ${r.stage} ${r.start}-${r.end}`); continue; }
    for (const f of ["artist", "stage", "start", "end"]) if (x[f] !== r[f]) out.push(`${x.artist}: ${f} ${r[f]} → ${x[f]}`);
  }
  return out;
}

export async function extract(id) {
  const want = PHP_EDITIONS[id], ed = EDITIONS[id];
  if (!want || !ed) throw new Error(`unknown lineup.php edition ${id}`);
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), ...want.window);
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: true, valid: false });
      continue;
    }
    const r = readEdition(got.text, want, ed);
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), valid: r.valid, rows: r.rows.length, problems: r.problems, skipped: r.skipped, sets: r.rows });
  }
  const valid = considered.filter(c => c.valid);
  const ledger = { id, method: "structured_html", official: want.url, window: want.window, template: "insomniac lineup.php", days: [] };
  if (!valid.length) {
    ledger.blocked = `no capture in ${want.window.join("–")} prints every ${ed.year} date`;
  } else {
    const chosen = pick(valid, ed);
    const earlierUnfiled = chosen && considered.filter(c => c.notFiled && c.captureTimestamp > lastDay(ed) && c.captureTimestamp < chosen.captureTimestamp);
    if (!chosen) ledger.blocked = `no valid capture in ${want.window.join("–")} was taken after the last day, ${ed.dates.at(-1)[0]}`;
    else if (earlierUnfiled.length) ledger.blocked = `relay did not file ${earlierUnfiled.map(c => c.captureTimestamp).join(", ")}, taken after the last day and before the chosen capture ${chosen.captureTimestamp}`;
    else {
    ed.dates.forEach(([date], i) => {
      const sets = chosen.sets.filter(s => s.day === i + 1);
      const byStage = {};
      for (const s of sets) byStage[s.stage] = (byStage[s.stage] || 0) + 1;
      ledger.days.push({ day: i + 1, url: want.url, date, chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl,
        sha256: chosen.sha256, rows: sets.length, stages: byStage });
    });
    ledger.chosen = chosen.captureTimestamp;
    if (chosen.via) ledger.relayedVia = chosen.via;
    ledger.skipped = chosen.skipped;
    ledger.considered = considered.map(({ sets, ...c }) => ({ ...c,
      diffVsChosen: c === chosen || !c.valid ? undefined : diff(chosen.sets, sets) }));
    }
  }
  if (ledger.blocked) {
    ledger.days = [];
    ledger.considered = considered.map(({ sets, ...c }) => c);
    return { ledger, rows: [] };
  }
  const chosen = pick(valid, ed);
  const rows = chosen.sets.map(s => ({ ...s, captureTimestamp: chosen.captureTimestamp }));
  mkdirSync(join(ROOT, "data/historical/sheets"), { recursive: true });
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  const cols = ["day", "stage", "start", "end", "artist", "settimeId", "timeSource", "captureTimestamp"];
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.tsv`),
    [cols.join("\t"), ...rows.map(r => cols.map(c => r[c]).join("\t"))].join("\n") + "\n");
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: extract-insomniac-php.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); }
    else console.log(`▸ ${id} @${ledger.chosen}: ${rows.length} sets · ${ledger.days.map(d => `day ${d.day} ${d.date} ${d.rows}`).join(" · ")}${ledger.skipped.length ? ` · ${ledger.skipped.length} alphabetical rows left out` : ""}`);
    for (const c of ledger.considered || [])
      console.log(`   ${c.captureTimestamp} ${c.notFiled ? "UNFILED" : `valid=${c.valid} rows=${c.rows}${c.problems?.length ? ` ${c.problems.slice(0, 2).join("; ")}` : ""}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`}`);
  }
}
