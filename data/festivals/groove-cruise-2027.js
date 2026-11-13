// ═══════════════════════════════════════════════════════════════════════
// GROOVE CRUISE MIAMI 2027 — Allure of the Seas · Miami → Royal Beach Club
// Jan 21–25, 2027. Groove Cruise. Four nights at sea.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true; Jake 2026-11-11:
// switch on the festivals with a full lineup). No day split, stage split or
// set times are published, so every act sits unplaced in one TBA bucket.
//
// SOURCE lineup: groovecruise.com/lineup2027, read 2026-11-12. 106 artist
// cards; a trailing "Support" card is not an act and is not loaded. Each card
// names the act's Groove Cruise brand and genre ("ABYSS - Techno/Underground",
// "EMBARK - Trance", "RISING TIDES - House/Tech House", "SIREN'S ECHO -
// Melodic Bass", "THE TRENCH - Drum & Bass", "TAKING BACK EMO - Emo/Rock",
// "BARNYARD - YeeDM (Country x EDM)"). That pair is kept in the act's bio
// only: it is the brand's genre, not a ruling on the artist's, so the genre
// field stays "—". The brands are hosts, not rooms, so no stage is set.
// NAME CASING: the cards print every name in capitals. A name is written the
// way the artist registry already spells it from an earlier festival (58),
// else the way the act's own bio on the same page spells it (35), else as
// printed (13). Each row whose casing differs from the card notes the
// printed form, so nothing here is a guess.
//
// SOURCE dates, ship, itinerary: groovecruise.com, read 2026-11-12 —
// "From January 21-25, 2027 ... set sail from Miami to Nassau aboard Royal
// Caribbean's Allure of the Seas"; itinerary Day 1 Thu Jan 21 Miami, Day 2
// at sea, Day 3 Sat Jan 23 Royal Beach Club on Paradise Island, Day 4 at sea,
// Day 5 Mon Jan 25 Miami. "96 hours of nonstop music across 13 stages".
// The home page also shows the sailing as SOLD OUT (waitlist only).
// SOURCE gps: the official pages say only "Miami, Florida". Miami's cruise
// port is PortMiami; en.wikipedia.org/wiki/PortMiami, read 2026-11-12 —
// 25.77417°N 80.17111°W. The festival itself is at sea, so an on-site check
// can only match at the port on boarding and return days.
// NO HOURS: boarding and disembark times are not published. startMs/endMs
// bound the five calendar days in Miami time, not boarding-to-disembark.
// NO AGE POLICY loaded: none read from an official page.
// NO WEATHER: a ship at sea has no fixed forecast point, so weatherEndpoint
// is null even though the port is in the US.
// sunTimes are COMPUTED (NOAA formula, zenith 90.833°, UTC-5) at the port
// for Jan 21; Jan 25 is 07:07 / 17:58.
(function () {
  "use strict";

  const STAGES = [];
  const AMENITIES = [];
  const SCHEDULE = {};
  const scheduled = act => {
    const s = SCHEDULE[act.id];
    if (!s) return act;
    const { provisional, ...rest } = act;
    return { ...rest, stage: s[0], start: s[1], end: s[2], day: s[3] ?? act.day,
      bio: "Playing Groove Cruise Miami 2027." };
  };
  const mk = (id, name, brand, genre) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #38bdf8, #0b1e3f)",
    bio: "Playing Groove Cruise Miami 2027 under the " + brand + " banner (" +
         genre + "). Day, stage and set time are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("gc-22-weeks", "22 Weeks", "RISING TIDES", "House/Tech House"),  // printed "22 WEEKS"
    mk("gc-adam-beyer", "Adam Beyer", "ABYSS", "Techno/Underground"),  // printed "ADAM BEYER"
    mk("gc-adam-scott", "Adam Scott", "EMBARK", "Trance"),  // printed "ADAM SCOTT"
    mk("gc-adina-butar", "Adina Butar", "EMBARK", "Trance"),  // printed "ADINA BUTAR"
    mk("gc-alley-kay", "Alley Kay", "ABYSS", "Techno/Underground"),  // printed "ALLEY KAY"
    mk("gc-amidy", "AMIDY", "SIREN'S ECHO", "Melodic Bass"),
    mk("gc-amprs-and-nd", "AMPRS&ND", "ABYSS", "Techno/Underground"),
    mk("gc-amy-wiles", "Amy Wiles", "EMBARK", "Trance"),  // printed "AMY WILES"
    mk("gc-anabel-englund", "Anabel Englund", "RISING TIDES", "House/Tech House"),  // printed "ANABEL ENGLUND"
    mk("gc-andrew-bayer", "Andrew Bayer", "EMBARK", "Trance"),  // printed "ANDREW BAYER"
    mk("gc-anthony-attalla", "Anthony Attalla", "ABYSS", "Techno/Underground"),  // printed "ANTHONY ATTALLA"
    mk("gc-bella-renee", "Bella Renee", "THE TRENCH", "Drum & Bass"),  // printed "BELLA RENEE"
    mk("gc-brookie", "Brookie", "RISING TIDES", "House/Tech House"),  // printed "BROOKIE"
    mk("gc-bryan-lubliner", "Bryan Lubliner", "RISING TIDES", "House/Tech House"),  // printed "BRYAN LUBLINER"
    mk("gc-bunt", "Bunt.", "RISING TIDES", "House/Tech House"),  // printed "BUNT."
    mk("gc-cazztek", "Cazztek", "RISING TIDES", "House/Tech House"),  // printed "CAZZTEK"
    mk("gc-ciaran-mcauley", "Ciaran McAuley", "EMBARK", "Trance"),  // printed "CIARAN MCAULEY"
    mk("gc-cicale", "CICALE", "RISING TIDES", "House/Tech House"),
    mk("gc-cid", "Cid", "RISING TIDES", "House/Tech House"),  // printed "CID"
    mk("gc-collelo", "Collelo", "ABYSS", "Techno/Underground"),  // printed "COLLELO"
    mk("gc-dansyn", "Dansyn", "RISING TIDES", "House/Tech House"),  // printed "DANSYN"
    mk("gc-dave-neven", "Dave Neven", "EMBARK", "Trance"),  // printed "DAVE NEVEN"
    mk("gc-daxson", "Daxson", "EMBARK", "Trance"),  // printed "DAXSON"
    mk("gc-deeper-purpose", "Deeper Purpose", "ABYSS", "Techno/Underground"),  // printed "DEEPER PURPOSE"
    mk("gc-deepfake", "DEEPFAKE", "ABYSS", "Techno/Underground"),
    mk("gc-deerock", "Deerock", "BARNYARD", "YeeDM (Country x EDM)"),  // printed "DEEROCK"
    mk("gc-dimibo", "Dimibo", "EMBARK", "Trance"),  // printed "DIMIBO"
    mk("gc-disco-lines", "Disco Lines", "RISING TIDES", "House/Tech House"),  // printed "DISCO LINES"
    mk("gc-distant-matter", "Distant Matter", "RISING TIDES", "House/Tech House"),  // printed "DISTANT MATTER"
    mk("gc-dj-susan", "DJ Susan", "RISING TIDES", "House/Tech House"),  // printed "DJ SUSAN"
    mk("gc-doc-brown", "Doc Brown", "RISING TIDES", "House/Tech House"),  // printed "DOC BROWN"
    mk("gc-d-o-d", "D.O.D", "RISING TIDES", "House/Tech House"),
    mk("gc-dose", "Dose", "RISING TIDES", "House/Tech House"),  // printed "DOSE"
    mk("gc-drums-of-the-sun", "Drums of the Sun", "RISING TIDES", "House/Tech House"),  // printed "DRUMS OF THE SUN"
    mk("gc-dxn3", "DXN3", "RISING TIDES", "House/Tech House"),
    mk("gc-eli-brown", "Eli Brown", "ABYSS", "Techno/Underground"),  // printed "ELI BROWN"
    mk("gc-ely-oaks", "Ely Oaks", "EMBARK", "Trance"),  // printed "ELY OAKS"
    mk("gc-eskuche", "Eskuche", "ABYSS", "Techno/Underground"),  // printed "ESKUCHE"
    mk("gc-fallon", "Fallon", "RISING TIDES", "House/Tech House"),  // printed "FALLON"
    mk("gc-and-friends", "&friends", "ABYSS", "Techno/Underground"),  // printed "&FRIENDS"
    mk("gc-gene-farris", "Gene Farris", "RISING TIDES", "House/Tech House"),  // printed "GENE FARRIS"
    mk("gc-gravagerz", "Gravagerz", "RISING TIDES", "House/Tech House"),  // printed "GRAVAGERZ"
    mk("gc-grube-and-hovsepian", "Grube & Hovsepian", "EMBARK", "Trance"),  // printed "GRUBE & HOVSEPIAN"
    mk("gc-gudfella", "GUDFELLA", "RISING TIDES", "House/Tech House"),
    mk("gc-jackie-hollander", "Jackie Hollander", "RISING TIDES", "House/Tech House"),  // printed "JACKIE HOLLANDER"
    mk("gc-jason-ross", "Jason Ross", "SIREN'S ECHO", "Melodic Bass"),  // printed "JASON ROSS"
    mk("gc-joshwa", "Joshwa", "RISING TIDES", "House/Tech House"),  // printed "JOSHWA"
    mk("gc-k3ss", "K3SS", "ABYSS", "Techno/Underground"),
    mk("gc-kettama", "Kettama", "ABYSS", "Techno/Underground"),  // printed "KETTAMA"
    mk("gc-ksofresko", "KsoFresKo", "ABYSS", "Techno/Underground"),  // printed "KSOFRESKO"
    mk("gc-laszewo", "Laszewo", "RISING TIDES", "House/Tech House"),  // printed "LASZEWO"
    mk("gc-laura-van-dam", "Laura van Dam", "EMBARK", "Trance"),  // printed "LAURA VAN DAM"
    mk("gc-leah-loredo", "Leah Loredo", "RISING TIDES", "House/Tech House"),  // printed "LEAH LOREDO"
    mk("gc-leena-punks", "Leena Punks", "EMBARK", "Trance"),  // printed "LEENA PUNKS"
    mk("gc-linney", "Linney", "EMBARK", "Trance"),  // printed "LINNEY"
    mk("gc-lizzy-jane", "Lizzy Jane", "THE TRENCH", "Drum & Bass"),  // printed "LIZZY JANE"
    mk("gc-luccio", "Luccio", "EMBARK", "Trance"),  // printed "LUCCIO"
    mk("gc-luci", "Luci", "SIREN'S ECHO", "Melodic Bass"),  // printed "LUCI"
    mk("gc-luke-alexander", "Luke Alexander", "ABYSS", "Techno/Underground"),  // printed "LUKE ALEXANDER"
    mk("gc-maesic", "Maesic", "RISING TIDES", "House/Tech House"),  // printed "MAESIC"
    mk("gc-marco-faraone", "Marco Faraone", "ABYSS", "Techno/Underground"),  // printed "MARCO FARAONE"
    mk("gc-marco-strous", "Marco Strous", "RISING TIDES", "House/Tech House"),  // printed "MARCO STROUS"
    mk("gc-marie-vaunt", "Marie Vaunt", "ABYSS", "Techno/Underground"),  // printed "MARIE VAUNT"
    mk("gc-markus-schulz", "Markus Schulz", "EMBARK", "Trance"),  // printed "MARKUS SCHULZ"
    mk("gc-maxinne", "Maxinne", "ABYSS", "Techno/Underground"),  // printed "MAXINNE"
    mk("gc-max-low", "Max Low", "RISING TIDES", "House/Tech House"),  // printed "MAX LOW"
    mk("gc-me-n-u", "Me n ü", "RISING TIDES", "House/Tech House"),  // printed "ME N Ü"
    mk("gc-mitis", "MitiS", "SIREN'S ECHO", "Melodic Bass"),  // printed "MITIS"
    mk("gc-mph", "MPH", "RISING TIDES", "House/Tech House"),
    mk("gc-nate-wyatt", "Nate Wyatt", "RISING TIDES", "House/Tech House"),  // printed "NATE WYATT"
    mk("gc-nathan-bliss", "Nathan Bliss", "RISING TIDES", "House/Tech House"),  // printed "NATHAN BLISS"
    mk("gc-new-girl", "New Girl", "RISING TIDES", "House/Tech House"),  // printed "NEW GIRL"
    mk("gc-nicky-genesis", "Nicky Genesis", "RISING TIDES", "House/Tech House"),  // printed "NICKY GENESIS"
    mk("gc-nifra", "Nifra", "EMBARK", "Trance"),  // printed "NIFRA"
    mk("gc-okayval", "OKAYVAL", "ABYSS", "Techno/Underground"),
    mk("gc-pretty-pink", "Pretty Pink", "EMBARK", "Trance"),  // printed "PRETTY PINK"
    mk("gc-quackson", "Quackson", "SIREN'S ECHO", "Melodic Bass"),  // printed "QUACKSON"
    mk("gc-raecola", "RaeCola", "RISING TIDES", "House/Tech House"),  // printed "RAECOLA"
    mk("gc-ragie-ban", "Ragie Ban", "ABYSS", "Techno/Underground"),  // printed "RAGIE BAN"
    mk("gc-ranger-trucco", "Ranger Trucco", "RISING TIDES", "House/Tech House"),  // printed "RANGER TRUCCO"
    mk("gc-ravnzen", "RavnZen", "RISING TIDES", "House/Tech House"),  // printed "RAVNZEN"
    mk("gc-rinaly", "Rinaly", "EMBARK", "Trance"),  // printed "RINALY"
    mk("gc-roddy-lima", "Roddy Lima", "ABYSS", "Techno/Underground"),  // printed "RODDY LIMA"
    mk("gc-romeo", "Romeo", "THE TRENCH", "Drum & Bass"),  // printed "ROMEO"
    mk("gc-sad-bois", "SAD BOIS", "SIREN'S ECHO", "Melodic Bass"),
    mk("gc-sam-feldt", "Sam Feldt", "RISING TIDES", "House/Tech House"),  // printed "SAM FELDT"
    mk("gc-sarah-de-warren", "Sarah de Warren", "ABYSS", "Techno/Underground"),  // printed "SARAH DE WARREN"
    mk("gc-scooter-and-lavelle", "Scooter & Lavelle", "RISING TIDES", "House/Tech House"),  // printed "SCOOTER & LAVELLE"
    mk("gc-scotty-boy", "Scotty Boy", "RISING TIDES", "House/Tech House"),  // printed "SCOTTY BOY"
    mk("gc-sebastian-morxx", "Sebastian Morxx", "RISING TIDES", "House/Tech House"),  // printed "SEBASTIAN MORXX"
    mk("gc-shannon-scott-williams", "Shannon Scott Williams", "RISING TIDES", "House/Tech House"),  // printed "SHANNON SCOTT WILLIAMS"
    mk("gc-ship-wrek", "Ship Wrek", "RISING TIDES", "House/Tech House"),  // printed "SHIP WREK"
    mk("gc-silva-bumpa", "Silva Bumpa", "RISING TIDES", "House/Tech House"),  // printed "SILVA BUMPA"
    mk("gc-sloane-motion", "Sloane Motion", "RISING TIDES", "House/Tech House"),  // printed "SLOANE MOTION"
    mk("gc-somnity", "SOMNiTY", "SIREN'S ECHO", "Melodic Bass"),  // printed "SOMNITY"
    mk("gc-space-92", "Space 92", "ABYSS", "Techno/Underground"),  // printed "SPACE 92"
    mk("gc-tee-so", "Tee So", "RISING TIDES", "House/Tech House"),  // printed "TEE SO"
    mk("gc-the-brothers-grim", "The Brothers Grim", "TAKING BACK EMO", "Emo/Rock"),  // printed "THE BROTHERS GRIM"
    mk("gc-tini-gessler", "Tini Gessler", "ABYSS", "Techno/Underground"),  // printed "TINI GESSLER"
    mk("gc-tinykvt", "TINYKVT", "SIREN'S ECHO", "Melodic Bass"),
    mk("gc-tom-higgenson", "Tom Higgenson", "TAKING BACK EMO", "Emo/Rock"),  // printed "TOM HIGGENSON"
    mk("gc-travis-clark", "Travis Clark", "TAKING BACK EMO", "Emo/Rock"),  // printed "TRAVIS CLARK"
    mk("gc-trivecta", "Trivecta", "SIREN'S ECHO", "Melodic Bass"),  // printed "TRIVECTA"
    mk("gc-wes-miles", "WES MILES", "RISING TIDES", "House/Tech House"),
    mk("gc-whipped-cream", "Whipped Cream", "RISING TIDES", "House/Tech House"),  // printed "WHIPPED CREAM"
    mk("gc-years-of-war", "Years of War", "SIREN'S ECHO", "Melodic Bass"),  // printed "YEARS OF WAR"
  ];

  const CONFIG = {
    id: "groove-cruise-2027",
    lineupSource: { url: "https://www.groovecruise.com/lineup2027", observedAt: "2026-11-12", official: true },
    name: "Groove Cruise Miami 2027",
    shortName: "Groove Cruise",
    brand: "Groove Cruise",
    tagline: "Four nights of music at sea, Miami to Paradise Island",
    location: "Allure of the Seas · Miami, FL",
    locationShort: "Allure of the Seas",
    dates: "Jan 21–25, 2027",
    year: 2027,
    print: { accent: null, source: { url: "https://www.groovecruise.com/", observedAt: "2026-11-12" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://www.groovecruise.com/",
      observedAt: "2026-11-12",
    },
    // Miami and Nassau are both Eastern Time (EST, UTC-5, in January).
    startMs: Date.UTC(2027, 0, 21, 5, 0, 0),   // Jan 21 00:00 EST
    endMs: Date.UTC(2027, 0, 26, 4, 59, 59),   // Jan 25 23:59:59 EST
    tz: "America/New_York",
    tzAbbr: "EST",
    utcOffsetHours: -5,
    dayDates: {
      1: { y: 2027, m: 0, d: 21, name: "Jan 21–25", short: "TBA",
           midnightUtc: Date.UTC(2027, 0, 21, 5, 0, 0) },
    },
    sunTimes: { 1: { rise: "07:08", set: "17:55" } },
    gps: { lat: 25.77417, lng: -80.17111, onSiteRadiusMi: 0.8 },
    venue: {
      name: "Royal Caribbean's Allure of the Seas (boards at PortMiami)",
      address: "PortMiami, Miami, FL",
      terrain: "cruise ship — four nights at sea with a beach-club day on Paradise Island",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["groove-cruise-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#38bdf8", emoji: "🛳️", region: "North America" },
  };
})();
