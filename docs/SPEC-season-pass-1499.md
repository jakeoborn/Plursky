# Spec: $14.99 season pass (+ $4.99/mo) — ASC products, RevenueCat, and the copy that changes

Written 2026-08-22. Pricing signed off by the founder: **$14.99 season pass primary,
$4.99/month secondary**. Nothing here is built yet — this is the build sheet so the work is
one sitting once the Paid Apps agreement is active (see docs/ASC-paid-apps-walkthrough.md).

Blocking dependency: **all IAP, including sandbox, fails until Paid Apps is active** (TODO.md §C.10).
Second dependency: the updated Program License Agreement must be accepted or ASC won't let new
IAP products be created.

## What exists today
- `plursky_plus_annual` — $7.99/yr auto-renewable, **Ready to Submit**, never sandbox-tested.
- `plursky_plus_festival` — $2.99 per-festival non-consumable, referenced in code (`RC_PRODUCT_IDS`),
  deferred (needs festival-scoped entitlement).
- RevenueCat: entitlement `plus`, Current offering `Default` → package Plursky+ → `plursky_plus_annual`.
  App linked, public key matches code. Verified end to end except the actual purchase.
- Code: `spotify.jsx` — `PLUS_KEY`, `RC_PRODUCT_IDS`, `RC_ENTITLEMENT`, `_purchasePlus`, paywall overlay,
  auto-renew disclosure block (~line 6960).

## Products to create in App Store Connect

### 1. Season pass — the primary
| Field | Value |
| --- | --- |
| Type | **Non-Consumable** |
| Product ID | `plursky_season_pass_2026` |
| Reference Name | Plursky Season Pass 2026 |
| Price | $14.99 (US), Apple's global equivalents |
| Display Name | Season Pass |
| Description | Unlock every Plursky+ feature for the whole festival season: no watermark, full-res collages, GIF and video export, unlimited cloud backup. |

Why non-consumable and not a non-renewing subscription: a non-renewing subscription makes the app
responsible for tracking and expiring the term server-side, and there is no server-side receipt
logic today. A non-consumable maps cleanly onto the existing `plus` entitlement (RevenueCat treats it
as lifetime), needs no new backend, and next season simply ships as a new product. Trade-off to be
explicit about: a 2026 pass bought this way does not expire, so `plursky_season_pass_2027` would be an
upsell rather than a renewal. If the founder wants the pass to actually lapse at season end, say so —
that's a different product type and real backend work.

### 2. Monthly — the secondary
| Field | Value |
| --- | --- |
| Type | **Auto-Renewable Subscription** |
| Subscription Group | the existing group that holds `plursky_plus_annual` (same group so users can move between tiers) |
| Product ID | `plursky_plus_monthly` |
| Reference Name | Plursky+ Monthly |
| Price | $4.99/month |
| Display Name | Plursky+ Monthly |

Founder call needed: does `plursky_plus_annual` ($7.99/yr) stay? As-is, a $7.99 annual undercuts
both new prices. Recommendation: leave the product in place but pull it out of the RevenueCat
offering so it isn't shown, rather than deleting it — deletion is messy if anyone ever bought it.

### Review metadata for both
Screenshot of the paywall, plus review notes: "In-app purchase unlocks watermark-free export and
cloud backup. Sandbox tester can reach the paywall from the Me tab → PLUS."
New IAP products can be submitted with the next build or reviewed on their own once the agreement
is active.

## RevenueCat changes
1. Products: add `plursky_season_pass_2026` and `plursky_plus_monthly`, both mapped to entitlement `plus`.
2. Offering `Default`: packages become **Season Pass (primary, featured)** → **Monthly (secondary)**.
   Remove the annual package from the offering.
3. No key changes; the public SDK key in code stays valid.

## Code changes (small)
In `spotify.jsx`:
- `RC_PRODUCT_IDS` gains `season: "plursky_season_pass_2026"` and `monthly: "plursky_plus_monthly"`.
- The paywall's default purchase call (`handlePurchase(RC_PRODUCT_IDS.annual)`, ~line 6954) points at
  `RC_PRODUCT_IDS.season`, with the monthly as the second button.
- The auto-renew disclosure only applies to the monthly. A non-consumable pass must **not** carry
  auto-renew language — showing renewal copy on a one-time purchase is a Guideline 3.1.2 problem.
  So: pass button gets a plain one-time-purchase line, monthly button keeps the disclosure with
  "$4.99/month" substituted for "$7.99/year".
Left unwritten deliberately: the actual button words and the paywall headline are founder copy.

## Public copy that changes with the price — FOUNDER EYES BEFORE IT SHIPS
Both of these are public-facing, so nothing here has been edited. Exact current strings and the
proposed replacements:

**1. terms.html line 44 — currently:**
> <li><strong>Annual subscription</strong> ($7.99/year) covers all festivals and renews automatically unless cancelled at least 24 hours before the renewal date.</li>

Proposed:
> <li><strong>Season Pass</strong> ($14.99) is a one-time purchase that unlocks Plursky+ for the 2026 festival season and does not renew.</li>
> <li><strong>Plursky+ Monthly</strong> ($4.99/month) renews automatically unless cancelled at least 24 hours before the renewal date.</li>

**2. spotify.jsx ~line 6961 — paywall button label:** `"$7.99 / YEAR"` → `"$14.99 SEASON PASS"` plus a
second `"$4.99 / MONTH"` button.

**3. spotify.jsx ~line 6969 — the disclosure block:** currently reads
> Plursky+ · $7.99/year, auto-renews until cancelled. Payment is charged to …

It stays word for word for the monthly with the price swapped, and the season pass gets its own
non-renewing line instead.

**4. spotify.jsx line 6790 comment** ("$2.99/festival or $7.99/yr") — stale, update with the code change.

Also worth a look before launch: the App Store listing description and any screenshots that state
a price.

## Order of operations once Paid Apps goes active
1. Sandbox-test the existing `plursky_plus_annual` purchase — proves the loop end to end before
   anything new is built.
2. Create the two products in ASC, wire the RevenueCat offering.
3. Land the code + copy change (founder-approved words) and archive a build.
4. Sandbox-test the season pass, then submit.
