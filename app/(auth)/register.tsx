import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import Button from '../../components/Button';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useStore();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  const canProceedStep0 = fullName.trim().length > 1 && phone.length >= 10 && selectedProvider;
  const canProceedStep1 = pin.length === 4;

  const handleRegister = async () => {
    setError('');
    const result = await signUp(
      phone,
      pin,
      fullName.trim(),
      selectedProvider || 'airtel'
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
      <TouchableOpacity style={styles.back} onPress={() => (step > 0 ? setStep(0) : router.back())}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{step === 0 ? 'Create account' : 'Set your PIN'}</Text>
        <Text style={styles.subtitle}>
          {step === 0 ? 'Enter your details to get started' : 'Choose a 4-digit PIN to secure your account'}
        </Text>

        {step === 0 ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Chanda Mwila"
                placeholderTextColor={Colors.textLight}
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
                  onChangeText={setPhone}
                  placeholder="97 123 4567"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary provider</Text>
              <View style={styles.providerGrid}>
                {Providers.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.providerChip,
                      selectedProvider === p.id && { borderColor: p.color, backgroundColor: p.color + '15' },
                    ]}
                    onPress={() => setSelectedProvider(p.id)}
                  >
                    <View style={[styles.providerDot, { backgroundColor: p.color }]} />
                    <Text
                      style={[styles.providerLabel, selectedProvider === p.id && { color: p.color, fontWeight: '700' }]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              title="Continue"
              onPress={() => setStep(1)}
              disabled={!canProceedStep0}
              size="lg"
              style={{ marginTop: Spacing.lg }}
            />
          </>
        ) : (
          <>
            <View style={styles.pinContainer}>
              <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
                placeholder="----"
                placeholderTextColor={Colors.textLight}
              />
              <View style={styles.dots}>
                {Array.from({ length: 4 }, (_, i) => (
                  <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
                ))}
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
              title="Create Account"
              onPress={handleRegister}
              disabled={!canProceedStep1}
              loading={isLoading}
              size="lg"
              style={{ marginTop: Spacing.xl }}
            />
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
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  providerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  providerLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  pinContainer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  pinInput: {
    position: 'absolute',
    opacity: 0,
    width: 200,
    height: 50,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.md,
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
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
