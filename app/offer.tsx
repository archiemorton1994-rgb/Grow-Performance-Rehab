import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  type PurchasesPackage,
} from 'react-native-purchases';
import { useColors } from '@/constants/colors';
import { useAppStore } from '@/lib/store';
import { configureRevenueCat } from '@/lib/auth-context';
import { periodWordsFor, getTrialText } from '@/lib/subscription-period';
import { GrowIconTile } from '@/components/GrowIcon';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

/**
 * THE MOMENT BETWEEN SEEING THE APP AND BEING ASKED TO PAY FOR IT.
 *
 * WHY IT ASKS THE STORE RATHER THAN SAYING "THE FIRST 14 DAYS ARE ON US"
 * ─────────────────────────────────────────────────────────────────────
 * That sentence lived on the onboarding celebration screen for a long time and
 * was removed, because Apple grants an introductory offer once per APPLE ID and
 * not once per Grow account. A returning user, or anyone on a second phone, read
 * it and then met a paywall whose button said only "Subscribe". They believed
 * they had signed up for a free fortnight and saw a charge the same day.
 *
 * The claim is a good one. It just has to be true of the person reading it. So
 * this screen does what the paywall does: it asks the store whether THIS Apple
 * ID is still eligible, and what the offer actually is, and then says so. If the
 * answer is fourteen days, it says fourteen days. If it is seven, it says seven.
 * If this Apple ID has used it, the screen says something else honest rather
 * than promising a gift that will not arrive.
 *
 * getTrialText is the same function the paywall uses, so the two cannot drift.
 */
export default function OfferScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);
  const setShowcaseComplete = useAppStore((s) => s.setShowcaseComplete);

  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!RC_API_KEY) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        await configureRevenueCat();
        const offerings = await Purchases.getOfferings();
        const found =
          offerings.current?.monthly ?? offerings.current?.availablePackages[0] ?? null;
        if (cancelled) return;
        setPkg(found);
        if (found?.product?.identifier) {
          try {
            const check = await Purchases.checkTrialOrIntroductoryPriceEligibility([
              found.product.identifier,
            ]);
            const status = check[found.product.identifier]?.status;
            if (!cancelled) {
              setEligible(
                status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
              );
            }
          } catch {
            // Anything other than a clear yes leaves the honest wording in place.
            if (!cancelled) setEligible(false);
          }
        }
      } catch {
        if (!cancelled) setPkg(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trial = getTrialText(pkg, eligible);
  const period = periodWordsFor(pkg);
  const price = pkg?.product?.priceString ?? '';

  /**
   * MARKED SEEN HERE, NOT ON MOUNT.
   *
   * On mount looked tidier and broke the screen. The gate exempts this route
   * only while the showcase is unseen, so setting the flag as it opened made
   * the exemption stop applying in the same tick and the gate replaced this
   * screen with the paywall before anybody read a word of it. Found by
   * screenshotting the production bundle, not by reading the code.
   *
   * The cost of doing it here is that somebody who closes the app on this
   * screen sees the showcase again, which is the right way round to be wrong.
   */
  const onContinue = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowcaseComplete(true);
    router.replace('/subscription' as never);
  }, [setShowcaseComplete]);

  const hasTrial = trial.badge.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.middle}>
        <Animated.View entering={FadeInDown.duration(360)} style={styles.ring}>
          <GrowIconTile
            name={hasTrial ? 'gift' : 'sparkle'}
            size={112}
            color={C.primaryText}
            face={C.primaryMuted}
            shape="circle"
          />
        </Animated.View>

        {loading ? (
          <ActivityIndicator color={C.primaryText} style={{ marginTop: 28 }} />
        ) : (
          <>
            <Animated.Text entering={FadeInDown.delay(80).duration(360)} style={styles.title}>
              {hasTrial
                ? trial.offerHeadline
                : 'That is Grow'}
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(140).duration(360)} style={styles.body}>
              {hasTrial
                ? 'Everything you have just seen, free to use. Cancel any time before it ends and you will not be charged.'
                : 'Everything you have just seen, for what is on the next screen. Cancel any time.'}
            </Animated.Text>
            {price ? (
              <Animated.Text entering={FadeInDown.delay(200).duration(360)} style={styles.price}>
                {hasTrial ? 'Then ' : ''}
                {price}
                {period.per ? ` / ${period.per}` : ''}
              </Animated.Text>
            ) : null}
          </>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
          testID="offer-continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={C.textInverse} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 28 },
    middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Layout only. GrowIconTile draws the disc.
    ring: {
      width: 112,
      height: 112,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 30,
    },
    title: {
      fontSize: 29,
      lineHeight: 35,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      marginBottom: 14,
    },
    body: {
      fontSize: 15.5,
      lineHeight: 24,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
    },
    price: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: 18,
    },
    footer: { paddingTop: 12 },
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
  });
}
