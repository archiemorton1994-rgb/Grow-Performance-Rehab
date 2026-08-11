/**
 * The readiness screen tells you about time away, before you train.
 *
 * WHY A RENDER TEST AND NOT A UNIT TEST
 * ─────────────────────────────────────
 * The load back-off is covered by tests/time-off.check.mjs, which drives the
 * real engine. What that file cannot prove is the part the owner actually asked
 * for — that the app *visibly* knows. Archie's words were that a returning user
 * should "at least feel like the app knows", and the whole failure mode being
 * fixed is the app doing one thing while saying another.
 *
 * So this renders the real ReadinessScreen — the last screen before the weights
 * appear — and asserts the banner is there when someone has been away and gone
 * when they have not. A weight that quietly drops with nothing on screen to
 * explain it is indistinguishable from lost history, which is worse than no
 * adjustment at all.
 */

import React, { act } from 'react';
import renderer from 'react-test-renderer';

import ReadinessScreen from '../app/readiness';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const routerMock = require('../__mocks__/expo-router') as {
  __setParams: (p: Record<string, string>) => void;
  __clearParams: () => void;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const engineMock = require('../__mocks__/lib-workout-engine') as {
  daysAwayFrom: jest.Mock;
};

type TreeNode = {
  type: string;
  props: Record<string, unknown>;
  children: (TreeNode | string)[] | null;
};

function allText(node: TreeNode | string | null): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((c) => allText(c as TreeNode | string)).join(' ');
}

function render(): { text: string; hasBanner: boolean } {
  let root!: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(React.createElement(ReadinessScreen));
  });
  const tree = root.toJSON() as unknown as TreeNode;
  const text = allText(tree);
  let hasBanner = false;
  const walk = (n: TreeNode | string | null) => {
    if (!n || typeof n === 'string') return;
    if (n.props?.testID === 'layoff-banner') hasBanner = true;
    (n.children ?? []).forEach((c) => walk(c as TreeNode | string));
  };
  walk(tree);
  return { text, hasBanner };
}

describe('ReadinessScreen — time away from training', () => {
  beforeEach(() => {
    routerMock.__setParams({ sessionType: 'squat', isTestWeek: 'false' });
  });
  afterEach(() => {
    routerMock.__clearParams();
    engineMock.daysAwayFrom.mockReturnValue(null);
  });

  test('says nothing to someone who has been training all along', () => {
    engineMock.daysAwayFrom.mockReturnValue(2);
    const { hasBanner } = render();
    expect(hasBanner).toBe(false);
  });

  test('says nothing to a brand-new user with no history at all', () => {
    engineMock.daysAwayFrom.mockReturnValue(null);
    const { hasBanner } = render();
    expect(hasBanner).toBe(false);
  });

  test('names the gap and the cut after a month off', () => {
    engineMock.daysAwayFrom.mockReturnValue(35);
    const { text, hasBanner } = render();
    expect(hasBanner).toBe(true);
    expect(text).toContain('5 weeks since your last session');
    // The number matters more than the sympathy: it is what lets someone
    // disagree with the decision the app made on their behalf.
    expect(text).toMatch(/\d+% of where you left off/);
  });

  test('is honest that it is starting over after a year off', () => {
    engineMock.daysAwayFrom.mockReturnValue(368);
    const { text, hasBanner } = render();
    expect(hasBanner).toBe(true);
    expect(text).toContain('12 months away');
    expect(text).toContain('starting fresh');
  });

  test('never promises a percentage it is not applying', () => {
    // Just past the grace period the cut is real but tiny. Quoting "99%" reads
    // as a rounding error, so the copy says it in words instead.
    engineMock.daysAwayFrom.mockReturnValue(12);
    const { text, hasBanner } = render();
    expect(hasBanner).toBe(true);
    expect(text).not.toMatch(/\d+% of where you left off/);
  });
});
