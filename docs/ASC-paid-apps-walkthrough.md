# App Store Connect: turning on paid apps (walkthrough for Jake)

Written 2026-08-22. Everything here is a step only the Account Holder can do — 2FA prompts
on his Apple Account, and the tax form can't be edited afterward. No secrets in this file:
where a value is private (TIN, bank numbers) it says which value to use, not the value.

Why it matters: Plursky+ is fully built and wired (code v200, RevenueCat verified, product
`plursky_plus_annual` sitting Ready to Submit) but **every in-app purchase — including sandbox
testing — fails until the Paid Apps agreement is active**. See TODO.md §C.10. Apple's own
estimate is ~1–2 business days from submission to active.

Current account facts (verified from the live listings):
- Enrollment: individual. Seller reads "Jacob Oborn" on both apps
  (Plursky Live id6768888507, Dim Hour id6768082742). Team ID X54Q9P743S, bundle com.plursky.app.
- So Apple's contracting party is Jacob Oborn personally, not Dim Hour, LLC.

## Step 0 — clear the pending Program License Agreement (2 minutes)
An "Updated Apple Developer Program License Agreement Now Available" notice went out Aug 18.
While the current version is unaccepted, **new apps and new in-app purchase products can't be
created**, which would block the season pass. Check appstoreconnect.apple.com for the banner and
accept it if it's there.
Ref: https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/

## Step 1 — sign the Paid Apps agreement
App Store Connect → **Business** → Agreements tab → **Paid Apps** row → *View and Agree to Terms*
→ read → **Agree**. A 2FA code prompt may appear.
Account Holder only. **Irreversible** — once accepted it can't be undone.

## Step 2 — tax form (W-9)
Business → Agreements → **Tax Forms** → *Add Tax Info* next to U.S. Form W-9.
If the W-9 row isn't there, click (+) next to Tax Forms → Paid Apps → check the form → Add.

Fields and what to put:
- **Name (line 1) / TIN** — this is the decision to settle before typing. The account is enrolled
  as an individual, so Apple's contracting party is Jacob Oborn. IRS instructions for a
  disregarded single-member LLC say: owner's name on line 1, the LLC name on line 2, and the
  **owner's** TIN — which points at an SSN rather than the LLC's EIN.
  Confirm with whoever does the taxes first: **this submission can't be edited in App Store
  Connect afterward** (corrections require contacting Apple).
  Ref: https://www.irs.gov/instructions/iw9
- **Address** — the address on file for the enrolled individual.
- Use the downloadable W-9 tip sheet linked at the top of that page if any field is ambiguous.
Ref: https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/

## Step 3 — banking
Only unlocks after Step 1, and Apple won't process it until Step 2 is submitted.
Business → Agreements → **Bank Accounts** → *Add Bank Account*.
- Bank country/region: United States
- Bank: find by routing number, or search by bank name/city/postal code
- **Bank Account Currency: USD**
- **Account Type: Checking**
- Account Number: the account being paid into
- Account holder details: Apple's wording is "enter the details for the bank account holder…
  exactly as it appears on your bank account", and it expects the bank account of "the legal
  entity or individual enrolled in the Apple Developer Program".
  **Open question before submitting:** the enrolled party is an individual (Jacob Oborn) and the
  Mercury account is titled Dim Hour, LLC. That is a plausible name mismatch, and mismatches are
  how payouts get rejected. Either ask Apple Developer Support that exact question first, or point
  banking at an account in his own name for now and revisit when/if the LLC becomes the seller.
A 2FA code prompt may appear here too.
Ref: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/

## Step 4 — verify it went active
Business → Agreements: the Paid Apps row should show active with tax and bank status green.
Then run the sandbox purchase test (TODO.md §C.10 step 2): sandbox Apple ID → buy → watermark
turns off → Restore works. Plus goes live on the current build — no resubmit needed.

## Getting paid
Payments go out "within 45 days of the last day of the fiscal month in which the transaction
occurred", and the US/USD minimum payout threshold is $0.02, so there's no threshold problem.
Practically: September sales arrive in the bank around mid-November, October sales around
mid-December. Worth knowing when judging the Oct 31 revenue goal — booked revenue and cash
received are three to six weeks apart.
Refs: https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments/
      https://developer.apple.com/help/app-store-connect/reference/minimum-payment-threshold/

## If the LLC should be the seller later
Not on the critical path, and it shouldn't be. Enrolling Dim Hour, LLC as an organization needs a
D-U-N-S number (free, up to 5 business days from D&B plus up to 2 more before Apple sees it),
organization identity verification, a second $99 membership, its own Paid Apps agreement, and then
an app transfer — which requires both accounts to have current agreements in place. Weeks.
An app transfer keeps ratings, reviews and existing users, so doing it later costs nothing.
The free D-U-N-S lookup can start in parallel any time.
Refs: https://developer.apple.com/support/D-U-N-S
      https://developer.apple.com/help/app-store-connect/transfer-an-app/app-transfer-criteria/
