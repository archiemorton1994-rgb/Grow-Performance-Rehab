import type { ActiveSession } from './store';

/**
 * The route params that rebuild a saved session exactly as it was.
 *
 * Three screens offer a Resume button — Home, Train and the programme sheet —
 * and each wrote this object out longhand. All three replayed only the first
 * sore area, dropping the severity and the acute flag entirely, so the session
 * route rebuilt a DIFFERENT workout. The snapshot then failed its own
 * exercise-ID match and every logged set was discarded without a word, while
 * the card the user had just tapped still read "12/24 sets".
 *
 * One definition, so a param added to the session route cannot reach two of the
 * three Resume buttons. If you add a param here, add it to `snapshotContext` in
 * app/session.tsx too — they are the two halves of the same round trip.
 */
export function resumeParams(session: ActiveSession): Record<string, string> {
  return {
    sessionType: session.sessionType,
    hasAches: session.hasAches ? 'true' : 'false',
    // The session route reads this as a comma-separated list. Snapshots written
    // by older builds have only the single field, so fall back to it.
    painRegion: (session.painRegions?.length ? session.painRegions : [session.painRegion])
      .filter(Boolean)
      .join(','),
    ...(session.painSeverity ? { painSeverity: session.painSeverity } : {}),
    ...(session.acute !== undefined ? { acute: session.acute ? 'true' : 'false' } : {}),
    energy: session.energy,
    timeAvailable: session.timeAvailable,
    isTestWeek: session.isTestWeek ? 'true' : 'false',
    equipment: session.equipmentTier,
    ...(session.displayLabel ? { displayLabel: session.displayLabel } : {}),
  };
}
