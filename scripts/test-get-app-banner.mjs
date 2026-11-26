#!/usr/bin/env node
// "Get the app" card on the web landing (landing.jsx, GetTheAppCard).
//
// Pins who sees it: web visitors on desktop and in iPhone in-app browsers
// (Instagram, TikTok, Chrome on iOS) see it; the iPhone app itself, Android,
// iPhone Safari (which already shows the Smart App Banner) and anyone who
// closed it in the last 30 days do not. Also pins that the card is on the
// landing and links to the App Store listing.
//
//   node scripts/test-get-app-banner.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "landing.jsx"), "utf8");
const index = readFileSync(join(ROOT, "index.html"), "utf8");
const spotify = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failed++; console.error(`  ✗ ${msg}`); } };
const grab = re => { const m = src.match(re); if (!m) { console.error(`✗ not found: ${re}`); process.exit(1); } return m[0]; };

const code = [
  grab(/const GET_APP_HIDE_DAYS = .*;/),
  grab(/function _getAppBannerVisible\([\s\S]*?\n}\n/),
  "globalThis.out = { GET_APP_HIDE_DAYS, _getAppBannerVisible };",
].join("\n");
const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx);
const { GET_APP_HIDE_DAYS, _getAppBannerVisible: vis } = ctx.out;

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.0 (iPhone15,2; iOS 18_1; en_US)",
  tiktok: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.0.0 BytedanceWebview/d8a21c6",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const NOW = Date.UTC(2026, 10, 25);
const DAY = 86400000;

console.log("Get the app card");
ok(vis(UA.winChrome, false, null, NOW) === true, "desktop Chrome sees it");
ok(vis(UA.macSafari, false, null, NOW) === true, "Mac Safari sees it");
ok(vis(UA.iosChrome, false, null, NOW) === true, "Chrome on iPhone sees it (no Smart App Banner there)");
ok(vis(UA.instagram, false, null, NOW) === true, "Instagram's in-app browser sees it");
ok(vis(UA.tiktok, false, null, NOW) === true, "TikTok's in-app browser sees it");
ok(vis(UA.iosSafari, false, null, NOW) === false, "iPhone Safari does not (Smart App Banner covers it)");
ok(vis(UA.android, false, null, NOW) === false, "Android does not (iPhone-only app)");
ok(vis(UA.iosChrome, true, null, NOW) === false, "the iPhone app itself does not");
ok(vis(UA.winChrome, false, String(NOW - 2 * DAY), NOW) === false, "closed 2 days ago: hidden");
ok(vis(UA.winChrome, false, String(NOW - (GET_APP_HIDE_DAYS + 1) * DAY), NOW) === true, "closed 31 days ago: back");
ok(vis(UA.winChrome, false, "garbage", NOW) === true, "unreadable dismissal: shown");
ok(vis("", false, null, NOW) === true, "no user agent: shown");
ok(GET_APP_HIDE_DAYS === 30, "hide window is 30 days");

console.log("Wiring");
ok(/<\/header>\s*\n\s*<GetTheAppCard \/>/.test(src), "GeneralLandingScreen renders the card right under its header");
ok(/_appStoreUrl\(\)/.test(src.slice(src.indexOf("function GetTheAppCard"))), "the link uses _appStoreUrl()");
ok(/const APP_STORE_ID = \d{9,12};/.test(spotify), "APP_STORE_ID is set, so the link is the listing, not a search");
ok(/<meta name="apple-itunes-app" content="app-id=\d+">/.test(index), "index.html keeps the Smart App Banner the Safari case relies on");
ok(/localStorage\.setItem\(GET_APP_DISMISS_KEY/.test(src), "closing it is remembered");

if (failed) { console.error(`\n✗ ${failed} check(s) failed`); process.exit(1); }
console.log("\n✓ get-app banner: all checks passed");
