import { Platform } from 'react-native';

/**
 * Shared shadow system. Every screen used to hand-roll shadowColor/shadowOffset/
 * shadowOpacity/shadowRadius/elevation independently, which is (a) genuinely
 * duplicated across ~15 near-identical declarations and (b) the source of a
 * recurring "shadow* style props are deprecated. Use boxShadow" console warning
 * on web, since react-native-web wants a CSS box-shadow string there instead of
 * the native shadow* props.
 *
 * shadowStyle() is the one place that translates a shadow "recipe" into the
 * right style shape per platform. Everything else — the named tiers below, and
 * any one-off colored glow — should go through it rather than declaring
 * shadowColor/shadowOffset/etc. directly.
 */
function hexToRgba(hex: string, opacity: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function shadowStyle(
  color: string,
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number,
  offsetX = 0
) {
  if (Platform.OS === 'web') {
    return { boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${hexToRgba(color, opacity)}` };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

/** Subtle list-row / small-card lift. */
export function xsShadow(color: string) {
  return shadowStyle(color, 0.06, 3, 1, 2);
}

/** Standard card — the default for most cards, chips, and panels. */
export function cardShadow(color: string) {
  return shadowStyle(color, 0.12, 10, 4, 6);
}

/** Floating/prominent elements — bottom action bars, primary CTA cards. */
export function elevatedShadow(color: string) {
  return shadowStyle(color, 0.2, 16, 6, 10);
}

/** Bottom sheets / modals — shadow sits above the element, not below. */
export function sheetShadow(color: string) {
  return shadowStyle(color, 0.1, 16, -4, 12);
}

/** Colored glow for badges, unlock celebrations, and highlighted CTAs. */
export function glowShadow(color: string, opacity = 0.35, radius = 8) {
  return shadowStyle(color, opacity, radius, 3, 5);
}
