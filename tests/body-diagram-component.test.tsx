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
import { BodyDiagram, BODY_DIAGRAM_LABELS, MUSCLE_SET } from '../components/BodyDiagram';
import { PainInsightSheet } from '../components/PainInsightSheet';
// router is mapped to __mocks__/expo-router.js by moduleNameMapper
import { router } from 'expo-router';

// ─── Tree helpers ─────────────────────────────────────────────────────────────

type TreeNode = {
  type: string;
  props: Record<string, unknown>;
  children: (TreeNode | string)[] | null;
};

function findInTree(
  node: TreeNode | string | null,
  predicate: (n: TreeNode) => boolean
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
  return !!findInTree(root.toJSON() as TreeNode | null, (n) => n.props.testID === testId);
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
      'neck',
      'front_shoulder',
      'rear_shoulder',
      'elbow',

      'wrist',
      'upper_back',
      'lower_back',
      'core_ribs',
      'hip_groin',
      'knee',
      'calf_shin',
      'ankle_achilles',
      'chest',
      'bicep',
      'tricep',
      'quads',
      'hamstrings',
      'glutes',
      'lat_mid_back',
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
    act(() => {
      root = renderer.create(<FlexWrapper />);
    });
    expect(hasTestId(root, 'body-diagram-front')).toBe(true);
    expect(hasTestId(root, 'body-diagram-back')).toBe(true);
  });

  // ── Front-view region taps ──
  const frontRegions: [PainRegion, string][] = [
    ['neck', 'Neck'],
    ['front_shoulder', 'Front Shoulder'],
    ['elbow', 'Elbow'],
    ['wrist', 'Wrist'],
    ['core_ribs', 'Core / Ribs'],
    ['hip_groin', 'Hip / Groin'],
    ['knee', 'Knee'],
    ['calf_shin', 'Calf / Shin'],
    ['ankle_achilles', 'Ankle / Achilles'],
    ['chest', 'Chest'],
    ['bicep', 'Biceps'],
    ['quads', 'Quads'],
  ];

  for (const [region, label] of frontRegions) {
    test(`Front: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(<FlexWrapper />);
      });
      // Joint regions are only tappable in Joints mode; muscle regions use default Muscles mode
      if (!MUSCLE_SET.has(region)) {
        press(root, 'body-diagram-joints');
      }
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('Back: switching to Back clears selection and shows hint', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<FlexWrapper />);
    });
    // Select a front region first — neck is a joint so switch to Joints mode
    press(root, 'body-diagram-joints');
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, 'Neck')).toBe(true);
    // Switch to Back — handleViewChange calls onSelect(undefined)
    press(root, 'body-diagram-back');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  // ── Back-view region taps ──
  const backRegions: [PainRegion, string][] = [
    ['rear_shoulder', 'Rear Shoulder'],
    ['upper_back', 'Upper Back'],
    ['lower_back', 'Lower Back'],
    ['tricep', 'Triceps'],
    ['lat_mid_back', 'Lats / Mid Back'],
    ['glutes', 'Glutes'],
    ['hamstrings', 'Hamstrings'],
  ];

  for (const [region, label] of backRegions) {
    test(`Back: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(<FlexWrapper />);
      });
      press(root, 'body-diagram-back');
      // Joint regions are only tappable in Joints mode
      if (!MUSCLE_SET.has(region)) {
        press(root, 'body-diagram-joints');
      }
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('Front→Back→Front toggle: each switch clears selection', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<FlexWrapper />);
    });
    press(root, 'body-diagram-joints'); // neck is a joint region
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, 'Neck')).toBe(true);
    press(root, 'body-diagram-back');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
    press(root, 'body-diagram-front');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  test('selecting a region reveals the Start Session button', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<FlexWrapper />);
    });
    expect(hasTestId(root, 'start-session-btn')).toBe(false);
    press(root, 'body-diagram-joints'); // knee is a joint region
    press(root, 'body-diagram-region-knee');
    expect(hasTestId(root, 'start-session-btn')).toBe(true);
  });

  // ── Category-gating verification ──────────────────────────────────────────
  test('Muscles mode: pressing a joint region (knee) is a no-op', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<FlexWrapper />);
    });
    // category defaults to 'muscles'; knee is a joint region
    press(root, 'body-diagram-region-knee');
    expect(hasText(root, BODY_DIAGRAM_LABELS['knee'])).toBe(false);
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  test('Joints mode: pressing a muscle region (chest) is a no-op', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<FlexWrapper />);
    });
    press(root, 'body-diagram-joints');
    // chest is in MUSCLE_SET — not selectable in joints mode
    press(root, 'body-diagram-region-chest');
    expect(hasText(root, BODY_DIAGRAM_LABELS['chest'])).toBe(false);
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  test('switching to Joints mode makes joint regions selectable', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<FlexWrapper />);
    });
    // In Muscles mode, neck does nothing
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, BODY_DIAGRAM_LABELS['neck'])).toBe(false);
    // Switch to Joints mode — neck should now respond
    press(root, 'body-diagram-joints');
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, BODY_DIAGRAM_LABELS['neck'])).toBe(true);
  });
});

// ─── [3] Readiness screen — pain-region step ─────────────────────────────────

describe('[3] Readiness screen — pain-region step', () => {
  test('body diagram renders with Front and Back toggle on pain-region step', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<ReadinessWrapper />);
    });
    expect(hasTestId(root, 'body-diagram-front')).toBe(true);
    expect(hasTestId(root, 'body-diagram-back')).toBe(true);
  });

  // ── Front-view region taps ──
  const frontRegions: [PainRegion, string][] = [
    ['neck', 'Neck'],
    ['front_shoulder', 'Front Shoulder'],
    ['elbow', 'Elbow'],
    ['wrist', 'Wrist'],
    ['core_ribs', 'Core / Ribs'],
    ['hip_groin', 'Hip / Groin'],
    ['knee', 'Knee'],
    ['calf_shin', 'Calf / Shin'],
    ['ankle_achilles', 'Ankle / Achilles'],
  ];

  for (const [region, label] of frontRegions) {
    test(`Front: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(<ReadinessWrapper />);
      });
      // Joint regions are only tappable in Joints mode
      if (!MUSCLE_SET.has(region)) {
        press(root, 'body-diagram-joints');
      }
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('Back: switching to Back clears selection', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<ReadinessWrapper />);
    });
    press(root, 'body-diagram-joints'); // neck is a joint region
    press(root, 'body-diagram-region-neck');
    expect(hasText(root, 'Neck')).toBe(true);
    press(root, 'body-diagram-back');
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  // ── Back-view region taps ──
  const backRegions: [PainRegion, string][] = [
    ['rear_shoulder', 'Rear Shoulder'],
    ['upper_back', 'Upper Back'],
    ['lower_back', 'Lower Back'],
  ];

  for (const [region, label] of backRegions) {
    test(`Back: tapping ${region} shows "${label}" label chip`, () => {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(<ReadinessWrapper />);
      });
      press(root, 'body-diagram-back');
      // Joint regions are only tappable in Joints mode
      if (!MUSCLE_SET.has(region)) {
        press(root, 'body-diagram-joints');
      }
      press(root, `body-diagram-region-${region}`);
      expect(hasText(root, label)).toBe(true);
    });
  }

  test('selecting a region reveals the Confirm Region button', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<ReadinessWrapper />);
    });
    expect(hasTestId(root, 'pain-region-confirm')).toBe(false);
    press(root, 'body-diagram-joints'); // knee is a joint region
    press(root, 'body-diagram-region-knee');
    expect(hasTestId(root, 'pain-region-confirm')).toBe(true);
  });

  test('tapping Confirm Region with core_ribs navigates to session', () => {
    let confirmedRegion: PainRegion | undefined;
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ReadinessWrapper
          onConfirm={(r) => {
            confirmedRegion = r;
          }}
        />
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
    knee: 10,
    neck: 5,
    lower_back: 3,
  };

  // ── Opacity formula static guards ────────────────────────────────────────────
  // Source-level guards ensure the formula structure doesn't silently disappear.
  // Runtime opacity assertions follow below using the extended body-highlighter mock.

  test('opacity formula: non-zero counts use 4-state colour vocabulary (VOCAB_WORKED/ATTENTION/OVERLOADED)', () => {
    expect(src).toContain('VOCAB_WORKED');
    expect(src).toContain('VOCAB_ATTENTION');
    expect(src).toContain('VOCAB_OVERLOADED');
  });

  test('opacity formula: zero-count regions use VOCAB_REST (faint, not invisible)', () => {
    expect(src).toContain('VOCAB_REST');
    // All four vocab constants must be present
    expect(src).toContain('heatmapColor');
  });

  // ── Runtime rendering — no crash on any edge case ────────────────────────────

  test('renders without throwing with typical non-empty heatmapCounts', () => {
    let root!: renderer.ReactTestRenderer;
    expect(() => {
      act(() => {
        root = renderer.create(<BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />);
      });
    }).not.toThrow();
    expect(root).toBeDefined();
  });

  test('renders without throwing when heatmapCounts is an empty object {}', () => {
    let root!: renderer.ReactTestRenderer;
    expect(() => {
      act(() => {
        root = renderer.create(<BodyDiagram heatmapCounts={{}} onSelect={() => {}} />);
      });
    }).not.toThrow();
    expect(root).toBeDefined();
  });

  test('renders without throwing when all counts are zero', () => {
    const zeroCounts: Partial<Record<PainRegion, number>> = {
      knee: 0,
      neck: 0,
      lower_back: 0,
    };
    let root!: renderer.ReactTestRenderer;
    expect(() => {
      act(() => {
        root = renderer.create(<BodyDiagram heatmapCounts={zeroCounts} onSelect={() => {}} />);
      });
    }).not.toThrow();
    expect(root).toBeDefined();
  });

  // ── Region hotspot testIDs present ───────────────────────────────────────────
  // h() hotspot paths render for the current view regardless of heatmap mode.

  test('all front-view region hotspot testIDs are present in heatmap mode', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />);
    });
    const frontRegions: PainRegion[] = [
      'neck',
      'front_shoulder',
      'elbow',

      'wrist',
      'core_ribs',
      'hip_groin',
      'knee',
      'calf_shin',
      'ankle_achilles',
      'chest',
      'bicep',
      'quads',
      'upper_back',
    ];
    for (const r of frontRegions) {
      expect(hasTestId(root, `body-diagram-region-${r}`)).toBe(true);
    }
  });

  test('all back-view region hotspot testIDs are present after switching to Back in heatmap mode', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />);
    });
    press(root, 'body-diagram-back');
    const backRegions: PainRegion[] = [
      'neck',
      'rear_shoulder',
      'upper_back',
      'lower_back',
      'elbow',

      'wrist',
      'lat_mid_back',
      'glutes',
      'hamstrings',
      'knee',
      'calf_shin',
      'ankle_achilles',
      'tricep',
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
          onSelect={(r) => {
            selected = r;
          }}
        />
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
          onSelect={(r) => {
            selected = r;
          }}
        />
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
      root = renderer.create(<BodyDiagram heatmapCounts={SAMPLE_COUNTS} onSelect={() => {}} />);
    });
    // selected is undefined in heatmap mode → label is null → hint text shown
    expect(hasText(root, 'Tap a region on the diagram')).toBe(true);
  });

  // ── Runtime opacity assertions (via extended body-highlighter mock) ───────────
  // BodyDiagram passes { slug, styles: { fill: 'rgba(r,g,b,opacity)' } } entries
  // to <Body data={...}>. The mock captures that array so tests can assert on the
  // actual computed opacity values.
  //
  // Slug mapping (FRONT_REGION_SLUGS in BodyDiagram.tsx):
  //   knee      → 'knees'     (JOINT_CLR: #4a7e9b)
  //   neck      → 'neck'      (JOINT_CLR: #4a7e9b)
  //   hip_groin → 'adductors' (JOINT_CLR: #4a7e9b)
  //
  // 4-colour vocabulary (heatmapColor):
  //   count=0          → VOCAB_REST      rgba opacity 0.55
  //   count=1          → VOCAB_WORKED    solid #4ade80 (bright green)
  //   count=2-3        → VOCAB_ATTENTION solid #fbbf24 (amber-400)
  //   count≥4          → VOCAB_OVERLOADED solid #f87171 (red-400)

  /** Parses the alpha component from an rgba(r,g,b,a) string (REST tier only). */
  function parseOpacity(fill: string): number {
    const m = fill.match(/rgba\(\d+,\d+,\d+,([\d.]+)\)/);
    if (!m) throw new Error(`Unexpected fill format: ${fill}`);
    return parseFloat(m[1]);
  }

  test('runtime colour: overloaded region (count≥4) gets solid fill (no alpha)', () => {
    act(() => {
      renderer.create(<BodyDiagram heatmapCounts={{ knee: 10 }} onSelect={() => {}} />);
    });
    const data = bodyHighlighterMock.getCapturedBodyData();
    expect(data).not.toBeNull();
    const kneeEntry = data!.find((e) => e.slug === 'knees');
    expect(kneeEntry).toBeDefined();
    // knee=10 → OVERLOADED → solid VOCAB_OVERLOADED
    expect(kneeEntry!.styles.fill).toBe('#f87171');
  });

  test('runtime opacity: zero-count region gets REST fill opacity 0.55 (faint, not invisible)', () => {
    // knee=10 is the only hot region; hip_groin is absent → count=0 → REST
    act(() => {
      renderer.create(<BodyDiagram heatmapCounts={{ knee: 10 }} onSelect={() => {}} />);
    });
    const data = bodyHighlighterMock.getCapturedBodyData();
    expect(data).not.toBeNull();
    const hipEntry = data!.find((e) => e.slug === 'adductors');
    expect(hipEntry).toBeDefined();
    // hip_groin count=0 → REST → opacity 0.55
    expect(parseOpacity(hipEntry!.styles.fill)).toBeCloseTo(0.55, 2);
  });

  test('runtime colour: three vocabulary tiers produce three distinct fills', () => {
    // knee=5 (OVERLOADED ≥4), neck=1 (WORKED =1), hip_groin=0 (REST =0)
    act(() => {
      renderer.create(<BodyDiagram heatmapCounts={{ knee: 5, neck: 1 }} onSelect={() => {}} />);
    });
    const data = bodyHighlighterMock.getCapturedBodyData();
    expect(data).not.toBeNull();
    const kneeEntry = data!.find((e) => e.slug === 'knees');
    const neckEntry = data!.find((e) => e.slug === 'neck');
    const hipEntry = data!.find((e) => e.slug === 'adductors');
    expect(kneeEntry).toBeDefined();
    expect(neckEntry).toBeDefined();
    expect(hipEntry).toBeDefined();
    // Active tiers use solid colours; REST uses rgba
    expect(kneeEntry!.styles.fill).toBe('#f87171'); // OVERLOADED
    expect(neckEntry!.styles.fill).toBe('#4ade80'); // WORKED
    expect(parseOpacity(hipEntry!.styles.fill)).toBeCloseTo(0.55, 2); // REST
    // All three fills are distinct
    expect(kneeEntry!.styles.fill).not.toBe(neckEntry!.styles.fill);
    expect(neckEntry!.styles.fill).not.toBe(hipEntry!.styles.fill);
    expect(kneeEntry!.styles.fill).not.toBe(hipEntry!.styles.fill);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [5] Stats — Pain Insight Sheet
//
// Two layers of test coverage:
//
//  a) Isolated unit tests — render <PainInsightSheet> directly with explicit
//     props and assert on testID presence and callback invocation.
//
//  b) Integration tests — render <StatsHeatmapHarness> which mirrors the
//     workouts.tsx heatmap section: it derives painRegionCounts from session
//     history, renders <BodyDiagram heatmapCounts={...}>, and wires
//     <PainInsightSheet> so that pressing "Start Targeted Prehab" calls
//     router.push() with the correct { painRegion, sessionType } params —
//     replicating the full workouts.tsx path end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the heatmap section of workouts.tsx:
 *   session history → painRegionCounts → BodyDiagram (heatmapCounts) →
 *   tap region → PainInsightSheet opens → Start Prehab → router.push()
 */
function StatsHeatmapHarness({
  sessions,
}: {
  sessions: Array<{ painRegion?: string; date: string }>;
}) {
  const [painInsightRegion, setPainInsightRegion] = React.useState<PainRegion | null>(null);

  const painRegionCounts = React.useMemo(() => {
    const counts: Partial<Record<PainRegion, number>> = {};
    for (const s of sessions) {
      if (s.painRegion) {
        const r = s.painRegion as PainRegion;
        counts[r] = (counts[r] ?? 0) + 1;
      }
    }
    return counts;
  }, [sessions]);

  return (
    // Wrap in View so root.toJSON() is a single node, not an array
    <View testID="stats-heatmap-harness">
      <BodyDiagram
        selected={undefined}
        onSelect={(r) => {
          if (r) setPainInsightRegion(r);
        }}
        heatmapCounts={painRegionCounts}
      />
      <PainInsightSheet
        region={painInsightRegion}
        sessionCount={painInsightRegion ? (painRegionCounts[painInsightRegion] ?? 0) : 0}
        onStartPrehab={(region) => {
          setPainInsightRegion(null);
          router.push({
            pathname: '/session',
            params: {
              sessionType: 'prehab',
              hasAches: 'false',
              painRegion: region,
              energy: 'normal',
              timeAvailable: '60',
              isTestWeek: 'false',
              equipment: 'bodyweight',
            },
          });
        }}
        onViewHistory={jest.fn()}
        onDismiss={() => setPainInsightRegion(null)}
      />
    </View>
  );
}

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
        />
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
        />
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
          region="elbow"
          sessionCount={5}
          onStartPrehab={jest.fn()}
          onViewHistory={jest.fn()}
          onDismiss={jest.fn()}
        />
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
        />
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
        />
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
        />
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
        />
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
        />
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
          />
        );
      });
    }).not.toThrow();
  });

  // ── Integration tests ──────────────────────────────────────────────────────
  // These render StatsHeatmapHarness and verify the full heatmap tap →
  // sheet open → navigation path, mirroring workouts.tsx end-to-end.

  beforeEach(() => {
    (router.push as jest.Mock).mockClear();
  });

  test('integration: tapping a heatmap region opens the sheet with the correct label', () => {
    const sessions = [
      { painRegion: 'knee', date: '2026-07-01' },
      { painRegion: 'knee', date: '2026-06-28' },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<StatsHeatmapHarness sessions={sessions} />);
    });
    // Sheet must not be visible before tapping
    expect(hasTestId(root, 'pain-insight-sheet')).toBe(false);
    // Tap the front-view knee hotspot (always rendered — front view is default)
    press(root, 'body-diagram-region-knee');
    // Sheet must now be visible with the correct region label
    expect(hasTestId(root, 'pain-insight-sheet')).toBe(true);
    expect(hasText(root, BODY_DIAGRAM_LABELS['knee'])).toBe(true);
  });

  test('integration: pressing Start Targeted Prehab calls router.push with the correct painRegion', () => {
    const sessions = [
      { painRegion: 'knee', date: '2026-07-01' },
      { painRegion: 'knee', date: '2026-06-28' },
    ];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<StatsHeatmapHarness sessions={sessions} />);
    });
    // Open sheet by tapping the knee region on the heatmap
    press(root, 'body-diagram-region-knee');
    expect(hasTestId(root, 'pain-insight-sheet')).toBe(true);
    // The count derived from session history must be shown
    expect(hasText(root, 'Flagged in 2 sessions')).toBe(true);
    // Press the primary CTA
    press(root, 'pain-insight-start-prehab');
    // router.push must have been called exactly once with the correct params
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/session',
        params: expect.objectContaining({
          sessionType: 'prehab',
          painRegion: 'knee',
        }),
      })
    );
  });

  test('integration: region absent from history (count=0) opens sheet without crash and navigates correctly', () => {
    // hip_groin has no sessions → count=0 → fallback label "Flagged in 1 session"
    const sessions = [{ painRegion: 'knee', date: '2026-07-01' }];
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<StatsHeatmapHarness sessions={sessions} />);
    });
    // Tap hip_groin (front view hotspot, always present regardless of count)
    press(root, 'body-diagram-region-hip_groin');
    expect(hasTestId(root, 'pain-insight-sheet')).toBe(true);
    // Count=0 → fallback message shown
    expect(hasText(root, 'Flagged in 1 session')).toBe(true);
    // Navigation still works for zero-count regions
    press(root, 'pain-insight-start-prehab');
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ painRegion: 'hip_groin' }),
      })
    );
  });
});
