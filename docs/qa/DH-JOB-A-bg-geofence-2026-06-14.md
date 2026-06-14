# DH-JOB-A — Background Geofence Device QA (2026-06-14)

Agent: HeyClicky Codex agent mode  
Device context: iPhone Mirroring visible, paired physical iPhone available via CoreDevice  
Related issue: #12  
Related PR: #94 (not merged by this agent)

## Coverage

Checked:
- Read repo guardrails in `AGENTS.md`, `CLAUDE.md`, `RELEASE.md`, and `docs/qa/CLICKY-ROLE.md`.
- Confirmed iPhone Mirroring was visible and captured the iPhone home screen as evidence.
- Confirmed a paired physical iPhone was visible to Xcode/CoreDevice: `iPhone 13 Pro (6)` / `iPhone 17 Pro Max (iPhone18,2)`, identifier `B43EBA0E-0131-5609-94D0-49600D6672D6`, state `available (paired)`.
- Confirmed the repo app bundle id is `com.plursky.app` in `capacitor.config.ts` and the Xcode project.
- Checked Xcode’s visible window state and captured the current Xcode window.
- Checked available `xcrun devicectl` subcommands for physical-device process/device controls.

Not checked:
- Did not sign in to Plursky.
- Did not want-list Lucia or Tatsu Dallas.
- Did not grant the iOS Always Allow location prompt.
- Did not start or stop Plursky location tracking.
- Did not background Plursky and simulate Dallas coordinates.
- Did not verify a background notification firing.
- Did not verify 30-minute de-dupe behavior.
- Did not force-quit/re-enter geofence or verify background relaunch.
- Did not tap a notification to verify deep-linking to the venue detail page.

Reason coverage stopped:
- iPhone Mirroring exposed only a generic `AXGroup` for the phone surface, with no accessible app icons or in-app controls to drive safely by element index.
- This HeyClicky runtime blocks unrestricted coordinate/pixel driving for mirrored phone content, so tapping through the iPhone UI would require unsafe pointer/pixel control not available in this build.
- The visible Xcode window was the Organizer `Archives` window, not an active debug/run session for Plursky.
- `xcrun devicectl` on the paired physical device exposed process/install/notification/orientation/sysdiagnose controls, but no physical-device location simulation command equivalent to Xcode’s Debug → Simulate Location menu.

## Evidence

- `docs/qa/DH-JOB-A-2026-06-14-0840-iphone-home.png`
  - Timestamp captured: 2026-06-14 08:40 America/Chicago.
  - On-screen text visible: iPhone home screen, time `8:40`, weather widget `Dallas`, `Expect rain in the next hour`, dock icons Phone / X / Messages / Chrome.
- `docs/qa/DH-JOB-A-2026-06-14-0842-xcode-archives.png`
  - Timestamp captured: 2026-06-14 08:42 America/Chicago.
  - On-screen text visible: Xcode Organizer `Archives`, selected archive identifier `com.dimhour.app`, version `1.0.8 (20)`.

## Step Findings

### 1. Sign in and want-list a Dallas venue

Expected:
- Sign in.
- Want-list Lucia (`32.7470245, -96.8285281`) or Tatsu Dallas (`32.7866473, -96.7776787`).

Observed:
- Not executed.
- iPhone Mirroring was visible at the home screen, but did not expose tappable phone app controls via accessibility.

Observed vs expected:
- FAIL / BLOCKED. The expected app state was not reached.

Evidence:
- Screenshot: `docs/qa/DH-JOB-A-2026-06-14-0840-iphone-home.png`.
- Exact on-screen text: `Dallas`, `Expect rain in the next hour`, `8:40`.

### 2. Profile → Notifications → Manage → grant Always Allow → Start

Expected:
- iOS location prompt includes Always Allow.
- After tapping Start, Location row reads `Tracking`.

Observed:
- Not executed.
- No permission prompt was reached.
- No `Tracking` row was observed.

Observed vs expected:
- FAIL / BLOCKED. The expected permission and tracking state were not observed.

Evidence:
- Screenshot: `docs/qa/DH-JOB-A-2026-06-14-0840-iphone-home.png`.

### 3. Background app and simulate venue coordinates

Expected:
- App is backgrounded.
- Xcode Debug → Simulate Location sets device location to the venue coordinates.
- Notification text fires while backgrounded: `You're near <venue>`.

Observed:
- Not executed.
- Xcode was visible in Organizer `Archives`, not an active debug window for Plursky.
- `xcrun devicectl device --help` showed no `location` subcommand for the paired physical device.

Observed vs expected:
- FAIL / BLOCKED. No simulated location was applied and no notification fired.

Evidence:
- Screenshot: `docs/qa/DH-JOB-A-2026-06-14-0842-xcode-archives.png`.
- Exact on-screen text: `Archives`, `Version`, `Identifier`, `com.dimhour.app`, `1.0.8 (20)`.
- CLI observation: paired device `B43EBA0E-0131-5609-94D0-49600D6672D6` was `available (paired)`.

### 4. Stay in area and verify no repeat within 30 minutes

Expected:
- No repeat notification for that venue within 30 minutes.

Observed:
- Not executed because the initial geofence notification was not produced.

Observed vs expected:
- FAIL / BLOCKED. De-dupe behavior was not measured.

Evidence:
- No notification text was observed.

### 5. Force-quit, re-enter radius, verify background relaunch notification

Expected:
- iOS relaunches Plursky in the background and notification still fires.

Observed:
- Not executed.

Observed vs expected:
- FAIL / BLOCKED. Background relaunch behavior was not measured.

Evidence:
- No background relaunch log or notification was observed.

### 6. Tap notification and verify venue detail deep link

Expected:
- Tapping notification opens the venue detail page.

Observed:
- Not executed because no notification fired.

Observed vs expected:
- FAIL / BLOCKED. Deep link behavior was not measured.

Evidence:
- No notification text was observed.

### 7. Manage → Stop

Expected:
- Location row reads `Off`.
- No further alerts fire.

Observed:
- Not executed because tracking was never started.

Observed vs expected:
- FAIL / BLOCKED. Stop behavior and post-stop alert suppression were not measured.

Evidence:
- No `Off` row was observed.

## Headline

JOB-A remains unverified on device. The current HeyClicky runtime could see the mirrored iPhone and Xcode, but could not safely drive the mirrored phone UI or set physical-device location, so no background geofence behavior was measured.
