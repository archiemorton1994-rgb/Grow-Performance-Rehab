/**
 * WHAT THE TRAIN TAB OFFERS, AND WHAT ITS TOUR SAYS ABOUT IT.
 *
 * All of this used to live inside app/(tabs)/train.tsx, which is a React Native
 * screen and therefore cannot be imported by a plain node check. So the only way
 * a test could ask "does any tile on Train still say KPI" was to read the screen
 * as text and match a regular expression over it - which is this repo's named
 * commonest defect, because a regular expression matches the comment explaining
 * a word as readily as the word itself.
 *
 * The list, the labels and the tour cards are plain data with no React in them,
 * so tests/non-kpi-user.check.mjs RUNS them: it asks for the label of every tile
 * the tab draws and reads the actual string back.
 *
 * WHAT THE TAB SHOWS, AND WHY IT IS ONE GRID.
 *
 * It used to be two. A "KPI Sessions" grid of Squat, Bench, Deadlift and
 * Custom, above an "Additional Sessions" grid of Lower, Upper, Full Body and
 * Conditioning. Once the three lift-named ids stopped naming a session of their
 * own (see lib/session-type.ts) the top grid quietly became Lower Body, Upper
 * Body and Full Body as well: the same three names, subtitles, icons and
 * photographs, printed twice on one screen, under a heading that defined them as
 * "Key Performance Indicator lifts: Squat, Bench, and Deadlift".
 *
 * There is one grid now and it holds the five things a person can choose, in the
 * order Archie asked for. Programmes sit beneath it as their own row, because a
 * programme is not a session: it is an optional plan that chooses sessions for
 * you, and the row says so.
 */
import { SESSION_META } from './session-meta';
import type { TrainSessionType } from './session-type';

/**
 * The five sessions the Train tab offers, in the order they are drawn.
 *
 * Typed against TrainSessionType, so 'squat', 'bench' and 'deadlift' cannot be
 * put back on this screen without failing the typecheck first.
 */
export const TRAIN_SESSION_TYPES: TrainSessionType[] = [
  'full_body',
  'upper_body',
  'lower_body',
  'conditioning',
  'custom',
];

/**
 * THE ONLY SESSION COUNT ANY COPY MAY QUOTE.
 *
 * Counted off the list above, so it is the number of things a person can
 * actually tap. The showcase and the paywall both used to print the size of
 * SESSION_META instead, which is ten: the seven the app builds plus the three
 * lift ids kept only for reading old history back. "10 kinds of session, from a
 * heavy squat day" was therefore advertising two sessions that do not exist and
 * one that has not existed since the rotation changed, and it could not
 * self-correct, because the table it counted was still honestly ten long.
 *
 * Prehab and Flexibility are not in it. They are Restore, they are chosen on a
 * different tab, and any copy that wants to claim them has to say so in words
 * rather than quietly add two to a number about training.
 */
export const TRAIN_SESSION_COUNT = TRAIN_SESSION_TYPES.length;

/**
 * The one name on this tab that is not the name history uses.
 *
 * A finished custom session is filed as "Custom" everywhere it is read back -
 * in history, in the resume banner, on the summary - and that is the right word
 * for a thing that has already been made. It is the wrong word for a tile you
 * have not tapped yet, which is an invitation rather than a label, so the tile
 * says what tapping it does.
 */
const TRAIN_TILE_LABEL_OVERRIDES: Partial<Record<TrainSessionType, string>> = {
  custom: 'Build your own',
};

/** The name printed on a Train tile. */
export function trainTileLabel(type: TrainSessionType): string {
  return TRAIN_TILE_LABEL_OVERRIDES[type] ?? SESSION_META[type].label;
}

/** The line under the name on a Train tile. */
export function trainTileSubtitle(type: TrainSessionType): string {
  return SESSION_META[type].subtitle;
}

/**
 * The Programmes row, under the grid.
 *
 * Archie's first decision is that nothing is named after a lift; his twelfth is
 * that the barbell programmes stop being offered to new people. Both of those
 * are about what the app pushes, and this row is the other half of it: a
 * programme is available, it is not required, and choosing a session above costs
 * a programme nothing. That sentence has to be on the screen somebody starts
 * their training from, not only in a tour card they may have skipped.
 */
export const PROGRAMMES_ENTRY = {
  label: 'Programmes',
  subtitle: 'Optional. Pick one and your sessions are chosen for you, week by week.',
} as const;

export interface TrainTutorialStep {
  spotlightRef: 'equipment' | 'sessions' | 'custom';
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
}

export const TRAIN_TUTORIAL: readonly TrainTutorialStep[] = [
  {
    spotlightRef: 'equipment',
    iconName: 'barbell-outline',
    iconLabel: 'Equipment',
    title: 'Your equipment for today',
    body: "Tap here to change what's available just for this session, it won't touch your saved profile equipment.",
  },
  {
    spotlightRef: 'sessions',
    iconName: 'flash-outline',
    iconLabel: 'Sessions',
    title: 'Pick any of these, any time',
    // Absorbed the old "Every other way to train" step. That one spotlighted a
    // section headed ADDITIONAL SESSIONS containing four cards named Lower
    // Body, Upper Body, Full Body and Conditioning, to say they were four ways
    // to train: a card spent telling the user what they were already reading.
    // The sentence Archie asked for, on the screen it is about: choosing a
    // session here is free, and the programme is not the whole app.
    body: 'Every session in Grow is here whether you are on a programme or not. Nothing you pick here moves your programme along or sets it back: it is logged, it counts towards your records, and your block waits where it was.',
  },
  {
    // Same region as the step above, since Build your own sits in that grid, but
    // it is a different idea and was going unexplained. The builder is the only
    // place in the app that asks how long you have got, and a user who never
    // opens it never finds that out.
    spotlightRef: 'custom',
    iconName: 'construct-outline',
    iconLabel: 'Custom',
    title: 'Or build your own',
    body: 'Build your own asks what you are training for and how long you have (30, 45 or 60 minutes), then builds to fit. Your warm-up, mobility, activation and main exercise are always kept.',
  },
] as const;
