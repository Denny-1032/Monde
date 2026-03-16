import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone, calcTopUpFee } from '../lib/helpers';
import NumPad from '../components/NumPad';
import Button from '../components/Button';

const LIPILA_ENABLED = process.env.EXPO_PUBLIC_LIPILA_ENABLED === 'true';
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 5000];
const BANK_PROVIDERS = new Set(['fnb', 'zanaco', 'absa']);

export default function TopUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const user = useStore((s) => s.user);
  const topUp = useStore((s) => s.topUp);
  const linkedAccounts = useStore((s) => s.linkedAccounts);

  const [step, setStep] = useState<'provider' | 'amount' | 'confirm'>('amount');
  const [amount, setAmount] = useState('');
  // Filter out bank accounts for top-up (Lipila doesn't support bank top-ups)
  const momoAccounts = linkedAccounts.filter((a) => !BANK_PROVIDERS.has(a.provider));
  const defaultAccount = momoAccounts.find((a) => a.is_default) || momoAccounts[0];
  const [selectedProvider, setSelectedProvider] = useState(defaultAccount?.provider || user?.provider || 'airtel');
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(defaultAccount?.id);

  // Auto-select default linked account if loaded after initial render
  useEffect(() => {
    if (!selectedAccountId && momoAccounts.length > 0) {
      const def = momoAccounts.find((a) => a.is_default) || momoAccounts[0];
      setSelectedProvider(def.provider);
      setSelectedAccountId(def.id);
    }
  }, [linkedAccounts]);

  const parsedAmount = parseFloat(amount) || 0;
  const provider = Providers.find((p) => p.id === selectedProvider);
  const estimatedFee = calcTopUpFee(parsedAmount);

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
    if (parsedAmount < 5) {
      Alert.alert('Amount Too Small', 'Minimum top-up amount is K5.');
      return;
    }
    if (parsedAmount > 50000) {
      Alert.alert('Amount Too Large', 'Maximum top-up amount is K50,000.');
      return;
    }
    processTopUpAction();
  };

  const processTopUpAction = async () => {
    setLoading(true);
    try {
      const result = await topUp(parsedAmount, selectedProvider, undefined, selectedAccountId);
      if (result.success) {
        router.replace({
          pathname: '/success',
          params: {
            amount: parsedAmount.toString(),
            recipientName: selectedProvider === 'test_deposit' ? 'Test Deposit' : (provider?.name || selectedProvider),
            type: 'topup',
            method: 'wallet',
            status: (result as any).status || 'completed',
          },
        });
      } else if (result.error) {
        Alert.alert('Top-Up Failed', result.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Top-up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Top Up Wallet</Text>
        <View style={{ width: 32 }} />
      </View>

      {step === 'amount' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Provider selector */}
          <TouchableOpacity
            style={[styles.providerSelector, { backgroundColor: colors.surface }]}
            onPress={() => setStep('provider')}
            activeOpacity={0.7}
          >
            <View style={styles.providerLeft}>
              <View style={[styles.providerDot, { backgroundColor: selectedProvider === 'test_deposit' ? colors.success : (provider?.color || colors.primary) }]} />
              <View>
                <Text style={[styles.providerLabel, { color: colors.textLight }]}>From</Text>
                <Text style={[styles.providerName, { color: colors.text }]}>
                  {selectedProvider === 'test_deposit' ? 'Test Deposit' : (selectedAccountId ? (linkedAccounts.find((a) => a.id === selectedAccountId)?.account_name || provider?.name) : (provider?.name || 'Select Provider'))}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          {/* Amount display */}
          <View style={styles.amountContainer}>
            <Text style={[styles.amountPrefix, { color: colors.textSecondary }]}>K</Text>
            <Text style={[styles.amountValue, { color: colors.text }]}>{amount || '0'}</Text>
          </View>

          {/* Quick amounts */}
          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.quickBtn, { backgroundColor: amount === val.toString() ? colors.primary : colors.surfaceAlt }]}
                onPress={() => handleQuickAmount(val)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickBtnText, { color: amount === val.toString() ? colors.white : colors.textSecondary }]}>
                  K{val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* NumPad */}
          <NumPad onPress={handleNumPress} onDelete={handleDelete} showDecimal={true} />

          {/* Fee breakdown */}
          {parsedAmount > 0 && (
            <View style={styles.feeSection}>
              <View style={styles.feeRow}>
                <Text style={[styles.feeLabel, { color: colors.text, fontWeight: '600' }]}>You receive</Text>
                <Text style={[styles.feeValue, { color: colors.success, fontWeight: '700' }]}>{formatCurrency(parsedAmount)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Fee (3%)</Text>
                <Text style={[styles.feeValue, { color: colors.textSecondary }]}>{formatCurrency(estimatedFee)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Charged from {selectedProvider === 'test_deposit' ? 'test source' : (provider?.name || 'source')}</Text>
                <Text style={[styles.feeValue, { color: colors.textSecondary, fontWeight: '600' }]}>{formatCurrency(parsedAmount + estimatedFee)}</Text>
              </View>
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
        </ScrollView>
      )}

      {step === 'provider' && (
        <ScrollView style={styles.providerList} showsVerticalScrollIndicator={false}>
          {/* Mobile Money Accounts only (banks excluded — Lipila doesn't support bank top-ups) */}
          {momoAccounts.length > 0 && (
            <>
              <Text style={[styles.providerListTitle, { color: colors.text }]}>Your Accounts</Text>
              {[...momoAccounts].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)).map((acc) => {
                const ap = Providers.find((p) => p.id === acc.provider);
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.providerItem, { backgroundColor: colors.surface }, selectedAccountId === acc.id && { borderWidth: 2, borderColor: colors.primary }]}
                    onPress={() => {
                      setSelectedProvider(acc.provider);
                      setSelectedAccountId(acc.id);
                      setStep('amount');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.providerItemDot, { backgroundColor: ap?.color || colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.providerItemName, { color: colors.text }]}>{acc.account_name}</Text>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>{ap?.name} · {formatPhone(acc.account_phone)}</Text>
                    </View>
                    {acc.is_default && (
                      <View style={{ backgroundColor: colors.success + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: colors.success }}>Default</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {momoAccounts.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
              <Ionicons name="wallet-outline" size={48} color={colors.textLight} />
              <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: '600', marginTop: Spacing.md, textAlign: 'center' }}>
                No mobile money accounts
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xl }}>
                Link your Airtel Money, MTN MoMo, or Zamtel account to top up.
              </Text>
              <TouchableOpacity
                style={{ marginTop: Spacing.lg, backgroundColor: colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg }}
                onPress={() => router.push('/linked-accounts')}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.white, fontWeight: '600', fontSize: FontSize.md }}>Link an Account</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Test Deposit — only visible when Lipila is NOT enabled (dev/testing) */}
          {!LIPILA_ENABLED && (
            <>
              <Text style={[styles.providerListTitle, { marginTop: Spacing.lg, color: colors.textSecondary }]}>Testing</Text>
              <TouchableOpacity
                style={[styles.providerItem, { backgroundColor: colors.surface, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.borderLight }]}
                onPress={() => {
                  setSelectedProvider('test_deposit');
                  setSelectedAccountId(undefined);
                  setStep('amount');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.providerItemDot, { backgroundColor: colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerItemName, { color: colors.text }]}>Test Deposit</Text>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Add fake money for testing</Text>
                </View>
                <Ionicons name="flask-outline" size={20} color={colors.success} />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

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
  providerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
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
  },
  providerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
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
    marginRight: Spacing.xs,
  },
  amountValue: {
    fontSize: FontSize.hero + 8,
    fontWeight: '800',
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
  },
  quickBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  feeSection: {
    paddingVertical: Spacing.xs,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs + 2,
  },
  feeLabel: {
    fontSize: FontSize.sm,
  },
  feeValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
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
    marginBottom: Spacing.md,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
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
  },
});
