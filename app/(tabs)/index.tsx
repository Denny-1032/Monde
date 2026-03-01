import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../lib/helpers';
import TransactionItem from '../../components/TransactionItem';
import { HomeSkeleton } from '../../components/SkeletonLoader';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const transactions = useStore((s) => s.transactions);
  const fetchProfile = useStore((s) => s.fetchProfile);
  const fetchTransactions = useStore((s) => s.fetchTransactions);
  const recentTransactions = transactions.slice(0, 5);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchTransactions()]);
    setRefreshing(false);
  }, []);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <HomeSkeleton />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 10 }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] || 'User'}</Text>
          <Text style={styles.subGreeting}>What would you like to do?</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="person-circle-outline" size={36} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Balance Card */}
      <TouchableOpacity style={styles.balanceCard} activeOpacity={0.9} onPress={() => setBalanceHidden(!balanceHidden)}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Ionicons name={balanceHidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.white} style={{ opacity: 0.7 }} />
        </View>
        <Text style={styles.balanceAmount}>{balanceHidden ? 'K ••••••' : formatCurrency(user?.balance || 0)}</Text>
        <View style={styles.balanceProvider}>
          <View style={[styles.providerDot, { backgroundColor: Providers.find((p) => p.id === user?.provider)?.color || Colors.white }]} />
          <Text style={styles.providerText}>
            {Providers.find((p) => p.id === user?.provider)?.name || 'Airtel Money'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Quick Actions - THE 2 KEY FEATURES */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {/* Scan QR */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: Colors.primary }]}
            onPress={() => router.push('/scan')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="qr-code" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Scan QR</Text>
            <Text style={styles.actionDesc}>Scan to pay or receive</Text>
          </TouchableOpacity>

          {/* Tap to Pay */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: Colors.secondary }]}
            onPress={() => router.push('/tap')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="wifi" size={28} color={Colors.secondary} />
            </View>
            <Text style={styles.actionTitle}>Tap to Pay</Text>
            <Text style={styles.actionDesc}>Hold phones together</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Actions */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/receive')} activeOpacity={0.7}>
            <View style={[styles.secondaryIcon, { backgroundColor: Colors.success + '15' }]}>
              <Ionicons name="arrow-down-circle" size={22} color={Colors.success} />
            </View>
            <Text style={styles.secondaryLabel}>Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/payment')} activeOpacity={0.7}>
            <View style={[styles.secondaryIcon, { backgroundColor: Colors.primary + '15' }]}>
              <Ionicons name="send" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.secondaryLabel}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/(tabs)/history')} activeOpacity={0.7}>
            <View style={[styles.secondaryIcon, { backgroundColor: Colors.accent + '15' }]}>
              <Ionicons name="receipt" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.secondaryLabel}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.transactionsList}>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((txn) => (
              <TransactionItem
                key={txn.id}
                transaction={txn}
                onPress={() => router.push({ pathname: '/transaction', params: { id: txn.id } })}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={Colors.textLight} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/payment')} activeOpacity={0.7}>
                <Ionicons name="send" size={16} color={Colors.primary} />
                <Text style={styles.emptyCtaText}>Send your first payment</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  subGreeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notifBtn: {
    padding: 4,
  },
  balanceCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.8,
  },
  balanceAmount: {
    fontSize: FontSize.hero + 4,
    fontWeight: '800',
    color: Colors.white,
    marginTop: Spacing.xs,
  },
  balanceProvider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  providerText: {
    fontSize: FontSize.xs,
    color: Colors.white,
    fontWeight: '600',
  },
  actionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    minHeight: 150,
    justifyContent: 'flex-end',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  actionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  actionDesc: {
    fontSize: FontSize.xs,
    color: Colors.white,
    opacity: 0.85,
    marginTop: 2,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.lg,
  },
  secondaryAction: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  secondaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  recentSection: {
    paddingHorizontal: Spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  transactionsList: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.full,
  },
  emptyCtaText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
