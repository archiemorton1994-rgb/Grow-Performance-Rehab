/**
 * Runtime component rendering tests for BodyDiagram.
 *
 * Uses react-test-renderer (Node.js env — no browser, no Chromium required).
 * The component is fully rendered via React's reconciler with lightweight
 * mocks for react-native, react-native-svg, and expo-haptics.
 *
 * Covers test cases from the original Playwright body-diagram.spec.ts:
 *   [1]  5 source-code static guards
 *   [2] 22 Flex tab / Targeted Prehab render tests (BodyDiagram component behaviour)
 *   [3] 15 Readiness screen render tests
 *   [4] 10 Stats heatmap mode tests (heatmapCounts prop — no crash, correct interaction)
 */

import React, { useState } from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// react-native is redirected to __mocks__/react-native.js via moduleNameMapper
import { View, Text, Pressable } from 'react-native';

// PainRegion is a compile-time type — stripped by babel, no runtime load of store.ts
import type { PainRegion } from '../lib/store';
import { BodyDiagram, BODY_DIAGRAM_LABELS } from '../components/BodyDiagram';

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

/**
 * Returns true if any node in the rendered JSON tree has a direct string
 * child that equals `text` (matches how <Text>Neck</Text> is serialised).
 */
function hasText(root: renderer.ReactTestRenderer, text: string): boolean {
  return !!findInTree(root.toJSON() as TreeNode | null, (n) => {
    const c = n.children;
    return Array.isArray(c) && c.some((ch) => typeof ch === 'string' && ch === text);
  });
}

/**
 * Returns true if any node in the rendered JSON tree has props.testID === testId.
 */
function hasTestId(root: renderer.ReactTestRenderer, testId: string): boolean {
  return !!findInTree(
    root.toJSON() as TreeNode | null,
    (n) => n.props.testID === testId,
  );
}

/**
 * Finds the first element with `testID` and calls its `onPress` handler
 * inside `act()` so React flushes all resulting state updates.
 */
function press(root: renderer.ReactTestRenderer, testId: string): void {
  const els = root.root.findAllByProps({ testID: testId });
  if (els.length === 0) throw new Error(`No element found with testID="${testId}"`);
  act(() => {
    (els[0].props as { onPress: () => void }).onPress();
  });
}

// ─── Wrapper components ───────────────────────────────────────────────────────

/**
 * Stateful wrapper that simulates the Flex / Targeted Prehab modal context.
 * Shows a "Start Session" button (testID="start-session-btn") only when a
 * region is selected — mirrors the flex.tsx conditional rendering.
 */
function FlexWrapper({ defaultView }: { defaultView?: 'front' | 'back' }) {
  const [selected, setSelected] = useState<PainRegion | undefined>(undefined);
  return (
    <View>
      <BodyDiagram selected={selected} onSelect={setSelected} defaultView={defaultView} />
      {selected !== undefined && (
        <Pressable testID="start-session-btn" onPress={() => {}}>
          <Text>Start Session</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Stateful wrapper that simulates the Readiness screen pain-region step.
 * Shows a "Confirm Region" button (testID="pain-region-confirm") only when a
 * region is selected, and calls `onConfirm` when pressed.
 */
function ReadinessWrapper({ onConfirm }: { onConfirm?: (r: PainRegion) => void }) {
  const [selected, setSelected] = useState<PainRegion | undefined>(undefined);
  return (
    <View>
      <BodyDiagram selected={selected} onSelect={setSelected} />
      {selected !== undefined && (
        <Pressable
          testID="pain-region-confirm"
          onPress={() => onConfirm && selected !== undefined && onConfirm(selected)}
        >
          <Text>Confirm Region</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── [1] Source-code static guards ───────────────────────────────────────────

describe('[1] Source-code static guards', () => {
  const src = readFileSync(resolve(__dirname, '../components/BodyDiagram.tsx'), 'utf8');

  test('fill guard: h() uses rgba(0,0,0,0.001) not transparent', () => {
    expect(src).toContain("fill: 'rgba(0,0,0,0.001)'");
    expect(src).not.toMatch(/fill:\s*'transparent'/);
  });

  test('testID guard: h() spreads body-diagram-region-${r} on every hotspot', () => {
    expect(src).toContain('testID: `body-diagram-region-${r}`');
  });

  test('h() coverage: all 18 PainRegion values appear as h() calls', () => {
    const regions: PainRegion[] = [
      'neck', 'front_shoulder', 'rear_shoulder', 'elbow_wrist',
      'upper_back', 'lower_back', 'core_ribs', 'hip_groin',
      'knee', 'calf_shin', 'ankle_achilles', 'chest', 'bicep',
      'tricep', 'quads', 'hamstrings', 'glutes', 'lat_mid_back',
    ];
    for (const r of regions) {
      expect(src).toContain(`h('${r}')`);
    }
  });

  test('label completeness: BODY_DIAGRAM_LABELS has entries for all 18 regions', () => {
    expect(Object.keys(BODY_DIAGRAM_LABELS).length).toBe(18);
  });

  test('toggle testIDs: body-diagram-front and body-diagram-back present', () => {
    expect(src).toContain('testID="body-diagram-front"');
    expect(src).toContain('testID="body-diagram-back"');
  });
});

// ─── [2] Flex tab — Targeted Prehab modal ────────────────────────────────────

describe('[2] Flex tab — Targeted Prehab modal', () => {
  test('body diagram renders with Front and Back toggle buttons', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<FlexWrapper />); });
    expect(hasTestId(root, 'body-diagram-front')).toBe(true);
    expect(hasTestId(root, 'body-diagram-back')).toBe(true);
  });

  // ── Front-view region taps ──
  const frontRegions: [PainRegion, string][] = [
    ['neck',           'Neck'],
    ['front_shoulder', 'Front Shoulder'],
    ['elbow_wrist',    'Elbow / Wrist'],
    ['core_ribs',      'Core / Ribs'],
    ['hip_groin',      'Hip / Groin'],
    ['knee',           'Knee'],
    ['calf_shin',      'Calf / Shin'],
    ['ankle_achilles', 'Ankle / Achilles'],
    ['chest',          'Chest'],
    ['bicep',          'Biceps'],
    ['quads',          'Quads'],
  ];

  for (const [region, label] of frontRegions) {
    test(`Front: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => { root = renderer.create(<FlexWrapper />); });
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('Back: switching to Back clears selection and shows hint', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<FlexWrapper />); });
    // Select a front region first
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, 'Neck')).toBe(true);
    // Switch to Back — handleViewChange calls onSelect(undefined)
    press(root, 'body-diagram-back');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  // ── Back-view region taps ──
  const backRegions: [PainRegion, string][] = [
    ['rear_shoulder', 'Rear Shoulder'],
    ['upper_back',    'Upper Back'],
    ['lower_back',    'Lower Back'],
    ['tricep',        'Triceps'],
    ['lat_mid_back',  'Lats / Mid Back'],
    ['glutes',        'Glutes'],
    ['hamstrings',    'Hamstrings'],
  ];

  for (const [region, label] of backRegions) {
    test(`Back: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => { root = renderer.create(<FlexWrapper />); });
      press(root, 'body-diagram-back');
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('Front→Back→Front toggle: each switch clears selection', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<FlexWrapper />); });
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, 'Neck')).toBe(true);
    press(root, 'body-diagram-back');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
    press(root, 'body-diagram-front');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  test('selecting a region reveals the Start Session button', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<FlexWrapper />); });
    expect(hasTestId(root, 'start-session-btn')).toBe(false);
    press(root, 'body-diagram-region-knee');
    expect(hasTestId(root, 'start-session-btn')).toBe(true);
  });
});

// ─── [3] Readiness screen — pain-region step ─────────────────────────────────

describe('[3] Readiness screen — pain-region step', () => {
  test('body diagram renders with Front and Back toggle on pain-region step', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ReadinessWrapper />); });
    expect(hasTestId(root, 'body-diagram-front')).toBe(true);
    expect(hasTestId(root, 'body-diagram-back')).toBe(true);
  });

  // ── Front-view region taps ──
  const frontRegions: [PainRegion, string][] = [
    ['neck',           'Neck'],
    ['front_shoulder', 'Front Shoulder'],
    ['elbow_wrist',    'Elbow / Wrist'],
    ['core_ribs',      'Core / Ribs'],
    ['hip_groin',      'Hip / Groin'],
    ['knee',           'Knee'],
    ['calf_shin',      'Calf / Shin'],
    ['ankle_achilles', 'Ankle / Achilles'],
  ];

  for (const [region, label] of frontRegions) {
    test(`Front: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => { root = renderer.create(<ReadinessWrapper />); });
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('Back: switching to Back clears selection', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ReadinessWrapper />); });
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, 'Neck')).toBe(true);
    press(root, 'body-diagram-back');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  // ── Back-view region taps ──
  const backRegions: [PainRegion, string][] = [
    ['rear_shoulder', 'Rear Shoulder'],
    ['upper_back',    'Upper Back'],
    ['lower_back',    'Lower Back'],
  ];

  for (const [region, label] of backRegions) {
    test(`Back: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => { root = renderer.create(<ReadinessWrapper />); });
      press(root, 'body-diagram-back');
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('selecting a region reveals the Confirm Region button', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ReadinessWrapper />); });
    expect(hasTestId(root, 'pain-region-confirm')).toBe(false);
    press(root, 'body-diagram-region-knee');
    expect(hasTestId(root, 'pain-region-confirm')).toBe(true);
  });

  test('tapping Confirm Region with core_ribs navigates to session', () => {
    let confirmedRegion: PainRegion | undefined;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ReadinessWrapper onConfirm={(r) => { confirmedRegion = r; }} />,
      );
    });
    press(root, 'body-diagram-region-core_ribs');
    press(root, 'pain-region-confirm');
    expect(confirmedRegion).toBe('core_ribs');
  });
});

// ─── [4] Stats heatmap mode — Pain Patterns card ─────────────────────────────
// Verifies that BodyDiagram with heatmapCounts prop (used by the Stats screen
// Overview tab) renders safely across all edge cases and fires onSelect correctly.
// Note: The react-native-svg mock strips fill/style props, so opacity is verified
// via source-code static guards rather than inspecting rendered tree props.

describe('[4] Stats heatmap mode — Pain Patterns card', () => {
  const src = readFileSync(resolve(__dirname, '../components/BodyDiagram.tsx'), 'utf8');

  // Typical heatmap data: some regions hot, others absent (count treated as 0)
  const SAMPLE_COUNTS: Partial<Record<PainRegion, number>> = {
    knee: 10, neck: 5, lower_back: 3,
  };

  // ── Opacity formula static guards ────────────────────────────────────────────
  // The SVG mock only forwards testID + onPress; fill is stripped. We verify the
  // opacity branching logic exists in source to prove different opacities are used.

  test('opacity formula: non-zero counts use 0.14 + scaled 0.68 range', () => {
    expect(src).toContain('0.14 + (count / heatmapMaxCount) * 0.68');
  });

  test('opacity formula: zero-count regions use 0.06 baseline (faint, not invisible)', () => {
    // Formula: count > 0 ? 0.14 + … : 0.06
    expect(src).toContain(': 0.06');
    // Both values must differ — verified by their co-presence in the ternary
    expect(src).toContain('count > 0');
  });

  // ── Runtime rendering — no crash on any edge case ────────────────────────────

  test('renders without throwing with typical non-empty heatmapCounts', () => {
    let root!: renderer.ReactTestRenderer;
    expect(() => {
      act(() => {
        root = renderer.create(
          <BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />,
        );
      });
    }).not.toThrow();
    expect(root).toBeDefined();
  });

  test('renders without throwing when heatmapCounts is an empty object {}', () => {
    let root!: renderer.ReactTestRenderer;
    expect(() => {
      act(() => {
        root = renderer.create(
          <BodyDiagram heatmapCounts={{}} onSelect={() => {}} />,
        );
      });
    }).not.toThrow();
    expect(root).toBeDefined();
  });

  test('renders without throwing when all counts are zero', () => {
    const zeroCounts: Partial<Record<PainRegion, number>> = {
      knee: 0, neck: 0, lower_back: 0,
    };
    let root!: renderer.ReactTestRenderer;
    expect(() => {
      act(() => {
        root = renderer.create(
          <BodyDiagram heatmapCounts={zeroCounts} onSelect={() => {}} />,
        );
      });
    }).not.toThrow();
    expect(root).toBeDefined();
  });

  // ── Region hotspot testIDs present ───────────────────────────────────────────
  // h() hotspot paths render for the current view regardless of heatmap mode.

  test('all front-view region hotspot testIDs are present in heatmap mode', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />,
      );
    });
    const frontRegions: PainRegion[] = [
      'neck', 'front_shoulder', 'elbow_wrist', 'core_ribs',
      'hip_groin', 'knee', 'calf_shin', 'ankle_achilles',
      'chest', 'bicep', 'quads', 'upper_back',
    ];
    for (const r of frontRegions) {
      expect(hasTestId(root, `body-diagram-region-${r}`)).toBe(true);
    }
  });

  test('all back-view region hotspot testIDs are present after switching to Back in heatmap mode', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />,
      );
    });
    press(root, 'body-diagram-back');
    const backRegions: PainRegion[] = [
      'neck', 'rear_shoulder', 'upper_back', 'lower_back',
      'elbow_wrist', 'lat_mid_back', 'glutes', 'hamstrings',
      'knee', 'calf_shin', 'ankle_achilles', 'hip_groin', 'tricep',
    ];
    for (const r of backRegions) {
      expect(hasTestId(root, `body-diagram-region-${r}`)).toBe(true);
    }
  });

  // ── onSelect interaction ─────────────────────────────────────────────────────

  test('onSelect fires with correct region when a hot region is pressed in heatmap mode', () => {
    let selected: PainRegion | undefined;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BodyDiagram
          heatmapCounts={SAMPLE_COUNTS}
          onSelect={(r) => { selected = r; }}
        />,
      );
    });
    press(root, 'body-diagram-region-knee');
    expect(selected).toBe('knee');
  });

  test('onSelect fires for a region with count 0 (absent from heatmapCounts)', () => {
    let selected: PainRegion | undefined;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BodyDiagram
          heatmapCounts={{ knee: 5 }}
          onSelect={(r) => { selected = r; }}
        />,
      );
    });
    // core_ribs has no count entry (treated as 0) — should still be tappable
    press(root, 'body-diagram-region-core_ribs');
    expect(selected).toBe('core_ribs');
  });

  // ── Read-only display — no label chip ────────────────────────────────────────

  test('hint text "Tap a region on the diagram" shows in heatmap mode (no label chip)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />,
      );
    });
    // selected is undefined in heatmap mode → label is null → hint text shown
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });
});

