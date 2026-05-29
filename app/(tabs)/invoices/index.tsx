import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import { useApi } from '../../../src/mobile/hooks/useApi';
import { useTheme } from '../../../src/mobile/theme';
import type { Invoice } from '../../../src/mobile/types';
import { formatCurrency, formatDate, isManagerOrAdmin } from '../../../src/mobile/utils';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { IconSymbol } from '@/components/ui/icon-symbol';

type InvoiceFilter = 'unpaid' | 'partial' | 'paid' | 'all';

type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral';

function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s === 'paid') return 'success';
  if (s === 'unpaid') return 'danger';
  if (s === 'partial') return 'warning';
  return 'neutral';
}

function matchesFilter(inv: Invoice, filter: InvoiceFilter): boolean {
  if (filter === 'all') return true;
  return inv.status?.toLowerCase() === filter;
}

const FILTER_LABELS: Record<InvoiceFilter, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  all: 'All',
};

const FILTER_TEST_IDS: Record<InvoiceFilter, string> = {
  unpaid: 'invoices-filter-unpaid',
  partial: 'invoices-filter-partial',
  paid: 'invoices-filter-paid',
  all: 'invoices-filter-all',
};

export default function InvoicesScreen() {
  const api = useApi();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InvoiceFilter>('unpaid');
  const canManage = isManagerOrAdmin(user);

  // Manager "+ New" header action (Pattern G)
  useEffect(() => {
    if (!canManage) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          testID="invoices-new-button"
          accessibilityLabel="New Invoice"
          onPress={() => router.push('/invoices/new')}
          style={{ padding: spacing.sm }}
        >
          <IconSymbol name="plus" size={22} color={colors.navy} />
        </Pressable>
      ),
    });
  }, [canManage, navigation, router, colors.navy, spacing.sm]);

  // Pattern H: unchanged data load
  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.getInvoices();
      setInvoices(res.invoices ?? []);
    } catch { /* ignore */ }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  const counts: Record<InvoiceFilter, number> = {
    unpaid: invoices.filter(i => i.status?.toLowerCase() === 'unpaid').length,
    partial: invoices.filter(i => i.status?.toLowerCase() === 'partial').length,
    paid: invoices.filter(i => i.status?.toLowerCase() === 'paid').length,
    all: invoices.length,
  };

  const filtered = invoices
    .filter(i => matchesFilter(i, filter))
    .sort((a, b) => {
      if (filter === 'all' || filter === 'unpaid' || filter === 'partial') {
        return a.dueDate.localeCompare(b.dueDate);
      }
      return b.dueDate.localeCompare(a.dueDate);
    });

  // Manager-gated open-balance banner (T-05-05-01)
  const unpaidTotal = canManage
    ? invoices
        .filter(i => i.status?.toLowerCase() !== 'paid')
        .reduce((sum, i) => sum + Number(i.balance || 0), 0)
    : 0;

  return (
    <Screen headerMode="native" padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0, gap: 10 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {/* Open-balance banner — manager only (T-05-05-01) */}
        {canManage && unpaidTotal > 0 && (
          <View style={{
            marginTop: spacing.sm,
            backgroundColor: colors.warningBg,
            borderRadius: radius.md,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.warningBorder,
          }}>
            <RNText style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>
              Open balance: {formatCurrency(unpaidTotal)}
            </RNText>
          </View>
        )}

        {/* Filter chips — Phase-4 D-06 chip pattern */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, flexDirection: 'row', paddingVertical: 2 }}
        >
          {(['unpaid', 'partial', 'paid', 'all'] as InvoiceFilter[]).map(f => {
            const isActive = filter === f;
            return (
              <Pressable
                key={f}
                testID={FILTER_TEST_IDS[f]}
                style={[
                  s.chip,
                  {
                    paddingVertical: 6,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    minHeight: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: 5,
                  },
                  isActive
                    ? { backgroundColor: colors.navy, borderColor: colors.navy }
                    : { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => setFilter(f)}
              >
                <RNText style={{
                  fontSize: 13,
                  fontWeight: '600',
                  lineHeight: 19,
                  color: isActive ? colors.inverse : colors.muted,
                }}>
                  {FILTER_LABELS[f]}
                </RNText>
                <RNText style={{
                  fontSize: 12,
                  fontWeight: '400',
                  lineHeight: 16,
                  color: isActive ? 'rgba(255,255,255,0.7)' : colors.mutedLight,
                }}>
                  {counts[f]}
                </RNText>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Empty state (Pattern I) */}
        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
            <IconSymbol name="doc.text" size={48} color={colors.mutedLight} />
            <RNText style={{
              fontSize: 15,
              fontWeight: '400',
              lineHeight: 21,
              color: colors.muted,
              textAlign: 'center',
            }}>
              {filter === 'all'
                ? 'No invoices found.'
                : `No ${FILTER_LABELS[filter].toLowerCase()} invoices found.`}
            </RNText>
          </View>
        )}

        {/* Invoice cards */}
        {filtered.map((inv, idx) => {
          const overdue = inv.status?.toLowerCase() !== 'paid' && new Date(inv.dueDate) < new Date();
          const hasBalance = Number(inv.balance) > 0 && inv.status?.toLowerCase() !== 'paid';
          return (
            <Pressable
              key={inv.id}
              onPress={() => router.push(`/invoices/${inv.id}`)}
            >
              <Card
                elevation="sm"
                padding="md"
                radius="lg"
                testID={idx === 0 ? 'invoices-card-0' : undefined}
              >
                {/* Overdue left accent */}
                {overdue && (
                  <View style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    backgroundColor: colors.danger,
                    borderTopLeftRadius: radius.lg,
                    borderBottomLeftRadius: radius.lg,
                  }} />
                )}

                {/* Top row: invoice number + amount/badge */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text variant="headline" weight="600" numberOfLines={1}>
                      {inv.invoiceNumber ?? `Invoice #${inv.id}`}
                    </Text>
                    {inv.jobName ? (
                      <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.navy, marginTop: 2 }}>
                        {inv.jobName}
                      </RNText>
                    ) : null}
                    <RNText style={{
                      fontSize: 11,
                      color: overdue ? colors.danger : colors.muted,
                      marginTop: 2,
                    }}>
                      {overdue
                        ? `Issued ${formatDate(inv.dateIssued)} · ⚠ Overdue`
                        : `Issued ${formatDate(inv.dateIssued)} · Due ${formatDate(inv.dueDate)}`}
                    </RNText>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <RNText style={{ fontSize: 20, fontWeight: '700', lineHeight: 26, color: colors.text }}>
                      {formatCurrency(inv.amount)}
                    </RNText>
                    <Badge
                      tone={statusTone(inv.status ?? '')}
                      label={inv.status ?? 'Unknown'}
                    />
                  </View>
                </View>

                {/* Balance due line */}
                {hasBalance && (
                  <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.danger, marginTop: 4 }}>
                    Balance due: {formatCurrency(inv.balance)}
                  </RNText>
                )}
              </Card>
            </Pressable>
          );
        })}

        {/* Bottom padding */}
        <View style={{ height: 12 }} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chip: {},
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
