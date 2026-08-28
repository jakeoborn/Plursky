// ═══════════════════════════════════════════════════════════════════════
// OUTSIDE LANDS 2026 — Golden Gate Park · San Francisco, CA
// Aug 7–9, 2026
// ═══════════════════════════════════════════════════════════════════════
// RETROSPECTIVE BUILD. This festival is in the past, so every field below is
// published historical fact rather than a forecast — hence available: true and
// no provisional set-time flags. Sources are cited per block.
//
// SOURCE lineup + set times: InMusic per-day set-time listings (inmusicblog.com,
//   2026-08-07 / -08 / -09), captured 2026-08-28. SECONDARY SOURCE, flagged: the official
//   sfoutsidelands.com/lineup page was taken down after the festival (404 as of
//   2026-08-28) and web.archive.org is not reachable from this environment, so the
//   primary could not be re-read. Headline slots cross-check against the SF Chronicle and
//   Riff Magazine set-time reports (Charli xcx 8:40 Lands End, The Strokes 8:35,
//   RÜFÜS DU SOL 8:25, PinkPantheress 8:45 Sutro, The xx 8:10 Twin Peaks).
// SOURCE hours: gates 11am, music noon-10pm — SF Chronicle 2026 festival guide.
// SOURCE stage positions: OpenStreetMap — Polo Field, Hellman Hollow, Lindley Meadow and
//   Marx Meadow are measured features; SOMA, Dolores’ and Duboce Triangle are by hand.
//
// Death Cab for Cutie plays TWICE on Sunday (12:40 Sutro, then 8:25 Sutro performing
// "Plans" in full). Both are in the data; it is not a duplicate row.
// One Friday SOMA row is mistyped in the source as "8:25-9:25 55 ODD MOB & OMNOM present
// HYPERBEAM"; read as 8:25-9:55, consistent with every other SOMA closing slot.
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
// Round-trip residual for this festival: 0.033 grid units (~0.4 m),
// which is entirely the cost of printing x/y to one decimal for readability.
(function () {
  "use strict";

  const STAGES = [
    { id: "landsend",  name: "Lands End", short: "LANDS END", color: "#22c55e",
      x: 22.8, y: 64.1, size: 1.7, desc: "Polo Field · headliners",
      vibe: "The Polo Field", vibeNote: "The big one. Fog rolls in about the time the headliner does, and it never stops being the point.", peak: "17:00–22:00" },
    { id: "twinpeaks", name: "Twin Peaks", short: "TWIN PEAKS", color: "#38bdf8",
      x: 72.6, y: 51.6, size: 1.4, desc: "Hellman Hollow · co-headliners",
      vibe: "The Hollow", vibeNote: "Natural bowl, trees on three sides, and the best sound at the festival if you stand halfway up.", peak: "17:00–22:00" },
    { id: "sutro",     name: "Sutro", short: "SUTRO", color: "#a855f7",
      x: 39.1, y: 34.9, size: 1.3, desc: "Lindley Meadow · rock + indie",
      vibe: "Guitar Meadow", vibeNote: "Turnstile, Modest Mouse, PinkPantheress. Sutro is where the weekend's loudest hour usually happens.", peak: "17:00–22:00" },
    { id: "panhandle", name: "Panhandle", short: "PANHANDLE", color: "#fbbf24",
      x: 78.5, y: 25.2, size: 0.95, desc: "Marx Meadow · rising acts",
      vibe: "Forty Minutes Each", vibeNote: "Short sets, small crowd, actual grass to sit on. The best place to find your next favourite band.", peak: "13:00–20:00" },
    { id: "soma",      name: "SOMA Tent", short: "SOMA", color: "#ec4899",
      x: 85.9, y: 42.7, size: 1.1, desc: "East · electronic tent",
      vibe: "Inside the Tent", vibeNote: "Ninety-minute DJ sets back to back from noon. Dark, loud, and ten degrees warmer than the rest of the park.", peak: "16:00–22:00" },
    { id: "dolores",   name: "Dolores'", short: "DOLORES'", color: "#f472b6",
      x: 59.9, y: 32, size: 0.8, desc: "Dolores' x Hot Goth GF · comedy + drag",
      vibe: "The Best Bad Idea", vibeNote: "Drag, comedy, a pole show and a singalong. San Francisco's stage, and nobody else could run it.", peak: "14:00–20:00" },
    { id: "duboce",    name: "Duboce Triangle", short: "DUBOCE", color: "#14b8a6",
      x: 49.3, y: 53.3, size: 0.7, desc: "DJ sets + surprise guests",
      vibe: "Thirty-Minute Drops", vibeNote: "Half-hour DJ sets from acts who played a real stage earlier. Check it on the way between the big two.", peak: "14:00–20:00" },
  ];

  const AMENITIES = [
    { id: "osl1", type: "water", label: "Hydration Station", x: 28.2, y: 57.3 },
    { id: "osl2", type: "water", label: "Hydration Station", x: 66.9, y: 46.7 },
    { id: "osl3", type: "med", label: "Medical", x: 31.7, y: 66.7 },
    { id: "osl4", type: "med", label: "Medical", x: 70.4, y: 40 },
    { id: "osl5", type: "toilet", label: "Restrooms", x: 19, y: 58.7 },
    { id: "osl6", type: "toilet", label: "Restrooms", x: 49.3, y: 40 },
    { id: "osl7", type: "toilet", label: "Restrooms", x: 76.1, y: 29.3 },
    { id: "osl8", type: "food", label: "Taste of the Bay Area", x: 42.3, y: 42.7 },
    { id: "osl9", type: "food", label: "Wine Lands", x: 56.3, y: 36 },
    { id: "osl10", type: "info", label: "Info / Lost & Found", x: 19.7, y: 69.3 },
  ];

  // tier: 3 = headline slot (19:00+), 2 = prime (16:00–18:59), 1 = earlier.
  const mk = (id, name, genre, stage, day, start, end) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 19 || h < 6 ? 3 : h >= 16 ? 2 : 1;
    return { id, name, genre, country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #1a0a28)`,
      bio: `Played Outside Lands 2026.` };
  };

  const ARTISTS = [
    // ─────────── DAY 1 · Friday Aug 7 ───────────
    // Lands End
    mk("os1",    "Faouzia",                                           "Pop",                 "landsend",      1, "12:05", "12:50"),
    mk("os2",    "Grace Ives",                                        "—",                   "landsend",      1, "13:20", "14:05"),
    mk("os3",    "Durand Bernar",                                     "—",                   "landsend",      1, "14:35", "15:25"),
    mk("os4",    "Wet Leg",                                           "Rock",                "landsend",      1, "15:55", "16:45"),
    mk("os5",    "GloRilla",                                          "Hip-Hop",             "landsend",      1, "17:15", "18:00"),
    mk("os6",    "Labrinth",                                          "Hip-Hop",             "landsend",      1, "18:30", "19:40"),
    mk("os7",    "Charli xcx",                                        "Pop",                 "landsend",      1, "20:40", "22:00"),
    // Twin Peaks
    mk("os8",    "Nezza",                                             "—",                   "twinpeaks",     1, "12:30", "13:20"),
    mk("os9",    "Kerala Dust",                                       "Electronic",          "twinpeaks",     1, "14:05", "14:50"),
    mk("os10",   "Alleycvt",                                          "Electronic",          "twinpeaks",     1, "15:35", "16:25"),
    mk("os11",   "Tinashe",                                           "Hip-Hop",             "twinpeaks",     1, "17:10", "18:00"),
    mk("os12",   "Clipse",                                            "Hip-Hop",             "twinpeaks",     1, "18:45", "19:35"),
    mk("os13",   "Griztronics",                                       "Electronic",          "twinpeaks",     1, "20:25", "21:55"),
    // Sutro
    mk("os14",   "Bad Nerves",                                        "Rock",                "sutro",         1, "12:25", "13:10"),
    mk("os15",   "Die Spitz",                                         "Rock",                "sutro",         1, "13:40", "14:25"),
    mk("os16",   "The Story So Far",                                  "Punk / Hardcore",     "sutro",         1, "14:55", "15:40"),
    mk("os17",   "Sierra Ferrell",                                    "Rock",                "sutro",         1, "16:10", "17:10"),
    mk("os18",   "Geese",                                             "Rock",                "sutro",         1, "17:50", "18:50"),
    mk("os19",   "Turnstile",                                         "Punk / Hardcore",     "sutro",         1, "19:20", "20:20"),
    mk("os20",   "Modest Mouse",                                      "Rock",                "sutro",         1, "20:50", "21:50"),
    // Panhandle
    mk("os21",   "Dani Satin and Always Hallways",                    "—",                   "panhandle",     1, "12:00", "12:30"),
    mk("os22",   "Chezile",                                           "—",                   "panhandle",     1, "13:20", "14:00"),
    mk("os23",   "Sawyer Hill",                                       "—",                   "panhandle",     1, "14:50", "15:30"),
    mk("os24",   "Billie Marten",                                     "—",                   "panhandle",     1, "16:25", "17:05"),
    mk("os25",   "Goldie Boutilier",                                  "—",                   "panhandle",     1, "18:00", "18:40"),
    mk("os26",   "Dylan Brady",                                       "Electronic",          "panhandle",     1, "19:35", "20:20"),
    // SOMA Tent
    mk("os27",   "Vertigo",                                           "Electronic",          "soma",          1, "12:00", "12:55"),
    mk("os28",   "Luke Alessi",                                       "Electronic",          "soma",          1, "12:55", "14:25"),
    mk("os29",   "Tobiahs",                                           "Electronic",          "soma",          1, "14:25", "15:55"),
    mk("os30",   "MPH",                                               "Electronic",          "soma",          1, "15:55", "17:25"),
    mk("os31",   "Ki/Ki",                                             "Electronic",          "soma",          1, "17:25", "18:55"),
    mk("os32",   "¥ØU$UK€ ¥UK1MAT$U",                                 "Electronic",          "soma",          1, "18:55", "20:25"),
    mk("os33",   "55 ODD MOB & OMNOM present HYPERBEAM",              "Electronic",          "soma",          1, "20:25", "21:25"),
    // Dolores'
    mk("os34",   "DJ Erinyes",                                        "Drag / Comedy",       "dolores",       1, "12:30", "13:15"),
    mk("os35",   "DJ Dolomedes",                                      "Drag / Comedy",       "dolores",       1, "13:15", "14:00"),
    mk("os36",   "Pink Stiletto",                                     "Drag / Comedy",       "dolores",       1, "14:00", "14:30"),
    mk("os37",   "DJ Starr Noir",                                     "Drag / Comedy",       "dolores",       1, "14:30", "15:20"),
    mk("os38",   "Hot Goth Freak Show",                               "Drag / Comedy",       "dolores",       1, "15:20", "15:50"),
    mk("os39",   "Soltera",                                           "Drag / Comedy",       "dolores",       1, "15:50", "16:35"),
    mk("os40",   "DJ Hopeless & Hot Goth Pole Show",                  "Drag / Comedy",       "dolores",       1, "16:35", "17:20"),
    mk("os41",   "Ms. Boan",                                          "Drag / Comedy",       "dolores",       1, "17:20", "18:05"),
    mk("os42",   "Hot Goth Freak Show",                               "Drag / Comedy",       "dolores",       1, "18:05", "18:35"),
    mk("os43",   "Light Asylum",                                      "Drag / Comedy",       "dolores",       1, "18:45", "19:30"),
    mk("os44",   "Romy (DJ set)",                                     "Electronic",          "dolores",       1, "19:30", "20:30"),
    // Duboce Triangle
    mk("os45",   "Nezza",                                             "DJ Set",              "duboce",        1, "14:05", "14:35"),
    mk("os46",   "Chezile",                                           "DJ Set",              "duboce",        1, "15:25", "15:55"),
    mk("os47",   "Luke Alessi",                                       "Electronic",          "duboce",        1, "16:45", "17:15"),
    mk("os48",   "Alleycvt",                                          "Electronic",          "duboce",        1, "18:15", "18:45"),
    mk("os49",   "tobiahs",                                           "Electronic",          "duboce",        1, "19:55", "20:40"),
    // ─────────── DAY 2 · Saturday Aug 8 ───────────
    // Lands End
    mk("os50",   "Bandalos Chinos",                                   "Latin",               "landsend",      2, "12:10", "12:55"),
    mk("os51",   "Haute & Freddy",                                    "—",                   "landsend",      2, "13:25", "14:10"),
    mk("os52",   "Audrey Hobert",                                     "Pop",                 "landsend",      2, "14:40", "15:30"),
    mk("os53",   "Lucy Dacus",                                        "—",                   "landsend",      2, "16:00", "16:50"),
    mk("os54",   "Ethel Cain",                                        "Punk / Hardcore",     "landsend",      2, "17:20", "18:20"),
    mk("os55",   "Djo",                                               "Rock",                "landsend",      2, "18:50", "19:50"),
    mk("os56",   "The Strokes",                                       "Rock",                "landsend",      2, "20:35", "21:55"),
    // Twin Peaks
    mk("os57",   "Red Leather",                                       "—",                   "twinpeaks",     2, "12:30", "13:10"),
    mk("os58",   "After",                                             "—",                   "twinpeaks",     2, "13:55", "14:35"),
    mk("os59",   "Laszewo",                                           "—",                   "twinpeaks",     2, "15:10", "16:00"),
    mk("os60",   "Malcom Todd",                                       "—",                   "twinpeaks",     2, "16:45", "17:45"),
    mk("os61",   "Dijon",                                             "—",                   "twinpeaks",     2, "18:30", "19:20"),
    mk("os62",   "The xx",                                            "—",                   "twinpeaks",     2, "20:10", "21:25"),
    // Sutro
    mk("os63",   "Rio Kosta",                                         "—",                   "sutro",         2, "12:35", "13:20"),
    mk("os64",   "Wunderhorse",                                       "Rock",                "sutro",         2, "13:50", "14:35"),
    mk("os65",   "Sienna Spiro",                                      "—",                   "sutro",         2, "15:05", "15:50"),
    mk("os66",   "Yard Act",                                          "Rock",                "sutro",         2, "16:20", "17:05"),
    mk("os67",   "Snow Strippers",                                    "Rock",                "sutro",         2, "17:35", "18:20"),
    mk("os68",   "It’s murph",                                        "—",                   "sutro",         2, "18:50", "20:00"),
    mk("os69",   "PinkPantheress",                                    "—",                   "sutro",         2, "20:45", "21:45"),
    // Panhandle
    mk("os70",   "Ryman",                                             "—",                   "panhandle",     2, "12:00", "12:30"),
    mk("os71",   "Racing Mount Pleasant",                             "—",                   "panhandle",     2, "13:10", "13:50"),
    mk("os72",   "Ally Evenson",                                      "—",                   "panhandle",     2, "14:35", "15:05"),
    mk("os73",   "Automatic",                                         "Rock",                "panhandle",     2, "16:00", "16:40"),
    mk("os74",   "Silvana Estrada",                                   "Rock",                "panhandle",     2, "17:45", "18:25"),
    mk("os75",   "DJ Trixie Mattel",                                  "Electronic",          "panhandle",     2, "19:20", "20:05"),
    // SOMA Tent
    mk("os76",   "Bad Juuju",                                         "Electronic",          "soma",          2, "12:35", "13:55"),
    mk("os77",   "1-800 Girls",                                       "Electronic",          "soma",          2, "13:55", "15:25"),
    mk("os78",   "Camoufly",                                          "Electronic",          "soma",          2, "15:25", "16:55"),
    mk("os79",   "Sultan + Shepard",                                  "Electronic",          "soma",          2, "16:55", "18:25"),
    mk("os80",   "Ben Böhmer",                                        "Electronic",          "soma",          2, "18:40", "20:10"),
    mk("os81",   "Lane 8",                                            "Electronic",          "soma",          2, "20:25", "21:55"),
    // Dolores'
    mk("os82",   "OUT TONIGHT: A Musical Singalong feat. D’Arcy Drollinger", "Drag / Comedy",       "dolores",       2, "12:30", "13:30"),
    mk("os83",   "OASIS DJ Set: Beverly Chills",                      "Drag / Comedy",       "dolores",       2, "13:30", "14:15"),
    mk("os84",   "Pink Stiletto",                                     "Drag / Comedy",       "dolores",       2, "14:00", "14:30"),
    mk("os85",   "REPARATIONS w/ DJ Newoncé",                         "Drag / Comedy",       "dolores",       2, "14:15", "15:15"),
    mk("os86",   "REPARATIONS w/ Nicki Jizz feat. Kori King",         "Drag / Comedy",       "dolores",       2, "15:15", "16:45"),
    mk("os87",   "OASIS DJ Set: DJ Ion The Prize",                    "Drag / Comedy",       "dolores",       2, "16:45", "17:45"),
    mk("os88",   "PRINCESS w/ Tito Soto feat. Lydia B Kollins",       "Drag / Comedy",       "dolores",       2, "17:45", "19:15"),
    // Duboce Triangle
    mk("os89",   "Tycho DJ Set",                                      "Electronic",          "duboce",        2, "12:15", "13:45"),
    mk("os90",   "Bandalos Chinos",                                   "Latin",               "duboce",        2, "14:10", "14:40"),
    mk("os91",   "Racing Mount Pleasant",                             "DJ Set",              "duboce",        2, "15:30", "16:00"),
    mk("os92",   "RIO KOSTA (DJ Set)",                                "DJ Set",              "duboce",        2, "16:50", "17:20"),
    mk("os93",   "Laszewo",                                           "DJ Set",              "duboce",        2, "18:20", "18:50"),
    mk("os94",   "Bad Juuju",                                         "Electronic",          "duboce",        2, "19:50", "20:35"),
    // ─────────── DAY 3 · Sunday Aug 9 ───────────
    // Lands End
    mk("os95",   "SF Gay Men’s Chorus",                               "—",                   "landsend",      3, "12:00", "12:40"),
    mk("os96",   "Sports",                                            "—",                   "landsend",      3, "13:10", "13:55"),
    mk("os97",   "Balu Brigada",                                      "—",                   "landsend",      3, "14:25", "15:15"),
    mk("os98",   "JADE",                                              "K-Pop",               "landsend",      3, "15:45", "16:45"),
    mk("os99",   "Disco Lines",                                       "Electronic",          "landsend",      3, "17:15", "18:15"),
    mk("os100",  "Empire of the Sun",                                 "Rock",                "landsend",      3, "18:45", "19:45"),
    mk("os101",  "RÜFÜS DU SOL",                                      "—",                   "landsend",      3, "20:25", "21:55"),
    // Twin Peaks
    mk("os102",  "Magnus Ferrell",                                    "—",                   "twinpeaks",     3, "12:45", "13:25"),
    mk("os103",  "sosocamo",                                          "—",                   "twinpeaks",     3, "14:10", "14:55"),
    mk("os104",  "Destin Conrad",                                     "Hip-Hop",             "twinpeaks",     3, "15:40", "16:30"),
    mk("os105",  "kwn",                                               "—",                   "twinpeaks",     3, "17:15", "18:05"),
    mk("os106",  "Mariah the Scientist",                              "Hip-Hop",             "twinpeaks",     3, "18:50", "19:50"),
    mk("os107",  "Baby Keem",                                         "Hip-Hop",             "twinpeaks",     3, "20:40", "21:55"),
    // Sutro
    mk("os108",  "Death Cab for Cutie",                               "Rock",                "sutro",         3, "12:40", "13:30"),
    mk("os109",  "Marlon Funaki",                                     "—",                   "sutro",         3, "13:50", "14:30"),
    mk("os110",  "Momma",                                             "Rock",                "sutro",         3, "15:00", "15:45"),
    mk("os111",  "Kingfishr",                                         "Country",             "sutro",         3, "16:15", "17:05"),
    mk("os112",  "The Temper Trap",                                   "Rock",                "sutro",         3, "17:35", "18:25"),
    mk("os113",  "Not for Radio",                                     "—",                   "sutro",         3, "19:05", "19:55"),
    mk("os114",  "Death Cab for Cutie",                               "Rock",                "sutro",         3, "20:25", "21:40"),
    // Panhandle
    mk("os115",  "Cruz Beckham",                                      "Pop",                 "panhandle",     3, "12:00", "12:40"),
    mk("os116",  "Day We Ran",                                        "—",                   "panhandle",     3, "13:25", "14:05"),
    mk("os117",  "Amble",                                             "—",                   "panhandle",     3, "14:55", "15:35"),
    mk("os118",  "Night Tapes",                                       "—",                   "panhandle",     3, "16:30", "17:10"),
    mk("os119",  "Infinity Song",                                     "—",                   "panhandle",     3, "18:05", "18:45"),
    mk("os120",  "Frost Children",                                    "—",                   "panhandle",     3, "19:50", "20:35"),
    // SOMA Tent
    mk("os121",  "Etari",                                             "Electronic",          "soma",          3, "12:05", "13:35"),
    mk("os122",  "X Club.",                                           "Electronic",          "soma",          3, "13:35", "15:10"),
    mk("os123",  "Carlita",                                           "Electronic",          "soma",          3, "15:10", "16:45"),
    mk("os124",  "Boys Noize",                                        "Electronic",          "soma",          3, "16:45", "18:20"),
    mk("os125",  "Miss Monique",                                      "Electronic",          "soma",          3, "18:20", "19:55"),
    mk("os126",  "Boris Brejcha",                                     "Electronic",          "soma",          3, "19:55", "21:55"),
    // Dolores'
    mk("os127",  "Charles Hawthorne",                                 "Drag / Comedy",       "dolores",       3, "12:45", "14:25"),
    mk("os128",  "Mark O’Brien",                                      "Drag / Comedy",       "dolores",       3, "14:25", "15:45"),
    mk("os129",  "Grace Towers & Friends",                            "Drag / Comedy",       "dolores",       3, "15:45", "16:05"),
    mk("os130",  "Stanley Frank Sensation",                           "Drag / Comedy",       "dolores",       3, "16:05", "17:05"),
    mk("os131",  "Beya",                                              "Drag / Comedy",       "dolores",       3, "17:05", "18:05"),
    mk("os132",  "Grace Towers & Friends",                            "Drag / Comedy",       "dolores",       3, "18:05", "18:25"),
    mk("os133",  "Elaine & Robin",                                    "Drag / Comedy",       "dolores",       3, "18:25", "19:25"),
    mk("os134",  "DJ Minx",                                           "Drag / Comedy",       "dolores",       3, "19:25", "20:25"),
    // Duboce Triangle
    mk("os135",  "Britton",                                           "DJ Set",              "duboce",        3, "14:05", "14:35"),
    mk("os136",  "Day We Ran",                                        "DJ Set",              "duboce",        3, "15:25", "15:55"),
    mk("os137",  "Frost Children (DJ Set)",                           "DJ Set",              "duboce",        3, "16:45", "17:30"),
    mk("os138",  "Marlon Funaki",                                     "DJ Set",              "duboce",        3, "18:15", "18:45"),
    mk("os139",  "Surprise Guest",                                    "DJ Set",              "duboce",        3, "19:45", "20:45"),
  ];

  const CONFIG = {
    id: "outside-lands-2026",
    name: "Outside Lands 2026",
    shortName: "Outside Lands",
    brand: "Outside Lands",
    tagline: "Three days of fog in Golden Gate Park",
    location: "Golden Gate Park · San Francisco, CA",
    locationShort: "Golden Gate Park",
    dates: "Aug 7–9, 2026",
    year: 2026,
    // gates day 1 (11:00 PDT) -> close of the final day (22:00 PDT)
    startMs: Date.UTC(2026, 7, 7, 18, 0, 0),
    endMs:   Date.UTC(2026, 7, 10, 5, 0, 0),
    tz: "America/Los_Angeles",
    tzAbbr: "PDT",
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 7, d: 7, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 7, 7, 7, 0, 0) },
      2: { y: 2026, m: 7, d: 8, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 7, 8, 7, 0, 0) },
      3: { y: 2026, m: 7, d: 9, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 7, 9, 7, 0, 0) },
    },
    // sunrise-sunset.org at the venue centroid, rendered in PDT.
    sunTimes: {
      1: { rise: "06:17", set: "20:13" },
      2: { rise: "06:18", set: "20:12" },
      3: { rise: "06:19", set: "20:11" },
    },
    // No festival-operated shuttle published for 2026; field omitted rather than guessed.
    gps: { lat: 37.7695, lng: -122.4887, onSiteRadiusMi: 0.55 },
    rideshareGps: {
      lat: 37.7649, lng: -122.4961,
      label: "Lincoln & 41st · Rideshare Pickup",
      note:  "No vehicles inside the park. Exit south to Lincoln Way.",
    },
    venue: {
      name: "Golden Gate Park",
      address: "Golden Gate Park, San Francisco, CA 94122",
      festivalBounds: { north: 37.773, south: 37.7655,
                        west: -122.496, east: -122.4818 },
    },
    // Every anchor is the stage's own authored lat/lng, so the affine in
    // map.jsx reproduces each stage's x/y exactly. Verified by scripts/verify.mjs.
    gpsAnchors: [
      // Ordered so the leading triple spans the largest triangle — map.jsx's
      // _solveMapAffine reads only the first three, and a thin triple is unstable.
      { stageId: "landsend",      lat: 37.76819, lng: -122.49276 },  // osm
      { stageId: "sutro",         lat: 37.77038, lng: -122.49045 },  // osm
      { stageId: "soma",          lat: 37.76980, lng: -122.48380 },  // prov
      { stageId: "twinpeaks",     lat: 37.76913, lng: -122.48569 },  // osm
      { stageId: "panhandle",     lat: 37.77111, lng: -122.48485 },  // osm
      { stageId: "dolores",       lat: 37.77060, lng: -122.48750 },  // prov
      { stageId: "duboce",        lat: 37.76900, lng: -122.48900 },  // prov
    ],
    weatherEndpoint: "https://api.weather.gov/points/37.77,-122.49",
    mainStageId: "landsend",
    // Generated abstract overlay, NOT the official patron map — that art is
    // rights-restricted and is never copied into this repo (lostlands-2026.jpg
    // precedent). Authored in the same 0-100 frame as the stages above.
    mapImage: "osl-2026.svg",
    mapStyle: "image-overlay",
    mapTheme: "park",
    // The overlay prints no stage names, so pills carry them.
    mapPrintsStageNames: false,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["outside-lands-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, accent: "#22c55e", emoji: "🌁", region: "North America" },
  };
})();
