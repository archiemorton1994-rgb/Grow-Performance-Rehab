import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { EquipmentTier } from '@/lib/store';
import { GrowIcon } from './GrowIcon';

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
const TIER_ICONS: Partial<Record<EquipmentTier, keyof typeof Ionicons.glyphMap>> = {
  bodyweight: 'body-outline',
  bands: 'infinite-outline',
  dumbbells: 'barbell-outline',
  kettlebells: 'fitness-outline',
  fullgym: 'business-outline',
};

/**
 * THE BENCH IS DRAWN RATHER THAN BORROWED (Archie, 30 September 2026).
 *
 * His words: the "Bench, box or sturdy step" tile "should be a gym bench not a
 * green rectangle". It was Ionicons' `tablet-landscape-outline` - the flattest
 * glyph in that family and, drawn in the colour of a selected row, a green
 * rectangle. The house set has no bench either, so one was drawn for it: see
 * `bench` in lib/icon-art.ts for the shape and components/EquipmentTileArt for
 * the photograph that is still missing.
 *
 * It is here rather than in EquipmentTileArt so that every place the app names
 * this tier gets the bench - the two pickers, the sign-up pager, the Profile
 * summary row and the bench prompt card - instead of the tile getting it and the
 * rows keeping the rectangle.
 */
const DRAWN_TIERS: Partial<Record<EquipmentTier, 'bench'>> = {
  bench: 'bench',
};

interface EquipmentIconProps {
  tier: EquipmentTier;
  size: number;
  color?: string;
}

export function EquipmentIcon({ tier, size, color }: EquipmentIconProps) {
  const C = useColors();
  const drawn = DRAWN_TIERS[tier];
  if (drawn) return <GrowIcon name={drawn} size={size} color={color ?? C.text} />;
  const name = TIER_ICONS[tier];
  if (!name) return null;
  return <Ionicons name={name} size={size} color={color ?? C.text} />;
}
