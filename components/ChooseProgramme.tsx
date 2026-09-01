/**
 * NO PROGRAMME YET: the page that offers seven, and says none of them is compulsory.
 *
 * WHY IT EXISTS
 * ─────────────
 * "Your Program" used to lead an unenrolled user to the three-lift rotation and
 * a cycle number, which is a description of what the app had been doing to them
 * rather than a choice they had made. Reported after use: the home screen
 * suggested a Squat Session with a Test Week badge to somebody who had never
 * asked for either, and there was nowhere obvious to go and change it.
 *
 * So Home now points here whenever nobody is enrolled, and here offers the seven
 * programmes directly, plus the builder for anybody who would rather answer
 * questions than choose. Both land in the same hub.
 *
 * THE SENTENCE AT THE BOTTOM IS NOT A DISCLAIMER, IT IS THE POINT.
 * A programme is a convenience, not the app. Everything in Train stays open,
 * nothing here is required, and somebody who reads this page as "pick one or you
 * cannot use Grow" has been told the opposite of the truth.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, useGoColors } from '@/constants/colors';
import { SESSION_SHORT_LABELS } from '@/lib/session-meta';
import { useAppStore } from '@/lib/store';
import {
  PROGRAMMES,
  PROGRAMME_IDS,
  cycleFor,
  programmeDifficulty,
  type ProgrammeId,
} from '@/lib/programme';

export interface ChooseProgrammeProps {
  /**
   * Reveals the three-lift rotation screen this page replaced.
   *
   * Absent for anybody who has never trained on it. Present, and quiet, for
   * everybody who has: their rotation is real, it has a cycle number they have
   * watched climb, and replacing that with a chooser without a way back would
   * be taking something away in the name of tidying up.
   */
  onKeepRotation?: () => void;
}

export function ChooseProgramme({ onKeepRotation }: ChooseProgrammeProps) {
  const C = useColors();
  const go = useGoColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);

  const enrolInProgramme = useAppStore((s) => s.enrolInProgramme);
  const experienceLevel = useAppStore((s) => s.userProfile?.experienceLevel);
  const [picked, setPicked] = useState<ProgrammeId | null>(null);

  const haptic = useCallback((heavy = false) => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(
      heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
  }, []);

  const start = useCallback(
    (id: ProgrammeId) => {
      haptic(true);
      enrolInProgramme(id, new Date().toISOString());
    },
    [enrolInProgramme, haptic]
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      testID="choose-programme"
    >
      <Text style={styles.lede}>
        A programme decides what you train and when, so you do not have to. Pick one, or answer a
        few questions and we will pick.
      </Text>

      {/* The builder first, because it is the better answer for most people:
          it reads their injuries, their kit and their goal, and this list
          cannot. Offered rather than forced, which is why the seven are still
          right underneath it. */}
      <Pressable
        onPress={() => {
          haptic(true);
          router.push('/onboarding');
        }}
        testID="choose-build-mine"
        style={({ pressed }) => [styles.builder, pressed && { opacity: 0.9 }]}
      >
        <View style={[styles.builderIcon, { backgroundColor: C.primaryMuted }]}>
          <Ionicons name="git-branch-outline" size={20} color={C.primaryText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.builderTitle}>Build mine from a few questions</Text>
          <Text style={styles.builderSub}>
            It reads your goal, your kit, your time and anything that is sore, then picks and
            tunes one.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
      </Pressable>

      <Text style={styles.sectionLabel}>OR CHOOSE ONE YOURSELF</Text>

      {PROGRAMME_IDS.map((id) => {
        const t = PROGRAMMES[id];
        const open = picked === id;
        const difficulty = programmeDifficulty(id, experienceLevel ?? 'beginner', 3);
        return (
          <View key={id} style={[styles.card, open && { borderColor: go.fill }]}>
            <Pressable
              onPress={() => {
                haptic();
                setPicked(open ? null : id);
              }}
              testID={`choose-programme-${id}`}
              style={({ pressed }) => [styles.cardHead, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{t.name}</Text>
                <Text style={styles.cardBlurb}>{t.blurb}</Text>
              </View>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={17}
                color={C.textTertiary}
              />
            </Pressable>

            {open && (
              <View style={styles.cardBody}>
                <View style={styles.metaRow}>
                  <View style={styles.difficultyPill}>
                    <Text style={styles.difficultyPillText}>
                      {difficulty.label.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>
                    {cycleFor(id, 3).map((s) => SESSION_SHORT_LABELS[s]).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.cardNote}>
                  Starts at 3 days a week over 12 sessions. Both are yours to change on the next
                  screen, along with how long you have got.
                </Text>
                <Pressable
                  onPress={() => start(id)}
                  testID={`start-programme-${id}`}
                  style={({ pressed }) => [
                    styles.startBtn,
                    { backgroundColor: go.fill },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.startBtnText, { color: go.on }]}>Start {t.name}</Text>
                  <Ionicons name="arrow-forward" size={16} color={go.on} />
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {/* Said last, and said plainly. */}
      <View style={styles.footNote} testID="choose-programme-optional">
        <Ionicons name="information-circle-outline" size={15} color={C.textTertiary} />
        <Text style={styles.footNoteText}>
          You do not need one. Every session in Train stays open whether you are on a programme or
          not, and anything you do there is logged and counts towards your records either way.
        </Text>
      </View>
      <Pressable
        onPress={() => {
          haptic();
          router.push('/(tabs)/train');
        }}
        testID="choose-programme-train-instead"
        style={({ pressed }) => [styles.wideBtn, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="grid-outline" size={16} color={C.text} />
        <Text style={styles.wideBtnText}>Just pick a session instead</Text>
      </Pressable>

      {!!onKeepRotation && (
        <Pressable
          onPress={() => {
            haptic();
            onKeepRotation();
          }}
          testID="choose-programme-keep-rotation"
          style={({ pressed }) => [styles.quietLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.quietLinkText}>See the rotation you have been training</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 18, paddingTop: 10, gap: 10 },

    lede: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 4,
    },

    builder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: C.primaryMuted,
      backgroundColor: C.primarySurface,
    },
    builderIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    builderTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
    builderSub: {
      fontSize: 12,
      lineHeight: 16.5,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },

    sectionLabel: {
      fontSize: 10.5,
      letterSpacing: 1,
      fontFamily: 'Inter_700Bold',
      color: C.textTertiary,
      marginTop: 12,
      marginBottom: 2,
    },

    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      overflow: 'hidden',
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    cardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    cardBlurb: {
      fontSize: 12,
      lineHeight: 16.5,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    cardBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    difficultyPill: {
      paddingHorizontal: 8,
      paddingVertical: 3.5,
      borderRadius: 6,
      backgroundColor: C.surfaceSecondary,
    },
    difficultyPillText: {
      fontSize: 9.5,
      letterSpacing: 0.8,
      fontFamily: 'Inter_700Bold',
      color: C.textSecondary,
    },
    metaText: { flex: 1, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    cardNote: {
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },

    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
    },
    startBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },

    footNote: { flexDirection: 'row', gap: 8, marginTop: 14, paddingHorizontal: 2 },
    footNoteText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },

    wideBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      marginTop: 6,
    },
    wideBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },

    quietLink: { alignItems: 'center', paddingVertical: 14 },
    quietLinkText: {
      fontSize: 12.5,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      textDecorationLine: 'underline',
    },
  });
}
