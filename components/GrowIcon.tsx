import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { ArtShape } from '@/lib/badge-art';
import { GROW_ICONS, GrowIconName } from '@/lib/icon-art';

/**
 * Renders one of the app's own icons (lib/icon-art.ts).
 *
 * Drop-in shaped like Ionicons — `name`, `size`, `color` — so swapping a call
 * site is a one-line change and the two can coexist while the migration
 * proceeds. Ionicons stays the right tool for plain controls (chevrons, close,
 * the tab bar); this is for the illustrative icons that carry the app's look.
 */

const BOX = 48;

export interface GrowIconProps {
  name: GrowIconName;
  size: number;
  color: string;
  /** Optional override for the muted tone. Defaults to `color` at low opacity,
   *  which is right on every background the app currently uses. */
  mutedColor?: string;
}

function GrowIconImpl({ name, size, color, mutedColor }: GrowIconProps) {
  const shapes: ArtShape[] = GROW_ICONS[name] ?? [];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      <G>
        {shapes.map((s, i) => {
          // Icon art has no `face` ink — see the note in lib/icon-art.ts. Any
          // shape asking for it is drawn in the muted tone rather than punching
          // a hole in an unknown background.
          const paint = (which?: 'glyph' | 'face') =>
            which == null ? 'none' : which === 'face' ? (mutedColor ?? color) : color;
          const common = {
            fill: paint(s.fill),
            stroke: paint(s.stroke),
            strokeWidth: s.sw,
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
            opacity: s.o,
            ...(s.rot != null ? { rotation: s.rot, originX: BOX / 2, originY: BOX / 2 } : null),
          };
          if (s.k === 'circle') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
          if (s.k === 'rect')
            return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
          return <Path key={i} d={s.d} {...common} />;
        })}
      </G>
    </Svg>
  );
}

export const GrowIcon = React.memo(GrowIconImpl);
