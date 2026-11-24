// ═══════════════════════════════════════════════════════════════════════
// DREAMSTATE SOCAL 2026 — Queen Mary Waterfront · Long Beach, CA
// Nov 20–21, 2026
// ═══════════════════════════════════════════════════════════════════════
// SET TIMES ARE OFFICIAL (flipped 2026-11-20). Every act carries its real
// night, stage, start and end. The official 2026 FESTIVAL MAP (2026-11-04)
// supplies the stage names, the map plate and the amenities below.
//
// SOURCE set times: socal.dreamstateusa.com/lineup/set-times/day-1/ (Friday
//   Nov 20) and /day-2/ (Saturday Nov 21), read 2026-11-20 with
//   scripts/fetch-insomniac-settimes.mjs. 70 sets on 4 stages (The Dream, The
//   Void, The Sequence, The Vision): Friday 36, Saturday 34. Every stage runs
//   16:00 to 01:00 both nights, the printed "4 PM – 1 AM". No zone is printed;
//   the venue is Pacific and there is no DST change that weekend (PST, UTC-8).
//   The Beatbox Art Car carries no sets on these pages.
//   ✓ CROSS-CHECKED: the lineup page now prints By Day (Friday 36, Saturday 34)
//   and By Stage (Dream 17, Void 17, Sequence 18, Vision 18) lists. Both are
//   disjoint, both union to the 70-row alphabetical list, and that list
//   matches the 70 set-times rows name for name.
// LINEUP REFRESHED 2026-11-20 to the official page. Four billings changed
//   since the 2026-09-09 read, and the official lists no longer print the old
//   ones: "BT + Matt Fax" is now "BT"; "David Forbes + Mark Sherry pres Thick
//   As Thieves" and "John Askew + Simon Patterson" are gone, and "David Forbes
//   + John Askew" is new; "Discovery Project" is gone; "Hausman" and "Roman
//   Messer" are new. New billings get new ids; the dropped ids go with them.
//   Four rows are printed shorter on both official pages than the names this
//   module ships: "KAUFMANN" (ships "KAUFMANN (DE)", the festival's own earlier
//   disambiguator, which the artist registry keeps whole), "Key4050", "Mirage
//   (Live)" and "Parallel Worlds" (ship the full press billings, see LINEUP
//   below). Same acts, same ids; the schedule rows are keyed by id, so a
//   re-import must map those four sheet names to these ids first.
//
// SOURCE festival map (2026-11-07): socal.dreamstateusa.com/festival-map/ →
//   dssc_2026_de_festival_map_1080x1350_r03-1.png (uploads 2026/11/04,
//   1080x1350, sha256 a7a11e57a5e8bfbc…). Plate = dreamstate-socal-2026-map.webp:
//   crop x 10..1060, y 280..1005 of that file (title block and legend
//   removed), centre-padded to 1050x1050 with #0B1030. A pixel (px,py) on
//   the official file is x% = (px-10)/10.5, y% = (py-117.5)/10.5 on the plate.
//
// ── SOURCES ──
//
// LINEUP, source of record: socal.dreamstateusa.com/lineup/ (official),
//   re-parsed 2026-09-09. 70 acts, taken from the 70 <li> rows of the page's
//   single `ul.lineup__list`. 14 of the 70 are CO-BILLED, preserved VERBATIM
//   as one act each, because that is how the set is sold and how the schedule
//   will print it — the same rule III Points and Nocturnal apply to B2B.
//
//   ⛔ DO NOT READ THIS PAGE THROUGH A PROSE SUMMARISER. Asked for "every
//   artist name", one returns 81 — it splits the co-billed rows on the "+".
//   Every one of those halves is a real artist, so nothing looks wrong; the
//   list is simply billings that do not exist. Caught only by parsing the
//   list element and finding 70 rows where the summary claimed 81. Parse the
//   markup, count the rows, and let the count be the check.
//
//   ⛔ The page also embeds a music player whose track credits carry
//   `class="song__artist"` — Freedom Fighters, Bryan Kearney, Liquid Soul,
//   Static Movement and nine more. They are NOT on this lineup. Scraping
//   anything class-matched on "artist" picks them up. Only `ul.lineup__list`
//   is the lineup.
//
// LINEUP, corroborating source: press.insomniac.com "Dreamstate SoCal Reveals
//   Full Lineup For 2026 Edition, November 20-21" (Jul 9, 2026), read
//   2026-09-09. Same 70 acts. It resolves three rows the lineup page prints
//   as bare project names, and those three are the reason this module's row
//   text is a RECONCILIATION of the two official sources rather than a copy
//   of either:
//     site "Key4050"         → press "BRYAN KEARNEY + JOHN O'CALLAGHAN PRES KEY 4050"
//     site "Mirage (Live)"   → press "FERRY TAYLE + TONKS PRES MIRAGE (LIVE)"
//     site "Parallel Worlds" → press "PAUL DENTON + WILL REES PRES PARALLEL WORLDS"
//   The site's own list is inconsistent about this: it prints the full billing
//   for "Andrew Rayel pres Extasia", "David Forbes + Mark Sherry pres Thick As
//   Thieves" and "Paul van Dyk pres Essence Of Acid", and the bare project for
//   the three above. Shipping the bare project loses the billed artists — a
//   Bryan Kearney fan scanning the lineup would not find him — so the full
//   billing wins and the array is ordered exactly as the press A-Z prints it.
//
//   ⛔ THE PRESS RELEASE IS NOT SAFE TO COUNT EITHER, in two distinct ways.
//   (1) It lists Key4050 TWICE — once at B as the full billing and again at K
//   as "KEY4050" — so a naive read gives 71 acts, one of them a duplicate of
//   another under a different name. (2) Three billings are WRAPPED over two
//   <br> lines ("DAVID FORBES + MARK SHERRY" / "PRES THICK AS THIEVES", and
//   the same for Parallel Worlds and Paul van Dyk), so splitting on newlines
//   gives 74. 74 → 71 → 70 only after joining the PRES continuations and
//   dropping the duplicate. The lineup page's 70 <li> rows are the count of
//   record; the press release is the naming authority for the three, and
//   nothing else.
//
//   Two further disagreements, both resolved in the site's favour because the
//   press release is set in ALL CAPS and cannot be a casing source: press
//   writes "ALPHA 9 + ILANBLUESTONE" (no space) where the site has "ALPHA 9 +
//   Ilan Bluestone", and press writes "PRES THE ESSENCE OF ACID" where the
//   site has "pres Essence Of Acid". Neither changes who is playing.
//
//   ⚠ ONE unresolved spelling: press writes "KEY 4050", the lineup page
//   writes "Key4050". The act styles itself Key4050, so the site spelling
//   ships. One space, flagged rather than silently picked.
//
// STAGES: from the official 2026 festival map (SOURCE above). Its four
//   names match the 2025 asset-filename leads on /experience/stages/
//   (dssc_the_dream/sequence/vision/void_stage, read 2026-09-09), plus the
//   Beatbox Art Car. See the block on STAGES below.
// SOURCE dates: socal.dreamstateusa.com — "November 20+21, 2026"; the press
//   release names them "Friday, November 20 and Saturday, November 21, 2026".
// SOURCE venue + hours + age policy: socal.dreamstateusa.com/hours-and-info/,
//   accessed 2026-09-09 — "Queen Mary Waterfront, 1126 Queens Hwy, Long
//   Beach, CA 90802", main event "4 PM – 1 AM" both days with an afterparty
//   "12 AM – 6 AM", "You must be 18+ to enter and 21+ for alcohol."
// SOURCE set-time release: socal.dreamstateusa.com/faq/ — "During the days
//   leading up to the festival, set times will be posted via this site, our
//   social media sites, and email updates."
// SOURCE venue geometry: OpenStreetMap way 438331516 "The Queen Mary"
//   (historic=ship, tourism=hotel), centroid 33.752789,-118.189632, fetched
//   from the OSM map API 2026-09-09.
// SOURCE sun times: api.sunrise-sunset.org at that centroid, 2026-09-09.
//
// ── WHAT IS STILL NOT PUBLISHED (verified 2026-11-20, do not fabricate) ──
//
// MAIN STAGE. Neither the map nor the set-times pages say which stage is the
//   main stage, so mainStageId stays null and the four stages share one size.
//
// ── SPATIAL MODEL ──
// The official map is ART, drawn oblique (an isometric 3-D view with the
// Queen Mary floating in space), not a survey. It ships as an image-overlay
// plate, the Escape posture: stage x/y are percent positions ON THE ART,
// measured off each stage STRUCTURE (never its label), and they are poster
// positions, not places on the ground. No gpsAnchors, mapArtIsGeoregistered
// false, so the v257/v260 gate suppresses every distance and walk-time
// readout. No lat/lng on any stage or amenity.
//
// ⚠ THE CENTROID IS THE SHIP, AND THE FESTIVAL IS NOT ON THE SHIP. "Queen
// Mary Waterfront" is the open ground beside the permanently moored liner.
// OSM names the SHIP (way 438331516) and nothing else there; the ground the
// festival actually occupies is two unnamed surface-parking polygons to its
// west — way 186112219 (36,862 m², centroid 33.751937,-118.192464) and way
// 186112218 (18,232 m², centroid 33.752973,-118.192052), measured the same
// day. Those are recorded for the flip session and deliberately NOT shipped
// as the venue: OSM calls them parking, not a festival ground, and welding
// two lots into a footprint would be a derivation wearing a survey's clothes.
// The ship is the only NAMED surveyed feature and it is the venue's namesake,
// so it carries the centroid; onSiteRadiusMi 0.4 (644 m) covers both lots
// with room to spare. No venue.footprint at all — the festival perimeter is
// not a surveyable feature today, and saying so is the honest answer.
//
// ── STILL OPEN AFTER THE SET-TIMES FLIP ──
//   1. mainStageId once an official source says which stage is the main stage.
//   2. venue.footprint: still none. The map's perimeter is art, not a survey.
(function () {
  "use strict";

  // ── STAGES: from the official 2026 festival map (see SOURCE above) ──
  //
  // The map prints SEQUENCE, VOID, VISION and DREAM, which confirms the four
  // 2025 asset-filename leads, plus BEATBOX ART CAR (named in the 2026 press
  // release as "Beatbox's Art Car stage featuring local trance artists").
  //
  // ⚠ Still open: the 2026 press release says the four stages include "the
  // new Long Beach Amphitheater". No stage on the map carries that name. It
  // may be the venue of one of the four; nothing published says which, so it
  // is not mapped onto any of them. Flagged, not picked.
  //
  // x/y: the centre of each stage STRUCTURE on the plate, measured on 3x
  // zooms of the official file (official px in each comment). Colours are
  // APP-ASSIGNED to echo each stage's own art; Insomniac publishes no stage
  // palette, so do not cite them as official. No desc: no programming is
  // published per stage.
  const STAGES = [
    { id: "sequence", name: "Sequence", short: "SEQNCE", color: "#E040FB", size: 1.4,
      x: 12.9, y: 24.0 },   // truss + deck at official px (145, 370)
    { id: "void",     name: "Void",     short: "VOID",   color: "#7C4DFF", size: 1.4,
      x: 47.3, y: 62.8 },   // lit stage box facing the grey seating, (507, 777)
    { id: "vision",   name: "Vision",   short: "VISION", color: "#00E676", size: 1.4,
      x: 61.2, y: 55.8 },   // green-panel truss deck, (653, 703)
    { id: "dream",    name: "Dream",    short: "DREAM",  color: "#29B6F6", size: 1.4,
      x: 94.6, y: 73.3 },   // blue cylinder stage, (1003, 887)
    { id: "beatbox-art-car", name: "Beatbox Art Car", short: "BEATBOX", color: "#FFB300", size: 1.1,
      x: 41.6, y: 45.0 },   // the boombox car, (447, 590)
  ];

  // From the official map's legend icons (same plate maths; official px in
  // each comment). A subset: the medical, water, restroom, info, locker and
  // charging icons. Bars, food and VIP icons are left to the map art itself.
  const AMENITIES = [
    { id: "dssc-med1",    type: "med",    label: "First Aid",      x: 9.3,  y: 29.9 },  // (108, 431) by Sequence
    { id: "dssc-med2",    type: "med",    label: "First Aid",      x: 56.2, y: 72.4 },  // (600, 878) by the shuttle gate
    { id: "dssc-med3",    type: "med",    label: "First Aid",      x: 79.2, y: 78.6 },  // (842, 943) by Dream
    { id: "dssc-water1",  type: "water",  label: "Water Station",  x: 13.3, y: 41.9 },  // (150, 557)
    { id: "dssc-water2",  type: "water",  label: "Water Station",  x: 34.5, y: 64.5 },  // (372, 795) by Void
    { id: "dssc-water3",  type: "water",  label: "Water Station",  x: 62.4, y: 68.1 },  // (665, 833) by Vision
    { id: "dssc-wc1",     type: "toilet", label: "Restrooms",      x: 17.7, y: 43.6 },  // (196, 575)
    { id: "dssc-wc2",     type: "toilet", label: "Restrooms",      x: 46.5, y: 49.2 },  // (498, 634)
    { id: "dssc-wc3",     type: "toilet", label: "Restrooms",      x: 68.5, y: 61.4 },  // (729, 762)
    { id: "dssc-wc4",     type: "toilet", label: "Restrooms",      x: 49.1, y: 77.9 },  // (526, 935)
    { id: "dssc-info",    type: "info",   label: "Info Booth",     x: 33.3, y: 50.2 },  // (360, 645)
    { id: "dssc-lockers", type: "locker", label: "Lockers",        x: 29.2, y: 48.3 },  // (317, 625)
    { id: "dssc-charge1", type: "charge", label: "Charge Station", x: 15.4, y: 42.6 },  // (172, 565)
    { id: "dssc-charge2", type: "charge", label: "Charge Station", x: 33.1, y: 56.0 },  // (358, 705)
  ];

  // Every act is unplaced and untimed. `tier` drives lineup card weighting
  // elsewhere; with no set times there is no basis to rank, so all acts sit
  // at the same tier rather than being silently ordered by a guess.
  // `provisional: true` marks the whole set for the flip session.
  // The flip fills this block from the OFFICIAL schedule, after STAGES and
  // real Fri/Sat dayDates come from the same source:
  //   node scripts/fetch-insomniac-settimes.mjs https://socal.dreamstateusa.com/lineup/set-times --days 2 --out sheet.tsv
  //   node scripts/import-set-times.mjs dreamstate-socal-2026 sheet.tsv --days-from-sheet --source <official-url>
  // id → [stageId, start, end, day]. Empty until then: every act unplaced.
  const SCHEDULE = {
    // SCHEDULE:BEGIN dreamstate-socal-2026
    // source: https://socal.dreamstateusa.com/lineup/set-times/ · imported 2026-11-20 · 70 of 70 acts
    "dssc-maximizer": ["sequence", "16:00", "17:00", 1],  // Maximizer
    "dssc-terra": ["sequence", "17:00", "18:00", 1],  // Terra
    "dssc-kaufmann-de": ["sequence", "18:00", "19:00", 1],  // KAUFMANN
    "dssc-burn-in-noise": ["sequence", "19:00", "20:00", 1],  // Burn In Noise
    "dssc-gms": ["sequence", "20:00", "21:00", 1],  // GMS
    "dssc-phaxe": ["sequence", "21:00", "22:00", 1],  // Phaxe
    "dssc-astrix": ["sequence", "22:00", "23:00", 1],  // Astrix
    "dssc-neelix": ["sequence", "23:00", "00:00", 1],  // Neelix
    "dssc-infected-mushroom": ["sequence", "00:00", "01:00", 1],  // Infected Mushroom
    "dssc-shay-de-castro": ["void", "16:00", "17:00", 1],  // Shay De Castro
    "dssc-bk": ["void", "17:00", "18:00", 1],  // BK
    "dssc-lee-ann-roberts": ["void", "18:00", "19:00", 1],  // Lee Ann Roberts
    "dssc-a-n-i": ["void", "19:00", "20:00", 1],  // A.N.I.
    "dssc-schrotthagen": ["void", "20:00", "21:00", 1],  // Schrotthagen
    "dssc-panteros666": ["void", "21:00", "22:00", 1],  // Panteros666
    "dssc-pegassi": ["void", "22:00", "23:00", 1],  // Pegassi
    "dssc-enrico-sangiuliano": ["void", "23:00", "00:00", 1],  // Enrico Sangiuliano
    "dssc-reinier-zonneveld-live": ["void", "00:00", "01:00", 1],  // Reinier Zonneveld (Live)
    "dssc-karm": ["vision", "16:00", "17:00", 1],  // KARMÅ
    "dssc-steve-dekay": ["vision", "17:00", "18:00", 1],  // Steve Dekay
    "dssc-frankyeffe": ["vision", "18:00", "19:00", 1],  // FRANKYEFFE
    "dssc-ferry-tayle-and-tonks-pres-mirage-live": ["vision", "19:00", "20:00", 1],  // Mirage (Live)
    "dssc-nrg2000": ["vision", "20:00", "21:00", 1],  // NRG2000
    "dssc-warp-brothers": ["vision", "21:00", "22:00", 1],  // Warp Brothers
    "dssc-mauro-picotto": ["vision", "22:00", "23:00", 1],  // Mauro Picotto
    "dssc-bt": ["vision", "23:00", "00:00", 1],  // BT
    "dssc-marco-v": ["vision", "00:00", "01:00", 1],  // Marco V
    "dssc-visionv": ["dream", "16:00", "17:00", 1],  // VisionV
    "dssc-matty-ralph": ["dream", "17:00", "18:00", 1],  // Matty Ralph
    "dssc-david-rust-and-olly-james": ["dream", "18:00", "19:00", 1],  // David Rust + Olly James
    "dssc-the-rocketman": ["dream", "19:00", "20:00", 1],  // The Rocketman
    "dssc-marlo": ["dream", "20:00", "21:00", 1],  // MaRLo
    "dssc-andrew-rayel-pres-extasia": ["dream", "21:00", "22:00", 1],  // Andrew Rayel pres Extasia
    "dssc-dash-berlin": ["dream", "22:00", "23:00", 1],  // Dash Berlin
    "dssc-hannah-laing-and-marie-vaunt": ["dream", "23:00", "00:00", 1],  // Hannah Laing + Marie Vaunt
    "dssc-artbat": ["dream", "00:00", "01:00", 1],  // ARTBAT
    "dssc-barakuda": ["sequence", "16:00", "17:00", 2],  // Barakuda
    "dssc-perfect-stranger": ["sequence", "17:00", "18:00", 2],  // Perfect Stranger
    "dssc-rising-dust": ["sequence", "18:00", "19:00", 2],  // Rising Dust
    "dssc-sighter": ["sequence", "19:00", "20:00", 2],  // Sighter
    "dssc-john-00-fleming": ["sequence", "20:00", "21:00", 2],  // John 00 Fleming
    "dssc-giorgia-angiuli": ["sequence", "21:00", "22:00", 2],  // Giorgia Angiuli
    "dssc-vini-vici": ["sequence", "22:00", "23:00", 2],  // Vini Vici
    "dssc-ace-ventura": ["sequence", "23:00", "00:00", 2],  // Ace Ventura
    "dssc-animato": ["sequence", "00:00", "01:00", 2],  // Animato
    "dssc-hausman": ["void", "16:00", "17:00", 2],  // Hausman
    "dssc-roman-messer": ["void", "17:00", "18:00", 2],  // Roman Messer
    "dssc-paul-denton-and-will-rees-pres-parallel-worlds": ["void", "18:00", "19:00", 2],  // Parallel Worlds
    "dssc-eddie-halliwell-and-judge-jules": ["void", "19:00", "20:00", 2],  // Eddie Halliwell + Judge Jules
    "dssc-david-forbes-and-john-askew": ["void", "20:00", "21:15", 2],  // David Forbes + John Askew
    "dssc-bryan-kearney-and-john-ocallaghan-pres-key4050": ["void", "21:15", "22:30", 2],  // Key4050
    "dssc-aly-and-fila-and-billy-gillies": ["void", "22:30", "23:45", 2],  // Aly & Fila + Billy Gillies
    "dssc-paul-van-dyk-pres-essence-of-acid": ["void", "23:45", "01:00", 2],  // Paul van Dyk pres Essence Of Acid
    "dssc-sequence-six": ["vision", "16:00", "17:00", 2],  // Sequence Six
    "dssc-maria-healy": ["vision", "17:00", "18:00", 2],  // Maria Healy
    "dssc-chris-metcalfe": ["vision", "18:00", "19:00", 2],  // Chris Metcalfe
    "dssc-andy-moor": ["vision", "19:00", "20:00", 2],  // Andy Moor
    "dssc-allen-watts-and-talla-2xlc": ["vision", "20:00", "21:00", 2],  // Allen Watts + Talla 2XLC
    "dssc-darren-porter-and-sean-tyas": ["vision", "21:00", "22:00", 2],  // Darren Porter + Sean Tyas
    "dssc-cold-blue": ["vision", "22:00", "23:00", 2],  // Cold Blue
    "dssc-4-strings-classics-set": ["vision", "23:00", "00:00", 2],  // 4 Strings (Classics Set)
    "dssc-solarstone": ["vision", "00:00", "01:00", 2],  // Solarstone
    "dssc-das-pharaoh": ["dream", "16:00", "17:00", 2],  // Das Pharaoh
    "dssc-th-en": ["dream", "17:00", "18:00", 2],  // TH;EN
    "dssc-nu-aspect": ["dream", "18:00", "19:00", 2],  // Nu Aspect
    "dssc-joa": ["dream", "19:00", "20:00", 2],  // JOA
    "dssc-aaron-hibell-live": ["dream", "20:00", "21:00", 2],  // Aaron Hibell (Live)
    "dssc-alpha-9-and-ilan-bluestone": ["dream", "21:00", "22:00", 2],  // ALPHA 9 + Ilan Bluestone
    "dssc-ferry-corsten-and-marsh": ["dream", "22:00", "23:00", 2],  // Ferry Corsten + Marsh
    "dssc-above-and-beyond-anjunabeats-classics": ["dream", "23:00", "01:00", 2],  // Above & Beyond (Anjunabeats Classics)
    // SCHEDULE:END
  };
  const scheduled = act => {
    const s = SCHEDULE[act.id];
    if (!s) return act;
    const { provisional, ...rest } = act;
    return { ...rest, stage: s[0], start: s[1], end: s[2], day: s[3] ?? act.day, bio: "Playing Dreamstate SoCal 2026." };
  };

  const mk = (id, name) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #6366f1, #0b0620)",
    bio: "Playing Dreamstate SoCal 2026. Stage, night and set time are not " +
         "published yet — the official schedule drops in the days before the " +
         "festival.",
    provisional: true,
  });

  const ARTISTS = [
    mk("dssc-4-strings-classics-set",                               "4 Strings (Classics Set)"),
    mk("dssc-a-n-i",                                                "A.N.I."),
    mk("dssc-aaron-hibell-live",                                    "Aaron Hibell (Live)"),
    mk("dssc-above-and-beyond-anjunabeats-classics",                "Above & Beyond (Anjunabeats Classics)"),
    mk("dssc-ace-ventura",                                          "Ace Ventura"),
    mk("dssc-allen-watts-and-talla-2xlc",                           "Allen Watts + Talla 2XLC"),
    mk("dssc-alpha-9-and-ilan-bluestone",                           "ALPHA 9 + Ilan Bluestone"),
    mk("dssc-aly-and-fila-and-billy-gillies",                       "Aly & Fila + Billy Gillies"),
    mk("dssc-andrew-rayel-pres-extasia",                            "Andrew Rayel pres Extasia"),
    mk("dssc-andy-moor",                                            "Andy Moor"),
    mk("dssc-animato",                                              "Animato"),
    mk("dssc-artbat",                                               "ARTBAT"),
    mk("dssc-astrix",                                               "Astrix"),
    mk("dssc-barakuda",                                             "Barakuda"),
    mk("dssc-bk",                                                   "BK"),
    mk("dssc-bryan-kearney-and-john-ocallaghan-pres-key4050",       "Bryan Kearney + John O'Callaghan pres Key4050"),
    mk("dssc-bt",                                                   "BT"),
    mk("dssc-burn-in-noise",                                        "Burn In Noise"),
    mk("dssc-chris-metcalfe",                                       "Chris Metcalfe"),
    mk("dssc-cold-blue",                                            "Cold Blue"),
    mk("dssc-darren-porter-and-sean-tyas",                          "Darren Porter + Sean Tyas"),
    mk("dssc-das-pharaoh",                                          "Das Pharaoh"),
    mk("dssc-dash-berlin",                                          "Dash Berlin"),
    mk("dssc-david-forbes-and-john-askew",                          "David Forbes + John Askew"),
    mk("dssc-david-rust-and-olly-james",                            "David Rust + Olly James"),
    mk("dssc-eddie-halliwell-and-judge-jules",                      "Eddie Halliwell + Judge Jules"),
    mk("dssc-enrico-sangiuliano",                                   "Enrico Sangiuliano"),
    mk("dssc-ferry-corsten-and-marsh",                              "Ferry Corsten + Marsh"),
    mk("dssc-ferry-tayle-and-tonks-pres-mirage-live",               "Ferry Tayle + Tonks pres Mirage (Live)"),
    mk("dssc-frankyeffe",                                           "FRANKYEFFE"),
    mk("dssc-giorgia-angiuli",                                      "Giorgia Angiuli"),
    mk("dssc-gms",                                                  "GMS"),
    mk("dssc-hannah-laing-and-marie-vaunt",                         "Hannah Laing + Marie Vaunt"),
    mk("dssc-hausman",                                              "Hausman"),
    mk("dssc-infected-mushroom",                                    "Infected Mushroom"),
    mk("dssc-joa",                                                  "JOA"),
    mk("dssc-john-00-fleming",                                      "John 00 Fleming"),
    mk("dssc-karm",                                                 "KARMÅ"),
    mk("dssc-kaufmann-de",                                          "KAUFMANN (DE)"),
    mk("dssc-lee-ann-roberts",                                      "Lee Ann Roberts"),
    mk("dssc-marco-v",                                              "Marco V"),
    mk("dssc-maria-healy",                                          "Maria Healy"),
    mk("dssc-marlo",                                                "MaRLo"),
    mk("dssc-matty-ralph",                                          "Matty Ralph"),
    mk("dssc-mauro-picotto",                                        "Mauro Picotto"),
    mk("dssc-maximizer",                                            "Maximizer"),
    mk("dssc-neelix",                                               "Neelix"),
    mk("dssc-nrg2000",                                              "NRG2000"),
    mk("dssc-nu-aspect",                                            "Nu Aspect"),
    mk("dssc-panteros666",                                          "Panteros666"),
    mk("dssc-paul-denton-and-will-rees-pres-parallel-worlds",       "Paul Denton + Will Rees pres Parallel Worlds"),
    mk("dssc-paul-van-dyk-pres-essence-of-acid",                    "Paul van Dyk pres Essence Of Acid"),
    mk("dssc-pegassi",                                              "Pegassi"),
    mk("dssc-perfect-stranger",                                     "Perfect Stranger"),
    mk("dssc-phaxe",                                                "Phaxe"),
    mk("dssc-reinier-zonneveld-live",                               "Reinier Zonneveld (Live)"),
    mk("dssc-rising-dust",                                          "Rising Dust"),
    mk("dssc-roman-messer",                                         "Roman Messer"),
    mk("dssc-schrotthagen",                                         "Schrotthagen"),
    mk("dssc-sequence-six",                                         "Sequence Six"),
    mk("dssc-shay-de-castro",                                       "Shay De Castro"),
    mk("dssc-sighter",                                              "Sighter"),
    mk("dssc-solarstone",                                           "Solarstone"),
    mk("dssc-steve-dekay",                                          "Steve Dekay"),
    mk("dssc-terra",                                                "Terra"),
    mk("dssc-th-en",                                                "TH;EN"),
    mk("dssc-the-rocketman",                                        "The Rocketman"),
    mk("dssc-vini-vici",                                            "Vini Vici"),
    mk("dssc-visionv",                                              "VisionV"),
    mk("dssc-warp-brothers",                                        "Warp Brothers"),
  ];

  const CONFIG = {
    id:        "dreamstate-socal-2026",
    // Hours as the festival's OWN page prints them (24h wall clock, local):
    // label is the page's word for the window ("Gates", "Festival", "Event").
    // No published value means no field — never inferred from an older year.
    // `dated` quotes the page's dated block verbatim; editionHours() prints the
    // hours only when that block is for this edition.
    hours: { label: "Event", open: "16:00", close: "01:00", url: "https://socal.dreamstateusa.com/guide/hours-and-info/", dated: "Friday, November 20 + Saturday, November 21, 2026", observedAt: "2026-09-24" },
    // Where the lineup rows came from (the SOURCE note above), as data so the
    // public /f/ page can cite it. observedAt = the date it was read.
    lineupSource: { url: "https://socal.dreamstateusa.com/lineup/", observedAt: "2026-11-20", official: true },
    scheduleSource: { url: "https://socal.dreamstateusa.com/lineup/set-times/", observedAt: "2026-11-20", official: true },
    name:      "Dreamstate SoCal 2026",
    shortName: "Dreamstate SoCal",
    brand:     "Dreamstate",
    tagline:   "Two nights of trance on the Long Beach waterfront",
    location:  "Queen Mary Waterfront · Long Beach, CA",
    locationShort: "Queen Mary Waterfront",
    dates:     "Nov 20–21, 2026",
    year:      2026,
    // Night Print accent: the festival's own first-party colour (ledger: scripts/test-night-print.mjs)
    print: { accent: "#4AB4EA", source: { url: "https://socal.dreamstateusa.com/wp-content/assets/css/dreamstate-sf.min.css?ver=2.2.41", observedAt: "2026-10-09", seenAs: "a{color:#4AB4EA}, .button{background-color}, active nav link, blockquote, .card__category (8 uses)", confidence: "high" }, note: "The per-festival stylesheet of Insomniac's shared 'festival' theme sets every link, primary button and category label to this sky blue (written uppercase in the CSS); no theme-color meta." },
    officialEvent: {
      id: 527404, url: "https://socal.dreamstateusa.com/",
      website: "https://socal.dreamstateusa.com/",
      tickets: "https://dreamstate.frontgatetickets.com/",
      observedAt: "2026-09-10",
    },
    // Los Angeles is PST (UTC-8) on these dates — DST ended Nov 1, 2026.
    // Hours ARE published, so these are the real ones rather than the
    // generous bounds a festival with unpublished hours has to use:
    // doors 4 PM Nov 20, afterparty closes 6 AM Nov 22.
    startMs: Date.UTC(2026, 10, 21, 0, 0, 0),   // Nov 20 16:00 PST
    endMs:   Date.UTC(2026, 10, 22, 14, 0, 0),  // Nov 22 06:00 PST
    tz:      "America/Los_Angeles",
    tzAbbr:  "PST",
    utcOffsetHours: -8,
    // Two real nights, from the official set-times pages (day-1 = Friday
    // Nov 20, day-2 = Saturday Nov 21; see the header). Until 2026-11-20 this
    // was ONE "Nov 20–21" bucket labelled TBA, the III Points precedent (#79),
    // because no day split had been published.
    dayDates: {
      1: { y: 2026, m: 10, d: 20, name: "Friday",   short: "FRI", midnightUtc: Date.UTC(2026, 10, 20, 8, 0, 0) },
      2: { y: 2026, m: 10, d: 21, name: "Saturday", short: "SAT", midnightUtc: Date.UTC(2026, 10, 21, 8, 0, 0) },
    },
    // api.sunrise-sunset.org at 33.752789,-118.189632, fetched 2026-11-20,
    // converted to PST and cut to the minute.
    sunTimes: {
      1: { rise: "06:29", set: "16:47" },
      2: { rise: "06:30", set: "16:46" },
    },
    // Surveyed OSM centroid of The Queen Mary (way 438331516), NOT an address
    // geocode. See the header: this is the ship, the festival is on the ground
    // beside it, and the radius is sized to cover both.
    gps: { lat: 33.752789, lng: -118.189632, onSiteRadiusMi: 0.4 },
    venue: {
      name: "Queen Mary Waterfront",
      address: "1126 Queens Hwy, Long Beach, CA 90802",
      terrain: "asphalt",
      // No footprint. The festival perimeter is not a surveyable feature
      // today and the ship's hull is not the festival. See the header.
    },
    weatherEndpoint: "https://api.weather.gov/points/33.7528,-118.1896",
    mainStageId: null,
    // ── THE MAP ──
    // The official 2026 map as an image-overlay plate (see SOURCE). The art
    // is oblique and unregistered: no gpsAnchors, so no distance claims.
    mapImage: "dreamstate-socal-2026-map.webp",
    // The same art fitted to the ground by its own ties (shoreline, the lot,
    // the dome, the Queen Mary; never a stage), Jake 2026-11-12: "let's try to
    // get each map overlayed on top of the real ground". Oblique art, so a
    // homography: scripts/build-geo-plate.py over map-sources/dreamstate-socal-2026-geo-ties.json.
    // The real map lays this plate down at its bounds; still no distance claims.
    mapGeoref: { image: "geo-maps/dreamstate-socal-2026.webp", bounds: [-118.1955541, 33.7505923, -118.1880717, 33.7552658], model: "homography",
                 ties: "map-sources/dreamstate-socal-2026-geo-ties.json", rmsM: 13.8, looRmsM: 19.8 },
    mapStyle: "image-overlay",
    mapTheme: "park",
    mapPrintsStageNames: true,
    mapArtIsGeoregistered: false,
    // Published policy, drives FAQ copy only.
    policies: { reentry: false, alcoholAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["dreamstate-socal-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Official set times since 2026-11-20 (see the header). Stages, map and
    // amenities come from the official map.
    registry: { available: true, scheduleTBA: false, accent: "#6366f1", emoji: "🌀", region: "North America" },
  };
})();

