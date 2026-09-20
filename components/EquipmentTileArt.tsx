import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { EquipmentTier } from '@/lib/store';
import { EquipmentIcon } from './EquipmentIcon';

/**
 * THE PICTURE ON AN EQUIPMENT TILE, FROM ONE PLACE.
 *
 * Three screens draw the equipment question as photographs: the sign-up pager,
 * the Profile equipment sheet and the readiness "Equipment today" picker. Each
 * one carried its own copy of the same two lines - a photo map and an
 * <Image source={MAP[tier]} /> - which was fine while every tile had a
 * photograph and stopped being fine the moment one did not.
 *
 * There are five photographs and six tiles. "Bench, box or sturdy step" has no
 * artwork of its own, and an <Image> with an undefined source does not fail,
 * warn or fall back: it draws an empty box. That is what shipped on the
 * readiness screen - a blank 86pt grey banner beside five photographs - because
 * the fallback was added to two of the three copies and missed on the third.
 *
 * So the map and the fallback live here, once. A fourth screen that asks the
 * equipment question gets both for free, and cannot get one without the other.
 */
const EQUIPMENT_PHOTOS: Partial<Record<EquipmentTier, ReturnType<typeof require>>> = {
  bodyweight: require('@/assets/images/equipment/bodyweight.png'),
  bands: require('@/assets/images/equipment/bands.png'),
  dumbbells: require('@/assets/images/equipment/dumbbells.png'),
  kettlebells: require('@/assets/images/equipment/kettlebells.png'),
  fullgym: require('@/assets/images/equipment/fullgym.png'),
};

/**
 * True when this tier has a photograph, false when it falls back to the glyph.
 *
 * Exported so a test can say which of the two a tile is expected to draw
 * without writing the answer down twice.
 */
export function hasEquipmentPhoto(tier: EquipmentTier): boolean {
  return Boolean(EQUIPMENT_PHOTOS[tier]);
}

interface EquipmentTileArtProps {
  tier: EquipmentTier;
  /** Sizing for the photograph, which each picker frames differently. */
  imageStyle?: StyleProp<ImageStyle>;
  /** Point size for the line glyph drawn where there is no photograph. */
  iconSize?: number;
  iconColor?: string;
}

export function EquipmentTileArt({
  tier,
  imageStyle,
  iconSize = 26,
  iconColor,
}: EquipmentTileArtProps) {
  const photo = EQUIPMENT_PHOTOS[tier];
  if (photo) return <Image source={photo} style={imageStyle} resizeMode="contain" />;
  return <EquipmentIcon tier={tier} size={iconSize} color={iconColor} />;
}
