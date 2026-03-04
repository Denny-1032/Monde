import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useColors } from '../constants/useColors';

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, setMode, isDark } = useTheme();
  const colors = useColors();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        {/* Theme Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Theme</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary + '12' }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.secondary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, { color: colors.text }]}>Dark Mode</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  {mode === 'system' ? 'Following system setting' : mode === 'dark' ? 'Always dark' : 'Always light'}
                </Text>
              </View>
            </View>
            <View style={styles.themeToggle}>
              {(['light', 'system', 'dark'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.themeOption, { backgroundColor: mode === opt ? colors.primary : colors.surfaceAlt }]}
                  onPress={() => setMode(opt)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt === 'light' ? 'sunny-outline' : opt === 'dark' ? 'moon-outline' : 'phone-portrait-outline'}
                    size={16}
                    color={mode === opt ? colors.white : colors.textSecondary}
                  />
                  <Text style={[styles.themeOptionText, { color: mode === opt ? colors.white : colors.textSecondary }]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Choose "System" to automatically match your device's dark mode setting.
          </Text>
        </View>
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
    paddingVertical: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  card: {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  menuSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
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
  },
  themeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
