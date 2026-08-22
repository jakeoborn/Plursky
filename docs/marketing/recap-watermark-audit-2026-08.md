# Recap export watermark legibility audit — 2026-08-22

Prereq for ALL Radiate/community posting (Radiate recon Jun 7: communities are image-first; the export itself must carry plursky.com legibly). Audited every export surface in `recap-engine.jsx` at output resolution against phone-screen legibility (rough rule: ≥17px at 1080-wide, opacity ≥0.5, contrast over photo/background).

| Surface | Canvas | Watermark found | Verdict | Fix in this PR |
|---|---|---|---|---|
| Recap stats card (2 variants) | 1080×1920 | `PLURSKY.COM` 26px/α0.55 cream-on-dark | PASS | — |
| Recap video intro frame (story) | 1080×1920 | `MADE WITH PLURSKY` 14px/α0.4 | FAIL (too small+faint on phones) | 18px/α0.6 |
| Recap video photo frames (story) | 1080×1920 | `MADE WITH PLURSKY · PLURSKY.COM` 13px/α0.45 | FAIL | 17px/α0.6 |
| Recap video end card | 1080×1920 | `plursky.com` 48px + `YOUR FESTIVAL. YOUR STORY.` | PASS | — |
| Collage GIF | 540×675 | `MADE WITH PLURSKY` 11px + `plursky.com` 12px serif | PASS (half-res canvas ≈ 22/24px equivalent) | — |
| Weekend poster | 1080×? | `MADE WITH PLURSKY · N MOMENTS` 22px + `plursky.com` 24px on footer band | PASS | — |
| Festival DNA card | 1080×1350 | `MADE WITH PLURSKY+` 12px/α0.3 | FAIL (faint) | 14px/α0.5 + plursky.com α0.65 |
| Festival passport | 1080×1350 | dark-on-cream 12px/α0.25 | FAIL (faint) | 14px/α0.45 + plursky.com α0.6 |

## Remaining gap (brand-voice decision for founder)
No surface carries a CALL-TO-ACTION ("get the app"). The June Radiate recon called for `plursky.com + CTA` baked in. The video end card's `YOUR FESTIVAL. YOUR STORY.` beneath the 48px `plursky.com` is the only CTA-adjacent line. Recommendation (founder picks final words): end card and stats card right-margin tagline become `PLURSKY.COM — MAKE YOURS` or `GET PLURSKY`; one line, same Geist Mono. Not implemented here — copy is founder's to approve.
