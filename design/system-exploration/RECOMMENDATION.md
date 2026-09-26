# Plursky design systems: recommendation

**Recommendation: Laser.** Holo is a close second if you want light to lead.

This is a concept exploration. Nothing here changes production UI, `spotify.jsx`,
the paywall, copy or store metadata. The next step, once a direction is picked,
is a component-level implementation spec for the winner.

## The three directions

| | **Laser** (dark) | **Holo** (light + Blacklight night) | **Headliner** (poster) |
|---|---|---|---|
| Idea | The UI draws in light, like a rig | PLUR made tactile: wristband foil, kandi beads, collectible set cards | The lineup poster and riso flyer, where type is the image |
| Ground | `#07060B` violet-black | `#F4F3F8` pearl / `#0E0B1D` Blacklight | `#1B24B8` ultramarine, a new ink each night |
| Accent | `#9474FF` (405 nm violet), one glow per screen | `#4A2BFF` ultraviolet + foil on earned things only | `#FF4FB4` fluoro pink spot ink |
| Type | Michroma caps · SF Pro · Martian Mono | Unbounded · SF Pro | Archivo (wdth 62–125) · SF Pro |
| Radii | 6 / 12 / 18 / 28 | 14 / 22 / 32 / bead | 0 / 3 / sticker |
| Elevation | Lit edge, and a glow for the one lifted thing | Soft UV-tinted shadow, bead gloss | Misregistration offset, no blur ever |
| Motion | Timed in beats at 128 BPM; strobe-safe | Springy; foil follows phone tilt | Stepped print cuts, a live ticker |
| Signature | **The rig**: the schedule as beams. **Light trail**: your night as a long exposure | **The band**, and **sets as holo cards** you collect | **Your poster**: your plan billed like a headliner |
| Night | Native | Needs its whole second theme (Blacklight) | Blue ground reads fine; loudest of the three |

Each direction is mocked across the whole product, not just the five App Store screens:

- **Laser:** 7 screens
- **Holo:** 8 screens, including its Blacklight night mode
- **Headliner:** 8 screens

The set covers Today, Lineup as a list, Lineup as a calendar (the stage × time
timetable), the official map, the artist card, the inside of the artist card, and
Me. Headliner adds its Poster view.

All three pass the same design gate (below) at 0 failures on every screen. The
gate settles quality, so the choice is strategic.

## Why Laser

1. **It keeps the standing call, "dark is the brand."** Festival media is shot at
   night. The positioning is calm and readable at 3 AM. Laser is the only
   direction where night is the native state, not a second theme to maintain.
2. **It's ownable, not generic dark.** The fix for "another dark festival app"
   isn't a new background colour. It's two signatures built from Plursky's own
   data that no other app can draw: the **rig** (tonight's schedule as a light
   show) and the **light trail** (the sets you actually saw, as a long exposure
   to share).
3. **The photos support; the system leads.** Today, Lineup and Me look finished
   with zero photography. The Spotify artist photo gets graded into the void on
   the Artist screen, and your Memories stay thumbnails.
4. **The lowest-risk migration.** It maps close to 1:1 onto today's shipped
   `.theme-field` tokens:
   - `--paper` → `--void`
   - `--signal` → `--l405`
   - `--ink` / `--text-2` / `--text-3` → `--ink` / `--ink-2` / `--ink-3`

   SF Pro stays the reading face, which keeps the Dynamic Type path open. The
   two new faces are display-only.
5. **It scales to 13 festivals.** The spectrum means light, not any one
   festival's palette. Stage colours stay on the map only, as ruled.

**Its honest weakness:** at thumbnail size it's the least surprising in the
category. The fix is in the App Store set: screenshot 1 leads with the rig,
which reads as a light show at any size.

## When to choose the others

- **Holo, if light should lead.** It's the most distinctive in a category that
  is all dark, and it's the most culturally warm (kandi, PLUR). The cost is two
  full themes, because at night it has to become Blacklight, and a light UI at
  3 AM is off-positioning.
- **Headliner, if virality outranks calm.** The poster share is the strongest
  single growth artifact of the three. As a whole-app system it's the loudest.
  The blue ground costs OLED power, and a new ink per night times 13 festivals
  is a lot of surface to keep right.

**A portable idea:** Headliner's *My EDC 2026* poster works as a share template
inside any direction. If Laser wins, it's a strong candidate for the Recap
share card, set in Laser's type and colour.

## Honesty notes on the mocks

- **Set times** are EDC LV 2026 Saturday data from `data.jsx`. The plan,
  attended sets and Memories counts are sample user data.
- **Maps** show the **official EDC LV 2026 map** (`edc-map-2026.jpg`, from
  lasvegas.edc.com/festival-map/). Stage pins use the `data.jsx` stage x/y. The
  maps make no distance or walk-time claims.
- **Tracklist cues** are marked "Likely", never exact, per the tracklist ruling.
  The track names are illustrative. The real feature draws on recent setlists.
- **Artist photos** come from Spotify, the app's only approved artist-image
  source. Each one was verified by Spotify returning that artist's own name. The
  Artist screens credit "Photo · Spotify".
- **Memories thumbnails** are Jake's own EDC 2026 photos. They live in the
  gitignored `photos/` folder and are never committed.
- **Mobbin** (second pass, 2026-09-26). Four changes, each restyled per
  direction; the gate still passes at 0 failures on all 23 screens:
  - **Today:** artist faces on "Next on your plan" rows, as in Spotify's queue
    and Particle's "Playing Next". A Spotify photo only where we hold that
    artist's own; otherwise initials, never a stand-in. (Laser, Headliner)
  - **Lineup:** a circled add button that fills when the set is on your plan,
    as in Spotify's artist Events list. (Laser; Holo and Headliner already had it)
  - **Map:** share and close in the stage sheet's header, plus a row of
    follow-up actions, as in the Pangea, Tabby and Wanderlog place sheets.
    Bump's "1.8 mi from you" was deliberately not copied: no distance claims.
  - **Me:** share destinations (Story, Crew, Save, More) under the card, as in
    Beli's recap, and "so far" on the stats, as in Duolingo's dated review.
  - Checked and unchanged: the timetable's current-time pill (Todoist) and the
    artist page order (Shazam, DICE, Live Nation).
  Each Mobbin link is in the review page.

## Design gate

`node design/system-exploration/gate.mjs` measures the rendered screens in
headless Chrome at 440×956. It runs checks G1–G10, and a direction passes at
0 failures:

- **G1** page errors
- **G2** fonts loaded
- **G3** images decoded
- **G4** clipped text
- **G5** text escaping the frame
- **G6** colliding text (per-line ink boxes, only the visible part)
- **G7** type at 11px or more (SVG labels at 9px or more)
- **G8** tap targets at 44px or more (chips at 32px or more)
- **G9** computed token contrast
- **G10** short labels that wrap, and widows

Every check from G2 to G10 was mutation-tested. A planted defect of each kind
made the gate fail before its pass was trusted. That testing caught four gate
bugs:
- The occlusion probe skipped anything outside the viewport.
- A self-clipping element was missed.
- Horizontal clipping by a scroll view was excused as scrolling.
- An outer scroll view judged sideways cuts inside a horizontal scroller.

It also caught two false positives, both fixed:
- Line boxes are taller than their glyphs.
- An ellipsised run was measured at its hidden full width.

**Known blind spot:** text covered by another element is skipped, because scroll
content under a sheet or the tab bar is normal. The visual review covers it. That
review caught a tick label under the now-marker and inconsistent List/Grid
controls, and both were fixed.
