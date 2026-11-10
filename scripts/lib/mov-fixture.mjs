// Builds small QuickTime (.mov) files shaped like real iPhone clips, with a
// planted capture fix in every place a real clip keeps one:
//   moov/meta keys+ilst  com.apple.quicktime.location.ISO6709 (+ accuracy)
//   moov/udta ©xyz       (older iPhones, Android)
//   top-level free       a leftover copy of the meta (seen in real clips)
//   inside mdat          an orphaned keys+ilst copy (26 of 34 real GPS clips)
// The planted digits are distinctive so a leak is greppable in any byte dump.
export const PLANT = { lat: 28.5412, lng: -81.3987, iso: "+28.5412-081.3987+012.345/", acc: "6.000000" };
export const LEAKS = ["28.5412", "081.3987", "81.3987"];
export const ISO_SHAPE = /[+-]\d{1,3}\.\d{2,}[+-]\d{1,3}\.\d{2,}/;
export const CAPTURE_UNIX_S = 1794340800; // 2026-11-10T00:00:00Z

const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const typ = t => (Buffer.isBuffer(t) ? t : Buffer.from(t, "latin1"));
export const box = (t, ...kids) => { const body = Buffer.concat(kids.map(k => (Buffer.isBuffer(k) ? k : Buffer.from(k, "latin1")))); return Buffer.concat([u32(8 + body.length), typ(t), body]); };

export function metaBox(items, orphan = null, dupKeys = false) {
  const hdlr = box("hdlr", u32(0), u32(0), "mdta", Buffer.alloc(12), Buffer.alloc(1));
  const keys = box("keys", u32(0), u32(items.length), ...items.map(([k]) => { const name = Buffer.from(k, "latin1"); return Buffer.concat([u32(8 + name.length), Buffer.from("mdta"), name]); }));
  // orphan: an item whose index is past the keys table (no key names it).
  const extra = orphan ? [box(u32(items.length + 7), box("data", u32(1), u32(0), orphan))] : [];
  const ilst = box("ilst", ...items.map(([, v], i) => box(u32(i + 1), box("data", u32(1), u32(0), v))), ...extra);
  return box("meta", hdlr, keys, ...(dupKeys ? [box("keys", u32(0), u32(1), Buffer.concat([u32(8 + 22), Buffer.from("mdta"), Buffer.from("com.vendor.capture.pos")]))] : []), ilst);
}
export const IPHONE_ITEMS = [
  ["com.apple.quicktime.location.accuracy.horizontal", PLANT.acc],
  ["com.apple.quicktime.location.ISO6709", PLANT.iso],
  ["com.apple.quicktime.make", "Apple"],
  ["com.apple.quicktime.model", "iPhone 17 Pro Max"],
];

function mvhd(slack = false) {
  const p = Buffer.alloc(100);
  p.writeUInt32BE(CAPTURE_UNIX_S + 2082844800, 4); // creation, 1904 epoch
  p.writeUInt32BE(CAPTURE_UNIX_S + 2082844800, 8);
  p.writeUInt32BE(600, 12); p.writeUInt32BE(6000, 16);
  return box("mvhd", slack ? Buffer.concat([p, BIN_PLANT]) : p);
}
function trak(timedKey, format = "mebx", second = null, nested = false, opaque = false, slack = false) {
  const mebx = box(format, Buffer.alloc(6), u16(1), box("keys", box(u32(1), box("keyd", "mdta", timedKey))));
  const entries = second ? [mebx, box(second, Buffer.alloc(6), u16(1), BIN_PLANT)] : [mebx];
  const stsd = box("stsd", u32(0), u32(entries.length), ...entries);
  // nested: a vendor box holding a binary fix at every container level
  const v = t => nested ? [box(t, BIN_PLANT)] : [];
  // opaque: a fix inside the small containers (gmhd, dinf, tref);
  // slack: a fix in the bytes past an stco table's last entry.
  const o = opaque ? [box("gmhd", box("gmin", Buffer.alloc(16)), box("gpsg", BIN_PLANT)), box("dinf", box("gpsd", BIN_PLANT))] : [];
  const tref = opaque ? [box("tref", box("gpsr", BIN_PLANT))] : [];
  const stco = slack ? [box("stco", u32(0), u32(0), BIN_PLANT)] : [];
  return box("trak", ...v("vgps"), ...tref, box("mdia", ...v("gpsm"), box("minf", ...v("gpsn"), ...o, box("stbl", stsd, ...stco, ...v("gpst")))));
}
// Deterministic filler that never spells a coordinate.
function filler(n, seed = 7) {
  const b = Buffer.alloc(n); let x = seed;
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; b[i] = 0x80 | (x >> 16 & 0x7f); }
  return b;
}

// A fix as raw float64s, the way a vendor's binary udta box or a GPS track
// carries it: no text for a regex to find.
export const BIN_PLANT = (() => { const b = Buffer.alloc(16); b.writeDoubleBE(PLANT.lat, 0); b.writeDoubleBE(PLANT.lng, 8); return b; })();

// A top-level XMP packet (Adobe's XMP UUID) carrying the fix in EXIF
// degrees,minutes form: nothing coordinate-shaped for a regex to match.
export const XMP_UUID = Buffer.from("BE7ACFCB97A942E89C71999491E3AFAC", "hex");
export const XMP_DM = { lat: "28,32.472N", lng: "81,23.922W" };
export const XMP_GPS = Buffer.from(`<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="${XMP_DM.lat}" exif:GPSLongitude="${XMP_DM.lng}" exif:GPSVersionID="2.2.0.0"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`, "latin1");

// opts: { timedKey, trackFormat, secondEntry, udtaBinary, oddItem, orphanItem, dupKeys, xmpUuid, xmpGps, nestedGps, opaqueGps, leafSlack, shortLeaf, mdatBytes, straddleAt, noGps }
export function buildMov(opts = {}) {
  const timedKey = opts.timedKey || "com.apple.quicktime.video-orientation";
  let items = opts.noGps ? IPHONE_ITEMS.slice(2) : IPHONE_ITEMS;
  if (opts.oddItem) items = [...items, ["com.vendor.capture.pos", BIN_PLANT]];
  const meta = metaBox(items, opts.orphanItem ? BIN_PLANT : null, !!opts.dupKeys);
  const udtaKids = opts.noGps ? [] : [box(Buffer.from("©xyz", "latin1"), u16(PLANT.iso.length), u16(0x15c7), PLANT.iso)];
  if (opts.udtaBinary) udtaKids.push(box("GPSb", BIN_PLANT));
  const udta = box("udta", ...udtaKids);
  const moov = box("moov", mvhd(!!opts.leafSlack), trak(timedKey, opts.trackFormat, opts.secondEntry, !!opts.nestedGps, !!opts.opaqueGps, !!opts.leafSlack), meta, udta, ...(opts.nestedGps ? [box("gps ", BIN_PLANT)] : []));
  let media = filler(opts.mdatBytes || 64 * 1024);
  if (!opts.noGps) {
    // orphaned meta copy + a bare coordinate string, as real clips carry
    meta.copy(media, 4096);
    Buffer.from(PLANT.iso, "latin1").copy(media, 20000);
    if (opts.straddleAt) Buffer.from(PLANT.iso, "latin1").copy(media, opts.straddleAt - 8);
  }
  const ftyp = box("ftyp", "qt  ", u32(0), "qt  ");
  const mdat = box("mdat", media);
  const free = box("free", opts.noGps ? Buffer.alloc(64) : meta);
  const tail = opts.xmpUuid ? [box("uuid", Buffer.alloc(16, 0xbe), BIN_PLANT)] : [];
  if (opts.xmpGps) tail.push(box("uuid", XMP_UUID, XMP_GPS));
  return { bytes: Buffer.concat([ftyp, box("wide"), mdat, moov, free, ...tail]), mdatStart: ftyp.length + 8 + 8 };
}
