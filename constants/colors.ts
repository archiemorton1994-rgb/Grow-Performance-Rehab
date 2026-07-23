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
  tabInactive: '#9ca5a0',

  destructive: '#ef4444',
  pbFlash: '#f59e0b',
  pbFlashText: '#ffffff',
  trophy: '#f59e0b',
  trophyBg: '#fef9c3',
  trophyBorder: '#fde68a',
  streakBg: '#fff7ed',
  streakBorder: '#fed7aa',
  streakText: '#c2410c',

  achievementGold: '#d97706',
  achievementGoldBg: '#fffbeb',
  achievementGoldMuted: '#fef3c7',
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

  difficultyAdvancedBg: '#fde8e8',
  difficultyIntermediateBg: '#fff8e1',
  difficultyBeginnerBg: '#e8f5e9',
  difficultyAdvancedText: '#c0392b',
  difficultyIntermediateText: '#f39c12',
  difficultyBeginnerText: '#27ae60',

  categoryMechanical: '#e0f2f1',
  categoryMechanicalText: '#00695c',
  categoryNeuro: '#f3e5f5',
  categoryNeuroText: '#7b1fa2',
  categoryPrehab: '#fff3e0',
  categoryPrehabText: '#e65100',
  categoryFinisher: '#fce8e6',
  categoryFinisherText: '#c62828',
  categoryCooldown: '#e8f5e9',
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
  pbFlashText: '#ffffff',
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

/** Canonical amber/gold for achievement accents — for non-hook contexts (lib modules, static data). */
export const ACHIEVEMENT_GOLD = DarkColors.achievementGold;

const Colors = LightColors;
export default Colors;
