# QA v209 Autonomous iOS QA Harness

## What changed

This branch adds the missing automation path for simulator-driven QA instead of relying on blocked iPhone Mirroring clicks, missing `simctl io tap`, or `simctl openurl` confirmation sheets.

- `ios/App/App/PlurskyBridgeViewController.swift` injects QA launch params into the Capacitor WebView at document start.
- `ios/App/App/Base.lproj/Main.storyboard` now uses that bridge subclass.
- `ios/App/AppUITests/AppUITests.swift` adds an XCUITest smoke flow for Memories lenses.
- `ios/App/App.xcodeproj/project.pbxproj` adds the `AppUITests` target and includes the bridge file in the app target.

## QA launch arguments

The bridge accepts these launch arguments or matching env vars:

- `-plurskyQAMode 1` / `PLURSKY_QA_MODE=1`: bypass onboarding.
- `-plurskyQASeed memories` / `PLURSKY_QA_SEED=memories`: seed Memories QA moments.
- `-plurskyInitialTab memories` / `PLURSKY_INITIAL_TAB=memories`: open the Memories tab.

## Commands run

```bash
xcrun simctl shutdown all
xcrun simctl erase all
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  build-for-testing
```

Result: `** TEST BUILD SUCCEEDED **`.

Then attempted:

```bash
rm -rf /tmp/plursky-ui-test.xcresult
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -resultBundlePath /tmp/plursky-ui-test.xcresult \
  test -only-testing:AppUITests/AppUITests/testMemoriesSmokeFlow
```

Result: Xcode rebuilt and began test launch, but local `CoreSimulatorService` entered uninterruptible state and `simctl list devices booted` stopped returning a booted device. This is a host Simulator runtime issue, not an app compile issue.

## Current conclusion

The previous blockers are addressed at the app/repo level by moving control into XCUITest and startup launch arguments. The remaining blocker is local CoreSimulator instability during test execution. Retry after restarting Simulator/CoreSimulator or rebooting the Mac.

## Next verification command

```bash
xcrun simctl shutdown all || true
killall Simulator || true
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -resultBundlePath /tmp/plursky-ui-test.xcresult \
  test -only-testing:AppUITests/AppUITests/testMemoriesSmokeFlow
```
