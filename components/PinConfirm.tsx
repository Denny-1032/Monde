import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_KEY = 'monde_biometric_enabled';

interface PinConfirmProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  onBiometricSuccess?: () => void;
  loading?: boolean;
  error?: string;
}

const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;

export default function PinConfirm({ visible, title, subtitle, onConfirm, onCancel, onBiometricSuccess, loading, error }: PinConfirmProps) {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(0);
  const [lockMsg, setLockMsg] = useState('');
  const [biometricAvail, setBiometricAvail] = useState(false);

  React.useEffect(() => {
    if (visible && onBiometricSuccess) checkAndPromptBiometric();
  }, [visible]);

  const checkAndPromptBiometric = async () => {
    try {
      if (Platform.OS === 'web') return;
      const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (val !== 'true') return;
      const ok = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!ok || !enrolled) return;
      setBiometricAvail(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: title || 'Authorize Transaction',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: true,
      });
      if (result.success && onBiometricSuccess) onBiometricSuccess();
    } catch {}
  };

  const handleKey = (key: string) => {
    if (loading) return;
    const now = Date.now();
    if (attempts >= MAX_PIN_ATTEMPTS && now < lockoutEnd) {
      const secs = Math.ceil((lockoutEnd - now) / 1000);
      setLockMsg(`Too many attempts. Try again in ${secs}s.`);
      return;
    }
    if (now >= lockoutEnd && lockMsg) setLockMsg('');
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        onConfirm(next);
      }, 200);
    }
  };

  // Track failed attempts when error arrives
  React.useEffect(() => {
    if (error) {
      setPin('');
      setAttempts((a) => {
        const next = a + 1;
        if (next >= MAX_PIN_ATTEMPTS) {
          setLockoutEnd(Date.now() + LOCKOUT_MS);
          setLockMsg(`Too many attempts. Locked for ${LOCKOUT_MS / 1000}s.`);
        }
        return next;
      });
    }
  }, [error]);

  React.useEffect(() => {
    if (visible) {
      setPin('');
      setLockMsg('');
    }
  }, [visible]);

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
  };

  const handleCancel = () => {
    setPin('');
    onCancel();
  };

  const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title || 'Confirm with PIN'}</Text>
            <Text style={styles.subtitle}>{subtitle || 'Enter your 4-digit PIN to authorize'}</Text>
          </View>

          <View style={styles.dotsRow}>
            {dots.map((filled, i) => (
              <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: Spacing.sm }} />
          ) : null}

          {(lockMsg || error) ? <Text style={styles.error}>{lockMsg || error}</Text> : null}

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
                      <Ionicons name="backspace-outline" size={26} color={Colors.text} />
                    ) : (
                      <Text style={styles.keyText}>{key}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {biometricAvail && onBiometricSuccess ? (
            <TouchableOpacity style={styles.biometricBtn} onPress={checkAndPromptBiometric}>
              <Ionicons name="finger-print-outline" size={22} color={Colors.primary} />
              <Text style={styles.biometricText}>Use Biometric</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.md,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  error: {
    textAlign: 'center',
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  key: {
    width: 75,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  keyText: {
    fontSize: FontSize.xl + 4,
    fontWeight: '500',
    color: Colors.text,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  biometricText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
});
