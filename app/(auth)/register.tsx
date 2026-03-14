import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useColors } from '../../constants/useColors';
import { useStore } from '../../store/useStore';
import { sanitizeText, isValidPhone, isValidPin, detectProvider } from '../../lib/validation';
import { verifyOtp, resendSignUpOtp, checkPhoneExists, ensureProfileExists } from '../../lib/api';
import Button from '../../components/Button';
import OtpInput from '../../components/OtpInput';

const PIN_KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

export default function RegisterScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signUp, initSession, isLoading, sessionId } = useStore();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);

  const canProceedStep0 = fullName.trim().length > 1 && isValidPhone(phone) && tosAccepted;
  const canProceedStep1 = isValidPin(pin);
  const canProceedStep2 = isValidPin(confirmPin);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
  };

  const handleRegister = async () => {
    setError('');
    const safeName = sanitizeText(fullName);
    if (safeName.length < 2) {
      setError('Please enter a valid name.');
      return;
    }
    const detected = detectProvider(phone);
    const result = await signUp(
      phone,
      pin,
      safeName,
      detected || 'unknown'
    );
    if (result.success) {
      // signUp({ phone }) automatically sends OTP via Twilio Verify
      setStep(3);
    } else {
      setError(result.error || 'Registration failed. Please try again.');
      Alert.alert('Registration Error', result.error || 'Something went wrong.');
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setOtpError('');
    setOtpLoading(true);
    const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
    try {
      const result = await verifyOtp(formattedPhone, code);
      if (result.success) {
        // OTP verified — create profile, then load everything
        const safeName = sanitizeText(fullName);
        const detected = detectProvider(phone);
        // Get the user ID from the new session (verifyOtp established it)
        const userId = sessionId || useStore.getState().sessionId;
        if (userId) {
          await ensureProfileExists(userId, formattedPhone, safeName, detected || 'airtel');
        }
        // Load profile + transactions + subscriptions
        await initSession();
        router.replace('/(tabs)');
      } else {
        setOtpError(result.error || 'Invalid code. Please try again.');
      }
    } catch (e: any) {
      setOtpError(e?.message || 'Verification failed. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
    await resendSignUpOtp(formattedPhone);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={styles.back} onPress={() => {
        if (step === 3) { /* Can't go back from OTP - already registered */ }
        else if (step === 2) { setConfirmPin(''); setError(''); setStep(1); }
        else if (step === 1) { setPin(''); setError(''); setStep(0); }
        else router.back();
      }}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>{step === 0 ? 'Create account' : step === 1 ? 'Set your PIN' : step === 2 ? 'Confirm PIN' : 'Verify your number'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {step === 0 ? 'Enter your details to get started' : step === 1 ? 'Choose a 4-digit PIN to secure your account' : step === 2 ? 'Re-enter your PIN to confirm' : `Enter the code sent to +260${phone.replace(/^0/, '')}`}
        </Text>

        {step === 0 ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Full name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Phone number</Text>
              <View style={styles.phoneRow}>
                <View style={[styles.prefix, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.prefixText, { color: colors.textSecondary }]}>+260</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.phoneInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.tosRow}
              onPress={() => setTosAccepted(!tosAccepted)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, { borderColor: colors.border }, tosAccepted && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {tosAccepted && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
              <Text style={[styles.tosText, { color: colors.textSecondary }]}>
                I agree to the{' '}
                <Text style={[styles.tosLink, { color: colors.primary }]} onPress={() => router.push('/terms')}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={[styles.tosLink, { color: colors.primary }]} onPress={() => router.push('/terms')}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

            <Button
              title={phoneChecking ? 'Checking...' : 'Continue'}
              onPress={async () => {
                setError('');
                setPhoneChecking(true);
                const { exists } = await checkPhoneExists(phone);
                setPhoneChecking(false);
                if (exists) {
                  setError('This phone number is already registered. Please log in instead.');
                  return;
                }
                setStep(1);
              }}
              disabled={!canProceedStep0 || phoneChecking}
              loading={phoneChecking}
              size="lg"
              style={{ marginTop: Spacing.md }}
            />
          </>
        ) : step === 1 ? (
          <>
            <View style={styles.dotsRow}>
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={[styles.dot, { borderColor: colors.border }, i < pin.length && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
              ))}
            </View>

            <View style={styles.pad}>
              {PIN_KEYS.map((row, i) => (
                <View key={i} style={styles.padRow}>
                  {row.map((key, j) => (
                    <TouchableOpacity
                      key={j}
                      style={key ? [styles.padKey, { backgroundColor: colors.surface }] : styles.padKeyEmpty}
                      onPress={() => {
                        if (key === 'del') { setPin((p) => p.slice(0, -1)); }
                        else if (key && pin.length < 4) { setPin((p) => p + key); }
                      }}
                      activeOpacity={key ? 0.7 : 1}
                    >
                      {key === 'del' ? (
                        <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
                      ) : (
                        <Text style={[styles.padKeyText, { color: colors.primary }]}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            <View style={{ paddingHorizontal: Spacing.lg }}>
              <Button
                title="Continue"
                onPress={() => { setError(''); setStep(2); }}
                disabled={!canProceedStep1}
                size="lg"
              />
            </View>
          </>
        ) : step === 2 ? (
          <>
            <View style={styles.dotsRow}>
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={[styles.dot, { borderColor: colors.border }, i < confirmPin.length && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
              ))}
            </View>

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

            <View style={styles.pad}>
              {PIN_KEYS.map((row, i) => (
                <View key={i} style={styles.padRow}>
                  {row.map((key, j) => (
                    <TouchableOpacity
                      key={j}
                      style={key ? [styles.padKey, { backgroundColor: colors.surface }] : styles.padKeyEmpty}
                      onPress={() => {
                        if (key === 'del') { setConfirmPin((p) => p.slice(0, -1)); setError(''); }
                        else if (key && confirmPin.length < 4) { setConfirmPin((p) => p + key); setError(''); }
                      }}
                      activeOpacity={key ? 0.7 : 1}
                    >
                      {key === 'del' ? (
                        <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
                      ) : (
                        <Text style={[styles.padKeyText, { color: colors.primary }]}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            <View style={{ paddingHorizontal: Spacing.lg }}>
              <Button
                title="Create Account"
                onPress={() => {
                  if (confirmPin !== pin) {
                    setError('PINs do not match. Please try again.');
                    setConfirmPin('');
                    return;
                  }
                  handleRegister();
                }}
                disabled={!canProceedStep2}
                loading={isLoading}
                size="lg"
              />
            </View>
          </>
        ) : (
          <View style={styles.otpSection}>
            <OtpInput
              length={6}
              onComplete={handleVerifyOtp}
              error={otpError}
              onResend={handleResendOtp}
              resendCooldown={60}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  back: {
    position: 'absolute',
    top: 60,
    left: Spacing.md,
    zIndex: 10,
    padding: Spacing.sm,
  },
  content: {
    paddingTop: 110,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: FontSize.md,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  prefix: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  pad: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: Spacing.lg,
  },
  padKey: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
    }),
  },
  padKeyEmpty: {
    width: 64,
    height: 64,
  },
  padKeyText: {
    fontSize: 28,
    fontWeight: '500',
  },
  errorText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tosText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  tosLink: {
    fontWeight: '600',
  },
  otpSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
});
