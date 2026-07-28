import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { PainRegion, useAppStore } from '@/lib/store';
import { useColors } from '@/constants/colors';

type BodyView = 'front' | 'back';
type BodyCategory = 'muscles' | 'joints';

// ─── Colour vocabulary ────────────────────────────────────────────────────────
// These four states are used consistently across ALL diagram appearances:
//   worked     — primary muscles trained / selected region   (emerald green)
//   attention  — secondary / moderate volume / adjacent pain (orange)
//   overloaded — high pain frequency / excessive volume      (red)
//   rest       — not trained, no signal                      (dark grey)
const VOCAB_WORKED = '#4ade80'; // bright emerald-green — pops on dark backgrounds
const VOCAB_ATTENTION = '#fbbf24'; // amber-400
const VOCAB_OVERLOADED = '#f87171'; // red-400
const VOCAB_REST = '#2a2a2a'; // dark grey (visible on dark panel)

// Legacy joint colour kept for non-heatmap joint category display
const JOINT_CLR = '#4a7e9b';

// Dark panel background for the diagram container. Exported so screens using
// `compact` mode (which skips this component's own panel wrapper) can recreate
// the same panel colour around their own layout instead of guessing a value.
export const PANEL_BG = '#0d0d0d';

// ─── Region categorisation ────────────────────────────────────────────────────
export const MUSCLE_SET = new Set<PainRegion>([
  'chest',
  'bicep',
  'tricep',
  'core_ribs',
  'quads',
  'hamstrings',
  'glutes',
  'lat_mid_back',
  'upper_back',
  'lower_back',
  'calf_shin',
]);

// ── ADDING A NEW PAIN REGION — update ALL four of these: ─────────────────────
//
//  1. lib/store.ts              → add the literal to the PainRegion union type
//  2. BODY_DIAGRAM_LABELS       → add a human-readable label  (this file, below)
//  3. MUSCLE_SET                → add it here if it is a muscle region;
//                                 joint regions are classified automatically
//                                 (this file, above — no change needed for joints)
//  4. FRONT_REGION_SLUGS /      → add the slug(s) for the new region in the
//     BACK_REGION_SLUGS           correct view map(s); also update the reverse
//                                 FRONT_SLUG_TO_REGION / BACK_SLUG_TO_REGION maps
//
//  The contract test at tests/body-diagram-region-coverage.check.mjs verifies
//  steps 2–4 automatically on every run; step 1 is checked by TypeScript.
//
//  Also update renderFrontHotspots / renderBackHotspots below (contract compliance).
// ─────────────────────────────────────────────────────────────────────────────

export const BODY_DIAGRAM_LABELS: Record<PainRegion, string> = {
  neck: 'Neck',
  front_shoulder: 'Front Shoulder',
  rear_shoulder: 'Rear Shoulder',
  elbow_wrist: 'Elbow / Wrist',
  upper_back: 'Upper Back',
  lower_back: 'Lower Back',
  core_ribs: 'Core / Ribs',
  hip_groin: 'Hip / Groin',
  knee: 'Knee',
  calf_shin: 'Calf / Shin',
  ankle_achilles: 'Ankle / Achilles',
  chest: 'Chest',
  bicep: 'Biceps',
  tricep: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  lat_mid_back: 'Lats / Mid Back',
};

// ── Cycle-through order: body-order top → bottom, per view ───────────────────
// Used by the cycle-through arrow button to step through selectable regions.
const FRONT_CYCLE_ORDER: PainRegion[] = [
  'neck',
  'front_shoulder',
  'chest',
  'bicep',
  'elbow_wrist',
  'upper_back',
  'core_ribs',
  'hip_groin',
  'quads',
  'knee',
  'calf_shin',
  'ankle_achilles',
];
const BACK_CYCLE_ORDER: PainRegion[] = [
  'neck',
  'rear_shoulder',
  'upper_back',
  'lat_mid_back',
  'tricep',
  'elbow_wrist',
  'lower_back',
  'glutes',
  'hamstrings',
  'knee',
  'calf_shin',
  'ankle_achilles',
];

// ── Library slug mappings ─────────────────────────────────────────────────────
// Front view: PainRegion → library Slug(s)
const FRONT_REGION_SLUGS: Partial<Record<PainRegion, Slug[]>> = {
  neck: ['neck'],
  front_shoulder: ['deltoids'],
  elbow_wrist: ['forearm'],
  upper_back: ['trapezius'],
  core_ribs: ['abs', 'obliques'],
  hip_groin: ['adductors'],
  knee: ['knees'],
  calf_shin: ['tibialis', 'calves'],
  ankle_achilles: ['ankles'],
  chest: ['chest'],
  bicep: ['biceps'],
  quads: ['quadriceps'],
};

// Back view: PainRegion → library Slug(s)
const BACK_REGION_SLUGS: Partial<Record<PainRegion, Slug[]>> = {
  neck: ['neck'],
  rear_shoulder: ['deltoids'],
  elbow_wrist: ['forearm'],
  upper_back: ['trapezius'],
  lower_back: ['lower-back'],
  lat_mid_back: ['upper-back'],
  knee: ['knees'],
  calf_shin: ['calves'],
  ankle_achilles: ['ankles'],
  tricep: ['triceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
};

// Reverse maps: library Slug → PainRegion (view-specific)
const FRONT_SLUG_TO_REGION: Partial<Record<Slug, PainRegion>> = {
  neck: 'neck',
  deltoids: 'front_shoulder',
  forearm: 'elbow_wrist',
  trapezius: 'upper_back',
  abs: 'core_ribs',
  obliques: 'core_ribs',
  adductors: 'hip_groin',
  knees: 'knee',
  tibialis: 'calf_shin',
  calves: 'calf_shin',
  ankles: 'ankle_achilles',
  chest: 'chest',
  biceps: 'bicep',
  quadriceps: 'quads',
};

const BACK_SLUG_TO_REGION: Partial<Record<Slug, PainRegion>> = {
  neck: 'neck',
  deltoids: 'rear_shoulder',
  forearm: 'elbow_wrist',
  trapezius: 'upper_back',
  'lower-back': 'lower_back',
  'upper-back': 'lat_mid_back',
  knees: 'knee',
  calves: 'calf_shin',
  ankles: 'ankle_achilles',
  triceps: 'tricep',
  hamstring: 'hamstrings',
  gluteal: 'glutes',
};

// ── Colour helpers ─────────────────────────────────────────────────────────────
function colorWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Map a heatmap count to the 4-state colour vocabulary */
export function heatmapColor(count: number): string {
  if (count <= 0) return colorWithAlpha(VOCAB_REST, 0.55);
  if (count === 1) return VOCAB_WORKED;
  if (count <= 3) return VOCAB_ATTENTION;
  return VOCAB_OVERLOADED;
}

/** Solid (full-opacity) bucket colour for a given heatmap count */
export function heatmapBucketColor(count: number): string {
  if (count <= 0) return VOCAB_REST;
  if (count === 1) return VOCAB_WORKED;
  if (count <= 3) return VOCAB_ATTENTION;
  return VOCAB_OVERLOADED;
}

// Approximate SVG-viewBox centre point for each region.
// The body-highlighter library renders at height=400*scale while the container
// is svgWidth*2.4 = 480*scale, so the figure occupies 400/480 = 5/6 of the
// overlay coordinate space.  All Y values are therefore multiplied by 5/6 so
// ripple animations fire at the correct visual centre of each muscle group.
// Both bilateral regions (arms, shoulders) use the body vertical midline x=100
// so the ripple appears near the torso rather than at the SVG edge.
const REGION_ANCHOR: Record<PainRegion, { x: number; y: number }> = {
  neck: { x: 100, y: 48 },
  front_shoulder: { x: 100, y: 89 },
  rear_shoulder: { x: 100, y: 89 },
  chest: { x: 100, y: 81 },
  bicep: { x: 100, y: 102 },
  tricep: { x: 100, y: 102 },
  elbow_wrist: { x: 100, y: 158 },
  upper_back: { x: 100, y: 57 },
  core_ribs: { x: 100, y: 123 },
  lower_back: { x: 100, y: 135 },
  lat_mid_back: { x: 100, y: 108 },
  hip_groin: { x: 100, y: 163 },
  glutes: { x: 100, y: 196 },
  quads: { x: 100, y: 213 },
  hamstrings: { x: 100, y: 258 },
  knee: { x: 100, y: 278 },
  calf_shin: { x: 100, y: 325 },
  ankle_achilles: { x: 100, y: 368 },
};

interface BodyDiagramProps {
  selected?: PainRegion | undefined;
  onSelect: (region: PainRegion | undefined) => void;
  /** Multi-select: all currently selected regions (highlighted alongside `selected`) */
  selectedRegions?: PainRegion[];
  accentColor?: string;
  accentColorLight?: string;
  defaultView?: BodyView;
  maxWidth?: number;
  /** When provided, activates heatmap mode: zones are coloured by frequency */
  heatmapCounts?: Partial<Record<PainRegion, number>>;
  /** Set false to opt out of the dark panel container (rare) */
  darkPanel?: boolean;
  /**
   * Compact mode: renders just the body SVG with no toggles, label, legend,
   * or panel wrapper. Use when embedding multiple diagrams side-by-side in a
   * custom container. Silhouette is drawn white (suitable for dark backgrounds).
   */
  compact?: boolean;
  /**
   * When true, the silhouette defaultFill switches to a warm dark ink colour
   * so the body shape is legible on a light/ecru background (certificate card).
   */
  lightBg?: boolean;
  /**
   * Override the three heatmap legend labels [low, medium, high].
   * Defaults to ['Worked', 'Secondary', 'High load'].
   * Use context-specific labels when the diagram is showing pain frequency
   * rather than muscle-training volume.
   */
  legendLabels?: [string, string, string];
}

export function BodyDiagram({
  selected,
  onSelect,
  selectedRegions,
  accentColor,
  accentColorLight,
  defaultView = 'front',
  maxWidth = 200,
  heatmapCounts,
  darkPanel = true,
  compact = false,
  lightBg = false,
  legendLabels = ['Worked', 'Secondary', 'High load'],
}: BodyDiagramProps) {
  const [view, setView] = useState<BodyView>(defaultView);
  const [category, setCategory] = useState<BodyCategory>('muscles');
  const C = useColors();
  const sex = useAppStore((s) => s.userProfile.sex);
  const gender = sex === 'female' ? 'female' : 'male';
  const { width: screenWidth } = useWindowDimensions();

  const accent = accentColor ?? C.warning;
  const accentBg = accentColorLight ?? C.warningLight;

  const svgWidth = Math.min(screenWidth - 80, maxWidth);
  const scale = svgWidth / 200;

  // ─── Affordance pulse animation — runs indefinitely until first tap ───────
  const pulseAnim = useSharedValue(1);
  const hasTapped = useRef(false);

  useEffect(() => {
    if (heatmapCounts) return;
    hasTapped.current = false;
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const svgAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const stopPulse = () => {
    if (hasTapped.current) return;
    hasTapped.current = true;
    cancelAnimation(pulseAnim);
    pulseAnim.value = withTiming(1.0, { duration: 150 });
  };

  // ─── Ripple animation on tap (anchored to the tapped region) ────────────
  const RIPPLE_SIZE = 44; // px — absolute size before scale animation
  const rippleScale = useSharedValue(0.5);
  const rippleOpacity = useSharedValue(0);
  const [ripplePos, setRipplePos] = useState<{ px: number; py: number } | null>(null);

  const triggerRipple = (region: PainRegion) => {
    const anchor = REGION_ANCHOR[region];
    // Convert SVG viewBox coords → rendered pixel coords
    const px = anchor.x * scale - RIPPLE_SIZE / 2;
    const py = anchor.y * scale - RIPPLE_SIZE / 2;
    setRipplePos({ px, py });
    rippleScale.value = 0.3;
    rippleOpacity.value = 0.55;
    rippleScale.value = withTiming(2.2, { duration: 480, easing: Easing.out(Easing.cubic) });
    rippleOpacity.value = withTiming(0, { duration: 480, easing: Easing.out(Easing.quad) });
  };

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  // ─── Tap handler ────────────────────────────────────────────────────────────
  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ─── Cycle-through: advance to next selectable region in body order ─────────
  const handleCycle = () => {
    const allRegions = view === 'front' ? FRONT_CYCLE_ORDER : BACK_CYCLE_ORDER;
    const regions = allRegions.filter((r) => {
      const isMuscle = MUSCLE_SET.has(r);
      return category === 'muscles' ? isMuscle : !isMuscle;
    });
    if (regions.length === 0) return;
    // Multi-select: advance past the last added region.
    // Single-select: advance past the currently selected region.
    const currentRegion =
      selected !== undefined
        ? selected
        : selectedRegions?.length
          ? selectedRegions[selectedRegions.length - 1]
          : undefined;
    const currentIdx = currentRegion !== undefined ? regions.indexOf(currentRegion) : -1;
    const nextRegion = regions[(currentIdx + 1) % regions.length];
    stopPulse();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerRipple(nextRegion);
    onSelect(nextRegion);
  };

  // ─── h(): interactive zone — MUST use rgba(0,0,0,0.001) (not transparent/none)
  // react-native-svg only fires onPress for painted (non-transparent) fills on iOS/Android.
  // Out-of-category regions use rgba(0,0,0,0) (fully transparent) so native touch
  // events do not fire; onPress is a no-op so Jest tests can still call it safely.
  // Heatmap mode bypasses category filtering — all regions are always tappable.
  const h = (r: PainRegion) => {
    if (!heatmapCounts) {
      const isMuscle = MUSCLE_SET.has(r);
      const inCategory = category === 'muscles' ? isMuscle : !isMuscle;
      if (!inCategory) {
        return {
          fill: 'rgba(0,0,0,0)',
          stroke: 'transparent',
          strokeWidth: 0,
          onPress: () => {},
          testID: `body-diagram-region-${r}` as string,
        };
      }
    }
    return {
      fill: 'rgba(0,0,0,0.001)',
      stroke: 'transparent',
      strokeWidth: 0,
      onPress: () => {
        stopPulse();
        tap();
        triggerRipple(r);
        onSelect(r);
      },
      testID: `body-diagram-region-${r}` as string,
    };
  };

  // ─── Hotspot overlay render functions ──────────────────────────────────────
  // Biceps and triceps paths are intentionally large to ensure reliable tap targets.
  // All paths use rgba(0,0,0,0.001) fill so react-native-svg fires onPress on iOS/Android.
  // Contract tests (tests/body-diagram*.check.mjs) verify every PainRegion is covered.

  const renderFrontHotspots = () => (
    <G>
      {/* Neck — enlarged tap target (was 28 wide × 18 tall, now 46 wide × 24 tall) */}
      <Path d="M 80,42 C 76,48 74,56 74,64 L 126,64 C 126,56 124,48 120,42 Z" {...h('neck')} />
      {/* Front shoulders — enlarged to cover full deltoid area */}
      <Path
        d="M 50,72 C 38,70 22,68 10,72 C 2,76 0,88 0,102 C 0,116 4,128 12,136 C 18,142 28,146 38,144 C 48,142 54,134 54,122 L 54,94 Z"
        {...h('front_shoulder')}
      />
      <Path
        d="M 150,72 C 162,70 178,68 190,72 C 198,76 200,88 200,102 C 200,116 196,128 188,136 C 182,142 172,146 162,144 C 152,142 146,134 146,122 L 146,94 Z"
        {...h('front_shoulder')}
      />
      {/* Chest */}
      <Path
        d="M 52,76 C 56,70 66,68 76,68 C 84,68 92,72 98,78 L 100,82 C 98,96 94,110 88,122 C 80,126 70,126 62,122 C 56,118 52,108 52,96 Z"
        {...h('chest')}
      />
      <Path
        d="M 148,76 C 144,70 134,68 124,68 C 116,68 108,72 102,78 L 100,82 C 102,96 106,110 112,122 C 120,126 130,126 138,122 C 144,118 148,108 148,96 Z"
        {...h('chest')}
      />
      {/* Biceps — significantly enlarged tap targets covering the upper arm */}
      <Path
        d="M 0,88 C 0,104 2,120 6,134 C 10,146 18,154 30,152 C 42,150 50,140 50,126 C 50,110 44,96 36,90 C 26,84 10,82 0,88 Z"
        {...h('bicep')}
      />
      <Path
        d="M 200,88 C 200,104 198,120 194,134 C 190,146 182,154 170,152 C 158,150 150,140 150,126 C 150,110 156,96 164,90 C 174,84 190,82 200,88 Z"
        {...h('bicep')}
      />
      {/* Forearm / Elbow+Wrist */}
      <Path
        d="M 8,154 C 4,168 2,184 2,200 C 2,212 4,222 10,228 C 16,234 24,234 30,228 C 36,222 38,210 38,196 C 38,182 36,168 32,156 C 24,150 12,150 8,154 Z"
        {...h('elbow_wrist')}
      />
      <Path
        d="M 192,154 C 196,168 198,184 198,200 C 198,212 196,222 190,228 C 184,234 176,234 170,228 C 164,222 162,210 162,196 C 162,182 164,168 168,156 C 176,150 188,150 192,154 Z"
        {...h('elbow_wrist')}
      />
      {/* Core / Ribs */}
      <Path
        d="M 53,120 C 54,132 54,144 54,156 C 54,164 56,170 58,176 C 66,180 82,182 100,182 C 118,182 134,180 142,176 C 144,170 146,164 146,156 C 146,144 146,132 147,120 C 134,124 120,126 110,126 L 90,126 C 80,126 66,124 53,120 Z"
        {...h('core_ribs')}
      />
      {/* Hip / Groin — enlarged tap target (taller band, extends higher) */}
      <Path
        d="M 54,172 C 46,180 42,192 42,204 C 46,212 62,216 82,218 L 118,218 C 138,216 154,212 158,204 C 158,192 154,180 146,172 C 134,176 118,178 100,178 C 82,178 66,176 54,172 Z"
        {...h('hip_groin')}
      />
      {/* Quads */}
      <Path
        d="M 48,202 C 40,214 32,230 26,248 C 22,262 22,278 24,294 C 26,306 32,318 40,322 C 50,324 62,320 70,312 C 78,302 80,288 78,272 C 76,256 72,240 70,226 C 68,214 70,204 72,200 C 62,198 54,198 48,202 Z"
        {...h('quads')}
      />
      <Path
        d="M 152,202 C 160,214 168,230 174,248 C 178,262 178,278 176,294 C 174,306 168,318 160,322 C 150,324 138,320 130,312 C 122,302 120,288 122,272 C 124,256 128,240 130,226 C 132,214 130,204 128,200 C 138,198 146,198 152,202 Z"
        {...h('quads')}
      />
      {/* Knees — enlarged tap targets (start 14px higher, wider) */}
      <Path
        d="M 16,306 C 14,320 16,336 22,346 C 28,354 40,358 52,358 C 64,358 74,352 78,344 C 82,334 82,318 78,308 C 66,314 58,320 50,320 C 42,320 30,314 16,306 Z"
        {...h('knee')}
      />
      <Path
        d="M 184,306 C 186,320 184,336 178,346 C 172,354 160,358 148,358 C 136,358 126,352 122,344 C 118,334 118,318 122,308 C 134,314 142,320 150,320 C 158,320 170,314 184,306 Z"
        {...h('knee')}
      />
      {/* Calf / Shin */}
      <Path
        d="M 24,348 C 18,360 16,374 16,388 C 16,402 20,416 26,426 C 32,434 40,438 50,438 C 60,438 68,434 74,426 C 80,416 82,402 80,388 C 78,374 74,358 70,348 C 62,342 50,340 40,344 Z"
        {...h('calf_shin')}
      />
      <Path
        d="M 176,348 C 182,360 184,374 184,388 C 184,402 180,416 174,426 C 168,434 160,438 150,438 C 140,438 132,434 126,426 C 120,416 118,402 120,388 C 122,374 126,358 130,348 C 138,342 150,340 160,344 Z"
        {...h('calf_shin')}
      />
      {/* Ankles / Achilles — enlarged tap targets (start 14px higher) */}
      <Path
        d="M 14,418 C 8,428 6,440 10,452 C 12,460 24,462 40,462 L 66,462 C 82,462 92,460 94,452 C 96,438 90,426 84,418 C 72,422 60,424 50,424 C 38,424 26,422 14,418 Z"
        {...h('ankle_achilles')}
      />
      <Path
        d="M 186,418 C 192,428 194,440 190,452 C 188,460 176,462 160,462 L 134,462 C 118,462 108,460 106,452 C 104,438 110,426 116,418 C 128,422 140,424 150,424 C 162,424 174,422 186,418 Z"
        {...h('ankle_achilles')}
      />
      {/* Upper back / Trapezius (front view — visible as trap at top) */}
      <Path d="M 56,60 Q 79,56 100,56 Q 121,56 144,60 L 144,80 L 56,80 Z" {...h('upper_back')} />
    </G>
  );

  const renderBackHotspots = () => (
    <G>
      {/* Neck — enlarged tap target (was 28 wide × 18 tall, now 46 wide × 24 tall) */}
      <Path d="M 80,42 C 76,48 74,56 74,64 L 126,64 C 126,56 124,48 120,42 Z" {...h('neck')} />
      {/* Front shoulder — rendered beneath rear_shoulder so rear_shoulder captures
          taps from the back view; front_shoulder is still selectable from the sides
          of the shoulder area not covered by the rear_shoulder path */}
      <Path
        d="M 50,72 C 38,70 22,68 10,72 C 2,76 0,88 0,102 C 0,116 4,128 12,136 C 18,142 28,146 38,144 C 48,142 54,134 54,122 L 54,94 Z"
        {...h('front_shoulder')}
      />
      <Path
        d="M 150,72 C 162,70 178,68 190,72 C 198,76 200,88 200,102 C 200,116 196,128 188,136 C 182,142 172,146 162,144 C 152,142 146,134 146,122 L 146,94 Z"
        {...h('front_shoulder')}
      />
      {/* Rear shoulders — enlarged; rendered after front_shoulder so they sit on
          top and are the default tap target for the shoulder area from back view */}
      <Path
        d="M 50,72 C 38,70 22,68 10,72 C 2,76 0,88 0,102 C 0,116 4,128 12,136 C 18,142 28,146 38,144 C 48,142 54,134 54,122 L 54,94 Z"
        {...h('rear_shoulder')}
      />
      <Path
        d="M 150,72 C 162,70 178,68 190,72 C 198,76 200,88 200,102 C 200,116 196,128 188,136 C 182,142 172,146 162,144 C 152,142 146,134 146,122 L 146,94 Z"
        {...h('rear_shoulder')}
      />
      {/* Triceps — significantly enlarged tap targets covering the rear upper arm */}
      <Path
        d="M 0,90 C 0,108 2,124 6,138 C 10,150 20,158 32,156 C 44,154 52,142 52,128 C 52,112 46,98 38,92 C 28,86 10,84 0,90 Z"
        {...h('tricep')}
      />
      <Path
        d="M 200,90 C 200,108 198,124 194,138 C 190,150 180,158 168,156 C 156,154 148,142 148,128 C 148,112 154,98 162,92 C 172,86 190,84 200,90 Z"
        {...h('tricep')}
      />
      {/* Forearm / Elbow+Wrist */}
      <Path
        d="M 8,154 C 4,168 2,184 2,200 C 2,212 4,222 10,228 C 16,234 24,234 30,228 C 36,222 38,210 38,196 C 38,182 36,168 32,156 C 24,150 12,150 8,154 Z"
        {...h('elbow_wrist')}
      />
      <Path
        d="M 192,154 C 196,168 198,184 198,200 C 198,212 196,222 190,228 C 184,234 176,234 170,228 C 164,222 162,210 162,196 C 162,182 164,168 168,156 C 176,150 188,150 192,154 Z"
        {...h('elbow_wrist')}
      />
      {/* Upper back */}
      <Path
        d="M 100,64 C 88,70 76,82 70,96 C 66,106 66,118 70,128 C 74,136 84,140 94,140 L 106,140 C 116,140 126,136 130,128 C 134,118 134,106 130,96 C 124,82 112,70 100,64 Z"
        {...h('upper_back')}
      />
      {/* Lats / Mid back */}
      <Path
        d="M 50,76 C 44,88 40,102 36,118 C 32,132 30,146 30,160 C 30,172 32,180 38,186 C 44,190 52,190 56,184 C 60,176 62,160 62,144 C 62,128 62,112 62,98 C 62,88 60,80 58,76 Z"
        {...h('lat_mid_back')}
      />
      <Path
        d="M 150,76 C 156,88 160,102 164,118 C 168,132 170,146 170,160 C 170,172 168,180 162,186 C 156,190 148,190 144,184 C 140,176 138,160 138,144 C 138,128 138,112 138,98 C 138,88 140,80 142,76 Z"
        {...h('lat_mid_back')}
      />
      {/* Lower back */}
      <Path
        d="M 68,138 C 64,148 62,158 62,168 C 62,176 64,182 70,186 C 78,190 90,192 100,192 C 110,192 122,190 130,186 C 136,182 138,176 138,168 C 138,158 136,148 132,138 C 122,134 112,132 100,132 C 88,132 78,134 68,138 Z"
        {...h('lower_back')}
      />
      {/* Glutes */}
      <Path
        d="M 44,186 C 32,192 20,204 14,220 C 8,236 8,252 14,264 C 20,274 32,280 48,280 C 62,280 74,272 80,258 C 86,244 86,226 80,212 C 74,200 60,192 44,186 Z"
        {...h('glutes')}
      />
      <Path
        d="M 156,186 C 168,192 180,204 186,220 C 192,236 192,252 186,264 C 180,274 168,280 152,280 C 138,280 126,272 120,258 C 114,244 114,226 120,212 C 126,200 140,192 156,186 Z"
        {...h('glutes')}
      />
      {/* Hamstrings */}
      <Path
        d="M 26,268 C 20,280 16,294 14,310 C 12,322 12,334 16,342 C 20,348 28,352 38,350 C 48,348 56,340 60,330 C 64,320 66,306 64,290 C 62,276 58,264 52,258 C 44,260 34,264 26,268 Z"
        {...h('hamstrings')}
      />
      <Path
        d="M 174,268 C 180,280 184,294 186,310 C 188,322 188,334 184,342 C 180,348 172,352 162,350 C 152,348 144,340 140,330 C 136,320 134,306 136,290 C 138,276 142,264 148,258 C 156,260 166,264 174,268 Z"
        {...h('hamstrings')}
      />
      {/* Knees — enlarged tap targets (start 14px higher, wider) */}
      <Path
        d="M 16,306 C 14,320 16,336 22,346 C 28,354 40,358 52,358 C 64,358 74,352 78,344 C 82,334 82,318 78,308 C 66,314 58,320 50,320 C 42,320 30,314 16,306 Z"
        {...h('knee')}
      />
      <Path
        d="M 184,306 C 186,320 184,336 178,346 C 172,354 160,358 148,358 C 136,358 126,352 122,344 C 118,334 118,318 122,308 C 134,314 142,320 150,320 C 158,320 170,314 184,306 Z"
        {...h('knee')}
      />
      {/* Calf / Shin */}
      <Path
        d="M 24,348 C 18,360 16,374 16,388 C 16,402 20,416 26,426 C 32,434 40,438 50,438 C 60,438 68,434 74,426 C 80,416 82,402 80,388 C 78,374 74,358 70,348 C 62,342 50,340 40,344 Z"
        {...h('calf_shin')}
      />
      <Path
        d="M 176,348 C 182,360 184,374 184,388 C 184,402 180,416 174,426 C 168,434 160,438 150,438 C 140,438 132,434 126,426 C 120,416 118,402 120,388 C 122,374 126,358 130,348 C 138,342 150,340 160,344 Z"
        {...h('calf_shin')}
      />
      {/* Ankles / Achilles — enlarged tap targets (start 14px higher) */}
      <Path
        d="M 14,418 C 8,428 6,440 10,452 C 12,460 24,462 40,462 L 66,462 C 82,462 92,460 94,452 C 96,438 90,426 84,418 C 72,422 60,424 50,424 C 38,424 26,422 14,418 Z"
        {...h('ankle_achilles')}
      />
      <Path
        d="M 186,418 C 192,428 194,440 190,452 C 188,460 176,462 160,462 L 134,462 C 118,462 108,460 106,452 C 104,438 110,426 116,418 C 128,422 140,424 150,424 C 162,424 174,422 186,418 Z"
        {...h('ankle_achilles')}
      />
    </G>
  );

  // ─── Build library data array ─────────────────────────────────────────────────
  const bodyData = useMemo((): ExtendedBodyPart[] => {
    const slugMap = view === 'front' ? FRONT_REGION_SLUGS : BACK_REGION_SLUGS;
    const result: ExtendedBodyPart[] = [];

    if (heatmapCounts !== undefined) {
      for (const [region, slugs] of Object.entries(slugMap) as [PainRegion, Slug[]][]) {
        const count = heatmapCounts[region] ?? 0;
        const fillColor = heatmapColor(count);
        for (const slug of slugs) {
          result.push({ slug, styles: { fill: fillColor } });
        }
      }
      return result;
    }

    for (const [region, slugs] of Object.entries(slugMap) as [PainRegion, Slug[]][]) {
      const isSelected = selected === region || (selectedRegions?.includes(region) ?? false);
      const isMuscle = MUSCLE_SET.has(region);
      const inCategory = category === 'muscles' ? isMuscle : !isMuscle;
      for (const slug of slugs) {
        if (isSelected) {
          result.push({ slug, styles: { fill: VOCAB_WORKED } });
        } else {
          const clr = isMuscle ? VOCAB_WORKED : JOINT_CLR;
          const op = inCategory ? 0.55 : 0.08;
          result.push({ slug, styles: { fill: colorWithAlpha(clr, op) } });
        }
      }
    }
    return result;
  }, [view, selected, selectedRegions, category, heatmapCounts]);

  // ─── Library press handler ─────────────────────────────────────────────────────
  const handleBodyPartPress = (bodyPart: ExtendedBodyPart) => {
    const regionMap = view === 'front' ? FRONT_SLUG_TO_REGION : BACK_SLUG_TO_REGION;
    const slug = bodyPart.slug as Slug;
    const region = regionMap[slug];
    if (region) {
      if (!heatmapCounts) {
        const isMuscle = MUSCLE_SET.has(region);
        const inCategory = category === 'muscles' ? isMuscle : !isMuscle;
        if (!inCategory) return;
      }
      stopPulse();
      tap();
      triggerRipple(region);
      onSelect(region);
    }
  };

  const label = selected
    ? BODY_DIAGRAM_LABELS[selected]
    : selectedRegions?.length
      ? selectedRegions.map((r) => BODY_DIAGRAM_LABELS[r]).join(' · ')
      : null;

  // defaultFill: body silhouette — warm dark ink on light bg, white on dark panel/compact, themed otherwise
  const defaultFill = lightBg
    ? colorWithAlpha('#2C1F0F', 0.22)
    : darkPanel || compact
      ? colorWithAlpha('#ffffff', 0.12)
      : colorWithAlpha(C.text, 0.7);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { alignItems: 'center', paddingVertical: 8 },
        darkPanel: {
          backgroundColor: PANEL_BG,
          borderRadius: 20,
          paddingVertical: 16,
          paddingHorizontal: 12,
          alignItems: 'center',
          marginVertical: 6,
          overflow: 'hidden',
        },
        toggleGroup: { gap: 8, marginBottom: 10, alignItems: 'center' as const },
        toggleRow: {
          flexDirection: 'row' as const,
          backgroundColor: darkPanel ? 'rgba(255,255,255,0.08)' : C.surfaceTertiary,
          borderRadius: 12,
          padding: 3,
          alignSelf: 'center' as const,
        },
        toggleBtn: {
          paddingVertical: 7,
          paddingHorizontal: 22,
          borderRadius: 10,
          alignItems: 'center' as const,
        },
        toggleBtnActive: { backgroundColor: darkPanel ? 'rgba(255,255,255,0.14)' : C.surface },
        toggleText: {
          fontSize: 14,
          fontFamily: 'Inter_600SemiBold',
          color: darkPanel ? 'rgba(255,255,255,0.5)' : C.textSecondary,
        },
        toggleTextActive: { color: darkPanel ? '#fff' : C.text },
        catRow: {
          flexDirection: 'row' as const,
          backgroundColor: darkPanel ? 'rgba(255,255,255,0.06)' : C.surfaceTertiary,
          borderRadius: 10,
          padding: 3,
          alignSelf: 'center' as const,
        },
        catBtn: {
          paddingVertical: 5,
          paddingHorizontal: 18,
          borderRadius: 8,
          alignItems: 'center' as const,
        },
        catBtnActive: { backgroundColor: darkPanel ? 'rgba(255,255,255,0.12)' : C.surface },
        catText: {
          fontSize: 12,
          fontFamily: 'Inter_600SemiBold',
          color: darkPanel ? 'rgba(255,255,255,0.45)' : C.textSecondary,
        },
        catMuscleActive: { color: VOCAB_WORKED },
        catJointActive: { color: JOINT_CLR },
        bodyRow: {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        cyclerSpacer: { width: 60 },
        cyclerBtn: {
          alignSelf: 'center' as const,
          padding: 4,
          marginLeft: 4,
        },
        cyclerBtnInner: {
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 1.5,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        bodyWrap: { alignItems: 'center' as const },
        rippleWrap: {
          position: 'absolute' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        rippleCircle: {
          borderRadius: 999,
          borderWidth: 2,
          borderColor: VOCAB_WORKED,
        },
        labelRow: {
          marginTop: 10,
          minHeight: 34,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        labelChip: {
          paddingHorizontal: 18,
          paddingVertical: 7,
          borderRadius: 20,
          borderWidth: 1.5,
        },
        labelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
        hintText: {
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          color: darkPanel ? 'rgba(255,255,255,0.35)' : C.textTertiary,
        },
        // Heatmap legend
        legendRow: {
          flexDirection: 'row' as const,
          gap: 10,
          marginTop: 10,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
        legendDot: { width: 8, height: 8, borderRadius: 4 },
        legendText: {
          fontSize: 10,
          fontFamily: 'Inter_400Regular',
          color: darkPanel ? 'rgba(255,255,255,0.4)' : C.textTertiary,
        },
      }),
    [C, darkPanel]
  );

  const handleViewChange = (v: BodyView) => {
    stopPulse();
    tap();
    setView(v);
    if (v !== view) onSelect(undefined);
  };

  const handleCategoryChange = (cat: BodyCategory) => {
    stopPulse();
    tap();
    setCategory(cat);
    onSelect(undefined);
  };

  const diagramContent = (
    <>
      {!compact && (
        <View style={styles.toggleGroup}>
          {/* Front / Back toggle */}
          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => handleViewChange('front')}
              style={[styles.toggleBtn, view === 'front' && styles.toggleBtnActive]}
              testID="body-diagram-front"
            >
              <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>
                Front
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleViewChange('back')}
              style={[styles.toggleBtn, view === 'back' && styles.toggleBtnActive]}
              testID="body-diagram-back"
            >
              <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>
                Back
              </Text>
            </Pressable>
          </View>

          {/* Muscles / Joints category toggle — hidden in heatmap mode */}
          {!heatmapCounts && (
            <View style={styles.catRow}>
              <Pressable
                onPress={() => handleCategoryChange('muscles')}
                style={[styles.catBtn, category === 'muscles' && styles.catBtnActive]}
                testID="body-diagram-muscles"
              >
                <Text style={[styles.catText, category === 'muscles' && styles.catMuscleActive]}>
                  Muscles
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleCategoryChange('joints')}
                style={[styles.catBtn, category === 'joints' && styles.catBtnActive]}
                testID="body-diagram-joints"
              >
                <Text style={[styles.catText, category === 'joints' && styles.catJointActive]}>
                  Joints
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Body diagram + hotspot overlay + cycle-through arrow */}
      <View style={styles.bodyRow}>
        {/* Spacer mirrors the cycle button width so the body stays centred */}
        {!compact && !heatmapCounts && <View style={styles.cyclerSpacer} />}

        <Animated.View style={[styles.bodyWrap, svgAnimStyle]}>
          <View style={{ position: 'relative', width: svgWidth, height: svgWidth * 2.4 }}>
            <Body
              data={bodyData}
              gender={gender}
              side={view}
              scale={scale}
              colors={[defaultFill]}
              onBodyPartPress={handleBodyPartPress}
            />
            <Svg
              width={svgWidth}
              height={svgWidth * 2.4}
              viewBox="0 0 200 480"
              style={StyleSheet.absoluteFillObject}
            >
              {/* scaleY 5/6: library renders at 400*scale px, container is 480*scale px.
                  Compressing hotspot paths by 400/480 aligns them with the visual body. */}
              <G transform="scale(1, 0.8333)">
                {view === 'front' ? renderFrontHotspots() : renderBackHotspots()}
              </G>
            </Svg>
          </View>
          {/* Ripple overlay — anchored to the tapped region centre */}
          {ripplePos && (
            <Animated.View
              style={[
                styles.rippleWrap,
                {
                  width: RIPPLE_SIZE,
                  height: RIPPLE_SIZE,
                  top: ripplePos.py,
                  left: ripplePos.px,
                  pointerEvents: 'none',
                },
                rippleStyle,
              ]}
            >
              <View style={[styles.rippleCircle, { width: RIPPLE_SIZE, height: RIPPLE_SIZE }]} />
            </Animated.View>
          )}
        </Animated.View>

        {/* Cycle-through arrow button — steps through regions one-by-one */}
        {!compact && !heatmapCounts && (
          <Pressable
            onPress={handleCycle}
            style={({ pressed }) => [styles.cyclerBtn, pressed && { opacity: 0.7 }]}
            hitSlop={16}
            testID="body-diagram-cycle"
          >
            <View
              style={[
                styles.cyclerBtnInner,
                {
                  backgroundColor: colorWithAlpha(accent, 0.12),
                  borderColor: colorWithAlpha(accent, 0.4),
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={22} color={accent} />
            </View>
          </Pressable>
        )}
      </View>

      {/* Label / hint — hidden in compact mode */}
      {!compact && (
        <View style={styles.labelRow}>
          {label ? (
            <View style={[styles.labelChip, { backgroundColor: accentBg, borderColor: accent }]}>
              <Text style={[styles.labelText, { color: accent }]}>{label}</Text>
            </View>
          ) : (
            <Text style={styles.hintText}>Tap a region on the diagram</Text>
          )}
        </View>
      )}

      {/* Colour legend for heatmap mode — hidden in compact mode */}
      {!compact && heatmapCounts && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: VOCAB_WORKED }]} />
            <Text style={styles.legendText}>{legendLabels[0]}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: VOCAB_ATTENTION }]} />
            <Text style={styles.legendText}>{legendLabels[1]}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: VOCAB_OVERLOADED }]} />
            <Text style={styles.legendText}>{legendLabels[2]}</Text>
          </View>
        </View>
      )}
    </>
  );

  if (compact) {
    return <View style={{ alignItems: 'center' }}>{diagramContent}</View>;
  }

  if (darkPanel) {
    return (
      <View style={styles.container}>
        <View style={styles.darkPanel}>{diagramContent}</View>
      </View>
    );
  }

  return <View style={styles.container}>{diagramContent}</View>;
}
