#!/usr/bin/env node
// sign-musickit-token.mjs (print and --write), against THROWAWAY keys and a COPY of
// spotify-api.jsx in a temp dir. No real .p8 is read and the repo file is
// never touched. Proves: a renewal keeps the live kid, verifies, stays inside
// Apple's 6-month cap and replaces only the token; and refuses a key file
// naming a different KEY_ID, a non-P-256 key, and a file with no token line.
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEN = join(ROOT, "scripts", "sign-musickit-token.mjs");
const TEAM = "X54Q9P743S";
const dir = mkdtempSync(join(tmpdir(), "musickit-renew-"));
let checks = 0, fails = 0, broken = 0, brokenOk = 0;
const ok = (c, m) => { checks++; if (/^broken fixture/.test(m)) { broken++; if (c) brokenOk++; } if (!c) { fails++; console.log(`  ✗  ${m}`); } };
const run = args => { try { return { code: 0, out: execFileSync(process.execPath, [GEN, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` }; } };
const part = (t, i) => JSON.parse(Buffer.from(t.split(".")[i], "base64url").toString());

try {
  const SRC = readFileSync(join(ROOT, "spotify-api.jsx"), "utf8");
  const live = /const APPLE_DEV_TOKEN = "([^"]*)";/.exec(SRC)[1];
  const kid = part(live, 0).kid;
  ok(/^[A-Z0-9]{10}$/.test(kid), `the live token carries a 10-char kid (${kid})`);

  const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" });
  const keyFile = join(dir, `AuthKey_${kid}.p8`);
  writeFileSync(keyFile, ec);
  const target = join(dir, "spotify-api.jsx");

  // 1. Renewal with the same key.
  writeFileSync(target, SRC);
  const r = run([TEAM, kid, keyFile, "--write", "--target", target]);
  ok(r.code === 0, `renewal exits 0 (${r.out.trim()})`);
  const after = readFileSync(target, "utf8");
  const tok = /const APPLE_DEV_TOKEN = "([^"]*)";/.exec(after)?.[1] || "";
  ok(tok && tok !== live, "the token was replaced");
  ok(after.replace(tok, "T") === SRC.replace(live, "T"), "nothing but the token changed");
  const h = tok ? part(tok, 0) : {}, p = tok ? part(tok, 1) : {};
  ok(h.alg === "ES256" && h.kid === kid, "header keeps ES256 and the live kid");
  ok(p.iss === "X54Q9P743S", "iss is the Plursky team");
  ok(p.exp - p.iat > 0 && p.exp - p.iat <= 15777000, "exp within Apple's 6-month cap");
  const [a, b, sig] = tok.split(".");
  ok(verify("SHA256", Buffer.from(`${a}.${b}`), { key: createPublicKey(ec), dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url")), "signature verifies against the key");
  ok(readFileSync(join(ROOT, "spotify-api.jsx"), "utf8") === SRC, "the repo's spotify-api.jsx is untouched");

  // 2. Print-only mode writes nothing.
  writeFileSync(target, SRC);
  const pr = run([TEAM, kid, keyFile]);
  ok(pr.code === 0 && pr.out.trim().split(".").length === 3 && readFileSync(target, "utf8") === SRC, "print mode prints a JWT and writes nothing");

  // Broken fixtures: each must be refused, and leave the file as it was.
  const other = join(dir, "AuthKey_ZZZZZZZZZZ.p8"); writeFileSync(other, ec);
  writeFileSync(target, SRC);
  const k1 = run([TEAM, kid, other, "--write", "--target", target]);
  ok(k1.code !== 0 && /the key file is ZZZZZZZZZZ/.test(k1.out) && readFileSync(target, "utf8") === SRC, "broken fixture: a key file naming another KEY_ID is refused");
  const k1b = run([TEAM, "ZZZZZZZZZZ", other, "--write", "--target", target]);
  ok(k1b.code === 0 && part(/const APPLE_DEV_TOKEN = "([^"]*)";/.exec(readFileSync(target, "utf8"))[1], 0).kid === "ZZZZZZZZZZ", "a new key with its own KEY_ID is accepted and labelled with it");

  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
  writeFileSync(keyFile, rsa); writeFileSync(target, SRC);
  const k2 = run([TEAM, kid, keyFile, "--write", "--target", target]);
  ok(k2.code !== 0 && readFileSync(target, "utf8") === SRC, "broken fixture: a non-P-256 key is refused");

  writeFileSync(keyFile, ec); writeFileSync(target, "// no token here\n");
  const k3 = run([TEAM, kid, keyFile, "--write", "--target", target]);
  ok(k3.code !== 0 && /no APPLE_DEV_TOKEN line/.test(k3.out), "broken fixture: a file with no token line is refused");
} finally { rmSync(dir, { recursive: true, force: true }); }

console.log(`${fails ? "✗" : "✓"} MusicKit renew: ${checks - fails}/${checks} checks, ${brokenOk}/${broken} broken fixtures refused`);
process.exit(fails ? 1 : 0);
