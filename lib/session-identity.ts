/**
 * WHAT KIND OF SESSION THIS IS, SAID IN COLOUR.
 *
 * THE PROBLEM. Every session looked identical. Squat day, deadlift day, a
 * mobility session from the Restore tab: same green, same card, same
 * everything, and the only thing telling them apart was the title. Reported as
 * "I just think adding variation so they feel more like, OK this is a squat
 * session, or a deadlift session".
 *
 * SO EACH SESSION TYPE OWNS A HUE, and it is used in exactly three places: the
 * rail down the side of the exercise card, the marks in the progress strip, and
 * the small furniture on the card that used to be green. Nothing else. The one
 * button that finishes a set stays the brand green on every session, because
 * the thing you press must not move or change colour depending on what day it
 * is.
 *
 * TWO SHADES PER SESSION, and both are needed.
 *
 *   `deep`   goes ON the page - the exercise card is a fixed ecru, light in
 *            every theme, so anything drawn on it has to be dark.
 *   `bright` goes on the APP's own background, which is near-black in the dark
 *            theme most people use. `deep` there is a smudge.
 *
 * The same hue at two lightnesses reads as one identity. One value could not
 * serve both grounds without being illegible on one of them.
 *
 * THE PAGE ITSELF is fixed, not themed. That is the point of it: the exercise
 * you are doing should be the brightest, most obviously separate thing on the
 * screen whichever theme somebody runs. It is the same parchment as the session
 * summary certificate, so finishing a session lands on paper you have been
 * looking at for an hour.
 */
import type { SessionType } from './store';

export interface SessionIdentity {
  /** For ink and rails ON the ecru page. Dark enough to read on parchment. */
  deep: string;
  /** For marks on the app's own background, which is near-black in dark mode. */
  bright: string;
  /** A wash of the hue for fills on the page. Always subtle. */
  wash: string;
}

/**
 * The page the exercise card is printed on.
 *
 * Same family as SAGE in app/session-summary.tsx, which is itself taken from
 * the Grow logo's mark-on-parchment colouring. Fixed in both themes on purpose.
 */
export const PAGE = {
  /** The card. */
  bg: '#f7f1df',
  /** The lower edge, for a gradient that reads as paper rather than as card. */
  bgEdge: '#eee2c4',
  /** Body text. */
  ink: '#1b2a21',
  /** Labels and secondary lines. */
  inkMuted: '#4f5c50',
  /** Anything that should recede. */
  inkFaint: '#77826f',
  /** Rules and separators. */
  hairline: 'rgba(27,42,33,0.16)',
  /** A slightly warmer inset panel, for blocks within the page. */
  inset: '#efe6cb',
  /** A caution note on parchment. The themed warning token is tuned for the
   *  app background and sits at about 2:1 on cream. */
  warn: '#8a5300',
  /** The surround for the YouTube button. Its red is a brand mark and stays
   *  itself; only the tile behind it is lightened to sit on paper. */
  videoBg: '#fbe4e4',
  videoBorder: '#efc0c0',
} as const;

/**
 * Ten hues, spread round the wheel so no two sessions are mistakable at a
 * glance. Every `deep` clears 4.5:1 on PAGE.bg and every `bright` clears 4.5:1
 * on the dark theme's background - asserted in tests/session-identity.check.mjs
 * rather than trusted, because a palette picked by eye drifts the first time
 * somebody adds an eleventh.
 */
export const SESSION_IDENTITY: Record<SessionType, SessionIdentity> = {
  // The three KPI lifts get the three strongest, most distinct hues, because
  // they are the sessions somebody does most often and most needs to recognise.
  // Cyan-blue rather than the royal blue it started as. That one sat 15
  // degrees from the assistant's sapphire, and the assistant is the single
  // thing in this app whose colour is supposed to mean only itself - on the
  // session people run most often, its button stopped announcing what it was.
  squat: { deep: '#14607f', bright: '#52b7e0', wash: 'rgba(20,96,127,0.10)' },
  bench: { deep: '#9d4413', bright: '#ef9152', wash: 'rgba(157,68,19,0.10)' },
  deadlift: { deep: '#5a3690', bright: '#b18ee6', wash: 'rgba(90,54,144,0.10)' },

  upper_body: { deep: '#0b6059', bright: '#45bdb0', wash: 'rgba(11,96,89,0.10)' },
  lower_body: { deep: '#7a5a0f', bright: '#e0b04a', wash: 'rgba(122,90,15,0.10)' },
  // Full body keeps the brand green: it is the session that is everything.
  full_body: { deep: '#2f6b46', bright: '#5ddc93', wash: 'rgba(47,107,70,0.10)' },

  conditioning: { deep: '#95213c', bright: '#f0768c', wash: 'rgba(149,33,60,0.10)' },

  // The Restore family sits in the cooler, calmer half deliberately. These are
  // the sessions somebody does when something hurts.
  // Plum, not the steel blue it started as: that sat 15 degrees from squat's
  // blue, which is close enough that the two sessions read the same at a
  // glance. The check measures hue separation for exactly this reason.
  prehab: { deep: '#8a2f79', bright: '#d97ec6', wash: 'rgba(138,47,121,0.10)' },
  flexibility: { deep: '#4a662d', bright: '#a5cd6f', wash: 'rgba(74,102,45,0.10)' },

  // A quiet lavender rather than another saturated violet. The saturated one
  // sat only 9.7 deltaE from deadlift as a chart mark - hue-separated on paper
  // and the same swatch to a reader, which the stats donut showed up. Custom is
  // the session somebody built themselves, so reading as the quiet one among
  // nine prescribed colours suits it.
  custom: { deep: '#403c88', bright: '#bdbae8', wash: 'rgba(64,60,136,0.10)' },
};

/** Never throws: an unknown type reads as a custom session. */
export function sessionIdentity(type: SessionType | string | undefined): SessionIdentity {
  return SESSION_IDENTITY[type as SessionType] ?? SESSION_IDENTITY.custom;
}
