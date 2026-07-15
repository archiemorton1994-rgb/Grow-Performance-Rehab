---
name: Playwright RNW disabled Pressable click-through
description: In React Native Web, a Pressable with disabled=true accepts Playwright click() DOM events but onPress never fires; band exercises in SessionActiveBar require reps>0 before the check button is enabled.
---

## The rule

When writing Playwright tests that click through Expo/React Native Web `Pressable` buttons, a button with `disabled={true}` will silently swallow clicks — Playwright's `.click()` dispatches DOM events successfully (no error, no timeout), but the React `onPress` handler is never invoked and state does not update.

## Why

React Native Web's Pressable uses its own gesture responder system (`onStartShouldSetResponder`). When `disabled={true}` the responder returns `false`, so the synthetic press event is not captured. Playwright dispatches native browser `mousedown/mouseup/click` events which bypass the responder, making the click appear to succeed from Playwright's perspective.

## How to apply

Before clicking a Pressable that might be disabled:

1. **Identify the disabled condition**. For `SessionActiveBar`, the `isZeroBlocked` formula is:
   - Time exercises: never blocked
   - Band exercises: blocked when `parsedReps === 0` → fill reps first
   - Strength exercises: blocked when `weight === 0 OR reps === 0` → that IS the KPI lift (desired state)

2. **Fill required inputs before clicking**. For band exercises (reps visible, weight NOT visible), fill the reps TextInput with a non-zero value (e.g. `"8"`) before clicking the check button.

3. **Detect the pattern**: if Playwright's `.click()` on a button succeeds but state never updates (no feedback panel appears, no exercise advance), the button is almost certainly disabled.

## Session click-through pattern (session-bar-kav.spec.ts)

```ts
// Fill reps for band exercises before clicking check
for (let s = 1; s <= 6; s++) {
  const hasWeight = await page.getByTestId(`set-${s}-weight`).isVisible({ timeout: 80 }).catch(() => false);
  if (hasWeight) break; // strength exercise — stop here
  const hasReps = await page.getByTestId(`set-${s}-reps`).isVisible({ timeout: 150 }).catch(() => false);
  if (hasReps) {
    await page.getByTestId(`set-${s}-reps`).fill('8');
    break;
  }
}
// Now click the check button (it is enabled)
for (let s = 1; s <= 6; s++) {
  const checkBtn = page.getByTestId(`set-${s}-check`);
  if (await checkBtn.isVisible({ timeout: 200 }).catch(() => false)) {
    await checkBtn.click();
    break;
  }
}
```
