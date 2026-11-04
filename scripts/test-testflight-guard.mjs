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
//     back the processed build's groups, and has no flag that skips the guard.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INTERNAL_ONLY_KEY, exportOptionsPlist, exportOptionsProblems, externalDistribution } from "./testflight-guard.mjs";

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
ok(at("externalDistribution(buildGroups)") > upload, "processed build's groups are read back after the upload");
ok(!/--(skip|no|allow)-?(guard|external|internal)/i.test(src), "no flag skips the guard");

if (fails.length) { fails.forEach(f => console.log(`  ✗ ${f}`)); console.log(`✗ testflight guard: ${fails.length} of ${checks} checks failed`); process.exit(1); }
console.log(`  ✓ testflight guard: ${checks} checks — export plist internal-only, an external group or public link stops the run before upload, processed build read back`);
