import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useColors } from '../../constants/useColors';
import { useStore } from '../../store/useStore';
import { isValidPhone } from '../../lib/validation';
import { preventScreenCapture } from '../../lib/security';

const LAST_PHONE_KEY = 'monde_last_phone';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, isLoading } = useStore();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(true);
  const [loadingPhone, setLoadingPhone] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(0);

  // M2: Prevent screenshots on PIN entry screen
  useEffect(() => preventScreenCapture(), []);

  useEffect(() => {
    (async () => {
      try {
        const saved = Platform.OS === 'web'
          ? localStorage.getItem(LAST_PHONE_KEY)
          : await SecureStore.getItemAsync(LAST_PHONE_KEY);
        if (saved) {
          setPhone(saved);
          setShowPhoneInput(false); // Skip straight to PIN
        }
      } catch {}
      setLoadingPhone(false);
    })();
  }, []);

  const handleKey = (key: string) => {
    if (isLoading) return;
    const now = Date.now();
    if (attempts >= MAX_ATTEMPTS && now < lockoutEnd) {
      const secsLeft = Math.ceil((lockoutEnd - now) / 1000);
      setError(`Too many attempts. Try again in ${secsLeft}s.`);
      return;
    }
    if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) {
        handleLogin(newPin);
      }
    }
  };

  const handleLogin = async (enteredPin: string) => {
    const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
    const result = await signIn(formattedPhone, enteredPin);
    if (result.success) {
      // Save phone for next login
      try {
        if (Platform.OS === 'web') localStorage.setItem(LAST_PHONE_KEY, phone);
        else await SecureStore.setItemAsync(LAST_PHONE_KEY, phone);
      } catch {}
      router.replace('/(tabs)');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutEnd(Date.now() + LOCKOUT_SECONDS * 1000);
        setError(`Too many attempts. Locked for ${LOCKOUT_SECONDS}s.`);
      } else {
        // Show actual error from Supabase for better debugging
        const detail = result.error || 'Invalid PIN';
        setError(`${detail} (${MAX_ATTEMPTS - newAttempts} attempts left)`);
      }
      setPin('');
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const canProceedToPin = isValidPhone(phone);

  const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);

  const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={[styles.logoText, { color: colors.white }]}>M</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {loadingPhone ? '' : showPhoneInput ? 'Enter your phone number' : 'Enter your 4-digit PIN'}
        </Text>
        {!showPhoneInput && phone ? (
          <TouchableOpacity onPress={() => setShowPhoneInput(true)} style={[styles.changePhone, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.changePhoneText, { color: colors.primary }]}>+260{phone.replace(/^0/, '')}  </Text>
            <Ionicons name="create-outline" size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showPhoneInput ? (
        <View style={styles.phoneSection}>
          <View style={styles.phoneRow}>
            <View style={[styles.prefix, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.prefixText, { color: colors.textSecondary }]}>+260</Text>
            </View>
            <TextInput
              style={[styles.phoneInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={[styles.continueBtn, !canProceedToPin && styles.continueBtnDisabled]}
            onPress={() => setShowPhoneInput(false)}
            disabled={!canProceedToPin}
          >
            <Text style={[styles.continueBtnText, { color: colors.white }, !canProceedToPin && { opacity: 0.5 }]}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.dots}>
            {dots.map((filled, i) => (
              <View key={i} style={[styles.dot, { borderColor: colors.border }, filled && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
            ))}
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : null}

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          <View style={styles.pad}>
            {KEYS.map((row, i) => (
              <View key={i} style={styles.row}>
                {row.map((key, j) => (
                  <TouchableOpacity
                    key={j}
                    style={key ? [styles.key, { backgroundColor: colors.surface }] as ViewStyle[] : styles.keyEmpty as any}
                    onPress={() => {
                      if (key === 'del') handleDelete();
                      else if (key) handleKey(key);
                    }}
                    activeOpacity={key ? 0.7 : 1}
                  >
                    {key === 'del' ? (
                      <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
                    ) : (
                      <Text style={[styles.keyText, { color: colors.primary }]}>{key}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/forgot-pin')}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot PIN?</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  back: {
    position: 'absolute',
    top: 60,
    left: Spacing.md,
    zIndex: 10,
    padding: Spacing.sm,
  },
  header: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'transparent',
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
    justifyContent: 'space-evenly',
    marginBottom: Spacing.lg,
  },
  key: {
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
  keyEmpty: {
    width: 64,
    height: 64,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
  },
  phoneSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    gap: Spacing.lg,
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: FontSize.md,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  changePhone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  changePhoneText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  forgotText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
