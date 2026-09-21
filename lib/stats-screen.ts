/**
 * WHAT THE STATS TOUR SAYS, AND WHY IT IS NOT IN THE SCREEN.
 *
 * Same reason as lib/train-screen.ts. These cards are strings with no React in
 * them, they live on a screen a plain node check cannot import, and so the only
 * way a test could ask "does the tour still name a session the app has stopped
 * building" was to read app/(tabs)/workouts.tsx as text and match a regular
 * expression over it. That is this repo's commonest defect: the expression
 * matches the comment explaining why a word was removed exactly as readily as
 * the word itself, and there are several such comments on that screen.
 *
 * tests/copy-sweep.check.mjs imports this file and reads the sentences back.
 *
 * WHY THERE IS ONLY ONE CARD.
 * The second step was cut. It described "this week, your current streak and
 * your all-time total": a streak already explained on Home, over three zeroes
 * and an empty chart, with the words "fill in as you log sessions" admitting
 * there was nothing to look at. A tour card pointing at a blank panel is worse
 * than no card, because it spends the user's attention on the app's future
 * rather than on anything they can use now.
 */

export interface StatsTutorialStep {
  spotlightRef: 'tabs' | 'stats';
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
}

export const STATS_TUTORIAL: readonly StatsTutorialStep[] = [
  {
    spotlightRef: 'tabs',
    iconName: 'swap-horizontal-outline',
    iconLabel: 'Views',
    title: 'Four ways to look at your training',
    // Progress leads with the personal-best list now, so that is what it is
    // named by. "Volume and where the work landed" described the two sections
    // UNDER the one a user sees first.
    body: 'Overview for the big picture, Strength for your heaviest lifts and any maxes you have recorded, Progress for your personal bests and training volume, and History for every session you have logged.',
  },
] as const;
