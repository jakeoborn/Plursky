# QA v209 Smoke Test Run

## Command

```bash
UDID=CF8E13AF-7A6F-4725-882B-5F142B4BACBA
xcrun simctl shutdown all >/dev/null 2>&1 || true
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

## Result

The simulator boot completed successfully after normal first-boot migration:

```text
Status=4294967295, isTerminal=YES
Finished
```

Xcode then built and packaged the app/test runner, but when the XCTest runner should launch, the booted simulator disappeared from `simctl list devices booted` while `xcodebuild` kept waiting.

Observed after the stall:

```text
== Devices ==
-- iOS 26.4 --
-- iOS 26.5 --
```

Only `com.apple.CoreSimulator.CoreSimulatorService` and the waiting `xcodebuild` process remained.

## Conclusion

The Plursky XCUITest harness still builds, but this smoke run did not execute because Xcode/CoreSimulator drops the booted simulator during the UI-test launch handoff. This is now narrowed to local Simulator/XCTest runtime behavior rather than app code.

## Best next fix

Reboot the Mac to fully clear CoreSimulator, then rerun the same command. If it still drops the simulator after reboot, create a fresh simulator device from Xcode or with `simctl create` and run the test against that new UDID.
