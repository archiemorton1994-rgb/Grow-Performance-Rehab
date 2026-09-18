import { Ionicons } from '@expo/vector-icons';
import type { AppColors } from '@/constants/colors';
import { trainTypeOf, type TrainSessionType } from '@/lib/session-type';
import type { SessionType } from '@/lib/store';

export interface SessionMeta {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * WHY EVERY TABLE IN THIS FILE IS WRITTEN TWICE OVER.
 *
 * Seven of the ten session ids describe a session the app still builds. The
 * other three - 'squat', 'bench' and 'deadlift' - are only ever read back now:
 * off somebody's completed sessions, off what the server synced, and out of a
 * frozen programme report or a Barbell Strength cycle that is part way through.
 * They still have to resolve to a name, or those screens print nothing at all.
 *
 * What they must NOT do is print a name they no longer earn. A stored squat day
 * builds a lower body session (see lib/session-type.ts), so it is a lower body
 * session, and it says so wherever it is shown.
 *
 * So each table lists the seven real types once, then files the three legacy
 * ids under whatever `trainTypeOf` says they now are. Nobody has to remember to
 * update two entries when a name changes, because there is only ever one.
 */
const TRAIN_META: Record<TrainSessionType, SessionMeta> = {
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

export const SESSION_META: Record<SessionType, SessionMeta> = {
  ...TRAIN_META,
  squat: TRAIN_META[trainTypeOf('squat')],
  bench: TRAIN_META[trainTypeOf('bench')],
  deadlift: TRAIN_META[trainTypeOf('deadlift')],
};

export const SESSION_TYPE_COUNT = Object.keys(SESSION_META).length;

const TRAIN_DISPLAY_NAMES: Record<TrainSessionType, string> = {
  upper_body: 'Upper Body',
  lower_body: 'Lower Body',
  full_body: 'Full Body',
  conditioning: 'Conditioning',
  prehab: 'Prehab',
  flexibility: 'Flexibility',
  custom: 'Custom Session',
};

export const SESSION_DISPLAY_NAMES: Record<SessionType, string> = {
  ...TRAIN_DISPLAY_NAMES,
  squat: TRAIN_DISPLAY_NAMES[trainTypeOf('squat')],
  bench: TRAIN_DISPLAY_NAMES[trainTypeOf('bench')],
  deadlift: TRAIN_DISPLAY_NAMES[trainTypeOf('deadlift')],
};

const TRAIN_SHORT_LABELS: Record<TrainSessionType, string> = {
  upper_body: 'Upper Body',
  lower_body: 'Lower Body',
  full_body: 'Full Body',
  conditioning: 'Conditioning',
  prehab: 'Prehab',
  flexibility: 'Flexibility',
  custom: 'Custom',
};

export const SESSION_SHORT_LABELS: Record<SessionType, string> = {
  ...TRAIN_SHORT_LABELS,
  squat: TRAIN_SHORT_LABELS[trainTypeOf('squat')],
  bench: TRAIN_SHORT_LABELS[trainTypeOf('bench')],
  deadlift: TRAIN_SHORT_LABELS[trainTypeOf('deadlift')],
};

export interface SessionColorPair {
  bg: string;
  color: string;
}

export function getSessionColors(C: AppColors): Record<SessionType, SessionColorPair> {
  const train: Record<TrainSessionType, SessionColorPair> = {
    upper_body: { bg: C.badgeVolume, color: C.badgeVolumeText },
    lower_body: { bg: C.primaryMuted, color: C.primary },
    full_body: { bg: C.categoryNeuro, color: C.categoryNeuroText },
    conditioning: { bg: C.categoryPrehab, color: C.categoryPrehabText },
    prehab: { bg: C.categoryMechanical, color: C.categoryMechanicalText },
    flexibility: { bg: C.categoryCooldown, color: C.categoryCooldownText },
    custom: { bg: C.categoryFinisher, color: C.categoryFinisherText },
  };
  return {
    ...train,
    squat: train[trainTypeOf('squat')],
    bench: train[trainTypeOf('bench')],
    deadlift: train[trainTypeOf('deadlift')],
  };
}
