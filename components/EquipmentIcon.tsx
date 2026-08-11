import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { EquipmentTier } from '@/lib/store';

/**
 * These tiers used to be photographic PNGs — opaque, near-black, and shipped at
 * 1024px for a 13–20px slot. At that size the two darkest were indistinguishable
 * from black squares on a light card, and because a bitmap has no ink to
 * recolour, the `color` callers were already passing had nowhere to go.
 *
 * Line icons say the same thing at 13px and take the colour of the row they sit
 * in, so a selected tier now reads as selected. Ionicons rather than GrowIcon
 * because the house set has no band, kettlebell or gym glyph, and five icons
 * from one family beat four from another plus a stray.
 */
const TIER_ICONS: Record<EquipmentTier, keyof typeof Ionicons.glyphMap> = {
  bodyweight: 'body-outline',
  bands: 'infinite-outline',
  dumbbells: 'barbell-outline',
  kettlebells: 'fitness-outline',
  fullgym: 'business-outline',
};

interface EquipmentIconProps {
  tier: EquipmentTier;
  size: number;
  color?: string;
}

export function EquipmentIcon({ tier, size, color }: EquipmentIconProps) {
  const C = useColors();
  const name = TIER_ICONS[tier];
  if (!name) return null;
  return <Ionicons name={name} size={size} color={color ?? C.text} />;
}
