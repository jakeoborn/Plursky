# QA v209 New Simulator Run

## New simulator created

```text
Name: Plursky-QA-iPhone-17-Pro
UDID: A41B3D69-B726-4385-BF47-C33C6F634E5D
Runtime: iOS 26.4
Device type: iPhone 17 Pro
```

Created with:

```bash
xcrun simctl create Plursky-QA-iPhone-17-Pro \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-26-4
```

## Result

The fresh simulator was created, but first boot stalled in the same CoreSimulator migration path:

```text
Waiting on Data Migration
Reason: Running plugin com.apple.-0LaunchServicesMigrator
```

It stayed there past 40 seconds and did not reach normal boot readiness, so the XCUITest smoke run could not start on the new device.

## Conclusion

A brand-new simulator did not fix the issue. This now points to the installed local Xcode/CoreSimulator iOS runtime itself, not stale simulator device data and not Plursky app code.

## Best next fix

Use Xcode's Components/Platforms UI or `xcodebuild -downloadPlatform iOS` to reinstall the iOS simulator platform/runtime, then rerun the smoke test. If Xcode offers an iOS simulator runtime update, install it first.
