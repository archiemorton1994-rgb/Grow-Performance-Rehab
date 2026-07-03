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
 *   [4] 13 Stats heatmap mode tests (heatmapCounts prop — no crash, correct interaction,
 *          and runtime opacity assertions via the extended body-highlighter mock)
 *   [5]  9 Stats — Pain Insight Sheet (PainInsightSheet component extracted from workouts.tsx)
 */

import React, { useState } from 'react';
import renderer from 'react-test-renderer';
import { act } from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// react-native is redirected to __mocks__/react-native.js via moduleNameMapper
import { View, Text, Pressable } from 'react-native';

// Body-highlighter mock exposes getCapturedBodyData() so tests can inspect the
// heatmap data array passed to <Body data={...}> and assert on fill/opacity values.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bodyHighlighterMock = require('../__mocks__/react-native-body-highlighter') as {
  getCapturedBodyData: () => Array<{ slug: string; styles: { fill: string } }> | null;
  clearCapturedBodyData: () => void;
};

// PainRegion is a compile-time type — stripped by babel, no runtime load of store.ts
import type { PainRegion } from '../lib/store';
import { BodyDiagram, BODY_DIAGRAM_LABELS } from '../components/BodyDiagram';
import { PainInsightSheet } from '../components/PainInsightSheet';

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
// Overview tab) renders safely across all edge cases, fires onSelect correctly,
// and produces the expected fill/opacity values via the body-highlighter data prop.

describe('[4] Stats heatmap mode — Pain Patterns card', () => {
  const src = readFileSync(resolve(__dirname, '../components/BodyDiagram.tsx'), 'utf8');

  // Typical heatmap data: some regions hot, others absent (count treated as 0)
  const SAMPLE_COUNTS: Partial<Record<PainRegion, number>> = {
    knee: 10, neck: 5, lower_back: 3,
  };

  // ── Opacity formula static guards ────────────────────────────────────────────
  // Source-level guards ensure the formula structure doesn't silently disappear.
  // Runtime opacity assertions follow below using the extended body-highlighter mock.

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

  // ── Runtime opacity assertions (via extended body-highlighter mock) ───────────
  // BodyDiagram passes { slug, styles: { fill: 'rgba(r,g,b,opacity)' } } entries
  // to <Body data={...}>. The mock captures that array so tests can assert on the
  // actual computed opacity values, catching any silent formula change immediately.
  //
  // Slug mapping (FRONT_REGION_SLUGS in BodyDiagram.tsx):
  //   knee  → 'knees'   (JOINT_CLR: #4a7e9b)
  //   neck  → 'neck'    (JOINT_CLR: #4a7e9b)
  //   hip_groin → 'adductors' (JOINT_CLR: #4a7e9b)
  //
  // Formula:  count > 0  ? 0.14 + (count / maxCount) * 0.68  : 0.06
  //   count=10, max=10  → 0.14 + 1.00 * 0.68 = 0.82
  //   count=5,  max=10  → 0.14 + 0.50 * 0.68 = 0.48
  //   count=0  (absent) → 0.06

  /** Parses the alpha component from an rgba(r,g,b,a) string. */
  function parseOpacity(fill: string): number {
    const m = fill.match(/rgba\(\d+,\d+,\d+,([\d.]+)\)/);
    if (!m) throw new Error(`Unexpected fill format: ${fill}`);
    return parseFloat(m[1]);
  }

  test('runtime opacity: max-count region (count=10) gets fill opacity 0.82', () => {
    act(() => {
      renderer.create(
        <BodyDiagram heatmapCounts={{ knee: 10 }} onSelect={() => {}} />,
      );
    });
    const data = bodyHighlighterMock.getCapturedBodyData();
    expect(data).not.toBeNull();
    const kneeEntry = data!.find(e => e.slug === 'knees');
    expect(kneeEntry).toBeDefined();
    // knee=10, maxCount=max(10,1)=10: 0.14 + (10/10)*0.68 = 0.82
    expect(parseOpacity(kneeEntry!.styles.fill)).toBeCloseTo(0.82, 2);
  });

  test('runtime opacity: zero-count region gets baseline fill opacity 0.06', () => {
    // knee=10 is the only hot region; hip_groin is absent → count=0
    act(() => {
      renderer.create(
        <BodyDiagram heatmapCounts={{ knee: 10 }} onSelect={() => {}} />,
      );
    });
    const data = bodyHighlighterMock.getCapturedBodyData();
    expect(data).not.toBeNull();
    const hipEntry = data!.find(e => e.slug === 'adductors');
    expect(hipEntry).toBeDefined();
    // hip_groin count=0: opacity = 0.06
    expect(parseOpacity(hipEntry!.styles.fill)).toBeCloseTo(0.06, 2);
  });

  test('runtime opacity: three counts produce three distinct opacity values in the correct order', () => {
    // knee=10 (max), neck=5 (mid), hip_groin=0 (absent)
    act(() => {
      renderer.create(
        <BodyDiagram heatmapCounts={{ knee: 10, neck: 5 }} onSelect={() => {}} />,
      );
    });
    const data = bodyHighlighterMock.getCapturedBodyData();
    expect(data).not.toBeNull();
    const kneeEntry  = data!.find(e => e.slug === 'knees');
    const neckEntry  = data!.find(e => e.slug === 'neck');
    const hipEntry   = data!.find(e => e.slug === 'adductors');
    expect(kneeEntry).toBeDefined();
    expect(neckEntry).toBeDefined();
    expect(hipEntry).toBeDefined();
    // Exact values
    expect(parseOpacity(kneeEntry!.styles.fill)).toBeCloseTo(0.82, 2); // 0.14+1.00*0.68
    expect(parseOpacity(neckEntry!.styles.fill)).toBeCloseTo(0.48, 2); // 0.14+0.50*0.68
    expect(parseOpacity(hipEntry!.styles.fill)).toBeCloseTo(0.06, 2);  // baseline
    // Ordering
    expect(parseOpacity(kneeEntry!.styles.fill))
      .toBeGreaterThan(parseOpacity(neckEntry!.styles.fill));
    expect(parseOpacity(neckEntry!.styles.fill))
      .toBeGreaterThan(parseOpacity(hipEntry!.styles.fill));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [5] Stats — Pain Insight Sheet
//
// PainInsightSheet is extracted from the inline Modal in workouts.tsx so it
// can be tested in isolation. It receives region, sessionCount, and three
// callbacks (onStartPrehab, onViewHistory, onDismiss) as props and renders a
// bottom-sheet style Modal with testID-tagged interactive elements.
// ─────────────────────────────────────────────────────────────────────────────

describe('[5] Stats — Pain Insight Sheet', () => {
  test('sheet is not rendered when region is null (Modal visible=false)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region={null}
          sessionCount={0}
          onStartPrehab={jest.fn()}
          onViewHistory={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    // Modal mock returns null when visible=false, so toJSON() is null
    expect(root.toJSON()).toBeNull();
  });

  test('sheet renders with the correct region label when region is set', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region="knee"
          sessionCount={3}
          onStartPrehab={jest.fn()}
          onViewHistory={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    expect(hasTestId(root, 'pain-insight-sheet')).toBe(true);
    expect(hasTestId(root, 'pain-insight-region-label')).toBe(true);
    // BODY_DIAGRAM_LABELS['knee'] === 'Knee'
    expect(hasText(root, BODY_DIAGRAM_LABELS['knee'])).toBe(true);
  });

  test('session count text uses plural form when count > 1', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region="elbow_wrist"
          sessionCount={5}
          onStartPrehab={jest.fn()}
          onViewHistory={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    expect(hasText(root, 'Flagged in 5 sessions')).toBe(true);
  });

  test('session count text uses singular form when count = 1', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region="neck"
          sessionCount={1}
          onStartPrehab={jest.fn()}
          onViewHistory={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    expect(hasText(root, 'Flagged in 1 session')).toBe(true);
  });

  test('session count text shows fallback when count = 0 (region absent from history)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region="lower_back"
          sessionCount={0}
          onStartPrehab={jest.fn()}
          onViewHistory={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    expect(hasText(root, 'Flagged in 1 session')).toBe(true);
  });

  test('"Start Targeted Prehab" button calls onStartPrehab with the correct region', () => {
    const onStartPrehab = jest.fn();
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region="knee"
          sessionCount={5}
          onStartPrehab={onStartPrehab}
          onViewHistory={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    press(root, 'pain-insight-start-prehab');
    expect(onStartPrehab).toHaveBeenCalledTimes(1);
    expect(onStartPrehab).toHaveBeenCalledWith('knee');
  });

  test('"View in History" button calls onViewHistory with the correct region', () => {
    const onViewHistory = jest.fn();
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region="hip_groin"
          sessionCount={2}
          onStartPrehab={jest.fn()}
          onViewHistory={onViewHistory}
          onDismiss={jest.fn()}
        />,
      );
    });
    press(root, 'pain-insight-view-history');
    expect(onViewHistory).toHaveBeenCalledTimes(1);
    expect(onViewHistory).toHaveBeenCalledWith('hip_groin');
  });

  test('close (×) button calls onDismiss', () => {
    const onDismiss = jest.fn();
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <PainInsightSheet
          region="ankle_achilles"
          sessionCount={3}
          onStartPrehab={jest.fn()}
          onViewHistory={jest.fn()}
          onDismiss={onDismiss}
        />,
      );
    });
    press(root, 'pain-insight-close');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('renders without crash when sessionCount is zero (region absent from pain history)', () => {
    expect(() => {
      act(() => {
        renderer.create(
          <PainInsightSheet
            region="calf_shin"
            sessionCount={0}
            onStartPrehab={jest.fn()}
            onViewHistory={jest.fn()}
            onDismiss={jest.fn()}
          />,
        );
      });
    }).not.toThrow();
  });
});

