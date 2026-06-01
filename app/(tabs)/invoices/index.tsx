import { useNavigation, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Pressable, RefreshControl,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useApi } from '../../../src/mobile/hooks/useApi';
import { tenantKey } from '../../../src/mobile/query/queryClient';
import { useTheme } from '../../../src/mobile/theme';
import type { Invoice } from '../../../src/mobile/types';
import { formatCurrency, formatDate, isManagerOrAdmin } from '../../../src/mobile/utils';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwipeRow, closeOpenSwipeRow } from '@/components/ui/SwipeRow';

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

// Swipe panel widths (72pt per button; matches 06-UI-SPEC swipe-action button width)
const ACTION_BTN_WIDTH = 72;
const PANEL_TWO = ACTION_BTN_WIDTH * 2; // manager: 2 buttons
const PANEL_ONE = ACTION_BTN_WIDTH;     // non-manager: 1 button

type InvoiceSwipeActionsProps = {
  inv: Invoice;
  drag: SharedValue<number>;
  methods: SwipeableMethods;
  canManage: boolean;
  onRecordPayment: () => void;
  onSharePdf: () => void;
};

function InvoiceSwipeActions({
  inv,
  drag,
  methods,
  canManage,
  onRecordPayment,
  onSharePdf,
}: InvoiceSwipeActionsProps) {
  const { colors } = useTheme();
  const panelWidth = canManage ? PANEL_TWO : PANEL_ONE;

  // Translate the action panel in sync with the swipe drag, on the UI thread.
  // Drag is negative for left-swipe (right-actions revealed) — Pitfall 3.
  // Must run inside a useAnimatedStyle worklet: `drag` is a SharedValue that
  // mutates on the UI thread without re-rendering React, so interpolating it in
  // the render body freezes the panel at mount. Mirrors timesheets TimeRowSwipeActions.
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          drag.get(),
          [-panelWidth, 0],
          [0, panelWidth],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        s.swipePanel,
        { width: panelWidth },
        animStyle,
      ]}
    >
      {canManage && (
        <Pressable
          testID={`invoice-record-payment-${inv.id}`}
          accessibilityLabel="Record payment"
          onPress={() => { methods.close(); onRecordPayment(); }}
          style={[s.swipeBtn, { backgroundColor: colors.success, width: ACTION_BTN_WIDTH }]}
        >
          <IconSymbol name={'checkmark.circle' as never} size={22} color={colors.inverse} />
        </Pressable>
      )}
      <Pressable
        testID={`invoice-share-pdf-${inv.id}`}
        accessibilityLabel="Share PDF"
        onPress={() => { methods.close(); onSharePdf(); }}
        style={[s.swipeBtn, { backgroundColor: colors.navySurface, width: ACTION_BTN_WIDTH }]}
      >
        <IconSymbol name={'square.and.arrow.up' as never} size={22} color={colors.inverse} />
      </Pressable>
    </Animated.View>
  );
}

export default function InvoicesScreen() {
  const api = useApi();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, tenantSubdomain } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const [filter, setFilter] = useState<InvoiceFilter>('unpaid');
  const canManage = isManagerOrAdmin(user);

  // TanStack Query — tenant-scoped, persisted, auto-refetch on reconnect/foreground.
  const { data, isLoading: loading, isRefetching: refreshing, refetch } = useQuery({
    queryKey: tenantKey(tenantSubdomain, 'invoices'),
    queryFn: () => api.getInvoices(),
  });
  const invoices: Invoice[] = data?.invoices ?? [];

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

  // Skeleton loading guard — 4 SkeletonRows replace the old ActivityIndicator
  if (loading) {
    return (
      <Screen headerMode="native" testID="invoices-skeleton">
        <View style={{ padding: spacing.md, gap: 10 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
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
        onScrollBeginDrag={closeOpenSwipeRow}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void refetch();
            }}
          />
        }
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
            <RNText style={{ color: colors.navy, fontWeight: '700', fontSize: 13 }}>
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
                    ? { backgroundColor: colors.navySurface, borderColor: colors.navySurface }
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

        {/* Empty state — EmptyState kit component replaces inline block (MOTION-02) */}
        {filtered.length === 0 && (
          <EmptyState
            icon="doc.text"
            message="No invoices here."
            actionLabel={canManage ? 'Create Invoice' : undefined}
            onAction={canManage ? () => router.push('/invoices/new') : undefined}
            testID="invoices-empty-state"
          />
        )}

        {/* Invoice cards — SwipeRow with role-gated actions + Card onPress (MOTION-03) */}
        {filtered.map((inv) => {
          const overdue = inv.status?.toLowerCase() !== 'paid' && new Date(inv.dueDate) < new Date();
          const hasBalance = Number(inv.balance) > 0 && inv.status?.toLowerCase() !== 'paid';
          return (
            <SwipeRow
              key={inv.id}
              testID={`invoice-row-${inv.id}`}
              renderActions={(drag, methods) => (
                <InvoiceSwipeActions
                  inv={inv}
                  drag={drag}
                  methods={methods}
                  canManage={canManage}
                  onRecordPayment={() => router.push(`/invoices/${inv.id}?action=recordPayment`)}
                  onSharePdf={() => router.push(`/invoices/${inv.id}?action=share`)}
                />
              )}
            >
              <Card
                elevation="sm"
                padding="md"
                radius="lg"
                onPress={() => router.push(`/invoices/${inv.id}`)}
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
                  <View style={{ flex: 1, minWidth: 0 }}>
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
                      {`Issued ${formatDate(inv.dateIssued)} · Due ${formatDate(inv.dueDate)}`}
                    </RNText>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0, maxWidth: '55%' }}>
                    <RNText
                      numberOfLines={1}
                      style={{ fontSize: 20, fontWeight: '700', lineHeight: 26, color: colors.text }}
                    >
                      {formatCurrency(inv.amount)}
                    </RNText>
                    <Badge
                      tone={statusTone(inv.status ?? '')}
                      label={inv.status ?? 'Unknown'}
                    />
                    {overdue && (
                      <Badge
                        tone="danger"
                        size="sm"
                        label="Overdue"
                        testID={`invoice-overdue-pill-${inv.id}`}
                      />
                    )}
                  </View>
                </View>

                {/* Balance due line */}
                {hasBalance && (
                  <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.danger, marginTop: 4 }}>
                    Balance due: {formatCurrency(inv.balance)}
                  </RNText>
                )}
              </Card>
            </SwipeRow>
          );
        })}

        {/* Bottom padding */}
        <View style={{ height: 12 }} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  chip: {},
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  swipePanel: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  swipeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
});
