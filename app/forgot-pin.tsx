import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { isValidPhone, isValidPin, pinToPassword } from '../lib/validation';
import { resetPinWithToken, sendOtp, verifyOtp } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';
import Button from '../components/Button';

type Step = 'phone' | 'verify' | 'newpin' | 'confirm' | 'done';

export default function ForgotPinScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestReset = async () => {
    if (!isValidPhone(phone)) {
      setError('Please enter a valid phone number.');
      return;
    }
    setLoading(true);
    setError('');

    if (!isSupabaseConfigured) {
      // Offline mock — skip to verification step
      setTimeout(() => {
        setLoading(false);
        setStep('verify');
      }, 800);
      return;
    }

    const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
    const result = await sendOtp(formattedPhone);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to send reset code. Please try again.');
      return;
    }
    setStep('verify');
  };

  const handleVerifyCode = async () => {
    if (code.length < 4) {
      setError('Please enter the verification code.');
      return;
    }
    setError('');

    if (!isSupabaseConfigured) {
      // Offline mock — skip to new PIN step
      setStep('newpin');
      return;
    }

    setLoading(true);
    const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
    const result = await verifyOtp(formattedPhone, code);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Invalid verification code. Please try again.');
      return;
    }
    setStep('newpin');
  };

  const handleSetNewPin = () => {
    if (!isValidPin(newPin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirmNewPin = async () => {
    if (newPin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }
    setLoading(true);
    setError('');

    if (!isSupabaseConfigured) {
      // Offline mock
      setTimeout(() => {
        setLoading(false);
        setStep('done');
      }, 800);
      return;
    }

    const result = await resetPinWithToken(phone, newPin);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to reset PIN. Please try again.');
      return;
    }
    setStep('done');
  };

  const handleDone = () => {
    router.replace('/(auth)/login');
  };

  const renderStep = () => {
    switch (step) {
      case 'phone':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="call-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Reset Your PIN</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Enter the phone number associated with your Monde account.</Text>

            <View style={styles.phoneRow}>
              <View style={[styles.prefix, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.prefixText, { color: colors.textSecondary }]}>+260</Text>
              </View>
              <TextInput
                style={[styles.phoneInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(''); }}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
                placeholderTextColor={colors.textLight}
              />
            </View>

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

            <Button
              title="Send Reset Code"
              onPress={handleRequestReset}
              loading={loading}
              disabled={!isValidPhone(phone) || loading}
              size="lg"
            />
          </View>
        );

      case 'verify':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="mail-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Enter Verification Code</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              We've sent a verification code to your phone number. Enter it below.
            </Text>

            <TextInput
              style={[styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={code}
              onChangeText={(t) => { setCode(t.replace(/[^0-9]/g, '')); setError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textAlign="center"
              placeholderTextColor={colors.textLight}
            />

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

            <Button
              title="Verify Code"
              onPress={handleVerifyCode}
              disabled={code.length < 4 || loading}
              size="lg"
            />

            <TouchableOpacity style={styles.resendBtn} onPress={handleRequestReset} disabled={loading}>
              <Text style={[styles.resendText, { color: colors.primary }]}>Didn't receive a code? Resend</Text>
            </TouchableOpacity>
          </View>
        );

      case 'newpin':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="key-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Create New PIN</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Enter a new 4-digit PIN for your account.</Text>

            <TextInput
              style={[styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={newPin}
              onChangeText={(t) => { setNewPin(t.replace(/[^0-9]/g, '')); setError(''); }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              textAlign="center"
              placeholderTextColor={colors.textLight}
            />

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

            <Button
              title="Continue"
              onPress={handleSetNewPin}
              disabled={newPin.length !== 4}
              size="lg"
            />
          </View>
        );

      case 'confirm':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Confirm New PIN</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Re-enter your new 4-digit PIN to confirm.</Text>

            <TextInput
              style={[styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={confirmPin}
              onChangeText={(t) => { setConfirmPin(t.replace(/[^0-9]/g, '')); setError(''); }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              textAlign="center"
              placeholderTextColor={colors.textLight}
            />

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

            <Button
              title="Reset PIN"
              onPress={handleConfirmNewPin}
              loading={loading}
              disabled={confirmPin.length !== 4 || loading}
              size="lg"
            />
          </View>
        );

      case 'done':
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="checkmark-done" size={32} color={colors.success} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>PIN Reset Successful</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Your PIN has been updated. You can now log in with your new PIN.</Text>

            <Button title="Go to Login" onPress={handleDone} size="lg" />
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Forgot PIN</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.progressRow}>
        {['phone', 'verify', 'newpin', 'confirm'].map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              { backgroundColor: colors.borderLight },
              (step === s || ['phone', 'verify', 'newpin', 'confirm', 'done'].indexOf(step) > i) && [styles.progressDotActive, { backgroundColor: colors.primary }],
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: undefined, // set dynamically
  },
  progressDotActive: {
    backgroundColor: undefined, // set dynamically
    width: 24,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  stepDesc: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    width: '100%',
  },
  prefix: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    borderWidth: 1,
  },
  prefixText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.lg,
    borderWidth: 1,
  },
  codeInput: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '700',
    borderWidth: 1,
    width: '100%',
    marginBottom: Spacing.lg,
    letterSpacing: 8,
  },
  error: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  resendBtn: {
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  resendText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
