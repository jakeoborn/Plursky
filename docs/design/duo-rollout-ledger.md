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
| Today (live, upcoming, ended) | `home.jsx` | **checkpoint built** | Crew row ("3 of your crew at …") not built: no crew-at-stage data on Today. |
| Tab bar | `chrome.jsx` `TabBar` | **built** | none known |
| Festival switcher | `chrome.jsx` `FestivalSwitcher` | pending | legacy grid cards and film gradient fallback |
| Lineup list | `lineup.jsx` | pending | 21 hex + 15 rgb literals, 43 mono labels; rows need faces, circled add, Now row lift |
| Lineup grid | `lineup.jsx` | pending | blocks need faces and the plan tint; measured 96px column floor stays |
| Artist page | `artist.jsx` | pending | the board puts the name over the Spotify photo; the Spotify compliance rule (no overlay) wins, so the hero stays attributed and un-overlaid |
| Map chrome | `map.jsx` | pending | 66 hex + 60 rgb literals (most are map art, documented exceptions); canvas stays night in both modes |
| Music / Spotify | `spotify.jsx` | pending | 64 hex, 85 serif, 239 mono uses |
| Me / Headliner | `spotify.jsx` Me, `recap-engine.jsx` | pending | quiet recap card + festival chips + passport per board `me()` |
| Memories / recap | `recap-engine.jsx`, `photo-tag.jsx` | pending | exports stay one look (ruling 2026-09-26) |
| Past library / edition | `historical.jsx` | pending | no literals; needs duo type roles |
| Onboarding, search, sheets, dialogs, banners, empty/loading/error | `app.jsx`, `chrome.jsx`, `supabase.jsx` | pending | `FieldSheet`, `FieldButton` still the Field primitives |
| Public `/f/` pages | `scripts/gen-festival-pages.mjs` | audit pending | independent web layout, keeps edition disclaimers |
| Commerce | `spotify.jsx` paywall | tokens only | no behaviour, price or offer change |
