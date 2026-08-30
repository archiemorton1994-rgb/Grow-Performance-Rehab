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
 * glance, and SATURATED. The first version was tuned only for legibility and
 * came out a set of pastels: "the rest are too pastel, they need to be harsher
 * and more distinct".
 *
 * Every value below is the MOST SATURATED colour at its hue that still meets
 * every rule the suite enforces - white readable on `deep`, `deep` readable on
 * the recap page, `bright` readable on black AND readable as a fill with near
 * black text on it. Eight of the ten come out at full saturation. They were
 * solved for rather than picked, because a set of ten that has to satisfy four
 * contrast rules, an 18 degree hue separation, a no-go zone around the
 * assistant's sapphire and a deltaE floor between every pair is not something
 * anybody gets right by eye.
 *
 * THE ASSIGNMENTS ARE ARCHIE'S: bench red, deadlift yellow, custom orange,
 * flexibility purple, prehab untouched. The four he did not name moved out of
 * their way - lower body from bronze, which collided with the new yellow, and
 * conditioning from crimson, which collided with the new red.
 */
export const SESSION_IDENTITY: Record<SessionType, SessionIdentity> = {
  // The three KPI lifts. Squat kept its cyan-blue, which was the one he said
  // was fine; it is only more saturated. It cannot go bluer than this: the
  // assistant's sapphire sits at 224 degrees and is the one colour in this app
  // that has to mean only itself.
  squat: { deep: '#0073a8', bright: '#0092d6', wash: 'rgba(0,115,168,0.10)' },
  bench: { deep: '#d61200', bright: '#ff311f', wash: 'rgba(214,18,0,0.10)' },
  deadlift: { deep: '#7a6a00', bright: '#d6ba00', wash: 'rgba(122,106,0,0.10)' },

  upper_body: { deep: '#007571', bright: '#00d6cf', wash: 'rgba(0,117,113,0.10)' },
  // Lime, not the bronze it was. Bronze sat 10 degrees from the new yellow,
  // which is deadlift.
  lower_body: { deep: '#527500', bright: '#96d600', wash: 'rgba(82,117,0,0.10)' },
  // Full body keeps the brand green: it is the session that is everything, and
  // a neon green here would fight the one green button in a session.
  full_body: { deep: '#2f6b46', bright: '#5ddc93', wash: 'rgba(47,107,70,0.10)' },

  // Magenta, not the crimson it was. Crimson sat 19 degrees from the new red,
  // which is bench.
  conditioning: { deep: '#d6004f', bright: '#ff1f71', wash: 'rgba(214,0,79,0.10)' },

  // "Prehab leave as is." Untouched, and the only entry here that is still a
  // muted colour - which is arguably right for the session somebody does when
  // something hurts.
  prehab: { deep: '#8a2f79', bright: '#d97ec6', wash: 'rgba(138,47,121,0.10)' },
  // Purple, not the olive it was: "flexibility can be more purple". The olive
  // also sat 11 degrees from the new lime.
  flexibility: { deep: '#8800ff', bright: '#b35cff', wash: 'rgba(136,0,255,0.10)' },

  custom: { deep: '#ad5100', bright: '#db6600', wash: 'rgba(173,81,0,0.10)' },
};

/** Never throws: an unknown type reads as a custom session. */
export function sessionIdentity(type: SessionType | string | undefined): SessionIdentity {
  return SESSION_IDENTITY[type as SessionType] ?? SESSION_IDENTITY.custom;
}
