/**
 * Runtime component tests: badge animation hook fires correctly for 1, N,
 * and 0 new badges, and does not re-animate already-earned badges on remount.
 *
 * Uses react-test-renderer + Jest fake timers so we can assert that each
 * badge's animate prop transitions false→true→false at the expected times
 * without a browser or native runtime.
 *
 * Two-phase act() pattern:
 *   act 1: root.update(props) → React re-renders + flushes effects
 *            (useEffect now runs, registering setTimeout timers)
 *   act 2: jest.advanceTimersByTime(n) → fires timers + flushes setState
 *
 * Cases:
 *   [A] Single new badge  — animate=true at t=0 ms, false at t=800 ms
 *   [B] 3 simultaneous   — stagger starts 0/80/160 ms, clears 800/880/960 ms
 *   [C] No new badges     — no animations at any point
 *   [D] Remount (restart) — pre-seeded ref means existing badges never animate
 */

import React from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';
import { View } from 'react-native';
import { useBadgeAnimation } from '../hooks/useBadgeAnimation';

// ─── Minimal test harness ─────────────────────────────────────────────────────

/**
 * Renders one <View testID={`animating-${id}`} /> for every ID currently
 * in the animating set, so we can assert presence/absence via findAllByProps.
 */
function BadgeHarness({ earnedBadges }: { earnedBadges: string[] }) {
  const animating = useBadgeAnimation(earnedBadges);
  return (
    <View testID="harness">
      {Array.from(animating).map(id => (
        <View key={id} testID={`animating-${id}`} />
      ))}
    </View>
  );
}

function isAnimating(root: renderer.ReactTestRenderer, id: string): boolean {
  return root.root.findAllByProps({ testID: `animating-${id}` }).length > 0;
}

/** Update props and flush the resulting effect (registers timers). */
function updateBadges(root: renderer.ReactTestRenderer, badges: string[]) {
  act(() => { root.update(<BadgeHarness earnedBadges={badges} />); });
}

/** Advance fake timers and flush resulting setState calls. */
function tick(ms: number) {
  act(() => { jest.advanceTimersByTime(ms); });
}

// ─── Timer setup ──────────────────────────────────────────────────────────────

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => { jest.runOnlyPendingTimers(); });
  jest.useRealTimers();
});

// ─── [A] Single new badge ─────────────────────────────────────────────────────

describe('[A] Single new badge', () => {
  test('not animating at mount', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<BadgeHarness earnedBadges={['badge_a', 'badge_b']} />); });
    expect(isAnimating(root, 'badge_a')).toBe(false);
    expect(isAnimating(root, 'badge_b')).toBe(false);
  });

  test('animate=true immediately after badge earned (startDelay=0)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<BadgeHarness earnedBadges={['badge_a', 'badge_b']} />); });

    updateBadges(root, ['badge_a', 'badge_b', 'badge_c']);
    tick(1); // advance past the delay=0 start timer

    expect(isAnimating(root, 'badge_c')).toBe(true);
  });

  test('animate=false after 800 ms (animation lifetime)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<BadgeHarness earnedBadges={['badge_a']} />); });

    updateBadges(root, ['badge_a', 'badge_b']);
    tick(1);    // badge_b starts animating
    expect(isAnimating(root, 'badge_b')).toBe(true);

    tick(800);  // clear timer fires (clearDelay = 0 + 800)
    expect(isAnimating(root, 'badge_b')).toBe(false);
  });

  test('already-present badge does not animate when new one is added', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<BadgeHarness earnedBadges={['badge_a']} />); });

    updateBadges(root, ['badge_a', 'badge_b']);
    tick(1);

    expect(isAnimating(root, 'badge_a')).toBe(false);
    expect(isAnimating(root, 'badge_b')).toBe(true);
  });
});

// ─── [B] 3 simultaneous badges (stagger ripple) ───────────────────────────────

describe('[B] 3 simultaneous badges', () => {
  test('badges start animating at 0 / 80 / 160 ms respectively', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<BadgeHarness earnedBadges={['badge_a']} />); });

    // Schedule all three at once; effect runs after this act()
    updateBadges(root, ['badge_a', 'badge_b', 'badge_c', 'badge_d']);

    tick(1);   // fires badge_b start (i=0, startDelay=0)
    expect(isAnimating(root, 'badge_b')).toBe(true);
    expect(isAnimating(root, 'badge_c')).toBe(false);  // i=1, startDelay=80 — not yet
    expect(isAnimating(root, 'badge_d')).toBe(false);  // i=2, startDelay=160 — not yet

    tick(80);  // total 81 ms — fires badge_c start
    expect(isAnimating(root, 'badge_c')).toBe(true);
    expect(isAnimating(root, 'badge_d')).toBe(false);

    tick(80);  // total 161 ms — fires badge_d start
    expect(isAnimating(root, 'badge_d')).toBe(true);
  });

  test('badges clear at 800 / 880 / 960 ms respectively', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<BadgeHarness earnedBadges={['badge_a']} />); });

    updateBadges(root, ['badge_a', 'badge_b', 'badge_c', 'badge_d']);
    tick(161);  // all three started (0, 80, 160 ms starts)

    expect(isAnimating(root, 'badge_b')).toBe(true);
    expect(isAnimating(root, 'badge_c')).toBe(true);
    expect(isAnimating(root, 'badge_d')).toBe(true);

    tick(640);  // total 801 ms → badge_b clears (clearDelay = 0 + 800)
    expect(isAnimating(root, 'badge_b')).toBe(false);
    expect(isAnimating(root, 'badge_c')).toBe(true);
    expect(isAnimating(root, 'badge_d')).toBe(true);

    tick(80);   // total 881 ms → badge_c clears (clearDelay = 80 + 800)
    expect(isAnimating(root, 'badge_c')).toBe(false);
    expect(isAnimating(root, 'badge_d')).toBe(true);

    tick(80);   // total 961 ms → badge_d clears (clearDelay = 160 + 800)
    expect(isAnimating(root, 'badge_d')).toBe(false);
  });
});

// ─── [C] No new badges ───────────────────────────────────────────────────────

describe('[C] No new badges', () => {
  test('re-render with same earnedBadges content triggers no animation', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<BadgeHarness earnedBadges={['badge_a', 'badge_b']} />); });

    // Same IDs — new array reference but no new content
    updateBadges(root, ['badge_a', 'badge_b']);
    tick(1000);

    expect(isAnimating(root, 'badge_a')).toBe(false);
    expect(isAnimating(root, 'badge_b')).toBe(false);
  });
});

// ─── [D] Remount (app restart) ───────────────────────────────────────────────

describe('[D] Remount with existing badges (app restart)', () => {
  test('pre-earned badges do not animate when component remounts', () => {
    // First mount — simulate badges loaded from storage at boot
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BadgeHarness earnedBadges={['badge_a', 'badge_b', 'badge_c']} />
      );
    });
    tick(1000);
    expect(isAnimating(root, 'badge_a')).toBe(false);
    expect(isAnimating(root, 'badge_b')).toBe(false);
    expect(isAnimating(root, 'badge_c')).toBe(false);

    // Unmount, then remount with the same badges (simulates app restart)
    act(() => { root.unmount(); });
    act(() => {
      root = renderer.create(
        <BadgeHarness earnedBadges={['badge_a', 'badge_b', 'badge_c']} />
      );
    });
    tick(1000);
    expect(isAnimating(root, 'badge_a')).toBe(false);
    expect(isAnimating(root, 'badge_b')).toBe(false);
    expect(isAnimating(root, 'badge_c')).toBe(false);
  });

  test('new badge earned after restart animates; pre-earned ones stay quiet', () => {
    let root!: renderer.ReactTestRenderer;

    // Restart: component mounts with pre-loaded badges
    act(() => {
      root = renderer.create(<BadgeHarness earnedBadges={['badge_a', 'badge_b']} />);
    });

    // User earns a new badge in this session
    updateBadges(root, ['badge_a', 'badge_b', 'badge_c']);
    tick(1);

    expect(isAnimating(root, 'badge_a')).toBe(false);
    expect(isAnimating(root, 'badge_b')).toBe(false);
    expect(isAnimating(root, 'badge_c')).toBe(true);
  });
});
