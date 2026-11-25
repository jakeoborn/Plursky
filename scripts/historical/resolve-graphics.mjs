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
  // III Points 2014: one grid per day, embedded by the schedule page.
  "iii-points-2014": { year: 2014, page: "http://iiipoints.com/schedule/", window: ["20141001", "20141231"],
    image: /\/Schedule\/(?:friday|saturday|sunday)\.png/i,
    days: [{ day: 1, date: "2014-10-10", token: /friday/i }, { day: 2, date: "2014-10-11", token: /saturday/i }, { day: 3, date: "2014-10-12", token: /sunday/i }] },
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
  // Coachella 2022: coachella.com/schedule embeds one graphic per day under
  // media-prd.coachella.com/content/content_images/232/, each a hashed name,
  // so the token is the file's own name. Weekend 1's Sunday was re-issued
  // (gmprJMads… → gd07bQrV…, capture 20220417004207); Weekend 2's three are
  // on the May capture.
  "coachella-2010": { year: 2010, page: "http://www.coachella.com/event/set-times", window: ["20100401", "20100531"],
    image: /images\/2010(?:fri|sat|sun)\.jpg/,
    days: [{ day: 1, date: "2010-04-16", token: /^2010fri\./ }, { day: 2, date: "2010-04-17", token: /^2010sat\./ }, { day: 3, date: "2010-04-18", token: /^2010sun\./ }] },
  "coachella-2011": { year: 2011, page: "http://www.coachella.com/event/set-times", window: ["20110401", "20110531"],
    image: /images\/ie6\/800(?:fri|sat|sun)\.jpg/,
    days: [{ day: 1, date: "2011-04-15", token: /^800fri\./ }, { day: 2, date: "2011-04-16", token: /^800sat\./ }, { day: 3, date: "2011-04-17", token: /^800sun\./ }] },
  "coachella-2022": { year: 2022, page: "https://www.coachella.com/schedule", window: ["20220401", "20220531"],
    image: /content_images\/232\/[A-Za-z0-9]{40}\.jpg/,
    days: [{ day: 1, date: "2022-04-15", token: /^H1xpKD3d/ }, { day: 2, date: "2022-04-16", token: /^U0mrDaS8/ }, { day: 3, date: "2022-04-17", token: /^(gd07bQrV|gmprJMad)/ },
      { day: 4, date: "2022-04-22", token: /^vDDIalfx/ }, { day: 5, date: "2022-04-23", token: /^9hx4C2KF/ }, { day: 6, date: "2022-04-24", token: /^zzf52cET/ }] },
  "coachella-2023": { year: 2023, page: "https://www.coachella.com/schedule", window: ["20230401", "20230531"],
    image: /coachella-2023\/images\/coach-[a-z0-9-]+\.jpeg/,
    days: [{ day: 1, date: "2023-04-14", token: /^coach-friday\./ }, { day: 2, date: "2023-04-15", token: /^coach-saturday\./ }, { day: 3, date: "2023-04-16", token: /^coach-sunday\./ },
      { day: 4, date: "2023-04-21", token: /^coach-w2-friday\./ }, { day: 5, date: "2023-04-22", token: /^coach-w2-saturday\./ }, { day: 6, date: "2023-04-23", token: /^coach-w2-sunday\./ }] },
  "coachella-2024": { year: 2024, page: "https://www.coachella.com/schedule", window: ["20240401", "20240531"],
    image: /content_images\/452\/[A-Za-z0-9]{40}\.jpg/,
    days: [{ day: 1, date: "2024-04-12", token: /^wDq5bU0e/ }, { day: 2, date: "2024-04-13", token: /^FsAaxfwe/ }, { day: 3, date: "2024-04-14", token: /^QIXQ0WU1/ },
      { day: 4, date: "2024-04-19", token: /^Q27wWxzl/ }, { day: 5, date: "2024-04-20", token: /^umPrN2MU/ }, { day: 6, date: "2024-04-21", token: /^tGARxSEF/ }] },
  "coachella-2025": { year: 2025, page: "https://www.coachella.com/schedule", window: ["20250401", "20250531"],
    image: /content\/coachella2025\/c25-w[12]-(?:friday|saturday|sunday)\.jpg/,
    days: [{ day: 1, date: "2025-04-11", token: /^c25-w1-friday\./ }, { day: 2, date: "2025-04-12", token: /^c25-w1-saturday\./ }, { day: 3, date: "2025-04-13", token: /^c25-w1-sunday\./ },
      { day: 4, date: "2025-04-18", token: /^c25-w2-friday\./ }, { day: 5, date: "2025-04-19", token: /^c25-w2-saturday\./ }, { day: 6, date: "2025-04-20", token: /^c25-w2-sunday\./ }] },
  "coachella-2026": { year: 2026, page: "https://www.coachella.com/schedule", window: ["20260401", "20260531"],
    image: /content\/coachella-2026\/set-times-(?:friday|sat|sun|fri-wk2|sat-wk2|sun-wk2)\.jpg/,
    days: [{ day: 1, date: "2026-04-10", token: /^set-times-friday\./ }, { day: 2, date: "2026-04-11", token: /^set-times-sat\./ }, { day: 3, date: "2026-04-12", token: /^set-times-sun\./ },
      { day: 4, date: "2026-04-17", token: /^set-times-fri-wk2\./ }, { day: 5, date: "2026-04-18", token: /^set-times-sat-wk2\./ }, { day: 6, date: "2026-04-19", token: /^set-times-sun-wk2\./ }] },
  // The Mac queue (ocr-queue.mjs, data/historical/MAC-QUEUE.md). Each pattern
  // was checked against the archived pages' own HTML; the graphics themselves
  // have not been read yet.
  //
  // Governors Ball 2023: one grid per day on /set-times/, issued May 9
  // ("gb23-set-times-fri-230509.jpg"). WordPress also embeds resized copies
  // ("…-819x1024.jpg"); only the original is matched.
  "governors-ball-2023": { year: 2023, page: "https://www.governorsballmusicfestival.com/set-times/", window: ["20230501", "20231231"],
    image: /gb23-set-times-(?:fri|sat|sun)-\d+\.jpg/i,
    days: [{ day: 1, date: "2023-06-09", token: /-fri-/i }, { day: 2, date: "2023-06-10", token: /-sat-/i }, { day: 3, date: "2023-06-11", token: /-sun-/i }] },
  // Movement 2016-2018 print every day on one schedule graphic on
  // movement.us/schedule, re-issued with a counter or a suffix (2016
  // "…_FINAL-5.jpg", 2017 "…_new-orientation_FINAL.jpg", 2018 "…_WEB.png").
  // Every day reads the same file. 2017 and 2018 also link a PDF, not read.
  "movement-2016": { year: 2016, page: "http://movement.us/schedule", window: ["20160301", "20161231"],
    image: /MVMT-2016-web-schedule[^"'\s/]*?\.jpg/i,
    days: [{ day: 1, date: "2016-05-28", token: /schedule/i }, { day: 2, date: "2016-05-29", token: /schedule/i }, { day: 3, date: "2016-05-30", token: /schedule/i }] },
  "movement-2017": { year: 2017, page: "http://movement.us/schedule", window: ["20170201", "20171231"],
    image: /MVMT-2017-web-schedule[^"'\s/]*?\.jpg/i,
    days: [{ day: 1, date: "2017-05-27", token: /schedule/i }, { day: 2, date: "2017-05-28", token: /schedule/i }, { day: 3, date: "2017-05-29", token: /schedule/i }] },
  "movement-2018": { year: 2018, page: "http://movement.us/schedule", window: ["20180101", "20181231"],
    image: /MVMT-2018-web-schedule[^"'\s/]*?\.png/i,
    days: [{ day: 1, date: "2018-05-26", token: /schedule/i }, { day: 2, date: "2018-05-27", token: /schedule/i }, { day: 3, date: "2018-05-28", token: /schedule/i }] },
  // Electric Forest 2024 and 2025: one grid per day, Thursday to Sunday, from
  // AEG's blob store. 2024's only capture that embeds them is from June 16,
  // before the festival; its "brainery.jpg" (workshops) is not matched.
  "electric-forest-2024": { year: 2024, page: "http://electricforest.com/schedule/", window: ["20240501", "20241231"],
    image: /content\/electric-forest-2024\/schedule\/(?:thurs|fri|sat|sun)\.jpg/i,
    days: [{ day: 1, date: "2024-06-20", token: /^thurs\./ }, { day: 2, date: "2024-06-21", token: /^fri\./ }, { day: 3, date: "2024-06-22", token: /^sat\./ }, { day: 4, date: "2024-06-23", token: /^sun\./ }] },
  "electric-forest-2025": { year: 2025, page: "http://electricforest.com/schedules/", window: ["20250501", "20251231"],
    image: /content\/electric-forest\/2025\/set-times\/(?:thur|fri|sat|sun)\.jpg/i,
    days: [{ day: 1, date: "2025-06-19", token: /^thur\./ }, { day: 2, date: "2025-06-20", token: /^fri\./ }, { day: 3, date: "2025-06-21", token: /^sat\./ }, { day: 4, date: "2025-06-22", token: /^sun\./ }] },
  // Ultra Europe 2024: three numbered social posts on /lineup/set-times/
  // ("ULTRA-EUROPE-SET-TIMES-IG-POST_01-960x1200.jpg"); only that resized copy
  // was archived. The numbers are taken as Friday to Sunday, which review must
  // confirm against each graphic's printed day.
  "ultra-europe-2024": { year: 2024, page: "https://ultraeurope.com/lineup/set-times/", window: ["20240601", "20241231"],
    image: /ULTRA-EUROPE-SET-TIMES-IG-POST_0[1-3]-960x1200\.jpg/i,
    days: [{ day: 1, date: "2024-07-12", token: /_01-/ }, { day: 2, date: "2024-07-13", token: /_02-/ }, { day: 3, date: "2024-07-14", token: /_03-/ }] },
  // Coachella 2019: one grid per day and weekend on /set-times/, from the
  // festival's CloudFront uploads ("c19_settimes_friday_wk1_v1.jpg"). The Do
  // LaB and Heineken House grids are separate files and not matched.
  "coachella-2019": { year: 2019, page: "https://coachella.com/set-times/", window: ["20190401", "20190630"],
    image: /c19_settimes_(?:friday|saturday|sunday)_wk[12]_v\d+\.jpg/i,
    days: [{ day: 1, date: "2019-04-12", token: /_friday_wk1_/i }, { day: 2, date: "2019-04-13", token: /_saturday_wk1_/i }, { day: 3, date: "2019-04-14", token: /_sunday_wk1_/i },
      { day: 4, date: "2019-04-19", token: /_friday_wk2_/i }, { day: 5, date: "2019-04-20", token: /_saturday_wk2_/i }, { day: 6, date: "2019-04-21", token: /_sunday_wk2_/i }] },
  // Coachella 2018: Weekend 1 grids on /lineup/set-times/ from the festival's
  // S3 bucket ("c18_notthefileyouarelookingfor_wk1_fri_v1.png"); Weekend 2
  // re-issued them as "C18dog_wk2-gridupdate-4201.jpg" to "…-4203.jpg", taken
  // as Friday to Sunday, which review must confirm against the printed day.
  "coachella-2018": { year: 2018, page: "https://www.coachella.com/lineup/set-times/", window: ["20180401", "20181231"],
    image: /(?:c18_notthefileyouarelookingfor_wk1_(?:fri|sat|sun)_v\d+\.png|C18dog_wk2-gridupdate-420[123]\.jpg)/i,
    days: [{ day: 1, date: "2018-04-13", token: /_wk1_fri_/i }, { day: 2, date: "2018-04-14", token: /_wk1_sat_/i }, { day: 3, date: "2018-04-15", token: /_wk1_sun_/i },
      { day: 4, date: "2018-04-20", token: /-4201\./ }, { day: 5, date: "2018-04-21", token: /-4202\./ }, { day: 6, date: "2018-04-22", token: /-4203\./ }] },
  // Ultra 2011: every stage and day on one timetable graphic
  // ("umf2011-timetables1.jpg") on /set-times. Every day reads the same file.
  "ultra-miami-2011": { year: 2011, page: "http://www.ultramusicfestival.com/set-times", window: ["20110301", "20111231"],
    image: /umf2011-timetables\d*\.jpg/i,
    days: [{ day: 1, date: "2011-03-25", token: /timetables/i }, { day: 2, date: "2011-03-26", token: /timetables/i }, { day: 3, date: "2011-03-27", token: /timetables/i }] },
  // Ultra 2012: one grid per day on /set-times/ ("uploads/2012/03/friday.jpg").
  "ultra-miami-2012": { year: 2012, page: "http://www.ultramusicfestival.com/set-times/", window: ["20120301", "20121231"],
    image: /uploads\/2012\/03\/(?:friday|saturday|sunday)\.jpg/i,
    days: [{ day: 1, date: "2012-03-23", token: /^friday\./i }, { day: 2, date: "2012-03-24", token: /^saturday\./i }, { day: 3, date: "2012-03-25", token: /^sunday\./i }] },
  // Electric Forest 2017, 2019 and 2022: one grid per day on the year's
  // /20YY-info/schedule/ page. Only WordPress's resized copies are embedded
  // ("EF2019_Schedules_Friday-1000x1294.jpg"); the Brainery (workshops) grid
  // is not matched. 2017's page shows Weekend 2 only, so its days are 5 to 8;
  // no Weekend 1 grid was archived. 2022 first issued "…_Friday2-…" and
  // "…_Saturday2-…"; the page's later captures carry the final names.
  "electric-forest-2017": { year: 2017, page: "https://www.electricforestfestival.com/2017-info/schedule/", window: ["20170601", "20171231"],
    image: /EF2017__W2_Schedule_(?:Thurs-1|Friday|Saturday|Sun)-1000x1294\.jpg/i,
    days: [{ day: 5, date: "2017-06-29", token: /_Thurs-/ }, { day: 6, date: "2017-06-30", token: /_Friday-/ }, { day: 7, date: "2017-07-01", token: /_Saturday-/ }, { day: 8, date: "2017-07-02", token: /_Sun-/ }] },
  "electric-forest-2019": { year: 2019, page: "https://electricforestfestival.com/2019-info/schedule/", window: ["20190601", "20191231"],
    image: /EF2019_Schedules_(?:Thursday-1|Friday|Saturday|Sunday)-1000x1294\.jpg/i,
    days: [{ day: 1, date: "2019-06-27", token: /_Thursday-/ }, { day: 2, date: "2019-06-28", token: /_Friday-/ }, { day: 3, date: "2019-06-29", token: /_Saturday-/ }, { day: 4, date: "2019-06-30", token: /_Sunday-/ }] },
  "electric-forest-2022": { year: 2022, page: "https://electricforestfestival.com/2022-info/schedule/", window: ["20220601", "20221231"],
    image: /uploads\/2022\/06\/EF2022_Schedules?_(?:Thursday|Friday2?|Saturday2?|Sunday)-1545x2000\.jpg/i,
    days: [{ day: 1, date: "2022-06-23", token: /_Thursday-/ }, { day: 2, date: "2022-06-24", token: /_Friday2?-/ }, { day: 3, date: "2022-06-25", token: /_Saturday2?-/ }, { day: 4, date: "2022-06-26", token: /_Sunday-/ }] },
  // Movement 2019: every day on one schedule graphic on the Shopify site's
  // /pages/schedule-2019 ("Movement-2019__Full_Schedule_<uuid>.png").
  "movement-2019": { year: 2019, page: "https://www.movement.us/pages/schedule-2019", window: ["20190501", "20191231"],
    image: /Movement-2019__Full_Schedule[^"'\s/?]*?\.png/i,
    days: [{ day: 1, date: "2019-05-25", token: /schedule/i }, { day: 2, date: "2019-05-26", token: /schedule/i }, { day: 3, date: "2019-05-27", token: /schedule/i }] },
  // Movement 2023 and 2024: one graphic per day on the Shopify site's schedule
  // page (2024's is /pages/schedule-1; /pages/schedule said "check back").
  // 2023's Saturday was reissued as "…1_SAT_update.jpg". 2025 prints every
  // stage and day on one graphic, so every day reads the same file.
  "movement-2023": { year: 2023, page: "https://movementfestival.com/pages/schedule", window: ["20230501", "20231231"],
    image: /Movement23_FullSchedule\d_(?:SAT|SUN|MON)[^"'\s/?]*?\.jpg/i,
    days: [{ day: 1, date: "2023-05-27", token: /_SAT/ }, { day: 2, date: "2023-05-28", token: /_SUN/ }, { day: 3, date: "2023-05-29", token: /_MON/ }] },
  "movement-2024": { year: 2024, page: "https://movementfestival.com/pages/schedule-1", window: ["20240501", "20241231"],
    image: /Movement24_Fullschedules[^"'\s/?]*?\.jpg/i,
    days: [{ day: 1, date: "2024-05-25", token: /_Saturday_/ }, { day: 2, date: "2024-05-26", token: /_Sunday_/ }, { day: 3, date: "2024-05-27", token: /_Monday_/ }] },
  "movement-2025": { year: 2025, page: "https://movementfestival.com/pages/schedule", window: ["20250501", "20251231"],
    image: /Movement25_Fullschedules[^"'\s/?]*?\.png/i,
    days: [{ day: 1, date: "2025-05-24", token: /schedules/i }, { day: 2, date: "2025-05-25", token: /schedules/i }, { day: 3, date: "2025-05-26", token: /schedules/i }] },
  // Shambhala 2019: one full schedule (Thursday to Sunday) embedded on
  // /stages-lineups/ as "SMF-2019-full-schedule-1-1.png". The page also links
  // "…-full-schedule-1.png" and four per-day "…-instgram-<day>.png" posts,
  // none of them archived, so they are not matched. Every day reads one file.
  "shambhala-2019": { year: 2019, page: "https://shambhalamusicfestival.com/stages-lineups/", window: ["20190701", "20191231"],
    image: /SMF-2019-full-schedule-1-1\.png/i,
    days: [{ day: 1, date: "2019-08-08", token: /full-schedule/i }, { day: 2, date: "2019-08-09", token: /full-schedule/i }, { day: 3, date: "2019-08-10", token: /full-schedule/i }, { day: 4, date: "2019-08-11", token: /full-schedule/i }] },
  // Ultra Europe 2019 and 2025 print every stage and day on one graphic
  // (2019 on /lineup/, "europe-lineup-times-2019.jpg", later
  // "…-settimes-2019-1.jpg"; 2025 on /lineup/set-times/). Every day reads the
  // same file. 2023 is three numbered social posts on /set-times/, taken as
  // Friday to Sunday, which review must confirm against the printed day.
  "ultra-europe-2019": { year: 2019, page: "https://ultraeurope.com/lineup/", window: ["20190601", "20191231"],
    image: /europe-lineup-(?:settimes|times)-2019[-\d]*\.jpg/i,
    days: [{ day: 1, date: "2019-07-12", token: /lineup/i }, { day: 2, date: "2019-07-13", token: /lineup/i }, { day: 3, date: "2019-07-14", token: /lineup/i }] },
  "ultra-europe-2023": { year: 2023, page: "https://ultraeurope.com/set-times/", window: ["20230601", "20231231"],
    image: /ULTRA-EUROPE-2023-SET-TIMES-IG-Post_0[1-3][-\d]*?-960x1200\.jpe?g/i,
    days: [{ day: 1, date: "2023-07-07", token: /_01-/ }, { day: 2, date: "2023-07-08", token: /_02-/ }, { day: 3, date: "2023-07-09", token: /_03-/ }] },
  "ultra-europe-2025": { year: 2025, page: "https://ultraeurope.com/lineup/set-times/", window: ["20250601", "20251231"],
    image: /2025-ULTRA-EUROPE-SET-TIMES-WEB-IMAGE[^"'\s/]*?\.png/i,
    days: [{ day: 1, date: "2025-07-11", token: /SET-TIMES/i }, { day: 2, date: "2025-07-12", token: /SET-TIMES/i }, { day: 3, date: "2025-07-13", token: /SET-TIMES/i }] },
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
