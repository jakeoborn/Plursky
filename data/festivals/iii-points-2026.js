// ═══════════════════════════════════════════════════════════════════════
// III POINTS 2026 — Mana Wynwood · Miami, FL
// Oct 16–17, 2026
// ═══════════════════════════════════════════════════════════════════════
// OPEN ON ITS LINEUP, set times pending. The LINEUP and the DAY SPLIT are
// official; stages and set times are NOT PUBLISHED, and nothing here invents
// them.
//
// SOURCE lineup: iiipoints.com/lineup-2026/ (official), re-read 2026-09-30
//   17:04 UTC (Last-Modified 2026-09-29 19:22:52 UTC). 229 rows of the
//   page's `ul.lineup__list`, 78 of them printing B2B. Earlier reads:
//   2026-08-29 (218), Internet Archive 2026-09-02 (216), 2026-09-25 (215).
//   The page is the lineup of record: an act is in ARTISTS if and only if
//   today's page bills it.
// SOURCE day split: the official lineup-by-day graphic on that same page,
//   https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/72/2026/07/15114208/IIIP26_PHASE-2-LUBD-v2-01-scaled.jpg
//   2560 x 1600, sha256 bb5ddb4d45873e526a0cc846f9bbf234981e8052fe0f22815129d95417e8a8a7,
//   Last-Modified 2026-07-15 18:42:09 UTC. The Internet Archive's copy of
//   2026-09-02 is byte-identical, so it has not changed since at least then.
//   FRIDAY OCTOBER 16 on the left, SATURDAY OCTOBER 17 on the right: the
//   centre, four rings, a "444 · 4-hour extended sets" box and a local-act
//   panel per day. All 217 entries transcribed by hand and the two local
//   panels checked against a macOS Vision OCR; the transcription is
//   docs/qa/reports/iii-points-2026-day-split/graphic.tsv.
//   The graphic carries NO stage and NO set time. "4PM-4AM" under each panel
//   is event hours; the 444 box names extended sets, not a stage.
//
// ── HOW THE TWO SOURCES ARE JOINED (2026-09-30) ──
// The graphic is older than the list and neither is a superset of the
// other, so each answers one question:
//   · WHO plays, and each member's spelling: today's list.
//   · WHICH DAY: the graphic.
//   · B2B ORDER: the graphic. The list prints B2B members alphabetically
//     ("Artime B2B Mystic Bill"); the graphic bills the set ("MYSTIC BILL
//     B2B ARTIME"). 12 acts reordered; ids unchanged, so saved picks survive.
//   · Where a row's display text and its structured name disagree, the
//     graphic breaks the tie: "1-800-305" (row text and graphic; structured
//     name "1-800-Lolita&Xana") and "Santiago Villu" (structured name and
//     graphic; row text "Villu").
// Recorded, each one, and NOT resolved by guessing:
//   · Same act, spelled differently. Day from the graphic, name from the list:
//       graphic "MALÓNE MOREZ B2B MILUHSKA"  list "Malóne B2B Miluhska"
//       graphic "MACCABIII B2B PEZLO MD"     list "Maccabi B2B Pezlo MD"
//       graphic "ITBSP"                      list "1tbsp"
//       graphic "BOYGIRL", "TECH GIRLS", "VIFRO", "¥UKIMAT$U": the display
//       face has no leet digits; the list's B0YG1RL, Tech G1rls, V1FRO and
//       ¥UK1MAT$U are the artists' own styling and are kept.
//   · The graphic bills ONE member where the list bills a B2B including
//     them. The act takes that member's day on the graphic and keeps the
//     list's billing. If III Points moved the B2B to the other day, these
//     three are wrong; they are named here and in the gate:
//       graphic "FIUZA" (Fri)    list "FIUZA B2B Madison Kay"
//       graphic "SEL.6" (Sat)    list "SEL.6 B2B Playshado"
//       graphic "DAY/DEM" (Sat)  list "Bricolage B2B DAY/DEM"
//   · On the graphic, not on today's list: NOT added (GRAPHIC_ONLY below).
//       Underscores (Fri): on no list read, ever.
//       GZA performing Liquid Swords (Fri): billed 2026-09-25, gone today,
//         so it moves to REMOVED_FROM_LINEUP. Today's list bills "Ghostface
//         Killah presents Supreme Clientele", which the graphic does not carry.
//       Mr. Brown (Fri), Jencarlos (Sat): already removed on 2026-09-25.
//   · On today's list, not on the graphic: 16 acts, billed, so in the lineup,
//     with NO day (mkUnscheduled), the way Escape Halloween carries its
//     lineup-card acts: amar · Blind Fish · Canela · Crespi Drum Syndicate
//     (Live) · Cumbiamba · DJ Ahamed · Emily Afre · Ghostface Killah presents
//     Supreme Clientele · GodBlessJai · Huracán · iiry? · Lylac · Nikole ·
//     P1no B2B Trippie Hippie · Scotty Sobek · serafitz B2B SOL Discos
//   · New on the list since 2026-09-25: 15 rows (14 of the 16 above, plus
//     1tbsp, which the graphic puts on Friday). Renamed by the list: "Jump
//     Source (Live)", "Rental Snakes (Live)", "Saint & Romero (Hybrid)".
//
// ── LINEUP DRIFT, recorded 2026-09-25 (kept for the record) ──
// Three reads of the same page: ours 2026-08-29 (218), the Wayback Machine
// capture 2026-09-02 01:51 UTC (216), and today (215).
//   1. REMOVED, gone from today's page. Each is in REMOVED_FROM_LINEUP
//      below, out of the lineup, with a one-line re-add:
//        JENCARLOS · Mr. Brown · Mila Gama B2B X3BUTTERFLY  (on 09-02, gone today)
//        Ultrathem (solo)                                   (already gone 09-02)
//      The 09-02 read is the Internet Archive's capture (timestamp
//      20260902015146); it is cited here only, never linked from a live
//      module. Every record cites the official page as read today.
//      Mila Gama and Ultrathem are still billed in other B2Bs
//      ("Elias Garcia B2B Mila Gama", "Dr. Rubinstein B2B Ultrathem").
//   2. ADDED: "GZA performing Liquid Swords" (on neither earlier read). The
//      row's data-artist-name is "GZA"; the billing is what we show, and
//      artist.jsx's _lookupName drops the "performing …" note for lookups.
//   3. CASING: "SEL.6 B2B PLAYSHADO" now prints "SEL.6 B2B Playshado".
//   4. Dude Skywalker is on 08-29 and today, but not in the 09-02 capture.
//      Kept: today's page bills it.
//   5. DISPLAY ≠ NAME, one row contradicts itself, NOT resolved by guessing:
//      the row that used to print "1-800-Lolita B2B Xana" now prints
//      "1-800-305", while its data-artist-name is still "1-800-Lolita&Xana"
//      and its data-artist-id is the same pair (440360-440357) as 09-02.
//      Kept as "1-800-Lolita B2B Xana": the row's own structured name, which
//      names two artists the "1-800-305" text does not. Re-check at the flip.
//      Two older display/name gaps are benign billing notes, also kept as
//      printed: "Daizy" (name "Daizy (US)") and "res_ (live)" (name "res_").
// SOURCE venue + dates + policies: iiipoints.com/guide/, accessed 2026-08-29
//   — "Mana Wynwood, 2217 NW 5th Ave, Miami, FL 33127", "October 16+17, 2026",
//   no re-entry, 21+ for alcohol, "asphalt and grass terrain".
// SOURCE venue geometry: OpenStreetMap way 435880991 "Mana Wynwood Convention
//   Center", fetched via Overpass 2026-08-29.
// SOURCE sun times: api.sunrise-sunset.org at the OSM centroid, per day,
//   2026-09-30.
//
// ⛔ DO NOT SOURCE ANYTHING FROM THIS SITE'S JSON-LD. The lineup page still
// serves `"name": "III Points Music Festival 2021", "startDate": "2021-10-22",
// "location": "DMANA WYNWOOD"` — five years stale. The human-readable guide
// page is correct; the structured data is not. Same trap for
// iiipoints.com/experience/stages/, which 404s but is still linked from the
// site's own popup config.
//
// ── WHAT IS NOT PUBLISHED (re-checked 2026-09-30, do not fabricate) ──
// STAGES and SET TIMES are absent. The DAY SPLIT is published now, on the
// lineup-by-day graphic (see SOURCE day split); until 2026-09-30 this
// festival carried every act in one "Oct 16–17" bucket because no split had
// been read. The guide FAQ: "Maps showing stage locations, food, bathrooms,
// etc. WILL BE AVAILABLE PRIOR TO THE EVENT" and "DURING THE DAYS LEADING UP
// TO THE FESTIVAL, set times will be posted." So every artist carries
// stage: null and start/end "", and 16 of them also carry day: null.
//
// ── SPATIAL MODEL ──
// There is none, deliberately, and that is the point. Every other festival in
// this repo authors each stage's real lat/lng and DERIVES its 0-100 grid x/y
// from that. Here there are no stages to author, so there is no grid, no
// gpsAnchors, and no map art. Inventing a ground plate to fill the Map tab
// would be exactly the defect PR #36 removed from EDC LV, where poster-space
// coordinates had been laundered into world coordinates and left the main
// stage sitting on a racetrack.
//
// `mapMode: "real"` is the answer instead: real street tiles centred on the
// surveyed venue, the live blue dot, and the venue outline — all of it true,
// none of it drawn by us. Wynwood is a street grid, so a real map is also
// genuinely the better wayfinding tool here; at EDC the poster IS the
// wayfinding artifact, which is why that one stays image-overlay.
//
// ── ANCHOR PROVENANCE (SPEC-add-festivals tiering) ──
// venue.footprint is T1 VERIFIED — surveyed OSM geometry, not eyeballed.
// gpsAnchors: NONE. Not T3, not provisional, ABSENT. A stage anchor cannot be
// tiered before the stage exists.
//
// ⚠ venue.footprint is the CONVENTION CENTER BUILDING (184 × 149 m), not the
// festival perimeter. The site is billed as "5 city blocks", but no surveyed
// perimeter is published, so the building is what can be drawn honestly.
// Widen it at the flip, from the official map — never by estimating.
//
// ── FLIP CHECKLIST (official map + set times, ~early Oct) ──
//   1. STAGES with real lat/lng; derive x/y from them (never the reverse).
//   2. start/end per act (and a day for the 16 unscheduled acts, from the
//      official schedule only); drop the `provisional` flag.
//   3. gpsAnchors re-measured to T1 against the official map.
//   4. Widen venue.footprint to the real perimeter.
//   5. amenities from the official map's legend.
//   6. registry.available → true.
(function () {
  "use strict";

  // No stages published — see the header. This is intentionally empty, and
  // the app must stay correct with it empty.
  //
  // ⚠ This comment used to claim scripts/verify.mjs's mount probe boots this
  // festival active and asserts that. It does not — the probe loads the real
  // index.html with an empty localStorage, so it always boots whatever the
  // resolver picks (acl-2026 today), and it cannot pick a gated festival at
  // all: getActiveFestivalId requires `f.available`. Booting a gated
  // festival needs a local flip; that is how this one and crssd-fall-2026
  // were actually rendered. Do not trust the empty-STAGES path to a gate
  // that is not there.
  const STAGES = [];

  // No amenity map published.
  const AMENITIES = [];

  // Every act is unplaced and untimed; all but 16 have their official day.
  // `tier` drives lineup card weighting
  // elsewhere; with no set times there is no basis to rank, so all acts sit
  // at the same tier rather than being silently ordered by a guess.
  // `provisional: true` marks the whole set for the flip session.
  // The flip fills this block from the OFFICIAL schedule, after STAGES and
  // real Fri/Sat dayDates come from the same source:
  //   node scripts/fetch-insomniac-settimes.mjs https://www.iiipoints.com/lineup/set-times --days 2 --out sheet.tsv
  //   node scripts/import-set-times.mjs iii-points-2026 sheet.tsv --days-from-sheet --source <official-url>
  // id → [stageId, start, end, day]. Empty until then: every act unplaced.
  const SCHEDULE = {
    // SCHEDULE:BEGIN iii-points-2026
    // SCHEDULE:END
  };
  const scheduled = act => {
    const s = SCHEDULE[act.id];
    if (!s) return act;
    const { provisional, ...rest } = act;
    return { ...rest, stage: s[0], start: s[1], end: s[2], day: s[3] ?? act.day, bio: "Playing III Points 2026." };
  };

  const mk = (id, name, day) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #22d3ee, #1a0a28)",
    bio: `Playing III Points 2026 on ${day === 1 ? "Friday, October 16" : "Saturday, October 17"}. ` +
         "Stage and set time are not published yet — the official schedule drops in the days before the festival.",
    provisional: true,
  });

  // Billed on today's official list, absent from the lineup-by-day graphic
  // (see the header). No day, stage or time is inferred for them.
  const mkUnscheduled = (id, name) => scheduled({
    id, name, genre: "—", country: "—", stage: null, day: null,
    start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #22d3ee, #1a0a28)",
    bio: "On the official III Points 2026 lineup. Its day, stage and set time are not published: " +
         "the official lineup-by-day graphic does not list it.",
    provisional: true, unscheduled: true,
  });

  // Day from the official lineup-by-day graphic; billing from today's list,
  // in the graphic's B2B order. Ids never change with billing.
  const ARTISTS = [
    // ─────────── Friday, October 16 (105 acts) ───────────
    mk("iiip-1tbsp",                         "1tbsp", 1),
    mk("iiip-aabel-b2b-siegel",              "Aabel B2B Siegel", 1),
    mk("iiip-ackdaddy",                      "Ackdaddy", 1),
    mk("iiip-adam-at-the-door",              "Adam At The Door", 1),
    mk("iiip-ahmed-spins-b2b-omri",          "Ahmed Spins B2B OMRI.", 1),
    mk("iiip-alejo",                         "ALEJO", 1),
    mk("iiip-alexx-in-chainss-b2b-solte",    "Alexx in Chainss B2B Soltek", 1),
    mk("iiip-aphex-twink-b2b-foreseer",      "Aphex Twink B2B FORESEER", 1),
    mk("iiip-b0yg1rl",                       "B0YG1RL", 1),
    mk("iiip-baby-jesus-b2b-chaos",          "Baby Jesus B2B CHAOS!", 1),
    mk("iiip-bakke",                         "Bakke", 1),
    mk("iiip-beltran-b2b-ben-sterling",      "Beltran B2B Ben Sterling", 1),
    mk("iiip-bill-patrick-b2b-bort",         "Bill Patrick B2B Bort", 1),
    mk("iiip-bone-thugs-n-harmony",          "Bone Thugs-N-Harmony", 1),
    mk("iiip-brunello-b2b-rafael",           "Brunello B2B Rafael", 1),
    mk("iiip-cami-di-marzo",                 "Cami di Marzo", 1),
    mk("iiip-cloonee",                       "Cloonee", 1),
    mk("iiip-connan-mockasin",               "Connan Mockasin", 1),
    mk("iiip-corridos-ketamina",             "Corridos Ketamina", 1),
    mk("iiip-daizy",                         "Daizy", 1),
    mk("iiip-dan-molinari",                  "Dan Molinari", 1),
    mk("iiip-danny-brown",                   "Danny Brown", 1),
    mk("iiip-danny-daze-b2b-dj-godfathe",    "Danny Daze B2B DJ Godfather", 1),
    mk("iiip-deep-cleansing",                "Deep Cleansing", 1),
    mk("iiip-differ",                        "Differ", 1),
    mk("iiip-discip",                        "Discip", 1),
    mk("iiip-disco-lines",                   "Disco Lines", 1),
    mk("iiip-dj-harvey",                     "DJ Harvey", 1),
    mk("iiip-dj-sabi-b2b-grue5ome",          "DJ Sabi B2B GRUE5OME", 1),
    mk("iiip-dr-rubinstein-b2b-ultrathe",    "Dr. Rubinstein B2B Ultrathem", 1),
    mk("iiip-duun-b2b-sleepy-c",             "duun B2B Sleepy C", 1),
    mk("iiip-eco-sistema",                   "eco-sistema", 1),
    mk("iiip-eli-escobar-b2b-jubilee",       "Eli Escobar B2B Jubilee", 1),
    mk("iiip-elias-garcia-b2b-mila-gama",    "Elias Garcia B2B Mila Gama", 1),
    mk("iiip-eveava-b2b-jovigibs",           "eveava B2B Jovigibs", 1),
    mk("iiip-extra-andrew-b2b-mutant-pe",    "Extra Andrew B2B Mutant Pete", 1),
    mk("iiip-feph-b2b-mr-tron",              "Feph B2B Mr. Tron", 1),
    mk("iiip-fiin",                          "Fiin", 1),
    mk("iiip-fiuza-b2b-madison-kay",         "FIUZA B2B Madison Kay", 1),
    mk("iiip-floating-points",               "Floating Points", 1),
    mk("iiip-flying-lotus",                  "Flying Lotus", 1),
    mk("iiip-gio-elia-b2b-meghan-lee",       "Gio Elia B2B Meghan Lee", 1),
    mk("iiip-godisound",                     "Godisound", 1),
    mk("iiip-grace-arribas-b2b-marte",       "Grace Arribas B2B MARTE", 1),
    mk("iiip-hamdi",                         "Hamdi", 1),
    mk("iiip-heidi-lawden",                  "Heidi Lawden", 1),
    mk("iiip-honey-dijon",                   "Honey Dijon", 1),
    mk("iiip-rimaye-b2b-inbal",              "Inbal B2B Rimaye", 1),
    mk("iiip-invt",                          "INVT", 1),
    mk("iiip-ivy-lab",                       "Ivy Lab", 1),
    mk("iiip-jacques-greene",                "Jacques Greene", 1),
    mk("iiip-jane-remover",                  "Jane Remover", 1),
    mk("iiip-jeremy-ismael",                 "Jeremy Ismael", 1),
    mk("iiip-jigitz",                        "Jigitz", 1),
    mk("iiip-joanna-kuchta-b2b-robyn-si",    "Joanna Kuchta B2B Robyn Sin Love", 1),
    mk("iiip-lotusoph-b2b-julia-saturno",    "Julia Saturno B2B Lotusoph", 1),
    mk("iiip-jump-source",                   "Jump Source (Live)", 1),
    mk("iiip-katie-ox-b2b-nat-siriani",      "Katie Ox B2B Nat Siriani", 1),
    mk("iiip-kumi",                          "Kumi", 1),
    mk("iiip-lagrimas-de-oro",               "Lagrimas de Oro", 1),
    mk("iiip-lauren-palma",                  "Lauren Palma", 1),
    mk("iiip-levity-b2b-taiki-nulight",      "Levity B2B Taiki Nulight", 1),
    mk("iiip-lil-kim",                       "Lil' Kim", 1),
    mk("iiip-lousy-lover-b2b-lucaz",         "Lousy Lover B2B Lucaz", 1),
    mk("iiip-maccabi-b2b-pezlo-md",          "Maccabi B2B Pezlo MD", 1),
    mk("iiip-maher-daniel-b2b-mai-iache",    "Maher Daniel B2B Mai Iachetti", 1),
    mk("iiip-malone-b2b-miluhska",           "Malóne B2B Miluhska", 1),
    mk("iiip-mary-droppinz",                 "Mary Droppinz", 1),
    mk("iiip-mason-norris-b2b-mia-vende",    "Mason Norris B2B Mia Vendetta", 1),
    mk("iiip-megusta-b2b-migs",              "Megusta B2B MIGS", 1),
    mk("iiip-men-i-trust",                   "Men I Trust", 1),
    mk("iiip-mgna-crrrta",                   "MGNA Crrrta", 1),
    mk("iiip-miguel-clark-b2b-naim-zarz",    "Miguel Clark B2B Naim Zarzour", 1),
    mk("iiip-miguelle-tons-b2b-saraga",      "Miguelle & Tons B2B Saraga", 1),
    mk("iiip-mind-enterprises",              "Mind Enterprises", 1),
    mk("iiip-moscoman",                      "Moscoman", 1),
    mk("iiip-nate-sib",                      "nate sib", 1),
    mk("iiip-nicholas-g-padilla",            "Nicholas G. Padilla", 1),
    mk("iiip-nicole-gallamini-b2b-nikit",    "Nicole Gallamini B2B Nikita Green", 1),
    mk("iiip-odd-mob",                       "Odd Mob", 1),
    mk("iiip-oma-totem-b2b-true-vine",       "oma totem B2B True Vine", 1),
    mk("iiip-parcels",                       "Parcels", 1),
    mk("iiip-patch",                         "Patch+", 1),
    mk("iiip-pawsa",                         "PAWSA", 1),
    mk("iiip-proletar-b2b-zamurai",          "Proletar B2B Zamurai", 1),
    mk("iiip-puma",                          "Puma", 1),
    mk("iiip-purity-ring",                   "Purity Ring", 1),
    mk("iiip-r-v-calypso",                   "R/V Calypso", 1),
    mk("iiip-ragie-ban",                     "Ragie Ban", 1),
    mk("iiip-rello",                         "Rello", 1),
    mk("iiip-rental-snakes",                 "Rental Snakes (Live)", 1),
    mk("iiip-roddy-lima",                    "Roddy Lima", 1),
    mk("iiip-peach-b2b-shanti-celeste",      "Shanti Celeste B2B Peach", 1),
    mk("iiip-raje-b2b-slugg",                "Slugg B2B RAJE", 1),
    mk("iiip-sportswax",                     "Sportswax", 1),
    mk("iiip-will-buck-b2b-taimur",          "Taimur B2B Will Buck", 1),
    mk("iiip-tech-g1rls",                    "Tech G1rls", 1),
    mk("iiip-tiffy-vera-b2b-thunderpony",    "Thunderpony B2B Tiffy Vera", 1),
    mk("iiip-tokischa",                      "Tokischa", 1),
    mk("iiip-uchi",                          "Uchi", 1),
    mk("iiip-v1fro",                         "V1FRO", 1),
    mk("iiip-vania-junco",                   "Vania Junco", 1),
    mk("iiip-max-styler-b2b-vintage-cul",    "Vintage Culture B2B Max Styler", 1),
    mk("iiip-will-renuart",                  "Will Renuart", 1),
    mk("iiip-zep",                           "ZEP", 1),
    // ─────────── Saturday, October 17 (108 acts) ───────────
    mk("iiip-1-800-lolita-b2b-xana",         "1-800-305", 2),
    mk("iiip-2up",                           "2UP!", 2),
    mk("iiip-619",                           "619!", 2),
    mk("iiip-999999999",                     "999999999", 2),
    mk("iiip-adam-port",                     "Adam Port", 2),
    mk("iiip-ale-acosta-b2b-hazon",          "Ale Acosta B2B Hazón", 2),
    mk("iiip-alezsandro-b2b-dalva",          "Alezsandro B2B Dalva", 2),
    mk("iiip-allnightkev-b2b-lo-g",          "Allnightkev B2B Lo-G", 2),
    mk("iiip-ashley-venom-b2b-souls-dep",    "Ashley Venom B2B Souls Departed", 2),
    mk("iiip-bassvictim",                    "Bassvictim", 2),
    mk("iiip-pressure-point-b2b-berrakk",    "Berrakka B2B Pressure Point", 2),
    mk("iiip-blood-orange",                  "Blood Orange", 2),
    mk("iiip-bonita-applebumz-b2b-toni-",    "Bonita Applebumz B2B Toni Shardai", 2),
    mk("iiip-bozito-b2b-gabo-escalona",      "Bozito B2B Gabo Escalona", 2),
    mk("iiip-bricolage-b2b-day-dem",         "Bricolage B2B DAY/DEM", 2),
    mk("iiip-camp-blu",                      "Camp Blu", 2),
    mk("iiip-carter-jackson-brown",          "Carter Jackson-Brown", 2),
    mk("iiip-chanel-beads",                  "Chanel Beads", 2),
    mk("iiip-charlotte-de-witte",            "Charlotte de Witte", 2),
    mk("iiip-chasewest",                     "ChaseWest", 2),
    mk("iiip-coffintexts-b2b-dj-fuckoff",    "Coffintexts B2B DJ Fuckoff", 2),
    mk("iiip-cole-knight-b2b-dreya-v",       "Cole Knight B2B DREYA V", 2),
    mk("iiip-daphni",                        "Daphni", 2),
    mk("iiip-david-vunk",                    "David Vunk", 2),
    mk("iiip-dean-turnley",                  "Dean Turnley", 2),
    mk("iiip-d-luxe-b2b-dennis-baker",       "Dennis Baker B2B D.Luxe", 2),
    mk("iiip-dj-ray-b2b-ez-dee",             "DJ Ray B2B EZ Dee", 2),
    mk("iiip-dj-three-b2b-sister-system",    "DJ Three B2B Sister System", 2),
    mk("iiip-domnrob",                       "DomnRob", 2),
    mk("iiip-doris-dana",                    "doris dana", 2),
    mk("iiip-duality-b2b-gumthewrapper",     "Duality B2B GumtheWrapper", 2),
    mk("iiip-dude-skywalker",                "Dude Skywalker", 2),
    mk("iiip-ear",                           "ear", 2),
    mk("iiip-ellynora",                      "Ellynora", 2),
    mk("iiip-faith-leazae",                  "Faith Leazae", 2),
    mk("iiip-fakemink",                      "fakemink", 2),
    mk("iiip-fine",                          "Fine", 2),
    mk("iiip-four-tet",                      "Four Tet", 2),
    mk("iiip-generous-b-b2b-hakuna",         "Generous B B2B Hakuna", 2),
    mk("iiip-haai",                          "HAAi", 2),
    mk("iiip-horsegiirl",                    "horsegiirL", 2),
    mk("iiip-idriss-d-b2b-danyelino",        "Idriss D B2B Danyelino", 2),
    mk("iiip-interplanetary-criminal",       "Interplanetary Criminal", 2),
    mk("iiip-jason-rault",                   "Jason Rault", 2),
    mk("iiip-jbz",                           "JBZ", 2),
    mk("iiip-jinn-pr",                       "JINN_PR", 2),
    mk("iiip-joss-dean",                     "Joss Dean", 2),
    mk("iiip-kelela",                        "Kelela", 2),
    mk("iiip-kettama",                       "KETTAMA", 2),
    mk("iiip-khami",                         "Khami", 2),
    mk("iiip-ki-ki",                         "KI/KI", 2),
    mk("iiip-kinahau",                       "KinAhau", 2),
    mk("iiip-kujo-b2b-rara",                 "Kujo B2B RARA", 2),
    mk("iiip-la-bb",                         "La BB", 2),
    mk("iiip-lady-narcisse-b2b-racci",       "Lady Narcisse B2B Racci", 2),
    mk("iiip-ladyboy",                       "LADYBOY", 2),
    mk("iiip-liquid-dinosaurs",              "Liquid Dinosaurs", 2),
    mk("iiip-lizzie-mcguire",                "Lizzie_mcguire", 2),
    mk("iiip-loukeman",                      "Loukeman", 2),
    mk("iiip-lupreme-b2b-santo",             "Lupreme B2B SANTO", 2),
    mk("iiip-machine-girl",                  "Machine Girl", 2),
    mk("iiip-mango-b2b-mister-lo",           "Mango B2B Mister Lo", 2),
    mk("iiip-marco-carola-b2b-franky-ri",    "Marco Carola B2B Franky Rizardo", 2),
    mk("iiip-marie-qrie-b2b-viva-vidal",     "Marie Qrie B2B Viva Vidal", 2),
    mk("iiip-marsolo",                       "Marsolo", 2),
    mk("iiip-max-dean-b2b-luke-dean",        "Max Dean B2B Luke Dean", 2),
    mk("iiip-milo-ziro-b2b-xilla",           "Milo Ziro B2B Xilla", 2),
    mk("iiip-ml-buch",                       "ML Buch", 2),
    mk("iiip-monoky",                        "Monoky", 2),
    mk("iiip-mph",                           "MPH", 2),
    mk("iiip-mr-bitch",                      "Mr. Bitch", 2),
    mk("iiip-artime-b2b-mystic-bill",        "Mystic Bill B2B Artime", 2),
    mk("iiip-natalia-roth-b2b-max-stern",    "Natalia Roth B2B Max Stern", 2),
    mk("iiip-nick-leon-b2b-safety-tranc",    "Nick León B2B Safety Trance", 2),
    mk("iiip-nii-tei",                       "Nii Tei", 2),
    mk("iiip-omar",                          "Omar+", 2),
    mk("iiip-phiphi-b2b-winter-wrong",       "phiphi B2B Winter Wrong", 2),
    mk("iiip-rebolledo",                     "Rebolledo", 2),
    mk("iiip-red-axes",                      "Red Axes", 2),
    mk("iiip-res-live",                      "res_ (live)", 2),
    mk("iiip-roman-flugel",                  "Roman Flügel", 2),
    mk("iiip-jinks-b2b-romulo-del-casti",    "Romulo Del Castillo B2B Jinks", 2),
    mk("iiip-rude-boy-b2b-sdrv",             "Rude Boy B2B SDRV", 2),
    mk("iiip-rusowsky",                      "rusowsky", 2),
    mk("iiip-saint-romero",                  "Saint & Romero (Hybrid)", 2),
    mk("iiip-sam-alfred",                    "Sam Alfred", 2),
    mk("iiip-santiago-villu",                "Santiago Villu", 2),
    mk("iiip-saturnsarii-b2b-suz",           "SATURNSARii B2B SUZ", 2),
    mk("iiip-sel-6-b2b-playshado",           "SEL.6 B2B Playshado", 2),
    mk("iiip-seth-troxler",                  "Seth Troxler", 2),
    mk("iiip-shinobi",                       "Shinobi", 2),
    mk("iiip-grant-sabadash-b2b-shir-mi",    "Shir Miya B2B Grant Sabadash", 2),
    mk("iiip-silvie-loto-b2b-ms-mada",       "Silvie Loto B2B Ms. Mada", 2),
    mk("iiip-sosa",                          "Sosa", 2),
    mk("iiip-spice-crime-b2b-violeta",       "Spice Crime B2B Violeta", 2),
    mk("iiip-sunn-o",                        "Sunn O)))", 2),
    mk("iiip-terence-tabeau",                "Terence Tabeau", 2),
    mk("iiip-tiga",                          "Tiga", 2),
    mk("iiip-tricky",                        "Tricky", 2),
    mk("iiip-underworld",                    "Underworld", 2),
    mk("iiip-velora",                        "Velora", 2),
    mk("iiip-vsyana",                        "vsyana", 2),
    mk("iiip-vtss",                          "VTSS", 2),
    mk("iiip-vvilhelm",                      "VVilhelm", 2),
    mk("iiip-whitesquare",                   "Whitesquare", 2),
    mk("iiip-willikens-ivkovic",             "Willikens & Ivkovic", 2),
    mk("iiip-yhwh-nailgun",                  "YHWH Nailgun", 2),
    mk("iiip-u-uk-uk1mat-u",                 "¥ØU$UK€ ¥UK1MAT$U", 2),
    // ─────────── On the lineup, not on the day graphic (16 acts) ───────────
    mkUnscheduled("iiip-amar",               "amar"),
    mkUnscheduled("iiip-blind-fish",         "Blind Fish"),
    mkUnscheduled("iiip-canela",             "Canela"),
    mkUnscheduled("iiip-crespi-drum-syndicate-live", "Crespi Drum Syndicate (Live)"),
    mkUnscheduled("iiip-cumbiamba",          "Cumbiamba"),
    mkUnscheduled("iiip-dj-ahamed",          "DJ Ahamed"),
    mkUnscheduled("iiip-emily-afre",         "Emily Afre"),
    mkUnscheduled("iiip-ghostface-killah-presents", "Ghostface Killah presents Supreme Clientele"),
    mkUnscheduled("iiip-godblessjai",        "GodBlessJai"),
    mkUnscheduled("iiip-huracan",            "Huracán"),
    mkUnscheduled("iiip-iiry",               "iiry?"),
    mkUnscheduled("iiip-lylac",              "Lylac"),
    mkUnscheduled("iiip-nikole",             "Nikole"),
    mkUnscheduled("iiip-p1no-b2b-trippie-hippie", "P1no B2B Trippie Hippie"),
    mkUnscheduled("iiip-scotty-sobek",       "Scotty Sobek"),
    mkUnscheduled("iiip-serafitz-b2b-sol-discos", "serafitz B2B SOL Discos"),
  ];

  // Acts the official lineup page billed and then dropped (LINEUP DRIFT 1 in
  // the header). Kept OUT of ARTISTS, so no screen, count or search sees
  // them; kept HERE so a re-bill is a one-line re-add with the same id,
  // which brings any saved pick back with it.
  const LINEUP = "https://www.iiipoints.com/lineup-2026/";
  const REMOVED_FROM_LINEUP = [
    { id: "iiip-jencarlos", name: "JENCARLOS", lastSeen: "2026-09-02", removedFrom: { url: LINEUP, observedAt: "2026-09-25" } },
    { id: "iiip-mr-brown", name: "Mr. Brown", lastSeen: "2026-09-02", removedFrom: { url: LINEUP, observedAt: "2026-09-25" } },
    { id: "iiip-mila-gama-b2b-x3butterfly", name: "Mila Gama B2B X3BUTTERFLY", lastSeen: "2026-09-02", removedFrom: { url: LINEUP, observedAt: "2026-09-25" } },
    { id: "iiip-ultrathem", name: "Ultrathem", lastSeen: "2026-08-29", removedFrom: { url: LINEUP, observedAt: "2026-09-25" } },
    { id: "iiip-gza", name: "GZA performing Liquid Swords", lastSeen: "2026-09-25", removedFrom: { url: LINEUP, observedAt: "2026-09-30" } },
  ].map(r => ({ ...r, reAdd: `mk("${r.id}", "${r.name}", <day>)` }));

  // On the official lineup-by-day graphic, NOT on today's official list, so
  // NOT in the lineup. The day is recorded so a re-bill is one line.
  const DAY_GRAPHIC = "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/72/2026/07/15114208/IIIP26_PHASE-2-LUBD-v2-01-scaled.jpg";
  const GRAPHIC_ONLY = [
    { billing: "Underscores", day: 1, note: "on no list read (08-29, 09-02, 09-25, 09-30)" },
    { billing: "GZA performing Liquid Swords", day: 1, note: "billed 09-25, removed by 09-30; see REMOVED_FROM_LINEUP" },
    { billing: "Mr. Brown", day: 1, note: "removed from the list by 09-25" },
    { billing: "Jencarlos", day: 2, note: "removed from the list by 09-25" },
  ].map(r => ({ ...r, graphic: { url: DAY_GRAPHIC, observedAt: "2026-09-30" } }));

  const CONFIG = {
    id:        "iii-points-2026",
    // Where the lineup rows came from (the SOURCE note above), as data so the
    // public /f/ page can cite it. observedAt = the date it was read.
    lineupSource: { url: "https://www.iiipoints.com/lineup-2026/", observedAt: "2026-09-30", official: true },
    name:      "III Points 2026",
    shortName: "III Points",
    brand:     "III Points",
    tagline:   "Two days of music, art and technology in Wynwood",
    location:  "Mana Wynwood · Miami, FL",
    locationShort: "Mana Wynwood",
    dates:     "Oct 16–17, 2026",
    year:      2026,
    // Miami is EDT (UTC-4) in October — DST does not end until Nov 1.
    // Gate/close times are NOT published; these bound the two program days
    // generously so night-crossing timestamps resolve to the right day, and
    // they get replaced by the real hours at the flip.
    startMs: Date.UTC(2026, 9, 16, 20, 0, 0),  // Oct 16 16:00 EDT
    endMs:   Date.UTC(2026, 9, 18, 8, 0, 0),   // Oct 18 04:00 EDT
    tz:      "America/New_York",
    tzAbbr:  "EDT",
    utcOffsetHours: -4,
    // Two real days, from the official lineup-by-day graphic (see header).
    // Until 2026-09-30 this was ONE "Oct 16–17" bucket labelled TBA,
    // because no split had been read and a null day hides an act from every
    // day tab. 16 billed acts still have no day; they are `unscheduled`.
    dayDates: {
      1: { y: 2026, m: 9, d: 16, name: "Friday",   short: "FRI", midnightUtc: Date.UTC(2026, 9, 16, 4, 0, 0) },
      2: { y: 2026, m: 9, d: 17, name: "Saturday", short: "SAT", midnightUtc: Date.UTC(2026, 9, 17, 4, 0, 0) },
    },
    // api.sunrise-sunset.org at 25.79852,-80.20225, per day, converted to EDT.
    sunTimes: {
      1: { rise: "07:19", set: "18:53" },
      2: { rise: "07:19", set: "18:52" },
    },
    // Surveyed OSM centroid of the convention center, NOT a Nominatim
    // address geocode — the two differ by 80 m here, and the geocode is the
    // street address rather than the building.
    gps: { lat: 25.79852, lng: -80.20225, onSiteRadiusMi: 0.35 },
    venue: {
      name: "Mana Wynwood",
      address: "2217 NW 5th Ave, Miami, FL 33127",
      terrain: "asphalt and grass",
      // T1 VERIFIED — OpenStreetMap way 435880991, all 23 surveyed vertices,
      // VERBATIM. A Douglas-Peucker pass to 17 points was measured first
      // (0.13% area delta, no self-intersection) and then thrown away: at 23
      // points the approximation buys nothing, and shipping the survey
      // unmodified means there is no decimation epsilon for a future reader
      // to wonder about. 13,255 m². The notch on the north-west side is real
      // building geometry, not an artifact.
      //
      // This is the BUILDING, not the festival perimeter — the site is billed
      // as 5 city blocks. See the header before widening it.
      footprint: [
        [25.79907, -80.20245], [25.79882, -80.20245], [25.79870, -80.20244],
        [25.79870, -80.20241], [25.79848, -80.20240], [25.79835, -80.20253],
        [25.79813, -80.20227], [25.79827, -80.20212], [25.79827, -80.20199],
        [25.79833, -80.20197], [25.79835, -80.20113], [25.79843, -80.20113],
        [25.79843, -80.20105], [25.79779, -80.20103], [25.79774, -80.20277],
        [25.79780, -80.20283], [25.79863, -80.20286], [25.79869, -80.20280],
        [25.79870, -80.20249], [25.79881, -80.20250], [25.79892, -80.20250],
        [25.79892, -80.20273], [25.79907, -80.20273],
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/25.7985,-80.2022",
    mainStageId: null,
    // ── THE MAP ──
    // No mapImage, no mapStyle: "image-overlay", no gpsAnchors. This festival
    // opens straight into the real basemap. See the header for why that is
    // the honest choice rather than a fallback.
    mapMode: "real",
    mapPrintsStageNames: false,
    // The affine-vs-poster gate has no poster to check against here. Not a
    // waiver — there is genuinely nothing to register.
    mapArtIsGeoregistered: false,
    // Published policy, drives FAQ copy only.
    policies: { reentry: false, alcoholAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["iii-points-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    removedFromLineup: REMOVED_FROM_LINEUP,
    graphicOnly: GRAPHIC_ONLY,
    // GATED: set times, stages and the official map are all unpublished.
    registry: { available: true, scheduleTBA: true, accent: "#22d3ee", emoji: "🔺", region: "North America" },
  };
})();
