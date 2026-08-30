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
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';

import { SessionActiveBar } from '../app/session';

type BarProps = Parameters<typeof SessionActiveBar>[0];

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
    isBandExercise: false,
    isTimeExercise: false,
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
    const root = render(baseProps({ isTimeExercise: true }));
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
    const root = render(baseProps({ isBandExercise: true }));
    expect(hasTestId(root, 'set-1-reps')).toBe(true);
  });

  test('weight TextInput is NOT rendered for band exercise', () => {
    const root = render(baseProps({ isBandExercise: true }));
    expect(hasTestId(root, 'set-1-weight')).toBe(false);
  });
});

// ─── [5] Time-based exercises — Mark-Set-Done button, no TextInputs ──────────

describe('[5] Time-based exercises — no weight/reps inputs', () => {
  test('set-N-check button renders for time exercise', () => {
    const root = render(baseProps({ isTimeExercise: true }));
    expect(hasTestId(root, 'set-1-check')).toBe(true);
  });

  test('weight TextInput is NOT rendered for time exercise', () => {
    const root = render(baseProps({ isTimeExercise: true }));
    expect(hasTestId(root, 'set-1-weight')).toBe(false);
  });

  test('reps TextInput is NOT rendered for time exercise', () => {
    const root = render(baseProps({ isTimeExercise: true }));
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
