/**
 * Every equipment tile draws something.
 *
 * WHY A RENDER TEST AND NOT A UNIT TEST
 * ─────────────────────────────────────
 * tests/bench-choice.check.mjs proves the sixth tile is offered, is stored, is
 * not a rung and changes what somebody is given. All of that was true of the
 * tile that shipped on the readiness screen, and the tile was still broken:
 * it drew an empty grey banner beside five photographs, because there are five
 * pictures and six tiers and the screen rendered
 * `<Image source={EQUIPMENT_IMAGES[tier]} />` with nothing behind the lookup.
 *
 * That is the failure mode worth a render test. An <Image> with an undefined
 * source does not throw, does not warn and does not fall back: it lays out a
 * box of the right size and paints nothing in it. Typecheck is happy, because
 * `Partial<Record<...>>` says the lookup may be undefined and the Image prop
 * accepts it. Lint is happy. The bundle builds. Only looking at the screen, or
 * this, catches it.
 *
 * So: render the real readiness screen - the last screen before the weights
 * appear, and the one that shipped blank - and insist every tile on it draws
 * either a photograph with a real source or a line glyph. Then render the
 * shared component the other two pickers use, for every tier, and insist on
 * the same thing there.
 */

import React, { act } from 'react';
import renderer from 'react-test-renderer';

import ReadinessScreen from '../app/readiness';
import { EquipmentTileArt, hasEquipmentPhoto } from '../components/EquipmentTileArt';
import { PICKER_TIERS } from '../lib/equipment-picker';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const routerMock = require('../__mocks__/expo-router') as {
  __setParams: (p: Record<string, string>) => void;
  __clearParams: () => void;
};

type TreeNode = {
  type: string;
  props: Record<string, unknown>;
  children: (TreeNode | string)[] | null;
};

function walk(node: TreeNode | string | null, visit: (n: TreeNode) => void): void {
  if (!node || typeof node === 'string') return;
  visit(node);
  (node.children ?? []).forEach((c) => walk(c as TreeNode | string, visit));
}

function findByTestID(root: TreeNode | null, testID: string): TreeNode | null {
  let found: TreeNode | null = null;
  walk(root, (n) => {
    if (!found && n.props?.testID === testID) found = n;
  });
  return found;
}

/** A photograph that would actually paint: an Image with a source behind it. */
function photographs(node: TreeNode | null): TreeNode[] {
  const out: TreeNode[] = [];
  walk(node, (n) => {
    if (n.type === 'Image') out.push(n);
  });
  return out;
}

/** The line glyphs: the vector-icon mock renders them as `icon-<name>`. */
function glyphs(node: TreeNode | null): TreeNode[] {
  const out: TreeNode[] = [];
  walk(node, (n) => {
    const id = n.props?.testID;
    if (typeof id === 'string' && id.startsWith('icon-')) out.push(n);
  });
  return out;
}

function renderReadiness(): TreeNode | null {
  let root!: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(React.createElement(ReadinessScreen));
  });
  return root.toJSON() as unknown as TreeNode | null;
}

describe('the equipment tiles are never blank', () => {
  beforeEach(() => {
    routerMock.__setParams({ sessionType: 'squat', isTestWeek: 'false' });
  });
  afterEach(() => {
    routerMock.__clearParams();
  });

  test('the readiness picker offers every tile, and every tile draws something', () => {
    const tree = renderReadiness();
    const blank: string[] = [];
    const missing: string[] = [];

    for (const tier of PICKER_TIERS) {
      const tile = findByTestID(tree, `equipment-${tier}`);
      if (!tile) {
        missing.push(tier);
        continue;
      }
      const pictures = photographs(tile);
      // A tile that draws a photograph must have a source behind it; a tile
      // that draws no photograph must draw a glyph instead. Either way there
      // is ink in the frame, which is the whole claim.
      const painted =
        pictures.length > 0
          ? pictures.every((p) => p.props.source != null)
          : glyphs(tile).length > 0;
      if (!painted) blank.push(tier);
    }

    expect(missing).toEqual([]);
    expect(blank).toEqual([]);
  });

  test('the bench tile on the readiness picker draws a glyph, not an empty box', () => {
    const tree = renderReadiness();
    const tile = findByTestID(tree, 'equipment-bench');
    expect(tile).not.toBeNull();
    // No photograph exists for it, so there must be no Image at all rather
    // than an Image pointing at nothing.
    expect(photographs(tile)).toEqual([]);
    // Two glyphs: the equipment icon and the tick box's own.
    expect(glyphs(tile).length).toBeGreaterThanOrEqual(1);
  });

  test('a tile with a photograph on the readiness picker really has its source', () => {
    const tree = renderReadiness();
    for (const tier of PICKER_TIERS.filter((t) => hasEquipmentPhoto(t))) {
      const pictures = photographs(findByTestID(tree, `equipment-${tier}`));
      expect(pictures.length).toBe(1);
      expect(pictures[0].props.source).toBeTruthy();
    }
  });

  test('the shared tile art draws every tier the pickers can ask it for', () => {
    for (const tier of PICKER_TIERS) {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(React.createElement(EquipmentTileArt, { tier }));
      });
      const tree = root.toJSON() as unknown as TreeNode | null;
      const pictures = photographs(tree);
      const icons = glyphs(tree);
      if (hasEquipmentPhoto(tier)) {
        expect(pictures.length).toBe(1);
        expect(pictures[0].props.source).toBeTruthy();
      } else {
        // Nothing to photograph, so it must fall back rather than draw a box.
        expect(pictures).toEqual([]);
        expect(icons.length).toBe(1);
      }
    }
  });
});
