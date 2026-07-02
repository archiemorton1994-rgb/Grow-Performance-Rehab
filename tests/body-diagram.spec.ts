/**
 * E2E regression tests for BodyDiagram — fill workaround & region selection.
 *
 * Protects against:
 * 1. The unselected-hotspot fill being reverted from rgba(0,0,0,0.001) to
 *    'transparent'. On iOS/Android, react-native-svg only fires onPress for
 *    painted (non-transparent) fills; transparent makes hotspots silently
 *    untappable while appearing fine in the web preview.
 * 2. Hotspot onPress handlers not selecting the correct PainRegion.
 * 3. Label chips not rendering the correct human-readable region name.
 * 4. Front/Back toggle failing to switch views or clear selection.
 *
 * Coverage:
 *   - Flex tab "Targeted Prehab" modal (app/(tabs)/flex.tsx) — emerald accent
 *   - All 11 PainRegion values: 8 front-view + 3 back-only
 *
 * Auth: uses the dev OTP API (devCode returned in response body in dev mode)
 * to get a real JWT, then injects localStorage state to bypass onboarding.
 */

import { test, expect, Page, APIRequestContext, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:5000';
const APP_BASE = 'http://localhost:8082';
const TEST_EMAIL = `bd.spec.${Date.now()}@grow.ci`;

let authToken = '';

// ─── Auth setup ──────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  const ctx: APIRequestContext = await request.newContext({ baseURL: API_BASE });

  const codeRes = await ctx.post('/api/auth/request-code', {
    data: { email: TEST_EMAIL },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(codeRes.ok()).toBeTruthy();
  const codeBody = await codeRes.json();
  const devCode: string = codeBody.devCode;
  expect(devCode).toMatch(/^\d{6}$/);

  const verifyRes = await ctx.post('/api/auth/verify-code', {
    data: { email: TEST_EMAIL, code: devCode },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(verifyRes.ok()).toBeTruthy();
  const verifyBody = await verifyRes.json();
  authToken = verifyBody.token;
  expect(authToken).toBeTruthy();

  await ctx.dispose();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function injectAuthAndNavigate(page: Page): Promise<void> {
  await page.goto(APP_BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token }: { token: string }) => {
      localStorage.setItem('grow_auth_token', token);
      localStorage.setItem(
        'grow-app-storage',
        JSON.stringify({
          state: {
            onboardingComplete: true,
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
    { token: authToken },
  );
  await page.reload({ waitUntil: 'networkidle' });
}

async function openPrehabModal(page: Page): Promise<void> {
  const flexTab = page.getByText('Flex').last();
  await flexTab.click();
  await page.waitForTimeout(800);

  const prehabBtn = page.getByText('Targeted Prehab');
  await prehabBtn.scrollIntoViewIfNeeded();
  await prehabBtn.click();
  await page.waitForTimeout(600);
}

function regionLocator(page: Page, region: string) {
  return page.locator(`[data-testid="body-diagram-region-${region}"]`).first();
}

function toggleLocator(page: Page, view: 'front' | 'back') {
  return page.locator(`[data-testid="body-diagram-${view}"]`);
}

// ─── Static guard ─────────────────────────────────────────────────────────────

test('source guard: BodyDiagram uses rgba(0,0,0,0.001) fill not transparent', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../components/BodyDiagram.tsx'),
    'utf8',
  );

  expect(src).toContain('rgba(0,0,0,0.001)');

  // Extract the h() helper block and assert it has no transparent fill
  const hBlock = src.match(/const h = \(r: PainRegion\)[\s\S]*?\}\);/)?.[0] ?? '';
  expect(hBlock).not.toBe('');
  expect(hBlock).not.toMatch(/fill:\s*['"]transparent['"]/);
});

test('source guard: all 11 pain regions have testID wired via h()', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../components/BodyDiagram.tsx'),
    'utf8',
  );
  expect(src).toContain('testID: `body-diagram-region-${r}`');

  const regions = [
    'neck', 'front_shoulder', 'rear_shoulder', 'elbow_wrist',
    'upper_back', 'lower_back', 'core_ribs', 'hip_groin',
    'knee', 'calf_shin', 'ankle_achilles',
  ];
  for (const r of regions) {
    const hotspotPattern = new RegExp(`h\\('${r}'\\)`);
    expect(src).toMatch(hotspotPattern);
  }
});

test('source guard: BODY_DIAGRAM_LABELS has entries for all 11 regions', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../components/BodyDiagram.tsx'),
    'utf8',
  );
  const regions = [
    'neck', 'front_shoulder', 'rear_shoulder', 'elbow_wrist',
    'upper_back', 'lower_back', 'core_ribs', 'hip_groin',
    'knee', 'calf_shin', 'ankle_achilles',
  ];
  for (const r of regions) {
    expect(src).toContain(`${r}:`);
  }
});

// ─── Browser E2E: Flex tab → Targeted Prehab modal ────────────────────────────

test.describe('Flex tab — Targeted Prehab modal body diagram (emerald accent)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthAndNavigate(page);
    await openPrehabModal(page);
  });

  test('body diagram renders with Front and Back toggle buttons', async ({ page }) => {
    await expect(toggleLocator(page, 'front')).toBeVisible();
    await expect(toggleLocator(page, 'back')).toBeVisible();
  });

  test('Front view: tapping neck shows "Neck" label chip', async ({ page }) => {
    await regionLocator(page, 'neck').click();
    await expect(page.getByText('Neck')).toBeVisible();
  });

  test('Front view: tapping core_ribs shows "Core / Ribs" label chip', async ({ page }) => {
    await regionLocator(page, 'core_ribs').click();
    await expect(page.getByText('Core / Ribs')).toBeVisible();
  });

  test('Front view: tapping front_shoulder shows "Front Shoulder" label chip', async ({ page }) => {
    await regionLocator(page, 'front_shoulder').first().click();
    await expect(page.getByText('Front Shoulder')).toBeVisible();
  });

  test('Front view: tapping hip_groin shows "Hip / Groin" label chip', async ({ page }) => {
    await regionLocator(page, 'hip_groin').click();
    await expect(page.getByText('Hip / Groin')).toBeVisible();
  });

  test('Front view: tapping knee shows "Knee" label chip', async ({ page }) => {
    await regionLocator(page, 'knee').first().click();
    await expect(page.getByText('Knee')).toBeVisible();
  });

  test('Front view: tapping elbow_wrist shows "Elbow / Wrist" label chip', async ({ page }) => {
    await regionLocator(page, 'elbow_wrist').first().click();
    await expect(page.getByText('Elbow / Wrist')).toBeVisible();
  });

  test('Front view: tapping calf_shin shows "Calf / Shin" label chip', async ({ page }) => {
    await regionLocator(page, 'calf_shin').first().click();
    await expect(page.getByText('Calf / Shin')).toBeVisible();
  });

  test('Front view: tapping ankle_achilles shows "Ankle / Achilles" label chip', async ({ page }) => {
    await regionLocator(page, 'ankle_achilles').first().click();
    await expect(page.getByText('Ankle / Achilles')).toBeVisible();
  });

  test('Back view: switching to Back clears selection and shows hint', async ({ page }) => {
    await regionLocator(page, 'neck').click();
    await expect(page.getByText('Neck')).toBeVisible();
    await toggleLocator(page, 'back').click();
    await expect(page.getByText('Tap a region on the diagram')).toBeVisible();
    await expect(page.getByText('Neck')).not.toBeVisible();
  });

  test('Back view: tapping upper_back shows "Upper Back" label chip', async ({ page }) => {
    await toggleLocator(page, 'back').click();
    await regionLocator(page, 'upper_back').click();
    await expect(page.getByText('Upper Back')).toBeVisible();
  });

  test('Back view: tapping rear_shoulder shows "Rear Shoulder" label chip', async ({ page }) => {
    await toggleLocator(page, 'back').click();
    await regionLocator(page, 'rear_shoulder').first().click();
    await expect(page.getByText('Rear Shoulder')).toBeVisible();
  });

  test('Back view: tapping lower_back shows "Lower Back" label chip', async ({ page }) => {
    await toggleLocator(page, 'back').click();
    await regionLocator(page, 'lower_back').click();
    await expect(page.getByText('Lower Back')).toBeVisible();
  });

  test('selecting a region shows the Start Session button', async ({ page }) => {
    await regionLocator(page, 'core_ribs').click();
    const startBtn = page.getByTestId('prehab-region-start');
    if (await startBtn.count() > 0) {
      await expect(startBtn).toBeVisible();
    } else {
      await expect(page.getByText(/Start Session/i)).toBeVisible();
    }
  });

  test('Front→Back→Front toggle: selection clears on each switch', async ({ page }) => {
    await regionLocator(page, 'hip_groin').click();
    await expect(page.getByText('Hip / Groin')).toBeVisible();

    await toggleLocator(page, 'back').click();
    await expect(page.getByText('Tap a region on the diagram')).toBeVisible();

    await toggleLocator(page, 'front').click();
    await expect(page.getByText('Tap a region on the diagram')).toBeVisible();
  });
});
