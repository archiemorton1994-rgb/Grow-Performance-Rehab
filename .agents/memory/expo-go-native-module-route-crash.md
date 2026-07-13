---
name: Expo Go native module static import crashes route
description: Static top-level import of a non-bundled native module causes Expo Router to 404 the whole screen.
---

## The Rule

Never statically import native modules that may not be bundled with Expo Go at the top level of a screen file. Use lazy `require()` inside the functions that actually need them.

**Why:** When a static import references a native module that isn't available in Expo Go (e.g. `react-native-view-shot`, `expo-media-library` at a version newer than the SDK), the JavaScript module evaluation throws during startup. The module never completes evaluation, so its `export default` never registers. Expo Router then logs:

```
WARN  Route "./your-screen.tsx" is missing the required default export.
WARN  [Layout children]: No route named "your-screen" exists in nested children: [...]
```

Any navigation to that route falls through to `+not-found`, showing "This screen doesn't exist."

**How to apply:**
- If a screen uses screenshot/media/sharing features, move those imports inside the async handler functions using `require()`.
- Add `// eslint-disable-next-line @typescript-eslint/no-require-imports` above each `require`.
- Wrap with a try/catch so failure to load the native module degrades gracefully.

Example pattern:
```typescript
const handleShare = async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { captureRef } = require('react-native-view-shot') as { captureRef: ... };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');
    // ... use them
  } catch {
    Alert.alert('Not available in this environment');
  }
};
```

## Companion fix for chain-replace navigation

If a screen is reached via a chain of `router.replace` calls (e.g. readiness → replace → session → replace → session-summary), Expo Router v6 can corrupt the stack. Fix: use `router.push` for the final navigation, and declare the screen as `presentation: 'fullScreenModal'` with `gestureEnabled: false` in the root Stack so the user can't swipe back.

```tsx
// app/_layout.tsx
<Stack.Screen
  name="session-summary"
  options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
/>

// calling screen
router.push('/session-summary'); // not router.replace
```

The "Done" button in the modal calls `router.dismissAll()` + `router.replace('/(tabs)')` to return home cleanly.
