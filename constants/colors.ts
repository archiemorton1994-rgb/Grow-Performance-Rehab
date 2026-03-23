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
