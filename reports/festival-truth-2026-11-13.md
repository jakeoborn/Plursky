# Festival truth audit — 2026-11-13

SPEC-193 Phase 2. Read-only. Data read from the running app (`_DATA_SETS`) at `4439cf28`. 27 festivals, 1194 artist-photo ledger rows. Command: `node scripts/audit-festival-truth.mjs`.

**Findings: 0 S1 · 7 S2 · 10 S3.**

Severity: **S1** = the app shows a fan something false or broken (wrong date, a set on a stage that doesn't exist, two sets at once on one stage, a deleted photo). **S2** = likely wrong or unproven and needs a look (possible date mismatch, duplicate act, missing provenance, waiver expiring). **S3** = cosmetic or informational.

Official checks read only server-rendered text from the official site recorded in the festival's own `officialEvent`. A site that renders in the browser shows up as UNVERIFIED, not MATCH. `MISMATCH?` means the page names other dates in the same month; it is a lead for a human, never proof.

Artist photos: 1194 ledger rows, 1194 files hash-checked, 1194 of 1194 Commons pages re-read (licence, plus deletion, permission, dispute and no-source templates or categories), 0 finding(s).

## Summary

| Festival | State | Stages | Sets (timed) | Official dates | Official venue | /f/ page | Map basis | Waiver | S1 | S2 | S3 |
|---|---|--:|--:|---|---|---|---|---|--:|--:|--:|
| edc-lv-2026 | ended | 9 | 241 (241) | PARTIAL ([fetched 2026-11-13T06:06](https://lasvegas.edc.com/)) | MATCH | yes | 9 GPS anchor(s) | — | 0 | 0 | 1 |
| acl-2026 | ended | 7 | 136 (136) | PARTIAL ([fetched 2026-11-13T06:06](https://www.aclfestival.com/)) | MATCH | yes | 4 GPS anchor(s) | — | 0 | 0 | 0 |
| lost-lands-2026 | ended | 7 | 206 (206) | MATCH ([fetched 2026-11-13T06:06](https://www.lostlandsfestival.com/)) | UNVERIFIED | yes | none (real map only) | — | 0 | 0 | 1 |
| edc-orlando-2026 | ended | 5 | 133 (133) | MISMATCH? ([fetched 2026-11-13T06:06](https://orlando.edc.com/)) | MATCH | yes | 5 GPS anchor(s) | 2026-12-01 | 0 | 2 | 2 |
| ultra-miami-2026 | ended | 7 | 166 (166) | PARTIAL ([fetched 2026-11-13T06:06](https://ultramusicfestival.com/)) | MATCH | yes | 7 GPS anchor(s) | — | 0 | 0 | 0 |
| governors-ball-2026 | ended | 3 | 58 (58) | MATCH ([fetched 2026-11-13T06:06](https://www.governorsballmusicfestival.com/)) | MATCH | yes | 3 GPS anchor(s) | 2026-12-01 | 0 | 1 | 0 |
| summerfest-2026 | ended | 10 | 446 (436) | UNVERIFIED ([fetched 2026-11-13T06:06](https://www.summerfest.com/)) | UNVERIFIED | yes | 10 GPS anchor(s) | — | 0 | 1 | 1 |
| lollapalooza-2026 | ended | 9 | 195 (195) | MATCH ([fetched 2026-11-13T06:06](https://www.lollapalooza.com/)) | MATCH | yes | 9 GPS anchor(s) | — | 0 | 0 | 1 |
| outside-lands-2026 | ended | 7 | 139 (139) | MISMATCH? ([fetched 2026-11-13T06:06](https://www.sfoutsidelands.com/)) | UNVERIFIED | yes | 7 GPS anchor(s) | — | 0 | 2 | 1 |
| iii-points-2026 | ended | 13 | 231 (231) | UNVERIFIED ([fetched 2026-11-13T06:06](https://www.iiipoints.com/)) | MATCH | yes | 13 GPS anchor(s) | — | 0 | 0 | 0 |
| nocturnal-wonderland-2026 | ended | 5 | 86 (86) | MATCH ([fetched 2026-11-13T06:06](https://www.nocturnalwonderland.com/)) | UNVERIFIED | yes | none (real map only) | — | 0 | 0 | 0 |
| crssd-fall-2026 | ended | 3 | 53 (53) | UNVERIFIED ([fetched 2026-11-13T06:06](https://www.crssdfest.com/)) | UNVERIFIED | yes | georeferenced plate | — | 0 | 0 | 0 |
| portola-2026 | ended | 5 | 64 (64) | UNVERIFIED ([fetched 2026-11-13T06:06](https://portolamusicfestival.com/)) | UNVERIFIED | yes | none (real map only) | — | 0 | 0 | 0 |
| hard-summer-2026 | ended | 7 | 91 (91) | MATCH ([fetched 2026-11-13T06:06](https://www.hardsummer.com/)) | UNVERIFIED | yes | georeferenced plate | — | 0 | 0 | 1 |
| arc-2026 | ended | 4 | 96 (96) | MATCH ([fetched 2026-11-13T06:06](https://arcmusicfestival.com/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| escape-halloween-2026 | ended | 7 | 118 (118) | MISMATCH? ([fetched 2026-11-13T06:06](https://escapehalloween.com/)) | MATCH | yes | none (real map only) | — | 0 | 1 | 1 |
| dreamstate-socal-2026 | TBA | 5 | 70 (0) | MATCH ([fetched 2026-11-13T06:06](https://socal.dreamstateusa.com/)) | UNVERIFIED | yes | georeferenced plate | — | 0 | 0 | 1 |
| decadence-colorado-2026 | TBA | 0 | 23 (0) | MATCH ([fetched 2026-11-13T06:06](https://decadencenye.com/)) | UNVERIFIED | yes | none (real map only) | — | 0 | 0 | 0 |
| countdown-nye-2026 | TBA | 0 | 71 (0) | PARTIAL ([fetched 2026-11-13T06:06](https://countdownnye.com/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| lights-all-night-2026 | TBA | 0 | 39 (0) | MATCH ([fetched 2026-11-13T06:06](https://lightsallnight.com/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| decadence-arizona-2026 | TBA | 0 | 39 (0) | MATCH ([fetched 2026-11-13T06:06](https://decadencearizona.com/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| sunset-on-the-river-2027 | TBA | 0 | 16 (0) | MATCH ([fetched 2026-11-13T06:06](https://sunsetotr.com/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| dwp-2026 | TBA | 0 | 25 (0) | MATCH ([fetched 2026-11-13T06:06](https://dwpfest.com/)) | UNVERIFIED | yes | none (real map only) | — | 0 | 0 | 0 |
| edc-thailand-2026 | TBA | 0 | 100 (0) | PARTIAL ([fetched 2026-11-13T06:06](https://thailand.edc.com/en/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| tomorrowland-thailand-2026 | TBA | 7 | 158 (0) | MATCH ([fetched 2026-11-13T06:06](https://thailand.tomorrowland.com/en/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| groove-cruise-2027 | TBA | 0 | 106 (0) | MATCH ([fetched 2026-11-13T06:06](https://www.groovecruise.com/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |
| day-zero-tulum-2027 | TBA | 0 | 30 (0) | MATCH ([fetched 2026-11-13T06:06](https://dayzerofestival.com/tulum/)) | MATCH | yes | none (real map only) | — | 0 | 0 | 0 |

## S1 findings

None.

## S2 findings

| Festival | Finding | Detail | Evidence |
|---|---|---|---|
| edc-orlando-2026 | official page may show different dates (needs a human look) | page names our days in another year: nov 6, 2027, nov 7, 2027; ours nov 6, 2026, nov 7, 2026, nov 8, 2026 | [source](https://orlando.edc.com/) |
| edc-orlando-2026 | map registration waiver expires within 45 days | 2026-12-01 (18 d) | [source](https://github.com/jakeoborn/Plursky/blob/main/scripts/verify.mjs) |
| governors-ball-2026 | map registration waiver expires within 45 days | 2026-12-01 (18 d) | [source](https://github.com/jakeoborn/Plursky/blob/main/scripts/verify.mjs) |
| summerfest-2026 | two sets overlap on the same stage (festival ended) | 1: day 6 aurora: DJ Andres 14:45-15:20 × Jazzteca 15:15-16:10 | [source](https://summerfest.com/lineup) |
| outside-lands-2026 | two sets overlap on the same stage (festival ended) | 2: day 2 dolores: OASIS DJ Set: Beverly Chills 13:30-14:15 × Pink Stiletto 14:00-14:30; day 2 dolores: Pink Stiletto 14:00-14:30 × REPARATIONS w/ DJ Newoncé 14:15-15:15 | [source](https://inmusicblog.com/) |
| outside-lands-2026 | official page may show different dates (needs a human look) | page names our days in another year: aug 7, 2027, aug 8, 2027; ours aug 7, 2026, aug 8, 2026, aug 9, 2026 | [source](https://www.sfoutsidelands.com/) |
| escape-halloween-2026 | official page may show different dates (needs a human look) | page names our days in another year: oct 30, 2027; ours oct 30, 2026, oct 31, 2026 | [source](https://escapehalloween.com/) |

## S3 findings

| Festival | Finding | Detail | Evidence |
|---|---|---|---|
| edc-lv-2026 | set time not on a 5-minute mark | 21: Chris Lorenzo 22:07-23:15, Sofi Tukker 23:19-00:30, The Chainsmokers 00:32-01:42, FISHER 01:47-02:57, Porter Robinson (DJ Set) 03:01-04:11 | [source](https://festivaldust.com/) |
| lost-lands-2026 | set time not on a 5-minute mark | 1: Excision B2B Space Laces 21:40-22:47 | [source](https://github.com/johnta2000/johnta2000.github.io/blob/01315c1f03c0a01c9a8294132ac8cb6480a49ac3/convex/lostLandsSetTimes.ts) |
| edc-orlando-2026 | set time not on a 5-minute mark | 17: Alesso (Sunset Set) 17:28-18:43, David Guetta 22:31-23:56, KREAM 18:47-19:57, Mau P 21:13-22:28, Pegassi 16:25-17:28 | [source](https://orlando.edc.com/lineup/set-times/day-1/) |
| edc-orlando-2026 | act plays two sets on one day (spot-check against the official times) | 2: AAT (ecf1 stereo 14:15) ≈ AAT (ecf46 bacardi 17:45) day 1; Gabss (ecs17 stereo 14:30) ≈ Gabss (ecs45 bacardi 18:00) day 2 | [source](https://orlando.edc.com/lineup/set-times/day-1/) |
| summerfest-2026 | act plays two sets on one day (spot-check against the official times) | 65: The Mighty Ms. Erica And the Sound Production (su40 johnsonville 13:45) ≈ The Mighty Ms. Erica And the Sound Production (su41 johnsonville 15:30) day 1; 5 Card Studs (su42 johnsonville 17:30) ≈ 5 Card Studs (su43 johnsonville 19:30) day 1; Passion Pit (su32 tmobile 22:15) ≈ Passion Pit (su46 amf | [source](https://summerfest.com/lineup) |
| lollapalooza-2026 | act plays two sets on one day (spot-check against the official times) | 4: Devault (lo13 perrys 13:45) ≈ Devault (lo23 titos 19:30) day 1; DJ Prince Lex (lo44 bonus 13:30) ≈ DJ Prince Lex (lo46 bonus 16:30) day 1; DJ Prince Lex (lo96 bonus 14:00) ≈ DJ Prince Lex (lo100 bonus 17:45) day 2 | [source](https://lollapalooza.com/schedule) |
| outside-lands-2026 | act plays two sets on one day (spot-check against the official times) | 14: Hot Goth Freak Show (os38 dolores 15:20) ≈ Hot Goth Freak Show (os42 dolores 18:05) day 1; Nezza (os8 twinpeaks 12:30) ≈ Nezza (os45 duboce 14:05) day 1; Chezile (os22 panhandle 13:20) ≈ Chezile (os46 duboce 15:25) day 1 | [source](https://inmusicblog.com/) |
| hard-summer-2026 | set time not on a 5-minute mark | 1: Kali Uchis 20:56-22:00 | [source](https://hardsummer.com/lineup/set-times/day-1/) |
| escape-halloween-2026 | act plays two sets on one day (spot-check against the official times) | 2: Acyan (esc-acyan-d2 sewer-district 16:00) ≈ Acyan (esc-acyan-d2-s2 beatbox-art-car 18:30) day 2; Cat & Maomi (esc-cat-and-maomi-d2 feeding-grounds 16:00) ≈ Cat & Maomi (esc-cat-and-maomi-d2-s2 beatbox-art-car 21:30) day 2 | [source](https://escapehalloween.com/lineup/set-times/day-1/) |
| dreamstate-socal-2026 | stage with zero sets | Sequence, Void, Vision, Dream, Beatbox Art Car | [source](https://socal.dreamstateusa.com/lineup/) |

## Official-page reads

| Festival | URL | Fetched | Dates | Venue | Why not MATCH |
|---|---|---|---|---|---|
| edc-lv-2026 | https://lasvegas.edc.com/ | 2026-11-13T06:06:09.928Z | PARTIAL | MATCH | page names 2/3 of our dates |
| acl-2026 | https://www.aclfestival.com/ | 2026-11-13T06:06:10.557Z | PARTIAL | MATCH | page names 3/6 of our dates |
| lost-lands-2026 | https://www.lostlandsfestival.com/ | 2026-11-13T06:06:10.829Z | MATCH | UNVERIFIED |  |
| edc-orlando-2026 | https://orlando.edc.com/ | 2026-11-13T06:06:11.207Z | MISMATCH? | MATCH | page names our days in another year: nov 6, 2027, nov 7, 2027; ours nov 6, 2026, nov 7, 2026, nov 8, 2026 |
| ultra-miami-2026 | https://ultramusicfestival.com/ | 2026-11-13T06:06:11.603Z | PARTIAL | MATCH | page names 2/3 of our dates |
| governors-ball-2026 | https://www.governorsballmusicfestival.com/ | 2026-11-13T06:06:12.261Z | MATCH | MATCH |  |
| summerfest-2026 | https://www.summerfest.com/ | 2026-11-13T06:06:12.769Z | UNVERIFIED | UNVERIFIED | fetch failed (403) |
| lollapalooza-2026 | https://www.lollapalooza.com/ | 2026-11-13T06:06:13.081Z | MATCH | MATCH |  |
| outside-lands-2026 | https://www.sfoutsidelands.com/ | 2026-11-13T06:06:13.375Z | MISMATCH? | UNVERIFIED | page names our days in another year: aug 7, 2027, aug 8, 2027; ours aug 7, 2026, aug 8, 2026, aug 9, 2026 |
| iii-points-2026 | https://www.iiipoints.com/ | 2026-11-13T06:06:13.988Z | UNVERIFIED | MATCH | page text names none of our dates |
| nocturnal-wonderland-2026 | https://www.nocturnalwonderland.com/ | 2026-11-13T06:06:14.484Z | MATCH | UNVERIFIED |  |
| crssd-fall-2026 | https://www.crssdfest.com/ | 2026-11-13T06:06:15.696Z | UNVERIFIED | UNVERIFIED | page has almost no server-rendered text (client-rendered) |
| portola-2026 | https://portolamusicfestival.com/ | 2026-11-13T06:06:17.598Z | UNVERIFIED | UNVERIFIED | page text names none of our dates |
| hard-summer-2026 | https://www.hardsummer.com/ | 2026-11-13T06:06:17.991Z | MATCH | UNVERIFIED |  |
| arc-2026 | https://arcmusicfestival.com/ | 2026-11-13T06:06:19.147Z | MATCH | MATCH |  |
| escape-halloween-2026 | https://escapehalloween.com/ | 2026-11-13T06:06:19.676Z | MISMATCH? | MATCH | page names our days in another year: oct 30, 2027; ours oct 30, 2026, oct 31, 2026 |
| dreamstate-socal-2026 | https://socal.dreamstateusa.com/ | 2026-11-13T06:06:20.645Z | MATCH | UNVERIFIED |  |
| decadence-colorado-2026 | https://decadencenye.com/ | 2026-11-13T06:06:21.819Z | MATCH | UNVERIFIED |  |
| countdown-nye-2026 | https://countdownnye.com/ | 2026-11-13T06:06:22.273Z | PARTIAL | MATCH | page names 1/2 of our dates |
| lights-all-night-2026 | https://lightsallnight.com/ | 2026-11-13T06:06:22.928Z | MATCH | MATCH |  |
| decadence-arizona-2026 | https://decadencearizona.com/ | 2026-11-13T06:06:24.004Z | MATCH | MATCH |  |
| sunset-on-the-river-2027 | https://sunsetotr.com/ | 2026-11-13T06:06:24.557Z | MATCH | MATCH |  |
| dwp-2026 | https://dwpfest.com/ | 2026-11-13T06:06:25.574Z | MATCH | UNVERIFIED |  |
| edc-thailand-2026 | https://thailand.edc.com/en/ | 2026-11-13T06:06:26.868Z | PARTIAL | MATCH | page names 2/3 of our dates |
| tomorrowland-thailand-2026 | https://thailand.tomorrowland.com/en/ | 2026-11-13T06:06:28.073Z | MATCH | MATCH |  |
| groove-cruise-2027 | https://www.groovecruise.com/ | 2026-11-13T06:06:28.879Z | MATCH | MATCH |  |
| day-zero-tulum-2027 | https://dayzerofestival.com/tulum/ | 2026-11-13T06:06:29.182Z | MATCH | MATCH |  |

## Public /f/ pages with no data set in the app

28 pages (coming-soon or archive pages, not audited here): awakenings-2027, bass-coast-2027, beyond-wonderland-gorge-2027, beyond-wonderland-socal-2027, boom-festival-2027, coachella-2027, creamfields-2027, das-energi-2027, defqon1-2027, edc-mexico-2027, electric-forest-2027, electric-love-2027, forbidden-kingdom-2027, kappa-futurfestival-2027, movement-2027, ozora-2027, parookaville-2027, primavera-sound-2027, shambhala-2027, sonar-2027, sziget-2027, time-warp-2027, tomorrowland-2027, tomorrowland-brasil-2027, tomorrowland-winter-2027, ubbi-dubbi-2027, ultra-europe-2027, untold-2027.

## Not covered

- Set-by-set comparison against the official set-time pages: most official schedules are client-rendered or images. The schedule source URL is the evidence link on each row; a human check is still needed before any time is changed.
- Stage names against the official site: names are compared only inside the app's own data (unknown or empty stages).
