import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { FeeSummary, FloatSummary, FeeDetail } from '../constants/types';
import { getFeeSummary, getFloatSummary, getFeeDetails } from '../lib/api';
import { formatCurrency, formatDate, formatPhone } from '../lib/helpers';

type TabId = 'overview' | 'fees' | 'float';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const user = useStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [floatSummary, setFloatSummary] = useState<FloatSummary | null>(null);
  const [feeDetails, setFeeDetails] = useState<FeeDetail[]>([]);
  const [feeTotal, setFeeTotal] = useState(0);
  const [feeFilter, setFeeFilter] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Guard: only admin can view (uses is_admin flag from profile)
  const isAdmin = user?.is_admin === true;

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [fees, float] = await Promise.all([
        getFeeSummary(),
        getFloatSummary(),
      ]);

      if (fees.success) setFeeSummary(fees);
      else setError(fees.error || 'Failed to load fee summary');

      if (float.success) setFloatSummary(float);

      const details = await getFeeDetails(20, 0, feeFilter);
      if (details.success) {
        setFeeDetails(details.data || []);
        setFeeTotal(details.total);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [feeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const loadMoreFees = async () => {
    if (feeDetails.length >= feeTotal) return;
    const details = await getFeeDetails(20, feeDetails.length, feeFilter);
    if (details.success && details.data) {
      setFeeDetails((prev) => [...prev, ...details.data]);
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Admin</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="lock-closed" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Access Denied</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This dashboard is restricted to the Monde admin account.
          </Text>
        </View>
      </View>
    );
  }

  const feeTypeLabel = (type: string) => {
    switch (type) {
      case 'topup_fee': return 'Top-up';
      case 'withdraw_fee': return 'Withdrawal';
      case 'payment_fee': return 'Payment';
      default: return type;
    }
  };

  const feeTypeColor = (type: string) => {
    switch (type) {
      case 'topup_fee': return colors.success;
      case 'withdraw_fee': return colors.secondary;
      case 'payment_fee': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Admin Dashboard</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.backBtn}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['overview', 'fees', 'float'] as TabId[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
              {tab === 'overview' ? 'Overview' : tab === 'fees' ? 'Fee Ledger' : 'Float'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading admin data...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Error</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.white }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* ====== OVERVIEW TAB ====== */}
          {activeTab === 'overview' && feeSummary && (
            <>
              {/* Revenue Card */}
              <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
                <Text style={styles.heroLabel}>Total Revenue</Text>
                <Text style={styles.heroAmount}>
                  {formatCurrency(feeSummary.total_fees_collected)}
                </Text>
                <Text style={styles.heroSub}>
                  {feeSummary.total_fee_transactions} fee transactions
                </Text>
              </View>

              {/* Fee breakdown */}
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Fee Breakdown</Text>
              <View style={styles.cardRow}>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Top-up Fees</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.topup_fees)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.secondary }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Withdraw Fees</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.withdraw_fees)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardRow}>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Payment Fees</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.payment_fees)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Admin Balance</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.admin_balance)}
                  </Text>
                </View>
              </View>

              {/* Float summary (quick) */}
              {floatSummary && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: Spacing.lg }]}>
                    System Overview
                  </Text>
                  <View style={[styles.infoRow, { backgroundColor: colors.surface }]}>
                    <View style={styles.infoItem}>
                      <Ionicons name="people" size={20} color={colors.primary} />
                      <Text style={[styles.infoValue, { color: colors.text }]}>{floatSummary.total_users}</Text>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Users</Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoItem}>
                      <Ionicons name="wallet" size={20} color={colors.success} />
                      <Text style={[styles.infoValue, { color: colors.text }]}>{floatSummary.users_with_balance}</Text>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>With Balance</Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoItem}>
                      <Ionicons name="cash" size={20} color={colors.secondary} />
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {formatCurrency(floatSummary.system_total)}
                      </Text>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>System Total</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Integrity check */}
              {feeSummary && (
                <View style={[styles.integrityCard, {
                  backgroundColor: feeSummary.total_fees_collected === feeSummary.admin_balance
                    ? colors.success + '15'
                    : colors.error + '15',
                }]}>
                  <Ionicons
                    name={feeSummary.total_fees_collected === feeSummary.admin_balance ? 'checkmark-circle' : 'warning'}
                    size={20}
                    color={feeSummary.total_fees_collected === feeSummary.admin_balance ? colors.success : colors.error}
                  />
                  <Text style={[styles.integrityText, {
                    color: feeSummary.total_fees_collected === feeSummary.admin_balance ? colors.success : colors.error,
                  }]}>
                    {feeSummary.total_fees_collected === feeSummary.admin_balance
                      ? 'Ledger matches admin balance — no discrepancy'
                      : `Discrepancy: ledger ${formatCurrency(feeSummary.total_fees_collected)} vs balance ${formatCurrency(feeSummary.admin_balance)}`}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* ====== FEE LEDGER TAB ====== */}
          {activeTab === 'fees' && (
            <>
              {/* Filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {[
                  { id: null, label: 'All' },
                  { id: 'topup_fee', label: 'Top-up' },
                  { id: 'withdraw_fee', label: 'Withdraw' },
                  { id: 'payment_fee', label: 'Payment' },
                ].map((f) => (
                  <TouchableOpacity
                    key={f.label}
                    style={[
                      styles.filterChip,
                      { backgroundColor: feeFilter === f.id ? colors.primary : colors.surface },
                    ]}
                    onPress={() => {
                      setFeeFilter(f.id);
                      setFeeDetails([]);
                      setLoading(true);
                    }}
                  >
                    <Text style={[
                      styles.filterChipText,
                      { color: feeFilter === f.id ? colors.white : colors.text },
                    ]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
                {feeTotal} fee record{feeTotal !== 1 ? 's' : ''}
              </Text>

              {feeDetails.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color={colors.textLight} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No fee records found</Text>
                </View>
              ) : (
                feeDetails.map((fee) => (
                  <View key={fee.id} style={[styles.feeRow, { backgroundColor: colors.surface }]}>
                    <View style={styles.feeRowTop}>
                      <View style={[styles.feeTypeBadge, { backgroundColor: feeTypeColor(fee.fee_type) + '18' }]}>
                        <Text style={[styles.feeTypeBadgeText, { color: feeTypeColor(fee.fee_type) }]}>
                          {feeTypeLabel(fee.fee_type)}
                        </Text>
                      </View>
                      <Text style={[styles.feeAmount, { color: colors.success }]}>
                        +{formatCurrency(fee.fee_amount)}
                      </Text>
                    </View>
                    <View style={styles.feeRowBottom}>
                      <Text style={[styles.feeUser, { color: colors.text }]}>
                        {fee.user_name || 'Unknown'} • {formatPhone(fee.user_phone || '')}
                      </Text>
                      <Text style={[styles.feeDate, { color: colors.textLight }]}>
                        {formatDate(fee.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.feeGross, { color: colors.textSecondary }]}>
                      Gross: {formatCurrency(fee.gross_amount)}
                    </Text>
                  </View>
                ))
              )}

              {feeDetails.length < feeTotal && (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, { borderColor: colors.primary }]}
                  onPress={loadMoreFees}
                >
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ====== FLOAT TAB ====== */}
          {activeTab === 'float' && floatSummary && (
            <>
              <View style={[styles.heroCard, { backgroundColor: colors.success }]}>
                <Text style={styles.heroLabel}>Total User Float</Text>
                <Text style={styles.heroAmount}>
                  {formatCurrency(floatSummary.total_float)}
                </Text>
                <Text style={styles.heroSub}>
                  Must match trust account balance at the bank
                </Text>
              </View>

              <View style={[styles.floatCard, { backgroundColor: colors.surface }]}>
                <FloatRow
                  icon="people" iconColor={colors.primary}
                  label="Total Users" value={String(floatSummary.total_users)}
                  colors={colors}
                />
                <FloatRow
                  icon="wallet" iconColor={colors.success}
                  label="Users with Balance" value={String(floatSummary.users_with_balance)}
                  colors={colors}
                />
                <FloatRow
                  icon="cash" iconColor={colors.secondary}
                  label="User Float" value={formatCurrency(floatSummary.total_float)}
                  colors={colors}
                />
                <FloatRow
                  icon="business" iconColor={colors.primary}
                  label="Monde Revenue" value={formatCurrency(floatSummary.admin_balance)}
                  colors={colors}
                />
                <FloatRow
                  icon="globe" iconColor={colors.warning}
                  label="System Total" value={formatCurrency(floatSummary.system_total)}
                  colors={colors} last
                />
              </View>

              <View style={[styles.integrityCard, { backgroundColor: colors.primary + '12' }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={[styles.integrityText, { color: colors.primary }]}>
                  The trust account at the bank must hold at least{' '}
                  {formatCurrency(floatSummary.total_float)} to cover all user balances.
                  Monde's revenue ({formatCurrency(floatSummary.admin_balance)}) is separate.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function FloatRow({ icon, iconColor, label, value, colors, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  colors: any;
  last?: boolean;
}) {
  return (
    <View style={[styles.floatRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.floatLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.floatValue, { color: colors.text }]}>{value}</Text>
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  tab: {
    paddingBottom: Spacing.sm,
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: 100,
  },
  loadingText: {
    fontSize: FontSize.md,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: 100,
    paddingHorizontal: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  errorText: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },

  // Hero card
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },

  // Section
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

  // Stat cards
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  infoLabel: {
    fontSize: FontSize.xs,
  },
  infoDivider: {
    width: 1,
    height: 36,
  },

  // Integrity
  integrityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  integrityText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Fee ledger
  filterRow: {
    flexGrow: 0,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  feeRow: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  feeRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  feeTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  feeTypeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  feeAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  feeRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeUser: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  feeDate: {
    fontSize: FontSize.xs,
  },
  feeGross: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  loadMoreText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
  },

  // Float tab
  floatCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  floatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  floatLabel: {
    flex: 1,
    fontSize: FontSize.md,
  },
  floatValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
