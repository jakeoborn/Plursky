#!/usr/bin/env node
// Warn before the Apple Music developer token runs out.
//
// APPLE_DEV_TOKEN in spotify-api.jsx is a signed JWT that Apple caps at about
// six months. When it lapses, every Apple Music call in the app (web and the
// native build) fails at once, and nothing in the repo notices: the token was
// ten days from expiry on 2026-11-17 with no alarm anywhere (SPEC-212 W5).
//
// This reads the token's own `exp` claim (no network, no key) and fails when
// fewer than --min-days remain. It runs from the scheduled page-freshness job,
// NOT from verify.mjs: a date-driven failure in verify would block unrelated
// pull requests, the way a festival ending used to.
//
//   node scripts/check-musickit-token.mjs                 # default 21 days
//   node scripts/check-musickit-token.mjs --min-days 30
//   node scripts/check-musickit-token.mjs --self-test     # planted tokens
//
// Renewal: node scripts/sign-musickit-token.mjs <TEAM_ID> <KEY_ID> <AuthKey.p8> --write
// (renews APPLE_DEV_TOKEN in place), bump the cache-bust, and ship a native build too
// (the native app bundles its own copy of the JS: CLAUDE.md §3).
import { readFileSync } from "node:fs";

const DAY = 86400000;

// The token's expiry and key id, or a reason it cannot be read. Pure.
export function tokenExpiry(source) {
  const m = /const\s+APPLE_DEV_TOKEN\s*=\s*"([^"]*)"/.exec(source);
  if (!m) return { error: "APPLE_DEV_TOKEN not found" };
  if (!m[1]) return { error: "APPLE_DEV_TOKEN is empty" };
  const parts = m[1].split(".");
  if (parts.length !== 3) return { error: "APPLE_DEV_TOKEN is not a JWT" };
  let head, body;
  try {
    head = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    body = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { return { error: "APPLE_DEV_TOKEN does not decode" }; }
  if (!Number.isFinite(body.exp)) return { error: "APPLE_DEV_TOKEN has no exp" };
  return { expMs: body.exp * 1000, kid: head.kid || null };
}

export function verdict(source, nowMs, minDays) {
  const t = tokenExpiry(source);
  if (t.error) return { ok: false, line: `✗ ${t.error}` };
  const days = (t.expMs - nowMs) / DAY;
  const when = new Date(t.expMs).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  if (days < 0) return { ok: false, days, line: `✗ Apple Music token (key ${t.kid}) EXPIRED ${when}` };
  if (days < minDays) return { ok: false, days, line: `✗ Apple Music token (key ${t.kid}) expires ${when}, ${Math.floor(days)} day(s) left (warn under ${minDays})` };
  return { ok: true, days, line: `✓ Apple Music token (key ${t.kid}) expires ${when}, ${Math.floor(days)} day(s) left` };
}

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

if (process.argv.includes("--self-test")) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const tok = exp => `const APPLE_DEV_TOKEN = "${b64({ alg: "ES256", kid: "TESTKEY" })}.${b64({ iss: "T", iat: 0, exp })}.sig";`;
  const now = Date.UTC(2026, 10, 17);
  const s = now / 1000;
  const cases = [
    ["90 days left", tok(s + 90 * 86400), true],
    ["10 days left", tok(s + 10 * 86400), false],
    ["expired", tok(s - 86400), false],
    ["empty", `const APPLE_DEV_TOKEN = "";`, false],
    ["missing", `const OTHER = "x";`, false],
    ["not a JWT", `const APPLE_DEV_TOKEN = "abc";`, false],
    ["no exp", `const APPLE_DEV_TOKEN = "${b64({ kid: "K" })}.${b64({ iss: "T" })}.sig";`, false],
  ];
  const miss = cases.filter(([, src, want]) => verdict(src, now, 21).ok !== want).map(([n]) => n);
  console.log(miss.length ? `✗ self-test missed: ${miss.join(", ")}` : `✓ check-musickit-token self-test: ${cases.length} cases`);
  process.exit(miss.length ? 1 : 0);
}

const minDays = Number(arg("--min-days", "21"));
const v = verdict(readFileSync("spotify-api.jsx", "utf8"), Date.now(), minDays);
console.log(v.line);
process.exit(v.ok ? 0 : 1);
