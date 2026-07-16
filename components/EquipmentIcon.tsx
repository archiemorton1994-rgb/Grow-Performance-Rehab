import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { EquipmentTier } from '@/lib/store';

interface EquipmentIconProps {
  tier: EquipmentTier;
  size: number;
  color: string;
}

export function EquipmentIcon({ tier, size, color }: EquipmentIconProps) {
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
    case 'bodyweight':
      return 'person-outline';
    case 'bands':
      return 'git-compare-outline';
    case 'dumbbells':
      return 'barbell-outline';
    case 'barbell':
      return 'barbell-outline';
    case 'fullgym':
      return 'barbell-outline';
    default:
      return 'barbell-outline';
  }
}
