#!/usr/bin/env node
// Offline regression test for press() in qa-agent-device-ios.mjs.
//
//   node scripts/test-qa-press.mjs
//
// Runs the REAL press() source (sliced out of the harness, not a copy) in a VM
// with a fake agent-device client and agent-device's real AppError /
// normalizeAgentDeviceError / isNodeVisible. No Simulator: this proves the
// press logic, not a flow. The flow itself still needs a Simulator run.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { AppError, normalizeAgentDeviceError } from "agent-device";
import { isNodeVisible } from "agent-device/selectors";

const SRC = readFileSync(new URL("./qa-agent-device-ios.mjs", import.meta.url), "utf8");
const slice = (from, to) => { const a = SRC.indexOf(from), b = SRC.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error(`cannot find ${from}`); return SRC.slice(a, b); };
const CODE = [
  slice("const FORBIDDEN_CONFIRM", "\n") + "\n",
  slice("function nodeLabel(n)", "function findNode"),
  slice("function interactionRef(ref)", "async function saveSnapshot"),
  slice("async function press(", "async function screenshot"),
].join("\n");

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗ ${msg}`); } };
const on = (ref, label) => ({ ref, label, hittable: true, rect: { x: 0, y: 100, width: 100, height: 44 } });
const off = (ref, label) => ({ ref, label, hittable: false });
const offscreen = dir => new AppError("COMMAND_FAILED", "Ref is off-screen and not safe to press", { reason: "offscreen_ref", scrollDirection: dir });

// `snaps` is the snapshot sequence; `pressFails(ref, n)` returns an error to throw or null.
async function run({ snaps, pressFails = () => null, matchers = /Continue/, opts }) {
  const log = { snapshots: 0, presses: [], scrolls: [] };
  const sandbox = {
    result: {}, normalizeAgentDeviceError, isNodeVisible, setTimeout: (f) => f(),
    saveSnapshot: async () => ({ snap: { nodes: snaps[Math.min(log.snapshots++, snaps.length - 1)] } }),
    client: { interactions: {
      press: async ({ ref }) => { log.presses.push(ref); if (log.presses.length > 50) throw new Error("runaway: press() never stopped pressing"); const e = pressFails(ref, log.presses.length); if (e) throw e; },
      scroll: async a => { log.scrolls.push(a); },
    } },
  };
  runInNewContext(CODE + "\nthis.press = press;", sandbox);
  let error = null;
  try { await sandbox.press(matchers, "test", opts); } catch (e) { error = e; }
  return { ...log, error, recorded: sandbox.result.presses || [] };
}

// 1. An on-screen match beats an earlier off-screen one.
{ const r = await run({ snaps: [[off("e1", "Continue"), on("e2", "Continue")]] });
  check(!r.error && r.presses.join() === "@e2", `on-screen match wins (pressed ${r.presses})`); }
// 2. Only off-screen: press it; agent-device refuses → scroll in its direction, fresh snapshot, new ref.
{ const r = await run({ snaps: [[off("e1", "Continue")], [on("e9", "Continue")]], pressFails: ref => ref === "@e1" ? offscreen("up") : null });
  check(!r.error, `recovers after one off-screen refusal (${r.error?.message})`);
  check(r.presses.join() === "@e1,@e9", `retries with the ref from the NEW snapshot (pressed ${r.presses})`);
  check(r.scrolls.length === 1 && r.scrolls[0].direction === "up" && r.scrolls[0].pixels === 160, `scrolls once, 160px, the reported way (${JSON.stringify(r.scrolls)})`);
  check(r.snapshots === 2, `a fresh snapshot per attempt (${r.snapshots})`); }
// 3. A refused ref is never re-pressed without a new snapshot.
{ const r = await run({ snaps: [[off("e1", "Continue")], [off("e1", "Continue")], [on("e3", "Continue")]], pressFails: (ref, n) => n < 3 ? offscreen("down") : null });
  check(!r.error && r.snapshots === r.presses.length, `every press follows its own snapshot (${r.snapshots} snapshots, ${r.presses.length} presses)`); }
// 4. Gives up after maxScrolls and rethrows the agent-device error.
{ const r = await run({ snaps: [[off("e1", "Continue")]], pressFails: () => offscreen("down"), opts: { maxScrolls: 6 } });
  check(r.error instanceof AppError && r.presses.length === 7 && r.scrolls.length === 6, `bounded: 7 presses, 6 scrolls, then the AppError (${r.presses.length}/${r.scrolls.length}, ${r.error?.constructor?.name})`); }
// 5. Any other press error is rethrown unchanged, with no scroll.
{ const other = new AppError("COMMAND_FAILED", "device gone", { reason: "device_disconnected" });
  const r = await run({ snaps: [[on("e1", "Continue")]], pressFails: () => other });
  check(r.error === other && r.scrolls.length === 0, `a non-offscreen error is rethrown as-is (${r.error?.message})`); }
// 6. Missing target with a `missing` message → FAIL_UI_REGRESSION.
{ const r = await run({ snaps: [[on("e1", "Other")]], opts: { missing: "CONTINUE is absent" } });
  check(r.error?.finalState === "FAIL_UI_REGRESSION" && r.error.message === "CONTINUE is absent", `absent target is a UI regression (${r.error?.finalState})`); }
// 7. Missing target without `missing` → plain error, no finalState.
{ const r = await run({ snaps: [[on("e1", "Other")]] });
  check(r.error && !r.error.finalState && /could not find test/.test(r.error.message), `absent target without a message is a plain error (${r.error?.message})`); }
// 8. Safety stop: never presses a purchase-confirm control.
{ const r = await run({ snaps: [[on("e1", "Buy")]], matchers: /Buy/ });
  check(/safety stop/.test(r.error?.message || "") && r.presses.length === 0, `refuses a Buy control without pressing (${r.error?.message})`); }
// 9. Matcher list: the first matcher with any hit wins; every press is recorded.
{ const r = await run({ snaps: [[on("e1", "Done"), on("e2", "Continue")]], matchers: [/Continue/, /Done/] });
  check(r.presses.join() === "@e2" && r.recorded.length === 1 && r.recorded[0].text === "Continue" && r.recorded[0].visible === true, `matcher order and the press record (${JSON.stringify(r.recorded)})`); }

console.log(`  ${failed ? "✗" : "✓"}  qa press(): ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);
