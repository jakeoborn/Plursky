const CACHE      = 'plursky-v479';
// Tile cache is intentionally separate from the app cache so map tiles
// survive APP_VER bumps. Tiles for a given (z, x, y) are immutable, so
// cache-first forever is correct.
const TILE_CACHE = 'plursky-tiles-v1';
const APP_VER    = 'v479';

// Own-origin app files â€” versioned to match what index.html requests.
// addAll is atomic so a missed own-origin file fails the install fast.
const LOCAL = [
  './',
  './index.html',
  './manifest.json',
  './callback.html',
  './share.html',
  './og.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  // The board's faces: offline, a missing one falls back to the system stack.
  './fonts/anton-latin.woff2',
  './fonts/anton-latin-ext.woff2',
  './fonts/space-grotesk-latin.woff2',
  './fonts/space-grotesk-latin-ext.woff2',
  './fonts/instrument-serif-latin.woff2',
  './fonts/instrument-serif-latin-ext.woff2',
  './fonts/instrument-serif-italic-latin.woff2',
  './fonts/instrument-serif-italic-latin-ext.woff2',
  './fonts/martian-mono-latin.woff2',
  './fonts/martian-mono-latin-ext.woff2',
  // The print's and the artist screen's face: Sora (OFL), one variable family.
  './fonts/sora-latin.woff2',
  './fonts/sora-latin-ext.woff2',
  // Wave-1 festival data modules. Must be cached alongside data.jsx and must
  // load before it — index.html enforces the order; this list only has to make
  // sure they are all present offline. A missing one drops that festival from
  // the switcher (data.jsx warns and skips) rather than breaking the app.
  `./data/festivals/ultra-miami-2026.js?v=${APP_VER}`,
  `./data/festivals/governors-ball-2026.js?v=${APP_VER}`,
  `./data/festivals/summerfest-2026.js?v=${APP_VER}`,
  `./data/festivals/lollapalooza-2026.js?v=${APP_VER}`,
  `./data/festivals/outside-lands-2026.js?v=${APP_VER}`,
  `./data/festivals/iii-points-2026.js?v=${APP_VER}`,
  `./data/festivals/nocturnal-wonderland-2026.js?v=${APP_VER}`,
  `./data/festivals/crssd-fall-2026.js?v=${APP_VER}`,
  `./data/festivals/portola-2026.js?v=${APP_VER}`,
  `./data/festivals/hard-summer-2026.js?v=${APP_VER}`,
  `./data/festivals/arc-2026.js?v=${APP_VER}`,
  `./data/festivals/escape-halloween-2026.js?v=${APP_VER}`,
  `./data/festivals/dreamstate-socal-2026.js?v=${APP_VER}`,
  `./data/festivals/decadence-colorado-2026.js?v=${APP_VER}`,
  `./data/festivals/countdown-nye-2026.js?v=${APP_VER}`,
  // Licensed artist-photo ledger runtime (data/artist-photos/ledger.json → build-artist-photo-ledger.mjs).
  `./data/artist-photos.js?v=${APP_VER}`,
  // One artist key for the photo lookup and the registry (artist repository M3).
  `./data/artist-key.js?v=${APP_VER}`,
  // Festival-art ledger (Item 6): official tile art, data/festival-art.js.
  `./data/festival-art.js?v=${APP_VER}`,
  // Ground plates (mapImage targets). Not every festival module has one: ARC,
  // III Points, CRSSD and Portola ship mapMode "real" and no plate.
  //
  // ⚠ THIS LIST IS ATOMIC. The install handler below uses cache.addAll(), which
  // rejects as a unit — ONE entry that 404s and NOTHING here gets cached, so the
  // whole app silently stops working offline. It only console.warn()s, so the
  // symptom is invisible until someone is on a festival field with no signal.
  // That is why the "precache integrity" gate in scripts/verify.mjs asserts, in
  // both directions, that every mapImage is listed here and every own-origin
  // entry here exists on disk and is tracked in git.
  //
  // Born from: acl-park.webp, edc-map-2026.jpg and edco-tinker-2026.jpg were all
  // rendered by the app but never added here — ACL (Oct 9), EDC and EDC Orlando
  // (Nov 6-8) each had no offline map, which is the point of the app on a field.
  './ultra-2026.svg',
  './govball-2026.svg',
  './summerfest-2026.svg',
  './lolla-2026.svg',
  './osl-2026.svg',
  './nocturnal-2026.svg',
  './hard-summer-2026.webp',
  './escape-2025-map.webp',
  './acl-park-2026.webp',
  './iiip-map-2026.webp',
  './edc-map-2026.jpg',
  './edco-tinker-2026.jpg',
  './artist-photos/afrojack.webp',
  './artist-photos/alan-walker.webp',
  './artist-photos/alesso.webp',
  './artist-photos/alison-wonderland.webp',
  './artist-photos/alok.webp',
  './artist-photos/amyl-and-the-sniffers.webp',
  './artist-photos/bone-thugs-n-harmony.webp',
  './artist-photos/boys-noize.webp',
  './artist-photos/cascada.webp',
  './artist-photos/charli-xcx.webp',
  './artist-photos/charlotte-de-witte.webp',
  './artist-photos/chuckie.webp',
  './artist-photos/connan-mockasin.webp',
  './artist-photos/da-tweekaz.webp',
  './artist-photos/danny-brown.webp',
  './artist-photos/deorro.webp',
  './artist-photos/dimitri-vegas-and-like-mike.webp',
  './artist-photos/dj-harvey.webp',
  './artist-photos/dj-snake.webp',
  './artist-photos/excision.webp',
  './artist-photos/floating-points.webp',
  './artist-photos/flying-lotus.webp',
  './artist-photos/four-tet.webp',
  './artist-photos/galantis.webp',
  './artist-photos/hardwell.webp',
  './artist-photos/honey-dijon.webp',
  './artist-photos/jane-remover.webp',
  './artist-photos/john-summit.webp',
  './artist-photos/kaskade.webp',
  './artist-photos/kelela.webp',
  './artist-photos/ki-ki.webp',
  './artist-photos/kings-of-leon.webp',
  './artist-photos/laidback-luke.webp',
  './artist-photos/lane-8.webp',
  './artist-photos/lil-kim.webp',
  './artist-photos/lorde.webp',
  './artist-photos/luciano.webp',
  './artist-photos/marco-carola.webp',
  './artist-photos/marshmello.webp',
  './artist-photos/martin-garrix.webp',
  './artist-photos/men-i-trust.webp',
  './artist-photos/nina-kraviz.webp',
  './artist-photos/parcels.webp',
  './artist-photos/purity-ring.webp',
  './artist-photos/richie-hawtin.webp',
  './artist-photos/rusowsky.webp',
  './artist-photos/seth-troxler.webp',
  './artist-photos/skrillex.webp',
  './artist-photos/slander.webp',
  './artist-photos/steve-aoki.webp',
  './artist-photos/the-war-on-drugs.webp',
  './artist-photos/tiesto.webp',
  './artist-photos/tokischa.webp',
  './artist-photos/tricky.webp',
  './artist-photos/underworld.webp',
  './artist-photos/zedd.webp',
  './festival-art/acl-2026.webp',
  './festival-art/arc-2026.webp',
  './festival-art/beyond-wonderland-gorge-2027.webp',
  './festival-art/beyond-wonderland-socal-2027.webp',
  './festival-art/coachella-2027.webp',
  './festival-art/countdown-nye-2026.webp',
  './festival-art/crssd-fall-2026.webp',
  './festival-art/dreamstate-socal-2026.webp',
  './festival-art/edc-lv-2026.webp',
  './festival-art/edc-mexico-2027.webp',
  './festival-art/edc-orlando-2026.webp',
  './festival-art/escape-halloween-2026.webp',
  './festival-art/governors-ball-2026.webp',
  './festival-art/hard-summer-2026.webp',
  './festival-art/iii-points-2026.webp',
  './festival-art/lollapalooza-2026.webp',
  './festival-art/lost-lands-2026.webp',
  './festival-art/nocturnal-wonderland-2026.webp',
  './festival-art/outside-lands-2026.webp',
  './festival-art/portola-2026.webp',
  './festival-art/summerfest-2026.webp',
  './festival-art/tomorrowland-2027.webp',
  './festival-art/ultra-miami-2026.webp',
  './festival-art/tiles/acl-2026.webp',
  './festival-art/tiles/arc-2026.webp',
  './festival-art/tiles/beyond-wonderland-gorge-2027.webp',
  './festival-art/tiles/beyond-wonderland-socal-2027.webp',
  './festival-art/tiles/coachella-2027.webp',
  './festival-art/tiles/countdown-nye-2026.webp',
  './festival-art/tiles/crssd-fall-2026.webp',
  './festival-art/tiles/decadence-colorado-2026.webp',
  './festival-art/tiles/dreamstate-socal-2026.webp',
  './festival-art/tiles/edc-lv-2026.webp',
  './festival-art/tiles/edc-mexico-2027.webp',
  './festival-art/tiles/edc-orlando-2026.webp',
  './festival-art/tiles/electric-forest-2027.webp',
  './festival-art/tiles/escape-halloween-2026.webp',
  './festival-art/tiles/governors-ball-2026.webp',
  './festival-art/tiles/hard-summer-2026.webp',
  './festival-art/tiles/iii-points-2026.webp',
  './festival-art/tiles/lollapalooza-2026.webp',
  './festival-art/tiles/lost-lands-2026.webp',
  './festival-art/tiles/nocturnal-wonderland-2026.webp',
  './festival-art/tiles/outside-lands-2026.webp',
  './festival-art/tiles/portola-2026.webp',
  './festival-art/tiles/summerfest-2026.webp',
  './festival-art/tiles/tomorrowland-2027.webp',
  './festival-art/tiles/ultra-miami-2026.webp',
  `./build/ios-frame.js?v=${APP_VER}`,
  `./build/data.js?v=${APP_VER}`,
  `./build/supabase.js?v=${APP_VER}`,
  `./build/machine.js?v=${APP_VER}`,
  `./build/chrome.js?v=${APP_VER}`,
  `./build/home.js?v=${APP_VER}`,
  `./build/map.js?v=${APP_VER}`,
  `./build/survey.js?v=${APP_VER}`,
  `./build/lineup.js?v=${APP_VER}`,
  `./build/artist.js?v=${APP_VER}`,
  `./build/photo-tag.js?v=${APP_VER}`,
  `./build/spotify-api.js?v=${APP_VER}`,
  `./build/recap-engine.js?v=${APP_VER}`,
  `./build/historical.js?v=${APP_VER}`,
  `./build/artists.js?v=${APP_VER}`,
  `./build/landing.js?v=${APP_VER}`,
  `./build/spotify.js?v=${APP_VER}`,
  `./build/app.js?v=${APP_VER}`,
];

// Third-party CDN scripts â€” pinned exact versions, content is immutable.
// Precached so the app boots with zero connectivity at the EDC venue.
// Each is caught individually so a CDN hiccup doesn't abort SW install.
const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  // The real map's library (map.jsx PACK_LIB, same pinned URLs). It used to
  // load on first Map open only, which failed on festival 5G and left
  // III Points with no map surface (M1, Oct 16). test-maplibre-field-load.mjs
  // fails if PACK_LIB names a URL that is not in this list.
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap',
];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// Map basemap providers used by the Real Map (BETA). Vector tiles + style
// JSON + glyphs + sprites from OpenFreeMap; raster satellite imagery from
// Esri. Cached opportunistically: pan around the LVMS area while online
// and the tiles you visit get stored, then work offline at the festival.
const TILE_HOSTS = ['tiles.openfreemap.org', 'server.arcgisonline.com'];

// Never intercept live API calls â€” let them fail naturally when offline.
// An offline-pack download (map.jsx, marked plursky-pack=1) passes through
// too: the pack keeps its own copy in IndexedDB, and letting this worker also
// file its tiles in TILE_CACHE and MapLibre in the app cache would change the
// active festival's cache for another festival's download.
function isPassThrough(url) {
  return url.includes('plursky-pack=1')         ||
         url.includes('accounts.spotify.com') ||
         url.includes('api.spotify.com')       ||
         url.includes('api.music.apple.com')   ||
         url.includes('anthropic.com')          ||
         url.includes('/v1/messages')           ||
         url.includes('.supabase.co');
}

function isCDN(url) {
  return CDN_HOSTS.some(h => url.includes(h));
}

function isTile(url) {
  return TILE_HOSTS.some(h => url.includes(h));
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      // Own-origin critical path â€” atomic, fail-fast
      await c.addAll(LOCAL.map(u => new Request(u, { cache: 'no-store' })))
             .catch(err => console.warn('[sw] local precache fail', err));
      // CDN â€” best-effort, each caught individually
      await Promise.all(CDN.map(u =>
        c.add(new Request(u, { mode: 'cors', credentials: 'omit' }))
         .catch(err => console.warn('[sw] cdn precache miss', u, err))
      ));
    })
  );
});

self.addEventListener('activate', e => {
  // Keep both the current app cache and the tile cache. Drop only old
  // plursky-* caches from previous versions. Tile cache survives bumps so
  // users don't re-download the LVMS area on every deploy.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== TILE_CACHE && k.startsWith('plursky-'))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (isPassThrough(req.url)) return;

  // Map tiles + style + glyphs + sprites: cache-first into the dedicated
  // tile cache. Tiles for a given (z, x, y) are immutable so we never need
  // to revalidate; first visit while online stores it forever (or until
  // browser evicts the cache under storage pressure).
  if (isTile(req.url)) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req, { mode: 'cors', credentials: 'omit' }).then(resp => {
          if (resp && resp.status === 200)
            caches.open(TILE_CACHE).then(c => c.put(req, resp.clone()));
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // CDN + fonts: cache-first (immutable pinned versions; woff2 cached on first use)
  if (isCDN(req.url)) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req, { mode: 'cors', credentials: 'omit' }).then(resp => {
          if (resp && resp.status === 200)
            caches.open(CACHE).then(c => c.put(req, resp.clone()));
          return resp;
        });
      })
    );
    return;
  }

  // Own-origin: network-first so deploys propagate; SW cache fallback when offline.
  // cache:'no-store' bypasses browser HTTP cache so GH-Pages max-age=600 can't pin
  // users to stale index.html between SW updates.
  e.respondWith(
    fetch(req, { cache: 'no-store' }).then(resp => {
      if (resp && resp.status === 200)
        caches.open(CACHE).then(c => c.put(req, resp.clone()));
      return resp;
    }).catch(() =>
      caches.match(req).then(c => c || caches.match('./index.html'))
    )
  );
});

// â”€â”€ Push (server-driven) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {
    try { data = { title: 'Plursky', body: e.data ? e.data.text() : '' }; } catch {}
  }
  e.waitUntil(self.registration.showNotification(data.title || 'Plursky', {
    body:    data.body  || '',
    icon:    data.icon  || '/og.svg',
    badge:   data.badge || '/og.svg',
    tag:     data.tag   || 'plursky',
    data:    { url: data.url || '/' },
    vibrate: [80, 40, 80],
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); return existing.navigate?.(target); }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('sync', e => {
  if (e.tag === 'flush-location-queue') e.waitUntil(Promise.resolve());
});
