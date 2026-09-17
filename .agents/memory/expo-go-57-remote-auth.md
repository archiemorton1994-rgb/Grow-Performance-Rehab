---
name: Expo Go 57 remote authentication
description: Account matching required for opening remote SDK 57 development manifests in Expo Go.
---

For a remote SDK 57 development manifest, Expo Go requires the phone and the Expo CLI process serving Metro to be signed into the same Expo account. Anonymous Metro asks the phone to sign in; a temporary Replit CLI account causes an owner mismatch for a personal Expo Go account. An organization robot token also fails this requirement because Metro publishes the robot's identity rather than the human/shared Expo username.

**Why:** Raw QR codes contain only the Metro URL and cannot perform Replit's documented account handoff when that Preview control is unavailable. The project opened successfully only after the user logged into Expo privately in Shell and Metro used that exact profile.

**How to apply:** Keep personal Expo CLI state isolated with `__UNSAFE_EXPO_HOME_DIRECTORY=$HOME/.expo-user`, never collect credentials in chat, and have Expo Go use the same account. For durable authentication, store a personal access token as `EXPO_TOKEN`; confirm `expo whoami` and the live manifest username both equal the Expo Go login. Do not use robot or temporary `replit-private-*` identities for shared physical-device testing.