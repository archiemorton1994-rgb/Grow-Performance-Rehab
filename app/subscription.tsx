import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useColors } from '@/constants/colors';
import { useAuth, configureRevenueCat } from '@/lib/auth-context';
import { EXERCISE_COUNT } from '@/lib/exercise-db';
import { PAIN_ADAPTATION_REGION_COUNT } from '@/lib/store';
import { SESSION_TYPE_COUNT } from '@/lib/session-meta';
import { getApiUrl } from '@/lib/query-client';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

const STATS = [
  { value: `${EXERCISE_COUNT}+`, label: 'exercises' },
  { value: `${SESSION_TYPE_COUNT}`, label: 'session types' },
  { value: `${PAIN_ADAPTATION_REGION_COUNT}`, label: 'pain zones' },
];

const BULLETS: { icon: 'checkmark-circle' | 'checkmark-circle-outline'; text: string }[] = [
  { icon: 'checkmark-circle', text: 'Smart session programming' },
  { icon: 'checkmark-circle', text: 'Automatic weight progression' },
  { icon: 'checkmark-circle', text: `${PAIN_ADAPTATION_REGION_COUNT}-region pain adaptation` },
  { icon: 'checkmark-circle', text: 'Milestone achievements' },
  { icon: 'checkmark-circle', text: 'Strength 1RM tracking' },
  { icon: 'checkmark-circle', text: 'Session resume' },
];

function getTrialText(pkg: PurchasesPackage | null): { badge: string; cta: string; sub: string } {
  const intro = pkg?.product?.introPrice;
  if (intro && intro.price === 0 && intro.periodNumberOfUnits > 0) {
    const n = intro.periodNumberOfUnits;
    const unit = (intro.periodUnit as string).toUpperCase();
    let period = `${n}-day`;
    if (unit === 'WEEK') period = n === 1 ? '1-week' : `${n}-week`;
    else if (unit === 'MONTH') period = n === 1 ? '1-month' : `${n}-month`;
    else if (unit === 'YEAR') period = n === 1 ? '1-year' : `${n}-year`;
    return {
      badge: `${period} free trial`,
      cta: `Start ${period.charAt(0).toUpperCase() + period.slice(1)} Free Trial`,
      sub: `Try free for ${period.replace('-', ' ')}, then`,
    };
  }
  return {
    badge: '14-day free trial',
    cta: 'Start 14-Day Free Trial',
    sub: 'Try free for 14 days, then',
  };
}

function getLegalUrls() {
  try {
    const base = getApiUrl().replace(/\/$/, '');
    return { privacyUrl: `${base}/privacy`, termsUrl: `${base}/terms` };
  } catch {
    return {
      privacyUrl: 'https://growperformance.app/privacy',
      termsUrl: 'https://growperformance.app/terms',
    };
  }
}

export default function SubscriptionScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { refreshSubscription } = useAuth();
  const webTop = Platform.OS === 'web' ? 67 : 0;

  const [offering, setOffering] = useState<PurchasesPackage | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(true);
  const [offeringError, setOfferingError] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { privacyUrl, termsUrl } = useMemo(() => getLegalUrls(), []);

  const fetchOffering = useCallback(async () => {
    if (!RC_API_KEY) {
      setLoadingOffering(false);
      return;
    }
    setLoadingOffering(true);
    setOfferingError(false);
    try {
      await configureRevenueCat();
      const offerings = await Purchases.getOfferings();
      const monthly = offerings.current?.monthly ?? offerings.current?.availablePackages[0] ?? null;
      setOffering(monthly);
      if (!monthly) setOfferingError(true);
    } catch (e) {
      if (__DEV__) console.warn('[Subscription] getOfferings failed:', e);
      setOffering(null);
      setOfferingError(true);
    } finally {
      setLoadingOffering(false);
    }
  }, []);

  useEffect(() => {
    fetchOffering();
  }, [fetchOffering]);

  const handlePurchase = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setErrorMsg('');

    if (!RC_API_KEY || __DEV__) {
      await refreshSubscription();
      return;
    }

    if (loadingOffering) return;

    if (!offering) {
      setErrorMsg('Could not connect to the App Store. Tap "Retry" below to try again.');
      return;
    }

    setPurchasing(true);
    try {
      await Purchases.purchasePackage(offering);
      await refreshSubscription();
    } catch (err: unknown) {
      const rcErr = err as { userCancelled?: boolean; message?: string; code?: number };
      if (__DEV__) console.warn('[Subscription] purchasePackage error:', rcErr);
      if (!rcErr?.userCancelled) {
        setErrorMsg(rcErr?.message ?? 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [offering, loadingOffering, refreshSubscription]);

  const handleRestore = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!RC_API_KEY) return;
    setErrorMsg('');
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await refreshSubscription();
    } catch {
      setErrorMsg('Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [refreshSubscription]);

  const priceString = offering?.product?.priceString ?? '';
  const trialText = getTrialText(offering);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTop + 16,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16),
        },
      ]}
    >
      {/* Header — logo + wordmark + tagline */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          resizeMode="cover"
        />
        <View style={styles.headerText}>
          <Text style={styles.wordmark}>GROW</Text>
          <Text style={styles.tagline}>Performance & Rehab</Text>
        </View>
      </View>

      {/* Headline */}
      <Text style={styles.headline}>Everything you need{'\n'}to train smarter</Text>

      {/* Stat chips */}
      <View style={styles.statsRow}>
        {STATS.map((s) => (
          <View key={s.label} style={styles.statChip}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Feature bullets — 2-column grid */}
      <View style={styles.bulletsGrid}>
        {BULLETS.map((b) => (
          <View key={b.text} style={styles.bulletRow}>
            <Ionicons name={b.icon} size={15} color={C.primary} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>{b.text}</Text>
          </View>
        ))}
      </View>

      {/* Pricing card */}
      <View style={styles.planCard}>
        <View style={styles.planCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>Grow Monthly</Text>
            {loadingOffering ? (
              <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 4 }} />
            ) : offeringError ? (
              <View style={styles.retryRow}>
                <Text style={styles.priceUnavail}>Price unavailable</Text>
                <Pressable onPress={fetchOffering} testID="offerings-retry" style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.planPrice}>
                {priceString}
                <Text style={styles.planPer}> / month</Text>
              </Text>
            )}
          </View>
          <View style={styles.trialBadge}>
            <Text style={styles.trialBadgeText}>{trialText.badge}</Text>
          </View>
        </View>
        <Text style={styles.planSub}>
          {trialText.sub} {priceString ? `${priceString}/month` : 'the standard rate'}. Cancel
          anytime.
        </Text>
      </View>

      {/* Error message */}
      {errorMsg ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color={C.error} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* CTA */}
      <Pressable
        onPress={handlePurchase}
        disabled={purchasing}
        style={({ pressed }) => [
          styles.ctaBtn,
          purchasing && styles.ctaBtnLoading,
          pressed && styles.ctaBtnPressed,
        ]}
        testID="subscribe-cta"
      >
        {purchasing ? (
          <ActivityIndicator color={C.textInverse} />
        ) : (
          <Text style={styles.ctaBtnText}>{trialText.cta}</Text>
        )}
      </Pressable>

      {/* Footer: restore + legal in one row */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleRestore}
          disabled={restoring}
          hitSlop={8}
          testID="restore-purchases"
        >
          <Text style={styles.footerLink}>{restoring ? 'Restoring…' : 'Restore'}</Text>
        </Pressable>
        <Text style={styles.footerDot}>·</Text>
        <Text
          style={styles.footerLink}
          testID="legal-terms"
          onPress={() => Linking.openURL(termsUrl)}
        >
          Terms
        </Text>
        <Text style={styles.footerDot}>·</Text>
        <Text
          style={styles.footerLink}
          testID="legal-privacy"
          onPress={() => Linking.openURL(privacyUrl)}
        >
          Privacy
        </Text>
      </View>

      {/* Sub-legal auto-renew notice */}
      <Text style={styles.legalSmall}>
        {priceString
          ? `Renews at ${priceString}/month unless cancelled 24 hrs before period end.`
          : 'Auto-renews monthly unless cancelled at least 24 hours before period end.'}
      </Text>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
      paddingHorizontal: 24,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 12,
    },
    headerText: { flex: 1 },
    wordmark: {
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
      color: C.primary,
      letterSpacing: 2,
    },
    tagline: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },

    headline: {
      fontSize: 26,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      lineHeight: 33,
      marginBottom: 16,
    },

    // Stat chips
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statChip: {
      flex: 1,
      backgroundColor: C.primarySurface,
      borderRadius: 12,
      paddingVertical: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    statValue: {
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: C.primary,
    },
    statLabel: {
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
      color: C.primary,
      marginTop: 1,
      opacity: 0.8,
    },

    // Bullets
    bulletsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 0,
      marginBottom: 16,
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.borderLight,
      paddingHorizontal: 14,
      paddingVertical: 12,
      rowGap: 10,
      columnGap: 4,
    },
    bulletRow: {
      width: '50%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingRight: 8,
    },
    bulletIcon: { flexShrink: 0 },
    bulletText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.text,
      flex: 1,
    },

    // Pricing card
    planCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 2,
      borderColor: C.primary,
      marginBottom: 12,
    },
    planCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    planName: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginBottom: 2,
    },
    planPrice: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },
    planPer: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    trialBadge: {
      backgroundColor: C.primaryMuted,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    trialBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary },
    planSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },

    retryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    priceUnavail: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    retryBtn: {
      backgroundColor: C.primaryMuted,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    retryBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },

    // Error
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 8,
    },
    errorText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.error, flex: 1 },

    // CTA
    ctaBtn: {
      height: 52,
      borderRadius: 16,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    ctaBtnLoading: { opacity: 0.7 },
    ctaBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    ctaBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.textInverse },

    // Footer
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    footerLink: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    footerDot: {
      fontSize: 13,
      color: C.textTertiary,
    },
    legalSmall: {
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      textAlign: 'center',
      lineHeight: 14,
    },
  });
}
