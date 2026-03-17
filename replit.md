# Grow Performance & Rehab

## Overview
A React Native mobile fitness app that removes decision fatigue by telling users exactly what to do each workout based on their equipment, pain levels, energy, and available time. Built with Expo, Expo Router, and Zustand.

## Architecture
- **Frontend**: Expo (React Native) with Expo Router file-based routing
- **Backend**: Express.js (minimal, serves landing page and API routes)
- **State**: Zustand with AsyncStorage persistence (no database needed)

## Key Features

### Equipment (5 Tiers)
- `bodyweight` — no equipment  
- `bands` — resistance bands (maps to bodyweight exercise pool internally)  
- `dumbbells` — dumbbells  
- `kettlebells` — kettlebells (maps to dumbbells exercise pool internally)  
- `fullgym` — full barbell/machine gym  
- Internal tier mapping: `toInternalTier()` in `lib/exercise-db.ts` collapses 5→3 for exercise lookup

### Session Types (4 options)
- **Lower Body** (`squat`) — Quad/Glute/Hamstring focus, squat pattern KPI
- **Upper Body** (`bench`) — Chest/Shoulder/Tricep focus, push pattern KPI
- **Full Body** (`deadlift`) — Posterior chain focus, hinge pattern KPI
- **Conditioning** (`conditioning`) — HIIT circuits, cardio, fat burn / cardiovascular focus

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
    index.tsx           - Home screen (4 session type cards)
    workouts.tsx        - Training plan/schedule view
    profile.tsx         - Profile, stats, settings
lib/
  store.ts              - Zustand store (state, all actions)
  exercise-db.ts        - Full exercise database (all 8 phases, 3 session types, 3 internal tiers + conditioning)
  workout-engine.ts     - Session generation logic, helper functions
constants/
  colors.ts             - Emerald green (#2f6b46) design system
```

## Design
- Primary color: Emerald green `#2f6b46`
- Font: Inter (400, 500, 600, 700)
- All loads displayed in kg
- Clean card-based UI, no unnecessary text, icon-first design

## Workflows
- `Start Backend` — Express on port 5000 (API + landing page)
- `Start Frontend` — Expo on port 8081 (mobile web preview)
