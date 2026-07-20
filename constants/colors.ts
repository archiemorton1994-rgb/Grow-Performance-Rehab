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

  youtubeSurface: '#FFF0F0',
  youtubeBorder: '#FFCCCC',

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
  trophyBg: '#1f1700',
  trophyBorder: '#352700',
  streakBg: '#1f1000',
  streakBorder: '#3a1a00',
  streakText: '#fb923c',

  achievementGold: '#f59e0b',
  achievementGoldBg: '#1a1100',
  achievementGoldMuted: '#f59e0b22',
  achievementGoldBorder: '#f59e0b33',

  youtubeSurface: '#1a0808',
  youtubeBorder: '#2a1010',

  categoryMechanical: '#0d2421',
  categoryMechanicalText: '#4db6ac',
  categoryNeuro: '#1a0d24',
  categoryNeuroText: '#c084fc',
  categoryPrehab: '#1f1200',
  categoryPrehabText: '#fb923c',
  categoryFinisher: '#1f0a0a',
  categoryFinisherText: '#f87171',
  categoryCooldown: '#0a1f12',
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
  return DarkColors;
}

/** Canonical amber/gold for achievement accents — for non-hook contexts (lib modules, static data). */
export const ACHIEVEMENT_GOLD = DarkColors.achievementGold;

const Colors = LightColors;
export default Colors;
