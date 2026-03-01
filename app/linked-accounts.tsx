import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useStore } from '../store/useStore';
import { formatPhone } from '../lib/helpers';
import Button from '../components/Button';

export default function LinkedAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const linkedAccounts = useStore((s) => s.linkedAccounts);
  const fetchLinkedAccounts = useStore((s) => s.fetchLinkedAccounts);
  const addLinkedAccount = useStore((s) => s.addLinkedAccount);
  const removeLinkedAccount = useStore((s) => s.removeLinkedAccount);
  const setDefaultLinkedAccount = useStore((s) => s.setDefaultLinkedAccount);

  const [showAdd, setShowAdd] = useState(false);
  const [addProvider, setAddProvider] = useState('');
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchLinkedAccounts();
  }, []);

  const handleAdd = async () => {
    if (!addProvider) {
      Alert.alert('Error', 'Please select a provider.');
      return;
    }
    if (!addName.trim()) {
      Alert.alert('Error', 'Please enter the account holder name.');
      return;
    }
    if (!addPhone.trim() || addPhone.trim().length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    setAddLoading(true);
    const result = await addLinkedAccount(
      addProvider,
      addName.trim(),
      addPhone.trim(),
      linkedAccounts.length === 0, // First account is default
    );
    setAddLoading(false);

    if (result.success) {
      setShowAdd(false);
      setAddProvider('');
      setAddName('');
      setAddPhone('');
      Alert.alert('Account Linked', 'Your account has been linked successfully.');
    } else {
      Alert.alert('Error', result.error || 'Failed to link account.');
    }
  };

  const handleRemove = (id: string, name: string) => {
    Alert.alert('Remove Account', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await removeLinkedAccount(id);
          if (!result.success) Alert.alert('Error', result.error || 'Failed to remove.');
        },
      },
    ]);
  };

  const handleSetDefault = async (id: string) => {
    const result = await setDefaultLinkedAccount(id);
    if (!result.success) Alert.alert('Error', result.error || 'Failed to set default.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Linked Accounts</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Link your mobile money and bank accounts for 1-tap top ups and withdrawals.
          </Text>
        </View>

        {linkedAccounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={56} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No linked accounts</Text>
            <Text style={styles.emptyText}>
              Add your Airtel Money, MTN MoMo, or bank account for faster transactions.
            </Text>
            <Button title="Link an Account" onPress={() => setShowAdd(true)} size="md" />
          </View>
        ) : (
          linkedAccounts.map((account) => {
            const prov = Providers.find((p) => p.id === account.provider);
            return (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountTop}>
                  <View style={[styles.providerDot, { backgroundColor: prov?.color || Colors.primary }]} />
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{account.account_name}</Text>
                    <Text style={styles.accountPhone}>{formatPhone(account.account_phone)}</Text>
                    <Text style={styles.accountProvider}>{prov?.name || account.provider}</Text>
                  </View>
                  {account.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  )}
                </View>
                <View style={styles.accountActions}>
                  {!account.is_default && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleSetDefault(account.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="star-outline" size={16} color={Colors.primary} />
                      <Text style={styles.actionText}>Set Default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.removeBtn]}
                    onPress={() => handleRemove(account.id, account.account_name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    <Text style={[styles.actionText, { color: Colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link Account</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Provider Picker */}
            <Text style={styles.fieldLabel}>Provider</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.providerScroll}>
              {Providers.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.providerChip, addProvider === p.id && { backgroundColor: p.color + '20', borderColor: p.color }]}
                  onPress={() => setAddProvider(p.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.chipDot, { backgroundColor: p.color }]} />
                  <Text style={[styles.chipText, addProvider === p.id && { color: p.color, fontWeight: '700' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Account Name */}
            <Text style={styles.fieldLabel}>Account Holder Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Banda"
              placeholderTextColor={Colors.textLight}
              value={addName}
              onChangeText={setAddName}
              autoCapitalize="words"
            />

            {/* Phone Number */}
            <Text style={styles.fieldLabel}>Phone / Account Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 0971234567"
              placeholderTextColor={Colors.textLight}
              value={addPhone}
              onChangeText={setAddPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.modalFooter}>
              <Button
                title={addLoading ? 'Linking...' : 'Link Account'}
                onPress={handleAdd}
                disabled={!addProvider || !addName.trim() || !addPhone.trim() || addLoading}
                size="lg"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  accountCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  accountTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  providerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  accountPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  accountProvider: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 1,
  },
  defaultBadge: {
    backgroundColor: Colors.success + '18',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  defaultText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.success,
  },
  accountActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeBtn: {},
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  providerScroll: {
    flexGrow: 0,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  modalFooter: {
    marginTop: Spacing.xl,
  },
});
