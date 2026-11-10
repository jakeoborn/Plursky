var _EXIF_TAG_EXIF_IFD = 0x8769;
var _EXIF_TAG_GPS_IFD = 0x8825;
var _EXIF_TAG_DATETIME_ORIGINAL = 0x9003;
var _EXIF_TAG_GPS_HPOS_ERR = 0x001F;
var _EXIF_TAG_GPS_IMG_DIR = 0x0011;
var _EXIF_TAG_GPS_IMG_DIR_REF = 0x0010;
var _EXIF_TAG_GPS_LAT_REF = 0x0001;
var _EXIF_TAG_GPS_LAT = 0x0002;
var _EXIF_TAG_GPS_LNG_REF = 0x0003;
var _EXIF_TAG_GPS_LNG = 0x0004;
var IMPORT_LOG_KEY = "plursky_import_log_v1";
function _importLog(event, detail) {
  var row = {
    t: new Date().toISOString(),
    event,
    ...(detail || {})
  };
  try {
    console.info(`[plursky:import] ${event} ${JSON.stringify(detail || {})}`);
  } catch {}
  try {
    var log = JSON.parse(localStorage.getItem(IMPORT_LOG_KEY) || "[]");
    log.push(row);
    localStorage.setItem(IMPORT_LOG_KEY, JSON.stringify(log.slice(-400)));
  } catch {}
}
function plurskyImportLog() {
  try {
    return JSON.parse(localStorage.getItem(IMPORT_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}
function _allFestivalAttendedIds() {
  try {
    var store = typeof getAttendedStore === "function" ? getAttendedStore() : {};
    return [...new Set(Object.values(store).flatMap(n => Object.values(n || {}).flat()))];
  } catch {
    return [];
  }
}
function _parseDateString(s) {
  if (!s) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) return {
    yr: +m[1],
    mo: +m[2],
    dy: +m[3],
    hh: +m[4],
    mm: +m[5],
    ss: +m[6]
  };
  m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) return {
    yr: +m[1],
    mo: +m[2],
    dy: +m[3],
    hh: +m[4],
    mm: +m[5],
    ss: +m[6]
  };
  return null;
}
function _parseXmpDateFromText(xmpText) {
  if (!xmpText) return null;
  var patterns = [/<exif:DateTimeOriginal>([^<]+)<\/exif:DateTimeOriginal>/, /exif:DateTimeOriginal=["']([^"']+)["']/, /<photoshop:DateCreated>([^<]+)<\/photoshop:DateCreated>/, /photoshop:DateCreated=["']([^"']+)["']/, /<xmp:CreateDate>([^<]+)<\/xmp:CreateDate>/, /xmp:CreateDate=["']([^"']+)["']/];
  for (var re of patterns) {
    var m = re.exec(xmpText);
    if (m) {
      var parsed = _parseDateString(m[1].trim());
      if (parsed) return parsed;
    }
  }
  return null;
}
function _parseFilenameDate(name) {
  if (!name) return null;
  var m;
  m = /Screenshot\s+(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{2})\.(\d{2})\.(\d{2})/i.exec(name);
  if (m) return {
    yr: +m[1],
    mo: +m[2],
    dy: +m[3],
    hh: +m[4],
    mm: +m[5],
    ss: +m[6]
  };
  m = /Photo\s+on\s+(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{1,2})\.(\d{2})\s*(AM|PM)/i.exec(name);
  if (m) {
    var hh = +m[4];
    if (/PM/i.test(m[6]) && hh < 12) hh += 12;
    if (/AM/i.test(m[6]) && hh === 12) hh = 0;
    return {
      yr: +m[1],
      mo: +m[2],
      dy: +m[3],
      hh,
      mm: +m[5],
      ss: 0
    };
  }
  m = /[IV][MD][GP]_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(name);
  if (m) return {
    yr: +m[1],
    mo: +m[2],
    dy: +m[3],
    hh: +m[4],
    mm: +m[5],
    ss: +m[6]
  };
  return null;
}
async function _parseExifMeta(file) {
  var out = {
    date: null,
    lat: null,
    lng: null,
    acc: null,
    heading: null,
    headingRef: null
  };
  if (!file) return out;
  var name = String(file.name || "");
  var type = String(file.type || "");
  var isVideo = /^video\//.test(type) || /\.(mov|mp4|m4v)$/i.test(name);
  var isImage = /^image\//.test(type) || /\.(jpe?g|heic|png|webp)$/i.test(name);
  if (isVideo) return _parseVideoMeta(file);
  if (!isImage) return out;
  try {
    var buf = await file.slice(0, 256 * 1024).arrayBuffer();
    var dv = new DataView(buf);
    if (dv.getUint16(0) !== 0xFFD8) return out;
    var off = 2;
    var _loop = async function () {
        if (dv.getUint8(off) !== 0xFF) return 0;
        var marker = dv.getUint16(off);
        var len = dv.getUint16(off + 2);
        if (marker === 0xFFE1 && len > 8) {
          var exifHdr = dv.getUint8(off + 4) === 0x45 && dv.getUint8(off + 5) === 0x78 && dv.getUint8(off + 6) === 0x69 && dv.getUint8(off + 7) === 0x66;
          if (!exifHdr) {
            if (!out.date) {
              var XMP_HDR = "http://ns.adobe.com/xap/1.0/";
              var isXmp = true;
              for (var i = 0; i < XMP_HDR.length; i++) {
                if (dv.getUint8(off + 4 + i) !== XMP_HDR.charCodeAt(i)) {
                  isXmp = false;
                  break;
                }
              }
              if (isXmp) {
                var xmpStart = off + 4 + XMP_HDR.length + 1;
                var xmpEnd = off + 2 + len;
                var text = "";
                for (var _i = xmpStart; _i < Math.min(xmpEnd, dv.byteLength); _i++) {
                  text += String.fromCharCode(dv.getUint8(_i));
                }
                var xmpDate = _parseXmpDateFromText(text);
                if (xmpDate) out.date = xmpDate;
              }
            }
            off += 2 + len;
            return 1;
          }
          var tiff = off + 10;
          var byteOrder = dv.getUint16(tiff);
          var little = byteOrder === 0x4949;
          var u16 = p => dv.getUint16(p, little);
          var u32 = p => dv.getUint32(p, little);
          if (u16(tiff + 2) !== 0x002A) return {
            v: out
          };
          var ifd0 = tiff + u32(tiff + 4);
          var readEntries = ifdOff => {
            var n = u16(ifdOff);
            var entries = {};
            for (var _i2 = 0; _i2 < n; _i2++) {
              var eOff = ifdOff + 2 + _i2 * 12;
              entries[u16(eOff)] = {
                type: u16(eOff + 2),
                count: u32(eOff + 4),
                valOff: eOff + 8
              };
            }
            return entries;
          };
          var ifd0Entries = readEntries(ifd0);
          var exifPtr = ifd0Entries[_EXIF_TAG_EXIF_IFD];
          if (exifPtr) {
            var exifIfd = tiff + u32(exifPtr.valOff);
            var exifEntries = readEntries(exifIfd);
            var dto = exifEntries[_EXIF_TAG_DATETIME_ORIGINAL];
            if (dto && dto.count > 0) {
              var strOff = dto.count > 4 ? tiff + u32(dto.valOff) : dto.valOff;
              var str = "";
              for (var _i3 = 0; _i3 < Math.min(dto.count - 1, 24); _i3++) {
                var c = dv.getUint8(strOff + _i3);
                if (c === 0) break;
                str += String.fromCharCode(c);
              }
              var m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(str);
              if (m) {
                var yr = +m[1],
                  mo = +m[2],
                  dy = +m[3];
                var hh = +m[4],
                  mm = +m[5],
                  ss = +m[6];
                out.date = {
                  yr,
                  mo,
                  dy,
                  hh,
                  mm,
                  ss
                };
              }
            }
          }
          var gpsPtr = ifd0Entries[_EXIF_TAG_GPS_IFD];
          if (gpsPtr) {
            var gpsIfd = tiff + u32(gpsPtr.valOff);
            var gpsEntries = readEntries(gpsIfd);
            var readRationalDeg = entry => {
              if (!entry || entry.count !== 3 || entry.type !== 5) return null;
              var off2 = tiff + u32(entry.valOff);
              var r = p => u32(p) / u32(p + 4);
              return r(off2) + r(off2 + 8) / 60 + r(off2 + 16) / 3600;
            };
            var lat = readRationalDeg(gpsEntries[_EXIF_TAG_GPS_LAT]);
            var lng = readRationalDeg(gpsEntries[_EXIF_TAG_GPS_LNG]);
            if (lat != null) {
              var refEntry = gpsEntries[_EXIF_TAG_GPS_LAT_REF];
              var refCh = refEntry ? String.fromCharCode(dv.getUint8(refEntry.valOff)) : "N";
              out.lat = refCh === "S" ? -lat : lat;
            }
            if (lng != null) {
              var _refEntry = gpsEntries[_EXIF_TAG_GPS_LNG_REF];
              var _refCh = _refEntry ? String.fromCharCode(dv.getUint8(_refEntry.valOff)) : "E";
              out.lng = _refCh === "W" ? -lng : lng;
            }
            var readRational1 = entry => {
              if (!entry || entry.count !== 1 || entry.type !== 5) return null;
              var off2 = tiff + u32(entry.valOff);
              var den = u32(off2 + 4);
              if (!den) return null;
              var v = u32(off2) / den;
              return isFinite(v) ? v : null;
            };
            var acc = readRational1(gpsEntries[_EXIF_TAG_GPS_HPOS_ERR]);
            if (acc != null && acc >= 0) out.acc = acc;
            var dir = readRational1(gpsEntries[_EXIF_TAG_GPS_IMG_DIR]);
            if (dir != null && dir >= 0 && dir <= 360) {
              out.heading = dir;
              var dRef = gpsEntries[_EXIF_TAG_GPS_IMG_DIR_REF];
              out.headingRef = dRef ? String.fromCharCode(dv.getUint8(dRef.valOff)) : "T";
            }
          }
          return {
            v: out
          };
        }
        off += 2 + len;
      },
      _ret;
    while (off + 4 < dv.byteLength) {
      _ret = await _loop();
      if (_ret === 0) break;
      if (_ret === 1) continue;
      if (_ret) return _ret.v;
    }
  } catch {}
  return out;
}
async function _parseVideoMeta(file) {
  var out = {
    date: null,
    lat: null,
    lng: null,
    acc: null,
    timestampSource: null,
    locationSource: null,
    rawUtcMs: null
  };
  if (!file) return out;
  try {
    var size = file.size;
    var slice = async (start, len) => new DataView(await file.slice(start, start + Math.min(len, size - start)).arrayBuffer());
    var pos = 0,
      moov = null;
    while (pos + 8 <= size) {
      var h = await slice(pos, 16);
      var boxSize = h.getUint32(0);
      var type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
      var hdr = 8;
      if (boxSize === 1) {
        boxSize = h.getUint32(8) * 4294967296 + h.getUint32(12);
        hdr = 16;
      } else if (boxSize === 0) {
        boxSize = size - pos;
      }
      if (boxSize < hdr) break;
      if (type === "moov") {
        moov = await slice(pos, Math.min(boxSize, 2 * 1024 * 1024));
        break;
      }
      pos += boxSize;
    }
    if (!moov) return out;
    var n = moov.byteLength;
    var typeAt = (dv, i) => String.fromCharCode(dv.getUint8(i), dv.getUint8(i + 1), dv.getUint8(i + 2), dv.getUint8(i + 3));
    var parseIso6709 = s => {
      var m = /([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(s || "");
      return m ? {
        lat: parseFloat(m[1]),
        lng: parseFloat(m[2])
      } : null;
    };
    var readAscii = (start, len) => {
      var s = "";
      for (var k = 0; k < Math.min(len, 256) && start + k < n; k++) {
        var c = moov.getUint8(start + k);
        if (!c) continue;
        if (c >= 32 && c <= 126) s += String.fromCharCode(c);
      }
      return s;
    };
    var applyMdta = ({
      keys,
      vals
    }) => {
      for (var i of Object.keys(vals)) {
        var name = keys[i],
          v = vals[i];
        if (out.lat == null && name === "com.apple.quicktime.location.ISO6709") {
          var p = parseIso6709(v);
          if (p) {
            out.lat = p.lat;
            out.lng = p.lng;
            out.locationSource = "video-mdta";
          }
        } else if (name === "com.apple.quicktime.location.accuracy.horizontal") {
          var a = parseFloat(v);
          if (isFinite(a) && a >= 0) out.acc = a;
        }
      }
    };
    var visit = (start, end, depth, parentType, scope) => {
      if (depth > 6) return;
      var pos = start;
      while (pos + 8 <= end && pos + 8 <= n) {
        var _boxSize = moov.getUint32(pos);
        var _type = typeAt(moov, pos + 4);
        var _hdr = 8;
        if (_boxSize === 1 && pos + 16 <= n) {
          _boxSize = moov.getUint32(pos + 8) * 4294967296 + moov.getUint32(pos + 12);
          _hdr = 16;
        } else if (_boxSize === 0) _boxSize = end - pos;
        if (!_boxSize || _boxSize < _hdr || pos + _boxSize > n + 1) break;
        var payload = pos + _hdr;
        var boxEnd = Math.min(n, pos + _boxSize);
        if (!out.date && _type === "mvhd" && boxEnd - payload >= 16) {
          var ver = moov.getUint8(payload);
          var secs = ver === 1 && boxEnd - payload >= 28 ? moov.getUint32(payload + 4) * 4294967296 + moov.getUint32(payload + 8) : moov.getUint32(payload + 4);
          var unixMs = (secs - 2082844800) * 1000;
          var tooFuture = unixMs > Date.now() + 366 * 24 * 3600000;
          if (secs > 2082844800 && isFinite(unixMs) && !tooFuture) {
            var d = new Date(unixMs + _festivalTzOffsetHours() * 3600000);
            out.date = {
              yr: d.getUTCFullYear(),
              mo: d.getUTCMonth() + 1,
              dy: d.getUTCDate(),
              hh: d.getUTCHours(),
              mm: d.getUTCMinutes(),
              ss: d.getUTCSeconds()
            };
            out.timestampSource = "video-mvhd";
            out.rawUtcMs = unixMs;
          }
        }
        if (out.lat == null && _type === "©xyz") {
          var p = parseIso6709(readAscii(payload, boxEnd - payload));
          if (p) {
            out.lat = p.lat;
            out.lng = p.lng;
            out.locationSource = "video-xyz";
          }
        }
        if (scope && _type === "keys" && boxEnd - payload >= 8) {
          var count = moov.getUint32(payload + 4);
          var k = payload + 8;
          for (var i = 1; i <= count && k + 8 <= boxEnd; i++) {
            var ks = moov.getUint32(k);
            if (ks < 8) break;
            scope.keys[i] = readAscii(k + 8, ks - 8);
            k += ks;
          }
        }
        if (scope && parentType === "ilst" && boxEnd - payload >= 16 && typeAt(moov, payload + 4) === "data") {
          var ds = moov.getUint32(payload);
          scope.vals[moov.getUint32(pos + 4)] = readAscii(payload + 16, Math.min(ds, boxEnd - payload) - 16);
        }
        if (["trak", "mdia", "minf", "stbl", "udta", "meta", "ilst", "moov"].includes(_type)) {
          var isoMeta = _type === "meta" && !(payload + 8 <= boxEnd && typeAt(moov, payload + 4) === "hdlr");
          var inner = _type === "meta" ? {
            keys: {},
            vals: {}
          } : scope;
          visit(isoMeta ? Math.min(boxEnd, payload + 4) : payload, boxEnd, depth + 1, _type, inner);
          if (_type === "meta") applyMdta(inner);
        }
        pos += _boxSize;
      }
    };
    visit(8, n, 0);
  } catch {}
  return out;
}
var _VGPS_MAX_BOX = 64 * 1024 * 1024;
var _VGPS_COORD_RE = /[+-]\d{1,3}\.\d{2,}[+-]\d{1,3}\.\d{2,}/;
var _VGPS_KEY_RE = /location|ISO6709|gps/i;
var _VGPS_TRACK_FORMATS = new Set(["hvc1", "hev1", "avc1", "avc3", "dvh1", "dvhe", "mp4a", "apac", "alac", "lpcm", "ipcm", "sowt", "twos", "in24", "in32", "fl32", "fl64", "Opus", "fLaC", "mebx", "tmcd"]);
var _VGPS_TIMED_KEYS = new Set(["video-orientation", "detected-face", "detected-face.bounds", "detected-face.face-id", "detected-face.roll-angle", "detected-face.yaw-angle", "live-photo-info", "com.apple.quicktime.live-photo-info", "scene-illuminance", "milli-lux", "cinematic-audio", "segment-identifier", "optical-center", "metadata.1", "uuid", "apple-maker-note.74", "apple-maker-note.97", "camera.lens_model", "camera.focal_length.35mm_equivalent", "camera.lens_irisfnumber"].map(k => "com.apple.quicktime." + k));
var _VGPS_KEEP_KEYS = new Set(["make", "model", "software", "creationdate", "full-frame-rate-playback-intent", "camera.lens_model", "camera.focal_length.35mm_equivalent", "camera.lens_irisfnumber"].map(k => "com.apple.quicktime." + k));
function _vgpsLatin1(u8, a, b) {
  var s = "";
  for (var i = a; i < b; i++) s += String.fromCharCode(u8[i]);
  return s;
}
var _VGPS_TREF_KINDS = new Set(["cdep", "cdsc", "fall", "rndr", "hint", "chap", "tmcd", "sync", "scpt", "ssrc", "vdep", "vplx", "font", "hind", "ipir", "mpod", "subt", "thmb", "auxl"]);
var _VGPS_CHILDREN = {
  moov: new Set(["mvhd", "trak", "udta", "meta", "mvex"]),
  trak: new Set(["tkhd", "edts", "mdia", "meta", "tapt", "tref", "udta", "load"]),
  edts: new Set(["elst"]),
  mdia: new Set(["mdhd", "hdlr", "minf", "elng", "udta"]),
  minf: new Set(["vmhd", "smhd", "gmhd", "nmhd", "hmhd", "sthd", "dinf", "stbl", "hdlr"]),
  stbl: new Set(["stsd", "stts", "ctts", "cslg", "stsc", "stsz", "stz2", "stco", "co64", "stss", "stsh", "stps", "sdtp", "sbgp", "sgpd"]),
  gmhd: new Set(["gmin", "text", "tmcd"]),
  tmcd: new Set(["tcmi"]),
  dinf: new Set(["dref"]),
  dref: new Set(["url ", "alis"]),
  mvex: new Set(["mehd", "trex"]),
  tapt: new Set(["clef", "prof", "enof"]),
  tref: _VGPS_TREF_KINDS
};
var _VGPS_WALK = {
  moov: 0,
  trak: 0,
  mdia: 0,
  minf: 0,
  stbl: 0,
  udta: 0,
  meta: 0,
  ilst: 0,
  edts: 0,
  gmhd: 0,
  dinf: 0,
  mvex: 0,
  tapt: 0,
  tref: 0,
  dref: 8
};
var _vgpsWalks = (type, parentType) => type in _VGPS_WALK || type === "tmcd" && parentType === "gmhd";
var _VGPS_LEAF_LEN = (type, parentType, dv, p, P, ctx) => {
  var v = P >= 1 ? dv.getUint8(p) : 0,
    n = off => P >= off + 4 ? dv.getUint32(p + off) : 0;
  if (parentType === "tref") {
    if (P % 4) return -1;
    for (var o = 0; o < P; o += 4) {
      var id = dv.getUint32(p + o);
      if (id < 1 || id > 1024) return -1;
    }
    return P;
  }
  switch (type) {
    case "mvhd":
      return v === 1 ? 112 : 100;
    case "tkhd":
      return v === 1 ? 96 : 84;
    case "mdhd":
      return v === 1 ? 36 : 24;
    case "mehd":
      return v === 1 ? 12 : 8;
    case "vmhd":
      return 12;
    case "smhd":
      return 8;
    case "nmhd":
    case "sthd":
      return 4;
    case "hmhd":
      return 20;
    case "gmin":
      return 16;
    case "text":
      return 36;
    case "load":
      return 16;
    case "trex":
      return 24;
    case "cslg":
      return v === 1 ? 44 : 24;
    case "clef":
    case "prof":
    case "enof":
      return 12;
    case "url ":
    case "alis":
      return 4;
    case "hdlr":
      return 24;
    case "elng":
      return 4;
    case "tcmi":
      return 24;
    case "elst":
      return 8 + n(4) * (v === 1 ? 20 : 12);
    case "stts":
    case "ctts":
    case "co64":
    case "stsh":
      return 8 + n(4) * 8;
    case "stss":
    case "stps":
    case "stco":
      return 8 + n(4) * 4;
    case "stsc":
      return 8 + n(4) * 12;
    case "stsz":
      ctx.samples = n(8);
      return 12 + (n(4) === 0 ? n(8) * 4 : 0);
    case "stz2":
      ctx.samples = n(8);
      return 12 + Math.ceil(n(8) * (P >= 8 ? dv.getUint8(p + 7) : 0) / 8);
    case "sdtp":
      return ctx.samples == null ? null : 4 + ctx.samples;
    case "sbgp":
      return (v === 1 ? 16 : 12) + n(v === 1 ? 12 : 8) * 8;
    case "sgpd":
      {
        if (v !== 1 && v !== 2) return null;
        var hdr = v === 1 ? 16 : 20,
          dl = n(8),
          count = n(hdr - 4);
        if (dl) return hdr + count * dl;
        if (v !== 1) return null;
        var at = hdr;
        for (var i = 0; i < count; i++) {
          if (at + 4 > P) return P + 1;
          at += 4 + dv.getUint32(p + at);
        }
        return at;
      }
    default:
      return null;
  }
};
function _stripVideoGpsRegion(u8, layout = null) {
  var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  var len = u8.byteLength;
  var type4 = i => _vgpsLatin1(u8, i, i + 4);
  var zero = (a, b) => {
    for (var i = a; i < b && i < len; i++) u8[i] = 0;
  };
  var toFree = pos => {
    u8[pos + 4] = 0x66;
    u8[pos + 5] = 0x72;
    u8[pos + 6] = 0x65;
    u8[pos + 7] = 0x65;
  };
  var n = 0,
    refuse = null,
    curTrak = null;
  var visit = (start, end, depth, parentType, scope) => {
    if (depth > 8 || refuse) return;
    var pos = start;
    var scopeCtx = {};
    if (parentType === "stbl") {
      for (var q = start; q + 20 <= end;) {
        var qs = dv.getUint32(q);
        if (qs < 8 || q + qs > end) break;
        if (qs >= 20 && (type4(q + 4) === "stsz" || type4(q + 4) === "stz2")) scopeCtx.samples = dv.getUint32(q + 16);
        q += qs;
      }
    }
    while (pos + 8 <= end) {
      var size = dv.getUint32(pos);
      var type = type4(pos + 4);
      var hdr = 8;
      if (size === 1) {
        if (pos + 16 > end) break;
        size = dv.getUint32(pos + 8) * 4294967296 + dv.getUint32(pos + 12);
        hdr = 16;
      } else if (size === 0) size = end - pos;
      if (size < hdr || pos + size > end) {
        refuse = "malformed box";
        return;
      }
      var payload = pos + hdr,
        boxEnd = pos + size;
      if (type === "free" || type === "skip") {
        zero(payload, boxEnd);
      } else if (depth === 0 && !["moov", "meta", "ftyp", "wide", "pdin"].includes(type)) {
        zero(payload, boxEnd);
        toFree(pos);
        n++;
      } else if (type === "uuid" || type === "XMP_" || parentType === "meta" && !["hdlr", "keys", "ilst"].includes(type)) {
        zero(payload, boxEnd);
        toFree(pos);
        n++;
      } else if (type === "mvex") {
        refuse = "fragmented movie";
        return;
      } else if (_VGPS_CHILDREN[parentType] && !_VGPS_CHILDREN[parentType].has(type)) {
        zero(payload, boxEnd);
        toFree(pos);
        n++;
      } else if (_VGPS_CHILDREN[parentType] && type !== "stsd" && !_vgpsWalks(type, parentType)) {
        var want = _VGPS_LEAF_LEN(type, parentType, dv, payload, boxEnd - payload, scopeCtx);
        if (want === null) {
          zero(payload, boxEnd);
          toFree(pos);
          n++;
        } else if (want < 0 || want > boxEnd - payload) {
          refuse = "unreadable " + type;
          return;
        } else if (want < boxEnd - payload) {
          zero(payload + want, boxEnd);
          n++;
        }
        if (layout && curTrak && /^(stsz|stz2|stsc|stco|co64)$/.test(type)) {
          if (curTrak[type]) {
            refuse = "duplicate " + type;
            return;
          }
          curTrak[type] = payload;
        }
      } else if (type === "©xyz" || type === "loci" || parentType === "udta" && type !== "meta") {
        zero(payload, boxEnd);
        toFree(pos);
        n++;
      } else if (type === "stsd") {
        if (_VGPS_KEY_RE.test(_vgpsLatin1(u8, payload, boxEnd))) {
          refuse = "timed location track";
          return;
        }
        var count = boxEnd - payload >= 8 ? dv.getUint32(payload + 4) : 0;
        var e = payload + 8;
        for (var k = 0; k < count; k++) {
          var es = e + 8 <= boxEnd ? dv.getUint32(e) : 0;
          if (es < 8 || e + es > boxEnd) {
            refuse = "unreadable sample table";
            return;
          }
          var fmt = type4(e + 4);
          if (!_VGPS_TRACK_FORMATS.has(fmt)) {
            refuse = "unknown track format " + JSON.stringify(fmt);
            return;
          }
          var fam = _VGPS_NAL_FAMILY[fmt];
          if (layout && curTrak) (curTrak.fmts ||= []).push(fmt);
          if (fam) {
            var cfg = fam === "avc" ? "avcC" : "hvcC";
            var c = e + 86,
              L = 0;
            while (c + 8 <= e + es) {
              var cs = dv.getUint32(c);
              if (cs < 8 || c + cs > e + es) break;
              if (type4(c + 4) === cfg) {
                var r = _vgpsConfig(fam, u8, c + 8, c + cs);
                if (r.refuse) {
                  refuse = r.refuse;
                  return;
                }
                L = r.L;
              }
              c += cs;
            }
            if (L !== 1 && L !== 2 && L !== 4) {
              refuse = "unreadable " + cfg;
              return;
            }
            if (layout && curTrak) {
              if (curTrak.fam && curTrak.fam !== fam || curTrak.lenSize && curTrak.lenSize !== L) {
                refuse = "mixed video sample entries";
                return;
              }
              curTrak.fam = fam;
              curTrak.lenSize = L;
            }
          }
          if (fmt === "mebx") {
            var body = _vgpsLatin1(u8, e, e + es);
            var at = body.indexOf("keyd"),
              seen = 0;
            while (at >= 4) {
              var ks = dv.getUint32(e + at - 4);
              if (ks < 12 || at - 4 + ks > es) {
                refuse = "unreadable timed key";
                return;
              }
              var name = body.slice(at + 8, at - 4 + ks);
              if (!_VGPS_TIMED_KEYS.has(name)) {
                refuse = "timed key " + JSON.stringify(name);
                return;
              }
              seen++;
              at = body.indexOf("keyd", at - 4 + ks);
            }
            if (!seen && body.includes("keys")) {
              refuse = "unreadable timed keys";
              return;
            }
          }
          e += es;
        }
      } else if (scope && type === "keys" && boxEnd - payload >= 8) {
        if (scope.keysSeen++) {
          refuse = "duplicate keys table";
          return;
        }
        var _count = dv.getUint32(payload + 4);
        var _k = payload + 8;
        for (var i = 1; i <= _count && _k + 8 <= boxEnd; i++) {
          var _ks = dv.getUint32(_k);
          if (_ks < 8 || _k + _ks > boxEnd) break;
          var _name = _vgpsLatin1(u8, _k + 8, _k + _ks);
          if (_VGPS_KEEP_KEYS.has(_name)) scope.keep.add(i);
          if (_VGPS_KEY_RE.test(_name)) {
            scope.hit.add(i);
            var red = "plursky.redacted.".padEnd(_ks - 8, "x").slice(0, _ks - 8);
            for (var j = 0; j < _ks - 8; j++) u8[_k + 8 + j] = red.charCodeAt(j);
          }
          _k += _ks;
        }
      } else if (scope && parentType === "ilst") {
        scope.items.push({
          idx: dv.getUint32(pos + 4),
          payload,
          boxEnd
        });
      }
      if (_vgpsWalks(type, parentType)) {
        var isoMeta = type === "meta" && !(payload + 8 <= boxEnd && type4(payload + 4) === "hdlr");
        var inner = type === "meta" ? {
          hit: new Set(),
          keep: new Set(),
          items: [],
          keysSeen: 0
        } : scope;
        var skip = isoMeta ? 4 : type === "tmcd" ? 0 : _VGPS_WALK[type] || 0;
        var prevTrak = curTrak;
        if (type === "trak" && layout) {
          curTrak = {};
          layout.push(curTrak);
        }
        visit(Math.min(boxEnd, payload + skip), boxEnd, depth + 1, type, inner);
        curTrak = prevTrak;
        if (type === "meta") {
          for (var it of inner.items) if (!inner.keep.has(it.idx) || inner.hit.has(it.idx)) {
            var dataHdr = it.payload + 16 <= it.boxEnd && type4(it.payload + 4) === "data" ? 16 : 0;
            zero(it.payload + dataHdr, it.boxEnd);
            n++;
          }
        }
      }
      pos = boxEnd;
    }
  };
  visit(0, len, 0, null, null);
  return refuse ? {
    refuse
  } : {
    n
  };
}
var _VGPS_NAL_FAMILY = {
  avc1: "avc",
  avc3: "avc",
  hvc1: "hevc",
  hev1: "hevc",
  dvh1: "hevc",
  dvhe: "hevc"
};
var _VGPS_HVCC_SEI = {
  137: 24,
  144: 4,
  147: 1,
  148: 8
};
function _vgpsFixedSei(b, p, len) {
  if (len < 3 || (b[p] >> 1 & 0x3f) !== 39) return false;
  var i = p + 2;
  var z = p + len;
  while (i < z) {
    if (i === z - 1 && b[i] === 0x80) return true;
    var t = 0,
      s = 0;
    while (i < z && b[i] === 0xff) {
      t += 255;
      i++;
    }
    if (i >= z) return false;
    t += b[i++];
    while (i < z && b[i] === 0xff) {
      s += 255;
      i++;
    }
    if (i >= z) return false;
    s += b[i++];
    if (_VGPS_HVCC_SEI[t] !== s || i + s > z) return false;
    for (var k = i; k < i + s - 2; k++) if (b[k] === 0 && b[k + 1] === 0 && b[k + 2] === 3) return false;
    i += s;
  }
  return false;
}
var _VGPS_PS_MAX = 128;
function _vgpsConfig(fam, u8, p, z) {
  var ps = (t, at, len) => len >= 1 && len <= _VGPS_PS_MAX && at + len <= z && !(u8[at] & 0x80) && (fam === "avc" ? (u8[at] & 0x1f) === t : (u8[at] >> 1 & 0x3f) === t);
  if (fam === "avc") {
    if (z - p < 7) return {
      refuse: "unreadable avcC"
    };
    var _L = (u8[p + 4] & 3) + 1;
    var _a = p + 6;
    var lists = [[u8[p + 5] & 0x1f, 7]];
    var walk = (n, t) => {
      for (var i = 0; i < n; i++) {
        if (_a + 2 > z) return false;
        var len = u8[_a] << 8 | u8[_a + 1];
        if (!ps(t, _a + 2, len)) return false;
        _a += 2 + len;
      }
      return true;
    };
    if (!walk(u8[p + 5] & 0x1f, 7)) return {
      refuse: "avcC carries a NAL it cannot vouch for"
    };
    if (_a + 1 > z) return {
      refuse: "unreadable avcC"
    };
    var npps = u8[_a++];
    if (!walk(npps, 8)) return {
      refuse: "avcC carries a NAL it cannot vouch for"
    };
    if (_a < z && [100, 110, 122, 144].includes(u8[p + 1])) {
      if (_a + 4 > z) return {
        refuse: "unreadable avcC"
      };
      _a += 3;
      var next = u8[_a++];
      if (!walk(next, 13)) return {
        refuse: "avcC carries a NAL it cannot vouch for"
      };
    }
    if (_a !== z) return {
      refuse: "avcC has trailing bytes"
    };
    return {
      L: _L
    };
  }
  if (z - p < 23) return {
    refuse: "unreadable hvcC"
  };
  var L = (u8[p + 21] & 3) + 1;
  var a = p + 23;
  for (var k = 0, na = u8[p + 22]; k < na; k++) {
    if (a + 3 > z) return {
      refuse: "unreadable hvcC"
    };
    var nt = u8[a] & 0x3f,
      nn = u8[a + 1] << 8 | u8[a + 2];
    a += 3;
    for (var q = 0; q < nn; q++) {
      if (a + 2 > z) return {
        refuse: "unreadable hvcC"
      };
      var len = u8[a] << 8 | u8[a + 1],
        at = a + 2;
      if (at + len > z) return {
        refuse: "unreadable hvcC"
      };
      if (nt === 39 ? !_vgpsFixedSei(u8, at, len) : !(nt >= 32 && nt <= 34 && ps(nt, at, len))) return {
        refuse: "hvcC carries an SEI it cannot vouch for"
      };
      a = at + len;
    }
  }
  if (a !== z) return {
    refuse: "hvcC has trailing bytes"
  };
  return {
    L
  };
}
function _vgpsNalAction(fam, b, q, len) {
  var h = b[q];
  if (h & 0x80) return "refuse";
  if (fam === "avc") {
    var _t = h & 0x1f;
    if (_t >= 1 && _t <= 5) return "keep";
    if (_t === 7 || _t === 8) return len <= _VGPS_PS_MAX ? "keep" : "refuse";
    if (_t === 9) return len === 2 ? "keep" : "refuse";
    if (_t === 10 || _t === 11) return len === 1 ? "keep" : "refuse";
    if (_t === 6 || _t === 12) return "fill";
    return "refuse";
  }
  if (len < 2) return "refuse";
  var t = h >> 1 & 0x3f;
  if (t <= 9 || t >= 16 && t <= 21) return "keep";
  if (t >= 32 && t <= 34) return len <= _VGPS_PS_MAX ? "keep" : "refuse";
  if (t === 35) return len === 3 ? "keep" : "refuse";
  if (t === 36 || t === 37) return len === 2 ? "keep" : "refuse";
  if (t >= 38 && t <= 40) return "fill";
  if (t === 62) return "fill";
  return "refuse";
}
function _vgpsFiller(fam, b, q, len) {
  var out = new Uint8Array(len).fill(0xff);
  var hl = fam === "avc" ? 1 : 2;
  out[0] = fam === "avc" ? 0x0c : 0x4c;
  if (fam === "hevc") out[1] = b[q + 1] & 7 || 1;
  if (len > hl) out[len - 1] = 0x80;
  return out;
}
function _vgpsSamples(u8, layout) {
  var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  var out = [];
  var _loop2 = function (t) {
      if (!t.fmts || !t.fmts.length) return {
        v: {
          refuse: "track without a sample description"
        }
      };
      if (t.fmts.some(f => _VGPS_NAL_FAMILY[f] !== undefined && _VGPS_NAL_FAMILY[f] !== t.fam)) return {
        v: {
          refuse: "mixed video sample entries"
        }
      };
      var co = t.stco != null ? t.stco : t.co64;
      if (t.stsz == null && t.stz2 == null || t.stsc == null || co == null || t.stco != null && t.co64 != null) return {
        v: {
          refuse: "track without sample tables"
        }
      };
      var sizes;
      if (t.stsz != null) {
        var fixed = dv.getUint32(t.stsz + 4),
          cnt = dv.getUint32(t.stsz + 8);
        sizes = i => fixed || dv.getUint32(t.stsz + 12 + i * 4);
        sizes.count = cnt;
      } else {
        var fs = u8[t.stz2 + 7],
          _cnt = dv.getUint32(t.stz2 + 8),
          base = t.stz2 + 12;
        if (fs !== 4 && fs !== 8 && fs !== 16) return {
          v: {
            refuse: "unreadable stz2"
          }
        };
        sizes = i => fs === 16 ? dv.getUint16(base + i * 2) : fs === 8 ? u8[base + i] : u8[base + (i >> 1)] >> (i & 1 ? 0 : 4) & 15;
        sizes.count = _cnt;
      }
      var nChunks = dv.getUint32(co + 4),
        wide = t.co64 != null;
      var chunkOff = c => wide ? dv.getUint32(co + 8 + c * 8) * 4294967296 + dv.getUint32(co + 12 + c * 8) : dv.getUint32(co + 8 + c * 4);
      var runs = dv.getUint32(t.stsc + 4);
      var i = 0;
      for (var r = 0; r < runs; r++) {
        var first = dv.getUint32(t.stsc + 8 + r * 12),
          spc = dv.getUint32(t.stsc + 12 + r * 12);
        var next = r + 1 < runs ? dv.getUint32(t.stsc + 8 + (r + 1) * 12) : nChunks + 1;
        if (first < 1 || next <= first || next > nChunks + 1) return {
          v: {
            refuse: "unreadable stsc"
          }
        };
        for (var c = first; c < next; c++) {
          var off = chunkOff(c - 1);
          for (var k = 0; k < spc; k++, i++) {
            if (i >= sizes.count) return {
              v: {
                refuse: "sample tables disagree"
              }
            };
            var sz = sizes(i);
            out.push({
              off,
              size: sz,
              fam: t.fam || null,
              L: t.lenSize || 0
            });
            off += sz;
          }
        }
      }
      if (i !== sizes.count) return {
        v: {
          refuse: "sample tables disagree"
        }
      };
    },
    _ret2;
  for (var t of layout) {
    _ret2 = _loop2(t);
    if (_ret2) return _ret2.v;
  }
  out.sort((x, y) => x.off - y.off);
  return {
    samples: out
  };
}
async function _vgpsNalPatches(blob, samples, start, end) {
  var patches = [];
  var buf = null,
    bs = 0;
  for (var s of samples) {
    if (!buf || s.off < bs || s.off + s.size > bs + buf.length) {
      bs = s.off;
      buf = new Uint8Array(await blob.slice(bs, Math.min(end, Math.max(s.off + s.size, s.off + _VGPS_WIN))).arrayBuffer());
      if (s.off + s.size > bs + buf.length) return {
        refuse: "sample past mdat"
      };
    }
    var z = s.off - bs + s.size;
    var q = s.off - bs;
    while (q < z) {
      if (q + s.L > z) return {
        refuse: "unparseable video sample"
      };
      var len = 0;
      for (var k = 0; k < s.L; k++) len = len * 256 + buf[q + k];
      q += s.L;
      if (len < 1 || q + len > z) return {
        refuse: "unparseable video sample"
      };
      var act = _vgpsNalAction(s.fam, buf, q, len);
      if (act === "refuse") return {
        refuse: "video NAL type " + (s.fam === "avc" ? buf[q] & 0x1f : buf[q] >> 1 & 0x3f)
      };
      if (act === "fill") {
        var f = _vgpsFiller(s.fam, buf, q, len);
        var same = true;
        for (var _k2 = 0; _k2 < len && same; _k2++) same = f[_k2] === buf[q + _k2];
        if (!same) patches.push({
          off: bs + q,
          bytes: f
        });
      }
      q += len;
    }
  }
  return {
    patches
  };
}
var _VGPS_WIN = 8 * 1024 * 1024,
  _VGPS_OVERLAP = 4096;
var _VGPS_ISO_RE = /[+-]\d{1,3}\.\d{2,}[+-]\d{1,3}\.\d{2,}(?:[+-]\d+(?:\.\d+)?)?\/?/g;
async function _vgpsScanMedia(blob, start, end, init = []) {
  var dec = new TextDecoder("windows-1252");
  var patches = init.slice();
  var inPatch = o => patches.find(p => o >= p.off && o < p.off + p.bytes.length);
  var _loop3 = async function (w) {
      var b = Math.min(end, w + _VGPS_WIN + _VGPS_OVERLAP);
      var u8 = new Uint8Array(await blob.slice(w, b).arrayBuffer());
      var s = dec.decode(u8);
      var own = i => w + i < Math.min(end, w + _VGPS_WIN);
      var metaRe = /meta/g;
      var m;
      while (m = metaRe.exec(s)) {
        var _p = m.index - 4;
        if (_p < 0 || !own(_p) || inPatch(w + _p)) continue;
        var sz = new DataView(u8.buffer, u8.byteOffset + _p, 4).getUint32(0);
        if (sz < 24 || sz > 1024 * 1024 || w + _p + sz > end) continue;
        if (s.slice(_p + 12, _p + 16) !== "hdlr" && s.slice(_p + 16, _p + 20) !== "hdlr") continue;
        var reg = new Uint8Array(await blob.slice(w + _p, w + _p + sz).arrayBuffer());
        var r = _stripVideoGpsRegion(reg);
        if (r.refuse) return {
          v: {
            refuse: "embedded meta: " + r.refuse
          }
        };
        if (r.n) patches.push({
          off: w + _p,
          bytes: reg
        });
      }
      _VGPS_ISO_RE.lastIndex = 0;
      while (m = _VGPS_ISO_RE.exec(s)) {
        if (!own(m.index)) continue;
        var abs = w + m.index,
          host = inPatch(abs);
        if (host) {
          host.bytes.fill(0, abs - host.off, Math.min(host.bytes.length, abs - host.off + m[0].length));
        } else patches.push({
          off: abs,
          bytes: new Uint8Array(m[0].length)
        });
      }
      var chk = u8.slice();
      for (var _p2 of patches) {
        var a = Math.max(_p2.off, w),
          z = Math.min(_p2.off + _p2.bytes.length, b);
        if (a < z) chk.set(_p2.bytes.subarray(a - _p2.off, z - _p2.off), a - w);
      }
      var cs = dec.decode(chk);
      if (new RegExp(_VGPS_ISO_RE.source).test(cs) || /location\.ISO6709|location\.accuracy/.test(cs)) return {
        v: {
          refuse: "coordinate left in media"
        }
      };
    },
    _ret3;
  for (var w = start; w < end; w += _VGPS_WIN) {
    _ret3 = await _loop3(w);
    if (_ret3) return _ret3.v;
  }
  patches.sort((x, y) => x.off - y.off);
  var parts = [];
  var at = start;
  for (var p of patches) {
    if (p.off < at) return {
      refuse: "overlapping patches"
    };
    if (p.off > at) parts.push(blob.slice(at, p.off));
    parts.push(p.bytes);
    at = p.off + p.bytes.length;
  }
  if (at < end) parts.push(blob.slice(at, end));
  return {
    parts,
    n: patches.length
  };
}
async function _stripVideoGps(blob) {
  try {
    if (!blob || typeof blob.slice !== "function") return null;
    var size = blob.size;
    var head = async pos => new DataView(await blob.slice(pos, Math.min(size, pos + 16)).arrayBuffer());
    var boxes = [];
    for (var pos = 0; pos < size;) {
      if (pos + 8 > size) return null;
      var h = await head(pos);
      var boxSize = h.getUint32(0),
        hdr = 8;
      var type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
      if (boxSize === 1) {
        if (h.byteLength < 16) return null;
        boxSize = h.getUint32(8) * 4294967296 + h.getUint32(12);
        hdr = 16;
      } else if (boxSize === 0) boxSize = size - pos;
      if (boxSize < hdr || pos + boxSize > size) return null;
      if (["moof", "mfra", "sidx", "styp", "ssix"].includes(type)) return null;
      boxes.push({
        pos,
        boxSize,
        hdr,
        type
      });
      pos += boxSize;
    }
    if (boxes.filter(b => b.type === "moov").length !== 1) return null;
    var done = new Map();
    var redacted = 0,
      samples = [];
    for (var b of boxes) {
      if (b.type === "mdat") continue;
      if (b.boxSize > _VGPS_MAX_BOX) return null;
      var u8 = new Uint8Array(await blob.slice(b.pos, b.pos + b.boxSize).arrayBuffer());
      var layout = b.type === "moov" ? [] : null;
      var r = _stripVideoGpsRegion(u8, layout);
      if (r.refuse) {
        console.warn("[backup] video GPS strip refused:", r.refuse);
        return null;
      }
      redacted += r.n;
      var s = _vgpsLatin1(u8, 0, u8.byteLength);
      if (_VGPS_COORD_RE.test(s) || /ISO6709/.test(s)) {
        console.warn("[backup] video GPS strip: coordinate left in", b.type);
        return null;
      }
      if (layout) {
        var v = _vgpsSamples(u8, layout);
        if (v.refuse) {
          console.warn("[backup] video GPS strip refused:", v.refuse);
          return null;
        }
        samples = v.samples;
      }
      done.set(b, u8);
    }
    var parts = [];
    var covered = 0;
    var _loop4 = async function () {
        if (_b.type !== "mdat") {
          parts.push(done.get(_b));
          return 0;
        }
        var a = _b.pos + _b.hdr,
          z = _b.pos + _b.boxSize;
        var mine = samples.filter(s => s.off >= a && s.off + s.size <= z);
        covered += mine.length;
        var np = await _vgpsNalPatches(blob, mine.filter(s => s.fam), a, z);
        if (np.refuse) {
          console.warn("[backup] video GPS strip refused:", np.refuse);
          return {
            v: null
          };
        }
        var at = a,
          gap = 0;
        var gaps = [];
        for (var _s of mine) {
          if (_s.off > at) {
            gaps.push({
              off: at,
              bytes: new Uint8Array(_s.off - at)
            });
            gap += _s.off - at;
          }
          at = Math.max(at, _s.off + _s.size);
        }
        if (at < z) {
          gaps.push({
            off: at,
            bytes: new Uint8Array(z - at)
          });
          gap += z - at;
        }
        if (gap > _VGPS_MAX_BOX) {
          console.warn("[backup] video GPS strip refused: too much unreferenced media");
          return {
            v: null
          };
        }
        parts.push(blob.slice(_b.pos, a));
        var r = await _vgpsScanMedia(blob, a, z, np.patches.concat(gaps));
        if (r.refuse) {
          console.warn("[backup] video GPS strip refused:", r.refuse);
          return {
            v: null
          };
        }
        parts.push(...r.parts);
        redacted += r.n;
      },
      _ret4;
    for (var _b of boxes) {
      _ret4 = await _loop4();
      if (_ret4 === 0) continue;
      if (_ret4) return _ret4.v;
    }
    if (covered !== samples.length) {
      console.warn("[backup] video GPS strip refused: samples outside mdat");
      return null;
    }
    var out = new Blob(parts, {
      type: blob.type || "video/quicktime"
    });
    if (out.size !== size) return null;
    return {
      blob: out,
      redacted
    };
  } catch (e) {
    console.warn("[backup] video GPS strip failed:", e && e.message);
    return null;
  }
}
function _festivalTzOffsetHours(cfg) {
  var day1 = (cfg || window.FESTIVAL_CONFIG)?.dayDates?.[1];
  if (!day1) return -7;
  return -new Date(day1.midnightUtc).getUTCHours();
}
function _photoEpochUtc(date, cfg) {
  var offset = _festivalTzOffsetHours(cfg);
  return Date.UTC(date.yr, date.mo - 1, date.dy, date.hh, date.mm, date.ss || 0) - offset * 3600000;
}
function _wallClockFromUtc(utcMs, cfg) {
  var d = new Date(utcMs + _festivalTzOffsetHours(cfg) * 3600000);
  return {
    yr: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    dy: d.getUTCDate(),
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
    ss: d.getUTCSeconds()
  };
}
function _photoFestivalNight(date, cfgIn, utcMs) {
  var r = _photoFestivalNightWeekend(date, cfgIn, utcMs);
  return r ? r.night : null;
}
function _photoFestivalNightWeekend(date, cfgIn, utcMs) {
  var cfg = cfgIn || window.FESTIVAL_CONFIG;
  if (!cfg?.dayDates) return null;
  if (utcMs == null && !date) return null;
  var photoMs = utcMs != null ? utcMs : _photoEpochUtc(date, cfg);
  for (var {
    weekend,
    shift
  } of festivalWeekendShifts(cfg)) {
    for (var n of Object.keys(cfg.dayDates).map(Number)) {
      var dm = cfg.dayDates[n];
      if (!dm) continue;
      var midnight = dm.midnightUtc + shift;
      var startMs = midnight + 11 * 3600000;
      var endMs = midnight + 30 * 3600000;
      if (photoMs >= startMs - 30 * 60000 && photoMs <= endMs + 30 * 60000) return {
        night: n,
        weekend,
        shift
      };
    }
  }
  return null;
}
function _activeDataSet() {
  return {
    id: window.FESTIVAL_CONFIG?.id || null,
    config: window.FESTIVAL_CONFIG || {},
    artists: window.ARTISTS || [],
    amenities: window.AMENITIES || []
  };
}
function _allDataSets() {
  var sets = window._DATA_SETS;
  if (!sets) return [_activeDataSet()];
  var reg = window.FESTIVALS_REGISTRY || [];
  var activeId = window.FESTIVAL_CONFIG?.id || null;
  var usable = id => id === activeId || !!reg.find(f => f?.config?.id === id && f.available);
  return Object.keys(sets).filter(usable).map(id => ({
    id,
    config: sets[id]?.config || {},
    artists: sets[id]?.artists || [],
    amenities: sets[id]?.amenities || []
  }));
}
function _nearSiteMeters(cfg) {
  return Math.max((cfg?.gps?.onSiteRadiusMi || 0.4) * 1609.34 * 5, 15000);
}
function _festivalSiteMeters(cfg, lat, lng) {
  var g = cfg?.gps;
  if (!g || g.lat == null || g.lng == null) return null;
  return _haversineMeters(lat, lng, g.lat, g.lng);
}
var _OFF_VENUE_MARGIN_M = 500;
function _offVenueMeters(cfg, lat, lng, acc) {
  var g = cfg?.gps;
  if (lat == null || lng == null || !g || g.lat == null || g.lng == null || !(g.onSiteRadiusMi > 0)) return null;
  var err = acc != null && isFinite(acc) && acc >= 0 ? acc : _GPS_STAGE_MAX_ACC_M;
  var past = _haversineMeters(lat, lng, g.lat, g.lng) - err - g.onSiteRadiusMi * 1609.34;
  return past > _OFF_VENUE_MARGIN_M ? Math.round(past) : null;
}
function _resolveFestivalForPhoto(meta) {
  var active = _activeDataSet();
  var asActive = why => ({
    ...active,
    night: null,
    siteMeters: null,
    resolvedBy: why
  });
  if (!meta?.date && meta?.rawUtcMs == null) return asActive("active_no_date");
  var utcMs = meta.rawUtcMs != null ? meta.rawUtcMs : null;
  var cands = _allDataSets().map(ds => ({
    ds,
    night: _photoFestivalNight(meta.date, ds.config, utcMs),
    meters: null
  })).filter(c => c.night != null);
  if (!cands.length) return asActive("active_no_time_match");
  var resolvedBy = "time";
  var {
    lat,
    lng
  } = meta;
  if (cands.length > 1 && lat != null && lng != null) {
    for (var c of cands) c.meters = _festivalSiteMeters(c.ds.config, lat, lng);
    var near = cands.filter(c => c.meters != null && c.meters <= _nearSiteMeters(c.ds.config));
    if (near.length) {
      cands = near;
      resolvedBy = "time+geo";
    }
    if (cands.length > 1) {
      var ranked = cands.filter(c => c.meters != null).sort((a, b) => a.meters - b.meters);
      if (ranked.length) {
        cands = [ranked[0]];
        resolvedBy = "time+geo_nearest";
      }
    }
  }
  var win = cands[0];
  if (cands.length > 1) {
    win = cands.find(c => c.ds.id === active.id) || cands[0];
    resolvedBy = "time_tie";
  }
  return {
    ...win.ds,
    night: win.night,
    siteMeters: win.meters,
    resolvedBy
  };
}
function _someFestivalClaimsCaptureTime(date, utcMs) {
  if (!date && utcMs == null) return false;
  var sets = window._DATA_SETS;
  if (!sets) return _photoFestivalNight(date, null, utcMs) != null;
  for (var id of Object.keys(sets)) {
    var cfg = sets[id]?.config;
    if (!cfg?.dayDates) continue;
    if (_photoFestivalNight(date, cfg, utcMs) != null) return true;
  }
  return false;
}
var _AMENITY_LABEL_NEEDS_GEOMETRY = new Set(["acl-2026"]);
function _matchNearestLocation(lat, lng, ds) {
  var set = ds || _activeDataSet();
  var amenities = set.amenities || [];
  if (!amenities.length) return null;
  var cfg = set.config || {};
  var fid = set.id || cfg.id;
  if (_AMENITY_LABEL_NEEDS_GEOMETRY.has(fid)) {
    var verified = typeof geometryVerifiedFor === "function" && geometryVerifiedFor(fid);
    if (!verified) return null;
  }
  var isActive = !set.id || set.id === window.FESTIVAL_CONFIG?.id;
  var mapToGps = isActive ? window.mapToGps : null;
  var hasAffine = !!(isActive && cfg.gpsAnchors?.length >= 3);
  var amenityToGps = am => {
    if (hasAffine && mapToGps) return mapToGps(am.x, am.y);
    if (!cfg.gps) return null;
    var scale = (cfg.gps.onSiteRadiusMi || 0.4) * 1609.34 / 50;
    var mPerDegLat = 111320;
    var mPerDegLng = 111320 * Math.cos(cfg.gps.lat * Math.PI / 180);
    return {
      lat: cfg.gps.lat + (am.y - 50) * scale / mPerDegLat,
      lng: cfg.gps.lng + (am.x - 50) * scale / mPerDegLng
    };
  };
  var best = null,
    bestDist = Infinity;
  for (var am of amenities) {
    var gps = amenityToGps(am);
    if (!gps) continue;
    var d = _haversineMeters(lat, lng, gps.lat, gps.lng);
    if (d < bestDist) {
      bestDist = d;
      best = am;
    }
  }
  if (!best || bestDist > 200) return null;
  var ICONS = {
    water: "💧",
    food: "🍔",
    med: "🏥",
    toilet: "🚻",
    art: "🎨",
    info: "ℹ️",
    charge: "🔋",
    locker: "🔐"
  };
  return {
    label: best.label,
    type: best.type,
    icon: ICONS[best.type] || "📍",
    distMeters: Math.round(bestDist)
  };
}
var _GPS_STAGE_MAX_ACC_M = 200;
function _allProgrammedStagesAnchored(artists, night, anchors) {
  var anchored = new Set(anchors.map(a => a.stageId));
  return (artists || []).every(a => a.day !== night || anchored.has(a.stage));
}
function _matchArtistForPhoto({
  date,
  lat,
  lng,
  rawUtcMs,
  acc
}, savedIds, attendedIds, ds) {
  if (!date && rawUtcMs == null) return {
    artistId: null,
    night: null,
    festivalId: null,
    reason: "no_date"
  };
  var set = ds || _resolveFestivalForPhoto({
    date,
    lat,
    lng,
    rawUtcMs
  });
  var cfg = set.config || {};
  var festivalId = set.id || null;
  var resolvedBy = set.resolvedBy || "explicit";
  var gpsUsableForStage = acc == null || acc <= _GPS_STAGE_MAX_ACC_M;
  var sLat = gpsUsableForStage ? lat : null;
  var sLng = gpsUsableForStage ? lng : null;
  var gpsRejected = !gpsUsableForStage && lat != null;
  var localDate = rawUtcMs != null ? _wallClockFromUtc(rawUtcMs, cfg) : date;
  var nw = _photoFestivalNightWeekend(localDate, cfg, rawUtcMs);
  if (!nw) return {
    localDate,
    gpsRejected,
    artistId: null,
    night: null,
    festivalId,
    resolvedBy,
    reason: "outside_festival_window"
  };
  var night = nw.night;
  var artists = (set.artists || []).filter(a => actPlaysWeekend(a, nw.weekend));
  var photoMs = _photoEpochUtc(date, cfg);
  var setWindow = a => {
    var dm = cfg.dayDates?.[a.day];
    if (!dm) return null;
    var midnight = dm.midnightUtc + nw.shift;
    var [sh, sm] = a.start.split(":").map(Number);
    var [eh, em] = a.end.split(":").map(Number);
    return {
      localDate,
      gpsRejected,
      startMs: midnight + ((sh < 8 ? sh + 24 : sh) * 60 + sm) * 60000,
      endMs: midnight + ((eh < 8 ? eh + 24 : eh) * 60 + em) * 60000
    };
  };
  var attendedSet = new Set(attendedIds || []);
  var savedSet = new Set(savedIds || []);
  var priorIds = [...new Set([...(attendedIds || []), ...(savedIds || [])])];
  var stageAnchorsAll = resolvedStageAnchors(cfg);
  var fixGate = lat != null && lng != null ? stageFixGate(stageAnchorsAll, {
    lat,
    lng,
    accuracy: acc
  }, null, STAGE_FIX_PHOTO) : {
    status: "none"
  };
  var trustedStage = fixGate.status === "trusted" ? fixGate.stageId : null;
  var gpsGate = fixGate.status === "none" ? undefined : {
    status: fixGate.status,
    stageId: trustedStage,
    distM: fixGate.distM != null ? Math.round(fixGate.distM) : null,
    marginM: fixGate.marginM != null ? Math.round(fixGate.marginM) : null
  };
  var playingIn = a => {
    var w = setWindow(a);
    return !!w && photoMs >= w.startMs - 5 * 60000 && photoMs <= w.endMs + 10 * 60000;
  };
  var playingNow = artists.filter(playingIn).sort((x, y) => setWindow(x).startMs - setWindow(y).startMs || String(x.id).localeCompare(String(y.id)));
  if (trustedStage) {
    var here = playingNow.filter(a => a.stage === trustedStage);
    if (here.length) {
      var edge = a => {
        var w = setWindow(a);
        return photoMs < w.startMs ? w.startMs - photoMs : photoMs > w.endMs ? photoMs - w.endMs : 0;
      };
      var act = here.slice().sort((x, y) => edge(x) - edge(y))[0];
      var anchor = stageAnchorsAll.find(g => g.stageId === trustedStage);
      var surveyGrade = !!anchor && (anchor.anchorSource === "osm" || anchor.anchorSource === "crowd");
      var unpinned = playingNow.some(a => a.id !== act.id && !stageAnchorsAll.some(g => g.stageId === a.stage));
      var priorPlaying = priorIds.filter(id => id !== act.id && playingNow.some(a => a.id === id));
      var ambiguous = !surveyGrade || unpinned || here.length > 1 || priorPlaying.length > 0;
      var own = attendedSet.has(act.id) ? "attended" : savedSet.has(act.id) ? "saved" : null;
      var over = priorPlaying.length ? ";over-" + (priorPlaying.some(id => attendedSet.has(id)) ? "attended" : "saved") : "";
      return {
        localDate,
        gpsRejected,
        artistId: act.id,
        night: act.day,
        festivalId,
        resolvedBy,
        reason: own ? own + "_set_time" : "stage_gps_time",
        evidence: (own ? own + "+time+stage-gps" : "trusted-gps+time") + over,
        suggested: false,
        anchorSource: anchor ? anchor.anchorSource : null,
        ambiguous,
        alternatives: ambiguous ? [act.id, ...playingNow.filter(a => a.id !== act.id).map(a => a.id)] : undefined,
        gpsGate
      };
    }
  }
  var priorHits = priorIds.map(id => artists.find(a => a.id === id)).filter(Boolean).map(a => {
    var w = setWindow(a);
    return w ? {
      a,
      ...w,
      score: attendedSet.has(a.id) ? 1000 : 500
    } : null;
  }).filter(Boolean).filter(x => photoMs >= x.startMs - 5 * 60000 && photoMs <= x.endMs + (attendedSet.has(x.a.id) ? 20 : 10) * 60000);
  if (priorHits.length) {
    priorHits.sort((x, y) => y.score - x.score || x.endMs - x.startMs - (y.endMs - y.startMs));
    var hit = priorHits[0];
    var topTier = priorHits.filter(h => h.score === hit.score);
    var _ambiguous = topTier.length > 1;
    var attended = attendedSet.has(hit.a.id);
    if (!attended) {
      var away = _offVenueMeters(cfg, lat, lng, acc);
      if (away != null) {
        return {
          localDate,
          gpsRejected,
          artistId: null,
          night,
          festivalId,
          resolvedBy,
          reason: "off_venue",
          evidence: "gps-off-venue",
          distMeters: away,
          defeated: hit.a.id
        };
      }
    }
    var atStage = trustedStage != null && trustedStage === hit.a.stage;
    var evidence = attended ? "attended+time" : atStage ? "saved+time+stage-gps" : "saved+time";
    return {
      localDate,
      gpsRejected,
      artistId: hit.a.id,
      night: hit.a.day,
      festivalId,
      resolvedBy,
      reason: attended ? "attended_set_time" : "saved_set_time",
      evidence,
      suggested: !attended && !atStage,
      ambiguous: _ambiguous,
      alternatives: _ambiguous ? topTier.map(h => h.a.id) : undefined,
      gpsGate
    };
  }
  {
    var _away = _offVenueMeters(cfg, lat, lng, acc);
    if (_away != null) return {
      localDate,
      gpsRejected,
      artistId: null,
      night,
      festivalId,
      resolvedBy,
      reason: "off_venue",
      evidence: "gps-off-venue",
      distMeters: _away
    };
  }
  if (sLat != null && sLng != null) {
    var anchors = resolvedStageAnchors(cfg);
    if (anchors.length > 0 && _allProgrammedStagesAnchored(artists, night, anchors)) {
      var nearest = null,
        minMeters = Infinity;
      for (var a of anchors) {
        var m = _haversineMeters(sLat, sLng, a.lat, a.lng);
        if (m < minMeters) {
          minMeters = m;
          nearest = a;
        }
      }
      if (minMeters > 120) {
        var loc = _matchNearestLocation(sLat, sLng, set);
        return {
          localDate,
          gpsRejected,
          artistId: null,
          night,
          festivalId,
          resolvedBy,
          reason: "off_stage",
          distMeters: Math.round(minMeters),
          location: loc,
          anchorSource: nearest ? nearest.anchorSource : null
        };
      }
    }
  }
  var minOfDay = localDate.hh * 60 + localDate.mm;
  var adjustedMin = minOfDay < 480 ? minOfDay + 1440 : minOfDay;
  var candidates = [];
  for (var _a2 of artists) {
    if (_a2.day !== night) continue;
    var [sh, sm] = _a2.start.split(":").map(Number);
    var [eh, em] = _a2.end.split(":").map(Number);
    var startMin = (sh < 8 ? sh + 24 : sh) * 60 + sm;
    var endMin = (eh < 8 ? eh + 24 : eh) * 60 + em;
    if (adjustedMin >= startMin - 5 && adjustedMin <= endMin + 10) {
      candidates.push({
        a: _a2,
        startMin,
        endMin
      });
    }
  }
  if (candidates.length === 0) {
    {
      var nearStage = trustedStage;
      var nearStageM = fixGate.distM;
      var nearSource = (stageAnchorsAll.find(g => g.stageId === trustedStage) || {}).anchorSource || null;
      if (nearStage) {
        var best = null,
          bestGap = Infinity;
        for (var _a3 of artists) {
          if (_a3.day !== night || _a3.stage !== nearStage) continue;
          var [_sh, _sm] = _a3.start.split(":").map(Number);
          var [_eh, _em] = _a3.end.split(":").map(Number);
          var _startMin = (_sh < 8 ? _sh + 24 : _sh) * 60 + _sm;
          var _endMin = (_eh < 8 ? _eh + 24 : _eh) * 60 + _em;
          var gap = adjustedMin < _startMin ? _startMin - adjustedMin : adjustedMin > _endMin ? adjustedMin - _endMin : 0;
          if (gap > 0 && gap < bestGap) {
            bestGap = gap;
            best = _a3;
          }
        }
        if (best && bestGap <= 60) {
          return {
            localDate,
            gpsRejected,
            artistId: best.id,
            night,
            festivalId,
            resolvedBy,
            reason: "stage_time_proximity",
            ambiguous: true,
            alternatives: undefined,
            anchorSource: nearSource,
            proximity: {
              stageId: nearStage,
              meters: Math.round(nearStageM),
              gapMin: bestGap
            }
          };
        }
      }
    }
    return {
      localDate,
      gpsRejected,
      artistId: null,
      night,
      festivalId,
      resolvedBy,
      reason: "no_artist_at_time"
    };
  }
  if (fixGate.status === "outside" && candidates.length > 1) {
    var pinned = a => stageAnchorsAll.some(g => g.stageId === a.stage);
    var left = candidates.filter(c => !pinned(c.a));
    if (left.length === 1) {
      return {
        localDate,
        gpsRejected,
        artistId: left[0].a.id,
        night,
        festivalId,
        resolvedBy,
        reason: "unpinned_by_exclusion",
        ambiguous: true,
        anchorSource: null,
        gpsGate,
        alternatives: [left[0].a.id, ...candidates.filter(c => c !== left[0]).sort((x, y) => x.startMin - y.startMin).map(c => c.a.id)]
      };
    }
    if (left.length > 1) {
      var ordered = [...left.sort((x, y) => x.startMin - y.startMin), ...candidates.filter(c => pinned(c.a)).sort((x, y) => x.startMin - y.startMin)];
      return {
        localDate,
        gpsRejected,
        artistId: null,
        night,
        festivalId,
        resolvedBy,
        reason: "several_playing",
        ambiguous: true,
        anchorSource: null,
        gpsGate,
        alternatives: ordered.map(c => c.a.id)
      };
    }
  }
  if (candidates.length === 1) {
    return {
      localDate,
      gpsRejected,
      artistId: candidates[0].a.id,
      night,
      festivalId,
      resolvedBy,
      reason: "matched",
      ambiguous: false,
      anchorSource: null,
      gpsGate
    };
  }
  var several = candidates.slice().sort((x, y) => x.startMin - y.startMin || String(x.a.id).localeCompare(String(y.a.id)));
  return {
    localDate,
    gpsRejected,
    artistId: null,
    night,
    festivalId,
    resolvedBy,
    reason: "several_playing",
    ambiguous: true,
    anchorSource: null,
    alternatives: several.map(c => c.a.id),
    gpsGate
  };
}
function _scanNightWindows(cfgIn) {
  var cfg = cfgIn || window.FESTIVAL_CONFIG;
  if (!cfg?.dayDates) return [];
  var H = 3600000,
    slack = 30 * 60000;
  var out = [];
  for (var {
    weekend,
    shift
  } of festivalWeekendShifts(cfg)) {
    for (var n of Object.keys(cfg.dayDates).map(Number)) {
      var dm = cfg.dayDates[n];
      if (!dm || typeof dm.midnightUtc !== "number") continue;
      var midnight = dm.midnightUtc + shift;
      out.push({
        night: n,
        weekend,
        startMs: midnight + 11 * H - slack,
        endMs: midnight + 30 * H + slack
      });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}
function _scanQueryRanges(cfgIn) {
  var ranges = [];
  for (var w of _scanNightWindows(cfgIn)) {
    var last = ranges[ranges.length - 1];
    if (last && w.startMs <= last.endMs) last.endMs = Math.max(last.endMs, w.endMs);else ranges.push({
      startMs: w.startMs,
      endMs: w.endMs
    });
  }
  return ranges;
}
function _photoKitAssetMeta(asset, cfgIn) {
  var cfg = cfgIn || window.FESTIVAL_CONFIG;
  var ms = Number(asset?.createdMs);
  if (!isFinite(ms) || ms <= 0) return null;
  var lat = Number(asset.lat),
    lng = Number(asset.lng);
  var hasGps = asset.lat != null && asset.lng != null && isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  var acc = Number(asset.acc);
  return {
    date: _wallClockFromUtc(ms, cfg),
    rawUtcMs: ms,
    lat: hasGps ? lat : null,
    lng: hasGps ? lng : null,
    acc: hasGps && asset.acc != null && isFinite(acc) && acc >= 0 ? acc : null,
    timestampSource: "photokit",
    locationSource: hasGps ? "photokit-gps" : "none"
  };
}
var _SCAN_SET_BUFFER_MS = 15 * 60000;
var _SCAN_TIME_RE = /^(\d{1,2}):(\d{2})$/;
function _zonedWallToUtc(yr, mo, dy, hh, mm, tz) {
  var guess = Date.UTC(yr, mo - 1, dy, hh, mm);
  if (!tz || typeof Intl === "undefined") return null;
  var fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return null;
  }
  var offsetAt = ms => {
    var p = {};
    for (var x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms;
  };
  var t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return t;
}
function _scanNightLocalDate(cfg, n, shift) {
  var dm = cfg?.dayDates?.[n];
  if (!dm || typeof dm.midnightUtc !== "number") return null;
  var ms = dm.midnightUtc + shift + 12 * 3600000;
  if (cfg.tz && typeof Intl !== "undefined") {
    try {
      var p = {};
      for (var x of new Intl.DateTimeFormat("en-US", {
        timeZone: cfg.tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date(ms))) p[x.type] = x.value;
      return {
        yr: +p.year,
        mo: +p.month,
        dy: +p.day
      };
    } catch {}
  }
  var d = new Date(ms + _festivalTzOffsetHours(cfg) * 3600000);
  return {
    yr: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    dy: d.getUTCDate()
  };
}
function _scanActUtc(cfg, n, shift, hhmm) {
  var m = _SCAN_TIME_RE.exec(String(hhmm || ""));
  if (!m) return null;
  var h = +m[1];
  var mi = +m[2];
  var date = _scanNightLocalDate(cfg, n, shift);
  if (!date) return null;
  var dayAdd = 0;
  if (h < 8) dayAdd = 1;
  var base = new Date(Date.UTC(date.yr, date.mo - 1, date.dy + dayAdd));
  var utc = _zonedWallToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), h, mi, cfg.tz);
  if (utc != null) return utc;
  var dm = cfg.dayDates[n];
  return dm.midnightUtc + shift + ((h < 8 ? h + 24 : h) * 60 + mi) * 60000;
}
function _scanSetWindows(cfgIn, artistsIn) {
  var cfg = cfgIn || window.FESTIVAL_CONFIG;
  var artists = artistsIn || cfg?.id && window._DATA_SETS?.[cfg.id]?.artists || (cfg === window.FESTIVAL_CONFIG ? window.ARTISTS : null) || [];
  if (!cfg?.dayDates) return [];
  var out = [];
  for (var {
    weekend,
    shift
  } of festivalWeekendShifts(cfg)) {
    for (var n of Object.keys(cfg.dayDates).map(Number).sort((a, b) => a - b)) {
      if (!cfg.dayDates[n] || typeof cfg.dayDates[n].midnightUtc !== "number") continue;
      var startMs = Infinity,
        endMs = -Infinity,
        acts = 0;
      for (var a of artists) {
        if (Number(a?.day) !== n || !actPlaysWeekend(a, weekend)) continue;
        if (setTimeStatus(a) !== "confirmed") continue;
        var s0 = _scanActUtc(cfg, n, shift, a.start),
          e0 = _scanActUtc(cfg, n, shift, a.end);
        if (s0 == null || e0 == null) continue;
        var e1 = e0 <= s0 ? e0 + 24 * 3600000 : e0;
        acts++;
        if (s0 < startMs) startMs = s0;
        if (e1 > endMs) endMs = e1;
      }
      out.push(acts ? {
        night: n,
        weekend,
        source: "set-times",
        startMs: startMs - _SCAN_SET_BUFFER_MS,
        endMs: endMs + _SCAN_SET_BUFFER_MS,
        acts
      } : {
        night: n,
        weekend,
        source: "none",
        acts: 0
      });
    }
  }
  return out;
}
function _scanWindowReport(cfgIn, artistsIn) {
  var cfg = cfgIn || window.FESTIVAL_CONFIG;
  return _scanSetWindows(cfg, artistsIn).map(w => {
    if (w.source !== "set-times") return {
      night: w.night,
      weekend: w.weekend,
      source: w.source
    };
    var f = ms => {
      var d = _wallClockFromUtcTz(ms, cfg);
      return `${d.yr}-${String(d.mo).padStart(2, "0")}-${String(d.dy).padStart(2, "0")} ${String(d.hh).padStart(2, "0")}:${String(d.mm).padStart(2, "0")}`;
    };
    return {
      night: w.night,
      weekend: w.weekend,
      source: w.source,
      acts: w.acts,
      start: f(w.startMs),
      end: f(w.endMs)
    };
  });
}
function _wallClockFromUtcTz(ms, cfg) {
  if (cfg?.tz && typeof Intl !== "undefined") {
    try {
      var p = {};
      for (var x of new Intl.DateTimeFormat("en-US", {
        timeZone: cfg.tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).formatToParts(new Date(ms))) p[x.type] = x.value;
      return {
        yr: +p.year,
        mo: +p.month,
        dy: +p.day,
        hh: +p.hour % 24,
        mm: +p.minute
      };
    } catch {}
  }
  return _wallClockFromUtc(ms, cfg);
}
function _scanPickAssets(assets, cfgIn, seenIds, artistsIn) {
  var cfg = cfgIn || window.FESTIVAL_CONFIG;
  var seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  var windows = _scanSetWindows(cfg, artistsIn);
  var timed = windows.filter(w => w.source === "set-times");
  var untimed = new Set(windows.filter(w => w.source !== "set-times").map(w => `${w.night}|${w.weekend}`));
  var keep = [];
  var outside = 0,
    outsideSets = 0,
    fullNight = 0,
    already = 0;
  var _loop5 = function () {
      if (!a || !a.id) return 0;
      var ms = Number(a.createdMs);
      if (!isFinite(ms)) {
        outside++;
        return 0;
      }
      var whole = false;
      if (!timed.some(w => ms >= w.startMs && ms <= w.endMs)) {
        var nw = _photoFestivalNightWeekend(null, cfg, ms);
        if (!nw) {
          outside++;
          return 0;
        }
        if (!untimed.has(`${nw.night}|${nw.weekend}`)) {
          outsideSets++;
          return 0;
        }
        whole = true;
      }
      if (seen.has(a.id)) {
        already++;
        return 0;
      }
      if (whole) fullNight++;
      keep.push(a);
    },
    _ret5;
  for (var a of assets || []) {
    _ret5 = _loop5();
    if (_ret5 === 0) continue;
  }
  keep.sort((x, y) => Number(x.createdMs) - Number(y.createdMs));
  return {
    keep,
    outside,
    outsideSets,
    fullNight,
    untimedNights: untimed.size,
    already,
    nightsWithoutSetTimes: windows.filter(w => w.source !== "set-times").map(w => ({
      night: w.night,
      weekend: w.weekend
    }))
  };
}
function _pickerErrorIsCancel(err) {
  var msg = String(err && (err.message || err.errorMessage) || err || "").trim();
  return /^pick(Files|Media|Images|Videos)? cancel(l)?ed\.?$/i.test(msg);
}
function _scanChunks(assets, maxPhotos = 20) {
  var chunks = [];
  for (var a of assets || []) {
    var last = chunks[chunks.length - 1];
    if (a?.mediaType !== "video" && last && last.length < maxPhotos && last[0]?.mediaType !== "video") last.push(a);else chunks.push([a]);
  }
  return chunks;
}
var _SCAN_SEEN_KEY = "plursky_scan_seen_v1";
var _SCAN_SEEN_MAX = 20000;
function _scanSeenRead() {
  try {
    var v = JSON.parse(localStorage.getItem(_SCAN_SEEN_KEY) || "[]");
    return new Set(Array.isArray(v) ? v.filter(x => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function _scanSeenAdd(ids) {
  var cur = [..._scanSeenRead()];
  var have = new Set(cur);
  for (var id of ids || []) if (typeof id === "string" && !have.has(id)) {
    cur.push(id);
    have.add(id);
  }
  var trimmed = cur.length > _SCAN_SEEN_MAX ? cur.slice(cur.length - _SCAN_SEEN_MAX) : cur;
  try {
    localStorage.setItem(_SCAN_SEEN_KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed.length;
}
var _SCAN_DIAG_KEY = "plursky_scan_diag_v1";
var _SCAN_DIAG_SALT_KEY = "plursky_scan_diag_salt_v1";
var _SCAN_DIAG_MAX_EVENTS = 60;
var _SCAN_DIAG_MAX_CHANGES = 80;
var _SCAN_DIAG_MAX_RECORDS = 1500;
var _SCAN_DIAG_MAX_CHARS = 38000;
function _scanDiagSalt() {
  try {
    var s = localStorage.getItem(_SCAN_DIAG_SALT_KEY);
    if (!s || !/^[0-9a-f]{32}$/.test(s)) {
      var b = new Uint8Array(16);
      if (window.crypto?.getRandomValues) window.crypto.getRandomValues(b);else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
      s = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(_SCAN_DIAG_SALT_KEY, s);
    }
    return s;
  } catch {
    return "nosalt";
  }
}
function _scanDiagHash(id, salt) {
  var str = `${salt}|${id}`;
  var h1 = 0x811c9dc5,
    h2 = 0x01000193 ^ 0x5bd1e995;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 = (h2 ^ h2 >>> 13) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
var _scanDiagStr = (v, re, max = 40) => typeof v === "string" && v.length <= max && re.test(v) ? v : v == null ? null : "?";
var _SCAN_DIAG_ID_RE = /^[A-Za-z0-9_.:-]+$/;
var _SCAN_DIAG_LABEL_RE = /^[a-z0-9_-]+$/i;
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
    fp: m._fingerprint ? 1 : 0
  };
}
function _scanDiagRecords(all, salt) {
  var out = [];
  for (var night of Object.keys(all || {})) {
    var arr = all[night];
    if (!Array.isArray(arr)) continue;
    for (var m of arr) if (m && m.id != null) out.push(_scanDiagRecord(m, night, salt));
  }
  return out;
}
function _scanDiagSummary(records) {
  var byFest = {},
    bySource = {};
  for (var r of records) {
    var f = r.f || "-",
      n = r.n == null ? "-" : String(r.n),
      a = r.a || "-";
    byFest[f] = byFest[f] || {
      total: 0,
      nights: {}
    };
    byFest[f].total++;
    var nn = byFest[f].nights[n] = byFest[f].nights[n] || {};
    nn[a] = (nn[a] || 0) + 1;
    var s = r.ts || "-";
    bySource[s] = (bySource[s] || 0) + 1;
  }
  return {
    total: records.length,
    byFest,
    bySource
  };
}
function _scanDiagRead() {
  try {
    var v = JSON.parse(localStorage.getItem(_SCAN_DIAG_KEY) || "null");
    if (v && typeof v === "object" && Array.isArray(v.events)) return v;
  } catch {}
  return {
    v: 1,
    before: null,
    last: null,
    events: []
  };
}
function _scanDiagWrite(d) {
  try {
    localStorage.setItem(_SCAN_DIAG_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}
function _scanDiagOrigin(stack) {
  var names = [];
  for (var line of String(stack || "").split("\n")) {
    var m = line.match(/^\s*(?:at\s+)?(?:async\s+)?([A-Za-z_$][\w$.]*)\s*(?:@|\()/);
    var nm = m && m[1].split(".").pop();
    if (!nm || /^_scanDiag|^_writeMoments$|^Error$/.test(nm)) continue;
    if (nm.length <= 40) names.push(nm);
    if (names.length >= 4) break;
  }
  return names.join(">") || "?";
}
function _scanDiagEnsureBefore(allIn) {
  try {
    var d = _scanDiagRead();
    if (d.before) return false;
    var salt = _scanDiagSalt();
    var all = allIn || JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    var records = _scanDiagRecords(all, salt);
    d.before = {
      t: new Date().toISOString(),
      summary: _scanDiagSummary(records),
      records: records.slice(0, _SCAN_DIAG_MAX_RECORDS),
      truncated: records.length > _SCAN_DIAG_MAX_RECORDS
    };
    d.last = Object.fromEntries(records.map(r => [r.h, `${r.f}|${r.n}|${r.a}|${r.ts}`]));
    d.events.push({
      t: d.before.t,
      ev: "before",
      origin: "boot",
      total: records.length
    });
    return _scanDiagWrite(d);
  } catch {
    return false;
  }
}
function _scanDiagLog(ev, all, stack) {
  try {
    var d = _scanDiagRead();
    var salt = _scanDiagSalt();
    var cur = all || JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    var records = _scanDiagRecords(cur, salt);
    var now = {};
    for (var r of records) now[r.h] = `${r.f}|${r.n}|${r.a}|${r.ts}`;
    var prev = d.last || {};
    var added = 0,
      removed = 0,
      changed = 0;
    var changes = [];
    for (var h of Object.keys(now)) {
      if (!(h in prev)) {
        added++;
        if (changes.length < _SCAN_DIAG_MAX_CHANGES) changes.push(`+${h}:${now[h]}`);
      } else if (prev[h] !== now[h]) {
        changed++;
        if (changes.length < _SCAN_DIAG_MAX_CHANGES) changes.push(`~${h}:${prev[h]}>${now[h]}`);
      }
    }
    for (var _h of Object.keys(prev)) if (!(_h in now)) {
      removed++;
      if (changes.length < _SCAN_DIAG_MAX_CHANGES) changes.push(`-${_h}:${prev[_h]}`);
    }
    var origin = ev === "write" ? _scanDiagOrigin(stack) : ev;
    var lastEv = d.events[d.events.length - 1];
    if (ev === "write" && lastEv && lastEv.ev === "write" && lastEv.origin === origin) {
      lastEv.writes = (lastEv.writes || 1) + 1;
      lastEv.tEnd = new Date().toISOString();
      lastEv.total = records.length;
      lastEv.added += added;
      lastEv.removed += removed;
      lastEv.changed += changed;
      for (var c of changes) if (lastEv.changes.length < _SCAN_DIAG_MAX_CHANGES) lastEv.changes.push(c);
    } else {
      d.events.push({
        t: new Date().toISOString(),
        ev,
        origin,
        total: records.length,
        added,
        removed,
        changed,
        changes
      });
      if (d.events.length > _SCAN_DIAG_MAX_EVENTS) {
        d.events.splice(1, d.events.length - _SCAN_DIAG_MAX_EVENTS);
      }
    }
    d.last = now;
    return _scanDiagWrite(d);
  } catch {
    return false;
  }
}
var _SCAN_DIAG_HASH_RE = /^[0-9a-f]{16}$/;
var _SCAN_DIAG_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
var _SCAN_DIAG_NIGHT_RE = /^(-|_other|\d{1,3})$/;
var _SCAN_DIAG_EV_RE = /^[a-z-]{1,20}$/;
var _SCAN_DIAG_ORIGIN_RE = /^[A-Za-z0-9_$>?-]{1,170}$/;
var _SCAN_DIAG_SEG = "[A-Za-z0-9_.:?-]{1,40}";
var _SCAN_DIAG_STATE = `${_SCAN_DIAG_SEG}\\|${_SCAN_DIAG_SEG}\\|${_SCAN_DIAG_SEG}\\|${_SCAN_DIAG_SEG}`;
var _SCAN_DIAG_CHANGE_RE = new RegExp(`^[+~-][0-9a-f]{16}:${_SCAN_DIAG_STATE}(>${_SCAN_DIAG_STATE})?$`);
var _scanDiagInt = v => Number.isInteger(v) && v >= 0 && v < 1e7 ? v : 0;
var _scanDiagKey = (k, re) => typeof k === "string" && k.length <= 40 && re.test(k);
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
    auto: r.auto ? 1 : 0,
    amb: r.amb ? 1 : 0,
    rt: r.rt ? 1 : 0,
    fp: r.fp ? 1 : 0
  };
}
function _scanDiagCleanCounts(obj, keyRe) {
  var out = {};
  if (!obj || typeof obj !== "object") return out;
  for (var k of Object.keys(obj)) if (_scanDiagKey(k, keyRe)) out[k] = _scanDiagInt(obj[k]);
  return out;
}
function _scanDiagCleanSummary(sIn) {
  var sum = sIn && typeof sIn === "object" ? sIn : {};
  var byFest = {};
  for (var f of Object.keys(sum.byFest || {})) {
    var fv = sum.byFest[f];
    if (!_scanDiagKey(f, _SCAN_DIAG_ID_RE) || !fv || typeof fv !== "object") continue;
    var nights = {};
    for (var n of Object.keys(fv.nights || {})) {
      if (_scanDiagKey(n, _SCAN_DIAG_NIGHT_RE)) nights[n] = _scanDiagCleanCounts(fv.nights[n], _SCAN_DIAG_ID_RE);
    }
    byFest[f] = {
      total: _scanDiagInt(fv.total),
      nights
    };
  }
  return {
    total: _scanDiagInt(sum.total),
    byFest,
    bySource: _scanDiagCleanCounts(sum.bySource, _SCAN_DIAG_ID_RE)
  };
}
function _scanDiagCleanEvent(e) {
  if (!e || typeof e !== "object") return null;
  var out = {
    t: typeof e.t === "string" && _SCAN_DIAG_ISO_RE.test(e.t) ? e.t : null,
    ev: typeof e.ev === "string" && _SCAN_DIAG_EV_RE.test(e.ev) ? e.ev : "?",
    origin: typeof e.origin === "string" && _SCAN_DIAG_ORIGIN_RE.test(e.origin) ? e.origin : "?",
    total: _scanDiagInt(e.total)
  };
  if (typeof e.tEnd === "string" && _SCAN_DIAG_ISO_RE.test(e.tEnd)) out.tEnd = e.tEnd;
  if (e.ev !== "before") {
    out.added = _scanDiagInt(e.added);
    out.removed = _scanDiagInt(e.removed);
    out.changed = _scanDiagInt(e.changed);
    if (Number.isInteger(e.writes)) out.writes = _scanDiagInt(e.writes);
    out.changes = Array.isArray(e.changes) ? e.changes.filter(c => typeof c === "string" && c.length <= 260 && _SCAN_DIAG_CHANGE_RE.test(c)) : [];
  }
  return out;
}
function _scanDiagTop(obj, k, val = v => v) {
  var e = Object.entries(obj);
  if (e.length <= k) return {
    out: obj,
    cut: false
  };
  e.sort((x, y) => val(y[1]) - val(x[1]));
  return {
    out: Object.fromEntries(e.slice(0, k)),
    rest: e.slice(k),
    cut: true
  };
}
function _scanDiagTrimSummary(sum, k) {
  if (k === Infinity) return {
    sum,
    cut: false
  };
  var cut = false;
  var byFest = {};
  var f = _scanDiagTop(sum.byFest, k, v => v.total);
  if (f.cut) {
    cut = true;
    byFest._other = {
      total: f.rest.reduce((t, [, v]) => t + v.total, 0),
      nights: {}
    };
  }
  for (var [fid, fv] of Object.entries(f.out)) {
    var nights = {};
    var ns = _scanDiagTop(fv.nights, k, v => Object.values(v).reduce((t, c) => t + c, 0));
    if (ns.cut) {
      cut = true;
      nights._other = {
        _other: ns.rest.reduce((t, [, v]) => t + Object.values(v).reduce((a, c) => a + c, 0), 0)
      };
    }
    for (var [n, arts] of Object.entries(ns.out)) {
      var a = _scanDiagTop(arts, k);
      if (a.cut) {
        cut = true;
        a.out = {
          ...a.out,
          _other: (a.out._other || 0) + a.rest.reduce((t, [, c]) => t + c, 0)
        };
      }
      nights[n] = a.out;
    }
    byFest[fid] = {
      total: fv.total,
      nights
    };
  }
  var src = _scanDiagTop(sum.bySource, k);
  if (src.cut) {
    cut = true;
    src.out = {
      ...src.out,
      _other: (src.out._other || 0) + src.rest.reduce((t, [, c]) => t + c, 0)
    };
  }
  return {
    sum: {
      total: sum.total,
      byFest,
      bySource: src.out
    },
    cut
  };
}
function _scanDiagExportText(meta = {}) {
  var d = _scanDiagRead();
  var salt = _scanDiagSalt();
  var all = (() => {
    try {
      return JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    } catch {
      return {};
    }
  })();
  var nowRecords = _scanDiagRecords(all, salt).map(_scanDiagCleanRecord).filter(Boolean);
  var nowSummary = _scanDiagCleanSummary(_scanDiagSummary(nowRecords));
  var b = d.before && typeof d.before === "object" ? d.before : null;
  var beforeRecords = b && Array.isArray(b.records) ? b.records.map(_scanDiagCleanRecord).filter(Boolean) : [];
  var beforeSummary = b ? _scanDiagCleanSummary(b.summary) : null;
  var beforeT = b && typeof b.t === "string" && _SCAN_DIAG_ISO_RE.test(b.t) ? b.t : null;
  var beforeCut = !!(b && b.truncated);
  var events = (Array.isArray(d.events) ? d.events : []).map(_scanDiagCleanEvent).filter(Boolean);
  var ver = typeof meta.appVersion === "string" && /^v\d+$/.test(meta.appVersion) ? meta.appVersion : null;
  var created = new Date().toISOString();
  var head = () => ({
    schema: "plursky-scan-diag/1",
    created,
    app: ver,
    activeFestival: _scanDiagStr(window.FESTIVAL_CONFIG?.id, _SCAN_DIAG_ID_RE),
    scanSeen: (() => {
      try {
        return _scanSeenRead().size;
      } catch {
        return null;
      }
    })()
  });
  var build = ({
    rec,
    ev,
    ch,
    k
  }) => {
    var evKeep = ev >= events.length ? events : ev <= 0 ? [] : [events[0], ...events.slice(1).slice(-(ev - 1))];
    var changesCut = false;
    var evOut = evKeep.map(e => {
      if (!e.changes) return e;
      if (e.changes.length > ch || e.changes.length < e.added + e.removed + e.changed) changesCut = true;
      return {
        ...e,
        changes: e.changes.slice(0, ch)
      };
    });
    var bs = beforeSummary ? _scanDiagTrimSummary(beforeSummary, k) : null;
    var ns = _scanDiagTrimSummary(nowSummary, k);
    return {
      ...head(),
      truncated: {
        records: beforeCut || beforeRecords.length > rec || nowRecords.length > rec,
        events: events.length - evOut.length,
        changes: changesCut,
        summary: !!(bs && bs.cut) || ns.cut
      },
      eventsTotal: events.length,
      before: b ? {
        t: beforeT,
        total: beforeSummary.total,
        summary: bs.sum,
        truncated: beforeCut || beforeRecords.length > rec,
        records: beforeRecords.slice(0, rec)
      } : null,
      now: {
        total: nowRecords.length,
        summary: ns.sum,
        truncated: nowRecords.length > rec,
        records: nowRecords.slice(0, rec)
      },
      events: evOut
    };
  };
  var steps = [];
  for (var n = _SCAN_DIAG_MAX_RECORDS; n > 0; n = Math.floor(n * 0.7)) steps.push({
    rec: n,
    ev: _SCAN_DIAG_MAX_EVENTS,
    ch: _SCAN_DIAG_MAX_CHANGES,
    k: Infinity
  });
  steps.push({
    rec: 0,
    ev: _SCAN_DIAG_MAX_EVENTS,
    ch: _SCAN_DIAG_MAX_CHANGES,
    k: Infinity
  }, {
    rec: 0,
    ev: 30,
    ch: 20,
    k: Infinity
  }, {
    rec: 0,
    ev: 10,
    ch: 5,
    k: Infinity
  });
  for (var k of [200, 50, 20, 5, 1, 0]) steps.push({
    rec: 0,
    ev: 10,
    ch: 5,
    k
  });
  steps.push({
    rec: 0,
    ev: 0,
    ch: 0,
    k: 0
  });
  for (var p of steps) {
    var text = JSON.stringify(build(p));
    if (text.length <= _SCAN_DIAG_MAX_CHARS) return text;
  }
  return JSON.stringify({
    ...head(),
    truncated: {
      records: true,
      events: events.length,
      changes: true,
      summary: true
    },
    eventsTotal: events.length,
    before: b ? {
      total: beforeSummary.total
    } : null,
    now: {
      total: nowRecords.length
    }
  }).slice(0, _SCAN_DIAG_MAX_CHARS);
}
async function _scanDiagShare(meta = {}) {
  _scanDiagLog("share", null, "");
  var text = _scanDiagExportText(meta);
  var capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      await capShare.share({
        title: "Plursky scan diagnostic",
        text,
        dialogTitle: "Send scan diagnostic"
      });
      return {
        ok: true,
        mode: "share",
        chars: text.length
      };
    } catch (e) {
      if (/cancel|abort/i.test(e?.message || "")) return {
        ok: false,
        mode: "cancelled",
        chars: text.length
      };
      return {
        ok: false,
        mode: "error",
        chars: text.length
      };
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Plursky scan diagnostic",
        text
      });
      return {
        ok: true,
        mode: "share",
        chars: text.length
      };
    } catch (e) {
      if (e?.name === "AbortError") return {
        ok: false,
        mode: "cancelled",
        chars: text.length
      };
    }
  }
  var clip = typeof navigator !== "undefined" ? navigator.clipboard : null;
  if (!clip || typeof clip.writeText !== "function") return {
    ok: false,
    mode: "unavailable",
    chars: text.length
  };
  try {
    await clip.writeText(text);
    return {
      ok: true,
      mode: "copied",
      chars: text.length
    };
  } catch {
    return {
      ok: false,
      mode: "error",
      chars: text.length
    };
  }
}
try {
  _scanDiagEnsureBefore();
} catch {}
function _memoriesImportCopy(pickerAvailable, scanAvailable) {
  if (pickerAvailable) return {
    invite: "Import your festival photos & videos — Plursky auto-tags each to the set you were watching, finds the song that was playing, and turns them into a recap.",
    withSets: "Import photos or videos and they’ll land on the sets below."
  };
  if (scanAvailable) return {
    invite: "Plursky organises your festival photos and videos by the set you were watching. Tap Scan my weekend above to bring in your festival nights.",
    withSets: "Scan my weekend above and your clips will land on the sets below."
  };
  return {
    invite: "Plursky organises your festival photos and videos by the set you were watching. This build can’t open your photo library, so there’s nothing to import from here yet.",
    withSets: "This build can’t open your photo library, so the sets below are your library for now."
  };
}