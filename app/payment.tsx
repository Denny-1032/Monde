import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/helpers';
import { sanitizeText, validateAmount, getProviderInfo, isValidPhone } from '../lib/validation';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import PinConfirm from '../components/PinConfirm';
import * as Haptics from 'expo-haptics';

export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    recipientName?: string;
    recipientPhone?: string;
    provider?: string;
    amount?: string;
    method?: string;
  }>();

  const user = useStore((s) => s.user);
  const sendPayment = useStore((s) => s.sendPayment);

  // If coming from QR/NFC with all details, go straight to confirm
  const hasPrefilledData = !!(params.recipientName && params.amount);
  const [step, setStep] = useState<'input' | 'confirm'>(hasPrefilledData ? 'confirm' : 'input');
  const [recipientName, setRecipientName] = useState(params.recipientName || '');
  const [recipientPhone, setRecipientPhone] = useState(params.recipientPhone || '');
  const [amount, setAmount] = useState(params.amount || '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [pinError, setPinError] = useState('');

  const method = (params.method as 'qr' | 'nfc' | 'manual') || 'manual';

  const recipientProvider = getProviderInfo(recipientPhone);
  const senderProvider = Providers.find((p) => p.id === user?.provider);
  const isCrossProvider = recipientProvider && senderProvider && recipientProvider.id !== senderProvider.id;
  const canReview = isValidPhone(recipientPhone) && parseFloat(amount) > 0;

  const handleReview = () => {
    const parsedAmount = parseFloat(amount);
    const check = validateAmount(parsedAmount, user?.balance || 0);
    if (!check.valid) {
      Alert.alert('Invalid Amount', check.error);
      return;
    }
    setStep('confirm');
  };

  const handleConfirm = () => {
    setPinError('');
    setShowPinConfirm(true);
  };

  const handlePinConfirm = async (pin: string) => {
    // Verify PIN by re-authenticating
    const phone = user?.phone || '';
    const signIn = useStore.getState().signIn;
    setLoading(true);
    const authResult = await signIn(phone, pin);
    if (!authResult.success) {
      setLoading(false);
      setPinError('Incorrect PIN. Try again.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    const safeName = sanitizeText(recipientName) || 'Unknown';
    const safeNote = note ? sanitizeText(note) : undefined;
    const result = await sendPayment(
      recipientPhone.replace(/[^0-9+]/g, ''),
      safeName,
      parsedAmount,
      method,
      safeNote,
    );
    setLoading(false);
    setShowPinConfirm(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: '/success',
        params: {
          amount: parsedAmount.toString(),
          recipientName: recipientName || 'Unknown',
          type: 'send',
          method,
        },
      });
    } else {
      Alert.alert('Payment Failed', result.error || 'Something went wrong.');
    }
  };

  return (
    <>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 10 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 'confirm') setStep('input');
          else router.back();
        }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {step === 'input' ? 'Send Money' : 'Confirm Payment'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Single input screen: recipient + amount + note */}
      {step === 'input' && (
        <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="e.g. 0971234567"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              autoFocus={!params.recipientPhone}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="e.g. Chanda Mwila"
              placeholderTextColor={Colors.textLight}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amount}
              onChangeText={(t) => {
                if (/^\d*\.?\d{0,2}$/.test(t)) setAmount(t);
              }}
              placeholder="0.00"
              placeholderTextColor={Colors.textLight}
              keyboardType="decimal-pad"
            />
            <Text style={styles.balanceHint}>Balance: {formatCurrency(user?.balance || 0)}</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="What's this for?"
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <Button
            title="Review & Send"
            onPress={handleReview}
            disabled={!canReview}
            size="lg"
            style={{ marginTop: Spacing.md, marginBottom: 40 }}
          />
        </ScrollView>
      )}

      {/* Confirm */}
      {step === 'confirm' && (
        <View style={styles.confirmContainer}>
          <View style={styles.confirmCard}>
            <Avatar name={recipientName || recipientPhone} size={60} />
            <Text style={styles.confirmName}>{recipientName || recipientPhone}</Text>
            {recipientName ? <Text style={styles.confirmPhone}>{recipientPhone}</Text> : null}
            <View style={styles.confirmDivider} />
            <Text style={styles.confirmAmountLabel}>Amount</Text>
            <Text style={styles.confirmAmount}>{formatCurrency(parseFloat(amount) || 0)}</Text>
            {note ? <Text style={styles.confirmNote}>"{note}"</Text> : null}
            <View style={styles.confirmMeta}>
              <View style={styles.confirmMetaItem}>
                <Ionicons name={method === 'qr' ? 'qr-code-outline' : method === 'nfc' ? 'wifi-outline' : 'send-outline'} size={16} color={Colors.textSecondary} />
                <Text style={styles.confirmMetaText}>via {method === 'qr' ? 'QR Code' : method === 'nfc' ? 'Tap to Pay' : 'Manual'}</Text>
              </View>
              {recipientProvider ? (
                <View style={styles.confirmMetaItem}>
                  <View style={[styles.providerDot, { backgroundColor: recipientProvider.color }]} />
                  <Text style={styles.confirmMetaText}>{recipientProvider.name}</Text>
                  {isCrossProvider ? (
                    <View style={styles.crossBadge}>
                      <Ionicons name="swap-horizontal" size={12} color={Colors.secondary} />
                      <Text style={styles.crossBadgeText}>Cross-provider</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.confirmActions}>
            <Button title="Confirm & Send" onPress={handleConfirm} size="lg" loading={loading} />
            <Button title="Cancel" onPress={() => router.back()} variant="ghost" />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>

    <PinConfirm
      visible={showPinConfirm}
      title="Authorize Payment"
      subtitle={`Send ${formatCurrency(parseFloat(amount) || 0)} to ${recipientName || 'recipient'}`}
      onConfirm={handlePinConfirm}
      onCancel={() => { setShowPinConfirm(false); setPinError(''); }}
      loading={loading}
      error={pinError}
    />
    </>
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
  stepContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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
  amountInput: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  balanceHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  confirmContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  confirmCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  confirmName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  confirmPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  confirmDivider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.lg,
  },
  confirmAmountLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  confirmAmount: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  confirmNote: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  confirmMeta: {
    marginTop: Spacing.lg,
  },
  confirmMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  confirmMetaText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  providerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  crossBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.xs,
  },
  crossBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.secondary,
  },
  confirmActions: {
    gap: Spacing.sm,
  },
});
