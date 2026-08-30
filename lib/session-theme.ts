/**
 * THE WHOLE SESSION WEARS THE SESSION'S COLOUR.
 *
 * THE PROBLEM, reported after the first attempt at this: "I do think there is
 * too much green still", "the pop up messages in the session are all still
 * green", "the pre-session screens are all still green", "it doesn't feel
 * consistent in session with the colouring and theme".
 *
 * The first attempt gave each session a hue and spent it in three places: the
 * rail down the exercise card, the marks in the progress strip, and a little of
 * the card's furniture. Everything else - the ease-off prompt, the effort
 * question, the rest timer's messages, the pre-session plan, the sheets - stayed
 * brand green, because those are painted from the theme's `primary` family and
 * the hue was not part of the theme. So a squat session was a blue rail on a
 * green screen, which reads as an accident rather than a decision.
 *
 * WHAT THIS DOES. It re-tones the theme itself for the duration of a session.
 * The colour set comes back with the green family swapped for the session's hue
 * and the app's own greys given a wash of it, so any component that builds its
 * styles from those tokens becomes the session's colour with nothing to
 * remember and nothing to miss - the same trick that made the exercise card
 * safe to move onto paper, one level further up.
 *
 * WHAT STAYS GREEN. The big button at the bottom that moves you forward: Did
 * It, Mark Set Done, Start the session, Complete session. From Archie: "the
 * main big green confirmation box at the bottom should be the only constant."
 * It is GO below, so it cannot drift with the rest.
 *
 * WHY NO CONTRAST CAN BREAK. Every token derived here is luminance-matched to
 * the token it replaces: pulled towards the session's hue, then scaled in
 * linear light until it is exactly as bright as the colour it stands in for.
 * Contrast is a function of luminance alone, so every text-on-surface pair in
 * the whole session flow keeps the ratio it was checked at. There are four
 * deliberate exceptions - primary, primaryDark and primaryText, which take the
 * identity's own contrast-verified shades, and a pure black background, which
 * has no brightness to preserve and is lifted to a floor. All four are asserted
 * in tests/session-theme.check.mjs.
 *
 * This file has no React and no react-native import on purpose, so the
 * derivation can be run and measured directly by that test. The hook and the
 * provider live next door in session-theme-context.tsx.
 */
import { sessionIdentity } from './session-identity';
import type { SessionType } from './store';

/**
 * The go button. Grow green, in both themes, in every session.
 *
 * Two values because the dark theme's green button is the bright one with near
 * black text on it and the light theme's is the deep one with white. They are
 * the values the app already used for primaryDark/primaryDarkText, pinned here
 * so that re-toning the primary family cannot take the go button with it.
 */
export const GO = {
  light: { fill: '#2f6b46', on: '#ffffff' },
  dark: { fill: '#4ade80', on: '#1a1d1b' },
} as const;

/** The theme tokens a session re-tones. Structural, so this file imports none. */
export interface SessionThemeTokens {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;
  primarySurface: string;
  primaryText: string;
  success: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  border: string;
  borderLight: string;
}

// ── Colour maths ───────────────────────────────────────────────────────────
// These are the only colours in the app that are derived rather than chosen,
// and the derivation is the reason they are safe to apply in bulk.

type RGB = [number, number, number];

function parseHex(hex: string): RGB | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: RGB): string {
  return `#${rgb
    .map((v) => {
      const c = Math.max(0, Math.min(255, Math.round(v)));
      return c.toString(16).padStart(2, '0');
    })
    .join('')}`;
}

const toLinear = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return c * 255;
};

/** WCAG relative luminance, the only quantity contrast depends on. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const lum = (rgb: RGB): number => {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const blend = (a: RGB, b: RGB, t: number): RGB => [
  a[0] * (1 - t) + b[0] * t,
  a[1] * (1 - t) + b[1] * t,
  a[2] * (1 - t) + b[2] * t,
];

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

/**
 * `rgb`, taken to white or to black until it is exactly `targetL` bright.
 *
 * The obvious way to hit a luminance - scale the three channels in linear light
 * - is wrong here, and wrong in a way that only shows up in one theme. It works
 * beautifully going darker, but asking a saturated blue to be as bright as a
 * pale mint tint clips two channels at full and hands back fluorescent cyan.
 * The light theme's whole primary family came out neon on the first attempt.
 *
 * Blending towards white or black cannot leave the gamut, so it always returns
 * a colour that exists. It desaturates on the way up, which is exactly what a
 * pale tint of a hue is.
 */
function atLuminance(rgb: RGB, targetL: number): RGB {
  const start = lum(rgb);
  if (Math.abs(start - targetL) < 1e-6) return rgb;
  const up = targetL > start;
  const anchor = up ? WHITE : BLACK;
  let lo = 0;
  let hi = 1;
  // Luminance is monotonic in t along a blend to white or to black, so twenty
  // halvings put it within a rounding error of the target.
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const here = lum(blend(rgb, anchor, mid));
    if (up ? here < targetL : here > targetL) lo = mid;
    else hi = mid;
  }
  return blend(rgb, anchor, (lo + hi) / 2);
}

/**
 * `base`, pulled `amount` of the way towards `hue`, then put back to exactly
 * the brightness it started at.
 *
 * Contrast depends on luminance alone, so a token that comes back at the
 * brightness it went in at holds every ratio it was checked against. That is
 * what makes this safe to apply across a whole theme at once.
 *
 * `floor` exists for one colour only - the dark theme's pure black background,
 * which has no brightness to preserve and would swallow any tint. Lifting it to
 * a floor near #0e0e0e costs white text 21:1 down to about 19:1.
 */
export function recolour(base: string, hue: string, amount: number, floor = 0): string {
  const b = parseHex(base);
  const h = parseHex(hue);
  // rgba() borders and any other non-hex token pass through untouched.
  if (!b || !h) return base;

  const target = Math.max(lum(b), floor);
  if (target <= 0) return base;

  return toHex(atLuminance(blend(b, h, amount), target));
}

/** Straight sRGB darkening, for the one token that wants weight, not hue. */
function darken(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb.map((v) => v * (1 - amount)) as RGB);
}

/**
 * How far each neutral is pulled towards the session's hue.
 *
 * Dark mode holds far more colour at low brightness than light mode can at high
 * brightness, which is why the two rows are so different: near-black can be
 * more than half hue and still read as a dark app, while near-white turns into
 * a coloured app almost immediately.
 */
const NEUTRAL_TINT = {
  light: { background: 0.12, surface: 0.09, border: 0.2 },
  dark: { background: 0.6, surface: 0.45, border: 0.45 },
} as const;

/** The floor for a background with no brightness to tint. See recolour. */
export const BLACK_BACKGROUND_FLOOR = 0.0045;

/**
 * The theme's green family and neutral greys, in one session's colour.
 *
 * Returns only the tokens that change, so a caller spreads it over the base and
 * everything else - text, error, warning, the category colours, the assistant's
 * sapphire - is left exactly as it was.
 */
export function sessionColorOverrides(
  base: SessionThemeTokens,
  type: SessionType | string | undefined,
  isDark: boolean
): Partial<SessionThemeTokens> {
  const id = sessionIdentity(type);
  const hue = id.deep;
  const tint = isDark ? NEUTRAL_TINT.dark : NEUTRAL_TINT.light;

  return {
    // The three that take the identity's own shades rather than a derivation.
    // `primary` is the fill the app puts white text on, and `deep` is already
    // held above 4.5:1 against near-white parchment, which makes white on it
    // better than 5:1. Using it verbatim also means the rail down the exercise
    // card, the marks in the strip and every filled chip are literally one
    // colour rather than three cousins.
    primary: hue,
    primaryDark: isDark ? id.bright : darken(hue, 0.28),
    primaryText: isDark ? id.bright : hue,

    primaryLight: recolour(base.primaryLight, hue, 1),
    primaryMuted: recolour(base.primaryMuted, hue, 1),
    primarySurface: recolour(base.primarySurface, hue, 1),
    success: recolour(base.success, hue, 1),

    background: recolour(base.background, hue, tint.background, BLACK_BACKGROUND_FLOOR),
    surface: recolour(base.surface, hue, tint.surface),
    surfaceSecondary: recolour(base.surfaceSecondary, hue, tint.surface),
    surfaceTertiary: recolour(base.surfaceTertiary, hue, tint.surface),
    border: recolour(base.border, hue, tint.border),
    borderLight: recolour(base.borderLight, hue, tint.border),
  };
}

/** Which tokens above are derived by luminance-matching, and so must not drift. */
export const LUMINANCE_MATCHED_TOKENS: (keyof SessionThemeTokens)[] = [
  'primaryLight',
  'primaryMuted',
  'primarySurface',
  'success',
  'surface',
  'surfaceSecondary',
  'surfaceTertiary',
  'border',
  'borderLight',
];
