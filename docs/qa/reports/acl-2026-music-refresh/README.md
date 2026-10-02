# ACL September 30 music refresh

All six official September 30 grids inspected, W2 first. 136 music records, 188 expanded weekend performances. Stable IDs preserve Snow Strippers (as09), Palace (as23), Arcy Drive W2 (as22), Britton (au21), and DJ Cassandra (as28, now both weekends). No old artist record was renamed to a replacement artist.

Five removed music identities remain in removedFromLineup with their old name, slot, source and observation date: Fakemink (as25), Nat Myers (as29), Rubio (au13), Sasha Keable (au20), Paloma Morphy (au29). Four new identities are Vinny, Jason Scott & The High Heat, Flight By Nothing and girlsweetvoiced. Existing saved IDs are not reassigned to another artist.

Per-row scheduleSources store the exact dated grid and observation date. Main-stage closers retain the existing 22:00 end policy; those grid blocks print only the start, and endSource explicitly labels that inheritance. Underscores remains 15:30-16:30: direct inspection of an enlarged crop settled a misleading low-resolution read as 16:00.

The shipped-grid-ledger is an export of the applied data for auditing, not an independent proof. base-artist-identities is the original main snapshot used for identity tests. Tests assert printed changed slots, source coverage, removed identities and no stage overlaps. No invented stage coordinates, GPS pins or Bonus artist identities. Bonus/food readiness is separate PR #272 and is not repeated here.

Cache slot v392: main v388, open #262 v389, #266 v390, #271 v391 when checked September 30. Bundle, public festival schedule/page, sitemap fingerprints and status table regenerated. This is source preparation, not a claim of web deployment, native upload or real-iPhone verification.

Sources: https://www.aclfestival.com/schedule . Exact six CDN URLs appear per performance in shipped-grid-ledger.tsv and on the runtime artist records.
