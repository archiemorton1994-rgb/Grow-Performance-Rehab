/**
 * THE TWO LOOKS THE APP HAS, AND THE ONE PLACE THEY ARE LISTED.
 *
 * There used to be three. The third was "System" in settings and "Match my
 * phone" in the builder, and it followed the device's colour scheme. Archie's
 * call: it looks the same as Light to anybody using it, so it is a third button
 * that buys nothing and a third branch in every place that asks which palette
 * to paint. It is gone.
 *
 * Anyone already on it moves to LIGHT, not Dark. That is deliberate. Almost
 * every phone that had this app open was on the light scheme, so light is what
 * "Match my phone" was actually showing them; moving them to Dark would change
 * the app's appearance under somebody who never asked for it.
 *
 * No React and no react-native import in this file on purpose, the same reason
 * lib/go-colors.ts has none: tests/theme-options.check.mjs can then read the
 * real list rather than a copy of it, and both the settings screen and the
 * profile builder draw their buttons from the same array, so they cannot drift.
 */

/** The user's chosen palette. There is no third value any more. */
export type ThemePreference = 'dark' | 'light';

/** What a new install gets before anybody touches settings. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

/**
 * The buttons, in the order they are drawn, used by BOTH the Appearance row in
 * settings and the "Choose your look" question in the builder.
 */
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/**
 * Anything claiming to be a theme, turned into one of the two.
 *
 * The legacy 'system' becomes 'light' (see above). Everything else that is not
 * a theme at all, which is a payload from a build that never had the field or a
 * corrupted value, falls to the default rather than leaving the app with a
 * preference it cannot paint.
 *
 * Every boundary where a theme arrives from outside this build has to run
 * through here: the persisted-state migration, a merged server payload, and a
 * saved onboarding draft. Miss one and an old 'system' survives, useColors
 * falls through to Dark, and somebody who chose "Match my phone" on a light
 * phone opens the app black.
 */
export function normaliseThemePreference(value: unknown): ThemePreference {
  if (value === 'light' || value === 'system') return 'light';
  if (value === 'dark') return 'dark';
  return DEFAULT_THEME_PREFERENCE;
}
