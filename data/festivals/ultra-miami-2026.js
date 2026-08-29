// ═══════════════════════════════════════════════════════════════════════
// ULTRA MIAMI 2026 — Bayfront Park · Miami, FL
// Mar 27–29, 2026
// ═══════════════════════════════════════════════════════════════════════
// RETROSPECTIVE BUILD. This festival is in the past, so every field below is
// published historical fact rather than a forecast — hence available: true and
// no provisional set-time flags. Sources are cited per block.
//
// SOURCE lineup + set times: official set-times graphic, ultramusicfestival.com/lineup/set-times/
//   (ULTRA2026-SET-TIMES-website-1.png), accessed 2026-08-28.
// SOURCE hours: Fri 4pm-midnight, Sat noon-midnight, Sun noon-10pm (Miami New Times /
//   NBC 6 South Florida festival previews, Mar 2026) — matches the graphic, whose
//   earliest Friday slot is 16:00 and whose latest Sunday slot is 21:00.
// SOURCE venue centroid + Torch of Friendship + FPL Solar Amphitheater: OpenStreetMap.
//
// The graphic prints START TIMES ONLY. The grid is contiguous — each slot begins when
// the previous one ends — so `end` is DERIVED as the next start on that stage/day, and
// the last act of each stage-day ends at that day's close.
//
// SPATIAL MODEL — read this before moving any coordinate.
// Each stage carries ONE authored position: its real-world lat/lng. The 0-100
// grid x/y below is DERIVED from that lat/lng against `footprint`, and
// gpsAnchors is the same lat/lng echoed back. So feeding any anchor through
// map.jsx's gpsToMap() returns that stage's own x/y exactly — the map art and
// the pin layer cannot drift apart, because they are the same transform.
// (EDC LV and ACL were authored the other way round — art and pins registered
// independently — and both had stages tens of metres out. Don't repeat it.)
// Positions marked "prov" are placed from the published site layout and are
// NOT satellite-verified; "osm" are measured OpenStreetMap features.
// Round-trip residual for this festival: 0.083 grid units (~0.5 m),
// which is entirely the cost of printing x/y to one decimal for readability.
(function () {
  "use strict";

  const STAGES = [
    { id: "main",          name: "ULTRA Main Stage", short: "MAIN", color: "#38bdf8",
      x: 46.7, y: 13.8, size: 1.7, desc: "North lawn · headliners",
      vibe: "The Big Screen", vibeNote: "Every closer, every pyro cue, every phone in the air. Bayfront's north lawn holds the whole festival at once.", peak: "20:00–24:00" },
    { id: "worldwide",     name: "Worldwide Stage", short: "WW", color: "#a855f7",
      x: 33.3, y: 83.7, size: 1.2, desc: "South lawn · bass, trance, hard",
      vibe: "Bass Cathedral", vibeNote: "Dubstep and hard dance from noon. The crowd that never leaves the rail.", peak: "19:00–24:00" },
    { id: "megastructure", name: "Megastructure", short: "MEGA", color: "#f97316",
      x: 63.3, y: 90, size: 1.3, desc: "RESISTANCE Megastructure · south-east, techno + house",
      vibe: "Techno Cathedral", vibeNote: "The Megastructure is the reason people fly in. Long sets, real selectors, no filler.", peak: "18:00–24:00" },
    { id: "cove",          name: "The Cove", short: "COVE", color: "#14b8a6",
      x: 75, y: 56.3, size: 1, desc: "Bayfront · underground takeovers",
      vibe: "Water's Edge", vibeNote: "Backs onto the bay. Smallest crowd, deepest selections, best breeze.", peak: "17:00–24:00" },
    { id: "live",          name: "Live Stage", short: "LIVE", color: "#ec4899",
      x: 49, y: 35, size: 1.1, desc: "FPL Solar Amphitheater · live acts",
      vibe: "Actual Instruments", vibeNote: "The amphitheater. Live sets, real drums, the one place at Ultra with fixed seating.", peak: "18:00–23:00" },
    { id: "umfradio",      name: "UMF Radio Stage", short: "RADIO", color: "#facc15",
      x: 20, y: 25, size: 0.95, desc: "North-west · takeover stage",
      vibe: "Label Takeovers", vibeNote: "A different crew every day. Hard, fast, and closest to the gate.", peak: "18:00–24:00" },
    { id: "oasis",         name: "Oasis", short: "OASIS", color: "#22c55e",
      x: 25, y: 58.8, size: 0.85, desc: "Mid-park · local + rising",
      vibe: "First Slot Energy", vibeNote: "Where Miami's own get their Ultra debut. Turn up early and you'll catch someone before they blow up.", peak: "16:00–22:00" },
  ];

  const AMENITIES = [
    { id: "ultra1", type: "water", label: "Hydration Station", x: 33.3, y: 37.5 },
    { id: "ultra2", type: "water", label: "Hydration Station", x: 43.3, y: 75 },
    { id: "ultra3", type: "med", label: "Medical", x: 23.3, y: 52.5 },
    { id: "ultra4", type: "med", label: "Medical", x: 50, y: 81.2 },
    { id: "ultra5", type: "toilet", label: "Restrooms", x: 40, y: 27.5 },
    { id: "ultra6", type: "toilet", label: "Restrooms", x: 30, y: 68.8 },
    { id: "ultra7", type: "food", label: "Food Court", x: 36.7, y: 47.5 },
    { id: "ultra8", type: "info", label: "Info / Lost & Found", x: 16.7, y: 20 },
    { id: "ultra9", type: "locker", label: "Lockers", x: 26.7, y: 23.7 },
    { id: "ultra10", type: "art", label: "Torch of Friendship", x: 44, y: 53.2 },  // OSM
  ];

  // tier: 3 = headline slot (21:00+), 2 = prime (18:00–20:59), 1 = earlier.
  const mk = (id, name, genre, stage, day, start, end) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 21 || h < 6 ? 3 : h >= 18 ? 2 : 1;
    return { id, name, genre, country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #1a0a28)`,
      bio: `Played Ultra Miami 2026.` };
  };

  const ARTISTS = [
    // ─────────── DAY 1 · Friday Mar 27 ───────────
    // ULTRA Main Stage
    mk("ul1",    "Frank Walker",                                      "EDM",                 "main",          1, "16:00", "16:50"),
    mk("ul2",    "VOYD",                                              "EDM",                 "main",          1, "16:50", "17:55"),
    mk("ul3",    "Worship",                                           "Electronic",          "main",          1, "17:55", "19:00"),
    mk("ul4",    "Illenium",                                          "EDM",                 "main",          1, "19:00", "20:05"),
    mk("ul5",    "Bzrp",                                              "EDM",                 "main",          1, "20:05", "21:20"),
    mk("ul6",    "Alesso b2b Martin Garrix",                          "EDM",                 "main",          1, "21:20", "22:45"),
    mk("ul7",    "Major Lazer",                                       "Electronic",          "main",          1, "22:45", "00:00"),
    // Worldwide Stage
    mk("ul8",    "Prada2000",                                         "Bass",                "worldwide",     1, "16:00", "17:00"),
    mk("ul9",    "Matty Ralph",                                       "Bass",                "worldwide",     1, "17:00", "18:00"),
    mk("ul10",   "Superstrings",                                      "Bass",                "worldwide",     1, "18:00", "19:00"),
    mk("ul11",   "Vini Vici",                                         "Bass",                "worldwide",     1, "19:00", "20:00"),
    mk("ul12",   "Lilly Palmer",                                      "Bass",                "worldwide",     1, "20:00", "21:00"),
    mk("ul13",   "Armin van Buuren b2b Marlon Hoffstadt",             "Bass",                "worldwide",     1, "21:00", "22:30"),
    mk("ul14",   "Armin van Buuren",                                  "Bass",                "worldwide",     1, "22:30", "00:00"),
    // Megastructure
    mk("ul15",   "MAR-T",                                             "Techno",              "megastructure", 1, "16:00", "17:30"),
    mk("ul16",   "Massano",                                           "Techno",              "megastructure", 1, "17:30", "19:00"),
    mk("ul17",   "Miss Monique",                                      "Electronic",          "megastructure", 1, "19:00", "20:30"),
    mk("ul18",   "Vintage Culture",                                   "Techno",              "megastructure", 1, "20:30", "22:00"),
    mk("ul19",   "Eric Prydz",                                        "Techno",              "megastructure", 1, "22:00", "00:00"),
    // The Cove
    mk("ul20",   "Godtripper",                                        "Techno",              "cove",          1, "16:00", "17:30"),
    mk("ul21",   "ALT8",                                              "Techno",              "cove",          1, "17:30", "19:00"),
    mk("ul22",   "999999999",                                         "Techno",              "cove",          1, "19:00", "20:30"),
    mk("ul23",   "Clara Cuvé",                                        "Techno",              "cove",          1, "20:30", "22:00"),
    mk("ul24",   "Sara Landry",                                       "Techno",              "cove",          1, "22:00", "00:00"),
    // Live Stage
    mk("ul25",   "Afrobeta",                                          "Live Electronic",     "live",          1, "17:00", "18:15"),
    mk("ul26",   "SHIMA",                                             "Live Electronic",     "live",          1, "18:15", "19:45"),
    mk("ul27",   "Black Tiger Sex Machine presents Connected Fighters", "Live Electronic",     "live",          1, "19:45", "21:15"),
    mk("ul28",   "Of The Trees",                                      "Live Electronic",     "live",          1, "21:15", "22:45"),
    mk("ul29",   "Levity presents Lasership",                         "Live Electronic",     "live",          1, "22:45", "00:00"),
    // UMF Radio Stage
    mk("ul30",   "Linney",                                            "Hard Dance",          "umfradio",      1, "16:00", "16:30"),
    mk("ul31",   "Ookay",                                             "Hard Dance",          "umfradio",      1, "16:30", "17:15"),
    mk("ul32",   "Nostalgix",                                         "Hard Dance",          "umfradio",      1, "17:15", "18:15"),
    mk("ul33",   "Jessica Audiffred",                                 "Hard Dance",          "umfradio",      1, "18:15", "19:15"),
    mk("ul34",   "Steve Aoki",                                        "Hard Dance",          "umfradio",      1, "19:15", "20:15"),
    mk("ul35",   "Special Guest b2b Special Guest",                   "Hard Dance",          "umfradio",      1, "20:15", "21:15"),
    mk("ul36",   "Laidback Luke",                                     "Hard Dance",          "umfradio",      1, "21:15", "22:15"),
    mk("ul37",   "Riot Ten",                                          "Hard Dance",          "umfradio",      1, "22:15", "23:15"),
    mk("ul38",   "Bloody Beetroots (Throwback Electro Set)",          "Hard Dance",          "umfradio",      1, "23:15", "00:00"),
    // Oasis
    mk("ul39",   "Nundos",                                            "House",               "oasis",         1, "16:00", "17:00"),
    mk("ul40",   "Richard Fraioli b2b Jimmy Page b3b DJ Ideal",       "House",               "oasis",         1, "17:00", "18:30"),
    mk("ul41",   "Los De La Vega",                                    "House",               "oasis",         1, "18:30", "19:30"),
    mk("ul42",   "Hymm Marley",                                       "House",               "oasis",         1, "19:30", "20:00"),
    mk("ul43",   "Tak Shak",                                          "House",               "oasis",         1, "20:00", "21:00"),
    mk("ul44",   "Rodrigo Vieira",                                    "House",               "oasis",         1, "21:00", "22:00"),
    mk("ul45",   "DJ Hannah",                                         "House",               "oasis",         1, "22:00", "23:00"),
    mk("ul46",   "Luca Testa",                                        "House",               "oasis",         1, "23:00", "00:00"),
    // ─────────── DAY 2 · Saturday Mar 28 ───────────
    // ULTRA Main Stage
    mk("ul47",   "Gil Glaze",                                         "EDM",                 "main",          2, "12:00", "12:55"),
    mk("ul48",   "MYKRIS",                                            "EDM",                 "main",          2, "12:55", "14:00"),
    mk("ul49",   "HALÕ",                                              "EDM",                 "main",          2, "14:00", "15:05"),
    mk("ul50",   "Nicky Romero",                                      "EDM",                 "main",          2, "15:05", "16:10"),
    mk("ul51",   "Loud Luxury",                                       "EDM",                 "main",          2, "16:10", "17:15"),
    mk("ul52",   "Alan Walker",                                       "EDM",                 "main",          2, "17:15", "18:20"),
    mk("ul53",   "Steve Aoki",                                        "EDM",                 "main",          2, "18:20", "19:25"),
    mk("ul54",   "Excision",                                          "EDM",                 "main",          2, "19:25", "20:30"),
    mk("ul55",   "Hardwell",                                          "EDM",                 "main",          2, "20:30", "21:35"),
    mk("ul56",   "Armin van Buuren",                                  "EDM",                 "main",          2, "21:35", "22:45"),
    mk("ul57",   "Sebastian Ingrosso b2b Steve Angello",              "EDM",                 "main",          2, "22:45", "00:00"),
    // Worldwide Stage
    mk("ul58",   "Julian Cross",                                      "Bass",                "worldwide",     2, "12:10", "13:00"),
    mk("ul59",   "Distinct Motive",                                   "Bass",                "worldwide",     2, "13:00", "14:00"),
    mk("ul60",   "Sidequest",                                         "Bass",                "worldwide",     2, "14:00", "15:00"),
    mk("ul61",   "Daniel Allan",                                      "Bass",                "worldwide",     2, "15:00", "16:00"),
    mk("ul62",   "ARMNHMR",                                           "Bass",                "worldwide",     2, "16:00", "17:00"),
    mk("ul63",   "HOL!",                                              "Bass",                "worldwide",     2, "17:00", "18:00"),
    mk("ul64",   "BOU",                                               "Bass",                "worldwide",     2, "18:00", "19:00"),
    mk("ul65",   "Kai Wachi",                                         "Bass",                "worldwide",     2, "19:00", "20:00"),
    mk("ul66",   "Outlaw b2b Trym",                                   "Bass",                "worldwide",     2, "20:00", "21:00"),
    mk("ul67",   "Hamdi",                                             "Bass",                "worldwide",     2, "21:00", "22:00"),
    mk("ul68",   "¥ØU$UK€ ¥UK1MAT$U",                                 "Electronic",          "worldwide",     2, "22:00", "23:00"),
    mk("ul69",   "ISOXO",                                             "Bass",                "worldwide",     2, "23:00", "00:00"),
    // Megastructure
    mk("ul70",   "Andy Pate b2b Rod B.",                              "Techno",              "megastructure", 2, "12:00", "13:15"),
    mk("ul71",   "Juliet Fox",                                        "Techno",              "megastructure", 2, "13:15", "14:30"),
    mk("ul72",   "Alan Fitzpatrick b2b Marco Faraone",                "Techno",              "megastructure", 2, "14:30", "16:00"),
    mk("ul73",   "Sasha_John Digweed",                                "Techno",              "megastructure", 2, "16:00", "17:30"),
    mk("ul74",   "Eli Brown",                                         "Electronic",          "megastructure", 2, "17:30", "19:00"),
    mk("ul75",   "Adam Beyer b2b Joseph Capriati",                    "Techno",              "megastructure", 2, "19:00", "21:00"),
    mk("ul76",   "Carl Cox",                                          "Techno",              "megastructure", 2, "21:00", "00:00"),
    // The Cove
    mk("ul77",   "JOA",                                               "Techno",              "cove",          2, "12:00", "13:15"),
    mk("ul78",   "Olympe",                                            "Techno",              "cove",          2, "13:15", "14:30"),
    mk("ul79",   "Rivo",                                              "Techno",              "cove",          2, "14:30", "16:00"),
    mk("ul80",   "Kasia",                                             "Techno",              "cove",          2, "16:00", "17:30"),
    mk("ul81",   "Deep Dish",                                         "Techno",              "cove",          2, "17:30", "19:00"),
    mk("ul82",   "Colyn b2b Innellea",                                "Techno",              "cove",          2, "19:00", "20:30"),
    mk("ul83",   "Cassian",                                           "Techno",              "cove",          2, "20:30", "22:00"),
    mk("ul84",   "Joris Voorn b2b Korolova",                          "Techno",              "cove",          2, "22:00", "00:00"),
    // Live Stage
    mk("ul85",   "Miss Bashful",                                      "Live Electronic",     "live",          2, "16:00", "17:10"),
    mk("ul86",   "Confidence Man",                                    "Rock",                "live",          2, "17:10", "18:30"),
    mk("ul87",   "Snow Strippers",                                    "Rock",                "live",          2, "18:30", "20:00"),
    mk("ul88",   "Madeon",                                            "Live Electronic",     "live",          2, "20:00", "21:30"),
    mk("ul89",   "Boys Noize Live",                                   "Live Electronic",     "live",          2, "21:30", "22:45"),
    mk("ul90",   "Brutalismus 3000",                                  "Live Electronic",     "live",          2, "22:45", "00:00"),
    // UMF Radio Stage
    mk("ul91",   "CGK",                                               "Hard Dance",          "umfradio",      2, "12:00", "13:30"),
    mk("ul92",   "Darksiderz",                                        "Hard Dance",          "umfradio",      2, "13:30", "15:00"),
    mk("ul93",   "Audiofreq",                                         "Hard Dance",          "umfradio",      2, "15:00", "16:00"),
    mk("ul94",   "The Purge",                                         "Hard Dance",          "umfradio",      2, "16:00", "17:00"),
    mk("ul95",   "The Saints",                                        "Hard Dance",          "umfradio",      2, "17:00", "18:00"),
    mk("ul96",   "Coone",                                             "Hard Dance",          "umfradio",      2, "18:00", "19:00"),
    mk("ul97",   "Da Tweekaz",                                        "Hard Dance",          "umfradio",      2, "19:00", "20:00"),
    mk("ul98",   "Mish",                                              "Hard Dance",          "umfradio",      2, "20:00", "21:00"),
    mk("ul99",   "D-Sturb",                                           "Hard Dance",          "umfradio",      2, "21:00", "22:00"),
    mk("ul100",  "Dual Damage",                                       "Hard Dance",          "umfradio",      2, "22:00", "23:00"),
    mk("ul101",  "Soren",                                             "Hard Dance",          "umfradio",      2, "23:00", "00:00"),
    // Oasis
    mk("ul102",  "Cimeo",                                             "House",               "oasis",         2, "12:00", "13:00"),
    mk("ul103",  "Juno b2b Wyzzard b3b Bebe Breaks",                  "House",               "oasis",         2, "13:00", "14:00"),
    mk("ul104",  "Kauro",                                             "House",               "oasis",         2, "14:00", "15:00"),
    mk("ul105",  "Soul Goodman b2b Dabura",                           "House",               "oasis",         2, "15:00", "16:00"),
    mk("ul106",  "CVMRN",                                             "House",               "oasis",         2, "16:00", "17:00"),
    mk("ul107",  "Bill Kelly",                                        "House",               "oasis",         2, "17:00", "18:00"),
    mk("ul108",  "Lucy Guo",                                          "House",               "oasis",         2, "18:00", "19:00"),
    mk("ul109",  "Jack Vice",                                         "House",               "oasis",         2, "19:00", "20:00"),
    mk("ul110",  "Pinto",                                             "House",               "oasis",         2, "20:00", "21:00"),
    mk("ul111",  "Marco Ninni",                                       "House",               "oasis",         2, "21:00", "22:00"),
    mk("ul112",  "Alexander Som",                                     "House",               "oasis",         2, "22:00", "23:00"),
    mk("ul113",  "Wally Lopez",                                       "House",               "oasis",         2, "23:00", "00:00"),
    // ─────────── DAY 3 · Sunday Mar 29 ───────────
    // ULTRA Main Stage
    mk("ul114",  "Kapuchon",                                          "EDM",                 "main",          3, "12:15", "13:05"),
    mk("ul115",  "ME N U",                                            "EDM",                 "main",          3, "13:05", "14:10"),
    mk("ul116",  "R3HAB",                                             "EDM",                 "main",          3, "14:10", "15:15"),
    mk("ul117",  "Maddix",                                            "EDM",                 "main",          3, "15:15", "16:20"),
    mk("ul118",  "ARTBAT",                                            "EDM",                 "main",          3, "16:20", "17:25"),
    mk("ul119",  "Marlon Hoffstadt",                                  "EDM",                 "main",          3, "17:25", "18:30"),
    mk("ul120",  "Afrojack",                                          "EDM",                 "main",          3, "18:30", "19:35"),
    mk("ul121",  "DJ Snake",                                          "EDM",                 "main",          3, "19:35", "20:45"),
    mk("ul122",  "John Summit",                                       "Electronic",          "main",          3, "20:45", "22:00"),
    // Worldwide Stage
    mk("ul123",  "Big Florida",                                       "Bass",                "worldwide",     3, "12:00", "13:00"),
    mk("ul124",  "JSTJR",                                             "Bass",                "worldwide",     3, "13:00", "14:00"),
    mk("ul125",  "BOLO",                                              "Bass",                "worldwide",     3, "14:00", "15:00"),
    mk("ul126",  "LAYZ",                                              "Bass",                "worldwide",     3, "15:00", "16:00"),
    mk("ul127",  "Andy C",                                            "Bass",                "worldwide",     3, "16:00", "17:00"),
    mk("ul128",  "Holy Priest",                                       "Bass",                "worldwide",     3, "17:00", "18:00"),
    mk("ul129",  "Peekaboo",                                          "Bass",                "worldwide",     3, "18:00", "19:00"),
    mk("ul130",  "Ray Volpe b2b Sullivan King",                       "Bass",                "worldwide",     3, "19:00", "20:30"),
    mk("ul131",  "Wankdat",                                           "Bass",                "worldwide",     3, "20:30", "22:00"),
    // Megastructure
    mk("ul132",  "Bassett b2b Christopher James",                     "Techno",              "megastructure", 3, "12:00", "14:00"),
    mk("ul133",  "Scenarios",                                         "Techno",              "megastructure", 3, "14:00", "15:30"),
    mk("ul134",  "Argy b2b Mind Against",                             "Techno",              "megastructure", 3, "15:30", "17:00"),
    mk("ul135",  "Adriatique",                                        "Techno",              "megastructure", 3, "17:00", "18:30"),
    mk("ul136",  "Boris Brejcha",                                     "Electronic",          "megastructure", 3, "18:30", "20:00"),
    mk("ul137",  "Amelie Lens b2b Sara Landry",                       "Techno",              "megastructure", 3, "20:00", "22:00"),
    // The Cove
    mk("ul138",  "M.O.N.R.O.E.",                                      "Techno",              "cove",          3, "12:00", "13:00"),
    mk("ul139",  "Plastik Funk",                                      "Techno",              "cove",          3, "13:00", "14:00"),
    mk("ul140",  "Black Fancy",                                       "Techno",              "cove",          3, "14:00", "15:15"),
    mk("ul141",  "Malóne",                                            "Techno",              "cove",          3, "15:15", "16:30"),
    mk("ul142",  "Rossi.",                                            "Techno",              "cove",          3, "16:30", "18:00"),
    mk("ul143",  "Dennis Cruz b2b Seth Troxler",                      "Techno",              "cove",          3, "18:00", "20:00"),
    mk("ul144",  "The Martinez Brothers",                             "Techno",              "cove",          3, "20:00", "22:00"),
    // Live Stage
    mk("ul145",  "BOIISH",                                            "Live Electronic",     "live",          3, "16:00", "17:00"),
    mk("ul146",  "Parisi",                                            "Live Electronic",     "live",          3, "17:00", "18:15"),
    mk("ul147",  "Louis The Child",                                   "Live Electronic",     "live",          3, "18:15", "19:30"),
    mk("ul148",  "TIM3LESS",                                          "Live Electronic",     "live",          3, "19:30", "21:00"),
    mk("ul149",  "ZHU",                                               "Live Electronic",     "live",          3, "21:00", "22:00"),
    // UMF Radio Stage
    mk("ul150",  "EERA",                                              "Hard Dance",          "umfradio",      3, "12:00", "13:30"),
    mk("ul151",  "Frost Children",                                    "Hard Dance",          "umfradio",      3, "13:30", "15:00"),
    mk("ul152",  "X CLUB.",                                           "Hard Dance",          "umfradio",      3, "15:00", "16:30"),
    mk("ul153",  "FCUKERS",                                           "Hard Dance",          "umfradio",      3, "16:30", "18:00"),
    mk("ul154",  "MCR-T",                                             "Hard Dance",          "umfradio",      3, "18:00", "19:30"),
    mk("ul155",  "DJ Gigola",                                         "Hard Dance",          "umfradio",      3, "19:30", "20:30"),
    mk("ul156",  "Peterblue",                                         "Hard Dance",          "umfradio",      3, "20:30", "22:00"),
    // Oasis
    mk("ul157",  "Dubplates & Dragons",                               "House",               "oasis",         3, "12:00", "13:00"),
    mk("ul158",  "Andy Ares",                                         "House",               "oasis",         3, "13:00", "14:00"),
    mk("ul159",  "Jay P",                                             "House",               "oasis",         3, "14:00", "15:00"),
    mk("ul160",  "Sebastian Morxx",                                   "House",               "oasis",         3, "15:00", "16:00"),
    mk("ul161",  "Wags b2b Lemony Snickettes",                        "House",               "oasis",         3, "16:00", "17:00"),
    mk("ul162",  "Luke Hunter",                                       "House",               "oasis",         3, "17:00", "18:00"),
    mk("ul163",  "Purple",                                            "House",               "oasis",         3, "18:00", "19:00"),
    mk("ul164",  "Audiosal",                                          "House",               "oasis",         3, "19:00", "20:00"),
    mk("ul165",  "X-Con b2b Marvin Delgado b3b CJ",                   "House",               "oasis",         3, "20:00", "21:00"),
    mk("ul166",  "Metaphysical",                                      "House",               "oasis",         3, "21:00", "22:00"),
  ];

  const CONFIG = {
    id: "ultra-miami-2026",
    name: "Ultra Miami 2026",
    shortName: "Ultra 2026",
    brand: "Ultra",
    tagline: "Three days on Biscayne Bay",
    location: "Bayfront Park · Miami, FL",
    locationShort: "Bayfront Park",
    dates: "Mar 27–29, 2026",
    year: 2026,
    // gates day 1 (16:00 EDT) -> close of the final day (22:00 EDT)
    startMs: Date.UTC(2026, 2, 27, 20, 0, 0),
    endMs:   Date.UTC(2026, 2, 30, 2, 0, 0),
    tz: "America/New_York",
    tzAbbr: "EDT",
    utcOffsetHours: -4,
    dayDates: {
      1: { y: 2026, m: 2, d: 27, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 2, 27, 4, 0, 0) },
      2: { y: 2026, m: 2, d: 28, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 2, 28, 4, 0, 0) },
      3: { y: 2026, m: 2, d: 29, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 2, 29, 4, 0, 0) },
    },
    // sunrise-sunset.org at the venue centroid, rendered in EDT.
    sunTimes: {
      1: { rise: "07:15", set: "19:36" },
      2: { rise: "07:14", set: "19:36" },
      3: { rise: "07:13", set: "19:37" },
    },
    // No festival-operated shuttle published for 2026; field omitted rather than guessed.
    gps: { lat: 25.7752, lng: -80.1866, onSiteRadiusMi: 0.35 },
    rideshareGps: {
      lat: 25.7793, lng: -80.1896,
      label: "NE 2nd St · Rideshare Pickup",
      note:  "Biscayne Blvd closes at the park. Walk north out of Gate 1.",
    },
    venue: {
      name: "Bayfront Park",
      address: "301 Biscayne Blvd, Miami, FL 33132",
      festivalBounds: { north: 25.779, south: 25.771,
                        west: -80.189, east: -80.183 },
    },
    // Every anchor is the stage's own authored lat/lng, so the affine in
    // map.jsx reproduces each stage's x/y exactly. Verified by scripts/verify.mjs.
    gpsAnchors: [
      // Ordered so the leading triple spans the largest triangle — map.jsx's
      // _solveMapAffine reads only the first three, and a thin triple is unstable.
      { stageId: "worldwide",     lat: 25.77230, lng: -80.18700 },  // prov
      { stageId: "cove",          lat: 25.77450, lng: -80.18450 },  // prov
      { stageId: "umfradio",      lat: 25.77700, lng: -80.18780 },  // prov
      { stageId: "main",          lat: 25.77790, lng: -80.18620 },  // prov
      { stageId: "megastructure", lat: 25.77180, lng: -80.18520 },  // prov
      { stageId: "live",          lat: 25.77620, lng: -80.18606 },  // osm
      { stageId: "oasis",         lat: 25.77430, lng: -80.18750 },  // prov
    ],
    weatherEndpoint: "https://api.weather.gov/points/25.78,-80.19",
    mainStageId: "main",
    // Generated abstract overlay, NOT the official patron map — that art is
    // rights-restricted and is never copied into this repo (lostlands-2026.jpg
    // precedent). Authored in the same 0-100 frame as the stages above.
    mapImage: "ultra-2026.svg",
    mapStyle: "image-overlay",
    mapTheme: "park",
    // The overlay prints no stage names, so pills carry them.
    mapPrintsStageNames: false,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["ultra-miami-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, accent: "#38bdf8", emoji: "🌴", region: "North America" },
  };
})();
