# Report — cross-festival photo resolution, the 2027 roll, and the IAP audit

**2026-08-27 · Claude Code lane · post-#27 work order (ITEMS 1–4)**

Four PRs open. Nothing merged, nothing pushed to `main`.

| # | PR | Item | State |
|---|---|---|---|
| **#27** | official-map layer + `showLabels` (v234) | (prior) | open, **CI green** |
| **#28** | photo-tag cross-festival resolution (v235) | ITEM 2 | open, stacked on #27 |
| **#29** | Paid Apps premise correction | ITEM 4 | open, **targets `main`** |
| **#30** | Forest + Tomorrowland → 2027 (v236) | ITEM 1 | open, stacked on #28 |

⚠️ **#28 and #30 will show NO CHECKS until retargeted.** `sanity.yml` fires only on
`pull_request: branches: [main]`. Per your own PR-2 reminder: do not read "no checks"
as green. Both gates were run locally and the output is in each PR body.

Merge order: **#27 → #28 → #30**. GitHub auto-retargets each child on merge — but
delete the base branch *after* the child retargets, not before, or the child is
stranded (that is how #24 got orphaned last week). #29 is independent.

---

## One correction to the work order

The verification line specifies `node scripts/compile-bundle.mjs --check`.
**That script does not exist** — not in `scripts/`, not anywhere in the repo
(`grep -rn compile-bundle .` → nothing), and Plursky has no bundler by design.
The real equivalent is what CI runs, and it is what I ran:

```
npm ci → node scripts/build.mjs → node scripts/bump.mjs --check
       → tsc --noEmit (JSX parse) → node scripts/verify.mjs
```

---

## ITEM 2 — photo-tag cross-festival resolution (#28)

Auto-tagging read `window.FESTIVAL_CONFIG` / `window.ARTISTS` throughout: the festival
that is **selected**, not the one the photo was taken at.

Import an EDC clip while ACL is active and its May timestamp is checked against ACL's
**October** `dayDates`, matches nothing, and returns `outside_festival_window`. The
importer then does `night = matched.night || fallbackNight` and stamps
`festivalId: window.FESTIVAL_CONFIG.id`.

That last step is why this is not a display glitch. `_activeMoments()` keeps a moment
only when its `festivalId` is current, so **the wrong stamp is persisted and switching
back to EDC never recovers the clip.**

The fix resolves the festival first — every festival in `_DATA_SETS` is asked which of
*its* nights contains the capture time, each in **its own timezone**; GPS breaks ties
only when two claim it; no claimant falls back to the active festival exactly as
before. Every helper defaults to the active set, so same-festival behaviour is
bit-identical.

**A trap worth recording.** My first version let *any* festival win. Four of the six
are `available: false`, and `getActiveFestivalId()` refuses a gated id — so a photo
resolved to Lost Lands would have been stamped with an id the user **can never
select**: hidden on every screen, unreachable, worse than the bug being fixed. Caught
before push; there is now a regression test for it.

Three more instances of the same bug class went with it: the `file.lastModified` trust
gate (rejected a real capture time whenever another festival was selected), the
archive-recovery gate, and the compose form (would have pre-filled an artist chip from
a lineup the moment isn't being saved under).

**Deliberate limit:** `map.jsx`'s `MAP_AFFINE` is solved once at eval time from the
active festival, so amenity naming for a non-active festival uses the config-driven
radial fallback rather than the affine. Artist tagging reads `cfg.gpsAnchors` directly
and stays exact everywhere. No `map.jsx` change — #27's surface untouched.

Receipts: verify gate green + **18/18 VM assertions** against the real `data.jsx` and
the real `photo-tag.jsx` (the bug, the reverse direction, a same-festival regression
guard, the gated guard, the geo tiebreak, the trust gate).

> `rendered chars: 1425` in the gate output is **not** a regression. The unchanged base
> branch measures identically — I ran it to check, because the PR-3 report recorded
> 19376 from a run that got further. The number is render-progress under virtual time,
> not a health signal; `root` + the 14/14 globals are.

## ITEM 1 — the 2027 roll (#30)

**Neither festival has official 2027 dates** (checked 2026-08-27), so both ship
`dates: "Dates TBA"`, which the generator's date regex deliberately fails to parse —
the pages emit **no** JSON-LD `startDate`/`endDate` rather than a fabricated one.
Verified: `grep -c 'startDate\|endDate'` → `0` on both.

Electric Forest's only circulating figure, "Thu Jun 24 2027", is from a prediction
page. And the widely reposted Tomorrowland **"Jul 17–19 and 24–26, 2027" is
demonstrably wrong** — those are 2026's day numbers copied forward:

| | Jul 17 | Jul 24 |
|---|---|---|
| 2026 (real) | **Fri** | **Fri** |
| 2027 (claimed) | **Sat** | **Sat** |

Tomorrowland runs Fri–Sun. Rejected rather than propagated, and deliberately *not*
"corrected" to Jul 16–18 & 23–25 — that would be our arithmetic, not an announcement.

Forest's data layer is deleted (177 lines: ~123 acts, provisional stage assignments,
placeholder set times, centroid-guessed anchors — all describing an edition that
already happened). Recover with `git show 615fa40:data.jsx` at the flip session. The
badge set was **re-keyed, not deleted**: Ranch Arena / Sherwood Court / Tripolee /
Honeybee Hideout / Carousel Club are recurring stages, not lineup data.

Pages, sitemap and both homepage lists are **regenerated**, never hand-edited.
**Sitemap = 10 = 7 festival pages + homepage + terms + privacy**, matching the live
count. Both new pages screenshotted and read.

**Open:** `/f/electric-forest-2026/` and `/f/tomorrowland-2026/` now 404. The work
order said drop them, so they are dropped. A tombstone page is a small follow-up if
you'd rather they soft-land.

## ITEM 4 — the stale premise (#29)

Paid Apps **Active** (2026-05-13 → **2027-03-23**), tax Active, banking Active. The
walkthrough's founding premise — "every IAP, including sandbox testing, fails until the
agreement is active" — is false.

Beyond the one-edit ask: the same premise appeared in **four more places in TODO.md**,
which is the file lanes actually read. All four corrected. One real future date now
recorded: **the agreement expires 2027-03-23.**

## ITEM 3 — IAP audit: one gap, and it needs your word

You said RevenueCat + ASC are live, so I audited the app side rather than waiting.

**Sound:** product lookup matches on `p.product.identifier`, i.e. the *store product*
id — robust to `$rc_lifetime`/`$rc_monthly` package naming. Entitlement `plus` gated
consistently across purchase, restore, and the customer-info listener. Restore path
present and wired to a button. Guideline 3.1.2 disclosure complete on the
auto-renewable, and correctly **absent** on the non-consumable.

**The gap — prices are hardcoded, four places:**

```
spotify.jsx:7015  "$14.99 SEASON PASS"
spotify.jsx:7021  "Season Pass · $14.99 one-time purchase…"
spotify.jsx:7034  "$4.99 / MONTH"
spotify.jsx:7040  "Plursky+ · $4.99/month, auto-renews…"
```

Nothing reads `pkg.product.priceString`. ASC is the source of truth for price and
RevenueCat already returns it localized, so today any ASC price change, or any
non-US storefront, shows the user a **wrong price** — a 2.3.1/3.1.2 exposure, and it
makes the "real localized prices" QA check unverifiable by construction.

**I did not change it.** That is paywall copy, and your standing rule is that paywall
copy stays PROVISIONAL pending your sign-off. The fix is one substitution per site
(`priceString` with the current string as fallback) — the *words* don't change, only
the numeral becomes ASC-sourced. Say go and it ships.

Also stale, in code: the comment at `spotify.jsx:6875` still says sandbox testing "is
still blocked on the Paid Apps agreement". Folds into the same edit.

**Sandbox QA is founder-device work** — I can't drive a purchase from here. The
checklist: offering fetch returns both packages with real localized prices · season
pass grants `plus` · monthly grants `plus` · restore works on a fresh install.

---

## Notes for other lanes

- **`bump.mjs` owns versions.** No hand-sed. Every PR here used `--next`; CI runs `--check`.
- **A stacked PR shows no checks.** Not green — unrun.
- **Delete a base branch only after the child retargets.**
- **`npm ci` works now** (it was the point of the #23 RevenueCat pin) — but each fresh
  worktree needs its own `node_modules` before `verify.mjs` will run.
- Two gated festivals still fail the GPS anchor gate as warnings: `lost-lands-2026`
  worst **39.91**, `edc-orlando-2026` worst **56.90**. Both owe a re-derive at their
  flip sessions. Live festivals are within 0.09.
