/**
 * Whether this person has asked their phone to stop animating things.
 *
 * WHY IT DID NOT EXIST BEFORE
 * ───────────────────────────
 * Nothing in the app asked. Every animation until now was a short fade or a
 * spring on a button, which is unpleasant to ignore but survivable. The profile
 * tree is not: the whole screen travels, and for somebody with vestibular
 * sensitivity a page that moves itself every time they answer a question is the
 * reason they turned the setting on.
 *
 * It is also the first thing a new user sees, so a reduced-motion setting that
 * is ignored here is ignored at exactly the worst moment.
 *
 * Defaults to FALSE and then corrects itself, rather than the other way round.
 * The query is asynchronous, and a screen that starts still and then begins
 * animating reads worse than one that animates from the first frame.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!cancelled) setReduced(!!v);
      })
      .catch(() => {
        // Not supported on this platform. Animating is the right default.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduced(!!v)
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
