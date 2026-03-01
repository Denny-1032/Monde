import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
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
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.menuIcon, danger && { backgroundColor: Colors.error + '15' }]}>
        <Ionicons name={icon} size={20} color={danger ? Colors.error : Colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, danger && { color: Colors.error }]}>{label}</Text>
        {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

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
    <ScrollView style={[styles.container, { paddingTop: insets.top + 10 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Profile</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Avatar name={user?.full_name || 'U'} size={64} imageUrl={user?.avatar_url} />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.full_name}</Text>
          <Text style={styles.profilePhone}>{formatPhone(user?.phone || '')}</Text>
        </View>
      </View>

      {/* Menu Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuGroup}>
          <MenuItem icon="person-outline" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
          <MenuItem icon="wallet-outline" label="Linked Accounts" subtitle="Manage your payment accounts" onPress={() => router.push('/linked-accounts')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.menuGroup}>
          <MenuItem icon="notifications-outline" label="Notifications" onPress={() => Alert.alert('Notifications', 'Push notifications coming in a future update.')} />
          <MenuItem icon="shield-checkmark-outline" label="Security" subtitle="PIN & biometrics" onPress={() => router.push('/security')} />
          <MenuItem icon="language-outline" label="Language" subtitle="English" onPress={() => Alert.alert('Language', 'Additional languages coming soon.')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuGroup}>
          <MenuItem icon="help-circle-outline" label="Help & FAQ" onPress={() => Alert.alert('Help', 'For support, email help@monde.app')} />
          <MenuItem icon="chatbubble-outline" label="Contact Support" onPress={() => Alert.alert('Contact', 'Email: support@monde.app\nPhone: +260 211 000 000')} />
          <MenuItem icon="document-text-outline" label="Terms & Privacy" onPress={() => Alert.alert('Terms & Privacy', 'By using Monde you agree to our Terms of Service and Privacy Policy. Full documents available at monde.app/legal')} />
        </View>
      </View>

      <View style={[styles.section, { marginBottom: 40 }]}>
        <View style={styles.menuGroup}>
          <MenuItem icon="log-out-outline" label="Log Out" onPress={handleLogout} danger />
        </View>
      </View>

      <Text style={styles.version}>Monde v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
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
    color: Colors.text,
  },
  profilePhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  menuGroup: {
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
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textLight,
    paddingBottom: 30,
    marginTop: Spacing.md,
  },
});
