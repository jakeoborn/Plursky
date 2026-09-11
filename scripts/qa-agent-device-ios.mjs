#!/usr/bin/env node
/**
 * Local, non-transactional native IAP smoke test.
 *
 *   node scripts/qa-agent-device-ios.mjs --flow iap-sheet
 *   node scripts/qa-agent-device-ios.mjs --flow map-3d-edc-lv
 *
 * Builds a fresh Simulator app and drives one native QA flow through
 * agent-device. The IAP flow never presses a Buy, Subscribe, Confirm, or
 * side-button purchase control.
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
  console.error("Usage: node scripts/qa-agent-device-ios.mjs --flow <iap-sheet|map-3d-edc-lv> [--device NAME] [--artifacts ABSOLUTE_PATH] [--no-build]");
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
if (!new Set(["iap-sheet", "map-3d-edc-lv"]).has(opts.flow)) usage("--flow must be iap-sheet or map-3d-edc-lv");
if (opts.artifacts && !opts.artifacts.startsWith("/")) usage("--artifacts must be an absolute path");

const iso = new Date().toISOString().replaceAll(":", "-");
let sha = "unknown";
let out = opts.artifacts || join(ROOT, "artifacts", "agent-device", opts.flow, iso);
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
async function waitForSnapshot(matcher, { timeoutMs = 20_000, name = "snapshot-wait.txt", interactiveOnly = false } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await saveSnapshot(name, interactiveOnly);
    if (matcher.test(last.body)) return last;
    await new Promise(r => setTimeout(r, 750));
  }
  throw Object.assign(new Error(`timed out waiting for ${matcher}`), { finalState: "FAIL_UI_REGRESSION" });
}
async function openNativeUrl(url) {
  await run("xcrun", ["simctl", "openurl", udid, url]);
  await new Promise(r => setTimeout(r, 750));
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
  const { createAgentDeviceClient, normalizeAgentDeviceError } = await import("agent-device");
  let clientAttempt = 0;
  const freshClient = () => createAgentDeviceClient({
    session: `plursky-${opts.flow}-${process.pid}-${++clientAttempt}`,
    lockPolicy: "reject",
    lockPlatform: "ios",
  });
  client = freshClient();

  await step("prepare-ios-runner", async () => {
    const attempts = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const prepared = await client.command.prepare({
          action: "ios-runner", platform: "ios", udid, timeoutMs: 120_000,
        });
        attempts.push({ attempt, status: "PASS", elapsedMs: Date.now() - started, prepared });
        result.iosRunnerPreparation = {
          attempts: attempt,
          durationMs: prepared.durationMs,
          cache: prepared.cache,
          artifact: prepared.artifact,
          timing: prepared.timing,
        };
        await writeFile(join(out, "agent-device-prepare-ios-runner.json"), JSON.stringify({ attempts }, null, 2) + "\n");
        result.artifacts.iosRunnerPreparation = join(out, "agent-device-prepare-ios-runner.json");
        return;
      } catch (error) {
        const normalized = normalizeAgentDeviceError(error);
        attempts.push({ attempt, status: "FAIL", elapsedMs: Date.now() - started, error: normalized });
        await writeFile(join(out, "agent-device-prepare-ios-runner.json"), JSON.stringify({ attempts }, null, 2) + "\n");
        result.artifacts.iosRunnerPreparation = join(out, "agent-device-prepare-ios-runner.json");
        const prepareTimeout = normalized.message === "Daemon request timed out";
        if (!prepareTimeout || attempt === 2) throw error;

        // Retry only the explicit, side-effect-free runner preparation. Never
        // retry app interactions: a timed-out press may already have landed.
        try { await client.sessions.close(); } catch {}
        client = null;
        await new Promise(r => setTimeout(r, 2_000));
        client = freshClient();
      }
    }
  });

  if (opts.flow === "iap-sheet") await step("drive-iap-sheet", async () => {
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

  if (opts.flow === "map-3d-edc-lv") await step("drive-map-3d-edc-lv", async () => {
    await client.apps.open({ app: bundleId, platform: "ios", udid });

    // The festival switcher lives on Today, not Map. The native URL handler
    // is a supported app path and dismisses onboarding without a product-only
    // test hook.
    await openNativeUrl("plursky://qa?tab=home");
    await waitForSnapshot(/\bTODAY\b/i, { name: "snapshot-home-entry.txt", interactiveOnly: true });

    // Select EDC LV from the real festival switcher. The switch reloads the
    // WebView, so refs after this press are deliberately discarded.
    const entry = await saveSnapshot("snapshot-before-festival-switch.txt", true);
    const festivalChip = (entry.snap.nodes || []).find(n => {
      const t = [n.label, n.name, n.value, n.text].filter(Boolean).join(" ");
      return /NOCTURNAL|EDC LV|FESTIVAL/i.test(t) && n.ref;
    });
    if (!festivalChip?.ref) throw Object.assign(new Error("festival chip absent on Today"), { finalState: "FAIL_UI_REGRESSION" });
    await client.interactions.press({ ref: festivalChip.ref });
    await waitForSnapshot(/Electric Daisy Carnival.*Las Vegas|EDC LV/i, { name: "snapshot-festival-switcher.txt", interactiveOnly: true });
    await press(/Electric Daisy Carnival.*Las Vegas|EDC LV/i, "edc-lv");

    // EDC LV is post-festival, so its normal tab bar replaces Map with
    // Memories. Re-enter Map through the same supported native URL handler.
    await new Promise(r => setTimeout(r, 1800));
    await openNativeUrl("plursky://qa?tab=map");
    await waitForSnapshot(/Map layers/i, { name: "snapshot-edc-map-entry.txt", interactiveOnly: true });

    await press(/Map layers/i, "map-layers");
    const layers = await waitForSnapshot(/Real map.*BETA/i, { name: "snapshot-map-layers.txt", interactiveOnly: true });
    const realMap = findNode(layers.snap, /Real map.*BETA/i);
    const realText = [realMap?.label, realMap?.name, realMap?.value, realMap?.text].filter(Boolean).join(" ");
    if (!realMap?.ref) throw Object.assign(new Error("Real map control absent"), { finalState: "FAIL_UI_REGRESSION" });
    // aria-pressed is not consistently surfaced in the merged iOS tree. A
    // fresh install is off by contract, so one press enables it.
    await client.interactions.press({ ref: realMap.ref });

    const style = await waitForSnapshot(/STYLIZED/i, { timeoutMs: 25_000, name: "snapshot-real-map-styles.txt", interactiveOnly: true });
    const stylized = findNode(style.snap, /^STYLIZED$/i) || findNode(style.snap, /STYLIZED/i);
    if (!stylized?.ref) throw Object.assign(new Error("Stylized map control absent"), { finalState: "FAIL_UI_REGRESSION" });
    await client.interactions.press({ ref: stylized.ref });

    // MapLibre's DOM stage pills are accessibility-visible. Pillar geometry is
    // WebGL and must be judged from the stabilized screenshot, not this tree.
    const settled = await waitForSnapshot(/KINETIC FIELD|CIRCUIT GROUNDS|COSMIC MEADOW/i, { timeoutMs: 25_000, name: "snapshot-map-3d-settled.txt" });
    const stageNames = ["KINETIC FIELD", "CIRCUIT GROUNDS", "COSMIC MEADOW", "BASS POD", "NEON GARDEN"];
    const visibleStages = stageNames.filter(name => settled.body.toUpperCase().includes(name));
    if (visibleStages.length < 3) throw Object.assign(new Error(`only ${visibleStages.length} expected stage pills found`), { finalState: "FAIL_UI_REGRESSION" });
    if (/MAP ERROR|REAL MAP UNAVAILABLE|FESTIVAL MAP SHOWN/i.test(settled.body)) throw Object.assign(new Error("visible map error"), { finalState: "FAIL_UI_REGRESSION" });
    result.map3d = { festival: "edc-lv-2026", style: "stylized", expectedPitchDegrees: 55, visibleStages, visualReviewRequired: true };
    await new Promise(r => setTimeout(r, 1500));
    await screenshot("map-3d-edc-lv.png");
  });

  const dirtyEnd = (await run("git", ["status", "--porcelain"])).stdout.trim();
  if (dirtyEnd) throw new Error(`post-run working tree differs:\n${dirtyEnd}`);
  if (result.purchaseConfirmationActivated) throw new Error("purchase confirmation safety invariant failed");
  await finish(opts.flow === "iap-sheet" ? "PASS_SHEET_PRESENTED" : "PASS_MAP_3D_CAPTURED");
  for (const path of Object.values(result.artifacts)) { const s = await stat(path); if (!s.size) throw new Error(`empty artifact: ${path}`); }
  JSON.parse(await readFile(join(out, "result.json"), "utf8"));
  console.log(`${result.finalState} — ${out}`);
} catch (error) {
  await finish(error.finalState || "FAIL_HARNESS", error.message);
  console.error(`${result.finalState}: ${error.message}\nArtifacts: ${out}`);
  process.exitCode = 1;
} finally {
  if (client) { try { await client.sessions.close(); } catch {} }
}
