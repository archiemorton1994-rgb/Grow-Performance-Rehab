import { LIBRARY_EXERCISES } from './exercise-library';
import type { Exercise } from './workout-engine';

/**
 * THE PRACTICE SESSION, AND THE TOUR THAT TALKS OVER IT.
 *
 * WHY THEY ARE NOT IN app/session.tsx ANY MORE
 * ────────────────────────────────────────────
 * Same reason as lib/train-screen.ts and lib/stats-screen.ts. Both are plain
 * data, the screen they lived on cannot be imported by a node check, and so the
 * only way to test what the practice session shows was a regular expression
 * over six thousand lines of screen - which matches a comment about an exercise
 * as readily as the exercise itself.
 *
 * WHY THE DEMO IS BUILT FROM THE LIBRARY AND NOT TYPED OUT
 * ───────────────────────────────────────────────────────
 * This is the first session almost everybody sees. It runs before the paywall,
 * off the last showcase slide, so for most people it is the whole experience of
 * the app before they decide whether to pay for it.
 *
 * It used to be four hand-written exercises: Barbell Back Squat, Romanian
 * Deadlift, Lying Leg Curl and Dead Bug, with Goblet Squat, Barbell Reverse
 * Lunge, Dumbbell RDL and Back Extension offered as their alternatives. Seven
 * of those eight names are not on Archie's list, so the demonstration session
 * was advertising movements the app cannot prescribe: somebody could pay,
 * open Train, and never once be given the exercise that sold it to them.
 *
 * So every card here is a real library record, looked up by id. The name, the
 * sets, the reps, the coaching cue and the video all come from the record, and
 * a record that leaves the library takes the demo card with it rather than
 * leaving a stale name behind. tests/copy-sweep.check.mjs holds every name on
 * this screen - the exercises and both alternatives of each - to the library.
 *
 * WHAT THE FOUR ARE, AND WHY
 * ──────────────────────────
 * A full body session at the kit tier most people have: squat, hinge, push,
 * core. Full Body is what a beginner is offered every time (Archie's second
 * decision), so it is the honest thing to show somebody who has not started.
 * The first card carries a load, because the tour's second and third steps are
 * about logging a weight and saying how it felt, and a bodyweight card would
 * leave them narrating boxes that are not there.
 *
 * Nothing logged here is ever persisted; see tests/demo-session-no-persist.
 */

/** A library record by id, or a loud failure. Ids are checked by the tests. */
function record(id: string) {
  const found = LIBRARY_EXERCISES.find((e) => e.id === id);
  if (!found) throw new Error(`demo session references an exercise that is not in the library: ${id}`);
  return found;
}

/**
 * THE CARD KEEPS A demo- ID OF ITS OWN, AND THAT IS DELIBERATE.
 *
 * Everything a person has ever lifted is filed under the id of the exercise
 * they did, and the session screen looks three things up by the id ON THE CARD:
 * their best ever weight for it, the average from their last session, and the
 * weight and reps of the last completed set. None of those reads is behind the
 * isDemo guard, because the guard is about WRITES.
 *
 * So a card carrying `sq-main-db` in the practice session would be served the
 * real goblet squat history of anybody who has one. The tour is run again from
 * Profile, months in: a user who goblet squats 32 kg would open the practice
 * session, find the boxes prefilled with 32 rather than the 16 the card says,
 * and could set off a personal-best flash on a session that is not real.
 *
 * The prescription comes from the library; the id does not. Prefixing it means
 * the lookups miss, exactly as they did when the whole card was hand-written.
 */
const demoIdFor = (libraryId: string) => `demo-${libraryId}`;

interface DemoCard {
  /** The library record this card prescribes. */
  id: string;
  category: Exercise['category'];
  /** Display text for the working weight; absent for bodyweight work. */
  load?: string;
  /** The same movement with different kit. */
  swap?: { id: string; load?: string; reason: string };
  /** A different movement for the same muscles. */
  swap2?: { id: string; load?: string; reason: string };
}

const DEMO_CARDS: DemoCard[] = [
  {
    id: 'sq-main-db', // Kettlebell Goblet Squats
    category: 'main',
    load: '16 kg',
    swap: { id: 'cond-db-e-6b', load: '12 kg', reason: 'Same movement, dumbbells instead.' },
    swap2: {
      id: 'lib-lunge-kettlebell-reverse-lunges',
      load: '12 kg',
      reason: 'Different exercise, same legs.',
    },
  },
  {
    id: 'ch-kb-romanian-deadlift', // Kettlebell Romanian Deadlift
    category: 'main',
    load: '20 kg',
    swap: { id: 'lib-hinge-cable-romanian-deadlift', load: '25 kg', reason: 'Same movement on a cable.' },
    swap2: { id: 'sq-acc-bw-2', reason: 'Different exercise, same glutes and hamstrings.' },
  },
  {
    id: 'bn-main-db', // Dumbbell Bench Press
    category: 'main',
    load: '20 kg',
    swap: { id: 'bn-main-bw', reason: 'Same movement, nothing but you.' },
    swap2: { id: 'bn-acc-db-13', load: '12 kg', reason: 'Different exercise, same shoulders and triceps.' },
  },
  {
    id: 'sq-acc-bw-17', // Deadbug
    category: 'accessory',
  },
];

export const DEMO_EXERCISES: Exercise[] = DEMO_CARDS.map((card) => {
  const main = record(card.id);
  const swap = card.swap ? record(card.swap.id) : null;
  const swap2 = card.swap2 ? record(card.swap2.id) : null;
  return {
    id: demoIdFor(main.id),
    name: main.name,
    sets: main.sets,
    reps: main.reps,
    cue: main.cue,
    suggestedLoad: card.load ?? 'Bodyweight',
    category: card.category,
    badge: undefined,
    videoId: main.videoId ?? '',
    hasSwap: swap !== null,
    ...(swap && card.swap
      ? {
          swapId: demoIdFor(swap.id),
          swapName: swap.name,
          swapCue: swap.cue,
          swapLoad: card.swap.load ?? 'Bodyweight',
          swapKind: 'equipment' as const,
          swapReason: card.swap.reason,
        }
      : {}),
    ...(swap2 && card.swap2
      ? {
          swap2Id: demoIdFor(swap2.id),
          swap2Name: swap2.name,
          swap2Cue: swap2.cue,
          swap2Load: card.swap2.load ?? 'Bodyweight',
          swap2Kind: 'movement' as const,
          swap2Reason: card.swap2.reason,
        }
      : {}),
  };
});

export interface SessionTutorialStep {
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
  /** Override the default 190px card-to-bottom offset for steps that spotlight elements near the bottom bar. */
  bottomOffset?: number;
  /** Which UI ref to spotlight for this step. */
  spotlightRef: 'firstCardHeader' | 'sessionBar' | 'progressBar';
  /** Narrow the spotlight to one element inside the region the step is really
   *  about (e.g. a specific icon button). Only meaningful with tightSpotlight. */
  spotlightTarget?: 'detailsToggle';
  /** When true (requires spotlightTarget), the spotlight cutout tightly hugs
   *  the spotlightTarget element itself instead of the whole spotlightRef
   *  region - use when the step is only about one icon, not the card in general. */
  tightSpotlight?: true;
  /** If true, this step is skipped for session types that don't use weight logging (prehab, flexibility). */
  requiresWeightLogging?: true;
  /** Demo mode only: force the session bar into its post-set feedback UI
   *  (Too Easy / OK / Hard) for the duration of this step, regardless of
   *  whether the user actually tapped the demo's log-set button - the demo
   *  doesn't process real taps, so without this the step would narrate a
   *  UI that never actually appears. */
  demoForceFeedback?: true;
}

export const SESSION_TUTORIAL: readonly SessionTutorialStep[] = [
  {
    spotlightRef: 'firstCardHeader',
    iconName: 'barbell-outline',
    iconLabel: 'Exercise',
    title: 'Your first exercise',
    // One exercise on screen at a time now, so the old "work through them in
    // order" is not advice, it is a description of what the screen does. The
    // video is still a red YouTube glyph and still opens a search when that
    // movement has not been filmed, which is most of them, so it is worth
    // saying rather than looking like a fault.
    body: 'One exercise at a time, so nothing else is in the way. The red button opens a form demo, and if that movement has not been filmed yet it opens a search instead.',
  },
  {
    spotlightRef: 'sessionBar',
    requiresWeightLogging: true,
    iconName: 'create-outline',
    iconLabel: 'Log sets',
    title: 'Log every set',
    // "Type the weight and reps" asks for work the app has already done: both
    // boxes arrive filled in with the prescription, so a set that went to plan
    // is one tap. And the reps are not decoration - logging under the range
    // holds the weight where it is. That rule was invisible everywhere.
    body: 'Both boxes arrive filled in, so a set that went to plan is one tap on Did It. The weight is a suggestion and not an instruction: change it to whatever you actually lift, and the next one starts closer. Log fewer reps than asked and the app holds your weight there rather than adding to it.',
  },
  {
    spotlightRef: 'sessionBar',
    requiresWeightLogging: true,
    iconName: 'happy-outline',
    iconLabel: 'Feedback',
    title: 'Tell us how it felt',
    // Says what the answer is FOR. The tour used to describe only the
    // in-session effect, so the single biggest thing these taps do - set the
    // weight you are given next week - went unexplained, and an answer whose
    // consequence you cannot see is one people stop giving.
    body: 'After each set, tap Easy, Challenging or Too Hard. It changes your next set straight away, and it sets the weight you start with next time. Say Challenging with sets still to come and it offers a way out as well: one more set lighter, or move on keeping everything you have logged.',
    demoForceFeedback: true,
  },
  {
    spotlightRef: 'firstCardHeader',
    spotlightTarget: 'detailsToggle',
    tightSpotlight: true,
    iconName: 'help-circle-outline',
    iconLabel: 'Details',
    title: 'Everything else is in here',
    // Swap moved out of this panel to the row beside the video, so the copy
    // points at where it actually is. It still has to name BOTH kinds it
    // offers - naming one was the half-truth this sentence was rewritten for.
    body: 'The coaching cue, the target weight, how hard to push, and somewhere to leave yourself a note. The two arrows beside the video swap the exercise: the same exercise with different equipment, or a different exercise for the same muscles.',
  },
  {
    spotlightRef: 'progressBar',
    iconName: 'stats-chart-outline',
    iconLabel: 'Progress',
    title: "You're on your way",
    body: 'The row of marks at the top is the whole session, one for each exercise, with a finish line at the end. Tap it any time to see the full list, or to go back to something you think you logged wrong.',
  },
];
