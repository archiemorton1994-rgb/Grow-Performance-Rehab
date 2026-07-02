/**
 * Regression tests for BodyDiagram — fill workaround & region tap behaviour.
 *
 * Protects against:
 * 1. Reverting the unselected-hotspot fill from rgba(0,0,0,0.001) to
 *    'transparent'. On iOS/Android, react-native-svg only fires onPress for
 *    painted (non-transparent) fills — transparent silently kills touch events
 *    while appearing fine in the web preview.
 * 2. onPress handlers not selecting the correct PainRegion.
 * 3. Label chips not rendering the correct human-readable region name.
 * 4. Front/Back toggle failing to switch views or clear selection.
 *
 * Entry points tested:
 *   A. app/(tabs)/flex.tsx  "Targeted Prehab" sheet  (emerald accent)
 *   B. app/readiness.tsx    pain-region step          (amber accent)
 *
 * ── Section layout ───────────────────────────────────────────────────────────
 *   [1] Source-code static guards  — run always, no browser needed
 *   [2] Flex tab browser E2E       — Playwright Chromium, Expo web localhost:8082
 *   [3] Readiness browser E2E      — Playwright Chromium, Expo web localhost:8082
 *
 * Browser tests run via scripts/run-playwright.sh which derives LD_LIBRARY_PATH
 * from $HOST_PATH (Replit NixOS exposes each installed package's /bin/ in
 * HOST_PATH; replacing /bin with /lib surfaces all glib, dbus, eudev, X11 etc.
 * libraries that Playwright's Chromium binary needs).
 *
 * Auth bypass: OTP devCode returned in response body when NODE_ENV=development.
 * State:       grow-app-storage v20, grow_auth_token in localStorage.
 */

import { test, expect, Page, APIRequestContext, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE  = 'http://localhost:5000';
const APP_BASE  = 'http://localhost:8082';

let authToken = '';

// ─── Auth setup (runs for browser sections only) ──────────────────────────────

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;
  const email = `bd.spec.${Date.now()}@grow.ci`;
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
  await page.goto(APP_BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token }: { token: string }) => {
      localStorage.setItem('grow_auth_token', token);
      localStorage.setItem(
        'grow-app-storage',
        JSON.stringify({
          state: {
            onboardingComplete: true,
            // tourComplete: true stops the guided TourSheet from intercepting
            // tab presses (the sheet contains "Flex" text which confuses selectors).
            tourComplete: true,
            // Prevent the weekly weight-prompt modal from blocking navigation.
            lastWeightPromptedAt: Date.now(),
            equipmentTiers: ['bodyweight'],
            userProfile: {
              name: 'CI Tester',
              experienceLevel: 'intermediate',
              goals: ['fitness'],
              bodyweightKg: 75,
              sex: 'prefer_not_to_say',
            },
          },
          version: 20,
        }),
      );
    },
    { token },
  );
  // 'load' instead of 'networkidle': Expo HMR WebSocket prevents networkidle
  // from ever resolving, burning up to 20 s per test on the navigation timeout.
  await page.reload({ waitUntil: 'load' });
  // Use [role="tab"] to anchor on the actual tab bar — avoids matching "Flex"
  // text that also appears inside tour-sheet modal content.
  await page.locator('[role="tab"]').filter({ hasText: 'Flex' })
    .waitFor({ state: 'visible', timeout: 12000 });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function hotspot(page: Page, region: string) {
  return page.locator(`[data-testid="body-diagram-region-${region}"]`).first();
}

function toggleBtn(page: Page, view: 'front' | 'back') {
  return page.locator(`[data-testid="body-diagram-${view}"]`);
}

// ─── [1] Source-code static guards (no browser required) ─────────────────────

test.describe('Source-code static guards', () => {

  test('fill guard: h() uses rgba(0,0,0,0.001) not transparent', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../components/BodyDiagram.tsx'), 'utf8');

    // global presence
    expect(src).toContain('rgba(0,0,0,0.001)');

    // inside h() block only
    const hBlock = src.match(
      /const h = \(r: PainRegion\) => \(\{[\s\S]*?\}\);/)?.[0] ?? '';
    expect(hBlock, 'h() block not found — check function signature').not.toBe('');
    expect(hBlock).not.toMatch(/fill:\s*['"]transparent['"]/);
    expect(hBlock).not.toMatch(/fill:\s*['"]none['"]/);
  });

  test('testID guard: h() spreads body-diagram-region-${r} on every hotspot', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../components/BodyDiagram.tsx'), 'utf8');
    expect(src).toContain('testID: `body-diagram-region-${r}`');
  });

  test('h() coverage: all 18 PainRegion values appear as h(\'region\') calls', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../components/BodyDiagram.tsx'), 'utf8');
    const regions = [
      'neck', 'front_shoulder', 'rear_shoulder', 'elbow_wrist',
      'upper_back', 'lower_back', 'core_ribs', 'hip_groin',
      'knee', 'calf_shin', 'ankle_achilles',
      'chest', 'bicep', 'tricep', 'quads', 'hamstrings', 'glutes', 'lat_mid_back',
    ];
    for (const r of regions) {
      expect(src, `h('${r}') not found`).toMatch(new RegExp(`h\\('${r}'\\)`));
    }
  });

  test('label completeness: BODY_DIAGRAM_LABELS has entries for all 18 regions', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../components/BodyDiagram.tsx'), 'utf8');
    const expected: Record<string, string> = {
      neck:           'Neck',
      front_shoulder: 'Front Shoulder',
      rear_shoulder:  'Rear Shoulder',
      elbow_wrist:    'Elbow / Wrist',
      upper_back:     'Upper Back',
      lower_back:     'Lower Back',
      core_ribs:      'Core / Ribs',
      hip_groin:      'Hip / Groin',
      knee:           'Knee',
      calf_shin:      'Calf / Shin',
      ankle_achilles: 'Ankle / Achilles',
      chest:          'Chest',
      bicep:          'Biceps',
      tricep:         'Triceps',
      quads:          'Quads',
      hamstrings:     'Hamstrings',
      glutes:         'Glutes',
      lat_mid_back:   'Lats / Mid Back',
    };
    for (const [region, label] of Object.entries(expected)) {
      expect(src, `key '${region}' not in BODY_DIAGRAM_LABELS`).toContain(`${region}:`);
      expect(src, `label string '${label}' not found`).toContain(label);
    }
  });

  test('toggle testIDs: body-diagram-front and body-diagram-back present', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../components/BodyDiagram.tsx'), 'utf8');
    expect(src).toMatch(/testID="body-diagram-front"/);
    expect(src).toMatch(/testID="body-diagram-back"/);
  });

});

// ─── [2] Flex tab — Targeted Prehab modal (browser E2E) ───────────────────────
// Run via: bash scripts/run-playwright.sh (sets LD_LIBRARY_PATH from HOST_PATH)

test.describe('Flex tab — Targeted Prehab modal (Expo web)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthAndNavigate(page);
    // Navigate to Flex tab via [role="tab"] — getByText('Flex') is unreliable
    // because the TourSheet modal also contains "Flex" in its content.
    await page.locator('[role="tab"]').filter({ hasText: 'Flex' }).click();
    // Open "Targeted Prehab" entry sheet via testID — getByText('Targeted Prehab')
    // is unreliable because the Home tab's Full Body session card sits behind it
    // in the DOM (all tab panes are mounted simultaneously) and intercepts clicks
    // at those coordinates. The testID targets the Pressable that owns onPress.
    const prehabBtn = page.locator('[data-testid="flex-row-prehab"]');
    await prehabBtn.waitFor({ state: 'visible' });
    await prehabBtn.click();
    // Wait until the BodyDiagram is mounted before each test
    await page.locator('[data-testid="body-diagram-front"]').waitFor({ state: 'visible' });
  });

  test('body diagram renders with Front and Back toggle buttons', async ({ page }) => {
    await expect(toggleBtn(page, 'front')).toBeVisible();
    await expect(toggleBtn(page, 'back')).toBeVisible();
  });

  test('Front: tapping neck shows "Neck" label chip', async ({ page }) => {
    await hotspot(page, 'neck').click();
    await expect(page.getByText('Neck')).toBeVisible();
  });

  test('Front: tapping front_shoulder shows "Front Shoulder" label chip', async ({ page }) => {
    await hotspot(page, 'front_shoulder').click();
    await expect(page.getByText('Front Shoulder')).toBeVisible();
  });

  test('Front: tapping elbow_wrist shows "Elbow / Wrist" label chip', async ({ page }) => {
    await hotspot(page, 'elbow_wrist').click();
    await expect(page.getByText('Elbow / Wrist')).toBeVisible();
  });

  test('Front: tapping core_ribs shows "Core / Ribs" label chip', async ({ page }) => {
    await hotspot(page, 'core_ribs').click();
    await expect(page.getByText('Core / Ribs')).toBeVisible();
  });

  test('Front: tapping hip_groin shows "Hip / Groin" label chip', async ({ page }) => {
    await hotspot(page, 'hip_groin').click();
    await expect(page.getByText('Hip / Groin')).toBeVisible();
  });

  test('Front: tapping knee shows "Knee" label chip', async ({ page }) => {
    await hotspot(page, 'knee').click();
    await expect(page.getByText('Knee')).toBeVisible();
  });

  test('Front: tapping calf_shin shows "Calf / Shin" label chip', async ({ page }) => {
    await hotspot(page, 'calf_shin').click();
    await expect(page.getByText('Calf / Shin')).toBeVisible();
  });

  test('Front: tapping ankle_achilles shows "Ankle / Achilles" label chip', async ({ page }) => {
    await hotspot(page, 'ankle_achilles').click();
    await expect(page.getByText('Ankle / Achilles')).toBeVisible();
  });

  test('Back: switching to Back clears selection and shows hint', async ({ page }) => {
    await hotspot(page, 'neck').click();
    await expect(page.getByText('Neck')).toBeVisible();
    await toggleBtn(page, 'back').click();
    await expect(page.getByText('Tap a region on the diagram')).toBeVisible();
    await expect(page.getByText('Neck')).not.toBeVisible();
  });

  test('Back: tapping rear_shoulder shows "Rear Shoulder" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'rear_shoulder').click();
    await expect(page.getByText('Rear Shoulder')).toBeVisible();
  });

  test('Back: tapping upper_back shows "Upper Back" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'upper_back').click();
    await expect(page.getByText('Upper Back')).toBeVisible();
  });

  test('Back: tapping lower_back shows "Lower Back" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'lower_back').click();
    await expect(page.getByText('Lower Back')).toBeVisible();
  });

  test('Front→Back→Front toggle: each switch clears selection', async ({ page }) => {
    await hotspot(page, 'hip_groin').click();
    await expect(page.getByText('Hip / Groin')).toBeVisible();
    await toggleBtn(page, 'back').click();
    await expect(page.getByText('Tap a region on the diagram')).toBeVisible();
    await toggleBtn(page, 'front').click();
    await expect(page.getByText('Tap a region on the diagram')).toBeVisible();
  });

  // New front-view regions (chest, biceps, quads)
  // Note: exact:true needed — label text also appears in session-card subtitles
  // mounted in the background DOM (e.g. "Chest · Shoulders · Triceps").
  test('Front: tapping chest shows "Chest" label chip', async ({ page }) => {
    await hotspot(page, 'chest').click();
    await expect(page.getByText('Chest', { exact: true })).toBeVisible();
  });

  test('Front: tapping bicep shows "Biceps" label chip', async ({ page }) => {
    await hotspot(page, 'bicep').click();
    await expect(page.getByText('Biceps', { exact: true })).toBeVisible();
  });

  test('Front: tapping quads shows "Quads" label chip', async ({ page }) => {
    await hotspot(page, 'quads').click();
    await expect(page.getByText('Quads', { exact: true })).toBeVisible();
  });

  // New back-view regions (tricep, lats, glutes, hamstrings)
  test('Back: tapping tricep shows "Triceps" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'tricep').click();
    await expect(page.getByText('Triceps', { exact: true })).toBeVisible();
  });

  test('Back: tapping lat_mid_back shows "Lats / Mid Back" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'lat_mid_back').click();
    await expect(page.getByText('Lats / Mid Back')).toBeVisible();
  });

  test('Back: tapping glutes shows "Glutes" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'glutes').click();
    await expect(page.getByText('Glutes', { exact: true })).toBeVisible();
  });

  test('Back: tapping hamstrings shows "Hamstrings" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'hamstrings').click();
    await expect(page.getByText('Hamstrings', { exact: true })).toBeVisible();
  });

  test('selecting a region reveals the Start Session button', async ({ page }) => {
    await hotspot(page, 'core_ribs').click();
    await expect(page.getByText(/Start Session/i)).toBeVisible();
  });

});

// ─── [3] Readiness screen — pain-region step (browser E2E) ────────────────────
//
// Flow: /readiness?sessionType=squat&isTestWeek=false
//   → tap testID="aches-yes" (sets hasAches = true)
//   → tap testID="readiness-start" (handleStart → step = 'painRegion')
//   → BodyDiagram renders with amber accent
//   → tap each hotspot → verify label chip + testID="pain-region-confirm" button
//
// Run via: bash scripts/run-playwright.sh (sets LD_LIBRARY_PATH from HOST_PATH)

test.describe('Readiness screen — pain-region step (Expo web)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthAndNavigate(page);
    // Direct URL navigation to /readiness always fails: the app gate in
    // _layout.tsx unconditionally calls router.replace("/(tabs)") for every
    // authenticated user on first mount, regardless of the requested URL.
    // We must navigate in-app instead:
    //   1. Click the Train tab → session list
    //   2. Click "Lower Body" (squat — always the first rotation session for a
    //      user with no completedSessions, so isCurrent = true)
    //   3. handleStart() → router.push('/readiness', params) → readiness screen
    await page.locator('[role="tab"]').filter({ hasText: 'Train' }).click();
    // Use testID to target the squat session card directly.
    // getByText('Lower Body').first() finds the Home tab's suggested-session text
    // (DOM-first, pointer-events:none), and the Train tab's bench card intercepts
    // the click at those coordinates. Clicking the testID element targets the card
    // that owns the onPress handler, which is inside the active Train tab container.
    await page.locator('[data-testid="train-session-squat"]')
      .waitFor({ state: 'visible' });
    await page.locator('[data-testid="train-session-squat"]').click();
    // Mark "Yes →" to indicate aches (hasAches = true)
    await page.getByTestId('aches-yes').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('aches-yes').click();
    // Tap Start — because hasAches is true, transitions to painRegion step
    await page.getByTestId('readiness-start').click();
    // Wait until the BodyDiagram is mounted before each test
    await page.locator('[data-testid="body-diagram-front"]').waitFor({ state: 'visible' });
  });

  test('body diagram renders with Front and Back toggle on pain-region step', async ({ page }) => {
    await expect(toggleBtn(page, 'front')).toBeVisible();
    await expect(toggleBtn(page, 'back')).toBeVisible();
  });

  test('Front: tapping neck shows "Neck" label chip', async ({ page }) => {
    await hotspot(page, 'neck').click();
    await expect(page.getByText('Neck')).toBeVisible();
  });

  test('Front: tapping front_shoulder shows "Front Shoulder" label chip', async ({ page }) => {
    await hotspot(page, 'front_shoulder').click();
    await expect(page.getByText('Front Shoulder')).toBeVisible();
  });

  test('Front: tapping elbow_wrist shows "Elbow / Wrist" label chip', async ({ page }) => {
    await hotspot(page, 'elbow_wrist').click();
    await expect(page.getByText('Elbow / Wrist')).toBeVisible();
  });

  test('Front: tapping core_ribs shows "Core / Ribs" label chip', async ({ page }) => {
    await hotspot(page, 'core_ribs').click();
    await expect(page.getByText('Core / Ribs')).toBeVisible();
  });

  test('Front: tapping hip_groin shows "Hip / Groin" label chip', async ({ page }) => {
    await hotspot(page, 'hip_groin').click();
    await expect(page.getByText('Hip / Groin')).toBeVisible();
  });

  test('Front: tapping knee shows "Knee" label chip', async ({ page }) => {
    await hotspot(page, 'knee').click();
    await expect(page.getByText('Knee')).toBeVisible();
  });

  test('Front: tapping calf_shin shows "Calf / Shin" label chip', async ({ page }) => {
    await hotspot(page, 'calf_shin').click();
    await expect(page.getByText('Calf / Shin')).toBeVisible();
  });

  test('Front: tapping ankle_achilles shows "Ankle / Achilles" label chip', async ({ page }) => {
    await hotspot(page, 'ankle_achilles').click();
    await expect(page.getByText('Ankle / Achilles')).toBeVisible();
  });

  test('Back: switching to Back clears selection', async ({ page }) => {
    await hotspot(page, 'neck').click();
    await expect(page.getByText('Neck')).toBeVisible();
    await toggleBtn(page, 'back').click();
    await expect(page.getByText('Tap a region on the diagram')).toBeVisible();
  });

  test('Back: tapping rear_shoulder shows "Rear Shoulder" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'rear_shoulder').click();
    await expect(page.getByText('Rear Shoulder')).toBeVisible();
  });

  test('Back: tapping upper_back shows "Upper Back" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'upper_back').click();
    await expect(page.getByText('Upper Back')).toBeVisible();
  });

  test('Back: tapping lower_back shows "Lower Back" label chip', async ({ page }) => {
    await toggleBtn(page, 'back').click();
    await hotspot(page, 'lower_back').click();
    await expect(page.getByText('Lower Back')).toBeVisible();
  });

  test('selecting a region reveals the Confirm Region button', async ({ page }) => {
    await hotspot(page, 'core_ribs').click();
    await expect(page.getByTestId('pain-region-confirm')).toBeVisible();
  });

  test('tapping Confirm Region with core_ribs navigates to session', async ({ page }) => {
    await hotspot(page, 'core_ribs').click();
    await page.getByTestId('pain-region-confirm').click();
    await expect(page).toHaveURL(/\/session/);
  });
});
