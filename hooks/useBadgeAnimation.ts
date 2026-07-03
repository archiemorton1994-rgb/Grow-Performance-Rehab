import { useRef, useState, useEffect } from 'react';

/**
 * Tracks which badge IDs are currently animating (pulse + glow ring).
 *
 * On mount, prevBadgeIdsRef is pre-seeded with the current earnedBadges so
 * that badges already earned before this render cycle (e.g. from a previous
 * app session loaded from storage) never retrigger on mount.
 *
 * When earnedBadges gains new IDs each badge is:
 *   - added to animatingBadgeIds at (index * 80) ms  — stagger ripple
 *   - removed from animatingBadgeIds at (index * 80 + 800) ms
 *
 * Returns the live Set<string> of IDs that should show their animation.
 */
export function useBadgeAnimation(earnedBadges: string[]): Set<string> {
  const prevBadgeIdsRef = useRef<Set<string>>(new Set(earnedBadges));
  const [animatingBadgeIds, setAnimatingBadgeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prev = prevBadgeIdsRef.current;
    const newIds = earnedBadges.filter(id => !prev.has(id));
    prevBadgeIdsRef.current = new Set(earnedBadges);

    if (newIds.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    newIds.forEach((id, i) => {
      const startDelay = i * 80;
      const clearDelay = startDelay + 800;

      timers.push(
        setTimeout(() => {
          setAnimatingBadgeIds(prev => new Set([...prev, id]));
        }, startDelay),
      );
      timers.push(
        setTimeout(() => {
          setAnimatingBadgeIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, clearDelay),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [earnedBadges]);

  return animatingBadgeIds;
}
