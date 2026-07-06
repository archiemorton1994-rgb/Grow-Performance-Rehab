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
 */

import React, { useState } from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';

// Both components and SessionScreen (default export) are exported from session.tsx
// for testability. All session.tsx dependencies are mapped in jest-component.config.js.
import SessionScreen, { PainAdaptBanner, ExerciseCard } from '../app/session';

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
    hasSwap: false,
    isDumbbellExercise: false,
  };
}

/** Minimal ExerciseSetData satisfying the interface. */
function makeSetData(): Parameters<typeof ExerciseCard>[0]['setData'] {
  return {
    sets: [{ reps: 10, weight: 20, completed: false }],
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
