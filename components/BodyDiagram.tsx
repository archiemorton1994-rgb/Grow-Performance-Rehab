import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Svg, { Circle, Rect, Ellipse, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { PainRegion } from '@/lib/store';
import { useColors } from '@/constants/colors';

type BodyView = 'front' | 'back';

export const BODY_DIAGRAM_LABELS: Partial<Record<PainRegion, string>> = {
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
      {/* Torso */}
      <Rect x={31} y={48} width={58} height={98} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left upper arm */}
      <Rect x={5} y={48} width={26} height={70} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right upper arm */}
      <Rect x={89} y={48} width={26} height={70} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left forearm */}
      <Rect x={2} y={113} width={22} height={52} rx={8} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right forearm */}
      <Rect x={96} y={113} width={22} height={52} rx={8} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Hip / Pelvis */}
      <Rect x={27} y={141} width={66} height={30} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left thigh */}
      <Rect x={29} y={165} width={27} height={66} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right thigh */}
      <Rect x={64} y={165} width={27} height={66} rx={9} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left knee */}
      <Rect x={27} y={224} width={31} height={20} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right knee */}
      <Rect x={62} y={224} width={31} height={20} rx={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left shin */}
      <Rect x={28} y={238} width={29} height={48} rx={8} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right shin */}
      <Rect x={63} y={238} width={29} height={48} rx={8} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Left foot */}
      <Ellipse cx={42} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
      {/* Right foot */}
      <Ellipse cx={78} cy={288} rx={15} ry={6} fill={bodyFill} stroke={bodyStroke} strokeWidth={1} />
    </G>
  );

  const renderFrontHotspots = () => (
    <G>
      {/* Neck — min 33 SVG units tall for ≥44pt at maxWidth=160 */}
      <Rect x={43} y={30} width={34} height={33} rx={7} {...h('neck')} />

      {/* Front Shoulder — bilateral */}
      <Rect x={1} y={44} width={32} height={40} rx={8} {...h('front_shoulder')} />
      <Rect x={87} y={44} width={32} height={40} rx={8} {...h('front_shoulder')} />

      {/* Elbow / Wrist — bilateral (covers elbow joint + forearm) */}
      <Rect x={0} y={83} width={27} height={84} rx={8} {...h('elbow_wrist')} />
      <Rect x={93} y={83} width={27} height={84} rx={8} {...h('elbow_wrist')} />

      {/* Core / Ribs — mid torso */}
      <Rect x={30} y={83} width={60} height={60} rx={7} {...h('core_ribs')} />

      {/* Hip / Groin */}
      <Rect x={25} y={137} width={70} height={36} rx={7} {...h('hip_groin')} />

      {/* Knee — bilateral, min 33 SVG units tall */}
      <Rect x={23} y={213} width={38} height={36} rx={7} {...h('knee')} />
      <Rect x={59} y={213} width={38} height={36} rx={7} {...h('knee')} />

      {/* Calf / Shin — bilateral */}
      <Rect x={23} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />
      <Rect x={59} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />

      {/* Ankle / Achilles — bilateral, min 33 SVG units tall */}
      <Rect x={23} y={261} width={38} height={35} rx={6} {...h('ankle_achilles')} />
      <Rect x={59} y={261} width={38} height={35} rx={6} {...h('ankle_achilles')} />
    </G>
  );

  const renderBackHotspots = () => (
    <G>
      {/* Neck — min 33 SVG units tall for ≥44pt at maxWidth=160 */}
      <Rect x={43} y={30} width={34} height={33} rx={7} {...h('neck')} />

      {/* Rear Shoulder — bilateral */}
      <Rect x={1} y={44} width={32} height={40} rx={8} {...h('rear_shoulder')} />
      <Rect x={87} y={44} width={32} height={40} rx={8} {...h('rear_shoulder')} />

      {/* Upper Back (thoracic) — upper torso */}
      <Rect x={30} y={48} width={60} height={48} rx={7} {...h('upper_back')} />

      {/* Lower Back (lumbar) — lower torso */}
      <Rect x={30} y={94} width={60} height={50} rx={7} {...h('lower_back')} />

      {/* Elbow / Wrist — bilateral (back of arm) */}
      <Rect x={0} y={83} width={27} height={84} rx={8} {...h('elbow_wrist')} />
      <Rect x={93} y={83} width={27} height={84} rx={8} {...h('elbow_wrist')} />

      {/* Hip / Groin (gluteal on back) */}
      <Rect x={25} y={137} width={70} height={36} rx={7} {...h('hip_groin')} />

      {/* Knee — bilateral, min 33 SVG units tall */}
      <Rect x={23} y={213} width={38} height={36} rx={7} {...h('knee')} />
      <Rect x={59} y={213} width={38} height={36} rx={7} {...h('knee')} />

      {/* Calf / Shin — bilateral */}
      <Rect x={23} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />
      <Rect x={59} y={241} width={38} height={34} rx={7} {...h('calf_shin')} />

      {/* Ankle / Achilles — bilateral, min 33 SVG units tall */}
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
