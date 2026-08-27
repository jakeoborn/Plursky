# Note for lanes — PR 1 (RevenueCat pin) open, two live IAP bugs found

**Date** 2026-08-27 · **main** `430da02` · **live** v232 · **this work** PR [#23](https://github.com/jakeoborn/Plursky/pull/23), open, `CLEAN`, not merged

Companion to [`2026-08-27-pr-chain-v232.md`](2026-08-27-pr-chain-v232.md), which
covers the three PRs already merged and live. This one covers the work order
that followed, and exists mainly because **PR 1 turned up two bugs that are
bigger than the task it was scoped for**.

---

## Status of the queue

| PR | scope | state |
|---|---|---|
| **1** | RevenueCat pin → 9.2.2 | **open as #23**, green, awaiting founder merge |
| 2 | CI verify gate + `scripts/bump.mjs` | not started |
| 3 | Official-map layer (+ `RealMap` `showLabels`) | not started |
| 4 | `photo-tag.jsx` cross-festival resolution | not started |

Hard rules in force: PRs only, no merges, no direct pushes to `main`, no
`cap sync` / Xcode archive / ASC steps, no public copy changes without founder
sign-off.

## PR 1 — what it was asked to do

`npm ci` could never succeed. `@revenuecat/purchases-capacitor@13.1.2` declares
peer `@capacitor/core >=8.0.0`; the app is pinned to Capacitor 6, so the
lockfile was peer-inconsistent **as committed** and no native build could be
produced to carry the season pass.

Registry claims re-verified rather than taken from the work order:

| version | peer `@capacitor/core` |
|---|---|
| **9.2.2** (last 9.x) | **`^6.0.0`** ✅ |
| 10.0.0 | `>=7.0.0` |
| 12.0.0 | `>=8.0.0` |
| 13.1.2 | `>=8.0.0` |

Pinned **exact** — `"9.2.2"`, no caret. A caret lets npm walk into 10.x and
silently reintroduces the ERESOLVE that CI now exists to catch.

```
$ rm -rf node_modules && npm ci
added 116 packages, and audited 117 packages in 773ms
npm ci EXIT CODE = 0
```

## 🔴 What it actually found

The order said to check the five call sites against the v9 API surface "and
adjust if signatures differ". They differ from what the **code assumes** — but
not between versions. v9's `.d.ts` and v13.1.2's declare both of these
identically, so **both bugs have been live the whole time**. They stayed
invisible because sandbox purchase testing is blocked on the Paid Apps
agreement, so the purchase path has never once been exercised end to end.

**1. The purchase could never succeed.**

```js
const { offerings } = await Purchases.getOfferings();   // undefined
```

`getOfferings(): Promise<PurchasesOfferings>` resolves to `{ all, current }`
**itself**, not to `{ offerings }`. So `offerings` was `undefined`, `find()` ran
on `undefined`, `pkg` was falsy, and every purchase returned
`{success:false, error:"Product not available"}`. **The season pass would have
shipped dead** — the code, the ASC product and the RevenueCat offering could all
be correct and no one could buy anything.

**2. The customer-info listener revoked Plus.**

```js
Purchases.addCustomerInfoUpdateListener(({ customerInfo: info }) => _syncEntitlements(info));
```

`CustomerInfoUpdateListener = (customerInfo: CustomerInfo) => void` — the
listener is handed `CustomerInfo` **directly**. Destructuring `.customerInfo`
off it gave `undefined`, and `_syncEntitlements(undefined)` falls through to
`_setPlusSub(false)`. Every push update **turned Plus off** instead of syncing
it. Worse than a no-op: a paying customer loses their entitlement on the next
RevenueCat update.

Both replayed against the real v9 return shapes read out of the installed
`.d.ts`:

```
OLD  getOfferings -> pkg = undefined      NEW  getOfferings -> pkg = ssn
OLD  listener     -> PLUS OFF (revoked)   NEW  listener     -> PLUS ON
```

The remaining call sites — `configure({apiKey})`, `getCustomerInfo()`,
`purchasePackage({aPackage})`, `restorePurchases()` — check out against v9
unchanged, verified field by field against `PurchasesConfiguration`,
`MakePurchaseResult`, `PurchasesPackage.product.identifier` and
`CustomerInfo.entitlements.active`.

> **Status:** both fixed in #23, **not yet merged**. Neither is exploitable —
> one makes purchases fail, the other revokes an entitlement. Nobody gets
> anything free from either. Recorded here because the fix is not on `main`
> yet and any lane touching IAP before #23 lands is looking at broken code.

## Two smaller things worth knowing

**The doc contradiction is resolved** (`docs/marketing/radiate-pitch-refresh-2026-08.md`).
Product truth: the pass is a **non-consumable that never expires**. There is no
"Sep 15–Nov 15 window" and no season expiry — "festival-season pass" is a NAME,
not a term limit. The window language lived only in an internal note; the
outbound email copy never claimed it, so **no public-facing copy changed**.

**The verify skill was lying.** `plursky-verify`'s `ORDER=` line matched *every*
`*.jsx` string in `index.html`, including filenames mentioned in **prose
comments**. Once #21 added those comments, the extraction hoisted `app.jsx` and
`spotify.jsx` to the front of the load order, so `app.jsx` evaluated before
`data.jsx` and died on `FESTIVAL_CONFIG is not defined` — a **false `root=0`**
with entirely healthy code behind it.

Fixed to match only real `src="…"`. **Any lane running the mount probe against
a pre-#23 checkout will get that false failure.** PR 2 must use the corrected
extraction when it moves the probe into CI.

## Version cascade

PR 1 takes **v233**. PR 3 → v234, PR 4 → v235. PR 2 is docs/CI/scripts only, so
it does not bump. Landing PR 2's `scripts/bump.mjs` before PR 3 and PR 4 is what
stops the manual three-file sed chain that produced the v230→v231→v232 dance in
the previous report.

## Still founder-gated, in flight

Google Search Console property + Squarespace DNS TXT · ASC product creation +
RevenueCat offering rewire · Paid Apps agreement → Active. #23 unblocks the
**build**, not the **purchase loop** — the loop needs the agreement active
before anything can be tested for real.

Paywall button copy remains **PROVISIONAL** pending founder sign-off. No further
public copy changes without it.
