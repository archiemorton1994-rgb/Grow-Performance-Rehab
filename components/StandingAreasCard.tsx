/**
 * THE AREAS EVERY SESSION IS BUILT AROUND, AND THE ONLY PLACE THEY CAN CHANGE.
 *
 * Two answers from the profile builder decide this:
 *
 *   "Is anything sore or injured right now?"  -> standingSoreRegions
 *   "Has a clinician told you to avoid loading anything?" -> clinicalAvoid
 *
 * Both are standing facts about a person rather than a report about today, so
 * both are merged into every session the engine builds (see generateWorkout in
 * lib/workout-engine.ts, where the two lists become one set of regions to work
 * around). The readiness screen's question is separate and still asked before
 * every session; it answers "what hurts now", not "what do we always avoid".
 *
 * WHY THIS CARD HAD TO EXIST BEFORE THE SORE ANSWER COULD BE WIRED UP. Both
 * fields were written once, at sign-up, by a builder that cannot be re-entered.
 * An answer given once that quietly suppresses a chunk of the catalogue for ever,
 * with no way to say "that knee is better now", is worse than an answer that
 * does nothing - and until this card, that is exactly what the clinician answer
 * already was. A shoulder that settles has to be able to come off the list.
 *
 * The two are kept apart on purpose. A clinician's instruction is not the same
 * statement as "this ached when I signed up", and a physiotherapist reading this
 * screen should be able to tell which is which.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PAIN_CATEGORIES, useAppStore, type PainRegion } from '@/lib/store';
import type { AppColors } from '@/constants/colors';

const ALL_REGIONS: { id: PainRegion; label: string }[] = Object.values(PAIN_CATEGORIES).flatMap(
  (g) => g.regions
);

const labelFor = (r: PainRegion) => ALL_REGIONS.find((x) => x.id === r)?.label ?? r;

type Which = 'sore' | 'clinical';

export default function StandingAreasCard({ C }: { C: AppColors }) {
  const userProfile = useAppStore((s) => s.userProfile);
  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const [editing, setEditing] = useState<Which | null>(null);

  const sore = userProfile.standingSoreRegions ?? [];
  const clinical = userProfile.clinicalAvoid ?? [];
  const styles = makeStyles(C);

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggle = (which: Which, region: PainRegion) => {
    tap();
    const current = which === 'sore' ? sore : clinical;
    const next = current.includes(region)
      ? current.filter((r) => r !== region)
      : [...current, region];
    setUserProfile(
      which === 'sore'
        ? {
            standingSoreRegions: next,
            // Clearing the last area clears how long it had been going on with
            // it. Leaving "a few weeks" behind with nothing it refers to is the
            // kind of orphan that later reads as a fact.
            standingSoreSince: next.length === 0 ? null : userProfile.standingSoreSince,
          }
        : { clinicalAvoid: next }
    );
  };

  const Row = ({ which, title, blurb, list }: {
    which: Which;
    title: string;
    blurb: string;
    list: PainRegion[];
  }) => {
    const open = editing === which;
    return (
      <View style={styles.row} testID={`standing-${which}`}>
        <Pressable
          onPress={() => {
            tap();
            setEditing(open ? null : which);
          }}
          testID={`standing-${which}-toggle`}
          accessibilityRole="button"
          accessibilityLabel={open ? `Done editing ${title}` : `Change ${title}`}
          style={({ pressed }) => [styles.rowHead, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowBlurb}>{blurb}</Text>
          </View>
          <Text style={styles.rowAction}>{open ? 'Done' : 'Change'}</Text>
        </Pressable>

        {list.length > 0 ? (
          <View style={styles.chips}>
            {list.map((r) => (
              <View key={r} style={styles.chipOn} testID={`standing-${which}-on-${r}`}>
                <Text style={styles.chipOnText}>{labelFor(r)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.none} testID={`standing-${which}-none`}>
            Nothing, so nothing is being worked around.
          </Text>
        )}

        {open && (
          <View style={styles.grid}>
            {ALL_REGIONS.map((r) => {
              const on = list.includes(r.id);
              return (
                <Pressable
                  key={r.id}
                  onPress={() => toggle(which, r.id)}
                  testID={`standing-${which}-pick-${r.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={r.label}
                  style={({ pressed }) => [
                    styles.pick,
                    on && styles.pickOn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{r.label}</Text>
                  {on && <Ionicons name="checkmark" size={13} color={C.primaryDark} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(120).duration(400)}
      style={styles.card}
      testID="standing-areas-card"
    >
      <View style={styles.head}>
        <Ionicons name="shield-checkmark-outline" size={19} color={C.primaryDark} />
        <Text style={styles.title}>Areas we work around</Text>
      </View>
      <Text style={styles.intro}>
        Every session avoids loading these, whether or not they hurt on the day. What is sore
        right now is a separate question, asked before each session.
      </Text>

      <Row
        which="sore"
        title="Sore or injured"
        blurb="What you told us was bothering you"
        list={sore}
      />
      <Row
        which="clinical"
        title="A clinician said to avoid"
        blurb="From a physio, doctor or surgeon"
        list={clinical}
      />
    </Animated.View>
  );
}

const makeStyles = (C: AppColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
    intro: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, lineHeight: 19 },
    row: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
    rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    rowBlurb: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    rowAction: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryDark },
    none: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    chipOn: {
      backgroundColor: C.primaryMuted,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    chipOnText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: C.primaryDark },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    pick: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 7,
      paddingHorizontal: 10,
    },
    pickOn: { backgroundColor: C.primaryMuted, borderColor: C.primaryDark },
    pickText: { fontSize: 12.5, fontFamily: 'Inter_400Regular', color: C.text },
    pickTextOn: { fontFamily: 'Inter_600SemiBold', color: C.primaryDark },
  });
