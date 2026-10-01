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
| Artist page | `artist.jsx` | **built below the hero** | The hero is the compliant version: no name over a Spotify photo (the board puts it there). Stats row and lower sections are legacy on tokens. |
| Map chrome | `map.jsx` | **built (chrome)** | Canvas, pins and stage pills unchanged and night in both modes. Layers popover, amenity key and the place card are legacy on tokens. |
| Music / Spotify | `spotify.jsx` | **partial** | Eyebrows, hint and panels on the board; actions get the board button shape through a CSS scope, but keep their caps copy. Brand fills (Spotify, Apple Music) stay. |
| Me / Headliner | `spotify.jsx` Me | **partial** | Identity, stats, tiles and entries built. The board's quiet recap card with festival chips and the passport are NOT built: Me holds no per-festival recap data to fill them. Lower sections (history, crew, safety, headliners) are legacy on tokens. |
| Memories / recap | `spotify.jsx`, `recap-engine.jsx` | **header only** | TopBar is on the board. Library and recap views are legacy on tokens; exports stay one look (ruling 2026-09-26). |
| Past library / edition | `historical.jsx` | **built** | none known |
| Landing | `landing.jsx` | **built** | none known |
| Onboarding | `app.jsx` | **built** | none known |
| Sheets | `chrome.jsx` `FieldSheet`, `FieldButton` | **built** | Every FieldSheet (switcher, Filters, Personalize, history info, Today's night sheet) takes the board's sheet and button. |
| Banners, empty/loading/error | `app.jsx`, `chrome.jsx`, `supabase.jsx` | pending | |
| Public `/f/` pages | `scripts/gen-festival-pages.mjs` | audit pending | independent web layout, keeps edition disclaimers |
| Commerce | `spotify.jsx` paywall | tokens only | no behaviour, price or offer change |

## Bugs fixed during the rollout

- My night printed no day name on its tiles (`d.short` on a DAYS row, which has `label`).
- My night cut artist names with an ellipsis; they wrap now.
- Switcher dates were `nowrap`, so Summerfest's "Jun 18–20, Jun 25–27 & Jul 2–4, 2026" ran past the chevron at 320.
- Map's Meet up was a 24pt pill; it is a 44pt chip.
- A two-digit hour overran the list's time column (76px at 14px in a 64px column).
