import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Svg, { Circle, Rect, Ellipse, G, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { PainRegion } from '@/lib/store';
import { useColors } from '@/constants/colors';

type BodyView = 'front' | 'back';

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
  const C = useColors();
  const { width: screenWidth } = useWindowDimensions();

  const accent = accentColor ?? C.warning;
  const accentBg = accentColorLight ?? C.warningLight;

  const VW = 120;
  const VH = 295;
  const svgWidth = Math.min(screenWidth - 80, maxWidth);
  const svgHeight = svgWidth * (VH / VW);

  const bodyFill = C.surfaceSecondary;
  const bodyStroke = C.border;

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const press = (r: PainRegion) => { tap(); onSelect(r); };

  const h = (r: PainRegion) => ({
    fill: selected === r ? accent + '55' : 'rgba(0,0,0,0.001)',
    stroke: selected === r ? accent : 'transparent',
    strokeWidth: selected === r ? 2.5 : 0,
    onPress: () => press(r),
    testID: `body-diagram-region-${r}` as string,
  });

  // ─── Front silhouette — tapered torso with chest-curve, sternum hint ──────────
  const renderFrontSilhouette = () => (
    <G>
      <Circle cx={60} cy={22} r={17} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={53} y={37} width={14} height={14} rx={4} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Torso: wider at chest/shoulder, tapers to waist, widens at hips */}
      <Path
        d="M 34,48 L 86,48 L 90,68 Q 92,88 88,118 L 87,140 L 79,147 L 41,147 L 33,140 L 32,118 Q 28,88 30,68 Z"
        fill={bodyFill} stroke={bodyStroke} strokeWidth={1}
      />
      {/* Sternum centre line hint */}
      <Path d="M 60,54 Q 59,74 60,90" fill="none" stroke={bodyStroke} strokeWidth={0.5} opacity={0.35} />
      <Rect x={5}  y={48} width={26} height={70} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={89} y={48} width={26} height={70} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={2}  y={113} width={22} height={52} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={96} y={113} width={22} height={52} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Path d="M 28,140 Q 44,134 60,140 Q 76,134 92,140 L 92,168 Q 76,174 60,172 Q 44,174 28,168 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={29} y={167} width={27} height={66} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={64} y={167} width={27} height={66} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={42} cy={236} rx={15} ry={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={77} cy={236} rx={15} ry={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={28} y={240} width={29} height={46} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={63} y={240} width={29} height={46} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={42} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={78} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
    </G>
  );

  // ─── Back silhouette — spine line + shoulder blade hints ──────────────────────
  const renderBackSilhouette = () => (
    <G>
      <Circle cx={60} cy={22} r={17} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={53} y={37} width={14} height={14} rx={4} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Torso: slightly flared at trapezius top vs front version */}
      <Path
        d="M 33,48 L 87,48 Q 92,54 92,70 Q 93,92 88,120 L 87,140 L 79,147 L 41,147 L 33,140 L 32,120 Q 27,92 28,70 Q 28,54 33,48 Z"
        fill={bodyFill} stroke={bodyStroke} strokeWidth={1}
      />
      {/* Spine line */}
      <Path d="M 60,52 L 60,140" fill="none" stroke={bodyStroke} strokeWidth={0.5} opacity={0.3} />
      {/* Left shoulder blade */}
      <Path d="M 39,58 Q 50,55 53,68 Q 53,82 44,86 Q 37,83 37,70 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={0.5} opacity={0.28} />
      {/* Right shoulder blade */}
      <Path d="M 81,58 Q 70,55 67,68 Q 67,82 76,86 Q 83,83 83,70 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={0.5} opacity={0.28} />
      <Rect x={5}  y={48} width={26} height={70} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={89} y={48} width={26} height={70} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={2}  y={113} width={22} height={52} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={96} y={113} width={22} height={52} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Path d="M 28,140 Q 44,134 60,140 Q 76,134 92,140 L 92,168 Q 76,174 60,172 Q 44,174 28,168 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={29} y={167} width={27} height={66} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={64} y={167} width={27} height={66} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={42} cy={236} rx={15} ry={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={77} cy={236} rx={15} ry={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={28} y={240} width={29} height={46} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Rect x={63} y={240} width={29} height={46} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={42} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      <Ellipse cx={78} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
    </G>
  );

  // ─── Front hotspots — anatomical Ellipse / Path shapes ───────────────────────
  const renderFrontHotspots = () => (
    <G>
      {/* Neck — cylinder Rect */}
      <Rect x={47} y={37} width={26} height={26} rx={6} {...h('neck')} />

      {/* Front Shoulder (deltoid cap) — oval at shoulder cap */}
      <Ellipse cx={10}  cy={57} rx={14} ry={14} {...h('front_shoulder')} />
      <Ellipse cx={110} cy={57} rx={14} ry={14} {...h('front_shoulder')} />

      {/* Chest (pectorals) — twin-lobe wing shape */}
      <Path d="M 34,60 Q 46,52 60,60 Q 74,52 86,60 L 86,82 Q 74,90 60,84 Q 46,90 34,82 Z" {...h('chest')} />

      {/* Biceps (front of upper arm) — teardrop oval, below shoulder */}
      <Ellipse cx={18}  cy={90} rx={12} ry={22} {...h('bicep')} />
      <Ellipse cx={102} cy={90} rx={12} ry={22} {...h('bicep')} />

      {/* Elbow / Wrist — elongated forearm oval */}
      <Ellipse cx={13}  cy={140} rx={10} ry={26} {...h('elbow_wrist')} />
      <Ellipse cx={107} cy={140} rx={10} ry={26} {...h('elbow_wrist')} />

      {/* Core / Ribs — slightly waisted central torso shape */}
      <Path d="M 34,86 Q 46,82 60,82 Q 74,82 86,86 L 86,134 Q 74,140 60,140 Q 46,140 34,134 Z" {...h('core_ribs')} />

      {/* Hip / Groin — wide curved pelvis shape */}
      <Path d="M 27,138 Q 44,132 60,138 Q 76,132 93,138 L 92,168 Q 76,174 60,172 Q 44,174 28,168 Z" {...h('hip_groin')} />

      {/* Quads (front thigh columns) — elongated teardrop ovals */}
      <Ellipse cx={43} cy={198} rx={13} ry={26} {...h('quads')} />
      <Ellipse cx={77} cy={198} rx={13} ry={26} {...h('quads')} />

      {/* Knee — rounded oval */}
      <Ellipse cx={43} cy={236} rx={15} ry={11} {...h('knee')} />
      <Ellipse cx={77} cy={236} rx={15} ry={11} {...h('knee')} />

      {/* Calf / Shin — elongated oval, widest at mid-belly */}
      <Ellipse cx={43} cy={260} rx={13} ry={19} {...h('calf_shin')} />
      <Ellipse cx={77} cy={260} rx={13} ry={19} {...h('calf_shin')} />

      {/* Ankle / Achilles — compact oval */}
      <Ellipse cx={43} cy={281} rx={12} ry={10} {...h('ankle_achilles')} />
      <Ellipse cx={77} cy={281} rx={12} ry={10} {...h('ankle_achilles')} />
    </G>
  );

  // ─── Back hotspots — anatomical Ellipse / Path shapes ────────────────────────
  const renderBackHotspots = () => (
    <G>
      {/* Neck — cylinder Rect */}
      <Rect x={47} y={37} width={26} height={26} rx={6} {...h('neck')} />

      {/* Rear Shoulder (posterior deltoid) — oval at shoulder cap */}
      <Ellipse cx={10}  cy={57} rx={14} ry={14} {...h('rear_shoulder')} />
      <Ellipse cx={110} cy={57} rx={14} ry={14} {...h('rear_shoulder')} />

      {/* Triceps (back of upper arm) — teardrop oval, below shoulder */}
      <Ellipse cx={18}  cy={90} rx={12} ry={22} {...h('tricep')} />
      <Ellipse cx={102} cy={90} rx={12} ry={22} {...h('tricep')} />

      {/* Elbow / Wrist — elongated forearm oval */}
      <Ellipse cx={13}  cy={140} rx={10} ry={26} {...h('elbow_wrist')} />
      <Ellipse cx={107} cy={140} rx={10} ry={26} {...h('elbow_wrist')} />

      {/* Upper Back (trapezius / rhomboids) — diamond centred on thoracic */}
      <Path d="M 60,52 L 78,64 L 75,92 L 60,98 L 45,92 L 42,64 Z" {...h('upper_back')} />

      {/* Lats / Mid Back — bilateral fan blades flanking the spine */}
      <Path d="M 30,70 Q 42,65 44,76 L 42,138 Q 36,142 29,136 Q 26,104 30,70 Z" {...h('lat_mid_back')} />
      <Path d="M 90,70 Q 78,65 76,76 L 78,138 Q 84,142 91,136 Q 94,104 90,70 Z" {...h('lat_mid_back')} />

      {/* Lower Back (lumbar) — centred oval below lats */}
      <Ellipse cx={60} cy={116} rx={17} ry={26} {...h('lower_back')} />

      {/* Glutes — bilateral rounded ovals forming the gluteal pair */}
      <Ellipse cx={44} cy={154} rx={17} ry={16} {...h('glutes')} />
      <Ellipse cx={76} cy={154} rx={17} ry={16} {...h('glutes')} />

      {/* Hamstrings (back of thigh) — elongated ovals */}
      <Ellipse cx={43} cy={198} rx={13} ry={26} {...h('hamstrings')} />
      <Ellipse cx={77} cy={198} rx={13} ry={26} {...h('hamstrings')} />

      {/* Knee — rounded oval */}
      <Ellipse cx={43} cy={236} rx={15} ry={11} {...h('knee')} />
      <Ellipse cx={77} cy={236} rx={15} ry={11} {...h('knee')} />

      {/* Calf / Shin — elongated oval */}
      <Ellipse cx={43} cy={260} rx={13} ry={19} {...h('calf_shin')} />
      <Ellipse cx={77} cy={260} rx={13} ry={19} {...h('calf_shin')} />

      {/* Ankle / Achilles — compact oval */}
      <Ellipse cx={43} cy={281} rx={12} ry={10} {...h('ankle_achilles')} />
      <Ellipse cx={77} cy={281} rx={12} ry={10} {...h('ankle_achilles')} />
    </G>
  );

  const label = selected ? BODY_DIAGRAM_LABELS[selected] : null;

  const styles = useMemo(() => StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: 8 },
    toggleRow: {
      flexDirection: 'row' as const,
      gap: 0,
      marginBottom: 16,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 12,
      padding: 3,
      alignSelf: 'center' as const,
    },
    toggleBtn: {
      paddingVertical: 8,
      paddingHorizontal: 24,
      borderRadius: 10,
      alignItems: 'center' as const,
    },
    toggleBtnActive: {
      backgroundColor: C.surface,
    },
    toggleText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    toggleTextActive: {
      color: C.text,
    },
    svgWrap: {
      alignItems: 'center' as const,
    },
    labelRow: {
      marginTop: 14,
      minHeight: 36,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    labelChip: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    labelText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
    },
    hintText: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },
  }), [C]);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => { tap(); setView('front'); if (view !== 'front') onSelect(undefined); }}
          style={[styles.toggleBtn, view === 'front' && styles.toggleBtnActive]}
          testID="body-diagram-front"
        >
          <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>Front</Text>
        </Pressable>
        <Pressable
          onPress={() => { tap(); setView('back'); if (view !== 'back') onSelect(undefined); }}
          style={[styles.toggleBtn, view === 'back' && styles.toggleBtnActive]}
          testID="body-diagram-back"
        >
          <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.svgWrap}>
        <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${VW} ${VH}`}>
          {view === 'front' ? renderFrontSilhouette() : renderBackSilhouette()}
          {view === 'front' ? renderFrontHotspots() : renderBackHotspots()}
        </Svg>
      </View>

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
