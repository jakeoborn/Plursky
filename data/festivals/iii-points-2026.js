// ═══════════════════════════════════════════════════════════════════════
// III POINTS 2026 — Mana Wynwood · Miami, FL
// Oct 16–17, 2026
// ═══════════════════════════════════════════════════════════════════════
// GATED SCAFFOLD. The LINEUP is real and complete; everything that places an
// act in space or time is NOT PUBLISHED, and nothing here invents it.
//
// SOURCE lineup: iiipoints.com/lineup-2026/ (official), accessed 2026-08-29.
//   218 acts, parsed from the 218 <li> rows of the page's single
//   `ul.lineup__list`. 218 unique, 80 of them B2B. B2B billing is preserved
//   VERBATIM as one act, because that is how the set is sold and how the
//   schedule will print it.
// SOURCE venue + dates + policies: iiipoints.com/guide/, accessed 2026-08-29
//   — "Mana Wynwood, 2217 NW 5th Ave, Miami, FL 33127", "October 16+17, 2026",
//   no re-entry, 21+ for alcohol, "asphalt and grass terrain".
// SOURCE venue geometry: OpenStreetMap way 435880991 "Mana Wynwood Convention
//   Center", fetched via Overpass 2026-08-29.
// SOURCE sun times: api.sunrise-sunset.org at the OSM centroid, 2026-08-29.
//
// ⛔ DO NOT SOURCE ANYTHING FROM THIS SITE'S JSON-LD. The lineup page still
// serves `"name": "III Points Music Festival 2021", "startDate": "2021-10-22",
// "location": "DMANA WYNWOOD"` — five years stale. The human-readable guide
// page is correct; the structured data is not. Same trap for
// iiipoints.com/experience/stages/, which 404s but is still linked from the
// site's own popup config.
//
// ── WHAT IS NOT PUBLISHED (verified 2026-08-29, do not fabricate) ──
// STAGES, DAY SPLIT, and SET TIMES are all absent. The lineup is ONE flat
// alphabetical list covering both days — there are no stage headings and no
// Fri/Sat tabs. The guide FAQ states it directly: "Maps showing stage
// locations, food, bathrooms, etc. WILL BE AVAILABLE PRIOR TO THE EVENT" and
// "DURING THE DAYS LEADING UP TO THE FESTIVAL, set times will be posted."
// So every artist below carries stage: null, day: null, start/end "".
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
//   2. day + start/end per act; drop the `provisional` flag.
//   3. gpsAnchors re-measured to T1 against the official map.
//   4. Widen venue.footprint to the real perimeter.
//   5. amenities from the official map's legend.
//   6. registry.available → true.
(function () {
  "use strict";

  // No stages published — see the header. This is intentionally empty, and
  // the app must stay correct with it empty; that is asserted by the mount
  // probe in scripts/verify.mjs, which boots this festival active.
  const STAGES = [];

  // No amenity map published.
  const AMENITIES = [];

  // Every act is unplaced and untimed. `tier` drives lineup card weighting
  // elsewhere; with no set times there is no basis to rank, so all acts sit
  // at the same tier rather than being silently ordered by a guess.
  // `provisional: true` marks the whole set for the flip session.
  const mk = (id, name) => ({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #22d3ee, #1a0a28)",
    bio: "Playing III Points 2026. Stage, day and set time are not published " +
         "yet — the official schedule drops in the days before the festival.",
    provisional: true,
  });

  const ARTISTS = [
    mk("iiip-1-800-lolita-b2b-xana",        "1-800-Lolita B2B Xana"),
    mk("iiip-2up",                          "2UP!"),
    mk("iiip-619",                          "619!"),
    mk("iiip-999999999",                    "999999999"),
    mk("iiip-aabel-b2b-siegel",             "Aabel B2B Siegel"),
    mk("iiip-ackdaddy",                     "Ackdaddy"),
    mk("iiip-adam-at-the-door",             "Adam At The Door"),
    mk("iiip-adam-port",                    "Adam Port"),
    mk("iiip-ahmed-spins-b2b-omri",         "Ahmed Spins B2B OMRI."),
    mk("iiip-ale-acosta-b2b-hazon",         "Ale Acosta B2B Hazón"),
    mk("iiip-alejo",                        "ALEJO"),
    mk("iiip-alexx-in-chainss-b2b-solte",   "Alexx in Chainss B2B Soltek"),
    mk("iiip-alezsandro-b2b-dalva",         "Alezsandro B2B Dalva"),
    mk("iiip-allnightkev-b2b-lo-g",         "Allnightkev B2B Lo-G"),
    mk("iiip-aphex-twink-b2b-foreseer",     "Aphex Twink B2B FORESEER"),
    mk("iiip-artime-b2b-mystic-bill",       "Artime B2B Mystic Bill"),
    mk("iiip-ashley-venom-b2b-souls-dep",   "Ashley Venom B2B Souls Departed"),
    mk("iiip-b0yg1rl",                      "B0YG1RL"),
    mk("iiip-baby-jesus-b2b-chaos",         "Baby Jesus B2B CHAOS!"),
    mk("iiip-bakke",                        "Bakke"),
    mk("iiip-bassvictim",                   "Bassvictim"),
    mk("iiip-beltran-b2b-ben-sterling",     "Beltran B2B Ben Sterling"),
    mk("iiip-bill-patrick-b2b-bort",        "Bill Patrick B2B Bort"),
    mk("iiip-blood-orange",                 "Blood Orange"),
    mk("iiip-bone-thugs-n-harmony",         "Bone Thugs-N-Harmony"),
    mk("iiip-bonita-applebumz-b2b-toni-",   "Bonita Applebumz B2B Toni Shardai"),
    mk("iiip-bozito-b2b-gabo-escalona",     "Bozito B2B Gabo Escalona"),
    mk("iiip-bricolage-b2b-day-dem",        "Bricolage B2B DAY/DEM"),
    mk("iiip-brunello-b2b-rafael",          "Brunello B2B Rafael"),
    mk("iiip-cami-di-marzo",                "Cami di Marzo"),
    mk("iiip-camp-blu",                     "Camp Blu"),
    mk("iiip-carter-jackson-brown",         "Carter Jackson-Brown"),
    mk("iiip-chanel-beads",                 "Chanel Beads"),
    mk("iiip-charlotte-de-witte",           "Charlotte de Witte"),
    mk("iiip-chasewest",                    "ChaseWest"),
    mk("iiip-cloonee",                      "Cloonee"),
    mk("iiip-coffintexts-b2b-dj-fuckoff",   "Coffintexts B2B DJ Fuckoff"),
    mk("iiip-cole-knight-b2b-dreya-v",      "Cole Knight B2B DREYA V"),
    mk("iiip-connan-mockasin",              "Connan Mockasin"),
    mk("iiip-corridos-ketamina",            "Corridos Ketamina"),
    mk("iiip-d-luxe-b2b-dennis-baker",      "D.Luxe B2B Dennis Baker"),
    mk("iiip-daizy",                        "Daizy"),
    mk("iiip-dan-molinari",                 "Dan Molinari"),
    mk("iiip-danny-brown",                  "Danny Brown"),
    mk("iiip-danny-daze-b2b-dj-godfathe",   "Danny Daze B2B DJ Godfather"),
    mk("iiip-daphni",                       "Daphni"),
    mk("iiip-david-vunk",                   "David Vunk"),
    mk("iiip-dean-turnley",                 "Dean Turnley"),
    mk("iiip-deep-cleansing",               "Deep Cleansing"),
    mk("iiip-differ",                       "Differ"),
    mk("iiip-discip",                       "Discip"),
    mk("iiip-disco-lines",                  "Disco Lines"),
    mk("iiip-dj-harvey",                    "DJ Harvey"),
    mk("iiip-dj-ray-b2b-ez-dee",            "DJ Ray B2B EZ Dee"),
    mk("iiip-dj-sabi-b2b-grue5ome",         "DJ Sabi B2B GRUE5OME"),
    mk("iiip-dj-three-b2b-sister-system",   "DJ Three B2B Sister System"),
    mk("iiip-domnrob",                      "DomnRob"),
    mk("iiip-doris-dana",                   "doris dana"),
    mk("iiip-dr-rubinstein-b2b-ultrathe",   "Dr. Rubinstein B2B Ultrathem"),
    mk("iiip-duality-b2b-gumthewrapper",    "Duality B2B GumtheWrapper"),
    mk("iiip-dude-skywalker",               "Dude Skywalker"),
    mk("iiip-duun-b2b-sleepy-c",            "duun B2B Sleepy C"),
    mk("iiip-ear",                          "ear"),
    mk("iiip-eco-sistema",                  "eco-sistema"),
    mk("iiip-eli-escobar-b2b-jubilee",      "Eli Escobar B2B Jubilee"),
    mk("iiip-elias-garcia-b2b-mila-gama",   "Elias Garcia B2B Mila Gama"),
    mk("iiip-ellynora",                     "Ellynora"),
    mk("iiip-eveava-b2b-jovigibs",          "eveava B2B Jovigibs"),
    mk("iiip-extra-andrew-b2b-mutant-pe",   "Extra Andrew B2B Mutant Pete"),
    mk("iiip-faith-leazae",                 "Faith Leazae"),
    mk("iiip-fakemink",                     "fakemink"),
    mk("iiip-feph-b2b-mr-tron",             "Feph B2B Mr. Tron"),
    mk("iiip-fiin",                         "Fiin"),
    mk("iiip-fine",                         "Fine"),
    mk("iiip-fiuza-b2b-madison-kay",        "FIUZA B2B Madison Kay"),
    mk("iiip-floating-points",              "Floating Points"),
    mk("iiip-flying-lotus",                 "Flying Lotus"),
    mk("iiip-four-tet",                     "Four Tet"),
    mk("iiip-generous-b-b2b-hakuna",        "Generous B B2B Hakuna"),
    mk("iiip-gio-elia-b2b-meghan-lee",      "Gio Elia B2B Meghan Lee"),
    mk("iiip-godisound",                    "Godisound"),
    mk("iiip-grace-arribas-b2b-marte",      "Grace Arribas B2B MARTE"),
    mk("iiip-grant-sabadash-b2b-shir-mi",   "Grant Sabadash B2B Shir Miya"),
    mk("iiip-haai",                         "HAAi"),
    mk("iiip-hamdi",                        "Hamdi"),
    mk("iiip-heidi-lawden",                 "Heidi Lawden"),
    mk("iiip-honey-dijon",                  "Honey Dijon"),
    mk("iiip-horsegiirl",                   "horsegiirL"),
    mk("iiip-idriss-d-b2b-danyelino",       "Idriss D B2B Danyelino"),
    mk("iiip-interplanetary-criminal",      "Interplanetary Criminal"),
    mk("iiip-invt",                         "INVT"),
    mk("iiip-ivy-lab",                      "Ivy Lab"),
    mk("iiip-jacques-greene",               "Jacques Greene"),
    mk("iiip-jane-remover",                 "Jane Remover"),
    mk("iiip-jason-rault",                  "Jason Rault"),
    mk("iiip-jbz",                          "JBZ"),
    mk("iiip-jencarlos",                    "JENCARLOS"),
    mk("iiip-jeremy-ismael",                "Jeremy Ismael"),
    mk("iiip-jigitz",                       "Jigitz"),
    mk("iiip-jinks-b2b-romulo-del-casti",   "Jinks B2B Romulo Del Castillo"),
    mk("iiip-jinn-pr",                      "JINN_PR"),
    mk("iiip-joanna-kuchta-b2b-robyn-si",   "Joanna Kuchta B2B Robyn Sin Love"),
    mk("iiip-joss-dean",                    "Joss Dean"),
    mk("iiip-u-uk-uk1mat-u",                "¥ØU$UK€ ¥UK1MAT$U"),
    mk("iiip-jump-source",                  "Jump Source"),
    mk("iiip-katie-ox-b2b-nat-siriani",     "Katie Ox B2B Nat Siriani"),
    mk("iiip-kelela",                       "Kelela"),
    mk("iiip-kettama",                      "KETTAMA"),
    mk("iiip-khami",                        "Khami"),
    mk("iiip-ki-ki",                        "KI/KI"),
    mk("iiip-kinahau",                      "KinAhau"),
    mk("iiip-kujo-b2b-rara",                "Kujo B2B RARA"),
    mk("iiip-kumi",                         "Kumi"),
    mk("iiip-la-bb",                        "La BB"),
    mk("iiip-lady-narcisse-b2b-racci",      "Lady Narcisse B2B Racci"),
    mk("iiip-ladyboy",                      "LADYBOY"),
    mk("iiip-lagrimas-de-oro",              "Lagrimas de Oro"),
    mk("iiip-lauren-palma",                 "Lauren Palma"),
    mk("iiip-levity-b2b-taiki-nulight",     "Levity B2B Taiki Nulight"),
    mk("iiip-lil-kim",                      "Lil' Kim"),
    mk("iiip-liquid-dinosaurs",             "Liquid Dinosaurs"),
    mk("iiip-lizzie-mcguire",               "Lizzie_mcguire"),
    mk("iiip-lotusoph-b2b-julia-saturno",   "Lotusoph B2B Julia Saturno"),
    mk("iiip-loukeman",                     "Loukeman"),
    mk("iiip-lousy-lover-b2b-lucaz",        "Lousy Lover B2B Lucaz"),
    mk("iiip-lupreme-b2b-santo",            "Lupreme B2B SANTO"),
    mk("iiip-maccabi-b2b-pezlo-md",         "Maccabi B2B Pezlo MD"),
    mk("iiip-machine-girl",                 "Machine Girl"),
    mk("iiip-maher-daniel-b2b-mai-iache",   "Maher Daniel B2B Mai Iachetti"),
    mk("iiip-malone-b2b-miluhska",          "Malóne B2B Miluhska"),
    mk("iiip-mango-b2b-mister-lo",          "Mango B2B Mister Lo"),
    mk("iiip-marco-carola-b2b-franky-ri",   "Marco Carola B2B Franky Rizardo"),
    mk("iiip-marie-qrie-b2b-viva-vidal",    "Marie Qrie B2B Viva Vidal"),
    mk("iiip-marsolo",                      "Marsolo"),
    mk("iiip-mary-droppinz",                "Mary Droppinz"),
    mk("iiip-mason-norris-b2b-mia-vende",   "Mason Norris B2B Mia Vendetta"),
    mk("iiip-max-dean-b2b-luke-dean",       "Max Dean B2B Luke Dean"),
    mk("iiip-max-styler-b2b-vintage-cul",   "Max Styler B2B Vintage Culture"),
    mk("iiip-megusta-b2b-migs",             "Megusta B2B MIGS"),
    mk("iiip-men-i-trust",                  "Men I Trust"),
    mk("iiip-mgna-crrrta",                  "MGNA Crrrta"),
    mk("iiip-miguel-clark-b2b-naim-zarz",   "Miguel Clark B2B Naim Zarzour"),
    mk("iiip-miguelle-tons-b2b-saraga",     "Miguelle & Tons B2B Saraga"),
    mk("iiip-mila-gama-b2b-x3butterfly",    "Mila Gama B2B X3BUTTERFLY"),
    mk("iiip-milo-ziro-b2b-xilla",          "Milo Ziro B2B Xilla"),
    mk("iiip-mind-enterprises",             "Mind Enterprises"),
    mk("iiip-ml-buch",                      "ML Buch"),
    mk("iiip-monoky",                       "Monoky"),
    mk("iiip-moscoman",                     "Moscoman"),
    mk("iiip-mph",                          "MPH"),
    mk("iiip-mr-bitch",                     "Mr. Bitch"),
    mk("iiip-mr-brown",                     "Mr. Brown"),
    mk("iiip-natalia-roth-b2b-max-stern",   "Natalia Roth B2B Max Stern"),
    mk("iiip-nate-sib",                     "nate sib"),
    mk("iiip-nicholas-g-padilla",           "Nicholas G. Padilla"),
    mk("iiip-nick-leon-b2b-safety-tranc",   "Nick León B2B Safety Trance"),
    mk("iiip-nicole-gallamini-b2b-nikit",   "Nicole Gallamini B2B Nikita Green"),
    mk("iiip-nii-tei",                      "Nii Tei"),
    mk("iiip-odd-mob",                      "Odd Mob"),
    mk("iiip-oma-totem-b2b-true-vine",      "oma totem B2B True Vine"),
    mk("iiip-omar",                         "Omar+"),
    mk("iiip-p1no-b2b-trippie-hippie",      "P1no B2B Trippie Hippie"),
    mk("iiip-parcels",                      "Parcels"),
    mk("iiip-patch",                        "Patch+"),
    mk("iiip-pawsa",                        "PAWSA"),
    mk("iiip-peach-b2b-shanti-celeste",     "Peach B2B Shanti Celeste"),
    mk("iiip-phiphi-b2b-winter-wrong",      "phiphi B2B Winter Wrong"),
    mk("iiip-pressure-point-b2b-berrakk",   "Pressure Point B2B Berrakka"),
    mk("iiip-proletar-b2b-zamurai",         "Proletar B2B Zamurai"),
    mk("iiip-puma",                         "Puma"),
    mk("iiip-purity-ring",                  "Purity Ring"),
    mk("iiip-r-v-calypso",                  "R/V Calypso"),
    mk("iiip-ragie-ban",                    "Ragie Ban"),
    mk("iiip-raje-b2b-slugg",               "RAJE B2B Slugg"),
    mk("iiip-rebolledo",                    "Rebolledo"),
    mk("iiip-red-axes",                     "Red Axes"),
    mk("iiip-rello",                        "Rello"),
    mk("iiip-rental-snakes",                "Rental Snakes"),
    mk("iiip-res-live",                     "res_ (live)"),
    mk("iiip-rimaye-b2b-inbal",             "Rimaye B2B Inbal"),
    mk("iiip-roddy-lima",                   "Roddy Lima"),
    mk("iiip-roman-flugel",                 "Roman Flügel"),
    mk("iiip-rude-boy-b2b-sdrv",            "Rude Boy B2B SDRV"),
    mk("iiip-rusowsky",                     "rusowsky"),
    mk("iiip-saint-romero",                 "Saint & Romero"),
    mk("iiip-sam-alfred",                   "Sam Alfred"),
    mk("iiip-santiago-villu",               "Santiago Villu"),
    mk("iiip-saturnsarii-b2b-suz",          "SATURNSARii B2B SUZ"),
    mk("iiip-sel-6-b2b-playshado",          "SEL.6 B2B PLAYSHADO"),
    mk("iiip-serafitz-b2b-sol-discos",      "serafitz B2B SOL Discos"),
    mk("iiip-seth-troxler",                 "Seth Troxler"),
    mk("iiip-shinobi",                      "Shinobi"),
    mk("iiip-silvie-loto-b2b-ms-mada",      "Silvie Loto B2B Ms. Mada"),
    mk("iiip-sosa",                         "Sosa"),
    mk("iiip-spice-crime-b2b-violeta",      "Spice Crime B2B Violeta"),
    mk("iiip-sportswax",                    "Sportswax"),
    mk("iiip-sunn-o",                       "Sunn O)))"),
    mk("iiip-tech-g1rls",                   "Tech G1rls"),
    mk("iiip-terence-tabeau",               "Terence Tabeau"),
    mk("iiip-tiffy-vera-b2b-thunderpony",   "Tiffy Vera B2B Thunderpony"),
    mk("iiip-tiga",                         "Tiga"),
    mk("iiip-tokischa",                     "Tokischa"),
    mk("iiip-tricky",                       "Tricky"),
    mk("iiip-uchi",                         "Uchi"),
    mk("iiip-ultrathem",                    "Ultrathem"),
    mk("iiip-underworld",                   "Underworld"),
    mk("iiip-v1fro",                        "V1FRO"),
    mk("iiip-vania-junco",                  "Vania Junco"),
    mk("iiip-velora",                       "Velora"),
    mk("iiip-vsyana",                       "vsyana"),
    mk("iiip-vtss",                         "VTSS"),
    mk("iiip-vvilhelm",                     "VVilhelm"),
    mk("iiip-whitesquare",                  "Whitesquare"),
    mk("iiip-will-buck-b2b-taimur",         "Will Buck B2B Taimur"),
    mk("iiip-will-renuart",                 "Will Renuart"),
    mk("iiip-willikens-ivkovic",            "Willikens & Ivkovic"),
    mk("iiip-yhwh-nailgun",                 "YHWH Nailgun"),
    mk("iiip-zep",                          "ZEP"),  ];

  const CONFIG = {
    id:        "iii-points-2026",
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
    // ⚠️ ONE bucket for a TWO-day festival, on purpose.
    //
    // The day split is not published (see header). Three options, and only
    // one is honest AND usable:
    //   - day: null on every act → the lineup screen renders EMPTY, because
    //     the whole app filters `a.day === activeDay` in 48 places. 218 acts
    //     shipped and none reachable. Measured, not guessed.
    //   - each act on BOTH days → claims every act plays twice. False.
    //   - ONE bucket labelled TBA → every act browsable and saveable now,
    //     and the label states exactly what is unknown.
    //
    // Rewriting those 48 comparison sites to treat null as "any day" is the
    // structurally nicer fix, but it touches six files for one gated
    // festival. Revisit it if a second TBA festival ever needs it; until
    // then this is module-local and reverses cleanly at the flip, where this
    // becomes the real Fri/Sat pair and each act gets its true day.
    dayDates: {
      1: { y: 2026, m: 9, d: 16, name: "Oct 16–17", short: "TBA", midnightUtc: Date.UTC(2026, 9, 16, 4, 0, 0) },
    },
    // api.sunrise-sunset.org at 25.79852,-80.20225, converted to EDT.
    // Oct 16 and 17 differ by one minute at sunset; the single bucket takes
    // day 1's, which is correct to within that minute for either date.
    sunTimes: {
      1: { rise: "07:19", set: "18:53" },
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
    // GATED: set times, stages and the official map are all unpublished.
    registry: { available: false, accent: "#22d3ee", emoji: "🔺", region: "North America" },
  };
})();
