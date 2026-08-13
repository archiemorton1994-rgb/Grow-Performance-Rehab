/**
 * Runtime component test: the tutorial spotlight is the shape of what it points at.
 *
 * THE BUG THIS REPRODUCES
 * ───────────────────────
 * The highlight radius was `min(width, height) / 2` unconditionally — a true
 * pill, always. On an icon that is a circle and correct. On a region of content
 * it is a circle and wrong: spotlighting the 2x2 grid of session cards on the
 * Train tab drew a 330px circle over a 330px square, so the corners of all four
 * cards sat outside the highlight while empty page sat inside it. It happened
 * at almost every step of every tab's tour, because almost everything a tour
 * points at is a block of content rather than an icon.
 *
 * This renders the real CoachMark and reads the radius actually applied to the
 * highlight, rather than asserting that a line of source exists.
 *
 * Uses react-test-renderer, same as session-bar-kav.test.tsx.
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';

import CoachMark from '../components/CoachMark';
import { SMALL_TARGET, REGION_RADIUS } from '../lib/spotlight-shape';

type Rect = { top: number; left: number; width: number; height: number; borderRadius?: number };

function renderWith(rect: Rect) {
  let root!: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(
      <CoachMark
        visible
        title="Your strength foundation"
        body="Squat, Bench, and Deadlift drive your 1RM."
        step={1}
        total={3}
        onNext={() => {}}
        onSkip={() => {}}
        spotlightRect={rect}
      />
    );
  });
  return root;
}

/**
 * The radius applied to the highlight itself.
 *
 * Found by its geometry rather than by a testID: the highlight is the one
 * absolutely-positioned view whose top/left/width/height match the rect handed
 * in, which is exactly how a reader identifies it on screen.
 */
function highlightRadius(root: renderer.ReactTestRenderer, rect: Rect): number | undefined {
  const flatten = (s: any): any =>
    Array.isArray(s) ? Object.assign({}, ...s.map(flatten)) : (s ?? {});
  // react-test-renderer's shipped types omit `findAll`, which exists at runtime —
  // same gap as `update` in set-feedback-attribution.test.tsx.
  const rootInstance = root.root as unknown as {
    findAll: (fn: (node: { props: any }) => boolean) => { props: any }[];
  };
  const match = rootInstance
    .findAll((n) => {
      const style = flatten(n.props?.style);
      return (
        style.position === 'absolute' &&
        style.top === rect.top &&
        style.left === rect.left &&
        style.width === rect.width &&
        style.height === rect.height
      );
    })
    .map((n) => flatten(n.props.style));
  return match[0]?.borderRadius;
}

describe('the spotlight takes its shape from the target', () => {
  test('a block of content is a rounded rectangle, not a circle', () => {
    // The reported case: the KPI Sessions grid, a 2x2 block of cards.
    const rect = { top: 90, left: 16, width: 330, height: 330 };
    const root = renderWith(rect);
    const r = highlightRadius(root, rect);

    expect(r).toBe(REGION_RADIUS);
    // The specific regression: half the short side would be 165, a circle.
    expect(r).not.toBe(rect.height / 2);
  });

  test('a wide card is a rounded rectangle too', () => {
    const rect = { top: 200, left: 16, width: 358, height: 120 };
    const root = renderWith(rect);
    expect(highlightRadius(root, rect)).toBe(REGION_RADIUS);
  });

  test('an icon-sized target is still a full circle', () => {
    // A tab icon, inflated by the 6px every caller adds on each side.
    const rect = { top: 700, left: 150, width: 56, height: 56 };
    const root = renderWith(rect);
    expect(highlightRadius(root, rect)).toBe(28);
  });

  test('a thin progress bar is still a full pill', () => {
    const rect = { top: 160, left: 16, width: 358, height: 20 };
    const root = renderWith(rect);
    expect(highlightRadius(root, rect)).toBe(10);
  });

  test('the two cases meet without a jump at the threshold', () => {
    const justSmall = { top: 0, left: 0, width: 300, height: SMALL_TARGET };
    const justLarge = { top: 0, left: 0, width: 300, height: SMALL_TARGET + 1 };
    const a = highlightRadius(renderWith(justSmall), justSmall)!;
    const b = highlightRadius(renderWith(justLarge), justLarge)!;
    expect(a).toBe(SMALL_TARGET / 2);
    expect(b).toBe(REGION_RADIUS);
    // No visible pop as a tour steps from a chip to a card.
    expect(Math.abs(a - b)).toBeLessThanOrEqual(16);
  });

  test('an explicit borderRadius still wins', () => {
    const rect = { top: 0, left: 0, width: 300, height: 300, borderRadius: 4 };
    const root = renderWith(rect);
    expect(highlightRadius(root, rect)).toBe(4);
  });
});
