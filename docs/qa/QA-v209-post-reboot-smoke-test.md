# QA v209 Post-Reboot Smoke Test

## Command run

```bash
UDID=CF8E13AF-7A6F-4725-882B-5F142B4BACBA
xcrun simctl boot "$UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$UDID" -b
rm -rf /tmp/plursky-ui-test.xcresult
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" \
  -resultBundlePath /tmp/plursky-ui-test.xcresult \
  test -only-testing:AppUITests/AppUITests/testMemoriesSmokeFlow
```

## What happened

After the Mac reboot, the simulator booted cleanly:

```text
Status=4294967295, isTerminal=YES
Finished
```

Xcode then performed a cold post-reboot build and successfully signed the `AppUITests` runner. At the point where XCTest should launch the runner, `xcrun simctl list devices booted` again returned no booted devices:

```text
== Devices ==
-- iOS 26.4 --
-- iOS 26.5 --
```

The waiting processes were:

```text
com.apple.CoreSimulator.CoreSimulatorService
xcodebuild ... test -only-testing:AppUITests/AppUITests/testMemoriesSmokeFlow
```

## Result

The smoke test still did not execute. Reboot fixed the long migration loop, but not the XCTest handoff: Xcode drops the booted simulator when launching the UI-test runner.

## Next fix to try

Create a brand-new simulator device and run against that new UDID instead of the existing iPhone 17 Pro device. If the new device also disappears at XCTest launch, the remaining issue is likely the generated Xcode test target/scheme metadata rather than CoreSimulator data.
