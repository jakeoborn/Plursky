// Festival-art ledger: the ONLY door for festival tile and card art (Item 6,
// Oct 16 spec). Official sources only: the festival's own site, press or
// official socials. No fabricated art, no third-party reposts, no map art.
// Official publication establishes provenance, not reuse rights
// (festival-art/PROVENANCE.md); `license` says what is known.
//
//   tile: 168x168 webp for the 56px list tile (3x), cut from `from`
//   card: the full frame for the switcher's grid card, when there is one
//   sourcePage: the official page the art was taken from
//   assetUrl: the direct asset, when recorded (null = not recorded at the time)
//   retrieved: when it was taken, YYYY-MM-DD
//
// Every listed festival gets an entry (Jake 2026-10-18: "a visual based app,
// lots of photos"). A photo first; official key art or a logo only where the
// festival publishes no photo. The letter tile in the registry accent is a
// stopgap for a festival added before its art, never an end state.
// Gate: scripts/test-festival-art.mjs (completeness, files, dimensions, budget).
window.PLURSKY_FESTIVAL_ART = Object.freeze({
  "acl-2026": {
    tile: "festival-art/tiles/acl-2026.webp", card: "festival-art/acl-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.aclfestival.com/gallery", assetUrl: null,
    credit: "\"Aerial - Dua Lipa\" by Nathan Zucker, ACL W1 2024", retrieved: "2026-09-22",
    license: "Official festival gallery; reuse terms not granted. Jake-selected interim card art 2026-09-22.",
  },
  "crssd-fall-2026": {
    tile: "festival-art/tiles/crssd-fall-2026.webp", card: "festival-art/crssd-fall-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.crssdfest.com/galleries/",
    assetUrl: "https://www.crssdfest.com/wp-content/uploads/2024/10/CRSSD2024_0928_183018-5837_KNK.jpg",
    credit: "Official CRSSD park-wide golden-hour aerial, file credit KNK", retrieved: "2026-09-22",
    license: "Official festival gallery; reuse terms not granted. Jake-selected interim card art 2026-09-22.",
  },
  "portola-2026": {
    tile: "festival-art/tiles/portola-2026.webp", card: "festival-art/portola-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://portolamusicfestival.com/", assetUrl: null,
    credit: "Official Portola site vertical-card asset, Pier 80 at golden hour", retrieved: "2026-09-22",
    license: "Official festival site; reuse terms not granted. Jake-selected interim card art 2026-09-22.",
  },
  "iii-points-2026": {
    tile: "festival-art/tiles/iii-points-2026.webp", card: "festival-art/iii-points-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.iiipoints.com/", assetUrl: null,
    credit: "Official III Points gallery, IIIP2025_1018_004857-2658_TLR", retrieved: "2026-09-22",
    license: "Official festival gallery; reuse terms not granted. Jake-selected interim card art 2026-09-22.",
  },
  "edc-lv-2026": {
    tile: "festival-art/tiles/edc-lv-2026.webp", card: "festival-art/edc-lv-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://lasvegas.edc.com/", assetUrl: null,
    credit: "Official EDC Las Vegas site, speedway aerial, EDCLV2026_0516_015131-4901_JAE-Edit", retrieved: "2026-09-22",
    license: "Official festival site; reuse terms not granted. Jake-selected interim card art 2026-09-22.",
  },
  "countdown-nye-2026": {
    tile: "festival-art/tiles/countdown-nye-2026.webp", card: "festival-art/countdown-nye-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://countdownnye.com/", assetUrl: null,
    credit: "Official Countdown gallery, 1_CSC2023_1231_235949-08506_IME", retrieved: "2026-09-22",
    license: "Official festival gallery; reuse terms not granted. Jake-selected interim card art 2026-09-22.",
  },
  "arc-2026": {
    tile: "festival-art/tiles/arc-2026.webp", card: "festival-art/arc-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://arcmusicfestival.com/",
    assetUrl: "https://arcmusicfestival.com/wp-content/uploads/2024/02/Copy-of-ARC2023_0903_195934-0425_DLG.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "beyond-wonderland-gorge-2027": {
    tile: "festival-art/tiles/beyond-wonderland-gorge-2027.webp", card: "festival-art/beyond-wonderland-gorge-2027.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://pnw.beyondwonderland.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/75/2024/06/26164328/BWPNW2024_0623_010518-3387_TLR-Enhanced-NR_530x240.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "beyond-wonderland-socal-2027": {
    tile: "festival-art/tiles/beyond-wonderland-socal-2027.webp", card: "festival-art/beyond-wonderland-socal-2027.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://socal.beyondwonderland.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/67/2026/08/27152416/BWSC2026_0327_171058-6556_JWP_720h.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "coachella-2027": {
    tile: "festival-art/tiles/coachella-2027.webp", card: "festival-art/coachella-2027.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.coachella.com/",
    assetUrl: "https://media.coachella.com/content/banner_images/795/w5AmQpnH09F24CfdVBX02UI2oZdv8jvLsadnB8nX.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "dreamstate-socal-2026": {
    tile: "festival-art/tiles/dreamstate-socal-2026.webp", card: "festival-art/dreamstate-socal-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://socal.dreamstateusa.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/53/2025/09/02134010/DSSC2024_1123_212553-6741_JAE-Enhanced-NR-Edit-3_530x240-1.webp",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "edc-mexico-2027": {
    tile: "festival-art/tiles/edc-mexico-2027.webp", card: "festival-art/edc-mexico-2027.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://mexico.edc.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/86/2025/08/01124045/EDCMX2025_0223_003520-3250_JMM_04-scaled.webp",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "edc-orlando-2026": {
    tile: "festival-art/tiles/edc-orlando-2026.webp", card: "festival-art/edc-orlando-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://orlando.edc.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/44/2019/03/05080659/EDCORL2018_1109_203907-0508_ALIVECOVERAGE-AGP-social.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "escape-halloween-2026": {
    tile: "festival-art/tiles/escape-halloween-2026.webp", card: "festival-art/escape-halloween-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://escapehalloween.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/52/2023/06/02160021/ESCAPE2022_1028_224323-05751_IME_540x240.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "governors-ball-2026": {
    tile: "festival-art/tiles/governors-ball-2026.webp", card: "festival-art/governors-ball-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.governorsballmusicfestival.com/",
    assetUrl: "https://cdn.prod.website-files.com/6752f21b56158b1c6c4bc9f2/69457b9ae1a0fb2626cb8b38_CHARLES-REAGAN-AERIALS_04.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "hard-summer-2026": {
    tile: "festival-art/tiles/hard-summer-2026.webp", card: "festival-art/hard-summer-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.hardsummer.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/38/2024/08/08150817/HSMF2024_0803_193238-9844_JAE-1200x630-1.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "lollapalooza-2026": {
    tile: "festival-art/tiles/lollapalooza-2026.webp", card: "festival-art/lollapalooza-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.lollapalooza.com/",
    assetUrl: "https://cdn.prod.website-files.com/67c1632e86f99390b0516b6d/67c6088cf31f20665cdfe47f_Asset%202%403x%203.webp",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "lost-lands-2026": {
    tile: "festival-art/tiles/lost-lands-2026.webp", card: "festival-art/lost-lands-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.lostlandsfestival.com/",
    assetUrl: "https://www.lostlandsfestival.com/wp-content/uploads/2023/10/Lost_Lands_2026_12.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "nocturnal-wonderland-2026": {
    tile: "festival-art/tiles/nocturnal-wonderland-2026.webp", card: "festival-art/nocturnal-wonderland-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.nocturnalwonderland.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/46/2026/02/11142448/NW2025_0913_205534-1091_OTU.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "outside-lands-2026": {
    tile: "festival-art/tiles/outside-lands-2026.webp", card: "festival-art/outside-lands-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.sfoutsidelands.com/",
    assetUrl: "https://www.sfoutsidelands.com/assets/ol2026_0808_193131-_alive-(1).jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "summerfest-2026": {
    tile: "festival-art/tiles/summerfest-2026.webp", card: "festival-art/summerfest-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://www.summerfest.com/",
    assetUrl: "https://s3.summerfest.com/assets/video/homepage-background-v2.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "tomorrowland-2027": {
    tile: "festival-art/tiles/tomorrowland-2027.webp", card: "festival-art/tomorrowland-2027.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://belgium.tomorrowland.com/en/welcome/",
    assetUrl: "https://belgium.tomorrowland.com/assets/rXvZtSKVZXWcGbV5Qo_s1eYnTyd0ZaDD2pgSxzSfZUY/w:768/f:webp/czM6Ly93YW93LXNrcy1wcm9kdWN0aW9uLWZlc3RpdmFsLWJlbGdpdW0tYXNzZXRzLzIwMjYvcG9zdC1ldmVudC8xNzg0OTgyMzkzNzU4XzEwMDc3ZTcxLWY5OGMtNGU1MS1iNDdiLTI0MGZlZjVlN2I0NC5qcGdfMF84ODk2NjM2NTIzMzI4NjMyODA5LmpwZw.webp",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "ultra-miami-2026": {
    tile: "festival-art/tiles/ultra-miami-2026.webp", card: "festival-art/ultra-miami-2026.webp", width: 168, height: 168,
    kind: "photo", sourcePage: "https://ultramusicfestival.com/",
    assetUrl: "https://mjb7fzbh9yu24bzq.public.blob.vercel-storage.com/ULTRA2026_0327_222209-7879_ALIVE.jpg",
    credit: "Photo served by the festival's own site", retrieved: "2026-09-30",
    license: "Official festival site; reuse terms not granted. Jake-requested card art 2026-09-30 (#273).",
  },
  "decadence-colorado-2026": {
    tile: "festival-art/tiles/decadence-colorado-2026.webp", card: null, width: 168, height: 168,
    kind: "key-art", sourcePage: "https://decadencenye.com/",
    assetUrl: "https://decadencenye.com/wp-content/uploads/2026/08/Decadence_2026_Header.jpg",
    credit: "Decadence 2026 \"The Digital City\" header key art, the portrait panel (no text)", retrieved: "2026-10-18",
    license: "Official festival site; reuse terms not stated. No official photo on the site (checked 2026-09-30 and 2026-10-18).",
  },
  "electric-forest-2027": {
    tile: "festival-art/tiles/electric-forest-2027.webp", card: null, width: 168, height: 168,
    kind: "logo", sourcePage: "https://www.electricforestfestival.com/",
    assetUrl: "https://media.web.aegpresents.com/content/seo_images/738/QYrsNFGnojQynQbPI7XImXi6Mun0bzyLmbThefG0.jpg",
    credit: "Electric Forest logo from the official share image (the site's og:image, 1200x670)", retrieved: "2026-10-18",
    license: "Official festival share image; reuse terms not stated. The site serves no festival photo (poster and illustration only, checked 2026-10-18): a photo is still owed.",
  },
});
