#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2] || path.resolve('vegas-edc-export/festival-candidates');
const files = (await fs.readdir(root)).filter(name => /\.(mov|mp4|m4v|jpe?g|heic|png)$/i.test(name)).sort();

function parseVideoMeta(buffer) {
  const out = { date: null, gps: null, source: null };
  const u32 = (off) => buffer.readUInt32BE(off);
  const typeAt = (off) => buffer.toString('latin1', off, off + 4);
  function parseIso6709(s) {
    const m = /([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(s || '');
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  }
  function readAscii(start, end) {
    let s = '';
    for (let i = start; i < Math.min(end, start + 256, buffer.length); i++) {
      const c = buffer[i];
      if (!c) continue;
      if (c >= 32 && c <= 126) s += String.fromCharCode(c);
    }
    return s;
  }
  function visit(start, end, depth) {
    if (depth > 8) return;
    let pos = start;
    while (pos + 8 <= end && pos + 8 <= buffer.length) {
      let size = u32(pos);
      const type = typeAt(pos + 4);
      let hdr = 8;
      if (size === 1 && pos + 16 <= buffer.length) {
        size = u32(pos + 8) * 4294967296 + u32(pos + 12);
        hdr = 16;
      } else if (size === 0) size = end - pos;
      if (!size || size < hdr || pos + size > buffer.length + 1) break;
      const payload = pos + hdr;
      const boxEnd = Math.min(buffer.length, pos + size);
      if (!out.date && type === 'mvhd' && boxEnd - payload >= 16) {
        const ver = buffer[payload];
        const secs = ver === 1 && boxEnd - payload >= 28
          ? u32(payload + 4) * 4294967296 + u32(payload + 8)
          : u32(payload + 4);
        const unixMs = (secs - 2082844800) * 1000;
        if (secs > 2082844800 && Number.isFinite(unixMs)) {
          out.date = new Date(unixMs).toISOString();
          out.source = 'mvhd';
        }
      }
      if (!out.gps && type === '©xyz') out.gps = parseIso6709(readAscii(payload, boxEnd));
      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta', 'ilst'].includes(type)) {
        visit(type === 'meta' ? Math.min(boxEnd, payload + 4) : payload, boxEnd, depth + 1);
      }
      pos += size;
    }
  }
  visit(0, buffer.length, 0);
  return out;
}

function parseJpegExif(buffer) {
  const out = { date: null, gps: null, source: null };
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return out;
  let off = 2;
  while (off + 4 < buffer.length) {
    if (buffer[off] !== 0xff) break;
    const marker = buffer.readUInt16BE(off);
    const len = buffer.readUInt16BE(off + 2);
    if (marker === 0xffe1 && len > 8 && buffer.toString('latin1', off + 4, off + 8) === 'Exif') {
      const tiff = off + 10;
      const little = buffer.readUInt16BE(tiff) === 0x4949;
      const r16 = (p) => little ? buffer.readUInt16LE(p) : buffer.readUInt16BE(p);
      const r32 = (p) => little ? buffer.readUInt32LE(p) : buffer.readUInt32BE(p);
      const readEntries = (ifd) => {
        const n = r16(ifd); const entries = new Map();
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12;
          entries.set(r16(e), { type: r16(e + 2), count: r32(e + 4), valOff: e + 8 });
        }
        return entries;
      };
      const ifd0 = tiff + r32(tiff + 4);
      const ifd0e = readEntries(ifd0);
      const exifPtr = ifd0e.get(0x8769);
      if (exifPtr) {
        const exif = readEntries(tiff + r32(exifPtr.valOff));
        const dto = exif.get(0x9003);
        if (dto) {
          const strOff = dto.count > 4 ? tiff + r32(dto.valOff) : dto.valOff;
          const str = buffer.toString('latin1', strOff, strOff + Math.min(dto.count, 24)).replace(/\0.*$/, '');
          out.date = str;
          out.source = 'exif';
        }
      }
      const gpsPtr = ifd0e.get(0x8825);
      if (gpsPtr) out.gps = { present: true };
      return out;
    }
    off += 2 + len;
  }
  return out;
}

const rows = [];
for (const name of files) {
  const full = path.join(root, name);
  const buffer = await fs.readFile(full);
  const isVideo = /\.(mov|mp4|m4v)$/i.test(name);
  const meta = isVideo ? parseVideoMeta(buffer) : parseJpegExif(buffer);
  rows.push({ name, kind: isVideo ? 'video' : 'image', source: meta.source || 'none', date: meta.date || '', gps: !!meta.gps, size: buffer.length });
}
const byKind = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc; }, {});
const withDate = rows.filter(r => r.date).length;
const withGps = rows.filter(r => r.gps).length;
console.log(JSON.stringify({ root, files: rows.length, byKind, withDate, withGps, missingDate: rows.filter(r => !r.date).slice(0, 20) }, null, 2));
if (!rows.length) process.exit(1);
if (withDate < Math.floor(rows.length * 0.5)) process.exit(2);
