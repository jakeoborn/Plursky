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
import { INTERNAL_ONLY_KEY, awaitValidBuild, exportOptionsPlist, exportOptionsProblems, externalDistribution, preUploadGuard } from "./testflight-guard.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) fails.push(m); };

// 1. Export options.
const xml = exportOptionsPlist("X54Q9P743S");
ok(new RegExp(`<key>${INTERNAL_ONLY_KEY}</key><true/>`).test(xml), "plist sets testFlightInternalTestingOnly true");
ok(exportOptionsProblems(xml).length === 0, "the real plist passes the check");
ok(exportOptionsProblems(xml.replace(/\s*<key>testFlightInternalTestingOnly<\/key><true\/>/, "")).length === 1, "a plist without the key is rejected");
ok(exportOptionsProblems(xml.replace("<key>testFlightInternalTestingOnly</key><true/>", "<key>testFlightInternalTestingOnly</key><false/>")).length === 1, "a plist with the key false is rejected");
// --app-store: the key is present and false, and each mode rejects the other's plist.
const asXml = exportOptionsPlist("X54Q9P743S", { appStore: true });
ok(new RegExp(`<key>${INTERNAL_ONLY_KEY}</key><false/>`).test(asXml), "an App Store plist sets testFlightInternalTestingOnly false, explicitly");
ok(exportOptionsProblems(asXml, { appStore: true }).length === 0, "the App Store plist passes the App Store check");
ok(exportOptionsProblems(asXml).length === 1, "an App Store plist FAILS the default (internal-only) check");
ok(exportOptionsProblems(xml, { appStore: true }).length === 1, "an internal-only plist FAILS the App Store check");
ok(exportOptionsProblems(asXml.replace(/\s*<key>testFlightInternalTestingOnly<\/key><false\/>/, ""), { appStore: true }).length === 1, "an App Store plist without the key is rejected");

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
const guardCall = at("const pre = await preUploadGuard({");
ok(guardCall > 0 && guardCall < upload, "the pre-upload guard (beta groups + plist) runs before the upload");
// Unconditional in BOTH modes: a top-level statement at column 0, with no
// if/ternary between the step-5 banner and the call, and its problems stop the run.
const step5 = at("// ── 5.");
ok(/^const pre = await preUploadGuard\(\{$/m.test(src) && step5 > 0 && step5 < guardCall, "the guard call is a top-level statement in step 5");
ok(!/\bif\s*\(|\?[^.]/.test(src.slice(step5, guardCall).replace(/\/\/[^\n]*/g, "")), "nothing conditional sits between step 5 and the guard call (no APP_STORE branch around it)");
ok(at("if (pre.problems.length) die(") > guardCall && at("if (pre.problems.length) die(") < upload, "any pre-upload problem stops the run before upload");
ok(!/externalDistribution\(|exportOptionsPlist\(/.test(src), "the script builds no plist and checks no groups outside preUploadGuard()");
ok(at("fs.writeFileSync(exportOpts, pre.xml)") > guardCall && at("fs.writeFileSync(exportOpts, pre.xml)") < upload, "the export plist written is the one the guard checked");
ok(at("exportOptionsProblems(") > 0 && at("exportOptionsProblems(") < upload, "plist check runs before the upload");
ok(!/<key>method<\/key>/.test(src), "no second hand-written export plist in the script");
const wait = at("await awaitValidBuild(");
ok(wait > upload, "post-upload confirmation goes through awaitValidBuild()");
ok(at("if (problems.length) die(") > wait, "any awaitValidBuild problem stops the run");
ok((src.match(/betaGroups\?/g) || []).length === 2, "groups are read in exactly two places: the app before upload, the build inside awaitValidBuild");
ok(!/WAIT_VALID/.test(src) && !/processingState[^\n]*break/.test(src), "no default path that stops waiting before VALID (old --wait-valid opt-in gone)");
ok(!/--(skip|no|allow)-?(guard|external|internal)/i.test(src), "no flag skips the guard");
ok(/preUploadGuard\(\{\s*teamId: TEAM_ID, appStore: APP_STORE,/.test(src) && at("exportOptionsProblems(fs.readFileSync(exportOpts, \"utf8\"), { appStore: APP_STORE })") > 0, "the plist and its check both follow the run's mode");
ok(!/\/v1\/builds\/\$\{id\}\/betaGroups/.test(src) && /\/v1\/betaGroups\?filter\[builds\]=\$\{id\}/.test(src), "the build's groups are read with filter[builds] (Apple 403s /builds/{id}/betaGroups)");

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

// ── pre-upload guard, run for real in EACH mode ────────────────────────────
// (1) --app-store: the group guard still runs and rejects an external group
//     and a public link. (2) default: the guard runs and the plist keeps
//     testFlightInternalTestingOnly true. Wrapping the group check in an
//     appStore conditional, or skipping it in either mode, turns these red.
const linked = { id: "g5", attributes: { name: "Linked team", isInternalGroup: true, publicLinkEnabled: true } };
async function pre(appStore, groups) {
  let reads = 0;
  const r = await preUploadGuard({ teamId: "X54Q9P743S", appStore, readAppGroups: async () => { reads++; return groups; } });
  return { ...r, reads };
}
for (const [appStore, mode] of [[true, "--app-store"], [false, "default"]]) {
  const e = await pre(appStore, [internal, external]);
  ok(e.reads === 1, `${mode}: the app's beta groups are read before upload (read ${e.reads}x)`);
  ok(e.problems.some(p => /external beta group "Festival beta"/.test(p)), `${mode}: an external beta group stops the upload (got ${JSON.stringify(e.problems)})`);
  const l = await pre(appStore, [internal, linked]);
  ok(l.problems.some(p => /public TestFlight link on "Linked team"/.test(p)), `${mode}: a public link stops the upload (got ${JSON.stringify(l.problems)})`);
  const c = await pre(appStore, [internal]);
  ok(c.reads === 1 && c.problems.length === 0, `${mode}: internal-only groups pass (got ${JSON.stringify(c.problems)})`);
  ok(new RegExp(`<key>${INTERNAL_ONLY_KEY}</key><${appStore ? "false" : "true"}/>`).test(c.xml), `${mode}: the plist sets ${INTERNAL_ONLY_KEY} ${appStore ? "false" : "true"}`);
}
{
  const d = await pre(false, [internal]);
  ok(exportOptionsProblems(d.xml).length === 0 && !/<key>testFlightInternalTestingOnly<\/key><false\/>/.test(d.xml), "default mode: testFlightInternalTestingOnly stays true (never false)");
}

if (fails.length) { fails.forEach(f => console.log(`  ✗ ${f}`)); console.log(`✗ testflight guard: ${fails.length} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ testflight guard: ${checks} checks — export plist internal-only, an external group or public link stops the run before upload, mandatory wait for VALID before the build's groups are read`);
