/**
 * THE PAGE. Parchment, fixed in both themes.
 *
 * Used by one thing: the recap at the end of a session, the screen that lists
 * what you actually did before you tap Complete. It is the same paper as the
 * summary certificate that follows it, so finishing a session is a hand-off
 * between two sheets rather than a jump between two apps.
 *
 * IT IS NOT THEMED, and that is the point. The recap is the one moment in the
 * app that is about what happened rather than about what to do next, and it
 * should look like a different kind of object whichever theme somebody runs.
 *
 * THIS FILE USED TO HOLD A PALETTE TOO - ten hues, one per session type, swapped
 * into the theme for the length of a session. It shipped, and Archie lived with
 * it: "I think the colours was a good idea in principle but maybe better just a
 * simplistic style as it was before." It is in the history if it is ever wanted
 * back; the solver that produced it is worth more than the values were.
 */

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
  /**
   * A number that went the other way, on parchment.
   *
   * Deliberately not a traffic-light red. A lift that dipped during a block is
   * still training that was logged, and often the price of something else
   * climbing hard, so it is a warm rust rather than an alarm. Same value and
   * same reasoning as TONE_DOWN on the session certificate, which is the other
   * document printed on this paper.
   */
  down: '#9a3412',
  /** The surround for the YouTube button. Its red is a brand mark and stays
   *  itself; only the tile behind it is lightened to sit on paper. */
  videoBg: '#fbe4e4',
  videoBorder: '#efc0c0',
} as const;
