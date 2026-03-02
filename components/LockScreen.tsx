import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { verifyPin as verifyPinApi } from '../lib/api';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_KEY = 'monde_biometric_enabled';

interface LockScreenProps {
  onUnlock: () => void;
}

const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const colors = useColors();
  const user = useStore((s) => s.user);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    attemptBiometric();
  }, []);

  const attemptBiometric = async () => {
    try {
      if (Platform.OS === 'web') return;
      const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (val !== 'true') return;
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Monde',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: true,
      });
      if (result.success) onUnlock();
    } catch {}
  };

  const handleKey = (key: string) => {
    if (loading || pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    setError('');
    if (next.length === 4) {
      setTimeout(() => handleVerifyPin(next), 200);
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleVerifyPin = async (enteredPin: string) => {
    setLoading(true);
    const { success } = await verifyPinApi(user?.phone || '', enteredPin);
    setLoading(false);
    if (success) {
      onUnlock();
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{user?.full_name || 'Enter PIN to unlock'}</Text>
      </View>

      <View style={styles.dotsRow}>
        {dots.map((filled, i) => (
          <View key={i} style={[styles.dot, { borderColor: colors.border }, filled && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: Spacing.sm }} />
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  error: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
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
