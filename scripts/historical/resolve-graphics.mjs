#!/usr/bin/env node
// resolve-graphics.mjs — find, fetch and hash an edition's OFFICIAL daily
// schedule graphics through the Wayback Machine (Gov Ball, Lollapalooza, ACL).
//
//   node scripts/historical/resolve-graphics.mjs governors-ball-2025 [lollapalooza-2025 acl-2025]
//
// Walks every capture of the official /schedule page inside the edition's
// window, collects the schedule images each capture embeds (Webflow serves
// resized "-p-500" copies; only the full-size original is kept), and picks,
// per official day, the image from the LATEST capture that still embeds one
// for that day — a revised grid replaces an older one (Gov Ball's Saturday is
// "Sat_6.7D", a re-issue). Earlier revisions stay in the ledger.
//
// The graphics are research artifacts: they are cached in the private research
// directory, hashed, and never committed or shipped. OCR reads the cached copy.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture } from "./wayback.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// `days`: the official days in order, each with the filename token that marks
// its graphic. The match is on the image's own filename, which the festival
// wrote — never on page position.
export const GRAPHIC_EDITIONS = {
  // Governors Ball 2024: "GBSchedule-Working-Fri-6.7.jpg" (final, from
  // 20240621); the April issue was "GB24-Schedule-Fri-4.25.png". The grids
  // print "FRI. JUNE 7" with no year; June 7 is a Friday in 2024 only.
  // Ultra 2024: the original uploads were never archived, only WordPress's
  // resized copies; the 1600x1000 copy is the largest and is legible. The
  // Saturday and Sunday grids were re-issued as "Sat-Complete-1" and
  // "Sun-Complete-2" during the festival.
  // Ultra 2022: "UltraMiami_2022_Set_Times_FRI-1600x1000.png", "…_SAT-1-…", "…_SUN-4-…".
  // Ultra 2016, 2017 and 2019 print set times on the lineup graphic itself,
  // one tall image with every stage and day, on the /lineup/ page. Every day
  // reads the same file. The graphic is re-issued with a counter
  // ("miami-lineup-phase3-2.jpg", "miami-lineup-times-2019-5.jpg"); the
  // "-og" social card is a different crop and never matches.
  "ultra-miami-2016": { year: 2016, page: "https://ultramusicfestival.com/lineup/", window: ["20160301", "20160331"],
    image: /miami-lineup-phase3-\d+\.jpg/i,
    days: [{ day: 1, date: "2016-03-18", token: /lineup/i }, { day: 2, date: "2016-03-19", token: /lineup/i }, { day: 3, date: "2016-03-20", token: /lineup/i }] },
  "ultra-miami-2017": { year: 2017, page: "https://ultramusicfestival.com/lineup/", window: ["20170301", "20170331"],
    image: /miami-lineup-phase3-\d+\.jpg/i,
    days: [{ day: 1, date: "2017-03-24", token: /lineup/i }, { day: 2, date: "2017-03-25", token: /lineup/i }, { day: 3, date: "2017-03-26", token: /lineup/i }] },
  "ultra-miami-2019": { year: 2019, page: "https://ultramusicfestival.com/lineup/", window: ["20190301", "20190331"],
    image: /miami-lineup-times-2019-\d+\.jpg/i,
    days: [{ day: 1, date: "2019-03-29", token: /lineup/i }, { day: 2, date: "2019-03-30", token: /lineup/i }, { day: 3, date: "2019-03-31", token: /lineup/i }] },
  "ultra-miami-2022": { year: 2022, page: "https://ultramusicfestival.com/set-times/", window: ["20220301", "20220331"],
    image: /UltraMiami_2022_Set_Times_[^"'\s/]+?-1600x1000\.png/i,
    days: [{ day: 1, date: "2022-03-25", token: /_FRI-/i }, { day: 2, date: "2022-03-26", token: /_SAT-/i }, { day: 3, date: "2022-03-27", token: /_SUN-/i }] },
  // Ultra 2023 re-issued Sunday on the day ("…_SUNDAY-web-2-…"); the window
  // ends on Sunday so the last capture carrying it is the one read.
  "ultra-miami-2023": { year: 2023, page: "https://ultramusicfestival.com/set-times/", window: ["20230301", "20230326"],
    image: /ULTRA2023_SET-TIMES_[^"'\s/]+?-1600x1000\.jpe?g/i,
    days: [{ day: 1, date: "2023-03-24", token: /_FRIDAY-/i }, { day: 2, date: "2023-03-25", token: /_SATURDAY-/i }, { day: 3, date: "2023-03-26", token: /_SUNDAY-/i }] },
  "ultra-miami-2024": { year: 2024, page: "https://ultramusicfestival.com/set-times/", window: ["20240301", "20240331"],
    image: /ULTRA2024_SET-TIMES_[^"'\s/]+?-1600x1000\.jpe?g/i,
    days: [{ day: 1, date: "2024-03-22", token: /_22-/i }, { day: 2, date: "2024-03-23", token: /_(?:23|Sat)-/i }, { day: 3, date: "2024-03-24", token: /_(?:24|Sun)-/i }] },
  // Ultra 2025 prints all three days on one graphic, so every day reads the
  // same file. The page moved to /lineup/set-times/ that year.
  "ultra-miami-2025": { year: 2025, page: "https://ultramusicfestival.com/lineup/set-times/", window: ["20250301", "20250330"],
    image: /ULTRA2025-SET-TIMES[^"'\s/]*?\.png/i,
    days: [{ day: 1, date: "2025-03-28", token: /SET-TIMES/i }, { day: 2, date: "2025-03-29", token: /SET-TIMES/i }, { day: 3, date: "2025-03-30", token: /SET-TIMES/i }] },
  "governors-ball-2024": { year: 2024, page: "https://www.governorsballmusicfestival.com/schedule", window: ["20240401", "20241231"],
    image: /(?:GBSchedule-Working|GB24-Schedule)-[^"'\s/]+?\.(?:png|jpg)/i,
    days: [{ day: 1, date: "2024-06-07", token: /-Fri/i }, { day: 2, date: "2024-06-08", token: /-Sat/i }, { day: 3, date: "2024-06-09", token: /-Sun/i }] },
  "governors-ball-2025": { year: 2025, page: "https://www.governorsballmusicfestival.com/schedule", window: ["20250601", "20251231"],
    image: /GBSchedule-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2025-06-06", token: /-Fri/i }, { day: 2, date: "2025-06-07", token: /-Sat/i }, { day: 3, date: "2025-06-08", token: /-Sun/i }] },
  // Lollapalooza 2021-2023: grids embedded on lollapalooza.com/schedule from
  // assets-global.website-files.com. 2021 "LP21-GRID-V15_01-Thurs-01.png"
  // (re-issued V11-V15); 2022 "LOL22-Grid-0728-THURSDAY_Web-Opt-….jpg" and
  // "LOL22-Grid-0729_Sat-1350X1080.png"; 2023 "L23_Grid-07.28_Aug3.png", whose
  // Sunday was re-issued as "L23_Grid-08.01_Aug6-1080x1350.png".
  "lollapalooza-2021": { year: 2021, page: "https://www.lollapalooza.com/schedule", window: ["20210601", "20211231"],
    image: /LP21-GRID-V\d+_[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2021-07-29", token: /_01-Thurs/i }, { day: 2, date: "2021-07-30", token: /_02-Fri/i },
      { day: 3, date: "2021-07-31", token: /_03-Sat/i }, { day: 4, date: "2021-08-01", token: /_04-Sun/i }] },
  "lollapalooza-2022": { year: 2022, page: "https://www.lollapalooza.com/schedule", window: ["20220601", "20221231"],
    image: /LOL22-Grid-[^"'\s/]+?\.(?:png|jpe?g)/i,
    days: [{ day: 1, date: "2022-07-28", token: /THURS/i }, { day: 2, date: "2022-07-29", token: /FRI/i },
      { day: 3, date: "2022-07-30", token: /Sat/i }, { day: 4, date: "2022-07-31", token: /SUN/i }] },
  "lollapalooza-2023": { year: 2023, page: "https://www.lollapalooza.com/schedule", window: ["20230601", "20231231"],
    image: /L23_Grid-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2023-08-03", token: /_Aug3\b|_Aug3[-.]/i }, { day: 2, date: "2023-08-04", token: /_Aug4/i },
      { day: 3, date: "2023-08-05", token: /_Aug5/i }, { day: 4, date: "2023-08-06", token: /_Aug6/i }] },
  // Lollapalooza 2024: "Lolla24_Grid-01Thurs-07.23.png"; the May issue was
  // "LOLLA24-THURS-Schedule-web.png". Re-issues add a date and a letter.
  // Sunday's last two re-issues carry no day name ("Lolla24_Grid-08.04.png",
  // "…-08.04B.png"); each prints "SUN, AUG. 4, 2024" in its header, and the
  // review manifest records that check.
  "lollapalooza-2024": { year: 2024, page: "https://www.lollapalooza.com/schedule", window: ["20240601", "20241231"],
    image: /(?:Lolla24_Grid|LOLLA24)-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2024-08-01", token: /Thurs/i }, { day: 2, date: "2024-08-02", token: /Fri/i },
      { day: 3, date: "2024-08-03", token: /Sat/i }, { day: 4, date: "2024-08-04", token: /Sun|Grid-08\.04/i }] },
  "lollapalooza-2025": { year: 2025, page: "https://www.lollapalooza.com/schedule", window: ["20250725", "20251231"],
    image: /LOL25_Schedule-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2025-07-31", token: /Thurs/i }, { day: 2, date: "2025-08-01", token: /Fri\b|_Fri/i },
      // Lolla's final Saturday and Sunday re-issues carry no day name
      // ("08.01-WEB", "08.03.04-Sun"); each graphic prints its own day and
      // date in its header, and the review manifest records that check.
      { day: 3, date: "2025-08-02", token: /_Sat|08\.01-WEB|Chance-WEB/i }, { day: 4, date: "2025-08-03", token: /Sun/i }] },
  "acl-2025": { year: 2025, page: "https://www.aclfestival.com/schedule", window: ["20250915", "20251231"],
    image: /ACL25-Schedule-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2025-10-03", token: /W1-Fri/i }, { day: 2, date: "2025-10-04", token: /W1-Sat/i }, { day: 3, date: "2025-10-05", token: /W1-Sun/i },
      { day: 4, date: "2025-10-10", token: /W2-Fri/i }, { day: 5, date: "2025-10-11", token: /W2-Sat/i }, { day: 6, date: "2025-10-12", token: /W2-Sun/i }] },
  // ACL 2023 names its grids "ACL_FestivalSchedule_FRI_Weekend-1.png" and
  // "ACL_Festival_Schedule_SAT_Weekend-1-1080x1350.png"; the chosen W1 Sunday
  // is "…SUN_Weekend-1080x1350.png" with no weekend number (its printed header
  // says WEEKEND ONE SUNDAY, OCTOBER 8), so day 3 matches a SUN_Weekend not
  // followed by -2.
  "acl-2023": { year: 2023, page: "https://www.aclfestival.com/schedule", window: ["20230801", "20231231"],
    image: /ACL_Festival_?Schedule_[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2023-10-06", token: /FRI_Weekend-1/i }, { day: 2, date: "2023-10-07", token: /SAT_Weekend-1/i }, { day: 3, date: "2023-10-08", token: /SUN_Weekend(?!-2)/i },
      { day: 4, date: "2023-10-13", token: /FRI_Weekend-2/i }, { day: 5, date: "2023-10-14", token: /SAT_Weekend-2/i }, { day: 6, date: "2023-10-15", token: /SUN_Weekend-2/i }] },
  // ACL 2024: "ACL-2024-Schedule-W1-Fri-10.4.png"; re-issues add a suffix
  // ("-10.4-D"), so the token is the weekend and day only.
  "acl-2024": { year: 2024, page: "https://www.aclfestival.com/schedule", window: ["20240901", "20241231"],
    image: /ACL-2024-Schedule-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2024-10-04", token: /W1-Fri/i }, { day: 2, date: "2024-10-05", token: /W1-Sat/i }, { day: 3, date: "2024-10-06", token: /W1-Sun/i },
      { day: 4, date: "2024-10-11", token: /W2-Fri/i }, { day: 5, date: "2024-10-12", token: /W2-Sat/i }, { day: 6, date: "2024-10-13", token: /W2-Sun/i }] },
  // ACL 2021: "ACL21-Grid-v14_FRI.png" for weekend one, "…_FRI_2.png" for
  // weekend two (one copy is "…_FRI_2%20(1).png").
  "acl-2021": { year: 2021, page: "https://www.aclfestival.com/schedule", window: ["20210901", "20211231"],
    image: /ACL21-Grid-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2021-10-01", token: /_FRI\.png$/i }, { day: 2, date: "2021-10-02", token: /_SAT\.png$/i }, { day: 3, date: "2021-10-03", token: /_SUN\.png$/i },
      { day: 4, date: "2021-10-08", token: /_FRI_2/i }, { day: 5, date: "2021-10-09", token: /_SAT_2/i }, { day: 6, date: "2021-10-10", token: /_SUN_2/i }] },
  // ACL 2022 names its grids two ways: "ACL-Schedule-Sat-Wk2-…" and the
  // revised Sunday "ACL_FestivalSchedule_10.13_ACL-Schedule-Sun-Wk2 (1).png".
  "acl-2022": { year: 2022, page: "https://www.aclfestival.com/schedule", window: ["20221001", "20221231"],
    image: /ACL(?:-Schedule-|_FestivalSchedule_)[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2022-10-07", token: /Fri-Wk1/i }, { day: 2, date: "2022-10-08", token: /Sat-Wk1/i }, { day: 3, date: "2022-10-09", token: /Sun-Wk1/i },
      { day: 4, date: "2022-10-14", token: /Fri-Wk2/i }, { day: 5, date: "2022-10-15", token: /Sat-Wk2/i }, { day: 6, date: "2022-10-16", token: /Sun-Wk2/i }] },
};

// Webflow resized copies end "-p-500.png" or "-p-800.jpg"; keep only the original.
const fullSize = u => !/-p-\d+\.(?:png|jpe?g)$/i.test(u);

export async function resolve(id) {
  const ed = GRAPHIC_EDITIONS[id];
  const host = ed.page.replace(/^https?:\/\//, "");
  const caps = await listCaptures(host, ...ed.window);
  const seen = [];
  for (const c of caps) {
    const got = await fetchCapture(c.timestamp, ed.page);
    // Older WordPress pages (Ultra 2016, 2017) link protocol-relative
    // ("//ultramusicfestival.com/wp-content/…"); those read as https.
    const re = new RegExp(`(?:https?:)?//[^"'\\s)]+?${ed.image.source}`, "gi");
    const imgs = [...new Set((got.text.match(re) || []).map(u => u.startsWith("//") ? `https:${u}` : u))].filter(fullSize);
    seen.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, images: imgs });
  }
  const ledger = { id, method: "official_image_transcription", official: ed.page, window: ed.window,
    pageCaptures: seen.map(s => ({ ...s, images: s.images.map(u => u.split("/").pop()) })), days: [] };
  for (const d of ed.days) {
    const revisions = [];
    for (const s of seen) for (const u of s.images) if (d.token.test(u.split("/").pop()) && !revisions.some(r => r.url === u))
      revisions.push({ url: u, firstSeen: s.captureTimestamp });
    const lastCap = [...seen].reverse().find(s => s.images.some(u => d.token.test(u.split("/").pop())));
    if (!lastCap) { ledger.days.push({ day: d.day, date: d.date, blocked: "no capture embeds an official graphic for this day" }); continue; }
    const pick = lastCap.images.filter(u => d.token.test(u.split("/").pop()));
    if (pick.length !== 1) { ledger.days.push({ day: d.day, date: d.date, blocked: `ambiguous: ${pick.length} graphics in ${lastCap.captureTimestamp}` }); continue; }
    let img;
    try { img = await fetchCapture(lastCap.captureTimestamp, pick[0], { binary: true }); }
    catch (e) {
      ledger.days.push({ day: d.day, date: d.date, blocked: `graphic not archived: ${e.message}`, originalUrl: pick[0],
        revisions: revisions.map(r => ({ file: r.url.split("/").pop(), firstSeen: r.firstSeen })) });
      continue;
    }
    ledger.days.push({ day: d.day, date: d.date, pageCapture: lastCap.captureTimestamp, pageArchivedUrl: lastCap.archivedUrl,
      originalUrl: pick[0], imageCapture: img.captureTimestamp, imageArchivedUrl: img.archivedUrl,
      sha256: img.sha256, bytes: img.bytes, contentType: img.contentType, cacheFile: img.file.split("/").pop(),
      revisions: revisions.map(r => ({ file: r.url.split("/").pop(), firstSeen: r.firstSeen })) });
  }
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return ledger;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const id of process.argv.slice(2)) {
    const l = await resolve(id);
    console.log(`▸ ${id}: ${l.pageCaptures.length} page captures`);
    for (const d of l.days) console.log(d.blocked ? `  ✗ day ${d.day} ${d.date}: ${d.blocked}`
      : `  day ${d.day} ${d.date}: ${d.originalUrl.split("/").pop()} page@${d.pageCapture} img@${d.imageCapture} ${d.bytes}B ${d.contentType} sha ${d.sha256.slice(0, 12)} · ${d.revisions.length} revision(s): ${d.revisions.map(r => r.file.replace(/^[0-9a-f]+_/, "")).join(", ")}`);
  }
}
