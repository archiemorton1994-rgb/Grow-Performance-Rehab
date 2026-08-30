/**
 * Runtime component test: a set rating is filed against the exercise it was
 * given for, not the one that happens to be on screen when it is answered.
 *
 * THE BUG THIS REPRODUCES
 * ───────────────────────
 * Completing the last set of an exercise advances the session immediately, so
 * the parent re-renders this bar with the NEXT exercise while the "how did it
 * feel?" prompt is still open. The prompt used to read `exercise.id` live at
 * the moment an answer was tapped, so the answer was filed against the next
 * exercise. Measured in the app: an "Easy" for a Back Squat's final set was
 * saved against the accessory that followed it.
 *
 * It is the final set that matters most — warm-up answers no longer count
 * toward the "easy" tally, so on a ramped main lift the working set is the only
 * set that can produce a rating at all.
 *
 * The second case here covers the session's very last set, where the bar used
 * to return the "Complete Session" button before it ever drew the prompt.
 *
 * Uses react-test-renderer via jest-component.config.js, same as
 * session-bar-kav.test.tsx.
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';

import { SessionActiveBar } from '../app/session';

type BarProps = Parameters<typeof SessionActiveBar>[0];

const ANSWERED = 'squat-main';
const NEXT_UP = 'accessory-after';

function makeExercise(id: string, name: string): BarProps['exercise'] {
  return {
    id,
    name,
    sets: 2,
    reps: '5',
    cue: 'Brace and drive.',
    suggestedLoad: '60 kg',
    category: 'accessory',
    isDumbbellExercise: false,
    hasSwap: false,
  } as BarProps['exercise'];
}

function makeSetData(activeSetIndex: number): BarProps['setData'] {
  return {
    sets: [
      { setNumber: 1, reps: 5, weight: 60, completed: activeSetIndex > 0 },
      { setNumber: 2, reps: 5, weight: 60, completed: false },
    ],
    swapCount: 0,
    activeSetIndex,
  };
}

function baseProps(overrides: Partial<BarProps> = {}): BarProps {
  return {
    exercise: makeExercise(ANSWERED, 'Back Squat'),
    exerciseIndex: 0,
    setData: makeSetData(1),
    activeSetIndex: 1,
    weightGuidesKg: [40, 60],
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

function pressById(root: renderer.ReactTestRenderer, testID: string) {
  const target = root.root.findAllByProps({ testID })[0];
  const onPress = target.props.onPress as () => void;
  act(() => {
    onPress();
  });
}

/** react-test-renderer's shipped types omit `update`, which exists at runtime. */
function rerender(root: renderer.ReactTestRenderer, element: React.ReactElement) {
  act(() => {
    (root as unknown as { update: (e: React.ReactElement) => void }).update(element);
  });
}

function hasTestId(root: renderer.ReactTestRenderer, id: string): boolean {
  return root.root.findAllByProps({ testID: id }).length > 0;
}

describe('a rating lands on the exercise the set belonged to', () => {
  test('answering after the session has advanced still credits the finished exercise', () => {
    const onFeedback = jest.fn();
    const props = baseProps({ onFeedback });

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<SessionActiveBar {...props} />);
    });

    // Finish the LAST set of the answered exercise. This is what raises the prompt.
    pressById(root, 'did-it-2');
    expect(hasTestId(root, 'feedback-easy')).toBe(true);

    // The parent advances to the next exercise while the prompt is still open —
    // exactly what the real screen does on a final set.
    rerender(
      root,
      <SessionActiveBar
        {...props}
        exercise={makeExercise(NEXT_UP, 'DB Romanian Deadlift')}
        exerciseIndex={1}
        setData={makeSetData(0)}
        activeSetIndex={0}
      />
    );

    // Only now does the user tap an answer.
    pressById(root, 'feedback-easy');

    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback.mock.calls[0][0]).toBe(ANSWERED);
    expect(onFeedback.mock.calls[0][0]).not.toBe(NEXT_UP);
  });

  test('the set index reported is the one that was logged, not the new active set', () => {
    const onFeedback = jest.fn();
    const props = baseProps({ onFeedback });

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<SessionActiveBar {...props} />);
    });
    pressById(root, 'did-it-2');
    rerender(
      root,
      <SessionActiveBar
        {...props}
        exercise={makeExercise(NEXT_UP, 'DB Romanian Deadlift')}
        exerciseIndex={1}
        setData={makeSetData(0)}
        activeSetIndex={0}
      />
    );
    pressById(root, 'feedback-easy');

    // Set 2 (index 1) was the one completed; the bar had moved to index 0.
    expect(onFeedback.mock.calls[0][1]).toBe(1);
  });
});

describe('the final set of the whole session still gets asked', () => {
  test('an open prompt outranks the Complete Session button', () => {
    const onFeedback = jest.fn();
    const props = baseProps({ onFeedback });

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<SessionActiveBar {...props} />);
    });

    pressById(root, 'did-it-2');

    // Everything is now done — the parent flips sessionAllDone on.
    rerender(root, <SessionActiveBar {...props} sessionAllDone isLastExercise />);

    expect(hasTestId(root, 'feedback-easy')).toBe(true);
    expect(hasTestId(root, 'complete-session')).toBe(false);

    pressById(root, 'feedback-easy');
    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback.mock.calls[0][0]).toBe(ANSWERED);

    // Once answered, the finish button takes over.
    expect(hasTestId(root, 'complete-session')).toBe(true);
  });
});
