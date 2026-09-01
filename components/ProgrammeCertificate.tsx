/**
 * THE PROGRAMME, ISSUED.
 *
 * WHY IT IS PRINTED ON THE SAME PAPER AS A FINISHED SESSION
 * ────────────────────────────────────────────────────────
 * PAGE is the parchment the end-of-session recap and the summary certificate
 * are already drawn on, taken from the Grow logo's own mark-on-paper colouring.
 * Using it here was not a decorative choice. It means a programme is ISSUED on
 * the same paper a session is CERTIFIED on, so the first thing somebody is
 * handed and the thing they are handed after every workout belong to each
 * other. A one-off object invented for this screen would have been a flourish;
 * this is the app's existing language used at the other end of the journey.
 *
 * WHAT IT HAS TO ACHIEVE
 * ──────────────────────
 * This is the first moment anybody sees what they have actually bought, and
 * until now the app never said. It has four jobs, in this order:
 *
 *   1. HAND THEM SOMETHING. A named programme with a shape, not a settings
 *      summary. "Return to Lifting, twelve weeks, three days a week."
 *   2. SAY WHY THIS ONE, in their own answers. The app has just made a decision
 *      on their behalf and naming the cause is what separates a considered app
 *      from a black box.
 *   3. SHOW THE DOOR IS OPEN. Recovery work sits alongside the block and never
 *      costs them their place in it, and the other six programmes are theirs
 *      too. Somebody who thinks they have been locked into one thing will not
 *      explore, and the app is mostly things to explore.
 *   4. SAY WHAT COMES WITH IT. Every one of those features has existed for
 *      months and has never been listed anywhere a subscriber would read it.
 *
 * THE PAGE IS THE HERO AND EVERYTHING ELSE IS BELOW IT, on the app's own
 * background. Printing the feature list on the parchment too would turn a
 * certificate into a brochure.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useGoColors } from '@/constants/colors';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { PAGE } from '@/lib/session-identity';
import { SESSION_DISPLAY_NAMES, SESSION_TYPE_COUNT } from '@/lib/session-meta';
import { distinctExerciseCount } from '@/lib/exercise-db';
import { PAIN_ADAPTATION_REGION_COUNT } from '@/lib/store';
import {
  PROGRAMME_PROMISES,
  cycleOf,
  extrasOf,
  includedInGrow,
  otherProgrammes,
  programmeCareNote,
  programmeDifficulty,
  nameOf,
  programmeFor,
  programmeReasons,
  weeksFor,
  type EnrolledProgramme,
} from '@/lib/programme';
import type { TreeOutcome } from '@/lib/profile-tree';
import { bandLabel } from '@/lib/exercise-levels';

export interface ProgrammeCertificateProps {
  programme: EnrolledProgramme;
  outcome: TreeOutcome;
  /**
   * What the button says.
   *
   * "Take a tour" by default, because that is what happens next: the tabs open
   * on the tour intro for anybody who has not done it. It used to say "Start
   * training", which sent somebody who had just spent two minutes answering
   * questions straight past the explanation of everything they had just been
   * given. The hub passes its own label, because from there it just closes.
   */
  ctaLabel?: string;
  onContinue: () => void;
}

export function ProgrammeCertificate({
  programme,
  outcome,
  ctaLabel = 'Take a tour',
  onContinue,
}: ProgrammeCertificateProps) {
  const C = useColors();
  const go = useGoColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(C), [C]);

  const template = programmeFor(programme.templateId);
  const displayName = nameOf(programme);
  const cycle = cycleOf(programme);
  const extras = extrasOf(programme);
  const reasons = programmeReasons(outcome);
  const careNote = programmeCareNote(outcome);
  const others = otherProgrammes(programme.templateId);
  const difficulty = programmeDifficulty(programme.templateId, outcome.experience, programme.days, cycle);
  const weeks = weeksFor(programme.sessions, programme.days);

  // Once per mount. distinctExerciseCount walks the whole catalogue, and this is
  // the only screen outside the paywall that wants it.
  const included = useMemo(
    () =>
      includedInGrow({
        exercises: distinctExerciseCount(),
        painAreas: PAIN_ADAPTATION_REGION_COUNT,
        sessionTypes: SESSION_TYPE_COUNT,
      }),
    []
  );

  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  /**
   * The pager's own height, measured rather than inherited.
   *
   * alignSelf stretch and flexGrow on the content container both looked right
   * and neither worked: photographed on the exported build, the sheet still
   * sized to its own text and the short pages were small cards floating in
   * black. Measuring once on layout and setting the height is the version that
   * actually holds, on every page and both platforms.
   */
  const [pagerHeight, setPagerHeight] = useState(0);
  const pager = useRef<ScrollView>(null);

  /**
   * THE PAGES, AS DATA.
   *
   * Six of them, and the order is the order somebody asks the questions in:
   * what have I got, why this one, what will I actually do, what else can I do,
   * what comes with it, and what is still mine if I change my mind. Page one is
   * the topline and is the only one that has to land on its own - the rest are
   * read by anybody who wants them.
   */
  const pages: { key: string; label: string; body: React.ReactNode }[] = [
    {
      key: 'topline',
      label: 'Your programme',
      body: (
        <>
          <View style={styles.pageHead}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.mark}
              resizeMode="cover"
            />
            <Text style={styles.pageEyebrow}>YOUR PROGRAMME</Text>
          </View>

          <Text style={styles.name} testID="programme-name">
            {displayName}
          </Text>
          <Text style={styles.blurb}>{template.blurb}</Text>

          {/* The difficulty, named and justified in the same breath, with the
              rungs of the movement ladders it draws from. A label on its own
              invites the question; the line under it answers it, and the band
              is what makes the answer checkable rather than a claim. */}
          <View style={styles.difficultyRow} testID="programme-difficulty">
            <View style={styles.difficultyPill}>
              <Text style={styles.difficultyPillText}>{difficulty.label.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.difficultyWhy}>{difficulty.because}</Text>
              <Text style={styles.difficultyBand}>{bandLabel(difficulty.band)}, out of five.</Text>
            </View>
          </View>

          <View style={styles.rule} />

          <View style={styles.stats}>
            <Stat value={String(programme.sessions)} label="sessions" />
            <View style={styles.statDivide} />
            <Stat value={String(programme.days)} label="days a week" />
            <View style={styles.statDivide} />
            <Stat value={`~${weeks}`} label={weeks === 1 ? 'week' : 'weeks'} />
          </View>

          {!!careNote && (
            <View style={styles.care} testID="programme-care-note">
              <Ionicons name="alert-circle-outline" size={15} color={PAGE.warn} />
              <Text style={styles.careText}>{careNote}</Text>
            </View>
          )}
        </>
      ),
    },
    {
      key: 'why',
      label: 'Why this one',
      body: (
        <>
          <Text style={styles.pageEyebrow}>WHY THIS ONE</Text>
          <Text style={styles.pageTitle}>Built from what you said</Text>
          <View style={styles.rule} />
          {reasons.map((r) => (
            <View key={r} style={styles.reasonRow}>
              <Ionicons name="checkmark" size={13} color={PAGE.ink} style={styles.reasonTick} />
              <Text style={styles.reason}>{r}</Text>
            </View>
          ))}
        </>
      ),
    },
    {
      key: 'sessions',
      label: 'Your sessions',
      body: (
        <>
          <Text style={styles.pageEyebrow}>YOUR SESSIONS, IN ORDER</Text>
          <Text style={styles.pageTitle}>What you will actually do</Text>
          <View style={styles.rule} />
          <View style={styles.chips}>
            {cycle.map((t, i) => (
              <View key={`${t}-${i}`} style={styles.chip}>
                <Text style={styles.chipNo}>{i + 1}</Text>
                <Text style={styles.chipText}>{SESSION_DISPLAY_NAMES[t]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.chipNote}>
            It repeats until you have done all {programme.sessions}, {programme.days} of them a
            week. The block is counted in sessions, so it waits for you.
          </Text>

          {extras.length > 0 && (
            <>
              <Text style={[styles.pageEyebrow, styles.sectionGap]}>
                AND WHENEVER YOU WANT THEM
              </Text>
              <View style={styles.chips}>
                {extras.map((t) => (
                  <View key={t} style={[styles.chip, styles.chipOpen]}>
                    <Text style={styles.chipText}>{SESSION_DISPLAY_NAMES[t]}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.chipNote}>
                Rehab, mobility and conditioning sit alongside the block. Doing one never costs
                you your place in it.
              </Text>
            </>
          )}
        </>
      ),
    },
    {
      key: 'included',
      label: 'What comes with it',
      body: (
        <>
          <Text style={styles.pageEyebrow}>WHAT COMES WITH IT</Text>
          <Text style={styles.pageTitle}>All of it, from the first session</Text>
          <View style={styles.rule} />
          <View style={styles.includeList}>
            {included.map((f) => (
              <View key={f.title} style={styles.includeRow}>
                <View style={styles.includeDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.includeTitle}>{f.title}</Text>
                  <Text style={styles.includeBody}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ),
    },
    {
      key: 'others',
      label: 'The other programmes',
      body: (
        <View testID="other-programmes">
          <Text style={styles.pageEyebrow}>AND {String(others.length).toUpperCase()} MORE</Text>
          <Text style={styles.pageTitle}>Picking one locks nothing away</Text>
          <View style={styles.rule} />
          <Text style={styles.pageBody}>
            Switch whenever you like. Nothing you have logged is lost, and every session in Train
            stays open whether you are on a programme or not.
          </Text>
          <View style={styles.otherGrid}>
            {others.map((p) => (
              <View key={p.id} style={styles.other}>
                <Text style={styles.otherName}>{p.name}</Text>
                <Text style={styles.otherBlurb} numberOfLines={3}>
                  {p.blurb}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'promises',
      label: 'Three things to know',
      body: (
        <View testID="programme-promises">
          <Text style={styles.pageEyebrow}>BEFORE YOU START</Text>
          <Text style={styles.pageTitle}>Three things to know</Text>
          <View style={styles.rule} />
          <View style={styles.promises}>
            {PROGRAMME_PROMISES.map((p, i) => (
              <View key={p.title} style={styles.promise}>
                <Text style={styles.promiseNo}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.promiseTitle}>{p.title}</Text>
                  <Text style={styles.promiseBody}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ),
    },
  ];

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const w = e.nativeEvent.layoutMeasurement.width || 1;
      const i = Math.round(e.nativeEvent.contentOffset.x / w);
      setPage((prev) => (prev === i ? prev : i));
    },
    []
  );

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(pages.length - 1, i));
      pager.current?.scrollTo({ x: next * width, animated: !reduceMotion });
      setPage(next);
    },
    [pages.length, reduceMotion, width]
  );

  const last = page >= pages.length - 1;

  return (
    <View style={styles.root}>
      <View style={[styles.bookHead, { paddingTop: insets.top + 14 }]}>
        <Animated.Text
          entering={reduceMotion ? undefined : FadeIn.duration(320)}
          style={styles.issued}
        >
          BUILT FROM YOUR ANSWERS
        </Animated.Text>
      </View>

      {/**
       * A BOOKLET, NOT A SCROLL.
       *
       * Everything here used to be one column two and a half screens tall, and
       * the reading of it was "a lot of scrolling" - which is fair, because the
       * five sections have nothing to do with each other except that they are
       * all about the same programme. As pages they are five short reads with a
       * beginning and an end, and the first one carries the whole answer on its
       * own for anybody who wants only that.
       */}
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
        onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
        testID="programme-booklet"
      >
        {pages.map((p, i) => (
          <View
            key={p.key}
            style={{ width, paddingHorizontal: 18, height: pagerHeight || undefined }}
          >
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(60).duration(420)}
              style={styles.page}
              testID={i === 0 ? 'programme-certificate' : `booklet-page-${p.key}`}
            >
              {/* Each page scrolls inside itself. The longest of them is seven
                  features and it does not fit a small phone, and a booklet whose
                  pages silently clip is worse than one you scroll a little. */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pageInner}
              >
                {p.body}
              </ScrollView>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bookFoot}>
        <View style={styles.dots}>
          {pages.map((p, i) => (
            <Pressable
              key={p.key}
              onPress={() => goTo(i)}
              hitSlop={10}
              testID={`booklet-dot-${i}`}
              accessibilityRole="button"
              accessibilityLabel={p.label}
            >
              <View style={[styles.dot, i === page && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.pageLabel} numberOfLines={1}>
          {last ? pages[page].label : `${pages[page].label} · swipe for more`}
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={onContinue}
          testID="certificate-continue"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: go.fill },
            pressed && { opacity: 0.88 },
          ]}
        >
          <Text style={[styles.ctaText, { color: go.on }]}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={18} color={go.on} />
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={statStyles.wrap}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  value: { fontSize: 26, fontFamily: 'Inter_700Bold', color: PAGE.ink, letterSpacing: -0.6 },
  label: {
    fontSize: 10.5,
    fontFamily: 'Inter_500Medium',
    color: PAGE.inkMuted,
    marginTop: 1,
    letterSpacing: 0.4,
  },
});

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 18 },

    issued: {
      fontSize: 10.5,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1.5,
      color: C.textTertiary,
      textAlign: 'center',
      marginBottom: 14,
    },

    // ── the parchment ──────────────────────────────────────────────────
    page: {
      // flex: 1 rather than growing to its content. Every page is the same
      // sheet of paper, which is most of what makes six cards read as one
      // booklet rather than six cards.
      flex: 1,
      backgroundColor: PAGE.bg,
      borderRadius: 20,
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 18,
      borderWidth: 1,
      borderColor: PAGE.bgEdge,
    },
    pageHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    mark: { width: 30, height: 30, borderRadius: 8 },
    pageEyebrow: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1.4,
      color: PAGE.inkFaint,
    },
    name: {
      fontSize: 32,
      lineHeight: 36,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      letterSpacing: -0.9,
    },
    blurb: {
      fontSize: 14.5,
      lineHeight: 20,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
      marginTop: 7,
    },

    difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
    difficultyPill: {
      paddingHorizontal: 10,
      paddingVertical: 4.5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: PAGE.hairline,
      backgroundColor: PAGE.inset,
    },
    difficultyPillText: {
      fontSize: 10.5,
      letterSpacing: 1,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
    },
    difficultyWhy: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
    },
    difficultyBand: {
      fontSize: 11,
      lineHeight: 15,
      fontFamily: 'Inter_600SemiBold',
      color: PAGE.inkMuted,
      marginTop: 1,
    },

    rule: { height: 1, backgroundColor: PAGE.hairline, marginVertical: 18 },

    stats: { flexDirection: 'row', alignItems: 'center' },
    statDivide: { width: 1, height: 30, backgroundColor: PAGE.hairline },

    sectionLabel: {
      fontSize: 9.5,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1.3,
      color: PAGE.inkFaint,
      marginBottom: 9,
    },
    sectionGap: { marginTop: 20 },

    reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
    reasonTick: { marginTop: 2 },
    reason: {
      flex: 1,
      fontSize: 13.5,
      lineHeight: 19,
      fontFamily: 'Inter_500Medium',
      color: PAGE.ink,
    },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 9,
      backgroundColor: PAGE.inset,
      borderWidth: 1,
      borderColor: PAGE.hairline,
    },
    chipOpen: { backgroundColor: 'transparent', borderStyle: 'dashed' },
    chipNo: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      color: PAGE.inkFaint,
    },
    chipText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: PAGE.ink },
    chipNote: {
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkFaint,
      marginTop: 8,
    },

    care: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 18,
      padding: 12,
      borderRadius: 10,
      backgroundColor: PAGE.inset,
      borderLeftWidth: 3,
      borderLeftColor: PAGE.warn,
    },
    careText: {
      flex: 1,
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Inter_500Medium',
      color: PAGE.warn,
    },

    /**
     * ON THE PARCHMENT NOW, so these read PAGE ink rather than app ink.
     *
     * These three blocks used to live below the page on the app's own dark
     * ground, and moving them into the booklet without restyling them put white
     * body text on cream paper. Photographed, unreadable, and the sort of thing
     * that is obvious in a screenshot and invisible in a diff.
     */
    includeList: { marginTop: 14, gap: 13 },
    includeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    includeDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: PAGE.ink,
      marginTop: 6,
    },
    includeTitle: { fontSize: 14.5, fontFamily: 'Inter_700Bold', color: PAGE.ink },
    includeBody: {
      fontSize: 12.5,
      lineHeight: 17.5,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
      marginTop: 2,
    },

    otherGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    other: {
      width: '48.4%',
      padding: 12,
      borderRadius: 12,
      backgroundColor: PAGE.inset,
      borderWidth: 1,
      borderColor: PAGE.hairline,
    },
    otherName: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: PAGE.ink },
    otherBlurb: {
      fontSize: 11.5,
      lineHeight: 15.5,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
      marginTop: 3,
    },

    promises: { marginTop: 14, gap: 14 },
    promise: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    promiseNo: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: PAGE.inset,
      color: PAGE.ink,
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      textAlign: 'center',
      lineHeight: 24,
      overflow: 'hidden',
    },
    promiseTitle: { fontSize: 14.5, fontFamily: 'Inter_700Bold', color: PAGE.ink },
    promiseBody: {
      fontSize: 12.5,
      lineHeight: 17.5,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
      marginTop: 2,
    },

    bookHead: { paddingHorizontal: 18, paddingBottom: 12 },
    pager: { flex: 1 },
    pageInner: { paddingBottom: 6 },
    pageTitle: {
      fontSize: 24,
      lineHeight: 29,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      letterSpacing: -0.6,
      marginTop: 4,
    },
    pageBody: {
      fontSize: 13.5,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
    },

    bookFoot: { alignItems: 'center', gap: 7, paddingTop: 14, paddingBottom: 4 },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: C.border,
    },
    dotOn: { backgroundColor: C.primaryText, width: 20 },
    pageLabel: {
      fontSize: 11.5,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      letterSpacing: 0.2,
    },

    footer: {
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.background,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: 16,
    },
    ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  });
}
