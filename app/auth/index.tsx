import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OtpAuthScreen() {
  const insets = useSafeAreaInsets();
  const { requestCode, verifyCode } = useAuth();
  const webTop = Platform.OS === 'web' ? 67 : 0;

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const codeRef = useRef<TextInput>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const codeValid = code.trim().length === 6;

  const handleSendCode = async () => {
    if (!emailValid || loading) return;
    setLoading(true);
    try {
      const result = await requestCode(email.trim());
      setDevCode(result.devCode);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 150);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send code. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = useCallback(async () => {
    if (!codeValid || loading) return;
    setLoading(true);
    try {
      await verifyCode(email.trim(), code.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Incorrect code. Please try again.';
      setCode('');
      Alert.alert('Invalid code', msg);
      setLoading(false);
    }
  }, [codeValid, loading, verifyCode, email, code]);

  useEffect(() => {
    if (step === 'code' && code.length === 6 && !loading) {
      handleVerifyCode();
    }
  }, [step, code, loading, handleVerifyCode]);

  const handleResend = async () => {
    setCode('');
    setDevCode(undefined);
    setLoading(true);
    try {
      const result = await requestCode(email.trim());
      setDevCode(result.devCode);
      if (!result.devCode) {
        Alert.alert('Code sent', 'A new code has been sent to your email.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resend code.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + webTop + 24, paddingBottom: insets.bottom + 48 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('@/assets/images/logo.jpeg')}
          style={styles.logoImage}
          resizeMode="cover"
        />

        {step === 'email' ? (
          <>
            <Text style={styles.heading}>Sign in to Grow</Text>
            <Text style={styles.sub}>
              Enter your email and we{'\u2019'}ll send you a login code.
            </Text>

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleSendCode}
              autoFocus
              testID="otp-email"
            />

            <Pressable
              onPress={handleSendCode}
              disabled={!emailValid || loading}
              style={[styles.cta, (!emailValid || loading) && styles.ctaDisabled]}
              testID="otp-send"
            >
              {loading
                ? <ActivityIndicator color={Colors.textInverse} />
                : <Text style={styles.ctaText}>Send code</Text>
              }
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => { setStep('email'); setCode(''); }} style={styles.backRow}>
              <Ionicons name="chevron-back" size={18} color={Colors.primary} />
              <Text style={styles.backText}>Change email</Text>
            </Pressable>

            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.sub}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{email.trim()}</Text>
            </Text>

            {devCode && (
              <View style={styles.devBanner}>
                <Text style={styles.devBannerLabel}>Dev mode — your code:</Text>
                <Text style={styles.devBannerCode}>{devCode}</Text>
              </View>
            )}

            <Text style={styles.label}>Login code</Text>
            <TextInput
              ref={codeRef}
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleVerifyCode}
              maxLength={6}
              testID="otp-code"
            />

            <Pressable
              onPress={handleVerifyCode}
              disabled={!codeValid || loading}
              style={[styles.cta, (!codeValid || loading) && styles.ctaDisabled]}
              testID="otp-verify"
            >
              {loading
                ? <ActivityIndicator color={Colors.textInverse} />
                : <Text style={styles.ctaText}>Continue</Text>
              }
            </Pressable>

            <Pressable onPress={handleResend} disabled={loading} style={styles.resendRow}>
              <Text style={styles.resendText}>
                Didn{'\u2019'}t receive it?{' '}
                <Text style={styles.resendLink}>Resend code</Text>
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 24 },

  logoImage: {
    width: 88, height: 88, borderRadius: 44,
    marginBottom: 32,
  },

  heading: { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 32, lineHeight: 22 },
  emailHighlight: { fontFamily: 'Inter_600SemiBold', color: Colors.text },

  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 6, marginTop: 4 },

  input: {
    height: 52, borderRadius: 14, backgroundColor: Colors.surface,
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_400Regular', color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },

  codeInput: {
    height: 64, borderRadius: 14, backgroundColor: Colors.surface,
    paddingHorizontal: 20, fontSize: 32, fontFamily: 'Inter_700Bold', color: Colors.text,
    borderWidth: 1.5, borderColor: Colors.borderLight,
    letterSpacing: 12,
    textAlign: 'center',
  },

  cta: {
    height: 54, borderRadius: 16, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.textInverse },

  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 2 },
  backText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.primary },

  resendRow: { marginTop: 20, alignItems: 'center' },
  resendText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  resendLink: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },

  devBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  devBannerLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  devBannerCode: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#92400e',
    letterSpacing: 8,
  },
});
