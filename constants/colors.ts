import { useColorScheme } from 'react-native';
import { useAppStore } from '@/lib/store';

const LightColors = {
  primary: '#2f6b46',
  primaryLight: '#3d8a5c',
  primaryDark: '#1e4a30',
  primaryMuted: '#e8f2ec',
  primarySurface: '#f0f7f3',
  /** The brand green as *foreground ink* — accent text, icon tints, chart
   *  strokes sitting on an ordinary background.
   *
   *  `primary` is the fill token: it is the colour we put *behind* white text,
   *  so it has to stay dark in both themes. That makes it the wrong colour to
   *  paint text *with* on a dark theme, where it lands at 1.9–3.3:1. Splitting
   *  the two roles lets each keep the value its job needs. In this theme they
   *  happen to coincide; in DarkColors they do not. */
  primaryText: '#2f6b46',

  /**
   * SAPPHIRE - the assistant, and nothing else.
   *
   * The assistant is the one part of the app that is not the app talking about
   * your session; it is something talking to you ABOUT your training. Giving it
   * the brand green made it read as another panel. A colour used nowhere else
   * means the button is recognisable at a glance and the panel announces what
   * it is before a word of it has been read.
   *
   * Held to the same contrast floor as everything else, and pinned by
   * tests/assistant-identity.check.mjs: assistantInk on assistantSurface and on
   * the ordinary background, and assistantOnFill on assistantFill.
   *
   * assistantFill      the button and the panel header, a solid block
   * assistantOnFill    text and icons sitting on that block
   * assistantInk       sapphire used as foreground ink on an ordinary surface
   * assistantSurface   the panel's own tinted ground
   * assistantMuted     chips and dividers inside the panel
   */
  assistantFill: '#1e3a8a',
  assistantOnFill: '#ffffff',
  assistantInk: '#1d4ed8',
  assistantSurface: '#f2f5fd',
  assistantMuted: '#dde6fa',

  background: '#fafbfa',
  surface: '#ffffff',
  surfaceSecondary: '#f5f6f5',
  surfaceTertiary: '#eef0ef',

  text: '#1a1d1b',
  // Moved down with textTertiary rather than independently. Once tertiary is
  // held at AA it lands within 0.1 of where secondary used to sit, so the two
  // tiers would have rendered as the same grey. Secondary is set from the dark
  // theme's secondary instead (7.2 : 1 here vs 7.7 : 1 there on the same
  // surface) - light was the weaker theme for the same strings, which was never
  // a decision anybody made.
  textSecondary: '#4a504c',
  // Tertiary carries real content, not decoration: every achievement name and
  // rarity tier, "Not tried yet", the in-session timer line, each queued
  // exercise's set/rep spec, "Resend code in 25s", the locked equipment labels.
  // It sat below AA in both themes on the argument that closing the gap would
  // erase the tier; the tier is kept by moving textSecondary too. Set to clear
  // 4.5 : 1 on surfaceTertiary - the darkest card light mode paints it on - and
  // deliberately close to that floor, so it stays the quiet tier.
  textTertiary: '#656f68',
  textInverse: '#ffffff',
  /** Text/icon color for content placed on a `primaryDark`-filled surface.
   *  primaryDark flips from dark green (light theme) to bright green (dark
   *  theme), so unlike textInverse this must flip too — plain white on the
   *  dark-theme bright green is unreadable (~1.7:1 contrast). */
  primaryDarkText: '#ffffff',

  border: '#e2e5e3',
  borderLight: '#f0f2f1',

  success: '#2f6b46',
  warning: '#c4820e',
  warningLight: '#fef3e2',
  error: '#c4392e',
  errorLight: '#fde8e6',

  badgeComfort: '#e8d5f5',
  badgeComfortText: '#6b3fa0',
  badgeVolume: '#d5e8f5',
  badgeVolumeText: '#2a5f8f',

  tabActive: '#2f6b46',
  // Was '#9ca5a0' - only ~2.4:1 against the near-white tab bar, hard to read.
  // Left where it is now that textSecondary has moved down: an unselected tab
  // label has to stay clearly quieter than the selected one, which body-copy
  // ink no longer is. 5.2 : 1 on the tab bar, so it is above AA on its own.
  tabInactive: '#646d67',

  destructive: '#ef4444',
  pbFlash: '#f59e0b',
  pbFlashText: '#5c2d00',
  trophy: '#7a4400',
  trophyBg: '#e8a900',
  trophyBorder: '#daa000',
  streakBg: '#ffb896',
  streakBorder: '#ffbe85',
  streakText: '#c2410c',

  achievementGold: '#7a4400',
  achievementGoldBg: '#e8a900',
  achievementGoldMuted: '#f5c842',
  achievementGoldBorder: '#f59e0b55',

  /** The three Restore rows — one derived family, not three picked colours.
   *
   *  Recovery, mobility and prehab really are three different modalities, so
   *  they stay told apart by hue. They used to be teal / indigo / amber, which
   *  is three hues chosen independently: nothing tied them to each other or to
   *  the brand, and side by side they read as an unfinished screen.
   *
   *  These are derived instead. All three share one saturation and one *weight*
   *  — each is tuned so it lands on the same contrast (~5.2 : 1 light, ~7 : 1
   *  dark) against the 5% wash of itself the row is filled with — so only the
   *  hue differs. The hues step evenly away from the brand green (143 deg):
   *  158 / 186 / 214, sea green to teal to steel blue. Close enough to read as
   *  the brand's family, far enough that none of them is mistaken for the brand
   *  accent itself, which on Home means "strength session".
   *
   *  Each is painted as the row's title on a card filled with itself, so the
   *  surface moves with the ink — measure the composite, not the raw value
   *  against a white page. That is how the old prehab amber sat at 1.99 : 1. */
  cardAccentRecovery: '#147451',
  cardAccentMobility: '#15707a',
  cardAccentPrehab: '#2164bc',
  energyBadge: '#7C6EF0',

  youtubeSurface: '#FFF0F0',
  youtubeBorder: '#FFCCCC',

  trendWarning: '#d97706',
  trendDanger: '#dc2626',
  trendNeutral: '#6b7280',
  trendInactive: '#c8c8c8',
  trendInactiveBorder: '#b0b0b0',
  trendNegativeText: '#c0392b',
  trendPositiveBg: '#e8f5ee',
  trendNegativeBg: '#fdecea',
  trendPositiveBorder: '#b7deca',
  trendNegativeBorder: '#f5bdb8',

  difficultyAdvancedBg: '#f0b8b8',
  difficultyIntermediateBg: '#f0c860',
  difficultyBeginnerBg: '#a8d8ac',
  difficultyAdvancedText: '#c0392b',
  difficultyIntermediateText: '#7c3800',
  difficultyBeginnerText: '#166534',

  categoryMechanical: '#80cbc4',
  categoryMechanicalText: '#00695c',
  categoryNeuro: '#ce93d8',
  // Was '#7b1fa2' - 3.43:1 on its own tile, which made the deadlift row of the
  // first-session chooser visibly weaker than the squat and bench rows beside it.
  categoryNeuroText: '#5e1580',
  categoryPrehab: '#f4511e',
  categoryPrehabText: '#ffffff',
  categoryFinisher: '#e53935',
  categoryFinisherText: '#ffffff',
  categoryCooldown: '#a5d6a7',
  categoryCooldownText: '#2e7d32',

  overlayBg: 'rgba(0,0,0,0.5)',
  overlayBgLight: 'rgba(0,0,0,0.45)',
  primarySubtext: 'rgba(255,255,255,0.8)',
  shadow: '#000',

  light: {
    text: '#1a1d1b',
    background: '#fafbfa',
    tint: '#2f6b46',
    tabIconDefault: '#9ca5a0',
    tabIconSelected: '#2f6b46',
  },
};

const DarkColors = {
  primary: '#2f6b46',
  primaryLight: '#3d8a5c',
  primaryDark: '#4ade80',
  primaryMuted: '#1a3d28',
  primarySurface: '#091510',
  /** See the note on LightColors.primaryText. Here the two roles diverge: this
   *  is the bright green, which clears AA on every dark surface the app uses
   *  (6.9:1 on primaryMuted, its worst case, up to 12:1 on the background). */
  primaryText: '#4ade80',

  /** See the note on LightColors.assistantFill. Dark mode needs the ink bright
   *  rather than deep - the light-theme #1d4ed8 lands at 2.4:1 on this
   *  background - and the surface a tinted near-black rather than a tinted
   *  near-white. */
  assistantFill: '#1e3a8a',
  assistantOnFill: '#ffffff',
  assistantInk: '#7aa7ff',
  assistantSurface: '#0b1020',
  assistantMuted: '#1c2846',

  background: '#000000',
  surface: '#111111',
  surfaceSecondary: '#1a1a1a',
  surfaceTertiary: '#252525',

  text: '#ffffff',
  textSecondary: '#b8b8b8',
  // See the note on LightColors.textTertiary. Same job, same floor: 4.6 : 1 on
  // surfaceTertiary, the lightest card dark mode paints it on.
  textTertiary: '#8c8c8c',
  textInverse: '#ffffff',
  primaryDarkText: '#1a1d1b',

  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.05)',

  success: '#3d8a5c',
  warning: '#d4920e',
  warningLight: '#1a1200',
  error: '#d45040',
  errorLight: '#1a0800',

  badgeComfort: '#1a0e25',
  badgeComfortText: '#c084fc',
  badgeVolume: '#0d1a28',
  badgeVolumeText: '#60a5fa',

  // Matches primaryText so the tab bar's accent is the same green as every
  // other accent in this theme.
  tabActive: '#4ade80',
  // Was '#444444' - 2.16:1 on the black tab bar, i.e. worse than the value the
  // light theme rejected for the same reason (see the note above tabInactive
  // there). Dimmer than tabActive so the selected tab still reads as selected.
  tabInactive: '#8a8a8a',

  destructive: '#f87171',
  pbFlash: '#fbbf24',
  pbFlashText: '#5c2d00',
  trophy: '#fbbf24',
  trophyBg: '#4a3600',
  trophyBorder: '#5c4500',
  streakBg: '#5a3500',
  streakBorder: '#5c3000',
  streakText: '#fb923c',

  achievementGold: '#f59e0b',
  achievementGoldBg: '#4d3800',
  achievementGoldMuted: '#f59e0b22',
  achievementGoldBorder: '#f59e0b33',

  // Same three hues as the light theme, lifted to ~7 : 1 on their own tint.
  // Dark mode can afford the extra brightness and needs it — at the light
  // theme's weight these read as three dim smudges on black.
  cardAccentRecovery: '#28ac7c',
  cardAccentMobility: '#2ba7b5',
  cardAccentPrehab: '#699bdc',
  energyBadge: '#9d8cf5',

  youtubeSurface: '#1a0808',
  youtubeBorder: '#2a1010',

  trendWarning: '#d97706',
  trendDanger: '#dc2626',
  trendNeutral: '#6b7280',
  trendInactive: '#505050',
  trendInactiveBorder: '#757575',
  trendNegativeText: '#c0392b',
  trendPositiveBg: '#0a1f12',
  trendNegativeBg: '#1a0500',
  trendPositiveBorder: '#1e4a30',
  trendNegativeBorder: '#3a1510',

  difficultyAdvancedBg: '#6b1f1f',
  difficultyIntermediateBg: '#5c3600',
  difficultyBeginnerBg: '#1c4a2a',
  difficultyAdvancedText: '#e07060',
  difficultyIntermediateText: '#f5a523',
  difficultyBeginnerText: '#4ade80',

  categoryMechanical: '#1c4a42',
  categoryMechanicalText: '#4db6ac',
  categoryNeuro: '#482265',
  categoryNeuroText: '#c084fc',
  categoryPrehab: '#4d2c00',
  categoryPrehabText: '#fb923c',
  categoryFinisher: '#6a1e1e',
  categoryFinisherText: '#f87171',
  categoryCooldown: '#163d26',
  categoryCooldownText: '#6ee7b7',

  overlayBg: 'rgba(0,0,0,0.75)',
  overlayBgLight: 'rgba(0,0,0,0.65)',
  primarySubtext: 'rgba(255,255,255,0.8)',
  shadow: '#000',

  light: {
    text: '#ffffff',
    background: '#000000',
    tint: '#4ade80',
    tabIconDefault: '#8a8a8a',
    tabIconSelected: '#4ade80',
  },
};

export type AppColors = typeof LightColors;

export function useColors(): AppColors {
  const themePreference = useAppStore((s) => s.themePreference);
  const systemScheme = useColorScheme();
  if (themePreference === 'light') return LightColors;
  if (themePreference === 'dark') return DarkColors;
  return systemScheme === 'light' ? LightColors : DarkColors;
}

/** Direct access to dark-mode tokens for non-hook contexts (e.g. pre-render crash views). */
export { DarkColors };

/**
 * Olympic plate colours — deliberately NOT theme tokens.
 *
 * These are the colours of the physical objects: a 25 kg plate is red, a 20 is
 * blue, a 15 is yellow, a 10 is green. The plate calculator only helps if the
 * picture on screen matches the rack in front of you, so these must not shift
 * with light or dark mode. They live here rather than inline in the component
 * because the colour-tokens check is right that loose hex literals in a screen
 * are usually a mistake — this is the exception, so it says so.
 *
 * Pounds reuse the kilo scheme by convention: 45 lb blue, 35 lb yellow.
 */
export const PLATE_COLORS: Record<number, string> = {
  25: '#c0392b',
  20: '#2255a4',
  15: '#d4ac0d',
  10: '#27853f',
  5: '#e8e8e8',
  2.5: '#8a8f8c',
  1.25: '#8a8f8c',
  45: '#2255a4',
  35: '#d4ac0d',
};

const Colors = LightColors;
export default Colors;
