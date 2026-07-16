import React from 'react';
import { Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { EquipmentTier } from '@/lib/store';

const PNG_ICONS: Partial<Record<EquipmentTier, any>> = {
  bodyweight: require('@/assets/images/sessions/bodyweight.png'),
  bands: require('@/assets/images/sessions/bands.png'),
  dumbbells: require('@/assets/images/sessions/dumbbells.png'),
};

interface EquipmentIconProps {
  tier: EquipmentTier;
  size: number;
  color: string;
}

export function EquipmentIcon({ tier, size, color }: EquipmentIconProps) {
  const png = PNG_ICONS[tier];
  if (png) {
    return <Image source={png} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  if (tier === 'kettlebells') {
    return <MaterialCommunityIcons name="kettlebell" size={size} color={color} />;
  }
  return (
    <Ionicons
      name={getIoniconName(tier) as keyof typeof Ionicons.glyphMap}
      size={size}
      color={color}
    />
  );
}

function getIoniconName(tier: EquipmentTier): string {
  switch (tier) {
    case 'barbell':
      return 'barbell-outline';
    case 'fullgym':
      return 'barbell-outline';
    default:
      return 'barbell-outline';
  }
}
