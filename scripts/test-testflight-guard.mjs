#!/usr/bin/env node
// test-testflight-guard.mjs — build-upload-testflight.mjs stays internal-only.
//
//   node scripts/test-testflight-guard.mjs
//
// No Xcode, no network, no App Store Connect. Proves:
//   - the export plist sets testFlightInternalTestingOnly true, and a plist
//     without it (or with false) is rejected;
//   - the guard FAILS when an external beta group is present, when a group's
//     kind is unknown, or when a public link is on, and passes for internal
//     groups only;
//   - the upload script runs the guard and the plist check BEFORE its
//     `run("upload", …)`, writes the plist from exportOptionsPlist(), reads
//     back the processed build's groups, and has no flag that skips the guard;
//   - awaitValidBuild (the ONLY post-upload path) waits through PROCESSING and
//     reads groups only once the build is VALID: an external group Apple
//     attaches as processing finishes FAILS the run, and a build still
//     PROCESSING at the deadline fails without its groups ever being read.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INTERNAL_ONLY_KEY, awaitValidBuild, exportOptionsPlist, exportOptionsProblems, externalDistribution } from "./testflight-guard.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) fails.push(m); };

// 1. Export options.
const xml = exportOptionsPlist("X54Q9P743S");
ok(new RegExp(`<key>${INTERNAL_ONLY_KEY}</key><true/>`).test(xml), "plist sets testFlightInternalTestingOnly true");
ok(exportOptionsProblems(xml).length === 0, "the real plist passes the check");
ok(exportOptionsProblems(xml.replace(/\s*<key>testFlightInternalTestingOnly<\/key><true\/>/, "")).length === 1, "a plist without the key is rejected");
ok(exportOptionsProblems(xml.replace("<key>testFlightInternalTestingOnly</key><true/>", "<key>testFlightInternalTestingOnly</key><false/>")).length === 1, "a plist with the key false is rejected");

// 2. ASC beta groups.
const internal = { id: "g1", attributes: { name: "Plursky team", isInternalGroup: true, publicLinkEnabled: false } };
const external = { id: "g2", attributes: { name: "Festival beta", isInternalGroup: false, publicLinkEnabled: false } };
ok(externalDistribution([]).length === 0, "no groups passes");
ok(externalDistribution([internal]).length === 0, "internal-only groups pass");
const ext = externalDistribution([internal, external]);
ok(ext.length === 1 && /external beta group "Festival beta"/.test(ext[0]), `an external group FAILS the guard (got ${JSON.stringify(ext)})`);
ok(externalDistribution([{ id: "g3", attributes: { name: "Mystery" } }]).length === 1, "a group of unknown kind fails (unknown never passes)");
ok(externalDistribution([{ id: "g4", attributes: { name: "Linked", isInternalGroup: false, publicLinkEnabled: true } }]).length === 2, "a public link fails on its own line");

// 3. The upload script wires it in, before the upload, with no bypass.
const src = readFileSync(join(ROOT, "scripts/build-upload-testflight.mjs"), "utf8");
const at = s => src.indexOf(s);
const upload = at('run("upload"');
ok(upload > 0, "upload step found");
ok(at("externalDistribution(groups)") > 0 && at("externalDistribution(groups)") < upload, "beta-group guard runs before the upload");
ok(at("exportOptionsPlist(TEAM_ID)") > 0 && at("exportOptionsPlist(TEAM_ID)") < upload, "export plist comes from exportOptionsPlist()");
ok(at("exportOptionsProblems(") > 0 && at("exportOptionsProblems(") < upload, "plist check runs before the upload");
ok(!/<key>method<\/key>/.test(src), "no second hand-written export plist in the script");
const wait = at("await awaitValidBuild(");
ok(wait > upload, "post-upload confirmation goes through awaitValidBuild()");
ok(at("if (problems.length) die(") > wait, "any awaitValidBuild problem stops the run");
ok((src.match(/betaGroups\?/g) || []).length === 2, "groups are read in exactly two places: the app before upload, the build inside awaitValidBuild");
ok(!/WAIT_VALID/.test(src) && !/processingState[^\n]*break/.test(src), "no default path that stops waiting before VALID (old --wait-valid opt-in gone)");
ok(!/--(skip|no|allow)-?(guard|external|internal)/i.test(src), "no flag skips the guard");

// 4. Behaviour: fake clock + fake ASC, no network.
async function sim(states, groupsAt) {
  let t = 0, i = 0; const reads = [];
  const r = await awaitValidBuild({
    poll: async () => { const s = states[Math.min(i, states.length - 1)]; i++; return { state: s, buildId: s ? "b1" : null }; },
    readGroups: async (id) => { reads.push({ id, state: states[Math.min(i - 1, states.length - 1)] }); return groupsAt(); },
    sleep: async () => { t += 30_000; },
    now: () => t,
    deadline: 10 * 60_000,
  });
  return { r, reads, polls: i };
}
{
  // Default path: not visible, then PROCESSING twice, then VALID. Groups gain an
  // external group the moment processing finishes; the guard must see it.
  const seq = [null, "PROCESSING", "PROCESSING", "VALID"];
  const { r, reads, polls } = await sim(seq, () => [internal, external]);
  ok(polls === 4, `waited through PROCESSING until VALID (polled ${polls}× , expected 4)`);
  ok(reads.length === 1 && reads[0].state === "VALID", `groups read once, only at VALID (got ${JSON.stringify(reads)})`);
  ok(r.problems.length === 1 && /external beta group "Festival beta"/.test(r.problems[0]), `external group appearing after processing FAILS (got ${JSON.stringify(r.problems)})`);
}
{
  const { r, reads } = await sim(["PROCESSING", "VALID"], () => [internal]);
  ok(r.state === "VALID" && r.problems.length === 0 && reads.length === 1, "internal-only build passes after VALID");
}
{
  // Never leaves PROCESSING: fail at the deadline, groups NEVER read (even if they look internal).
  const { r, reads } = await sim(["PROCESSING"], () => [internal]);
  ok(reads.length === 0, "a build still PROCESSING at the deadline never has its groups read");
  ok(r.problems.length === 1 && /still PROCESSING/.test(r.problems[0]), `PROCESSING at the deadline FAILS (got ${JSON.stringify(r.problems)})`);
}
{
  const { r, reads } = await sim([null], () => []);
  ok(reads.length === 0 && r.problems.length === 1 && /never appeared/.test(r.problems[0]), "a build that never appears FAILS");
}
{
  const { r, reads } = await sim(["PROCESSING", "INVALID"], () => [internal]);
  ok(reads.length === 0 && r.problems.length === 1 && /INVALID/.test(r.problems[0]), "INVALID FAILS without reading groups");
}
{
  // An unknown state is not VALID: keep waiting, never read groups on it.
  const { reads, polls } = await sim(["SOMETHING_NEW", "VALID"], () => [internal]);
  ok(polls === 2 && reads.length === 1, "an unknown processing state waits, it does not pass");
}

if (fails.length) { fails.forEach(f => console.log(`  ✗ ${f}`)); console.log(`✗ testflight guard: ${fails.length} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ testflight guard: ${checks} checks — export plist internal-only, an external group or public link stops the run before upload, mandatory wait for VALID before the build's groups are read`);
