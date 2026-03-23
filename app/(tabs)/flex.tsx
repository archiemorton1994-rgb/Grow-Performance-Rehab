import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { PainRegion, useAppStore, PAIN_CATEGORIES } from '@/lib/store';

export default function FlexScreen() {
  const insets = useSafeAreaInsets();
  const { getEffectiveTier } = useAppStore();
  const equipmentTier = getEffectiveTier();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [selectedRegion, setSelectedRegion] = useState<PainRegion | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startSession = (
    sessionType: 'prehab' | 'flexibility',
    hasAches = false,
    painRegion?: PainRegion,
  ) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/session',
      params: {
        sessionType,
        hasAches: hasAches ? 'true' : 'false',
        painRegion: painRegion ?? '',
        energy: 'normal',
        timeAvailable: '60',
        isTestWeek: 'false',
        equipment: equipmentTier,
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + webTopInset + 16,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Rest & Restore</Text>
      <Text style={styles.subtitle}>Recovery, mobility, and prehab sessions</Text>

      {/* Recovery */}
      <Animated.View entering={FadeInDown.delay(0).duration(400)}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="shield-checkmark" size={22} color="#2e7d32" />
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.cardTitle}>Recovery</Text>
              <Text style={styles.cardDuration}>Full-body joint circuit · 20–30 min</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            A gentle circuit targeting common trouble spots. Perfect after a hard training block or on a rest day.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
            onPress={() => startSession('prehab')}
          >
            <Ionicons name="play" size={15} color="#fff" />
            <Text style={styles.startBtnText}>Start Recovery</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Mobility */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="leaf" size={22} color="#2e7d32" />
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.cardTitle}>Mobility</Text>
              <Text style={styles.cardDuration}>Full-body stretch session · 30–40 min</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            Long-hold stretches for the full body. Improves range of motion and helps you move and feel better between training days.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
            onPress={() => startSession('flexibility')}
          >
            <Ionicons name="play" size={15} color="#fff" />
            <Text style={styles.startBtnText}>Start Mobility</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Targeted Prehab */}
      <Animated.View entering={FadeInDown.delay(160).duration(400)}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="fitness" size={22} color="#e65100" />
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.cardTitle}>Targeted Prehab</Text>
              <Text style={styles.cardDuration}>Area-focused circuit · 20–30 min</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            Select a region that needs attention. The session focuses on protecting and strengthening that area.
          </Text>

          <View style={styles.areaSection}>
            <Text style={styles.areaLabel}>Select area</Text>
            {Object.entries(PAIN_CATEGORIES).map(([catKey, cat]) => {
              const isOpen = expandedCategory === catKey;
              return (
                <View key={catKey}>
                  <Pressable
                    style={[styles.categoryRow, isOpen && styles.categoryRowOpen]}
                    onPress={() => {
                      hapticTap();
                      setExpandedCategory(isOpen ? null : catKey);
                      if (isOpen) setSelectedRegion(null);
                    }}
                  >
                    <Text style={[styles.categoryText, isOpen && styles.categoryTextOpen]}>
                      {cat.label}
                    </Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={isOpen ? Colors.primary : Colors.textSecondary}
                    />
                  </Pressable>
                  {isOpen && (
                    <View style={styles.regionGrid}>
                      {cat.regions.map((r) => {
                        const isSelected = selectedRegion === r.id;
                        return (
                          <Pressable
                            key={r.id}
                            style={[styles.regionChip, isSelected && styles.regionChipSelected]}
                            onPress={() => {
                              hapticTap();
                              setSelectedRegion(isSelected ? null : r.id as PainRegion);
                            }}
                          >
                            <Text style={[styles.regionText, isSelected && styles.regionTextSelected]}>
                              {r.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              styles.startBtnOrange,
              !selectedRegion && styles.startBtnDisabled,
              pressed && !!selectedRegion && { opacity: 0.85 },
            ]}
            onPress={() => selectedRegion && startSession('prehab', true, selectedRegion)}
            disabled={!selectedRegion}
          >
            <Ionicons name="play" size={15} color="#fff" />
            <Text style={styles.startBtnText}>
              {selectedRegion ? 'Start Targeted Prehab' : 'Choose an area above'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },

  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.text },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 24,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardMeta: { flex: 1 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  cardDuration: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  startBtnOrange: {
    backgroundColor: '#e65100',
    shadowColor: '#e65100',
  },
  startBtnDisabled: {
    backgroundColor: Colors.surfaceTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  startBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },

  areaSection: { marginBottom: 16 },
  areaLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryRowOpen: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  categoryTextOpen: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },

  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 8,
    paddingTop: 4,
  },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  regionChipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  regionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  regionTextSelected: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
});
