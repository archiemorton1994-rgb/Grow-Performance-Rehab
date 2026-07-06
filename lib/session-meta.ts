import { Ionicons } from '@expo/vector-icons';
import type { AppColors } from '@/constants/colors';
import type { SessionType } from '@/lib/store';

export interface SessionMeta {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const SESSION_META: Record<SessionType, SessionMeta> = {
  squat: { label: 'Lower Body', subtitle: 'Quads · Glutes · Hamstrings', icon: 'walk-outline' },
  bench: { label: 'Upper Body', subtitle: 'Chest · Shoulders · Triceps', icon: 'person-outline' },
  deadlift: { label: 'Full Body', subtitle: 'Back · Hips · Legs', icon: 'body-outline' },
  conditioning: { label: 'Conditioning', subtitle: 'Cardio & Stamina', icon: 'flame-outline' },
  prehab: {
    label: 'Prehab',
    subtitle: 'Joint health & Mobility',
    icon: 'shield-checkmark-outline',
  },
  flexibility: { label: 'Flexibility', subtitle: 'Stretching & Recovery', icon: 'leaf-outline' },
  custom: { label: 'Custom', subtitle: 'Pick your own exercises', icon: 'create-outline' },
};

export const SESSION_DISPLAY_NAMES: Record<SessionType, string> = {
  squat: 'Lower Body Strength',
  bench: 'Upper Body Press',
  deadlift: 'Full Body Pull',
  conditioning: 'Conditioning',
  prehab: 'Prehab',
  flexibility: 'Flexibility',
  custom: 'Custom Session',
};

export const SESSION_SHORT_LABELS: Record<SessionType, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
  conditioning: 'Conditioning',
  prehab: 'Prehab',
  flexibility: 'Flexibility',
  custom: 'Custom',
};

export interface SessionColorPair {
  bg: string;
  color: string;
}

export function getSessionColors(C: AppColors): Record<SessionType, SessionColorPair> {
  return {
    squat: { bg: C.primaryMuted, color: C.primary },
    bench: { bg: C.badgeVolume, color: C.badgeVolumeText },
    deadlift: { bg: C.categoryNeuro, color: C.categoryNeuroText },
    conditioning: { bg: C.categoryPrehab, color: C.categoryPrehabText },
    prehab: { bg: C.categoryMechanical, color: C.categoryMechanicalText },
    flexibility: { bg: C.categoryCooldown, color: C.categoryCooldownText },
    custom: { bg: C.categoryFinisher, color: C.categoryFinisherText },
  };
}
