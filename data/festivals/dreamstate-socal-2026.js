// ═══════════════════════════════════════════════════════════════════════
// DREAMSTATE SOCAL 2026 — Queen Mary Waterfront · Long Beach, CA
// Nov 20–21, 2026
// ═══════════════════════════════════════════════════════════════════════
// GATED SCAFFOLD. The LINEUP is real and complete and the four STAGE NAMES
// are shipped; the day split, the set times and the site map are not
// published, and none of them are invented below.
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
// STAGES: the four asset filenames on socal.dreamstateusa.com/experience/
//   stages/ — dssc_the_dream_stage, dssc_the_sequence_stage,
//   dssc_the_vision_stage, dssc_the_void_stage — read 2026-09-09, corroborated
//   in COUNT by the press release ("four stages"). See the caveat block on
//   STAGES below before touching them.
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
// ── WHAT IS NOT PUBLISHED (verified 2026-09-09, do not fabricate) ──
//
// DAY SPLIT. One flat list covering both nights, no Fri/Sat tabs.
// SET TIMES. Absent; Insomniac posts them in the days before the festival.
// STAGE ASSIGNMENTS. Every act is stage: null. The stages exist, the mapping
//   of acts onto them does not.
// STAGE POSITIONS. No 2026 site map, and the build does not exist to measure
//   off satellite either, so no stage carries x/y — the CRSSD precedent.
// SITE MAP. None.
//
// ── SPATIAL MODEL ──
// mapMode: "real" — real street tiles on the surveyed centroid and the live
// blue dot, which is all true, and no map art, no grid and no gpsAnchors,
// because there is nothing to register. Same posture as III Points (#79).
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
// ── FLIP CHECKLIST (set times + site map, ~mid-Nov) ──
//   1. CONFIRM the four stage names against the official grid — they are
//      filename-derived, see the caveats — and resolve the Long Beach
//      Amphitheater and Beatbox Art Car questions below.
//   2. Real lat/lng per stage; derive x/y from them, never the reverse.
//   3. day + start/end + stage per act; drop the `provisional` flag.
//   4. Replace the single TBA bucket with the real Fri/Sat pair.
//   5. venue.footprint from the official map's perimeter — never estimated.
//   6. amenities from the official map's legend.
//   7. mainStageId once the grid says which stage is the main stage.
//   8. registry.available → true.
//   9. Re-run node scripts/gen-festival-pages.mjs and commit the result.
(function () {
  "use strict";

  // ── STAGES: FOUR NAMES, FILENAME-DERIVED, SHIPPED ON PURPOSE ──
  //
  // socal.dreamstateusa.com/experience/stages/ renders each stage as an IMAGE
  // with no text and an EMPTY alt attribute — the visible page is a header,
  // one line of copy and four bare "/" separators. The only place the names
  // survive is the asset filenames: dssc_the_dream_stage, the_sequence_stage,
  // the_vision_stage, the_void_stage. Four files, four cards, and the press
  // release independently says "four stages". That agreement is why these
  // ship; a filename alone would not be enough.
  //
  // ⚠ THREE things the flip must settle, all of them open right now:
  //   1. The same press release says the four stages include "the new Long
  //      Beach Amphitheater". That name is NOT in the filename set. Either
  //      the amphitheater is the venue HOSTING one of these four, or it is a
  //      fifth name and one of these four is retired. Unresolved.
  //   2. It also announces "the addition of Beatbox's Art Car stage featuring
  //      local trance artists" — a real, text-published, officially named
  //      stage that is deliberately NOT below, because the official count is
  //      four and adding it would make this array disagree with Insomniac.
  //      (Nocturnal ships the same sponsor art car as "Beatbox Boombox", so
  //      the pattern is established and the flip should expect a fifth row.)
  //   3. The filenames carry no year. They are on the 2026 site, but an asset
  //      can outlive its edition — confirm against the 2026 set-time grid.
  //
  // ⛔ Nocturnal's warning applies with full force: a search for this
  // festival's stage names will confidently return names from earlier
  // editions. The grid or the official map, or nothing.
  //
  // No x/y on any of them — there is no 2026 site map and no build to measure
  // off satellite, so no stage has a known position. The CRSSD precedent:
  // stages appear in pills, filters and cards, and simply carry no map pin.
  // No `desc` either — the genre each stage programs is not published, and
  // guessing "main stage" or "psytrance" from the name is exactly the
  // invention this scaffold exists to avoid. Uniform `size`, because ranking
  // them would be a claim about which is the main stage; `mainStageId` stays
  // null for the same reason.
  const STAGES = [
    { id: "dream",    name: "The Dream",    short: "DREAM",    color: "#818cf8", size: 1.2 },
    { id: "sequence", name: "The Sequence", short: "SEQUENCE", color: "#22d3ee", size: 1.2 },
    { id: "vision",   name: "The Vision",   short: "VISION",   color: "#f472b6", size: 1.2 },
    { id: "void",     name: "The Void",     short: "VOID",     color: "#a78bfa", size: 1.2 },
  ];

  // No amenity map published.
  const AMENITIES = [];

  // Every act is unplaced and untimed. `tier` drives lineup card weighting
  // elsewhere; with no set times there is no basis to rank, so all acts sit
  // at the same tier rather than being silently ordered by a guess.
  // `provisional: true` marks the whole set for the flip session.
  const mk = (id, name) => ({
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
    mk("dssc-bt-and-matt-fax",                                      "BT + Matt Fax"),
    mk("dssc-burn-in-noise",                                        "Burn In Noise"),
    mk("dssc-chris-metcalfe",                                       "Chris Metcalfe"),
    mk("dssc-cold-blue",                                            "Cold Blue"),
    mk("dssc-darren-porter-and-sean-tyas",                          "Darren Porter + Sean Tyas"),
    mk("dssc-das-pharaoh",                                          "Das Pharaoh"),
    mk("dssc-dash-berlin",                                          "Dash Berlin"),
    mk("dssc-david-forbes-and-mark-sherry-pres-thick-as-thieves",   "David Forbes + Mark Sherry pres Thick As Thieves"),
    mk("dssc-david-rust-and-olly-james",                            "David Rust + Olly James"),
    mk("dssc-discovery-project",                                    "Discovery Project"),
    mk("dssc-eddie-halliwell-and-judge-jules",                      "Eddie Halliwell + Judge Jules"),
    mk("dssc-enrico-sangiuliano",                                   "Enrico Sangiuliano"),
    mk("dssc-ferry-corsten-and-marsh",                              "Ferry Corsten + Marsh"),
    mk("dssc-ferry-tayle-and-tonks-pres-mirage-live",               "Ferry Tayle + Tonks pres Mirage (Live)"),
    mk("dssc-frankyeffe",                                           "FRANKYEFFE"),
    mk("dssc-giorgia-angiuli",                                      "Giorgia Angiuli"),
    mk("dssc-gms",                                                  "GMS"),
    mk("dssc-hannah-laing-and-marie-vaunt",                         "Hannah Laing + Marie Vaunt"),
    mk("dssc-infected-mushroom",                                    "Infected Mushroom"),
    mk("dssc-joa",                                                  "JOA"),
    mk("dssc-john-00-fleming",                                      "John 00 Fleming"),
    mk("dssc-john-askew-and-simon-patterson",                       "John Askew + Simon Patterson"),
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
    name:      "Dreamstate SoCal 2026",
    shortName: "Dreamstate SoCal",
    brand:     "Dreamstate",
    tagline:   "Two nights of trance on the Long Beach waterfront",
    location:  "Queen Mary Waterfront · Long Beach, CA",
    locationShort: "Queen Mary Waterfront",
    dates:     "Nov 20–21, 2026",
    year:      2026,
    // Los Angeles is PST (UTC-8) on these dates — DST ended Nov 1, 2026.
    // Hours ARE published, so these are the real ones rather than the
    // generous bounds a festival with unpublished hours has to use:
    // doors 4 PM Nov 20, afterparty closes 6 AM Nov 22.
    startMs: Date.UTC(2026, 10, 21, 0, 0, 0),   // Nov 20 16:00 PST
    endMs:   Date.UTC(2026, 10, 22, 14, 0, 0),  // Nov 22 06:00 PST
    tz:      "America/Los_Angeles",
    tzAbbr:  "PST",
    utcOffsetHours: -8,
    // ⚠️ ONE bucket for a TWO-night festival, on purpose — the III Points
    // precedent (#79), reached the same way and for the same reason.
    //
    // The day split is not published (see header). The options are the same
    // three, and only one is honest AND usable:
    //   - day: null on every act → the lineup screen renders EMPTY, because
    //     the app filters `a.day === activeDay` in dozens of places.
    //   - each act on BOTH nights → claims every act plays twice. False.
    //   - ONE bucket labelled TBA → every act browsable and saveable now,
    //     and the label states exactly what is unknown.
    //
    // III Points' note says to revisit teaching the app that a null day means
    // "any day" if a SECOND festival ever needed this. This is that second
    // festival, so the trigger has fired and it is worth doing — but it is a
    // cross-cutting change to day handling and it is not this PR. Flagged in
    // the PR body. Until then this stays module-local and reverses cleanly at
    // the flip, where it becomes the real Fri/Sat pair.
    dayDates: {
      1: { y: 2026, m: 10, d: 20, name: "Nov 20–21", short: "TBA", midnightUtc: Date.UTC(2026, 10, 20, 8, 0, 0) },
    },
    // api.sunrise-sunset.org at 33.752789,-118.189632, converted to PST.
    // Nov 20 and 21 differ by one minute at sunrise and not at all at sunset;
    // the single bucket takes Nov 20's.
    sunTimes: {
      1: { rise: "06:28", set: "16:48" },
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
    // No mapImage, no mapStyle: "image-overlay", no gpsAnchors. This festival
    // opens straight into the real basemap.
    mapMode: "real",
    mapPrintsStageNames: false,
    // Nothing to register — not a waiver.
    mapArtIsGeoregistered: false,
    // Published policy, drives FAQ copy only.
    policies: { reentry: false, alcoholAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["dreamstate-socal-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // GATED: the day split, the set times, every act's stage assignment and
    // the official map are all unpublished. The four stage NAMES ship (see
    // STAGES); nothing is placed on them.
    registry: { available: false, accent: "#6366f1", emoji: "🌀", region: "North America" },
  };
})();

