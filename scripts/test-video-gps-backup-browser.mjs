#!/usr/bin/env node
// Imported videos, in the real app: "Back up my weekend" and the moments
// backup send no coordinate.
//
//   W1 the backup uploads the clip (one storage upload, same byte length).
//   W2 the uploaded bytes carry no planted coordinate and no ISO6709 key.
//   W3 the moments push (user_data upsert) carries the video moment, its tag
//      and amenity label, and none of parsedGps, gpsAccM, heading, headingRef.
//   W4 NO request on the wire (any host, URL or body, fetch, XHR or beacon)
//      carries a planted coordinate.
//   W5 fail closed: a clip whose fix cannot be stripped is held back (not
//      uploaded, counted in gpsHeld), and the rest still back up.
//   PC positive control: the same flow with the strip and the slim replaced by
//      pass-throughs MUST trip W2, W3 and W4, so the wire capture really sees
//      both payloads.
// Supabase is stubbed at the network layer; nothing leaves the machine.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";
import { buildMov, PLANT, LEAKS, ISO_SHAPE } from "./lib/mov-fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const leaks = s => LEAKS.some(l => s.includes(l)) || ISO_SHAPE.test(s) || s.includes("ISO6709");

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "edc-orlando-2026";
const BOOT = `http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=lineup`;
const CLIP = buildMov().bytes;
const HELD = buildMov({ timedKey: "com.apple.quicktime.location.ISO6709" }).bytes;

// Every outbound body, serialised in the page before it is sent: fetch
// (string, Blob, FormData, buffers), XHR and sendBeacon. Blob bytes are read
// as latin1 so binary uploads are greppable.
const WIRE_TAP = () => {
  const tap = window.__wire = [];
  const asText = async b => {
    if (b == null) return "";
    if (typeof b === "string") return b;
    if (b instanceof Blob) { const u = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return s; }
    if (b instanceof FormData) { let s = ""; for (const [k, v] of b.entries()) s += k + "=" + (await asText(v)) + "\n"; return s; }
    if (b instanceof URLSearchParams) return b.toString();
    if (b instanceof ArrayBuffer || ArrayBuffer.isView(b)) return asText(new Blob([b]));
    return String(b);
  };
  const of = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const method = (init && init.method) || (input && input.method) || "GET";
    let body = init && init.body;
    if (body == null && input instanceof Request) { try { body = await input.clone().blob(); } catch {} }
    tap.push({ via: "fetch", method, url: String(url), body: await asText(body), size: body instanceof Blob ? body.size : null, isForm: body instanceof FormData });
    return of.apply(this, arguments);
  };
  const xs = XMLHttpRequest.prototype.send, xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) { asText(b).then(t => tap.push({ via: "xhr", method: this.__m, url: String(this.__u), body: t })); return xs.apply(this, arguments); };
  if (navigator.sendBeacon) { const sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (u, b) => { asText(b).then(t => tap.push({ via: "beacon", url: String(u), body: t })); return sb(u, b); }; }
};

async function newCtx(browser) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 393, height: 852 } });
  await wireVendor(ctx);
  // Supabase, stubbed: storage upload accepts, user_data read is empty, upsert accepts.
  await ctx.route(/supabase\.co/, r => {
    const u = r.request().url(), m = r.request().method();
    if (/\/storage\/v1\/object\//.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "moment-media/x" }) });
    if (/\/rest\/v1\/user_data/.test(u) && m === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ artist_ids: [], notes: {}, meta: {} }) });
    return r.fulfill({ status: 201, contentType: "application/json", body: "[]" });
  });
  await ctx.addInitScript(fid => {
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
  }, FID);
  await ctx.addInitScript(WIRE_TAP);
  return ctx;
}

// Seeds two video moments shaped as the import loop writes them and stores
// their raw bytes in the app's IndexedDB, then runs the real backup + push.
async function runFlow(page, { passthrough }) {
  return page.evaluate(async ({ clip, held, fid, plant, passthrough }) => {
    const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const timed = ARTISTS.filter(a => a.start && a.end && a.day === 2);
    const mk = (id, artist, extra = {}) => ({
      id, night: 2, text: "", artistId: artist.id, photoId: `p_${id}`, posterId: null, kind: "video", duration: 10,
      createdAt: 1, takenAt: "2026-11-07 22:45:00", takenAtSource: "video-mvhd", autoTagged: true, tagSource: "exif",
      festivalId: fid, festivalStampSource: "capture-time", parsedGps: { lat: plant.lat, lng: plant.lng }, gpsAccM: 6,
      heading: 211, headingRef: "T", hasGps: true, location: { label: "Water", type: "water", icon: "💧", distMeters: 40 }, ...extra,
    });
    localStorage.setItem("plursky_moments_v1", JSON.stringify({ 2: [mk("v_ok", timed[0]), mk("v_held", timed[1] || timed[0])] }));
    await _putPhoto("p_v_ok", new Blob([bytes(clip)], { type: "video/quicktime" }));
    await _putPhoto("p_v_held", new Blob([bytes(held)], { type: "video/quicktime" }));
    window.sbGetUser = async () => ({ id: "u-test" });
    if (passthrough) {
      window._stripVideoGps = async b => ({ blob: b, redacted: 0 });
      window._slimMomentsForSync = all => all;
    }
    window.__wire.length = 0;
    const res = await _backupMyWeekend();
    await sbPushMoments();
    await new Promise(r => setTimeout(r, 300)); // let XHR/beacon taps settle
    return { res, wire: window.__wire };
  }, { clip: CLIP.toString("base64"), held: HELD.toString("base64"), fid: FID, plant: PLANT, passthrough });
}

function judge(out, label) {
  const ups = out.wire.filter(w => /\/storage\/v1\/object\/moment-media\//.test(w.url) && w.method !== "GET");
  const upOk = ups.filter(w => /p_v_ok/.test(w.url));
  const upHeld = ups.filter(w => /p_v_held/.test(w.url));
  const pushes = out.wire.filter(w => /\/rest\/v1\/user_data/.test(w.url) && w.method === "POST");
  const pushBody = pushes.map(p => p.body).join("\n");
  return {
    W1: upOk.length === 1 && upOk[0].body.length >= CLIP.length,
    W2: upOk.length === 1 && !leaks(upOk[0].body),
    W3: pushes.length >= 1 && pushBody.includes("v_ok") && pushBody.includes("Water") && !leaks(pushBody) && !/parsedGps|gpsAccM|"heading"|headingRef/.test(pushBody),
    W4: !out.wire.some(w => leaks(w.url) || leaks(w.body || "")),
    W5: upHeld.length === 0 && out.res && out.res.gpsHeld === 1 && out.res.done === 1,
    n: { uploads: ups.length, pushes: pushes.length, wire: out.wire.length, res: out.res },
  };
}

let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const boot = async () => {
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(BOOT, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof _backupMyWeekend === "function" && typeof _stripVideoGps === "function", FID, { timeout: 60000 });
    return { ctx, page, errors };
  };

  {
    const { ctx, page, errors } = await boot();
    const j = judge(await runFlow(page, { passthrough: false }), "app");
    console.log(`  · wire: ${j.n.wire} requests, ${j.n.uploads} uploads, ${j.n.pushes} moments pushes; backup ${JSON.stringify(j.n.res)}`);
    check(j.W1, "W1 the backup uploads the clip once, full length");
    check(j.W2, "W2 the uploaded bytes carry no coordinate and no ISO6709 key");
    check(j.W3, "W3 the moments push keeps tag + amenity label and carries no coordinate field");
    check(j.W4, "W4 no request anywhere carries a planted coordinate (URL or body)");
    check(j.W5, "W5 a clip that cannot be proven clean is held back, the other still backs up");
    check(!errors.length, `no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  {
    const { ctx, page } = await boot();
    const j = judge(await runFlow(page, { passthrough: true }), "control");
    check(!j.W2, "PC upload: with the strip bypassed, the wire capture sees the coordinate in the uploaded bytes");
    check(!j.W3, "PC push: with the slim bypassed, the wire capture sees the coordinate in the moments push");
    check(!j.W4, "PC wire: the any-request scan trips on the planted coordinate");
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`test-video-gps-backup-browser: ${checks - failed}/${checks} passed`);
process.exit(failed ? 1 : 0);
