import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import { sanitizeText, isValidPhone, isValidPin, detectProvider } from '../../lib/validation';
import Button from '../../components/Button';

const PIN_KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useStore();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);

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
      detected || 'airtel'
    );
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(result.error || 'Registration failed. Please try again.');
      Alert.alert('Registration Error', result.error || 'Something went wrong.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={styles.back} onPress={() => {
        if (step === 2) { setConfirmPin(''); setError(''); setStep(1); }
        else if (step === 1) { setPin(''); setError(''); setStep(0); }
        else router.back();
      }}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{step === 0 ? 'Create account' : step === 1 ? 'Set your PIN' : 'Confirm PIN'}</Text>
        <Text style={styles.subtitle}>
          {step === 0 ? 'Enter your details to get started' : step === 1 ? 'Choose a 4-digit PIN to secure your account' : 'Re-enter your PIN to confirm'}
        </Text>

        {step === 0 ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefix}>
                  <Text style={styles.prefixText}>+260</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
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
              <View style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}>
                {tosAccepted && <Ionicons name="checkmark" size={14} color={Colors.white} />}
              </View>
              <Text style={styles.tosText}>
                I agree to the{' '}
                <Text style={styles.tosLink} onPress={() => router.push('/terms')}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.tosLink} onPress={() => router.push('/terms')}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <Button
              title="Continue"
              onPress={() => setStep(1)}
              disabled={!canProceedStep0}
              size="lg"
              style={{ marginTop: Spacing.md }}
            />
          </>
        ) : step === 1 ? (
          <>
            <View style={styles.dotsRow}>
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
              ))}
            </View>

            <View style={styles.pad}>
              {PIN_KEYS.map((row, i) => (
                <View key={i} style={styles.padRow}>
                  {row.map((key, j) => (
                    <TouchableOpacity
                      key={j}
                      style={styles.padKey}
                      onPress={() => {
                        if (key === 'del') { setPin((p) => p.slice(0, -1)); }
                        else if (key && pin.length < 4) { setPin((p) => p + key); }
                      }}
                      activeOpacity={key ? 0.6 : 1}
                    >
                      {key === 'del' ? (
                        <Ionicons name="backspace-outline" size={26} color={Colors.text} />
                      ) : (
                        <Text style={styles.padKeyText}>{key}</Text>
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
        ) : (
          <>
            <View style={styles.dotsRow}>
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={[styles.dot, i < confirmPin.length && styles.dotFilled]} />
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.pad}>
              {PIN_KEYS.map((row, i) => (
                <View key={i} style={styles.padRow}>
                  {row.map((key, j) => (
                    <TouchableOpacity
                      key={j}
                      style={styles.padKey}
                      onPress={() => {
                        if (key === 'del') { setConfirmPin((p) => p.slice(0, -1)); setError(''); }
                        else if (key && confirmPin.length < 4) { setConfirmPin((p) => p + key); setError(''); }
                      }}
                      activeOpacity={key ? 0.6 : 1}
                    >
                      {key === 'del' ? (
                        <Ionicons name="backspace-outline" size={26} color={Colors.text} />
                      ) : (
                        <Text style={styles.padKeyText}>{key}</Text>
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
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  prefix: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
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
    borderColor: Colors.border,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pad: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  padKey: {
    width: 75,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  padKeyText: {
    fontSize: FontSize.xl + 4,
    fontWeight: '500',
    color: Colors.text,
  },
  errorText: {
    color: Colors.error,
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
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tosText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  tosLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
