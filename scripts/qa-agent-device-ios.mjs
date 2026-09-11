#!/usr/bin/env node
/**
 * Local, non-transactional native IAP smoke test.
 *
 *   node scripts/qa-agent-device-ios.mjs --flow iap-sheet
 *
 * Builds a fresh Simulator app, drives Plursky through agent-device, and
 * proves that the Season Pass button reaches a native purchase surface. It
 * never presses a Buy, Subscribe, Confirm, or side-button purchase control.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_BUNDLE = "com.plursky.app";
const FORBIDDEN_CONFIRM = /^(buy|subscribe|confirm|purchase)$/i;
const argv = process.argv.slice(2);
const opts = { flow: "", device: "", artifacts: "", noBuild: false };

function usage(reason = "") {
  if (reason) console.error(`Error: ${reason}\n`);
  console.error("Usage: node scripts/qa-agent-device-ios.mjs --flow iap-sheet [--device NAME] [--artifacts ABSOLUTE_PATH] [--no-build]");
  process.exit(2);
}
for (let i = 0; i < argv.length; i++) {
  const flag = argv[i];
  if (flag === "--flow" || flag === "--device" || flag === "--artifacts") {
    const value = argv[++i];
    if (!value || value.startsWith("--")) usage(`${flag} needs a value`);
    opts[flag === "--flow" ? "flow" : flag === "--device" ? "device" : "artifacts"] = value;
  } else if (flag === "--no-build") opts.noBuild = true;
  else usage(`unknown flag ${flag}`);
}
if (opts.flow !== "iap-sheet") usage("--flow must be iap-sheet");
if (opts.artifacts && !opts.artifacts.startsWith("/")) usage("--artifacts must be an absolute path");

const iso = new Date().toISOString().replaceAll(":", "-");
let sha = "unknown";
let out = opts.artifacts || join(ROOT, "artifacts", "agent-device", "iap-sheet", iso);
const result = { schemaVersion: 1, flow: opts.flow, startedAt: new Date().toISOString(), finalState: "FAIL_HARNESS", steps: [], artifacts: {}, purchaseConfirmationActivated: false };
let simulatorWasBooted = false;
let udid = "";
let bundleId = "";
let client;

async function atomicJson() {
  await mkdir(out, { recursive: true });
  const temp = join(out, ".result.json.tmp");
  await writeFile(temp, JSON.stringify(result, null, 2) + "\n");
  await rename(temp, join(out, "result.json"));
}
async function finish(state, error = "") {
  result.finalState = state;
  result.finishedAt = new Date().toISOString();
  if (error) result.error = error;
  await atomicJson();
  await writeFile(join(out, "SUMMARY.txt"), [
    `state=${state}`, `git_sha=${sha}`, `simulator_udid=${udid || "unknown"}`,
    `bundle_id=${bundleId || "unknown"}`, `artifacts=${out}`, error && `error=${error}`,
  ].filter(Boolean).join("\n") + "\n");
}
function text(value) { return Buffer.isBuffer(value) ? value.toString() : String(value ?? ""); }
function run(file, args, { cwd = ROOT, env = process.env, allowFailure = false, log = "" } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = execFile(file, args, { cwd, env, maxBuffer: 50 * 1024 * 1024 }, async (error, stdout, stderr) => {
      const body = `$ ${file} ${args.join(" ")}\n\n${text(stdout)}${text(stderr)}`;
      if (log) await writeFile(join(out, log), body);
      if (error && !allowFailure) {
        const e = new Error(`${file} failed${log ? `; see ${join(out, log)}` : ""}`);
        e.cause = error; rejectRun(e);
      } else resolveRun({ stdout: text(stdout), stderr: text(stderr), code: error?.code || 0 });
    });
    child.on("error", rejectRun);
  });
}
async function step(name, fn) {
  const row = { name, startedAt: new Date().toISOString(), status: "RUNNING" };
  result.steps.push(row); await atomicJson();
  try {
    const value = await fn(); row.status = "PASS"; return value;
  } catch (error) { row.status = "FAIL"; row.error = error.message; throw error; }
  finally { row.finishedAt = new Date().toISOString(); await atomicJson(); }
}
function semverTuple(s) { return (s.match(/\d+/g) || []).slice(0, 3).map(Number); }
function atLeast(actual, wanted) {
  for (let i = 0; i < wanted.length; i++) { if ((actual[i] || 0) !== wanted[i]) return (actual[i] || 0) > wanted[i]; }
  return true;
}
function snapshotText(snapshot) {
  return (snapshot.nodes || []).map(n => [n.label, n.name, n.value, n.text, n.role].filter(Boolean).join(" ")).join("\n");
}
function findNode(snapshot, matcher) {
  return (snapshot.nodes || []).find(n => matcher.test([n.label, n.name, n.value, n.text].filter(Boolean).join(" ")));
}
async function saveSnapshot(name, interactiveOnly = false) {
  const snap = await client.capture.snapshot({ interactiveOnly });
  const body = snapshotText(snap);
  const path = join(out, name); await writeFile(path, body + "\n"); result.artifacts[name] = path;
  return { snap, body };
}
async function press(matcher, label) {
  const { snap } = await saveSnapshot(`before-${label}.txt`, true);
  const node = findNode(snap, matcher);
  if (!node?.ref) throw new Error(`could not find ${label} in interactive accessibility snapshot`);
  const nodeText = [node.label, node.name, node.value, node.text].filter(Boolean).join(" ");
  if (FORBIDDEN_CONFIRM.test(nodeText.trim())) throw new Error(`safety stop: refusing purchase-confirm control ${JSON.stringify(nodeText)}`);
  await client.interactions.press({ ref: node.ref });
}
async function screenshot(name) {
  const requested = join(out, name);
  const captured = await client.capture.screenshot({ path: requested });
  const path = captured.path || requested;
  result.artifacts[name] = path;
}
async function waitForResult(ms = 20_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const { snap, body } = await saveSnapshot("snapshot-purchase-result.txt");
    const lower = body.toLowerCase();
    // System StoreKit surfaces expose at least one system-owned checkout cue.
    // Do not count Plursky's own "purchase" copy or its Restore control.
    const systemBundle = snap.appBundleId && snap.appBundleId !== bundleId;
    const native = systemBundle || /confirm your in.app purchase|would you like to buy|apple account|payment method|double.click|side button|confirm with|environment: sandbox|ask to buy|cancel purchase/.test(lower);
    const error = /could not|unavailable|failed|not found|error|try again/.test(lower);
    if (native) return { kind: "sheet", snap, body };
    if (error) return { kind: "error", snap, body };
    await new Promise(r => setTimeout(r, 750));
  }
  return { kind: "timeout", ...(await saveSnapshot("snapshot-purchase-result.txt")) };
}

await mkdir(out, { recursive: true });
try {
  await step("preflight", async () => {
    if (process.platform !== "darwin") throw Object.assign(new Error("macOS is required"), { finalState: "BLOCKED_SIMULATOR_SETUP" });
    if (!atLeast(semverTuple(process.versions.node), [22, 12, 0])) throw Object.assign(new Error(`Node >=22.12 required; found ${process.versions.node}`), { finalState: "BLOCKED_SIMULATOR_SETUP" });
    sha = (await run("git", ["rev-parse", "HEAD"])).stdout.trim(); result.gitSha = sha;
    const dirty = (await run("git", ["status", "--porcelain"])).stdout.trim();
    if (dirty) throw new Error(`working tree must be clean:\n${dirty}`);
    const pre = [];
    for (const [file, args] of [["xcode-select", ["-p"]], ["xcodebuild", ["-version"]], ["xcrun", ["simctl", "help"]], ["pod", ["--version"]]]) {
      const r = await run(file, args); pre.push(`$ ${file} ${args.join(" ")}\n${r.stdout}${r.stderr}`);
    }
    await writeFile(join(out, "preflight.log"), pre.join("\n")); result.artifacts.preflight = join(out, "preflight.log");
    const listing = await run("xcodebuild", ["-list", "-workspace", "ios/App/App.xcworkspace", "-json"]);
    const schemes = JSON.parse(listing.stdout).workspace?.schemes || [];
    if (!schemes.includes("App")) throw new Error(`App scheme not found; schemes: ${schemes.join(", ")}`);
    const settings = await run("xcodebuild", ["-workspace", "ios/App/App.xcworkspace", "-scheme", "App", "-showBuildSettings", "-sdk", "iphonesimulator"]);
    bundleId = settings.stdout.match(/^\s*PRODUCT_BUNDLE_IDENTIFIER = (.+)$/m)?.[1]?.trim() || "";
    if (bundleId !== EXPECTED_BUNDLE) throw new Error(`bundle ID ${bundleId || "missing"}; expected ${EXPECTED_BUNDLE}`);
    result.bundleId = bundleId;
    const devices = JSON.parse((await run("xcrun", ["simctl", "list", "devices", "available", "-j"])).stdout).devices;
    const all = Object.entries(devices).flatMap(([runtime, ds]) => ds.map(d => ({ ...d, runtime })));
    const chosen = all.find(d => opts.device && d.name === opts.device) || all.find(d => d.state === "Booted" && /iPhone/.test(d.name)) || all.find(d => /iPhone/.test(d.name));
    if (!chosen) throw Object.assign(new Error(`no available ${opts.device || "iPhone"} Simulator found`), { finalState: "BLOCKED_SIMULATOR_SETUP" });
    udid = chosen.udid; simulatorWasBooted = chosen.state === "Booted"; result.simulator = { name: chosen.name, udid, runtime: chosen.runtime };
    console.log(`Plursky QA: sha=${sha} bundle=${bundleId} simulator=${chosen.name} (${udid}) artifacts=${out}`);
  });

  await step("install-dependencies", async () => {
    const binary = join(ROOT, "node_modules", ".bin", "agent-device");
    try { await stat(binary); }
    catch { await run("npm", ["ci"], { log: "npm-ci.log" }); }
    const installed = (await run(binary, ["--version"])).stdout.trim();
    if (installed !== "0.21.0") throw new Error(`agent-device 0.21.0 required; found ${installed || "unknown"}`);
    result.agentDeviceVersion = installed;
  });
  await step("agent-device-doctor", async () => {
    await run(join(ROOT, "node_modules", ".bin", "agent-device"), ["doctor"], { log: "agent-device-doctor.log" });
    await run(join(ROOT, "node_modules", ".bin", "agent-device"), ["capabilities", "--platform", "ios"], { log: "agent-device-capabilities-ios.log" });
  });
  await step("boot-simulator", async () => {
    if (!simulatorWasBooted) await run("xcrun", ["simctl", "boot", udid]);
    await run("xcrun", ["simctl", "bootstatus", udid, "-b"]);
  });
  await step("build", async () => {
    if (!opts.noBuild) {
      await run("npm", ["run", "build"], { log: "build.log" });
      const syncBefore = (await run("git", ["status", "--porcelain"])).stdout;
      await run("npx", ["cap", "sync", "ios"], { log: "cap-sync.log" });
      const syncAfter = (await run("git", ["status", "--porcelain"])).stdout;
      if (syncAfter !== syncBefore) {
        await writeFile(join(out, "cap-sync.diff"), (await run("git", ["diff"])).stdout);
        throw new Error(`cap sync changed tracked files; see ${join(out, "cap-sync.diff")}`);
      }
      const derived = join(ROOT, "artifacts", "agent-device", "derived-data", sha);
      await rm(derived, { recursive: true, force: true });
      await run("xcodebuild", ["-workspace", "ios/App/App.xcworkspace", "-scheme", "App", "-configuration", "Debug", "-sdk", "iphonesimulator", "-destination", `id=${udid}`, "-derivedDataPath", derived, "CODE_SIGNING_ALLOWED=NO", "build"], { log: "xcodebuild.log" });
    }
    const derived = join(ROOT, "artifacts", "agent-device", "derived-data", sha);
    const app = join(derived, "Build", "Products", "Debug-iphonesimulator", "App.app");
    const s = await stat(app); if (!s.isDirectory()) throw new Error(`built app missing at ${app}`);
    const actual = (await run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", join(app, "Info.plist")])).stdout.trim();
    if (actual !== bundleId) throw new Error(`built app bundle ID ${actual}; expected ${bundleId}`);
    await run("xcrun", ["simctl", "terminate", udid, bundleId], { allowFailure: true });
    await run("xcrun", ["simctl", "uninstall", udid, bundleId], { allowFailure: true });
    await run("xcrun", ["simctl", "install", udid, app]);
  });
  await step("drive-iap-sheet", async () => {
    const { createAgentDeviceClient } = await import("agent-device");
    client = createAgentDeviceClient({ session: `plursky-iap-${process.pid}`, lockPolicy: "reject", lockPlatform: "ios" });
    await client.apps.open({ app: bundleId, platform: "ios", udid });
    let first = await saveSnapshot("snapshot-launch.txt");
    if (!/\bME\b/i.test(first.body)) throw Object.assign(new Error("ME tab absent after launch"), { finalState: "FAIL_UI_REGRESSION" });
    await press(/\bME\b/i, "me");
    await new Promise(r => setTimeout(r, 500));
    await press(/PLURSKY(?:\+| PLUS)/i, "plursky-plus");
    await new Promise(r => setTimeout(r, 500));
    const plus = await saveSnapshot("snapshot-plus.txt");
    for (const expected of [/Season Pass/i, /RESTORE PURCHASE/i, /one-time purchase/i, /nothing auto-renews/i]) {
      if (!expected.test(plus.body)) throw Object.assign(new Error(`Plursky+ assertion failed: ${expected}`), { finalState: "FAIL_UI_REGRESSION" });
    }
    await screenshot("before-purchase.png");
    await press(/Season Pass/i, "season-pass");
    const observed = await waitForResult();
    await screenshot("purchase-result.png");
    if (observed.kind === "sheet") return;
    if (/offer|product not found|price lookup/i.test(observed.body)) throw Object.assign(new Error("StoreKit/RevenueCat offerings unavailable"), { finalState: "BLOCKED_OFFERINGS" });
    if (/plugin|purchases.*not available|not implemented/i.test(observed.body)) throw Object.assign(new Error("RevenueCat native plugin unavailable"), { finalState: "BLOCKED_NATIVE_PLUGIN" });
    throw Object.assign(new Error(observed.kind === "error" ? "visible purchase error" : "native purchase sheet did not appear within 20s"), { finalState: "FAIL_UI_REGRESSION" });
  });

  const dirtyEnd = (await run("git", ["status", "--porcelain"])).stdout.trim();
  if (dirtyEnd) throw new Error(`post-run working tree differs:\n${dirtyEnd}`);
  if (result.purchaseConfirmationActivated) throw new Error("purchase confirmation safety invariant failed");
  await finish("PASS_SHEET_PRESENTED");
  for (const path of Object.values(result.artifacts)) { const s = await stat(path); if (!s.size) throw new Error(`empty artifact: ${path}`); }
  JSON.parse(await readFile(join(out, "result.json"), "utf8"));
  console.log(`PASS_SHEET_PRESENTED — ${out}`);
} catch (error) {
  await finish(error.finalState || "FAIL_HARNESS", error.message);
  console.error(`${result.finalState}: ${error.message}\nArtifacts: ${out}`);
  process.exitCode = 1;
} finally {
  if (client) { try { await client.sessions.close(); } catch {} }
}
