import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_KEY = 'monde_biometric_enabled';

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Fingerprint');
  const { mode, setMode, isDark } = useTheme();

  useEffect(() => {
    checkBiometrics();
    loadBiometricSetting();
  }, []);

  const loadBiometricSetting = async () => {
    try {
      const val = Platform.OS === 'web'
        ? localStorage.getItem(BIOMETRIC_KEY)
        : await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (val === 'true') setBiometricEnabled(true);
    } catch {}
  };

  const saveBiometricSetting = async (enabled: boolean) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
      } else {
        await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
      }
    } catch {}
  };

  const checkBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else {
          setBiometricType('Fingerprint');
        }
      }
    } catch {
      setBiometricAvailable(false);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Test biometric before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricType} for Monde`,
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setBiometricEnabled(true);
        await saveBiometricSetting(true);
        Alert.alert(`${biometricType} Enabled`, `You can now use ${biometricType.toLowerCase()} to authorize transactions.`);
      } else {
        Alert.alert('Authentication Failed', `Could not verify your ${biometricType.toLowerCase()}.`);
      }
    } else {
      setBiometricEnabled(false);
      await saveBiometricSetting(false);
      Alert.alert(`${biometricType} Disabled`, 'You will need to enter your PIN for all transactions.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Security</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Security Options */}
      <View style={styles.content}>
        {/* PIN Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PIN</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/change-pin')} activeOpacity={0.6}>
              <View style={styles.menuIcon}>
                <Ionicons name="key-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Change PIN</Text>
                <Text style={styles.menuSub}>Update your 4-digit security PIN</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Biometric Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biometric Authentication</Text>
          <View style={styles.card}>
            <View style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.success + '12' }]}>
                <Ionicons name="finger-print-outline" size={20} color={Colors.success} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{biometricType}</Text>
                <Text style={styles.menuSub}>
                  {biometricAvailable
                    ? `Use ${biometricType.toLowerCase()} to authorize transactions`
                    : Platform.OS === 'web'
                    ? 'Available on mobile devices only'
                    : 'Not available on this device'}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                trackColor={{ false: Colors.borderLight, true: Colors.success + '60' }}
                thumbColor={biometricEnabled ? Colors.success : Colors.textLight}
              />
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <View style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.secondary + '12' }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={Colors.secondary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Dark Mode</Text>
                <Text style={styles.menuSub}>
                  {mode === 'system' ? 'Following system setting' : mode === 'dark' ? 'Always dark' : 'Always light'}
                </Text>
              </View>
            </View>
            <View style={styles.themeToggle}>
              {(['light', 'system', 'dark'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.themeOption, mode === opt && styles.themeOptionActive]}
                  onPress={() => setMode(opt)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt === 'light' ? 'sunny-outline' : opt === 'dark' ? 'moon-outline' : 'phone-portrait-outline'}
                    size={16}
                    color={mode === opt ? Colors.white : Colors.textSecondary}
                  />
                  <Text style={[styles.themeOptionText, mode === opt && styles.themeOptionTextActive]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Your PIN is securely encrypted and never stored in plain text. Biometric data is processed on-device and never leaves your phone.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  menuSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '08',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  themeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  themeOptionActive: {
    backgroundColor: Colors.primary,
  },
  themeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  themeOptionTextActive: {
    color: Colors.white,
  },
});
