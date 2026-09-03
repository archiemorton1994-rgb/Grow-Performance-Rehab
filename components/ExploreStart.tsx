/**
 * THE ENDING FOR SOMEBODY WHO SAID "let me explore".
 *
 * The builder's other ending is ProgrammeCertificate, which issues a named
 * block and is entirely about that block. Handing that document to somebody who
 * has just declined a programme would be the app not listening, so this is the
 * other half of the fork.
 *
 * IT IS NOT A CONSOLATION PRIZE, and the copy works hard not to read as one.
 * Choosing your own sessions is not choosing less: every session is still built
 * from the same profile, the same movement screen, the same injuries and the
 * same kit. The difference is who picks which one. So the card leads with what
 * has been set up FOR them - the same tuning a programme user got - and then
 * says where to go.
 *
 * SAME PAPER AS THE CERTIFICATE. One builder, one ending, two contents. A
 * different visual language here would make the choice feel like two different
 * apps, and the person who explored would be the one holding the cheaper one.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PAGE } from '@/lib/session-identity';
import { GO } from '@/lib/go-colors';
import { bandLabel } from '@/lib/exercise-levels';
import { levelBandForExperience } from '@/lib/programme';
import type { TreeOutcome } from '@/lib/profile-tree';

/** The certificate's own green, which is the light half of GO: this document is
 *  printed on parchment in both themes, so it does not follow the app theme. */
const CERT_GREEN = GO.light.fill;

interface Props {
  outcome: TreeOutcome;
  onContinue: () => void;
}

/** What the app has actually tuned, in the order somebody would ask about it. */
function whatIsSetUp(outcome: TreeOutcome): { icon: string; title: string; body: string }[] {
  const out: { icon: string; title: string; body: string }[] = [];

  const band = levelBandForExperience(outcome.experience, 0);
  /**
   * `screenPassed` is null when the screen was never taken and an ARRAY when it
   * was, including an empty one. The first version tested `length >= 0`, which
   * is true of every array and told somebody who had skipped the question that
   * their movements were set from it. Photographing the walk caught it.
   */
  const tookScreen = Array.isArray(outcome.screenPassed);
  out.push({
    icon: 'barbell-outline',
    title: 'Your movements',
    body: tookScreen
      ? `Set from what you told us you can do right now, rather than from a guess. ${bandLabel(band)}, out of five.`
      : `${bandLabel(band)}, out of five, from how long you have been training. Take the movement check any time to make it more exact.`,
  });

  if (outcome.equipmentTiers.length > 0) {
    out.push({
      icon: 'cube-outline',
      title: 'Your kit',
      body:
        outcome.maxKitKg > 0
          ? 'Every session is built from what you have, and nothing is ever prescribed heavier than the weight you can pick up.'
          : 'Every session is built from what you have. You are asked again before each one, so a day without the gym just builds a different session.',
    });
  }

  if (outcome.soreRegions.length > 0 || outcome.avoidRegions.length > 0) {
    out.push({
      icon: 'shield-checkmark-outline',
      title: 'What we work around',
      body:
        'The areas you named are avoided in every session, whether or not they hurt on the day. You can change them any time in your profile.',
    });
  }

  out.push({
    icon: 'trending-up-outline',
    title: 'Your weights',
    body: 'They climb when you finish a session cleanly and hold when you do not, whichever sessions you choose.',
  });

  return out;
}

const NEXT: { icon: string; title: string; body: string }[] = [
  {
    icon: 'flash-outline',
    title: 'Start any session',
    body: 'Upper, lower, full body, conditioning, prehab or a stretch. Pick one and it is built for you.',
  },
  {
    icon: 'construct-outline',
    title: 'Or build your own',
    body: 'Choose the exercises yourself and the app still sets the weights and the reps.',
  },
  {
    icon: 'layers-outline',
    title: 'A programme, whenever you want one',
    body: 'Seven of them are waiting in Train, and starting one costs you nothing you have already done.',
  },
];

export function ExploreStart({ outcome, onContinue }: Props) {
  const setUp = whatIsSetUp(outcome);

  return (
    <View style={styles.screen} testID="explore-start">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator
        bounces={false}
      >
        <View style={styles.sheet}>
          <LinearGradient
            colors={[PAGE.bg, PAGE.bgEdge]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.head}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.mark}
              resizeMode="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>SET UP FOR</Text>
              <Text style={styles.name} numberOfLines={1}>
                {outcome.name || 'You'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>You are ready to train</Text>
          <Text style={styles.blurb}>
            No programme, so nothing is chosen for you. Everything below is set up all the same,
            and every session you pick uses it.
          </Text>

          <View style={styles.rule} />

          {setUp.map((r) => (
            <View key={r.title} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={r.icon as never} size={17} color={CERT_GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowBody}>{r.body}</Text>
              </View>
            </View>
          ))}

          <View style={styles.rule} />
          <Text style={styles.sectionLabel}>WHERE TO START</Text>

          {NEXT.map((r) => (
            <View key={r.title} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={r.icon as never} size={17} color={CERT_GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onContinue}
          testID="explore-start-continue"
          accessibilityRole="button"
          accessibilityLabel="Start exploring"
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>Start exploring</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  // Room under the last row so it does not end mid-sentence against the button,
  // which reads as a clipped layout rather than as more to scroll.
  scroll: { padding: 16, paddingBottom: 28 },
  sheet: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PAGE.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  mark: { width: 40, height: 40, borderRadius: 20 },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
    color: PAGE.inkFaint,
  },
  name: { fontSize: 17, fontFamily: 'Inter_700Bold', color: PAGE.ink },
  title: { fontSize: 25, fontFamily: 'Inter_700Bold', color: PAGE.ink, marginBottom: 6 },
  blurb: { fontSize: 14, fontFamily: 'Inter_400Regular', color: PAGE.inkMuted, lineHeight: 20 },
  rule: { height: 1, backgroundColor: PAGE.hairline, marginVertical: 16 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
    color: PAGE.inkFaint,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PAGE.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold', color: PAGE.ink },
  rowBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: PAGE.inkMuted,
    lineHeight: 18.5,
    marginTop: 2,
  },
  footer: { padding: 16, paddingTop: 8 },
  cta: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: CERT_GREEN,
  },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
