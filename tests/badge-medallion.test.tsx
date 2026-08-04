/**
 * Every badge in the catalogue must actually render.
 *
 * WHY THIS MATTERS
 * ────────────────
 * BadgeMedallion is reachable from the HOME screen, not just the achievements
 * screen: app/_layout.tsx shows AchievementUnlockedSheet whenever
 * newlyUnlockedBadges is non-empty, and that sheet draws a medallion. That queue
 * is PERSISTED (lib/store.ts partialize keeps it), so a medallion that throws
 * during render does not just break one popup — it leaves an undismissable
 * modal that comes back on every cold start. The user cannot clear it by
 * restarting, only by wiping app data.
 *
 * BadgeMedallion indexes two tables by values that come from the badge:
 *   BADGE_GLYPHS[category] and TIER_METALS[tier]
 * A miss on either gives `undefined`, and the next line dereferences it. Neither
 * typecheck nor lint nor a Metro bundle catches that, because the types line up
 * — only the runtime values can be wrong.
 *
 * So: render every badge in the catalogue, earned and locked, at both the sizes
 * the app uses (the rim decoration is size-gated, so the small path and the
 * detailed path are different code).
 */
import React from 'react';
import renderer from 'react-test-renderer';
import { BadgeMedallion } from '@/components/BadgeMedallion';
import { BADGE_CATALOG, BADGE_CATEGORY_ORDER } from '@/lib/badges';

describe('BadgeMedallion', () => {
  it('renders every badge in the catalogue without throwing', () => {
    const failures: string[] = [];
    for (const badge of BADGE_CATALOG) {
      for (const size of [52, 104]) {
        for (const locked of [false, true]) {
          try {
            const tree = renderer.create(
              <BadgeMedallion
                category={badge.category}
                tier={badge.tier}
                locked={locked}
                size={size}
              />
            );
            tree.unmount();
          } catch (e) {
            failures.push(
              `${badge.id} (${badge.category}/${badge.tier}, size ${size}, locked ${locked}): ${
                (e as Error).message
              }`
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('covers every category with a drawing', () => {
    for (const category of BADGE_CATEGORY_ORDER) {
      expect(() => {
        renderer.create(<BadgeMedallion category={category} tier="gold" size={62} />).unmount();
      }).not.toThrow();
    }
  });

  it('renders the laurelled top tier, which has the most geometry', () => {
    expect(() => {
      renderer.create(<BadgeMedallion category="milestone" tier="grow" size={124} />).unmount();
    }).not.toThrow();
  });
});
