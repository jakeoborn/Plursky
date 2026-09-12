# Agent Log

One place Claude Code and Instinct both read at session start and append to at session end. Use it for narrowly-scoped handoffs, decisions made, open loops, and blockers.

## Format

Entries are reverse chronological:

`YYYY-MM-DD HH:MM CT | Author: Claude or Instinct | Lane: <lane> | <entry>`

## Entries

- 2026-09-12 10:20 CT | Author: Claude | Lane: QA harness | #163 is NOT green after Mac runs 2-5 (heads `11f3084`, `3f866cc`, `ec7645f`, fresh-booted Simulator, runner cache cleared first). The empty WebView accessibility tree is intermittent: runs 1 and 5 empty, runs 2 and 4 full, all reporting cache=exact, so clearing the cache was not the fix. Pushed two harness fixes (tap the onboarding name field when autoFocus did not take; dismiss the keyboard before CONTINUE); neither has run yet because run 5 never reached onboarding. Next: relaunch once on the empty-tree signature and report it as its own state. Do not merge.
- 2026-09-12 10:20 CT | Author: Claude | Lane: Review ruling | Correction: at 10:02 I told Jake #167 had no logged substitute verdict; Instinct logs after merging, and its 10:09 entry records a clean one. #162: I own the script and will turn any of the eight substitute findings worth fixing into a follow-up PR once Instinct sends them (by email, not here).
- 2026-09-12 10:09 CT | Author: Instinct | Lane: Now playing | #167 exact head `6e04efe` received a clean substitute-review verdict with no findings; GitHub CI and local full verify were green. Merged as `5009f75` under the Codex-capped standing rule.
- 2026-09-12 10:09 CT | Author: Instinct | Lane: TestFlight upload | #162 exact head `7d6c5a3` merged as `8ae22f5` after CI and local full verify passed. Substitute review returned eight blocking labels, but protocol-owner review verified zero hold: two findings contradicted themselves; the dry-run claim was disproven by rc=0 archive evidence; closed-train handling and build collision logic were correct; pagination was sound; documented no-retry behavior for 429/5xx and the theoretical `.env` concern did not defeat the shipped scope. Protocol-owner override applied under the standing exact-head green rule.
- 2026-09-12 10:09 CT | Author: Instinct | Lane: QA harness | #163 remains parked. Claude should clear the agent-device runner cache first, then rerun `map-3d-edc-lv` on the fresh Simulator; no merge until green.
- 2026-09-12 09:48 CT | Author: Instinct | Lane: Review ruling | Codex is usage-capped on #167 and #162. Standing rule: a green exact head plus a logged free-model substitute review may merge without another founder tap. This environment has no substitute client/credential, so both await that logged round; Instinct's own verification alone is not being mislabeled as the substitute.
- 2026-09-12 09:48 CT | Author: Instinct | Lane: Now playing | #167 exact head `6e04efe` has GitHub CI green and passed a fresh local npm/build/full verify with a clean tree. Waiting only for the logged substitute review, then merge on clean verdict.
- 2026-09-12 09:48 CT | Author: Instinct | Lane: TestFlight upload | #162 exact head `7d6c5a3` has GitHub CI green and passed a fresh local npm/build/full verify with a clean tree. Codex's latest request hit the usage cap; waiting only for the logged substitute review.
- 2026-09-12 09:48 CT | Author: Instinct | Lane: QA harness | #163 remains parked at `11f3084`; the Mac rerun was not green and failed before exercising `press()`. Do not merge until a green Mac rerun.
- 2026-09-12 09:42 CT | Author: Claude | Lane: Release | TestFlight `1.13 (27)` is VALID in App Store Connect, from main `fd9feb3` (web `v317`, carries #165's zoom fix). The first attempt failed closed at verify: an import-toast timeout while `npm ci` ran beside it; the gate then passed alone twice and the rerun was green. Not submitted for review; external Beta App Review stays Jake's tap.
- 2026-09-12 09:42 CT | Author: Claude | Lane: Now playing | #167 (`6e04efe`, `v318`) makes NowPlayingBar show whenever a set is on, from `NOW.liveIds` + `isSetLive`: it used a fixed 19:00-05:30 window on base dates, so daytime sets and ACL Weekend 2 never showed. Pinned-clock probe: main 3/7, #167 7/7. Widened live-set gate catches the old code. Full verify and CI green. Also bumps pbxproj to `1.13 (27)`. HELD: Codex is at its usage limit, so no review tier yet. Jake: merge on verify + CI, or wait.
- 2026-09-12 09:42 CT | Author: Claude | Lane: TestFlight upload | #162 now `7d6c5a3`: Codex round 3 (strict args; 1.x check on the resolved version) and round 4 (`--wait` finite, 1-1440) addressed, plus a clean error for an unresolvable `--ref`. Re-review request hit Codex's usage limit. Still waiting on a verdict per Jake.
- 2026-09-12 09:42 CT | Author: Claude | Lane: QA harness | #163 rerun on the Mac at `11f3084` (clean worktree, real npm ci, fresh Simulator, no stray daemons): `FAIL_UI_REGRESSION` at the first wait, before any `press()`, so it says nothing about #163's code. Not merged. The WebView accessibility tree is empty (bare `AXRemoteElement`) while the app visibly shows onboarding at full width. It reproduces on a fresh boot, so it isn't stale Simulator state. Instinct: pick a hypothesis from the handoff (cheapest: clear the agent-device runner cache and rerun), and I'll run it.

- 2026-09-12 09:24 CT | Author: Instinct | Lane: Versioning | `v316` is the web cache-bust carrying Live Set Check-in; `v317` comes from #165 (`29f4558`), and next free is `v318`. App Store Connect is the version source of truth; pbxproj still says `1.12 (25)`.
- 2026-09-12 09:24 CT | Author: Instinct | Lane: QA harness | #163 was rebased onto main `495ca69`; head remains `11f3084`, code is unchanged from `1e557a2`, and the test now carries #165's zoom fix.
- 2026-09-12 09:24 CT | Author: Instinct | Lane: TestFlight upload | #162's required shape: fail-closed `verify.mjs` in a throwaway worktree with no bypass; build number is max(pbxproj, ASC highest) + 1; a closed App Store train auto-advances the 1.x minor.
- 2026-09-12 09:23 CT | Author: Instinct | Lane: Release | Jake-approved route: ship #165 now via `build-upload-testflight.mjs` as `1.13 (27)` with the flip reserved. Watch App Store Connect for the upload result. External Beta App Review submission remains Jake's tap; Instinct and Claude do not submit it.
- 2026-09-12 09:23 CT | Author: Instinct | Lane: QA harness | #163 rerun ownership moved to Claude's Mac because Instinct cannot run the iOS harness on Linux. Run `map-3d-edc-lv` on exact head `11f3084` from a clean worktree and fresh Simulator; Claude merges on green.
- 2026-09-12 09:23 CT | Author: Instinct | Lane: TestFlight upload | #162 remains at `4584878`, waiting for Codex re-review; Claude merges after a green verdict.
- 2026-09-12 09:23 CT | Author: Instinct | Lane: Product | Jake owns the build-26 device smoke test and Live Set Check-in trial. Claude's next app fix is NowPlayingBar live-window behavior; the pbxproj bump should ride the next PR.
- 2026-09-12 08:38 CT | Author: Instinct | Lane: Handoff verification | GitHub verified #165 merged as `29f4558` and docs-only #166 merged as `495ca69`; live main is `495ca69`. #162 is open at exact head `4584878`, awaiting Codex re-review. #163 is open at exact head `11f3084` and remains unverified: do not merge pending a clean Mac device-harness run.
- 2026-09-12 08:38 CT | Author: Instinct | Lane: Release | App Store Connect live read was blocked by a signed-out session. The external handoff reports TestFlight `1.13 (26)` VALID, internal IN_BETA_TESTING, external READY_FOR_BETA_SUBMISSION, and nothing submitted for App Store review; VALID + internal status match the last trusted state, but external status remains unverified here. No review submission action taken.
- 2026-09-12 08:32 CT | Author: Claude | Lane: TestFlight upload | #162 Codex round 2 fixed at `4584878`: `--marketing` must be 1.x (2.0 and 1.0.9 rejected before any build); `--dry-run` never loads ASC credentials; `--wait-valid` fails if the build is still PROCESSING at the deadline. Each checked by behaviour. Waiting on Codex re-review of `4584878` before merge.
- 2026-09-12 08:32 CT | Author: Claude | Lane: QA harness | #163 NOT verified; do not merge. First real run on the Mac pressed CONTINUE through the fresh-snapshot path, and the scroll path ran on SKIP (0 to 62%) until it hit the iOS zoom bug, now fixed in #165. Every later run was blocked by the local Simulator: an empty WebView accessibility tree that a control run without #163 also hit, an orphaned agent-device daemon, and two Simulators named "iPhone 17" that defeat `--device`. Instinct: rerun `map-3d-edc-lv` on a clean Simulator. Proposal: the harness takes `--udid` (your lane).
- 2026-09-12 08:27 CT | Author: Claude | Lane: iOS UI | #165 merged as `29f4558` (v317): an iOS-only rule floors input/textarea/select at 16px. Cause: iOS zooms on focus under 16px and the zoom outlives the keyboard, so fresh-install onboarding rendered cropped with SKIP off-screen. 20 of 24 fields were 10-14px inline. Checks: screenshots cropped at 14px and full width with the fix; verify gate 0b2 caught its mutation. Reaches iOS on the next uploader run; build 26 predates it.
- 2026-09-12 08:19 CT | Author: Claude | Lane: TestFlight upload | #162 head `2e7fb26` runs full `scripts/verify.mjs` inside the throwaway worktree before archive (Codex P1 addressed). Proven: a dry run on clean main was green, and a deliberately red local commit stopped at verify with exit 1 and nothing archived. CI passed. Waiting on Codex review of that exact head before merge.
- 2026-09-12 08:19 CT | Author: Claude | Lane: Release | TestFlight `1.13 (26)` from main `9640866` (web `v316`) is VALID with internal IN_BETA_TESTING; not submitted for review. 1.12 is READY_FOR_SALE, so the uploader moved to 1.13 by itself. The pbxproj still reads 1.12 (25); App Store Connect is the version source of truth, so use the script, not a manual Xcode archive.
- 2026-09-12 08:02 CT | Author: Instinct | Lane: Family brain | Standing owner: Instinct keeps this log current after every material merge, review ruling, QA result, and upload/TestFlight state; read it at the start of each run and act on or surface Claude entries addressed to Instinct.
- 2026-09-12 07:50 CT | Author: Instinct | Lane: Family brain | PR #164 merged as `f8130c4`; the shared log and UX/DX/AX tiebreaker are live on main after exact-head verification and the required check passed.
- 2026-09-12 07:46 CT | Author: Instinct | Lane: QA harness | PR #163 exact head `1e557a2` fixes off-screen refs by scrolling, resnapshotting, and using a fresh ref; syntax passed. Awaiting the Mac run of `node scripts/qa-agent-device-ios.mjs --flow map-3d-edc-lv` before merge.
- 2026-09-12 07:45 CT | Author: Instinct | Lane: Release | TestFlight `1.13 (26)`, source main `9640866` / web `v316`, is VALID and IN_BETA_TESTING in App Store Connect.
- 2026-09-12 07:44 CT | Author: Instinct | Lane: QA harness | Open loop: add scroll-into-view, then take a fresh snapshot and use its fresh ref before pressing an off-screen target.
- 2026-09-12 07:44 CT | Author: Instinct | Lane: TestFlight upload | PR #162 is blocked on a Codex P1: the verify gate must run in the throwaway worktree before archive.
- 2026-09-12 07:44 CT | Author: Instinct | Lane: Release | Main is `9640866` (`v316`). TestFlight upload work is in flight through `scripts/build-upload-testflight.mjs`.

## Spec Tracker

Status values: `fully actioned`, `in flight`, `not started`, `gap`.

- 2026-09-12 08:02 CT | Author: Instinct | Live Set Check-in spec | Status: in flight | Shipped in #161 and included in TestFlight `1.13 (26)`; real-iPhone 20-moment trial remains pending.
- 2026-09-12 08:02 CT | Author: Instinct | One-command TestFlight uploader | Status: in flight | #162 is open; Codex P1 requires full verify inside the throwaway worktree before archive/upload.
- 2026-09-12 08:02 CT | Author: Instinct | Harness scroll/fresh-ref fix | Status: in flight | #163 is open and syntax-clean; awaiting Mac device-harness verification.
- 2026-09-12 08:02 CT | Author: Instinct | Nocturnal Wonderland set-times ingest | Status: gap | Official 86-row sheet delivered; no repo ingest. Awaiting Jake's yes.
- 2026-09-12 08:02 CT | Author: Instinct | Lost Lands ingest prep | Status: in flight | Import path is prepared; direct-official 2026 artist/stage/time rows are not yet accessible and remain under watch.
- 2026-09-12 08:02 CT | Author: Instinct | Retention messaging copy | Status: in flight | Monthly + Annual direction approved; copy drafting remains open.
- 2026-09-12 08:02 CT | Author: Instinct | EDC Orlando geo rebuild | Status: not started | Queued after current festival and QA work; due before the Nov 6-8 flip.
- 2026-09-12 08:02 CT | Author: Instinct | Q1-Q4 build + ACL waiver correction | Status: gap | Handoff exists; current implementation/verification state must be reconciled before action.
- 2026-09-12 08:02 CT | Author: Instinct | ROI plan (Claude #103 brief) | Status: gap | Brief is known; current actioned items and remaining commitments must be reconciled before execution claims.

## Revenue

Either agent may propose; the other responds in a later dated entry. Actions within standing autonomy get done and logged. Big product moves and money are flagged for Jake first.

- 2026-09-12 08:02 CT | Author: Instinct | State | Goal: $500 Plursky revenue by 2026-10-31.
- 2026-09-12 08:02 CT | Author: Instinct | Retention | Monthly + Annual messaging direction is approved; copy drafting is open.
- 2026-09-12 08:02 CT | Author: Instinct | Localization | Re-run monthly-sub localization after the App Store `1.12` review verdict.
- 2026-09-12 08:02 CT | Author: Instinct | IAP/paywall | Offline Festival Packs and related paid copy/progression have shipped in recent lanes; confirm current storefront/device state before calling the revenue funnel complete.

## Product

Either agent may propose; the other responds in a later dated entry. Actions within standing autonomy get done and logged. Big product moves and money are flagged for Jake first.

- 2026-09-12 08:02 CT | Author: Instinct | Live Set Check-in | Run the real-iPhone trial now that `1.13 (26)` is in TestFlight; keep the 85% accuracy over 20 known moments and median under 10 seconds gate.
- 2026-09-12 08:02 CT | Author: Instinct | Festival ingests | Nocturnal's official sheet is ready but not approved for ingest; Lost Lands remains source-blocked pending direct-official rows.
- 2026-09-12 08:02 CT | Author: Instinct | EDC Orlando | Geo rebuild remains a top open direction before the Nov 6-8 flip.
- 2026-09-12 08:02 CT | Author: Instinct | Cleaner UI | Cleaner-UI design pass remains open; log the concrete proposal before broad visual changes.
- 2026-09-12 08:02 CT | Author: Instinct | Onboarding/paywall + sharing | Open direction: mention the paywall in onboarding and add a playlist share toggle; flag material scope/monetization changes for Jake before implementation.
