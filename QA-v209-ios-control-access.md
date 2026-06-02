# Plursky iOS Control Access Attempt

Date: 2026-06-01
Agent: HeyClicky Codex agent mode

## Goal

Find and improve a safe way for the agent to drive the iOS app without unsafe pixel-clicking inside iPhone Mirroring.

## What now works

- Found a booted iOS Simulator: iPhone 17 Pro, UDID `CF8E13AF-7A6F-4725-882B-5F142B4BACBA`.
- Built Plursky for Simulator with `xcodebuild`.
- Installed and launched `com.plursky.app` with `xcrun simctl`.
- Confirmed the earlier black screen was transient: normal Simulator launch renders Plursky after a few seconds.
- Added local code hooks for safer QA setup:
  - `app.jsx`: accepts `memories` as a valid `tab` deep-link value.
  - `app.jsx`: adds `qaMode=1` onboarding bypass parsing.
  - `app.jsx`: query parsing can also read hash-style `#?...` params.
  - `spotify.jsx`: adds a guarded `qaSeed=memories` localStorage seeder for synthetic Memories data when no moments exist.
- Rebuilt and synced after those changes.

## Current blocker

The Simulator can launch the app normally, but launching with URL arguments such as `plursky://localhost/?qaMode=1&tab=memories&qaSeed=memories` or `capacitor://localhost/#?qaMode=1&tab=memories&qaSeed=memories` opens a blank cream screen. Console shows WebView loaded and no JS crash. That means the next fix is not generic simulator access anymore; it is native URL/deep-link delivery for Capacitor on Simulator.

## Why iPhone Mirroring still cannot be safely driven

- iPhone Mirroring exposes only the host app window/menu AX tree, not the iOS app's buttons.
- HeyClicky's safe runtime does not expose drag or unrestricted pixel-clicking for mirrored content.
- Therefore physical-device QA still requires human tapping unless a safe coordinate/drag permission mode is enabled outside this runtime.

## Practical next paths

1. Add a real Capacitor `appUrlOpen` listener that converts incoming simulator URLs into app state/localStorage actions instead of relying on `window.location.search`.
2. Alternatively add a native/debug launch argument or environment variable read by the WebView bootstrap to set `qaMode`, `tab`, and `qaSeed`.
3. Once the QA route renders, use Simulator screenshots and available simctl actions for non-device-specific checks.
4. Keep physical iPhone/iPhone Mirroring for Shazam, GPS, Photos import, backup, and Spotify OAuth because those are not fully simulator-representative.

## Guardrail

No commits or pushes were made by this agent.
