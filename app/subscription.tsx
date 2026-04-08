import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useColors } from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';
import { getApiUrl } from '@/lib/query-client';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

const FEATURES = [
  { icon: 'barbell-outline' as const, title: 'Personalised session programming', desc: 'Loads adapted to your strength and goals' },
  { icon: 'body-outline' as const, title: '11-region pain adaptation', desc: 'Smart exercise swaps around your pain zones' },
  { icon: 'trending-up-outline' as const, title: 'Progress tracking & strength tests', desc: 'Monitor your 1RM progress over time' },
];

const INCLUDED_ITEMS = [
  'Unlimited sessions across all 6 session types',
  '5 equipment tiers — bodyweight to full gym',
  'Per-set weight logging with auto-progression',
  'Per-exercise load tracking across sessions',
  'Strength test weeks with 1RM tracking',
  'Pain-aware exercise swaps (11 body regions)',
  'Readiness-adjusted volume every session',
  'Session resume — pick up where you left off',
];

function getLegalUrls() {
  try {
    const base = getApiUrl().replace(/\/$/, '');
    return { privacyUrl: `${base}/privacy`, termsUrl: `${base}/terms` };
  } catch {
    return { privacyUrl: 'https://growperformance.app/privacy', termsUrl: 'https://growperformance.app/terms' };
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

  const { privacyUrl, termsUrl } = useMemo(() => getLegalUrls(), []);

  const fetchOffering = useCallback(async () => {
    if (!RC_API_KEY) {
      setLoadingOffering(false);
      return;
    }
    setLoadingOffering(true);
    setOfferingError(false);
    try {
      const offerings = await Purchases.getOfferings();
      const monthly = offerings.current?.monthly ?? offerings.current?.availablePackages[0] ?? null;
      setOffering(monthly);
      if (!monthly) setOfferingError(true);
    } catch {
      setOffering(null);
      setOfferingError(true);
    } finally {
      setLoadingOffering(false);
    }
  }, []);

  useEffect(() => { fetchOffering(); }, [fetchOffering]);

  const handlePurchase = useCallback(async () => {
    if (!RC_API_KEY) {
      await refreshSubscription();
      return;
    }
    if (!offering) {
      Alert.alert('Unavailable', 'No subscription package found. Please try again later.');
      return;
    }
    setPurchasing(true);
    try {
      await Purchases.purchasePackage(offering);
      await refreshSubscription();
    } catch (err: unknown) {
      const rcErr = err as { userCancelled?: boolean; message?: string };
      if (!rcErr?.userCancelled) {
        Alert.alert('Purchase failed', rcErr?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [offering, refreshSubscription]);

  const handleRestore = useCallback(async () => {
    if (!RC_API_KEY) return;
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await refreshSubscription();
    } catch {
      Alert.alert('Restore failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [refreshSubscription]);

  const priceString = offering?.product?.priceString ?? '£7.99';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('@/assets/images/logo.jpeg')}
          style={styles.logoImage}
          resizeMode="cover"
        />

        <Text style={styles.headline}>Everything you need{'\n'}to train smarter</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.includedCard}>
          <Text style={styles.includedTitle}>What's included</Text>
          {INCLUDED_ITEMS.map((item) => (
            <View key={item} style={styles.includedRow}>
              <Ionicons name="checkmark-circle" size={16} color={C.primary} style={{ marginTop: 1 }} />
              <Text style={styles.includedText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planCard}>
          <View style={styles.planCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>Grow Monthly</Text>
              {loadingOffering
                ? <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 4 }} />
                : offeringError
                  ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>Price unavailable</Text>
                      <Pressable onPress={fetchOffering} style={{ backgroundColor: C.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary }}>Retry</Text>
                      </Pressable>
                    </View>
                  )
                  : <Text style={styles.planPrice}>{priceString}<Text style={styles.planPer}> / month</Text></Text>
              }
            </View>
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>14-day free trial</Text>
            </View>
          </View>
          <Text style={styles.planSub}>Try free for 14 days, then {priceString}/month. Cancel anytime.</Text>
        </View>

        <Pressable
          onPress={handlePurchase}
          disabled={purchasing || (!!RC_API_KEY && !offering && !loadingOffering)}
          style={[styles.ctaBtn, (purchasing) && styles.ctaBtnLoading]}
          testID="subscribe-cta"
        >
          {purchasing
            ? <ActivityIndicator color={C.textInverse} />
            : <Text style={styles.ctaBtnText}>Start 14-Day Free Trial</Text>
          }
        </Pressable>

        <Pressable
          onPress={handleRestore}
          disabled={restoring}
          style={styles.restoreBtn}
          testID="restore-purchases"
        >
          <Text style={styles.restoreText}>
            {restoring ? 'Restoring...' : 'Restore Purchases'}
          </Text>
        </Pressable>

        <Text style={styles.legal}>
          {'By continuing you agree to our '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(termsUrl)}>
            Terms of Service
          </Text>
          {' and '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(privacyUrl)}>
            Privacy Policy
          </Text>
          {'. Subscription renews at '}
          {priceString}
          {'/month unless cancelled at least 24 hours before the end of the current period.'}
        </Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24, paddingTop: 24 },

  logoImage: {
    width: 96, height: 96, borderRadius: 48,
    marginBottom: 28,
  },

  headline: {
    fontSize: 30, fontFamily: 'Inter_700Bold', color: C.text,
    lineHeight: 38, marginBottom: 28,
  },

  features: { gap: 16, marginBottom: 28 },
  featureRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.borderLight,
  },
  featureIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.primaryMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 },
  featureDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  includedCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: C.borderLight, marginBottom: 20, gap: 10,
  },
  includedTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  includedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  includedText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text, lineHeight: 20 },

  planCard: {
    backgroundColor: C.surface, borderRadius: 18, padding: 20,
    borderWidth: 2, borderColor: C.primary, marginBottom: 20,
  },
  planCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginBottom: 2 },
  planPrice: { fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text },
  planPer: { fontSize: 15, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  trialBadge: {
    backgroundColor: C.primaryMuted, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  trialBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
  planSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary },

  ctaBtn: {
    height: 58, borderRadius: 18, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  ctaBtnLoading: { opacity: 0.7 },
  ctaBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.textInverse },

  restoreBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 20 },
  restoreText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },

  legal: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary,
    textAlign: 'center', lineHeight: 16,
  },
  legalLink: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary,
    textDecorationLine: 'underline',
  },
}); }
