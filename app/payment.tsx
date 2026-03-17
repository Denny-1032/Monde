import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone, calcPaymentFee } from '../lib/helpers';
import { sanitizeText, validateAmount, isValidPhone } from '../lib/validation';
import { searchProfilesByPhone, lookupByHandle } from '../lib/api';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
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

  const colors = useColors();
  const user = useStore((s) => s.user);
  const sendPayment = useStore((s) => s.sendPayment);

  const hasPrefilledData = !!(params.recipientName && params.amount);
  const [step, setStep] = useState<'input' | 'confirm'>(hasPrefilledData ? 'confirm' : 'input');
  const [recipientName, setRecipientName] = useState(params.recipientName || '');
  const [recipientPhone, setRecipientPhone] = useState(params.recipientPhone || '');
  const [amount, setAmount] = useState(params.amount || '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

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

      // Handle lookup: if input starts with @, search by handle
      if (cleaned.startsWith('@') && cleaned.length >= 4) {
        setLookingUp(true);
        const result = await lookupByHandle(cleaned);
        setLookingUp(false);
        if (result.found && result.id !== user?.id) {
          results.push({
            id: result.id!,
            name: result.full_name!,
            phone: result.phone!,
            source: 'monde',
            avatar_url: result.avatar_url,
          });
          setRecipientName(result.full_name!);
          setRecipientPhone(result.phone!);
        }
        setSuggestions(results);
        return;
      }

      // Search device contacts by name or phone
      const lower = cleaned.toLowerCase();
      const contactMatches = deviceContacts.filter(
        (c) => c.name.toLowerCase().includes(lower) || c.phone.includes(cleaned)
      ).slice(0, 5);
      results.push(...contactMatches);

      // Search Monde users by phone (single call — reuse for both suggestions and auto-fill)
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
        // Auto-fill name if exact Monde match
        if (isValidPhone(cleaned) && data.length === 1 && data[0].id !== user?.id) {
          setRecipientName(data[0].full_name);
        }
      }

      setSuggestions(results);
    }, 400);
  }, [deviceContacts, user?.id]);

  const selectSuggestion = (s: ContactSuggestion) => {
    setRecipientPhone(s.phone);
    setRecipientName(s.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleReview = () => {
    // Block agents from using Send Money
    if (user?.is_agent) {
      Alert.alert('Agent Account', 'Agent accounts cannot send money directly. Use "Deposit" to credit a customer or "Agent Transfer" to send to another agent.');
      return;
    }
    // Prevent send-to-self
    const cleanedPhone = recipientPhone.replace(/[^0-9+]/g, '');
    const userPhone = user?.phone || '';
    if (cleanedPhone === userPhone || cleanedPhone === userPhone.replace('+260', '0') || `+260${cleanedPhone.replace(/^0/, '')}` === userPhone) {
      Alert.alert('Invalid Recipient', 'You cannot send money to yourself.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    const fee = calcPaymentFee(parsedAmount);
    const check = validateAmount(parsedAmount, user?.balance || 0);
    if (!check.valid) {
      Alert.alert('Invalid Amount', check.error);
      return;
    }
    if ((parsedAmount + fee) > (user?.balance || 0)) {
      Alert.alert('Insufficient Balance', `You need ${formatCurrency(parsedAmount + fee)} (${formatCurrency(parsedAmount)} + ${formatCurrency(fee)} fee) but your balance is ${formatCurrency(user?.balance || 0)}.`);
      return;
    }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setLoading(true);
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
    } else if (result.error) {
      Alert.alert('Payment Failed', result.error);
    }
  };

  return (
    <>
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 'confirm') setStep('input');
          else router.back();
        }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {step === 'input' ? 'Send Money' : 'Confirm Payment'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {step === 'input' && (
        <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Phone / Contact search */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>To (phone or name)</Text>
            <TextInput
              ref={phoneRef}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={recipientPhone}
              onChangeText={handlePhoneChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              keyboardType="default"
              autoFocus={!params.recipientPhone}
              autoCorrect={false}
              maxLength={30}
            />
            {lookingUp && (
              <ActivityIndicator size="small" color={colors.primary} style={{ position: 'absolute', right: 12, top: 36 }} />
            )}
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={[styles.suggestionsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {suggestions.map((s) => (
                  <TouchableOpacity key={s.id + s.phone} style={[styles.suggestionItem, { borderBottomColor: colors.borderLight }]} onPress={() => selectSuggestion(s)}>
                    <Avatar name={s.name} size={34} imageUrl={s.avatar_url} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionName, { color: colors.text }]}>{s.name}</Text>
                      <Text style={[styles.suggestionPhone, { color: colors.textSecondary }]}>{formatPhone(s.phone)}</Text>
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
              <Ionicons name="person-circle" size={20} color={colors.primary} />
              <Text style={[styles.recipientPreviewText, { color: colors.primary }]}>{recipientName}</Text>
              <TouchableOpacity onPress={() => setRecipientName('')}>
                <Ionicons name="close-circle" size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text>
            <TextInput
              style={[styles.input, styles.amountInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={amount}
              onChangeText={(t) => {
                if (/^\d*\.?\d{0,2}$/.test(t)) setAmount(t);
              }}
              keyboardType="decimal-pad"
              maxLength={10}
            />
            <Text style={[styles.balanceHint, { color: colors.textSecondary }]}>Balance: {formatCurrency(user?.balance || 0)}</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Note (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={note}
              onChangeText={(t) => setNote(t.slice(0, 140))}
              maxLength={140}
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
          <View style={[styles.confirmCard, { backgroundColor: colors.surface }]}>
            <Avatar name={recipientName || recipientPhone} size={60} />
            <Text style={[styles.confirmName, { color: colors.text }]}>{recipientName || recipientPhone}</Text>
            {recipientName ? <Text style={[styles.confirmPhone, { color: colors.textSecondary }]}>{formatPhone(recipientPhone)}</Text> : null}
            <View style={[styles.confirmDivider, { backgroundColor: colors.borderLight }]} />
            <Text style={[styles.confirmAmountLabel, { color: colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.confirmAmount, { color: colors.primary }]}>{formatCurrency(parseFloat(amount) || 0)}</Text>
            {calcPaymentFee(parseFloat(amount) || 0) > 0 && (
              <>
                <Text style={[styles.confirmFee, { color: colors.textSecondary }]}>Fee: {formatCurrency(calcPaymentFee(parseFloat(amount) || 0))}</Text>
                <Text style={[styles.confirmFee, { color: colors.text, fontWeight: '600', marginTop: 2 }]}>Total: {formatCurrency((parseFloat(amount) || 0) + calcPaymentFee(parseFloat(amount) || 0))}</Text>
              </>
            )}
            {note ? <Text style={[styles.confirmNote, { color: colors.textSecondary }]}>"{note}"</Text> : null}
            <View style={styles.confirmMeta}>
              <View style={styles.confirmMetaItem}>
                <Ionicons name={method === 'qr' ? 'qr-code-outline' : method === 'nfc' ? 'wifi-outline' : 'send-outline'} size={16} color={colors.textSecondary} />
                <Text style={[styles.confirmMetaText, { color: colors.textSecondary }]}>via {method === 'qr' ? 'QR Code' : method === 'nfc' ? 'Tap to Pay' : 'Monde'}</Text>
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

    </>
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
  amountInput: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  balanceHint: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  suggestionsBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
    borderBottomColor: undefined, // set dynamically
  },
  suggestionName: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  suggestionPhone: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  mondeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '15',
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
  },
  confirmContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  confirmCard: {
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
    marginTop: Spacing.md,
  },
  confirmPhone: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  confirmDivider: {
    width: '100%',
    height: 1,
    marginVertical: Spacing.lg,
  },
  confirmAmountLabel: {
    fontSize: FontSize.sm,
  },
  confirmAmount: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    marginTop: Spacing.xs,
  },
  confirmFee: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  confirmNote: {
    fontSize: FontSize.sm,
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
  },
  confirmActions: {
    gap: Spacing.sm,
  },
});
