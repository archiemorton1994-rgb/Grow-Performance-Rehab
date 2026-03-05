# Grow Performance & Rehab

## Overview
A React Native mobile fitness app that removes decision fatigue by telling users exactly what to do each workout based on their equipment and how they feel. Built with Expo, Expo Router, and Zustand.

## Architecture
- **Frontend**: Expo (React Native) with Expo Router file-based routing
- **Backend**: Express.js (minimal, serves landing page and API routes)
- **State**: Zustand with AsyncStorage persistence (no database needed)

## Key Features
- **Equipment Tiers**: Bodyweight/Bands, Dumbbells/Kettlebells, Full Gym/Barbell
- **3-Day Rotation**: Squat (Lower), Bench (Upper), Deadlift (Full Body)
- **Readiness Check**: Pre-workout pain/energy assessment
- **Dynamic Workout Engine**: 3-layer adaptation (equipment swap, pain swap, energy swap)
- **Session Tracking**: Completion tracking, streak counting, workout history

## File Structure
```
app/
  _layout.tsx           - Root layout with providers and onboarding redirect
  onboarding.tsx        - Equipment tier selection
  readiness.tsx         - Pre-workout readiness check (aches + energy)
  session.tsx           - Active workout player with exercise cards
  (tabs)/
    _layout.tsx         - Tab navigation (NativeTabs + classic fallback)
    index.tsx           - Home screen (stats, start session hero)
    workouts.tsx        - Program timeline with rotation visualization
    profile.tsx         - Settings, equipment change, workout history

lib/
  store.ts              - Zustand store with AsyncStorage persistence
  workout-engine.ts     - Workout generation with 3-layer adaptation logic
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

## Dependencies
- zustand (state management with persistence)
- @react-native-async-storage/async-storage
- expo-haptics, expo-router, @expo/vector-icons
- react-native-reanimated (animations)
