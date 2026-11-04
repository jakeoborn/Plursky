// testflight-guard.mjs — keeps a build from build-upload-testflight.mjs on
// INTERNAL TestFlight only. Pure functions, so test-testflight-guard.mjs can
// prove each rule without Xcode or App Store Connect.
//
// Two layers:
//   1. the export itself: `testFlightInternalTestingOnly` (Xcode 26 export
//      option; `xcodebuild -help` documents it as "this build cannot be
//      distributed via external TestFlight or the App Store");
//   2. App Store Connect state, read before the upload and again on the
//      processed build: any external beta group, or a public link, stops the
//      run. Nothing here writes to App Store Connect.

export const INTERNAL_ONLY_KEY = "testFlightInternalTestingOnly";

export function exportOptionsPlist(teamId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>${teamId}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>${INTERNAL_ONLY_KEY}</key><true/>
</dict></plist>
`;
}

// Problems with an export-options plist; empty when it is internal-only.
export function exportOptionsProblems(xml) {
  const m = new RegExp(`<key>${INTERNAL_ONLY_KEY}</key>\\s*<(true|false)\\s*/>`).exec(xml);
  if (!m) return [`export options lack ${INTERNAL_ONLY_KEY}`];
  if (m[1] !== "true") return [`export options set ${INTERNAL_ONLY_KEY} to false`];
  return [];
}

// ASC betaGroups rows → reasons the build could reach anyone outside the team.
// An absent isInternalGroup is treated as external: unknown never passes.
export function externalDistribution(groups) {
  const out = [];
  for (const g of groups || []) {
    const a = g?.attributes || {};
    const name = a.name || g?.id || "unnamed group";
    if (a.isInternalGroup !== true) out.push(`external beta group "${name}"`);
    if (a.publicLinkEnabled === true) out.push(`public TestFlight link on "${name}"`);
  }
  return out;
}

// Wait for the uploaded build to be VALID, then read its beta groups. The
// groups are never read while the build is PROCESSING (or in any state but
// VALID): a group Apple attaches when processing finishes would otherwise be
// missed. There is no opt-out. All I/O is injected, so the test drives it with
// a fake clock and fake ASC.
//   poll()            → { state, buildId }  (state null while not visible yet)
//   readGroups(id)    → ASC betaGroups rows for that build
//   sleep()           → resolves after one poll interval
//   now(), deadline   → ms clock and the give-up time
// Returns { state, buildId, groups, problems }; any problem means stop.
export async function awaitValidBuild({ poll, readGroups, sleep, now, deadline, onWait = () => {} }) {
  let state = null, buildId = null;
  while (now() < deadline) {
    ({ state = null, buildId = null } = (await poll()) || {});
    if (state === "VALID") break;
    if (state === "INVALID" || state === "FAILED") {
      return { state, buildId, groups: [], problems: [`App Store Connect marked the build ${state}`] };
    }
    onWait(state);
    await sleep();
  }
  if (!state) return { state, buildId, groups: [], problems: ["the build never appeared in App Store Connect before the deadline"] };
  if (state !== "VALID") return { state, buildId, groups: [], problems: [`the build is still ${state} at the deadline; its groups were not read`] };
  const groups = (await readGroups(buildId)) || [];
  return { state, buildId, groups, problems: externalDistribution(groups) };
}
