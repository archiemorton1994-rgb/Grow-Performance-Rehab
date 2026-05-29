import { useColorScheme } from 'react-native';

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

  // Tab bar
  tabActive: '#2f6b46',
  tabInactive: '#9ca5a0',

  // Celebration / achievement (trophy, streak)
  destructive: '#ef4444',
  trophy: '#f59e0b',
  trophyBg: '#fef9c3',
  trophyBorder: '#fde68a',
  streakBg: '#fff7ed',
  streakBorder: '#fed7aa',
  streakText: '#c2410c',

  // YouTube button surface (brand red kept on icon/text itself)
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
  primaryDark: '#1e4a30',
  primaryMuted: '#1a2e22',
  primarySurface: '#162219',

  background: '#0f1412',
  surface: '#1a2420',
  surfaceSecondary: '#1f2b26',
  surfaceTertiary: '#243029',

  text: '#e8edea',
  textSecondary: '#8fa89f',
  textTertiary: '#607068',
  textInverse: '#ffffff',

  border: '#2e3d37',
  borderLight: '#243029',

  success: '#3d8a5c',
  warning: '#d4920e',
  warningLight: '#2a1f06',
  error: '#d45040',
  errorLight: '#2a0e0b',

  badgeComfort: '#2d1f40',
  badgeComfortText: '#c9a0f5',
  badgeVolume: '#1a2d40',
  badgeVolumeText: '#7ab5e8',

  // Tab bar
  tabActive: '#5da87a',
  tabInactive: '#607068',

  // Celebration / achievement (trophy, streak)
  destructive: '#f87171',
  trophy: '#fbbf24',
  trophyBg: '#2d2006',
  trophyBorder: '#4a3308',
  streakBg: '#2d1507',
  streakBorder: '#5c2d0a',
  streakText: '#fb923c',

  // YouTube button surface (brand red kept on icon/text itself)
  youtubeSurface: '#2a0a0a',
  youtubeBorder: '#4a1515',

  categoryMechanical: '#0e2420',
  categoryMechanicalText: '#4db6ac',
  categoryNeuro: '#220e2e',
  categoryNeuroText: '#ce93d8',
  categoryPrehab: '#251a07',
  categoryPrehabText: '#ff9a4d',
  categoryFinisher: '#2a0e0b',
  categoryFinisherText: '#ef9a9a',
  categoryCooldown: '#0e2415',
  categoryCooldownText: '#81c784',

  light: {
    text: '#e8edea',
    background: '#0f1412',
    tint: '#2f6b46',
    tabIconDefault: '#607068',
    tabIconSelected: '#2f6b46',
  },
};

export type AppColors = typeof LightColors;

export function useColors(): AppColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkColors : LightColors;
}

const Colors = LightColors;
export default Colors;
