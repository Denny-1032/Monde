import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone } from '../lib/helpers';
import NumPad from '../components/NumPad';
import Button from '../components/Button';
import PinConfirm from '../components/PinConfirm';
import { verifyPin } from '../lib/api';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 5000];

export default function TopUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const topUp = useStore((s) => s.topUp);
  const linkedAccounts = useStore((s) => s.linkedAccounts);

  const [step, setStep] = useState<'provider' | 'amount' | 'confirm'>('amount');
  const [amount, setAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(user?.provider || 'airtel');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);

  const parsedAmount = parseFloat(amount) || 0;
  const provider = Providers.find((p) => p.id === selectedProvider);
  // Estimate fee (matches server-side calculation)
  const estimatedFee = parsedAmount > 0 ? Math.round((parsedAmount * 0.01 + 1) * 100) / 100 : 0;

  const handleNumPress = (key: string) => {
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    if (amount.length >= 10) return;
    setAmount((prev) => prev + key);
  };

  const handleDelete = () => {
    setAmount((prev) => prev.slice(0, -1));
  };

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleConfirm = () => {
    if (parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than zero.');
      return;
    }
    setPinError('');
    setShowPin(true);
  };

  const handlePinConfirm = async (pin: string) => {
    const phone = user?.phone || '';
    const { success: pinOk } = await verifyPin(phone, pin);
    if (!pinOk) {
      setPinError('Incorrect PIN');
      return;
    }
    setLoading(true);
    try {
      const result = await topUp(parsedAmount, selectedProvider, undefined, selectedAccountId);
      if (result.success) {
        router.replace({
          pathname: '/success',
          params: {
            amount: parsedAmount.toString(),
            recipientName: provider?.name || selectedProvider,
            type: 'topup',
            method: 'wallet',
          },
        });
      } else {
        Alert.alert('Top-Up Failed', result.error || 'Something went wrong.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Top-up failed.');
    } finally {
      setLoading(false);
      setShowPin(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Top Up Wallet</Text>
        <View style={{ width: 32 }} />
      </View>

      {step === 'amount' && (
        <>
          {/* Provider selector */}
          <TouchableOpacity
            style={styles.providerSelector}
            onPress={() => setStep('provider')}
            activeOpacity={0.7}
          >
            <View style={styles.providerLeft}>
              <View style={[styles.providerDot, { backgroundColor: provider?.color || Colors.primary }]} />
              <View>
                <Text style={styles.providerLabel}>From</Text>
                <Text style={styles.providerName}>{provider?.name || 'Select Provider'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Amount display */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountPrefix}>K</Text>
            <Text style={styles.amountValue}>{amount || '0'}</Text>
          </View>

          {/* Quick amounts */}
          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.quickBtn, amount === val.toString() && styles.quickBtnActive]}
                onPress={() => handleQuickAmount(val)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickBtnText, amount === val.toString() && styles.quickBtnTextActive]}>
                  K{val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* NumPad */}
          <NumPad onPress={handleNumPress} onDelete={handleDelete} showDecimal={true} />

          {/* Fee info */}
          {parsedAmount > 0 && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Estimated fee</Text>
              <Text style={styles.feeValue}>{formatCurrency(estimatedFee)}</Text>
            </View>
          )}

          {/* Confirm button */}
          <View style={styles.footer}>
            <Button
              title={loading ? 'Processing...' : `Top Up ${parsedAmount > 0 ? formatCurrency(parsedAmount) : ''}`}
              onPress={handleConfirm}
              disabled={parsedAmount <= 0 || loading}
              size="lg"
            />
          </View>
        </>
      )}

      {step === 'provider' && (
        <ScrollView style={styles.providerList} showsVerticalScrollIndicator={false}>
          {/* Linked Accounts — 1-tap selection */}
          {linkedAccounts.length > 0 && (
            <>
              <Text style={styles.providerListTitle}>Your Accounts</Text>
              {linkedAccounts.map((acc) => {
                const ap = Providers.find((p) => p.id === acc.provider);
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.providerItem, selectedProvider === acc.provider && styles.providerItemActive]}
                    onPress={() => {
                      setSelectedProvider(acc.provider);
                      setSelectedAccountId(acc.id);
                      setStep('amount');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.providerItemDot, { backgroundColor: ap?.color || Colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.providerItemName}>{acc.account_name}</Text>
                      <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>{ap?.name} · {formatPhone(acc.account_phone)}</Text>
                    </View>
                    {acc.is_default && (
                      <View style={{ backgroundColor: Colors.success + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: Colors.success }}>Default</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <Text style={[styles.providerListTitle, { marginTop: Spacing.lg }]}>All Providers</Text>
            </>
          )}
          {linkedAccounts.length === 0 && (
            <Text style={styles.providerListTitle}>Select Provider</Text>
          )}
          {Providers.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.providerItem, selectedProvider === p.id && styles.providerItemActive]}
              onPress={() => {
                setSelectedProvider(p.id);
                setSelectedAccountId(undefined);
                setStep('amount');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.providerItemDot, { backgroundColor: p.color }]} />
              <Text style={[styles.providerItemName, { flex: 1 }]}>{p.name}</Text>
              {selectedProvider === p.id && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* PIN Confirmation */}
      <PinConfirm
        visible={showPin}
        title="Authorize Top-Up"
        subtitle={`Top up ${formatCurrency(parsedAmount)} from ${provider?.name || 'provider'}`}
        onConfirm={handlePinConfirm}
        onCancel={() => { setShowPin(false); setPinError(''); }}
        loading={loading}
        error={pinError}
      />
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
  providerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  providerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  providerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  providerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  providerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  amountPrefix: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  amountValue: {
    fontSize: FontSize.hero + 8,
    fontWeight: '800',
    color: Colors.text,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  quickBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  quickBtnActive: {
    backgroundColor: Colors.primary,
  },
  quickBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  quickBtnTextActive: {
    color: Colors.white,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  feeLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  feeValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  providerList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  providerListTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  providerItemActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  providerItemDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  providerItemName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
});
