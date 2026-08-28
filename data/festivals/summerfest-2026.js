// ═══════════════════════════════════════════════════════════════════════
// SUMMERFEST 2026 — Henry Maier Festival Park · Milwaukee, WI
// Jun 18–20, Jun 25–27 & Jul 2–4, 2026
// ═══════════════════════════════════════════════════════════════════════
// RETROSPECTIVE BUILD. This festival is in the past, so every field below is
// published historical fact rather than a forecast — hence available: true and
// no provisional set-time flags. Sources are cited per block.
//
// SOURCE lineup + set times: the nine official daily schedule graphics linked from
//   summerfest.com/lineup ("view daily schedules"), hosted at
//   s3.summerfest.com/assets/files/2026/schedules/updates/, accessed 2026-08-28.
// SOURCE dates + hours: summerfest.com press release 2026-02-19 ("Milwaukee’s Summerfest
//   Reveals 2026 Lineup") — three weekends, Jun 18-20 / Jun 25-27 / Jul 2-4, noon to midnight.
// SOURCE stage positions: OpenStreetMap features inside Henry Maier Festival Park —
//   nine of the ten stages are mapped by name; only the AmFam House stage is placed by hand.
// SOURCE amenities: OpenStreetMap (First Aid x2, Police/Lost & Found, Event Tickets,
//   Bo Black Family Fountain, Big Gig BBQ, JoJo’s, Arts & Crafts Market, Wheel in the
//   Sky, Skyglider). Hydration and restroom pins are placed by hand.
//
// THE AMPHITHEATER IS SEPARATELY TICKETED. American Family Insurance Amphitheater
// concerts need their own ticket; that ticket also admits you to the grounds that day.
// Its acts are included below because they are part of the festival programme, but a
// grounds ticket alone will NOT get you in.
// The daily graphics print START TIMES ONLY — but the coloured block behind each name
// is drawn to scale, so its height IS the duration. End times below are MEASURED from
// that geometry: every block on all nine graphics was located by scanning its stage
// column for runs of non-background pixels, the pixel-to-minute scale was fitted by
// least squares against the start times printed on the same graphic, and each block’s
// bottom edge was read off and rounded to five minutes. Fit residuals are under two
// minutes per day. Where a column’s block count did not match its label count the end
// falls back to the earlier of the next set and a 75-minute slot; those are the
// minority and are called out in the PR gate output.
// Ten stages are rendered — the ones the daily music grid prints. summerfest.com’s stage
// filter also lists Gruber Law Offices SportsZone, Lasso Lounge, Northwestern Mutual
// Community Park and the Pickleball Village; those are activity areas, not music stages
// on the daily grid, and are omitted (EDC "stages we don’t render" precedent).
// Several acts legitimately appear twice in a day — an AmFam House acoustic session plus
// a full set later, or two beer-garden sets at Johnsonville Summerville. Not duplicates.
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
// Round-trip residual for this festival: 0.070 grid units (~0.3 m),
// which is entirely the cost of printing x/y to one decimal for readability.
(function () {
  "use strict";

  const STAGES = [
    { id: "amph",         name: "AmFam Amphitheater", short: "AMP", color: "#e85d2e",
      x: 53.5, y: 90.4, size: 1.7, desc: "American Family Insurance Amphitheater · separately ticketed",
      vibe: "The Big Room", vibeNote: "23,000 seats at the south end. A separate ticket gets you in — and that ticket also gets you the grounds all day.", peak: "19:00–23:00" },
    { id: "bmo",          name: "BMO Pavilion", short: "BMO", color: "#38bdf8",
      x: 70, y: 75.8, size: 1.3, desc: "Lakeside · covered pavilion",
      vibe: "Roof Over Your Head", vibeNote: "Covered, lakeside, and the sound bounces perfectly. Milwaukee's rain plan.", peak: "19:00–23:00" },
    { id: "briggs",       name: "Big Backyard", short: "BACKYARD", color: "#22c55e",
      x: 23.2, y: 64, size: 1.2, desc: "Briggs & Stratton Big Backyard · indie + singer-songwriter",
      vibe: "Lawn Chair Country", vibeNote: "Bring a blanket. The Backyard is where you sit down for an hour and end up staying three.", peak: "18:00–23:00" },
    { id: "generac",      name: "Generac Power Stage", short: "GENERAC", color: "#a855f7",
      x: 23.3, y: 51.1, size: 1.25, desc: "Mid-grounds · rock + alt",
      vibe: "Loud and Central", vibeNote: "Right in the middle of the grounds, so half the park hears it whether they meant to or not.", peak: "19:00–23:00" },
    { id: "miller",       name: "Miller Lite Oasis", short: "OASIS", color: "#f97316",
      x: 19.7, y: 40.4, size: 1.3, desc: "West · punk, ska, heavy",
      vibe: "The Pit", vibeNote: "Summerfest's rowdiest room. If a band still has a mosh pit in 2026, it plays the Oasis.", peak: "20:00–24:00" },
    { id: "aurora",       name: "Aurora Pavilion", short: "AURORA", color: "#14b8a6",
      x: 40.5, y: 26.8, size: 1, desc: "North · world, jazz, local showcase",
      vibe: "Milwaukee's Room", vibeNote: "Rockonsin winners, mariachi, jazz, the Opera. The stage that actually sounds like the city.", peak: "17:00–22:00" },
    { id: "tmobile",      name: "T-Mobile Stage", short: "T-MOBILE", color: "#ec4899",
      x: 48.5, y: 17.8, size: 1.15, desc: "North · pop + hip-hop",
      vibe: "Chart Stage", vibeNote: "Newest names on the bill, tightest turnaround. Sets every two hours on the dot.", peak: "20:00–24:00" },
    { id: "uline",        name: "Uline Warehouse", short: "ULINE", color: "#2563eb",
      x: 42.7, y: 8.8, size: 1.2, desc: "North gate · classic rock + legacy",
      vibe: "Legacy Acts", vibeNote: "Gin Blossoms, Little Feat, Gene Simmons. The Warehouse books the bands your parents saw first.", peak: "19:00–23:00" },
    { id: "johnsonville", name: "Summerville", short: "SUMMERVILLE", color: "#facc15",
      x: 29, y: 13.1, size: 0.85, desc: "Johnsonville Summerville · beer garden, repeat sets",
      vibe: "Beer Garden Blues", vibeNote: "Two sets a night from the same band, brats in hand. Nobody is in a hurry here.", peak: "17:00–21:00" },
    { id: "amfamhouse",   name: "AmFam House", short: "HOUSE", color: "#64748b",
      x: 36.7, y: 56, size: 0.75, desc: "American Family Insurance House Stage · acoustic sessions",
      vibe: "Stripped Back", vibeNote: "Short acoustic sets and Q&As from acts playing the big stages later. Twenty minutes, no band.", peak: "14:00–18:00" },
  ];

  const AMENITIES = [
    { id: "summerfest1", type: "med", label: "First Aid Station", x: 39.5, y: 69 },  // OSM
    { id: "summerfest2", type: "med", label: "First Aid", x: 14.8, y: 48.8 },  // OSM
    { id: "summerfest3", type: "info", label: "Police / Lost & Found", x: 20, y: 56.7 },  // OSM
    { id: "summerfest4", type: "info", label: "Event Tickets", x: 22.8, y: 33 },  // OSM
    { id: "summerfest5", type: "water", label: "Bo Black Family Fountain", x: 33.2, y: 31.2 },  // OSM
    { id: "summerfest6", type: "water", label: "Hydration Station", x: 30, y: 62 },
    { id: "summerfest7", type: "water", label: "Hydration Station", x: 33.3, y: 22 },
    { id: "summerfest8", type: "toilet", label: "Restrooms", x: 30, y: 67 },
    { id: "summerfest9", type: "toilet", label: "Restrooms", x: 31.7, y: 37 },
    { id: "summerfest10", type: "toilet", label: "Restrooms", x: 40, y: 14 },
    { id: "summerfest11", type: "food", label: "Big Gig BBQ", x: 26.7, y: 28.3 },  // OSM
    { id: "summerfest12", type: "food", label: "JoJo's Martini Lounge", x: 48.8, y: 80.2 },  // OSM
    { id: "summerfest13", type: "art", label: "Arts & Crafts Market", x: 37, y: 60.1 },  // OSM
    { id: "summerfest14", type: "art", label: "Wheel in the Sky", x: 46.8, y: 70.4 },  // OSM
    { id: "summerfest15", type: "art", label: "Skyglider", x: 32.7, y: 42.6 },  // OSM
    { id: "summerfest16", type: "charge", label: "Charging — Mid Gate", x: 24.8, y: 31 },
    { id: "summerfest17", type: "charge", label: "Charging — South Gate", x: 11.5, y: 71.4 },
  ];

  // tier: 3 = headline slot (21:00+), 2 = prime (18:00–20:59), 1 = earlier.
  const mk = (id, name, genre, stage, day, start, end) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 21 || h < 6 ? 3 : h >= 18 ? 2 : 1;
    return { id, name, genre, country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #1a0a28)`,
      bio: `Played Summerfest 2026.` };
  };

  const ARTISTS = [
    // ─────────── DAY 1 · Thursday Jun 18 ───────────
    // AmFam Amphitheater
    mk("su1",    "Solon Holt",                                        "—",                   "amph",          1, "18:30", "19:20"),
    mk("su2",    "JP Saxe",                                           "Pop",                 "amph",          1, "19:30", "20:35"),
    mk("su3",    "Megan Moroney",                                     "Country",             "amph",          1, "20:45", "22:25"),
    // BMO Pavilion
    mk("su4",    "Dannyboy",                                          "—",                   "bmo",           1, "19:15", "20:20"),
    mk("su5",    "Charlie Wilson",                                    "—",                   "bmo",           1, "22:00", "23:30"),
    // Big Backyard
    mk("su6",    "Saint Blonde",                                      "—",                   "briggs",        1, "13:00", "13:45"),
    mk("su7",    "Avery Cochrane",                                    "—",                   "briggs",        1, "14:30", "15:20"),
    mk("su8",    "Tigernite",                                         "—",                   "briggs",        1, "16:00", "17:05"),
    mk("su9",    "Morgan St. Jean",                                   "—",                   "briggs",        1, "18:00", "19:05"),
    mk("su10",   "Dora Jar",                                          "Rock",                "briggs",        1, "20:00", "21:05"),
    mk("su11",   "Holly Humberstone",                                 "Pop",                 "briggs",        1, "22:00", "23:30"),
    // Generac Power Stage
    mk("su12",   "Scott E. Berendt & The US Project",                 "—",                   "generac",       1, "14:00", "14:50"),
    mk("su13",   "Circa 79",                                          "—",                   "generac",       1, "15:30", "16:35"),
    mk("su14",   "The Dream Syndicate",                               "Rock",                "generac",       1, "17:30", "18:35"),
    mk("su15",   "Modern English",                                    "Rock",                "generac",       1, "19:30", "20:35"),
    mk("su16",   "Echo & The Bunnymen",                               "Rock",                "generac",       1, "22:00", "23:30"),
    // Miller Lite Oasis
    mk("su17",   "Bowling Shoes",                                     "—",                   "miller",        1, "13:15", "14:05"),
    mk("su18",   "Mari",                                              "—",                   "miller",        1, "14:45", "15:35"),
    mk("su19",   "City of the Sun",                                   "—",                   "miller",        1, "16:30", "17:35"),
    mk("su20",   "Nicholas Tremulis & The Prodigals",                 "—",                   "miller",        1, "18:30", "19:35"),
    mk("su21",   "Hunny",                                             "Rock",                "miller",        1, "20:30", "21:35"),
    mk("su22",   "Tash Sultana",                                      "Rock",                "miller",        1, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su23",   "MKE Live Groove: Summerfest Edition",               "Youth Showcase",      "aurora",        1, "12:00", "13:50"),
    mk("su24",   "Stephan Jenkins of Third Eye Blind",                "Rock",                "aurora",        1, "14:00", "15:05"),
    mk("su25",   "Summerfest Opening Ceremonies",                     "Youth Showcase",      "aurora",        1, "18:00", "18:45"),
    mk("su26",   "Alejandro Escovedo",                                "Rock",                "aurora",        1, "19:00", "20:05"),
    mk("su27",   "DJ B-Lee",                                          "—",                   "aurora",        1, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su28",   "Micah Emrich",                                      "—",                   "tmobile",       1, "14:30", "15:20"),
    mk("su29",   "Maximiano",                                         "—",                   "tmobile",       1, "16:15", "17:20"),
    mk("su30",   "Venus & The Flytraps",                              "—",                   "tmobile",       1, "18:15", "19:25"),
    mk("su31",   "Marlon Funaki",                                     "—",                   "tmobile",       1, "20:15", "21:20"),
    mk("su32",   "Passion Pit",                                       "—",                   "tmobile",       1, "22:15", "23:50"),
    // Uline Warehouse
    mk("su33",   "Barely Civil",                                      "—",                   "uline",         1, "12:30", "13:15"),
    mk("su34",   "Supertaste",                                        "—",                   "uline",         1, "14:00", "14:45"),
    mk("su35",   "Post Sex Nachos",                                   "—",                   "uline",         1, "15:30", "16:35"),
    mk("su36",   "Taylor Acorn",                                      "—",                   "uline",         1, "17:30", "18:35"),
    mk("su37",   "The Bends",                                         "—",                   "uline",         1, "19:30", "20:35"),
    mk("su38",   "Third Eye Blind",                                   "Rock",                "uline",         1, "22:00", "23:30"),
    // Summerville
    mk("su39",   "Blues Disciples",                                   "Jazz / Blues",        "johnsonville",  1, "12:00", "13:05"),
    mk("su40",   "The Mighty Ms. Erica And the Sound Production",     "—",                   "johnsonville",  1, "13:45", "14:50"),
    mk("su41",   "The Mighty Ms. Erica And the Sound Production",     "—",                   "johnsonville",  1, "15:30", "16:35"),
    mk("su42",   "5 Card Studs",                                      "—",                   "johnsonville",  1, "17:30", "18:35"),
    mk("su43",   "5 Card Studs",                                      "—",                   "johnsonville",  1, "19:30", "20:35"),
    // AmFam House
    mk("su44",   "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    1, "12:00", "13:05"),
    mk("su45",   "Stephan Jenkins of Third Eye Blind",                "Rock",                "amfamhouse",    1, "14:00", "15:05"),
    mk("su46",   "Passion Pit",                                       "Acoustic Session",    "amfamhouse",    1, "16:00", "17:05"),
    mk("su47",   "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    1, "18:00", "19:00"),
    // ─────────── DAY 2 · Friday Jun 19 ───────────
    // AmFam Amphitheater
    mk("su48",   "Don Toliver with SahBabii, SoFaygo, Che, Lelo, Chase B, and sosocamo", "—",                   "amph",          2, "19:00", "22:45"),
    // BMO Pavilion
    mk("su49",   "The Lovemonkeys",                                   "—",                   "bmo",           2, "17:30", "18:35"),
    mk("su50",   "Aldo Nova",                                         "Rock",                "bmo",           2, "19:15", "20:20"),
    mk("su51",   "Styx",                                              "Rock",                "bmo",           2, "21:00", "22:30"),
    // Big Backyard
    mk("su52",   "Phil Wittliff",                                     "—",                   "briggs",        2, "13:00", "13:50"),
    mk("su53",   "Brady Lee",                                         "—",                   "briggs",        2, "14:30", "15:15"),
    mk("su54",   "Colin Lynch",                                       "—",                   "briggs",        2, "16:00", "17:05"),
    mk("su55",   "Steph Strings",                                     "—",                   "briggs",        2, "18:00", "19:05"),
    mk("su56",   "Adrien Nunez",                                      "—",                   "briggs",        2, "20:00", "21:05"),
    mk("su57",   "Cameron Whitcomb",                                  "—",                   "briggs",        2, "22:00", "23:30"),
    // Generac Power Stage
    mk("su58",   "flowersatherfeet",                                  "—",                   "generac",       2, "12:30", "13:20"),
    mk("su59",   "Initiate",                                          "—",                   "generac",       2, "14:00", "14:45"),
    mk("su60",   "Sleepy Gaucho",                                     "—",                   "generac",       2, "15:30", "16:35"),
    mk("su61",   "Deer Tick",                                         "Rock",                "generac",       2, "17:30", "18:35"),
    mk("su62",   "Evan Honer",                                        "—",                   "generac",       2, "19:30", "20:35"),
    mk("su63",   "Father John Misty",                                 "Rock",                "generac",       2, "21:30", "23:05"),
    // Miller Lite Oasis
    mk("su64",   "From Ashes to Embers",                              "—",                   "miller",        2, "13:15", "14:00"),
    mk("su65",   "Current Comfort",                                   "—",                   "miller",        2, "14:45", "15:35"),
    mk("su66",   "Vial",                                              "Punk / Hardcore",     "miller",        2, "16:30", "17:35"),
    mk("su67",   "Panic Shack",                                       "Punk / Hardcore",     "miller",        2, "18:30", "19:35"),
    mk("su68",   "NOBRO",                                             "Punk / Hardcore",     "miller",        2, "20:30", "22:00"),
    mk("su69",   "Amyl and the Sniffers",                             "Punk / Hardcore",     "miller",        2, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su70",   "Rockonsin",                                         "Youth Showcase",      "aurora",        2, "12:15", "14:35"),
    mk("su71",   "Ben Mulwana",                                       "—",                   "aurora",        2, "15:15", "16:05"),
    mk("su72",   "JazzMen",                                           "Jazz / Blues",        "aurora",        2, "16:30", "17:20"),
    mk("su73",   "Chris Crain",                                       "—",                   "aurora",        2, "17:45", "18:30"),
    mk("su74",   "The Family Stone",                                  "Rock",                "aurora",        2, "19:00", "20:05"),
    mk("su75",   "Nico At Nite",                                      "—",                   "aurora",        2, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su76",   "Amy Lowe & King Katz",                              "—",                   "tmobile",       2, "12:45", "13:30"),
    mk("su77",   "Queen Drie",                                        "—",                   "tmobile",       2, "14:30", "15:15"),
    mk("su78",   "Troy Tyler",                                        "—",                   "tmobile",       2, "16:15", "17:20"),
    mk("su79",   "Emmitt James",                                      "—",                   "tmobile",       2, "18:15", "19:20"),
    mk("su80",   "FEE$",                                              "—",                   "tmobile",       2, "20:15", "21:20"),
    mk("su81",   "Tyrese",                                            "Hip-Hop",             "tmobile",       2, "22:15", "23:45"),
    // Uline Warehouse
    mk("su82",   "FieldHockey",                                       "—",                   "uline",         2, "13:45", "14:50"),
    mk("su83",   "Tiny Voices",                                       "—",                   "uline",         2, "15:30", "16:35"),
    mk("su84",   "Red Jumpsuit Apparatus",                            "Punk / Hardcore",     "uline",         2, "17:30", "18:35"),
    mk("su85",   "State Champs",                                      "Punk / Hardcore",     "uline",         2, "19:30", "20:35"),
    mk("su86",   "Hot Mulligan",                                      "Punk / Hardcore",     "uline",         2, "21:30", "23:00"),
    // Summerville
    mk("su87",   "John Kocher",                                       "—",                   "johnsonville",  2, "12:00", "13:05"),
    mk("su88",   "Hot & Dirty Brass Band",                            "Jazz / Blues",        "johnsonville",  2, "13:45", "14:50"),
    mk("su89",   "Hot & Dirty Brass Band",                            "Jazz / Blues",        "johnsonville",  2, "15:30", "16:35"),
    mk("su90",   "Mrs. Fun",                                          "Jazz / Blues",        "johnsonville",  2, "17:30", "18:35"),
    mk("su91",   "Mrs. Fun",                                          "Jazz / Blues",        "johnsonville",  2, "19:30", "20:35"),
    // AmFam House
    mk("su92",   "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    2, "12:00", "13:15"),
    mk("su93",   "State Champs",                                      "Punk / Hardcore",     "amfamhouse",    2, "14:00", "15:15"),
    mk("su94",   "Evan Honer",                                        "Acoustic Session",    "amfamhouse",    2, "16:00", "17:15"),
    mk("su95",   "Hot Mulligan",                                      "Punk / Hardcore",     "amfamhouse",    2, "18:00", "19:00"),
    mk("su96",   "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    2, "19:00", "20:30"),
    // ─────────── DAY 3 · Saturday Jun 20 ───────────
    // AmFam Amphitheater
    mk("su97",   "Carín León",                                        "Country",             "amph",          3, "19:00", "20:40"),
    // BMO Pavilion
    mk("su98",   "Substitutes: Tales From The Who",                   "Rock",                "bmo",           3, "17:30", "18:35"),
    mk("su99",   "Kirstie Kraus",                                     "—",                   "bmo",           3, "19:15", "20:20"),
    mk("su100",  "David Lee Roth",                                    "Rock",                "bmo",           3, "21:00", "22:30"),
    // Big Backyard
    mk("su101",  "Sarah Krohn",                                       "—",                   "briggs",        3, "13:00", "13:50"),
    mk("su102",  "Noah Richardson",                                   "—",                   "briggs",        3, "14:30", "15:15"),
    mk("su103",  "SM6",                                               "—",                   "briggs",        3, "16:00", "17:05"),
    mk("su104",  "GRAHAM",                                            "—",                   "briggs",        3, "18:00", "19:05"),
    mk("su105",  "Weston Estate",                                     "—",                   "briggs",        3, "20:00", "21:05"),
    mk("su106",  "Connor Price",                                      "—",                   "briggs",        3, "22:00", "23:30"),
    // Generac Power Stage
    mk("su107",  "The Band Solstice",                                 "—",                   "generac",       3, "12:30", "13:15"),
    mk("su108",  "Tobacco Road",                                      "—",                   "generac",       3, "14:00", "14:45"),
    mk("su109",  "Old Mervs",                                         "—",                   "generac",       3, "15:30", "16:35"),
    mk("su110",  "Winyah",                                            "—",                   "generac",       3, "17:30", "18:35"),
    mk("su111",  "Penelope Road",                                     "—",                   "generac",       3, "19:30", "20:35"),
    mk("su112",  "flipturn",                                          "—",                   "generac",       3, "21:30", "23:00"),
    // Miller Lite Oasis
    mk("su113",  "IDKCONUNDRUM",                                      "—",                   "miller",        3, "13:15", "14:05"),
    mk("su114",  "American Progress",                                 "—",                   "miller",        3, "14:45", "15:35"),
    mk("su115",  "Colin Bracewell",                                   "—",                   "miller",        3, "16:30", "17:35"),
    mk("su116",  "The Juliana Theory",                                "Punk / Hardcore",     "miller",        3, "18:30", "19:35"),
    mk("su117",  "Braid",                                             "Punk / Hardcore",     "miller",        3, "20:30", "21:35"),
    mk("su118",  "The Academy Is...",                                 "Punk / Hardcore",     "miller",        3, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su119",  "Rockonsin",                                         "Youth Showcase",      "aurora",        3, "12:15", "14:30"),
    mk("su120",  "Cigarettes @ Sunset",                               "—",                   "aurora",        3, "15:15", "16:05"),
    mk("su121",  "Altered By Mom",                                    "—",                   "aurora",        3, "16:30", "17:15"),
    mk("su122",  "Red Leather",                                       "—",                   "aurora",        3, "17:45", "18:30"),
    mk("su123",  "Dexter And The Moonrocks",                          "—",                   "aurora",        3, "19:00", "20:05"),
    mk("su124",  "Aspen",                                             "—",                   "aurora",        3, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su125",  "Lauren Gottshall",                                  "—",                   "tmobile",       3, "12:45", "13:35"),
    mk("su126",  "Will Terry",                                        "—",                   "tmobile",       3, "14:30", "15:20"),
    mk("su127",  "Landon Wilks",                                      "—",                   "tmobile",       3, "16:15", "17:20"),
    mk("su128",  "Scott Wolverton",                                   "—",                   "tmobile",       3, "18:15", "19:20"),
    mk("su129",  "McCoy Moore",                                       "—",                   "tmobile",       3, "20:15", "21:20"),
    mk("su130",  "Nate Smith",                                        "Country",             "tmobile",       3, "22:15", "23:50"),
    // Uline Warehouse
    mk("su131",  "Milly & The Mayhem",                                "—",                   "uline",         3, "12:30", "13:15"),
    mk("su132",  "Kenneth Brian Band",                                "—",                   "uline",         3, "14:00", "14:45"),
    mk("su133",  "A.J. Croce",                                        "Jazz / Blues",        "uline",         3, "15:30", "16:35"),
    mk("su134",  "Trapper Schoepp",                                   "Country",             "uline",         3, "17:30", "18:35"),
    mk("su135",  "Don Felder",                                        "Rock",                "uline",         3, "19:30", "20:35"),
    mk("su136",  "Christopher Cross",                                 "Rock",                "uline",         3, "21:30", "23:00"),
    // Summerville
    mk("su137",  "Daniel Nathan Electracoustic",                      "—",                   "johnsonville",  3, "12:00", "13:05"),
    mk("su138",  "Divas & Jazz",                                      "Jazz / Blues",        "johnsonville",  3, "13:45", "14:50"),
    mk("su139",  "Divas & Jazz",                                      "Jazz / Blues",        "johnsonville",  3, "15:30", "16:35"),
    mk("su140",  "Dan Kolesari",                                      "—",                   "johnsonville",  3, "17:30", "18:35"),
    mk("su141",  "Dan Kolesari",                                      "—",                   "johnsonville",  3, "19:30", "20:35"),
    // AmFam House
    mk("su142",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    3, "12:00", "13:05"),
    mk("su143",  "flipturn",                                          "Acoustic Session",    "amfamhouse",    3, "14:00", "15:05"),
    mk("su144",  "Weston Estate",                                     "Acoustic Session",    "amfamhouse",    3, "16:00", "17:05"),
    mk("su145",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    3, "18:00", "19:05"),
    // ─────────── DAY 4 · Thursday Jun 25 ───────────
    // AmFam Amphitheater
    mk("su146",  "Aaron Rowe",                                        "—",                   "amph",          4, "19:30", "20:00"),
    mk("su147",  "Myles Smith",                                       "Pop",                 "amph",          4, "20:00", "21:15"),
    mk("su148",  "Ed Sheeran",                                        "Pop",                 "amph",          4, "21:15", "22:45"),
    // BMO Pavilion
    mk("su149",  "Big Daddy Kane",                                    "Hip-Hop",             "bmo",           4, "17:30", "18:35"),
    mk("su150",  "Gabriel Jacoby",                                    "—",                   "bmo",           4, "19:15", "20:15"),
    mk("su151",  "Common",                                            "Hip-Hop",             "bmo",           4, "21:00", "22:35"),
    // Big Backyard
    mk("su152",  "School of Rock",                                    "Youth Showcase",      "briggs",        4, "12:00", "15:50"),
    mk("su153",  "Robert Randolph & The Family Band",                 "Rock",                "briggs",        4, "16:30", "17:35"),
    mk("su154",  "The Handcuffs",                                     "—",                   "briggs",        4, "18:30", "19:35"),
    mk("su155",  "Sincere Engineer",                                  "Punk / Hardcore",     "briggs",        4, "20:30", "21:35"),
    mk("su156",  "Kim Gordon",                                        "Rock",                "briggs",        4, "22:30", "00:00"),
    // Generac Power Stage
    mk("su157",  "School of Rock",                                    "Youth Showcase",      "generac",       4, "12:00", "15:50"),
    mk("su158",  "Booker T. Jones",                                   "Jazz / Blues",        "generac",       4, "16:15", "17:20"),
    mk("su159",  "Pat McCurdy",                                       "Comedy",              "generac",       4, "17:45", "18:55"),
    mk("su160",  "Grabbitz",                                          "—",                   "generac",       4, "20:00", "21:05"),
    mk("su161",  "Subtronics",                                        "Electronic",          "generac",       4, "22:00", "23:30"),
    // Miller Lite Oasis
    mk("su162",  "OUTDrejas",                                         "—",                   "miller",        4, "13:15", "14:05"),
    mk("su163",  "Chrystal Gales",                                    "—",                   "miller",        4, "14:45", "15:35"),
    mk("su164",  "Vertical Horizon",                                  "Rock",                "miller",        4, "16:30", "17:35"),
    mk("su165",  "Porch Light",                                       "—",                   "miller",        4, "18:30", "19:35"),
    mk("su166",  "Hazlett",                                           "—",                   "miller",        4, "20:30", "21:35"),
    mk("su167",  "Kaleo",                                             "Rock",                "miller",        4, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su168",  "School of Rock",                                    "Youth Showcase",      "aurora",        4, "12:00", "15:50"),
    mk("su169",  "Abby Moeller",                                      "—",                   "aurora",        4, "16:30", "17:15"),
    mk("su170",  "Boy Golden",                                        "—",                   "aurora",        4, "17:45", "18:30"),
    mk("su171",  "The Mountain Goats",                                "Rock",                "aurora",        4, "19:00", "20:05"),
    mk("su172",  "DJ Gemini Gilly",                                   "—",                   "aurora",        4, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su173",  "School of Rock",                                    "Youth Showcase",      "tmobile",       4, "12:00", "15:50"),
    mk("su174",  "Wire & Nail",                                       "—",                   "tmobile",       4, "16:15", "16:55"),
    mk("su175",  "Old 97's",                                          "Rock",                "tmobile",       4, "17:15", "18:25"),
    mk("su176",  "Elijah Scott",                                      "—",                   "tmobile",       4, "18:45", "19:50"),
    mk("su177",  "Lanie Gardner",                                     "Country",             "tmobile",       4, "20:15", "21:20"),
    mk("su178",  "Tucker Wetmore",                                    "Country",             "tmobile",       4, "22:15", "23:45"),
    // Uline Warehouse
    mk("su179",  "School of Rock",                                    "Youth Showcase",      "uline",         4, "12:00", "15:50"),
    mk("su180",  "10,000 Maniacs",                                    "Rock",                "uline",         4, "16:15", "17:20"),
    mk("su181",  "Lisa Loeb",                                         "Rock",                "uline",         4, "17:45", "18:50"),
    mk("su182",  "Walk Off The Earth",                                "—",                   "uline",         4, "19:30", "20:35"),
    mk("su183",  "Halestorm",                                         "Rock",                "uline",         4, "21:30", "23:05"),
    // Summerville
    mk("su184",  "Jimmy Ray & The Hipsters",                          "—",                   "johnsonville",  4, "12:00", "13:05"),
    mk("su185",  "Ghosts in the Gravel",                              "—",                   "johnsonville",  4, "13:45", "14:50"),
    mk("su186",  "Ghosts in the Gravel",                              "—",                   "johnsonville",  4, "15:30", "16:40"),
    mk("su187",  "The Terry Sims Band",                               "—",                   "johnsonville",  4, "17:30", "18:35"),
    mk("su188",  "The Terry Sims Band",                               "—",                   "johnsonville",  4, "19:30", "20:35"),
    // AmFam House
    mk("su189",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    4, "12:00", "13:05"),
    mk("su190",  "Walk Off The Earth",                                "Acoustic Session",    "amfamhouse",    4, "14:00", "15:05"),
    mk("su191",  "Gabriel Jacoby",                                    "Acoustic Session",    "amfamhouse",    4, "16:00", "17:05"),
    mk("su192",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    4, "18:00", "19:05"),
    // ─────────── DAY 5 · Friday Jun 26 ───────────
    // AmFam Amphitheater
    mk("su193",  "Jessie Murph",                                      "Country",             "amph",          5, "19:00", "20:05"),
    mk("su194",  "Cody Johnson",                                      "Country",             "amph",          5, "20:30", "21:50"),
    // BMO Pavilion
    mk("su195",  "Alex Sampson",                                      "—",                   "bmo",           5, "17:30", "18:35"),
    mk("su196",  "The Aces",                                          "—",                   "bmo",           5, "19:15", "20:20"),
    mk("su197",  "Louis Tomlinson",                                   "Pop",                 "bmo",           5, "21:00", "22:30"),
    // Big Backyard
    mk("su198",  "School of Rock",                                    "Youth Showcase",      "briggs",        5, "12:00", "15:35"),
    mk("su199",  "Blonde",                                            "—",                   "briggs",        5, "16:30", "17:35"),
    mk("su200",  "KSP",                                               "—",                   "briggs",        5, "18:15", "19:20"),
    mk("su201",  "Henrik",                                            "—",                   "briggs",        5, "20:00", "21:05"),
    mk("su202",  "Petey USA",                                         "—",                   "briggs",        5, "22:00", "23:30"),
    // Generac Power Stage
    mk("su203",  "School of Rock",                                    "Youth Showcase",      "generac",       5, "12:00", "15:35"),
    mk("su204",  "7th Heaven",                                        "Rock",                "generac",       5, "16:15", "17:20"),
    mk("su205",  "Bobby Friss",                                       "—",                   "generac",       5, "17:45", "18:50"),
    mk("su206",  "Big Wild",                                          "Electronic",          "generac",       5, "19:30", "20:40"),
    mk("su207",  "Elderbrook",                                        "Electronic",          "generac",       5, "21:30", "23:05"),
    // Miller Lite Oasis
    mk("su208",  "Guardrail",                                         "—",                   "miller",        5, "13:15", "14:05"),
    mk("su209",  "Harrison Gordon",                                   "—",                   "miller",        5, "14:45", "15:35"),
    mk("su210",  "Lake Drive",                                        "—",                   "miller",        5, "16:30", "17:35"),
    mk("su211",  "Showoff",                                           "Punk / Hardcore",     "miller",        5, "18:30", "19:35"),
    mk("su212",  "Lucky Boys Confusion",                              "Punk / Hardcore",     "miller",        5, "20:30", "21:35"),
    mk("su213",  "Goldfinger",                                        "Punk / Hardcore",     "miller",        5, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su214",  "School of Rock",                                    "Youth Showcase",      "aurora",        5, "12:00", "15:35"),
    mk("su215",  "Siobhan Bodrug",                                    "—",                   "aurora",        5, "16:30", "17:20"),
    mk("su216",  "Harper O'Neill",                                    "—",                   "aurora",        5, "17:45", "18:30"),
    mk("su217",  "Sudan Archives",                                    "—",                   "aurora",        5, "19:00", "20:05"),
    mk("su218",  "Mr. New York",                                      "—",                   "aurora",        5, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su219",  "School of Rock",                                    "Youth Showcase",      "tmobile",       5, "12:00", "15:35"),
    mk("su220",  "Sugo",                                              "—",                   "tmobile",       5, "16:15", "17:20"),
    mk("su221",  "Greg Koch & The Koch Marshall Trio",                "—",                   "tmobile",       5, "18:15", "19:20"),
    mk("su222",  "The Band Loula",                                    "—",                   "tmobile",       5, "20:15", "21:25"),
    mk("su223",  "Marcus King Band",                                  "—",                   "tmobile",       5, "22:15", "23:45"),
    // Uline Warehouse
    mk("su224",  "School of Rock",                                    "Youth Showcase",      "uline",         5, "12:00", "15:35"),
    mk("su225",  "Sons Of The Silent Age",                            "Rock",                "uline",         5, "16:15", "17:20"),
    mk("su226",  "Two Feet",                                          "Rock",                "uline",         5, "17:45", "18:50"),
    mk("su227",  "Grouplove",                                         "Rock",                "uline",         5, "19:30", "20:35"),
    mk("su228",  "The Revivalists",                                   "Rock",                "uline",         5, "21:30", "23:00"),
    // Summerville
    mk("su229",  "Allison Mahal",                                     "—",                   "johnsonville",  5, "12:00", "13:05"),
    mk("su230",  "Danny Miller Band",                                 "—",                   "johnsonville",  5, "13:45", "14:50"),
    mk("su231",  "Danny Miller Band",                                 "—",                   "johnsonville",  5, "15:30", "16:35"),
    mk("su232",  "Testing Floor",                                     "—",                   "johnsonville",  5, "17:30", "18:35"),
    mk("su233",  "Testing Floor",                                     "—",                   "johnsonville",  5, "19:30", "20:35"),
    // AmFam House
    mk("su234",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    5, "12:00", "13:05"),
    mk("su235",  "Grouplove",                                         "Rock",                "amfamhouse",    5, "14:00", "15:05"),
    mk("su236",  "David Shaw and Zack Feinberg of the Revivalists",   "Acoustic Session",    "amfamhouse",    5, "16:00", "17:05"),
    mk("su237",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    5, "18:00", "19:05"),
    // ─────────── DAY 6 · Saturday Jun 27 ───────────
    // AmFam Amphitheater
    mk("su238",  "Carter Faith",                                      "Country",             "amph",          6, "19:00", "19:50"),
    mk("su239",  "Post Malone",                                       "Country",             "amph",          6, "20:30", "21:50"),
    // BMO Pavilion
    mk("su240",  "Alyssia Dominguez",                                 "—",                   "bmo",           6, "17:00", "18:05"),
    mk("su241",  "Alannah McCready",                                  "—",                   "bmo",           6, "18:30", "19:35"),
    mk("su242",  "Dylan Schneider",                                   "Country",             "bmo",           6, "20:15", "21:20"),
    mk("su243",  "Russell Dickerson",                                 "Country",             "bmo",           6, "22:00", "23:30"),
    // Big Backyard
    mk("su244",  "Alley Eyes",                                        "—",                   "briggs",        6, "12:00", "12:50"),
    mk("su245",  "Fuzzysurf",                                         "—",                   "briggs",        6, "13:15", "14:05"),
    mk("su246",  "Cardinal Bloom",                                    "—",                   "briggs",        6, "14:30", "15:20"),
    mk("su247",  "Modern Alibi",                                      "—",                   "briggs",        6, "16:00", "17:05"),
    mk("su248",  "Taz",                                               "—",                   "briggs",        6, "18:00", "19:05"),
    mk("su249",  "PawPaw Rod",                                        "—",                   "briggs",        6, "20:00", "21:05"),
    mk("su250",  "BØRNS",                                             "Rock",                "briggs",        6, "22:00", "23:30"),
    // Generac Power Stage
    mk("su251",  "MUSIC6S for Veterans & First Responders",           "Youth Showcase",      "generac",       6, "12:00", "15:05"),
    mk("su252",  "Chris Koster",                                      "—",                   "generac",       6, "15:30", "16:35"),
    mk("su253",  "Jean Dawson",                                       "—",                   "generac",       6, "17:30", "18:35"),
    mk("su254",  "King Buffalo",                                      "Rock",                "generac",       6, "19:30", "20:35"),
    mk("su255",  "Wolfmother",                                        "Rock",                "generac",       6, "21:30", "23:05"),
    // Miller Lite Oasis
    mk("su256",  "In The Know",                                       "—",                   "miller",        6, "13:15", "14:05"),
    mk("su257",  "King Solomon",                                      "—",                   "miller",        6, "14:45", "15:35"),
    mk("su258",  "Left on Sunset",                                    "—",                   "miller",        6, "16:30", "17:35"),
    mk("su259",  "The Expendables",                                   "Reggae / Dancehall",  "miller",        6, "18:30", "19:35"),
    mk("su260",  "The Movement",                                      "Reggae / Dancehall",  "miller",        6, "20:30", "21:35"),
    mk("su261",  "Pepper",                                            "Reggae / Dancehall",  "miller",        6, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su262",  "Tempo Dance Co.",                                   "Youth Showcase",      "aurora",        6, "12:00", "14:40"),
    mk("su263",  "DJ Andres",                                         "—",                   "aurora",        6, "14:45", "15:20"),
    mk("su264",  "Jazzteca",                                          "Latin",               "aurora",        6, "15:15", "16:10"),
    mk("su265",  "Orquesta Ayala",                                    "Latin",               "aurora",        6, "16:30", "17:15"),
    mk("su266",  "Junior Rivera",                                     "Latin",               "aurora",        6, "17:45", "18:40"),
    mk("su267",  "Mariachi Sol De Mexico",                            "Latin",               "aurora",        6, "19:00", "20:05"),
    mk("su268",  "DJ Don B",                                          "—",                   "aurora",        6, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su269",  "The Taxmen",                                        "—",                   "tmobile",       6, "12:45", "13:30"),
    mk("su270",  "Vincent Van Great",                                 "—",                   "tmobile",       6, "14:30", "15:35"),
    mk("su271",  "LAMB",                                              "—",                   "tmobile",       6, "16:15", "17:20"),
    mk("su272",  "Soulidified",                                       "—",                   "tmobile",       6, "18:15", "19:20"),
    mk("su273",  "Maris",                                             "—",                   "tmobile",       6, "20:15", "21:20"),
    mk("su274",  "Audrey Nuna",                                       "—",                   "tmobile",       6, "22:15", "23:45"),
    // Uline Warehouse
    mk("su275",  "The Noize",                                         "—",                   "uline",         6, "12:30", "13:15"),
    mk("su276",  "Haley Johnsen",                                     "—",                   "uline",         6, "14:00", "14:45"),
    mk("su277",  "Tracy Bonham",                                      "Rock",                "uline",         6, "15:30", "16:35"),
    mk("su278",  "Hank Azaria And The EZ Street Band",                "—",                   "uline",         6, "17:30", "18:35"),
    mk("su279",  "Freddy Jones Band",                                 "Rock",                "uline",         6, "19:30", "20:35"),
    mk("su280",  "Little Feat",                                       "Rock",                "uline",         6, "21:30", "23:00"),
    // Summerville
    mk("su281",  "Aubrey Marie",                                      "—",                   "johnsonville",  6, "12:00", "13:05"),
    mk("su282",  "Organissimo",                                       "Jazz / Blues",        "johnsonville",  6, "13:45", "14:50"),
    mk("su283",  "Organissimo",                                       "Jazz / Blues",        "johnsonville",  6, "15:30", "16:35"),
    mk("su284",  "The Hungry Williams",                               "Jazz / Blues",        "johnsonville",  6, "17:30", "18:35"),
    mk("su285",  "The Hungry Williams",                               "Jazz / Blues",        "johnsonville",  6, "19:30", "20:35"),
    // AmFam House
    mk("su286",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    6, "12:00", "13:05"),
    mk("su287",  "PawPaw Rod",                                        "Acoustic Session",    "amfamhouse",    6, "14:00", "15:05"),
    mk("su288",  "Dylan Schneider",                                   "Country",             "amfamhouse",    6, "16:00", "17:05"),
    mk("su289",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    6, "18:00", "19:05"),
    // ─────────── DAY 7 · Thursday Jul 2 ───────────
    // AmFam Amphitheater
    mk("su290",  "Temper City",                                       "—",                   "amph",          7, "19:00", "19:50"),
    mk("su291",  "Julia Wolf",                                        "Pop",                 "amph",          7, "20:00", "20:50"),
    mk("su292",  "Muse",                                              "Rock",                "amph",          7, "21:10", "22:50"),
    // BMO Pavilion
    mk("su293",  "*aya",                                              "—",                   "bmo",           7, "17:30", "18:35"),
    mk("su294",  "Lindsey Lomis",                                     "Pop",                 "bmo",           7, "19:15", "20:25"),
    mk("su295",  "Ella Mai",                                          "Pop",                 "bmo",           7, "21:00", "22:30"),
    // Big Backyard
    mk("su296",  "Buffchick",                                         "—",                   "briggs",        7, "13:00", "13:45"),
    mk("su297",  "Hell On Heels",                                     "—",                   "briggs",        7, "14:30", "15:20"),
    mk("su298",  "Hotel Fiction",                                     "Rock",                "briggs",        7, "16:00", "17:20"),
    mk("su299",  "Sunflower Bean",                                    "Rock",                "briggs",        7, "18:00", "19:10"),
    mk("su300",  "Blondshell",                                        "Rock",                "briggs",        7, "20:00", "21:05"),
    mk("su301",  "The Beths",                                         "Rock",                "briggs",        7, "22:00", "23:30"),
    // Generac Power Stage
    mk("su302",  "The President Kings",                               "—",                   "generac",       7, "12:30", "13:15"),
    mk("su303",  "Munroe",                                            "—",                   "generac",       7, "14:00", "14:45"),
    mk("su304",  "Scorched Waves",                                    "—",                   "generac",       7, "15:30", "16:35"),
    mk("su305",  "Living Colour",                                     "Rock",                "generac",       7, "17:30", "18:35"),
    mk("su306",  "Buckcherry",                                        "Rock",                "generac",       7, "19:30", "20:35"),
    mk("su307",  "Candlebox",                                         "Rock",                "generac",       7, "21:30", "23:00"),
    // Miller Lite Oasis
    mk("su308",  "Jonny T-Bird & The MP's",                           "—",                   "miller",        7, "12:30", "13:20"),
    mk("su309",  "Superfly",                                          "—",                   "miller",        7, "14:45", "15:30"),
    mk("su310",  "Breaking Cadence",                                  "—",                   "miller",        7, "16:30", "17:35"),
    mk("su311",  "El Sebas",                                          "—",                   "miller",        7, "18:30", "19:35"),
    mk("su312",  "Anees",                                             "Hip-Hop",             "miller",        7, "20:30", "21:35"),
    mk("su313",  "Sean Paul",                                         "Reggae / Dancehall",  "miller",        7, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su314",  "Florentine Opera Company",                          "Jazz / Blues",        "aurora",        7, "12:45", "15:00"),
    mk("su315",  "Kyle Ray",                                          "—",                   "aurora",        7, "15:15", "16:00"),
    mk("su316",  "Case Oats",                                         "Country",             "aurora",        7, "16:30", "17:15"),
    mk("su317",  "Jobi Riccio",                                       "—",                   "aurora",        7, "17:45", "18:30"),
    mk("su318",  "Matthew Hansen",                                    "—",                   "aurora",        7, "19:00", "20:05"),
    mk("su319",  "GIRLNEXTDOOR",                                      "—",                   "aurora",        7, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su320",  "Pretty Pity",                                       "—",                   "tmobile",       7, "12:45", "13:30"),
    mk("su321",  "Gold Steps",                                        "—",                   "tmobile",       7, "14:30", "15:15"),
    mk("su322",  "Flourescents",                                      "—",                   "tmobile",       7, "16:15", "17:20"),
    mk("su323",  "Girlfriends",                                       "—",                   "tmobile",       7, "18:15", "19:25"),
    mk("su324",  "KennyHoopla",                                       "Hip-Hop",             "tmobile",       7, "20:15", "21:20"),
    mk("su325",  "All Time Low",                                      "—",                   "tmobile",       7, "22:15", "23:45"),
    // Uline Warehouse
    mk("su326",  "Palm Ghosts",                                       "—",                   "uline",         7, "12:30", "13:15"),
    mk("su327",  "Outronaut",                                         "—",                   "uline",         7, "14:00", "14:45"),
    mk("su328",  "The Ocean Blue",                                    "Rock",                "uline",         7, "15:30", "16:35"),
    mk("su329",  "Sister Hazel",                                      "Rock",                "uline",         7, "17:30", "18:35"),
    mk("su330",  "Spin Doctors",                                      "Rock",                "uline",         7, "19:30", "20:35"),
    mk("su331",  "Gin Blossoms",                                      "Rock",                "uline",         7, "21:30", "23:00"),
    // Summerville
    mk("su332",  "Marcya Danielle",                                   "—",                   "johnsonville",  7, "12:00", "13:05"),
    mk("su333",  "Paul Spencer Band",                                 "—",                   "johnsonville",  7, "13:45", "14:50"),
    mk("su334",  "Paul Spencer Band",                                 "—",                   "johnsonville",  7, "15:30", "16:35"),
    mk("su335",  "The Group",                                         "—",                   "johnsonville",  7, "17:30", "18:35"),
    mk("su336",  "The Group",                                         "—",                   "johnsonville",  7, "19:30", "20:35"),
    // AmFam House
    mk("su337",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    7, "12:00", "13:05"),
    mk("su338",  "Spin Doctors",                                      "Rock",                "amfamhouse",    7, "16:00", "17:05"),
    mk("su339",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    7, "18:00", "19:05"),
    // ─────────── DAY 8 · Friday Jul 3 ───────────
    // AmFam Amphitheater
    mk("su340",  "Emei",                                              "Pop",                 "amph",          8, "18:55", "19:35"),
    mk("su341",  "Noah Cyrus",                                        "Pop",                 "amph",          8, "19:45", "20:50"),
    mk("su342",  "Alex Warren",                                       "Pop",                 "amph",          8, "21:15", "23:20"),
    // BMO Pavilion
    mk("su343",  "DJ Splackavelli",                                   "—",                   "bmo",           8, "17:30", "18:35"),
    mk("su344",  "Stephen Marley",                                    "Reggae / Dancehall",  "bmo",           8, "19:15", "20:20"),
    mk("su345",  "Buju Banton",                                       "Reggae / Dancehall",  "bmo",           8, "21:00", "22:30"),
    // Big Backyard
    mk("su346",  "Sarah Fierek",                                      "—",                   "briggs",        8, "13:00", "13:45"),
    mk("su347",  "V-Funk",                                            "—",                   "briggs",        8, "14:30", "15:20"),
    mk("su348",  "Stone Jam Band",                                    "—",                   "briggs",        8, "16:00", "17:05"),
    mk("su349",  "DJ Kool",                                           "Hip-Hop",             "briggs",        8, "18:00", "19:05"),
    mk("su350",  "DJ Jazzy Jeff",                                     "Hip-Hop",             "briggs",        8, "20:00", "21:05"),
    mk("su351",  "Rev Run",                                           "Hip-Hop",             "briggs",        8, "22:00", "23:30"),
    // Generac Power Stage
    mk("su352",  "Social Cig",                                        "—",                   "generac",       8, "12:30", "13:15"),
    mk("su353",  "Easy Honey",                                        "—",                   "generac",       8, "14:00", "14:50"),
    mk("su354",  "YaYa Biggs",                                        "—",                   "generac",       8, "15:30", "16:35"),
    mk("su355",  "Edgehill",                                          "—",                   "generac",       8, "17:30", "18:35"),
    mk("su356",  "Ax And The Hatchetmen",                             "—",                   "generac",       8, "19:30", "20:35"),
    mk("su357",  "Spoon",                                             "Rock",                "generac",       8, "21:30", "23:05"),
    // Miller Lite Oasis
    mk("su358",  "Fellow Travelers",                                  "—",                   "miller",        8, "12:30", "13:15"),
    mk("su359",  "Lost Orange Cat",                                   "—",                   "miller",        8, "14:00", "14:50"),
    mk("su360",  "The Big Win",                                       "—",                   "miller",        8, "16:00", "17:05"),
    mk("su361",  "Scout Speer",                                       "—",                   "miller",        8, "17:15", "18:05"),
    mk("su362",  "Adam Warner",                                       "—",                   "miller",        8, "18:30", "19:35"),
    mk("su363",  "Chase McDaniel",                                    "Country",             "miller",        8, "20:30", "21:35"),
    mk("su364",  "Whiskey Myers",                                     "Rock",                "miller",        8, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su365",  "wht.rrbt.obj",                                      "—",                   "aurora",        8, "12:45", "13:35"),
    mk("su366",  "Lunde",                                             "—",                   "aurora",        8, "14:00", "14:50"),
    mk("su367",  "Ask Carol",                                         "—",                   "aurora",        8, "15:15", "16:05"),
    mk("su368",  "Six Foot Blonde",                                   "—",                   "aurora",        8, "16:30", "17:20"),
    mk("su369",  "The Heavy Heavy",                                   "—",                   "aurora",        8, "17:45", "18:35"),
    mk("su370",  "Neal Francis",                                      "Rock",                "aurora",        8, "19:00", "20:05"),
    mk("su371",  "BG Good",                                           "—",                   "aurora",        8, "21:00", "00:00"),
    // T-Mobile Stage
    mk("su372",  "Hanna Simone",                                      "—",                   "tmobile",       8, "12:45", "13:35"),
    mk("su373",  "Manny Torres",                                      "—",                   "tmobile",       8, "14:30", "15:20"),
    mk("su374",  "Wave X Nile",                                       "—",                   "tmobile",       8, "16:15", "17:20"),
    mk("su375",  "LowDown Brass Band",                                "Jazz / Blues",        "tmobile",       8, "18:15", "19:20"),
    mk("su376",  "DJay Mando",                                        "—",                   "tmobile",       8, "20:15", "21:20"),
    mk("su377",  "Flo Rida",                                          "Hip-Hop",             "tmobile",       8, "22:15", "23:45"),
    // Uline Warehouse
    mk("su378",  "Bob Mittnacht & The Crowning Glories",              "—",                   "uline",         8, "12:30", "13:15"),
    mk("su379",  "Julianna Joy",                                      "—",                   "uline",         8, "14:00", "14:50"),
    mk("su380",  "Radio Radio",                                       "—",                   "uline",         8, "15:30", "16:35"),
    mk("su381",  "Ken Pomeroy",                                       "Country",             "uline",         8, "17:30", "18:35"),
    mk("su382",  "St. Paul And The Broken Bones",                     "—",                   "uline",         8, "19:30", "20:35"),
    mk("su383",  "Gene Simmons Band",                                 "Rock",                "uline",         8, "21:30", "23:00"),
    // Summerville
    mk("su384",  "Suzanne Grzanna",                                   "Jazz / Blues",        "johnsonville",  8, "12:00", "13:05"),
    mk("su385",  "The Kal Bergendahl Project",                        "—",                   "johnsonville",  8, "13:45", "14:55"),
    mk("su386",  "The Kal Bergendahl Project",                        "—",                   "johnsonville",  8, "15:30", "16:35"),
    mk("su387",  "Pierre 'Mr. Untouchable' Lee",                      "—",                   "johnsonville",  8, "17:30", "18:35"),
    mk("su388",  "Pierre 'Mr. Untouchable' Lee",                      "—",                   "johnsonville",  8, "19:30", "20:35"),
    // AmFam House
    mk("su389",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    8, "12:00", "13:05"),
    mk("su390",  "St. Paul And The Broken Bones",                     "Acoustic Session",    "amfamhouse",    8, "14:00", "15:05"),
    mk("su391",  "Spoon",                                             "Rock",                "amfamhouse",    8, "16:00", "17:05"),
    mk("su392",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    8, "18:00", "19:05"),
    // ─────────── DAY 9 · Saturday Jul 4 ───────────
    // AmFam Amphitheater
    mk("su393",  "Sunny Black",                                       "—",                   "amph",          9, "16:30", "16:50"),
    mk("su394",  "Ethan Burdick",                                     "—",                   "amph",          9, "17:00", "17:20"),
    mk("su395",  "Three 6 Mafia",                                     "Hip-Hop",             "amph",          9, "17:35", "18:20"),
    mk("su396",  "Tyler Hubbard",                                     "Country",             "amph",          9, "18:45", "19:35"),
    mk("su397",  "Jelly Roll",                                        "Country",             "amph",          9, "20:00", "21:20"),
    // BMO Pavilion
    mk("su398",  "Palmer Anthony",                                    "—",                   "bmo",           9, "17:30", "18:35"),
    mk("su399",  "Preston Cooper",                                    "—",                   "bmo",           9, "19:15", "20:20"),
    mk("su400",  "Sam Barber",                                        "Pop",                 "bmo",           9, "22:00", "23:30"),
    // Big Backyard
    mk("su401",  "BERMS.",                                            "—",                   "briggs",        9, "13:00", "13:45"),
    mk("su402",  "Louie & The Flashbombs",                            "—",                   "briggs",        9, "14:30", "15:20"),
    mk("su403",  "Elephonic",                                         "—",                   "briggs",        9, "16:00", "17:05"),
    mk("su404",  "KT Tunstall",                                       "Rock",                "briggs",        9, "18:00", "19:05"),
    mk("su405",  "John Vincent III",                                  "—",                   "briggs",        9, "20:00", "21:05"),
    mk("su406",  "Jonah Kagen",                                       "—",                   "briggs",        9, "22:00", "23:30"),
    // Generac Power Stage
    mk("su407",  "Oh Geeez, Not Again",                               "—",                   "generac",       9, "12:30", "13:20"),
    mk("su408",  "Ur Mom",                                            "—",                   "generac",       9, "14:00", "14:45"),
    mk("su409",  "Nicole Lawrence",                                   "—",                   "generac",       9, "15:30", "16:35"),
    mk("su410",  "Soul Asylum",                                       "Rock",                "generac",       9, "17:30", "18:35"),
    mk("su411",  "The Jayhawks",                                      "Rock",                "generac",       9, "19:30", "20:35"),
    mk("su412",  "BoDeans",                                           "Rock",                "generac",       9, "22:00", "23:30"),
    // Miller Lite Oasis
    mk("su413",  "\"Horizon\" The Popular Music Group Of Navy Band Great Lakes", "—",                   "miller",        9, "12:15", "13:20"),
    mk("su414",  "Flatwounds",                                        "—",                   "miller",        9, "13:45", "14:35"),
    mk("su415",  "The Maiden Voyage",                                 "—",                   "miller",        9, "15:15", "16:05"),
    mk("su416",  "SIIN",                                              "—",                   "miller",        9, "17:00", "18:05"),
    mk("su417",  "Drown The Lifeguard",                               "—",                   "miller",        9, "18:45", "19:50"),
    mk("su418",  "Sunami",                                            "Punk / Hardcore",     "miller",        9, "20:30", "21:35"),
    mk("su419",  "Kerry King",                                        "Punk / Hardcore",     "miller",        9, "22:30", "00:00"),
    // Aurora Pavilion
    mk("su420",  "Rockonsin: Runner Up",                              "Youth Showcase",      "aurora",        9, "12:45", "13:50"),
    mk("su421",  "Rockonsin: Winner",                                 "Youth Showcase",      "aurora",        9, "14:00", "15:05"),
    mk("su422",  "VALE",                                              "—",                   "aurora",        9, "15:15", "16:05"),
    mk("su423",  "Gego Y Nony",                                       "Latin",               "aurora",        9, "16:30", "17:20"),
    mk("su424",  "Tag Team",                                          "—",                   "aurora",        9, "17:45", "18:30"),
    mk("su425",  "Baha Men",                                          "Reggae / Dancehall",  "aurora",        9, "19:00", "20:05"),
    mk("su426",  "Sad Boy Saturday",                                  "—",                   "aurora",        9, "21:00", "22:30"),
    // T-Mobile Stage
    mk("su427",  "The Last Bees",                                     "—",                   "tmobile",       9, "12:45", "13:30"),
    mk("su428",  "Known Moons",                                       "—",                   "tmobile",       9, "14:30", "15:20"),
    mk("su429",  "Carolina Liar",                                     "Rock",                "tmobile",       9, "16:15", "17:20"),
    mk("su430",  "Pure Hex",                                          "—",                   "tmobile",       9, "18:15", "19:20"),
    mk("su431",  "Joywave",                                           "Rock",                "tmobile",       9, "20:15", "21:20"),
    mk("su432",  "The Temper Trap",                                   "Rock",                "tmobile",       9, "22:15", "23:45"),
    // Uline Warehouse
    mk("su433",  "Victor Jones",                                      "—",                   "uline",         9, "12:30", "13:20"),
    mk("su434",  "Porcupine",                                         "—",                   "uline",         9, "14:00", "14:45"),
    mk("su435",  "Poi Dog Pondering",                                 "Rock",                "uline",         9, "15:30", "16:35"),
    mk("su436",  "Jerry Harrison's '50 Years Of Talking Heads'",      "Rock",                "uline",         9, "17:30", "18:45"),
    mk("su437",  "Mindi Abair",                                       "Jazz / Blues",        "uline",         9, "19:30", "20:35"),
    mk("su438",  "Straight No Chaser",                                "Jazz / Blues",        "uline",         9, "22:00", "23:30"),
    // Summerville
    mk("su439",  "Frogwater",                                         "—",                   "johnsonville",  9, "12:00", "13:05"),
    mk("su440",  "Joe Wray",                                          "—",                   "johnsonville",  9, "13:45", "14:50"),
    mk("su441",  "Joe Wray",                                          "—",                   "johnsonville",  9, "15:30", "16:35"),
    mk("su442",  "Dorsten",                                           "—",                   "johnsonville",  9, "17:30", "18:35"),
    mk("su443",  "Dorsten",                                           "—",                   "johnsonville",  9, "19:30", "20:35"),
    // AmFam House
    mk("su444",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    9, "12:00", "13:05"),
    mk("su445",  "Soul Asylum",                                       "Rock",                "amfamhouse",    9, "14:00", "15:05"),
    mk("su446",  "The Temper Trap",                                   "Rock",                "amfamhouse",    9, "16:00", "17:05"),
    mk("su447",  "DJay Mando",                                        "Acoustic Session",    "amfamhouse",    9, "18:00", "19:05"),
  ];

  const CONFIG = {
    id: "summerfest-2026",
    name: "Summerfest 2026",
    shortName: "Summerfest",
    brand: "Summerfest",
    tagline: "Nine days on the Milwaukee lakefront",
    location: "Henry Maier Festival Park · Milwaukee, WI",
    locationShort: "Henry Maier Festival Park",
    dates: "Jun 18–20, Jun 25–27 & Jul 2–4, 2026",
    year: 2026,
    // gates day 1 (12:00 CDT) -> close of the final day (24:00 CDT)
    startMs: Date.UTC(2026, 5, 18, 17, 0, 0),
    endMs:   Date.UTC(2026, 6, 5, 5, 0, 0),
    tz: "America/Chicago",
    tzAbbr: "CDT",
    utcOffsetHours: -5,
    dayDates: {
      1: { y: 2026, m: 5, d: 18, name: "Thursday", short: "THU",
           midnightUtc: Date.UTC(2026, 5, 18, 5, 0, 0) },
      2: { y: 2026, m: 5, d: 19, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 5, 19, 5, 0, 0) },
      3: { y: 2026, m: 5, d: 20, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 5, 20, 5, 0, 0) },
      4: { y: 2026, m: 5, d: 25, name: "Thursday", short: "THU",
           midnightUtc: Date.UTC(2026, 5, 25, 5, 0, 0) },
      5: { y: 2026, m: 5, d: 26, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 5, 26, 5, 0, 0) },
      6: { y: 2026, m: 5, d: 27, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 5, 27, 5, 0, 0) },
      7: { y: 2026, m: 6, d: 2, name: "Thursday", short: "THU",
           midnightUtc: Date.UTC(2026, 6, 2, 5, 0, 0) },
      8: { y: 2026, m: 6, d: 3, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 6, 3, 5, 0, 0) },
      9: { y: 2026, m: 6, d: 4, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 6, 4, 5, 0, 0) },
    },
    // sunrise-sunset.org at the venue centroid, rendered in CDT.
    sunTimes: {
      1: { rise: "05:10", set: "20:35" },
      2: { rise: "05:10", set: "20:35" },
      3: { rise: "05:10", set: "20:35" },
      4: { rise: "05:11", set: "20:36" },
      5: { rise: "05:12", set: "20:36" },
      6: { rise: "05:12", set: "20:36" },
      7: { rise: "05:15", set: "20:36" },
      8: { rise: "05:15", set: "20:35" },
      9: { rise: "05:16", set: "20:35" },
    },
    // No festival-operated shuttle published for 2026; field omitted rather than guessed.
    gps: { lat: 43.03084, lng: -87.89851, onSiteRadiusMi: 0.45 },
    rideshareGps: {
      lat: 43.0288, lng: -87.90262,
      label: "East Summerfest Place · Rideshare",
      note:  "Pickup is west of the South Gate, off North Harbor Drive.",
    },
    venue: {
      name: "Henry Maier Festival Park",
      address: "200 N Harbor Dr, Milwaukee, WI 53202",
      festivalBounds: { north: 43.0362, south: 43.0262,
                        west: -87.9008, east: -87.8948 },
    },
    // Every anchor is the stage's own authored lat/lng, so the affine in
    // map.jsx reproduces each stage's x/y exactly. Verified by scripts/verify.mjs.
    gpsAnchors: [
      // Ordered so the leading triple spans the largest triangle — map.jsx's
      // _solveMapAffine reads only the first three, and a thin triple is unstable.
      { stageId: "bmo",           lat: 43.02862, lng: -87.89660 },  // osm
      { stageId: "briggs",        lat: 43.02980, lng: -87.89941 },  // osm
      { stageId: "uline",         lat: 43.03532, lng: -87.89824 },  // osm
      { stageId: "amph",          lat: 43.02716, lng: -87.89759 },  // osm
      { stageId: "generac",       lat: 43.03109, lng: -87.89940 },  // osm
      { stageId: "miller",        lat: 43.03216, lng: -87.89962 },  // osm
      { stageId: "aurora",        lat: 43.03352, lng: -87.89837 },  // osm
      { stageId: "tmobile",       lat: 43.03442, lng: -87.89789 },  // osm
      { stageId: "johnsonville",  lat: 43.03489, lng: -87.89906 },  // osm
      { stageId: "amfamhouse",    lat: 43.03060, lng: -87.89860 },  // prov
    ],
    weatherEndpoint: "https://api.weather.gov/points/43.03,-87.90",
    mainStageId: "amph",
    // Generated abstract overlay, NOT the official patron map — that art is
    // rights-restricted and is never copied into this repo (lostlands-2026.jpg
    // precedent). Authored in the same 0-100 frame as the stages above.
    mapImage: "summerfest-2026.svg",
    mapStyle: "image-overlay",
    mapTheme: "park",
    // The overlay prints no stage names, so pills carry them.
    mapPrintsStageNames: false,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["summerfest-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, accent: "#fbbf24", emoji: "🎡", region: "North America" },
  };
})();
