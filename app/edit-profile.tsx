import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useStore } from '../store/useStore';
import { sanitizeText } from '../lib/validation';
import { formatPhone } from '../lib/helpers';
import * as api from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';
import Avatar from '../components/Avatar';
import Button from '../components/Button';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const sessionId = useStore((s) => s.sessionId);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [loading, setLoading] = useState(false);

  const provider = Providers.find((p) => p.id === user?.provider);
  const hasChanges = sanitizeText(fullName) !== user?.full_name;

  const handleSave = async () => {
    const safeName = sanitizeText(fullName);
    if (safeName.length < 2) {
      Alert.alert('Invalid Name', 'Please enter at least 2 characters.');
      return;
    }

    setLoading(true);
    if (isSupabaseConfigured && sessionId) {
      const { error } = await api.updateProfile(sessionId, { full_name: safeName });
      if (error) {
        setLoading(false);
        Alert.alert('Error', error as string);
        return;
      }
    }
    if (user) setUser({ ...user, full_name: safeName });
    setLoading(false);
    Alert.alert('Saved', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 10 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.avatarSection}>
        <Avatar name={fullName || 'U'} size={80} />
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={Colors.textLight}
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.readOnly}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textLight} />
            <Text style={styles.readOnlyText}>{formatPhone(user?.phone || '')}</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Provider</Text>
          <View style={styles.readOnly}>
            <View style={[styles.providerDot, { backgroundColor: provider?.color || Colors.primary }]} />
            <Text style={styles.readOnlyText}>{provider?.name || 'Unknown'}</Text>
            <Text style={styles.readOnlyHint}>Change in Profile settings</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Save Changes"
          onPress={handleSave}
          disabled={!hasChanges || loading}
          loading={loading}
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
    marginBottom: Spacing.lg,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  form: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
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
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
  },
  readOnlyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  readOnlyHint: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginLeft: 'auto',
  },
  providerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
});
