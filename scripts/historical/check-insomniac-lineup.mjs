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

const OFF_GRAPHIC = "billed by the lineup app; no set-times graphic prints it on its date(s)";

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
  // Coachella's lineup page renders AEG's lineup app (div#ww, data-path
  // "711/2g4uo3jiai93brm3"), which reads shows.json: one row per billed act
  // per date, no stage or time. The page's <title> never names a year; the
  // edition is proven by the dates it prints and by the data path it embeds.
  // The set-times graphics print eight stages; acts the app bills that no
  // graphic prints (other stages, a pre-party night, "SURPRISE" slots) are
  // listed in offGraphic, by hand, after reading the graphics.
  "coachella-2026": {
    format: "aeg-app", url: "https://www.coachella.com/lineup", capture: "20260415132913", title: "Coachella 2026",
    staleTitle: "Coachella Valley Music & Arts Festival", identityText: "APR 10-12 & 17-19, 2026",
    data: { url: "https://events.aegamp.com/app/711/2g4uo3jiai93brm3/shows.json", capture: "20260409001657" },
    aliases: {
      "Chloé Caillet x Rossi.": "Rossi. x Chloé Caillet",
      "Röyksopp (DJ Set)": "Röyksopp",
      "Groove Armada (DJ Set)": "Groove Armada",
      "Worship (Sub Focus, Dimension, Culture Shock, 1991)": "Worship",
      "Linksa": "Linska",
    },
    offGraphic: {
      "Lambrini Girls": OFF_GRAPHIC,
      "DJ Snake's Pardon My French": OFF_GRAPHIC,
      "Soraya": OFF_GRAPHIC,
      "Fifi": OFF_GRAPHIC,
      "1tbsp": OFF_GRAPHIC,
      "Bullet Tooth": OFF_GRAPHIC,
      "MCR-T": OFF_GRAPHIC,
      "Effin": OFF_GRAPHIC,
      "SURPRISE": OFF_GRAPHIC,
      "Robin Schulz": OFF_GRAPHIC,
      "jigitz": OFF_GRAPHIC,
      "Wale": OFF_GRAPHIC,
      "Andy C": OFF_GRAPHIC,
      "Radiohead Motion Picture House: Kid A Mnesia": OFF_GRAPHIC,
      "Zerb": OFF_GRAPHIC,
      "Lumia": OFF_GRAPHIC,
      "REDKĒ": OFF_GRAPHIC,
      "Baalti": OFF_GRAPHIC,
      "NIIKO X SWAE": OFF_GRAPHIC,
      "Roddy Lima": OFF_GRAPHIC,
      "Joshwa": OFF_GRAPHIC,
      "Coi Leray": OFF_GRAPHIC,
      "Baby J": OFF_GRAPHIC,
      "Sean Paul": OFF_GRAPHIC,
      "Starjunk 95": OFF_GRAPHIC,
      "Andruss": OFF_GRAPHIC,
      "Mild Minds": OFF_GRAPHIC,
      "Tinashe (dj)": OFF_GRAPHIC,
      "oskar med k": OFF_GRAPHIC,
      "Less Than Jake": OFF_GRAPHIC,
      "Motion City Soundtrack": OFF_GRAPHIC,
      "andhim": OFF_GRAPHIC,
      "nimino": OFF_GRAPHIC,
      "Anfisa Letyago": OFF_GRAPHIC,
      "Soul Purpose": OFF_GRAPHIC,
      "Cincity": OFF_GRAPHIC,
      "Jackie Hollander": OFF_GRAPHIC,
      "Brunello": OFF_GRAPHIC,
      "Poolside's Daytime Disco": OFF_GRAPHIC,
      "Deer Jade": OFF_GRAPHIC,
      "Omar+": OFF_GRAPHIC,
      "OMNOM": OFF_GRAPHIC,
      "Whethan": OFF_GRAPHIC,
      "Disco Lines": OFF_GRAPHIC,
      "ØZI": OFF_GRAPHIC,
      "Kryptogram": OFF_GRAPHIC,
      "Sander Kleinenberg": OFF_GRAPHIC,
    },
  },
};

const ENT = { "&amp;": "&", "&#038;": "&", "&quot;": '"', "&#039;": "'", "&#8217;": "’", "&#8211;": "–", "&nbsp;": " " };
const text = s => String(s).replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();
export const fold = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// AEG's lineup app (shows.json): one row per billed act per date.
export function aegAppBillings(json) {
  const rows = Array.isArray(json) ? json : Object.values(json || {});
  return [...new Set(rows.map(r => text(r.title || "")).filter(Boolean))];
}

// The 2026 Insomniac lineup page: one <li> per billing in ul.lineup__list.
export function lineupBillings(html) {
  const i = html.indexOf('class="lineup__list"');
  if (i < 0) return null;
  const seg = html.slice(i, html.indexOf("</ul>", i));
  return [...seg.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => text(m[1])).filter(Boolean);
}

// offGraphic: billings listed by hand as printed on no set-times graphic. One
// that IS in the sheet is unmatched (the list is wrong), and an entry that is
// not billed is stale; either fails the test.
export function joinLineup(billings, sheetNames, aliases = {}, offGraphic = {}) {
  const inSheet = new Set(sheetNames.map(fold));
  const matched = [], aliased = [], unmatched = [], off = [];
  for (const b of billings) {
    if (b in offGraphic) (inSheet.has(fold(b)) ? unmatched : off).push(b);
    else if (inSheet.has(fold(b))) matched.push(b);
    else if (aliases[b] && inSheet.has(fold(aliases[b]))) aliased.push({ lineup: b, setTimes: aliases[b] });
    else unmatched.push(b);
  }
  const billed = new Set([...billings.map(fold), ...Object.values(aliases).map(fold)]);
  const setTimesOnly = [...new Set(sheetNames)].filter(n => !billed.has(fold(n)));
  const staleOffGraphic = Object.keys(offGraphic).filter(n => !billings.includes(n));
  return { billings: billings.length, matched: matched.length, aliased, unmatched, setTimesOnly,
    ...(Object.keys(offGraphic).length ? { offGraphic: off, staleOffGraphic } : {}) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const id of process.argv.slice(2)) {
    const cfg = LINEUP_PAGES[id];
    if (!cfg) { console.error(`no LINEUP_PAGES entry for ${id}`); process.exit(2); }
    const got = await fetchCapture(cfg.capture, cfg.url);
    const title = text((/<title>([^<]*)/.exec(got.text) || [])[1] || "");
    const staleOk = cfg.staleTitle && title === cfg.staleTitle && got.text.includes(cfg.identityText);
    if (!title.includes(cfg.title) && !staleOk) { console.error(`✗ ${id}: capture title "${title}" does not name ${cfg.title}`); process.exit(1); }
    let billings, data;
    if (cfg.format === "aeg-app") {
      // The page must embed the app at the data path the check reads.
      const path = /\/app\/(\d+\/[a-z0-9]+)\/shows\.json$/.exec(cfg.data.url)?.[1];
      if (!path || !got.text.includes(`data-path="${path}"`)) { console.error(`✗ ${id}: the lineup page does not embed the app at ${path}`); process.exit(1); }
      data = await fetchCapture(cfg.data.capture, cfg.data.url);
      billings = aegAppBillings(JSON.parse(data.text));
    } else billings = lineupBillings(got.text);
    if (!billings?.length) { console.error(`✗ ${id}: no lineup list in the capture`); process.exit(1); }
    const sheet = readSheet(join(ROOT, `data/historical/sheets/${id}.tsv`)).map(r => r.artist);
    const j = joinLineup(billings, sheet, cfg.aliases, cfg.offGraphic);
    const file = join(ROOT, `data/historical/ledger/${id}.json`);
    const ledger = JSON.parse(readFileSync(file, "utf8"));
    ledger.lineupCheck = { page: cfg.url, archivedUrl: got.archivedUrl, captureTimestamp: got.captureTimestamp, sha256: got.sha256, title,
      ...(staleOk ? { staleTitle: true, identityText: cfg.identityText } : {}),
      ...(data ? { data: { url: cfg.data.url, archivedUrl: data.archivedUrl, captureTimestamp: data.captureTimestamp, sha256: data.sha256 } } : {}), ...j };
    writeFileSync(file, JSON.stringify(ledger, null, 2) + "\n");
    console.log(`${j.unmatched.length || j.staleOffGraphic?.length ? "✗" : "✓"} ${id}: ${j.billings} billed · ${j.matched} matched · ${j.aliased.length} aliased${j.offGraphic ? ` · ${j.offGraphic.length} off-graphic · ${j.staleOffGraphic.length} stale` : ""} · ${j.unmatched.length} unmatched · ${j.setTimesOnly.length} set-times only (${j.setTimesOnly.join(", ")})`);
  }
}
