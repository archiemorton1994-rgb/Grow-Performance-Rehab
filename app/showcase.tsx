import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import { PAIN_ADAPTATION_REGION_COUNT } from '@/lib/store';
import { SESSION_TYPE_COUNT } from '@/lib/session-meta';
import { GrowIconTile } from '@/components/GrowIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * WHAT THE APP DOES, BEFORE ANYONE IS ASKED TO PAY FOR IT.
 *
 * THE PROBLEM THIS SOLVES
 * ───────────────────────
 * The order used to be: twelve onboarding screens, sign in, PAY, and only then
 * the guided tour and the practice session. Every person who downloaded Grow
 * invested ten minutes and handed over card details before experiencing a
 * single thing it does. The practice session, built specifically so logging a
 * real one feels familiar, was seen only by people who had already converted.
 *
 * WHY THIS IS NOT THE TAB TOUR MOVED FORWARD
 * ──────────────────────────────────────────
 * Two reasons, and both matter.
 *
 * The tab tour lives inside (tabs). Putting the tabs in front of the paywall
 * means an unsubscribed user is inside the app, and anyone who skips the tour is
 * simply in. This screen sits outside the tabs, and the practice session it ends
 * on is a root-level route in demo mode that cannot write to the store (see
 * tests/demo-session-no-persist.check.mjs), so nothing is exposed.
 *
 * And the two have different jobs. The tab tour teaches where the buttons are,
 * which is worth nothing to somebody still deciding whether to pay. This has to
 * answer "what is this, and why is it not the last training app I deleted". So
 * it leads with the things nothing else does: it trains around pain, it moves
 * the weight for you, and it is built by a physiotherapist.
 *
 * It ends by handing over. The strongest argument this app has is thirty seconds
 * of using it.
 */
interface Card {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  proof?: string;
}

const CARDS: Card[] = [
  {
    icon: 'rehab',
    eyebrow: 'Built by a physiotherapist',
    title: 'It trains around pain, not through it',
    body: `Say an area is sore and the session changes. The app takes out what would aggravate it, puts gentle work for that area in, and attaches a limit to stay inside. Not a lighter session. A different one.`,
    proof: `${PAIN_ADAPTATION_REGION_COUNT} areas you can flag, every one with rehab work behind it`,
  },
  {
    icon: 'trend',
    eyebrow: 'No spreadsheets',
    title: 'The weight moves itself',
    body: `Every load is worked out from what you actually lifted last time. Clear your reps and it climbs. Fall short and it holds. Come back from a break and it meets you where you are, then builds again.`,
    proof: 'Reps rise before weight does, which is why progress keeps going',
  },
  {
    icon: 'dumbbell',
    eyebrow: 'Whatever you have got',
    title: 'A full session in the space you have',
    body: `Tell it what equipment is around and how long you have got. Thirty minutes gets your warm-up, main lift and an accessory. An hour gets the lot. A machine taken? Swap any exercise for the same movement with different kit.`,
    proof: `${SESSION_TYPE_COUNT} kinds of session, from a heavy squat day to ten minutes of mobility`,
  },
  {
    icon: 'chart',
    eyebrow: 'It watches, so you do not have to',
    title: 'It tells you what it has noticed',
    body: `A lift that has stalled three sessions running. A personal best you did not clock. An ache you have now flagged five times in ten weeks, which is worth someone looking at. It says so, and it says what to do.`,
    proof: 'And you can hand the whole pain history to your physio in one tap',
  },
];

export default function ShowcaseScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const webTop = Platform.OS === 'web' ? 67 : 0;

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, CARDS.length - 1));
      setIndex(clamped);
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * clamped, animated: true });
    },
    []
  );

  const handleNext = useCallback(() => {
    haptic();
    if (index < CARDS.length - 1) {
      goTo(index + 1);
      return;
    }
    // The practice session. demo=true is what stops it touching the store;
    // showcase=true is what routes its ending here rather than into the tabs.
    router.push('/session?demo=true&showcase=true' as never);
  }, [index, goTo, haptic]);

  /**
   * Skipping ends the showcase, it does not end the decision.
   *
   * It lands on the offer, which is the next thing either way. Nobody is
   * trapped in a pitch.
   *
   * IT DOES NOT SET showcaseComplete. The gate exempts the offer route only
   * while the showcase is unseen, so marking it here made the exemption stop
   * applying in the same tick and the gate replaced the offer with the paywall
   * before it rendered. The offer sets the flag on its own Continue button.
   */
  const handleSkip = useCallback(() => {
    haptic();
    router.replace('/offer' as never);
  }, [haptic]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) setIndex((i) => Math.min(i + 1, CARDS.length - 1));
        else if (g.dx > 50) setIndex((i) => Math.max(i - 1, 0));
      },
    })
  ).current;

  const isLast = index === CARDS.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop + 8 }]}>
      <View style={styles.topRow}>
        <View style={styles.dots}>
          {CARDS.map((c, i) => (
            <View key={c.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={handleSkip} hitSlop={12} testID="showcase-skip">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        {...pan.panHandlers}
      >
        {CARDS.map((card) => (
          <View key={card.title} style={[styles.page, { width: SCREEN_WIDTH }]}>
            <Animated.View entering={FadeIn.duration(320)} style={styles.iconRing}>
              <GrowIconTile
                name={card.icon as never}
                size={108}
                color={C.primaryText}
                face={C.primaryMuted}
                shape="circle"
              />
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(60).duration(320)} style={styles.eyebrow}>
              {card.eyebrow.toUpperCase()}
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(110).duration(320)} style={styles.title}>
              {card.title}
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(160).duration(320)} style={styles.body}>
              {card.body}
            </Animated.Text>
            {card.proof ? (
              <Animated.View entering={FadeInDown.delay(220).duration(320)} style={styles.proofRow}>
                <Ionicons name="checkmark-circle" size={15} color={C.primaryText} />
                <Text style={styles.proof}>{card.proof}</Text>
              </Animated.View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
          testID="showcase-next"
        >
          <Text style={styles.ctaText}>{isLast ? 'Try a session' : 'Next'}</Text>
          <Ionicons
            name={isLast ? 'play' : 'arrow-forward'}
            size={18}
            color={C.textInverse}
          />
        </Pressable>
        {isLast ? (
          <Text style={styles.footNote}>
            A short practice session, so you can see how it works. Nothing is logged.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
    dotActive: { width: 20, backgroundColor: C.primary },
    skip: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    // Layout only. GrowIconTile draws the disc, lit rather than flat-filled.
    iconRing: {
      width: 108,
      height: 108,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 26,
    },
    eyebrow: {
      fontSize: 11,
      letterSpacing: 1.1,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryText,
      marginBottom: 10,
      textAlign: 'center',
    },
    title: {
      fontSize: 26,
      lineHeight: 33,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      marginBottom: 14,
    },
    body: {
      fontSize: 15,
      lineHeight: 24,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
    },
    proofRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 22,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: C.primaryMuted,
    },
    proof: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Inter_500Medium',
      color: C.primaryText,
    },
    footer: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 17,
      borderRadius: 16,
      backgroundColor: C.primary,
    },
    ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.textInverse },
    footNote: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      textAlign: 'center',
    },
  });
}
