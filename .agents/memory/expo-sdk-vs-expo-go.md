---
name: Expo SDK version vs Expo Go client support
description: Bumping the Expo SDK can lock users out of Expo Go; web preview masks the failure.
---

# Expo SDK bumps can break Expo Go (and Replit "Simulate on iOS")

When the project's Expo SDK is newer than the Expo Go client a user has installed,
Expo Go refuses to open the project: phone QR shows "Project is incompatible with
this version of Expo Go… requires a newer version", and Replit's "Simulate on iOS"
hangs on "Your app is starting…" (it runs Expo Go under the hood too).

**Why this is sneaky:** the dev server, Metro bundling, and the **web preview all keep
working** because the web preview is browser-based and never touches Expo Go. So
"works in the Replit preview pane" does NOT mean "works on a real device." A green
web preview can hide a total device-testing outage.

**Diagnosis signal:** curl the dev manifest with `-H "expo-platform: ios"` against the
Metro port and read `runtimeVersion` — e.g. `exposdk:56.0.0`. If that SDK is newer
than the installed Expo Go supports, that's the whole problem; it is NOT a
proxy/cold-build/tunnel issue.

**Fix options:** either the user updates Expo Go / uses a development build, or revert
the project to an SDK that the available Expo Go supports. A user-approved SDK
**downgrade** is a legitimate fix and overrides the usual "never downgrade" guardrail
for that task.

**How to apply / do a clean SDK downgrade:**
- Pull the exact known-good version matrix from the pre-upgrade commit
  (`git show <bump>^:package.json`), but preserve any later structural fixes
  (e.g. `sharp` as optionalDependency, added deps).
- Edit package.json directly to those exact versions, then reinstall — do NOT rely on
  `npm install pkg@x` to set specifiers, it rewrites them to carets (a react caret has
  crashed EAS builds before — see eas-react-version-pin).
- Pin native libs that Expo Go bundles to the SDK's exact expected version
  (e.g. react-native-keyboard-controller) so JS matches Expo Go's native module.
- Validate with `npx expo-doctor` (aim 18/18) and re-check the served manifest reports
  the target `exposdk:NN`.
- Before re-bumping the SDK in future, confirm the target Expo Go / Replit simulator
  actually supports that SDK.
