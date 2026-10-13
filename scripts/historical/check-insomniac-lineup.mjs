#!/usr/bin/env node
// check-insomniac-lineup.mjs — is a structured edition's lineup complete?
//
//   node scripts/historical/check-insomniac-lineup.mjs beyond-wonderland-socal-2026
//
// The set-times pages say who played when; the official LINEUP page says who
// was billed. An edition is only called complete when every billing on the
// archived lineup page is a set in the sheet. This reads the lineup capture
// named in LINEUP_PAGES (the page's own <title> must name the edition), joins
// it to the sheet case- and accent-folded, and writes the result into
// ledger/<id>.json as `lineupCheck`. Where the two pages spell one act
// differently, the pair must be listed in `aliases` here, by hand, after
// looking at both pages; anything else unmatched is left in `unmatched` and
// fails test-historical-editions.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchCapture } from "./wayback.mjs";
import { readSheet } from "./build-editions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LINEUP_PAGES = {
  "beyond-wonderland-socal-2026": {
    url: "https://socal.beyondwonderland.com/lineup/", capture: "20260419043528", title: "Beyond Wonderland SoCal 2026",
    // lineup page billing → set-times billing, same act (checked on both pages)
    aliases: { "Diesel": "DJ Diesel" },
  },
  // The site never updated its <title> ("…at The Gorge 2025") for 2026. The
  // edition is proven instead by text the page prints ("Beyond PNW 2026") and
  // by the set-times capture of the same crawl, whose day tabs print Saturday
  // June 27 / Sunday June 28 (2026 weekdays; Jun 27 2025 was a Friday).
  "beyond-wonderland-gorge-2026": {
    url: "https://pnw.beyondwonderland.com/lineup/", capture: "20260627043900", title: "Beyond Wonderland at The Gorge 2026",
    staleTitle: "Lineup – Beyond Wonderland at The Gorge 2025", identityText: "Beyond PNW 2026",
    aliases: {},
  },
};

const ENT = { "&amp;": "&", "&#038;": "&", "&quot;": '"', "&#039;": "'", "&#8217;": "’", "&#8211;": "–", "&nbsp;": " " };
const text = s => String(s).replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();
export const fold = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// The 2026 Insomniac lineup page: one <li> per billing in ul.lineup__list.
export function lineupBillings(html) {
  const i = html.indexOf('class="lineup__list"');
  if (i < 0) return null;
  const seg = html.slice(i, html.indexOf("</ul>", i));
  return [...seg.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => text(m[1])).filter(Boolean);
}

export function joinLineup(billings, sheetNames, aliases = {}) {
  const inSheet = new Set(sheetNames.map(fold));
  const matched = [], aliased = [], unmatched = [];
  for (const b of billings) {
    if (inSheet.has(fold(b))) matched.push(b);
    else if (aliases[b] && inSheet.has(fold(aliases[b]))) aliased.push({ lineup: b, setTimes: aliases[b] });
    else unmatched.push(b);
  }
  const billed = new Set([...billings.map(fold), ...Object.values(aliases).map(fold)]);
  const setTimesOnly = [...new Set(sheetNames)].filter(n => !billed.has(fold(n)));
  return { billings: billings.length, matched: matched.length, aliased, unmatched, setTimesOnly };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const id of process.argv.slice(2)) {
    const cfg = LINEUP_PAGES[id];
    if (!cfg) { console.error(`no LINEUP_PAGES entry for ${id}`); process.exit(2); }
    const got = await fetchCapture(cfg.capture, cfg.url);
    const title = text((/<title>([^<]*)/.exec(got.text) || [])[1] || "");
    const staleOk = cfg.staleTitle && title === cfg.staleTitle && got.text.includes(cfg.identityText);
    if (!title.includes(cfg.title) && !staleOk) { console.error(`✗ ${id}: capture title "${title}" does not name ${cfg.title}`); process.exit(1); }
    const billings = lineupBillings(got.text);
    if (!billings?.length) { console.error(`✗ ${id}: no lineup list in the capture`); process.exit(1); }
    const sheet = readSheet(join(ROOT, `data/historical/sheets/${id}.tsv`)).map(r => r.artist);
    const j = joinLineup(billings, sheet, cfg.aliases);
    const file = join(ROOT, `data/historical/ledger/${id}.json`);
    const ledger = JSON.parse(readFileSync(file, "utf8"));
    ledger.lineupCheck = { page: cfg.url, archivedUrl: got.archivedUrl, captureTimestamp: got.captureTimestamp, sha256: got.sha256, title,
      ...(staleOk ? { staleTitle: true, identityText: cfg.identityText } : {}), ...j };
    writeFileSync(file, JSON.stringify(ledger, null, 2) + "\n");
    console.log(`${j.unmatched.length ? "✗" : "✓"} ${id}: ${j.billings} billed · ${j.matched} matched · ${j.aliased.length} aliased · ${j.unmatched.length} unmatched · ${j.setTimesOnly.length} set-times only (${j.setTimesOnly.join(", ")})`);
  }
}
