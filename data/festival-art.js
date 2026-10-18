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
// A festival with no entry gets a letter tile in its own registry accent.
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
  "escape-halloween-2026": {
    tile: "festival-art/tiles/escape-halloween-2026.webp", card: null, width: 168, height: 168,
    kind: "key-art", sourcePage: "https://escapehalloween.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/52/2025/11/04114200/esc_2026_mk_ps_fs_seo_1200x630_r01.webp",
    credit: "Escape: Psycho Circus 2026 key art (the site's og:image, 1200x630), the framed-portrait panel", retrieved: "2026-10-18",
    license: "Official festival share image; reuse terms not stated.",
  },
  "dreamstate-socal-2026": {
    tile: "festival-art/tiles/dreamstate-socal-2026.webp", card: null, width: 168, height: 168,
    kind: "logo", sourcePage: "https://socal.dreamstateusa.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/53/2026/08/25110827/dssc_2026_mk_lu_lubd_fest_site_seo_1200x630_r01.jpg",
    credit: "Dreamstate logo mark from the official 2026 share image (the site's og:image, 1200x630)", retrieved: "2026-10-18",
    license: "Official festival share image; reuse terms not stated.",
  },
  "edc-orlando-2026": {
    tile: "festival-art/tiles/edc-orlando-2026.webp", card: null, width: 168, height: 168,
    kind: "logo", sourcePage: "https://orlando.edc.com/",
    assetUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/44/2026/07/07090245/edco_2026_mk_lu_lubd_fest_seo_1200x630_r01.jpg",
    credit: "EDC Orlando 2026 logo lockup from the official share image (the site's og:image, 1200x630)", retrieved: "2026-10-18",
    license: "Official festival share image; reuse terms not stated.",
  },
});
