# ASC App Review readiness — measured read against the live API

**Date:** 2026-08-27 · **Lane:** Claude Code · **Spec:** PR #32 (`docs/SPEC-app-review-submission.md`)

Every line below is a live App Store Connect API read, not an inference. Where a
spec premise failed the read, the correction is stated with the measurement that
falsified it.

## Bottom line

The submission is **one blocked API call away from being fully composed**. No
screenshot re-upload is needed, no demo account is needed, and two of the spec's
five "pending" items were already true. One genuinely new blocker surfaced that
the spec did not anticipate: **no attachable build exists**.

## Corrections to the spec's stated premises

| # | Spec / brief said | Measured | Impact |
|---|---|---|---|
| 1 | Annual `6775060777` is an IAP; `404` means never approved | It is a **subscription**, group level 1, state `READY_TO_SUBMIT` | Gave us a working control to diff the broken product against |
| 2 | Screenshots need re-doing version-scoped (4.4.1 gap) — "likely why RC says Missing Metadata" | **Falsified.** Both screenshots are attached and `COMPLETE`. The version objects have `image: NULL` — *but so does the annual, which is `READY_TO_SUBMIT`* | **No re-upload needed.** Saves the whole of spec Step 2 |
| 3 | "The app requires sign-in, so a demo account is mandatory" | **False.** All 10 prior submissions carry `demoAccountRequired=false`, and Jake's own approved review note reads *"No account/login is required to reach the paywall."* | **Jake owes one fewer input** |
| 4 | Version-scoped endpoints must be discovered/verified | All three version objects exist and are `PREPARE_FOR_SUBMISSION` | Step 5's relationship names verified correct |
| 5 | "If Apple rejects reusing the live build, STOP" | **Every** non-expired VALID build is already attached to a released version | New blocker — see below |

## The five deciding facts

- **D1 — prior approval:** none. One IAP (`plursky_season_pass_2026`, `MISSING_METADATA`)
  and two subscriptions (annual `READY_TO_SUBMIT`, monthly `MISSING_METADATA`).
- **D2 — app versions:** no `PREPARE_FOR_SUBMISSION` version exists. Live is **1.11**;
  all ten historical versions are `READY_FOR_SALE`.
- **D3 — builds:** four non-expired VALID builds (19, 20, 21, 22) — **all four already
  attached** to released versions. There is no free build to hang a new version on.
- **D4 — version objects:** all three present and `PREPARE_FOR_SUBMISSION`, each with an
  `en-US` localization. Product-level prices confirmed against ASC as source of truth:
  season pass **$14.99**, monthly **$4.99** — these match the strings hardcoded in
  `spotify.jsx`, so that known gap is currently *correct*, just not *sourced*.
- **D5 — review contact:** present and complete on every version. No demo account set,
  and per correction #3 none is required.

## What is actually still missing

1. **Season pass has no territory availability at all.** `inAppPurchaseAvailability`
   returns **404** — the resource does not exist. The monthly subscription has one.
   This is a real hole and a strong candidate for the `MISSING_METADATA` state.
2. **`MISSING_METADATA` root cause is not yet proven.** Two hypotheses were tested
   against the `READY_TO_SUBMIT` annual as a control and **both were falsified**:
   - version-scoped image → annual has none either;
   - null `reviewNote` → set it on the monthly (`200 OK`), state did not move.

   Rather than keep binary-searching config diffs, the decisive step is to let Apple
   name the gap by composing a draft submission and reading the rejection.

## The one blocked call

Composing the draft (`POST /v1/reviewSubmissions` + three `reviewSubmissionItems`) was
refused twice by the Claude Code auto-mode permission classifier as an outward-facing
write. It was **not** refused for lack of authorization, and no attempt was made to
work around it. The script is staged at `~/Downloads/asc-compose-draft.mjs`; it creates
a draft only, cannot submit, and prints its own rollback.

Its result decides the branch:

- **items accepted** → no app version is demanded → the rest is scriptable end to end;
- **items refused** → the error text names the true blocker, and if that is "needs an
  app version", D3 means a **fresh Xcode build upload is unavoidable** — the one step
  that cannot be driven from here.

## Side finding — credential surface in PR #32

The spec commits an ASC **Key ID** and **Issuer ID** into what is a **public** repo.
Neither is a secret without the `.p8`, but both are needless exposure and the repo
convention already excludes credential material. Recommend redacting to
`~/.config`-style references before #32 merges.

## Changes made to live ASC state

One: a `reviewNote` was written to the monthly subscription (previously null), modelled
on the annual's approved wording. It was a hypothesis test that came back negative, but
the note is correct, reviewer-facing metadata and was left in place. Reversible.
No pricing, availability, or customer-facing copy was touched. Nothing was submitted.
