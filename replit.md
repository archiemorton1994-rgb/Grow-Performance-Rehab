# Grow Performance & Rehab

## Overview
A React Native mobile fitness app that removes decision fatigue by telling users exactly what to do each workout based on their equipment, pain levels, energy, and available time. Built with Expo, Expo Router, and Zustand. Programming principles inspired by Pain-Free Performance (Rusin), The World's Fittest Book (Edgley), and Rebuilding Milo (Horschig).

## Architecture
- **Frontend**: Expo (React Native) with Expo Router file-based routing
- **Backend**: Express.js (minimal, serves landing page and API routes)
- **State**: Zustand with AsyncStorage persistence (no database needed)

## Key Features
- **Equipment Tiers**: Bodyweight/Bands, Dumbbells/Kettlebells, Full Gym/Barbell (exercises are strictly tier-appropriate)
- **3-Day Rotation**: Squat (Lower), Bench (Upper), Deadlift (Full Body)
- **Readiness Check**: Multi-step pre-workout assessment (aches, granular pain region, energy, time available)
- **11 Granular Pain Regions**: Front/Rear Shoulder, Elbow/Wrist, Neck, Lower/Upper Back, Core/Ribs, Knee, Hip/Groin, Ankle/Achilles, Calf/Shin
- **Time-Based Session Scaling**: 30/45/60 min options control workout depth (main only → full session)
- **Dynamic Workout Engine**: Multi-layer adaptation (equipment, pain region comfort swaps, energy volume, time scaling)
- **Weight/Rep Logging**: Per-set weight (kg) and rep tracking during sessions
- **1RM Test Weeks**: Every 4 or 6 cycles, a test week triggers with ramping protocols; results tracked in profile
- **Sled/Cardio Finishers**: Conditioning-focused finishers (sled, bike, rower, bodyweight cardio) inspired by Edgley
- **Video Demo Placeholders**: Each exercise has a video button (placeholder modal for future video assets)
- **Warm-Up Primers**: Session-specific warm-ups with mobility work (Rusin/Horschig principles)
- **All loads in kg**

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
