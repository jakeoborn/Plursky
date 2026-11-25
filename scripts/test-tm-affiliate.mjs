#!/usr/bin/env node
// Ticketmaster affiliate links (artist.jsx, "Upcoming shows" TICKETS button).
//
// The wrapper is OFF until TM_AFFILIATE_BASE holds the Impact deep-link prefix
// from Jake's Ticketmaster affiliate account. This gate pins two promises:
//   1. Off (the committed state) means every link is byte-for-byte the plain
//      Ticketmaster URL, so merging this changes nothing anyone sees.
//   2. On, only https ticketmaster.* URLs are wrapped, a malformed base or a
//      foreign host falls back to the plain URL, and the wrapped link carries
//      rel="sponsored" plus the commission note.
//
//   node scripts/test-tm-affiliate.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "artist.jsx"), "utf8");
let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failed++; console.error(`  ✗ ${msg}`); } };

const grab = re => { const m = src.match(re); if (!m) { console.error(`✗ not found: ${re}`); process.exit(1); } return m[0]; };
const code = [
  grab(/const TM_AFFILIATE_BASE = .*;/),
  grab(/const _TM_AFF_BASE_RE = .*;/),
  grab(/const _TM_HOST_RE = .*;/),
  grab(/function tmAffiliateUrl\([\s\S]*?\n}\n/),
  "globalThis.out = { TM_AFFILIATE_BASE, tmAffiliateUrl };",
].join("\n");
const ctx = { URL }; vm.createContext(ctx); vm.runInContext(code, ctx);
const { TM_AFFILIATE_BASE, tmAffiliateUrl } = ctx.out;

console.log("Ticketmaster affiliate links");
const EV = "https://www.ticketmaster.com/fred-again-tickets/event/0C006123ABCD1234";
const BASE = "https://ticketmaster.evyy.net/c/1234567/264167/4272";

ok(TM_AFFILIATE_BASE === "", "committed state is off (empty base)");
ok(tmAffiliateUrl(EV, "artist_shows") === EV, "off: link unchanged");

const w = tmAffiliateUrl(EV, "artist_shows", BASE);
ok(w === `${BASE}?u=${encodeURIComponent(EV)}&subId1=artist_shows`, "on: wraps with u= and subId1=");
ok(new URL(w).searchParams.get("u") === EV, "on: wrapped link decodes back to the event URL");
ok(tmAffiliateUrl("https://www.ticketmaster.ca/event/1", "x", BASE).startsWith(BASE), "on: ticketmaster.ca wrapped");
ok(tmAffiliateUrl("https://www.livenation.com/event/1", "x", BASE) === "https://www.livenation.com/event/1", "on: other host unchanged");
ok(tmAffiliateUrl("https://evil-ticketmaster.com.example.org/e", "x", BASE) === "https://evil-ticketmaster.com.example.org/e", "on: look-alike host unchanged");
ok(tmAffiliateUrl("http://www.ticketmaster.com/e", "x", BASE) === "http://www.ticketmaster.com/e", "on: non-https unchanged");
ok(tmAffiliateUrl(EV, "x", "http://ticketmaster.evyy.net/c/1/2/3") === EV, "bad base (http) ignored");
ok(tmAffiliateUrl(EV, "x", "https://ticketmaster.evyy.net/c/1/2") === EV, "bad base (short path) ignored");
ok(tmAffiliateUrl(EV, "x", BASE + "?u=") === EV, "bad base (query) ignored");
ok(tmAffiliateUrl("not a url", "x", BASE) === "not a url", "unparseable URL unchanged");
ok(tmAffiliateUrl(null, "x", BASE) === null, "missing URL passes through");
ok(new URL(tmAffiliateUrl(EV, "a b/<c>", BASE)).searchParams.get("subId1") === "a_b__c_", "subId sanitised");

// The rendering side: the button uses the wrapper, says sponsored when wrapped,
// and the disclosure is shown only when a link was wrapped.
ok(/href=\{tmAffiliateUrl\(ev\.url, "artist_shows"\)\}/.test(src), "TICKETS button uses tmAffiliateUrl");
ok(/"sponsored noopener noreferrer"/.test(src), "wrapped link is rel=sponsored");
ok(/tmEvents\.some\(ev => ev\.url && tmAffiliateUrl\(ev\.url, "artist_shows"\) !== ev\.url\)[\s\S]{0,300}may earn a commission/.test(src),
  "commission note shown only when a link is wrapped");

if (failed) { console.error(`\n✗ ${failed} check(s) failed`); process.exit(1); }
console.log("  all checks pass");
