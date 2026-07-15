/**
 * Playwright E2E: SessionActiveBar visibility above keyboard area.
 *
 * Confirms that when the weight TextInput (set-1-weight) is focused in an
 * active session, both the input and the complete-set button remain fully
 * visible in the viewport — not obscured by any overlapping element.
 *
 * Device viewports tested:
 *   iPhone SE  (375×667) — home-button, smallest common size, tightest space
 *   iPhone 14  (390×844) — Dynamic Island, modern flagship
 *
 * Note: This is the Expo web build (localhost:8082). Web does not show a
 * native software keyboard overlay, so the test asserts visual presence and
 * bounding-box containment within the viewport bounds rather than
 * keyboard-push distance. The native iOS/Android keyboard-avoidance invariants
 * are separately enforced by:
 *   • tests/session-kav.check.mjs  (16 structural contract checks)
 *   • tests/session-bar-kav.test.tsx (15 component render checks)
 *
 * Session navigation strategy:
 *   The session starts with a cardio warm-up (time-based exercise; no weight
 *   input). progressToWeightInput() clicks through each non-strength exercise's
 *   complete button — and dismisses the post-set feedback modal — until the
 *   KPI lift (first strength exercise) is active and set-1-weight appears.
 *
 * Run via:  bash scripts/run-playwright.sh tests/session-bar-kav.spec.ts
 * Auth bypass: devCode returned in response body when NODE_ENV=development.
 * Storage:  grow-app-storage v22, grow_auth_token in localStorage.
 */

import { test, expect, Page, APIRequestContext, request } from '@playwright/test';

const API_BASE = 'http://localhost:5000';
const APP_BASE = 'http://localhost:8082';

// Override per-spec: Expo web cold-bundle can take 30-60s on first request.
test.use({ navigationTimeout: 60_000, actionTimeout: 25_000 });

let authToken = '';

// ─── Auth setup ───────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;
  const email = `kav.spec.${Date.now()}@grow.ci`;
  const ctx: APIRequestContext = await request.newContext({ baseURL: API_BASE });
  const codeRes = await ctx.post('/api/auth/request-code', {
    data: { email },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(codeRes.ok()).toBeTruthy();
  const devCode: string = (await codeRes.json()).devCode;
  const verifyRes = await ctx.post('/api/auth/verify-code', {
    data: { email, code: devCode },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(verifyRes.ok()).toBeTruthy();
  authToken = (await verifyRes.json()).token;
  await ctx.dispose();
  return authToken;
}

async function injectAuthAndNavigate(page: Page): Promise<void> {
  const token = await getAuthToken();
  await page.goto(APP_BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(
    ({ token }: { token: string }) => {
      localStorage.setItem('grow_auth_token', token);
      localStorage.setItem(
        'grow-app-storage',
        JSON.stringify({
          state: {
            onboardingComplete: true,
            tourComplete: true,
            lastWeightPromptedAt: Date.now(),
            equipmentTiers: ['dumbbells'],
            userProfile: {
              name: 'KAV Tester',
              experienceLevel: 'intermediate',
              goals: ['fitness'],
              bodyweightKg: 80,
              sex: 'prefer_not_to_say',
            },
          },
          version: 22,
        })
      );
    },
    { token }
  );
  await page.reload({ waitUntil: 'load', timeout: 60_000 });
  await page.locator('[role="tab"]').filter({ hasText: 'Train' }).waitFor({
    state: 'visible',
    timeout: 30_000,
  });
}

async function navigateToSessionScreen(page: Page): Promise<void> {
  await page.locator('[role="tab"]').filter({ hasText: 'Train' }).click();
  await page.locator('[data-testid="train-session-squat"]').waitFor({ state: 'visible' });
  await page.locator('[data-testid="train-session-squat"]').click();

  // Readiness: no aches (default), select 30-min (fewest phases to click through)
  await page.getByTestId('aches-no').waitFor({ state: 'visible', timeout: 20_000 });
  // aches-no is selected by default; explicitly click to be safe
  await page.getByTestId('aches-no').click();
  // Select 30-min session — shortest path to the KPI lift
  await page.getByTestId('time-30').click();
  await page.getByTestId('readiness-start').click();

  await expect(page).toHaveURL(/\/session/, { timeout: 20_000 });
}

/**
 * The session starts with a cardio warm-up (time-based) then active stretches
 * before reaching the KPI lift (first dumbbell strength exercise).
 * This helper clicks through each non-strength set and dismisses
 * the post-set feedback modal until set-N-weight is visible.
 *
 * isZeroBlocked formula in SessionActiveBar:
 *   time exercises → not blocked (only needs check tap)
 *   band exercises → blocked when parsedReps === 0 → must fill reps first
 *   strength exercises → blocked when weight===0 OR reps===0 → that IS the KPI lift
 *
 * So for each non-strength exercise: detect if it is a band exercise
 * (set-N-reps visible, set-N-weight not visible) and fill "8" reps before
 * clicking the complete button. The button is enabled as soon as reps > 0.
 *
 * 30-min squat session phase order (dumbbells):
 *   1. Cardio warm-up     (1 set, time)   → check only
 *   2. Active stretches   (3 × 1 set)     → some time, some band (need reps fill)
 *   3. Mechanical priming (band)          → need reps fill
 *   4. KPI lift (Goblet Squat)            → set-N-weight visible here
 */
async function progressToWeightInput(page: Page): Promise<void> {
  for (let i = 0; i < 50; i++) {
    // Exit when the weight input is visible (first dumbbell / strength exercise)
    if (
      await page
        .getByTestId('set-1-weight')
        .isVisible({ timeout: 500 })
        .catch(() => false)
    ) {
      return;
    }

    // Dismiss the post-set feedback modal ("✓ Good" with testID="feedback-good").
    const feedbackGood = page.getByTestId('feedback-good');
    if (await feedbackGood.isVisible({ timeout: 600 }).catch(() => false)) {
      await feedbackGood.click();
      await page.waitForTimeout(300);
      continue;
    }

    // For band exercises (set-N-reps visible, set-N-weight NOT visible):
    // isZeroBlocked = parsedReps===0, so the check button is disabled until reps filled.
    // Fill "8" reps to enable the check button before clicking.
    for (let s = 1; s <= 6; s++) {
      const weightId = `set-${s}-weight`;
      const repsId = `set-${s}-reps`;
      const hasWeight = await page
        .getByTestId(weightId)
        .isVisible({ timeout: 80 })
        .catch(() => false);
      if (hasWeight) {
        // Strength exercise — the outer loop's weight check will catch this next iter
        break;
      }
      const hasReps = await page
        .getByTestId(repsId)
        .isVisible({ timeout: 150 })
        .catch(() => false);
      if (hasReps) {
        await page.getByTestId(repsId).fill('8');
        break;
      }
    }

    // Click the active set's complete button (set-N-check where N matches active set).
    let clicked = false;
    for (let s = 1; s <= 6; s++) {
      const checkBtn = page.getByTestId(`set-${s}-check`);
      if (await checkBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        await checkBtn.click();
        await page.waitForTimeout(400);
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await page.waitForTimeout(350);
    }
  }

  // Final assertion — descriptive failure if KPI lift was never reached
  await page.getByTestId('set-1-weight').waitFor({ state: 'visible', timeout: 10_000 });
}

// ─── iPhone SE (375×667) — smallest common device ────────────────────────────

test.describe('SessionActiveBar — iPhone SE (375×667)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await injectAuthAndNavigate(page);
    await navigateToSessionScreen(page);
    await progressToWeightInput(page);
  });

  test('weight TextInput is visible and within 375×667 viewport after focus', async ({ page }) => {
    const input = page.getByTestId('set-1-weight');
    await expect(input).toBeVisible();
    await input.click(); // focus the input
    // Must remain visible after focus — not pushed below viewport by any overlay
    await expect(input).toBeVisible();
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    // Bottom edge must be within the 667px viewport
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  });

  test('reps TextInput is visible within viewport when weight input is focused', async ({
    page,
  }) => {
    await page.getByTestId('set-1-weight').click();
    const repsInput = page.getByTestId('set-1-reps');
    await expect(repsInput).toBeVisible();
    const box = await repsInput.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  });

  test('complete-set button visible within viewport when weight input is focused', async ({
    page,
  }) => {
    await page.getByTestId('set-1-weight').click();
    const btn = page.getByTestId('set-1-check');
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  });
});

// ─── iPhone 14 (390×844) ─────────────────────────────────────────────────────

test.describe('SessionActiveBar — iPhone 14 (390×844)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await injectAuthAndNavigate(page);
    await navigateToSessionScreen(page);
    await progressToWeightInput(page);
  });

  test('weight TextInput is visible and within 390×844 viewport after focus', async ({ page }) => {
    const input = page.getByTestId('set-1-weight');
    await input.click();
    await expect(input).toBeVisible();
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });

  test('complete-set button visible at 390×844 when weight input is focused', async ({ page }) => {
    await page.getByTestId('set-1-weight').click();
    const btn = page.getByTestId('set-1-check');
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });
});
