import { Ionicons } from '@expo/vector-icons';
import type { AppColors } from '@/constants/colors';
import type { SessionType } from '@/lib/store';

export interface SessionMeta {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const SESSION_META: Record<SessionType, SessionMeta> = {
  squat: {
    label: 'Squat Session',
    subtitle: 'KPI · Quads · Glutes · Hamstrings',
    icon: 'walk-outline',
  },
  bench: {
    label: 'Bench Session',
    subtitle: 'KPI · Chest · Shoulders · Triceps',
    icon: 'person-outline',
  },
  deadlift: {
    label: 'Deadlift Session',
    subtitle: 'KPI · Hinge · Posterior Chain',
    icon: 'body-outline',
  },
  upper_body: {
    label: 'Upper Body',
    subtitle: 'Push · Pull · Full Coverage',
    icon: 'barbell-outline',
  },
  lower_body: {
    label: 'Lower Body',
    subtitle: 'Squat · Hinge · Lunge',
    icon: 'footsteps-outline',
  },
  full_body: {
    label: 'Full Body',
    subtitle: '6 Patterns · Balanced Training',
    icon: 'fitness-outline',
  },
  conditioning: { label: 'Conditioning', subtitle: 'Cardio & Stamina', icon: 'flame-outline' },
  prehab: {
    label: 'Prehab',
    subtitle: 'Joint health & Mobility',
    icon: 'shield-checkmark-outline',
  },
  flexibility: { label: 'Flexibility', subtitle: 'Stretching & Recovery', icon: 'leaf-outline' },
  custom: { label: 'Custom', subtitle: 'Pick your own exercises', icon: 'create-outline' },
};

export const SESSION_TYPE_COUNT = Object.keys(SESSION_META).length;

export const SESSION_DISPLAY_NAMES: Record<SessionType, string> = {
  squat: 'Squat Session',
  bench: 'Bench Session',
  deadlift: 'Deadlift Session',
  upper_body: 'Upper Body',
  lower_body: 'Lower Body',
  full_body: 'Full Body',
  conditioning: 'Conditioning',
  prehab: 'Prehab',
  flexibility: 'Flexibility',
  custom: 'Custom Session',
};

export const SESSION_SHORT_LABELS: Record<SessionType, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
  upper_body: 'Upper Body',
  lower_body: 'Lower Body',
  full_body: 'Full Body',
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
    upper_body: { bg: C.badgeVolume, color: C.badgeVolumeText },
    lower_body: { bg: C.primaryMuted, color: C.primary },
    full_body: { bg: C.categoryNeuro, color: C.categoryNeuroText },
    conditioning: { bg: C.categoryPrehab, color: C.categoryPrehabText },
    prehab: { bg: C.categoryMechanical, color: C.categoryMechanicalText },
    flexibility: { bg: C.categoryCooldown, color: C.categoryCooldownText },
    custom: { bg: C.categoryFinisher, color: C.categoryFinisherText },
  };
}
