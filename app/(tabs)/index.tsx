import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useColors } from '../../constants/useColors';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../lib/helpers';
import TransactionItem from '../../components/TransactionItem';
import { HomeSkeleton } from '../../components/SkeletonLoader';
import { preventScreenCapture } from '../../lib/security';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const transactions = useStore((s) => s.transactions);
  const fetchProfile = useStore((s) => s.fetchProfile);
  const fetchTransactions = useStore((s) => s.fetchTransactions);
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(true);
  const retryCount = React.useRef(0);
  const [profileError, setProfileError] = useState(false);

  // M2: Prevent screenshots on balance screen
  useEffect(() => preventScreenCapture(), []);

  // If authenticated but no user profile, retry fetching with increasing delays
  React.useEffect(() => {
    if (isAuthenticated && !user && retryCount.current < 3) {
      retryCount.current += 1;
      setProfileError(false);
      const delay = retryCount.current === 1 ? 500 : 1500;
      const timer = setTimeout(async () => {
        await fetchProfile();
        // If still no profile after fetchProfile, try full initSession
        if (!useStore.getState().user) {
          await useStore.getState().initSession();
        }
        // After final retry, show error if still no profile
        if (!useStore.getState().user && retryCount.current >= 3) {
          setProfileError(true);
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  const handleManualRetry = React.useCallback(async () => {
    setProfileError(false);
    retryCount.current = 0;
    await useStore.getState().initSession();
    if (!useStore.getState().user) {
      setProfileError(true);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchTransactions()]);
    setRefreshing(false);
  }, []);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
        {profileError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textLight} />
            <Text style={{ color: colors.text, fontSize: FontSize.lg, fontWeight: '600', marginTop: Spacing.md, textAlign: 'center' }}>
              Couldn't load your profile
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm, textAlign: 'center' }}>
              Please check your connection and try again.
            </Text>
            <TouchableOpacity
              onPress={handleManualRetry}
              style={{ marginTop: Spacing.lg, backgroundColor: colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg }}
            >
              <Text style={{ color: colors.white, fontWeight: '600', fontSize: FontSize.md }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <HomeSkeleton />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.text }]}>Hello, {user?.full_name?.split(' ')[0] || 'User'}</Text>
          <Text style={[styles.subGreeting, { color: colors.textSecondary }]}>What would you like to do?</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Profile" accessibilityRole="button">
          <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Balance Card */}
      <TouchableOpacity style={[styles.balanceCard, { backgroundColor: colors.primary }]} activeOpacity={0.9} onPress={() => setBalanceHidden(!balanceHidden)} accessibilityLabel={balanceHidden ? 'Show balance' : 'Hide balance'} accessibilityRole="button">
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>{user?.is_agent ? 'Agent Float' : 'Available Balance'}</Text>
          <Ionicons name={balanceHidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.white} style={{ opacity: 0.7 }} />
        </View>
        <Text style={styles.balanceAmount}>{balanceHidden ? 'K ••••••' : formatCurrency(user?.balance || 0)}</Text>
        {user?.is_agent && user?.agent_code && (
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: FontSize.sm, marginTop: 4, fontWeight: '600' }}>Agent Code: {user.agent_code}</Text>
        )}
      </TouchableOpacity>

      {/* Quick Actions - THE 2 KEY FEATURES */}
      <View style={styles.actionsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {/* Scan QR */}
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/scan')}
            activeOpacity={0.8}
            accessibilityLabel="Scan QR code to pay or receive"
            accessibilityRole="button"
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="qr-code" size={28} color={colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Scan QR</Text>
            <Text style={styles.actionDesc}>Scan to pay</Text>
          </TouchableOpacity>

          {/* Second quick action — agents get Deposit (primary), customers get Receive */}
          {user?.is_agent ? (
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.secondary }]}
              onPress={() => router.push('/agent-cashin' as any)}
              activeOpacity={0.8}
              accessibilityLabel="Deposit cash for customer"
              accessibilityRole="button"
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="arrow-down-circle" size={28} color={colors.secondary} />
              </View>
              <Text style={styles.actionTitle}>Deposit</Text>
              <Text style={styles.actionDesc}>Cash-in for customer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.secondary }]}
              onPress={() => router.push('/receive')}
              activeOpacity={0.8}
              accessibilityLabel="Show your QR code to receive money"
              accessibilityRole="button"
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="arrow-down-circle" size={28} color={colors.secondary} />
              </View>
              <Text style={styles.actionTitle}>Receive</Text>
              <Text style={styles.actionDesc}>Show your QR code</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Secondary Actions — different for agents vs customers */}
        {user?.is_agent ? (
          <>
            {/* Agent secondary actions */}
            <View style={styles.secondaryRow}>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/agent-cashout')} activeOpacity={0.7} accessibilityLabel="Process customer cash-out" accessibilityRole="button">
                <View style={[styles.secondaryIcon, { backgroundColor: colors.secondary + '15' }]}>
                  <Ionicons name="cash-outline" size={20} color={colors.secondary} />
                </View>
                <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Cash-Out</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/agent-transfer' as any)} activeOpacity={0.7} accessibilityLabel="Transfer to another agent" accessibilityRole="button">
                <View style={[styles.secondaryIcon, { backgroundColor: colors.secondary + '15' }]}>
                  <Ionicons name="swap-horizontal" size={20} color={colors.secondary} />
                </View>
                <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/withdraw')} activeOpacity={0.7} accessibilityLabel="Withdraw earnings" accessibilityRole="button">
                <View style={[styles.secondaryIcon, { backgroundColor: colors.secondary + '15' }]}>
                  <Ionicons name="arrow-up-circle" size={22} color={colors.secondary} />
                </View>
                <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Withdraw</Text>
              </TouchableOpacity>
            </View>
            {/* Agent float top-up */}
            <View style={styles.agentRow}>
              <TouchableOpacity
                style={[styles.agentBar, { backgroundColor: colors.success + '10', borderColor: colors.success + '30', flex: 1 }]}
                onPress={() => router.push('/top-up')}
                activeOpacity={0.7}
              >
                <Ionicons name="wallet" size={18} color={colors.success} />
                <Text style={[styles.agentBarText, { color: colors.success }]}>Add Float</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/top-up')} activeOpacity={0.7} accessibilityLabel="Top up wallet" accessibilityRole="button">
              <View style={[styles.secondaryIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="wallet" size={20} color={colors.success} />
              </View>
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/payment')} activeOpacity={0.7} accessibilityLabel="Send money" accessibilityRole="button">
              <View style={[styles.secondaryIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="send" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/get-cash')} activeOpacity={0.7} accessibilityLabel="Get cash from agent" accessibilityRole="button">
              <View style={[styles.secondaryIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="cash-outline" size={20} color={colors.success} />
              </View>
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Get Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/withdraw')} activeOpacity={0.7} accessibilityLabel="Withdraw money" accessibilityRole="button">
              <View style={[styles.secondaryIcon, { backgroundColor: colors.secondary + '15' }]}>
                <Ionicons name="arrow-up-circle" size={22} color={colors.secondary} />
              </View>
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Recent Transactions */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.transactionsList, { backgroundColor: colors.surface }]}>
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
              <Ionicons name="receipt-outline" size={40} color={colors.textLight} />
              <Text style={[styles.emptyText, { color: colors.textLight }]}>No transactions yet</Text>
              <TouchableOpacity style={[styles.emptyCta, { backgroundColor: colors.primary + '10' }]} onPress={() => router.push('/payment')} activeOpacity={0.7}>
                <Ionicons name="send" size={16} color={colors.primary} />
                <Text style={[styles.emptyCtaText, { color: colors.primary }]}>Send your first payment</Text>
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
  },
  subGreeting: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  notifBtn: {
    padding: 4,
  },
  balanceCard: {
    marginHorizontal: Spacing.lg,
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
  actionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
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
  },
  agentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  agentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  agentBarText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
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
    fontWeight: '600',
  },
  transactionsList: {
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
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyCtaText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
