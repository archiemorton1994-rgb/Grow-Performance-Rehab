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
  trophy: '#f59e0b',
  trophyBg: '#fef9c3',
  trophyBorder: '#fde68a',
  streakBg: '#fff7ed',
  streakBorder: '#fed7aa',
  streakText: '#c2410c',

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
  primaryDark: '#1e4a30',
  primaryMuted: '#0d1f15',
  primarySurface: '#091510',

  background: '#000000',
  surface: '#111111',
  surfaceSecondary: '#1a1a1a',
  surfaceTertiary: '#252525',

  text: '#ffffff',
  textSecondary: '#9a9a9a',
  textTertiary: '#555555',
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
  trophy: '#fbbf24',
  trophyBg: '#1f1700',
  trophyBorder: '#352700',
  streakBg: '#1f1000',
  streakBorder: '#3a1a00',
  streakText: '#fb923c',

  youtubeSurface: '#1a0808',
  youtubeBorder: '#2a1010',

  categoryMechanical: '#1a1a1a',
  categoryMechanicalText: '#4db6ac',
  categoryNeuro: '#1a1a1a',
  categoryNeuroText: '#c084fc',
  categoryPrehab: '#1a1a1a',
  categoryPrehabText: '#fb923c',
  categoryFinisher: '#1a1a1a',
  categoryFinisherText: '#f87171',
  categoryCooldown: '#1a1a1a',
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

const Colors = LightColors;
export default Colors;
