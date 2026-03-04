import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useColors } from '../../constants/useColors';
import { useStore } from '../../store/useStore';
import { formatPhone } from '../../lib/helpers';
import Avatar from '../../components/Avatar';

type MenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
};

function MenuItem({ icon, label, subtitle, onPress, danger }: MenuItemProps) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6} accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label} accessibilityRole="button">
      <View style={[styles.menuIcon, { backgroundColor: danger ? colors.error + '15' : colors.primary + '12' }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, { color: danger ? colors.error : colors.text }]}>{label}</Text>
        {subtitle ? <Text style={[styles.menuSub, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const fetchProfile = useStore((s) => s.fetchProfile);

  // Retry loading profile if null
  React.useEffect(() => {
    if (!user) { fetchProfile(); }
  }, [user]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Profile</Text>

      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <Avatar name={user?.full_name || 'U'} size={64} imageUrl={user?.avatar_url} />
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.full_name}</Text>
          {user?.handle ? <Text style={[styles.profileHandle, { color: colors.primary }]}>@{user.handle}</Text> : null}
          <Text style={[styles.profilePhone, { color: colors.textSecondary }]}>{formatPhone(user?.phone || '')}</Text>
        </View>
      </View>

      {/* Menu Sections */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
        <View style={[styles.menuGroup, { backgroundColor: colors.surface }]}>
          <MenuItem icon="person-outline" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
          <MenuItem icon="wallet-outline" label="Linked Accounts" subtitle="Manage your payment accounts" onPress={() => router.push('/linked-accounts')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>
        <View style={[styles.menuGroup, { backgroundColor: colors.surface }]}>
          <MenuItem icon="notifications-outline" label="Notifications" onPress={() => Alert.alert('Notifications', 'Push notifications coming in a future update.')} />
          <MenuItem icon="shield-checkmark-outline" label="Security" subtitle="PIN & biometrics" onPress={() => router.push('/security')} />
          <MenuItem icon="language-outline" label="Language" subtitle="English" onPress={() => Alert.alert('Language', 'Additional languages coming soon.')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Support</Text>
        <View style={[styles.menuGroup, { backgroundColor: colors.surface }]}>
          <MenuItem icon="help-circle-outline" label="Help & FAQ" onPress={() => Alert.alert('Help', 'For support, email copperjetofficial@gmail.com')} />
          <MenuItem icon="chatbubble-outline" label="Contact Support" onPress={() => Alert.alert('Contact', 'Email: copperjetofficial@gmail.com\nPhone: +260970627630')} />
          <MenuItem icon="document-text-outline" label="Terms & Privacy" onPress={() => router.push('/terms')} />
        </View>
      </View>

      <View style={[styles.section, { marginBottom: 40 }]}>
        <View style={[styles.menuGroup, { backgroundColor: colors.surface }]}>
          <MenuItem icon="log-out-outline" label="Log Out" onPress={handleLogout} danger />
        </View>
      </View>

      <Text style={[styles.version, { color: colors.textLight }]}>Monde v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  profileHandle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginTop: 2,
  },
  profilePhone: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  menuGroup: {
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
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    paddingBottom: 30,
    marginTop: Spacing.md,
  },
});
