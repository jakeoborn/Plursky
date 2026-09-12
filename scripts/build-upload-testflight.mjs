#!/usr/bin/env node
// One command: fresh main → native build → full verify gate (fails closed) →
// archive → cloud-signed export → upload to App Store Connect → confirm the
// build landed in ASC processing.
//
//   node scripts/build-upload-testflight.mjs              # ship origin/main
//   node scripts/build-upload-testflight.mjs --dry-run    # build + archive only; no ASC call, no upload
//   node scripts/build-upload-testflight.mjs --marketing 1.14 --wait-valid
//
// Options:
//   --ref <git-ref>      what to build (default origin/main, fetched first)
//   --marketing <x.y>    force the marketing version (must beat every closed ASC train)
//   --wait <min>         how long to wait for the build to appear in ASC (default 30)
//   --wait-valid         keep polling until processing finishes (VALID / INVALID)
//   --keep               keep the temp worktree afterwards
//   --dry-run            skip ASC and upload; version = project's, build = project's + 1
//
// Credentials never live in this repo. The script reads, in order:
//   ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH from the environment, then
//   ~/.appstoreconnect/plursky.env (KEY=VALUE lines, same names).
// The .p8 is looked up at ASC_KEY_PATH, ~/.appstoreconnect/private_keys/AuthKey_<id>.p8,
// then ~/private_keys/AuthKey_<id>.p8. The key must carry cloud signing — Apple signs
// server-side through -allowProvisioningUpdates, so no distribution cert is needed locally.
// Key IDs and the issuer are never printed.
//
// Versioning: ASC is the source of truth, not the pbxproj. The build number is
// max(project, every build ASC has ever seen) + 1. If the project's marketing version
// is a train ASC has already closed (approved or released), it moves to the next
// minor on the 1.x train (CLAUDE.md §1 — never 1.0.x). The bump is applied only
// inside the throwaway worktree; the summary prints it so the repo can follow.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const APP_ID = "6768888507";
const TEAM_ID = "X54Q9P743S";
const SCHEME = "App";
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// ── args ────────────────────────────────────────────────────────────────────
// Strict: a typo like --dryrun, or an option missing its value, must stop the
// run before any work. Silently ignoring it could upload what the caller meant
// to dry-run, or build a ref they didn't name.
const FLAGS = new Set(["--dry-run", "--wait-valid", "--keep"]);
const OPTS = new Set(["--ref", "--marketing", "--wait"]);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  const bad = (m) => { console.error(`✗ ${m} (see the header of ${path.basename(process.argv[1])})`); process.exit(1); };
  if (FLAGS.has(a)) args[a] = true;
  else if (OPTS.has(a)) {
    const v = process.argv[i + 1];
    if (v === undefined || v.startsWith("--")) bad(`${a} needs a value`);
    args[a] = v; i++;
  } else bad(`unknown argument ${a}`);
}
const DRY = !!args["--dry-run"];
const REF = args["--ref"] || "origin/main";
const FORCE_MKT = args["--marketing"] || null;
const WAIT_MIN = Number(args["--wait"] || "30");
const WAIT_VALID = !!args["--wait-valid"];
const KEEP = !!args["--keep"];
// Finite and bounded: `Infinity` or `1e309` would make the poll deadline infinite.
if (!(Number.isFinite(WAIT_MIN) && WAIT_MIN > 0 && WAIT_MIN <= 1440)) {
  console.error(`✗ --wait ${args["--wait"]} must be a number of minutes between 0 and 1440`);
  process.exit(1);
}
// CLAUDE.md §1: the train is 1.x, compared numerically; never 1.0.x or a new major.
const TRAIN = /^1\.[1-9]\d*$/;
if (FORCE_MKT && !TRAIN.test(FORCE_MKT)) {
  console.error(`✗ --marketing ${FORCE_MKT} is not on the 1.x train (expected 1.<minor>, e.g. 1.14)`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const LOG_DIR = path.join(os.homedir(), "Library/Logs/plursky-testflight", stamp);
fs.mkdirSync(LOG_DIR, { recursive: true });

const say = (m) => console.log(`[tf] ${m}`);
function die(m, log) {
  console.error(`\n✗ ${m}`);
  if (log && fs.existsSync(log)) {
    const lines = fs.readFileSync(log, "utf8").split("\n");
    const errs = lines.filter((l) => /error:|✗|failed|FAILED|Error Domain/i.test(l)).slice(-15);
    console.error((errs.length ? errs : lines.slice(-25)).join("\n"));
    console.error(`  full log: ${log}`);
  }
  process.exit(1);
}

// Runs a command with output to a log file; the exit code decides, never a pipe.
function run(name, cmd, args, cwd) {
  const log = path.join(LOG_DIR, `${name}.log`);
  say(`${name}…`);
  const fd = fs.openSync(log, "w");
  const r = spawnSync(cmd, args, { cwd, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  if (r.status !== 0) die(`${name} failed (exit ${r.status ?? r.signal})`, log);
  return log;
}
const out = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8" }).trim();

// ── credentials ─────────────────────────────────────────────────────────────
function loadCreds() {
  const file = path.join(os.homedir(), ".appstoreconnect/plursky.env");
  const fromFile = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#\s]+)"?/);
      if (m) fromFile[m[1]] = m[2];
    }
  }
  const get = (k) => process.env[k] || fromFile[k] || null;
  const keyId = get("ASC_KEY_ID");
  const issuer = get("ASC_ISSUER_ID");
  if (!keyId || !issuer) return null;
  const home = os.homedir();
  const keyPath = [
    get("ASC_KEY_PATH"),
    `${home}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`,
    `${home}/private_keys/AuthKey_${keyId}.p8`,
  ].filter(Boolean).map((p) => p.replace(/^~/, home)).find((p) => fs.existsSync(p));
  if (!keyPath) die(`no .p8 found for ASC_KEY_ID (looked in ~/.appstoreconnect/private_keys and ~/private_keys)`);
  return { keyId, issuer, keyPath };
}

// A dry run makes no ASC call and no upload, so it never needs (or checks) the key.
const creds = DRY ? null : loadCreds();
if (!creds && !DRY) {
  die(
    "App Store Connect credentials missing. Create ~/.appstoreconnect/plursky.env with:\n" +
    "    ASC_KEY_ID=<key id>\n    ASC_ISSUER_ID=<issuer id>\n" +
    "  and put AuthKey_<key id>.p8 in ~/.appstoreconnect/private_keys/ (or ~/private_keys/).\n" +
    "  The key needs App Manager (or Admin) with cloud signing. Nothing here goes in the repo."
  );
}
const authFlags = creds
  ? ["-allowProvisioningUpdates", "-authenticationKeyPath", creds.keyPath,
     "-authenticationKeyID", creds.keyId, "-authenticationKeyIssuerID", creds.issuer]
  : ["-allowProvisioningUpdates"];

// ── ASC API ─────────────────────────────────────────────────────────────────
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const input = `${b64({ alg: "ES256", kid: creds.keyId, typ: "JWT" })}.${b64({
    iss: creds.issuer, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1",
  })}`;
  const sig = crypto.sign("SHA256", Buffer.from(input), {
    key: fs.readFileSync(creds.keyPath, "utf8"), dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${input}.${sig}`;
}
async function asc(pathAndQuery) {
  // Apple's API closes idle HTTP/2 sessions (GOAWAY) mid-poll; a dropped socket
  // is retried, an HTTP error answer is not.
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(`https://api.appstoreconnect.apple.com${pathAndQuery}`, {
        headers: { Authorization: `Bearer ${jwt()}` },
      });
      break;
    } catch (e) {
      if (attempt >= 5) die(`ASC unreachable after ${attempt} tries: ${e.cause?.message || e.message}`);
      say(`ASC network error (${e.cause?.code || e.message}), retrying…`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  if (!res.ok) die(`ASC ${res.status} on ${pathAndQuery.split("?")[0]}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
async function ascAll(pathAndQuery) {
  const rows = [];
  let next = pathAndQuery;
  while (next) {
    const j = await asc(next);
    rows.push(...j.data);
    next = j.links?.next ? j.links.next.replace("https://api.appstoreconnect.apple.com", "") : null;
  }
  return rows;
}

// Versions compare numerically per component: 1.7 < 1.12 (the 1.0.x trap, CLAUDE.md §1).
const cmpVer = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};
// A train stops taking builds once its version is approved or released.
const CLOSED = new Set([
  "READY_FOR_SALE", "READY_FOR_DISTRIBUTION", "PENDING_DEVELOPER_RELEASE", "PENDING_APPLE_RELEASE",
  "PROCESSING_FOR_APP_STORE", "PROCESSING_FOR_DISTRIBUTION", "ACCEPTED", "REPLACED_WITH_NEW_VERSION",
  "REMOVED_FROM_SALE", "DEVELOPER_REMOVED_FROM_SALE",
]);

// ── 1. fresh checkout ───────────────────────────────────────────────────────
if (REF.startsWith("origin/")) run("git-fetch", "git", ["fetch", "origin", REF.slice(7)], REPO);
const sha = out("git", ["rev-parse", "--short", REF], REPO);
const WT = path.join(os.tmpdir(), `plursky-tf-${stamp}`);
run("git-worktree", "git", ["worktree", "add", "--detach", WT, REF], REPO);
const cleanup = () => {
  if (KEEP) return say(`worktree kept: ${WT}`);
  spawnSync("git", ["worktree", "remove", "--force", WT], { cwd: REPO });
};
process.on("exit", cleanup);
say(`building ${REF} @ ${sha} in ${WT}`);

const webVer = (fs.readFileSync(path.join(WT, "index.html"), "utf8").match(/\?v=v?(\d+)/) || [])[1] || "?";

// ── 2. web bundle → native project ──────────────────────────────────────────
run("npm-ci", "npm", ["ci"], WT);
run("web-build", "node", ["scripts/build.mjs"], WT);
run("cap-sync", "npx", ["cap", "sync", "ios"], WT);
// The full gate on the exact tree being shipped, after the bundle is built and
// before anything is archived. A red gate stops the run; there is no bypass.
run("verify", "node", ["scripts/verify.mjs"], WT);

// ── 3. version + build number ───────────────────────────────────────────────
const PBX = path.join(WT, "ios/App/App.xcodeproj/project.pbxproj");
let pbx = fs.readFileSync(PBX, "utf8");
const uniq = (re) => [...new Set([...pbx.matchAll(re)].map((m) => m[1]))];
const mkts = uniq(/MARKETING_VERSION = ([\d.]+);/g);
const blds = uniq(/CURRENT_PROJECT_VERSION = (\d+);/g);
if (mkts.length !== 1 || blds.length !== 1) die(`project has mixed versions: ${mkts} / ${blds}`);
let marketing = FORCE_MKT || mkts[0];
let build = Number(blds[0]) + 1;

if (creds && !DRY) {
  const versions = await ascAll(
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&fields[appStoreVersions]=versionString,appStoreState,appVersionState&limit=200`
  );
  const closed = versions
    .filter((v) => CLOSED.has(v.attributes.appStoreState) || CLOSED.has(v.attributes.appVersionState))
    .map((v) => v.attributes.versionString)
    .sort(cmpVer);
  const topClosed = closed.at(-1);
  if (topClosed && cmpVer(marketing, topClosed) <= 0) {
    if (FORCE_MKT) die(`--marketing ${FORCE_MKT} is not above the closed train ${topClosed}`);
    const [maj, min] = topClosed.split(".").map(Number);
    say(`train ${marketing} is closed (highest approved/released: ${topClosed}) → ${maj}.${min + 1}`);
    marketing = `${maj}.${min + 1}`;
  }
  const builds = await ascAll(`/v1/builds?filter[app]=${APP_ID}&fields[builds]=version&limit=200`);
  const topBuild = Math.max(0, ...builds.map((b) => Number(b.attributes.version)).filter(Number.isFinite));
  build = Math.max(build, topBuild + 1);
  say(`ASC: ${versions.length} versions, ${builds.length} builds (highest build ${topBuild})`);
} else {
  say("dry run: no ASC lookup — version/build are provisional");
}
// Whatever the source (--marketing, the ref's pbxproj, or the ASC bump), the
// version that ships must be on the 1.x train.
if (!TRAIN.test(marketing)) die(`marketing version ${marketing} is not on the 1.x train (expected 1.<minor>)`);

pbx = pbx
  .replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${marketing};`)
  .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
fs.writeFileSync(PBX, pbx);
say(`version ${marketing} (${build}) · web v${webVer}`);

// ── 4. archive ──────────────────────────────────────────────────────────────
// A real run archives where Xcode Organizer lists it; a dry run's provisional
// version/build stays out of Organizer, next to its logs.
const day = new Date().toISOString().slice(0, 10);
const ARCHIVE = DRY
  ? path.join(LOG_DIR, "dry-run.xcarchive")
  : path.join(os.homedir(), "Library/Developer/Xcode/Archives", day,
      `Plursky ${marketing} (${build}) ${stamp}.xcarchive`);
run("archive", "xcodebuild", [
  "-workspace", "ios/App/App.xcworkspace", "-scheme", SCHEME, "-configuration", "Release",
  "-destination", "generic/platform=iOS", "-archivePath", ARCHIVE, ...authFlags, "archive",
], WT);
const plist = path.join(ARCHIVE, "Info.plist");
const got = (k) => out("/usr/libexec/PlistBuddy", ["-c", `Print :ApplicationProperties:${k}`, plist]);
const [aMkt, aBld] = [got("CFBundleShortVersionString"), got("CFBundleVersion")];
if (aMkt !== marketing || aBld !== String(build)) die(`archive says ${aMkt} (${aBld}), expected ${marketing} (${build})`);
say(`archived ${aMkt} (${aBld}) → ${ARCHIVE}`);

if (DRY) {
  say("dry run: stopping before export/upload");
  process.exit(0);
}

// ── 5. cloud-signed export straight to App Store Connect ────────────────────
const exportOpts = path.join(LOG_DIR, "ExportOptions.plist");
fs.writeFileSync(exportOpts, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>${TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
`);
const upLog = run("upload", "xcodebuild", [
  "-exportArchive", "-archivePath", ARCHIVE, "-exportOptionsPlist", exportOpts,
  "-exportPath", path.join(LOG_DIR, "export"), ...authFlags,
], WT);
const upText = fs.readFileSync(upLog, "utf8");
if (!/Upload succeeded|EXPORT SUCCEEDED/.test(upText)) die("xcodebuild exited 0 but did not report a successful upload", upLog);
say("upload accepted by xcodebuild");

// ── 6. confirm in App Store Connect ─────────────────────────────────────────
const deadline = Date.now() + WAIT_MIN * 60_000;
let state = null;
while (Date.now() < deadline) {
  const j = await asc(`/v1/builds?filter[app]=${APP_ID}&filter[version]=${build}` +
    `&filter[preReleaseVersion.version]=${marketing}&fields[builds]=version,processingState,uploadedDate`);
  state = j.data[0]?.attributes?.processingState || null;
  if (state && (!WAIT_VALID || state !== "PROCESSING")) break;
  say(state ? `ASC: ${state}, waiting…` : "ASC: not visible yet, waiting…");
  await new Promise((r) => setTimeout(r, 30_000));
}
if (!state) die(`uploaded, but ${marketing} (${build}) did not appear in ASC within ${WAIT_MIN} min — check TestFlight`);
if (WAIT_VALID && state === "PROCESSING") die(`${marketing} (${build}) is still PROCESSING after ${WAIT_MIN} min — --wait-valid never saw VALID`);
if (state === "INVALID" || state === "FAILED") die(`ASC marked ${marketing} (${build}) ${state} — check the email from App Store Connect`);

console.log(`\n✓ Plursky ${marketing} (${build}) is in App Store Connect — ${state}`);
console.log(`  source ${REF} @ ${sha} · web v${webVer}`);
console.log(`  archive ${ARCHIVE}`);
console.log(`  logs    ${LOG_DIR}`);
if (marketing !== mkts[0] || build !== Number(blds[0])) {
  console.log(`  repo project.pbxproj still says ${mkts[0]} (${blds[0]}); ASC now has ${marketing} (${build}).`);
}
