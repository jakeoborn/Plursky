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
    var visit = (start, end, depth) => {
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
        if (["trak", "mdia", "minf", "stbl", "udta", "meta", "ilst", "moov"].includes(_type)) {
          visit(_type === "meta" ? Math.min(boxEnd, payload + 4) : payload, boxEnd, depth + 1);
        }
        pos += _boxSize;
      }
    };
    visit(8, n, 0);
  } catch {}
  return out;
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
  var cfg = cfgIn || window.FESTIVAL_CONFIG;
  if (!cfg?.dayDates) return null;
  if (utcMs == null && !date) return null;
  var photoMs = utcMs != null ? utcMs : _photoEpochUtc(date, cfg);
  for (var n of Object.keys(cfg.dayDates).map(Number)) {
    var dm = cfg.dayDates[n];
    if (!dm) continue;
    var startMs = dm.midnightUtc + 11 * 3600000;
    var endMs = dm.midnightUtc + 30 * 3600000;
    if (photoMs >= startMs - 30 * 60000 && photoMs <= endMs + 30 * 60000) return n;
  }
  return null;
}
function _haversineMeters(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var toRad = d => d * Math.PI / 180;
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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
function _anyFestivalNight(date, utcMs) {
  if (!date && utcMs == null) return null;
  for (var ds of _allDataSets()) {
    var night = _photoFestivalNight(date, ds.config, utcMs);
    if (night != null) return {
      festivalId: ds.id,
      night
    };
  }
  return null;
}
function _matchNearestLocation(lat, lng, ds) {
  var set = ds || _activeDataSet();
  var amenities = set.amenities || [];
  if (!amenities.length) return null;
  var cfg = set.config || {};
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
  var artists = set.artists || [];
  var festivalId = set.id || null;
  var resolvedBy = set.resolvedBy || "explicit";
  var gpsUsableForStage = acc == null || acc <= _GPS_STAGE_MAX_ACC_M;
  var sLat = gpsUsableForStage ? lat : null;
  var sLng = gpsUsableForStage ? lng : null;
  var gpsRejected = !gpsUsableForStage && lat != null;
  var localDate = rawUtcMs != null ? _wallClockFromUtc(rawUtcMs, cfg) : date;
  var night = _photoFestivalNight(localDate, cfg, rawUtcMs);
  if (!night) return {
    localDate,
    gpsRejected,
    artistId: null,
    night: null,
    festivalId,
    resolvedBy,
    reason: "outside_festival_window"
  };
  var photoMs = _photoEpochUtc(date, cfg);
  var setWindow = a => {
    var dm = cfg.dayDates?.[a.day];
    if (!dm) return null;
    var [sh, sm] = a.start.split(":").map(Number);
    var [eh, em] = a.end.split(":").map(Number);
    return {
      localDate,
      gpsRejected,
      startMs: dm.midnightUtc + ((sh < 8 ? sh + 24 : sh) * 60 + sm) * 60000,
      endMs: dm.midnightUtc + ((eh < 8 ? eh + 24 : eh) * 60 + em) * 60000
    };
  };
  var attendedSet = new Set(attendedIds || []);
  var savedSet = new Set(savedIds || []);
  var priorIds = [...new Set([...(attendedIds || []), ...(savedIds || [])])];
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
    return {
      localDate,
      gpsRejected,
      artistId: hit.a.id,
      night: hit.a.day,
      festivalId,
      resolvedBy,
      reason: attendedSet.has(hit.a.id) ? "attended_set_time" : "saved_set_time",
      ambiguous: _ambiguous,
      alternatives: _ambiguous ? topTier.map(h => h.a.id) : undefined
    };
  }
  if (sLat != null && sLng != null) {
    var anchors = resolvedStageAnchors(cfg);
    if (anchors.length > 0) {
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
  for (var _a of artists) {
    if (_a.day !== night) continue;
    var [sh, sm] = _a.start.split(":").map(Number);
    var [eh, em] = _a.end.split(":").map(Number);
    var startMin = (sh < 8 ? sh + 24 : sh) * 60 + sm;
    var endMin = (eh < 8 ? eh + 24 : eh) * 60 + em;
    if (adjustedMin >= startMin - 5 && adjustedMin <= endMin + 10) {
      candidates.push({
        a: _a,
        startMin,
        endMin
      });
    }
  }
  if (candidates.length === 0) {
    if (sLat != null && sLng != null) {
      var _anchors2 = resolvedStageAnchors(cfg);
      var nearStage = null,
        nearStageM = Infinity,
        nearSource = null;
      for (var g of _anchors2) {
        var _m = _haversineMeters(sLat, sLng, g.lat, g.lng);
        if (_m < nearStageM) {
          nearStageM = _m;
          nearStage = g.stageId;
          nearSource = g.anchorSource;
        }
      }
      if (nearStage && nearStageM <= 120) {
        var best = null,
          bestGap = Infinity;
        for (var _a2 of artists) {
          if (_a2.day !== night || _a2.stage !== nearStage) continue;
          var [_sh, _sm] = _a2.start.split(":").map(Number);
          var [_eh, _em] = _a2.end.split(":").map(Number);
          var _startMin = (_sh < 8 ? _sh + 24 : _sh) * 60 + _sm;
          var _endMin = (_eh < 8 ? _eh + 24 : _eh) * 60 + _em;
          var gap = adjustedMin < _startMin ? _startMin - adjustedMin : adjustedMin > _endMin ? adjustedMin - _endMin : 0;
          if (gap > 0 && gap < bestGap) {
            bestGap = gap;
            best = _a2;
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
  var inAttended = candidates.filter(c => attendedSet.has(c.a.id));
  var inSaved = candidates.filter(c => savedSet.has(c.a.id));
  var pool = inAttended.length ? inAttended : inSaved.length ? inSaved : candidates;
  var _anchors = resolvedStageAnchors(cfg);
  var stageDist = a => {
    if (sLat == null || sLng == null) return Infinity;
    var anchor = _anchors.find(g => g.stageId === a.stage);
    if (!anchor) return Infinity;
    var dLat = sLat - anchor.lat,
      dLng = sLng - anchor.lng;
    return dLat * dLat + dLng * dLng;
  };
  pool.sort((x, y) => {
    var dx = stageDist(x.a),
      dy = stageDist(y.a);
    if (dx !== Infinity && dy !== Infinity && Math.abs(dx - dy) > 1e-9) return dx - dy;
    return Math.abs(adjustedMin - x.startMin) - Math.abs(adjustedMin - y.startMin);
  });
  var dists = pool.map(c => stageDist(c.a));
  var gpsSeparated = dists.every(d => d !== Infinity) && [...dists].sort((a, b) => a - b).slice(0, 2).reduce((a, b) => b - a, 0) > 1e-9;
  var winnerAnchor = _anchors.find(g => g.stageId === pool[0].a.stage) || null;
  var gpsDecided = sLat != null && sLng != null && pool.length > 1 && gpsSeparated;
  var anchorSource = gpsDecided ? winnerAnchor ? winnerAnchor.anchorSource : null : null;
  var ambiguous = pool.length > 1 && !gpsSeparated || anchorSource === "poster";
  return {
    localDate,
    gpsRejected,
    artistId: pool[0].a.id,
    night,
    festivalId,
    resolvedBy,
    reason: "matched",
    ambiguous,
    anchorSource,
    alternatives: ambiguous ? pool.map(c => c.a.id) : undefined
  };
}