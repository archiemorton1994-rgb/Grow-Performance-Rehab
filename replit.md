# Grow Performance & Rehab

## Overview
A React Native mobile fitness app that removes decision fatigue by telling users exactly what to do each workout based on their equipment, pain levels, energy, and available time. Built with Expo, Expo Router, and Zustand.

## Architecture
- **Frontend**: Expo (React Native) with Expo Router file-based routing
- **Backend**: Express.js (minimal, serves landing page and API routes)
- **State**: Zustand with AsyncStorage persistence (no database needed)

## Key Features

### Equipment (5 Tiers — Multi-Select)
- `bodyweight` — no equipment  
- `bands` — resistance bands (maps to bodyweight exercise pool internally)  
- `dumbbells` — dumbbells  
- `kettlebells` — kettlebells (maps to dumbbells exercise pool internally)  
- `fullgym` — full barbell/machine gym  
- Users select **multiple** tiers they have access to; `getEffectiveTier()` derives the best (highest) single tier for session generation
- Full gym checkbox selects all; individual unticks retain others
- Beginners restricted to bodyweight + bands only
- Store field: `equipmentTiers: EquipmentTier[]` (replaces old single `equipmentTier`)
- Internal tier mapping: `getInternalTier()` in `lib/store.ts` collapses 5→3 for exercise lookup

### Session Types (7 options)
- **Lower Body** (`squat`) — Quad/Glute/Hamstring focus, squat pattern KPI
- **Upper Body** (`bench`) — Chest/Shoulder/Tricep focus, push pattern KPI
- **Full Body** (`deadlift`) — Posterior chain focus, hinge pattern KPI
- **Conditioning** (`conditioning`) — HIIT circuits, cardio, fat burn / cardiovascular focus
- **Prehab** (`prehab`) — Standalone joint-health circuit, bypasses readiness screen, 9 exercises (core stability, hip/shoulder health, ankle work)
- **Flexibility** (`flexibility`) — Standalone long-hold stretching session, 10 exercises, bypasses readiness screen
- **Custom** (`custom`) — User picks their own exercises, no auto-generation
- Shared metadata for all session types (label, subtitle, icon, color tokens) lives in `lib/session-meta.ts` — single source of truth used by Home, Train, Stats, and Flex screens.

### 8-Phase Session Structure
1. **Cardio Warm-Up** (prep) — 1-2 min, mandatory on ALL session lengths including 30-min (safety)
2. **Active Stretches** (prep) — 3 stretches for 30-min sessions, 1 for 45/60-min
3. **Mechanical Priming** (mechanical) — band activation, constant tension
4. **Neurological Priming** (neuro) — explosive jumps/swings, 45 and 60-min only
5. **KPI Lift** (main) — main strength exercise with ramped warm-up sets + working sets
6. **Pump Accessories** (accessory) — hypertrophy support
7. **Prehab** (prehab) — joint health, 45 and 60-min only
8. **Conditioning Finisher + Cooldown** (finisher/cooldown) — 60-min only

### Time Scaling
- **30 min** → Cardio warmup + 3 prep stretches + 1 mechanical + KPI + 1 accessory (SAFETY: always warms up)
- **45 min** → All prep + mechanical + neuro + KPI + 2 accessories + prehab + finisher
- **60 min** → Full 8 phases

### Profile Builder Onboarding (9-Screen Swipe Flow)
On first launch, users are routed to `/onboarding` — a horizontal paged ScrollView with one question per screen:
1. **Welcome** — GROW wordmark, "Performance & Rehab" tagline, feature pills
2. **Name** — text input, auto-focuses
3. **Biological Sex** — Male / Female / Prefer not to say (3 option cards)
4. **Experience** — 3 options (beginner/intermediate/advanced) — all three are now selectable
5. **Bodyweight** — numeric kg input
6. **Goals** — multi-select chips (strength / muscle / fat_loss / fitness / rehab)
7. **Equipment** — multi-select tiles with beginner restriction (bodyweight+bands only for beginners); fullgym selects all
8. **Key Lifts** — optional squat/bench/deadlift 1RM inputs with skip link
9. **Profile Built!** — animated checkmark, "Welcome [Name]" with summary pills, "Let's Go" CTA

Data saved: `setUserProfile({ name, sex, experienceLevel, goals, bodyweightKg })`, `setEquipmentTiers()`, `addOneRepMax()` per lift.
Navigation: programmatic via `scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index })`, `scrollEnabled={false}`.

### Session UX
- **Exercise Cards**: name, category pill, "N sets × reps", suggested load
- **Buttons below name**: "Watch form" (YouTube search) + "Swap exercise" (swap modal)
- **Rest Period**: displayed per category (e.g. "Rest 2-3 min between sets — full recovery is key")
- **Per-set weight guides**: shown for KPI lift and accessories (e.g. "Set 1: Easy warm-up (~50% of working weight)")
- **Dumbbell note**: "(each hand)" shown on dumbbell exercises to clarify load is per dumbbell
- **Swap modal**: shows original → alternative exercise, user can confirm or keep original
- **Congratulations modal**: shown on session complete with random motivational message + session stats
- **KeyboardAvoidingView**: properly handles keyboard covering set inputs
- **Progress bar**: tracks completed sets / total sets

### Pain Adaptation (11 Regions)
Front/Rear Shoulder, Elbow/Wrist, Neck, Lower/Upper Back, Core/Ribs, Knee, Hip/Groin, Ankle/Achilles, Calf/Shin
- Exercises with a `comfortVariant` that matches the pain region are swapped automatically
- Swap button allows manual exercise swapping too

### Profile Screen
- **Hero card**: editable name with avatar initial, experience level, goal tags
- **Stats**: total sessions, day streak, this week count
- **Milestone progress**: badge system for 1, 5, 10, 25, 50, 100, 150, 200 sessions
- **Strength KPIs**: best 1RM per lift with improvement trend ("PB" badge)
- **Settings**: equipment (modal with all 5 tiers), experience level, fitness goal, test week frequency
- **Recent sessions**: last 8 sessions with type, date, duration, top weight

### Onboarding Experience Screening
- 2-step onboarding: experience level first, then equipment
- **Beginners**: only Bodyweight and Bands available (Dumbbells/Kettlebells/Full Gym shown locked)
- **Intermediate/Advanced**: all 5 tiers available
- Beginner restriction banner explains users can unlock more equipment via profile later
- Experience level saved to `userProfile.experienceLevel` on step 1

### 1RM Test Weeks
- Triggered every 12 or 18 sessions (configurable)
- Ramping protocol per session type and equipment tier
- Results tracked with history and trend display on profile

## File Structure
```
app/
  _layout.tsx           - Root layout with providers and onboarding redirect
  session.tsx           - Session screen (8-phase workout display, set logging)
  readiness.tsx         - Pre-workout readiness check
  (tabs)/
    _layout.tsx         - 5-tab layout: Home, Profile, Train, Flex, Stats (NativeTabs with liquid glass)
    index.tsx           - Home tab — suggested session card + quick actions
    profile.tsx         - Profile tab — stats, settings, subscription, equipment
    train.tsx           - Train tab — strength session picker (Lower/Upper/Full + Custom) + resume banner
    flex.tsx            - Flex tab — Recovery / Mobility / Targeted Prehab / Conditioning entry sheets
    workouts.tsx        - Stats tab — history, charts, session detail
lib/
  store.ts              - Zustand store (state, all actions)
  exercise-db.ts        - Full exercise database (all 8 phases, 3 session types, 3 internal tiers + conditioning)
  workout-engine.ts     - Session generation logic, helper functions
  session-meta.ts       - Shared session-type metadata (labels, icons, color tokens)
constants/
  colors.ts             - Emerald green (#2f6b46) design system w/ light + dark token sets
```

## Design
- Primary color: Emerald green `#2f6b46`
- Font: Inter (400, 500, 600, 700)
- All loads displayed in kg
- Clean card-based UI, no unnecessary text, icon-first design

## Authentication & Subscriptions

### Email OTP Auth (Passwordless)
- `POST /api/auth/request-code` — generates 6-digit OTP for email (10-min expiry); logs to console in dev; sends via Resend in prod
- `POST /api/auth/verify-code` — validates OTP, upserts user, returns JWT
- `GET /api/auth/me` — validates JWT, returns user
- JWT stored in expo-secure-store (native) / AsyncStorage (web); 30-day expiry
- Requires env secret: `SESSION_SECRET`
- For email sending in production: connect Resend via Replit integration (`RESEND_API_KEY` env var)
- Dev testing: OTP printed to server console `[OTP] email@example.com → 123456`

### RevenueCat Subscription (£4.99/month + 14-day free trial)
- Requires `EXPO_PUBLIC_REVENUECAT_API_KEY` env var (from RC dashboard → API Keys)
- Expected entitlement name: `premium`
- App gate order: onboarding → auth → subscription → tabs
- Development bypass: set `EXPO_PUBLIC_RC_DEV_BYPASS=true` (development env only)
- In-app review prompt triggers after user's 5th session (one-time, via expo-store-review)
- `reviewPromptShown` persisted in Zustand store (v9)

### App Gate Flow (`app/_layout.tsx`)
1. `!onboardingComplete` → `/onboarding`
2. `!isAuthenticated` → `/auth` (single OTP screen for new and returning users)
3. `!hasActiveSubscription` → `/subscription` (paywall)
4. else → `/(tabs)` (main app)

## Code Style

All TypeScript/TSX/JS files are formatted with **Prettier** (config in `.prettierrc`):
- Single quotes, semicolons, 2-space indent, 100-character print width, trailing commas (ES5)

The `check` workflow runs `npm run check` (typecheck + lint + format check) on every push.

To auto-format everything locally:
```
npx prettier --write .
```

Editor integration: install the **Prettier** extension and enable *Format on Save*. The `.editorconfig` in the repo root sets matching indent/newline defaults so even editors without Prettier still stay consistent.

## Workflows
- `Start Backend` — Express on port 8081 (API + landing page)
- `Start Frontend` — Expo Metro on port 8082 (web preview served on port 3000)
