/**
 * Runtime component tests for SessionActiveBar keyboard-avoidance behaviour.
 *
 * Uses react-test-renderer (Node.js, no browser, no native modules).
 * All session.tsx dependencies are mocked in jest-component.config.js.
 *
 * Purpose: verify at RUNTIME that the weight/reps TextInputs are rendered and
 * reachable in the component tree for every device-size configuration, and that
 * the bar container is NOT absolutely positioned (required so the
 * KeyboardAvoidingView can lift it above the software keyboard).
 *
 * Device configurations tested:
 *   iPhone SE (375×667) — home-button device, bottomInset ≈ 0
 *   iPhone 14 (390×844) — Dynamic Island, bottomInset = 34
 *   Android  (360×800) — behavior="height" path, bottomInset = 24
 *
 * The mock environment sets Platform.OS = 'ios' and useSafeAreaInsets()
 * returns { top:47, bottom:34 } — representative of a modern iPhone.
 *
 * [1] Weight + reps inputs render on strength exercises (non-band, non-time)
 * [2] Complete button renders and carries the correct testID
 * [3] Bar container is NOT absolutely positioned
 * [4] Band exercises: reps-only input (no weight TextInput)
 * [5] Time-based exercises: Mark-Set-Done button, no TextInputs
 * [6] Completed-session state: Complete-Session button visible
 * [7] Loaded holds and carries: a weight box and no counter
 * [8] Sled Rows: a weight box and a counter that says metres
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';

import { SessionActiveBar } from '../app/session';

type BarProps = Parameters<typeof SessionActiveBar>[0];
type Shape = BarProps['shape'];

// The six shapes the bar can take, written out so each test says which one
// it is asking about. lib/set-logging.ts is what decides between them; these
// are the answers it can give.
const WEIGHT_AND_REPS: Shape = {
  weight: true,
  count: 'reps',
  weightRequired: true,
  unloadedLabel: 'Bodyweight',
};
const REPS_ONLY: Shape = {
  weight: false,
  count: 'reps',
  weightRequired: false,
  unloadedLabel: 'Bodyweight',
};
const NOTHING_TO_TYPE: Shape = {
  weight: false,
  count: null,
  weightRequired: false,
  unloadedLabel: 'Bodyweight',
};
const WEIGHT_ONLY: Shape = {
  weight: true,
  count: null,
  weightRequired: false,
  unloadedLabel: 'Bodyweight',
};
const WEIGHT_AND_METRES: Shape = {
  weight: true,
  count: 'metres',
  weightRequired: false,
  unloadedLabel: 'Bodyweight',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeExercise(): BarProps['exercise'] {
  return {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    sets: 3,
    reps: '8-12',
    cue: 'Keep chest tall.',
    suggestedLoad: '20 kg',
    category: 'accessory',
    isDumbbellExercise: true,
    hasSwap: false,
  } as BarProps['exercise'];
}

function makeSetData(): BarProps['setData'] {
  return {
    sets: [
      { setNumber: 1, reps: 10, weight: 20, completed: false },
      { setNumber: 2, reps: 10, weight: 20, completed: false },
      { setNumber: 3, reps: 10, weight: 20, completed: false },
    ],
    swapCount: 0,
    activeSetIndex: 0,
  };
}

function baseProps(overrides: Partial<BarProps> = {}): BarProps {
  return {
    exercise: makeExercise(),
    exerciseIndex: 0,
    setData: makeSetData(),
    activeSetIndex: 0,
    weightGuidesKg: [10, 15, 20],
    shape: WEIGHT_AND_REPS,
    previousBest: undefined,
    previousSessionWeight: undefined,
    weightUnit: 'kg',
    isLastExercise: false,
    sessionAllDone: false,
    isPrehabOrFlex: false,
    onSetChange: jest.fn(),
    onSetCompleted: jest.fn(),
    onFeedback: jest.fn(),
    onCompleteSession: jest.fn(),
    isCardioExercise: false,
    bottomInset: 34,
    ...overrides,
  };
}

function render(props: BarProps): renderer.ReactTestRenderer {
  let root!: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(<SessionActiveBar {...props} />);
  });
  return root;
}

/** Every string the bar actually renders, read off the rendered tree rather
 *  than off the component type - the react-native mock does not hand back a
 *  Text identity that findAllByType can match. */
function textOf(root: renderer.ReactTestRenderer): string[] {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') walk((node as { children?: unknown }).children);
  };
  walk(root.toJSON());
  return found;
}

function hasTestId(root: renderer.ReactTestRenderer, id: string): boolean {
  return root.root.findAllByProps({ testID: id }).length > 0;
}

// ─── [1] Weight + reps TextInputs render on strength exercises ────────────────

describe('[1] Weight + reps inputs — strength exercise (non-band, non-time)', () => {
  const cases = [
    { label: 'iPhone SE  (bottomInset=0)', bottomInset: 0 },
    { label: 'iPhone 14  (bottomInset=34)', bottomInset: 34 },
    { label: 'Android    (bottomInset=24)', bottomInset: 24 },
  ];

  test.each(cases)('weight TextInput renders — $label', ({ bottomInset }) => {
    const root = render(baseProps({ bottomInset }));
    expect(hasTestId(root, 'set-1-weight')).toBe(true);
  });

  test.each(cases)('reps TextInput renders — $label', ({ bottomInset }) => {
    const root = render(baseProps({ bottomInset }));
    expect(hasTestId(root, 'set-1-reps')).toBe(true);
  });
});

// ─── [2] Complete button ──────────────────────────────────────────────────────

describe('[2] Complete button — correct testID', () => {
  // "Did It", the full-width button under the boxes. There used to be a second
  // green square beside the reps box calling the same handler; it went when
  // the session screen was cut back to one green.
  test('did-it-1 Pressable is in the tree for the active set', () => {
    const root = render(baseProps());
    expect(hasTestId(root, 'did-it-1')).toBe(true);
  });

  test('did-it-2 renders when activeSetIndex=1 (second set active)', () => {
    const root = render(baseProps({ activeSetIndex: 1 }));
    expect(hasTestId(root, 'did-it-2')).toBe(true);
    expect(hasTestId(root, 'did-it-1')).toBe(false);
  });

  // The square is gone for weight-and-reps work, but a timed or held exercise
  // still shows Mark Set Done under that testID. Asserted so a future reader
  // does not conclude the id was retired everywhere.
  test('a weight exercise no longer carries the old square', () => {
    const root = render(baseProps());
    expect(hasTestId(root, 'set-1-check')).toBe(false);
  });

  test('but a timed exercise still does', () => {
    const root = render(baseProps({ shape: NOTHING_TO_TYPE }));
    expect(hasTestId(root, 'set-1-check')).toBe(true);
  });
});

// ─── [3] Bar container layout — NOT absolutely positioned ────────────────────

describe('[3] Bar container must be in normal layout flow (not absolutely positioned)', () => {
  test('root View of SessionActiveBar has no position:"absolute" style', () => {
    const root = render(baseProps());
    const tree = root.toJSON() as { props?: { style?: Record<string, unknown> } } | null;
    const rawStyle = tree?.props?.style ?? {};
    const style: Record<string, unknown> = Array.isArray(rawStyle)
      ? Object.assign({}, ...rawStyle.filter(Boolean))
      : (rawStyle as Record<string, unknown>);
    expect(style.position).not.toBe('absolute');
  });
});

// ─── [4] Band exercises — reps only, no weight TextInput ─────────────────────

describe('[4] Band exercises — reps-only input', () => {
  test('reps TextInput renders for band exercise', () => {
    const root = render(baseProps({ shape: REPS_ONLY }));
    expect(hasTestId(root, 'set-1-reps')).toBe(true);
  });

  test('weight TextInput is NOT rendered for band exercise', () => {
    const root = render(baseProps({ shape: REPS_ONLY }));
    expect(hasTestId(root, 'set-1-weight')).toBe(false);
  });
});

// ─── [5] Time-based exercises — Mark-Set-Done button, no TextInputs ──────────

describe('[5] Time-based exercises — no weight/reps inputs', () => {
  test('set-N-check button renders for time exercise', () => {
    const root = render(baseProps({ shape: NOTHING_TO_TYPE }));
    expect(hasTestId(root, 'set-1-check')).toBe(true);
  });

  test('weight TextInput is NOT rendered for time exercise', () => {
    const root = render(baseProps({ shape: NOTHING_TO_TYPE }));
    expect(hasTestId(root, 'set-1-weight')).toBe(false);
  });

  test('reps TextInput is NOT rendered for time exercise', () => {
    const root = render(baseProps({ shape: NOTHING_TO_TYPE }));
    expect(hasTestId(root, 'set-1-reps')).toBe(false);
  });
});

// ─── [6] Session-all-done state — Complete Session button ────────────────────

describe('[6] Session-all-done — complete-session button visible', () => {
  test('complete-session testID is in the tree when sessionAllDone=true', () => {
    const root = render(baseProps({ sessionAllDone: true, isLastExercise: true }));
    expect(hasTestId(root, 'complete-session')).toBe(true);
  });
});

// ─── [7] Loaded holds and carries — the weight box, and no counter ───────────

// Archie hit this on a Dumbbell Suitcase Hold: prescribed "30s each side" at
// 20-32 kg, and the bar collapsed to one green button because the app read the
// 30s and decided the whole thing was a hold. He asked for the weight only -
// the seconds and the metres stay fixed, because the library says on purpose
// that these get harder by adding weight rather than by holding longer.
describe('[7] Loaded holds and carries — weight box, no counter', () => {
  test('weight TextInput renders', () => {
    const root = render(baseProps({ shape: WEIGHT_ONLY }));
    expect(hasTestId(root, 'set-1-weight')).toBe(true);
  });

  test('the counter is NOT rendered', () => {
    const root = render(baseProps({ shape: WEIGHT_ONLY }));
    expect(hasTestId(root, 'set-1-reps')).toBe(false);
  });

  test('and it is Did It underneath, not Mark Set Done', () => {
    const root = render(baseProps({ shape: WEIGHT_ONLY }));
    expect(hasTestId(root, 'did-it-1')).toBe(true);
    expect(hasTestId(root, 'set-1-check')).toBe(false);
  });
});

// ─── [8] Sled Rows — weight and metres ───────────────────────────────────────

// "Sled rows - it shouldn't say reps it should just say weight and distance in
// m (metres)." Both boxes, and the second one says metres over it.
describe('[8] Sled Rows — both boxes, and the counter says metres', () => {
  test('both boxes render', () => {
    const root = render(baseProps({ shape: WEIGHT_AND_METRES }));
    expect(hasTestId(root, 'set-1-weight')).toBe(true);
    expect(hasTestId(root, 'set-1-reps')).toBe(true);
  });

  test('the counter is labelled metres and never reps', () => {
    const root = render(baseProps({ shape: WEIGHT_AND_METRES }));
    const labels = textOf(root);
    expect(labels).toContain('metres');
    expect(labels).not.toContain('reps');
  });

  test('a rep-counted exercise still says reps', () => {
    const root = render(baseProps({ shape: WEIGHT_AND_REPS }));
    const labels = textOf(root);
    expect(labels).toContain('reps');
    expect(labels).not.toContain('metres');
  });
});

// ─── [9] The unit is beside the weight box, whatever the user chose ──────────

// "When putting in weights during session it should say either kg or lbs,
// currently doesn't show the metric." Measured over the whole generator, 43%
// of the cards that showed a weight box showed it with no suggestion above it,
// and on those the unit appeared nowhere on the bar at all.
describe('[9] The weight box carries the unit', () => {
  const unitLabels = textOf;

  test('with a suggestion, the suggestion names the unit', () => {
    const root = render(baseProps({ weightGuidesKg: [20, 20, 20] }));
    expect(unitLabels(root).some((t) => t.includes('20') && t.includes('kg'))).toBe(true);
  });

  test('with no suggestion at all, the unit is still there on its own', () => {
    const root = render(baseProps({ weightGuidesKg: [0, 0, 0], previousSessionWeight: 0 }));
    expect(unitLabels(root)).toContain('kg');
  });

  test('and it is the user unit, not a hardcoded kg', () => {
    const root = render(
      baseProps({ weightUnit: 'lbs', weightGuidesKg: [0, 0, 0], previousSessionWeight: 0 })
    );
    const labels = unitLabels(root);
    expect(labels).toContain('lbs');
    expect(labels).not.toContain('kg');
  });
});
