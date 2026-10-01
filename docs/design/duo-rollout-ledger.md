# Duo board rollout: token map and gap ledger

The selected dark/light board is `design/system-exploration` @ `6524ccb`
(`shared/duo-tokens.js`, `shared/duo.css`, `shared/duo.js`, `dark/`, `white/`).
Production base: `main` @ `5733224` (v388). No separate component spec existed
before this ledger; the board's `duo.js` screens are the component reference.

## Token map

One purple family, mode-specific contrast. `#6D28D9` (Sep 13 anchor) is not
used on screen: it is 2.6:1 on the dark ground.

| Board role | CSS (new name → legacy name) | Dark | Light | Use |
|---|---|---|---|---|
| ground | `--bg` → `--paper` | `#07060B` | `#F4F3F8` | app ground |
| rows, sheets | `--s1` | `#100E17` | `#FFFFFF` | |
| cards | `--s2` → `--paper-2` | `#19161F` | `#FFFFFF` | cards, inputs |
| wells | `--s3` → `--paper-3` | `#241F2C` | `#EAE8F1` | wells, tracks, pressed |
| ink | `--ink` | `#F3F0FA` | `#14121C` | primary text |
| ink 2 / 3 | `--ink-2` → `--text-2`, `--ink-3` → `--text-3` | `#ABA4BB` / `#8A849A` | `#565266` / `#6B6780` | secondary, metadata |
| accent fill | `--acc` → `--signal` | `#9474FF` | `#4A2BFF` | your plan, selection, primary |
| accent text | `--acc-ink` → `--signal-ink` | `#B7A3FF` | `#4A2BFF` | accent as text |
| on accent | `--on-acc` → `--on-signal` | `#0B0816` | `#FFFFFF` | text on the fill |
| live | `--live` → `--success` | `#3DF5A0` | `#007A53` | LIVE only |
| clash | `--clash` → `--alert` | `#FF4574` | `#C4174F`* | clashes, errors |
| sunrise | `--sun` → `--warn` | `#FFC545` | `#B84A00` | sunrise, caution |
| elevation | `--e1`, `--e2`, `--glow` | board values | board values | card edge, sheets, the one lifted card |

\* The board's light clash `#D81B57` is 4.11:1 on its own `--s3` well, where the
clash label sits; `#C4174F` is 4.83:1. Light `--live` (4.43:1) and `--sun`
(4.31:1) must not be set as small text on `--s3`.

Type: `--f-ui` SF Pro (reading), `--f-display` Michroma (compact caps labels,
11px, never names or sentences), `--f-data` Martian Mono (times, counts).
Both web faces are self-hosted under `fonts/` (SIL OFL), preloaded and precached.
Radii `--rad-xs/sm/md/lg/pill` 6/12/20/28/999. Motion `--beat`, `--bar`,
`--t-tap`, `--t-move`, `--ease-decay`; Reduce Motion stops the live breath.

Legacy `.theme-field` overrides (inline Geist/Instrument Serif → SF, 11px floor)
stay until each surface moves to `duo-*` classes; `duo-*` components never
match those selectors.

## Surfaces

| Surface | Files | State | Gap to the board |
|---|---|---|---|
| Today (live, upcoming, ended) | `home.jsx` | **built** | Crew row ("3 of your crew at …") not built: no crew-at-stage data on Today. |
| Tab bar | `chrome.jsx` `TabBar` | **built** | none known |
| Festival switcher | `chrome.jsx` `FestivalSwitcher` | **built** | Grid cards keep their 258px floor (empty space under short rows). |
| Lineup list | `lineup.jsx` | **built** | Faces drop under 360pt so a name never wraps. Kept from the readability rulings: name weight 700, rows ≤ 60px, neutral dot in the main list and the stage dot in Saved/Now. |
| Lineup grid | `lineup.jsx` | **built** | Face + status head only on blocks taller than 40px; narrow lanes keep the name alone. The 96px column floor stays. |
| Filters sheet, My night | `lineup.jsx` | **built** | none known |
| Artist page | `artist.jsx` | **built below the hero** | The hero is the compliant version: no name over a Spotify photo (the board puts it there). Stats, similar artists, live set, Mixcloud, shows and setlists take board cards and labels. |
| Map chrome | `map.jsx` | **built (chrome)** | Canvas, pins and stage pills unchanged and night in both modes. Layers popover, amenity key, stage place card, routing bar, meet card and search results are on the board; the stage colour survives only as a dot. |
| Music / Spotify | `spotify.jsx` | **partial** | Eyebrows, hint and panels on the board; actions get the board button shape through a CSS scope, but keep their caps copy. Brand fills (Spotify, Apple Music) stay. |
| Me / Headliner | `spotify.jsx` Me, `supabase.jsx`, `chrome.jsx` | **built, two pieces held** | Identity, stats, tiles, history/records, badges, music, friends, crew, account, appearance, settings (reminders, battery, pack list), safety, headliners (board rows) and footer built. The board's quiet recap card with festival chips and the passport are NOT built: Me holds no per-festival recap data to fill them, and nothing is drawn for show. |
| Memories / recap | `spotify.jsx`, `recap-engine.jsx` | **built (app views)** | Library (filters, import, review, night headers, set cards, peak card, night map, share menu, Wall, Manage), photo viewer and the import review sheet are on the board. Exports (collage, GIF, recap video) stay one look (ruling 2026-09-26). |
| Past library / edition | `historical.jsx` | **built** | none known |
| Landing | `landing.jsx` | **built** | none known |
| Onboarding | `app.jsx` | **built** | none known |
| Sheets | `chrome.jsx` `FieldSheet`, `FieldButton` | **built** | Every FieldSheet (switcher, Filters, Personalize, history info, Today's night sheet) takes the board's sheet and button. |
| Banners, empty/loading/error | `app.jsx`, `chrome.jsx`, `home.jsx`, `lineup.jsx`, `map.jsx`, `historical.jsx`, `index.html` | **built** | Toast, root error screen, install, battery, shared-lineup and you-follow banners, Today's plan sheet, offline / times-pending notices, empty states, past-festival load/error, one skeleton shimmer. |
| Public `/f/` pages | `scripts/gen-festival-pages.mjs` | **audited, built** | Data audit 2026-10-01: all 25 pages match their data sets (names, timed sets, JSON-LD, no orphans). Stylesheet on the board's Dark/Light values with Martian Mono times; markup, copy, JSON-LD and edition disclaimers unchanged. |
| Commerce | `spotify.jsx` paywall | tokens only | Deliberately untouched beyond tokens: paywall copy and prices need founder sign-off. |

## Bugs fixed during the rollout

- My night printed no day name on its tiles (`d.short` on a DAYS row, which has `label`).
- My night cut artist names with an ellipsis; they wrap now.
- Switcher dates were `nowrap`, so Summerfest's "Jun 18–20, Jun 25–27 & Jul 2–4, 2026" ran past the chevron at 320.
- Map's Meet up was a 24pt pill; it is a 44pt chip.
- A two-digit hour overran the list's time column (76px at 14px in a 64px column).
- The photo viewer printed "12:undefined AM" for any takenAt without a wall clock; `test-memories-a11y` now opens the viewer and fails on undefined/NaN/null text.
- The toast ellipsised every long message to one line; it wraps now.
- The root error screen drew shade-coloured copy on `--ink`: dark on dark in Light.
- `.skel-dark` was a hardcoded cream sweep from the paper theme.
- Map artist search printed raw 24h "00:32 · D2" and cut names with an ellipsis.
- The Friends stage picker's border template had a stray `)"`, so the declaration was dropped.
- Locked badges and filtered-out amenity rows were dimmed with opacity (below AA); they read quieter by colour now.
- Memories' Wall/Manage row panned at 280pt with 200% text on CI's wider fonts; it wraps now.
- iOS: with System picked, the app froze on the iPhone's launch-time mode (the plugin pinned the window, and with it the WebView's prefers-color-scheme). On System the plugin now clears the override; `test-appearance` asserts the style sent (6 checks, mutation-caught). On main since #245.
- Independent pixel QA (200% text, wide fonts) found words broken inside themselves: the Memories title ("Memorie / s"), the import card ("Impor / t", "came / ra") and the tab labels ("Toda / y", "Lineu / p"). The fix follows the names ruling: text wraps between words, and a word that cannot fit steps the text down until it does (`fitWords`, one app-wide observer over `.duo-name` and `[data-fit-words]`). It covers screen titles, tab labels (one shared size), the import card, General Home rows and every artist/stage name. The import card's Pick drops under its text at large sizes.
- `test-memories-a11y`'s doubling loop compounded inherited sizes (126 of 163 elements; the title went 28 → 112px), so its "200%" was 2x to 8x. It snapshots sizes before doubling now, runs every pass again in Verdana, and fails on a word broken inside itself, on text cut off in its box, and on a screen that is not the one it names. On `d8b5349` the new checks fail 9 of 116; a planted ellipsis title fails 3; a `tab=recap` route fails all 6 screen checks.
- `test-appearance`'s "recap" and "landing" screens were Today: neither is a deep-link tab, so both fell back silently. Recap is reached through the app's own navigation and General Home through a bare URL now, and every screen asserts its heading or tab. Measured for the first time, General Home's not-yet-open rows were dimmed with opacity below AA (2.49:1 in Light); they read quieter by colour now, and only the picture keeps the dim.

## Findings, not fixed here

- `scripts/test-import.mjs` (v161) is not in verify or CI and no longer runs: its "ARTIST" view button and "TO RETAG" header left the app long before this PR.
- `scripts/e2e-lineup-grid.mjs` needs an output path argument and is not in verify or CI.
