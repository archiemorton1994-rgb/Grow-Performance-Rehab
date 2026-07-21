import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Image,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SEC = 30;
const RATE_LIMIT_COOLDOWN_SEC = 10 * 60;

export default function OtpAuthScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { requestCode, verifyCode } = useAuth();
  const webTop = Platform.OS === 'web' ? 67 : 0;

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const codeRef = useRef<TextInput>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const codeValid = code.trim().length === 6;
  const canResend = !loading && resendSecondsLeft === 0;

  useEffect(() => {
    if (step === 'code') {
      setResendSecondsLeft(RESEND_COOLDOWN_SEC);
    }
  }, [step]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const t = setTimeout(() => setResendSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecondsLeft]);

  const handleSendCode = async () => {
    if (!emailValid || loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await requestCode(email.trim());
      setDevCode(result.devCode);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 150);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send code. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = useCallback(async () => {
    if (!codeValid || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setErrorMsg('');
    try {
      await verifyCode(email.trim(), code.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Incorrect code. Please try again.';
      setCode('');
      setErrorMsg(msg);
      setLoading(false);
      setTimeout(() => codeRef.current?.focus(), 100);
    }
  }, [codeValid, loading, verifyCode, email, code]);

  useEffect(() => {
    if (step === 'code' && code.length === 6 && !loading) {
      handleVerifyCode();
    }
  }, [step, code, loading, handleVerifyCode]);

  const isRateLimitError = (msg: string) => msg.toLowerCase().includes('too many');

  const handleResend = async () => {
    if (!canResend) return;
    setCode('');
    setDevCode(undefined);
    setErrorMsg('');
    setLoading(true);
    try {
      const result = await requestCode(email.trim());
      setDevCode(result.devCode);
      setResendSecondsLeft(RESEND_COOLDOWN_SEC);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resend code.';
      setErrorMsg(msg);
      if (isRateLimitError(msg)) {
        setResendSecondsLeft(RATE_LIMIT_COOLDOWN_SEC);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      style={{ flex: 1, backgroundColor: C.background }}
      onPress={Keyboard.dismiss}
      accessible={false}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
              <Text style={styles.heading}>Welcome to Grow</Text>
              <Text style={styles.sub}>Enter your email to create an account or sign in.</Text>

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={[styles.input, errorMsg ? styles.inputError : null]}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrorMsg('');
                }}
                placeholder="you@example.com"
                placeholderTextColor={C.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
                autoFocus={Platform.OS !== 'web'}
                testID="otp-email"
              />

              {errorMsg ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={C.error} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSendCode}
                disabled={!emailValid || loading}
                style={[styles.cta, (!emailValid || loading) && styles.ctaDisabled]}
                testID="otp-send"
              >
                {loading ? (
                  <ActivityIndicator color={C.textInverse} />
                ) : (
                  <Text style={styles.ctaText}>Send code</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setErrorMsg('');
                }}
                style={styles.backRow}
                testID="otp-back"
              >
                <Ionicons name="chevron-back" size={18} color={C.primary} />
                <Text style={styles.backText}>Change email</Text>
              </Pressable>

              <Text style={styles.heading}>Check your inbox</Text>
              <Text style={styles.sub}>
                We sent a 6-digit code to{'\n'}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>
              </Text>

              {devCode ? (
                <View style={styles.devBanner}>
                  <Text style={styles.devBannerLabel}>Dev mode - your code:</Text>
                  <Text style={styles.devBannerCode}>{devCode}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Login code</Text>
              <TextInput
                ref={codeRef}
                style={[styles.codeInput, errorMsg ? styles.codeInputError : null]}
                value={code}
                onChangeText={(t) => {
                  setCode(t.replace(/\D/g, '').slice(0, 6));
                  setErrorMsg('');
                }}
                placeholder="000000"
                placeholderTextColor={C.textTertiary}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
                maxLength={6}
                testID="otp-code"
              />

              {errorMsg ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={C.error} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleVerifyCode}
                disabled={!codeValid || loading}
                style={[styles.cta, (!codeValid || loading) && styles.ctaDisabled]}
                testID="otp-verify"
              >
                {loading ? (
                  <ActivityIndicator color={C.textInverse} />
                ) : (
                  <Text style={styles.ctaText}>Continue</Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleResend}
                disabled={!canResend}
                style={styles.resendRow}
                testID="otp-resend"
              >
                {resendSecondsLeft > 0 ? (
                  <Text style={[styles.resendText, styles.resendTextMuted]}>
                    Resend code in {resendSecondsLeft}s
                  </Text>
                ) : (
                  <Text style={styles.resendText}>
                    Didn{'\u2019'}t receive it? <Text style={styles.resendLink}>Resend code</Text>
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    inner: { paddingHorizontal: 24 },

    logoImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
      marginBottom: 32,
    },

    heading: { fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 4 },
    sub: {
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 32,
      lineHeight: 22,
    },
    emailHighlight: { fontFamily: 'Inter_600SemiBold', color: C.text },

    label: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      marginBottom: 6,
      marginTop: 4,
    },

    input: {
      height: 52,
      borderRadius: 14,
      backgroundColor: C.surface,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: 'Inter_400Regular',
      color: C.text,
      borderWidth: 1.5,
      borderColor: C.borderLight,
    },
    inputError: { borderColor: C.error },

    codeInput: {
      height: 64,
      borderRadius: 14,
      backgroundColor: C.surface,
      paddingHorizontal: 20,
      fontSize: 32,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      borderWidth: 1.5,
      borderColor: C.borderLight,
      letterSpacing: 12,
      textAlign: 'center',
    },
    codeInputError: { borderColor: C.error },

    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4 },
    errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.error, flex: 1 },

    cta: {
      height: 54,
      borderRadius: 16,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },
    ctaDisabled: { opacity: 0.45 },
    ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.textInverse },

    backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 2 },
    backText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.primary },

    resendRow: { marginTop: 20, alignItems: 'center' },
    resendText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    resendTextMuted: { color: C.textTertiary },
    resendLink: { color: C.primary, fontFamily: 'Inter_600SemiBold' },

    devBanner: {
      backgroundColor: C.warningLight,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.warning,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
      alignItems: 'center',
    },
    devBannerLabel: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: C.warning,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    devBannerCode: {
      fontSize: 30,
      fontFamily: 'Inter_700Bold',
      color: C.warning,
      letterSpacing: 8,
    },
  });
}
