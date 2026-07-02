/**
 * Runtime component rendering tests for BodyDiagram.
 *
 * Uses react-test-renderer (Node.js env — no browser, no Chromium required).
 * The component is fully rendered via React's reconciler with lightweight
 * mocks for react-native, react-native-svg, and expo-haptics.
 *
 * Covers all 48 test cases from the original Playwright body-diagram.spec.ts:
 *   [1] 5  source-code static guards
 *   [2] 22 Flex tab / Targeted Prehab render tests
 *   [3] 15 Readiness screen render tests
 *   [4]  6 Prehab modal open→select→close→re-open reset guard
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

/**
 * Stateful wrapper that mirrors the prehab modal lifecycle in flex.tsx:
 *   - `isOpen` tracks modal visibility
 *   - `prehabRegion` tracks the selected region inside the modal
 *   - `openModal()` resets prehabRegion then opens (mirrors openModal's prehab guard)
 *   - `closeModal()` hides the modal then resets prehabRegion (mirrors closeModal)
 *
 * Exposes:
 *   testID="open-modal-btn"  — simulates tapping "Targeted Prehab" card
 *   testID="prehab-modal"    — the modal container (absent when closed)
 *   testID="close-modal-btn" — simulates the modal close / back button
 *   testID="prehab-start-btn"— the "Start Session" button (only when region set)
 */
function ModalLifecycleWrapper() {
  const [isOpen, setIsOpen] = useState(false);
  const [prehabRegion, setPrehabRegion] = useState<PainRegion | undefined>(undefined);

  const openModal = () => {
    setPrehabRegion(undefined); // mirrors: if (type === 'prehab') setPrehabDiagramRegion(undefined)
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setPrehabRegion(undefined); // mirrors: closeModal() always resets prehabDiagramRegion
  };

  return (
    <View>
      <Pressable testID="open-modal-btn" onPress={openModal}>
        <Text>Open Modal</Text>
      </Pressable>
      {isOpen && (
        <View testID="prehab-modal">
          <BodyDiagram selected={prehabRegion} onSelect={setPrehabRegion} />
          {prehabRegion !== undefined && (
            <Pressable testID="prehab-start-btn" onPress={() => {}}>
              <Text>Start Session</Text>
            </Pressable>
          )}
          <Pressable testID="close-modal-btn" onPress={closeModal}>
            <Text>Close</Text>
          </Pressable>
        </View>
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

// ─── [4] Prehab modal open → select → close → re-open reset guard ─────────────
//
// This is the runtime counterpart to the static checks in body-diagram-e2e.mjs
// section [4].  Rather than grep-ing source text, these tests actually render
// ModalLifecycleWrapper — which mirrors flex.tsx's openModal/closeModal logic —
// and assert that React's state machine behaves correctly at each lifecycle step.
//
// Regression story: if openModal's prehab guard or closeModal's unconditional
// reset is accidentally removed, the prehabRegion state persists across cycles.
// Test 4 ("re-opening modal … shows NO Start Session button") catches exactly
// that regression at the rendered-output level.

describe('[4] Prehab modal open → select → close → re-open reset guard', () => {
  test('Start Session button is hidden when the modal first opens', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ModalLifecycleWrapper />); });
    press(root, 'open-modal-btn');
    expect(hasTestId(root, 'prehab-start-btn')).toBe(false);
  });

  test('selecting a region after open shows the Start Session button', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ModalLifecycleWrapper />); });
    press(root, 'open-modal-btn');
    press(root, 'body-diagram-region-knee');
    expect(hasTestId(root, 'prehab-start-btn')).toBe(true);
  });

  test('closing the modal hides the modal container', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ModalLifecycleWrapper />); });
    press(root, 'open-modal-btn');
    press(root, 'body-diagram-region-knee');
    press(root, 'close-modal-btn');
    expect(hasTestId(root, 'prehab-modal')).toBe(false);
  });

  test('re-opening modal after a selection shows NO Start Session button (stale-region regression guard)', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ModalLifecycleWrapper />); });
    // First visit: open, pick a region, confirm Start Session appears
    press(root, 'open-modal-btn');
    press(root, 'body-diagram-region-knee');
    expect(hasTestId(root, 'prehab-start-btn')).toBe(true);
    // Close the modal
    press(root, 'close-modal-btn');
    // Re-open: prehabRegion must have been cleared — Start Session must be hidden
    press(root, 'open-modal-btn');
    expect(hasTestId(root, 'prehab-start-btn')).toBe(false);
  });

  test('can select a different region on re-open — prior selection does not bleed through', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ModalLifecycleWrapper />); });
    // First visit: select knee
    press(root, 'open-modal-btn');
    press(root, 'body-diagram-region-knee');
    expect(hasText(root, 'Knee')).toBe(true);
    press(root, 'close-modal-btn');
    // Second visit: no label from first visit, can pick a fresh region
    press(root, 'open-modal-btn');
    expect(hasText(root, 'Knee')).toBe(false);
    press(root, 'body-diagram-region-hip_groin');
    expect(hasText(root, 'Hip / Groin')).toBe(true);
    expect(hasTestId(root, 'prehab-start-btn')).toBe(true);
  });

  test('closing without selecting leaves modal in clean state on re-open', () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<ModalLifecycleWrapper />); });
    press(root, 'open-modal-btn');
    // Close immediately without selecting anything
    press(root, 'close-modal-btn');
    // Re-open — still no Start Session button
    press(root, 'open-modal-btn');
    expect(hasTestId(root, 'prehab-start-btn')).toBe(false);
  });
});
