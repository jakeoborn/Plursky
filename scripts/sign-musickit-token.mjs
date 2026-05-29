#!/usr/bin/env node
// Sign an Apple MusicKit developer token (ES256 JWT) — no npm deps.
//
// Prereqs (one-time, at developer.apple.com → Certificates, IDs & Profiles):
//   1. Keys → ➕ → enable "MusicKit" → Continue → Register → download the
//      private key file: AuthKey_XXXXXXXXXX.p8  (you can only download once)
//   2. Note the 10-char Key ID (shown on that key) and your Team ID
//      (top-right of the dev portal; Plursky team = X54Q9P743S).
//
// Usage:
//   node scripts/sign-musickit-token.mjs <TEAM_ID> <KEY_ID> <path/to/AuthKey_XXXX.p8>
//
// Example:
//   node scripts/sign-musickit-token.mjs X54Q9P743S ABC123DEF4 ~/Downloads/AuthKey_ABC123DEF4.p8
//
// Paste the printed token into APPLE_DEV_TOKEN in spotify-api.jsx, then bump
// the cache-bust + rebuild. Token is valid ~6 months — re-run to refresh.

import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const [teamId, keyId, p8Path] = process.argv.slice(2);
if (!teamId || !keyId || !p8Path) {
  console.error("Usage: node scripts/sign-musickit-token.mjs <TEAM_ID> <KEY_ID> <AuthKey_XXXX.p8>");
  process.exit(1);
}

const privateKey = readFileSync(p8Path, "utf8");
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

const header  = { alg: "ES256", kid: keyId };
const payload = { iss: teamId, iat: now, exp: now + 15777000 }; // ~6 months (Apple max)

const signingInput = `${b64(header)}.${b64(payload)}`;
// ieee-p1363 = raw R||S signature (JOSE format). Node's default is DER, which
// Apple rejects — this flag is the whole trick.
const sig = crypto.sign("sha256", Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });

console.log(`${signingInput}.${sig.toString("base64url")}`);
