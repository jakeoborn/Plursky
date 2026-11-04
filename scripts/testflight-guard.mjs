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
