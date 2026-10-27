// ═══════════════════════════════════════════════════════════════════════
// ESCAPE HALLOWEEN 2026 — NOS Events Center · San Bernardino, CA
// Oct 30–31, 2026 · Insomniac
// ═══════════════════════════════════════════════════════════════════════
// SET TIMES ARE OFFICIAL (flipped 2026-10-26). Every act carries its real
// day, stage, start and end. The map is still last year's (see THE MAP).
//
// SOURCE set times: escapehalloween.com/lineup/set-times/day-1/ (Fri) and
//   /day-2/ (Sat), read 2026-10-26 with scripts/fetch-insomniac-settimes.mjs.
//   118 sets on 7 stages: Fri 58, Sat 60. Every stage closes 02:00 both
//   nights except Saturday's Warehouse, 01:40.
//   ✓ CROSS-CHECKED: the fetch matched, row for row, a second independent
//   read of the same two pages (the lane's browser CSV, Slack 2026-10-26).
//   Names are AS PRINTED, oddities included: "k?d presents: Kill The Kid",
//   "Dr. Greco", "B2" (a Danse Macabre act, also on the lineup page — not a
//   B2B fragment), "MALUGI presents Matteo & Friends B2B" (looks cut off on
//   the page; carried as printed).
// SOURCE lineup + day split: escapehalloween.com/lineup, re-read 2026-10-26.
//   115 acts (Fri 58, Sat 57; disjoint; union = the alphabetical list) and a
//   By Stage list on the same 7 stages. Every set-times act is on it except
//   two, where the set-times page wins:
//   · Fri Big Top 16:00–17:15 is "Solitaire"; the lineup page still says
//     "Discovery Project". Lane ruling: the official schedule wins.
//   · "MALUGI presents Matteo & Friends B2B" is on the schedule only.
//   Dropped since the 2026-09-07 read, because the official lineup no longer
//   lists them: Ice Cube, "VNSSA B2B ????", and the separate card names
//   RoRoll and HUA (now billed together as "RoRoll B2B HUA").
// SOURCE stages: escapehalloween.com/experience/stages — five stages, each
//   with official lore copy. Danse Macabre and the Beatbox Art Car are on the
//   2026 schedule but not that page; they carry no x/y (see STAGES).
//   See the ⚠ on Psycho Circus below.
// SOURCE hours + policy: /guide/hours-and-info and /guide/faq, read
//   2026-09-07 — "Show Dates: October 30 + 31, 2026", "Festival Hours
//   4PM-2AM", "Afterparty 2AM-6AM", "You must be 18+ to enter and 21+ for
//   alcohol/VIP", "NO Re-entry/ins & outs per day", and on cash: "Yes, ATMs
//   will be available both inside and outside the venue grounds."
// SOURCE venue: OpenStreetMap way 563078901, via Nominatim 2026-09-07.
// SOURCE sun times: api.sunrise-sunset.org at the venue, converted to PDT.
//
// ⛔ THE OSM LOOKUP THAT FAILS. Searching OSM for "NOS Events Center" —
// the name the festival itself uses on every page — returns NOTHING. The
// venue is tagged "National Orange Show & Event Center". This is the third
// time this exact shape has cost a session (Pier 80 in portola-2026.js, the
// unlinked map page in hard-summer-2026.js): search by the LEGAL name and
// by the street address before concluding a venue is not in OSM.
//
// ⚠ PSYCHO CIRCUS IS NOT A 2026 STAGE. It appears prominently on the map
// art below, because that art is the 2025 map. The official 2026 stages
// page lists five stages and Psycho Circus is not among them. Do not add it
// back by reading the artwork — the artwork is a year out of date, which is
// the whole point of the fallback rule.
//
// ── THE MAP: LAST YEAR'S, DELIBERATELY ──
// Founder ruling (2026-09-06): "each edition ships its own map once it's
// officially released; until release week, fall back to last year's map."
// Insomniac has NOT released a 2026 map — /guide/festival-map/ still serves
// esc_2025_de_festival_map_1080x1350_r03.webp, and the FAQ still says
// amenities "will be clearly marked on the festival map" in the future
// tense. So this ships the 2025 map, and the five 2026 stages are
// registered to where they stand ON THAT ART.
//
//   ⚠ THIS IS A FALLBACK AND MUST BE REPLACED. Swap in the 2026 map the
//   week it drops and RE-MEASURE all five x/y — do not assume the layout
//   carried over. 2026 already dropped a stage; positions can move too.
//
//   The asset is 1040×1040 SQUARE ON PURPOSE. The source is 1080×1350; the
//   map panel was cropped and letterboxed to a square because map.jsx draws
//   image-overlay art with preserveAspectRatio="xMidYMid slice" — feed it a
//   non-square asset and every stage x/y silently shifts. Learned on HARD
//   Summer; do not "fix" the black bars.
//
//   Stage x/y were measured against a labelled 10×10 grid and then VERIFIED
//   by drawing the pins back onto the art and looking. That second step is
//   not optional: the first pass put FEEDING GROUNDS on its banner ribbon,
//   WAREHOUSE out on Psycho Path, SEWER DISTRICT beside its structure and
//   BIG TOP off the tent. Four of five were wrong, exactly as on HARD
//   Summer. Measure the STRUCTURE, never the label.
//
// ── TIMEZONE ──
// The pages print no zone. The venue is in San Bernardino and the official
// hours page reads "Festival Hours 4PM-2AM", so times are venue-local
// Pacific. US DST ends Sun Nov 1 at 02:00 — the instant night 2 closes — so
// every set is in PDT (UTC-7) with no ambiguous hour (lane ruling 2026-10-26,
// founder veto open). scripts/test-escape-set-times.mjs pins the instants.
//
// ── ANCHOR PROVENANCE (SPEC-add-festivals tiering) ──
// gpsAnchors: NONE. Not T3, not provisional, ABSENT. mapArtIsGeoregistered
// is false, MAP_AFFINE stays null, and the v257/v260 gate suppresses every
// distance and walk-time readout.
//
// ── STILL OPEN AFTER THE SET-TIMES FLIP ──
//   1. The 2026 map replaces escape-2025-map.webp; RE-MEASURE all x/y, and
//      place Danse Macabre and the Beatbox Art Car.
//   2. Re-check the stage list against the 2026 map (2025 had six).
// ═══════════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  // Colours are APP-ASSIGNED, chosen to echo each stage's own art on the
  // 2025 map. Insomniac publishes no stage palette — do not cite these as
  // official. Order and copy follow the official /experience/stages/ page.
  const STAGES = [
    { id: "big-top",        name: "The Big Top",     short: "BIGTOP",  color: "#29B6F6", size: 1.6,
      x: 20.0, y: 66.0,
      desc: "Main stage · carnival lights masking a darker secret" },
    { id: "feeding-grounds", name: "Feeding Grounds", short: "FEEDING", color: "#7CB342", size: 1.4,
      x: 30.0, y: 30.0,
      desc: "Giant creepy crawlers, waiting in the dark" },
    { id: "warehouse",      name: "The Warehouse",   short: "WAREHSE", color: "#FFB300", size: 1.4,
      x: 64.0, y: 53.0,
      desc: "The last curtain call — where the show ends and the spirits remain" },
    { id: "sewer-district", name: "Sewer District",  short: "SEWER",   color: "#9C27B0", size: 1.3,
      x: 87.0, y: 59.0,
      desc: "Dystopian lockdown · subliminal minimalism and live art" },
    { id: "cage",           name: "The Cage",        short: "CAGE",    color: "#F4511E", size: 1.3,
      x: 18.5, y: 27.5,
      desc: "Realm of hellfire — fire-breathers, metal-benders and welders" },
    // ⚠ NO POSITION, deliberately. Both are on the official 2026 set-times
    // pages and the lineup's By Stage list, but on neither the /experience/
    // stages page nor any published 2026 map (the map page still serves the
    // 2025 art, which has no such stages). map.jsx's PLACED_STAGES filter
    // draws nothing for a stage with no numeric x/y; the acts still list.
    // Same call as Nocturnal's Rave Cave. Place them from the 2026 map.
    { id: "danse-macabre",  name: "Danse Macabre",   short: "MACABRE", color: "#EC407A", size: 1.1,
      desc: "On the official 2026 set times" },
    { id: "beatbox-art-car", name: "Beatbox Art Car", short: "BEATBOX", color: "#26A69A", size: 0.9,
      desc: "Art car · on the official 2026 set times" },
  ];

  // No amenity list published for 2026. The 2025 map art carries amenity
  // icons, but reading 2026 amenities off last year's artwork is exactly the
  // thing the Psycho Circus note above warns against.
  const AMENITIES = [];

  // Day, stage and set time are all OFFICIAL: the block below is written by
  // the importer from the per-day set-times pages, never by hand. Re-run both
  // commands to pick up a schedule change:
  //   node scripts/fetch-insomniac-settimes.mjs https://escapehalloween.com/lineup/set-times --days 2 --out sheet.tsv
  //   node scripts/import-set-times.mjs escape-halloween-2026 sheet.tsv --source https://escapehalloween.com/lineup/set-times/day-1/
  // id → [stageId, start, end]. Times are venue-local wall clock (PDT, see
  // CONFIG); after-midnight sets sit under the night they belong to.
  // An act the sheet stops naming falls back to stage null and blank times.
  const SCHEDULE = {
    // SCHEDULE:BEGIN escape-halloween-2026
    // source: https://escapehalloween.com/lineup/set-times/day-1/ · imported 2026-10-27 · 118 of 118 acts
    "esc-solitaire-d1": ["big-top", "16:00", "17:15"],  // Solitaire
    "esc-nervo-d1": ["big-top", "17:15", "18:30"],  // Nervo
    "esc-cascada-d1": ["big-top", "18:30", "19:00"],  // Cascada
    "esc-morten-d1": ["big-top", "19:00", "20:00"],  // MORTEN
    "esc-kream-d1": ["big-top", "20:00", "21:00"],  // KREAM
    "esc-benny-benassi-d1": ["big-top", "21:00", "22:15"],  // Benny Benassi
    "esc-dimitri-vegas-and-like-mike-d1": ["big-top", "22:15", "23:30"],  // Dimitri Vegas & Like Mike
    "esc-steve-aoki-d1": ["big-top", "23:30", "00:40"],  // Steve Aoki
    "esc-cloonee-d1": ["big-top", "00:45", "02:00"],  // Cloonee
    "esc-pixie-dust-d1": ["feeding-grounds", "16:00", "17:00"],  // Pixie Dust
    "esc-kqd-presents-kill-the-kid-d1": ["feeding-grounds", "17:00", "18:00"],  // k?d presents: Kill The Kid
    "esc-mish-d1": ["feeding-grounds", "18:00", "19:00"],  // Mish
    "esc-gammer-d1": ["feeding-grounds", "19:00", "20:00"],  // Gammer
    "esc-frontliner-journey-set-d1": ["feeding-grounds", "20:00", "21:00"],  // Frontliner (Journey Set)
    "esc-anime-no-boundaries-d1": ["feeding-grounds", "21:00", "22:00"],  // AniMe - No Boundaries
    "esc-showtek-hardstyle-set-d1": ["feeding-grounds", "22:00", "23:00"],  // Showtek (Hardstyle Set)
    "esc-darren-styles-d1": ["feeding-grounds", "23:00", "00:00"],  // Darren Styles
    "esc-coone-b2b-dj-isaac-d1": ["feeding-grounds", "00:00", "01:00"],  // Coone B2B DJ Isaac
    "esc-lady-faith-b2b-lny-tnz-d1": ["feeding-grounds", "01:00", "02:00"],  // Lady Faith B2B LNY TNZ
    "esc-morelia-d1": ["warehouse", "16:00", "17:00"],  // Morelia
    "esc-trancemaster-krause-d1": ["warehouse", "17:00", "18:25"],  // Trancemaster Krause
    "esc-kloud-d1": ["warehouse", "18:25", "19:50"],  // Kloud
    "esc-cera-khin-d1": ["warehouse", "19:50", "21:15"],  // Cera Khin
    "esc-azyr-d1": ["warehouse", "21:15", "22:40"],  // Azyr
    "esc-clara-cuv-d1": ["warehouse", "22:40", "00:10"],  // Clara Cuvé
    "esc-trym-d1": ["warehouse", "00:10", "02:00"],  // Trym
    "esc-all-the-reason-d1": ["sewer-district", "16:00", "16:45"],  // All The Reason
    "esc-modal-nodes-d1": ["sewer-district", "16:45", "17:45"],  // MODAL NODES
    "esc-hershe-d1": ["sewer-district", "17:45", "18:45"],  // HerShe
    "esc-a-little-sound-d1": ["sewer-district", "18:45", "19:45"],  // A Little Sound
    "esc-cyclops-d1": ["sewer-district", "19:45", "20:45"],  // Cyclops
    "esc-getter-d1": ["sewer-district", "20:45", "21:45"],  // Getter
    "esc-ydg-d1": ["sewer-district", "21:45", "22:45"],  // YDG
    "esc-level-up-d1": ["sewer-district", "22:50", "23:50"],  // Level Up
    "esc-kai-wachi-d1": ["sewer-district", "23:55", "00:55"],  // Kai Wachi
    "esc-excision-d1": ["sewer-district", "01:00", "02:00"],  // Excision
    "esc-kana-hishiya-d1": ["cage", "16:00", "17:30"],  // Kana Hishiya
    "esc-silvie-loto-d1": ["cage", "17:30", "19:00"],  // Silvie Loto
    "esc-dj-tennis-d1": ["cage", "19:00", "20:30"],  // DJ Tennis
    "esc-adam-ten-d1": ["cage", "20:30", "22:00"],  // Adam Ten
    "esc-joseph-capriati-b2b-sosa-d1": ["cage", "22:00", "00:00"],  // Joseph Capriati B2B Sosa
    "esc-jamie-jones-b2b-franky-rizardo-d1": ["cage", "00:00", "02:00"],  // Jamie Jones B2B Franky Rizardo
    "esc-unscheduled-hiwater": ["danse-macabre", "16:00", "17:00"],  // HIWATER
    "esc-unscheduled-kimmo": ["danse-macabre", "17:00", "18:00"],  // Kimmo
    "esc-unscheduled-monic": ["danse-macabre", "18:00", "19:00"],  // Monic
    "esc-unscheduled-all-rise": ["danse-macabre", "19:00", "20:00"],  // All Rise
    "esc-roroll-b2b-hua-d1": ["danse-macabre", "20:00", "21:00"],  // RoRoll B2B HUA
    "esc-unscheduled-seung": ["danse-macabre", "21:00", "22:00"],  // SEUNG
    "esc-unscheduled-honeypacq": ["danse-macabre", "22:00", "23:00"],  // HoneyPacq
    "esc-b2-d1": ["danse-macabre", "23:00", "00:00"],  // B2
    "esc-unscheduled-death-simulator": ["danse-macabre", "00:00", "01:00"],  // Death Simulator
    "esc-unscheduled-comadoses": ["danse-macabre", "01:00", "02:00"],  // Comadoses
    "esc-mr-fowler-d1": ["beatbox-art-car", "16:00", "17:30"],  // Mr. Fowler
    "esc-lady-sinclair-d1": ["beatbox-art-car", "17:30", "19:00"],  // Lady Sinclair
    "esc-benni-ola-d1": ["beatbox-art-car", "19:00", "20:30"],  // Benni Ola
    "esc-sabrosura-boyz-d1": ["beatbox-art-car", "20:30", "22:00"],  // Sabrosura Boyz
    "esc-dr-greco-d1": ["beatbox-art-car", "22:00", "00:00"],  // Dr. Greco
    "esc-morelia-b2b-pixie-dust-d1": ["beatbox-art-car", "00:00", "02:00"],  // Morelia B2B Pixie Dust
    "esc-lumi-d2": ["big-top", "16:00", "17:00"],  // LUMI
    "esc-telykast-d2": ["big-top", "17:00", "18:00"],  // TELYKAST
    "esc-joyryde-sunset-set-d2": ["big-top", "18:00", "19:00"],  // JOYRYDE (Sunset Set)
    "esc-ian-asher-d2": ["big-top", "19:00", "20:00"],  // Ian Asher
    "esc-maddix-d2": ["big-top", "20:00", "21:00"],  // Maddix
    "esc-alok-d2": ["big-top", "21:00", "22:10"],  // Alok
    "esc-galantis-d2": ["big-top", "22:15", "23:25"],  // Galantis
    "esc-disco-lines-d2": ["big-top", "23:25", "00:40"],  // Disco Lines
    "esc-zedd-d2": ["big-top", "00:45", "02:00"],  // Zedd
    "esc-cat-and-maomi-d2": ["feeding-grounds", "16:00", "17:00"],  // Cat & Maomi
    "esc-pedroz-d2": ["feeding-grounds", "17:00", "18:00"],  // PEDROZ
    "esc-rommii-d2": ["feeding-grounds", "18:00", "19:00"],  // Rommii
    "esc-andruss-b2b-juos-d2": ["feeding-grounds", "19:00", "20:15"],  // Andruss B2B Juos
    "esc-girl-math-d2": ["feeding-grounds", "20:15", "21:30"],  // Girl Math
    "esc-ac-slater-d2": ["feeding-grounds", "21:30", "23:00"],  // AC Slater
    "esc-san-pacho-d2": ["feeding-grounds", "23:00", "00:30"],  // San Pacho
    "esc-omnom-d2": ["feeding-grounds", "00:30", "02:00"],  // OMNOM
    "esc-chrysalis-d2": ["warehouse", "16:00", "17:15"],  // Chrysalis
    "esc-alex-chapman-b2b-zoe-gitter-d2": ["warehouse", "17:15", "18:45"],  // Alex Chapman B2B Zoe Gitter
    "esc-sedef-adas-d2": ["warehouse", "18:45", "20:00"],  // Sedef Adasï
    "esc-champion-d2": ["warehouse", "20:00", "21:10"],  // Champion
    "esc-avalon-emerson-d2": ["warehouse", "21:10", "22:20"],  // Avalon Emerson
    "esc-dj-heartstring-d2": ["warehouse", "22:20", "23:30"],  // DJ Heartstring
    "esc-malugi-d2": ["warehouse", "23:30", "00:40"],  // MALUGI
    "esc-malugi-presents-matteo-and-friends-b2b-d2": ["warehouse", "00:40", "01:40"],  // MALUGI presents Matteo & Friends B2B
    "esc-acyan-d2": ["sewer-district", "16:00", "16:40"],  // Acyan
    "esc-ero808-d2": ["sewer-district", "16:40", "17:40"],  // ero808
    "esc-jon-casey-d2": ["sewer-district", "17:40", "18:40"],  // Jon Casey
    "esc-know-good-d2": ["sewer-district", "18:40", "19:40"],  // Know Good
    "esc-bou-d2": ["sewer-district", "19:40", "20:40"],  // Bou
    "esc-dr-fresch-d2": ["sewer-district", "20:40", "21:40"],  // Dr. Fresch
    "esc-adventure-club-d2": ["sewer-district", "21:40", "22:40"],  // Adventure Club
    "esc-liquid-stranger-d2": ["sewer-district", "22:45", "23:45"],  // Liquid Stranger
    "esc-too-hort-d2": ["sewer-district", "23:45", "00:15"],  // Too $hort
    "esc-ja-rule-d2": ["sewer-district", "00:15", "00:45"],  // Ja Rule
    "esc-dabin-d2": ["sewer-district", "00:50", "02:00"],  // Dabin
    "esc-jsmn-d2": ["cage", "16:00", "17:15"],  // JSMN
    "esc-yanamaste-d2": ["cage", "17:15", "18:30"],  // Yanamaste
    "esc-funk-assault-d2": ["cage", "18:30", "20:00"],  // Funk Assault
    "esc-richie-hawtin-d2": ["cage", "20:00", "21:30"],  // Richie Hawtin
    "esc-nina-kraviz-d2": ["cage", "21:30", "23:00"],  // Nina Kraviz
    "esc-indira-paganotto-d2": ["cage", "23:00", "00:30"],  // Indira Paganotto
    "esc-999999999-d2": ["cage", "00:30", "02:00"],  // 999999999
    "esc-unscheduled-landopolo": ["danse-macabre", "16:00", "17:00"],  // Landopolo
    "esc-unscheduled-coe": ["danse-macabre", "17:00", "18:00"],  // $coe
    "esc-unscheduled-desa-deca": ["danse-macabre", "18:00", "19:00"],  // Desa Deca
    "esc-unscheduled-nina-j": ["danse-macabre", "19:00", "20:00"],  // Nina J
    "esc-unscheduled-spency-be": ["danse-macabre", "20:00", "21:00"],  // Spency Be
    "esc-unscheduled-mark-lizaola": ["danse-macabre", "21:00", "22:00"],  // Mark Lizaola
    "esc-unscheduled-richard-vission": ["danse-macabre", "22:00", "23:00"],  // Richard Vission
    "esc-unscheduled-shaking": ["danse-macabre", "23:00", "00:00"],  // SHAKING
    "esc-unscheduled-marie-nyx": ["danse-macabre", "00:00", "01:00"],  // Marie Nyx
    "esc-unscheduled-tykni": ["danse-macabre", "01:00", "02:00"],  // TYKNI
    "esc-killmatter-d2": ["beatbox-art-car", "16:00", "17:00"],  // KILLMATTER
    "esc-craymak-d2": ["beatbox-art-car", "17:00", "18:30"],  // CRaymak
    "esc-acyan-d2-s2": ["beatbox-art-car", "18:30", "20:00"],  // Acyan
    "esc-sim-ivy-d2": ["beatbox-art-car", "20:00", "21:30"],  // Sim Ivy
    "esc-cat-and-maomi-d2-s2": ["beatbox-art-car", "21:30", "23:00"],  // Cat & Maomi
    "esc-fvlako-d2": ["beatbox-art-car", "23:00", "00:30"],  // FVLAKO
    "esc-juos-d2": ["beatbox-art-car", "00:30", "02:00"],  // Juos
    // SCHEDULE:END
  };
  const scheduled = act => {
    const s = SCHEDULE[act.id];
    if (!s) return act;
    const { provisional, ...rest } = act;
    // `tier` is display weighting from the official start hour, on the night
    // clock (before 08:00 is after midnight, so a 00:45 closer ranks top).
    const h = +s[1].slice(0, 2), nh = h < 8 ? h + 24 : h;
    const color = (STAGES.find(x => x.id === s[0]) || STAGES[0]).color;
    return { ...rest, stage: s[0], start: s[1], end: s[2], day: s[3] ?? act.day,
      tier: nh >= 22 ? 3 : nh >= 20 ? 2 : 1,
      img: `linear-gradient(135deg, ${color}, #1a0a14)`, bio: "Playing Escape Halloween 2026." };
  };

  const mk = (id, name, day) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #F4511E, #1a0a14)",
    bio: `Playing Escape Halloween 2026 on ${day === 1 ? "Friday, October 30" : "Saturday, October 31"}. ` +
         `Not on the official set-times page.`,
    provisional: true,
  });

  const ARTISTS = [
    // ─────────── Friday, October 30 (58 sets) ───────────
    mk("esc-a-little-sound-d1", "A Little Sound", 1),
    mk("esc-adam-ten-d1", "Adam Ten", 1),
    mk("esc-unscheduled-all-rise", "All Rise", 1),
    mk("esc-all-the-reason-d1", "All The Reason", 1),
    mk("esc-anime-no-boundaries-d1", "AniMe - No Boundaries", 1),
    mk("esc-azyr-d1", "Azyr", 1),
    mk("esc-b2-d1", "B2", 1),
    mk("esc-benni-ola-d1", "Benni Ola", 1),
    mk("esc-benny-benassi-d1", "Benny Benassi", 1),
    mk("esc-cascada-d1", "Cascada", 1),
    mk("esc-cera-khin-d1", "Cera Khin", 1),
    mk("esc-clara-cuv-d1", "Clara Cuvé", 1),
    mk("esc-cloonee-d1", "Cloonee", 1),
    mk("esc-unscheduled-comadoses", "Comadoses", 1),
    mk("esc-coone-b2b-dj-isaac-d1", "Coone B2B DJ Isaac", 1),
    mk("esc-cyclops-d1", "Cyclops", 1),
    mk("esc-darren-styles-d1", "Darren Styles", 1),
    mk("esc-unscheduled-death-simulator", "Death Simulator", 1),
    mk("esc-dimitri-vegas-and-like-mike-d1", "Dimitri Vegas & Like Mike", 1),
    mk("esc-dj-tennis-d1", "DJ Tennis", 1),
    mk("esc-dr-greco-d1", "Dr. Greco", 1),
    mk("esc-excision-d1", "Excision", 1),
    mk("esc-frontliner-journey-set-d1", "Frontliner (Journey Set)", 1),
    mk("esc-gammer-d1", "Gammer", 1),
    mk("esc-getter-d1", "Getter", 1),
    mk("esc-hershe-d1", "HerShe", 1),
    mk("esc-unscheduled-hiwater", "HIWATER", 1),
    mk("esc-unscheduled-honeypacq", "HoneyPacq", 1),
    mk("esc-jamie-jones-b2b-franky-rizardo-d1", "Jamie Jones B2B Franky Rizardo", 1),
    mk("esc-joseph-capriati-b2b-sosa-d1", "Joseph Capriati B2B Sosa", 1),
    mk("esc-kqd-presents-kill-the-kid-d1", "k?d presents: Kill The Kid", 1),
    mk("esc-kai-wachi-d1", "Kai Wachi", 1),
    mk("esc-kana-hishiya-d1", "Kana Hishiya", 1),
    mk("esc-unscheduled-kimmo", "Kimmo", 1),
    mk("esc-kloud-d1", "Kloud", 1),
    mk("esc-kream-d1", "KREAM", 1),
    mk("esc-lady-faith-b2b-lny-tnz-d1", "Lady Faith B2B LNY TNZ", 1),
    mk("esc-lady-sinclair-d1", "Lady Sinclair", 1),
    mk("esc-level-up-d1", "Level Up", 1),
    mk("esc-mish-d1", "Mish", 1),
    mk("esc-modal-nodes-d1", "MODAL NODES", 1),
    mk("esc-unscheduled-monic", "Monic", 1),
    mk("esc-morelia-d1", "Morelia", 1),
    mk("esc-morelia-b2b-pixie-dust-d1", "Morelia B2B Pixie Dust", 1),
    mk("esc-morten-d1", "MORTEN", 1),
    mk("esc-mr-fowler-d1", "Mr. Fowler", 1),
    mk("esc-nervo-d1", "Nervo", 1),
    mk("esc-pixie-dust-d1", "Pixie Dust", 1),
    mk("esc-roroll-b2b-hua-d1", "RoRoll B2B HUA", 1),
    mk("esc-sabrosura-boyz-d1", "Sabrosura Boyz", 1),
    mk("esc-unscheduled-seung", "SEUNG", 1),
    mk("esc-showtek-hardstyle-set-d1", "Showtek (Hardstyle Set)", 1),
    mk("esc-silvie-loto-d1", "Silvie Loto", 1),
    mk("esc-solitaire-d1", "Solitaire", 1),
    mk("esc-steve-aoki-d1", "Steve Aoki", 1),
    mk("esc-trancemaster-krause-d1", "Trancemaster Krause", 1),
    mk("esc-trym-d1", "Trym", 1),
    mk("esc-ydg-d1", "YDG", 1),
    // ─────────── Saturday, October 31 (60 sets) ───────────
    // Acyan and Cat & Maomi play TWICE on Saturday (a stage set, then the
    // Beatbox Art Car). Two entries each, the second id ending -s2; it is not
    // a duplicate row.
    mk("esc-999999999-d2", "999999999", 2),
    mk("esc-ac-slater-d2", "AC Slater", 2),
    mk("esc-acyan-d2", "Acyan", 2),
    mk("esc-acyan-d2-s2", "Acyan", 2),
    mk("esc-adventure-club-d2", "Adventure Club", 2),
    mk("esc-alex-chapman-b2b-zoe-gitter-d2", "Alex Chapman B2B Zoe Gitter", 2),
    mk("esc-alok-d2", "Alok", 2),
    mk("esc-andruss-b2b-juos-d2", "Andruss B2B Juos", 2),
    mk("esc-avalon-emerson-d2", "Avalon Emerson", 2),
    mk("esc-bou-d2", "Bou", 2),
    mk("esc-cat-and-maomi-d2", "Cat & Maomi", 2),
    mk("esc-cat-and-maomi-d2-s2", "Cat & Maomi", 2),
    mk("esc-champion-d2", "Champion", 2),
    mk("esc-chrysalis-d2", "Chrysalis", 2),
    mk("esc-unscheduled-coe", "$coe", 2),
    mk("esc-craymak-d2", "CRaymak", 2),
    mk("esc-dabin-d2", "Dabin", 2),
    mk("esc-unscheduled-desa-deca", "Desa Deca", 2),
    mk("esc-disco-lines-d2", "Disco Lines", 2),
    mk("esc-dj-heartstring-d2", "DJ Heartstring", 2),
    mk("esc-dr-fresch-d2", "Dr. Fresch", 2),
    mk("esc-ero808-d2", "ero808", 2),
    mk("esc-funk-assault-d2", "Funk Assault", 2),
    mk("esc-fvlako-d2", "FVLAKO", 2),
    mk("esc-galantis-d2", "Galantis", 2),
    mk("esc-girl-math-d2", "Girl Math", 2),
    mk("esc-ian-asher-d2", "Ian Asher", 2),
    mk("esc-indira-paganotto-d2", "Indira Paganotto", 2),
    mk("esc-ja-rule-d2", "Ja Rule", 2),
    mk("esc-jon-casey-d2", "Jon Casey", 2),
    mk("esc-joyryde-sunset-set-d2", "JOYRYDE (Sunset Set)", 2),
    mk("esc-jsmn-d2", "JSMN", 2),
    mk("esc-juos-d2", "Juos", 2),
    mk("esc-killmatter-d2", "KILLMATTER", 2),
    mk("esc-know-good-d2", "Know Good", 2),
    mk("esc-unscheduled-landopolo", "Landopolo", 2),
    mk("esc-liquid-stranger-d2", "Liquid Stranger", 2),
    mk("esc-lumi-d2", "LUMI", 2),
    mk("esc-maddix-d2", "Maddix", 2),
    mk("esc-malugi-d2", "MALUGI", 2),
    mk("esc-malugi-presents-matteo-and-friends-b2b-d2", "MALUGI presents Matteo & Friends B2B", 2),
    mk("esc-unscheduled-marie-nyx", "Marie Nyx", 2),
    mk("esc-unscheduled-mark-lizaola", "Mark Lizaola", 2),
    mk("esc-unscheduled-nina-j", "Nina J", 2),
    mk("esc-nina-kraviz-d2", "Nina Kraviz", 2),
    mk("esc-omnom-d2", "OMNOM", 2),
    mk("esc-pedroz-d2", "PEDROZ", 2),
    mk("esc-unscheduled-richard-vission", "Richard Vission", 2),
    mk("esc-richie-hawtin-d2", "Richie Hawtin", 2),
    mk("esc-rommii-d2", "Rommii", 2),
    mk("esc-san-pacho-d2", "San Pacho", 2),
    mk("esc-sedef-adas-d2", "Sedef Adasï", 2),
    mk("esc-unscheduled-shaking", "SHAKING", 2),
    mk("esc-sim-ivy-d2", "Sim Ivy", 2),
    mk("esc-unscheduled-spency-be", "Spency Be", 2),
    mk("esc-telykast-d2", "TELYKAST", 2),
    mk("esc-too-hort-d2", "Too $hort", 2),
    mk("esc-unscheduled-tykni", "TYKNI", 2),
    mk("esc-yanamaste-d2", "Yanamaste", 2),
    mk("esc-zedd-d2", "Zedd", 2),
  ];

  const CONFIG = {
    id:        "escape-halloween-2026",
    // Where the lineup rows came from (the SOURCE note above), as data so the
    // public /f/ page can cite it. observedAt = the date it was read.
    lineupSource: { url: "https://escapehalloween.com/lineup/", observedAt: "2026-10-26", official: true },
    scheduleSource: { url: "https://escapehalloween.com/lineup/set-times/day-1/", observedAt: "2026-10-26", official: true },
    name:      "Escape Halloween 2026",
    shortName: "Escape",
    brand:     "Escape",
    tagline:   "Two nights of psycho circus",
    location:  "NOS Events Center · San Bernardino, CA",
    locationShort: "NOS Events Center",
    dates:     "Oct 30–31, 2026",
    year:      2026,
    // Night Print accent: the festival's own first-party colour (ledger: scripts/test-night-print.mjs)
    print: { accent: "#E21C0F", source: { url: "https://escapehalloween.com/wp-content/assets/css/escape-halloween.min.css?ver=2.2.41", observedAt: "2026-10-09", seenAs: "a{color}, .button{background-color}, active nav link (8 uses); hover state darkens to #bd0b00", confidence: "high" }, note: "The per-festival stylesheet of Insomniac's shared 'festival' theme sets every link and primary button to this red; no theme-color meta." },
    officialStages: ["The Big Top", "Feeding Grounds", "The Warehouse", "Sewer District", "The Cage", "Danse Macabre", "Beatbox Art Car"],
    officialEvent: {
      id: 521015, url: "https://escapehalloween.com/",
      website: "https://escapehalloween.com/",
      tickets: "https://escapehalloween.frontgatetickets.com/",
      observedAt: "2026-09-10",
    },
    // Official: "Festival Hours 4PM-2AM". Both nights run 16:00 into 02:00
    // the following morning, so endMs lands on Nov 1.
    startMs: Date.UTC(2026, 9, 30, 23, 0, 0),  // Oct 30 16:00 PDT, gates
    endMs:   Date.UTC(2026, 10, 1,  9, 0, 0),  // Nov 1 02:00 PDT, close of night 2
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    // ⚠ US DST ends 02:00 on Sun Nov 1, 2026 — the exact instant night 2
    // closes. Both festival nights are entirely within PDT (UTC-7), so this
    // offset is correct; endMs above is the unambiguous UTC instant.
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 9, d: 30, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 9, 30, 7, 0, 0) },
      2: { y: 2026, m: 9, d: 31, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 9, 31, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at 34.0866,-117.2917, converted to PDT.
    sunTimes: {
      1: { rise: "07:06", set: "17:59" },
      2: { rise: "07:06", set: "17:58" },
    },
    // Polygon centroid of the OSM venue. The grounds are long and narrow
    // (385 × 1174 m), so the radius covers the far ends from the centre.
    gps: { lat: 34.085405, lng: -117.292632, onSiteRadiusMi: 0.5 },
    venue: {
      name:    "NOS Events Center",
      address: "689 S. E St, San Bernardino, CA 92408",
      terrain: "flat fairground — paved lots, exhibition halls and grass",
      // OpenStreetMap way 563078901, all 41 vertices verbatim. 385 × 1174 m.
      // Found by LEGAL name ("National Orange Show & Event Center"), not by
      // the name the festival uses — see the ⛔ note in the header.
      footprint: [
        [34.0919499, -117.2939607], [34.0889253, -117.2939574], [34.0882510, -117.2938318], [34.0880895,
        -117.2938060], [34.0880485, -117.2938228], [34.0875780, -117.2937319], [34.0872993,
        -117.2936883], [34.0869375, -117.2936495], [34.0860440, -117.2936557], [34.0860471,
        -117.2936286], [34.0858136, -117.2936083], [34.0858109, -117.2936386], [34.0855076,
        -117.2935946], [34.0855014, -117.2923447], [34.0839807, -117.2923422], [34.0837217,
        -117.2925021], [34.0827894, -117.2924415], [34.0826157, -117.2926259], [34.0825001,
        -117.2928187], [34.0824426, -117.2929744], [34.0823809, -117.2931736], [34.0823303,
        -117.2934148], [34.0822738, -117.2937917], [34.0819100, -117.2938239], [34.0815023,
        -117.2938256], [34.0814870, -117.2937922], [34.0814855, -117.2929290], [34.0814885,
        -117.2925513], [34.0815218, -117.2925318], [34.0815363, -117.2910087], [34.0815101,
        -117.2910057], [34.0815159, -117.2907388], [34.0823581, -117.2907465], [34.0823682,
        -117.2898196], [34.0861679, -117.2898114], [34.0906740, -117.2897916], [34.0916264,
        -117.2897863], [34.0916275, -117.2904588], [34.0920349, -117.2904585], [34.0920212,
        -117.2938722], [34.0919499, -117.2939607]
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/34.0854,-117.2926",
    // The Big Top is listed first on the official stages page, is the
    // largest structure on the map art, and closes both nights with the
    // headliners (Cloonee, Zedd) on the official schedule.
    mainStageId: "big-top",
    // ── THE MAP ──
    // LAST YEAR'S map, per the founder ruling. See the header before
    // touching any of this.
    mapImage: "escape-2025-map.webp",
    // The edition the shipped art was drawn for: the 2025 map
    // (esc_2025_de_festival_map_1080x1350_r03.webp, see the header). It is not
    // `year`, so wherever that art is on screen the map label names it
    // ("2025 MAP · …"). Drop it at the flip, with the art.
    mapArtYear: 2025,

    // The festival's OWN map page, linked (never embedded) by the /f/ page:
    // official publication is provenance, not reuse rights. mapYear is the
    // year printed on the map the page showed when checked — the 2026 page still shows the 2025 map.
    mapSource: { url: "https://escapehalloween.com/festival-map/", observedAt: "2026-10-26", mapYear: 2025 },
    mapStyle: "image-overlay",
    mapTheme: "park",
    mapPrintsStageNames: true,
    mapArtIsGeoregistered: false,
    // Published policy: 18+ entry, 21+ alcohol, no ins-and-outs. NOT
    // cashless — the FAQ says ATMs are available inside and outside.
    policies: { minimumAge: 18, alcoholAge: 21, reentry: false, cashless: false },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["escape-halloween-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Set times official (2026-10-26); the map is still last year's.
    registry: { available: true, scheduleTBA: false, accent: "#F4511E", emoji: "🎪", region: "North America" },
  };
})();
