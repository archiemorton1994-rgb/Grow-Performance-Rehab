import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WeightUnit } from '@/lib/store';

const BRAND_GREEN = '#2f6b46';
const BRAND_DARK = '#1e4a30';
const CARD_WIDTH = 380;
const CARD_HEIGHT = 480;

export interface WorkoutShareCardData {
  sessionLabel: string;
  sessionSubtitle: string;
  totalVolumeKg: number;
  totalSets: number;
  durationSeconds: number;
  newPb: { exerciseName: string; weightKg: number } | null;
  streakDays: number;
  isTestWeek: boolean;
  weightUnit: WeightUnit;
}

const WorkoutShareCard = forwardRef<View, WorkoutShareCardData>(
  (
    {
      sessionLabel,
      sessionSubtitle,
      totalVolumeKg,
      totalSets,
      durationSeconds,
      newPb,
      streakDays,
      isTestWeek,
      weightUnit,
    },
    ref
  ) => {
    const date = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const durationMin = Math.round(durationSeconds / 60);

    const displayVolume = weightUnit === 'lbs'
      ? Math.round(totalVolumeKg * 2.2046)
      : Math.round(totalVolumeKg);

    const volumeStr = displayVolume >= 1000
      ? `${(displayVolume / 1000).toFixed(1)}t`
      : `${displayVolume.toLocaleString()}${weightUnit}`;

    const pbWeightDisplay = newPb
      ? weightUnit === 'lbs'
        ? `${Math.round(newPb.weightKg * 2.2046)} lbs`
        : `${Math.round(newPb.weightKg)} kg`
      : null;

    return (
      <View ref={ref} style={styles.card}>
        <View style={styles.topBar} />

        <View style={styles.logoRow}>
          <View style={styles.logoCircle}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>GROW</Text>
            <Text style={styles.brandSub}>Performance & Rehabilitation</Text>
          </View>
        </View>

        <View style={styles.sessionBlock}>
          <Text style={styles.sessionLabel}>{sessionLabel}</Text>
          <Text style={styles.sessionSubtitle}>
            {isTestWeek ? 'Strength Test Week' : sessionSubtitle}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>SETS</Text>
          </View>
          {totalVolumeKg > 0 && (
            <>
              <View style={styles.statSep} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{volumeStr}</Text>
                <Text style={styles.statLabel}>MOVED</Text>
              </View>
            </>
          )}
          <View style={styles.statSep} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{durationMin}m</Text>
            <Text style={styles.statLabel}>DURATION</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          {newPb && (
            <View style={styles.pbBadge}>
              <Ionicons name="trophy" size={13} color="#f59e0b" />
              <Text style={styles.pbText} numberOfLines={1}>
                New PB — {newPb.exerciseName} {pbWeightDisplay}
              </Text>
            </View>
          )}
          {streakDays >= 2 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {streakDays}-day streak</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerDate}>{date}</Text>
          <Text style={styles.footerUrl}>growperformance.app</Text>
        </View>
      </View>
    );
  }
);

WorkoutShareCard.displayName = 'WorkoutShareCard';

export default WorkoutShareCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: BRAND_GREEN,
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 0,
  },
  topBar: {
    height: 6,
    backgroundColor: '#ffffff22',
    marginHorizontal: -28,
    marginBottom: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  brandText: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  brandSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  sessionBlock: {
    marginBottom: 20,
  },
  sessionLabel: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 40,
  },
  sessionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 36,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  statSep: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeRow: {
    gap: 8,
    flex: 1,
  },
  pbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pbText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  streakText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  footerDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  footerUrl: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
});
