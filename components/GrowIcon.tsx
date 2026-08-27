import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { ArtShape } from '@/lib/badge-art';
import { GROW_ICONS, GrowIconName } from '@/lib/icon-art';
import {
  deepStops,
  faceInkFor,
  deepToneOpacity,
  glyphStops,
  gradientId,
  GLYPH_GRADIENT_BOX,
  ICON_BOX,
  isDeepTone,
  MATERIAL_MIN_SIZE,
  shade,
  TILE_BOX,
  TILE_GLYPH_INSET,
  tileInk,
} from '@/lib/icon-material';

/**
 * Renders one of the app's own icons (lib/icon-art.ts).
 *
 * Drop-in shaped like Ionicons — `name`, `size`, `color` — so swapping a call
 * site is a one-line change and the two can coexist while the migration
 * proceeds. Ionicons stays the right tool for plain controls (chevrons, close,
 * the tab bar); this is for the illustrative icons that carry the app's look.
 *
 * The glyph is painted with a gradient rather than a flat fill. See
 * lib/icon-material.ts for why, and for the userSpaceOnUse trap that silently
 * deletes every straight line in the set if it is got wrong.
 */

const GLYPH_SCALE = (TILE_BOX - TILE_GLYPH_INSET * 2) / ICON_BOX;

export interface GrowIconProps {
  name: GrowIconName;
  size: number;
  color: string;
  /** Optional override for the muted tone. Defaults to `color`, which the
   *  material system then shades — right on every background the app uses. */
  mutedColor?: string;
}

/** The two ramps every glyph is painted with. Shared by the bare icon and the
 *  tile so the two cannot drift. */
function GlyphDefs({ color }: { color: string }) {
  const g = GLYPH_GRADIENT_BOX;
  return (
    <>
      <LinearGradient
        id={gradientId('gi', color)}
        gradientUnits="userSpaceOnUse"
        x1={g.x1}
        y1={g.y1}
        x2={g.x2}
        y2={g.y2}
      >
        {glyphStops(color).map((s) => (
          <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
        ))}
      </LinearGradient>
      <LinearGradient
        id={gradientId('gid', color)}
        gradientUnits="userSpaceOnUse"
        x1={g.x1}
        y1={g.y1}
        x2={g.x2}
        y2={g.y2}
      >
        {deepStops(color).map((s) => (
          <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
        ))}
      </LinearGradient>
    </>
  );
}

/**
 * The shapes themselves.
 *
 * `material` off falls back to the flat fill this used to do everywhere. It is
 * what runs below MATERIAL_MIN_SIZE, where a three-stop ramp across sixteen
 * pixels is banding rather than light.
 */
function Shapes({
  shapes,
  color,
  mutedColor,
  material,
}: {
  shapes: ArtShape[];
  color: string;
  mutedColor?: string;
  material: boolean;
}) {
  const solid = `url(#${gradientId('gi', color)})`;
  const deep = `url(#${gradientId('gid', color)})`;

  return (
    <>
      {shapes.map((s, i) => {
        const isDeep = isDeepTone(s.o);
        // `face` ink is for a shape drawn ON a solid glyph, where what is
        // behind it IS the glyph colour — the tick on the `check` seal is the
        // only one. It resolves to whatever will read on that colour rather
        // than to the muted tone, which would be the same green on green.
        const paint = (which?: 'glyph' | 'face') => {
          if (which == null) return 'none';
          if (which === 'face') return mutedColor ?? faceInkFor(color);
          if (!material) return color;
          return isDeep ? deep : solid;
        };
        const opacity = material && isDeep ? deepToneOpacity(s.o) : s.o;
        const common = {
          fill: paint(s.fill),
          stroke: paint(s.stroke),
          strokeWidth: s.sw,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          opacity,
          ...(s.rot != null ? { rotation: s.rot, originX: ICON_BOX / 2, originY: ICON_BOX / 2 } : null),
        };
        if (s.k === 'circle') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
        if (s.k === 'rect')
          return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
        return <Path key={i} d={s.d} {...common} />;
      })}
    </>
  );
}

function GrowIconImpl({ name, size, color, mutedColor }: GrowIconProps) {
  const shapes: ArtShape[] = GROW_ICONS[name] ?? [];
  const material = size >= MATERIAL_MIN_SIZE;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${ICON_BOX} ${ICON_BOX}`}>
      {material && (
        <Defs>
          <GlyphDefs color={color} />
        </Defs>
      )}
      <G>
        <Shapes shapes={shapes} color={color} mutedColor={mutedColor} material={material} />
      </G>
    </Svg>
  );
}

export const GrowIcon = React.memo(GrowIconImpl);

// ── The tile ────────────────────────────────────────────────────────────────

export interface GrowIconTileProps {
  name: GrowIconName;
  /** Outer size of the tile, not of the glyph. */
  size: number;
  /** Glyph ink. */
  color: string;
  /** Tile surface. A theme token — primaryMuted and surfaceTertiary are the
   *  two this app uses. */
  face: string;
  /** Squircle by default; circle where the surrounding shapes are round. */
  shape?: 'squircle' | 'circle';
}

/**
 * A glyph on a lit surface — the icon equivalent of a struck medallion.
 *
 * WHAT THIS REPLACES
 * ──────────────────
 * Every one of these call sites was a plain `<View>` with a flat backgroundColor
 * and an icon dropped in the middle. Three of them are on the first screen a
 * new user ever sees. A flat green rounded square with a thin glyph in it is
 * what a placeholder looks like, and it was read as one.
 *
 * The devices are the medallion's, one level down: a face that is lighter where
 * the light hits it, a rim that separates the tile from the page, a highlight
 * along the lit edge, and a gloss over the top third. Nothing here is a picture
 * of a material — it is the same four moves that made the badges read as
 * objects.
 */
function GrowIconTileImpl({
  name,
  size,
  color,
  face,
  shape = 'squircle',
}: GrowIconTileProps) {
  const shapes: ArtShape[] = GROW_ICONS[name] ?? [];
  const ink = tileInk(face);
  const uid = gradientId('git', face);
  const glossId = `${uid}-gloss`;
  // A squircle at ~29% of the box, which is the radius iOS app icons use and
  // reads as deliberate rather than as a rounded rectangle.
  const r = shape === 'circle' ? TILE_BOX / 2 : TILE_BOX * 0.29;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${TILE_BOX} ${TILE_BOX}`}>
      <Defs>
        <GlyphDefs color={color} />
        <LinearGradient id={uid} x1="12%" y1="0%" x2="88%" y2="100%">
          <Stop offset="0" stopColor={ink.faceLight} />
          <Stop offset="1" stopColor={ink.faceDark} />
        </LinearGradient>
        <LinearGradient id={glossId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.13} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Face */}
      <Rect x={0} y={0} width={TILE_BOX} height={TILE_BOX} rx={r} fill={`url(#${uid})`} />
      {/* Rim, inset by half its own width so it sits ON the edge, not over it */}
      <Rect
        x={0.9}
        y={0.9}
        width={TILE_BOX - 1.8}
        height={TILE_BOX - 1.8}
        rx={Math.max(0, r - 0.9)}
        fill="none"
        stroke={ink.rim}
        strokeOpacity={0.55}
        strokeWidth={1.8}
      />
      {/* Light along the top edge, turning the upper-right corner. The
          medallion does this with an arc across its upper left; a squircle has
          to follow its own outline or the highlight floats free of the shape. */}
      <Path
        d={`M${r} 1.8 H${TILE_BOX - r} A${r - 1.8} ${r - 1.8} 0 0 1 ${TILE_BOX - 1.8} ${r}`}
        fill="none"
        stroke={shade(ink.faceLight, 0.5)}
        strokeOpacity={0.5}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      {/* Gloss over the top third, as on the medallion face */}
      <Ellipse
        cx={TILE_BOX / 2}
        cy={TILE_BOX * 0.3}
        rx={TILE_BOX * 0.36}
        ry={TILE_BOX * 0.16}
        fill={`url(#${glossId})`}
      />

      <G transform={`translate(${TILE_GLYPH_INSET}, ${TILE_GLYPH_INSET}) scale(${GLYPH_SCALE})`}>
        <Shapes shapes={shapes} color={color} material />
      </G>
    </Svg>
  );
}

export const GrowIconTile = React.memo(GrowIconTileImpl);
