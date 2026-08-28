# Spec: Plursky App Review submission (season pass IAP + Plursky+ Monthly) via the App Store Connect API

Written 2026-08-27 by Instinct (v2, 6:20pm CT: fresh-build requirement, no-demo-account decision, approved What's New), for Claude to execute. Docs-only; no version bump.
Authorization: Jake, 2026-08-27 4:48pm CT — "Can Claude do the Plursky app review, he did it end to end for Plursky."

## Ground rules

- Everything runs as Jake-local scripts: `cd ~/Downloads && node <script>.mjs`, paste full output back. Auth is ES256 JWT.
- **Key IDs and the Issuer ID are deliberately NOT recorded in this repo — it is public.** They live only on Jake's Mac as `~/Downloads/AuthKey_<KEY_ID>.p8`; read them off the filenames or ask Jake. Neither is a secret without the matching `.p8`, but there is no reason to publish them.
- **Two different keys are in play, and they are not interchangeable** (learned the hard way 2026-08-27):
  - a **metadata key** — Admin role, used for every API read and for product/version/review-submission writes. It **cannot cloud-sign.** Using it for `xcodebuild -exportArchive` fails with `Cloud signing permission error` / `No signing certificate "iOS Distribution" found`, even though the key is Admin (`GET /v1/users` returns 200). Cloud-signing is a capability granted when the key is created, not a function of role.
  - an **archive key** — the only one carrying cloud-signing access. Use it for all `xcodebuild archive` / `-exportArchive` / upload runs. There is no distribution certificate in the Mac's keychain; Apple signs server-side via `-allowProvisioningUpdates`, so nothing is installed locally.
- The final submit PATCH is the point of no cheap return. If anything diverges from this spec while composing (extra required declarations, a build upload becoming necessary, unexpected 409s), STOP and report before firing it.
- This spec submits for review only. No release, no phased release, no pricing or availability changes, nothing else on the store.

## Current state (receipts from 2026-08-27)

- App `6768888507` (Plursky Live) is live on the store.
- Season pass IAP `6806003527` — NON_CONSUMABLE, $14.99 USA manual price, en-US localized. Current IAP version: `615b3fec-b764-4353-9af0-99310409f687` (PREPARE_FOR_SUBMISSION).
- Monthly subscription `6806010811` — ONE_MONTH, $4.99 USA, en-US localized, in group `22124255` ("Plursky Plus", en-US group localization present).
- Review screenshots COMPLETE on the v1 resources: monthly `f50476ff-c9dc-4bd1-a7e7-23577e143424`, season pass `ad8a74b6-0ed0-4d21-a8d5-c71cb12b2203` (uploaded via `subscriptionAppStoreReviewScreenshots` / `inAppPurchaseAppStoreReviewScreenshots`).
- RevenueCat linkage live (ASC API key in RC, "Valid credentials"). RC store status still reads "Missing Metadata" — suspected cause is the 4.4.1 version-scoping gap, step 2 below.

## Step 1 — readiness read (produces the deciding facts)

Run `asc-review-readiness.mjs` v2 (in ~/Downloads; also in iMessage). Read-only. It prints:

- **D1**: whether ANY IAP was ever approved (annual `6775060777` state — `READY_TO_SUBMIT` means never approved)
- **D2**: whether a PREPARE_FOR_SUBMISSION app version already exists
- **D3**: builds list with `processingState` and `usesNonExemptEncryption` (is a VALID build available for a new version)
- **D4**: per-version metadata — localizations, images, review screenshot ON the version objects (IAP version, subscription versions, group version)
- **D5**: the App Review contact record (contact info, demo account, notes)

## Step 2 — close version-scope gaps (decided by D4)

ASC API 4.4.1 moved review metadata to version-scoped objects and deprecated the v1 endpoints we used 2026-08-27. If D4 shows the version objects lacking screenshots or localizations, re-do them version-scoped BEFORE submitting:

- IAP version screenshot: 4.4.1 "Create an in-app purchase image" (v2, scoped to `inAppPurchaseVersions` id `615b3fec-b764-4353-9af0-99310409f687`). Verify exact type/relationship names against Apple's OpenAPI spec before coding. Upload flow is the same reserve → PUT chunks → PATCH commit as the v4 script, and the commit PATCH accepts ONLY `uploaded` + `sourceFileChecksum` (MD5 hex) — `assetToken` 409s on UPDATE.
- Subscription version: localizations + review image via the v2 subscription-version-scoped endpoints.
- Group version: localization via the v2 group-version-scoped endpoint.
- Screenshot file: `~/Downloads/paywall-*.png` (640x1136, both already on Jake's Mac).
- Verify after: each version object lists its screenshot/localizations; Apple's "Missing Metadata" flips to "Ready to Submit" (RevenueCat's store status follows on its next poll — do not use the RC UI as the source of truth, it lags and serves stale reads).

## Step 3 — App Review contact + demo account (D5)

The app requires sign-in, so a demo account is mandatory. `PATCH /v1/appReviewDetails/{id}`:

- `contactFirstName`, `contactLastName`, `contactPhone`, `contactEmail` — Jake's.
- `demoAccountRequired: false` — decided 2026-08-27 6:16pm CT: sign-in (Apple/Spotify OAuth) is optional, core identity is a device-local profile id, and the paywall path has no auth. No demo account; do not invent or request one. The monthly sub's reviewNote already states the paywall is reachable without login.
- `notes` — draft: "In-app purchase unlocks watermark-free export and cloud backup. The paywall is reachable from the Me tab → PLUS. Season Pass is a one-time $14.99 purchase (no renewal). Plursky+ Monthly is $4.99/month auto-renewable; manage or cancel in Settings."

## Step 4 — submission shape (decided by D1, D2, D3)

Apple's rule (App Store Connect Help, "Submit an In-App Purchase"): the FIRST IAP of each type must be submitted WITH a new app version in the same submission; a new subscription group must be submitted with at least one of its subscriptions; everything reviewed together goes in ONE draft submission.

**Branch A — an IAP is already approved:** items = season pass `inAppPurchaseVersion` + group `subscriptionGroupVersion` + monthly `subscriptionVersion`. No app version.

**Branch B — nothing approved yet (expected):** Branch A's items PLUS a new iOS app version:

- `POST /v1/appStoreVersions` {platform: IOS, versionString: live version +0.1 (take the live string from the readiness read), releaseType: MANUAL, app relationship `6768888507`}.
- Attach a build: **a FRESH build from current main is REQUIRED.** capacitor.config.ts has webDir:'dist' (bundled snapshot, not the live site) and build 22 (2026-06-07) predates the season-pass/monthly paywall — reusing it would put an app in review that cannot reach the products. Jake builds from main (v233+), `npx cap sync`, archives, and uploads via Xcode/Transporter (Jake-at-his-Mac step, Claude-guided). Set the version's `build` relationship to the NEW build once it processes to VALID.
- What's New text — **APPROVED by Jake 2026-08-27, use verbatim:** "Plursky+ is here. Season Pass ($14.99 one-time) and Monthly ($4.99) unlock watermark-free exports, cloud backup of your festival photos and videos, unlimited shares, and premium recap templates."
- If the API demands new declarations for the version (age rating, content rights), STOP and report — inherit-only is the assumption, not verified.

## Step 5 — compose and submit (3-step flow, API 4.4.x)

1. `POST /v1/reviewSubmissions` — relationships: app `6768888507` (verify whether `platform` is a required attribute against the OpenAPI spec first).
2. `POST /v1/reviewSubmissionItems` — one per item from step 4, relationships: `reviewSubmission` + exactly one of `inAppPurchaseVersion` / `subscriptionVersion` / `subscriptionGroupVersion` / `appStoreVersion`.
3. Report the composed submission (every item, version string, build id, demo account name only — never the password). On Jake's go: `PATCH /v1/reviewSubmissions/{id}` {submitted: true}.
4. Verify: `GET /v1/reviewSubmissions/{id}?include=items` — items flip to WAITING_FOR_REVIEW, then IN_REVIEW.

## Failure modes and rollback

- Draft submissions are deletable: `DELETE /v1/reviewSubmissions/{id}` (draft only). Items removable: `DELETE /v1/reviewSubmissionItems/{id}`.
- A new app version is deletable while PREPARE_FOR_SUBMISSION.
- Traps verified live 2026-08-27: commit PATCHes accept ONLY `uploaded` + `sourceFileChecksum`; the IAP screenshot create relationship is `inAppPurchaseV2` (not `inAppPurchase`); probe-before-create — repeated POSTs can 409; trust Apple's API reads over any web UI.

## Inputs Jake owes before the final PATCH

1. ~~Demo account~~ — not required (decided 6:16pm CT).
2. ~~What's New copy~~ — approved, verbatim above.
3. A fresh iOS build uploaded from his Mac (Xcode/Transporter) — the one unscriptable step.
4. Go on the final submit PATCH — his 2026-08-27 4:48pm ask authorizes it; reconfirm ONLY if anything diverges from this spec while composing.
