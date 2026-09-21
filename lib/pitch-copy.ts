// Type-only on purpose: the one use below is `keyof typeof Ionicons.glyphMap`,
// and a value import would pull @expo/vector-icons into every node check that
// reads this file for its words.
import type { Ionicons } from '@expo/vector-icons';
import { distinctExerciseCount } from './exercise-db';
import { PAIN_ADAPTATION_REGION_COUNT } from './store';
import { TRAIN_SESSION_COUNT } from './train-screen';

/**
 * EVERY WORD THE APP USES TO SELL ITSELF, IN ONE PLACE THAT A TEST CAN RUN.
 *
 * WHY IT LEFT THE SCREENS
 * ───────────────────────
 * These sentences lived inside app/showcase.tsx and app/subscription.tsx, which
 * are React Native screens and so cannot be imported by a plain node check. The
 * only way a test could ask "does the pitch still name a session the app has
 * stopped building" was to read the screen as text and match a regular
 * expression over it, and this repo's commonest defect is exactly that: a
 * regular expression matches the comment explaining why a word was removed as
 * readily as the word itself.
 *
 * None of it is React. It is a list of strings and a list of numbers, so
 * tests/copy-sweep.check.mjs RUNS it and reads the actual sentences back.
 *
 * WHAT WAS WRONG WITH IT
 * ──────────────────────
 * Both surfaces printed the size of SESSION_META as the number of sessions on
 * offer. That table has ten entries and three of them are the old lift days,
 * kept so a session logged two years ago still has a name. So the showcase
 * promised "10 kinds of session, from a heavy squat day to ten minutes of
 * mobility" and the paywall printed a tile reading "10 session types", when
 * five is what the Train tab offers and a squat day has not been one of them
 * since the rotation changed. The number is TRAIN_SESSION_COUNT now, which is
 * counted off the tiles themselves.
 *
 * HOUSE STYLE, because this is the copy a stranger reads first: British
 * spelling, no long dashes, no emoji, and no number typed out by hand.
 */

export interface ShowcaseCard {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  proof?: string;
}

/** The four slides, in the order they are swiped. */
export const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    icon: 'rehab',
    eyebrow: 'Built by a physiotherapist',
    title: 'It trains around pain, not through it',
    body: `Say an area is sore and the session changes. The app takes out what would aggravate it, puts gentle work for that area in, and attaches a limit to stay inside. Not a lighter session. A different one.`,
    proof: `${PAIN_ADAPTATION_REGION_COUNT} areas you can flag, every one with rehab work behind it`,
  },
  {
    icon: 'trend',
    eyebrow: 'No spreadsheets',
    title: 'The weight moves itself',
    body: `Every load is worked out from what you actually lifted last time. Clear your reps and it climbs. Fall short and it holds. Come back from a break and it meets you where you are, then builds again.`,
    proof: 'Reps rise before weight does, which is why progress keeps going',
  },
  {
    icon: 'dumbbell',
    eyebrow: 'Whatever you have got',
    title: 'A full session in the space you have',
    body: `Tell it what equipment is around and how long you have got. Thirty minutes gets your warm-up, main exercise and an accessory. An hour gets the lot. A machine taken? Swap any exercise for the same movement with different kit.`,
    /**
     * Restore is named in words rather than folded into the number.
     *
     * The old line reached for mobility to show the range and then counted it
     * in a total about training, which is how "10 kinds of session" survived so
     * long: the number and the example were describing two different lists.
     */
    proof: `${TRAIN_SESSION_COUNT} kinds of training session, plus recovery and mobility work for the days in between`,
  },
  {
    icon: 'chart',
    eyebrow: 'It watches, so you do not have to',
    title: 'It tells you what it has noticed',
    body: `A lift that has stalled three sessions running. A personal best you did not clock. An ache you have now flagged five times in ten weeks, which is worth someone looking at. It says so, and it says what to do.`,
    proof: 'And you can hand the whole pain history to your physio in one tap',
  },
];

export interface PaywallStat {
  value: string;
  label: string;
}

/**
 * The three numbers along the top of the paywall.
 *
 * Built when the paywall first renders rather than when the bundle loads: the
 * exercise count walks every list a card can be built from, and this is the
 * only screen that wants it.
 *
 * "session types" became "ways to train" along with the number. The label was
 * the other half of the overclaim: a tile reading "10 session types" was
 * counting stored ids, and a person cannot choose a stored id. Five is what the
 * Train tab puts in front of them.
 */
export const paywallStats = (): PaywallStat[] => [
  { value: `${distinctExerciseCount()}+`, label: 'exercises' },
  { value: `${TRAIN_SESSION_COUNT}`, label: 'ways to train' },
  { value: `${PAIN_ADAPTATION_REGION_COUNT}`, label: 'pain zones' },
];

export interface PaywallBenefit {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

/**
 * Four rows, in the order somebody decides in.
 *
 * The first one is the only reason to pick this app over the ones already on
 * their phone. Every strength app moves the weight; every rehab app works
 * around pain. This is the one that does both, and for a long time the paywall
 * led with "Every session, planned", which is what Fitbod sells and sells
 * better. So the pain row goes first and the planning row goes second.
 *
 * The third row is the cheapest advantage the app has and the one it spent the
 * least words on. A real physiotherapist chose the exercises, the rep ranges
 * and the swaps. Nothing generated does that, and nobody reading a store page
 * can tell the difference unless it is said.
 *
 * "Never lose a session" came off. Resuming a workout is a thing an app should
 * do, not a thing anybody pays for, and it was taking the place of the row
 * about handing a pain history to a clinician, which nothing else offers.
 */
export const PAYWALL_BENEFITS: PaywallBenefit[] = [
  {
    icon: 'medkit-outline',
    title: 'Tell it where it hurts',
    body: `Flag any of ${PAIN_ADAPTATION_REGION_COUNT} areas and the session changes. What would aggravate it comes out, gentler work for that area goes in.`,
  },
  {
    icon: 'trending-up-outline',
    title: 'The weight moves itself',
    // Not "exercises, sets and weights". The exercises come from the rotation
    // and the pools, and the set counts come from the template plus your
    // readiness answers. What genuinely comes from last time is the load and
    // the rep target, and those are the parts worth claiming.
    body: 'Loads and rep targets come from what you actually lifted last time. Clear your reps and it climbs. Fall short and it holds.',
  },
  {
    icon: 'school-outline',
    title: 'Written by a physiotherapist',
    body: 'Every exercise, rep range and alternative was chosen by a sports physio, not pulled out of a generic library.',
  },
  {
    icon: 'stats-chart-outline',
    title: 'Proof it is working',
    body: '1RM trends, personal bests and your full history. Hand the whole pain record to your own physio in one tap.',
  },
];
