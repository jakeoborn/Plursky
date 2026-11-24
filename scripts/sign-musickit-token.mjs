#!/usr/bin/env node
// Sign an Apple MusicKit developer token (ES256 JWT), no npm deps.
//
// Run it from the repo folder (cd ~/Plursky first; from anywhere else Node
// cannot find scripts/ and says MODULE_NOT_FOUND).
//
//   node scripts/sign-musickit-token.mjs <TEAM_ID> <KEY_ID> <path/to/AuthKey_XXXX.p8>           # print the token
//   node scripts/sign-musickit-token.mjs <TEAM_ID> <KEY_ID> <path/to/AuthKey_XXXX.p8> --write   # renew it in spotify-api.jsx
//
//   e.g. node scripts/sign-musickit-token.mjs X54Q9P743S ABC123DEF4 ~/Downloads/AuthKey_ABC123DEF4.p8 --write
//
// The token is APPLE_DEV_TOKEN in spotify-api.jsx. It is public by design;
// only the signed JWT ships, never the .p8. Apple caps it at ~6 months
// (scripts/check-musickit-token.mjs warns ahead). After --write: bump the
// cache-bust, commit, push (web) and ship an iOS build (the app bundles it).
//
// Before printing or writing, the script checks its own output: the key is
// P-256, the signature verifies, exp is inside Apple's cap, and a key file
// named AuthKey_<id>.p8 matches KEY_ID, so a token is never labelled with
// one key and signed with another.
//
// A new key, one time (developer.apple.com → Certificates, Identifiers & Profiles):
//   Keys → ➕ → name "Plursky MusicKit" → enable Media Services (MusicKit) →
//   Continue → Register → Download AuthKey_XXXXXXXXXX.p8. Apple lets you
//   download it ONCE. Keep it out of the repo and out of chat. The 10-char
//   Key ID is on the key's page and in the filename.

import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const WRITE = argv.includes("--write");
const target = opt("--target") || join(dirname(fileURLToPath(import.meta.url)), "..", "spotify-api.jsx");   // --target: tests use a copy
const [teamId, keyId, p8Arg] = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--target");
const die = msg => { console.error(`✗ ${msg}`); process.exit(1); };
if (!teamId || !keyId || !p8Arg) die("usage: node scripts/sign-musickit-token.mjs <TEAM_ID> <KEY_ID> <AuthKey_XXXX.p8> [--write]");
if (!/^[A-Z0-9]{10}$/.test(teamId) || !/^[A-Z0-9]{10}$/.test(keyId)) die("TEAM_ID and KEY_ID are 10 capital letters/digits each");
const p8Path = p8Arg.replace(/^~/, homedir());
if (!existsSync(p8Path)) die(`key file not found: ${p8Path}`);
const fileKid = /AuthKey_([A-Z0-9]{10})\.p8$/.exec(basename(p8Path))?.[1];
if (fileKid && fileKid !== keyId) die(`the key file is ${fileKid} but KEY_ID is ${keyId}`);

const TOKEN_RE = /const APPLE_DEV_TOKEN = "([^"]*)";/;
const src = WRITE ? (existsSync(target) ? readFileSync(target, "utf8") : "") : "";
if (WRITE && !TOKEN_RE.test(src)) die(`no APPLE_DEV_TOKEN line in ${target}`);

const privateKey = readFileSync(p8Path, "utf8");
let pub; try { pub = crypto.createPublicKey(privateKey); } catch { die("the key file is not a private key"); }
if (pub.asymmetricKeyDetails?.namedCurve !== "prime256v1") die("not a P-256 key: MusicKit keys are ES256");

const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header  = { alg: "ES256", kid: keyId };
const payload = { iss: teamId, iat: now, exp: now + 15777000 }; // ~6 months (Apple max)
const signingInput = `${b64(header)}.${b64(payload)}`;
// ieee-p1363 = raw R||S signature (JOSE format). Node's default is DER, which
// Apple rejects — this flag is the whole trick.
const sig = crypto.sign("sha256", Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });
if (!crypto.verify("sha256", Buffer.from(signingInput), { key: pub, dsaEncoding: "ieee-p1363" }, sig)) die("the signature does not verify against this key");
const token = `${signingInput}.${sig.toString("base64url")}`;

if (!WRITE) { console.log(token); process.exit(0); }
writeFileSync(target, src.replace(TOKEN_RE, `const APPLE_DEV_TOKEN = "${token}";`));
console.log(`✓ APPLE_DEV_TOKEN renewed in ${basename(target)}: kid ${keyId}, expires ${new Date(payload.exp * 1000).toISOString()}`);
