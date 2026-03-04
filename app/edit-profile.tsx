import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { sanitizeText } from '../lib/validation';
import { formatPhone } from '../lib/helpers';
import * as api from '../lib/api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '../components/Avatar';
import Button from '../components/Button';

export default function EditProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const sessionId = useStore((s) => s.sessionId);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [handle, setHandle] = useState(user?.handle || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [handleError, setHandleError] = useState('');

  const hasChanges = sanitizeText(fullName) !== user?.full_name || avatarUrl !== (user?.avatar_url || null) || handle !== (user?.handle || '');

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);

    try {
      if (isSupabaseConfigured && sessionId) {
        const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${sessionId}/avatar.${ext}`;
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

        // Use FormData for React Native compatibility
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: `avatar.${ext}`,
          type: mimeType,
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData, { upsert: true, contentType: mimeType });

        if (uploadError) {
          setUploadingAvatar(false);
          Alert.alert('Upload Failed', uploadError.message);
          return;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
        setAvatarUrl(publicUrl);
      } else {
        // Offline: just use local URI
        setAvatarUrl(asset.uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload image.');
    }
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    const safeName = sanitizeText(fullName);
    if (safeName.length < 2) {
      Alert.alert('Invalid Name', 'Please enter at least 2 characters.');
      return;
    }

    // Validate handle
    const cleanHandle = handle.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9.]/g, '');
    if (cleanHandle && cleanHandle.length < 3) {
      setHandleError('Handle must be at least 3 characters.');
      return;
    }
    if (cleanHandle && cleanHandle !== (user?.handle || '')) {
      const available = await api.checkHandleAvailable(cleanHandle);
      if (!available) {
        setHandleError('This handle is already taken.');
        return;
      }
    }

    setLoading(true);
    const updates: { full_name: string; avatar_url?: string; handle?: string } = { full_name: safeName };
    if (avatarUrl !== (user?.avatar_url || null)) {
      updates.avatar_url = avatarUrl || undefined;
    }
    if (cleanHandle !== (user?.handle || '')) {
      updates.handle = cleanHandle || undefined;
    }

    if (isSupabaseConfigured && sessionId) {
      const { error } = await api.updateProfile(sessionId, updates);
      if (error) {
        setLoading(false);
        Alert.alert('Error', error as string);
        return;
      }
    }
    if (user) setUser({ ...user, full_name: safeName, avatar_url: avatarUrl || undefined, handle: cleanHandle || undefined });
    setLoading(false);
    Alert.alert('Saved', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Edit Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <TouchableOpacity style={styles.avatarSection} onPress={pickAvatar} activeOpacity={0.7}>
        <Avatar name={fullName || 'U'} size={80} imageUrl={avatarUrl} />
        <View style={styles.cameraOverlay}>
          {uploadingAvatar ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="camera" size={16} color={colors.white} />
          )}
        </View>
        <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            maxLength={60}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Handle</Text>
          <View style={[styles.handleRow, { backgroundColor: colors.surface, borderColor: handleError ? colors.error : colors.border }]}>
            <Text style={[styles.handleAt, { color: colors.textLight }]}>@</Text>
            <TextInput
              style={[styles.handleInput, { color: colors.text }]}
              value={handle}
              onChangeText={(t) => { setHandle(t.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9.]/g, '')); setHandleError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
            />
          </View>
          {handleError ? <Text style={[styles.handleErrorText, { color: colors.error }]}>{handleError}</Text> : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number</Text>
          <View style={[styles.readOnly, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textLight} />
            <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>{formatPhone(user?.phone || '')}</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
    marginBottom: Spacing.lg,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 20,
    right: '50%',
    marginRight: -40,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  changePhotoText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: FontSize.md,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  handleAt: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginRight: 2,
  },
  handleInput: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    fontSize: FontSize.md,
  },
  handleErrorText: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
  },
  readOnlyText: {
    fontSize: FontSize.md,
  },
  readOnlyHint: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginLeft: 'auto',
  },
  footer: {
    marginTop: Spacing.xl,
  },
});
