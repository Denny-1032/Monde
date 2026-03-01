import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import { isValidPhone } from '../../lib/validation';

const LAST_PHONE_KEY = 'monde_last_phone';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useStore();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(true);
  const [loadingPhone, setLoadingPhone] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(0);

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
        setError(`Invalid PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
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
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          {loadingPhone ? '' : showPhoneInput ? 'Enter your phone number' : 'Enter your 4-digit PIN'}
        </Text>
        {!showPhoneInput && phone ? (
          <TouchableOpacity onPress={() => setShowPhoneInput(true)} style={styles.changePhone}>
            <Text style={styles.changePhoneText}>+260{phone.replace(/^0/, '')}  </Text>
            <Ionicons name="create-outline" size={14} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showPhoneInput ? (
        <View style={styles.phoneSection}>
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+260</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="97 123 4567"
              placeholderTextColor={Colors.textLight}
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
            <Text style={[styles.continueBtnText, !canProceedToPin && { opacity: 0.5 }]}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.dots}>
            {dots.map((filled, i) => (
              <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
            ))}
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: Spacing.md }} />
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
                      <Ionicons name="backspace-outline" size={26} color={Colors.text} />
                    ) : (
                      <Text style={styles.keyText}>{key}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.white,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
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
    borderColor: Colors.border,
    backgroundColor: 'transparent',
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
    color: Colors.text,
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: FontSize.md,
    color: Colors.text,
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
    color: Colors.white,
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  changePhone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.full,
  },
  changePhoneText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
