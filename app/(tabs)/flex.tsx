import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useAppStore } from '@/lib/store';
import { daysSince } from '@/lib/utils';

type ModalType = 'recovery' | 'mobility' | 'prehab' | 'conditioning' | null;
type ConditioningLevel = 'beginner' | 'intermediate' | 'advanced';

function getFlexRecency(completedSessions: any[], sessionType: 'prehab' | 'flexibility' | 'conditioning'): string {
  const matches = completedSessions.filter(s => s.sessionType === sessionType);
  if (matches.length === 0) return 'Not tried yet';
  const days = daysSince(matches[0].date);
  if (days === 0) return 'Done today';
  if (days === 1) return 'Last done yesterday';
  return `Last done ${days} days ago`;
}

const SESSION_INFO: Record<Exclude<ModalType, 'conditioning' | null>, {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  duration: string;
  description: string;
  cta: string;
  sessionType: 'prehab' | 'flexibility';
}> = {
  recovery: {
    title: 'Recovery',
    icon: 'shield-checkmark',
    iconBg: '#e8f5e9',
    iconColor: '#2e7d32',
    duration: 'Full-body joint circuit · 20–30 min',
    description: 'A gentle circuit targeting common trouble spots. Perfect after a hard training block or on a rest day. Select a focus area or choose Full Body for a complete joint reset.',
    cta: 'Start Recovery',
    sessionType: 'prehab',
  },
  mobility: {
    title: 'Mobility',
    icon: 'leaf',
    iconBg: '#e8f5e9',
    iconColor: '#2e7d32',
    duration: 'Full-body stretch session · 30–40 min',
    description: 'Long-hold stretches for the full body. Improves range of motion and helps you move and feel better between training days. Best done when your muscles are slightly warm.',
    cta: 'Start Mobility',
    sessionType: 'flexibility',
  },
  prehab: {
    title: 'Targeted Prehab',
    icon: 'fitness',
    iconBg: '#fff3e0',
    iconColor: '#e65100',
    duration: 'Area-focused circuit · 20–30 min',
    description: 'Select a region that needs attention. The session focuses on protecting and strengthening that specific area to reduce injury risk and improve long-term function.',
    cta: 'Choose Area & Start',
    sessionType: 'prehab',
  },
};

const CONDITIONING_LEVELS: Array<{
  key: ConditioningLevel;
  label: string;
  description: string;
  energy: string;
  timeAvailable: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  {
    key: 'beginner',
    label: 'Beginner',
    description: 'Steady pace · 30 min',
    energy: 'low',
    timeAvailable: '30',
    icon: 'walk',
    color: '#4caf50',
  },
  {
    key: 'intermediate',
    label: 'Intermediate',
    description: 'Moderate intensity · 45 min',
    energy: 'normal',
    timeAvailable: '45',
    icon: 'bicycle',
    color: '#ff9800',
  },
  {
    key: 'advanced',
    label: 'Advanced',
    description: 'High intensity · 60 min',
    energy: 'high',
    timeAvailable: '60',
    icon: 'flame',
    color: '#f44336',
  },
];

export default function FlexScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { completedSessions } = useAppStore();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const prehabRecency = useMemo(() => getFlexRecency(completedSessions, 'prehab'), [completedSessions]);
  const flexRecency = useMemo(() => getFlexRecency(completedSessions, 'flexibility'), [completedSessions]);
  const condRecency = useMemo(() => getFlexRecency(completedSessions, 'conditioning'), [completedSessions]);

  const styles = useMemo(() => makeStyles(C), [C]);

  const openModal = (type: NonNullable<ModalType>) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveModal(type);
  };

  const closeModal = () => setActiveModal(null);

  const handleStart = (sessionType: 'prehab' | 'flexibility') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeModal();
    router.push({ pathname: '/readiness', params: { sessionType, isTestWeek: 'false' } });
  };

  const handleConditioningStart = (level: typeof CONDITIONING_LEVELS[number]) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeModal();
    router.push({
      pathname: '/readiness',
      params: {
        sessionType: 'conditioning',
        isTestWeek: 'false',
        energy: level.energy,
        timeAvailable: level.timeAvailable,
      },
    });
  };

  const ROWS: Array<{
    key: NonNullable<ModalType>;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    recency: string;
  }> = [
    {
      key: 'recovery',
      title: 'Recovery',
      subtitle: 'Full-body joint circuit · 20–30 min',
      icon: 'shield-checkmark',
      iconBg: '#e8f5e9',
      iconColor: '#2e7d32',
      recency: prehabRecency,
    },
    {
      key: 'mobility',
      title: 'Mobility',
      subtitle: 'Full-body stretch session · 30–40 min',
      icon: 'leaf',
      iconBg: '#e8f5e9',
      iconColor: '#2e7d32',
      recency: flexRecency,
    },
    {
      key: 'prehab',
      title: 'Targeted Prehab',
      subtitle: 'Area-focused circuit · 20–30 min',
      icon: 'fitness',
      iconBg: '#fff3e0',
      iconColor: '#e65100',
      recency: prehabRecency,
    },
    {
      key: 'conditioning',
      title: 'Conditioning',
      subtitle: 'HIIT & cardio circuit · 30–60 min',
      icon: 'thunderstorm',
      iconBg: '#fce4ec',
      iconColor: '#c62828',
      recency: condRecency,
    },
  ];

  const activeInfo = activeModal && activeModal !== 'conditioning' ? SESSION_INFO[activeModal] : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.rootContent,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: insets.bottom + webBottomInset + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingBottom: 8 }]}>
        <Text style={styles.title}>Rest & Restore</Text>
        <Text style={styles.subtitle}>Recovery, mobility, prehab and conditioning</Text>
      </View>

      {/* Nav card list — intrinsic height so the bottom card is never clipped.
          overflow:hidden on the inner shell rounds the corners; the outer ring
          supplies the border without constraining height. */}
      <View style={styles.navGrid}>
        <View style={styles.navGridInner}>
          {ROWS.map((row, i) => (
            <React.Fragment key={row.key}>
              {i > 0 && <View style={styles.navDivider} />}
              <Animated.View entering={FadeIn.delay(i * 60).duration(380)}>
                <Pressable
                  onPress={() => openModal(row.key)}
                  style={({ pressed }) => [
                    styles.navBtn,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  testID={`flex-row-${row.key}`}
                >
                  <View style={[styles.navIcon, { backgroundColor: row.iconBg }]}>
                    <Ionicons name={row.icon} size={22} color={row.iconColor} />
                  </View>
                  <View style={styles.navBtnText}>
                    <Text style={styles.navLabel}>{row.title}</Text>
                    <Text style={styles.navSub}>{row.subtitle}</Text>
                    <Text style={styles.navRecency}>{row.recency}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                </Pressable>
              </Animated.View>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Standard session sheet (recovery / mobility / prehab) */}
      <Modal
        visible={activeModal !== null && activeModal !== 'conditioning'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            {activeInfo && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIconWrap, { backgroundColor: activeInfo.iconBg }]}>
                    <Ionicons name={activeInfo.icon} size={26} color={activeInfo.iconColor} />
                  </View>
                  <View style={styles.sheetHeaderText}>
                    <Text style={styles.sheetTitle}>{activeInfo.title}</Text>
                    <Text style={styles.sheetDuration}>{activeInfo.duration}</Text>
                  </View>
                  <Pressable
                    onPress={closeModal}
                    style={styles.closeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={C.textSecondary} />
                  </Pressable>
                </View>

                <Text style={styles.sheetDesc}>{activeInfo.description}</Text>

                <Pressable
                  onPress={() => handleStart(activeInfo.sessionType)}
                  style={({ pressed }) => [
                    styles.startBtn,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  testID={`flex-start-${activeModal}`}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.startBtnText}>{activeInfo.cta}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Conditioning level-selection sheet */}
      <Modal
        visible={activeModal === 'conditioning'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconWrap, { backgroundColor: '#fce4ec' }]}>
                <Ionicons name="thunderstorm" size={26} color="#c62828" />
              </View>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>Conditioning</Text>
                <Text style={styles.sheetDuration}>HIIT & cardio circuit · choose intensity</Text>
              </View>
              <Pressable
                onPress={closeModal}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.sheetDesc}>
              Pick your intensity. Your session will be matched to your equipment and the selected level — from a steady aerobic circuit to a high-intensity HIIT blast.
            </Text>

            <View style={styles.levelList}>
              {CONDITIONING_LEVELS.map((level) => (
                <Pressable
                  key={level.key}
                  onPress={() => handleConditioningStart(level)}
                  style={({ pressed }) => [
                    styles.levelBtn,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  ]}
                  testID={`flex-conditioning-${level.key}`}
                >
                  <View style={[styles.levelIconWrap, { backgroundColor: level.color + '22' }]}>
                    <Ionicons name={level.icon} size={20} color={level.color} />
                  </View>
                  <View style={styles.levelTextWrap}>
                    <Text style={styles.levelLabel}>{level.label}</Text>
                    <Text style={styles.levelDesc}>{level.description}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={level.color} />
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    rootContent: { flexGrow: 1 },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },

    navGrid: {
      marginHorizontal: 16,
      marginTop: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    navGridInner: {
      borderRadius: 17,
      overflow: 'hidden',
      backgroundColor: C.surface,
    },
    navDivider: { height: 1, backgroundColor: C.borderLight, marginHorizontal: 16 },
    navBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      minHeight: 82,
      gap: 14,
    },
    navIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    navBtnText: { flex: 1 },
    navLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    navSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    navRecency: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 },

    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    sheetIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetHeaderText: { flex: 1 },
    sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
    sheetDuration: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 3 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.surfaceTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetDesc: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      lineHeight: 21,
      marginBottom: 24,
    },

    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 15,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 5,
    },
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },

    levelList: {
      gap: 10,
    },
    levelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    levelIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelTextWrap: { flex: 1 },
    levelLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    levelDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
  });
}
