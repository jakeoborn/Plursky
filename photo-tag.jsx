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
// 0x001F GPSHPositioningError — RATIONAL, metres. iOS writes it on every fix.
// It is the difference between "you were at the waste stage" and "your phone
// had no idea where it was": a measured 2,808 m fix was confidently
// stage-separated and tagged, while a same-minute video put the user 700 m
// away. Read but never used until now.
const _EXIF_TAG_GPS_HPOS_ERR = 0x001F;
// 0x0011 GPSImgDirection (+ 0x0010 ref, "T" true / "M" magnetic) — RATIONAL,
// degrees. Nothing consumes this yet. It is captured now because it can ONLY
// be captured at import: heading plus position triangulates where a stage IS,
// rather than approximating it with the crowd centroid, and every photo
// imported before a consumer exists loses the data permanently.
const _EXIF_TAG_GPS_IMG_DIR     = 0x0011;
const _EXIF_TAG_GPS_IMG_DIR_REF = 0x0010;
const _EXIF_TAG_GPS_LAT_REF = 0x0001;
const _EXIF_TAG_GPS_LAT     = 0x0002;
const _EXIF_TAG_GPS_LNG_REF = 0x0003;
const _EXIF_TAG_GPS_LNG     = 0x0004;

// Try multiple date formats — ISO 8601 (XMP-style) and EXIF (colon-sep).
// Returns the canonical { yr, mo, dy, hh, mm, ss } shape or null.
// ── Import diagnostics ───────────────────────────────────────
// One structured line per imported file, tagged [plursky:import], so a real
// device import is diagnosable from the Xcode console or Safari Web Inspector
// without asking for screenshots. The last 400 lines are also kept on device
// (plursky_import_log_v1) and readable with plurskyImportLog() in the
// inspector. Never logs coordinates: GPS presence and accuracy only.
const IMPORT_LOG_KEY = "plursky_import_log_v1";
function _importLog(event, detail) {
  const row = { t: new Date().toISOString(), event, ...(detail || {}) };
  try { console.info(`[plursky:import] ${event} ${JSON.stringify(detail || {})}`); } catch {}
  try {
    const log = JSON.parse(localStorage.getItem(IMPORT_LOG_KEY) || "[]");
    log.push(row);
    localStorage.setItem(IMPORT_LOG_KEY, JSON.stringify(log.slice(-400)));
  } catch {}
}
function plurskyImportLog() {
  try { return JSON.parse(localStorage.getItem(IMPORT_LOG_KEY) || "[]"); } catch { return []; }
}
// Every festival's attended artist ids, flat. For the photo matcher only: it
// keeps an id only when the photo's own festival bills it.
function _allFestivalAttendedIds() {
  try {
    const store = typeof getAttendedStore === "function" ? getAttendedStore() : {};
    return [...new Set(Object.values(store).flatMap(n => Object.values(n || {}).flat()))];
  } catch { return []; }
}

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
  const out = { date: null, lat: null, lng: null, acc: null, heading: null, headingRef: null };
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
          // Single RATIONAL (8 bytes, so always out-of-line via valOff).
          const readRational1 = (entry) => {
            if (!entry || entry.count !== 1 || entry.type !== 5) return null;
            const off2 = tiff + u32(entry.valOff);
            const den = u32(off2 + 4);
            if (!den) return null;
            const v = u32(off2) / den;
            return isFinite(v) ? v : null;
          };
          const acc = readRational1(gpsEntries[_EXIF_TAG_GPS_HPOS_ERR]);
          if (acc != null && acc >= 0) out.acc = acc;
          const dir = readRational1(gpsEntries[_EXIF_TAG_GPS_IMG_DIR]);
          if (dir != null && dir >= 0 && dir <= 360) {
            out.heading = dir;
            const dRef = gpsEntries[_EXIF_TAG_GPS_IMG_DIR_REF];
            out.headingRef = dRef ? String.fromCharCode(dv.getUint8(dRef.valOff)) : "T";
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
  const out = { date: null, lat: null, lng: null, acc: null, timestampSource: null, locationSource: null, rawUtcMs: null };
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
    // One `meta` container's QuickTime items, resolved once its walk is done.
    // Scoped per container because a track-level `meta` (lens, focal length)
    // numbers its own keys from 1 too.
    const applyMdta = ({ keys, vals }) => {
      for (const i of Object.keys(vals)) {
        const name = keys[i], v = vals[i];
        if (out.lat == null && name === "com.apple.quicktime.location.ISO6709") {
          const p = parseIso6709(v);
          if (p) { out.lat = p.lat; out.lng = p.lng; out.locationSource = "video-mdta"; }
        } else if (name === "com.apple.quicktime.location.accuracy.horizontal") {
          // The claimed error radius, in metres. The tagger blinds a fix
          // coarser than 200 m for stage decisions; a clip filmed on a 1.3 km
          // fix must not pick a stage by it.
          const a = parseFloat(v);
          if (isFinite(a) && a >= 0) out.acc = a;
        }
      }
    };
    const visit = (start, end, depth, parentType, scope) => {
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
        // Current iPhones write NO ©xyz. Location and its accuracy live in
        // QuickTime metadata: `keys` names each item ("mdta" namespace) and
        // `ilst` holds the values, each child typed by its 1-based key index.
        // Without this every modern iPhone clip imported with no GPS at all,
        // so stage matching fell back to time alone and flagged every clip
        // ambiguous across the whole night's lineup.
        if (scope && type === "keys" && boxEnd - payload >= 8) {
          const count = moov.getUint32(payload + 4);
          let k = payload + 8;
          for (let i = 1; i <= count && k + 8 <= boxEnd; i++) {
            const ks = moov.getUint32(k);
            if (ks < 8) break;
            scope.keys[i] = readAscii(k + 8, ks - 8);
            k += ks;
          }
        }
        if (scope && parentType === "ilst" && boxEnd - payload >= 16 && typeAt(moov, payload + 4) === "data") {
          const ds = moov.getUint32(payload);
          scope.vals[moov.getUint32(pos + 4)] = readAscii(payload + 16, Math.min(ds, boxEnd - payload) - 16);
        }
        if (["trak", "mdia", "minf", "stbl", "udta", "meta", "ilst", "moov"].includes(type)) {
          // ISO `meta` is a full box (4 bytes of version/flags before its
          // children); QuickTime's moov-level `meta` is not, and starts
          // straight at its `hdlr`. Skipping 4 there misaligned the walk and
          // `keys`/`ilst` were never reached.
          const isoMeta = type === "meta" && !(payload + 8 <= boxEnd && typeAt(moov, payload + 4) === "hdlr");
          const inner = type === "meta" ? { keys: {}, vals: {} } : scope;
          visit(isoMeta ? Math.min(boxEnd, payload + 4) : payload, boxEnd, depth + 1, type, inner);
          if (type === "meta") applyMdta(inner);
        }
        pos += boxSize;
      }
    };
    visit(8, n, 0);
  } catch {}
  return out;
}

// ── Video GPS strip for cloud backup ─────────────────────────────────────
// Photos leave the device as a canvas re-encode (_compressMomentImage), which
// carries no EXIF. Videos are stored raw, and an iPhone clip writes its
// capture fix into the file: `com.apple.quicktime.location.ISO6709` (+ its
// accuracy) in moov/meta keys+ilst, older clips a udta `©xyz`, 3GPP a `loci`.
// Real clips (EDC LV 2026, 34 of 42) also hold a SECOND copy of that meta in
// a top-level `free` box after moov. "Back up my weekend" uploaded those
// bytes as-is, so the backup held every clip's coordinates.
//
// This returns a copy for upload with every one of those redacted IN PLACE:
// box sizes never change, so chunk offsets (stco/co64) stay valid and the
// clip plays as before. The media (mdat) is passed through by reference and
// never read. Anything it cannot prove clean returns null and the caller
// does not upload (fail closed): an unparseable container, a non-mdat box
// too large to inspect, a timed metadata track that names a location key,
// or a coordinate-shaped string still present after the redaction.
const _VGPS_MAX_BOX = 64 * 1024 * 1024;
const _VGPS_COORD_RE = /[+-]\d{1,3}\.\d{2,}[+-]\d{1,3}\.\d{2,}/;
const _VGPS_KEY_RE = /location|ISO6709|gps/i;
const _VGPS_TRACK_FORMATS = new Set([
  // Only formats whose samples cannot carry free text or EXIF. Text,
  // subtitle and (M)JPEG tracks are refused: their samples could hold a fix.
  "hvc1", "hev1", "avc1", "avc3", "av01", "vp09", "mp4v", "ap4h", "ap4x", "apch", "apcn", "apcs", "apco", "dvh1", "dvhe",
  "mp4a", "apac", "alac", "lpcm", "ipcm", "sowt", "twos", "in24", "in32", "fl32", "fl64", "ac-3", "ec-3", "Opus", "fLaC", "samr", "sawb", ".mp3",
  "mebx", "tmcd",
]);
// Timed (mebx) keys whose per-frame values live in mdat, where they cannot
// be blanked: only these Apple keys pass; any other key refuses the clip.
const _VGPS_TIMED_KEYS = new Set([
  "video-orientation", "detected-face", "detected-face.bounds", "detected-face.face-id", "detected-face.roll-angle", "detected-face.yaw-angle",
  "live-photo-info", "com.apple.quicktime.live-photo-info", "scene-illuminance", "milli-lux", "cinematic-audio", "segment-identifier", "optical-center",
  "metadata.1", "uuid", "apple-maker-note.74", "apple-maker-note.97", "camera.lens_model", "camera.focal_length.35mm_equivalent", "camera.lens_irisfnumber",
].map(k => "com.apple.quicktime." + k));
// Static (moov/meta) item values that are kept. Every other item's value
// is blanked in place, whatever its key is called.
const _VGPS_KEEP_KEYS = new Set([
  "make", "model", "software", "creationdate", "full-frame-rate-playback-intent",
  "camera.lens_model", "camera.focal_length.35mm_equivalent", "camera.lens_irisfnumber",
].map(k => "com.apple.quicktime." + k));
function _vgpsLatin1(u8, a, b) {
  let s = "";
  for (let i = a; i < b; i++) s += String.fromCharCode(u8[i]);
  return s;
}
// Deny by default INSIDE the movie too: each container the walker enters
// keeps only the children named here (the boxes real iPhone clips carry, plus
// the standard ISO/QuickTime ones). Anything else (a dashcam's moov-level
// `gps `, a vendor box in a trak) is blanked to `free`; a player never needs a
// box it does not know. udta and meta have their own rules below.
// Track-reference kinds: each is a plain list of u32 track ids.
const _VGPS_TREF_KINDS = new Set(["cdep", "cdsc", "fall", "rndr", "hint", "chap", "tmcd", "sync", "scpt", "ssrc", "vdep", "vplx", "font", "hind", "ipir", "mpod", "subt", "thmb", "auxl"]);
const _VGPS_CHILDREN = {
  moov: new Set(["mvhd", "trak", "udta", "meta", "mvex"]),
  trak: new Set(["tkhd", "edts", "mdia", "meta", "tapt", "tref", "udta", "load"]),
  edts: new Set(["elst"]),
  mdia: new Set(["mdhd", "hdlr", "minf", "elng", "udta"]),
  minf: new Set(["vmhd", "smhd", "gmhd", "nmhd", "hmhd", "sthd", "dinf", "stbl", "hdlr"]),
  stbl: new Set(["stsd", "stts", "ctts", "cslg", "stsc", "stsz", "stz2", "stco", "co64", "stss", "stsh", "stps", "sdtp", "sbgp", "sgpd"]),
  gmhd: new Set(["gmin", "text", "tmcd"]),
  tmcd: new Set(["tcmi"]),          // only walked under gmhd
  dinf: new Set(["dref"]),
  dref: new Set(["url ", "alis"]),  // self-contained data references
  mvex: new Set(["mehd", "trex"]),
  tapt: new Set(["clef", "prof", "enof"]),
  tref: _VGPS_TREF_KINDS,
};
// Containers the walker enters, and the header bytes before their children.
const _VGPS_WALK = { moov: 0, trak: 0, mdia: 0, minf: 0, stbl: 0, udta: 0, meta: 0, ilst: 0, edts: 0, gmhd: 0, dinf: 0, mvex: 0, tapt: 0, tref: 0, dref: 8 };
const _vgpsWalks = (type, parentType) => type in _VGPS_WALK || (type === "tmcd" && parentType === "gmhd");
// The exact payload length of a movie leaf, from its own fields. Bytes past it
// are slack a vendor could fill: zeroed. Shorter: refused. null = this leaf
// has no shape the strip can check: the box is BLANKED (fail closed); every
// leaf real iPhone clips carry has a shape here. Names (hdlr, elng, tcmi) are
// not needed for playback, so only their fixed part is kept.
const _VGPS_LEAF_LEN = (type, parentType, dv, p, P, ctx) => {
  const v = P >= 1 ? dv.getUint8(p) : 0, n = off => (P >= off + 4 ? dv.getUint32(p + off) : 0);
  if (parentType === "tref") {             // u32 track ids; 16 bytes of a fix also look like 4 ids, so range-check
    if (P % 4) return -1;
    for (let o = 0; o < P; o += 4) { const id = dv.getUint32(p + o); if (id < 1 || id > 1024) return -1; }
    return P;
  }
  switch (type) {
    case "mvhd": return v === 1 ? 112 : 100;
    case "tkhd": return v === 1 ? 96 : 84;
    case "mdhd": return v === 1 ? 36 : 24;
    case "mehd": return v === 1 ? 12 : 8;
    case "vmhd": return 12;
    case "smhd": return 8;
    case "nmhd": case "sthd": return 4;
    case "hmhd": return 20;
    case "gmin": return 16;
    case "text": return 36;
    case "load": return 16;
    case "trex": return 24;
    case "cslg": return v === 1 ? 44 : 24;
    case "clef": case "prof": case "enof": return 12;
    case "url ": case "alis": return 4;     // flags only; a self-contained ref holds no data
    case "hdlr": return 24;                 // fixed fields; the name is zeroed
    case "elng": return 4;                  // the language tag is zeroed
    case "tcmi": return 24;                 // the font name is zeroed
    case "elst": return 8 + n(4) * (v === 1 ? 20 : 12);
    case "stts": case "ctts": case "co64": case "stsh": return 8 + n(4) * 8;
    case "stss": case "stps": case "stco": return 8 + n(4) * 4;
    case "stsc": return 8 + n(4) * 12;
    case "stsz": ctx.samples = n(8); return 12 + (n(4) === 0 ? n(8) * 4 : 0);
    case "stz2": ctx.samples = n(8); return 12 + Math.ceil(n(8) * (P >= 8 ? dv.getUint8(p + 7) : 0) / 8);
    case "sdtp": return ctx.samples == null ? null : 4 + ctx.samples;
    case "sbgp": return (v === 1 ? 16 : 12) + n(v === 1 ? 12 : 8) * 8;
    case "sgpd": {
      if (v !== 1 && v !== 2) return null;
      const hdr = v === 1 ? 16 : 20, dl = n(8), count = n(hdr - 4);
      if (dl) return hdr + count * dl;
      if (v !== 1) return null;
      let at = hdr;                         // v1, variable entries: each has its own u32 length
      for (let i = 0; i < count; i++) { if (at + 4 > P) return P + 1; at += 4 + dv.getUint32(p + at); }
      return at;
    }
    default: return null;
  }
};
// Redacts one in-memory box region. Returns { n } (items redacted) or
// { refuse: reason }.
function _stripVideoGpsRegion(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const len = u8.byteLength;
  const type4 = i => _vgpsLatin1(u8, i, i + 4);
  const zero = (a, b) => { for (let i = a; i < b && i < len; i++) u8[i] = 0; };
  const toFree = (pos) => { u8[pos + 4] = 0x66; u8[pos + 5] = 0x72; u8[pos + 6] = 0x65; u8[pos + 7] = 0x65; };
  let n = 0, refuse = null;
  const visit = (start, end, depth, parentType, scope) => {
    if (depth > 8 || refuse) return;
    let pos = start;
    const scopeCtx = {};                   // per-container: stsz's sample count, for sdtp
    if (parentType === "stbl") {           // sdtp can come before stsz: read the count first
      for (let q = start; q + 20 <= end; ) {
        const qs = dv.getUint32(q);
        if (qs < 8 || q + qs > end) break;
        if (qs >= 20 && (type4(q + 4) === "stsz" || type4(q + 4) === "stz2")) scopeCtx.samples = dv.getUint32(q + 16);
        q += qs;
      }
    }
    while (pos + 8 <= end) {
      let size = dv.getUint32(pos);
      const type = type4(pos + 4);
      let hdr = 8;
      if (size === 1) { if (pos + 16 > end) break; size = dv.getUint32(pos + 8) * 4294967296 + dv.getUint32(pos + 12); hdr = 16; }
      else if (size === 0) size = end - pos;
      if (size < hdr || pos + size > end) { refuse = "malformed box"; return; }
      const payload = pos + hdr, boxEnd = pos + size;
      if (type === "free" || type === "skip") {
        zero(payload, boxEnd);
      } else if (depth === 0 && !["moov", "meta", "ftyp", "wide", "pdin"].includes(type)) {
        // Deny by default at the top level: uuid (XMP can carry GPS) or any
        // box this does not understand is blanked.
        zero(payload, boxEnd); toFree(pos); n++;
      } else if (type === "uuid" || type === "XMP_" || (parentType === "meta" && !["hdlr", "keys", "ilst"].includes(type))) {
        zero(payload, boxEnd); toFree(pos); n++;
      } else if (_VGPS_CHILDREN[parentType] && !_VGPS_CHILDREN[parentType].has(type)) {
        zero(payload, boxEnd); toFree(pos); n++;
      } else if (_VGPS_CHILDREN[parentType] && type !== "stsd" && !_vgpsWalks(type, parentType)) {
        const want = _VGPS_LEAF_LEN(type, parentType, dv, payload, boxEnd - payload, scopeCtx);
        if (want === null) { zero(payload, boxEnd); toFree(pos); n++; }
        else if (want < 0 || want > boxEnd - payload) { refuse = "unreadable " + type; return; }
        else if (want < boxEnd - payload) { zero(payload + want, boxEnd); n++; }
      } else if (type === "©xyz" || type === "loci" || (parentType === "udta" && type !== "meta")) {
        // udta is user data, never needed for playback. Location can sit in
        // it as text (©xyz, loci) or in a vendor's BINARY box no regex can
        // read, so every udta child but `meta` (walked below) is blanked.
        zero(payload, boxEnd); toFree(pos); n++;
      } else if (type === "stsd") {
        // A timed metadata track (mebx) declares its keys here; its VALUES
        // live in mdat, which this never rewrites. One that names a location
        // key cannot be made clean in place.
        if (_VGPS_KEY_RE.test(_vgpsLatin1(u8, payload, boxEnd))) { refuse = "timed location track"; return; }
        // Binary GPS tracks (GoPro gpmd, camm, …) carry no text to find, so
        // only known audio/video/timecode/text/mebx sample formats pass.
        // EVERY sample entry is checked; an unreadable table is refused.
        const count = boxEnd - payload >= 8 ? dv.getUint32(payload + 4) : 0;
        let e = payload + 8;
        for (let k = 0; k < count; k++) {
          const es = e + 8 <= boxEnd ? dv.getUint32(e) : 0;
          if (es < 8 || e + es > boxEnd) { refuse = "unreadable sample table"; return; }
          const fmt = type4(e + 4);
          if (!_VGPS_TRACK_FORMATS.has(fmt)) { refuse = "unknown track format " + JSON.stringify(fmt); return; }
          if (fmt === "mebx") {
            // Every keyd name in the entry must be a known non-location key.
            const body = _vgpsLatin1(u8, e, e + es);
            let at = body.indexOf("keyd"), seen = 0;
            while (at >= 4) {
              const ks = dv.getUint32(e + at - 4);
              if (ks < 12 || at - 4 + ks > es) { refuse = "unreadable timed key"; return; }
              const name = body.slice(at + 8, at - 4 + ks);
              if (!_VGPS_TIMED_KEYS.has(name)) { refuse = "timed key " + JSON.stringify(name); return; }
              seen++; at = body.indexOf("keyd", at - 4 + ks);
            }
            if (!seen && body.includes("keys")) { refuse = "unreadable timed keys"; return; }
          }
          e += es;
        }
      } else if (scope && type === "keys" && boxEnd - payload >= 8) {
        // Two keys tables make an index ambiguous (a player may read either).
        if (scope.keysSeen++) { refuse = "duplicate keys table"; return; }
        const count = dv.getUint32(payload + 4);
        let k = payload + 8;
        for (let i = 1; i <= count && k + 8 <= boxEnd; i++) {
          const ks = dv.getUint32(k);
          if (ks < 8 || k + ks > boxEnd) break;
          const name = _vgpsLatin1(u8, k + 8, k + ks);
          if (_VGPS_KEEP_KEYS.has(name)) scope.keep.add(i);
          if (_VGPS_KEY_RE.test(name)) {
            scope.hit.add(i);
            const red = "plursky.redacted.".padEnd(ks - 8, "x").slice(0, ks - 8);
            for (let j = 0; j < ks - 8; j++) u8[k + 8 + j] = red.charCodeAt(j);
          }
          k += ks;
        }
      } else if (scope && parentType === "ilst") {
        scope.items.push({ idx: dv.getUint32(pos + 4), payload, boxEnd });
      }
      if (_vgpsWalks(type, parentType)) {
        const isoMeta = type === "meta" && !(payload + 8 <= boxEnd && type4(payload + 4) === "hdlr");
        const inner = type === "meta" ? { hit: new Set(), keep: new Set(), items: [], keysSeen: 0 } : scope;
        const skip = isoMeta ? 4 : type === "tmcd" ? 0 : _VGPS_WALK[type] || 0;
        visit(Math.min(boxEnd, payload + skip), boxEnd, depth + 1, type, inner);
        if (type === "meta") {
          // Values are typed by key index. Keep-by-allowlist: an item keeps its
          // value ONLY when its index names a keep-listed key; every other item
          // (unknown key, index past a truncated keys table, a keyless
          // iTunes-style meta) is zeroed (its `data` box keeps its header).
          for (const it of inner.items) if (!inner.keep.has(it.idx) || inner.hit.has(it.idx)) {
            const dataHdr = it.payload + 16 <= it.boxEnd && type4(it.payload + 4) === "data" ? 16 : 0;
            zero(it.payload + dataHdr, it.boxEnd); n++;
          }
        }
      }
      pos = boxEnd;
    }
  };
  visit(0, len, 0, null, null);
  return refuse ? { refuse } : { n };
}
// The media box. Real clips (26 of those 34) carry ANOTHER copy of the
// keys+ilst block, coordinates included, inside mdat: dead bytes from an
// earlier moov write. mdat is read once in windows (never whole), and each
// window gets: every embedded `meta` copy redacted like the live one, then
// any ISO-6709-shaped string zeroed, then re-checked. Unchanged media is
// passed through as slices of the original blob.
const _VGPS_WIN = 8 * 1024 * 1024, _VGPS_OVERLAP = 4096;
const _VGPS_ISO_RE = /[+-]\d{1,3}\.\d{2,}[+-]\d{1,3}\.\d{2,}(?:[+-]\d+(?:\.\d+)?)?\/?/g;
async function _vgpsScanMedia(blob, start, end) {
  const dec = new TextDecoder("windows-1252"); // 1 byte -> 1 char, so indexes match
  const patches = []; // { off, bytes } absolute, non-overlapping
  const inPatch = (o) => patches.find(p => o >= p.off && o < p.off + p.bytes.length);
  for (let w = start; w < end; w += _VGPS_WIN) {
    const b = Math.min(end, w + _VGPS_WIN + _VGPS_OVERLAP);
    const u8 = new Uint8Array(await blob.slice(w, b).arrayBuffer());
    const s = dec.decode(u8);
    const own = i => w + i < Math.min(end, w + _VGPS_WIN); // a hit belongs to the window it starts in
    // 1) embedded meta copies (QuickTime meta: hdlr right after the header;
    //    ISO meta: after 4 flag bytes).
    const metaRe = /meta/g; let m;
    while ((m = metaRe.exec(s))) {
      const p = m.index - 4;
      if (p < 0 || !own(p) || inPatch(w + p)) continue;
      const sz = new DataView(u8.buffer, u8.byteOffset + p, 4).getUint32(0);
      if (sz < 24 || sz > 1024 * 1024 || w + p + sz > end) continue;
      if (s.slice(p + 12, p + 16) !== "hdlr" && s.slice(p + 16, p + 20) !== "hdlr") continue;
      const reg = new Uint8Array(await blob.slice(w + p, w + p + sz).arrayBuffer());
      const r = _stripVideoGpsRegion(reg);
      if (r.refuse) return { refuse: "embedded meta: " + r.refuse };
      if (r.n) patches.push({ off: w + p, bytes: reg });
    }
    // 2) any remaining coordinate string, wherever it sits.
    _VGPS_ISO_RE.lastIndex = 0;
    while ((m = _VGPS_ISO_RE.exec(s))) {
      if (!own(m.index)) continue;
      const abs = w + m.index, host = inPatch(abs);
      if (host) { host.bytes.fill(0, abs - host.off, Math.min(host.bytes.length, abs - host.off + m[0].length)); }
      else patches.push({ off: abs, bytes: new Uint8Array(m[0].length) });
    }
    // 3) proof for this window: patched, it reads clean.
    const chk = u8.slice();
    for (const p of patches) {
      const a = Math.max(p.off, w), z = Math.min(p.off + p.bytes.length, b);
      if (a < z) chk.set(p.bytes.subarray(a - p.off, z - p.off), a - w);
    }
    const cs = dec.decode(chk);
    if (new RegExp(_VGPS_ISO_RE.source).test(cs) || /location\.ISO6709|location\.accuracy/.test(cs)) return { refuse: "coordinate left in media" };
  }
  patches.sort((x, y) => x.off - y.off);
  const parts = []; let at = start;
  for (const p of patches) {
    if (p.off < at) return { refuse: "overlapping patches" };
    if (p.off > at) parts.push(blob.slice(at, p.off));
    parts.push(p.bytes); at = p.off + p.bytes.length;
  }
  if (at < end) parts.push(blob.slice(at, end));
  return { parts, n: patches.length };
}
// Blob in, { blob, redacted } or null out. Never throws.
async function _stripVideoGps(blob) {
  try {
    if (!blob || typeof blob.slice !== "function") return null;
    const size = blob.size;
    const head = async (pos) => new DataView(await blob.slice(pos, Math.min(size, pos + 16)).arrayBuffer());
    const parts = [];
    let pos = 0, sawMoov = false, redacted = 0;
    while (pos < size) {
      if (pos + 8 > size) return null;
      const h = await head(pos);
      let boxSize = h.getUint32(0), hdr = 8;
      const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
      if (boxSize === 1) { if (h.byteLength < 16) return null; boxSize = h.getUint32(8) * 4294967296 + h.getUint32(12); hdr = 16; }
      else if (boxSize === 0) boxSize = size - pos;
      if (boxSize < hdr || pos + boxSize > size) return null;
      if (type === "mdat") {
        parts.push(blob.slice(pos, pos + hdr));
        const r = await _vgpsScanMedia(blob, pos + hdr, pos + boxSize);
        if (r.refuse) { console.warn("[backup] video GPS strip refused:", r.refuse); return null; }
        parts.push(...r.parts); redacted += r.n;
      } else {
        if (boxSize > _VGPS_MAX_BOX) return null;
        const u8 = new Uint8Array(await blob.slice(pos, pos + boxSize).arrayBuffer());
        const r = _stripVideoGpsRegion(u8);
        if (r.refuse) { console.warn("[backup] video GPS strip refused:", r.refuse); return null; }
        redacted += r.n;
        // Proof, not hope: after the redaction no inspected byte may still
        // read as a coordinate or a location key.
        const s = _vgpsLatin1(u8, 0, u8.byteLength);
        if (_VGPS_COORD_RE.test(s) || /ISO6709/.test(s)) { console.warn("[backup] video GPS strip: coordinate left in", type); return null; }
        if (type === "moov") sawMoov = true;
        parts.push(u8);
      }
      pos += boxSize;
    }
    if (!sawMoov) return null;
    const out = new Blob(parts, { type: blob.type || "video/quicktime" });
    if (out.size !== size) return null;
    return { blob: out, redacted };
  } catch (e) {
    console.warn("[backup] video GPS strip failed:", e && e.message);
    return null;
  }
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
  const r = _photoFestivalNightWeekend(date, cfgIn, utcMs);
  return r ? r.night : null;
}
// The night AND the weekend. dayDates describe weekend one only, so on a
// two-weekend festival (weekendStartMs, ACL) each later weekend is the same
// days shifted; a weekend-2 photo was outside every window and got no night
// and no set (lane ruling 2026-09-23). Single-weekend festivals walk one
// weekend with shift 0 and weekend null, exactly as before.
function _photoFestivalNightWeekend(date, cfgIn, utcMs) {
  const cfg = cfgIn || window.FESTIVAL_CONFIG;
  if (!cfg?.dayDates) return null;
  if (utcMs == null && !date) return null;
  const photoMs = utcMs != null ? utcMs : _photoEpochUtc(date, cfg);
  for (const { weekend, shift } of festivalWeekendShifts(cfg)) {
    for (const n of Object.keys(cfg.dayDates).map(Number)) {
      const dm = cfg.dayDates[n];
      if (!dm) continue;
      const midnight = dm.midnightUtc + shift;
      // 11:00 local of day N → 06:00 local day N+1. Was 19:00→06:00 (EDC's
      // overnight shape) — but daytime festivals (ACL, Electric Forest) run
      // sets from ~noon, so every afternoon photo fell outside the window
      // and the attended/saved set-time match never ran. 11:00 still can't
      // overlap the previous night's +30h end (06:00 < 11:00), so post-
      // midnight photos keep bucketing to the night they belong to.
      const startMs = midnight + 11 * 3600000;     // 11:00 local, day N
      const endMs   = midnight + 30 * 3600000;     // 06:00 local, day N+1
      if (photoMs >= startMs - 30 * 60000 && photoMs <= endMs + 30 * 60000) return { night: n, weekend, shift };
    }
  }
  return null;
}

// _haversineMeters lives in data.jsx with the stage fix gate, which needs it.

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
// Build 39: is this fix OBVIOUSLY outside the festival? Only the festival's
// own sourced footprint (gps.lat/lng + onSiteRadiusMi) is used; a festival
// without one gets no verdict, never an invented boundary. The fix's own
// error is subtracted first, so a coarse fix only counts when even its
// nearest possible point is outside. A fix with no reported accuracy is
// given the stage gate's worst usable error. The footprint is a circle, not
// the fence line, so a fix just past it can still be inside the grounds
// (EDC LV's speedway runs past its 0.5 mi circle): only a fix more than
// _OFF_VENUE_MARGIN_M beyond the circle is "away". Returns metres past the
// circle, or null when there is no verdict (no fix, no footprint, not clear).
const _OFF_VENUE_MARGIN_M = 500;
function _offVenueMeters(cfg, lat, lng, acc) {
  const g = cfg?.gps;
  if (lat == null || lng == null || !g || g.lat == null || g.lng == null || !(g.onSiteRadiusMi > 0)) return null;
  const err = acc != null && isFinite(acc) && acc >= 0 ? acc : _GPS_STAGE_MAX_ACC_M;
  const past = _haversineMeters(lat, lng, g.lat, g.lng) - err - g.onSiteRadiusMi * 1609.34;
  return past > _OFF_VENUE_MARGIN_M ? Math.round(past) : null;
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
// "Does ANY festival we know of claim this timestamp?" Used by the trust gates
// in spotify.jsx that previously asked only the active festival and so
// discarded a real capture time for a photo from a different one.
//
// This is a TRUST question, not an ATTRIBUTION question, and that distinction
// is the whole reason it exists apart from _resolveFestivalForPhoto. The
// callers ask it to decide whether a timestamp is a genuine capture time or
// junk written by a re-encode. Nothing about that depends on WHICH festival, or
// on which night — so it answers with a boolean and nothing else.
//
// It used to return {festivalId, night} from the FIRST claimant. Both fields
// were an ordering accident: 10 of the 53 night windows are claimed by two
// festivals running the same weekend (lost-lands/nocturnal,
// lollapalooza/hard-summer, crssd/portola), and on those "first wins" reports
// _DATA_SETS declaration order as a fact. No caller ever read them — one tests
// `!= null`, the other takes `.night` and only compares that to null — so the
// wrong answer was latent, waiting for the first caller to believe it. A
// boolean does not guard that path, it removes it: there is no id left to read.
//
// It walks _DATA_SETS DIRECTLY rather than _allDataSets(), which filters to
// registry-`available`. That filter is correct for _resolveFestivalForPhoto,
// which attributes — stamping a moment with a gated id strands it, because
// getActiveFestivalId() also requires `available`. It is wrong here, because
// availability is a UI concern and says nothing about whether a timestamp is
// real. edc-orlando-2026 is gated today and is the only gated festival carrying
// a data module, so a genuine EDC Orlando capture time was being rejected as
// junk and the clip imported as no-date — a real capture time destroyed by a
// filter that exists to protect attribution.
function _someFestivalClaimsCaptureTime(date, utcMs) {
  if (!date && utcMs == null) return false;
  const sets = window._DATA_SETS;
  if (!sets) return _photoFestivalNight(date, null, utcMs) != null;
  for (const id of Object.keys(sets)) {
    const cfg = sets[id]?.config;
    if (!cfg?.dayDates) continue;
    if (_photoFestivalNight(date, cfg, utcMs) != null) return true;
  }
  return false;
}

// Festivals whose amenity label ("near 💧 Hydration") must come from VERIFIED
// geometry. The label places an art pin in the world, the same class of claim
// geometryVerifiedFor() already withholds for distances, so ACL (founder
// ruling 2026-09-23) gets no label until its map registers. The rest of the
// fleet, EDC first, is #223, which either widens this to every festival or
// deletes the label. Until then only the listed ids are gated.
const _AMENITY_LABEL_NEEDS_GEOMETRY = new Set(["acl-2026"]);

function _matchNearestLocation(lat, lng, ds) {
  const set = ds || _activeDataSet();
  const amenities = set.amenities || [];
  if (!amenities.length) return null;
  const cfg = set.config || {};
  const fid = set.id || cfg.id;
  if (_AMENITY_LABEL_NEEDS_GEOMETRY.has(fid)) {
    // Fail closed: no predicate loaded means no verified geometry.
    const verified = typeof geometryVerifiedFor === "function" && geometryVerifiedFor(fid);
    if (!verified) return null;
  }
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
// Above this, a fix cannot tell two stages apart. Stage anchors sit ~100-300 m
// from each other, so a fix with 2,808 m of claimed error "separates" them by
// pure noise — and it did: that photo was confidently tagged to waste while a
// same-minute video put the user 700 m away. The threshold is deliberately
// generous; the point is to reject garbage, not to demand a perfect fix.
const _GPS_STAGE_MAX_ACC_M = 200;
// "Far from every anchor" only means "between sets" when every stage playing
// that night HAS an anchor (lane ruling 2026-09-23). With one stage
// unanchored, a photo taken in its crowd is also far from every anchor, and
// calling it off_stage would throw away the time match that should tag it.
// So a festival with partial anchors skips the negative inference and falls
// through to the time matcher; no geometry is invented for the missing stage.
// An act with no stage counts as unanchored.
function _allProgrammedStagesAnchored(artists, night, anchors) {
  const anchored = new Set(anchors.map(a => a.stageId));
  return (artists || []).every(a => a.day !== night || anchored.has(a.stage));
}

function _matchArtistForPhoto({ date, lat, lng, rawUtcMs, acc }, savedIds, attendedIds, ds) {
  if (!date && rawUtcMs == null) return { artistId: null, night: null, festivalId: null, reason: "no_date" };
  // First: WHICH festival, and which of its nights, does this photo's
  // timestamp (+ GPS, as a tiebreak) place it in?
  const set = ds || _resolveFestivalForPhoto({ date, lat, lng, rawUtcMs });
  const cfg = set.config || {};
  const festivalId = set.id || null;
  const resolvedBy = set.resolvedBy || "explicit";
  // NOW the festival is known, so a video's wall clock can finally be derived
  // against the right zone. Everything downstream — the night bucket, the
  // set-time window, the takenAt stamped on the moment — uses this, not the
  // provisional one guessed at parse time.
  // A coarse fix stays usable for FESTIVAL resolution — "which venue, hundreds
  // of km apart" is a question a 2.8 km error can still answer — but is blinded
  // for every STAGE-level decision below. Resolution already happened above.
  const gpsUsableForStage = acc == null || acc <= _GPS_STAGE_MAX_ACC_M;
  const sLat = gpsUsableForStage ? lat : null;
  const sLng = gpsUsableForStage ? lng : null;
  const gpsRejected = !gpsUsableForStage && lat != null;
  const localDate = (rawUtcMs != null) ? _wallClockFromUtc(rawUtcMs, cfg) : date;
  const nw = _photoFestivalNightWeekend(localDate, cfg, rawUtcMs);
  if (!nw) return { localDate, gpsRejected, artistId: null, night: null, festivalId, resolvedBy, reason: "outside_festival_window" };
  const night = nw.night;
  // Only the acts playing the photo's weekend: every match below (saved and
  // attended, the time matcher, the changeover rescue, GPS separation) reads
  // this list, so a weekend-1 photo can never land on a weekend-2-only act.
  const artists = (set.artists || []).filter(a => actPlaysWeekend(a, nw.weekend));

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
    const midnight = dm.midnightUtc + nw.shift;   // the act's day on the photo's weekend
    const [sh, sm] = a.start.split(":").map(Number);
    const [eh, em] = a.end.split(":").map(Number);
    return {
      localDate, gpsRejected,
      startMs: midnight + ((sh < 8 ? sh + 24 : sh) * 60 + sm) * 60000,
      endMs:   midnight + ((eh < 8 ? eh + 24 : eh) * 60 + em) * 60000,
    };
  };
  // SMARTEST SIGNAL: you film the sets you planned to see / actually saw.
  // Match the photo's ABSOLUTE capture time against the windows of every set
  // you ATTENDED (+1000) or SAVED (+500). Attended wins because being there is
  // ground truth; saved is intent. Night-correct by construction.
  const attendedSet = new Set(attendedIds || []);
  const savedSet    = new Set(savedIds || []);
  const priorIds    = [...new Set([...(attendedIds || []), ...(savedIds || [])])];

  // SPEC-179: GPS speaks for a STAGE only through the one fix gate (#366):
  // accuracy 100 m or better (unknown counts as coarse), within 140 m of the
  // nearest stage, and that stage at least 35 m nearer than the runner-up.
  // At III Points the pins sit 42-121 m apart, so the old "within 120 m at
  // ±200 m" read one spot as two to five stages, and a clip filmed at RC95
  // during Yousuke Yukimatsu was tagged horsegiirL at Sector 3.
  const stageAnchorsAll = resolvedStageAnchors(cfg);
  const fixGate = (lat != null && lng != null)
    ? stageFixGate(stageAnchorsAll, { lat, lng, accuracy: acc }, null, STAGE_FIX_PHOTO)
    : { status: "none" };
  const trustedStage = fixGate.status === "trusted" ? fixGate.stageId : null;
  const gpsGate = fixGate.status === "none" ? undefined : {
    status: fixGate.status, stageId: trustedStage,
    distM: fixGate.distM != null ? Math.round(fixGate.distM) : null,
    marginM: fixGate.marginM != null ? Math.round(fixGate.marginM) : null,
  };
  // Every act whose set (5 min early, 10 min late) contains the capture time.
  const playingIn = (a) => {
    const w = setWindow(a);
    return !!w && photoMs >= w.startMs - 5 * 60000 && photoMs <= w.endMs + 10 * 60000;
  };
  const playingNow = artists.filter(playingIn)
    .sort((x, y) => (setWindow(x).startMs - setWindow(y).startMs) || String(x.id).localeCompare(String(y.id)));
  // A trusted fix at a stage where an act is playing tags that act, even over
  // a set you saved or marked attended: being measured at RC95 outranks a
  // plan, and a tap on the wrong row. Anything else that could be true stays
  // on the record as an alternative.
  if (trustedStage) {
    const here = playingNow.filter(a => a.stage === trustedStage);
    if (here.length) {
      // Two acts at one stage only overlap in the changeover slack: the one
      // whose real set contains the time, else the nearer edge.
      const edge = (a) => { const w = setWindow(a); return photoMs < w.startMs ? w.startMs - photoMs : photoMs > w.endMs ? photoMs - w.endMs : 0; };
      const act = here.slice().sort((x, y) => edge(x) - edge(y))[0];
      const anchor = stageAnchorsAll.find(g => g.stageId === trustedStage);
      const surveyGrade = !!anchor && (anchor.anchorSource === "osm" || anchor.anchorSource === "crowd");
      // An act at a stage with no pin could be where the fix really was.
      const unpinned = playingNow.some(a => a.id !== act.id && !stageAnchorsAll.some(g => g.stageId === a.stage));
      const priorPlaying = priorIds.filter(id => id !== act.id && playingNow.some(a => a.id === id));
      const ambiguous = !surveyGrade || unpinned || here.length > 1 || priorPlaying.length > 0;
      // The act GPS found may also be the one you saved or attended: say so.
      const own = attendedSet.has(act.id) ? "attended" : savedSet.has(act.id) ? "saved" : null;
      const over = priorPlaying.length ? ";over-" + (priorPlaying.some(id => attendedSet.has(id)) ? "attended" : "saved") : "";
      return {
        localDate, gpsRejected,
        artistId: act.id, night: act.day, festivalId, resolvedBy,
        reason: own ? own + "_set_time" : "stage_gps_time",
        evidence: (own ? own + "+time+stage-gps" : "trusted-gps+time") + over,
        suggested: false,
        anchorSource: anchor ? anchor.anchorSource : null,
        ambiguous,
        alternatives: ambiguous ? [act.id, ...playingNow.filter(a => a.id !== act.id).map(a => a.id)] : undefined,
        gpsGate,
      };
    }
  }
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
    const attended = attendedSet.has(hit.a.id);
    // Build 39 (food photo under Rüfüs): a SAVED set is intent, not proof you
    // were there. Saved + time alone is a suggestion the user checks; usable
    // GPS at that set's own stage confirms it; GPS clearly outside the
    // festival defeats it. An ATTENDED set stays ground truth (v211).
    if (!attended) {
      const away = _offVenueMeters(cfg, lat, lng, acc);
      if (away != null) {
        return { localDate, gpsRejected, artistId: null, night, festivalId, resolvedBy, reason: "off_venue",
                 evidence: "gps-off-venue", distMeters: away, defeated: hit.a.id };
      }
    }
    // A trusted fix at this set's own stage confirms a saved guess. A fix
    // that is coarse, ambiguous or elsewhere with nobody playing says nothing
    // (a trusted fix at a stage WITH an act playing already returned above).
    const atStage = trustedStage != null && trustedStage === hit.a.stage;
    const evidence = attended ? "attended+time" : atStage ? "saved+time+stage-gps" : "saved+time";
    return {
      localDate, gpsRejected,
      artistId: hit.a.id, night: hit.a.day, festivalId, resolvedBy,
      reason: attended ? "attended_set_time" : "saved_set_time",
      evidence,
      suggested: !attended && !atStage,
      ambiguous,
      alternatives: ambiguous ? topTier.map(h => h.a.id) : undefined,
      gpsGate,
    };
  }

  // The same off-venue verdict for every other time-only guess: a photo
  // taken clearly outside the festival is not of whoever was on stage.
  {
    const away = _offVenueMeters(cfg, lat, lng, acc);
    if (away != null) return { localDate, gpsRejected, artistId: null, night, festivalId, resolvedBy, reason: "off_venue", evidence: "gps-off-venue", distMeters: away };
  }

  // Off-stage check (FALLBACK ONLY — runs after the attended/saved set-time
  // match above has already failed). If the photo has GPS and it's beyond
  // ~120m from EVERY stage anchor AND we couldn't tie it to a set you
  // saved/attended, you were probably between sets — on Rainbow Road, at a
  // vendor, in a charger line. Surface "off_stage" so the UI shows
  // 📍 BETWEEN SETS instead of force-tagging the nearest stage's artist.
  // This is deliberately AFTER the prior-set match so crowd-distance GPS
  // never overrides ground truth (you told us you watched that set).
  if (sLat != null && sLng != null) {
    // Crowd anchors where measured, poster pins otherwise. This gate is why
    // 0.2 matters beyond tagging: with kinetic's pin 438 m from where its
    // crowd actually stands, eight tight-fix photos taken AT the main stage
    // were 218-317 m from every anchor and got dumped here as "between sets".
    const anchors = resolvedStageAnchors(cfg);
    if (anchors.length > 0 && _allProgrammedStagesAnchored(artists, night, anchors)) {
      let nearest = null, minMeters = Infinity;
      for (const a of anchors) {
        const m = _haversineMeters(sLat, sLng, a.lat, a.lng);
        if (m < minMeters) { minMeters = m; nearest = a; }
      }
      if (minMeters > 120) {
        const loc = _matchNearestLocation(sLat, sLng, set);
        // Stamp provenance: an off_stage verdict reached against a poster pin
        // is a weaker claim than one reached against a measured position.
        return { localDate, gpsRejected, artistId: null, night, festivalId, resolvedBy, reason: "off_stage", distMeters: Math.round(minMeters), location: loc,
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
    // SPEC-179: only a TRUSTED fix names the stage here too.
    {
      const nearStage = trustedStage;
      const nearStageM = fixGate.distM;
      const nearSource = (stageAnchorsAll.find(g => g.stageId === trustedStage) || {}).anchorSource || null;
      if (nearStage) {
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
          return { localDate, gpsRejected, artistId: best.id, night, festivalId, resolvedBy, reason: "stage_time_proximity",
                   ambiguous: true, alternatives: undefined, anchorSource: nearSource,
                   proximity: { stageId: nearStage, meters: Math.round(nearStageM), gapMin: bestGap } };
        }
      }
    }
    // We know the night but no specific artist — return the night so the
    // photo still lands in the right bucket (e.g. between sets, in the
    // shuttle line, etc.).
    return { localDate, gpsRejected, artistId: null, night, festivalId, resolvedBy, reason: "no_artist_at_time" };
  }
  // A precise fix more than 140 m from every pinned stage (the gate's
  // "outside") rules out the acts AT pinned stages: you were not within 140 m
  // of them. What is left plays on a stage with no pin, where the fix could
  // be. ACL pins 3 of 7 stages, so a photo in the BMI crowd is BMI's.
  if (fixGate.status === "outside" && candidates.length > 1) {
    const pinned = (a) => stageAnchorsAll.some(g => g.stageId === a.stage);
    const left = candidates.filter(c => !pinned(c.a));
    if (left.length === 1) {
      return { localDate, gpsRejected, artistId: left[0].a.id, night, festivalId, resolvedBy, reason: "unpinned_by_exclusion",
               ambiguous: true, anchorSource: null, gpsGate,
               alternatives: [left[0].a.id, ...candidates.filter(c => c !== left[0]).sort((x, y) => x.startMin - y.startMin).map(c => c.a.id)] };
    }
    if (left.length > 1) {
      const ordered = [...left.sort((x, y) => x.startMin - y.startMin), ...candidates.filter(c => pinned(c.a)).sort((x, y) => x.startMin - y.startMin)];
      return { localDate, gpsRejected, artistId: null, night, festivalId, resolvedBy, reason: "several_playing",
               ambiguous: true, anchorSource: null, gpsGate, alternatives: ordered.map(c => c.a.id) };
    }
  }
  // One act playing: that's the act, whatever GPS says (a trusted fix at
  // its stage already returned above; a fix elsewhere with nobody playing
  // there is a walk between stages, not a different set).
  if (candidates.length === 1) {
    return { localDate, gpsRejected, artistId: candidates[0].a.id, night, festivalId, resolvedBy, reason: "matched",
             ambiguous: false, anchorSource: null, gpsGate };
  }
  // Several acts playing and no trusted fix to choose between them. Before
  // SPEC-179 the act that started most recently won, flagged ambiguous; a
  // guess is not a tag, so this stays untagged with every act that was
  // playing offered as a suggestion, earliest start first.
  const several = candidates.slice().sort((x, y) => (x.startMin - y.startMin) || String(x.a.id).localeCompare(String(y.a.id)));
  return {
    localDate, gpsRejected,
    artistId: null, night, festivalId, resolvedBy, reason: "several_playing",
    ambiguous: true, anchorSource: null,
    alternatives: several.map(c => c.a.id),
    gpsGate,
  };
}

// ── Scan my weekend (v513) ────────────────────────────────────
// The iPhone app can read the photo library directly (PhotoScan plugin)
// instead of the user hand-picking files in PHPicker, which strips GPS
// without full access and caps a pick at 50. These are the pure parts: which
// time ranges to ask the library for, which assets it returned belong to a
// festival night, and how an asset's own capture data becomes the meta the
// matcher reads. Nothing here touches the plugin, so it all runs in a vm test.

// Every night of the festival as a UTC window, per weekend. The same
// 11:00 → 06:00 local span (±30 min) _photoFestivalNightWeekend accepts, so
// anything the scan keeps is something the matcher can place on a night.
function _scanNightWindows(cfgIn) {
  const cfg = cfgIn || window.FESTIVAL_CONFIG;
  if (!cfg?.dayDates) return [];
  const H = 3600000, slack = 30 * 60000;
  const out = [];
  for (const { weekend, shift } of festivalWeekendShifts(cfg)) {
    for (const n of Object.keys(cfg.dayDates).map(Number)) {
      const dm = cfg.dayDates[n];
      if (!dm || typeof dm.midnightUtc !== "number") continue;
      const midnight = dm.midnightUtc + shift;
      out.push({ night: n, weekend, startMs: midnight + 11 * H - slack, endMs: midnight + 30 * H + slack });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

// The library is asked once per contiguous run of nights, not once for the
// whole envelope: ACL's two weekends sit a week apart, and the week between
// is not the festival.
function _scanQueryRanges(cfgIn) {
  const ranges = [];
  for (const w of _scanNightWindows(cfgIn)) {
    const last = ranges[ranges.length - 1];
    if (last && w.startMs <= last.endMs) last.endMs = Math.max(last.endMs, w.endMs);
    else ranges.push({ startMs: w.startMs, endMs: w.endMs });
  }
  return ranges;
}

// One PhotoKit asset → the meta processImportedFiles hands the matcher.
// creationDate is a real instant, so rawUtcMs is authoritative and no
// timezone is guessed; the wall clock is derived for display only. A 0,0
// location is PhotoKit's "no fix", never a place.
function _photoKitAssetMeta(asset, cfgIn) {
  const cfg = cfgIn || window.FESTIVAL_CONFIG;
  const ms = Number(asset?.createdMs);
  if (!isFinite(ms) || ms <= 0) return null;
  const lat = Number(asset.lat), lng = Number(asset.lng);
  const hasGps = asset.lat != null && asset.lng != null && isFinite(lat) && isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  const acc = Number(asset.acc);
  return {
    date: _wallClockFromUtc(ms, cfg),
    rawUtcMs: ms,
    lat: hasGps ? lat : null,
    lng: hasGps ? lng : null,
    acc: hasGps && asset.acc != null && isFinite(acc) && acc >= 0 ? acc : null,
    timestampSource: "photokit",
    locationSource: hasGps ? "photokit-gps" : "none",
  };
}

// ── Scan hours from set times (build 39) ─────────────────────────────────
// Jake, 2026-11-05: "15 min before and after … everything else does not get
// scanned", "we can do photos/videos between set", "we have set times in the
// app". So each night's window is the app's own set times: the first set's
// start − 15 min to the last set's end + 15 min, on that night's weekend, in
// the festival's timezone. Between-set photos are inside it. Anything outside
// is counted and skipped: never imported, never marked as seen (a later
// lineup fix can still pick it up), and nothing already imported is touched.
// A night with no set times has no window and is not scanned; it is counted
// and named, never given guessed hours.
const _SCAN_SET_BUFFER_MS = 15 * 60000;
const _SCAN_TIME_RE = /^(\d{1,2}):(\d{2})$/;
// A wall-clock time in an IANA zone → the UTC instant. Two passes of "how far
// is this zone from UTC at that instant" settle a DST day (the second pass
// catches an instant whose own offset differs from the first guess's).
function _zonedWallToUtc(yr, mo, dy, hh, mm, tz) {
  const guess = Date.UTC(yr, mo - 1, dy, hh, mm);
  if (!tz || typeof Intl === "undefined") return null;
  let fmt;
  try { fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return null; }
  const offsetAt = (ms) => {
    const p = {}; for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return t;
}
// The local calendar date of night n on a weekend: read from the instant
// at local noon-ish, so a shifted weekend that crossed a DST change still
// lands on the right day.
function _scanNightLocalDate(cfg, n, shift) {
  const dm = cfg?.dayDates?.[n];
  if (!dm || typeof dm.midnightUtc !== "number") return null;
  const ms = dm.midnightUtc + shift + 12 * 3600000;
  if (cfg.tz && typeof Intl !== "undefined") {
    try {
      const p = {}; for (const x of new Intl.DateTimeFormat("en-US", { timeZone: cfg.tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms))) p[x.type] = x.value;
      return { yr: +p.year, mo: +p.month, dy: +p.day };
    } catch {}
  }
  const d = new Date(ms + _festivalTzOffsetHours(cfg) * 3600000);
  return { yr: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, dy: d.getUTCDate() };
}
// One act's set as UTC instants on a given night/weekend. Hours < 8 belong
// to the night they close (the same rule the matcher and lineup use).
function _scanActUtc(cfg, n, shift, hhmm) {
  const m = _SCAN_TIME_RE.exec(String(hhmm || ""));
  if (!m) return null;
  let h = +m[1]; const mi = +m[2];
  const date = _scanNightLocalDate(cfg, n, shift);
  if (!date) return null;
  let dayAdd = 0;
  if (h < 8) dayAdd = 1;
  const base = new Date(Date.UTC(date.yr, date.mo - 1, date.dy + dayAdd));
  const utc = _zonedWallToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), h, mi, cfg.tz);
  if (utc != null) return utc;
  const dm = cfg.dayDates[n];
  return dm.midnightUtc + shift + ((h < 8 ? h + 24 : h) * 60 + mi) * 60000;
}
// Every night of every weekend: its window from set times, or none.
//   { night, weekend, source: "set-times", startMs, endMs, acts }
//   { night, weekend, source: "none", acts: 0 }
function _scanSetWindows(cfgIn, artistsIn) {
  const cfg = cfgIn || window.FESTIVAL_CONFIG;
  // The lineup of THIS config's festival. Bare ARTISTS is whichever festival
  // is active (CLAUDE.md §5), so a non-active config reads _DATA_SETS.
  const artists = artistsIn
    || (cfg?.id && window._DATA_SETS?.[cfg.id]?.artists)
    || (cfg === window.FESTIVAL_CONFIG ? window.ARTISTS : null) || [];
  if (!cfg?.dayDates) return [];
  const out = [];
  for (const { weekend, shift } of festivalWeekendShifts(cfg)) {
    for (const n of Object.keys(cfg.dayDates).map(Number).sort((a, b) => a - b)) {
      if (!cfg.dayDates[n] || typeof cfg.dayDates[n].midnightUtc !== "number") continue;
      let startMs = Infinity, endMs = -Infinity, acts = 0;
      // weekend-exempt: builds a window for EVERY weekend; actPlaysWeekend(a, weekend) filters each one below
      for (const a of artists) {
        if (Number(a?.day) !== n || !actPlaysWeekend(a, weekend)) continue;
        // Only a confirmed time may move a boundary: an act whose sources
        // disagree (timeEvidence unresolved) ships blank, but a time that
        // reaches it some other way must not widen or open a night.
        if (setTimeStatus(a) !== "confirmed") continue;
        const s0 = _scanActUtc(cfg, n, shift, a.start), e0 = _scanActUtc(cfg, n, shift, a.end);
        if (s0 == null || e0 == null) continue;
        const e1 = e0 <= s0 ? e0 + 24 * 3600000 : e0; // a set that ends after midnight but before 08:00 is already +1 day; guard odd data
        acts++;
        if (s0 < startMs) startMs = s0;
        if (e1 > endMs) endMs = e1;
      }
      out.push(acts
        ? { night: n, weekend, source: "set-times", startMs: startMs - _SCAN_SET_BUFFER_MS, endMs: endMs + _SCAN_SET_BUFFER_MS, acts }
        : { night: n, weekend, source: "none", acts: 0 });
    }
  }
  return out;
}
// Per night, in words a person can check against the app's own schedule:
// local start and end of each window, or "no set times".
function _scanWindowReport(cfgIn, artistsIn) {
  const cfg = cfgIn || window.FESTIVAL_CONFIG;
  return _scanSetWindows(cfg, artistsIn).map(w => {
    if (w.source !== "set-times") return { night: w.night, weekend: w.weekend, source: w.source };
    const f = (ms) => { const d = _wallClockFromUtcTz(ms, cfg); return `${d.yr}-${String(d.mo).padStart(2, "0")}-${String(d.dy).padStart(2, "0")} ${String(d.hh).padStart(2, "0")}:${String(d.mm).padStart(2, "0")}`; };
    return { night: w.night, weekend: w.weekend, source: w.source, acts: w.acts, start: f(w.startMs), end: f(w.endMs) };
  });
}
function _wallClockFromUtcTz(ms, cfg) {
  if (cfg?.tz && typeof Intl !== "undefined") {
    try {
      const p = {}; for (const x of new Intl.DateTimeFormat("en-US", { timeZone: cfg.tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms))) p[x.type] = x.value;
      return { yr: +p.year, mo: +p.month, dy: +p.day, hh: +p.hour % 24, mm: +p.minute };
    } catch {}
  }
  return _wallClockFromUtc(ms, cfg);
}

// Which of the returned assets to import: inside a night's set-time window,
// not imported by an earlier scan, oldest first. Everything else is counted
// by why, so the screen can say what it skipped instead of a bare "nothing":
//   outside     — on no festival night at all
//   outsideSets — on a festival night, outside that night's set-time window
//   already     — imported by an earlier scan
// A night the app has no set times for has no hours to keep, so it is
// scanned in full (Jake 2026-11-05); `fullNight` counts what came from one
// and `untimedNights` how many such nights this festival has.
function _scanPickAssets(assets, cfgIn, seenIds, artistsIn) {
  const cfg = cfgIn || window.FESTIVAL_CONFIG;
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  const windows = _scanSetWindows(cfg, artistsIn);
  const timed = windows.filter(w => w.source === "set-times");
  const untimed = new Set(windows.filter(w => w.source !== "set-times").map(w => `${w.night}|${w.weekend}`));
  const keep = [];
  let outside = 0, outsideSets = 0, fullNight = 0, already = 0;
  for (const a of assets || []) {
    if (!a || !a.id) continue;
    const ms = Number(a.createdMs);
    if (!isFinite(ms)) { outside++; continue; }
    let whole = false;
    if (!timed.some(w => ms >= w.startMs && ms <= w.endMs)) {
      const nw = _photoFestivalNightWeekend(null, cfg, ms);
      if (!nw) { outside++; continue; }
      if (!untimed.has(`${nw.night}|${nw.weekend}`)) { outsideSets++; continue; }
      whole = true;
    }
    if (seen.has(a.id)) { already++; continue; }
    if (whole) fullNight++;
    keep.push(a);
  }
  keep.sort((x, y) => Number(x.createdMs) - Number(y.createdMs));
  return { keep, outside, outsideSets, fullNight, untimedNights: untimed.size, already,
           nightsWithoutSetTimes: windows.filter(w => w.source !== "set-times").map(w => ({ night: w.night, weekend: w.weekend })) };
}

// Picker cancel is not an error. @capawesome/capacitor-file-picker 6.2.0
// REJECTS when the sheet is dismissed ("pickFiles canceled."; pickMedia uses
// the same wording), so the catch below it reported a cancel as a failure
// and left an orange card up. Only that exact cancel wording counts; any
// other rejection is still an error.
function _pickerErrorIsCancel(err) {
  const msg = String((err && (err.message || err.errorMessage)) || err || "").trim();
  return /^pick(Files|Media|Images|Videos)? cancel(l)?ed\.?$/i.test(msg);
}

// Import batches: up to `maxPhotos` photos together, but a video always goes
// alone. A clip can be hundreds of MB, and holding several at once in the
// WebView is how an import runs out of memory. Order is kept.
function _scanChunks(assets, maxPhotos = 20) {
  const chunks = [];
  for (const a of assets || []) {
    const last = chunks[chunks.length - 1];
    if (a?.mediaType !== "video" && last && last.length < maxPhotos && last[0]?.mediaType !== "video") last.push(a);
    else chunks.push([a]);
  }
  return chunks;
}

// Library ids an earlier scan already imported. Device-local on purpose: a
// PhotoKit id means nothing on another phone. Capped so it cannot grow
// without bound across seasons; the oldest fall off first, and the import's
// own fingerprint check still catches a repeat.
const _SCAN_SEEN_KEY = "plursky_scan_seen_v1";
const _SCAN_SEEN_MAX = 20000;
function _scanSeenRead() {
  try {
    const v = JSON.parse(localStorage.getItem(_SCAN_SEEN_KEY) || "[]");
    return new Set(Array.isArray(v) ? v.filter(x => typeof x === "string") : []);
  } catch { return new Set(); }
}
function _scanSeenAdd(ids) {
  const cur = [..._scanSeenRead()];
  const have = new Set(cur);
  for (const id of ids || []) if (typeof id === "string" && !have.has(id)) { cur.push(id); have.add(id); }
  const trimmed = cur.length > _SCAN_SEEN_MAX ? cur.slice(cur.length - _SCAN_SEEN_MAX) : cur;
  try { localStorage.setItem(_SCAN_SEEN_KEY, JSON.stringify(trimmed)); } catch {}
  return trimmed.length;
}

// ── Scan diagnostic (build 39) ───────────────────────────────────────────
// WHY THIS EXISTS: on a real phone a second Scan of ACL left 60 clips under
// one Charli XCX card, after the first scan had filed 17 across their own
// sets. The code paths we could read (the grouping, "Looks right", a 2-old /
// 2-new rescan) do not reproduce it, so the cause is unknown. This records
// what the moment store looks like and which write changed it, so the next
// on-device run names the responsible write instead of us guessing one.
//
// It only READS the store. Nothing here migrates, retags, repairs or deletes
// a moment — the recorded state is evidence, and a repair needs its own
// approval.
//
// Privacy allowlist, enforced by test-scan-diagnostic.mjs: per record only a
// locally salted hash of the moment id, festival id, night, artist id (public
// lineup ids), tag/stamp/time source labels, kind and yes/no flags. No capture
// time, no import time, never a file name, path, PhotoKit id, GPS, location,
// fingerprint, text, token or email. Events carry their own timestamps (when
// the app wrote, not when a photo was taken), counts, the writing function's
// name and hash-keyed change lines. The export is REBUILT from those fields
// every time, never copied through from storage, and it leaves the phone only
// through the share sheet, when the user taps the button.
const _SCAN_DIAG_KEY = "plursky_scan_diag_v1";
const _SCAN_DIAG_SALT_KEY = "plursky_scan_diag_salt_v1";
const _SCAN_DIAG_MAX_EVENTS = 60;
const _SCAN_DIAG_MAX_CHANGES = 80;   // per event
const _SCAN_DIAG_MAX_RECORDS = 1500; // per snapshot
const _SCAN_DIAG_MAX_CHARS = 38000;  // the shared text; a Slack message holds 40k

function _scanDiagSalt() {
  try {
    let s = localStorage.getItem(_SCAN_DIAG_SALT_KEY);
    if (!s || !/^[0-9a-f]{32}$/.test(s)) {
      const b = new Uint8Array(16);
      if (window.crypto?.getRandomValues) window.crypto.getRandomValues(b);
      else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
      s = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(_SCAN_DIAG_SALT_KEY, s);
    }
    return s;
  } catch { return "nosalt"; }
}

// Two FNV-1a passes over salt+id → 16 hex. Not a secret store: it only has to
// let a before/after comparison follow one record without exporting its id.
function _scanDiagHash(id, salt) {
  const str = `${salt}|${id}`;
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const _scanDiagStr = (v, re, max = 40) =>
  (typeof v === "string" && v.length <= max && re.test(v)) ? v : (v == null ? null : "?");
const _SCAN_DIAG_ID_RE = /^[A-Za-z0-9_.:-]+$/;
const _SCAN_DIAG_LABEL_RE = /^[a-z0-9_-]+$/i;

// One moment → the allowlisted record. Built field by field from known
// names, so a new private field on a moment can never leak through a spread.
function _scanDiagRecord(m, night, salt) {
  return {
    h: _scanDiagHash(String(m.id), salt),
    f: _scanDiagStr(m.festivalId, _SCAN_DIAG_ID_RE),
    n: Number.isFinite(Number(night)) ? Number(night) : null,
    a: _scanDiagStr(m.artistId, _SCAN_DIAG_ID_RE),
    ts: _scanDiagStr(m.tagSource, _SCAN_DIAG_LABEL_RE),
    fs: _scanDiagStr(m.festivalStampSource, _SCAN_DIAG_LABEL_RE),
    tk: _scanDiagStr(m.takenAtSource, _SCAN_DIAG_LABEL_RE),
    k: m.kind === "video" ? "v" : "p",
    auto: m.autoTagged ? 1 : 0,
    amb: m.tagAmbiguous ? 1 : 0,
    rt: m.needsRetag ? 1 : 0,
    fp: m._fingerprint ? 1 : 0,
  };
}

function _scanDiagRecords(all, salt) {
  const out = [];
  for (const night of Object.keys(all || {})) {
    const arr = all[night];
    if (!Array.isArray(arr)) continue;
    for (const m of arr) if (m && m.id != null) out.push(_scanDiagRecord(m, night, salt));
  }
  return out;
}

// Counts by festival → night → artist ("-" = untagged), plus tag sources.
function _scanDiagSummary(records) {
  const byFest = {}, bySource = {};
  for (const r of records) {
    const f = r.f || "-", n = r.n == null ? "-" : String(r.n), a = r.a || "-";
    byFest[f] = byFest[f] || { total: 0, nights: {} };
    byFest[f].total++;
    const nn = byFest[f].nights[n] = byFest[f].nights[n] || {};
    nn[a] = (nn[a] || 0) + 1;
    const s = r.ts || "-";
    bySource[s] = (bySource[s] || 0) + 1;
  }
  return { total: records.length, byFest, bySource };
}

function _scanDiagRead() {
  try {
    const v = JSON.parse(localStorage.getItem(_SCAN_DIAG_KEY) || "null");
    if (v && typeof v === "object" && Array.isArray(v.events)) return v;
  } catch {}
  return { v: 1, before: null, last: null, events: [] };
}
function _scanDiagWrite(d) {
  try { localStorage.setItem(_SCAN_DIAG_KEY, JSON.stringify(d)); return true; } catch { return false; }
}

// Which code wrote: function names off the call stack, nothing else. Safari
// frames look like "name@capacitor://localhost/build/x.js:1:2" and V8 frames
// like "at name (file:1:2)"; only the bare name is kept.
function _scanDiagOrigin(stack) {
  const names = [];
  for (const line of String(stack || "").split("\n")) {
    const m = line.match(/^\s*(?:at\s+)?(?:async\s+)?([A-Za-z_$][\w$.]*)\s*(?:@|\()/);
    const nm = m && m[1].split(".").pop();
    if (!nm || /^_scanDiag|^_writeMoments$|^Error$/.test(nm)) continue;
    if (nm.length <= 40) names.push(nm);
    if (names.length >= 4) break;
  }
  return names.join(">") || "?";
}

// The very first time this build runs, before any scan or cloud restore can
// write, keep the store exactly as it was found. Never overwritten.
function _scanDiagEnsureBefore(allIn) {
  try {
    const d = _scanDiagRead();
    if (d.before) return false;
    const salt = _scanDiagSalt();
    const all = allIn || JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    const records = _scanDiagRecords(all, salt);
    d.before = { t: new Date().toISOString(), summary: _scanDiagSummary(records), records: records.slice(0, _SCAN_DIAG_MAX_RECORDS), truncated: records.length > _SCAN_DIAG_MAX_RECORDS };
    d.last = Object.fromEntries(records.map(r => [r.h, `${r.f}|${r.n}|${r.a}|${r.ts}`]));
    d.events.push({ t: d.before.t, ev: "before", origin: "boot", total: records.length });
    return _scanDiagWrite(d);
  } catch { return false; }
}

// Log one event against the store as it is NOW. For a write, `all` is the
// object being written; the change list says which records appeared,
// vanished, or moved festival/night/artist/source since the previous event.
function _scanDiagLog(ev, all, stack) {
  try {
    const d = _scanDiagRead();
    const salt = _scanDiagSalt();
    const cur = all || JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    const records = _scanDiagRecords(cur, salt);
    const now = {};
    for (const r of records) now[r.h] = `${r.f}|${r.n}|${r.a}|${r.ts}`;
    const prev = d.last || {};
    let added = 0, removed = 0, changed = 0;
    const changes = [];
    for (const h of Object.keys(now)) {
      if (!(h in prev)) { added++; if (changes.length < _SCAN_DIAG_MAX_CHANGES) changes.push(`+${h}:${now[h]}`); }
      else if (prev[h] !== now[h]) { changed++; if (changes.length < _SCAN_DIAG_MAX_CHANGES) changes.push(`~${h}:${prev[h]}>${now[h]}`); }
    }
    for (const h of Object.keys(prev)) if (!(h in now)) { removed++; if (changes.length < _SCAN_DIAG_MAX_CHANGES) changes.push(`-${h}:${prev[h]}`); }
    // An import persists after EVERY file, so one scan is dozens of writes
    // from the same caller. Back-to-back writes from one origin fold into a
    // single event (counts summed, changes appended to the cap), so a scan
    // cannot push the "before" history out of the event cap.
    const origin = ev === "write" ? _scanDiagOrigin(stack) : ev;
    const lastEv = d.events[d.events.length - 1];
    if (ev === "write" && lastEv && lastEv.ev === "write" && lastEv.origin === origin) {
      lastEv.writes = (lastEv.writes || 1) + 1;
      lastEv.tEnd = new Date().toISOString();
      lastEv.total = records.length;
      lastEv.added += added; lastEv.removed += removed; lastEv.changed += changed;
      for (const c of changes) if (lastEv.changes.length < _SCAN_DIAG_MAX_CHANGES) lastEv.changes.push(c);
    } else {
      d.events.push({ t: new Date().toISOString(), ev, origin, total: records.length, added, removed, changed, changes });
      if (d.events.length > _SCAN_DIAG_MAX_EVENTS) {
        // Keep the "before" line; drop the oldest after it.
        d.events.splice(1, d.events.length - _SCAN_DIAG_MAX_EVENTS);
      }
    }
    d.last = now;
    return _scanDiagWrite(d);
  } catch { return false; }
}

// ── Export: rebuilt from allowed fields, hard-bounded ─────────────────────
// Everything persisted is re-validated on the way out. A stored record,
// summary or event that grew an unexpected field (an older build, a bug, a
// hand edit) contributes only the fields named here, each checked against
// its pattern. Nothing from storage is spread or copied through.
const _SCAN_DIAG_HASH_RE = /^[0-9a-f]{16}$/;
const _SCAN_DIAG_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const _SCAN_DIAG_NIGHT_RE = /^(-|_other|\d{1,3})$/;
const _SCAN_DIAG_EV_RE = /^[a-z-]{1,20}$/;
const _SCAN_DIAG_ORIGIN_RE = /^[A-Za-z0-9_$>?-]{1,170}$/;
const _SCAN_DIAG_SEG = "[A-Za-z0-9_.:?-]{1,40}";
const _SCAN_DIAG_STATE = `${_SCAN_DIAG_SEG}\\|${_SCAN_DIAG_SEG}\\|${_SCAN_DIAG_SEG}\\|${_SCAN_DIAG_SEG}`;
const _SCAN_DIAG_CHANGE_RE = new RegExp(`^[+~-][0-9a-f]{16}:${_SCAN_DIAG_STATE}(>${_SCAN_DIAG_STATE})?$`);
const _scanDiagInt = (v) => (Number.isInteger(v) && v >= 0 && v < 1e7) ? v : 0;
const _scanDiagKey = (k, re) => typeof k === "string" && k.length <= 40 && re.test(k);

function _scanDiagCleanRecord(r) {
  if (!r || typeof r !== "object" || !_SCAN_DIAG_HASH_RE.test(r.h)) return null;
  return {
    h: r.h,
    f: _scanDiagStr(r.f, _SCAN_DIAG_ID_RE),
    n: Number.isInteger(r.n) && r.n >= 0 && r.n < 1000 ? r.n : null,
    a: _scanDiagStr(r.a, _SCAN_DIAG_ID_RE),
    ts: _scanDiagStr(r.ts, _SCAN_DIAG_LABEL_RE),
    fs: _scanDiagStr(r.fs, _SCAN_DIAG_LABEL_RE),
    tk: _scanDiagStr(r.tk, _SCAN_DIAG_LABEL_RE),
    k: r.k === "v" ? "v" : "p",
    auto: r.auto ? 1 : 0, amb: r.amb ? 1 : 0, rt: r.rt ? 1 : 0, fp: r.fp ? 1 : 0,
  };
}
function _scanDiagCleanCounts(obj, keyRe) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) if (_scanDiagKey(k, keyRe)) out[k] = _scanDiagInt(obj[k]);
  return out;
}
function _scanDiagCleanSummary(sIn) {
  const sum = sIn && typeof sIn === "object" ? sIn : {};
  const byFest = {};
  for (const f of Object.keys(sum.byFest || {})) {
    const fv = sum.byFest[f];
    if (!_scanDiagKey(f, _SCAN_DIAG_ID_RE) || !fv || typeof fv !== "object") continue;
    const nights = {};
    for (const n of Object.keys(fv.nights || {})) {
      if (_scanDiagKey(n, _SCAN_DIAG_NIGHT_RE)) nights[n] = _scanDiagCleanCounts(fv.nights[n], _SCAN_DIAG_ID_RE);
    }
    byFest[f] = { total: _scanDiagInt(fv.total), nights };
  }
  return { total: _scanDiagInt(sum.total), byFest, bySource: _scanDiagCleanCounts(sum.bySource, _SCAN_DIAG_ID_RE) };
}
function _scanDiagCleanEvent(e) {
  if (!e || typeof e !== "object") return null;
  const out = {
    t: typeof e.t === "string" && _SCAN_DIAG_ISO_RE.test(e.t) ? e.t : null,
    ev: typeof e.ev === "string" && _SCAN_DIAG_EV_RE.test(e.ev) ? e.ev : "?",
    origin: typeof e.origin === "string" && _SCAN_DIAG_ORIGIN_RE.test(e.origin) ? e.origin : "?",
    total: _scanDiagInt(e.total),
  };
  if (typeof e.tEnd === "string" && _SCAN_DIAG_ISO_RE.test(e.tEnd)) out.tEnd = e.tEnd;
  if (e.ev !== "before") {
    out.added = _scanDiagInt(e.added); out.removed = _scanDiagInt(e.removed); out.changed = _scanDiagInt(e.changed);
    if (Number.isInteger(e.writes)) out.writes = _scanDiagInt(e.writes);
    out.changes = Array.isArray(e.changes) ? e.changes.filter(c => typeof c === "string" && c.length <= 260 && _SCAN_DIAG_CHANGE_RE.test(c)) : [];
  }
  return out;
}
// Keep the k largest entries of a count map; the rest sum into "_other".
function _scanDiagTop(obj, k, val = (v) => v) {
  const e = Object.entries(obj);
  if (e.length <= k) return { out: obj, cut: false };
  e.sort((x, y) => val(y[1]) - val(x[1]));
  return { out: Object.fromEntries(e.slice(0, k)), rest: e.slice(k), cut: true };
}
function _scanDiagTrimSummary(sum, k) {
  if (k === Infinity) return { sum, cut: false };
  let cut = false;
  const byFest = {};
  const f = _scanDiagTop(sum.byFest, k, v => v.total);
  if (f.cut) {
    cut = true;
    byFest._other = { total: f.rest.reduce((t, [, v]) => t + v.total, 0), nights: {} };
  }
  for (const [fid, fv] of Object.entries(f.out)) {
    const nights = {};
    const ns = _scanDiagTop(fv.nights, k, v => Object.values(v).reduce((t, c) => t + c, 0));
    if (ns.cut) { cut = true; nights._other = { _other: ns.rest.reduce((t, [, v]) => t + Object.values(v).reduce((a, c) => a + c, 0), 0) }; }
    for (const [n, arts] of Object.entries(ns.out)) {
      const a = _scanDiagTop(arts, k);
      if (a.cut) { cut = true; a.out = { ...a.out, _other: (a.out._other || 0) + a.rest.reduce((t, [, c]) => t + c, 0) }; }
      nights[n] = a.out;
    }
    byFest[fid] = { total: fv.total, nights };
  }
  const src = _scanDiagTop(sum.bySource, k);
  if (src.cut) { cut = true; src.out = { ...src.out, _other: (src.out._other || 0) + src.rest.reduce((t, [, c]) => t + c, 0) }; }
  return { sum: { total: sum.total, byFest, bySource: src.out }, cut };
}

// The text the share sheet carries: compact JSON, at most 38,000 characters
// in ALL cases. Over the limit it sheds detail in a fixed order (record
// lists, then change lines and events, then per-artist detail in the
// summaries) and says what it shed in `truncated`. Totals are never cut.
function _scanDiagExportText(meta = {}) {
  const d = _scanDiagRead();
  const salt = _scanDiagSalt();
  const all = (() => { try { return JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}"); } catch { return {}; } })();
  const nowRecords = _scanDiagRecords(all, salt).map(_scanDiagCleanRecord).filter(Boolean);
  const nowSummary = _scanDiagCleanSummary(_scanDiagSummary(nowRecords));
  const b = d.before && typeof d.before === "object" ? d.before : null;
  const beforeRecords = b && Array.isArray(b.records) ? b.records.map(_scanDiagCleanRecord).filter(Boolean) : [];
  const beforeSummary = b ? _scanDiagCleanSummary(b.summary) : null;
  const beforeT = b && typeof b.t === "string" && _SCAN_DIAG_ISO_RE.test(b.t) ? b.t : null;
  const beforeCut = !!(b && b.truncated);
  const events = (Array.isArray(d.events) ? d.events : []).map(_scanDiagCleanEvent).filter(Boolean);
  const ver = typeof meta.appVersion === "string" && /^v\d+$/.test(meta.appVersion) ? meta.appVersion : null;
  const created = new Date().toISOString();
  const head = () => ({
    schema: "plursky-scan-diag/1", created, app: ver,
    activeFestival: _scanDiagStr(window.FESTIVAL_CONFIG?.id, _SCAN_DIAG_ID_RE),
    scanSeen: (() => { try { return _scanSeenRead().size; } catch { return null; } })(),
  });
  const build = ({ rec, ev, ch, k }) => {
    const evKeep = ev >= events.length ? events : ev <= 0 ? [] : [events[0], ...events.slice(1).slice(-(ev - 1))];
    let changesCut = false;
    const evOut = evKeep.map(e => {
      if (!e.changes) return e;
      if (e.changes.length > ch || e.changes.length < e.added + e.removed + e.changed) changesCut = true;
      return { ...e, changes: e.changes.slice(0, ch) };
    });
    const bs = beforeSummary ? _scanDiagTrimSummary(beforeSummary, k) : null;
    const ns = _scanDiagTrimSummary(nowSummary, k);
    return {
      ...head(),
      truncated: {
        records: beforeCut || beforeRecords.length > rec || nowRecords.length > rec,
        events: events.length - evOut.length,
        changes: changesCut,
        summary: !!(bs && bs.cut) || ns.cut,
      },
      eventsTotal: events.length,
      before: b ? { t: beforeT, total: beforeSummary.total, summary: bs.sum, truncated: beforeCut || beforeRecords.length > rec, records: beforeRecords.slice(0, rec) } : null,
      now: { total: nowRecords.length, summary: ns.sum, truncated: nowRecords.length > rec, records: nowRecords.slice(0, rec) },
      events: evOut,
    };
  };
  const steps = [];
  for (let n = _SCAN_DIAG_MAX_RECORDS; n > 0; n = Math.floor(n * 0.7)) steps.push({ rec: n, ev: _SCAN_DIAG_MAX_EVENTS, ch: _SCAN_DIAG_MAX_CHANGES, k: Infinity });
  steps.push({ rec: 0, ev: _SCAN_DIAG_MAX_EVENTS, ch: _SCAN_DIAG_MAX_CHANGES, k: Infinity },
             { rec: 0, ev: 30, ch: 20, k: Infinity }, { rec: 0, ev: 10, ch: 5, k: Infinity });
  for (const k of [200, 50, 20, 5, 1, 0]) steps.push({ rec: 0, ev: 10, ch: 5, k });
  steps.push({ rec: 0, ev: 0, ch: 0, k: 0 });
  for (const p of steps) {
    const text = JSON.stringify(build(p));
    if (text.length <= _SCAN_DIAG_MAX_CHARS) return text;
  }
  // Unreachable with sane input; still bounded if it ever is reached.
  return JSON.stringify({ ...head(), truncated: { records: true, events: events.length, changes: true, summary: true },
    eventsTotal: events.length, before: b ? { total: beforeSummary.total } : null, now: { total: nowRecords.length } }).slice(0, _SCAN_DIAG_MAX_CHARS);
}

// One tap → the iOS share sheet with the diagnostic as text (Slack, Messages,
// Mail all take it). Text, not a file: @capacitor/share hands a data URL to
// the sheet as a LINK, which is not something a person can send on.
// Returns { ok, mode } so the button can say what happened. With no native
// share, no navigator.share and no clipboard API, the answer is
// "unavailable": nothing was sent or copied, so nothing claims it was.
async function _scanDiagShare(meta = {}) {
  _scanDiagLog("share", null, "");
  const text = _scanDiagExportText(meta);
  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      await capShare.share({ title: "Plursky scan diagnostic", text, dialogTitle: "Send scan diagnostic" });
      return { ok: true, mode: "share", chars: text.length };
    } catch (e) {
      if (/cancel|abort/i.test(e?.message || "")) return { ok: false, mode: "cancelled", chars: text.length };
      return { ok: false, mode: "error", chars: text.length };
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try { await navigator.share({ title: "Plursky scan diagnostic", text }); return { ok: true, mode: "share", chars: text.length }; }
    catch (e) { if (e?.name === "AbortError") return { ok: false, mode: "cancelled", chars: text.length }; }
  }
  const clip = typeof navigator !== "undefined" ? navigator.clipboard : null;
  if (!clip || typeof clip.writeText !== "function") return { ok: false, mode: "unavailable", chars: text.length };
  try { await clip.writeText(text); return { ok: true, mode: "copied", chars: text.length }; }
  catch { return { ok: false, mode: "error", chars: text.length }; }
}

// Capture the untouched store as soon as this file loads: before React
// mounts, so before any Scan, cloud restore or retag can write.
try { _scanDiagEnsureBefore(); } catch {}

// Memories' empty-state copy, by what this build can do. Scan my weekend and
// the picker are separate doors: a build with Scan but no picker can still
// bring the library in, so the "can't open your photo library" line belongs
// only to a build with neither. One function, so the copy under the Scan card
// can never contradict it (#365).
function _memoriesImportCopy(pickerAvailable, scanAvailable) {
  if (pickerAvailable) return {
    invite: "Import your festival photos & videos — Plursky auto-tags each to the set you were watching, finds the song that was playing, and turns them into a recap.",
    withSets: "Import photos or videos and they’ll land on the sets below.",
  };
  if (scanAvailable) return {
    invite: "Plursky organises your festival photos and videos by the set you were watching. Tap Scan my weekend above to bring in your festival nights.",
    withSets: "Scan my weekend above and your clips will land on the sets below.",
  };
  return {
    invite: "Plursky organises your festival photos and videos by the set you were watching. This build can’t open your photo library, so there’s nothing to import from here yet.",
    withSets: "This build can’t open your photo library, so the sets below are your library for now.",
  };
}
