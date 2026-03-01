import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone } from '../lib/helpers';
import { sanitizeText, validateAmount, isValidPhone } from '../lib/validation';
import { verifyPin, searchProfilesByPhone } from '../lib/api';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import PinConfirm from '../components/PinConfirm';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';

type ContactSuggestion = {
  id: string;
  name: string;
  phone: string;
  source: 'monde' | 'contact';
  avatar_url?: string;
};

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

  const hasPrefilledData = !!(params.recipientName && params.amount);
  const [step, setStep] = useState<'input' | 'confirm'>(hasPrefilledData ? 'confirm' : 'input');
  const [recipientName, setRecipientName] = useState(params.recipientName || '');
  const [recipientPhone, setRecipientPhone] = useState(params.recipientPhone || '');
  const [amount, setAmount] = useState(params.amount || '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [pinError, setPinError] = useState('');

  // Contact & user lookup
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [deviceContacts, setDeviceContacts] = useState<ContactSuggestion[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout>>();

  const method = (params.method as 'qr' | 'nfc' | 'manual') || 'manual';
  const canReview = isValidPhone(recipientPhone) && parseFloat(amount) > 0;

  // Load device contacts on mount
  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      if (Platform.OS === 'web') return;
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      const mapped: ContactSuggestion[] = [];
      for (const c of data) {
        if (c.phoneNumbers && c.phoneNumbers.length > 0 && c.name) {
          const ph = c.phoneNumbers[0].number?.replace(/[^0-9+]/g, '') || '';
          if (ph.length >= 9) {
            mapped.push({ id: c.id || ph, name: c.name, phone: ph, source: 'contact' });
          }
        }
      }
      setDeviceContacts(mapped);
    } catch {
      // Contacts not available (e.g. web)
    }
  };

  // Debounced phone lookup — search Monde users + device contacts
  const handlePhoneChange = useCallback((text: string) => {
    setRecipientPhone(text);
    setShowSuggestions(true);

    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    const cleaned = text.replace(/[^0-9a-zA-Z@+]/g, '');
    if (cleaned.length < 3) {
      setSuggestions([]);
      setRecipientName('');
      return;
    }

    lookupTimer.current = setTimeout(async () => {
      const results: ContactSuggestion[] = [];

      // Search device contacts by name or phone
      const lower = cleaned.toLowerCase();
      const contactMatches = deviceContacts.filter(
        (c) => c.name.toLowerCase().includes(lower) || c.phone.includes(cleaned)
      ).slice(0, 5);
      results.push(...contactMatches);

      // Search Monde users by phone
      if (/^\d{3,}$/.test(cleaned)) {
        setLookingUp(true);
        const { data } = await searchProfilesByPhone(cleaned);
        setLookingUp(false);
        for (const p of data) {
          if (p.id !== user?.id && !results.find((r) => r.phone === p.phone)) {
            results.push({
              id: p.id,
              name: p.full_name,
              phone: p.phone,
              source: 'monde',
              avatar_url: p.avatar_url,
            });
          }
        }
      }

      setSuggestions(results);

      // Auto-fill name if exact match from Monde
      if (isValidPhone(cleaned)) {
        const { data } = await searchProfilesByPhone(cleaned);
        if (data.length === 1 && data[0].id !== user?.id) {
          setRecipientName(data[0].full_name);
        }
      }
    }, 400);
  }, [deviceContacts, user?.id]);

  const selectSuggestion = (s: ContactSuggestion) => {
    setRecipientPhone(s.phone);
    setRecipientName(s.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

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
    const phone = user?.phone || '';
    setLoading(true);
    const { success: pinOk } = await verifyPin(phone, pin);
    if (!pinOk) {
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
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 10 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      {step === 'input' && (
        <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Phone / Contact search */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>To (phone or name)</Text>
            <TextInput
              ref={phoneRef}
              style={styles.input}
              value={recipientPhone}
              onChangeText={handlePhoneChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              keyboardType="default"
              autoFocus={!params.recipientPhone}
              autoCorrect={false}
            />
            {lookingUp && (
              <ActivityIndicator size="small" color={Colors.primary} style={{ position: 'absolute', right: 12, top: 36 }} />
            )}
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {suggestions.map((s) => (
                  <TouchableOpacity key={s.id + s.phone} style={styles.suggestionItem} onPress={() => selectSuggestion(s)}>
                    <Avatar name={s.name} size={34} imageUrl={s.avatar_url} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionName}>{s.name}</Text>
                      <Text style={styles.suggestionPhone}>{formatPhone(s.phone)}</Text>
                    </View>
                    {s.source === 'monde' && (
                      <View style={styles.mondeBadge}>
                        <Text style={styles.mondeBadgeText}>Monde</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Auto-filled name (editable) */}
          {recipientName ? (
            <View style={styles.recipientPreview}>
              <Ionicons name="person-circle" size={20} color={Colors.primary} />
              <Text style={styles.recipientPreviewText}>{recipientName}</Text>
              <TouchableOpacity onPress={() => setRecipientName('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amount}
              onChangeText={(t) => {
                if (/^\d*\.?\d{0,2}$/.test(t)) setAmount(t);
              }}
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

      {step === 'confirm' && (
        <View style={styles.confirmContainer}>
          <View style={styles.confirmCard}>
            <Avatar name={recipientName || recipientPhone} size={60} />
            <Text style={styles.confirmName}>{recipientName || recipientPhone}</Text>
            {recipientName ? <Text style={styles.confirmPhone}>{formatPhone(recipientPhone)}</Text> : null}
            <View style={styles.confirmDivider} />
            <Text style={styles.confirmAmountLabel}>Amount</Text>
            <Text style={styles.confirmAmount}>{formatCurrency(parseFloat(amount) || 0)}</Text>
            {note ? <Text style={styles.confirmNote}>"{note}"</Text> : null}
            <View style={styles.confirmMeta}>
              <View style={styles.confirmMetaItem}>
                <Ionicons name={method === 'qr' ? 'qr-code-outline' : method === 'nfc' ? 'wifi-outline' : 'send-outline'} size={16} color={Colors.textSecondary} />
                <Text style={styles.confirmMetaText}>via {method === 'qr' ? 'QR Code' : method === 'nfc' ? 'Tap to Pay' : 'Monde'}</Text>
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
    position: 'relative',
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
  suggestionsBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    maxHeight: 220,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  suggestionPhone: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  mondeBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  mondeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  recipientPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '10',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    marginTop: -Spacing.sm,
  },
  recipientPreviewText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
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
