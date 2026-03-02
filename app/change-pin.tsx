import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { isValidPin, pinToPassword } from '../lib/validation';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type Step = 'current' | 'new' | 'confirm';

export default function ChangePinScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const signIn = useStore((s) => s.signIn);

  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activePin = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin;

  const handleKey = (key: string) => {
    if (loading) return;
    const current = activePin;
    if (current.length >= 4) return;

    const next = current + key;
    if (step === 'current') setCurrentPin(next);
    else if (step === 'new') setNewPin(next);
    else setConfirmPin(next);

    setError('');

    if (next.length === 4) {
      setTimeout(() => processStep(next), 200);
    }
  };

  const handleDelete = () => {
    if (step === 'current') setCurrentPin((p) => p.slice(0, -1));
    else if (step === 'new') setNewPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
    setError('');
  };

  const processStep = async (pin: string) => {
    if (step === 'current') {
      // Verify current PIN by attempting sign-in
      setLoading(true);
      const phone = user?.phone || '';
      const result = await signIn(phone, pin);
      setLoading(false);
      if (result.success) {
        setStep('new');
      } else {
        setError('Current PIN is incorrect.');
        setCurrentPin('');
      }
    } else if (step === 'new') {
      if (!isValidPin(pin)) {
        setError('PIN must be exactly 4 digits.');
        setNewPin('');
        return;
      }
      if (pin === currentPin) {
        setError('New PIN must be different from current PIN.');
        setNewPin('');
        return;
      }
      setStep('confirm');
    } else {
      // Confirm step
      if (pin !== newPin) {
        setError('PINs do not match. Try again.');
        setConfirmPin('');
        return;
      }
      // Update password in Supabase
      setLoading(true);
      if (isSupabaseConfigured) {
        const { error: updateError } = await supabase.auth.updateUser({
          password: pinToPassword(pin),
        });
        setLoading(false);
        if (updateError) {
          setError(updateError.message);
          setConfirmPin('');
          return;
        }
      } else {
        setLoading(false);
      }
      // Navigate back immediately, then show confirmation
      router.back();
      setTimeout(() => {
        Alert.alert('PIN Changed', 'Your PIN has been updated successfully.');
      }, 300);
    }
  };

  const stepLabel = step === 'current'
    ? 'Enter your current PIN'
    : step === 'new'
    ? 'Enter your new PIN'
    : 'Confirm your new PIN';

  const dots = Array.from({ length: 4 }, (_, i) => i < activePin.length);
  const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Change PIN</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        {(['current', 'new', 'confirm'] as Step[]).map((s, i) => (
          <View key={s} style={[styles.progressDot, { backgroundColor: colors.borderLight }, step === s && { backgroundColor: colors.primary }, (['current', 'new', 'confirm'].indexOf(step) > i) && { backgroundColor: colors.success }]} />
        ))}
      </View>

      <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>{stepLabel}</Text>

      <View style={styles.dotsRow}>
        {dots.map((filled, i) => (
          <View key={i} style={[styles.dot, { borderColor: colors.border }, filled && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: Spacing.md }} />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.pad}>
        {KEYS.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((key, j) => (
              <TouchableOpacity
                key={j}
                style={styles.key}
                onPress={() => {
                  if (key === 'del') handleDelete();
                  else if (key) handleKey(key);
                }}
                activeOpacity={key ? 0.6 : 1}
              >
                {key === 'del' ? (
                  <Ionicons name="backspace-outline" size={26} color={colors.text} />
                ) : (
                  <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
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
    marginBottom: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  error: {
    textAlign: 'center',
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  pad: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  key: {
    width: 75,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  keyText: {
    fontSize: FontSize.xl + 4,
    fontWeight: '500',
  },
});
