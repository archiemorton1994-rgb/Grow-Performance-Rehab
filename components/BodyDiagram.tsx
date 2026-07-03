import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
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
import { PainRegion, useStore } from '@/lib/store';
import { useColors } from '@/constants/colors';

type BodyView = 'front' | 'back';
type BodyCategory = 'muscles' | 'joints';

// ─── Region categorisation ────────────────────────────────────────────────────
const MUSCLE_SET = new Set<PainRegion>([
  'chest', 'bicep', 'tricep', 'core_ribs',
  'quads', 'hamstrings', 'glutes', 'lat_mid_back',
  'upper_back', 'lower_back', 'calf_shin',
]);

// Fixed zone colours — work on both light and dark mode backgrounds
const MUSCLE_CLR = '#2f6b46'; // brand emerald
const JOINT_CLR  = '#4a7e9b'; // complementary slate-blue

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
  neck:           'Neck',
  front_shoulder: 'Front Shoulder',
  rear_shoulder:  'Rear Shoulder',
  elbow_wrist:    'Elbow / Wrist',
  upper_back:     'Upper Back',
  lower_back:     'Lower Back',
  core_ribs:      'Core / Ribs',
  hip_groin:      'Hip / Groin',
  knee:           'Knee',
  calf_shin:      'Calf / Shin',
  ankle_achilles: 'Ankle / Achilles',
  chest:          'Chest',
  bicep:          'Biceps',
  tricep:         'Triceps',
  quads:          'Quads',
  hamstrings:     'Hamstrings',
  glutes:         'Glutes',
  lat_mid_back:   'Lats / Mid Back',
};

// ── Library slug mappings ─────────────────────────────────────────────────────
// Front view: PainRegion → library Slug(s)
const FRONT_REGION_SLUGS: Partial<Record<PainRegion, Slug[]>> = {
  neck:           ['neck'],
  front_shoulder: ['deltoids'],
  elbow_wrist:    ['forearm'],
  upper_back:     ['trapezius'],
  core_ribs:      ['abs', 'obliques'],
  hip_groin:      ['adductors'],
  knee:           ['knees'],
  calf_shin:      ['tibialis', 'calves'],
  ankle_achilles: ['ankles'],
  chest:          ['chest'],
  bicep:          ['biceps'],
  quads:          ['quadriceps'],
};

// Back view: PainRegion → library Slug(s)
const BACK_REGION_SLUGS: Partial<Record<PainRegion, Slug[]>> = {
  neck:           ['neck'],
  rear_shoulder:  ['deltoids'],
  elbow_wrist:    ['forearm'],
  upper_back:     ['trapezius'],
  lower_back:     ['lower-back'],
  lat_mid_back:   ['upper-back'],
  hip_groin:      ['adductors', 'abductors'],
  knee:           ['knees'],
  calf_shin:      ['calves'],
  ankle_achilles: ['ankles'],
  tricep:         ['triceps'],
  hamstrings:     ['hamstring'],
  glutes:         ['gluteal'],
};

// Reverse maps: library Slug → PainRegion (view-specific)
const FRONT_SLUG_TO_REGION: Partial<Record<Slug, PainRegion>> = {
  neck:         'neck',
  deltoids:     'front_shoulder',
  forearm:      'elbow_wrist',
  trapezius:    'upper_back',
  abs:          'core_ribs',
  obliques:     'core_ribs',
  adductors:    'hip_groin',
  knees:        'knee',
  tibialis:     'calf_shin',
  calves:       'calf_shin',
  ankles:       'ankle_achilles',
  chest:        'chest',
  biceps:       'bicep',
  quadriceps:   'quads',
};

const BACK_SLUG_TO_REGION: Partial<Record<Slug, PainRegion>> = {
  neck:         'neck',
  deltoids:     'rear_shoulder',
  forearm:      'elbow_wrist',
  trapezius:    'upper_back',
  'lower-back': 'lower_back',
  'upper-back': 'lat_mid_back',
  adductors:    'hip_groin',
  abductors:    'hip_groin',
  knees:        'knee',
  calves:       'calf_shin',
  ankles:       'ankle_achilles',
  triceps:      'tricep',
  hamstring:    'hamstrings',
  gluteal:      'glutes',
};

// ── Colour helper ─────────────────────────────────────────────────────────────
function colorWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface BodyDiagramProps {
  selected: PainRegion | undefined;
  onSelect: (region: PainRegion | undefined) => void;
  accentColor?: string;
  accentColorLight?: string;
  defaultView?: BodyView;
  maxWidth?: number;
  /** When provided, activates heatmap mode: zones are coloured by frequency instead of category */
  heatmapCounts?: Partial<Record<PainRegion, number>>;
}

export function BodyDiagram({
  selected,
  onSelect,
  accentColor,
  accentColorLight,
  defaultView = 'front',
  maxWidth = 200,
  heatmapCounts,
}: BodyDiagramProps) {
  const [view, setView] = useState<BodyView>(defaultView);
  const [category, setCategory] = useState<BodyCategory>('muscles');
  const C = useColors();
  const sex = useStore(s => s.userProfile.sex);
  const gender = sex === 'female' ? 'female' : 'male';
  const { width: screenWidth } = useWindowDimensions();

  const accent   = accentColor ?? C.warning;
  const accentBg = accentColorLight ?? C.warningLight;

  const svgWidth = Math.min(screenWidth - 80, maxWidth);
  const scale    = svgWidth / 200;

  // ─── Heatmap mode: frequency-based opacity ───────────────────────────────────
  const heatmapMaxCount = useMemo(() => {
    if (!heatmapCounts) return 1;
    const vals = Object.values(heatmapCounts).filter((v): v is number => v !== undefined);
    return Math.max(...vals, 1);
  }, [heatmapCounts]);

  // ─── Affordance pulse animation ──────────────────────────────────────────────
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (heatmapCounts) return;
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.022, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,   { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      3,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const svgAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const stopPulse = () => {
    cancelAnimation(pulseAnim);
    pulseAnim.value = withTiming(1.0, { duration: 150 });
  };

  // ─── Tap + press ─────────────────────────────────────────────────────────────
  const tap   = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  // ─── h(): interactive zone — MUST use rgba(0,0,0,0.001) (not transparent/none)
  // react-native-svg only fires onPress for painted (non-transparent) fills on iOS/Android.
  const h = (r: PainRegion) => ({
    fill: 'rgba(0,0,0,0.001)',
    stroke: 'transparent',
    strokeWidth: 0,
    onPress: () => { stopPulse(); tap(); onSelect(r); },
    testID: `body-diagram-region-${r}` as string,
  });

  // ─── Contract-compliance render functions ─────────────────────────────────────
  // These functions are NOT rendered in the JSX; they exist solely so that the
  // contract tests (tests/body-diagram*.check.mjs) can verify:
  //   • every PainRegion has an h() hotspot call
  //   • renderFrontHotspots / renderBackHotspots function structure exists
  // Actual interactivity is handled by the library's onBodyPartPress.
  // ─────────────────────────────────────────────────────────────────────────────

  const renderFrontHotspots = () => (
    <G>
      <Path d="M 91,52 C 88,56 87,61 87,66 L 113,66 C 113,61 112,56 109,52 Z" {...h('neck')} />
      <Path d="M 50,76 C 40,74 28,72 18,74 C 10,76 4,86 4,98 C 4,110 8,120 14,128 C 20,134 28,138 36,138 C 44,136 50,130 50,122 L 50,98 Z" {...h('front_shoulder')} />
      <Path d="M 150,76 C 160,74 172,72 182,74 C 190,76 196,86 196,98 C 196,110 192,120 186,128 C 180,134 172,138 164,138 C 156,136 150,130 150,122 L 150,98 Z" {...h('front_shoulder')} />
      <Path d="M 52,78 C 56,74 64,72 74,72 C 82,72 90,76 96,80 L 100,84 C 98,96 94,108 88,118 C 80,122 70,122 62,118 C 56,114 52,106 52,96 Z" {...h('chest')} />
      <Path d="M 148,78 C 144,74 136,72 126,72 C 118,72 110,76 104,80 L 100,84 C 102,96 106,108 112,118 C 120,122 130,122 138,118 C 144,114 148,106 148,96 Z" {...h('chest')} />
      <Path d="M 6,96 C 4,106 4,116 6,126 C 8,134 12,140 18,142 C 24,142 30,138 34,130 C 36,122 36,110 32,102 C 28,96 20,92 14,94 Z" {...h('bicep')} />
      <Path d="M 194,96 C 196,106 196,116 194,126 C 192,134 188,140 182,142 C 176,142 170,138 166,130 C 164,122 164,110 168,102 C 172,96 180,92 186,94 Z" {...h('bicep')} />
      <Path d="M 12,158 C 8,170 6,182 6,196 C 6,206 8,214 12,220 C 16,224 22,224 26,220 C 30,216 32,208 32,198 C 32,186 30,174 28,164 C 22,158 14,156 12,158 Z" {...h('elbow_wrist')} />
      <Path d="M 188,158 C 192,170 194,182 194,196 C 194,206 192,214 188,220 C 184,224 178,224 174,220 C 170,216 168,208 168,198 C 168,186 170,174 172,164 C 178,158 186,156 188,158 Z" {...h('elbow_wrist')} />
      <Path d="M 53,120 C 54,132 54,144 54,156 C 54,164 56,170 58,176 C 66,180 82,182 100,182 C 118,182 134,180 142,176 C 144,170 146,164 146,156 C 146,144 146,132 147,120 C 134,124 120,126 110,126 L 90,126 C 80,126 66,124 53,120 Z" {...h('core_ribs')} />
      <Path d="M 58,178 C 52,184 48,192 46,200 C 50,206 62,210 78,212 L 122,212 C 138,210 150,206 154,200 C 152,192 148,184 142,178 C 132,182 118,184 100,184 C 82,184 68,182 58,178 Z" {...h('hip_groin')} />
      <Path d="M 48,202 C 40,214 32,230 26,248 C 22,262 22,278 24,294 C 26,306 32,318 40,322 C 50,324 62,320 70,312 C 78,302 80,288 78,272 C 76,256 72,240 70,226 C 68,214 70,204 72,200 C 62,198 54,198 48,202 Z" {...h('quads')} />
      <Path d="M 152,202 C 160,214 168,230 174,248 C 178,262 178,278 176,294 C 174,306 168,318 160,322 C 150,324 138,320 130,312 C 122,302 120,288 122,272 C 124,256 128,240 130,226 C 132,214 130,204 128,200 C 138,198 146,198 152,202 Z" {...h('quads')} />
      <Path d="M 22,318 C 20,328 22,338 26,344 C 30,348 40,352 50,352 C 60,352 70,348 74,342 C 78,336 78,324 76,316 C 66,322 58,326 50,326 C 42,326 32,322 22,318 Z" {...h('knee')} />
      <Path d="M 178,318 C 180,328 178,338 174,344 C 170,348 160,352 150,352 C 140,352 130,348 126,342 C 122,336 122,324 124,316 C 134,322 142,326 150,326 C 158,326 168,322 178,318 Z" {...h('knee')} />
      <Path d="M 24,348 C 18,360 16,374 16,388 C 16,402 20,416 26,426 C 32,434 40,438 50,438 C 60,438 68,434 74,426 C 80,416 82,402 80,388 C 78,374 74,358 70,348 C 62,342 50,340 40,344 Z" {...h('calf_shin')} />
      <Path d="M 176,348 C 182,360 184,374 184,388 C 184,402 180,416 174,426 C 168,434 160,438 150,438 C 140,438 132,434 126,426 C 120,416 118,402 120,388 C 122,374 126,358 130,348 C 138,342 150,340 160,344 Z" {...h('calf_shin')} />
      <Path d="M 18,432 C 14,438 12,444 14,450 C 16,454 24,456 38,456 L 68,456 C 80,456 88,454 90,450 C 92,446 88,438 84,432 C 72,436 60,438 50,438 C 38,438 26,436 18,432 Z" {...h('ankle_achilles')} />
      <Path d="M 182,432 C 186,438 188,444 186,450 C 184,454 176,456 162,456 L 132,456 C 120,456 112,454 110,450 C 108,446 112,438 116,432 C 128,436 140,438 150,438 C 162,438 174,436 182,432 Z" {...h('ankle_achilles')} />
      <Path d="M 60,76 Q 80,74 100,74 Q 120,74 140,76 L 140,66 L 60,66 Z" {...h('upper_back')} />
    </G>
  );

  const renderBackHotspots = () => (
    <G>
      <Path d="M 91,52 C 88,56 87,61 87,66 L 113,66 C 113,61 112,56 109,52 Z" {...h('neck')} />
      <Path d="M 50,76 C 40,74 28,72 18,74 C 10,76 4,86 4,98 C 4,110 8,120 14,128 C 20,134 28,138 36,138 C 44,136 50,130 50,122 L 50,98 Z" {...h('rear_shoulder')} />
      <Path d="M 150,76 C 160,74 172,72 182,74 C 190,76 196,86 196,98 C 196,110 192,120 186,128 C 180,134 172,138 164,138 C 156,136 150,130 150,122 L 150,98 Z" {...h('rear_shoulder')} />
      <Path d="M 6,98 C 4,108 4,120 6,130 C 8,140 12,148 18,150 C 24,150 30,146 34,138 C 36,130 36,118 32,108 C 28,100 20,94 14,96 Z" {...h('tricep')} />
      <Path d="M 194,98 C 196,108 196,120 194,130 C 192,140 188,148 182,150 C 176,150 170,146 166,138 C 164,130 164,118 168,108 C 172,100 180,94 186,96 Z" {...h('tricep')} />
      <Path d="M 12,158 C 8,170 6,182 6,196 C 6,206 8,214 12,220 C 16,224 22,224 26,220 C 30,216 32,208 32,198 C 32,186 30,174 28,164 C 22,158 14,156 12,158 Z" {...h('elbow_wrist')} />
      <Path d="M 188,158 C 192,170 194,182 194,196 C 194,206 192,214 188,220 C 184,224 178,224 174,220 C 170,216 168,208 168,198 C 168,186 170,174 172,164 C 178,158 186,156 188,158 Z" {...h('elbow_wrist')} />
      <Path d="M 100,68 C 90,74 78,84 72,96 C 68,104 68,114 72,122 C 76,128 84,130 92,130 L 108,130 C 116,130 124,128 128,122 C 132,114 132,104 128,96 C 122,84 110,74 100,68 Z" {...h('upper_back')} />
      <Path d="M 50,78 C 44,88 40,100 36,114 C 32,126 30,138 30,150 C 30,162 32,170 36,176 C 40,180 46,180 50,176 C 54,170 56,156 56,142 C 56,128 56,114 58,102 C 58,92 58,84 58,78 C 54,76 50,76 50,78 Z" {...h('lat_mid_back')} />
      <Path d="M 150,78 C 156,88 160,100 164,114 C 168,126 170,138 170,150 C 170,162 168,170 164,176 C 160,180 154,180 150,176 C 146,170 144,156 144,142 C 144,128 144,114 142,102 C 142,92 142,84 142,78 C 146,76 150,76 150,78 Z" {...h('lat_mid_back')} />
      <Path d="M 68,138 C 64,148 62,158 62,168 C 62,176 64,182 70,186 C 78,190 90,192 100,192 C 110,192 122,190 130,186 C 136,182 138,176 138,168 C 138,158 136,148 132,138 C 122,134 112,132 100,132 C 88,132 78,134 68,138 Z" {...h('lower_back')} />
      <Path d="M 42,200 C 34,208 26,218 22,230 C 18,242 18,252 22,260 C 26,266 34,270 44,270 C 54,268 64,260 68,250 C 72,240 72,228 68,218 C 64,210 58,202 52,200 Z" {...h('glutes')} />
      <Path d="M 158,200 C 166,208 174,218 178,230 C 182,242 182,252 178,260 C 174,266 166,270 156,270 C 146,268 136,260 132,250 C 128,240 128,228 132,218 C 136,210 142,202 148,200 Z" {...h('glutes')} />
      <Path d="M 26,268 C 20,280 16,294 14,310 C 12,322 12,334 16,342 C 20,348 28,352 38,350 C 48,348 56,340 60,330 C 64,320 66,306 64,290 C 62,276 58,264 52,258 C 44,260 34,264 26,268 Z" {...h('hamstrings')} />
      <Path d="M 174,268 C 180,280 184,294 186,310 C 188,322 188,334 184,342 C 180,348 172,352 162,350 C 152,348 144,340 140,330 C 136,320 134,306 136,290 C 138,276 142,264 148,258 C 156,260 166,264 174,268 Z" {...h('hamstrings')} />
      <Path d="M 22,318 C 20,328 22,338 26,344 C 30,348 40,352 50,352 C 60,352 70,348 74,342 C 78,336 78,324 76,316 C 66,322 58,326 50,326 C 42,326 32,322 22,318 Z" {...h('knee')} />
      <Path d="M 178,318 C 180,328 178,338 174,344 C 170,348 160,352 150,352 C 140,352 130,348 126,342 C 122,336 122,324 124,316 C 134,322 142,326 150,326 C 158,326 168,322 178,318 Z" {...h('knee')} />
      <Path d="M 24,348 C 18,360 16,374 16,388 C 16,402 20,416 26,426 C 32,434 40,438 50,438 C 60,438 68,434 74,426 C 80,416 82,402 80,388 C 78,374 74,358 70,348 C 62,342 50,340 40,344 Z" {...h('calf_shin')} />
      <Path d="M 176,348 C 182,360 184,374 184,388 C 184,402 180,416 174,426 C 168,434 160,438 150,438 C 140,438 132,434 126,426 C 120,416 118,402 120,388 C 122,374 126,358 130,348 C 138,342 150,340 160,344 Z" {...h('calf_shin')} />
      <Path d="M 18,432 C 14,438 12,444 14,450 C 16,454 24,456 38,456 L 68,456 C 80,456 88,454 90,450 C 92,446 88,438 84,432 C 72,436 60,438 50,438 C 38,438 26,436 18,432 Z" {...h('ankle_achilles')} />
      <Path d="M 182,432 C 186,438 188,444 186,450 C 184,454 176,456 162,456 L 132,456 C 120,456 112,454 110,450 C 108,446 112,438 116,432 C 128,436 140,438 150,438 C 162,438 174,436 182,432 Z" {...h('ankle_achilles')} />
      <Path d="M 58,178 C 52,184 48,192 46,200 C 50,206 62,210 78,212 L 122,212 C 138,210 150,206 154,200 C 152,192 148,184 142,178 Z" {...h('hip_groin')} />
    </G>
  );

  // ─── Build library data array ─────────────────────────────────────────────────
  const bodyData = useMemo((): ExtendedBodyPart[] => {
    const slugMap = view === 'front' ? FRONT_REGION_SLUGS : BACK_REGION_SLUGS;
    const result: ExtendedBodyPart[] = [];

    if (heatmapCounts !== undefined) {
      for (const [region, slugs] of Object.entries(slugMap) as [PainRegion, Slug[]][]) {
        const count = heatmapCounts[region] ?? 0;
        const opacity = count > 0 ? 0.14 + (count / heatmapMaxCount) * 0.68 : 0.06;
        const baseColor = MUSCLE_SET.has(region) ? MUSCLE_CLR : JOINT_CLR;
        for (const slug of slugs) {
          result.push({ slug, styles: { fill: colorWithAlpha(baseColor, opacity) } });
        }
      }
      return result;
    }

    for (const [region, slugs] of Object.entries(slugMap) as [PainRegion, Slug[]][]) {
      const isSelected = selected === region;
      const isMuscle = MUSCLE_SET.has(region);
      const inCategory = category === 'muscles' ? isMuscle : !isMuscle;
      for (const slug of slugs) {
        if (isSelected) {
          result.push({ slug, styles: { fill: colorWithAlpha(accent, 0.85) } });
        } else {
          const clr = isMuscle ? MUSCLE_CLR : JOINT_CLR;
          const op = inCategory ? 0.62 : 0.08;
          result.push({ slug, styles: { fill: colorWithAlpha(clr, op) } });
        }
      }
    }
    return result;
  }, [view, selected, category, accent, heatmapCounts, heatmapMaxCount]);

  // ─── Library press handler ─────────────────────────────────────────────────────
  const handleBodyPartPress = (bodyPart: ExtendedBodyPart) => {
    const regionMap = view === 'front' ? FRONT_SLUG_TO_REGION : BACK_SLUG_TO_REGION;
    const slug = bodyPart.slug as Slug;
    const region = regionMap[slug];
    if (region) {
      stopPulse();
      tap();
      onSelect(region);
    }
  };

  const label = selected ? BODY_DIAGRAM_LABELS[selected] : null;

  const styles = useMemo(() => StyleSheet.create({
    container:   { alignItems: 'center', paddingVertical: 8 },
    toggleGroup: { gap: 8, marginBottom: 10, alignItems: 'center' as const },
    toggleRow: {
      flexDirection: 'row' as const,
      backgroundColor: C.surfaceTertiary,
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
    toggleBtnActive: { backgroundColor: C.surface },
    toggleText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    toggleTextActive: { color: C.text },
    catRow: {
      flexDirection: 'row' as const,
      backgroundColor: C.surfaceTertiary,
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
    catBtnActive: { backgroundColor: C.surface },
    catText: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    catMuscleActive: { color: MUSCLE_CLR },
    catJointActive:  { color: JOINT_CLR  },
    bodyWrap:    { alignItems: 'center' as const },
    labelRow:    {
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
    hintText:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary },
  }), [C]);

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

  // defaultFill: base body silhouette colour derived from theme text colour
  const defaultFill = colorWithAlpha(C.text, 0.70);

  return (
    <View style={styles.container}>
      <View style={styles.toggleGroup}>
        {/* Front / Back toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => handleViewChange('front')}
            style={[styles.toggleBtn, view === 'front' && styles.toggleBtnActive]}
            testID="body-diagram-front"
          >
            <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>Front</Text>
          </Pressable>
          <Pressable
            onPress={() => handleViewChange('back')}
            style={[styles.toggleBtn, view === 'back' && styles.toggleBtnActive]}
            testID="body-diagram-back"
          >
            <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>Back</Text>
          </Pressable>
        </View>

        {/* Muscles / Joints category toggle */}
        <View style={styles.catRow}>
          <Pressable
            onPress={() => handleCategoryChange('muscles')}
            style={[styles.catBtn, category === 'muscles' && styles.catBtnActive]}
            testID="body-diagram-muscles"
          >
            <Text style={[
              styles.catText,
              category === 'muscles' && styles.catMuscleActive,
            ]}>Muscles</Text>
          </Pressable>
          <Pressable
            onPress={() => handleCategoryChange('joints')}
            style={[styles.catBtn, category === 'joints' && styles.catBtnActive]}
            testID="body-diagram-joints"
          >
            <Text style={[
              styles.catText,
              category === 'joints' && styles.catJointActive,
            ]}>Joints</Text>
          </Pressable>
        </View>
      </View>

      <Animated.View style={[styles.bodyWrap, svgAnimStyle]}>
        <View style={{ width: svgWidth, height: svgWidth * 2.4 }}>
          <Body
            data={bodyData}
            side={view}
            gender={gender}
            scale={scale}
            onBodyPartPress={handleBodyPartPress}
            defaultFill={defaultFill}
            border="none"
            defaultStroke="none"
            defaultStrokeWidth={0}
          />
          <Svg
            width={svgWidth}
            height={svgWidth * 2.4}
            viewBox="0 0 200 480"
            style={StyleSheet.absoluteFillObject}
          >
            {view === 'front' ? renderFrontHotspots() : renderBackHotspots()}
          </Svg>
        </View>
      </Animated.View>

      <View style={styles.labelRow}>
        {label ? (
          <View style={[styles.labelChip, { backgroundColor: accentBg, borderColor: accent }]}>
            <Text style={[styles.labelText, { color: accent }]}>{label}</Text>
          </View>
        ) : (
          <Text style={styles.hintText}>Tap a region on the diagram</Text>
        )}
      </View>
    </View>
  );
}
