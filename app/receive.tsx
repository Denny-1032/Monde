import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useStore } from '../store/useStore';
import { generateQRData, formatCurrency } from '../lib/helpers';
import NumPad from '../components/NumPad';

export default function ReceiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const [amount, setAmount] = useState('');
  const [showAmountEntry, setShowAmountEntry] = useState(false);

  const qrPayload = generateQRData({
    app: 'monde',
    v: 1,
    phone: user?.phone || '',
    name: user?.full_name || '',
    provider: user?.provider || '',
    amount: amount ? parseFloat(amount) : undefined,
  });

  const handleKeyPress = (key: string) => {
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    if (amount.length >= 10) return;
    setAmount((prev) => prev + key);
  };

  const handleDelete = () => setAmount((prev) => prev.slice(0, -1));

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay me via Monde!\nName: ${user?.full_name}\nPhone: ${user?.phone}${amount ? `\nAmount: K${amount}` : ''}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Receive Money</Text>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {!showAmountEntry ? (
        <View style={styles.qrSection}>
          {/* QR Code Card */}
          <View style={styles.qrCard}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrPayload}
                size={200}
                color={Colors.text}
                backgroundColor={Colors.white}
              />
            </View>
            <Text style={styles.userName}>{user?.full_name}</Text>
            <Text style={styles.userPhone}>{user?.phone}</Text>
            {amount ? (
              <View style={styles.amountBadge}>
                <Text style={styles.amountBadgeText}>{formatCurrency(parseFloat(amount))}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.instruction}>Ask the sender to scan this QR code</Text>

          {/* Set Amount Button */}
          <TouchableOpacity style={styles.setAmountBtn} onPress={() => setShowAmountEntry(true)}>
            <Ionicons name="calculator-outline" size={20} color={Colors.primary} />
            <Text style={styles.setAmountText}>{amount ? 'Change amount' : 'Set amount (optional)'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Enter amount to request</Text>
          <Text style={styles.amountDisplay}>K{amount || '0'}</Text>
          <NumPad onPress={handleKeyPress} onDelete={handleDelete} />
          <View style={styles.amountActions}>
            <TouchableOpacity
              style={styles.amountDoneBtn}
              onPress={() => setShowAmountEntry(false)}
            >
              <Text style={styles.amountDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    marginBottom: Spacing.lg,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  qrSection: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  qrCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginHorizontal: Spacing.lg,
  },
  qrWrapper: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  userPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  amountBadge: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  amountBadgeText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  instruction: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  setAmountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.full,
  },
  setAmountText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  amountSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  amountActions: {
    paddingHorizontal: Spacing.lg,
    width: '100%',
    marginTop: Spacing.md,
  },
  amountDoneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
  },
  amountDoneBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
