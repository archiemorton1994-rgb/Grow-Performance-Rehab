import React from 'react';
import { Image } from 'react-native';
import { EquipmentTier } from '@/lib/store';

const PNG_ICONS: Partial<Record<EquipmentTier, any>> = {
  bodyweight: require('@/assets/images/sessions/bodyweight.png'),
  bands: require('@/assets/images/sessions/bands.png'),
  dumbbells: require('@/assets/images/sessions/dumbbells.png'),
  kettlebells: require('@/assets/images/sessions/kettlebells.png'),
  fullgym: require('@/assets/images/sessions/fullgym.png'),
};

interface EquipmentIconProps {
  tier: EquipmentTier;
  size: number;
  color?: string;
}

export function EquipmentIcon({ tier, size }: EquipmentIconProps) {
  const png = PNG_ICONS[tier];
  if (png) {
    return <Image source={png} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return null;
}
