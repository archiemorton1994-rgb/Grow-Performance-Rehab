# Dark-Mode Badge QA — Visual Verification

## Context

Task #601 changed `DarkColors.pbFlashText` from `#ffffff` (white) to `#5c2d00` (dark brown) to fix a 1.67:1 contrast failure on the amber PB-flash pill. This document records the visual-pass verification performed after that change.

## Colour tokens under review

| Token | Value | Role |
|---|---|---|
| `DarkColors.pbFlash` | `#fbbf24` | "New PB 🏆" badge fill |
| `DarkColors.pbFlashText` | `#5c2d00` | "New PB 🏆" badge text |
| `DarkColors.trophyBg` | `#4a3600` | Milestone / congrats icon background |
| `DarkColors.trophy` | `#fbbf24` | Trophy icon tint |
| `DarkColors.trophyBorder` | `#5c4500` | Milestone card outline |
| `DarkColors.streakBg` | `#5a3500` | Streak pill background |
| `DarkColors.streakText` | `#fb923c` | Streak pill text |
| `DarkColors.achievementGoldBg` | `#4d3800` | Achievement badge fill |
| `DarkColors.achievementGold` | `#f59e0b` | Achievement badge text/icon |

## Automated contrast-check output

Run: `node tests/dark-badge-contrast.check.mjs`

```
[dark-badge-contrast] checking status-badge, category-pill, achievement-badge, and PB-flash readability

  Background (DarkColors.surface): #111111
  Fill-vs-surface minimum : 1.5 : 1
  Text-vs-fill minimum    : 3.0 : 1

── Achievement / streak / trophy badges (fill vs surface, then text vs fill) ──
  ✓ DarkColors.achievementGoldBg (#4d3800) — contrast 1.69 : 1
  ✓ DarkColors.achievementGold (#f59e0b)   — contrast 5.20 : 1
  ✓ DarkColors.streakBg (#5a3500)          — contrast 1.75 : 1
  ✓ DarkColors.streakText (#fb923c)        — contrast 4.77 : 1
  ✓ DarkColors.trophyBg (#4a3600)          — contrast 1.64 : 1
  ✓ DarkColors.trophy (#fbbf24)            — contrast 6.92 : 1

── Achievement / streak / trophy borders (fill vs surface) ──
  ✓ DarkColors.achievementGoldBorder (#f59e0b33) — contrast 8.79 : 1
  ✓ DarkColors.streakBorder (#5c3000)            — contrast 1.69 : 1
  ✓ DarkColors.trophyBorder (#5c4500)            — contrast 2.07 : 1

── PB-flash badge (fill vs surface, then text vs fill) ──
  ✓ DarkColors.pbFlash (#fbbf24)    — contrast 11.31 : 1
  ✓ DarkColors.pbFlashText (#5c2d00) — contrast  6.87 : 1

dark-badge-contrast: all checks passed (32 / 32)
```

All 32 checks pass. Full output (including category pills, difficulty badges, and trend indicators) is reproduced by running the script directly.

## Visual assessment

### "New PB 🏆" badge (`app/session.tsx` — `pbFlashBadge` / `pbFlashBadgeText`)

- **Fill**: bright amber `#fbbf24` — visually pops against the dark card surface (`#111111`), contrast 11.31:1
- **Text**: dark brown `#5c2d00` — 6.87:1 on the amber fill, exceeds WCAG AA for normal text (4.5:1)
- **Aesthetic**: the amber-fill / dark-brown-text pairing reads as a deliberate "highlight / caution" callout, consistent with the light-mode PB pill. It does not look like an accident; the brown reads as a warm, on-brand accent against the gold.

### Milestone icon wrap (`app/session.tsx` — `milestoneIconWrap`)

- Fill `trophyBg` (`#4a3600`) is a deep amber-brown, distinct from the black card surface.
- Trophy icon rendered in `trophyBg` context uses the amber `trophy` token (`#fbbf24`, 6.92:1 vs fill) — very legible.
- Border `trophyBorder` (`#5c4500`) adds a warm outline that separates the icon card from the background (2.07:1 vs surface — above the 1.5:1 perceptibility floor).

### Streak badge (`app/session.tsx` — `streakBadge`)

- Fill `streakBg` (`#5a3500`) — warm dark-orange-brown, clearly distinct from the black surface (1.75:1).
- Text `streakText` (`#fb923c`) — bright orange, 4.77:1 on the dark fill. Legible and energetic, consistent with the streaks palette on the profile screen.

### Achievement gold badge (`app/(tabs)/profile.tsx` context)

- Fill `achievementGoldBg` (`#4d3800`) distinguishes the badge card from the dark background (1.69:1).
- Text/icon `achievementGold` (`#f59e0b`) at 5.20:1 on the fill — clear gold-on-brown, on-brand.

## Conclusion

The `pbFlashText` colour fix (#5c2d00) produces a correct, on-brand result in dark mode. The dark-brown text on the amber pill reads as a deliberate design choice, not an inversion artefact. All achievement, trophy, and streak badge token pairs also remain within contrast thresholds and look visually consistent with the app's amber/gold dark-mode palette.

No token changes required.
