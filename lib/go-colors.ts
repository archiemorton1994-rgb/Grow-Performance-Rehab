/**
 * The one green, and the two values it takes.
 *
 * Four buttons move a session forward - Start the session, Did It, Mark Set
 * Done, Complete Session - and they are the same green on every screen. From
 * Archie: "the main big green confirmation box at the bottom should be the only
 * constant."
 *
 * They are painted from HERE rather than from the theme's `primary` family
 * because under that family they had drifted apart: Mark Set Done and Complete
 * Session were the deep green while Did It was the bright one, so the button
 * that finishes a set changed appearance depending on which exercise you were
 * on. One source stops that happening again.
 *
 * The two values are the app's own - the deep green with white on it in the
 * light theme, the bright green with near-black on it in the dark one. A single
 * value cannot serve both grounds.
 *
 * No React and no react-native import in this file on purpose, so
 * tests/one-green.check.mjs can read the values rather than a copy of them. The
 * hook that picks between them is useGoColors in constants/colors.ts.
 */
export const GO = {
  light: { fill: '#2f6b46', on: '#ffffff' },
  dark: { fill: '#4ade80', on: '#1a1d1b' },
} as const;
