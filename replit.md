# Grow Performance & Rehab

## Overview
A React Native mobile fitness app that removes decision fatigue by telling users exactly what to do each workout based on their equipment, pain levels, energy, and available time. Built with Expo, Expo Router, and Zustand. Programming principles inspired by Pain-Free Performance (Rusin), The World's Fittest Book (Edgley), and Rebuilding Milo (Horschig).

## Architecture
- **Frontend**: Expo (React Native) with Expo Router file-based routing
- **Backend**: Express.js (minimal, serves landing page and API routes)
- **State**: Zustand with AsyncStorage persistence (no database needed)

## Key Features
- **Equipment Tiers**: Bodyweight/Bands, Dumbbells/Kettlebells, Full Gym/Barbell (exercises are strictly tier-appropriate)
- **3-Day Rotation**: Squat (Lower/Squat), Bench (Upper/Horizontal Push), Deadlift (Full Body/Hinge)
- **Readiness Check**: Multi-step pre-workout assessment (aches, granular pain region, energy, time available)
- **11 Granular Pain Regions**: Front/Rear Shoulder, Elbow/Wrist, Neck, Lower/Upper Back, Core/Ribs, Knee, Hip/Groin, Ankle/Achilles, Calf/Shin
- **Session Type Selection**: Home screen lets users choose Lower Body / Upper Body / Full Body session (suggested badge highlights the rotation-recommended next session)
- **8-Phase Session Structure** (Rusin / Edgley / Horschig principles):
  1. **Prep** — active movement stretches relevant to session type (no breathing drills); hip flexor/90-90 for Lower, doorway chest/thoracic ext for Upper, cat-cow/adductor rockback for Full
  2. **Mechanical Priming** — band activation, constant tension, 3×15-25 reps
  3. **Neurological Priming** — jumps, explosive push-ups, KB swings, 3×1-5 reps
  4. **KPI Lift** — main strength exercise with ramp-up + working sets
  5. **Pump Accessories** — hypertrophy support, 2×15-25 reps (capped at 2 sets)
  6. **Prehab** — joint health, 1 set
  7. **Conditioning Finisher** — sled/bike/circuits, energy-scaled (2-10 min)
  8. **Cool Down** — diaphragmatic breathing only (Full Body Stretch Sequence removed)
- **Time-Based Session Scaling** (calibrated to actual time budgets):
  - 30 min → 3 exercises: 1 mech + KPI + 1 accessory (~20-25 min of work)
  - 45 min → 8 exercises: 1 prep + 1 mech + neuro + KPI + 2 acc + 1 prehab + finisher (~38-42 min)
  - 60 min → 10 exercises: 1 prep + 2 mech + neuro + KPI + 2 acc + 1 prehab + finisher + cooldown (~52-58 min)
- **Dynamic Workout Engine**: Multi-layer adaptation (equipment, pain region comfort swaps, energy volume, time scaling)
- **Weight/Rep Logging**: Per-set weight (kg) and rep tracking during sessions
- **1RM Test Weeks**: Every 4 or 6 cycles, a test week triggers with ramping protocols; results tracked in profile
- **YouTube Video Links**: Each exercise card has a video button that opens a YouTube search for that exercise's proper form tutorial
- **All loads in kg**
- **App Icon**: Custom Grow Performance & Rehab branded icon (emerald green G-arrow-leaf motif)

## File Structure
```
app/
  _layout.tsx           - Root layout with providers and onboarding redirect
  onboarding.tsx        - Equipment tier selection
  readiness.tsx         - Pre-workout readiness check (aches, pain region, energy, time)
  session.tsx           - Active workout with per-set weight/rep logging, video modal
  (tabs)/
    _layout.tsx         - Tab navigation (NativeTabs + classic fallback)
    index.tsx           - Home screen (stats, test week banner, start session hero)
    workouts.tsx        - Program timeline with rotation + test week markers
    profile.tsx         - Settings, equipment, test freq, strength stats, history

lib/
  store.ts              - Zustand store (PainRegion, TimeAvailable, SetLog, ExerciseLog, OneRepMax types)
  exercise-db.ts        - Complete exercise database per equipment tier (warmups, mains, accessories, finishers, 1RM protocols)
  workout-engine.ts     - Workout generation with multi-layer adaptation
  query-client.ts       - React Query client configuration

constants/
  colors.ts             - Design system colors (emerald green primary)

server/
  index.ts              - Express server
  routes.ts             - API routes
```

## Design System
- Primary: #2f6b46 (emerald green)
- Font: Inter (400, 500, 600, 700 weights)
- Clean, minimalist iOS-inspired design
- Adaptation badges: comfort (purple), volume (blue)
- Test week accent: #e65100 (orange)

## Dependencies
- zustand (state management with persistence)
- @react-native-async-storage/async-storage
- expo-haptics, expo-router, @expo/vector-icons
- react-native-reanimated (animations)
- react-native-keyboard-controller
