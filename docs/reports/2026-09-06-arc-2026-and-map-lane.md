# ARC 2026 build + the wave-1 official-map lane is unblocked

**Date:** 2026-09-06 · **Lane:** Claude Code · **For:** Instinct review
**Ships in:** PR #86 (stacked on #85) · **Reproduce:** `node scripts/verify.mjs`

Two things happened. ARC 2026 shipped complete off official sources, and being
the first festival that is **live while the suite runs** it exposed two latent
bugs that no gate could have caught earlier. Separately, the wave-1 map lane
that looked blocked yesterday is not blocked — I had a broken search, not a
data gap. Details below, with a specific ask at the end.

---

## 1. ARC Music Festival 2026 — shipped (PR #86)

Union Park, Chicago. Four stages, **four days**, 96 real sets with real
start/end times. `mapMode: "real"`, no anchors, no invented layout.

**The queue row was wrong.** Issue #57 lists ARC as Sep 4–6. The official
grids are headed FRI SEPT 04, SAT SEPT 05, SUN SEPT 06 **and MON SEPT 07**,
and every page on the site reads "SEPT 4th - 7th 2026". Building to the row
would have dropped 25 Monday sets including Green Velvet, Honey Dijon,
Derrick Carter and Michael Bibi. Backlog rows are hypotheses.

**The site's own taxonomy disagrees with its own grids.** `stage` taxonomy
lists `elrow` (a takeover brand, on no 2026 grid) and omits The Midway (on all
four). Trusted the grids. Worth remembering for other Plot-built festival
sites — the taxonomy is a CMS artifact, not an editorial one.

**No patron map exists on the web** — verified three ways rather than assumed:
sitemap enumeration (30 pages, none a map), no 2026 image asset on any info
page, and a Wayback CDX sweep of the entire archived history returning zero
URLs containing "map". ARC's own FAQ says the map is labelled "when it is
released" — it is an on-site artifact.

## 2. Two latent bugs ARC surfaced

### 2a. The night counter was hardcoded to `/ 3` — already shipped, already wrong

`home.jsx` printed `NIGHT ${day} / 3`. It renders **only during a festival**,
so while every shipped festival sat in the future nobody could see it:

| festival | days | displayed |
|---|---|---|
| summerfest-2026 | 9 | `NIGHT 7 / 3` |
| lollapalooza-2026 | 4 | `NIGHT 4 / 3` |
| hard-summer-2026 | 2 | `NIGHT 1 / 3` |
| arc-2026 | 4 | `NIGHT 3 / 3` |

Only the three-day festivals ever read correctly. Now reads `DAYS.length`,
which data.jsx re-derives from the active config. Confirmed in the rendered
DOM: `NIGHT 3 / 4`.

### 2b. The mount probe assumed no festival is ever live

The probe asserted `preEventCountdown()` returns a countdown, full stop. That
function correctly returns null once the festival has started, so ARC going
live **failed a green tree and blamed bare-name resolution for it**. Now
checked in both directions against the active config's own `startMs` — which
is the stronger test, since a stale config shows a countdown for a festival
that already started and none for one that has not.

### Gates added (both falsified before being trusted)

- **Day-count gate** — refuses any numeric denominator on a day/night counter
  across all 14 `.jsx` sources. Falsified: reintroducing the literal fails at
  `home.jsx:1007`.
- **Countdown direction check** — falsified both ways.

---

## 3. The wave-1 map lane: I had a search bug, not a data gap

Yesterday I reported that the wave-1 five had "rolled over to their next
cycle" and that the lane needed a per-festival archived crawl. The first half
was true; the conclusion was based on a broken tool.

**The Wayback CDX API's `filter` regex silently matches nothing for a bracket
class.** `filter=original:.*[Mm][Aa][Pp].*` returns **HTTP 200 with an empty
body** — indistinguishable from a genuine no-results. Plain lowercase
`.*map.*` works (CDX folds case in the urlkey). I ran the bracketed form
across all five domains, got five empty results, and nearly filed that as
"no archived map URLs exist anywhere".

What caught it was running a control query I *knew* should match
(`.*lineup.*` on lollapalooza.com → 8 rows). **Always run a positive control
before believing a negative result from a filtering API.**

With the plain regex, every one of the five has real map paths:

| festival | map path | 2026 capture |
|---|---|---|
| Ultra Miami | `/site-map/` | ✅ 20260120, HTTP 200 |
| Summerfest | `/grounds-map/` | ✅ 20260118, HTTP 200 |
| Lollapalooza | `/experience/festival-map/` | only 301s to 2009–10 assets |
| Outside Lands | `/festival/festival-map.php`, `/festival-info/map` | query timed out |
| Governors Ball | `/map/` | 1 row, nothing usable |

> ⚠️ **Ultra calls its patron map a "site map".** `/site-map/` and
> `/accessible-map/`. Any map hunt that filters out "sitemap"-looking strings
> as robots/XML noise will discard Ultra's actual map. This is the same class
> as ARC's taxonomy and HARD Summer's unlinked map page: the artifact exists,
> the search discards it.

### Ask

Two of five are pinned. The other three need targeted work, and there is one
question I cannot answer alone:

1. **Can you pull the 2026 map assets for Lollapalooza, Outside Lands and
   Governors Ball?** The page paths are known (table above); what is missing
   is a capture from inside each festival's own 2026 cycle and the image URL
   it points at. archive.org was intermittently returning "Temporarily
   Offline" during my sweep, so this may just need retries at a better hour.
2. **Copyright posture — founder call, not ours.** The five generated plates
   were a deliberate no-artwork choice and each states "Not the official
   patron map; no festival artwork is reproduced." Replacing them ships real
   festival artwork into a public repo for five festivals at once. HARD
   Summer (PR #85) already crossed that line for one. Worth an explicit
   decision before it is five more.

Nothing in this section is blocking PR #86.
