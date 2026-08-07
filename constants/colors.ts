import { useColorScheme } from 'react-native';
import { useAppStore } from '@/lib/store';

const LightColors = {
  primary: '#2f6b46',
  primaryLight: '#3d8a5c',
  primaryDark: '#1e4a30',
  primaryMuted: '#e8f2ec',
  primarySurface: '#f0f7f3',

  background: '#fafbfa',
  surface: '#ffffff',
  surfaceSecondary: '#f5f6f5',
  surfaceTertiary: '#eef0ef',

  text: '#1a1d1b',
  textSecondary: '#6b7570',
  textTertiary: '#9ca5a0',
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
  // Matches textSecondary's already-vetted contrast (~4.8:1).
  tabInactive: '#6b7570',

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

  cardAccentRecovery: '#0d9488',
  cardAccentMobility: '#6366f1',
  cardAccentPrehab: '#f59e0b',
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
  categoryNeuroText: '#7b1fa2',
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

  background: '#000000',
  surface: '#111111',
  surfaceSecondary: '#1a1a1a',
  surfaceTertiary: '#252525',

  text: '#ffffff',
  textSecondary: '#b8b8b8',
  textTertiary: '#6e6e6e',
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

  tabActive: '#3d8a5c',
  tabInactive: '#444444',

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

  cardAccentRecovery: '#14b8a6',
  cardAccentMobility: '#818cf8',
  cardAccentPrehab: '#fbbf24',
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
    tint: '#3d8a5c',
    tabIconDefault: '#444444',
    tabIconSelected: '#3d8a5c',
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
