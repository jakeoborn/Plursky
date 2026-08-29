// ─────────────────────────────────────────────────────────────────
// photo-tag.jsx — EXIF parsing + photo auto-tagging (monolith split 3/N)
// Extracted verbatim from spotify.jsx.
//
// Pure logic, no React components, no window exports: JPEG EXIF parsing
// (DateTimeOriginal + GPS), XMP/filename date fallbacks, festival-night
// derivation from a capture timestamp, haversine distance, nearest-amenity
// match, and the photo→artist auto-tag detector (_matchArtistForPhoto).
//
// Cross-file contract (unchanged): top-level decls are global across these
// babel scripts, so the moment-import flow in spotify.jsx (_processMomentMedia,
// _metaFromFile, AddMomentForm, MomentCard retag) calls these bare and they
// resolve at runtime regardless of load order. Nothing outside spotify.jsx
// uses them, so no window export is needed. Loaded before spotify.jsx.
// ─────────────────────────────────────────────────────────────────

// ── EXIF + auto-tag (v135) ────────────────────────────────────
// Parse JPEG EXIF for DateTimeOriginal + GPSLatitude/Longitude so a
// photo dragged in from Camera Roll lands on the right artist without
// the user picking from a chip list. iOS encodes EXIF time as local
// wall-clock (no tz) — at EDC that's PT, so we treat the parsed
// "YYYY:MM:DD HH:MM:SS" string as PT and convert to epoch ms via the
// festival's day-midnight UTC constants (which already bake in PT).

const _EXIF_TAG_EXIF_IFD = 0x8769;
const _EXIF_TAG_GPS_IFD  = 0x8825;
const _EXIF_TAG_DATETIME_ORIGINAL = 0x9003;
const _EXIF_TAG_GPS_LAT_REF = 0x0001;
const _EXIF_TAG_GPS_LAT     = 0x0002;
const _EXIF_TAG_GPS_LNG_REF = 0x0003;
const _EXIF_TAG_GPS_LNG     = 0x0004;

// Try multiple date formats — ISO 8601 (XMP-style) and EXIF (colon-sep).
// Returns the canonical { yr, mo, dy, hh, mm, ss } shape or null.
function _parseDateString(s) {
  if (!s) return null;
  // ISO 8601: 2026-05-15T23:35:00(.000)?(±HH:MM|Z)?
  let m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  // EXIF colon: 2026:05:15 23:35:00
  m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  return null;
}

// XMP packets are XML embedded in an APP1 segment with the prefix
// "http://ns.adobe.com/xap/1.0/\0". WebKit (and most iOS pickers)
// sometimes strip the binary EXIF block but leave the XMP intact — so
// this is a real recovery path for "the photo has no DateTimeOriginal
// but the XMP CreateDate is fine". Regex over the packet text is way
// simpler than spinning up a DOM parser for the rare cases we hit it.
function _parseXmpDateFromText(xmpText) {
  if (!xmpText) return null;
  const patterns = [
    /<exif:DateTimeOriginal>([^<]+)<\/exif:DateTimeOriginal>/,
    /exif:DateTimeOriginal=["']([^"']+)["']/,
    /<photoshop:DateCreated>([^<]+)<\/photoshop:DateCreated>/,
    /photoshop:DateCreated=["']([^"']+)["']/,
    /<xmp:CreateDate>([^<]+)<\/xmp:CreateDate>/,
    /xmp:CreateDate=["']([^"']+)["']/,
  ];
  for (const re of patterns) {
    const m = re.exec(xmpText);
    if (m) {
      const parsed = _parseDateString(m[1].trim());
      if (parsed) return parsed;
    }
  }
  return null;
}

// Tertiary fallback when both EXIF and XMP are stripped: iOS screenshots
// and a few other system-generated files encode the capture time in the
// filename. Worth a try because file.lastModified on the WebKit picker
// path is usually the conversion timestamp (= "right now"), not when
// the photo was taken.
function _parseFilenameDate(name) {
  if (!name) return null;
  let m;
  // iOS screenshot: "Screenshot 2026-05-15 at 23.35.49.png"
  m = /Screenshot\s+(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{2})\.(\d{2})\.(\d{2})/i.exec(name);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  // iOS "Photo on" format: "Photo on 2026-05-15 at 11.35 PM.jpg"
  m = /Photo\s+on\s+(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{1,2})\.(\d{2})\s*(AM|PM)/i.exec(name);
  if (m) {
    let hh = +m[4];
    if (/PM/i.test(m[6]) && hh < 12) hh += 12;
    if (/AM/i.test(m[6]) && hh === 12) hh = 0;
    return { yr: +m[1], mo: +m[2], dy: +m[3], hh, mm: +m[5], ss: 0 };
  }
  // Android camera: "IMG_20260515_233549.jpg" / "VID_20260515_233549.mp4"
  m = /[IV][MD][GP]_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(name);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  return null;
}

async function _parseExifMeta(file) {
  const out = { date: null, lat: null, lng: null };
  if (!file) return out;
  // Videos carry no JPEG EXIF — their capture time + GPS live in the MP4/MOV
  // `moov` atom. Without this, videos fell through to file.lastModified (=
  // the WebKit picker's import time), so every clip auto-tagged to "now" →
  // wrong artist/night. Delegate to the atom reader so a video matches by its
  // true capture time like a photo does. (v209 — fixes mis-tagged videos.)
  const name = String(file.name || "");
  const type = String(file.type || "");
  const isVideo = /^video\//.test(type) || /\.(mov|mp4|m4v)$/i.test(name);
  const isImage = /^image\//.test(type) || /\.(jpe?g|heic|png|webp)$/i.test(name);
  if (isVideo) return _parseVideoMeta(file);
  if (!isImage) return out;
  try {
    // 256 KB is enough for the APP1 segment on any modern phone photo.
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const dv = new DataView(buf);
    if (dv.getUint16(0) !== 0xFFD8) return out; // not a JPEG → no EXIF
    // Scan ALL APP1 segments — a file may have separate EXIF + XMP
    // segments, and WebKit's HEIC→JPEG conversion is observed to
    // sometimes strip one but preserve the other. Try both before
    // giving up.
    let off = 2;
    while (off + 4 < dv.byteLength) {
      if (dv.getUint8(off) !== 0xFF) break;
      const marker = dv.getUint16(off);
      const len    = dv.getUint16(off + 2);
      if (marker === 0xFFE1 && len > 8) {
        // "Exif\0\0" header at off+4
        const exifHdr =
          dv.getUint8(off + 4) === 0x45 && // E
          dv.getUint8(off + 5) === 0x78 && // x
          dv.getUint8(off + 6) === 0x69 && // i
          dv.getUint8(off + 7) === 0x66;   // f
        if (!exifHdr) {
          // Not EXIF — maybe XMP. Check the Adobe namespace header.
          if (!out.date) {
            const XMP_HDR = "http://ns.adobe.com/xap/1.0/";
            let isXmp = true;
            for (let i = 0; i < XMP_HDR.length; i++) {
              if (dv.getUint8(off + 4 + i) !== XMP_HDR.charCodeAt(i)) { isXmp = false; break; }
            }
            if (isXmp) {
              const xmpStart = off + 4 + XMP_HDR.length + 1; // skip header + NUL
              const xmpEnd   = off + 2 + len;
              let text = "";
              for (let i = xmpStart; i < Math.min(xmpEnd, dv.byteLength); i++) {
                text += String.fromCharCode(dv.getUint8(i));
              }
              const xmpDate = _parseXmpDateFromText(text);
              if (xmpDate) out.date = xmpDate;
            }
          }
          off += 2 + len; continue;
        }
        const tiff = off + 10;
        const byteOrder = dv.getUint16(tiff);
        const little = byteOrder === 0x4949;
        const u16 = (p) => dv.getUint16(p, little);
        const u32 = (p) => dv.getUint32(p, little);
        if (u16(tiff + 2) !== 0x002A) return out;
        const ifd0 = tiff + u32(tiff + 4);
        const readEntries = (ifdOff) => {
          const n = u16(ifdOff);
          const entries = {};
          for (let i = 0; i < n; i++) {
            const eOff = ifdOff + 2 + i * 12;
            entries[u16(eOff)] = {
              type:  u16(eOff + 2),
              count: u32(eOff + 4),
              valOff: eOff + 8, // 4-byte value or pointer
            };
          }
          return entries;
        };
        const ifd0Entries = readEntries(ifd0);
        // ExifIFD → DateTimeOriginal
        const exifPtr = ifd0Entries[_EXIF_TAG_EXIF_IFD];
        if (exifPtr) {
          const exifIfd = tiff + u32(exifPtr.valOff);
          const exifEntries = readEntries(exifIfd);
          const dto = exifEntries[_EXIF_TAG_DATETIME_ORIGINAL];
          if (dto && dto.count > 0) {
            // ASCII at value or pointer (string > 4 bytes → pointer)
            const strOff = dto.count > 4 ? tiff + u32(dto.valOff) : dto.valOff;
            let str = "";
            for (let i = 0; i < Math.min(dto.count - 1, 24); i++) {
              const c = dv.getUint8(strOff + i);
              if (c === 0) break;
              str += String.fromCharCode(c);
            }
            // Format: "YYYY:MM:DD HH:MM:SS"
            const m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(str);
            if (m) {
              // Build PT epoch — EDC festival is in Vegas (UTC-7 PDT in May).
              // FESTIVAL_CONFIG.dayDates[*].midnightUtc already encodes that
              // (e.g. May 15 00:00 PT = May 15 07:00 UTC). We compute the
              // photo's offset from its calendar day's PT midnight, then add
              // to the day's midnightUtc to land on a true UTC epoch.
              const yr = +m[1], mo = +m[2], dy = +m[3];
              const hh = +m[4], mm = +m[5], ss = +m[6];
              // For now, ignore the date-from-EXIF year/month and just use
              // time-of-day vs. nearest festival night. This sidesteps EXIF
              // timezone weirdness — if a photo was taken at 11:30 PM it was
              // taken at 11:30 PM whatever the device clock thinks the day is.
              out.date = { yr, mo, dy, hh, mm, ss };
            }
          }
        }
        // GPSIFD → Latitude + Longitude
        const gpsPtr = ifd0Entries[_EXIF_TAG_GPS_IFD];
        if (gpsPtr) {
          const gpsIfd = tiff + u32(gpsPtr.valOff);
          const gpsEntries = readEntries(gpsIfd);
          const readRationalDeg = (entry) => {
            if (!entry || entry.count !== 3 || entry.type !== 5) return null;
            const off2 = tiff + u32(entry.valOff);
            const r = (p) => u32(p) / u32(p + 4);
            return r(off2) + r(off2 + 8) / 60 + r(off2 + 16) / 3600;
          };
          const lat = readRationalDeg(gpsEntries[_EXIF_TAG_GPS_LAT]);
          const lng = readRationalDeg(gpsEntries[_EXIF_TAG_GPS_LNG]);
          if (lat != null) {
            const refEntry = gpsEntries[_EXIF_TAG_GPS_LAT_REF];
            const refCh = refEntry ? String.fromCharCode(dv.getUint8(refEntry.valOff)) : "N";
            out.lat = refCh === "S" ? -lat : lat;
          }
          if (lng != null) {
            const refEntry = gpsEntries[_EXIF_TAG_GPS_LNG_REF];
            const refCh = refEntry ? String.fromCharCode(dv.getUint8(refEntry.valOff)) : "E";
            out.lng = refCh === "W" ? -lng : lng;
          }
        }
        return out;
      }
      off += 2 + len;
    }
  } catch {}
  return out;
}

// MP4/MOV capture metadata (v209) — videos store creation time in the `moov`
// → `mvhd` box (seconds since 1904-01-01 UTC) and, on iOS, GPS in a `©xyz`
// (ISO-6709) box. We walk only the TOP-LEVEL boxes (skipping the huge `mdat`
// by offset — never reading it) to find `moov`, then read just that box. The
// mvhd time is UTC; we convert to festival-LOCAL wall-clock to match how EXIF
// DateTimeOriginal is treated downstream (see _photoEpochUtc).
async function _parseVideoMeta(file) {
  const out = { date: null, lat: null, lng: null, timestampSource: null, locationSource: null, rawUtcMs: null };
  if (!file) return out;
  try {
    const size = file.size;
    const slice = async (start, len) =>
      new DataView(await file.slice(start, start + Math.min(len, size - start)).arrayBuffer());
    // 1) Walk top-level boxes to locate `moov` (often at EOF on iOS).
    let pos = 0, moov = null;
    while (pos + 8 <= size) {
      const h = await slice(pos, 16);
      let boxSize = h.getUint32(0);
      const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
      let hdr = 8;
      if (boxSize === 1) { boxSize = h.getUint32(8) * 4294967296 + h.getUint32(12); hdr = 16; }
      else if (boxSize === 0) { boxSize = size - pos; }
      if (boxSize < hdr) break;
      if (type === "moov") { moov = await slice(pos, Math.min(boxSize, 2 * 1024 * 1024)); break; }
      pos += boxSize;
    }
    if (!moov) return out;
    // 2) Walk the (small, structured) moov for mvhd creation time + GPS.
    const n = moov.byteLength;
    const typeAt = (dv, i) => String.fromCharCode(dv.getUint8(i), dv.getUint8(i+1), dv.getUint8(i+2), dv.getUint8(i+3));
    const parseIso6709 = (s) => {
      const m = /([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(s || "");
      return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
    };
    const readAscii = (start, len) => {
      let s = "";
      for (let k = 0; k < Math.min(len, 256) && start + k < n; k++) {
        const c = moov.getUint8(start + k);
        if (!c) continue;
        if (c >= 32 && c <= 126) s += String.fromCharCode(c);
      }
      return s;
    };
    const visit = (start, end, depth) => {
      if (depth > 6) return;
      let pos = start;
      while (pos + 8 <= end && pos + 8 <= n) {
        let boxSize = moov.getUint32(pos);
        const type = typeAt(moov, pos + 4);
        let hdr = 8;
        if (boxSize === 1 && pos + 16 <= n) { boxSize = moov.getUint32(pos + 8) * 4294967296 + moov.getUint32(pos + 12); hdr = 16; }
        else if (boxSize === 0) boxSize = end - pos;
        if (!boxSize || boxSize < hdr || pos + boxSize > n + 1) break;
        const payload = pos + hdr;
        const boxEnd = Math.min(n, pos + boxSize);
        if (!out.date && type === "mvhd" && boxEnd - payload >= 16) {
          const ver = moov.getUint8(payload);
          const secs = ver === 1 && boxEnd - payload >= 28
            ? moov.getUint32(payload + 4) * 4294967296 + moov.getUint32(payload + 8)
            : moov.getUint32(payload + 4);
        const unixMs = (secs - 2082844800) * 1000; // 1904→1970 epoch shift
          const tooFuture = unixMs > Date.now() + 366 * 24 * 3600000;
          if (secs > 2082844800 && isFinite(unixMs) && !tooFuture) {
          const d = new Date(unixMs + _festivalTzOffsetHours() * 3600000);
          out.date = { yr: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, dy: d.getUTCDate(),
                       hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds() };
            out.timestampSource = "video-mvhd";
            out.rawUtcMs = unixMs;
        }
      }
        if (out.lat == null && type === "©xyz") {
          const p = parseIso6709(readAscii(payload, boxEnd - payload));
          if (p) { out.lat = p.lat; out.lng = p.lng; out.locationSource = "video-xyz"; }
        }
        if (["trak", "mdia", "minf", "stbl", "udta", "meta", "ilst", "moov"].includes(type)) {
          visit(type === "meta" ? Math.min(boxEnd, payload + 4) : payload, boxEnd, depth + 1);
        }
        pos += boxSize;
      }
    };
    visit(8, n, 0);
  } catch {}
  return out;
}

// Given EXIF metadata + the list of saved-set IDs the user has tagged for
// any night, pick the best matching artist:
//   1. Prefer an artist whose set window contains the photo time AND whose
//      stage is closest to the photo GPS (if GPS available).
//   2. If no time match in saved sets, expand to ALL artists on that night.
//   3. If still nothing, return null.
// v146 fix: use the photo's actual DATE (yr/mo/dy) to determine which
// festival night it belongs to BEFORE matching artists. The prior version
// only used time-of-day, which meant a Saturday 10:30 PM photo could be
// tagged as a Friday artist whose set happened to overlap 10:30 PM.
//
// Festival night N runs from Day N at 19:00 local to Day N+1 at 06:00 local.
// `FESTIVAL_CONFIG.dayDates[n].midnightUtc` is the UTC epoch corresponding
// to Day N's local 00:00, so [+19h, +30h] is the night window in UTC.
// v235: every one of these took its festival from window.FESTIVAL_CONFIG —
// the ACTIVE one. They now take a config, defaulting to active, so the same
// timestamp can be asked about EVERY known festival (see
// _resolveFestivalForPhoto below). Callers that pass nothing behave exactly
// as they did before.
function _festivalTzOffsetHours(cfg) {
  const day1 = (cfg || window.FESTIVAL_CONFIG)?.dayDates?.[1];
  if (!day1) return -7; // PT default
  return -new Date(day1.midnightUtc).getUTCHours();
}
function _photoEpochUtc(date, cfg) {
  // EXIF DateTimeOriginal / file.lastModified gives festival-local wall
  // clock (iOS phones store capture time in device-local, no tz). Convert
  // to UTC epoch using the festival's offset.
  const offset = _festivalTzOffsetHours(cfg); // e.g. -7 for PDT
  return Date.UTC(date.yr, date.mo - 1, date.dy, date.hh, date.mm, date.ss || 0)
       - offset * 3600000;
}
// Inverse of _photoEpochUtc: a true UTC instant → the wall clock a person
// standing at THAT festival would have read off their phone. Videos are the
// only source that gives us a real instant (mvhd is UTC); EXIF images give a
// wall clock with no zone, which is why they cannot use this.
function _wallClockFromUtc(utcMs, cfg) {
  const d = new Date(utcMs + _festivalTzOffsetHours(cfg) * 3600000);
  return { yr: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, dy: d.getUTCDate(),
           hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds() };
}
// `utcMs`, when present, is the AUTHORITATIVE instant and `date` is ignored.
// A video's wall clock cannot be computed until we know which festival it
// belongs to, and that is exactly what this function is being called to help
// decide — so for videos the question is asked in UTC, where it has one
// answer, instead of in a wall clock that silently assumed a timezone.
function _photoFestivalNight(date, cfgIn, utcMs) {
  const cfg = cfgIn || window.FESTIVAL_CONFIG;
  if (!cfg?.dayDates) return null;
  if (utcMs == null && !date) return null;
  const photoMs = utcMs != null ? utcMs : _photoEpochUtc(date, cfg);
  for (const n of Object.keys(cfg.dayDates).map(Number)) {
    const dm = cfg.dayDates[n];
    if (!dm) continue;
    // 11:00 local of day N → 06:00 local day N+1. Was 19:00→06:00 (EDC's
    // overnight shape) — but daytime festivals (ACL, Electric Forest) run
    // sets from ~noon, so every afternoon photo fell outside the window
    // and the attended/saved set-time match never ran. 11:00 still can't
    // overlap the previous night's +30h end (06:00 < 11:00), so post-
    // midnight photos keep bucketing to the night they belong to.
    const startMs = dm.midnightUtc + 11 * 3600000;     // 11:00 local, day N
    const endMs   = dm.midnightUtc + 30 * 3600000;     // 06:00 local, day N+1
    if (photoMs >= startMs - 30 * 60000 && photoMs <= endMs + 30 * 60000) return n;
  }
  return null;
}

// Great-circle distance in meters. Only used for off-stage detection so
// precision isn't critical, but haversine is ~5 lines and exact.
function _haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Which festival is this photo actually FROM? (v235) ────────────────────
// Everything downstream used to read window.FESTIVAL_CONFIG / window.ARTISTS,
// i.e. whichever festival is SELECTED — not the one the photo was taken at.
// The failure that produces: import an EDC clip while ACL is the active
// festival, and its May timestamp is checked against ACL's October dayDates,
// matches no night, and comes back `outside_festival_window`. The importer
// then does `night = matched.night || fallbackNight` and stamps
// `festivalId: window.FESTIVAL_CONFIG.id`, so the EDC clip lands in ACL
// night 1, untagged. That is not a display glitch you can switch away from:
// _activeMoments() keeps a moment only when its festivalId is the current
// one, so the wrong stamp is persisted and switching back to EDC does not
// bring the clip back.
//
// Resolution order — timestamp first, geo purely as the tiebreak:
//   1. Ask EVERY festival in _DATA_SETS which of ITS nights contains the
//      capture time, each evaluated in its OWN timezone.
//   2. Only if two or more claim it: keep those whose site the photo's GPS
//      is actually near, then the nearest. Two festivals on one weekend is a
//      real shape (EDC Orlando vs. a same-weekend event), and geo is the
//      only thing that separates them.
//   3. No festival claims the time → resolve against the ACTIVE festival,
//      exactly as before, and let the caller's fallbackNight take over.
function _activeDataSet() {
  return {
    id: window.FESTIVAL_CONFIG?.id || null,
    config: window.FESTIVAL_CONFIG || {},
    artists: window.ARTISTS || [],
    amenities: window.AMENITIES || [],
  };
}
// Only festivals the user can actually SWITCH TO are resolution candidates.
// This is load-bearing, not tidiness: _DATA_SETS carries the gated entries
// too (Lost Lands, EDC Orlando, Forest), and getActiveFestivalId() refuses
// any id whose registry entry is `available: false`. Resolve a photo to a
// gated festival and it gets stamped with an id the user can never select —
// _activeMoments() would hide it on every screen with no way to reach it.
// A gated festival's set times are PROVISIONAL anyway, so matching artists
// against one would be wrong even if the moment were reachable.
// The active festival is always a candidate (it is available by definition).
function _allDataSets() {
  const sets = window._DATA_SETS;
  if (!sets) return [_activeDataSet()];
  const reg = window.FESTIVALS_REGISTRY || [];
  const activeId = window.FESTIVAL_CONFIG?.id || null;
  const usable = (id) => id === activeId ||
    !!reg.find(f => f?.config?.id === id && f.available);
  return Object.keys(sets).filter(usable).map(id => ({
    id,
    config: sets[id]?.config || {},
    artists: sets[id]?.artists || [],
    amenities: sets[id]?.amenities || [],
  }));
}
// Deliberately generous. `gps.onSiteRadiusMi` describes the FOOTPRINT, and a
// campground / shuttle-lot / hotel photo sits outside it while still plainly
// belonging to that festival. This radius only has to tell two festivals
// apart — it is not a geofence, so erring wide costs nothing.
function _nearSiteMeters(cfg) {
  return Math.max((cfg?.gps?.onSiteRadiusMi || 0.4) * 1609.34 * 5, 15000);
}
function _festivalSiteMeters(cfg, lat, lng) {
  const g = cfg?.gps;
  if (!g || g.lat == null || g.lng == null) return null;
  return _haversineMeters(lat, lng, g.lat, g.lng);
}
function _resolveFestivalForPhoto(meta) {
  const active = _activeDataSet();
  const asActive = (why) => ({ ...active, night: null, siteMeters: null, resolvedBy: why });
  if (!meta?.date && meta?.rawUtcMs == null) return asActive("active_no_date");

  // 1. TIME — every known festival, each in its own timezone.
  //    For a video we hand each candidate the raw UTC instant, so each one
  //    answers in ITS OWN zone. Before this, the mvhd instant was collapsed to
  //    a wall clock at parse time using whichever festival happened to be on
  //    screen, so a PT video imported during a CT festival was asked about
  //    using a clock already 2h wrong — wrong night, wrong set window.
  const utcMs = meta.rawUtcMs != null ? meta.rawUtcMs : null;
  let cands = _allDataSets()
    .map(ds => ({ ds, night: _photoFestivalNight(meta.date, ds.config, utcMs), meters: null }))
    .filter(c => c.night != null);
  if (!cands.length) return asActive("active_no_time_match");

  let resolvedBy = "time";

  // 2. GEO — only ever used to SEPARATE two time matches, never to reject a
  //    lone one. A photo can legitimately have no GPS, or have GPS from the
  //    campground; neither should cost it its festival.
  const { lat, lng } = meta;
  if (cands.length > 1 && lat != null && lng != null) {
    for (const c of cands) c.meters = _festivalSiteMeters(c.ds.config, lat, lng);
    const near = cands.filter(c => c.meters != null && c.meters <= _nearSiteMeters(c.ds.config));
    if (near.length) { cands = near; resolvedBy = "time+geo"; }
    if (cands.length > 1) {
      const ranked = cands.filter(c => c.meters != null).sort((a, b) => a.meters - b.meters);
      if (ranked.length) { cands = [ranked[0]]; resolvedBy = "time+geo_nearest"; }
    }
  }

  // 3. Still tied with nothing to separate them: prefer the ACTIVE festival
  //    if it is one of the claimants — you are most likely importing the one
  //    you are looking at.
  let win = cands[0];
  if (cands.length > 1) {
    win = cands.find(c => c.ds.id === active.id) || cands[0];
    resolvedBy = "time_tie";
  }
  return { ...win.ds, night: win.night, siteMeters: win.meters, resolvedBy };
}
// "Does ANY festival we know about claim this timestamp?" Used by the
// trust gates in spotify.jsx that previously asked only the active one and
// so discarded a real capture time for a photo from a different festival.
function _anyFestivalNight(date, utcMs) {
  if (!date && utcMs == null) return null;
  for (const ds of _allDataSets()) {
    const night = _photoFestivalNight(date, ds.config, utcMs);
    if (night != null) return { festivalId: ds.id, night };
  }
  return null;
}

function _matchNearestLocation(lat, lng, ds) {
  const set = ds || _activeDataSet();
  const amenities = set.amenities || [];
  if (!amenities.length) return null;
  const cfg = set.config || {};
  // map.jsx's MAP_AFFINE is solved ONCE at eval time from the ACTIVE
  // festival's anchors + stages, so mapToGps is hard-bound to that festival.
  // Using it for a photo we resolved to a DIFFERENT festival would place
  // that festival's amenities through the wrong affine — the exact class of
  // bug this change exists to remove. For a non-active festival we therefore
  // fall back to the config-driven radial approximation below, which is
  // self-contained. Amenity naming is a 200 m nicety ("near Water Station"),
  // so the coarser placement is an acceptable, bounded loss; artist tagging,
  // which is what actually matters, uses cfg.gpsAnchors directly and stays
  // exact for every festival.
  const isActive = !set.id || set.id === window.FESTIVAL_CONFIG?.id;
  const mapToGps = isActive ? window.mapToGps : null;
  const hasAffine = !!(isActive && cfg.gpsAnchors?.length >= 3);

  const amenityToGps = (am) => {
    if (hasAffine && mapToGps) return mapToGps(am.x, am.y);
    if (!cfg.gps) return null;
    const scale = (cfg.gps.onSiteRadiusMi || 0.4) * 1609.34 / 50;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(cfg.gps.lat * Math.PI / 180);
    return {
      lat: cfg.gps.lat + ((am.y - 50) * scale) / mPerDegLat,
      lng: cfg.gps.lng + ((am.x - 50) * scale) / mPerDegLng,
    };
  };

  let best = null, bestDist = Infinity;
  for (const am of amenities) {
    const gps = amenityToGps(am);
    if (!gps) continue;
    const d = _haversineMeters(lat, lng, gps.lat, gps.lng);
    if (d < bestDist) { bestDist = d; best = am; }
  }
  if (!best || bestDist > 200) return null;
  const ICONS = { water: "💧", food: "🍔", med: "🏥", toilet: "🚻", art: "🎨", info: "ℹ️", charge: "🔋", locker: "🔐" };
  return { label: best.label, type: best.type, icon: ICONS[best.type] || "📍", distMeters: Math.round(bestDist) };
}

// `attendedIds` (v204): sets the user actually WATCHED outrank sets they
// merely SAVED. Scoring is attended(+1000) > saved(+500) > any-on-night. When
// 2+ sets at the SAME tier contain the capture time (overnight overlap across
// stages) we keep the best guess but flag `ambiguous` + `alternatives` so the
// card can surface a "fix tag" chip instead of silently committing to one.
//
// v235: `ds` (a resolved data set) is optional. Omitted, the matcher resolves
// the festival ITSELF from the timestamp + geo rather than assuming the
// active one, and reports it back as `festivalId` so the caller stamps the
// moment with the festival the photo is FROM, not the one on screen.
function _matchArtistForPhoto({ date, lat, lng, rawUtcMs }, savedIds, attendedIds, ds) {
  if (!date && rawUtcMs == null) return { artistId: null, night: null, festivalId: null, reason: "no_date" };
  // First: WHICH festival, and which of its nights, does this photo's
  // timestamp (+ GPS, as a tiebreak) place it in?
  const set = ds || _resolveFestivalForPhoto({ date, lat, lng, rawUtcMs });
  const cfg = set.config || {};
  const artists = set.artists || [];
  const festivalId = set.id || null;
  const resolvedBy = set.resolvedBy || "explicit";
  // NOW the festival is known, so a video's wall clock can finally be derived
  // against the right zone. Everything downstream — the night bucket, the
  // set-time window, the takenAt stamped on the moment — uses this, not the
  // provisional one guessed at parse time.
  const localDate = (rawUtcMs != null) ? _wallClockFromUtc(rawUtcMs, cfg) : date;
  const night = _photoFestivalNight(localDate, cfg, rawUtcMs);
  if (!night) return { artistId: null, night: null, festivalId, resolvedBy, reason: "outside_festival_window" };

  // NOTE: the GPS "off-stage" gate used to run HERE, before the attended/
  // saved set-time match — which was a bug. A photo taken from the middle/
  // back of a crowd is routinely >120m from a stage's single anchor point,
  // so the gate would return "off_stage" and DISCARD a perfectly good
  // attended-set match (you told us you watched that set AND filmed during
  // its window — that's ground truth that GPS drift must not override).
  // The off-stage gate now runs LATER, only as a fallback when no attended/
  // saved set contains the capture time. (v211 fix.)

  // SMARTEST SIGNAL: you film the sets you planned to see. Match the photo's
  // ABSOLUTE capture time against your SAVED sets' absolute windows. This
  // beats night-bucketing + stage-guessing: if you saved John Summit (Kinetic
  // day 2, 00:32–01:42) and filmed at 01:00, this tags John Summit even if the
  // night heuristic mis-bucketed it as day 3 (Martin Garrix). Uses each set's
  // day-midnight (UTC) + start/end, so it's night-correct by construction.
  const photoMs = _photoEpochUtc(date, cfg);
  // <8h post-midnight is treated as "still the same festival night" — must
  // match lineup.jsx toNightMin + _photoFestivalNight so a 1–6 AM set lands
  // on its own night and not the next calendar day.
  const setWindow = (a) => {
    const dm = cfg.dayDates?.[a.day];
    if (!dm) return null;
    const [sh, sm] = a.start.split(":").map(Number);
    const [eh, em] = a.end.split(":").map(Number);
    return {
      localDate,
      startMs: dm.midnightUtc + ((sh < 8 ? sh + 24 : sh) * 60 + sm) * 60000,
      endMs:   dm.midnightUtc + ((eh < 8 ? eh + 24 : eh) * 60 + em) * 60000,
    };
  };
  // SMARTEST SIGNAL: you film the sets you planned to see / actually saw.
  // Match the photo's ABSOLUTE capture time against the windows of every set
  // you ATTENDED (+1000) or SAVED (+500). Attended wins because being there is
  // ground truth; saved is intent. Night-correct by construction.
  const attendedSet = new Set(attendedIds || []);
  const savedSet    = new Set(savedIds || []);
  const priorIds    = [...new Set([...(attendedIds || []), ...(savedIds || [])])];
  const priorHits = priorIds
    .map(id => artists.find(a => a.id === id))
    .filter(Boolean)
    .map(a => { const w = setWindow(a); return w ? { a, ...w, score: attendedSet.has(a.id) ? 1000 : 500 } : null; })
    .filter(Boolean)
    // Trailing tolerance: attended sets get +20 (you being THERE is ground
    // truth; film often continues a few min into the changeover), saved keeps
    // the legacy +10. (2026-08-22 founder field report at EDC.)
    .filter(x => photoMs >= x.startMs - 5 * 60000 &&
                 photoMs <= x.endMs + (attendedSet.has(x.a.id) ? 20 : 10) * 60000);
  if (priorHits.length) {
    // Highest tier first (attended > saved); tightest-fit as tiebreak.
    priorHits.sort((x, y) => (y.score - x.score) || ((x.endMs - x.startMs) - (y.endMs - y.startMs)));
    const hit = priorHits[0];
    // Ambiguous only when 2+ DISTINCT sets share the TOP tier and both contain
    // the time (e.g. two saved sets overlap across stages) — an attended set
    // outranking a saved one is a clear win, not a tie.
    const topTier = priorHits.filter(h => h.score === hit.score);
    const ambiguous = topTier.length > 1;
    return {
      localDate,
      artistId: hit.a.id, night: hit.a.day, festivalId, resolvedBy,
      reason: attendedSet.has(hit.a.id) ? "attended_set_time" : "saved_set_time",
      ambiguous,
      alternatives: ambiguous ? topTier.map(h => h.a.id) : undefined,
    };
  }

  // Off-stage check (FALLBACK ONLY — runs after the attended/saved set-time
  // match above has already failed). If the photo has GPS and it's beyond
  // ~120m from EVERY stage anchor AND we couldn't tie it to a set you
  // saved/attended, you were probably between sets — on Rainbow Road, at a
  // vendor, in a charger line. Surface "off_stage" so the UI shows
  // 📍 BETWEEN SETS instead of force-tagging the nearest stage's artist.
  // This is deliberately AFTER the prior-set match so crowd-distance GPS
  // never overrides ground truth (you told us you watched that set).
  if (lat != null && lng != null) {
    // Crowd anchors where measured, poster pins otherwise. This gate is why
    // 0.2 matters beyond tagging: with kinetic's pin 438 m from where its
    // crowd actually stands, eight tight-fix photos taken AT the main stage
    // were 218-317 m from every anchor and got dumped here as "between sets".
    const anchors = resolvedStageAnchors(cfg);
    if (anchors.length > 0) {
      let nearest = null, minMeters = Infinity;
      for (const a of anchors) {
        const m = _haversineMeters(lat, lng, a.lat, a.lng);
        if (m < minMeters) { minMeters = m; nearest = a; }
      }
      if (minMeters > 120) {
        const loc = _matchNearestLocation(lat, lng, set);
        // Stamp provenance: an off_stage verdict reached against a poster pin
        // is a weaker claim than one reached against a measured position.
        return { localDate, artistId: null, night, festivalId, resolvedBy, reason: "off_stage", distMeters: Math.round(minMeters), location: loc,
                 anchorSource: nearest ? nearest.anchorSource : null };
      }
    }
  }

  // Then: which artist on THAT night was playing at the photo's time?
  const minOfDay = localDate.hh * 60 + localDate.mm;
  const adjustedMin = minOfDay < 480 ? minOfDay + 1440 : minOfDay;
  const candidates = [];
  for (const a of artists) {
    if (a.day !== night) continue;
    const [sh, sm] = a.start.split(":").map(Number);
    const [eh, em] = a.end.split(":").map(Number);
    const startMin = (sh < 8 ? sh + 24 : sh) * 60 + sm;
    const endMin   = (eh < 8 ? eh + 24 : eh) * 60 + em;
    if (adjustedMin >= startMin - 5 && adjustedMin <= endMin + 10) {
      candidates.push({ a, startMin, endMin });
    }
  }
  if (candidates.length === 0) {
    // CHANGEOVER-GAP RESCUE (founder field report, EDC 2026-08-22): a photo
    // taken while stages switch acts used to land untagged ("no artist at
    // time") even when GPS pins the user INSIDE a stage's footprint and the
    // 20-minute setlist says exactly who was up last/down next. If GPS is
    // within 120m of a stage anchor, tag that stage's temporally-nearest set
    // when it's within 60 min — flagged `ambiguous` so the card shows the
    // FIX TAG chip instead of pretending certainty.
    if (lat != null && lng != null) {
      const anchors = resolvedStageAnchors(cfg);
      let nearStage = null, nearStageM = Infinity, nearSource = null;
      for (const g of anchors) {
        const m = _haversineMeters(lat, lng, g.lat, g.lng);
        if (m < nearStageM) { nearStageM = m; nearStage = g.stageId; nearSource = g.anchorSource; }
      }
      if (nearStage && nearStageM <= 120) {
        let best = null, bestGap = Infinity;
        for (const a of artists) {
          if (a.day !== night || a.stage !== nearStage) continue;
          const [sh, sm] = a.start.split(":").map(Number);
          const [eh, em] = a.end.split(":").map(Number);
          const startMin = (sh < 8 ? sh + 24 : sh) * 60 + sm;
          const endMin   = (eh < 8 ? eh + 24 : eh) * 60 + em;
          const gap = adjustedMin < startMin ? startMin - adjustedMin : (adjustedMin > endMin ? adjustedMin - endMin : 0);
          if (gap > 0 && gap < bestGap) { bestGap = gap; best = a; }
        }
        if (best && bestGap <= 60) {
          return { localDate, artistId: best.id, night, festivalId, resolvedBy, reason: "stage_time_proximity",
                   ambiguous: true, alternatives: undefined, anchorSource: nearSource,
                   proximity: { stageId: nearStage, meters: Math.round(nearStageM), gapMin: bestGap } };
        }
      }
    }
    // We know the night but no specific artist — return the night so the
    // photo still lands in the right bucket (e.g. between sets, in the
    // shuttle line, etc.).
    return { localDate, artistId: null, night, festivalId, resolvedBy, reason: "no_artist_at_time" };
  }
  // Prefer ATTENDED, then SAVED, then any; GPS tiebreaker; then tightest fit.
  const inAttended = candidates.filter(c => attendedSet.has(c.a.id));
  const inSaved    = candidates.filter(c => savedSet.has(c.a.id));
  const pool = inAttended.length ? inAttended : (inSaved.length ? inSaved : candidates);
  const _anchors = resolvedStageAnchors(cfg);
  const stageDist = (a) => {
    if (lat == null || lng == null) return Infinity;
    const anchor = _anchors.find(g => g.stageId === a.stage);
    if (!anchor) return Infinity;
    const dLat = lat - anchor.lat, dLng = lng - anchor.lng;
    return dLat * dLat + dLng * dLng;
  };
  pool.sort((x, y) => {
    const dx = stageDist(x.a), dy = stageDist(y.a);
    if (dx !== Infinity && dy !== Infinity && Math.abs(dx - dy) > 1e-9) return dx - dy;
    return Math.abs(adjustedMin - x.startMin) - Math.abs(adjustedMin - y.startMin);
  });
  // Two+ sets overlap this timestamp and GPS didn't cleanly separate the
  // stages → keep the best guess but flag it so the card shows a fix-tag chip.
  const dists = pool.map(c => stageDist(c.a));
  const gpsSeparated = dists.every(d => d !== Infinity) &&
    [...dists].sort((a, b) => a - b).slice(0, 2).reduce((a, b) => b - a, 0) > 1e-9;
  // Provenance of the anchor that actually decided this match. Only meaningful
  // when GPS did the separating — with no fix, or with a single candidate, the
  // anchor never entered into it and flagging would be noise.
  const winnerAnchor = _anchors.find(g => g.stageId === pool[0].a.stage) || null;
  const gpsDecided = lat != null && lng != null && pool.length > 1 && gpsSeparated;
  const anchorSource = gpsDecided ? (winnerAnchor ? winnerAnchor.anchorSource : null) : null;
  // POSTER-FALLBACK HONESTY FLAG. A match separated by a pin we know was
  // measured off a poster is a guess wearing a confident face — keep it (it
  // still beats no tag) but surface the FIX TAG chip, same as a GPS tie.
  const ambiguous = (pool.length > 1 && !gpsSeparated) || anchorSource === "poster";
  return {
      localDate,
    artistId: pool[0].a.id, night, festivalId, resolvedBy, reason: "matched",
    ambiguous, anchorSource,
    alternatives: ambiguous ? pool.map(c => c.a.id) : undefined,
  };
}
