#!/usr/bin/env node
// Imported videos: no coordinate leaves the device.
//
// Photos leave as a canvas re-encode (no EXIF). Videos are stored raw, and
// "Back up my weekend" uploaded those bytes with the capture fix inside.
// This gate runs the REAL source functions, sliced out of the .jsx files:
//   V. _stripVideoGps on a clip carrying a fix in every place real iPhone
//      clips keep one (meta keys+ilst, udta ©xyz, top-level free, an orphaned
//      copy inside mdat, one string across the 8 MB scan-window seam): the
//      copy has no coordinate byte, the parser reads no fix, the capture time
//      and every other byte position survive; anything it cannot prove clean
//      is refused (null), never passed through.
//   S. The moments backup (_slimMomentsForSync) drops a video's parsedGps,
//      gpsAccM, heading and headingRef; `location` (label + metres) stays.
//   P. Positive controls: the fixture really carries the fix (the parser
//      reads it), and a payload with a planted coordinate trips the detector.
//   M. Mutations: each must turn a check red, or the check proves nothing.
//   R. Local only: every real clip under ~/Plursky-private (skipped on CI).
import { readFileSync, existsSync, readdirSync, openAsBlob } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildMov, PLANT, LEAKS, ISO_SHAPE, CAPTURE_UNIX_S, BIN_PLANT, XMP_DM } from "./lib/mov-fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PT = readFileSync(join(ROOT, "photo-tag.jsx"), "utf8");
const SB = readFileSync(join(ROOT, "supabase.jsx"), "utf8");
function slice(src, a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`slice markers not found: ${a} … ${b}`);
  return src.slice(i, j);
}
const STRIP_SRC = slice(PT, "// ── Video GPS strip for cloud backup", "// Given EXIF metadata + the list");
const PARSE_SRC = slice(PT, "async function _parseVideoMeta(file)", "// ── Video GPS strip for cloud backup");
const SLIM_SRC = slice(SB, "const _MOMENT_LOCAL_FIELDS", "// Ceiling on the moments blob");
const quiet = { warn() {}, log() {} };
const loadStrip = src => new Function("console", `${src}; return _stripVideoGps;`)(quiet);
const parse = new Function("window", `${PARSE_SRC}; function _festivalTzOffsetHours(){ return 0; } return _parseVideoMeta;`)({ FESTIVAL_CONFIG: null });
const loadSlim = src => new Function(`${src}; return _slimMomentsForSync;`)();

// The detector every check and the browser gate share.
export const leaksIn = buf => { const s = Buffer.from(buf).toString("latin1"); return LEAKS.some(l => s.includes(l)) || ISO_SHAPE.test(s) || s.includes("ISO6709"); };
const bytesOf = async b => Buffer.from(await b.arrayBuffer());
const blobOf = buf => new Blob([buf], { type: "video/quicktime" });

// Runs every V/S check against one (strip, slim) pair; returns failed names.
async function suite(strip, slim) {
  const failed = []; let total = 0;
  const ok = (c, name) => { total++; if (!c) failed.push(name); };
  const { bytes, mdatStart } = buildMov();
  const r = await strip(blobOf(bytes));
  ok(!!r && !!r.blob, "V1 a clip with GPS strips (returns a copy, not null)");
  if (r && r.blob) {
    const out = await bytesOf(r.blob);
    ok(out.length === bytes.length, "V2 same byte length (chunk offsets stay valid)");
    ok(!leaksIn(out), "V3 no coordinate, no ISO6709 key anywhere in the copy (meta, udta, free, mdat)");
    const m = await parse(blobOf(out));
    ok(m.lat == null && m.lng == null && m.acc == null, "V4 the app's own parser reads no fix or accuracy from the copy");
    ok(m.date && m.rawUtcMs === CAPTURE_UNIX_S * 1000, "V5 capture time still reads (mvhd untouched)");
    ok(out.toString("latin1").includes("iPhone 17 Pro Max"), "V6 non-location metadata kept");
    // Every byte outside the redactions is the original's: compare a mdat
    // stretch with no plant in it.
    ok(out.subarray(mdatStart + 30000, mdatStart + 60000).equals(bytes.subarray(mdatStart + 30000, mdatStart + 60000)), "V7 media bytes pass through unchanged");
    ok(r.redacted >= 4, `V8 every copy redacted (meta, ©xyz, mdat meta copy, mdat string; got ${r.redacted})`);
  }
  // Seam: a coordinate written across the 8 MB window boundary.
  const big = buildMov({ mdatBytes: 8 * 1024 * 1024 + 65536, straddleAt: 8 * 1024 * 1024 });
  const rb = await strip(blobOf(big.bytes));
  ok(rb && !leaksIn(await bytesOf(rb.blob)), "V9 a coordinate across the scan-window seam is redacted");
  // Fail closed.
  // A key name the final ISO6709 proof would NOT see, so only the track check can refuse it.
  ok((await strip(blobOf(buildMov({ timedKey: "com.apple.quicktime.location.body" }).bytes))) === null, "V10 a timed location track (values in mdat per frame) is refused");
  ok((await strip(blobOf(Buffer.from("\x1aE\xdf\xa3 not an ISO-BMFF file 28.5412", "latin1")))) === null, "V11 a non-QuickTime/MP4 file is refused");
  ok((await strip(blobOf(bytes.subarray(0, bytes.length - 40)))) === null, "V12 a truncated file is refused");
  ok((await strip(null)) === null, "V13 no blob → null, no throw");
  // Binary location (no text to grep): a vendor udta box, and a GPS track.
  const bin = buildMov({ udtaBinary: true });
  ok(bin.bytes.includes(BIN_PLANT), "V15 setup: the fixture carries a binary fix in udta");
  const rbin = await strip(blobOf(bin.bytes));
  ok(rbin && !(await bytesOf(rbin.blob)).includes(BIN_PLANT), "V15 a binary fix in an unknown udta box is blanked");
  ok((await strip(blobOf(buildMov({ trackFormat: "gpmd" }).bytes))) === null, "V16 a track with a non-allowlisted sample format (GoPro gpmd) is refused");
  ok((await strip(blobOf(buildMov({ trackFormat: "camm" }).bytes))) === null, "V16b a camm (camera motion/GPS) track is refused");
  ok((await strip(blobOf(buildMov({ secondEntry: "gpmd" }).bytes))) === null, "V16c a gpmd sample entry behind an allowed first entry is refused");
  // Deny by default: a timed key with no location in its name, a static
  // item under an unknown key, a top-level XMP uuid, a subtitle track.
  ok((await strip(blobOf(buildMov({ timedKey: "com.vendor.track.pos" }).bytes))) === null, "V17 a timed key that is not on the known list is refused (whatever it is called)");
  const odd = buildMov({ oddItem: true, xmpUuid: true });
  ok(odd.bytes.includes(BIN_PLANT), "V18 setup: the fixture carries a binary fix under an odd key and in a uuid box");
  const rodd = await strip(blobOf(odd.bytes));
  ok(rodd && !(await bytesOf(rodd.blob)).includes(BIN_PLANT), "V18 a static item under an unknown key and a top-level uuid are blanked");
  ok(rodd && (await bytesOf(rodd.blob)).toString("latin1").includes("iPhone 17 Pro Max"), "V18b keep-listed items (model) survive");
  ok((await strip(blobOf(buildMov({ trackFormat: "tx3g" }).bytes))) === null, "V19 a subtitle (tx3g) track is refused");
  const orphan = buildMov({ orphanItem: true });
  ok(orphan.bytes.includes(BIN_PLANT), "V20 setup: an ilst item whose index no key names carries a binary fix");
  const ro = await strip(blobOf(orphan.bytes));
  ok(ro && !(await bytesOf(ro.blob)).includes(BIN_PLANT), "V20 an ilst item past the keys table is blanked (keep-by-allowlist)");
  ok((await strip(blobOf(buildMov({ dupKeys: true }).bytes))) === null, "V21 a meta with two keys tables (ambiguous index) is refused");
  // Reviewer case on af724411: a top-level XMP uuid with exif:GPSLatitude /
  // GPSLongitude in degrees,minutes form went through byte-identical.
  const xmp = buildMov({ noGps: true, xmpGps: true });
  const xs = xmp.bytes.toString("latin1");
  ok(xs.includes("exif:GPSLatitude") && xs.includes(XMP_DM.lat) && !leaksIn(xmp.bytes), "V22 setup: XMP GPS in degrees,minutes, invisible to the coordinate detector");
  const rx = await strip(blobOf(xmp.bytes));
  const xo = rx ? (await bytesOf(rx.blob)).toString("latin1") : "";
  ok(rx && xo.length === xmp.bytes.length && !xo.includes("GPSLatitude") && !xo.includes(XMP_DM.lat) && !xo.includes(XMP_DM.lng) && !xo.includes("xmpmeta"), "V22 a top-level XMP uuid is blanked whole (no GPSLatitude, no degrees,minutes, no packet)");
  // The reviewer's own file (scripts/fixtures/xmp-gps-fixture.mp4, fake
  // coordinates): a playable MP4 with that XMP uuid after moov.
  const rf = readFileSync(join(ROOT, "scripts/fixtures/xmp-gps-fixture.mp4"));
  ok(rf.toString("latin1").includes('exif:GPSLatitude="28,32.472N"'), "V23 setup: the reviewer's xmp-gps fixture carries exif:GPSLatitude");
  const rr = await strip(blobOf(rf));
  const ro2 = rr ? (await bytesOf(rr.blob)).toString("latin1") : "";
  ok(rr && ro2.length === rf.length && !/GPSLatitude|GPSLongitude|28,32\.472N|81,23\.922W|xmpmeta/.test(ro2), "V23 the reviewer's xmp-gps fixture uploads with no XMP GPS left");
  const clean = buildMov({ noGps: true });
  const rc = await strip(blobOf(clean.bytes));
  ok(rc && (await bytesOf(rc.blob)).equals(clean.bytes), "V14 a clip with no GPS uploads byte-identical");

  // S. moments backup
  const all = { 2: [
    { id: "v1", kind: "video", artistId: "kaskade", night: 2, parsedGps: { lat: PLANT.lat, lng: PLANT.lng }, gpsAccM: 6, heading: 211, headingRef: "T", location: { label: "Water", type: "water", icon: "💧", distMeters: 40 } },
    { id: "v2", kind: "video", artistId: "maddix", night: 2, parsedGps: null, hasGps: false },
  ] };
  const out = slim(all);
  const js = JSON.stringify(out);
  ok(!leaksIn(Buffer.from(js)) && !/parsedGps|gpsAccM|"heading"|headingRef/.test(js), "S1 a video moment's parsedGps, gpsAccM, heading, headingRef do not back up");
  ok(out[2][0].id === "v1" && out[2][0].artistId === "kaskade" && out[2][0].location?.label === "Water" && !("lat" in out[2][0].location), "S2 tag, night and amenity label still back up (no coordinates in it)");
  ok(all[2][0].parsedGps?.lat === PLANT.lat, "S3 the on-device record keeps its fix (pins, retag)");
  return { failed, total };
}

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log(`  ✗ ${msg}`); } };

// P. positive controls
{
  const { bytes } = buildMov();
  ok(leaksIn(bytes), "P1 the fixture carries the planted coordinate (the detector is not blind)");
  const m = await parse(blobOf(bytes));
  ok(Math.abs(m.lat - PLANT.lat) < 1e-9 && Math.abs(m.lng - PLANT.lng) < 1e-9 && m.acc === 6, "P2 the app's parser reads the planted fix from the fixture");
  ok(leaksIn(Buffer.from(JSON.stringify({ meta: { moments: { 1: [{ parsedGps: { lat: 28.5412, lng: -81.3987 } }] } } }))), "P3 a planted coordinate in a JSON payload trips the detector");
}

// V + S on the shipped source
{
  const { failed, total } = await suite(loadStrip(STRIP_SRC), loadSlim(SLIM_SRC));
  for (const f of failed) ok(false, f);
  pass += total - failed.length;
}

// M. mutations
const MUTANTS = [
  ["udta location boxes left in place", STRIP_SRC.replace('type === "©xyz" || type === "loci" || (parentType === "udta" && type !== "meta")', "false"), SLIM_SRC],
  ["top-level free copy left in place", STRIP_SRC.replace('if (type === "free" || type === "skip") {\n        zero(payload, boxEnd);', 'if (type === "free" || type === "skip") {'), SLIM_SRC],
  ["location keys not recognised", STRIP_SRC.replace("if (_VGPS_KEY_RE.test(name)) {", "if (false) {"), SLIM_SRC],
  ["mdat passed through unscanned", STRIP_SRC.replace("const r = await _vgpsScanMedia(blob, pos + hdr, pos + boxSize);", "const r = { parts: [blob.slice(pos + hdr, pos + boxSize)], n: 0 };"), SLIM_SRC],
  ["no window overlap", STRIP_SRC.replace("_VGPS_OVERLAP = 4096", "_VGPS_OVERLAP = 0"), SLIM_SRC],
  ["any udta child kept (only ©xyz/loci blanked)", STRIP_SRC.replace(' || (parentType === "udta" && type !== "meta")', ""), SLIM_SRC],
  ["only the first sample entry checked", STRIP_SRC.replace("k < count; k++", "k < Math.min(count, 1); k++"), SLIM_SRC],
  ["track-format allowlist off", STRIP_SRC.replace("if (!_VGPS_TRACK_FORMATS.has(fmt))", "if (false)"), SLIM_SRC],
  ["timed location track not refused", STRIP_SRC.replace('{ refuse = "timed location track"; return; }', "{}").replace('if (!_VGPS_TIMED_KEYS.has(name)) { refuse', 'if (false) { refuse'), SLIM_SRC],
  ["timed-key allowlist off (unknown non-location-named key passes)", STRIP_SRC.replace('if (!_VGPS_TIMED_KEYS.has(name)) { refuse', 'if (false) { refuse'), SLIM_SRC],
  ["static meta items not on the keep list kept", STRIP_SRC.replace("if (!inner.keep.has(it.idx) || inner.hit.has(it.idx))", "if (inner.hit.has(it.idx))"), SLIM_SRC],
  ["duplicate keys table accepted", STRIP_SRC.replace('if (scope.keysSeen++) { refuse = "duplicate keys table"; return; }', ""), SLIM_SRC],
  ["ilst index past the keys table kept (blank-list, fail open)", STRIP_SRC.replace("if (!inner.keep.has(it.idx) || inner.hit.has(it.idx))", "if (inner.hit.has(it.idx) || (it.idx <= inner.keep.size + inner.hit.size && !inner.keep.has(it.idx)))"), SLIM_SRC],
  ["top-level boxes allowlist off (uuid/XMP passes)", STRIP_SRC.replace('} else if (depth === 0 && !["moov", "meta", "ftyp", "wide", "pdin"].includes(type)) {', '} else if (false) {').replace('type === "uuid" || type === "XMP_" || ', ""), SLIM_SRC],
  ["top-level uuid kept", STRIP_SRC.replace('} else if (depth === 0 && !["moov", "meta", "ftyp", "wide", "pdin"].includes(type)) {', '} else if (false) {').replace('type === "uuid" || type === "XMP_" || ', ""), SLIM_SRC],
  ["text track allowed", STRIP_SRC.replace('"mebx", "tmcd",\n]);', '"mebx", "tmcd", "tx3g",\n]);'), SLIM_SRC],
  ["moments backup keeps video coordinates", STRIP_SRC, SLIM_SRC.replace('if (copy.kind === "video") for (const f of _VIDEO_COORD_FIELDS) delete copy[f];', "")],
];
for (const [name, strip, slimSrc] of MUTANTS) {
  if (strip === STRIP_SRC && slimSrc === SLIM_SRC) { ok(false, `M setup: mutation "${name}" did not apply`); continue; }
  const { failed } = await suite(loadStrip(strip), loadSlim(slimSrc));
  ok(failed.length > 0, `M mutation "${name}" turns a check red`);
  if (failed.length) console.log(`  · mutation "${name}" caught by: ${failed[0]}`);
}

// R. real clips (local only)
{
  const dir = join(homedir(), "Plursky-private/vegas-edc-export/festival-candidates");
  if (!existsSync(dir)) console.log("  · R skipped: no private clips on this machine");
  else {
    const strip = loadStrip(STRIP_SRC);
    let n = 0, gps = 0, leaked = 0, refused = 0;
    for (const f of readdirSync(dir).filter(x => /\.(mov|mp4)$/i.test(x))) {
      n++;
      const blob = await openAsBlob(join(dir, f));
      if ((await parse(blob)).lat != null) gps++;
      const r = await strip(blob);
      if (!r) { refused++; continue; }
      const out = await bytesOf(r.blob);
      if (leaksIn(out) || (await parse(blobOf(out))).lat != null || out.length !== blob.size) { leaked++; console.log(`  ✗ R ${f} still carries a fix`); }
    }
    console.log(`  · R real clips: ${n} files, ${gps} with GPS, ${leaked} leaked, ${refused} refused`);
    ok(leaked === 0, "R every real clip strips clean");
  }
}

console.log(`test-video-gps-strip: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
