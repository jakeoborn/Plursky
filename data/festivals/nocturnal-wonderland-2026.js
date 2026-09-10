// ═══════════════════════════════════════════════════════════════════════
// NOCTURNAL WONDERLAND 2026 — Glen Helen Regional Park · San Bernardino, CA
// Sep 19–20, 2026
// ═══════════════════════════════════════════════════════════════════════
// LIVE 2026 BUILD. Every act carries its official day, stage, start, and end.
// The 2026 site map is still unpublished; the existing honest map posture stays
// in place, with no invented georeference or Rave Cave position.
//
// SOURCE lineup: nocturnalwonderland.com/lineup/ (official), accessed
//   2026-09-06. The page carries TWO independent splits — by day and by stage
//   — and both were read in full: 86 acts each side, joined on exact artist
//   name with zero orphans in either direction (40 on Sat, 46 on Sun). B2B
//   billing is preserved VERBATIM as one act, because that is how the set is
//   sold and how the schedule will print it.
// SOURCE stages: nocturnalwonderland.com/experience/stages/ (official),
//   accessed 2026-09-06 — Mystic Wild, Dawn Mountain, Aurora Plains, Rave
//   Cave, with the stage blurbs quoted below. ⚠ That page lists FOUR; the
//   lineup page bills a FIFTH, Beatbox Boombox, with 18 acts on it. Both are
//   official, so all five ship. Do not "correct" this to four.
// SOURCE hours + age policy: nocturnalwonderland.com/guide/hours-and-info/,
//   accessed 2026-09-06 — "Festival Hours: 3PM-12AM daily", "You must be 18+
//   to enter and 21+ for alcohol/VIP."
// SOURCE venue: OpenStreetMap, Glen Helen Amphitheater / festival grounds,
//   34.2045945,-117.4017347. Address 2555 Glen Helen Pkwy per the official
//   guide's own map link.
// SOURCE sun times: api.sunrise-sunset.org at the OSM centroid, 2026-09-06.
//
// ⛔ DO NOT take stage names from press coverage or search summaries. Search
// results for this festival confidently return Labyrinth, Wolves' Den and
// Sunken Garden — those are REAL Nocturnal stages from EARLIER YEARS, and the
// 2026 site uses none of them. That mistake was live in this session before
// the official pages were read. Official pages only.
//
// SOURCE set times: nocturnalwonderland.com/lineup/set-times/day-1/ and
//   /day-2/ (official), accessed 2026-09-10. The two pages print 86 complete
//   stage/time rows: 42 Saturday and 44 Sunday. The source epochs encode the
//   printed wall clock as UTC, so this transcription follows the visible labels
//   (3PM–12AM PDT), not local conversion of those epoch integers.
// STAGE POSITIONS: absent. No 2026 site map exists, and the festival build
//   does not exist to measure off satellite either.
//
// ── SPATIAL MODEL ── (revised 2026-09-06 after the founder supplied the
// official 2025 festival map: "use the 2025 map if the 2026 map does not
// exist")
//
// LAYOUT is real; GEOREFERENCE is not, and the difference is the whole point.
//
// The 2025 official map gives RELATIVE layout — which stage sits where in
// relation to the others — so the four stages it shows carry 0-100 grid x/y
// read off it,
//
// ...and that read now has an INDEPENDENT corroboration (2026-09-06, #76).
// EDM Identity's 2025 review describes the layout in prose without reference
// to any map: entering the festival, Mystic Wild is on the far left, Dawn
// Mountain on the far right, Aurora Plains in the middle of the two. The grid
// agrees — mysticwild x=29.9, auroraplains x=61.7, dawnmountain x=70.8 — from
// a source that could not have copied it. That is corroboration of the
// LAYOUT only; it says nothing about world coordinates, and does not license
// anchors. and nocturnal-2026.svg is an abstract plate GENERATED from
// those coordinates (no festival artwork is reproduced; lostlands-2026.jpg
// precedent). That is a real, browsable site map.
//
// It does NOT give world coordinates, so there are NO gpsAnchors. Turning
// poster space into lat/lng is the exact defect PR #36 removed from EDC LV
// and the 2026-09-06 re-survey found on three more festivals. The EDCO spec
// (#68) does produce honest poster-class anchors, but by georeferencing the
// art onto county orthophotos with a 7-point least-squares affine against
// fixed street furniture. That measurement was not available in this session,
// and the alternative — eyeballing lat/lng off a screenshot — is precisely
// the invented precision the gate exists to stop. So: layout yes, anchors no,
// and anchoring is specced work for a session that has the imagery.
//
// Consequence, and it is the correct one: MAP_AFFINE is null, so every
// distance and walk-time readout suppresses itself through the v257/v260
// honesty gate, and the blue dot stays on the real-map layer where it is
// actually true. Nothing quotes a number it cannot support.
//
// ⚠ RAVE CAVE HAS NO POSITION. On the 2025 map it is an ART INSTALLATION in
// the legend, not a stage; for 2026 the lineup bills it as a stage with 15
// acts. It is real, its location is unknown, and map.jsx's PLACED_STAGES
// filter drops stages it cannot place rather than drawing a pin at NaN.
//
// ── FLIP CHECKLIST (Insomniac app set times + site map, ~Sep 12) ──
//   1. start/end per act from the official schedule; drop `provisional`.
//   2. GEOREFERENCE the site map onto ortho imagery the way #68 did for EDC
//      Orlando, then add gpsAnchors — src "poster" for art reads, "osm" for
//      satellite-measured features. `derived` is banned from the basis.
//      ── TIE POINTS ARE ALREADY FOUND (2026-09-06, #76). Glen Helen is
//      unusually well surveyed in OSM, and these four are distinctive enough
//      to recognise on any site map, so the flip session does not have to go
//      looking. Fit the affine against these, not against street furniture:
//        Large Lake            OSM way 437353375  centroid 34.20748,-117.40467  258 x 233 m
//        Small Lake            OSM way 437353374  centroid 34.20579,-117.40466  171 x 174 m
//        Amphitheater bowl     OSM way 233008519  centroid 34.20419,-117.40176   86 x 132 m
//        Amphitheater building OSM way 233008518  centroid 34.20440,-117.40239   58 x  79 m
//      Two named lakes 190 m apart on a north-south line, plus the bowl to
//      the south-east, give three well-spread non-collinear points — which is
//      the minimum an affine needs and more than EDC LV has ever had.
//      ⚠ WHAT IS STILL MISSING is the map image itself. The 2025 official map
//      is not retrievable from the open web (checked 2026-09-06: the official
//      site publishes no map page, and the aggregators that mirrored Lost
//      Lands' maps carry only Nocturnal's lineup poster). The flip session
//      gets the 2026 map from the Insomniac app; THAT is the input, and no
//      anchor may be authored before it exists.
//   3. Re-derive stage x/y from the measured lat/lng, never the reverse, and
//      regenerate nocturnal-2026.svg from the corrected coordinates.
//   4. Give Rave Cave a position, or leave it unplaced if still unknown.
//   5. amenities from the official map legend.
//   6. registry.available → true — its own PR, founder review (AGENTS.md).
(function () {
  "use strict";

  // Blurbs are quoted from the official stages page. Beatbox Boombox has no
  // blurb there — it is billed only on the lineup page — so it carries none
  // rather than an invented one.
  const STAGES = [
    { id: "mysticwild", name: "Mystic Wild", short: "MYSTIC", color: "#a855f7", size: 1.7,
      x: 29.9, y: 57.9,
      desc: "Main stage",
      vibe: "Claim Your Habitat",
      vibeNote: "\u201cGather your pack! At this grand scenic stage, hordes of wildly dancing creatures will claim their natural habitat.\u201d" },
    { id: "dawnmountain", name: "Dawn Mountain", short: "DAWN MTN", color: "#f97316", size: 1.4,
      x: 70.8, y: 9.3,
      desc: "Bass \u00b7 Bassrush",
      vibe: "A Maze of Sound",
      vibeNote: "\u201cAs you wander the pathways through this maze of sound, never fear! The beasts within hunger only for music.\u201d" },
    { id: "auroraplains", name: "Aurora Plains", short: "AURORA", color: "#14b8a6", size: 1.3,
      x: 61.7, y: 43.6,
      desc: "House + techno \u00b7 Insomniac Records",
      vibe: "Aural Flora",
      vibeNote: "\u201cImmerse yourself in a lush valley of sound as you revel in the aural flora of this bountiful stage.\u201d" },
    // ⚠ NO x/y ON PURPOSE. On the 2025 map "Rave Cave" is an ART
    // INSTALLATION in the legend, not a stage, and it has no stage structure
    // to read a position from. For 2026 the lineup bills it as a stage with
    // 15 acts, so it is real — but its LOCATION is genuinely unknown, and the
    // 2025 art cannot supply it. It shows up everywhere a stage should (pills,
    // filters, lineup cards) and simply carries no map pin until the 2026 map
    // lands. Do not borrow a nearby installation's spot.
    { id: "ravecave", name: "Rave Cave", short: "CAVE", color: "#ec4899", size: 1.1,
      desc: "Old-school + underground",
      vibe: "Creatures of the Night",
      vibeNote: "\u201cCalling all the creatures of the night!\u201d" },
    { id: "beatboxboombox", name: "Beatbox Boombox", short: "BOOMBOX", color: "#facc15", size: 0.9,
      x: 26.0, y: 81.4,
      desc: "Art car",
      vibe: "The Art Car",
      vibeNote: "Billed on the official lineup with 18 acts of its own. Insomniac has not published a stage blurb for it." },
  ];

  // No amenity map published — see the header.
  const AMENITIES = [];


  // Official artist metadata decoded from #settime-artist-data on the 2026
  // set-time pages, captured 2026-09-10. Keys are exact printed set billings.
  // B2Bs stay one schedule row; their member profiles remain nested here.
  // DMZ and Friends is intentionally absent: the payload identifies its only
  // profile as "DMZ News Official", an unresolved identity collision.
  const OFFICIAL_ARTIST_DATA = {
  "deadmau5": {
    "setName": "deadmau5",
    "artists": [
      {
        "name": "deadmau5",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/04/17215602/e24f237a-6d37-11ee-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/04/17215602/e24f237a-6d37-11ee-b991-0ee6b8365494-150x150.jpg",
        "bio": "Joel Zimmerman, more commonly known as deadmau5 (pronounced 'dead mouse'), is one of the world's most respected electronic music producers of modern times. Enjoying international chart success with his 2x platinum-certified single \"Ghosts 'n' Stuff,\" as well as \"Professional Griefers,\" \"Sofi Needs A Ladder\" and \"I Remember,\" he has also released seven critically acclaimed albums. The multiple JUNO Award-winning and GRAMMY®-nominated artist's ability to push the boundaries of his talent grows at an equal rate to his fan base, which counts 15 million and more over his combined social media channels. His latest music offerings include “Pomegranate” with The Neptunes, “Bridged By A Lightwave” with Kiesza, “Channel 43” with Wolfgang Gartner, “Hypnocurrency” with REZZ, “When The Summer Dies” with Lights, “Hyperlandia” featuring Foster The People, “this is fine.” with Portugal. The Man, “XYZ” and “My Heart Has Teeth” featuring Skylar Grey which appears on the Resident Evil soundtrack from the Netflix Series.\nIn 2022 deadmau5 teamed with longtime friend and collaborator Kaskade on new music project Kx5 releasing Top 40 smash and #1 dance music radio single “Escape” featuring Hayla and \"Take Me High.\"  In the live realm, his 2019/20 U.S. cubev3 tour featuring production of his own design and implementation ranked in the Top 10 of Pollstar’s top tours globally. This year he returns to the road for the ‘We Are Friends’ North American tour and as Kx5 will be headlining the Los Angeles Memorial Coliseum in December.  Beyond his music career, he is also a co-founder of gaming venture PIXELYNX and is an executive of HD streaming platform StreamVoodoo.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/deadmau5",
          "soundcloud": "https://soundcloud.com/deadmau5",
          "instagram": "https://instagram.com/deadmau5/",
          "spotify": "https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx",
          "twitter": "https://twitter.com/deadmau5",
          "website": "http://www.deadmau5.com/"
        }
      }
    ]
  },
  "Deorro": {
    "setName": "Deorro",
    "artists": [
      {
        "name": "Deorro",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/06/21212613/d9e1f3c0-3014-11ef-954e-0ecc81f4ee58-972x597.png",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/06/21212613/d9e1f3c0-3014-11ef-954e-0ecc81f4ee58-150x150.png",
        "bio": "For over a decade, Los Angeles-born and bred producer Deorro, or Erick Orrosquieta by name, has transcended musical styles, international borders, and broken cultural barriers with his genre-defying expertise. Armed with the same songwriting mastery and musical fluidity of his formative years as a bedroom producer and local hero, Deorro is now a globally-certified, chart-topping, platinum-selling artist.\nThe world was introduced to Deorro’s signature style in 2013 via “Yee” – his first major label release signed to Hardwell’s Revealed Recordings. A foreshadowing of greatness, “Yee” charted worldwide across Austria, Belgium, France, Germany, The Netherlands, and Switzerland. Deorro crossed over into the mainstream landscape in April 2014 with his groundbreaking single “Five Hours.” A quantum leap in his career, the track was a testament to his formidable sound design and dedication to sonic excellence. Equipped with warping crescendos, futuristic beats, and cerebral soundscapes, “Five Hours” went on to become a worldwide success charting in multiple countries including a #8 spot on SNEP official French Singles Chart and peaked at #1 on Billboard’s Dance Airplay chart. Like a detonated grenade, “Five Hours” initiated a seismic wave of non-stop momentum leading to a series of accolades including a guest cameo on MTV’s Teen Wolf and a commendable ranking in DJ Mag's Celebrated Top 100 DJs annual poll at #19 – the highest new entry of 2014. That same year, Deorro released his spanish hit “Perdoname” featuring DyCy and Adrian Delgado which garnered over 53 million plays across streaming platforms, won Best Latin American DJ at the EMPO Awards and now stands as a 2x Platinum record.\nBreaking into spaces outside of dance music, In 2015, Deorro teamed up with Grammy Award-winning R&B icon Chris Brown for their critically acclaimed track “Five More Hours.” The collaborative hit accelerated Deorro’s career to an unprecedented upward trajectory with the chart-topping track receiving more than 19 global certifications, 330 million Spotify streams, and over 200 million YouTube views and counting. A proud Mexican-American and voice for the Latin music community, his Latin/EDM hybrid single “Bailar” is now an 8x Platinum-certified hit that went on to win Latin Billboard’s Tropical Song of The Year along with a subsequent recording with esteemed musical legend and performer Pitbull.\nAn amalgamation of years of success and collaborative excellence, Deorro’s 2017 debut album Good Evening brought together the sounds, styles, and influences that levitated him to fame. Signed to Ultra Music, Good Evening is a versatile venture into sound-design. A conceptual LP with a staggering 24 tracks, the project is equipped with intros, outros, interludes, and story-telling. A narrative outline of the many subgenres that make-up the spectrum of dance music, Good Evening captures the wonders of future bass, dubstep, jazz-swing, and more. The album stacked a laundry list of accolades ranking high in the Apple Music Dance Album charts around the world, including #1 in two countries, #4 in France, #19 in Australia, and reached the Top 50 in Apple Music’s overall chart across six countries. With releases spanning major labels like Interscope, Spinnin’ Records, Mad Decent, and more, sync deals with 22 Jump Street, Zac Efron’s We Are Your Friends, and MTV’s Teen Wolf, additional collaborations with Steve Aoki and Diplo, and appearances at globally-esteemed festivals like Tomorrowland, Coachella, Lollapalooza, Parrokavile and World Club Dome in Germany and performances at venues like Shrine Auditorium, an ongoing residency at Marquee Nightclub Las Vegas and appearances across Ibiza, Deorro has become a decorated asset to the global dance music community.\nEmbracing the heart of his roots, 2022 was another groundbreaking year for Deorro courtesy of his well-received debut Latin LP ORRO. The engaging 19-track album, written entirely in Spanish, bridges the gap between mainstage electronic music and Latin dance music while simultaneously expanding on and innovating his signature style. The Billboard-praised album was followed by his 60-date worldwide Tour De ORRO tour including a string of Los Angeles shows which sold 8500 tickets in just one weekend. If partnering with the Men's Mexican National Soccer team for an 8-date concert series leading to the World Cup wasn’t enough, Deorro also took his live performance to the NFL to dominate a Thursday night half-time show for the Los Angeles Rams. A sought-after collaborator, Deorro performed as direct support for Bad Bunny on his World's Hottest tour, partnered with Tiesto to release “Savage” which garnered 33 million streams in 8 months, and fashioned an official remix for Pitbull’s “Discoteca” which he performed live at Premio Lo Nuestro where he was nominated for DJ Del Año – DJ of The Year.\nWith a fearless dedication to crafting intercultural hits and dissolving the boundaries of geography with music, Deorro has already released his 4-track EP Reflect in January of 2023 and will continue transforming the Latin-dance landscape for years to come.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/Deorro",
          "soundcloud": "https://soundcloud.com/deorro",
          "instagram": "https://www.instagram.com/deorro/",
          "spotify": "https://open.spotify.com/artist/6VD4UEUPvtsemqD3mmTqCR",
          "twitter": "https://twitter.com/deorro",
          "website": "http://deorro.com"
        }
      }
    ]
  },
  "James Hype": {
    "setName": "James Hype",
    "artists": [
      {
        "name": "James Hype",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/08/15071939/27efc096-79a8-11f0-954e-0ecc81f4ee58-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/08/15071939/27efc096-79a8-11f0-954e-0ecc81f4ee58-150x150.webp",
        "bio": "James Hype is arguably one of the UKs most important artists with his bootlegs and remixes consistently forming the cornerstone UK and international dance floors, alongside his singles regularly clocking tens of millions of streams, being accredited sales awards in the UK, and across Europe approaching half a billion cumulative streams worldwide.\nThis success, and James’ larger than life presence across social media and on the road have allowed him to regularly tour up and down the UK’s clubs and festivals, as well as appearing internationally in hot spots including Ibiza, Australia, Germany, Dubai and France to name a few, with dedicated US tours throughout the year. James has also enjoyed arena shows, which include Echo Arena (Liverpool), MEN Arena (Manchester), SSE Wembley (London) and the O2 Arena (London).\nJames Hype continues to be one of the UKs most prolific remixers, with highly esteemed official remixes of top artists, including Meduza, Joel Corry, Rita Ora, Anne-Marie and Bruno Mars amassing over one hundred million streams.\nFollowing his signing with The Cross Records/ Island Records UK, leading with his single ‘Afraid’ featuring HARLEE, and his follow up ‘Good Luck’ featuring Pia Mia, James Hype continues to secure daytime play listing, tens of millions of streams, and further establishing himself in the US. In between this and his forthcoming third single into his tenure at The Cross Records, James has returned to his roots in the clubs with a string of Beatport top 10 club releases including a collaboration with Vintage Culture and a number 1 chart single with Tita Lau.\nWith this, bigger remixes, bigger collaborations and a new tour dates worldwide including a two month US tour planned, James Hype is set to return and remain at the top of UK dance music and solidify his place as a trendsetter and chart mainstay.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/jameshypethedj",
          "soundcloud": "https://soundcloud.com/jameshypethedj",
          "instagram": "https://www.instagram.com/jameshype/",
          "spotify": "https://open.spotify.com/artist/43BxCL6t4c73BQnIJtry5v",
          "twitter": "https://twitter.com/JamesHYPE"
        }
      }
    ]
  },
  "JSTJR": {
    "setName": "JSTJR",
    "artists": [
      {
        "name": "JSTJR",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/04/25234536/933d838a-f3d2-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/04/25234536/933d838a-f3d2-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "JSTJR is here with one mission: MAKE TECHNO FUN AGAIN. No gatekeeping, no judgment, no uniform—just unmatched vibes that will turn even the most suspicious raver into a techno fan. Inspired by his time throwing illegal underground warehouse parties in LA, JSTJR has become a leading voice in the resurgence of rave-inspired techno sounds currently proliferating dance music around the world. His expertise in mixing and blending genres keeps fans on their toes and makes for absolutely addicting live sets and music releases. When he’s not touring the globe, JSTJR runs a record label and monthly party “Group Chat” with Insomniac, bringing the newest and hottest sounds to LA and the rest of the world.\nCurrently, JSTJR is taking his vision worldwide with his highly anticipated Techno Playground tour, which has been a massive success. Selling out or nearing capacity in nearly every city, this tour is proving that JSTJR’s unique approach to techno resonates with fans on a global scale. With high-energy, genre-defying performances, JSTJR’s Techno Playground is redefining the techno world, bringing the underground to the masses.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/Jstjr/",
          "soundcloud": "https://soundcloud.com/jstjr",
          "instagram": "https://www.instagram.com/JSTJR/",
          "spotify": "https://open.spotify.com/artist/5SNvvu3C0tFHMXcih3NdiP",
          "twitter": "https://twitter.com/JSTJR"
        }
      }
    ]
  },
  "Malaa": {
    "setName": "Malaa",
    "artists": [
      {
        "name": "Malaa",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/02/01162950/e49b4d04-f1de-11ed-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/02/01162950/e49b4d04-f1de-11ed-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "DJ and producer Malaa has embraced his shrouded identity since he came onto the scene in 2015 and plays off of his anonymity in his balaclava-clad persona and regular releases of mixes on Soundcloud titled “Who Is Malaa”.\nMalaa first began releasing music on Tchami’s Confession label with his debut Illicit EP in 2016 followed by his massive single “Notorious\" - and has not slowed down since. Along with his steady flow of releases, Illegal Mixtapes, and NO REDEMPTION (Tchami x Malaa) project, Malaa is well known for remixes including “Oh Me Oh My(feat. Travis Scott, Migos & G4ish),” “Mind (feat. Kai)” for Major Lazer and Tchami’s “Afterlife (feat. Stacy Barthe).”\nMalaa tours extensively along with the Pardon My French crew and has performed alongside DJ Snake, Tchami, Rezz, Mercer, and more. He plays global festivals including Ultra Music Festivals, Holy Ship!, Creamfields, Breakaway, HARD Summer Music Festivals, Moonrise, Spring Awakening and EDC.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/malaamusic/",
          "soundcloud": "https://soundcloud.com/malaamusic",
          "instagram": "https://www.instagram.com/malaamusic/",
          "spotify": "https://open.spotify.com/artist/7w1eTNePApzDk8XtgykCPS",
          "twitter": "https://twitter.com/Malaamusic"
        }
      }
    ]
  },
  "SABAI": {
    "setName": "SABAI",
    "artists": [
      {
        "name": "SABAI",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/01/19181345/ee377130-04ec-11f0-b991-0ee6b8365494-972x597.png",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/01/19181345/ee377130-04ec-11f0-b991-0ee6b8365494-150x150.png",
        "bio": "Emerging as one of the most recent breakthrough artists in electronic music, SABAI combines Future Bass, House, R&B, and Pop to craft a sound that’s as emotionally powerful as it is melodically captivating. Since his debut with the renowned Canadian label Monstercat, SABAI has captured global attention with over 55 million YouTube views and 145 million Spotify streams. Tracks like ‘Million Days’, ‘North Star,’ ‘Daydream,’ and ‘Memories’ have become anthems for fans seeking songs that reflect themes of love, resilience, and self-discovery. His name, SABAI — meaning ‘comfortable’ in Thai — reflects the essence of his music, which brings comfort and connection to fans worldwide.\nFrom headlining sold-out shows in legendary venues like Academy LA, Midway SF, and New York’s Bowery Ballroom, to performing at some of the world’s biggest festivals like Electric Daisy Carnival Las Vegas, Vision and Color in China, and Together Festival in Thailand, SABAI has made his mark on the global stage. In 2024, he debuted a full live band experience including his iconic electric guitar performances at the Hollywood Palladium for over 3,500 fans—a first for this rising star and a glimpse into his vision for live electronic music.\nThrough collaborations with artists like Elephante, Ridgely, Linney, Casey Cook, and Fuslie, SABAI’s music connects across genres, offering layers of emotion and authenticity. Recently, he launched his debut album North Star on his own label, IKIGAI, continuing to break boundaries as he builds a lasting presence in electronic music. With even more music slated for release in 2025, SABAI’s journey is only beginning, and his fans are eagerly following each step of his evolution.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/sabaiofficial",
          "soundcloud": "https://soundcloud.com/sabaimusic",
          "instagram": "https://www.instagram.com/sabaimusic/",
          "spotify": "https://open.spotify.com/artist/4OaSyxqlkp7aVpAZwF02QZ",
          "twitter": "https://twitter.com/sabai_music"
        }
      }
    ]
  },
  "GRAVAGERZ": {
    "setName": "GRAVAGERZ",
    "artists": [
      {
        "name": "GRAVAGERZ",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/10/10015347/8bd2988c-a57b-11f0-85a0-0a58a9feac02-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/10/10015347/8bd2988c-a57b-11f0-85a0-0a58a9feac02-150x150.webp",
        "bio": "In 2020, Gravagerz signed a management contract with Hajriz Bajrami (Leaf Music Management) at the age of 17. His early releases included \"Look Back at It\" on B1\r\nRecordings, as well as remixes for Regard x Ella Henderson and Era Istrefi.\r\nHis breakthrough came with \"Chihiro\" originally a remix of Billie Eilish's song on SoundCloud, which went viral on TikTok and Instagram, amassing over 200 million combined streams and\r\n1.2 million video creators using the track.\nAfter replacing the vocals, he officially released it as his own version.\r\nFollowing this success, he secured an official remix of Quavo and Lana Del Rey's \"Tough\" followed by another official cover release of Disclosure and London Grammar's \"Help Me Lose My Mind\", which garnered over 50 million streams and 50,000 video creators on social media.\nIn April 2025, Gravagerz released \"Pool\" featuring Kiki Wera, marking his first record to chart in the UK Top 100, reaching 15 million combined streams and inspiring 20,000 video creators.\r\nHis remixes frequently go viral on TikTok, with multiple tracks exceeding 50,000 video creators, including Drake's \"Time Flies,\" A$AP Rocky's \"Fukk Sleep,\" and WizzTheMC's \"Show Me Love\"/p>",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/gravagerzarchive",
          "instagram": "https://www.instagram.com/gravagerz",
          "spotify": "https://open.spotify.com/artist/2zoy9aYWHueNXCIqh2MStc?si=QsUxXJGeTy2A7VqkCkaAxg"
        }
      }
    ]
  },
  "Flava D": {
    "setName": "Flava D",
    "artists": [
      {
        "name": "Flava D",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/05/13002955/grltsUwjytAPFTNyimVRzxLnddUqIfnIbVKunJ1A-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/05/13002955/grltsUwjytAPFTNyimVRzxLnddUqIfnIbVKunJ1A-150x150.jpeg",
        "bio": "On the face of it, the Bournemouth born Flava D’s outlook on her career seems pretty simplistic: she likes to make music, constantly. And although there’s undoubtedly a whole lot more planning and thought that goes into the thinking behind the timing and positioning of her releases, she’s maintained the purity of that initial enthusiasm and it’s helped her go from selling bundles of short loops on Myspace to headlining club nights and festivals and releasing well received album projects (such as her FABRICLIVE 88 mix and the t q d album ukg) in a matter of six short years.\nEver since the appearance of ‘Hold On’, her 2013 debut release on the Butterz label, Flava D’s ably established herself as a player working in that furtive arena where garage, grime and bassline music intersects. More than adept at making the wonderfully smooth and bumpy UKG of tracks like ‘More Love’, she’s also demonstrated a knack for producing harder hitting club cuts like ‘In the Dance’ and her remix of ‘Rhythm & Gash’. It’s precisely that kind of widened scope she explored and demonstrated to the fullest in the making of FABRICLIVE 88 when she set herself the task of producing 90% of the music used on the mix herself.\nAs a core part of the Butterz camp she’s found a crew that’s positively blossomed from the incorporation of her music and as a result of that relationship she’s collaborated with luminaries like Wiley and My Nu Leng, toured the globe and [possibly more importantly] been afforded a position where she’s encouraged to just make music, constantly.",
        "socialLinks": {
          "website": "http://flavad.com/",
          "soundcloud": "https://soundcloud.com/flava_d",
          "facebook": "https://www.facebook.com/FlavaDMusic",
          "twitter": "https://twitter.com/flavad"
        }
      }
    ]
  },
  "Shima": {
    "setName": "Shima",
    "artists": [
      {
        "name": "Shima",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03014245/755babb2-5eed-11f1-8769-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03014245/755babb2-5eed-11f1-8769-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/shimamusic/?hl=en"
        }
      }
    ]
  },
  "Svdden Death": {
    "setName": "Svdden Death",
    "artists": [
      {
        "name": "Svdden Death",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2018/02/16195225/91b90480-8b0b-11ed-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2018/02/16195225/91b90480-8b0b-11ed-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "Bay Area native Daniel Howland, better known as SVDDEN DEATH, is an electronic music producer and DJ renowned for his heavy, unnerving, experimental dubstep anthems, and shocking on-stage antics. Well known for fabled projects such as VOYD, Summoning of the Eclipse, MELLODEATH, Masterhand, and Deadroom, to name a few, SVDDEN DEATH has proven to be one of the preeminent musicians standing out in a scene notorious for its noise, smoke, and mirrors.\nGrowing up, Danny would spend his formative years listening to Deathcore, Trance, and electro/big house, sparking his musical interest and ultimate induction into music production. Years prior to starting the SVDDEN DEATH project, he would begin producing under previous aliases with influences including Skrillex, Burial, Porter Robinson, Aphex Twin, and Alice Glass. His musical pursuits would eventually find him moving out to LA not long after the SVDDN DEATH project’s conception, where he would get involved in the underground scene performing at key venues such as The Union, Belasco, Los Globos, and more.\nOwing partly to his rising hype within the underground dubstep community, SVDDEN DEATH would release his first EP, “Spelljam,” on Never Say Die’s “Black Label” imprint in 2017, including the leading single “Marauders.” This followed closely by his early hit single “Take Ya Head Off” would propel the then 24-year-old producer to an underground legend, with massive acclaim from his peers for his unique sound. Following up with yet another hit, “Shut ‘Em Down,” with fellow artist Yakz that same year, he would set off on his debut co-headline tour of the same name. Answering the call originally put out with his first EP, SVDDEN DEATH would return with his sophomore EP “Junkworld” in 2018.\nUnable to slow down, Danny would send ripples through the EDM community with the reveal of his long-secret side project “VOYD” and the surprise 2018 release of “VOYD Vol. I” to massive success. Earning tens of millions of plays, the hit single “Behemoth” would go on to be possibly the first dubstep bass line that would be sung by crowds the world over at shows and festivals alike. His quick rise would turn the head of superstar DJ Marshmello, releasing their collaboration “Sell Out” in 2019, the name being a slight wink to pairing with an artist widely regarded as a pop star. With only a few cameos as the alias, VOYD would eventually debut at The Palladium Ballroom, in Los Angeles in 2020. What would follow would set the standard for live VOYD performances, dramatically revealing the project with a meticulously crafted levitation stunt and solidifying VOYD as the quintessential audio-visual experience of the electronic music scene.\nFollowing the massive success of the full launch of his VOYD project, 2022 would see SVDDEN DEATH drop the next installment of the VOYD story with “VOYD Vol. II,” a 5-act, 18 track epic taking fans on an hour-long journey through the mind of the artist. This expansion of the VOYD mythos would ultimately be the launchpad for his subsequent Summoning of the Eclipse Festival hosted at The Caverns later that year. With the dubstep community at his back, the seemingly unstoppable rockstar would reunite with long-time friend and pop star of his own making, Marshmello, for a historic back-to-back performance at EDC Las Vegas 2023 to widespread fan acclaim. In response, the two would release the fully realized MELLODEATH project with “MELLODEATH Vol. I” and the subsequent, massively successful, self-titled tour in 2024.\nBoth revered and inspired by his peers, including SYZY, YVM3, Marauda, Nimda, Phiso, Aweminus, Neonix, Execitioner, Vanfleet, and more, SVDDEN DEATH has proven to be a champion of true artists and artistry, taking every opportunity to spotlight up and comers and established musicians alike with his many curated events. With accolades including double headlines at festivals such as Ultra Miami, EDC Las Vegas, Rampage, Audiotistic, Ilesoniq, and more, SVDDEN DEATH is undoubtedly an artist at the forefront of his craft and is only getting started.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/suddendeath/",
          "soundcloud": "https://soundcloud.com/svddendeath",
          "instagram": "https://www.instagram.com/svddendeath/",
          "spotify": "https://open.spotify.com/artist/2u01kCKA5wDvvztuH8lyT0",
          "twitter": "https://twitter.com/suddendeathdub",
          "website": "https://svddendeath.com/"
        }
      }
    ]
  },
  "NGHTMRE": {
    "setName": "NGHTMRE",
    "artists": [
      {
        "name": "NGHTMRE",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/05/07212410/a3a76bfa-73d4-11f0-954e-0ecc81f4ee58-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/05/07212410/a3a76bfa-73d4-11f0-954e-0ecc81f4ee58-150x150.webp",
        "bio": "Tyler Marenyi, better known as NGHTMRE, has cemented his place as a leading force in modern electronic dance music and beyond. Based in Los Angeles, the producer, DJ, and label owner first skyrocketed to fame in 2015 when Skrillex premiered his then-unreleased track “Street” during Ultra Music Festival’s main stage—an iconic moment that set the stage for NGHTMRE’s meteoric rise.\nOver the past decade, NGHTMRE has become a heavyweight across EDM and hip-hop, co-founding the Gud Vibrations label with SLANDER and collaborating with an impressive roster of artists, including ZHU, The Chainsmokers, Gunna, Tory Lanez, A$AP Ferg, and Dillon Francis. Known as a true innovator, NGHTMRE’s immersive sets combine intricate sound design, unconventional samples, and field recordings, creating unforgettable experiences for his audiences.\nFrom his tenured residency at Hakkasan Las Vegas, to headlining festivals like Coachella, Bonnaroo, Ultra, and Electric Forest, NGHTMRE has electrified audiences worldwide. His global reach extends to marquee events like EDC Mexico, Tomorrowland, and Lollapalooza in Brazil, Chile, and France, as well as performances at iconic venues such as the Bill Graham Civic Auditorium, Terminal 5, and Los Angeles’s Grand Park.\nIn 2023, NGHTMRE expanded his creative boundaries, collaborating with REZZ, Knock2, and Big Gigantic—culminating in the debut of Gigantic NGHTMRE. This followed the release of his 18-track deluxe edition of DRMVRSE, a conceptually driven album paired with a mini-documentary exploring the project’s themes. As his ambitious Sonic Wars B2B North American tour wraps into 2024, NGHTMRE is gearing up for another explosive year with new music and worldwide performances on the horizon.\nCelebrating this milestone, NGHTMRE released 10 Years of NGHT, a coffee table book chronicling his journey from underground sensation to global icon. The visually stunning collection showcases the evolution of his artistry, offering fans a rare glimpse into the creative process behind his unforgettable live shows, innovative productions, and collaborations.\nLooking ahead, NGHTMRE is preparing to unveil his next full-length LP, MIND FULL. On the surface, the album serves up good vibes while taking a playful jab at our internet-addled brains. It’s both a call to unplug from the hyper-scrolling, brain-numbing digital reality and an invitation to escape into the NOW—filling your mind with the raw, unfiltered beauty of real life. At its core, MIND FULL is a cathartic experience, an opportunity to rage and release from the overwhelming chaos of modern existence, offering listeners both an emotional outlet and a path toward presence.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/nghtmre",
          "soundcloud": "https://soundcloud.com/nghtmre",
          "instagram": "https://instagram.com/nghtmre",
          "spotify": "https://open.spotify.com/artist/76M2Ekj8bG8W7X2nbx2CpF",
          "twitter": "https://twitter.com/NGHTMRE",
          "website": "https://nghtmre.com/"
        }
      }
    ]
  },
  "INFEKT B2B Virtual Riot": {
    "setName": "INFEKT B2B Virtual Riot",
    "artists": [
      {
        "name": "INFEKT",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/10/18002449/949b9496-636d-11f0-843a-0ee6b8365494-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/10/18002449/949b9496-636d-11f0-843a-0ee6b8365494-150x150.webp",
        "bio": "Christian Fial, better known as INFEKT has been producing since 2011, focusing on minimalistic, yet energetic basslines. He has released his music with the labels Disciple, Circus Records, NSD: Black Label, SMOG and much more. Which has gained support by numerous popular artists such as Kill The Noise, Cookie Monsta, Funtcase, 12th Planet etc. His previous live performances include sets at events like Drop In Bass, Night Grinderz, Havoc and Royal Bass. Be on the lookout as it's rumored that INFEKT is spreading to North America.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/infektdubstep/",
          "soundcloud": "https://soundcloud.com/infektdubstep",
          "instagram": "https://www.instagram.com/infektdubstep/",
          "spotify": "https://open.spotify.com/artist/3I6KMDdmPiLE5UQ4XF8Kpl",
          "twitter": "https://twitter.com/infektdubstep"
        }
      },
      {
        "name": "Virtual Riot",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/07/09220454/3b90e544-3e3f-11ef-954e-0ecc81f4ee58-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/07/09220454/3b90e544-3e3f-11ef-954e-0ecc81f4ee58-150x150.jpeg",
        "bio": "Virtual Riot is one of the most sought-after producers worldwide and is considered one of the most popular representatives of the dubstep scene. He is known for his unique productions and intense, elaborately produced shows.\nLast year, he was part of Justin Bieber’s album track “2 Much,” which was nominated for a Grammy. At the Loud Cave Awards 2021, Virtual Riot won the categories of Best Electronic Album, Best Bass Artist, and Best Bass Track. Not only has he received several awards for his outstanding sample packs from Splice, which were downloaded more than 5 million times, but he is also a star on the YouTube platform when it comes to production tutorials. His unique sense for sound development has brought his sounds to well-known Disney+ series and streaming hits like “Star Wars – The Mandalorian,” just as an example.\nThe German but Los Angeles-based producer has managed to effortlessly combine classically trained musicianship with top-notch sound design, reaching a wide fan base across the genre without sacrificing a level of authenticity that appeals to the fundamentals of both extremes. His album “Simulation,” which was released in 2021, was a huge success and was accompanied by an album tour across America, ending with his sold-out headline show at the famous Hollywood Palladium in Los Angeles.\nHe is a global touring artist performing at the biggest festivals in the world such as EDC, Coachella, Tomorrowland, Lost Lands, Rampage, Bassrush, and many more. Virtual Riot is Beatport’s best-selling artist of all time in the genre of dubstep and has gained 400k+ followers on YouTube with more than 1 million streams of his music per day. In the DJ Mag Top 100 DJ’s, the biggest DJ poll in the world, Virtual Riot is ranked 78th and has worked with the likes of Skrillex, Getter, and Kill The Noise, along with remixes for Zedd, The Chainsmokers, Flux Pavilion, Excision, and Pegboard Nerds.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/virtualriotmusic",
          "soundcloud": "https://soundcloud.com/virtual-riot",
          "instagram": "https://www.instagram.com/officialvirtualriot/",
          "twitter": "https://twitter.com/Virtual_Riot"
        }
      }
    ]
  },
  "Kompany B2B Samplifire": {
    "setName": "Kompany B2B Samplifire",
    "artists": [
      {
        "name": "Kompany",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/08/02220010/a35c3bee-8109-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/08/02220010/a35c3bee-8109-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "In a scene divided between rail riders waiting for the heaviest drop and stage hoppers seeking out the most technical sounds, Los Angeles bass DJ/producer Kyle Hagberg (aka Kompany) rises above with one foot firmly planted on each side. A former sound designer for Cymatics, Hagberg delivers meticulously crafted basses packaged as festival music, creating a distinct dubstep style many have tried to emulate over the years.\nKompany has collaborated with bass music giants such as Excision, SLANDER, Subtronics and Sullivan King, and was once name dropped by ILLENIUM as one of his favorite heavy artists. Some of Kompany’s most recognized tracks are his anthemic collaborations with fellow briddim godfather Wooli, notably 2018’s “Thicc Boi.”\nHis 2021 Untouchable Tour marked Kompany’s first run of headline shows, with him performing at over 30 clubs and festivals across the United States and Canada, including a coveted main stage slot at Lost Lands. In 2022 he did a worldwide festival run and joined a handful of higher ticket tour packages to warm up to headline bigger rooms in 2023.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/Kompanymusic/",
          "soundcloud": "https://soundcloud.com/kompanymusic",
          "instagram": "https://www.instagram.com/kompanymusic/",
          "spotify": "https://open.spotify.com/artist/7dtX3ykcuyVmts2HQnWgSP",
          "twitter": "https://twitter.com/Kompanymusic",
          "website": "https://kompanymusic.com/"
        }
      },
      {
        "name": "Samplifire",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2019/05/18004912/fdb72f64-6370-11f0-843a-0ee6b8365494-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2019/05/18004912/fdb72f64-6370-11f0-843a-0ee6b8365494-150x150.webp",
        "bio": "In the ever changing bass music scene, France native Samy Beyou known as Samplifire has risen TO the forefront of modern dubstep. Inspired by legends such as Noisia, Rusko & Skrillex, he started producing bass music in high school with a love for innovative sound design, potent basslines and fresh grooves. He rapidly gained recognition amongst the scene by releasing his first EP's on the iconic labels Never Say Die and Disciple plus his collaborations with Svdden Death, Barely Alive and Wooli to name a few.\nSince hitting the dubstep scene, Samplifire has been touring all over the world including multiple headline tours in North America. Renownedly known as one of the top producers, 2023 was no different with his tracks, Menticide (w/ YAKZ) and Firestorm topping beatport charts, and being played out at almost every dubstep show you can go to. In 2024 Samplifire can be seen touring around the globe from plays in Europe to North America at festivals such as Rampage, Beyond Wonderland, and many more TBA.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/SampliFire/",
          "soundcloud": "https://soundcloud.com/samplifire",
          "instagram": "https://www.instagram.com/samplifire/",
          "twitter": "https://twitter.com/Samplifire"
        }
      }
    ]
  },
  "Hybrid Minds": {
    "setName": "Hybrid Minds",
    "artists": [
      {
        "name": "Hybrid Minds",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2020/09/25234818/f4952c78-f3d2-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2020/09/25234818/f4952c78-f3d2-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "Masters of their own musical and soulful style, Hybrid Minds are at the very forefront of the thriving contemporary Drum & Bass renaissance and have been an undeniable influence on the genre since they broke through in 2011.\nThe UK duo’s signature style of subtle songcraft, evocative vocals, and natural ingredients has taken the scene by storm and led to a whole range of incredible accomplishments and successes. As performers, they continue to hit new levels, from their own headline show at Wembley Arena to selling out London’s iconic Alexandra Palace in just 24 hours.\nAs producers, they’ve amassed a high-grade A-list of collaborations with inspiring songwriters and vocalists such as venbee, Grace Grundy, Dan Fable, Tom Walker, Birdy, Charlotte Plank, Charlotte Haining, Lily Denning, and Grimm (to name a few). They have written three remarkable albums: Mountains (2013), Elements (2017), and their highly anticipated third album, Tides, set for release in March 2024.\nTheir most accomplished album to date, Tides features two 2023 anthems, “If Love Could Have Saved You” and “Lights.” Both tracks hit well over a million streams within weeks of release. With their continued success, Hybrid Minds are set to remain at the forefront of the thriving contemporary D&B movement for a long time to come.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/hybridmindsdnb/",
          "soundcloud": "https://soundcloud.com/hybridminds",
          "instagram": "https://www.instagram.com/hybridmindsdnb/",
          "twitter": "https://twitter.com/HybridMindsDNB",
          "website": "https://hybridmindsmusic.com/"
        }
      }
    ]
  },
  "Jkyl & Hyde B2B Nikita, the Wicked": {
    "setName": "Jkyl & Hyde B2B Nikita, the Wicked",
    "artists": [
      {
        "name": "Jkyl & Hyde",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2019/06/07194409/56f153ec-54f5-11ef-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2019/06/07194409/56f153ec-54f5-11ef-b991-0ee6b8365494-150x150.jpg",
        "bio": "half man /// half monster",
        "socialLinks": {
          "facebook": "https://www.facebook.com/JkylxHyde/",
          "soundcloud": "https://soundcloud.com/jkylxhyde",
          "instagram": "https://www.instagram.com/jkylxhyde/",
          "twitter": "https://twitter.com/jkylxhyde"
        }
      },
      {
        "name": "Nikita, the Wicked",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/01/25192400/e27a40a8-db51-11ef-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/01/25192400/e27a40a8-db51-11ef-b991-0ee6b8365494-150x150.jpg",
        "bio": "welcome to the dark side of my bizarre mind\nSan Francisco-based producer/DJ Nikita, the Wicked is defying the conventions of electronic music. Nikita strives to create honest, forward-thinking music by “finding the beauty in the imperfect, the elegance in the twisted, the grace within the chaos.” From Salvador Dali to MF Doom, Nikita’s brand centers around the beautiful darkness the creates with his music, ignited by his passion for both surrealistic visual art and a plethora of international cultures. Dance music needed a villain, and Nikita picked up the call.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/p/Nikita-the-Wicked-61560950248084/",
          "soundcloud": "https://soundcloud.com/nikitathewicked",
          "instagram": "https://www.instagram.com/nikitathewicked/",
          "spotify": "https://open.spotify.com/artist/0Kc65Qv0ju9H2cMNnP3Tqd",
          "twitter": "https://x.com/nikitathewicked"
        }
      }
    ]
  },
  "Sippy": {
    "setName": "Sippy",
    "artists": [
      {
        "name": "Sippy",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/03/12071449/7cf6535c-07e2-11f1-8ff3-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/03/12071449/7cf6535c-07e2-11f1-8ff3-0a58a9feac02-150x150.jpg",
        "bio": "SIPPY is a Sydney-born bass music powerhouse whose name has become synonymous with fearless sound design, unapologetic intensity, and stage-commanding energy. Now based in Los Angeles, the ICON Collective alum continues to carve her own lane with her most recent release Scars in Stereo (Deadbeats, 2025) - her long-awaited debut album that captures both her raw power and emotional evolution as an artist.\nSIPPY’s entered the next phase of her artistic evolution. Scars in Stereo showcases a more personal and vulnerable side of her artistry while elevating her technical production skills and emotional range. She continues to showcase raw storytelling, and bold bass design in a way unique to SIPPY.\nShe’s a proven favorite on labels like Deadbeats, Bassrush, and UKF, and with official remixes for The Chainsmokers, Zeds Dead, and Marshmello under her belt, SIPPY continues to push boundaries. With an extensive tour itinerary ahead, and appearances at high profile festivals, 2026 marks a bold new chapter for one of bass music’s most compelling voices.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/sippyau/",
          "soundcloud": "https://soundcloud.com/sippyau",
          "instagram": "https://www.instagram.com/sippyau/",
          "spotify": "https://open.spotify.com/artist/4LLYqe8ogaK9wC1xHlvR5S",
          "twitter": "https://twitter.com/SippyAu"
        }
      }
    ]
  },
  "Wolfie": {
    "setName": "Wolfie",
    "artists": [
      {
        "name": "Wolfie",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/09/26213953/5f9227e2-ac3e-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/09/26213953/5f9227e2-ac3e-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "facebook": "https://www.facebook.com/wolfiesounds/",
          "soundcloud": "https://soundcloud.com/musicbywolfie",
          "instagram": "https://www.instagram.com/WolfieSounds/"
        }
      }
    ]
  },
  "CALLEN B2B SEKTOR 8": {
    "setName": "CALLEN B2B SEKTOR 8",
    "artists": [
      {
        "name": "CALLEN",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/05/15163024/68f4a5a6-806a-11f1-b22a-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/05/15163024/68f4a5a6-806a-11f1-b22a-0a58a9feac02-150x150.jpg",
        "bio": "What's your DNA?\nCALLEN is a biological evolution on another level: leveraging forward-thinking production skills, otherworldly live performances, and a master's touch of cinematic horror, CALLEN has engineered a loyal following of fans and peers alike. A proud Icon Collective College of Music alumnus, CALLEN was a dutiful student and \"Scientist of Sound\" under the tutelage of EDM's best and brightest. CALLEN’S music has been heard live on the biggest stages around the world. Early in his career, CALLEN’S song “Bittersweet” bio-hacked into the mainstage soundsystem at EDC Las Vegas. \"Bittersweet\" then went on to be played 13 times on the live broadcast of the NBC Winter Olympics & Paralympics in Beijing, China. The international attention cemented CALLEN as a serious artist with international intentions. CALLEN takes pride in showcasing fresh, unusual, and experimental ideas, in both audible and visual dimensions of his musical experiment. Seamlessly splicing diverse genres and stitching vivid narratives with his physical mystique and intense musical storytelling, CALLEN stands as an unstoppable force defying the laws of nature. His evolution is not slowing down anytime soon.\nMusic is in his DNA and CALLEN is ever mutating.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/CALLENMUSICOFFICIAL",
          "instagram": "https://www.instagram.com/callen_music/",
          "soundcloud": "https://soundcloud.com/callenmusic",
          "x": "https://x.com/CALLEN_MUSIC"
        }
      },
      {
        "name": "SEKTOR 8",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/15163304/ce4cc5e4-5eed-11f1-81d2-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/15163304/ce4cc5e4-5eed-11f1-81d2-0a58a9feac02-150x150.jpg",
        "bio": "SEKTOR 8 is more than just heavy bass music... it's reality, reprogrammed.\nFusing soaring soundscapes, fissure-inducing bass, and wildly unpredictable switch-ups, SEKTOR 8 is a musical experience electronically engineered to shatter spacetime in real-time.\nConceived in the underground of Orlando, Florida, and unleashed as a conquering menace in Los Angeles, SEKTOR 8 has invaded stages with the biggest names in bass music including: Crankdat, Sullivan King, Ray Volpe, Ubur, Ghengar, Hol!, PhaseOne, Saymyname, Dodge & Fuski, Borgore, Eliminate and many, many more.\nFrom the largest stages in LA, to historic clubs across global international scenes. Every performance pushes the boundaries of the SEKTOR 8 sound and experience.\nIn this new reality only one thing is certain: audiences do not leave the same as they arrived. And they always come back wanting more.",
        "socialLinks": {
          "instagram": "https://www.instagram.com/sektor8official/",
          "spotify": "https://open.spotify.com/artist/70Y4DkKGQVp56oEbSp4fBH"
        }
      }
    ]
  },
  "Green Velvet": {
    "setName": "Green Velvet",
    "artists": [
      {
        "name": "Green Velvet",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/14222234/gvUi9xz0474rZQtSK1h0GhfS2EpeKdKsB04KjBWp-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/14222234/gvUi9xz0474rZQtSK1h0GhfS2EpeKdKsB04KjBWp-150x150.jpeg",
        "bio": "Change has been a constant theme throughout the successful career of Green Velvet, but as he has crossed genres, explored themes from the comedic to the serious and changed monikers, the common thread running through the music he has made for nearly two decades is its roots in and dedication to the Chicago House sound.\nHis first transformation came when he left master's degree studies in chemical engineering at UC-Berkeley to turn a hobby into a career making music, influenced by the sounds he had been exposed to as a science-fiction-loving, video-game-playing kid whose father was a part-time Chicago DJ.\nAs Cajmere, he released his inaugural 'Underground Goodies EP' in 1991 on his Cajual label, keeping true to the early House sound. He quickly followed it up the next year with the smash hit 'Coffeepot (It's Time for the Percolator)'.\nNot one to rest on his success, he soon changed things up, teaming with vocalist Dajae for 'Brighter Days', a more mellow House tune, this one released by Emotive. That pairing would be his last with a female vocalist until his recent partnership with rapper Kid Sister for 'Everybody Wants'.\nThe 17 years in between those two projects witnessed an incredible array of electronic music emanating from this prolific artist, as well as a second label under his direction,Relief. Adopting the persona Green Velvet (not to mention a Day-Glo shock wig) for his techno-oriented pieces and DJ appearances, he became the champion of new wave Chicago beats through the '90s-known best for hits such as 'Preacher Man', 'Flash' (a No. 1 U.S. dance hit in 1995), and 1997s laugh-inducing 'Answering Machine' The decade ended with his first album, 'Constant Chaos' in 1999.\nThe new century brought a compilation album, Green Velvet, during a brief signing with Warner Bros. Records' short-livedF-111 imprint, and a production album, 'Whatever', on Relief. The punk-inspired 'Whatever' explored darker themes than his previous work, including racism ('When?'), drug use ('Genedefekt' and 'La La Land'), alienation ('Sleepwalking') and bending to authority ('Gat').\n'La La Land' went on to become by far the biggest selling track of his career. His live act expanded as he began playing a keytar, with two other musicians - Nazuk and Spaceboy - backing him, playing heavily distorted synths.\nThe last decade also saw Green Velvet become a fan favorite across Europe, playing to huge crowds at festivals in addition to live radio appearances and club gigs. Numerous side projects and remixes under various names also added to his seemingly nonstop musical output.\nIn 2005, Green Velvet released his third album, 'Walk In Love', which stayed true to the House sound, with a few pop and punk-oriented tracks for good measure, including 'Come Back' and 'Pin-Up Girl' both of which featured a live guitarist.\nThe ongoing evolution in the music, career and life of the artist born Curtis Alan Jones in Chicago has been and will continue to be fascinating to watch and experience for his many followers.",
        "socialLinks": {
          "website": "http://www.green-velvet.com",
          "soundcloud": "http://soundcloud.com/green-velvet-1",
          "facebook": "http://facebook.com/GreenVelvetFanpage",
          "twitter": "http://twitter.com/GreenVelvet_"
        }
      }
    ]
  },
  "Partiboi69": {
    "setName": "Partiboi69",
    "artists": [
      {
        "name": "Partiboi69",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/03/26000336/8df852da-12a6-11f1-8046-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/03/26000336/8df852da-12a6-11f1-8046-0a58a9feac02-150x150.jpg",
        "bio": "Spiritual leader, Icon, Prophet – that's for others to say. Partiboi69's only objective is to spread digital love and deliver lethal 69 techniques live and direct to your senses. Described on the Internet as “symbol of mutual love and mystery of the Australian underground,” Partiboi69 is as advertised, without compromise. CEO of Mutual Pleasure Records and Stingboi Productions, Partiboi69 fuses cutting edge, computer-animated graphics with the sounds of Electro Dank, Ghetto Freak and K-Tech, to create a portal into his complex mind; A place where comfort and style are paramount, no stimulant is safe, and enjoyment is always mutual. The most explicit samplings of this are “Freaky Dreamz”, “Magnificent” and “Always Keep It 69”, as well as his technologically-advanced live mix broadcasts, as visually pleasurable as they are aurally – much like 69ing. Three million viewers have already converted; Will you be next?",
        "socialLinks": {
          "facebook": "https://www.facebook.com/Partiboi69/",
          "soundcloud": "https://soundcloud.com/partiboi69",
          "instagram": "https://www.instagram.com/partiboi69/",
          "spotify": "https://open.spotify.com/artist/0CutULGVZ24wOr1HHYoEOL",
          "twitter": "https://x.com/partiboi69",
          "website": "https://partiboi69.com/"
        }
      }
    ]
  },
  "Patrick Topping": {
    "setName": "Patrick Topping",
    "artists": [
      {
        "name": "Patrick Topping",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/01/22191009/e028a82c-00db-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/01/22191009/e028a82c-00db-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "As one of the breakout artists of his generation, British artist Patrick Topping has contributed a constant flow of positivity to the culture he loves so dearly, becoming one of the scene’s most popular DJs in the process. At the root of his incredible success are several core principles; passion for the music, a deep rooted desire to cultivate community, impeccable technical skills and a genuinely warm, friendly disposition. Driven by these fundamental elements Patrick has attained international status as a headline act, with an illustrious discography and a blossoming label and party brand. As he continues to inject his energy into refining his craft and building his own crew of talented acts, Patrick is entering a new level of artistry…\nSince his early days as a key member of Jamie Jones’ Hot Creations family, Patrick has demonstrated his prowess in the studio and on stage. With Jamie acting as a mentor and releasing Patrick’s debut EP in 2013, he quickly ascended through the ranks, becoming a resident at Jamie’s Paradise parties at DC-10, landing himself other high-profile shows in Ibiza and across the rest of Europe and the world. He’s gone on to play many of the world’s most influential clubs from Fabric London, Warung Brazil and Space Miami, to festivals including Coachella, Glastonbury, Awakenings, Ultra, and Tomorrowland. Patrick has been awarded three DJ Awards, one DJ Mag ‘Best of British’ Award and as a selector, prides himself on keeping the energy levels high, while ensuring that he spins a variety of styles.\nProduction-wise, early hits such as ‘Forget’ (2014 Ibiza Track Of The Season) and collaboration with Chicago legend Green Velvet – ‘Voicemail’ (2014) established his ability to produce high-grade dance floor weaponry. Leading to his last original work with Hot Creations – the massive ‘Be Sharp Say Nowt’ (2017) going on to become certified silver in the UK in 2021. But rather than stick with a formula, Patrick decided to invest his creative energy into exploring other styles; channeling his eclectic tastes into a variety of releases and launching his label Trick in 2019, a platform he has used to present a broader representation of himself as an artist.\nIn recent years he’s collaborated with house and techno legend Kevin Saunderson on ‘Frisk’ and has remixed high-profile artists including The Streets, Sam Fender, Robyn and Calvin Harris, also reworking house classics such ‘Don’t Call Me Baby’ by Madison Avenue and Paul Johnson’s ‘Dance with Me’, among others.\nHe’s dipped into house, techno, electro and disco, diversifying his output with a firm focus on enjoying the creative process. This is evident in every release, there’s a distinct flow of energy and an upbeat feeling that emanates from Patrick’s music. His dedication to the art of making music has resulted in an extended period of exploration during lockdown, including very personal developments such as releasing two tracks with his wife’s vocals, ‘New Reality’ and ‘Disco Hits’, as well recording his own debut vocals for the upcoming concept EP – Planet Session.\nIn 2019 he launched Trick, a label and event brand, set up to provide a platform for his own music and to act as an incubator for up-and-coming artists, as well as a home for established acts. Trick is now over 30 releases deep, with 11 of those being the artists’ debut release with a record label. The label has also been graced by more established artists, Will Clarke, Justin Jay and Gerd Janson among them. The Trick events are characterised by a focus on bespoke production, with careful consideration given to the visual presentation, as well as impeccable curation of some of the biggest and most cutting-edge names in the scene, from Floorplan, Ellen Allien, Luciano to Fjaak, alongside a host of label acts and residents. Whilst partnering with premiere promoters in key cities, such as Terminal V in Edinburgh and Thick As Thieves in Melbourne. The launch tour of five shows, starting with his hometown of Newcastle and The Warehouse project Manchester, Amsterdam ADE, Derry and London, was attended by over 18,500 people.\nWith his experience as a member of the Hot Creations crew, Patrick has been steadily cultivating a community around Trick. From the lesser-known artists he has signed and championed, to the regulars at his parties, there’s an innate desire to use his position to bring people together and give back to the culture he loves so much. Just as he was mentored by Jamie Jones, Patrick is now committed to passing on his knowledge and experience to younger artists. He’s formed a close bond with Elliot Adamson for instance, releasing some of his music and bringing him in to help with A&R. As well as seeing potential in the likes of Ewan McVicar and Ammara and welcoming them into the Trick family as residents and regulars on the label.\nStill driven by the same pure, concentrated energy that inspired him as a raver, Patrick Topping is relishing the opportunity to live out his dreams while also keeping his feet firmly on the ground. A hard working, humble and visionary artist, he is bound to continue making an invaluable contribution to club culture; whether he’s on the decks, in the studio or through the new generation of young acts he’s bringing up with him…",
        "socialLinks": {
          "facebook": "https://www.facebook.com/patricktoppingdj/",
          "soundcloud": "https://soundcloud.com/patricktopping",
          "instagram": "https://www.instagram.com/patricktopping/",
          "spotify": "https://open.spotify.com/artist/7yRimuQSC5Ks3T2Ts0iyZa",
          "twitter": "https://twitter.com/Patrick_Topping",
          "website": "https://www.patricktopping.co.uk/"
        }
      }
    ]
  },
  "Ragie Ban": {
    "setName": "Ragie Ban",
    "artists": [
      {
        "name": "Ragie Ban",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/10/28213637/247d4f4a-b446-11f0-9aba-0a58a9feac02-1-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/10/28213637/247d4f4a-b446-11f0-9aba-0a58a9feac02-1-150x150.webp",
        "bio": "Ragie Ban, a talented DJ and electronic music producer, is gaining prominence in the Brazilian and international music scene. With only 22 years of age and three years of experience, Ragie has accumulated an impressive curriculum, with the support of great artists and releases on renowned record companies. His music transcends genres, combining elements of techno, house and other electronic styles. Recognized for his skill, Ragie has won fans all over the world. With a solid base of followers and promising collaborations, Ragie is prepared to reach new heights in the electronic scene.",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/ragieban",
          "instagram": "https://www.instagram.com/ragieban/",
          "spotify": "https://open.spotify.com/artist/7lz52Oe1rAo5DwfSRwFsQL"
        }
      }
    ]
  },
  "Fleur Shore": {
    "setName": "Fleur Shore",
    "artists": [
      {
        "name": "Fleur Shore",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/03/03010738/b4d5aa5e-b95f-11ed-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/03/03010738/b4d5aa5e-b95f-11ed-b991-0ee6b8365494-150x150.jpg",
        "bio": "Refusing to conform to the norm and never following the formulas that work for others, there are already glimpses from the early stages of Fleur Shore’s career that she is very much an artist leading from the front.  Fleur’s sources of inspiration knows no boundaries, and her productions ooze infectious basslines, captivating vocals, and an investment of passion to resurrect the sounds from yesteryear with her own unique twist. Her attention to detail in the studio has caught the attention of likes of The Martinez Brothers and Archie Hamilton, which have resulted in releases on Cuttin' Headz, Boogeyman and Moscow.  As a DJ, her appreciation for the art of the warm-up set, technical ability, and an open minded approach to playing different genres secured her a residency at iconic clubbing institution Lab11 for flagship underground party TRMNL. Fleur also made impressive debuts at Fabric, The Warehouse Project, Ushuaïa as well as heading to South America, France, Italy & Holland. So it's safe to say the next few years and beyond look extremely promising for this talented young artist.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/FleurShoreDJ/",
          "soundcloud": "https://soundcloud.com/fleur-shore",
          "instagram": "https://www.instagram.com/fleur_shore/?hl=en",
          "spotify": "https://open.spotify.com/artist/7GyRA9n7JVslQGcbo72Dil",
          "twitter": "https://twitter.com/fleur_shore"
        }
      }
    ]
  },
  "M-High": {
    "setName": "M-High",
    "artists": [
      {
        "name": "M-High",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/02/10191406/272d35b4-e7e3-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/02/10191406/272d35b4-e7e3-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "facebook": "https://www.facebook.com/MHighMusic/",
          "soundcloud": "https://soundcloud.com/mhighmusic",
          "instagram": "https://www.instagram.com/mhighmusic",
          "spotify": "https://open.spotify.com/artist/5lNjdR9GxHHF3twNE6ayJW"
        }
      }
    ]
  },
  "Braydon Terzo": {
    "setName": "Braydon Terzo",
    "artists": [
      {
        "name": "Braydon Terzo",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/04/02211541/005804a8-2ed9-11f1-9425-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/04/02211541/005804a8-2ed9-11f1-9425-0a58a9feac02-150x150.jpg",
        "bio": "Braydon Terzo is a 25-year-old DJ, producer, and label owner carving his own path in the underground electronic music scene. Born in California and now based in Phoenix, Braydon is part of the new wave of American club artists redefining the underground soundscape. Drawing from his upbringing steeped in alternative rock and punk, he infuses his productions with a dark, glitchy twist to house music that brings a fresh energy to the dance floor.\nBraydon gained recognition with his breakout hit Minty, earning worldwide support from industry icons and airplay at renowned venues such as Space Miami and Circoloco Ibiza. With releases on labels such as Nervous Records, Coco UK and Muse, Braydon’s music was backed by artist like Cloonee, Chris Lake, Sosa, Chris Stussy, and Mau P, further solidified his reputation as an artist to watch. In 2025, he launched his own record label, Roots, debuting with Paula Abdul, which reached the number 1 spot on the Minimal/Deep Tech Beatport.\nAs he continues to break boundaries and push his sound forward, Braydon Terzo is firmly establishing himself as a leading voice in the next generation of underground music.",
        "socialLinks": {
          "instagram": "https://www.instagram.com/braydonterzo/",
          "spotify": "https://open.spotify.com/artist/7aPGojZ1i1CpRKa83QyUTq"
        }
      }
    ]
  },
  "Trainer Red": {
    "setName": "Trainer Red",
    "artists": [
      {
        "name": "Trainer Red",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03014655/1079bcce-5eee-11f1-b4a4-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03014655/1079bcce-5eee-11f1-b4a4-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/trainer_reddd"
        }
      }
    ]
  },
  "Basstripper": {
    "setName": "Basstripper",
    "artists": [
      {
        "name": "Basstripper",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/01/13065524/69f91d22-e9d7-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/01/13065524/69f91d22-e9d7-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "facebook": "https://www.facebook.com/BTdnb/",
          "soundcloud": "https://soundcloud.com/basstripper",
          "instagram": "https://www.instagram.com/basstripper/",
          "spotify": "https://open.spotify.com/artist/1tSiIyp5dxfbEaS0nZGMEl"
        }
      }
    ]
  },
  "Subsonic": {
    "setName": "Subsonic",
    "artists": [
      {
        "name": "Subsonic",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/07/17223438/2b38e5f8-635e-11f0-843a-0ee6b8365494-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/07/17223438/2b38e5f8-635e-11f0-843a-0ee6b8365494-150x150.webp",
        "bio": "",
        "socialLinks": {
          "facebook": "https://www.facebook.com/subsonicuk",
          "instagram": "https://www.instagram.com/subsonicuk/",
          "spotify": "https://open.spotify.com/artist/4D6frglSGSAHoK7W5rp92j"
        }
      }
    ]
  },
  "Reid Speed": {
    "setName": "Reid Speed",
    "artists": [
      {
        "name": "Reid Speed",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/04/30033646/c4ea7d60-4445-11f1-a012-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/04/30033646/c4ea7d60-4445-11f1-a012-0a58a9feac02-150x150.jpg",
        "bio": "To fans throughout the world, the name Reid Speed is synonymous with the legacy of American Drum & Bass and the history of the North American Heavy Bass movement. Consistently ranked as one of America’s top DJ’s, she’s known for her straight up skills on the decks, effortlessly mixing between genres on the fly. Her Speed of Sound podcast reaches thousands of listeners each month, while her original productions consistently land in high profile placements and top DJ’s sets alike, and keep her fans excited with their ever-evolving styles. Her award-winning Play Me Records label has introduced more top talent than any of it's kind and solidified Reid’s place in the industry as a respected tastemaker and curator.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/djreidspeed/",
          "soundcloud": "https://soundcloud.com/REIDSPEED",
          "instagram": "https://www.instagram.com/reidspeed/",
          "spotify": "https://open.spotify.com/artist/4AWFMJDettE5RFgwCW2moD",
          "twitter": "https://x.com/reidspeed"
        }
      }
    ]
  },
  "Oscar Da Grouch": {
    "setName": "Oscar Da Grouch",
    "artists": [
      {
        "name": "Oscar Da Grouch",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/06/25013544/zHul2NI5pE1aPQbK0b7tB6ErNz1lTuXHe80M6TOB-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/06/25013544/zHul2NI5pE1aPQbK0b7tB6ErNz1lTuXHe80M6TOB-150x150.jpeg",
        "bio": "",
        "socialLinks": {}
      }
    ]
  },
  "Ed Bailey": {
    "setName": "Ed Bailey",
    "artists": [
      {
        "name": "Ed Bailey",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/03/27220646/d414bc00-3b46-11f0-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/03/27220646/d414bc00-3b46-11f0-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "From the early days of sharing a residency with dj Dimitri and spinning with Todd Terry to more recent endeavors with Kylie Minogue opening for her US concerts, Ed Bailey has spent the last thirty years amassing some serious dj credentials. He has played major clubs, huge party weekends, dark, small, sweaty underground venues, and 10,000 person concert venues across multiple continents. He has held residencies at every major club in his hometown of Washington DC for the last 30 years - including Tracks, Ozone, Millennium, Cobalt, Nation, and Town. For two decades, he has been known for offering a varied style of music and is often recognized as a big room, big anthem, big vocal dj which is why he held residencies at major dance clubs like Tracks, VelvetNation, Salvation in Miami, both Fusion and Jungle in Atlanta, and played annually for the NYC Pride fireworks dance cruise...yet Bailey has his roots in underground, serious house music which is why he djed at the legendary after-hours club 1722 in Baltimore on Pride weekend annually, why he was asked by Junior Vasquez to fill in for him on occasion in NYC and even open for Junior on New Year's Eve at the Roxy, and why he opened for The Freemasons for their very first US appearance.",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/djedbailey",
          "twitter": "https://twitter.com/edbaileydc"
        }
      }
    ]
  },
  "Steve Loria": {
    "setName": "Steve Loria",
    "artists": [
      {
        "name": "Steve Loria",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/05/25235816/vlvGSlaBfYBNxO3buPy73TAyF3Q9RZfu2Q7iR15y-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/05/25235816/vlvGSlaBfYBNxO3buPy73TAyF3Q9RZfu2Q7iR15y-150x150.jpeg",
        "bio": "West coast legendary DJ, considered by most as one of the driving forces responsible for the start of the Los Angeles electronic music scene and an integral part in the development of the West Coast house scene as a whole. For the last 25 years Steve has traveled the globe playing along side many of the world’s premier djs in many of the world’s top clubs. Steve has headlined countless of legendary clubs and events such as, Together as One, Bang the Drum, Electric Daisy Carnival, Unlock the House, By the People, The Gathering, and Freedom Festival. His most extraordinary moments include a 5 hour sunrise set overlooking the Pyramids of Teotihuacan in Mexico City, spinning techno-house tunes to a massive crowd inside the Brooklyn Bridge, and who could forget his wicked 4 hour set in the middle of the Nevada Desert, for Desert Move Las Vegas. Steve Loria never stops expanding his sound, embracing the future, and respecting the past. We ask all new jacks and old school heads to join us and celebrate the true spirit of the Los Angeles underground!",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/steveloria",
          "facebook": "https://www.facebook.com/djsteveloria",
          "twitter": "https://twitter.com/steveloria",
          "instagram": "https://www.instagram.com/steveloria"
        }
      }
    ]
  },
  "Steve Leclair": {
    "setName": "Steve Leclair",
    "artists": [
      {
        "name": "Steve Leclair",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/04/30034406/c9ac39e6-4446-11f1-a152-0a58a9feac02-1-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/04/30034406/c9ac39e6-4446-11f1-a152-0a58a9feac02-1-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/djsteveleclair/"
        }
      }
    ]
  },
  "Woof Logik": {
    "setName": "Woof Logik",
    "artists": [
      {
        "name": "Woof Logik",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/11201803/77631928-282f-11ef-954e-0ecc81f4ee58-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/11201803/77631928-282f-11ef-954e-0ecc81f4ee58-150x150.jpeg",
        "bio": "Michael Granados and Miguel Meza, better known as Woof Logik, have been in the game for over 7 years. The two Los Angeles/Fontana natives have been pushing the boundaries with their sound and aren't afraid to tap into any genre. With an album release & EP's on record label Barong Family, there's no denying they aren't afraid to bring heavy bass, insane bounce energy, & banging techno beats. Nonetheless, these two have brought a breath of fresh air into the EDM community, having accumulated over 2 Million combined streams. Not to mention providing some of the most memorable curated set lists at festivals and venues across the U.S. alongside Yellow Claw, Showtek, ZHU, Alison Wonderland, 4B & Diesel. With all the support from the biggest names in the scene, you can expect Woof Logik to be up next!",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/wooflogik",
          "instagram": "https://www.instagram.com/wooflogik/?hl=en"
        }
      }
    ]
  },
  "Dack Janiels B2B Mongrel": {
    "setName": "Dack Janiels B2B Mongrel",
    "artists": [
      {
        "name": "Dack Janiels",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/06/03021941/71a54f50-3c4c-11ec-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/06/03021941/71a54f50-3c4c-11ec-b991-0ee6b8365494-150x150.jpg",
        "bio": "Tanner aka Dack Janiels was born in the bay area of Northern California and raised on a strict diet of skateboarding. After discovering dubstep, Dack honed his production skills and set out to craft his own blend of music- gaining support from leading industry figures such as Excision, 12th Planet, & Subtronics- leading to placements on NSD: Black Label, Bassrush, Subsidia, Disciple Round Table, & Rottun Records.   Dack is also co-owner/founder of the 40oz Cult- a Los Angeles collective, a label imprint and merch line that also serves as a collective for producers, skateboarders, and artists.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/DackJaniels666/",
          "soundcloud": "https://soundcloud.com/dackjaniels",
          "instagram": "https://www.instagram.com/dackjaniels/",
          "spotify": "https://open.spotify.com/artist/4F8JGeO6bJO7Z309mxHlP0",
          "twitter": "https://twitter.com/dackjanielsdub"
        }
      },
      {
        "name": "Mongrel",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/05/30200652/d8da6108-1ebf-11ef-b991-0ee6b8365494-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/05/30200652/d8da6108-1ebf-11ef-b991-0ee6b8365494-150x150.jpeg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/mongrel_dubz/"
        }
      }
    ]
  },
  "Hekler": {
    "setName": "Hekler",
    "artists": [
      {
        "name": "Hekler",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2018/02/08172558/Vnsyz1oBZJqgtfYo7E3p6biOeBK8QFWtDxL1N5Fn-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2018/02/08172558/Vnsyz1oBZJqgtfYo7E3p6biOeBK8QFWtDxL1N5Fn-150x150.jpeg",
        "bio": "Hekler (real name Shaun Bacus) has always taken a unique approach to his music. Toiling away tirelessly in the studio, Hekler brings a prolific pallet of influences, spanning hip-hop to bass music, ambient pieces and much more. He looks to masters of their craft, like Lorn, Mike Dean, Lisa Bella Donna and Clams Casino, to propel his robust productions forward. His cornerstone tracks like “Astral featuring Jeleel,” “Transparency,” and “404” afford listeners a look at what can happen when bass volatility and expert composition live in explosive harmony. Harrowing bass, bouncy toplines, and genuine artistry all live under one roof in Hekler’s house. Industry support continues to pour in for Hekler, alongside collaboration recruits from Ekali, GRAVEDGR, YOOKiE and more.With high-profile sightings at EDC, HARD Summer, Bonnaroo, Red Rocks, Rampage Festival, Escape—just to name a few—Hekler’s keeping ears perked cross-continentally. In early 2023 one of his most important, undertaking yet, his debut LP ABYSS on Bassrush Records, followed by his most recent body of work; ‘HEK SZN’ EP also out on Bassrush Records released Oct 2023. Hekler continues to have one lucid, overarching goal: to harness each ounce of artistic background and wisdom at his disposal. At the top of 2024 his release with OddKidOut ‘Original Steppa’ featuring Scruffizer has already garnished wide support, receiving Bass Arcade cover on Spotify on release day and several other editorial playlist support.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/heklermusic/",
          "soundcloud": "https://soundcloud.com/heklermusic",
          "instagram": "https://www.instagram.com/heklermusic/",
          "spotify": "https://open.spotify.com/artist/4FoQJyBgyhdDCb1wdEgNZh",
          "twitter": "https://twitter.com/heklermusic",
          "website": "https://www.heklermusic.com/"
        }
      }
    ]
  },
  "Dances B2B Techno Tupac": {
    "setName": "Dances B2B Techno Tupac",
    "artists": [
      {
        "name": "Dances",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2018/02/13200228/b7464820-7ef5-11f1-b7d8-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2018/02/13200228/b7464820-7ef5-11f1-b7d8-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "facebook": "https://www.facebook.com/danceswithwhitegirls/",
          "instagram": "https://www.instagram.com/danceslife/",
          "soundcloud": "https://soundcloud.com/danceswithwhitegirls",
          "x": "https://twitter.com/dances",
          "spotify": "https://open.spotify.com/artist/1XwL3qdo0jPmliKRgxY5TL"
        }
      },
      {
        "name": "Techno Tupac",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/12/12223505/e1dd2384-290b-11ef-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/12/12223505/e1dd2384-290b-11ef-b991-0ee6b8365494-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/technotupacmusic",
          "instagram": "https://www.instagram.com/techno_tupac/",
          "spotify": "https://open.spotify.com/artist/3X84CtZn7kefjfUMlxU2vx"
        }
      }
    ]
  },
  "Kittamami B2B Tony H": {
    "setName": "Kittamami B2B Tony H",
    "artists": [
      {
        "name": "Kittamami",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/24235650/cf3c0208-68e9-11f0-954e-0ecc81f4ee58-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/24235650/cf3c0208-68e9-11f0-954e-0ecc81f4ee58-150x150.webp",
        "bio": "The Detroit-bred, LA-based house & techno DJ/producer is known for Blending Detroit's electronic heritage with her love for all the sounds of techno and house, Kittamami captivates crowds with empowering female vocals and themes, pushing limits, and forging a unique sonic path.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/KittamamiDJ/",
          "soundcloud": "https://soundcloud.com/kittamami",
          "instagram": "http://www.instagram.com/kittamami"
        }
      },
      {
        "name": "Tony H",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/05/16065223/ac584540-d4e4-11ec-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/05/16065223/ac584540-d4e4-11ec-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "Anthony Henderson, known professionally as Tony H is a Panamanian house & techno dj, who is currently based out of Seattle, WA. In 2015 he founded his own label Late Night Munchies which has already released dozens of original tracks and remixes by artists and contributors from all over the globe; and then in 2019 he launched the sub-label Munchies After Dark with the main focus being strictly Melodic House & Techno. The brand's regular shows featuring new music combined with Tony H's live performance skills and engaging personality has translated into a strong following of supporters. He also curates his own mix series called The Drive-Thru, which can be found on Soundcloud and iTunes and features guest mixes from djs and producers from all around the world; and is now a weekly stream via Twitch every Wednesday. Kevin Knapp had him on his “Artist to Watch in 2021” list in one of his latest interviews, and with releases on Dirtybird, Space Yacht, Desert Hearts, Wyldcard Records, Flashmob Records and more, he is well on his way.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/officialtonyh",
          "soundcloud": "https://soundcloud.com/dj-tonyh",
          "instagram": "https://www.instagram.com/djtonyh507/",
          "twitter": "https://twitter.com/DJTonyH507"
        }
      }
    ]
  },
  "THA4SAKEN": {
    "setName": "THA4SAKEN",
    "artists": [
      {
        "name": "THA4SAKEN",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/13234728/26a73ae8-7f15-11f1-9e52-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/13234728/26a73ae8-7f15-11f1-9e52-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/tha4saken/",
          "soundcloud": "https://soundcloud.com/tha4saken"
        }
      }
    ]
  },
  "Lily Ardalan": {
    "setName": "Lily Ardalan",
    "artists": [
      {
        "name": "Lily Ardalan",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/13200739/7268b0e8-7ef6-11f1-ae43-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/13200739/7268b0e8-7ef6-11f1-ae43-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/lilyardalan/",
          "soundcloud": "https://soundcloud.com/lilyardalan",
          "spotify": "https://open.spotify.com/artist/5bXwD14lVQ9ku78gq9Tt29",
          "website": "https://lilyardalan.com/about-me"
        }
      }
    ]
  },
  "NEDA(:": {
    "setName": "NEDA(:",
    "artists": [
      {
        "name": "NEDA(:",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/13201441/6e4ac0c2-7ef7-11f1-987e-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/13201441/6e4ac0c2-7ef7-11f1-987e-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/soundsofneda/",
          "soundcloud": "https://soundcloud.com/officialneda"
        }
      }
    ]
  },
  "Illenium": {
    "setName": "Illenium",
    "artists": [
      {
        "name": "Illenium",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/06/21185802/7d7bcf9c-636d-11f0-843a-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/06/21185802/7d7bcf9c-636d-11f0-843a-0ee6b8365494-150x150.jpg",
        "bio": "Denver-based producer ILLENIUM is one of the most successful crossover electronic artists today, topping the U.S. dance charts, garnering +5B streams and headlining the world’s top festivals.    Following his 2016 debut album, ‘Ashes,’ ILLENIUM broke into the mainstream via his 2017 album, ‘Awake,’ which includes his classics \"Crawl Outta Love,\" \"Fractures\" and \"Feel Good,\" with Gryffin ft. Daya. A critical and commercial success, ‘Awake’ topped the iTunes Top Electronic Albums Chart in 12 countries with +100M streams.    In 2019, ILLENIUM released ‘Ascend,’ his third full-length album and his major label debut. As one of the biggest electronic releases of the year (+1B collective streams), the album topped Billboard's Top Dance/Electronic Albums chart and secured a Top 20 hit on the Billboard 200. The album includes the hit tracks \"Takeaway\" with The Chainsmokers ft. Lennon Stella, \"Good Things Fall Apart\" with Jon Bellion, \"Crashing\" ft. Bahari, \"In Your Arms\" with X Ambassadors and “Take You Down,” which chronicles his past battles with drug addiction.    Recognized as one of Billboard’s Top Dance/Electronic Artists of the 2010s, ILLENIUM brings his dynamic music to life via his live show, which has dominated festivals like Coachella, Lollapalooza, Bonnaroo and EDC. His 2019 Ascend Tour, which featured a five-piece live band, sold out landmark venues like Madison Square Garden (NYC), STAPLES Center (L.A.) and three consecutive nights at Red Rocks Amphitheatre (Denver).",
        "socialLinks": {
          "facebook": "https://www.facebook.com/Illenium",
          "soundcloud": "https://soundcloud.com/illeniumofficial",
          "instagram": "https://www.instagram.com/illenium/",
          "spotify": "https://open.spotify.com/artist/45eNHdiiabvmbp4erw26rg",
          "twitter": "https://twitter.com/ILLENIUM",
          "website": "http://illenium.com/"
        }
      }
    ]
  },
  "Seven Lions": {
    "setName": "Seven Lions",
    "artists": [
      {
        "name": "Seven Lions",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/20190045/cbd56200-846b-11f1-95da-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/20190045/cbd56200-846b-11f1-95da-0a58a9feac02-150x150.jpg",
        "bio": "Producer Seven Lions has never had a problem breaking rules and transcending musical boundaries to satisfy his creative vision. Catching his break after winning a Beatport remix contest in 2012 with his dubstep-focused version of Above & Beyond's \"You Got to Go,\" Seven Lions, born Jeff Montalvo, garnered support from the likes of Anjunabeats, Casablanca Records, OWSLA, Viper Recordings, Republic Records, and Monstercat over the past nine years. The Seven Lions world continues to expand through Ophelia Records, his own melodic bass label that has made it's imprint through several scene-leading releases like Seven Lions, SLANDER, and Dabin Feat. Dylan Matthew -- First Time, Seven Lions & Jason Ross -- Ocean, Seven Lions, Excision, and Wooli Feat. Dylan Matthew - Another Me, and Seven Lions, Dabin, and Trivecta Feat. Nevve -- Island. The label has become synonymous with homegrown, cream of the crop melodic bass music, and is undoubtedly the label that the rest of the melodic bass scene looks towards for up and coming acts and tour worthy anthems.\nPutting sheer technical production prowess to work in soulful, deep, hybridized creations all distinctly his own, the multi-talented musician is single-handedly changing the sonic landscape for future generations to come by bridging the gap between the soaring, ethereal vibe of trance and intensely adrenalizing bass music. His productions have seen stages at world-renowned festivals such as Ultra Music Festival, Electric Daisy Carnival (New York and Las Vegas), Electric Forest, Electric Zoo, South by Southwest, and HARD. 2021 saw Seven Lions expand his growing universe via his Ophelia Records and Chronicles festival imprints.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/SevenLions",
          "instagram": "https://www.instagram.com/sevenlionsmusic/",
          "soundcloud": "https://soundcloud.com/seven-lions",
          "x": "https://x.com/SevenLionsMusic",
          "spotify": "https://open.spotify.com/artist/6fcTRFpz0yH79qSKfof7lp",
          "website": "http://sevenlions.com"
        }
      }
    ]
  },
  "SIDEPIECE": {
    "setName": "SIDEPIECE",
    "artists": [
      {
        "name": "SIDEPIECE",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2020/02/21221451/a1c66dfc-301b-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2020/02/21221451/a1c66dfc-301b-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "SIDEPIECE is the brainchild of Dylan Ragland (Party Favor) and Ricky Mears (Nitti Gritti). At only three years old, SIDEPIECE has already racked up some of the most prestigious awards in dance music, being nominated for a Grammy for Best Dance Recording in 2021, as well as having the #1 most supported dance record in the world in 2020, and achieving platinum and gold certifications in a dozen countries for their breakout hit \"On My Mind.\" The duo has rapidly become one of the most sought after house acts in the industry, playing some of the most iconic venues and festivals around the globe like Lollapalooza, EDC, Tomorrowland, Bonnaroo, HARD Summer, and more, and racking up over half a billion plays across their catalogue on streaming platforms to date.\nHighly esteemed producers in their own right, Party Favor and Nitti Gritti came together in 2019 to form SIDEPIECE and saw them unite their styles and help them earn a reputation for sliding between genres on the electronic music spectrum, whilst keeping firm footholds in the bass and trap worlds. Party Favor is Ragland's genre-bending bass project counting over 400 million streams and multiple chart toppers to his name globally, having collaborated with the likes of Gucci Mane, Baauer, Dillon Francis, A$AP Ferg, and more, and just released his sophomore artist LP RESET through Ultra featuring K.Flay, Lil Gnar, Elohim, Marc E.Bassy, and more. Whereas, Nitti Gritti is a 12x platinum, Latin Grammy Award and a Latin Billboard Music Award winning producer for his work on Bad Bunny's album 'x100pre' and the song \"200MPH,\" along with recently being given the #14 spot in the '2020 Best Producers' ranking.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/youasidepiece/",
          "soundcloud": "https://soundcloud.com/youasidepiece",
          "instagram": "https://www.instagram.com/youasidepiece/",
          "spotify": "https://open.spotify.com/artist/5czbzNZZfWpyFgZyfT3Mkk",
          "twitter": "https://twitter.com/youasidepiece"
        }
      }
    ]
  },
  "R3HAB": {
    "setName": "R3HAB",
    "artists": [
      {
        "name": "R3HAB",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/12234255/KMHHQCo54NwhVp6bD0Uz3LxQvvO56b4wMkKZVNbo-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/12234255/KMHHQCo54NwhVp6bD0Uz3LxQvvO56b4wMkKZVNbo-150x150.jpeg",
        "bio": "Multi-Platinum DJ and producer Fadil El Ghoul, better known as R3HAB has been trailblazing his way through dance music for the past fifteen years. From his breakthrough remixes for Rihanna, Drake, Taylor Swift, Calvin Harris, to anthems such as Platinum-certified \"All Around The World (La La)\" and \"Lullaby\" to his collaborations with the likes of Ava Max, ZAYN, Luis Fonsi, Sean Paul, and more, R3HAB has proven to be one of the most forward-thinking artists in the game. His work has collected over 8 billion streams to date, including 1.1 billion in 2021 alone. R3HAB founded his label CYB3RPVNK in 2016, which has passed 4 billion streams across platforms since its inception.\r\n\r\nR3HAB continues to evolve and diversify his sound by working with artists around the globe, pushing the boundaries of dance music as he collaborates across genres and languages. He is Spotify's Most Discovered Artist, one of Spotify's top 200 most streamed artists, ranked #12 on prestigious DJ Mag's Top 100 DJs chart, and has earned over 70 Gold and Platinum certificates. R3HAB has embarked on multiple sold-out worldwide tours and was the first dance music artist to sell out 15 consecutive shows in China. On top of that, he performed at the world's top festivals, such as EDC, Ultra Music Festival, Tomorrowland, Balaton Sound, Coachella, Summer Sonic Festival, DWP Jakarta. With his combination of innate artistry and innovative attitude,  has earned his place as a household name in dance music.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/r3hab/",
          "soundcloud": "https://soundcloud.com/r3hab",
          "instagram": "https://www.instagram.com/r3hab/",
          "spotify": "https://open.spotify.com/artist/6cEuCEZu7PAE9ZSzLLc2oQ",
          "twitter": "https://twitter.com/R3HAB",
          "website": "http://djr3hab.com"
        }
      }
    ]
  },
  "Said The Sky (Sunset Set)": {
    "setName": "Said The Sky (Sunset Set)",
    "artists": [
      {
        "name": "Said The Sky",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/08/14222915/bf0d89e4-db13-11ed-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/08/14222915/bf0d89e4-db13-11ed-b991-0ee6b8365494-150x150.jpg",
        "bio": "A blend of soaring melodies & emotive basslines, Said The Sky is an experience through music.\r\n\r\nPlaying piano and various instruments since the age of eight, Colorado native Trevor Christensen is coming forward with a fresh perspective on music. Bringing a melodic background and technical training into his work, he is able to capture everything beautiful in what people know as EDM. His music is what he hopes it to be, an experience: a captivating blend of moving basslines and soaring melodies. This is nothing you want to miss.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/saidthesky/",
          "soundcloud": "https://soundcloud.com/said-the-sky",
          "instagram": "https://www.instagram.com/saidthesky/",
          "spotify": "https://open.spotify.com/artist/4LZ4De2MoO3lP6QaNCfvcu",
          "twitter": "https://twitter.com/SaidTheSky",
          "website": "http://saidthesky.com/"
        }
      }
    ]
  },
  "CHYL": {
    "setName": "CHYL",
    "artists": [
      {
        "name": "CHYL",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/10/01194554/c2d6525a-26c4-11f0-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/10/01194554/c2d6525a-26c4-11f0-b991-0ee6b8365494-150x150.jpg",
        "bio": "CHYL is a Los Angeles-based electronic dance music producer who is quickly making a name for herself in the industry. Despite graduating with a finance degree from Columbia University, she abandoned a promising career in investment banking to pursue her passion for dance music production. Since then, she has been on a meteoric rise, winning over fans with her infectious personality and energetic tracks.\nAs a pioneer in the genre of 150bpm Speed House, CHYL has garnered support from a range of industry tastemakers, including Steve Aoki, Habstrakt, Ghastly, Wuki, JSTJR and many more. Her high-energy productions, characterized by their fast pace and bass-heavy beats, have earned her a dedicated fanbase and a growing reputation as one-to-watch in the years to come.\n2022 was a banner year for CHYL, marked by the international success of her viral remix of Kanye West's \"Mercy\" and her debut performance on the mainstage at Countdown festival. Her tracks have been featured on esteemed labels such as Monstercat, Bassrush, and Dim Mak, with the latter signing her in January 2023.\nWith her unique sound and relentless work ethic, CHYL is a force to be reckoned with and an inspiration to anyone who wants to pursue their dreams. Her journey from finance to dance music production is a testament to the power of following one's passions, and her success is a reflection of her dedication and hard work. She continues to blaze a trail in the industry, with no plans of slowing down anytime soon.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/itschyl/",
          "soundcloud": "https://soundcloud.com/chylofficial",
          "instagram": "https://www.instagram.com/itschyl/",
          "spotify": "https://open.spotify.com/artist/15HOfHbNWedCAcJ3Cm1mbc"
        }
      }
    ]
  },
  "Angrybaby": {
    "setName": "Angrybaby",
    "artists": [
      {
        "name": "Angrybaby",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/02/01225353/b421a434-c154-11ee-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/02/01225353/b421a434-c154-11ee-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "Angrybaby is a 25 year old Asian-American electronic music producer from Albany, CA. He grew up playing the classical piano, and started to make hip-hop beats in high school using GarageBand. After moving home to San Francisco post-college, Angrybaby experienced a second awakening of electronic music when he was introduced into the culture of DJing and began throwing weekly community events in the Bay Area. Becoming a scholar of its composition, arrangement, and theory; he took what he learned from DJing and how dance music was composed and applied it to his own craft. Coupled with his classically-trained foundation and love for dance music, Angrybaby is making dance music for tomorrow.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/angrybabywah",
          "soundcloud": "https://on.soundcloud.com/mxidL",
          "instagram": "https://www.instagram.com/angrybaby_music?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
          "spotify": "https://open.spotify.com/artist/5TAU3fcCF32FqKMrdbXfRr?si=_FWI4RqFTcmckMVK1mPxxA"
        }
      }
    ]
  },
  "Mattilo": {
    "setName": "Mattilo",
    "artists": [
      {
        "name": "Mattilo",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/07/12223742/cf6daeb2-409e-11ef-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/07/12223742/cf6daeb2-409e-11ef-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "After getting dropped by Universal at just 16 years old, 22-year-old DJ/producer Mattilo decided to go indie and take his career into his own hands.\nTiktok launched him globally, with over 100 million views on the platform in 2023 alone. Posting 10-second clips of unreleased songs, landed him a record deal with ALT:Vision, support from acts like Acraze, Loud Luxury & Martin Garrix.\nHis latest track SET ME FREE garnered over 7 million views within the first week it was posted, and is set to be his breakout into the Dance music scene.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/mattilomusic/",
          "soundcloud": "https://soundcloud.com/mattilo",
          "instagram": "https://www.instagram.com/mattilo/",
          "spotify": "https://open.spotify.com/artist/7gAYkHRXnXtaZk4QMJ5kJC",
          "twitter": "https://twitter.com/mattilomusic"
        }
      }
    ]
  },
  "Jordan Savage": {
    "setName": "Jordan Savage",
    "artists": [
      {
        "name": "Jordan Savage",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/09/09051415/216f4f00-ac0d-11f1-aab2-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/09/09051415/216f4f00-ac0d-11f1-aab2-0a58a9feac02-150x150.jpg",
        "bio": "Hailing from Denver, Colorado, Jordan Savage is a bass music producer and DJ who’s been crafting heavy-hitting soundscapes for over five years. In the Bass Capital, he is known for his high-energy tearout drops and vocal-driven melodub bangers, like his most recent release on Subsidia Records Dawn 11 album, \"Nirvana\".  Jordan has also released original tracks on prominent labels including Future Bass Records, Bass Boost, LFTD Global, Outertone Records, and more — steadily carving out a unique space in the global dubstep scene.\nOn stage, Jordan has brought his explosive live sets to some of Denver’s most iconic venues, including Larimer Lounge, The Black Box Mainroom, Church Nightclub and Temple Nightclub, igniting crowds with a blend of intensity, emotion, and original music.\nWith multiple label releases already scheduled and a vault of finished tracks ready to go, 2026 is shaping up to be a breakout year. Jordan’s future plans include taking the project beyond Colorado, with upcoming shows and ambitions to hit the festival circuit.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/jordansavagemusic",
          "instagram": "https://www.instagram.com/jordansavagemusic",
          "soundcloud": "https://soundcloud.com/jordansavagemusic",
          "spotify": "https://open.spotify.com/artist/5Hx7guHyCdhevHq0o5P3jn",
          "website": "https://jordansavagemusic.com/"
        }
      }
    ]
  },
  "Teddy Pain (T-Pain Bass Set)": {
    "setName": "Teddy Pain (T-Pain Bass Set)",
    "artists": [
      {
        "name": "T-Pain",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/09/26005329/qnpM0NnrggIMD0ObrKxW7qOLpAAo0EKMq75BuylJ-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/09/26005329/qnpM0NnrggIMD0ObrKxW7qOLpAAo0EKMq75BuylJ-150x150.jpeg",
        "bio": "With 60 hit songs under his belt and two Grammy trophies on his mantle, T-Pain has cemented himself as one of the most influential artists of all time. But even he needed a bit of time to himself to reload. After an eight year run of #1 hits, albums, tours and a plethora of cameo appearances, T-Pain found himself  living a life full of exactly what his name implies.\nUpon releasing his 2011 album rEVOLVEr, the “Rappa Ternt Sanga” took an abrupt, but well-deserved, break from the spotlight. But it wasn’t to enjoy his spoils. His non-stop lifestyle was beginning to take a toll on his personal life and it was beginning to affect his creative “I was becoming somebody that I didn’t like,” he says. “I was living an unhappy lifestyle and it started affecting my family. I was hurting and scaring a lot of people.” At the height of his career that included a popular smartphone app and a Super Bowl commercial, T-Pain decided to take a two year hiatus from releasing music. Where that would be a death knell for other artists, it wound up being a second birth for T-Pain. In the fall of 2013 a rejuvenated T-Pain returned with one of his biggest hits to date, the DJ Mustard-produced single “Up Down (We Do This All Day)” featuring B.o.B. After returning to his familiar spot in the top ten of  the charts for 28 straight weeks and counting, he’s continuing the comeback in 2014 going with the club smash “Drankin Patna.”\nHis fifth album, Stoicville: The Phoenix is scheduled to follow and T-Pain promises that it he’s back to being the artist that he originally intended to be.“I want to be able to say that I put out an album that I believed in and that I liked,” he says. “Every song on the album is something that came out of my heart.” With this refreshed spirit, T-Pain is now spanning the globe on his “I Am T-Pain” tour with dates selling out in the United States, Europe, Australia and all points in between. Where fans will surely recognize the music and appreciate the new energy, they will also see the external changes T-Pain has made as well. He’s lost much of the weight he put on during his down time and he even shaved off his trademarked dreadlocks. “That was one of the hardest things to change about me,” he admits. “But I figured that if I could make that big of a change, everything else would change immediately, and it did.”\nWith many artists in the marketplace building successful careers borrowing from a sound that T-Pain helped create, it’s only right that he return to claim his throne. Only this time, don’t expect him to take another break, he’s going as hard as ever.",
        "socialLinks": {
          "website": "http://tpain.com/",
          "facebook": "https://www.facebook.com/t-pain",
          "twitter": "https://twitter.com/TPAIN",
          "instagram": "https://www.instagram.com/tpain/"
        }
      }
    ]
  },
  "TroyBoi": {
    "setName": "TroyBoi",
    "artists": [
      {
        "name": "TroyBoi",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/01/25232037/dZLXAFPPFPBajY037WAJaJO1P6Dfs8WFf8fP1iOL-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/01/25232037/dZLXAFPPFPBajY037WAJaJO1P6Dfs8WFf8fP1iOL-150x150.jpg",
        "bio": "T-R-O-Y-B-O-I. These letters are chanted by the masses at his shows, but the question is who is the artist incorporating stunning visuals, live instruments, talented dancers, and those jaw dropping aerialists?\nTroy Henry, the elusive producer who has classified himself as a music manipulation specialist got his start making his beats standing up in his London studio apartment kitchen with his MacBook and a midi keyboard. Today, the TroyBoi Experience is indeed a musical journey of hard-hitting beats, lights, visuals, and the unexpected. While his musical style can be broadly classified as trap, it’s extraordinarily unique, versatile, and fuses various textures from multiple genres. He is of Nigerian, Indian, Chinese, and Portuguese descent, and credits this (along with growing up in London, with its own blend of cultures and genres) for the diversity that is reflected in his music. Beyond his career releases which include his debut album Left Is Right (2017) and series of V!BEZ EPs in 2018 and 19,  his productions have caught the ear of major music stars. His 2018 remix of Billie Eilish’s “MyBoi-TroyBoi Remix” has garnered almost 79 million Spotify streams and in 2019, Rihanna featured two of his songs “Do You?” and “Malokara” at her SavagexFenty show, seen globally via Amazon Prime during New York Fashion Week.  TroyBoi’s sound has evolved from when he began his musical journey to now headlining at some of the world's largest festival stages such as Coachella, Lollapalooza (Chicago & Paris), Life Is Beautiful, HARD, EDC China and Electric Zoo, Sunset Music Festival, just to name a few as well as holding down a new residency at Elia Beach Club in Las Vegas. While the music industry was at a stand still due to the pandemic, Troy was working on new music/collaborations to come back stronger and more innovative as ever once live music was back. And Boi did he. In 2020 released, his highly anticipated V!BEZ Vol.4 featuring top hits like, “Do You and “Bellz”\nOne of his first festival appearances post pandemic, was the long-awaited return of Outside Lands Music Festival in San Francisco, where Troy had one of the largest crowds in the history of the festival. In early 2021, he released more hits like , “Mad Ting, Buss It, and of course “RedEye” with Justin Bieber which currently has over 48 million streams on Spotify.\nIn 2022, Troy has been hard at work on a brand new EP and headlining more festivals and shows worldwide. Troy has a true love and inspiration for Latin Music and he has plans to pay homage to that in his next new EP titled “INFLUENDO”. He was inspired to complete this project due his reflection of his admiration for the culture during his travels throughout various countries.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/troyboimusic",
          "soundcloud": "https://soundcloud.com/TroyBoi",
          "instagram": "https://www.instagram.com/troyboi_music/",
          "spotify": "https://open.spotify.com/artist/0tvpihdAsKiNnP6sWS3jUI",
          "twitter": "https://twitter.com/TroyBoiMusic",
          "website": "http://www.troyboimusic.com/"
        }
      }
    ]
  },
  "Hedex": {
    "setName": "Hedex",
    "artists": [
      {
        "name": "Hedex",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/01/25230443/ddfb93fe-5bf7-11ee-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/01/25230443/ddfb93fe-5bf7-11ee-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "facebook": "https://www.facebook.com/hedexuk",
          "soundcloud": "https://soundcloud.com/hedexuk",
          "instagram": "https://www.instagram.com/hedexuk/",
          "spotify": "https://open.spotify.com/artist/22I9QWygJ2IfxR855VsA3t",
          "twitter": "https://twitter.com/hedexuk"
        }
      }
    ]
  },
  "LAYZ": {
    "setName": "LAYZ",
    "artists": [
      {
        "name": "LAYZ",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/07/18002952/48211072-636e-11f0-843a-0ee6b8365494-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2021/07/18002952/48211072-636e-11f0-843a-0ee6b8365494-150x150.webp",
        "bio": "Leyla Ali, known professionally as LAYZ, has stormed onto the bass scene and quickly become a fan favorite. Establishing herself in the dubstep community for producing the heavy, new age sound and bringing it to the touring circuit with sets filled of energy and excitement. LAYZ has toured with Excision, Kayzo, Sullivan King, Wooli and more, in addition to festival plays at EDC Las Vegas, Lost Lands, EDC Orlando and Mexico, Bass Canyon, Rampage Belgium, Hard Summer & many others. Her music has been seen on labels such as Monstercat, Subsidia, Welcome Records, Disciple Round Table and Bassweight. She has grown an international fan base bringing her to new levels after every tour stop & song released.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/layzdubz/",
          "soundcloud": "https://soundcloud.com/layzdubz",
          "instagram": "https://www.instagram.com/layzdubz/",
          "spotify": "https://open.spotify.com/artist/2ozQcs5XxFaj5fvA02zhwo",
          "twitter": "https://twitter.com/layzdubz"
        }
      }
    ]
  },
  "BARELY ALIVE": {
    "setName": "BARELY ALIVE",
    "artists": [
      {
        "name": "BARELY ALIVE",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/07/27171438/dfdf71f8-29ff-11f1-9e23-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/07/27171438/dfdf71f8-29ff-11f1-9e23-0a58a9feac02-150x150.jpg",
        "bio": "In 2013, two childhood friends from Massachusetts named Matt and Willie teamed up to pursue their dreams in music—and quickly took the dubstep world by storm. Known for their high-energy sound and technical precision, BARELY ALIVE spent the next decade cementing themselves as staples in the scene, touring globally and delivering a relentless stream of heavy-hitting releases.\nAfter mastering their craft as producers, the inventive duo turned their attention to technology, setting out to create a robotic assistant. In a bizarre twist of fate, they fused their consciousness with artificial intelligence, only to perish in a freak accident. Today, their legacy lives on through their animatronic surrogate, WATT, who continues to create and perform at an otherworldly level.\nNow in 2026, BARELY ALIVE are ushering in a new era—bringing brostep back with a modern, explosive edge while pushing the boundaries of live performance. Their Overdrive 360 Laser Experience Tour is full-sensory, combining a cutting edge visual experience, immersive production, and the signature chaos fans have come to expect. With a revitalized sound and one of the most ambitious live shows in bass music, BARELY ALIVE proves they're not just part of dubstep's legacy—they're actively reshaping its future.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/barelyalivemusic",
          "soundcloud": "https://soundcloud.com/barelyalive",
          "instagram": "https://www.instagram.com/BarelyAliveUS/",
          "spotify": "https://open.spotify.com/artist/5c3akKV3CUqAVOnGZqf4S3",
          "twitter": "https://twitter.com/BarelyAliveUS"
        }
      }
    ]
  },
  "Eliminate": {
    "setName": "Eliminate",
    "artists": [
      {
        "name": "Eliminate",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/10/25003659/6aa5ddee-8b03-11ed-954e-0ecc81f4ee58-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/10/25003659/6aa5ddee-8b03-11ed-954e-0ecc81f4ee58-150x150.webp",
        "bio": "From industry newcomer to the scene's resident trendsetter, Eliminate has set a new precedent for innovation in dance music. Since signing to Disciple’s exclusive roster in 2018, Eliminate’s been on an upward trajectory. Throughout his discography, Eliminate has bounced across the genre spectrum, dabbling in dubstep, electro house, trap, and drum and bass, all the while maintaining his unmistakable signature sound that landed him on Disciple’s roster in the first place.\nIn 2019, Eliminate released his Cyber Whale EP, including his hit tracks “Weeble Wobble” and “Them” feat. Virus Syndicate that went on to be in the top 10 most-played tracks at EDC Las Vegas; “Weeble Wobble” was the 10th most-played electro house track of the entire year. That same year, Eliminate dropped his eclectic Dead Sea EP along with collaborations with Barely Alive, PhaseOne, and more. He’s taken his sound on tour with artists such as Sullivan King, Downlink, Dirt Monkey, and the sold-out Disciple Takeover concert series. Beyond his mettle in the studio, Eliminate stays connected to his audience with a killer social media presence that keeps fans on their toes.\nHeaded into the new year, Eliminate already has his next moves lined up: his first release of 2020 is an electric, four-on-the-floor remix of Valentino Khan’s “Pony,” soon followed by his first release on RL Grime's imprint Sable Valley Records. Additionally, he’s gearing up to release his long-awaited collaboration with DJ Diesel, better known as Shaquille O’Neal. Eliminate’s sound has influenced the current state of dance music in 2019 alone — his next move is sure to bring about the next trend for 2020.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/eliminatemusic/",
          "soundcloud": "https://soundcloud.com/eliminatemusic",
          "instagram": "https://www.instagram.com/eliminatemusic/",
          "spotify": "https://open.spotify.com/artist/6hBrJJrcYoNhvLC6KaFR4b",
          "twitter": "https://twitter.com/eliminatemusic"
        }
      }
    ]
  },
  "Friction": {
    "setName": "Friction",
    "artists": [
      {
        "name": "Friction",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/08/14011141/48671a74-da61-11ed-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/08/14011141/48671a74-da61-11ed-b991-0ee6b8365494-150x150.jpg",
        "bio": "Multi-award-winning Friction is one of the most revered and respected electronic music artists in the world today. Cutting his teeth in the drum & bass UK underground of the early 2000s, Friction’s build from one of the most passionate, most technically skilled DJ’s into an all-round anthem producing artist has been relentless.   Today he co-owns the globally renowned labels Shogun Audio & Elevate Records, and previously hosted the BBC Radio 1’s weekly drum & bass show for 6 years before moving on to concentrate on studio and touring. Deemed by Pete Tong as ‘one of the big dogs’, he entered the coveted D&B Hall of Fame at the 2011 D&B Arena Awards.   Friction’s own productions have gone from strength to strength releasing on imprints such as Metalheadz and Hospital in the early years before founding his own Shogun Audio label in 2004. With 18 years under its belt, it is now a powerhouse in the world of bass music, responsible for nurturing and kick-starting the careers of many of the scene’s biggest producers today.   Now off the back of a slew of releases including his debut album ‘Connections’ plus singles including ‘By Your Side’, ‘Your Love’ and the Radio 1 playlisted ‘Good To Me’ comes his sophomore album ‘After Dark’. The record features the likes of Pola & Bryson, K Motionz, Kanine, Poppy Baskcomb, A Little Sound, Shells and many more. Set to be released Sept 2022.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/frictiondeejay",
          "soundcloud": "https://soundcloud.com/officialfriction",
          "instagram": "https://www.instagram.com/officialfriction/",
          "spotify": "https://open.spotify.com/artist/5xdizdgbQQvGAgAolGhpXr",
          "twitter": "https://twitter.com/Friction"
        }
      }
    ]
  },
  "RIOT": {
    "setName": "RIOT",
    "artists": [
      {
        "name": "RIOT",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/08/24171816/81f7ebc6-c959-11f0-8cfe-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/08/24171816/81f7ebc6-c959-11f0-8cfe-0a58a9feac02-150x150.jpg",
        "bio": "DJ duo RIOT, Tom Davidson and Daniel Magid, relocated to Los Angeles, CA to bring their mix of progressive melodies and heavy bass-lines to the music capital of the world! Their style mixes two extremes of electronic music which energizes their fanbase to make an immediate impression and memory that can last a lifetime. RIOT has released multiple chart-topping originals on Monstercat, Warner Music, NCS, Dim Mak, Gud Vibration, Welcome and Insomniac Records, which includes collaborations with Slander, Kayzo, Dirtyphonics and more. Along with trend-setting originals, RIOT has massive remixes for heavy hitters Illenium, Knife Party, Infected Mushroom and Pegboard Nerds! Their charting debut album “Dogma Resistance” accumulated 85+ million streams. Their collaboration “Wake Up” with Kayzo has 40+ million streams on Spotify and currently lives as one of the most played dubstep tracks on the platform. Their collaboration with Slander, “You Don’t Even Know Me,” which is featured on Slander’s EP “Headbangers Ball,” has over 20+ million streams on Spotify and hit top 10 on the iTunes Dance Charts. Catch RIOT at a city near you, and get ready to join THE MOB!",
        "socialLinks": {
          "facebook": "https://www.facebook.com/groupRIOT",
          "soundcloud": "https://soundcloud.com/weareriot",
          "instagram": "https://www.instagram.com/riotmusic/",
          "twitter": "https://twitter.com/riotmusic"
        }
      }
    ]
  },
  "Nightstalker with MC Dino": {
    "setName": "Nightstalker with MC Dino",
    "artists": [
      {
        "name": "Dknow (MC Dino)",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/06/22234115/b3c75c72-b97f-11ee-b991-0ee6b8365494-972x597.webp",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/06/22234115/b3c75c72-b97f-11ee-b991-0ee6b8365494-150x150.webp",
        "bio": "MC DINO is a cornerstone of the American Drum and Bass scene. Hailing from Denver Colorado but now living in Los Angeles, Dino has spent decades energizing crowds with his commanding mic presence and deep connection to the culture. Whether in underground raves or on massive festival stages like EDC’s Basspod, his voice is instantly recognizable—fusing lyrical precision with raw energy.\nWith roots in the Colorado and West Coast rave movement and a reputation built alongside legends like Andy C, DJ Hype, and Dieselboy, MC Dino brings both experience and authenticity to every set. He’s not just a host—he’s a vibe conductor, a lyrical technician, and a proud representative of the global DnB community.\nFrom RESPECT LA to international tours, Dino continues to raise the bar for what it means to be an MC in this scene. No gimmicks—just bars, soul, and fire.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/dknowmc",
          "soundcloud": "https://soundcloud.com/mc-dino",
          "twitter": "https://twitter.com/dknow"
        }
      },
      {
        "name": "Nightstalker",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/05/07013830/SCKg6xDUjAW5QyUkBq1mVRJ29kBCQ2bSQK7aUinf-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/05/07013830/SCKg6xDUjAW5QyUkBq1mVRJ29kBCQ2bSQK7aUinf-150x150.jpeg",
        "bio": "With his flawless technique and signature style on stage, DJ Nightstalker is a name that has become synonymous with dancefloor mayhem and West Coast junglism. Having earned his stripes in the underground drum and bass scene of Los Angeles, DJ Nightstalker’s role as a writer and editor for legendary outlets like Bassrush, Insomniac, URB, XLR8R, ATM, and Kmag continues to earn him immeasurable recognition and respect worldwide.\nHailed by the L.A. Weekly as a “tastemaker and influencer,” DJ Nightstalker originally paid his dues in the Los Angeles rave scene performing at legendary L.A. underground venues like the Masterdome, Shaolin Temple and Stillwater Hotel. Even more important during these early years was the creation of his infamous Thursday night rinse-out Primordial on the now-defunct vibeflow.com. While it was definitely a space for local talent to represent, most heads tuned in to catch sets from the all-start cast of VIP players who would often drop by unannounced. Heavy-hitters like Pendulum, Photek, Panacea, DJ Rap, and even non-d&b artists like John Tejada, Ron D. Core and Omar Santana would regularly roll through and flex their skills for the internet massive.\nIt wasn’t long until DJ Nightstalker found his own skills as a DJ in high demand, unleashing his infectious energy and signature blend of high intensity drum & bass on dancefloors as varied as the infamous Desert Sound Coalition parties in the Mojave Desert on through to Club Yellow in Tokyo, Japan. Having since headlined countless club nights and rocked crowds alongside the likes of old-school legends and new-school superstars alike, DJ Nightstalker’s reputation for pushing audiences to the breaking point and transforming an average night out into a high-energy, mind-bending journey is the stuff of legend.\nFast-forward to 2021 and the USC professor by day and Bassrush resident by night is at the top of his game. Whether he’s crushing it at local club nights like Los Angeles’ own Respect or hammering it home on festival stages like Project Z, EDC Las Vegas, EDC Mexico, Escape: Psycho Circus, Nocturnal Wonderland and Countdown NYE, there’s no denying that DJ Nightstalker is the one promoters turn to when they want to bring the pain and have crowds bouncing off the walls and begging for more.\nPart entertainer, scholar and shaman, the only way to truly understand the power DJ Nightstalker wields is to experience him live with a crowd of heaving bodies at your side.\nConsider yourself warned...",
        "socialLinks": {
          "facebook": "https://www.facebook.com/nightstalkerdj",
          "soundcloud": "https://soundcloud.com/djnightstalker",
          "instagram": "https://www.instagram.com/dj.nightstalker/",
          "website": "http://www.djnightstalker.com/"
        }
      }
    ]
  },
  "Dombresky": {
    "setName": "Dombresky",
    "artists": [
      {
        "name": "Dombresky",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/11/26210202/1dbd7070-a191-11f1-a6f0-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/11/26210202/1dbd7070-a191-11f1-a6f0-0a58a9feac02-150x150.jpg",
        "bio": "Music facilitates the transfer of energy from the speakers to the body, to the mind, and to the heart.\nSetting off a similar chain reaction, Dombresky immediately incites motion with his distinct and dynamic\r\napproach to house fueled by a passionate pulse. The France-born and Los Angeles-based award-winning\r\nartist, producer, DJ, and Process Records Founder has generated over 100 million streams, ignited\r\nfestivals such as Coachella and EDC, packed storied venues as a headliner, and emerged as the rare\r\nphenomenon sought-after for remixes by everyone from Taylor Swift to Louis The Child and Foster The\r\nPeople.\nWith clear intent, he moves audiences with a series of 2025 singles, major shows, and more to come.\n“I just want to make people dance,” he exclaims. “That’s what I enjoy more than anything. I really try to\r\nput the groove into my sets. Ultimately, this is feel-good music, and I want the crowd to feel happy and\r\nsexy.”",
        "socialLinks": {
          "facebook": "https://www.facebook.com/Dombresky/",
          "instagram": "https://www.instagram.com/dombresky/",
          "soundcloud": "https://soundcloud.com/dombresky",
          "x": "https://twitter.com/Dombresky",
          "spotify": "https://open.spotify.com/artist/2GVtgxcx7jg5xVCZsIHSGN",
          "website": "https://dombresky.com/"
        }
      }
    ]
  },
  "Walker & Royce": {
    "setName": "Walker & Royce",
    "artists": [
      {
        "name": "Walker & Royce",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/06/13021506/8SDHMss1zYKGAS0iRigIfjR1in8OAKXYDbRMpzD6-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/06/13021506/8SDHMss1zYKGAS0iRigIfjR1in8OAKXYDbRMpzD6-150x150.jpeg",
        "bio": "For Sam Walker and Gavin Royce, the question is the fundamental test of their studio output. Simple as it may sound, for this perfectionist pair it’s anything but. Their innate dance floor intuition, combined with years of experience behind the decks, drives them to create music that isn’t just playable — it’s irresistible.\nFirst introduced by way of New York City's early-aughts dance music scene, Sam Walker and Gavin Royce first teamed up for a remix in 2011. The duo found early success on tastemaker labels like Crosstown Rebels, OFF Recordings, and Moda Black, scoring an Essential New Tune nod from Pete Tong with 2014’s “Sister.”  The indie dance and deep house sounds that informed Walker & Royce’s earliest work soon gave way to something different. Quirky accents and bouncy synths, previously deeper in the mix, leapt to the forefront, backed by a propulsive new energy. The success of their November 2015 “Bright Lights” remix was a clear indication that they were onto something.\nIn October 2017, Walker & Royce released their debut album Self Help on Dirtybird, which both showcased and expanded upon their now-signature sound. The guys enlisted numerous vocalists, including Green Velvet, Dances With White Girls, and Sophiegrophy, to make Self Help feel like a packed house party – while leaving no doubt about who was hosting.  Self Help was followed by further experimentation and growth. Sam and Gavin have collaborated with Ardalan, Chris Lake and VNSSA; remixed The Knocks and Justin Jay; and put out music on Relief, Black Book, HotBOi Records and more. Now, their new Rave Grave EP is the inaugural release on Diplo’s house-focused imprint Higher Ground.\nWalker & Royce have spent years honing in on their one-of-a-kind style, meticulously crafting the sounds they want their fans to hear in clubs, at festivals and in their headphones. The result is a cohesive, career-defining body of work that firmly places the duo at the forefront of dance music's future.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/walkerroyce",
          "soundcloud": "https://soundcloud.com/walker-and-royce",
          "instagram": "https://instagram.com/walkerandroyce/",
          "twitter": "https://twitter.com/WalkerAndRoyce"
        }
      }
    ]
  },
  "Ely Oaks": {
    "setName": "Ely Oaks",
    "artists": [
      {
        "name": "Ely Oaks",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/06/23070858/e62c8714-5000-11f0-843a-0ee6b8365494-1-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2025/06/23070858/e62c8714-5000-11f0-843a-0ee6b8365494-1-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/elyoaks/?hl=en",
          "spotify": "https://open.spotify.com/artist/2MdFJmUQf3ckA99IhFF9my"
        }
      }
    ]
  },
  "Joshwa": {
    "setName": "Joshwa",
    "artists": [
      {
        "name": "Joshwa",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/03/31195005/087d6b58-4f76-11ef-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/03/31195005/087d6b58-4f76-11ef-b991-0ee6b8365494-150x150.jpg",
        "bio": "Joshwa is not just an emerging talent; he's a force of nature in the UK House scene. His thrilling sonic journey is characterized by an exceptional streak of releases with key collaborators, supporters and record labels. With each beat, each note, Joshwa continues to redefine the UK sound in House music, crafting a unique sonic experience that's hard to forget while he flies the flag around the world.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/joshwauk",
          "soundcloud": "https://soundcloud.com/joshwauk",
          "instagram": "https://www.instagram.com/joshwauk/",
          "spotify": "https://open.spotify.com/artist/1PzAgFVk9v8cxn9flrqrv5",
          "twitter": "https://twitter.com/joshwa_uk"
        }
      }
    ]
  },
  "GUDFELLA": {
    "setName": "GUDFELLA",
    "artists": [
      {
        "name": "GUDFELLA",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/07/15223123/5ae3c3e0-2f60-11f0-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/07/15223123/5ae3c3e0-2f60-11f0-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "Kyle Domingo, better known in the music world as DJ and producer ‘GUDFELLA’, is an electronic artist hailing from San Diego, California. Born in the Philippines and later relocating to the United States with his family during his formative years, GUDFELLA’s life has been immersed in the power of music from an early age. Influenced by esteemed artists such as Madeon and Mura Masa, GUDFELLA embarked on a journey to master the art of music production and DJing. GUDFELLA is no stranger to using music as a medium for self-expression.\nAs GUDFELLA continues to push boundaries and captivate audiences with his unique sound, there is no doubt that his future holds even more ground breaking achievements and electrifying music experiences for his growing fan base.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/Gudfellaofficial",
          "soundcloud": "https://soundcloud.com/gudfellaofficial",
          "instagram": "https://www.instagram.com/gudfella/",
          "spotify": "https://open.spotify.com/artist/3KjZMSSy0BaCVdvL0VABRO",
          "twitter": "https://mobile.twitter.com/gudfellamusic",
          "website": "https://www.gudfella.com/"
        }
      }
    ]
  },
  "Tini Gessler": {
    "setName": "Tini Gessler",
    "artists": [
      {
        "name": "Tini Gessler",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/11/11195452/a98af7ba-61fa-11ed-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2022/11/11195452/a98af7ba-61fa-11ed-b991-0ee6b8365494-150x150.jpg",
        "bio": "A relative newcomer, Tini Gessler has risen through the music scene remarkably quickly. Starting out playing small parties in her home town of Sitges, Tini was soon picked up by Pacha Barcelona where she held a 3 year residency and it wasn’t long before she found herself playing at iconic clubs including Space and Pacha Ibiza. Since then Tini has cemented herself as part of the Elrow team, as resident DJ for their underground label KER. Gaining identity for her pumping deep/ tech-house sets, Tini has played across Europe and throughout Central and South America- notably at Rioma Club in Mexico DF with Marc Houle. As an elrow regular Tini also frequently plays alongside international artists such as Jamie Jones, Paco Osuna and Joseph Capriati. This Summer she will be making her debut at Amnesia and Tomorrowland amongst many other major festivals. Following her touring success Tini began producing and released her first EP ‘Going On’ with Toni Varga last year. This year she has an upcoming EP with Tolstoi and Andsan on Safe Music, as well as a hotly anticipated solo EP on 303 Lovers. Tini cites her inspiration for the tracks came from a recent trip to Africa, in which she encompassed her two passions: nature and music.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/tinigesslerofficial/",
          "soundcloud": "https://soundcloud.com/tini-gessler",
          "instagram": "https://www.instagram.com/tinigessler/",
          "spotify": "https://open.spotify.com/artist/5k1fr2qbGZrk40njMAyv0x"
        }
      }
    ]
  },
  "Inntraw": {
    "setName": "Inntraw",
    "artists": [
      {
        "name": "Inntraw",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03014938/6f5ac026-5eee-11f1-aa5c-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03014938/6f5ac026-5eee-11f1-aa5c-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/inntraw/",
          "spotify": "https://open.spotify.com/artist/0j6Tcp4NiZqsS3OEl4ppLw"
        }
      }
    ]
  },
  "Juos": {
    "setName": "Juos",
    "artists": [
      {
        "name": "Juos",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/12/24004655/a50e9d6a-93fa-11f0-92d7-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/12/24004655/a50e9d6a-93fa-11f0-92d7-0a58a9feac02-150x150.jpg",
        "bio": "JUOS is a Chicano producer from South Central Los Angeles making tech and bass house that hits with the same energy as a backyard party in LA—gritty, unapologetic, and undeniably raw.\nHe fell in love with dance music at Beyond Wonderland in 2013 and never looked back. While working day jobs to survive, he was producing tracks in his car, teaching himself the craft between shifts, refusing to let anything stop him. Years of grinding led to a breakout 2025, when he played festivals like Escape, Outside Lands, EDC Orlando, and Northern Nights, bringing his sound from LA to Vegas, Miami, San Francisco, and beyond.\nThat same year, JUOS released six tracks, including \"Side Man (feat. Techno Tupac),\" which hit #1 on Beatport's Bass House chart, and \"Candela,\" featured as the cover on Spotify's 'Tech House Operator' and included in the 'All New Dance' playlist. His music has racked up over 10M streams, been released on labels like DIRTYBIRD, Hellbent, and Thrive, and found its way into sets by Chris Lake, John Summit, Cloonee, Diplo, and Tiesto. He's also collaborated with Wax Motif and Andruss. And this is just the beginning.\nNow, it’s JUOS’ turn to become the name everyone knows.",
        "socialLinks": {
          "instagram": "https://www.instagram.com/juosmusic/",
          "soundcloud": "https://soundcloud.com/juosmusic",
          "spotify": "https://open.spotify.com/artist/25b30wypcCBgPGWG28RUcl"
        }
      }
    ]
  },
  "GAINZ": {
    "setName": "GAINZ",
    "artists": [
      {
        "name": "GAINZ",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03015217/cd1c338e-5eee-11f1-b781-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/03015217/cd1c338e-5eee-11f1-b781-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/gainz.music/"
        }
      }
    ]
  },
  "Stanton Warriors": {
    "setName": "Stanton Warriors",
    "artists": [
      {
        "name": "Stanton Warriors",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/09/11153639/main-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2015/09/11153639/main-150x150.jpg",
        "bio": "Since bursting onto the scene with their multi award-winning compilation “The Stanton Sessions” back in 2001, the Stanton Warriors’ irresistible and inimitable sound has consistently remained the soundtrack to some of the world’s biggest and best parties over the past thirteen years; from East London warehouses, Miami boat parties and illegal Detroit raves, to the stages of Coachella, Glastonbury, Burning Man and Ultra, selling out global tours and topping DJ lists along the way.\nIn the studio, Bristol’s Mark Yardley and Dominic Butler have honed a trademark, uncategorisable sound that is at once all their own, but also utterly indefinable, leading to high-profile releases on XL Records, Fabric, Cheap Thrills, Central Station and Universal, alongside official remixes for everyone from Daft Punk and Fatboy Slim, to MIA and Gorillaz. This phenomenal output and remarkable longevity has ensured the Stanton Warriors legendary status amongst not only their fans, but also their peers, as they remain fresh, original and relevant; obstinately dancing to beat of their own drum and helping to pave the way for new talent.\nIn 2014 alone, the Stanton Warriors topped the Beatport charts (again), inspired Disclosure’s Grammy-nominated album Settle, got Annie Mac dancing on her living room carpet, opened London’s 3k capacity Building Six club, saw their podcast shoot to No. 3 in the iTunes chart and smashed the stages of Ultra, Supersonic and Glastonbury.\nIn 2015, Stanton Warriors typically show no sign of slowing down with a brand new album featuring a host of new exciting bass artists such as Cause & Affect (aka Chris Lorenzo & Kane), sold-out tours across the USA, Europe, Australia and the Far East, collaborations on Claude Von Stroke’s Dirtybird label and a slew of exciting releases on their own tastemaker label Punks.",
        "socialLinks": {
          "website": "http://stantonwarriors.com/",
          "soundcloud": "https://soundcloud.com/stantonwarriors",
          "facebook": "https://www.facebook.com/stantonwarriors",
          "twitter": "https://twitter.com/stantonwarriors",
          "instagram": "https://instagram.com/stantonwarriors"
        }
      }
    ]
  },
  "Simply Jeff feat. Sharyn Maceren (Live)": {
    "setName": "Simply Jeff feat. Sharyn Maceren (Live)",
    "artists": [
      {
        "name": "Simply Jeff",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/05/09190443/b8ddeece-f3af-11ed-b991-0ee6b8365494-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/05/09190443/b8ddeece-f3af-11ed-b991-0ee6b8365494-150x150.jpg",
        "bio": "West Coast DJ Simply Jeff (Jeff Adachi), once known as DJ Spinn during the mid-'80s while working at Los Angeles radio hot spots like KROQ and MARS-FM, headed Funk-da-Fried Therapeutics, a progressive-leaning club night that allowed him to spin everything from chunky trip-hop and downtempo to trance and rave on the same night. He debuted early in the '90s with tracks recorded for Moonshine as X-Calibur (with Brian Scott). After forming the Orbit Transmission label, Jeff released more material during 1995-1996 as X-Calibur and the DJ's Project (with Scott, DJ Dan, and Scratchmaster DJ Rectangle). By 1997, Jeff had released his first mix album, Funk-Da-Fried. A second volume appeared one year later, and in 2000, Jeff returned with Funky Instrumentalist. He also issued the occasional 12\", as well as additional mixes like Bring It Back (2005) and Electro Shock (2010). ~ John Bush, Rovi",
        "socialLinks": {
          "facebook": "https://www.facebook.com/DJSimplyJeff/",
          "soundcloud": "https://soundcloud.com/simplyjeff",
          "instagram": "https://www.instagram.com/original_simplyjeff/",
          "spotify": "https://open.spotify.com/artist/5Tug131UB4YlP9Qhe9jBif",
          "x": "https://twitter.com/DJSimplyJeff"
        }
      }
    ]
  },
  "Star Eyes": {
    "setName": "Star Eyes",
    "artists": [
      {
        "name": "Star Eyes",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/01202338/79653046-15ac-11f1-8b7c-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/01202338/79653046-15ac-11f1-8b7c-0a58a9feac02-150x150.jpg",
        "bio": "Star Eyes is synonymous with raw underground bass music. A founding member of the world-renowned Trouble & Bass crew, currently at the helm of the Chaos Clan, this Los Angeles-based DJ/producer causes mayhem on the dancefloor with a style that swiftly connects the dots between regional American bass sounds and the hardcore continuum. Though her style moves across breakbeat, grime, bassline, Bmore/Jersey club, baile funk, and beyond, her aesthetic is continually inspired by jungle, old-skool hardcore, and the L.A. illegal warehouse parties in which she was raised.\nStar Eyes began DJing at age 15 – her name soon became synonymous with California jungle scene, and she was a longtime resident at the pioneering female-led drum 'n' bass night Eklectic in San Francisco. Eventually she founded America's first UK garage duo Syrup Girls (with DJ Siren) and moved to New York City, where she became a co-founder of the Trouble & Bass crew & record label, who were the first to bring Skepta, Skream & Benga, Night Slugs, Rusko, Elijah & Skilliam, Flava D and more to NYC. In 2009, she began releasing her first original productions and remixes on labels like UTTU, Mixpak, T&B and Worst Behavior. Since T&B disbanded in 2015, she has run her own digital label and party series called Chaos Clan and she's currently a member of L.A. renegade party crew Warp Mode alongside Bianca Oblivion and AK Sports, along with holding down a monthly radio show on Dublab.\nStar Eyes has played at Outlook Festival, Sonár, Fabric London, EDC, Burning Man, Stealth, Bossa Nova, Elsewhere, Rinse FM, and beyond. She is also an alumni of Red Bull Music Academy, a former radio host on RBMA/Red Bull Radio, a noted music journalist and the host of the RAVE TO THE GRAVE podcast (available on iTunes, Spotify, Stitcher, etc). With world-class skills and an irreverent attitude, Star Eyes has definitely earned the title \"queen of heavy bass.”",
        "socialLinks": {
          "facebook": "https://www.facebook.com/stareyezzz/",
          "soundcloud": "https://soundcloud.com/stareyes",
          "instagram": "https://www.instagram.com/stareyezzz/",
          "spotify": "https://open.spotify.com/artist/5DYKMNEbqXPFfsUjV4LCun"
        }
      }
    ]
  },
  "John Kelley": {
    "setName": "John Kelley",
    "artists": [
      {
        "name": "John Kelley",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/05/09191659/5R3H64I5aAWLUWuSZAiuvcfdbQvkwdPmSviq5CqI-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/05/09191659/5R3H64I5aAWLUWuSZAiuvcfdbQvkwdPmSviq5CqI-150x150.jpeg",
        "bio": "John Kelley was supposed to become a doctor. Half Asian. Half Southerner. It was study hard. Meet the expectations. Climb the family far out of the cotton-picking swamp. He was walking down a certain path.\nAnd then, just before medical school in 1991, he stepped into a rave called Infinity. Everything changed. His detailed hand at drawing, a love since he was a boy, came to the fore. His play of shadow and ink, often made to music, dramatized images with attitude. Years listening to Prince, The Police, Led Zeppelin, De La Soul, Funkadelic, Beastie Boys, Miles Davis, Pink Floyd, Tangerine Dream, all crashed under the waves as he listened to Doc Martin in downtown Los Angeles spin house and techno into majestic masterpieces; DJ Dan tearing it up in Long Beach at Aphrodite’s Temple; the UK’s Michael Cook peeling it back with CJ Bolland’s ‘Ravesignal.’ The lightsaber stabs of Joey Beltram’s ‘Energy Flash,’ the fractal head trip of Slam’s ‘Positive Education,’ the deep Italo house of ‘A Key To A Heaven For A Heavenly Trance,’ the heartbreaking nirvana of Future Sound of London’s ‘Papua New Guinea’ — all informed his diverse tastes.\nIt was the mix of all these things that fired his imagination. A Moontribe resident DJ since its first year in 1993, John crafted a sound that was a battle cry to keep ravers moving. Harassed and imploding, L.A.’s underground in 1993 was in dark retreat. While Insomniac and others revived the city, Moontribe took the faithful once a month out into the desert. Every full moon, dancers and seekers drove miles and miles, on freeways and dirt roads to secret locations, on dry lake beds, in winding canyons, in the echoey shelter of crumbling hills. As psi-trance flowered on one side of the moon via fellow resident DJ Daniel Chavez, John sparked a progressive house and breakbeat funk style on the other. Like a Yin and Yang, they spun.\nContinuing L.A.’s electro heritage, from Arabian Prince to Exist Dance, out of that Western ferment came a mixtape trilogy in 1994-1995 that would help set a course for Southern California’s native scene. John’s\nInitiations\n,\nDesert Funk\nand\nLunar Funk\nput breaks at the core of his philosophy.\nDesert Funk\nhit it hardest with breakneck mixing contrasted with patient overlays. Its “2 a.m.” A-side chipmunk’d the speed of Leftfield, dusted it up with The Chemical Brothers, and blazed the neurons with Underworld’s original ’Born Slippy.’ Basking in the morning sun on its “8 a.m.” flip side, he worked in acid jazz and breaky house with Aquatherium and Southside Reverb’s ‘Fuck You We’re From Texas.’\nIn 1996, on Moonshine records, he sent his sound across the country and around the world with the acclaimed\nFunkyDesertBreaks\nmix series\n,\ncalled out by historians Simon Reynolds and Michelangelo Matos as a landmark release: “One of Moonshine’s best-loved mid-nineties titles,” is how Matos remembers the two-volume set. From Uberzone’s squiggling ‘Moondusted’ to Castle Trancelot’s ’Indoctrinate’ to Drably Frond’s searing ‘Scilentific,’ John took listeners on twisting sonic adventures. He followed\nFDB\nwith the eclectic\nKnee Deep\n— spiking DJ Icey’s slasher ‘As If’ with Sven Vath’s dreamy ’Breakthrough’ — a tribal house flavored\nHigh Desert Soundsystem 1\nand\n2,\nand a deep tech-house edition of\nUnited DJs of America\n.\nIn 1999, he toured as the official DJ on the Community Service Tour with The Crystal Method, Orbital and The Lo-Fidelity Allstars. A fixture at Insomniac’s Nocturnal Wonderland and Electric Daisy Carnival events, including Philip Blaine’s historic Organic music festival, he played on the same bills as Carl Cox, Frankie Knuckles, Moby, Underworld, Juan Atkins, Eat Static, DJ Dan, Tiesto, and Groove Armada. At Burning Man, he helped define Black Rock City’s freeform psychedelic sound, alongside his Moontribe compatriots, Bassnectar (DJ Lorin) and others.\nIn 2000, a family tragedy forced a careful reassessment of his priorities. While he still toured, playing all over Asia, Australia and the Americas, he took a step back to refocus on studio productions and running his label, Ball of Waxx, co-founded with David DeLaski, formerly of the ambient electronica outfit Electric Skychurch. Through their label, they pushed the original works of Brian Seed, Desert Dwellers, Eastern Sun and Quade. In 2005, he put out his first album of original music, the breaks heavy\nA Night In The Park\n, featuring the rolling ‘Force Ten,’ the slamming ‘Desert Days,’ the floaty ‘Dye Sky Drive’ and the warped ‘Chopstix.’ The same year, he co-wrote ‘Rapture At Sea’ with Eastern Sun, a song that KCRW’s Jason Bentley picked as one of the top tracks of 2005.\nMore recently, John has played at Lightning In A Bottle, Tropical, and of course, L.A.’s Full Moon gatherings. He’s currently working on a new album, as well as collaborations with his Ball of Waxx cohorts. He also works as a sound editor and music supervisor for film and television. More than two decades after that fateful night at Infinity, John continues to evolve a dynamic personal sound, still walking his own unique path to the future.",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/dj-john-kelley",
          "facebook": "https://www.facebook.com/djjkelley/"
        }
      }
    ]
  },
  "Vitamin D": {
    "setName": "Vitamin D",
    "artists": [
      {
        "name": "Vitamin D",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/09193815/5M5tlkUBdB5UM1q65Q2KMTw0ibFVkdXLwXe2f9UC-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/09193815/5M5tlkUBdB5UM1q65Q2KMTw0ibFVkdXLwXe2f9UC-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/tallhomeyvita/?hl=en"
        }
      }
    ]
  },
  "B-Side": {
    "setName": "B-Side",
    "artists": [
      {
        "name": "B-Side",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/30190312/d526ac0c-7f15-11f1-a211-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/30190312/d526ac0c-7f15-11f1-a211-0a58a9feac02-150x150.jpg",
        "bio": "An original heavyweight of the early SoCal electronic music movement, B-SIDE helped soundtrack the foundational era of West Coast rave culture. From legendary underground events to massive desert gatherings, he established a fierce reputation as a premier architect of bass and breakbeat music.\nAfter stepping away from the turntables for more than two decades, he is coming out of retirement with the exact same raw passion that birthed the movement. Renowned as a master of breakbeats, B-SIDE returns to the stage for a highly anticipated all-vinyl performance on the Insomniac Fridays - Rave Cave stage on Sunday. Driven by a love for the culture and craftsmanship of DJing, his signature sets serve a dual purpose. They resurrect the golden-era roots for longtime breakbeat enthusiasts who remember the origins of the genre, while giving newer audiences a front-row seat to the authentic art of true vinyl mixing. Performed exactly how it was meant to be heard—straight from the wax—B-SIDE's return is not just a comeback; it is a passion-fueled revival of the raw energy that started it all.",
        "socialLinks": {
          "instagram": "https://www.instagram.com/bside619"
        }
      }
    ]
  },
  "Oscure": {
    "setName": "Oscure",
    "artists": [
      {
        "name": "Oscure",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/09235707/kP54DpsCypfnQY35s5jTvR0eYqbWvDVFFYR1H2VA-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/05/09235707/kP54DpsCypfnQY35s5jTvR0eYqbWvDVFFYR1H2VA-150x150.jpeg",
        "bio": "OSCURE has been one of the staples to the Los Angeles Underground Dance music scene, djing, producing and remixing music. He's a well established Los Angeles dj/producer and has performed on major events such as EDC, Beyond Wonderland, Nocturnal Wonderland, Coachealla for Do Lab Stage, LIB-Lightning in a Bottle, Earthdance and other major shows. He has licensed and released music on his own label LABA Recordings as well as local indie labels such as Funky Ghetto Phonics Music, Off World Music, Phunkedup Records, DMT3 Traxx, Fifth Gear, Red Bull Academy, Ball of Waxx & Booty Trax. Collaborations in the Studio include talented musicians like Run DMC, Sula, Medusa & the Feline Science, ILL Knob(Wu-Tang), Stacy Brandt, Sarah Ball, Eastern Sun, John Kelley, Stu G, and more. Check out Oscure's latest 3 song release \"L.A.B.A. EP 003\" out on Spotify, and other online stores worldwide.",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/djoscure",
          "facebook": "https://www.facebook.com/djoscure/",
          "spotify": "https://open.spotify.com/artist/43P5KfLZMophTBYZbUOWbu?si=XYqDXCFMSZevx6rCs6rf4Q"
        }
      }
    ]
  },
  "DJ Uncle Noah": {
    "setName": "DJ Uncle Noah",
    "artists": [
      {
        "name": "DJ Uncle Noah",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/27205825/dc6ea968-89fd-11f1-ad80-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/07/27205825/dc6ea968-89fd-11f1-ad80-0a58a9feac02-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "facebook": "https://www.facebook.com/AbProdSoCal/",
          "instagram": "https://www.instagram.com/abduction__productions",
          "soundcloud": "https://soundcloud.com/abduction-productions",
          "x": "https://x.com/abductionp",
          "spotify": "https://open.spotify.com/artist/5E4XbjbQwYCyGXfVDmPfKS"
        }
      }
    ]
  },
  "Donald Glaude B2B Thee-O": {
    "setName": "Donald Glaude B2B Thee-O",
    "artists": [
      {
        "name": "Donald Glaude",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/07/30014742/8981533e-4436-11f1-a07a-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/07/30014742/8981533e-4436-11f1-a07a-0a58a9feac02-150x150.jpg",
        "bio": "A DJ's DJ, this beloved and famously energetic veteran of the dance music scene has headlined all over the West Coast and released two full-length albums on Moonshine Records. He is a contemporary of DJ Dan, who once called him \"one of the most entertaining DJs…to watch live.\" Glaude is a Washington State native, but he first made a name for himself at the massive raves that San Francisco was known for in the early ‘90s -- Cool World, Together As One, etc. He also had a residency with Funky Techno Tribe, a very highly reputed house music promoter/label in San Francisco. It was only logical that he end up on Moonshine, one of the premiere dance music labels in the US and the home of DJ Dan.\nGlaude's first Moonshine project was Off the Hook, a compilation CD featuring funky house, deep house and techno tracks from several well-known producers. Like many of his fellow DJs, Glaude has begun to shift into more of a producer's role recently. His first forays into production was the track \"Soul Cha Cha\", followed shortly thereafter by \"To The Soul\". Both tracks were released as singles and included on his second full-length CD, Mixed Live. Currently Glaude divides his time between the dance floor, where he's as much in-demand as ever, and the studio, where he continues to mix and produce tracks for Moonshine or his own imprint, Respect Recordings. He's earned the distinction of being one of the few house DJs who can easily cross over from sub-genre to sub-genre, winning the love of house-heads, D&B fanatics and chill-room denizens alike. ~ L. Katz, Rovi",
        "socialLinks": {
          "facebook": "https://www.facebook.com/DonaldGlaudeFans/",
          "soundcloud": "https://soundcloud.com/DONALDGLAUDE",
          "instagram": "https://www.instagram.com/donaldglaude/",
          "spotify": "https://open.spotify.com/artist/6KNsaVj5wOjWM8xUIGmmoG",
          "twitter": "https://x.com/donaldglaude"
        }
      },
      {
        "name": "Thee-O",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/05/10221603/be46caea-d0ae-11ec-954e-0ecc81f4ee58-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2016/05/10221603/be46caea-d0ae-11ec-954e-0ecc81f4ee58-150x150.jpg",
        "bio": "Thee-O started DJing at the young age of 13 and by the time he was 18 in 1992, he started DJing in the thriving underground rave scene of Southern California. He has created a name for himself while changing genres and staying true to his integrity, committing to what he feels is the best in underground dance music. His consistency of skillful mixing and lively scratching has cemented “his sound” regardless of what genres co-mingle in his style.\r\n\r\nIn addition to his DJing, Thee-O is also an accomplished producer and remixer that have landed tracks on Bedrock, Suara, Perfecto, Looq, Drops and System Recordings to name just a few. His approach to music production mimics his DJing artistry in the aspect that genre comes second over the feeling of the music. Genres and styles are split, shattered and then reformed into songs that work on multiple dance floors.\r\n\r\nRecently, he was DJing and producing with Robert Pointer (AKA Robtronik) under the name Stylus. Stylus is also responsible for some of the most engaging events to occur in Los Angeles . Their events have occurred in amazing venues such as King King in the heart of Hollywood, The Standard Rooftop in downtown LA and Los Globos in the trendy Silverlake area, while attracting international talent of both House and Techno to join in on the fun.\r\n\r\nCurrently, Thee-O is relaunching Viva La Tech with his partners to create underground events, radio shows and perhaps even a label with a strong Techno focus. On the House music front he continues to work with the LA Based \"re:love\" crew to continue to throw the legendary park parties as well as pushing the brand to extend itself into new venues and opportunities.\r\n\r\nWhile a lot can be talked about when it comes to “Old School,” Thee-O walks the walk. He has accomplished a lot in his 24 years of being a DJ, producer and promoter and he is just getting started. He remains wildly popular while staying firmly planted into the underground scene and not falling into the hype that can surround the current EDM culture. With new ventures, new branding, new tracks, and new ideas, the future is going to be one for the books with lots more to come from this music innovator.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/DJTheeO/",
          "soundcloud": "https://soundcloud.com/thee-o",
          "instagram": "https://www.instagram.com/theeo/",
          "twitter": "https://twitter.com/theeo",
          "website": "http://www.djthee-o.com/"
        }
      }
    ]
  },
  "Shay De Castro": {
    "setName": "Shay De Castro",
    "artists": [
      {
        "name": "Shay De Castro",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/10/18191448/8fdce556-6dea-11ee-b991-0ee6b8365494-1-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2023/10/18191448/8fdce556-6dea-11ee-b991-0ee6b8365494-1-150x150.jpg",
        "bio": "Hailing from a city with not one electronic music club to speak of, Shay De Castro has beat all odds to become one of the most thrilling techno talents from the United States in the last decade. A musician since she was a child, her love of the genre sprouted quickly and obsessively as a teenager, often hacking her school’s computers just to chat with friends in Europe about the music. Now in her 20s, the LA-based fire starter has already made a mark with her potent productions and booming dancefloors.\nStaying true to her vision of brazenly thumping atmospheres, she’s managed to gain the support of the most high-power names in the industry today. From Adam Beyer at Tomorrowland, ANNA at Exit Festival, Pleasurekraft on Drumcode Radio, to Amelie Lens in The Tunnel, her tunes have penetrated of the ears and minds of countless listeners all over the globe.\nHer commitment to studio artistry transcends gimmicks, landing her on some of the scene’s most iconic labels such as Factory 93, Kraftek, and Respekt Recordings. With “spine-tingling build-ups and head-shaking kicks” you can find her tunes regularly in the top of the Beatport charts or on Spotify’s highly regarded “Techno Bunker” playlist, among many other tastemakers’ selections.\nAs a performer, her uniqueness has taken her to some of the most notable venues across the globe, with frequent bookings at hot spots like The Secret Garden Guatemala, Superior Ingredients, NYC, Tanzhaus West Frankfurt, Germany, and Amsterdam Dance Event. High-energy, risk-taking, and with a burning passion for connecting with ravers, her list of bookings is ever-diversifying. With a strong work ethic and passion for techno, you can be sure to see only more of her in decades to come.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/DJShaydeCastro/",
          "soundcloud": "https://soundcloud.com/shaydecastro",
          "instagram": "https://www.instagram.com/shaydecastro/",
          "spotify": "https://open.spotify.com/artist/0v9G2owf4WLwxKH95hc9gQ"
        }
      }
    ]
  },
  "Mark Lewis": {
    "setName": "Mark Lewis",
    "artists": [
      {
        "name": "Mark Lewis",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/30032127/a65ec34e-4443-11f1-ac15-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/30032127/a65ec34e-4443-11f1-ac15-0a58a9feac02-150x150.jpg",
        "bio": "Mark Lewis (GRAMMY NOMINEE, Billboard Magazine Top 10 -- Marks production has earned three EDM remixes, tracks hitting #1 spots. British-born Global DJ work in the music industry spans over three decades. Specializing in electronic music, he has travelled the world, touring with Paul Oakenfold & Carl Cox for over two decades. Performing at festivals such as ULTRA, EDC and major nightclub brands PACHA Ibiza, AMNESIA Ibiza, MINISTRY OF SOUND UK, BLUE MARLIN Cabo, HARD ROCK Las Vegas, NIKKI BEACH South Beach Miami, LIV South Beach Miami, EXCHANGE Los Angeles, AVALON Los Angeles, to name a few....\nMark is considered a pioneer in the music industry since 1988, specifically the electronic dance music scene, where he has garnered industry credits including a Grammy Nomination for his work as a music producer (under former stage name Mark Lewis) and as a member of the duo band Interstate. Along with THREE REMIXES CHARTING NUMBER 1's on BILLBOARD's TOP 10 and EIGHT remix tracks reaching Billboard's TOP 20. In addition to releasing original music under Armin Van Buuren’s label for Armada Music, he has released tracks under Paul Oakenfold’s label Perfecto Records, and his own label Mixology Recordings through Universal Music Group.",
        "socialLinks": {
          "facebook": "http://www.facebook.com/marklewismusik",
          "instagram": "https://www.instagram.com/marklewismusik",
          "soundcloud": "https://soundcloud.com/marklewismusik",
          "x": "http://x.com/marklewismusik",
          "website": "https://www.marklewisofficial.com/"
        }
      }
    ]
  },
  "Lenny V": {
    "setName": "Lenny V",
    "artists": [
      {
        "name": "Lenny V",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/07/06075112/812KrRt02vehWOAmS56xl2jF23YnKjYf2pjjlukm-972x597.jpeg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2014/07/06075112/812KrRt02vehWOAmS56xl2jF23YnKjYf2pjjlukm-150x150.jpeg",
        "bio": "Lenny V is a name that is synonymous with Underground Dance Music History in Southern California. An integral part of the scene since the early 90's, Djing at, and putting on some of the most memorable events that helped shape the scene as we know it today. Lenny has been performing at Insomniac Events since the late 90’s and is honored to carry on the tradition of djing at one of his all time favorite events. Born in Chicago, and raised in Los Angeles. His Puerto Rican Heritage has been a major contributing factor that has helped shape his sound. Lenny's music encompasses his heavy latin rhythms that he heard in his household growing up- along with the new emerging electronic sounds that were starting to grow out of Chicago and Detroit. These sounds continue to be the foundation for the house and techno that he plays when he performs or produces today- and they always will. Lenny continues to express himself via his output of music with projects on UDM Records, and his new collaboration as \"Cali Love\". Lenny keeps his imagination running with an eye to the future and a constant desire to evolve his sounds. Keeping his underground roots, but embracing many of the new sounds and the technology that helps fuel the Electronic Dance Music Movement, Lenny is here to stay.",
        "socialLinks": {
          "instagram": "https://www.instagram.com/djlennyv/"
        }
      }
    ]
  },
  "Maximus Grooves": {
    "setName": "Maximus Grooves",
    "artists": [
      {
        "name": "Maximus Grooves",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/03/11221358/1063f75c-65c6-11f1-a2ed-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2017/03/11221358/1063f75c-65c6-11f1-a2ed-0a58a9feac02-150x150.jpg",
        "bio": "Maximus Grooves is a product of Los Angeles’ underground movement, discovering rave culture at just 15 and immersing himself in its energy from the early ’90s forward. Raised in a music-filled home spanning ’80s and ’90s rock, hip-hop, reggae dub, old-school techno, and breakbeats, his sound was shaped by rhythm long before he stepped behind the decks.\nHis DJ career officially launched in 2005, playing local bars and clubs before expanding to major stages including EDC, Lightning in a Bottle, Sublevels, Off The Grid, and Nocturnal Wonderland. A lifelong vinyl collector and sonic storyteller, Maximus crafts hypnotic, groove-driven journeys rooted in Deep Electro Funky House and Techno Grooves, also blending soul, disco, dub textures, and underground grit into sets that honor the past while pushing forward.\nFounder of Tribal Underworld Music, he plays with heart, intention, and deep passion running through his blood. For Maximus, every set is a sacred exchange, an opportunity to create connection, elevate energy, and keep the underground spirit alive.",
        "socialLinks": {
          "soundcloud": "https://soundcloud.com/tribalunderworld"
        }
      }
    ]
  },
  "Kendo B2B SLAYY": {
    "setName": "Kendo B2B SLAYY",
    "artists": [
      {
        "name": "Kendo",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/04/27215844/c745a570-87ad-11f1-818a-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/04/27215844/c745a570-87ad-11f1-818a-0a58a9feac02-150x150.jpg",
        "bio": "Born in New York City and forged in the underground dance movement of Los Angeles, DJ Kendo is a foundational pillar of West Coast electronic music. Since 1984, he has championed a unique sonic fusion that bridges jazzy, soulful house with funky, acid tech-house. As a co-founder of the iconic Together As One festival and an audio engineer, Kendo has spent decades driving the evolution of global dance culture from the DJ booth to the massive festival stage.",
        "socialLinks": {
          "facebook": "https://www.facebook.com/DJKENDOTheOriginal",
          "instagram": "https://www.instagram.com/ken_djkendo_marrero/"
        }
      },
      {
        "name": "SLAYY",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/08/05233323/007db0c2-9126-11f1-8237-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/08/05233323/007db0c2-9126-11f1-8237-0a58a9feac02-150x150.jpg",
        "bio": "SLAYY is an electrifying DJ and producer with proud Puerto Rican roots, known for her high-energy sets and genre-blending style that commands attention on any dancefloor. Hailing from Los Angeles , her journey began early—at just 13 years old—under the influence of her father, a respected DJ who was deep in the EDM scene during the early ’90s.\nRaised in the heart of LA’s underground, SLAYY grew up surrounded by some of the dopest DJs in the city—many of whom are still rocking the decks today. That foundation shaped her ear, her style, and her deep respect for the culture. Now forging her own path, her evolution as an artist marks a full-circle moment, honoring her roots while pushing boundaries with every set.\nHer sound is bold, unapologetic, and undeniably hers—blending Hard Techno, Industrial Techno, Peak Time, Hard Groove, Ghetto Tech, and House into relentless, floor-shaking performances. Known for delivering raw energy and a captivating presence, SLAYY brings something powerful to every booth she steps into.\nIn addition to DJing, SLAYY is also a producer with a growing discography. She’s released music on various labels and independently via SoundCloud, where her tracks reflect the same passion and pulse as her live sets.\n“I love creating an exciting experience and surprising people. When I’m DJing, I feel like I’m in full control—and the music possesses me.” — SLAYY",
        "socialLinks": {
          "instagram": "https://www.instagram.com/slayythabeat_/",
          "soundcloud": "https://soundcloud.com/dj-slayyy"
        }
      }
    ]
  },
  "Nifty Nubez": {
    "setName": "Nifty Nubez",
    "artists": [
      {
        "name": "Nifty Nubez",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/01003413/cfc49a8c-a59c-11f1-b32d-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2024/06/01003413/cfc49a8c-a59c-11f1-b32d-0a58a9feac02-150x150.jpg",
        "bio": "This LA Rudegirl proudly holds down her own & has rapidly earned the respect from her higher ranking Junglist peers. Although her first love will always be Drum‘n Bass & Jungle. She's been known to throw down multi genre sets at Camp OG Afters, including Dubstep, Riddim, and Hard Techno! With a diverse love of Music & the backing of the most elite\r\nSoCal underground crews. She remains an unstoppable force!",
        "socialLinks": {
          "facebook": "https://www.facebook.com/DjNiftyNubez/",
          "instagram": "https://www.instagram.com/niftynubez/",
          "soundcloud": "https://soundcloud.com/djniftynubez"
        }
      }
    ]
  },
  "TankDubz": {
    "setName": "TankDubz",
    "artists": [
      {
        "name": "TankDubz",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/08/11221831/7c8b8b0c-95d2-11f1-a8b4-0a58a9feac02-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/08/11221831/7c8b8b0c-95d2-11f1-a8b4-0a58a9feac02-150x150.jpg",
        "bio": "TANKDUBZ, a Los Angeles Drum & Bass DJ and producer built for pure dancefloor damage. Hard-hitting bass, heavy drums, and zero filler — just relentless DnB pressure designed to lock the crowd in and keep them moving.",
        "socialLinks": {
          "instagram": "https://www.instagram.com/tankdubz/",
          "soundcloud": "https://soundcloud.com/tankdubz1",
          "spotify": "https://open.spotify.com/artist/0qoSz8qoxM2jX3lN7FBBbL"
        }
      }
    ]
  },
  "Kristin Lush": {
    "setName": "Kristin Lush",
    "artists": [
      {
        "name": "Kristin Lush",
        "heroImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/09211313/tB6OwkhhMBai41p1ZEgoNWaDuFoKa2EyFPv27i5Y-972x597.jpg",
        "thumbImageUrl": "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/2026/06/09211313/tB6OwkhhMBai41p1ZEgoNWaDuFoKa2EyFPv27i5Y-150x150.jpg",
        "bio": "",
        "socialLinks": {
          "instagram": "https://www.instagram.com/kristinlush/?hl=en"
        }
      }
    ]
  }
};

  // Every act has a REAL day, stage, start and end from the official schedule.
  // `tier` is display weighting derived from the official start hour.
  const mk = (id, name, stage, day, start, end) => {
    const official = OFFICIAL_ARTIST_DATA[name];
    const profiles = official?.artists || [];
    const first = profiles[0];
    return {
      id, name, genre: "—", country: "—",
      stage, day, start, end,
      tier: +start.slice(0, 2) >= 22 ? 3 : +start.slice(0, 2) >= 20 ? 2 : 1,
      // `img` is a CSS background shorthand throughout the current UI, not an
      // image URL. Keep it render-safe; retain the official photo separately
      // for a future UI that deliberately wraps it in url(...).
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0a0a1a)`,
      photoUrl: first?.heroImageUrl || "",
      thumbImg: first?.thumbImageUrl || "",
      bio: first?.bio || `Playing Nocturnal Wonderland 2026 on the ${(STAGES.find(s => s.id === stage) || {}).name} stage at ${start}.`,
      socials: first?.socialLinks || {},
      spotifyUrl: first?.socialLinks?.spotify || "",
      // Keeps every member identity on a collaboration without splitting the set.
      officialArtistProfiles: profiles,
    };
  };

  const ARTISTS = [
    // ─────────── Mystic Wild ───────────
    mk("nw-angrybaby", "Angrybaby", "mysticwild", 2, "16:45", "17:45"),
    mk("nw-chyl", "CHYL", "mysticwild", 2, "17:45", "18:45"),
    mk("nw-deadmau5", "deadmau5", "mysticwild", 1, "23:00", "00:00"),
    mk("nw-deorro", "Deorro", "mysticwild", 1, "22:00", "23:00"),
    mk("nw-jordan-savage", "Jordan Savage", "mysticwild", 2, "15:00", "15:45"),
    mk("nw-flava-d", "Flava D", "mysticwild", 1, "16:00", "17:00"),
    mk("nw-gravagerz", "GRAVAGERZ", "mysticwild", 1, "17:00", "18:00"),
    mk("nw-illenium", "Illenium", "mysticwild", 2, "23:00", "00:00"),
    mk("nw-james-hype", "James Hype", "mysticwild", 1, "21:00", "22:00"),
    mk("nw-jstjr", "JSTJR", "mysticwild", 1, "20:00", "21:00"),
    mk("nw-malaa", "Malaa", "mysticwild", 1, "19:00", "20:00"),
    mk("nw-mattilo", "Mattilo", "mysticwild", 2, "15:45", "16:45"),
    mk("nw-r3hab", "R3HAB", "mysticwild", 2, "19:50", "20:50"),
    mk("nw-sabai", "SABAI", "mysticwild", 1, "18:00", "19:00"),
    mk("nw-said-the-sky-sunset-set", "Said The Sky (Sunset Set)", "mysticwild", 2, "18:50", "19:50"),
    mk("nw-seven-lions", "Seven Lions", "mysticwild", 2, "21:55", "22:55"),
    mk("nw-shima", "Shima", "mysticwild", 1, "15:00", "16:00"),
    mk("nw-sidepiece", "SIDEPIECE", "mysticwild", 2, "20:50", "21:50"),
    // ─────────── Dawn Mountain ───────────
    mk("nw-barely-alive", "BARELY ALIVE", "dawnmountain", 2, "19:30", "20:30"),
    mk("nw-callen-b2b-sektor-8", "CALLEN B2B SEKTOR 8", "dawnmountain", 1, "15:00", "16:00"),
    mk("nw-eliminate", "Eliminate", "dawnmountain", 2, "18:30", "19:30"),
    mk("nw-friction", "Friction", "dawnmountain", 2, "17:30", "18:30"),
    mk("nw-hedex", "Hedex", "dawnmountain", 2, "21:30", "22:30"),
    mk("nw-hybrid-minds", "Hybrid Minds", "dawnmountain", 1, "19:00", "20:00"),
    mk("nw-infekt-b2b-virtual-riot", "INFEKT B2B Virtual Riot", "dawnmountain", 1, "21:00", "22:00"),
    mk("nw-jkyl-and-hyde-b2b-nikita-the-wicked", "Jkyl & Hyde B2B Nikita, the Wicked", "dawnmountain", 1, "18:00", "19:00"),
    mk("nw-kompany-b2b-samplifire", "Kompany B2B Samplifire", "dawnmountain", 1, "20:00", "21:00"),
    mk("nw-layz", "LAYZ", "dawnmountain", 2, "20:30", "21:30"),
    mk("nw-nghtmre", "NGHTMRE", "dawnmountain", 1, "22:00", "23:00"),
    mk("nw-nightstalker-with-mc-dino", "Nightstalker with MC Dino", "dawnmountain", 2, "15:00", "16:30"),
    mk("nw-riot", "RIOT", "dawnmountain", 2, "16:30", "17:30"),
    mk("nw-sippy", "Sippy", "dawnmountain", 1, "17:00", "18:00"),
    mk("nw-svdden-death", "Svdden Death", "dawnmountain", 1, "23:00", "00:00"),
    mk("nw-teddy-pain-t-pain-bass-set", "Teddy Pain (T-Pain Bass Set)", "dawnmountain", 2, "23:30", "00:00"),
    mk("nw-troyboi", "TroyBoi", "dawnmountain", 2, "22:30", "23:30"),
    mk("nw-wolfie", "Wolfie", "dawnmountain", 1, "16:00", "17:00"),
    // ─────────── Aurora Plains ───────────
    mk("nw-braydon-terzo", "Braydon Terzo", "auroraplains", 1, "16:00", "17:00"),
    mk("nw-dombresky", "Dombresky", "auroraplains", 2, "23:00", "00:00"),
    mk("nw-ely-oaks", "Ely Oaks", "auroraplains", 2, "21:00", "22:00"),
    mk("nw-fleur-shore", "Fleur Shore", "auroraplains", 1, "18:00", "19:00"),
    mk("nw-gainz", "GAINZ", "auroraplains", 2, "15:00", "16:00"),
    mk("nw-green-velvet", "Green Velvet", "auroraplains", 1, "22:30", "00:00"),
    mk("nw-gudfella", "GUDFELLA", "auroraplains", 2, "19:00", "20:00"),
    mk("nw-inntraw", "Inntraw", "auroraplains", 2, "17:00", "18:00"),
    mk("nw-joshwa", "Joshwa", "auroraplains", 2, "20:00", "21:00"),
    mk("nw-juos", "Juos", "auroraplains", 2, "16:00", "17:00"),
    mk("nw-m-high", "M-High", "auroraplains", 1, "17:00", "18:00"),
    mk("nw-partiboi69", "Partiboi69", "auroraplains", 1, "21:15", "22:30"),
    mk("nw-patrick-topping", "Patrick Topping", "auroraplains", 1, "20:00", "21:15"),
    mk("nw-ragie-ban", "Ragie Ban", "auroraplains", 1, "19:00", "20:00"),
    mk("nw-tini-gessler", "Tini Gessler", "auroraplains", 2, "18:00", "19:00"),
    mk("nw-trainer-red", "Trainer Red", "auroraplains", 1, "15:00", "16:00"),
    mk("nw-walker-and-royce", "Walker & Royce", "auroraplains", 2, "22:00", "23:00"),
    // ─────────── Rave Cave ───────────
    mk("nw-b-side", "B-Side", "ravecave", 2, "17:00", "18:00"),
    mk("nw-basstripper", "Basstripper", "ravecave", 1, "22:45", "00:00"),
    mk("nw-dj-uncle-noah", "DJ Uncle Noah", "ravecave", 2, "15:00", "16:00"),
    mk("nw-ed-bailey", "Ed Bailey", "ravecave", 1, "18:00", "19:00"),
    mk("nw-john-kelley", "John Kelley", "ravecave", 2, "19:00", "20:00"),
    mk("nw-oscar-da-grouch", "Oscar Da Grouch", "ravecave", 1, "19:00", "20:00"),
    mk("nw-oscure", "Oscure", "ravecave", 2, "16:00", "17:00"),
    mk("nw-reid-speed", "Reid Speed", "ravecave", 1, "20:00", "21:30"),
    mk("nw-simply-jeff-feat-sharyn-maceren-live", "Simply Jeff feat. Sharyn Maceren (Live)", "ravecave", 2, "21:00", "22:30"),
    mk("nw-stanton-warriors", "Stanton Warriors", "ravecave", 2, "22:30", "00:00"),
    mk("nw-star-eyes", "Star Eyes", "ravecave", 2, "20:00", "21:00"),
    mk("nw-steve-leclair", "Steve Leclair", "ravecave", 1, "15:00", "16:30"),
    mk("nw-steve-loria", "Steve Loria", "ravecave", 1, "16:30", "18:00"),
    mk("nw-subsonic", "Subsonic", "ravecave", 1, "21:30", "22:45"),
    mk("nw-vitamin-d", "Vitamin D", "ravecave", 2, "18:00", "19:00"),
    // ─────────── Beatbox Boombox ───────────
    mk("nw-dack-janiels-b2b-mongrel", "Dack Janiels B2B Mongrel", "beatboxboombox", 1, "22:00", "23:00"),
    mk("nw-dances-b2b-techno-tupac", "Dances B2B Techno Tupac", "beatboxboombox", 1, "20:00", "21:00"),
    mk("nw-dmz-and-friends", "DMZ and Friends", "beatboxboombox", 1, "19:00", "20:00"),
    mk("nw-donald-glaude-b2b-thee-o", "Donald Glaude B2B Thee-O", "beatboxboombox", 2, "23:00", "00:00"),
    mk("nw-hekler", "Hekler", "beatboxboombox", 1, "21:00", "22:00"),
    mk("nw-kendo-b2b-slayy", "Kendo B2B SLAYY", "beatboxboombox", 2, "18:00", "19:00"),
    mk("nw-kittamami-b2b-tony-h", "Kittamami B2B Tony H", "beatboxboombox", 1, "18:00", "19:00"),
    mk("nw-kristin-lush", "Kristin Lush", "beatboxboombox", 2, "15:00", "16:00"),
    mk("nw-lenny-v", "Lenny V", "beatboxboombox", 2, "20:00", "21:00"),
    mk("nw-lily-ardalan", "Lily Ardalan", "beatboxboombox", 1, "16:00", "17:00"),
    mk("nw-mark-lewis", "Mark Lewis", "beatboxboombox", 2, "21:00", "22:00"),
    mk("nw-maximus-grooves", "Maximus Grooves", "beatboxboombox", 2, "19:00", "20:00"),
    mk("nw-neda", "NEDA(:", "beatboxboombox", 1, "15:00", "16:00"),
    mk("nw-nifty-nubez", "Nifty Nubez", "beatboxboombox", 2, "17:00", "18:00"),
    mk("nw-shay-de-castro", "Shay De Castro", "beatboxboombox", 2, "22:00", "23:00"),
    mk("nw-tankdubz", "TankDubz", "beatboxboombox", 2, "16:00", "17:00"),
    mk("nw-tha4saken", "THA4SAKEN", "beatboxboombox", 1, "17:00", "18:00"),
    mk("nw-woof-logik", "Woof Logik", "beatboxboombox", 1, "23:00", "00:00"),
  ];

  const CONFIG = {
    id:        "nocturnal-wonderland-2026",
    name:      "Nocturnal Wonderland 2026",
    shortName: "Nocturnal",
    brand:     "Nocturnal Wonderland",
    tagline:   "Two nights with the creatures of the night",
    location:  "Glen Helen Regional Park \u00b7 San Bernardino, CA",
    locationShort: "Glen Helen Regional Park",
    dates:     "Sep 19\u201320, 2026",
    year:      2026,
    officialStages: ["Mystic Wild", "Dawn Mountain", "Aurora Plains", "Rave Cave", "Beatbox Boombox"],
    officialEvent: {
      id: 510542,
      url: "https://www.insomniac.com/events/nocturnal-wonderland-2026-2026-09-19-san-bernardino-ca/",
      website: "https://www.nocturnalwonderland.com/",
      tickets: "https://nocturnal.frontgatetickets.com/",
      observedAt: "2026-09-10",
    },
    // Official hours are 3PM-12AM daily (guide/hours-and-info). California is
    // PDT (UTC-7) in September \u2014 DST does not end until Nov 1.
    startMs: Date.UTC(2026, 8, 19, 22, 0, 0),  // Sep 19 15:00 PDT, gates
    endMs:   Date.UTC(2026, 8, 21,  7, 0, 0),  // Sep 21 00:00 PDT, close of night 2
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 8, d: 19, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 8, 19, 7, 0, 0) },
      2: { y: 2026, m: 8, d: 20, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 8, 20, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at the OSM centroid, converted to PDT.
    sunTimes: {
      1: { rise: "06:34", set: "18:51" },
      2: { rise: "06:35", set: "18:50" },
    },
    // OpenStreetMap centroid of the Glen Helen festival grounds, not a street
    // geocode. Radius covers the whole park, which is larger than the
    // amphitheater bowl the name suggests.
    gps: { lat: 34.20459, lng: -117.40173, onSiteRadiusMi: 0.6 },
    venue: {
      name:    "Glen Helen Regional Park",
      address: "2555 Glen Helen Pkwy, San Bernardino, CA 92407",
      // The SURVEY. OSM way 233008517, amenity=festival_grounds, 85 vertices,
      // 558 m E-W x 676 m N-S — the actual festival-grounds ring, added
      // 2026-09-06 (#76) so the venue-footprint gate RUNS here the moment the
      // flip adds anchors. It only checks festivals that declare a footprint,
      // and Lost Lands showed what that gap costs: four invented anchors sat
      // outside their venue for weeks because nothing was watching.
      footprint: [
          [34.20677, -117.40236], [34.20638, -117.40256], [34.20589, -117.40277],
          [34.20546, -117.40297], [34.20524, -117.40307], [34.20500, -117.40319],
          [34.20482, -117.40338], [34.20473, -117.40347], [34.20452, -117.40367],
          [34.20417, -117.40401], [34.20376, -117.40444], [34.20297, -117.40526],
          [34.20271, -117.40577], [34.20255, -117.40575], [34.20239, -117.40572],
          [34.20230, -117.40567], [34.20210, -117.40556], [34.20191, -117.40542],
          [34.20183, -117.40537], [34.20176, -117.40531], [34.20171, -117.40524],
          [34.20168, -117.40515], [34.20154, -117.40464], [34.20149, -117.40428],
          [34.20153, -117.40343], [34.20167, -117.40267], [34.20186, -117.40191],
          [34.20191, -117.40188], [34.20193, -117.40186], [34.20195, -117.40182],
          [34.20188, -117.40173], [34.20189, -117.40169], [34.20191, -117.40164],
          [34.20194, -117.40160], [34.20219, -117.40121], [34.20231, -117.40096],
          [34.20255, -117.40045], [34.20269, -117.40023], [34.20284, -117.40010],
          [34.20297, -117.39998], [34.20314, -117.39990], [34.20337, -117.39982],
          [34.20357, -117.39975], [34.20376, -117.39971], [34.20427, -117.39976],
          [34.20448, -117.39982], [34.20467, -117.39990], [34.20481, -117.39996],
          [34.20497, -117.40004], [34.20515, -117.40019], [34.20525, -117.40026],
          [34.20537, -117.40036], [34.20543, -117.40042], [34.20550, -117.40056],
          [34.20546, -117.40083], [34.20553, -117.40086], [34.20556, -117.40086],
          [34.20557, -117.40092], [34.20559, -117.40098], [34.20568, -117.40106],
          [34.20570, -117.40104], [34.20576, -117.40108], [34.20574, -117.40112],
          [34.20567, -117.40131], [34.20596, -117.40153], [34.20604, -117.40159],
          [34.20608, -117.40165], [34.20610, -117.40171], [34.20611, -117.40177],
          [34.20643, -117.40194], [34.20653, -117.40196], [34.20661, -117.40197],
          [34.20669, -117.40199], [34.20680, -117.40203], [34.20689, -117.40207],
          [34.20690, -117.40205], [34.20692, -117.40204], [34.20708, -117.40228],
          [34.20716, -117.40237], [34.20722, -117.40240], [34.20757, -117.40240],
          [34.20756, -117.40247], [34.20757, -117.40257], [34.20728, -117.40263],
          [34.20677, -117.40236],
      ],
      // The BOX, kept deliberately. It is not a worse footprint — the two
      // remaining consumers want a rectangle and nothing else will do: the
      // basemap clip mask (an outer ring with a hole punched in it) and
      // map.setMaxBounds, which takes a bbox by definition. Everything that
      // wants the real outline reads `footprint` and map.jsx already prefers
      // it. Its numbers are this polygon's own bounding box, so they cannot
      // drift apart.
      festivalBounds: { north: 34.2075695, south: 34.2014929,
                        west: -117.4057721, east: -117.3997092 },
    },
    weatherEndpoint: "https://api.weather.gov/points/34.2046,-117.4017",
    // Mystic Wild is the main stage: it is first on the official stages page
    // and carries deadmau5, Illenium and Seven Lions.
    mainStageId: "mysticwild",
    // ── THE MAP ──
    // Layout comes from the 2025 OFFICIAL map (founder call 2026-09-06: use
    // 2025 if 2026 does not exist). nocturnal-2026.svg is GENERATED from the
    // stage coordinates below — no festival artwork is reproduced, per the
    // lostlands-2026.jpg precedent.
    mapImage: "nocturnal-2026.svg",
    mapStyle: "image-overlay",
    mapTheme: "forest",
    // The plate prints no stage names, so the pills carry them.
    mapPrintsStageNames: false,
    // ⚠ NO gpsAnchors, deliberately, and this is the important line.
    // The 2025 map gives RELATIVE LAYOUT — which stage sits where, relative to
    // the others. It does NOT give world coordinates, and converting poster
    // space into lat/lng is precisely the defect PR #36 removed from EDC LV
    // and the 2026-09-06 re-survey found on three more festivals. So the art
    // places the pins and nothing claims to register them to the ground: no
    // affine, so the v257/v260 gate suppresses every distance and walk time,
    // and the blue dot stays on the real-map layer where it is actually true.
    mapArtIsGeoregistered: false,
    // Flip markers, read by humans rather than by code.
    setTimesProvisional: false,
    // Published policy: 18+ to enter, 21+ for alcohol/VIP.
    policies: { minimumAge: 18, alcoholAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["nocturnal-wonderland-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Live with official set times. The map remains unregistered until 2026 art publishes.
    registry: { available: true, accent: "#a855f7", emoji: "🌙", region: "North America" },
  };
})();
