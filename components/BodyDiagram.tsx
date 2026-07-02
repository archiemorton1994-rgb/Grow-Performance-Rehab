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

  const renderSilhouette = () => (
    <G>
      {/* Head */}
      <Circle cx={60} cy={22} r={17} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Neck */}
      <Rect x={53} y={37} width={14} height={14} rx={4} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Torso — tapered: wider at chest, narrows to waist, widens at hips */}
      <Path
        d="M 34,48 L 86,48 L 89,68 L 88,120 L 87,140 L 79,146 L 41,146 L 33,140 L 32,120 L 31,68 Z"
        fill={bodyFill}
        stroke={bodyStroke}
        strokeWidth={1}
      />
      {/* Left upper arm */}
      <Rect x={5} y={48} width={26} height={70} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right upper arm */}
      <Rect x={89} y={48} width={26} height={70} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left forearm */}
      <Rect x={2} y={113} width={22} height={52} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right forearm */}
      <Rect x={96} y={113} width={22} height={52} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Hip / Pelvis */}
      <Rect x={27} y={141} width={66} height={30} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left thigh */}
      <Rect x={29} y={165} width={27} height={66} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right thigh */}
      <Rect x={64} y={165} width={27} height={66} rx={10} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left knee */}
      <Rect x={27} y={224} width={31} height={20} rx={7} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right knee */}
      <Rect x={62} y={224} width={31} height={20} rx={7} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left shin */}
      <Rect x={28} y={238} width={29} height={48} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right shin */}
      <Rect x={63} y={238} width={29} height={48} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left foot */}
      <Ellipse cx={42} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right foot */}
      <Ellipse cx={78} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
    </G>
  );

  const renderFrontHotspots = () => (
    <G>
      {/* Neck */}
      <Rect x={43} y={30} width={34} height={33} rx={7} {...h('neck')} />

      {/* Front Shoulder — bilateral shoulder cap */}
      <Rect x={1} y={44} width={32} height={30} rx={8} {...h('front_shoulder')} />
      <Rect x={87} y={44} width={32} height={30} rx={8} {...h('front_shoulder')} />

      {/* Chest — upper torso slab */}
      <Rect x={30} y={52} width={60} height={34} rx={8} {...h('chest')} />

      {/* Biceps — front of upper arm (below shoulder) */}
      <Rect x={5} y={72} width={26} height={44} rx={10} {...h('bicep')} />
      <Rect x={89} y={72} width={26} height={44} rx={10} {...h('bicep')} />

      {/* Elbow / Wrist — forearm + elbow joint, bilateral */}
      <Rect x={0} y={113} width={27} height={54} rx={9} {...h('elbow_wrist')} />
      <Rect x={93} y={113} width={27} height={54} rx={9} {...h('elbow_wrist')} />

      {/* Core / Ribs — mid torso */}
      <Rect x={30} y={86} width={60} height={54} rx={7} {...h('core_ribs')} />

      {/* Hip / Groin */}
      <Rect x={25} y={137} width={70} height={36} rx={7} {...h('hip_groin')} />

      {/* Quads — front thigh columns, bilateral */}
      <Rect x={29} y={173} width={27} height={50} rx={10} {...h('quads')} />
      <Rect x={64} y={173} width={27} height={50} rx={10} {...h('quads')} />

      {/* Knee — bilateral */}
      <Rect x={23} y={213} width={38} height={36} rx={7} {...h('knee')} />
      <Rect x={59} y={213} width={38} height={36} rx={7} {...h('knee')} />

      {/* Calf / Shin — bilateral */}
      <Rect x={23} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />
      <Rect x={59} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />

      {/* Ankle / Achilles — bilateral */}
      <Rect x={23} y={261} width={38} height={35} rx={6} {...h('ankle_achilles')} />
      <Rect x={59} y={261} width={38} height={35} rx={6} {...h('ankle_achilles')} />
    </G>
  );

  const renderBackHotspots = () => (
    <G>
      {/* Neck */}
      <Rect x={43} y={30} width={34} height={33} rx={7} {...h('neck')} />

      {/* Rear Shoulder — bilateral shoulder cap */}
      <Rect x={1} y={44} width={32} height={30} rx={8} {...h('rear_shoulder')} />
      <Rect x={87} y={44} width={32} height={30} rx={8} {...h('rear_shoulder')} />

      {/* Triceps — back of upper arm (below rear shoulder), bilateral */}
      <Rect x={5} y={72} width={26} height={44} rx={10} {...h('tricep')} />
      <Rect x={89} y={72} width={26} height={44} rx={10} {...h('tricep')} />

      {/* Elbow / Wrist — forearm + elbow joint, bilateral */}
      <Rect x={0} y={113} width={27} height={54} rx={9} {...h('elbow_wrist')} />
      <Rect x={93} y={113} width={27} height={54} rx={9} {...h('elbow_wrist')} />

      {/* Upper Back (thoracic / traps) — central upper torso */}
      <Rect x={47} y={48} width={26} height={42} rx={7} {...h('upper_back')} />

      {/* Lats / Mid Back — bilateral flanking wings */}
      <Rect x={30} y={64} width={18} height={70} rx={7} {...h('lat_mid_back')} />
      <Rect x={72} y={64} width={18} height={70} rx={7} {...h('lat_mid_back')} />

      {/* Lower Back (lumbar) — central lower torso */}
      <Rect x={47} y={90} width={26} height={50} rx={7} {...h('lower_back')} />

      {/* Glutes — gluteal area (back view equivalent of hip region) */}
      <Rect x={25} y={137} width={70} height={36} rx={7} {...h('glutes')} />

      {/* Hamstrings — back of thigh columns, bilateral */}
      <Rect x={29} y={173} width={27} height={50} rx={10} {...h('hamstrings')} />
      <Rect x={64} y={173} width={27} height={50} rx={10} {...h('hamstrings')} />

      {/* Knee — bilateral */}
      <Rect x={23} y={213} width={38} height={36} rx={7} {...h('knee')} />
      <Rect x={59} y={213} width={38} height={36} rx={7} {...h('knee')} />

      {/* Calf / Shin — bilateral */}
      <Rect x={23} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />
      <Rect x={59} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />

      {/* Ankle / Achilles — bilateral */}
      <Rect x={23} y={261} width={38} height={35} rx={6} {...h('ankle_achilles')} />
      <Rect x={59} y={261} width={38} height={35} rx={6} {...h('ankle_achilles')} />
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
          {renderSilhouette()}
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
