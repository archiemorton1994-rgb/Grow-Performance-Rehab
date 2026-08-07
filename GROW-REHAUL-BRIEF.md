# Grow-Performance-Rehab — Rehaul Brief

Repo: https://github.com/archiemorton1994-rgb/Grow-Performance-Rehab
App: Expo/React Native workout app with automatic progressive-overload logic.

## Goal

This is a premium, paid ($4.99/mo) fitness app. The core mechanics (progression
math, pain-adaptation logic, badge/streak system) are solid — verified in a prior
review. What's missing is visual/structural consistency and a "premium" feel.
This brief covers: confirmed bugs to fix, a design-system pass, and a
screen-by-screen visual rehaul, in that order.

## Hard constraints — do not touch

- **Auth and RevenueCat integration logic** (in `app/_layout.tsx` and wherever
  subscription gating lives) — cosmetic/visual changes only, never touch the
  actual gating logic or API call structure.
- **Environment variables / secrets** — `SESSION_SECRET`, `RESEND_API_KEY`,
  `EXPO_PUBLIC_REVENUECAT_API_KEY` etc. live in Replit's env, not in the repo.
  Never hardcode, print, or ask for their values — just leave every
  `process.env.X` reference exactly as-is.
- Push incrementally to GitHub (small, reviewable commits) rather than one giant
  commit — the user pulls into Replit via its Git panel to sync, so smaller
  commits make that easier to follow and easier to revert if something's wrong.

---

## Phase 1 — Fix confirmed bugs (do this first; low risk, no design decisions needed)

### 1. Theme-broken achievement gold color
`constants/colors.ts` line ~218:
```ts
export const ACHIEVEMENT_GOLD = DarkColors.achievementGold; // BUG: always dark-mode value
```
`LightColors.achievementGold` = `#7a4400` (dark brown, meant for light bg)
`DarkColors.achievementGold` = `#f59e0b` (bright amber, meant for dark bg)

The exported constant always resolves to the dark-mode value, so in light mode
every achievement/milestone badge shows the wrong, low-contrast color. Used in:
`components/AchievementUnlockedSheet.tsx`, `app/achievements.tsx`, `lib/badges.ts`.

**Fix:** remove the static export; have each consumer read the token from
`useColors()` instead (e.g. `C.achievementGold`), so it resolves correctly per
active theme.

### 2. Hardcoded black text/icons on theme-aware button backgrounds
Repeating pattern: button background uses `C.primaryDark` or `C.primary` (which
change value between themes), but the text/icon color is hardcoded to
`'#000000'` instead of the theme-safe `C.textInverse` token that's already used
correctly on a nearly identical neighboring button in the same file.

`C.primaryDark`: light = `#1e4a30` (dark forest green) / dark = `#4ade80` (bright
green). Black text is fine on the dark-mode bright green, but nearly unreadable
on light mode's dark green — this is a real, user-facing contrast bug on some
of the most-tapped buttons in the app.

Confirmed locations:
- `app/(tabs)/index.tsx` — `startBtnText` style (~line 1183) — **Home tab's main
  "Start Session" CTA**
- `app/onboarding.tsx` (~line 906) — explicit inline override on the final
  "Start Training" button (the reusable `continueBtnText` style it's based on
  correctly uses `C.textInverse` — someone overrode it just for this button)
- `app/session.tsx`:
  - `didItBtnText` style + its icon color (~lines 724, 4305) — "Did It" button,
    tapped every set
  - `completeSetBtnText` style (~line 4157)
  - `cardioLogBtnText` style (~line 4434)
  - icon color at ~line 1051 and ~line 958

**Fix:** replace every `color: '#000000'` / `color="#000000"` in these spots
with `C.textInverse`. Also grep the rest of the codebase for the same
`'#000000'` pattern paired with a `C.primary`/`C.primaryDark` background — the
above list is what was confirmed, but do a full sweep since this looks like a
copy-paste-drift pattern that may recur elsewhere.

### 3. Milestone badge list drift
Real badge thresholds (`lib/badges.ts`, milestone category):
```
3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 500, 750
```
But `components/AchievementUnlockedSheet.tsx` and `app/session-summary.tsx` each
hardcode their own separate, stale copy:
```ts
const MILESTONE_SESSIONS = [1, 5, 10, 25, 50, 100, 150, 200];
```
Used to (a) decide if a session summary screen should show "milestone"
celebration, and (b) compute "N sessions to your next badge" countdown. Because
this list is missing most of the real thresholds, the countdown is frequently
wrong (e.g. tells a user "5 sessions to go" when the real next badge is 2
sessions away), and real milestones (session 3, 7, 15, 20, 30...) don't get
flagged as milestones on the summary screen at all.

**Fix:** export the real threshold list from `lib/badges.ts` (or
`lib/badge-engine.ts`) as a single source of truth; have both consumers import
it instead of hardcoding their own copy.

### 4. Beginner/equipment tier desync
`app/(tabs)/profile.tsx` — `saveEdit()` updates `experienceLevel` but never
touches `equipmentTiers`. If a user downgrades from Intermediate/Advanced to
Beginner after previously selecting Dumbbells/Kettlebells/Full Gym, the
disallowed tier stays in their stored `equipmentTiers` indefinitely — and
because the Equipment modal's `toggleEditTier` has `if (isLocked) return;`,
there's no UI path to ever remove it (the tile just shows locked with no
checkbox, can't be tapped).

Note: actual workout generation is *not* unsafe — `app/readiness.tsx` already
re-filters `equipmentTiers` against what's valid for the current experience
level right before a session starts. This is a stuck-stale-data / dead-end-UI
bug, not a workout-safety bug.

**Fix:** in `saveEdit()`, when saving a new `experienceLevel`, also filter
`equipmentTiers` down to whatever's valid for that level — mirror the same
logic `app/onboarding.tsx` already does correctly when experience changes
during onboarding (search onboarding.tsx for where it resets equipment on
experience change, and reuse that logic/pattern here).

### 5. Exercise rotation uses UTC day boundary, not local
`lib/workout-engine.ts` (~lines 615, 631, 665, 868) — all use
`Math.floor(Date.now() / 86400000)` to compute a rotating "day index" for
exercise variety. This flips at UTC midnight, not the user's local midnight —
so for non-UTC users, exercise rotation changes mid-afternoon/evening rather
than overnight, which can look inconsistent if the app is opened twice in one
evening.

**Fix:** compute day index from local date components (e.g.
`new Date().toDateString()` hashed, or year/month/day from local time) instead
of dividing the raw epoch timestamp.

### 6. Duplicate exercise data (drift risk, not currently a bug)
`lib/exercise-db.ts` — the warm-up ("Cardio Warm-Up", id `ph-s-1`) and cooldown
("Supine Hip 90/90 Stretch", id `ph-s-9`) exercises are defined twice: once
inline inside the `STANDALONE_PREHAB` array, and again as separate
`PREHAB_WARMUP` / `PREHAB_COOLDOWN` constants used by
`getRegionPrehabWorkout()`. Currently identical content in both copies, but any
future edit to one won't propagate to the other.

**Fix:** define each exercise once, reference it from both places.

### 7. Dead code
`components/stats/TrainingCalendarGrid.tsx` (a 12-week training-consistency
calendar component, ~396 lines) is fully built but never rendered anywhere in
the app. Either wire it in somewhere sensible (Home tab? a new section in
Stats?) or delete it — as-is it's just unused weight in the codebase.

---

## Phase 2 — Design system foundation (before touching any screen visually)

Currently `constants/colors.ts` has light/dark tokens, but there's no enforced
system beyond that — 89 hardcoded hex colors were found scattered across
`app/` and `components/` bypassing the token system entirely (most were
confirmed intentional — e.g. the achievement category color palette in
`achievements.tsx`, and `WorkoutShareCard.tsx`'s fixed brand-green share-card
styling which is correctly theme-independent — but it's worth a full audit
since this is exactly the kind of drift that caused bugs #1 and #2 above).

Before any screen-level visual work, lock down:
- **Type scale** — one consistent set of font sizes/weights, used everywhere
  (currently ad hoc per-screen).
- **Spacing scale** — a strict 4/8/12/16/24/32(...) scale, no arbitrary padding
  values.
- **Corner radius rule** — one or two values used consistently (cards, buttons,
  chips currently vary).
- **Elevation/shadow system** — one consistent shadow treatment for
  cards/sheets/modals.
- **Icon strategy** — see Phase 4.

This phase should produce updated tokens/constants only — nothing user-visible
changes yet. Get sign-off on this before Phase 3 so the whole visual pass is
consistent instead of ad hoc per screen.

## Phase 3 — Screen-by-screen visual pass

Work in this order (most-seen screens first):
1. **Home** (`app/(tabs)/index.tsx`)
2. **Session** (`app/session.tsx`) — the screen used every single set, every
   session. Also a structural monolith (4,457 lines) — worth splitting into
   sub-components the same way `workouts.tsx` was already split (see "Prior
   work" below) while doing the visual pass, not as a separate task.
3. **Train / Recover** (`app/(tabs)/train.tsx`, `app/(tabs)/recover.tsx`)
4. **Stats** (`app/(tabs)/workouts.tsx` — already refactored, see below)
5. **Profile** (`app/(tabs)/profile.tsx`) — also a monolith (2,344 lines),
   same treatment as session.tsx.
6. **Onboarding** (`app/onboarding.tsx`)

At each screen: check against the Phase 2 tokens, actually run the Expo dev
server and look at both themes before/after, don't move to the next screen
until the current one renders correctly in both light and dark mode.

## Phase 4 — Imagery / icon strategy

The user has been hand-picking individual images from Canva for
equipment/session-type icons, which is the likely source of "no consistent
WOW factor" — each image has its own style, palette, and quality level.

Two viable directions, discuss with user before committing:
- **(a)** Move to a single icon library already in the dependency tree
  (`@expo/vector-icons`) with one consistent custom color/sizing treatment,
  dropping the photo-style images entirely for things like equipment/session
  type indicators.
- **(b)** Keep custom illustrations but regenerate/replace them all against one
  tight style brief (same palette, same line weight, same background/lighting
  treatment) so they read as one cohesive set instead of individually-sourced
  images.

## Phase 5 — Regression pass

- Both themes, every screen touched.
- Confirm the auth/RevenueCat subscription gate still behaves identically
  (visual-only changes should not be able to break this, but verify).
- Test on a real device/Expo Go if possible, not just web preview — RN web
  rendering can diverge from native.

---

## Prior work already done (context, not a task)

`app/(tabs)/workouts.tsx` was already refactored from 5,153 lines down to
1,333, with 13 extracted components now living under `components/stats/`
(one file per chart/panel — `WeeklyBarChart.tsx`, `MonthCalendar.tsx`,
`SessionHistoryList.tsx`, `ExerciseGraph.tsx`, etc.) plus a shared
`components/stats/shared.ts` for common constants/helpers. This was done via
static analysis only (brace-balance checks, cross-reference grepping) without
ever running the app — **please run `npm run check`/typecheck and actually
open the Stats screen first, before building anything else on top of it**, to
confirm nothing was missed in that extraction.

`app/session.tsx` and `app/(tabs)/profile.tsx` are in a similar oversized state
(4,457 and 2,344 lines respectively, each containing many sub-components that
could be split the same way) — worth the same treatment, ideally combined with
the Phase 3 visual pass on those screens rather than as a separate mechanical
step.

There are also 35 ad-hoc `*.check.mjs` scripts under `tests/` instead of a
consolidated test suite — a sign of iterative one-off bug patching rather than
systematic testing. Worth consolidating into proper test files at some point,
though not urgent relative to the phases above.
