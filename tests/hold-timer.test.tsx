/**
 * Runtime component test: the counter on the card, and the buzz at the end of it.
 *
 * WHY THIS FILE EXISTS ALONGSIDE tests/hold-timer.check.mjs
 * ────────────────────────────────────────────────────────
 * That file drives the RULES - which cards get a clock, how long it runs, when
 * each alert belongs. It imports lib/hold-timer.ts and never touches the screen,
 * because a node check cannot import a React Native component.
 *
 * Everything between those rules and the person holding the phone was therefore
 * going to be "verified by reading": that the card mounts stopped rather than
 * running, that a press is what starts it, that a second of real time moves the
 * digits, and above all that the vibration is actually CALLED. The recon found
 * that no test anywhere in this repo asserts a haptic - zero hits for "haptic"
 * or "vibrat" across every check and the whole jest suite - so a vibration that
 * stopped working would not have been caught by anything.
 *
 * It is caught here. react-test-renderer runs the real component, expo-haptics
 * is a recording double, and jest's fake clock lets thirty seconds pass in a
 * millisecond. So the claim "it buzzes at three seconds and again at zero" is
 * something that ran, not something that was read.
 *
 * WHAT IS STILL NOT PROVED BY ANY TEST, SAID PLAINLY
 * ─────────────────────────────────────────────────
 * That the phone in somebody's hand physically vibrates. This asserts that Grow
 * asks it to, with which strength, and at which second. The step from
 * `Haptics.impactAsync` to a motor is expo-haptics' to keep.
 *
 *  [1] it mounts STOPPED, and nothing starts it but a press
 *  [2] a press starts it, and the digits count DOWN
 *  [3] the buzz: light at three seconds out, heavy and distinct at zero
 *  [4] "each side" stops at the swap and waits to be pressed again
 *  [5] a logged set arms the next one without starting it
 */

import React, { act } from 'react';
import renderer from 'react-test-renderer';
import * as Haptics from 'expo-haptics';

import { HoldTimer } from '../app/session';
import { holdClockFor, type HoldClock } from '../lib/hold-timer';

/**
 * A recording double, rather than the shared one in __mocks__/expo-haptics.js.
 *
 * Isolated to this file on purpose: the shared mock's functions return a
 * resolved promise and remember nothing, and giving it a memory would leave
 * every other suite sharing a counter nobody resets. babel-jest hoists this
 * above the imports, which is why it can sit below them and still take effect.
 */
jest.mock('expo-haptics', () => {
  const buzzes: string[] = [];
  return {
    __buzzes: buzzes,
    impactAsync: (style: string) => {
      buzzes.push(`impact:${style}`);
      return Promise.resolve();
    },
    notificationAsync: (type: string) => {
      buzzes.push(`notify:${type}`);
      return Promise.resolve();
    },
    selectionAsync: () => {
      buzzes.push('selection');
      return Promise.resolve();
    },
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
    NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
  };
});

const buzzes = (Haptics as unknown as { __buzzes: string[] }).__buzzes;

/** Only the alert buzzes. The light tap that acknowledges the press is not one. */
const alerts = () => buzzes.filter((b) => b !== 'selection');

/** `update` is on the renderer at runtime; the shipped types have lost it. */
type Tree = renderer.ReactTestRenderer & { update: (el: React.ReactElement) => void };

const START = 1_700_000_000_000;

/** Every string the card is currently drawing, joined. */
function words(tree: Tree): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') walk((node as { children?: unknown }).children);
  };
  walk(tree.toJSON());
  return out.join(' ');
}

function pressTheTimer(tree: Tree) {
  const found = tree.root.findAllByProps({ testID: 'hold-timer' });
  if (found.length === 0) throw new Error('the timer button is not on the card');
  const onPress = found[0].props.onPress as () => void;
  act(() => {
    onPress();
  });
}

/** Let `seconds` of real time pass, one tick at a time, as the interval would. */
function letTimePass(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
}

function clockOf(reps: string): HoldClock {
  const clock = holdClockFor(reps);
  if (!clock) throw new Error(`"${reps}" has no clock, so there is nothing to render`);
  return clock;
}

function render(clock: HoldClock, setsLogged = 0): Tree {
  let tree!: Tree;
  act(() => {
    tree = renderer.create(<HoldTimer clock={clock} setsLogged={setsLogged} />) as Tree;
  });
  return tree;
}

const mount = (reps: string) => render(clockOf(reps));

beforeEach(() => {
  buzzes.length = 0;
  jest.useFakeTimers();
  jest.setSystemTime(START);
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── [1] It mounts stopped ───────────────────────────────────────────────────

describe('[1] the counter mounts stopped, and only a press starts it', () => {
  test('a 30 second hold shows the full length and the word Start', () => {
    const tree = mount('30s');
    expect(words(tree)).toContain('Start the timer - 00:30');
  });

  test('forty seconds pass with nobody pressing and it has not moved or buzzed', () => {
    // This is the bug the phase exists for. The counter it replaces was created
    // with isRunning already true, so on the first card of a session it began
    // while the plan screen was still on top and could finish, and buzz, before
    // the person pressed Start. Forty seconds is longer than the hold.
    const tree = mount('30s');
    letTimePass(40);
    expect(words(tree)).toContain('Start the timer - 00:30');
    expect(alerts()).toEqual([]);
  });

  test('and that is true of the cardio warm-up, which is the one that did it', () => {
    const tree = mount('3 min');
    expect(words(tree)).toContain('Start the timer - 03:00');
    letTimePass(200);
    expect(words(tree)).toContain('Start the timer - 03:00');
    expect(alerts()).toEqual([]);
  });
});

// ─── [2] A press starts it, counting down ───────────────────────────────────

describe('[2] a press starts it and the digits count down', () => {
  test('one second of real time takes one second off the card', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    expect(words(tree)).toContain('00:30');
    letTimePass(1);
    expect(words(tree)).toContain('00:29');
    letTimePass(19);
    expect(words(tree)).toContain('00:10');
  });

  test('a second press pauses it, and the seconds already served are kept', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(10);
    pressTheTimer(tree);
    expect(words(tree)).toContain('Paused - 00:20');
    // Twenty seconds of being paused must not take the hold down to zero.
    letTimePass(20);
    expect(words(tree)).toContain('Paused - 00:20');
    pressTheTimer(tree);
    letTimePass(1);
    expect(words(tree)).toContain('00:19');
  });

  test('it says the time is up rather than sitting at 00:00', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(30);
    expect(words(tree)).toContain('Time is up');
  });
});

// ─── [3] The buzz ───────────────────────────────────────────────────────────

describe('[3] it buzzes three seconds out and again at zero', () => {
  test('nothing buzzes on the way down until three seconds are left', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(26);
    expect(words(tree)).toContain('00:04');
    expect(alerts()).toEqual([]);
  });

  test('a short light buzz as it reaches three, and not again on the way past', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(27);
    expect(words(tree)).toContain('00:03');
    expect(alerts()).toEqual(['impact:Light']);
    letTimePass(2);
    expect(words(tree)).toContain('00:01');
    expect(alerts()).toEqual(['impact:Light']);
  });

  test('and a distinct, heavier one at zero', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(30);
    // Heavy plus the success pattern: the same alert both existing timers used
    // at zero, and clearly different from the single light tap at three.
    expect(alerts()).toEqual(['impact:Light', 'impact:Heavy', 'notify:Success']);
  });

  test('a finished counter does not carry on buzzing', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(30);
    const atZero = [...alerts()];
    letTimePass(30);
    expect(alerts()).toEqual(atZero);
  });

  test('a pause and a resume inside the last three seconds does not buzz twice', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(28);
    expect(alerts()).toEqual(['impact:Light']);
    pressTheTimer(tree); // pause, with 2 seconds left
    letTimePass(5);
    pressTheTimer(tree); // carry on
    letTimePass(2);
    expect(alerts()).toEqual(['impact:Light', 'impact:Heavy', 'notify:Success']);
  });
});

// ─── [4] Each side ──────────────────────────────────────────────────────────

describe('[4] an each-side hold stops at the swap and waits', () => {
  test('the first side ends, it buzzes, and the card asks them to swap', () => {
    const tree = mount('30s each side');
    pressTheTimer(tree);
    letTimePass(30);
    expect(words(tree)).toContain('Swap sides, then start - 00:30');
    expect(words(tree)).toContain('2 of 2');
    expect(alerts()).toEqual(['impact:Light', 'impact:Heavy', 'notify:Success']);
  });

  test('and then it WAITS: a minute of waiting times nothing', () => {
    // The clinical point. Timing a side before the person has swapped to it
    // would credit them with a side they have not done.
    const tree = mount('30s each side');
    pressTheTimer(tree);
    letTimePass(30);
    const atSwap = [...alerts()];
    letTimePass(60);
    expect(words(tree)).toContain('Swap sides, then start - 00:30');
    expect(alerts()).toEqual(atSwap);
  });

  test('the second press runs the second side, and only then is the set done', () => {
    const tree = mount('30s each side');
    pressTheTimer(tree);
    letTimePass(30);
    pressTheTimer(tree);
    letTimePass(29);
    expect(words(tree)).toContain('00:01');
    letTimePass(1);
    expect(words(tree)).toContain('Time is up');
    expect(words(tree)).toContain('all 2 done');
    // One warning and one end per side: six calls for two sides.
    expect(alerts()).toEqual([
      'impact:Light',
      'impact:Heavy',
      'notify:Success',
      'impact:Light',
      'impact:Heavy',
      'notify:Success',
    ]);
  });

  test('a one-sided hold never asks anybody to swap', () => {
    const tree = mount('30s');
    pressTheTimer(tree);
    letTimePass(30);
    expect(words(tree)).not.toContain('Swap');
    expect(words(tree)).not.toContain('of 1');
  });
});

// ─── [5] The next set ───────────────────────────────────────────────────────

describe('[5] logging a set arms the next counter without starting it', () => {
  test('the second set of a three-set plank shows Start, not "run it again"', () => {
    const clock = clockOf('30s each side');
    const tree = render(clock, 0);
    pressTheTimer(tree);
    letTimePass(30);
    pressTheTimer(tree);
    letTimePass(30);
    expect(words(tree)).toContain('Time is up');

    // The set is logged, which is what increments this prop on the real card.
    act(() => {
      tree.update(<HoldTimer clock={clock} setsLogged={1} />);
    });
    expect(words(tree)).toContain('Start the timer - 00:30');
    expect(words(tree)).not.toContain('Time is up');

    // Armed, NOT started: still nothing counts until it is pressed.
    const before = [...alerts()];
    letTimePass(40);
    expect(words(tree)).toContain('Start the timer - 00:30');
    expect(alerts()).toEqual(before);
  });

  test('and it starts again at the FIRST side, not the second', () => {
    const clock = clockOf('30s each side');
    const tree = render(clock, 0);
    pressTheTimer(tree);
    letTimePass(30);
    expect(words(tree)).toContain('2 of 2');
    act(() => {
      tree.update(<HoldTimer clock={clock} setsLogged={1} />);
    });
    expect(words(tree)).toContain('1 of 2');
  });
});
