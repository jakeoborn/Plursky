# DH-JOB-B — Demand Backlog Maroma Check (2026-06-14)

Agent: HeyClicky Codex agent mode  
Related issue: #26

## Coverage

Checked:
- Looked for `scripts/data/demand-backlog.json` in the current repo checkout.
- Searched the repo for demand/backlog/search files.
- Searched Google Maps for exact-name and restaurant/place matches for `Maroma` in New York City, Miami, Los Angeles, and Mexico City.
- Filtered out near-matches and non-venue results where the name or category did not match the requested add-venue intent.

Not checked:
- Could not inspect `scripts/data/demand-backlog.json` contents because that file is absent in this checkout.
- Did not check pure cuisine words such as `gyoza` or `ramen`, per instruction.
- Did not add venue data to the app.

## Evidence

Timestamp: 2026-06-14 08:32–08:36 America/Chicago.

Repo observations:
- `scripts/data/demand-backlog.json` was not present.
- `rg --files | rg 'demand|backlog|venue|search'` did not find a demand backlog file.

Google Maps observations:
- New York City exact-name search returned no operational restaurant/venue named exactly `Maroma` in NYC.
  - Returned near/out-of-area examples included `Maroma, A Belmond Hotel, Riviera Maya`, `Marea`, `Maraca NYC`, `Mamo`, and `Secrets Maroma Beach Riviera Cancun`.
- Miami exact-name search returned `Maroma USA LLC`, `360 NE 80th St, Miami, FL 33138`, website `https://maromausa.com/`, category `wholesaler` / `supplier`, not a restaurant/venue for Plursky.
- Los Angeles exact-name search returned no operational restaurant/venue named exactly `Maroma` in LA.
  - Returned out-of-area `Maroma, A Belmond Hotel, Riviera Maya`.
- Mexico City exact-name search returned no exact operational restaurant/venue named exactly `Maroma` matching the requested add-venue intent.
  - Returned `Meroma`, `C.Colima 150, Roma Nte., Cuauhtémoc, 06700 Ciudad de México, CDMX`, website `http://meroma.mx/`, but this is a different name.
  - Returned `Gastronómica maroma`, `C. de Monte de Piedad 13, Centro Histórico de la Cdad. de México, Centro, Cuauhtémoc, 06000 Ciudad de México, CDMX`, category `restaurant`, but no official site was returned by Maps and the display name is not exactly `Maroma`.
- Additional exact-name search found an operational Dallas restaurant named `Maroma`, `1333 Oak Lawn Ave Ste 100, Dallas, TX 75207`, official site `http://maroma-restaurant.com/`. Dallas was not one of the requested demand cities for this job.

## Findings

### New York City

Expected:
- Determine whether there is a real, open venue called `Maroma` in NYC.

Observed:
- No exact operational NYC venue called `Maroma` was found.
- Results were near matches or out-of-area matches, not an addable NYC `Maroma` venue.

Observed vs expected:
- PASS for verification; no NYC add candidate found.

### Miami

Expected:
- Determine whether there is a real, open venue called `Maroma` in Miami.

Observed:
- `Maroma USA LLC` exists at `360 NE 80th St, Miami, FL 33138` with website `https://maromausa.com/`, but Maps categorizes it as `wholesaler` / `supplier`, not a restaurant or venue.

Observed vs expected:
- PASS for verification; no Miami add candidate found.

### Los Angeles

Expected:
- Determine whether there is a real, open venue called `Maroma` in Los Angeles.

Observed:
- No exact operational Los Angeles restaurant/venue called `Maroma` was found.

Observed vs expected:
- PASS for verification; no LA add candidate found.

### Mexico City

Expected:
- Determine whether there is a real, open venue called `Maroma` in Mexico City.

Observed:
- No exact operational Mexico City venue called `Maroma` with an official site was found.
- `Meroma` is a real operational restaurant in CDMX, but the name differs from the searched backlog term.
- `Gastronómica maroma` appears as an operational restaurant in CDMX, but no official site was returned and it is not an exact `Maroma` venue listing.

Observed vs expected:
- PARTIAL / NEEDS CLAUDE DECISION. Do not auto-add `Meroma` as `Maroma`; consider whether `Gastronómica maroma` deserves manual follow-up despite missing official site.

## Add-Venue Recommendation

Do not run add-venues for NYC, Miami, LA, or Mexico City based on this pass.

Potential out-of-scope note:
- Dallas has a real, operational restaurant named `Maroma` at `1333 Oak Lawn Ave Ste 100, Dallas, TX 75207`, official site `http://maroma-restaurant.com/`. This may be relevant only if Dallas demand is added to the backlog scope.
