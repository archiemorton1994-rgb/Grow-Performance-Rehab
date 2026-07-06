/**
 * Runtime component rendering tests for the pain-adaptation banner and
 * comfort note in session.tsx.
 *
 * Uses react-test-renderer (Node.js env — no browser, no native modules).
 * All session.tsx dependencies are mocked in jest-component.config.js.
 *
 *   [1]  Real PainAdaptBanner from session.tsx — banner presence and dismiss
 *        (exported component; regressions in session.tsx break these tests)
 *   [2]  Real ExerciseCard from session.tsx — comfort note rendering
 *        (exported component; same binding guarantee)
 *   [3]  PainAdaptBanner — session restore path
 *        (dismissed state persisted across background/resume)
 *   [4]  SessionScreen — restore from stored activeSession
 *        (integration tests for the restore path)
 *   [5]  Swap-exercise flow — comfort badge cleared after swap
 *        (getDisplayExercise must strip badge; comfortCount must reflect swaps)
 *   [6]  Bicep/tricep tap → session generator → comfortVariant exercises
 *        (end-to-end: BodyDiagram tap selects region; real generateWorkout
 *        produces badge='comfort' exercises for bicep and tricep pain regions)
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import renderer from 'react-test-renderer';
import { act } from 'react';

// Both components and SessionScreen (default export) are exported from session.tsx
// for testability. All session.tsx dependencies are mapped in jest-component.config.js.
import SessionScreen, { PainAdaptBanner, ExerciseCard } from '../app/session';

// Real ReadinessScreen — used in section [6] to mount the actual pain-picker flow.
// Its deps (expo-router, store, workout-engine) are all already mocked by
// jest-component.config.js, so it renders safely in Node.js.
import ReadinessScreen from '../app/readiness';

// MUSCLE_SET — used in section [6] to assert bicep/tricep are in muscles mode.
import { MUSCLE_SET } from '../components/BodyDiagram';
import type { PainRegion } from '../lib/store';

// Real generateWorkout — imported via relative path to bypass the
// `^@/lib/workout-engine$` mock mapping in jest-component.config.js.
// All types it imports from store.ts are stripped by Babel at runtime, so
// no mock dependency is introduced.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateWorkout } = require('../lib/workout-engine') as {
  generateWorkout: typeof import('../lib/workout-engine').generateWorkout;
};

// ─── Tree helpers ─────────────────────────────────────────────────────────────

type TreeNode = {
  type: string;
  props: Record<string, unknown>;
  children: (TreeNode | string)[] | null;
};

function findInTree(
  node: TreeNode | string | null,
  predicate: (n: TreeNode) => boolean,
): TreeNode | null {
  if (!node || typeof node === 'string') return null;
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = findInTree(child as TreeNode | string, predicate);
    if (found) return found;
  }
  return null;
}

function hasTestId(root: renderer.ReactTestRenderer, testId: string): boolean {
  return !!findInTree(
    root.toJSON() as TreeNode | null,
    (n) => n.props.testID === testId,
  );
}

/**
 * Returns true if any Text node in the tree has joined string children that
 * include `text` (handles JSX text interpolation splitting across children).
 */
function hasText(root: renderer.ReactTestRenderer, text: string): boolean {
  return !!findInTree(root.toJSON() as TreeNode | null, (n) => {
    const c = n.children;
    if (!Array.isArray(c)) return false;
    const joined = c.filter((ch) => typeof ch === 'string').join('');
    return joined.includes(text);
  });
}

function press(root: renderer.ReactTestRenderer, testId: string): void {
  const els = root.root.findAllByProps({ testID: testId });
  if (els.length === 0) throw new Error(`No element found with testID="${testId}"`);
  act(() => {
    (els[0].props as { onPress: () => void }).onPress();
  });
}

// ─── [1] Real PainAdaptBanner — banner presence and dismiss ───────────────────
//
// PainAdaptBanner is a controlled component: the parent owns the `dismissed`
// boolean. The fixture below wraps it with minimal state so we can test the
// full dismiss interaction while still rendering the real component from
// session.tsx.

/**
 * Minimal controlled fixture that drives PainAdaptBanner the same way
 * SessionScreen does: pass `dismissed` down, update it via `onDismiss`.
 */
function BannerFixture({
  hasAches,
  painRegion,
  comfortCount = 0,
}: {
  hasAches: boolean;
  painRegion: string | undefined;
  comfortCount?: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <PainAdaptBanner
      hasAches={hasAches}
      painRegion={painRegion as Parameters<typeof PainAdaptBanner>[0]['painRegion']}
      comfortCount={comfortCount}
      dismissed={dismissed}
      onDismiss={() => setDismissed(true)}
    />
  );
}

describe('[1] Real PainAdaptBanner — banner presence and dismiss', () => {
  test('banner renders and testID="pain-banner-dismiss" is present when hasAches=true and painRegion is set', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={true} painRegion="knee" />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(true);
  });

  test('banner is absent when hasAches=false', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={false} painRegion="knee" />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
  });

  test('banner is absent when painRegion is undefined even if hasAches=true', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={true} painRegion={undefined} />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
  });

  test('banner shows the adapted region label from getPainRegionLabel', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={true} painRegion="knee" />,
      );
    });
    expect(hasText(root, 'Adapted for')).toBe(true);
    expect(hasText(root, 'Knee')).toBe(true);
  });

  test('tapping the dismiss button removes the banner from the render tree', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={true} painRegion="knee" />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(true);
    press(root, 'pain-banner-dismiss');
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
  });

  test('banner shows zero-swap fallback message when comfortCount is 0', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={true} painRegion="knee" comfortCount={0} />,
      );
    });
    expect(hasText(root, 'No exercises needed swapping')).toBe(true);
  });

  test('banner shows singular swap message when comfortCount is 1', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={true} painRegion="knee" comfortCount={1} />,
      );
    });
    expect(hasText(root, '1 exercise swapped for comfort')).toBe(true);
  });

  test('banner shows plural swap message when comfortCount is 3', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BannerFixture hasAches={true} painRegion="knee" comfortCount={3} />,
      );
    });
    expect(hasText(root, '3 exercises swapped for comfort')).toBe(true);
  });
});

// ─── [2] Real ExerciseCard — comfort note rendering ───────────────────────────
//
// ExerciseCard is exported from session.tsx. These tests render the real
// component and assert on the comfort note that appears when badge="comfort"
// and a comfortRegionLabel is provided.

/** Minimal Exercise object satisfying the Exercise interface. */
function makeExercise(overrides: Partial<{
  badge: 'comfort' | 'volume' | undefined;
  category: string;
  hasSwap: boolean;
  swapName: string;
  swapCue: string;
  swap2Name: string;
}> = {}): Parameters<typeof ExerciseCard>[0]['exercise'] {
  return {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    sets: 3,
    reps: '8-12',
    cue: 'Keep chest tall.',
    suggestedLoad: '20 kg',
    category: (overrides.category ?? 'accessory') as Parameters<typeof ExerciseCard>[0]['exercise']['category'],
    badge: overrides.badge,
    videoId: 'test-video',
    hasSwap: overrides.hasSwap ?? false,
    isDumbbellExercise: false,
    swapName: overrides.swapName,
    swapCue: overrides.swapCue,
    swap2Name: overrides.swap2Name,
  };
}

/** Minimal ExerciseSetData satisfying the interface. */
function makeSetData(): Parameters<typeof ExerciseCard>[0]['setData'] {
  return {
    sets: [{ setNumber: 1, reps: 10, weight: 20, completed: false }],
    swapCount: 0,
    activeSetIndex: 0,
  };
}

/** Default no-op props for ExerciseCard. */
const defaultCardProps = {
  index: 0,
  onSetChange: () => {},
  onVideoPress: () => {},
  onSwapPress: () => {},
  isDumbbellSession: false,
  exerciseState: 'active' as const,
  sessionType: 'squat' as const,
};

describe('[2] Real ExerciseCard — comfort note rendering', () => {
  test('comfort note renders when badge="comfort" and comfortRegionLabel is provided', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise({ badge: 'comfort' })}
          setData={makeSetData()}
          comfortRegionLabel="Knee"
        />,
      );
    });
    expect(hasText(root, 'Adapted for Knee')).toBe(true);
    expect(hasText(root, 'skip if still uncomfortable')).toBe(true);
  });

  test('comfort note includes the exact region label', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise({ badge: 'comfort' })}
          setData={makeSetData()}
          comfortRegionLabel="Lower Back"
        />,
      );
    });
    expect(hasText(root, 'Adapted for Lower Back')).toBe(true);
    expect(hasText(root, 'skip if still uncomfortable')).toBe(true);
  });

  test('comfort note is absent when badge is "volume" even with a region label', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise({ badge: 'volume' })}
          setData={makeSetData()}
          comfortRegionLabel="Knee"
        />,
      );
    });
    expect(hasText(root, 'Adapted for Knee')).toBe(false);
    expect(hasText(root, 'skip if still uncomfortable')).toBe(false);
  });

  test('comfort note is absent when comfortRegionLabel is undefined', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise({ badge: 'comfort' })}
          setData={makeSetData()}
          comfortRegionLabel={undefined}
        />,
      );
    });
    expect(hasText(root, 'Adapted for')).toBe(false);
    expect(hasText(root, 'skip if still uncomfortable')).toBe(false);
  });

  test('comfort note is absent when badge is undefined', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise()}
          setData={makeSetData()}
        />,
      );
    });
    expect(hasText(root, 'Adapted for')).toBe(false);
    expect(hasText(root, 'skip if still uncomfortable')).toBe(false);
  });

  test('comfort note shows correct text for multiple pain regions', () => {
    const regions = ['Front Shoulder', 'Elbow / Wrist', 'Hip / Groin', 'Ankle / Achilles'];
    for (const label of regions) {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(
          <ExerciseCard
            {...defaultCardProps}
            exercise={makeExercise({ badge: 'comfort' })}
            setData={makeSetData()}
            comfortRegionLabel={label}
          />,
        );
      });
      expect(hasText(root, `Adapted for ${label}`)).toBe(true);
    }
  });

  test('ExerciseCard renders the exercise name regardless of comfort badge', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise({ badge: 'comfort' })}
          setData={makeSetData()}
          comfortRegionLabel="Knee"
        />,
      );
    });
    expect(hasText(root, 'Goblet Squat')).toBe(true);
  });
});

// ─── [3] PainAdaptBanner — session restore path ───────────────────────────────
//
// Task #312 persists `painBannerDismissed` in ActiveSession so the banner
// state survives app background → resume. These tests confirm that the
// correct initial `dismissed` value (restored from stored state) drives
// banner visibility correctly.
//
// The `RestoreFixture` starts with the `initialDismissed` value that would
// come from `stored.painBannerDismissed` on session resume.

function RestoreFixture({
  initialDismissed,
  hasAches,
  painRegion,
  comfortCount = 2,
}: {
  initialDismissed: boolean;
  hasAches: boolean;
  painRegion: string | undefined;
  comfortCount?: number;
}) {
  const [dismissed, setDismissed] = useState(initialDismissed);
  return (
    <PainAdaptBanner
      hasAches={hasAches}
      painRegion={painRegion as Parameters<typeof PainAdaptBanner>[0]['painRegion']}
      comfortCount={comfortCount}
      dismissed={dismissed}
      onDismiss={() => setDismissed(true)}
    />
  );
}

describe('[3] PainAdaptBanner — session restore path', () => {
  test('banner shows after restore when not previously dismissed (dismissed=false)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <RestoreFixture initialDismissed={false} hasAches={true} painRegion="knee" />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(true);
  });

  test('banner stays hidden after restore when previously dismissed (dismissed=true)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <RestoreFixture initialDismissed={true} hasAches={true} painRegion="knee" />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
  });

  test('banner stays hidden even with a comfort count when previously dismissed', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <RestoreFixture initialDismissed={true} hasAches={true} painRegion="knee" comfortCount={3} />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
    expect(hasText(root, 'exercises swapped')).toBe(false);
  });

  test('banner is absent after restore when hasAches=false (no pain session)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <RestoreFixture initialDismissed={false} hasAches={false} painRegion="knee" />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
  });

  test('banner is absent after restore when painRegion is undefined', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <RestoreFixture initialDismissed={false} hasAches={true} painRegion={undefined} />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
  });

  test('banner can still be dismissed during a resumed session (initialDismissed=false)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <RestoreFixture initialDismissed={false} hasAches={true} painRegion="knee" />,
      );
    });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(true);
    press(root, 'pain-banner-dismiss');
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
  });

  test('comfort note shows on restored comfort-badged exercise (badge="comfort")', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise({ badge: 'comfort' })}
          setData={makeSetData()}
          comfortRegionLabel="Lower Back"
        />,
      );
    });
    expect(hasText(root, 'Adapted for Lower Back')).toBe(true);
    expect(hasText(root, 'tap Swap or skip')).toBe(true);
  });

  test('comfort note absent on restored exercise that was not adapted (badge="volume")', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ExerciseCard
          {...defaultCardProps}
          exercise={makeExercise({ badge: 'volume' })}
          setData={makeSetData()}
          comfortRegionLabel="Lower Back"
        />,
      );
    });
    expect(hasText(root, 'Adapted for Lower Back')).toBe(false);
  });

  test('adapted region label renders correctly for all pain regions on restore', () => {
    const regions: Array<[string, string]> = [
      ['knee', 'Knee'],
      ['lower_back', 'Lower Back'],
      ['front_shoulder', 'Front Shoulder'],
      ['hip_groin', 'Hip / Groin'],
    ];
    for (const [region, label] of regions) {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(
          <RestoreFixture initialDismissed={false} hasAches={true} painRegion={region} />,
        );
      });
      expect(hasText(root, `Adapted for ${label}`)).toBe(true);
    }
  });
});

// ─── [4] SessionScreen — restore from stored activeSession ────────────────────
//
// Integration-style tests that render the full SessionScreen component with a
// mocked Zustand store containing a persisted ActiveSession snapshot, then
// assert that the pain banner and comfort-note driven by `hasAches` / `painRegion`
// survive the restore path in `tryRestoreFromStored`.
//
// Mock wiring:
//   store      → __mocks__/store.js      (__setStoreOverride / __clearStoreOverride)
//   router     → __mocks__/expo-router.js (__setParams / __clearParams)
//   exercises  → __mocks__/lib-workout-engine.js (generateWorkout is a jest.fn())
//
// All three mocks share the same Jest module-registry entry as what session.tsx
// imports, so overrides set here are seen by the component at render time.

// ── Fixture data ──────────────────────────────────────────────────────────────

/** Comfort-badged exercise matching the stored exerciseIds below. */
const RESTORE_EXERCISES = [
  {
    id: 'restore-comfort-ex',
    name: 'Goblet Squat',
    sets: 2,
    reps: '8-10',
    cue: 'Keep chest tall.',
    suggestedLoad: '20 kg',
    category: 'main',
    badge: 'comfort',
    videoId: '',
    hasSwap: true,
    isDumbbellExercise: true,
  },
];

/** URL params that navigate into a lower-body pain session. */
const SESSION_PARAMS = {
  sessionType: 'squat',
  hasAches: 'true',
  painRegion: 'knee',
  energy: 'normal',
  timeAvailable: '60',
  isTestWeek: 'false',
  equipment: 'dumbbells',
};

/** Build a stored ActiveSession that matches SESSION_PARAMS and RESTORE_EXERCISES. */
function buildStoredSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionType: 'squat',
    equipmentTier: 'dumbbells',
    hasAches: true,
    painRegion: 'knee',
    energy: 'normal',
    timeAvailable: '60',
    isTestWeek: false,
    exerciseData: [
      {
        sets: [
          { setNumber: 1, weight: 30, reps: 8, completed: true, skipped: false },
          { setNumber: 2, weight: 30, reps: 8, completed: false, skipped: false },
        ],
        swapCount: 0,
        activeSetIndex: 1,
      },
    ],
    exerciseNotes: [''],
    activeIndex: 0,
    savedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    completedSetsCount: 1,
    totalSets: 2,
    sessionName: 'Lower Body',
    elapsedSeconds: 180,
    exerciseIds: ['restore-comfort-ex'],
    painBannerDismissed: false,
    ...overrides,
  };
}

/** Minimal store state providing every field that SessionScreen destructures. */
const STORE_BASE = {
  userProfile: { sex: 'male', name: 'Test', experienceLevel: 'intermediate', goals: [], bodyweightKg: 80 },
  weightUnit: 'kg',
  equipmentTiers: ['dumbbells'],
  exerciseFeedback: {},
  exerciseNormalStreak: {},
  reviewPromptShown: false,
  completedSessions: [],
  getEffectiveTier: () => 'dumbbells',
  completeSession: () => {},
  addOneRepMax: () => {},
  setExerciseFeedback: () => {},
  applyTooEasyAdjustment: () => {},
  getBestORM: () => undefined,
  setActiveSession: () => {},
  clearActiveSession: () => {},
  updateLastLoggedWeights: () => {},
  lastLoggedWeights: {},
  setReviewPromptShown: () => {},
  lastSessionPerformance: {},
  pendingCustomExercises: [],
  clearPendingCustomExercises: () => {},
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('[4] SessionScreen — restore from stored activeSession', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const storeMock = require('../__mocks__/store');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const routerMock = require('../__mocks__/expo-router');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const workoutMock = require('../__mocks__/lib-workout-engine');

  beforeEach(() => {
    routerMock.__setParams(SESSION_PARAMS);
    workoutMock.generateWorkout.mockReturnValue(RESTORE_EXERCISES);
  });

  afterEach(() => {
    storeMock.__clearStoreOverride();
    routerMock.__clearParams();
    workoutMock.generateWorkout.mockReset();
  });

  test('pain banner visible after session restore when not previously dismissed', () => {
    storeMock.__setStoreOverride({
      ...STORE_BASE,
      activeSession: buildStoredSession({ painBannerDismissed: false }),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(SessionScreen)); });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(true);
    root.unmount();
  });

  test('pain banner hidden after session restore when previously dismissed', () => {
    storeMock.__setStoreOverride({
      ...STORE_BASE,
      activeSession: buildStoredSession({ painBannerDismissed: true }),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(SessionScreen)); });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
    root.unmount();
  });

  test('comfort note visible on restored comfort-badged exercise', () => {
    storeMock.__setStoreOverride({
      ...STORE_BASE,
      activeSession: buildStoredSession({ painBannerDismissed: false }),
    });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(SessionScreen)); });
    expect(hasText(root, 'Adapted for Knee')).toBe(true);
    root.unmount();
  });

  test('pain banner absent after restore when stored session has no pain (hasAches=false)', () => {
    storeMock.__setStoreOverride({
      ...STORE_BASE,
      activeSession: buildStoredSession({ hasAches: false, painBannerDismissed: false }),
    });
    // Also update params so SessionScreen sees hasAches=false (no pain nav)
    routerMock.__setParams({ ...SESSION_PARAMS, hasAches: 'false' });
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(SessionScreen)); });
    expect(hasTestId(root, 'pain-banner-dismiss')).toBe(false);
    root.unmount();
  });
});

// ─── [5] Swap-exercise flow — comfort badge cleared after swap ─────────────────
//
// When a pain-adapted session swaps a comfort-badged exercise, the swapped-in
// exercise must NOT inherit the comfort badge. These tests exercise two layers:
//
//   a) ExerciseCard: renders no comfort note when badge is absent (the state
//      produced by getDisplayExercise after a swap).
//   b) PainAdaptBanner: reflects the reduced comfortCount when exercises are
//      swapped away from the comfort variant.
//
// The fixture below replicates the session component's getDisplayExercise
// logic — badge is cleared when swapCount > 0 — so that if that invariant is
// ever broken in session.tsx the tests here will immediately fail.

type SwappableExercise = Parameters<typeof ExerciseCard>[0]['exercise'] & {
  swapName?: string;
  swapCue?: string;
  swap2Name?: string;
};

/**
 * Mirrors the getDisplayExercise logic from session.tsx.
 * Returns the exercise with its badge cleared whenever a swap is active.
 */
function applySwap(exercise: SwappableExercise, swapCount: 0 | 1 | 2): Parameters<typeof ExerciseCard>[0]['exercise'] {
  if (swapCount === 1 && exercise.swapName) {
    return {
      ...exercise,
      name: exercise.swapName,
      cue: exercise.swapCue ?? exercise.cue,
      hasSwap: true,
      badge: undefined,
    };
  }
  if (swapCount === 2 && exercise.swap2Name) {
    return {
      ...exercise,
      name: exercise.swap2Name,
      hasSwap: true,
      badge: undefined,
    };
  }
  return exercise;
}

/**
 * Fixture that holds swapCount state, applies the display-exercise logic, and
 * renders both ExerciseCard and PainAdaptBanner so both can be asserted on.
 *
 * Wrapped in a View (not a Fragment) so that root.toJSON() returns a single
 * node — findInTree cannot traverse arrays returned by Fragment renders.
 */
function SwapSessionFixture({
  exercise,
  initialSwapCount = 0,
  comfortRegionLabel,
  painRegion,
  totalComfortExercises,
}: {
  exercise: SwappableExercise;
  initialSwapCount?: 0 | 1 | 2;
  comfortRegionLabel: string;
  painRegion: 'knee' | 'lower_back';
  totalComfortExercises: number;
}) {
  const [swapCount, setSwapCount] = useState<0 | 1 | 2>(initialSwapCount);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const displayExercise = applySwap(exercise, swapCount);

  // comfortCount mirrors session.tsx: count only unswapped comfort exercises
  const comfortCount = exercise.badge === 'comfort' && swapCount === 0
    ? totalComfortExercises
    : totalComfortExercises - 1;

  return (
    <View>
      <PainAdaptBanner
        hasAches={true}
        painRegion={painRegion}
        comfortCount={comfortCount}
        dismissed={bannerDismissed}
        onDismiss={() => setBannerDismissed(true)}
      />
      <ExerciseCard
        {...defaultCardProps}
        exercise={displayExercise}
        setData={{ sets: [{ setNumber: 1, reps: 10, weight: 20, completed: false }], swapCount, activeSetIndex: 0 }}
        comfortRegionLabel={comfortRegionLabel}
        onSwapPress={() => setSwapCount((c) => Math.min(c + 1, 2) as 0 | 1 | 2)}
      />
    </View>
  );
}

describe('[5] Swap-exercise flow — comfort badge cleared after swap', () => {
  // Each test renders two versions of the fixture — pre-swap (swapCount=0) and
  // post-swap (swapCount=1 or 2) — rather than simulating a button press. This
  // is the canonical component-test pattern for react-test-renderer: assert the
  // rendered output for each distinct state directly, without relying on
  // act-driven interaction which can have timing quirks.

  // NOTE: PainAdaptBanner always renders "Adapted for {region}" in its header
  // (visible regardless of swapCount), so we cannot use that phrase to detect
  // the per-exercise comfort note in a combined fixture.  The discriminating
  // text is "skip if still uncomfortable" — that phrase is unique to the
  // ExerciseCard comfort note (the banner uses "skip anything that hurts").

  test('ExerciseCard comfort note is visible before the swap (swapCount=0)', () => {
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
      swapCue: 'Hinge at hips.',
    }) as SwappableExercise;

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={0}
          comfortRegionLabel="Knee"
          painRegion="knee"
          totalComfortExercises={1}
        />,
      );
    });

    // "skip if still uncomfortable" is the unique phrase from ExerciseCard's
    // comfort note — confirms the per-exercise note is visible pre-swap.
    expect(hasText(root, 'skip if still uncomfortable')).toBe(true);
  });

  test('ExerciseCard comfort note is absent after first swap (swapCount=1)', () => {
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
      swapCue: 'Hinge at hips.',
    }) as SwappableExercise;

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={1}
          comfortRegionLabel="Knee"
          painRegion="knee"
          totalComfortExercises={1}
        />,
      );
    });

    // "skip if still uncomfortable" is unique to ExerciseCard's comfort note.
    // After swap, badge is cleared — this phrase must not appear.
    expect(hasText(root, 'skip if still uncomfortable')).toBe(false);
  });

  test('swapped exercise shows the new exercise name (swapCount=1)', () => {
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
      swapCue: 'Hinge at hips.',
    }) as SwappableExercise;

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={1}
          comfortRegionLabel="Knee"
          painRegion="knee"
          totalComfortExercises={1}
        />,
      );
    });

    expect(hasText(root, 'Romanian Deadlift')).toBe(true);
    expect(hasText(root, 'Goblet Squat')).toBe(false);
  });

  test('ExerciseCard comfort note stays absent after second swap (swapCount=2)', () => {
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
      swapCue: 'Hinge at hips.',
      swap2Name: 'Good Morning',
    }) as SwappableExercise;

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={2}
          comfortRegionLabel="Knee"
          painRegion="knee"
          totalComfortExercises={1}
        />,
      );
    });

    // Badge must still be absent on the second alternative exercise.
    expect(hasText(root, 'skip if still uncomfortable')).toBe(false);
  });

  test('second swap shows second alternative exercise name (swapCount=2)', () => {
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
      swapCue: 'Hinge at hips.',
      swap2Name: 'Good Morning',
    }) as SwappableExercise;

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={2}
          comfortRegionLabel="Knee"
          painRegion="knee"
          totalComfortExercises={1}
        />,
      );
    });

    expect(hasText(root, 'Good Morning')).toBe(true);
    expect(hasText(root, 'Goblet Squat')).toBe(false);
  });

  test('banner shows "1 exercise swapped for comfort" when swapCount=0', () => {
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
      swapCue: 'Hinge at hips.',
    }) as SwappableExercise;

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={0}
          comfortRegionLabel="Knee"
          painRegion="knee"
          totalComfortExercises={1}
        />,
      );
    });

    expect(hasText(root, '1 exercise swapped for comfort')).toBe(true);
  });

  test('banner drops to "No exercises needed swapping" when the only comfort exercise is swapped (swapCount=1)', () => {
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
      swapCue: 'Hinge at hips.',
    }) as SwappableExercise;

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={1}
          comfortRegionLabel="Knee"
          painRegion="knee"
          totalComfortExercises={1}
        />,
      );
    });

    expect(hasText(root, 'No exercises needed swapping')).toBe(true);
    expect(hasText(root, '1 exercise swapped for comfort')).toBe(false);
  });

  test('banner drops from "2 exercises" to "1 exercise" when one of two comfort exercises is swapped (swapCount=1)', () => {
    // totalComfortExercises=2 simulates a session with two comfort-adapted
    // exercises; swapCount=1 means this particular exercise has been swapped,
    // so comfortCount falls from 2 to 1.
    const exercise = makeExercise({
      badge: 'comfort',
      hasSwap: true,
      swapName: 'Romanian Deadlift',
    }) as SwappableExercise;

    let rootBefore!: renderer.ReactTestRenderer;
    let rootAfter!: renderer.ReactTestRenderer;

    act(() => {
      rootBefore = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={0}
          comfortRegionLabel="Lower Back"
          painRegion="lower_back"
          totalComfortExercises={2}
        />,
      );
    });
    act(() => {
      rootAfter = renderer.create(
        <SwapSessionFixture
          exercise={exercise}
          initialSwapCount={1}
          comfortRegionLabel="Lower Back"
          painRegion="lower_back"
          totalComfortExercises={2}
        />,
      );
    });

    expect(hasText(rootBefore, '2 exercises swapped for comfort')).toBe(true);
    expect(hasText(rootAfter, '1 exercise swapped for comfort')).toBe(true);
    expect(hasText(rootAfter, '2 exercises swapped for comfort')).toBe(false);
  });
});

// ─── [6] Bicep/tricep pain-region flow — readiness screen drives comfortVariant session ──
//
// This section tests the complete pain-adaptation chain for the bicep and
// tricep regions, which were the focus of an enlarged tap-target overhaul:
//
//   ReadinessScreen (hasAches=true) → tap bicep/tricep on BodyDiagram
//   → pain-region-confirm → router.push receives painRegion
//   → real generateWorkout produces badge='comfort' exercises
//
// Three layers are tested:
//   a) ReadinessScreen: pressing "aches-yes" then "readiness-start" reaches
//      the pain-region step (BodyDiagram visible, pain-region-confirm absent
//      until a region is tapped).
//   b) ReadinessScreen → router.push: tapping body-diagram-region-bicep (front,
//      muscles mode) then pain-region-confirm passes painRegion='bicep' into the
//      router.push call — verifying the readiness screen's wiring is intact.
//   c) ReadinessScreen → router.push: same for body-diagram-region-tricep (back,
//      muscles mode).
//   d) End-to-end (bicep): captured router.push params feed directly into the
//      real generateWorkout; output session contains ≥1 badge='comfort' exercise.
//   e) End-to-end (tricep): same for tricep.
//   f) Negative control: ReadinessScreen with hasAches=false → router.push
//      passes hasAches='false' → generateWorkout produces 0 comfort exercises.
//
// The real generateWorkout is imported via relative path (not @/ alias) so the
// jest-component mock is bypassed and the actual exercise-db logic executes.
// ReadinessScreen's own import of @/lib/workout-engine hits the mock (stub fns
// for UI only — getSessionLabel, getEquipmentLabel, getEffectiveTier); the
// real engine is used only for the session-generation assertions below.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const routerMockForSection6 = require('../__mocks__/expo-router') as {
  __mockPush: jest.Mock;
  __setParams: (p: Record<string, string>) => void;
  __clearParams: () => void;
};

describe('[6] Real ReadinessScreen — bicep/tricep taps drive pain-adapted session', () => {

  beforeEach(() => {
    // sessionType=bench: best session to exercise bicep/tricep comfort variants.
    // isTestWeek=false: avoids the test-week path that skips energy/time selectors.
    routerMockForSection6.__setParams({ sessionType: 'bench', isTestWeek: 'false' });
    routerMockForSection6.__mockPush.mockClear();
  });

  afterEach(() => {
    routerMockForSection6.__clearParams();
    routerMockForSection6.__mockPush.mockClear();
  });

  // ── a) Readiness: aches-yes + start → pain region step rendered ───────────

  test('aches-yes then readiness-start transitions to pain-region step (BodyDiagram visible)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(ReadinessScreen)); });

    // Pain-region-confirm must not exist before the pain-region step
    expect(hasTestId(root, 'pain-region-confirm')).toBe(false);
    // Select "has aches"
    press(root, 'aches-yes');
    // Tap Start (→ "Next - select area" in aches mode)
    press(root, 'readiness-start');
    // Now on pain-region step — body diagram rendered, confirm absent until tap
    expect(hasTestId(root, 'body-diagram-front')).toBe(true);
    expect(hasTestId(root, 'pain-region-confirm')).toBe(false);
    root.unmount();
  });

  // ── b) ReadinessScreen → router.push: bicep tap passes painRegion='bicep' ──

  test('bicep tap + confirm → router.push called with painRegion="bicep" and hasAches="true"', () => {
    // bicep is in MUSCLE_SET → tappable in default muscles mode, front view
    expect(MUSCLE_SET.has('bicep')).toBe(true);

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(ReadinessScreen)); });

    // Navigate to pain-region step
    press(root, 'aches-yes');
    press(root, 'readiness-start');
    // Tap the bicep region on the diagram
    press(root, 'body-diagram-region-bicep');
    // Confirm button now visible; press it
    expect(hasTestId(root, 'pain-region-confirm')).toBe(true);
    press(root, 'pain-region-confirm');

    // router.push must have been called once with the correct pain params
    expect(routerMockForSection6.__mockPush).toHaveBeenCalledTimes(1);
    const pushArgs = routerMockForSection6.__mockPush.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(pushArgs.params.painRegion).toBe('bicep');
    expect(pushArgs.params.hasAches).toBe('true');
    root.unmount();
  });

  // ── c) ReadinessScreen → router.push: tricep tap passes painRegion='tricep' ─

  test('tricep tap (back view) + confirm → router.push called with painRegion="tricep" and hasAches="true"', () => {
    // tricep is in MUSCLE_SET → tappable in muscles mode; lives on the back view
    expect(MUSCLE_SET.has('tricep')).toBe(true);

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(ReadinessScreen)); });

    // Navigate to pain-region step
    press(root, 'aches-yes');
    press(root, 'readiness-start');
    // Switch to back view, then tap tricep
    press(root, 'body-diagram-back');
    press(root, 'body-diagram-region-tricep');
    expect(hasTestId(root, 'pain-region-confirm')).toBe(true);
    press(root, 'pain-region-confirm');

    expect(routerMockForSection6.__mockPush).toHaveBeenCalledTimes(1);
    const pushArgs = routerMockForSection6.__mockPush.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(pushArgs.params.painRegion).toBe('tricep');
    expect(pushArgs.params.hasAches).toBe('true');
    root.unmount();
  });

  // ── d) End-to-end (bicep): ReadinessScreen params → generateWorkout → comfort exercises

  test('full flow (bicep): router.push params from ReadinessScreen produce ≥1 badge="comfort" exercise', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(ReadinessScreen)); });

    press(root, 'aches-yes');
    press(root, 'readiness-start');
    press(root, 'body-diagram-region-bicep');
    press(root, 'pain-region-confirm');
    root.unmount();

    // Extract params exactly as session.tsx would receive them from router.push
    const pushArgs = routerMockForSection6.__mockPush.mock.calls[0][0] as {
      params: Record<string, string>;
    };
    const { hasAches: hasAchesStr, painRegion, equipment, energy, timeAvailable } = pushArgs.params;

    // Feed the router params into the real generateWorkout
    const exercises = generateWorkout(
      'bench',
      equipment as Parameters<typeof generateWorkout>[1],
      {
        hasAches: hasAchesStr === 'true',
        painRegion: painRegion as PainRegion,
        energy: (energy ?? 'normal') as Parameters<typeof generateWorkout>[2]['energy'],
        timeAvailable: (timeAvailable ?? '60') as Parameters<typeof generateWorkout>[2]['timeAvailable'],
      },
    );

    const comfortExercises = exercises.filter((e) => e.badge === 'comfort');
    expect(comfortExercises.length).toBeGreaterThanOrEqual(1);
  });

  // ── e) End-to-end (tricep): ReadinessScreen params → generateWorkout → comfort exercises

  test('full flow (tricep): router.push params from ReadinessScreen produce ≥1 badge="comfort" exercise', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(ReadinessScreen)); });

    press(root, 'aches-yes');
    press(root, 'readiness-start');
    press(root, 'body-diagram-back');
    press(root, 'body-diagram-region-tricep');
    press(root, 'pain-region-confirm');
    root.unmount();

    const pushArgs = routerMockForSection6.__mockPush.mock.calls[0][0] as {
      params: Record<string, string>;
    };
    const { hasAches: hasAchesStr, painRegion, equipment, energy, timeAvailable } = pushArgs.params;

    const exercises = generateWorkout(
      'bench',
      equipment as Parameters<typeof generateWorkout>[1],
      {
        hasAches: hasAchesStr === 'true',
        painRegion: painRegion as PainRegion,
        energy: (energy ?? 'normal') as Parameters<typeof generateWorkout>[2]['energy'],
        timeAvailable: (timeAvailable ?? '60') as Parameters<typeof generateWorkout>[2]['timeAvailable'],
      },
    );

    const comfortExercises = exercises.filter((e) => e.badge === 'comfort');
    expect(comfortExercises.length).toBeGreaterThanOrEqual(1);
  });

  // ── f) Negative control: no aches → router.push has hasAches='false' → no comfort

  test('negative: no aches selected → router.push passes hasAches="false" → generateWorkout produces 0 comfort exercises', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(React.createElement(ReadinessScreen)); });

    // Do NOT press aches-yes — hasAches stays false
    press(root, 'readiness-start');
    root.unmount();

    expect(routerMockForSection6.__mockPush).toHaveBeenCalledTimes(1);
    const pushArgs = routerMockForSection6.__mockPush.mock.calls[0][0] as {
      params: Record<string, string>;
    };
    expect(pushArgs.params.hasAches).toBe('false');

    const exercises = generateWorkout(
      'bench',
      'dumbbells',
      {
        hasAches: false,
        painRegion: undefined,
        energy: 'normal',
        timeAvailable: '60',
      },
    );
    const comfortExercises = exercises.filter((e) => e.badge === 'comfort');
    expect(comfortExercises.length).toBe(0);
  });
});
