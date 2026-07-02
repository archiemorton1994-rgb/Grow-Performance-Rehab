import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
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
import { PainRegion } from '@/lib/store';
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

interface BodyDiagramProps {
  selected: PainRegion | undefined;
  onSelect: (region: PainRegion | undefined) => void;
  accentColor?: string;
  accentColorLight?: string;
  defaultView?: BodyView;
  maxWidth?: number;
}

export function BodyDiagram({
  selected,
  onSelect,
  accentColor,
  accentColorLight,
  defaultView = 'front',
  maxWidth = 200,
}: BodyDiagramProps) {
  const [view, setView] = useState<BodyView>(defaultView);
  const [category, setCategory] = useState<BodyCategory>('muscles');
  const C = useColors();
  const { width: screenWidth } = useWindowDimensions();

  const accent   = accentColor ?? C.warning;
  const accentBg = accentColorLight ?? C.warningLight;

  const VW = 120;
  const VH = 295;
  const svgWidth  = Math.min(screenWidth - 80, maxWidth);
  const svgHeight = svgWidth * (VH / VW);

  // ─── Affordance pulse animation ──────────────────────────────────────────────
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    // 3 gentle pulses on first render — signals zones are tappable
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
  const press = (r: PainRegion) => { stopPulse(); tap(); onSelect(r); };

  const isInCat = (r: PainRegion) =>
    category === 'muscles' ? MUSCLE_SET.has(r) : !MUSCLE_SET.has(r);

  // ─── h(): interactive zone — MUST use rgba(0,0,0,0.001) (not transparent/none)
  // react-native-svg only fires onPress for painted (non-transparent) fills on iOS/Android.
  const h = (r: PainRegion) => ({
    fill: 'rgba(0,0,0,0.001)',
    stroke: 'transparent',
    strokeWidth: 0,
    onPress: () => press(r),
    testID: `body-diagram-region-${r}` as string,
  });

  // ─── dz(): decorative zone — visual coloring, no interactivity ───────────────
  const dz = (r: PainRegion) => {
    if (selected === r) {
      return { fill: accent, fillOpacity: 0.82, stroke: accent, strokeWidth: 1.5 };
    }
    return {
      fill: MUSCLE_SET.has(r) ? MUSCLE_CLR : JOINT_CLR,
      fillOpacity: isInCat(r) ? 0.62 : 0.10,
      stroke: 'none' as const,
      strokeWidth: 0,
    };
  };

  // ─── Silhouette base props (dark, adapts light/dark mode) ────────────────────
  const BS = { fill: C.text, fillOpacity: 0.82 };

  // ─── FRONT SILHOUETTE — curved, human-proportioned paths ─────────────────────
  const renderFrontSilhouette = () => (
    <G>
      {/* Head */}
      <Circle cx={60} cy={22} r={16} {...BS} />
      {/* Neck — tapered */}
      <Path d="M 53,36 Q 51,40 51,48 L 69,48 Q 69,40 67,36 Z" {...BS} />
      {/* Torso — shoulder flare, ribcage curve, waist taper, hip flare */}
      <Path
        d="M 33,48 C 26,50 24,58 24,68 Q 22,90 24,118 L 26,140 L 94,140 L 96,118 Q 98,90 96,68 C 96,58 94,50 87,48 Z"
        {...BS}
      />
      {/* Sternum centre hint */}
      <Path d="M 60,54 Q 59,74 60,90" fill="none" stroke={C.surface} strokeWidth={0.6} opacity={0.22} />
      {/* Left upper arm — tapered cylinder */}
      <Path d="M 6,50 C 4,56 4,68 4,80 L 5,108 C 5,116 10,120 17,120 C 24,120 28,116 28,108 L 28,78 C 28,64 27,52 23,49 Z" {...BS} />
      {/* Right upper arm */}
      <Path d="M 114,50 C 116,56 116,68 116,80 L 115,108 C 115,116 110,120 103,120 C 96,120 92,116 92,108 L 92,78 C 92,64 93,52 97,49 Z" {...BS} />
      {/* Left forearm — tapers toward wrist */}
      <Path d="M 4,118 C 2,126 2,138 2,150 L 3,162 C 4,170 10,173 16,172 C 22,171 25,164 25,156 L 24,140 C 24,128 24,120 22,117 Z" {...BS} />
      {/* Right forearm */}
      <Path d="M 116,118 C 118,126 118,138 118,150 L 117,162 C 116,170 110,173 104,172 C 98,171 95,164 95,156 L 96,140 C 96,128 96,120 98,117 Z" {...BS} />
      {/* Pelvis / hip block */}
      <Path d="M 26,139 Q 20,146 20,158 L 22,172 Q 42,180 60,180 Q 78,180 98,172 L 100,158 Q 100,146 94,139 Z" {...BS} />
      {/* Left thigh — tear-drop (wider at top, tapers to knee) */}
      <Path d="M 24,170 C 18,180 18,198 20,220 L 22,238 C 25,248 33,250 42,249 C 51,248 56,242 58,232 L 58,200 C 58,180 56,170 50,168 Z" {...BS} />
      {/* Right thigh */}
      <Path d="M 96,170 C 102,180 102,198 100,220 L 98,238 C 95,248 87,250 78,249 C 69,248 64,242 62,232 L 62,200 C 62,180 64,170 70,168 Z" {...BS} />
      {/* Left knee — rounded cap */}
      <Ellipse cx={42} cy={252} rx={16} ry={10} {...BS} />
      {/* Right knee */}
      <Ellipse cx={78} cy={252} rx={16} ry={10} {...BS} />
      {/* Left calf — gastrocnemius bulge curve */}
      <Path d="M 26,256 C 24,270 24,280 26,286 C 29,292 36,294 42,294 C 48,294 55,292 58,286 C 60,280 60,270 58,256 Z" {...BS} />
      {/* Right calf */}
      <Path d="M 94,256 C 96,270 96,280 94,286 C 91,292 84,294 78,294 C 72,294 65,292 62,286 C 60,280 60,270 62,256 Z" {...BS} />
      {/* Left foot */}
      <Ellipse cx={42} cy={293} rx={16} ry={5} {...BS} />
      {/* Right foot */}
      <Ellipse cx={78} cy={293} rx={16} ry={5} {...BS} />
    </G>
  );

  // ─── BACK SILHOUETTE — flared traps, spine, shoulder blades ──────────────────
  const renderBackSilhouette = () => (
    <G>
      {/* Head */}
      <Circle cx={60} cy={22} r={16} {...BS} />
      {/* Neck */}
      <Path d="M 53,36 Q 51,40 51,48 L 69,48 Q 69,40 67,36 Z" {...BS} />
      {/* Torso — slightly flared trapezius at top for back view */}
      <Path
        d="M 31,48 C 23,50 21,58 20,68 Q 18,90 20,118 L 22,140 L 98,140 L 100,118 Q 102,90 100,68 C 99,58 97,50 89,48 Z"
        {...BS}
      />
      {/* Spine line */}
      <Path d="M 60,52 L 60,138" fill="none" stroke={C.surface} strokeWidth={0.6} opacity={0.18} />
      {/* Left shoulder blade */}
      <Path d="M 38,54 Q 50,51 53,66 Q 53,82 43,87 Q 35,84 35,70 Z" fill={C.surface} fillOpacity={0.06} />
      {/* Right shoulder blade */}
      <Path d="M 82,54 Q 70,51 67,66 Q 67,82 77,87 Q 85,84 85,70 Z" fill={C.surface} fillOpacity={0.06} />
      {/* Left upper arm */}
      <Path d="M 6,50 C 4,56 4,68 4,80 L 5,108 C 5,116 10,120 17,120 C 24,120 28,116 28,108 L 28,78 C 28,64 27,52 23,49 Z" {...BS} />
      {/* Right upper arm */}
      <Path d="M 114,50 C 116,56 116,68 116,80 L 115,108 C 115,116 110,120 103,120 C 96,120 92,116 92,108 L 92,78 C 92,64 93,52 97,49 Z" {...BS} />
      {/* Left forearm */}
      <Path d="M 4,118 C 2,126 2,138 2,150 L 3,162 C 4,170 10,173 16,172 C 22,171 25,164 25,156 L 24,140 C 24,128 24,120 22,117 Z" {...BS} />
      {/* Right forearm */}
      <Path d="M 116,118 C 118,126 118,138 118,150 L 117,162 C 116,170 110,173 104,172 C 98,171 95,164 95,156 L 96,140 C 96,128 96,120 98,117 Z" {...BS} />
      {/* Pelvis / glute shelf */}
      <Path d="M 22,139 Q 16,146 16,158 L 18,172 Q 38,180 60,180 Q 82,180 102,172 L 104,158 Q 104,146 98,139 Z" {...BS} />
      {/* Left thigh */}
      <Path d="M 20,170 C 14,180 14,198 16,220 L 18,238 C 21,248 29,250 38,249 C 47,248 52,242 54,232 L 54,200 C 54,180 52,170 46,168 Z" {...BS} />
      {/* Right thigh */}
      <Path d="M 100,170 C 106,180 106,198 104,220 L 102,238 C 99,248 91,250 82,249 C 73,248 68,242 66,232 L 66,200 C 66,180 68,170 74,168 Z" {...BS} />
      {/* Left knee */}
      <Ellipse cx={38} cy={252} rx={16} ry={10} {...BS} />
      {/* Right knee */}
      <Ellipse cx={82} cy={252} rx={16} ry={10} {...BS} />
      {/* Left calf */}
      <Path d="M 22,256 C 20,270 20,280 22,286 C 25,292 31,294 38,294 C 45,294 51,292 54,286 C 56,280 56,270 54,256 Z" {...BS} />
      {/* Right calf */}
      <Path d="M 98,256 C 100,270 100,280 98,286 C 95,292 89,294 82,294 C 75,294 69,292 66,286 C 64,280 64,270 66,256 Z" {...BS} />
      {/* Left foot */}
      <Ellipse cx={38} cy={293} rx={16} ry={5} {...BS} />
      {/* Right foot */}
      <Ellipse cx={82} cy={293} rx={16} ry={5} {...BS} />
    </G>
  );

  // ─── FRONT decorative zones ───────────────────────────────────────────────────
  const renderFrontDecoZones = () => (
    <G>
      {/* Neck */}
      <Path d="M 52,36 Q 50,40 50,56 L 70,56 Q 70,40 68,36 Z" {...dz('neck')} />
      {/* Front shoulder — deltoid cap */}
      <Ellipse cx={10}  cy={57} rx={14} ry={14} {...dz('front_shoulder')} />
      <Ellipse cx={110} cy={57} rx={14} ry={14} {...dz('front_shoulder')} />
      {/* Chest — twin-lobe pec shape */}
      <Path d="M 34,60 Q 46,52 60,60 Q 74,52 86,60 L 86,82 Q 74,90 60,84 Q 46,90 34,82 Z" {...dz('chest')} />
      {/* Biceps — bilateral upper arm */}
      <Ellipse cx={16}  cy={88} rx={12} ry={22} {...dz('bicep')} />
      <Ellipse cx={104} cy={88} rx={12} ry={22} {...dz('bicep')} />
      {/* Elbow / Wrist — forearm bilateral */}
      <Ellipse cx={11}  cy={142} rx={10} ry={26} {...dz('elbow_wrist')} />
      <Ellipse cx={109} cy={142} rx={10} ry={26} {...dz('elbow_wrist')} />
      {/* Core / Ribs — abdominal panel */}
      <Path d="M 34,86 Q 46,82 60,82 Q 74,82 86,86 L 86,134 Q 74,140 60,140 Q 46,140 34,134 Z" {...dz('core_ribs')} />
      {/* Hip / Groin — curved pelvis */}
      <Path d="M 27,138 Q 44,132 60,138 Q 76,132 93,138 L 92,172 Q 76,178 60,176 Q 44,178 28,172 Z" {...dz('hip_groin')} />
      {/* Quads — front thigh bilateral */}
      <Ellipse cx={40} cy={200} rx={16} ry={28} {...dz('quads')} />
      <Ellipse cx={80} cy={200} rx={16} ry={28} {...dz('quads')} />
      {/* Knee */}
      <Ellipse cx={40} cy={248} rx={16} ry={10} {...dz('knee')} />
      <Ellipse cx={80} cy={248} rx={16} ry={10} {...dz('knee')} />
      {/* Calf / Shin */}
      <Ellipse cx={40} cy={268} rx={14} ry={20} {...dz('calf_shin')} />
      <Ellipse cx={80} cy={268} rx={14} ry={20} {...dz('calf_shin')} />
      {/* Ankle / Achilles */}
      <Ellipse cx={40} cy={286} rx={13} ry={9} {...dz('ankle_achilles')} />
      <Ellipse cx={80} cy={286} rx={13} ry={9} {...dz('ankle_achilles')} />
    </G>
  );

  // ─── BACK decorative zones ────────────────────────────────────────────────────
  const renderBackDecoZones = () => (
    <G>
      {/* Neck */}
      <Path d="M 52,36 Q 50,40 50,56 L 70,56 Q 70,40 68,36 Z" {...dz('neck')} />
      {/* Rear shoulder — posterior deltoid */}
      <Ellipse cx={10}  cy={57} rx={14} ry={14} {...dz('rear_shoulder')} />
      <Ellipse cx={110} cy={57} rx={14} ry={14} {...dz('rear_shoulder')} />
      {/* Triceps — back of upper arm */}
      <Ellipse cx={16}  cy={88} rx={12} ry={22} {...dz('tricep')} />
      <Ellipse cx={104} cy={88} rx={12} ry={22} {...dz('tricep')} />
      {/* Elbow / Wrist */}
      <Ellipse cx={11}  cy={142} rx={10} ry={26} {...dz('elbow_wrist')} />
      <Ellipse cx={109} cy={142} rx={10} ry={26} {...dz('elbow_wrist')} />
      {/* Upper Back — traps/rhomboid diamond */}
      <Path d="M 60,52 L 78,64 L 75,94 L 60,100 L 45,94 L 42,64 Z" {...dz('upper_back')} />
      {/* Lats / Mid Back — bilateral fan blades */}
      <Path d="M 28,72 Q 42,67 44,78 L 42,138 Q 36,143 28,137 Q 24,106 28,72 Z" {...dz('lat_mid_back')} />
      <Path d="M 92,72 Q 78,67 76,78 L 78,138 Q 84,143 92,137 Q 96,106 92,72 Z" {...dz('lat_mid_back')} />
      {/* Lower Back — lumbar oval */}
      <Ellipse cx={60} cy={118} rx={18} ry={24} {...dz('lower_back')} />
      {/* Glutes — bilateral rounded ovals */}
      <Ellipse cx={40} cy={162} rx={20} ry={18} {...dz('glutes')} />
      <Ellipse cx={80} cy={162} rx={20} ry={18} {...dz('glutes')} />
      {/* Hamstrings — back thigh bilateral */}
      <Ellipse cx={38} cy={200} rx={16} ry={28} {...dz('hamstrings')} />
      <Ellipse cx={82} cy={200} rx={16} ry={28} {...dz('hamstrings')} />
      {/* Knee */}
      <Ellipse cx={38} cy={248} rx={16} ry={10} {...dz('knee')} />
      <Ellipse cx={82} cy={248} rx={16} ry={10} {...dz('knee')} />
      {/* Calf / Shin */}
      <Ellipse cx={38} cy={268} rx={14} ry={20} {...dz('calf_shin')} />
      <Ellipse cx={82} cy={268} rx={14} ry={20} {...dz('calf_shin')} />
      {/* Ankle / Achilles */}
      <Ellipse cx={38} cy={286} rx={13} ry={9} {...dz('ankle_achilles')} />
      <Ellipse cx={82} cy={286} rx={13} ry={9} {...dz('ankle_achilles')} />
    </G>
  );

  // ─── FRONT interactive hotspots (transparent fill, touch-only) ───────────────
  const renderFrontHotspots = () => (
    <G>
      <Path d="M 52,36 Q 50,40 50,56 L 70,56 Q 70,40 68,36 Z" {...h('neck')} />
      <Ellipse cx={10}  cy={57} rx={14} ry={14} {...h('front_shoulder')} />
      <Ellipse cx={110} cy={57} rx={14} ry={14} {...h('front_shoulder')} />
      <Path d="M 34,60 Q 46,52 60,60 Q 74,52 86,60 L 86,82 Q 74,90 60,84 Q 46,90 34,82 Z" {...h('chest')} />
      <Ellipse cx={16}  cy={88} rx={12} ry={22} {...h('bicep')} />
      <Ellipse cx={104} cy={88} rx={12} ry={22} {...h('bicep')} />
      <Ellipse cx={11}  cy={142} rx={10} ry={26} {...h('elbow_wrist')} />
      <Ellipse cx={109} cy={142} rx={10} ry={26} {...h('elbow_wrist')} />
      <Path d="M 34,86 Q 46,82 60,82 Q 74,82 86,86 L 86,134 Q 74,140 60,140 Q 46,140 34,134 Z" {...h('core_ribs')} />
      <Path d="M 27,138 Q 44,132 60,138 Q 76,132 93,138 L 92,172 Q 76,178 60,176 Q 44,178 28,172 Z" {...h('hip_groin')} />
      <Ellipse cx={40} cy={200} rx={16} ry={28} {...h('quads')} />
      <Ellipse cx={80} cy={200} rx={16} ry={28} {...h('quads')} />
      <Ellipse cx={40} cy={248} rx={16} ry={10} {...h('knee')} />
      <Ellipse cx={80} cy={248} rx={16} ry={10} {...h('knee')} />
      <Ellipse cx={40} cy={268} rx={14} ry={20} {...h('calf_shin')} />
      <Ellipse cx={80} cy={268} rx={14} ry={20} {...h('calf_shin')} />
      <Ellipse cx={40} cy={286} rx={13} ry={9}  {...h('ankle_achilles')} />
      <Ellipse cx={80} cy={286} rx={13} ry={9}  {...h('ankle_achilles')} />
    </G>
  );

  // ─── BACK interactive hotspots ───────────────────────────────────────────────
  const renderBackHotspots = () => (
    <G>
      <Path d="M 52,36 Q 50,40 50,56 L 70,56 Q 70,40 68,36 Z" {...h('neck')} />
      <Ellipse cx={10}  cy={57} rx={14} ry={14} {...h('rear_shoulder')} />
      <Ellipse cx={110} cy={57} rx={14} ry={14} {...h('rear_shoulder')} />
      <Ellipse cx={16}  cy={88} rx={12} ry={22} {...h('tricep')} />
      <Ellipse cx={104} cy={88} rx={12} ry={22} {...h('tricep')} />
      <Ellipse cx={11}  cy={142} rx={10} ry={26} {...h('elbow_wrist')} />
      <Ellipse cx={109} cy={142} rx={10} ry={26} {...h('elbow_wrist')} />
      <Path d="M 60,52 L 78,64 L 75,94 L 60,100 L 45,94 L 42,64 Z" {...h('upper_back')} />
      <Path d="M 28,72 Q 42,67 44,78 L 42,138 Q 36,143 28,137 Q 24,106 28,72 Z" {...h('lat_mid_back')} />
      <Path d="M 92,72 Q 78,67 76,78 L 78,138 Q 84,143 92,137 Q 96,106 92,72 Z" {...h('lat_mid_back')} />
      <Ellipse cx={60} cy={118} rx={18} ry={24} {...h('lower_back')} />
      <Ellipse cx={40} cy={162} rx={20} ry={18} {...h('glutes')} />
      <Ellipse cx={80} cy={162} rx={20} ry={18} {...h('glutes')} />
      <Ellipse cx={38} cy={200} rx={16} ry={28} {...h('hamstrings')} />
      <Ellipse cx={82} cy={200} rx={16} ry={28} {...h('hamstrings')} />
      <Ellipse cx={38} cy={248} rx={16} ry={10} {...h('knee')} />
      <Ellipse cx={82} cy={248} rx={16} ry={10} {...h('knee')} />
      <Ellipse cx={38} cy={268} rx={14} ry={20} {...h('calf_shin')} />
      <Ellipse cx={82} cy={268} rx={14} ry={20} {...h('calf_shin')} />
      <Ellipse cx={38} cy={286} rx={13} ry={9}  {...h('ankle_achilles')} />
      <Ellipse cx={82} cy={286} rx={13} ry={9}  {...h('ankle_achilles')} />
    </G>
  );

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
    svgWrap:     { alignItems: 'center' as const },
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
          >
            <Text style={[
              styles.catText,
              category === 'muscles' && styles.catMuscleActive,
            ]}>Muscles</Text>
          </Pressable>
          <Pressable
            onPress={() => handleCategoryChange('joints')}
            style={[styles.catBtn, category === 'joints' && styles.catBtnActive]}
          >
            <Text style={[
              styles.catText,
              category === 'joints' && styles.catJointActive,
            ]}>Joints</Text>
          </Pressable>
        </View>
      </View>

      <Animated.View style={[styles.svgWrap, svgAnimStyle]}>
        <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${VW} ${VH}`}>
          {/* Layer 1: silhouette base */}
          {view === 'front' ? renderFrontSilhouette() : renderBackSilhouette()}
          {/* Layer 2: coloured muscle/joint zones (visual) */}
          {view === 'front' ? renderFrontDecoZones() : renderBackDecoZones()}
          {/* Layer 3: interactive touch zones (transparent) */}
          {view === 'front' ? renderFrontHotspots() : renderBackHotspots()}
        </Svg>
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
