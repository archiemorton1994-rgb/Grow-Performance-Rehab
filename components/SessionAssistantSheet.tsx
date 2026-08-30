/**
 * The assistant, mid-session, talking only about the set you are on.
 *
 * THE THIRD SURFACE. The home panel is the briefing and app/assistant.tsx is
 * the file behind it; both look across weeks. This one deliberately cannot:
 * lib/session-coach.ts is scoped to the exercise, the set and the mechanics of
 * logging, because a person standing at a rack does not need to hear about
 * their streak.
 *
 * SAPPHIRE, like the other two. The colour is the assistant's whole identity
 * and it only works while it stays exclusive, which is what
 * tests/assistant-identity.check.mjs enforces. This file is on that test's list
 * of surfaces allowed to wear it.
 *
 * IT IS A SHEET, NOT A CHAT. There is nothing to type. The questions people
 * actually have mid-session are a short and knowable list, and answering them
 * without asking anyone to compose a sentence between sets is the whole point.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import {
  sessionCoachSubtitle,
  sessionCoachTips,
  type SessionCoachContext,
} from '@/lib/session-coach';

export interface SessionAssistantSheetProps {
  visible: boolean;
  onClose: () => void;
  context: SessionCoachContext | null;
  /** Turns it off for good, from inside the sheet as well as from Settings. */
  onTurnOff: () => void;
}

/**
 * The way in, from the session top bar.
 *
 * It lives HERE rather than inline in app/session.tsx for one reason: the
 * assistant palette is exclusive, tests/assistant-identity.check.mjs enforces
 * that, and the enforcement only means anything while the list of files
 * allowed to wear sapphire is the list of files that ARE the assistant.
 */
export function SessionAssistantButton({
  onPress,
  hasNews = false,
}: {
  onPress: () => void;
  /**
   * True when the top of what it would say has changed since it was last
   * opened. A badge that is always on is wallpaper; this one goes out the
   * moment you look, and only comes back when there is genuinely something
   * else - a KPI lift, a first logged set, an area that hurts.
   */
  hasNews?: boolean;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Pressable
      onPress={onPress}
      style={styles.openBtn}
      testID="session-assistant-open"
      accessibilityRole="button"
      accessibilityLabel={
        hasNews
          ? 'Ask the assistant about this session, it has something to say'
          : 'Ask the assistant about this session'
      }
    >
      <Ionicons name="chatbubbles" size={17} color={C.assistantOnFill} />
      {hasNews && (
        <View style={styles.newsDot} testID="assistant-has-news">
          <Text style={styles.newsMark}>!</Text>
        </View>
      )}
    </Pressable>
  );
}

export function SessionAssistantSheet({
  visible,
  onClose,
  context,
  onTurnOff,
}: SessionAssistantSheetProps) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const tips = useMemo(() => (context ? sessionCoachTips(context) : []), [context]);
  /**
   * Turning it off used to make the button vanish with no explanation, and
   * nothing anywhere said how to get it back: "currently it just disappears".
   * The sheet stays up and says where it went.
   */
  const [turnedOff, setTurnedOff] = useState(false);
  React.useEffect(() => {
    if (visible) setTurnedOff(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />

          <View style={styles.head}>
            <View style={styles.avatar}>
              <Ionicons name="chatbubbles" size={20} color={C.assistantOnFill} />
            </View>
            <View style={styles.headText}>
              <Text style={styles.title}>While you are training</Text>
              {!!context && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {sessionCoachSubtitle(context)}
                </Text>
              )}
            </View>
          </View>

          {turnedOff ? (
            <View style={styles.tip} testID="assistant-turned-off">
              <Text style={styles.tipTitle}>Turned off for your sessions</Text>
              <Text style={styles.tipBody}>
                The button will not appear on the exercise card any more. To bring it back,
                go to Profile, open Settings, and switch In-Session Assistant back on.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {tips.map((tip, i) => (
                <View key={tip.title + i} style={styles.tip} testID={`session-tip-${i}`}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipBody}>{tip.body}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            {!turnedOff && (
              <Pressable
                onPress={() => {
                  setTurnedOff(true);
                  onTurnOff();
                }}
                style={styles.offBtn}
                testID="assistant-turn-off"
                accessibilityRole="button"
                accessibilityLabel="Turn the in-session assistant off"
              >
                <Text style={styles.offText}>Turn this off</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              style={styles.doneBtn}
              testID="assistant-close"
              accessibilityRole="button"
              accessibilityLabel="Back to the session"
            >
              <Text style={styles.doneText}>{turnedOff ? 'Got it' : 'Back to it'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    openBtn: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.assistantFill,
    },
    // Amber rather than red: it is "there is something here", not "something is
    // wrong". Sits proud of the corner so it reads at a glance on a small
    // button.
    newsDot: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.pbFlash,
    },
    newsMark: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.pbFlashText },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      width: '100%',
      maxHeight: '82%',
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 16,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: C.background,
      gap: 12,
    },
    grabber: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.assistantFill,
    },
    headText: { flex: 1, gap: 2 },
    title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.assistantInk },
    scroll: { flexShrink: 1 },
    scrollContent: { gap: 10, paddingBottom: 4 },
    tip: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: C.assistantSurface,
      borderWidth: 1,
      borderColor: C.assistantMuted,
      gap: 5,
    },
    tipTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.assistantInk },
    tipBody: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.text, lineHeight: 20 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    offBtn: { paddingVertical: 12, paddingHorizontal: 14 },
    offText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    doneBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: C.assistantFill,
    },
    doneText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.assistantOnFill },
  });
}
