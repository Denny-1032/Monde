import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useStore } from '../store/useStore';
import { formatCurrency, generateTransactionId } from '../lib/helpers';
import NumPad from '../components/NumPad';
import Button from '../components/Button';
import Avatar from '../components/Avatar';

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
  const addTransaction = useStore((s) => s.addTransaction);
  const updateBalance = useStore((s) => s.updateBalance);

  const [step, setStep] = useState<'details' | 'amount' | 'confirm'>(params.recipientName ? (params.amount ? 'confirm' : 'amount') : 'details');
  const [recipientName, setRecipientName] = useState(params.recipientName || '');
  const [recipientPhone, setRecipientPhone] = useState(params.recipientPhone || '');
  const [amount, setAmount] = useState(params.amount || '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const method = (params.method as 'qr' | 'nfc') || 'qr';

  const handleKeyPress = (key: string) => {
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    if (amount.length >= 10) return;
    setAmount((prev) => prev + key);
  };

  const handleDelete = () => setAmount((prev) => prev.slice(0, -1));

  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (parsedAmount > (user?.balance || 0)) {
      Alert.alert('Insufficient Balance', 'You do not have enough funds for this transaction.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      addTransaction({
        id: generateTransactionId(),
        type: 'send',
        amount: parsedAmount,
        currency: 'ZMW',
        recipient_name: recipientName || 'Unknown',
        recipient_phone: recipientPhone,
        provider: params.provider || user?.provider || 'airtel',
        status: 'completed',
        method,
        note: note || undefined,
        created_at: new Date().toISOString(),
      });
      updateBalance(-parsedAmount);
      setLoading(false);
      router.push({
        pathname: '/success',
        params: {
          amount: parsedAmount.toString(),
          recipientName: recipientName || 'Unknown',
          type: 'send',
          method,
        },
      });
    }, 1500);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 10 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 'confirm') setStep('amount');
          else if (step === 'amount' && !params.recipientName) setStep('details');
          else router.back();
        }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {step === 'details' ? 'Send Money' : step === 'amount' ? 'Enter Amount' : 'Confirm Payment'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step: Recipient Details */}
      {step === 'details' && (
        <View style={styles.stepContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recipient name</Text>
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
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="e.g. 0971234567"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
            />
          </View>
          <Button
            title="Next"
            onPress={() => setStep('amount')}
            disabled={!recipientName.trim() || !recipientPhone.trim()}
            size="lg"
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      )}

      {/* Step: Amount */}
      {step === 'amount' && (
        <View style={styles.amountContainer}>
          <Text style={styles.amountDisplay}>K{amount || '0'}</Text>
          <Text style={styles.balanceHint}>Balance: {formatCurrency(user?.balance || 0)}</Text>
          <NumPad onPress={handleKeyPress} onDelete={handleDelete} />
          <View style={styles.noteRow}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <Button
            title="Review"
            onPress={() => setStep('confirm')}
            disabled={!amount || parseFloat(amount) <= 0}
            size="lg"
            style={{ marginHorizontal: Spacing.lg }}
          />
        </View>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <View style={styles.confirmContainer}>
          <View style={styles.confirmCard}>
            <Avatar name={recipientName || 'U'} size={60} />
            <Text style={styles.confirmName}>{recipientName}</Text>
            <Text style={styles.confirmPhone}>{recipientPhone}</Text>
            <View style={styles.confirmDivider} />
            <Text style={styles.confirmAmountLabel}>Amount</Text>
            <Text style={styles.confirmAmount}>{formatCurrency(parseFloat(amount) || 0)}</Text>
            {note ? <Text style={styles.confirmNote}>"{note}"</Text> : null}
            <View style={styles.confirmMeta}>
              <View style={styles.confirmMetaItem}>
                <Ionicons name={method === 'qr' ? 'qr-code-outline' : 'wifi-outline'} size={16} color={Colors.textSecondary} />
                <Text style={styles.confirmMetaText}>via {method === 'qr' ? 'QR Code' : 'Tap to Pay'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.confirmActions}>
            <Button title="Confirm & Send" onPress={handleConfirm} size="lg" loading={loading} />
            <Button title="Cancel" onPress={() => router.back()} variant="ghost" />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
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
  amountContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  balanceHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  noteRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 4,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'center',
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
  confirmActions: {
    gap: Spacing.sm,
  },
});
