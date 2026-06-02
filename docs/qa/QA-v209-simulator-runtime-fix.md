# QA v209 Simulator Runtime Fix

## What "local simulator runtime" means

The local simulator runtime is Apple's CoreSimulator stack installed by Xcode:

- Runtime: `iOS 26.4` and `iOS 26.5` from `xcrun simctl list runtimes`.
- Service: `com.apple.CoreSimulator.CoreSimulatorService`.
- Devices: local simulator data under `~/Library/Developer/CoreSimulator/Devices`.

It is separate from Plursky. It is the local Apple service that boots virtual iPhones and runs XCUITest.

## What was fixed

I cleared the stale CoreSimulator state that had zombie iOS 26.5 runtime processes even though `simctl` showed no booted devices:

```bash
killall Simulator 2>/dev/null || true
xcrun simctl shutdown all || true
pkill -f 'CoreSimulator/Volumes/iOS_' 2>/dev/null || true
pkill -f 'com.apple.CoreSimulator.CoreSimulatorService' 2>/dev/null || true
xcrun simctl erase all || true
```

After that, the iOS 26.4 simulator successfully reached `Booted`, accepted `simctl spawn`, and produced a screenshot at `/tmp/plursky-boot-check.png`.

## What is still broken

When Xcode tries to launch the UI test runner, CoreSimulator falls back into a long data-migration wait:

```text
Waiting on Data Migration
Reason: Running plugin com.apple.-0LaunchServicesMigrator
```

That happens before Plursky runs, and it also affects direct app launch after the failed XCTest handoff. This points to a host Xcode/CoreSimulator runtime issue, not a Plursky app bug.

## Verified repo status

The autonomous QA harness still builds:

```bash
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  build-for-testing
```

Result: `** TEST BUILD SUCCEEDED **`.

## Next practical recovery

If the migration loop returns, the next local fix is outside the repo:

1. Quit Xcode and Simulator.
2. Run:

```bash
killall Simulator 2>/dev/null || true
xcrun simctl shutdown all || true
pkill -f 'CoreSimulator/Volumes/iOS_' 2>/dev/null || true
pkill -f 'com.apple.CoreSimulator.CoreSimulatorService' 2>/dev/null || true
xcrun simctl erase all || true
```

3. If it still hangs, reboot the Mac. The stuck service can sit in an uninterruptible state that only a reboot fully clears.
4. Retry the XCUITest smoke test:

```bash
rm -rf /tmp/plursky-ui-test.xcresult
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=CF8E13AF-7A6F-4725-882B-5F142B4BACBA' \
  -resultBundlePath /tmp/plursky-ui-test.xcresult \
  test -only-testing:AppUITests/AppUITests/testMemoriesSmokeFlow
```
