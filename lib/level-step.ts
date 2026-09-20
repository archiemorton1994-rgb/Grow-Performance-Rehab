import type { ExperienceLevel } from './store';
import { LIBRARY_LEVEL_NAMES, type LibraryLevel } from './exercise-library';
import { levelCeilingFor } from './library-session';

/**
 * OFFERING A HARDER LEVEL TO SOMEBODY WHO IS NOT ON A PROGRAMME.
 *
 * The programme report has offered a rung since blocks existed: finish one
 * comfortably and it says so, and nothing moves until the person accepts. Most
 * people are not on a programme, and for them the ceiling that decides which
 * movements they are ever shown was set once, at sign-up, and could never move
 * again. This is that offer for everybody else, made from the session summary,
 * on the one piece of evidence a rotation produces: logged sessions.
 *
 * WHAT IT WILL NOT DO
 * ───────────────────
 * IT NEVER OFFERS ATHLETE. Jumps, throws and the rest of the Athlete list are
 * where a physiotherapist's exercises stop being safe to hand somebody because
 * they have turned up sixteen times. Athlete is a thing a person chooses about
 * themselves on the experience page; it is never a reward. So the offer caps
 * at Advanced, which is also why Advanced itself is never offered a step: there
 * is nowhere above it this rule is willing to go.
 *
 * IT NEVER FIRES ON A PROGRAMME. A block is a plan somebody agreed to, and its
 * own report already offers the rung at the end of it. Two offers from two
 * screens, each with its own idea of what earns one, would mean the app asking
 * the same question twice and paying for it twice.
 *
 * IT CHANGES NOTHING BY ITSELF. Like the report's, it is a proposal. Accepting
 * goes through acceptLevelStep, which is the one action that writes the rung,
 * and "Not yet" is a real answer: the counter moves out by eight and the card
 * is gone until then.
 *
 * WHY A BONUS RATHER THAN A NEW EXPERIENCE LEVEL: see LevelStep in
 * lib/programme-report.ts. The short version is that the experience answer is
 * something somebody told us about their life outside the app, and the app
 * writing over it would leave the two of them sharing one box.
 */

/** The hardest level this offer will ever propose. Athlete is chosen, not given. */
export const LEVEL_STEP_CEILING: LibraryLevel = 3;

export interface LevelStepOffer {
  /** The level their sessions are built from today, and the one after this step. */
  from: LibraryLevel;
  to: LibraryLevel;
  /** Both levels in the onboarding wording, for the card. */
  fromName: string;
  toName: string;
  /** What to hand acceptLevelStep. See UserProfile.earnedLevelBonus. */
  toBonus: number;
}

export interface LevelStepInput {
  experienceLevel: ExperienceLevel;
  earnedLevelBonus?: number;
  /** Train sessions logged, counted through trainTypeOf. See countLiftingSessions. */
  liftingCount: number;
  /** The count at which the next offer is due, or null on a device never stamped. */
  levelStepDueAt: number | null;
  /** The enrolled block, if one is actually running. Paused counts as none. */
  programme: { paused?: boolean } | null;
}

/**
 * The offer to put on the session summary, or null for no offer.
 *
 * Pure, and takes the four facts rather than the store, so the rule can be run
 * on its own and a screen cannot quietly apply a fifth.
 */
export function levelStepOffer(i: LevelStepInput): LevelStepOffer | null {
  // A paused block is choosing nothing, which is the same rule Home follows.
  if (i.programme && !i.programme.paused) return null;

  const from = levelCeilingFor(i);
  if (from >= LEVEL_STEP_CEILING) return null;

  // Never stamped, so there is no honest way to say how many of these sessions
  // were trained at this level. See levelStepDueAt in lib/store.ts.
  if (typeof i.levelStepDueAt !== 'number' || !Number.isFinite(i.levelStepDueAt)) return null;
  if (i.liftingCount < i.levelStepDueAt) return null;

  const to = (from + 1) as LibraryLevel;
  return {
    from,
    to,
    fromName: LIBRARY_LEVEL_NAMES[from],
    toName: LIBRARY_LEVEL_NAMES[to],
    toBonus: Math.max(0, Math.floor(i.earnedLevelBonus ?? 0)) + 1,
  };
}

/**
 * WHAT THE LEVEL CONTROL ON PROFILE SAYS, AND WHETHER THERE IS A RUNG TO HAND
 * BACK.
 *
 * The level shown is the CEILING - what they said plus what they have taken -
 * because that is the number that decides which movements they are given, and
 * showing the experience answer on its own would tell somebody who has stepped
 * up twice that nothing had changed.
 *
 * Only the earned rung can be handed back here. The experience answer belongs
 * to the person, and the edit sheet is where they change it, so a step down
 * from a standing start is a different door rather than a smaller version of
 * this one.
 */
export interface LevelStanding {
  level: LibraryLevel;
  name: string;
  /** Rungs taken on top of the experience answer. */
  earned: number;
  /** The level they would be on after handing one back, or null if there is none. */
  down: { level: LibraryLevel; name: string } | null;
}

export function levelStandingFor(profile: {
  experienceLevel: ExperienceLevel;
  earnedLevelBonus?: number;
}): LevelStanding {
  const level = levelCeilingFor(profile);
  const earned = Math.max(0, Math.floor(profile.earnedLevelBonus ?? 0));
  const down =
    earned > 0
      ? (() => {
          const lower = levelCeilingFor({ ...profile, earnedLevelBonus: earned - 1 });
          return { level: lower, name: LIBRARY_LEVEL_NAMES[lower] };
        })()
      : null;
  return { level, name: LIBRARY_LEVEL_NAMES[level], earned, down };
}
