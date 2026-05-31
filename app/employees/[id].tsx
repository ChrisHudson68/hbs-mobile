import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useApi } from '@/src/mobile/hooks/useApi';
import { useAuth } from '@/src/mobile/context/AuthContext';
import { useTheme } from '@/src/mobile/theme';
import type { Employee } from '@/src/mobile/types';
import { formatCurrency, isManagerOrAdmin } from '@/src/mobile/utils';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SkeletonRow } from '@/components/ui/SkeletonRow';

const SKELETON_ROW_COUNT = 4;

/** Initials for the avatar — mirrors the employees list pattern. */
function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

/** Human-readable pay-type label for the Badge. */
function payTypeLabel(payType: string) {
  const normalized = payType?.toLowerCase();
  if (normalized === 'salary') return 'Salaried';
  if (normalized === 'hourly') return 'Hourly';
  return payType || 'Pay type unknown';
}

/** One key/value detail line inside the Card. */
function DetailRow({
  label,
  value,
  valueMuted = false,
}: {
  label: string;
  value: string;
  valueMuted?: boolean;
}) {
  return (
    <View style={s.detailRow}>
      <Text variant="footnote" tone="muted" weight="600">
        {label}
      </Text>
      <Text variant="subhead" weight="700" tone={valueMuted ? 'muted' : undefined}>
        {value}
      </Text>
    </View>
  );
}

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { user } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const canManage = isManagerOrAdmin(user);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const employeeId = Number(id);

  // No getEmployee endpoint exists — load the list and find by id (the list
  // route is already manager-gated server-side, so this is the same contract).
  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.getEmployees();
        const found = (res.employees ?? []).find((e) => e.id === employeeId) ?? null;
        setEmployee(found);
      } catch {
        setEmployee(null);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [api, employeeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen headerMode="native" padded={false} testID="employee-detail">
        <View style={{ paddingTop: spacing.md }}>
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      </Screen>
    );
  }

  // Non-managers should never reach the data (the endpoint is manager-gated),
  // but gate the UI consistently with the employees list — no "no permission" copy.
  if (!canManage || !employee) {
    return (
      <Screen headerMode="native" testID="employee-detail">
        <View style={s.center}>
          <EmptyState icon="person" message="Employee not found." />
        </View>
      </Screen>
    );
  }

  const isActive = Boolean(employee.active);
  const isSalaried = employee.payType?.toLowerCase() === 'salary';
  const hasSalary = employee.annualSalary != null && employee.annualSalary > 0;
  const payRateMuted = isSalaried && !hasSalary;
  const payRateValue = isSalaried
    ? hasSalary
      ? `${formatCurrency(employee.annualSalary as number)} / yr`
      : 'Salary · rate not set'
    : employee.hourlyRate != null
      ? `${formatCurrency(employee.hourlyRate)} / hr`
      : '—';

  return (
    <Screen headerMode="native" padded={false} testID="employee-detail">
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        {/* Navy hero card — avatar + name + status/pay-type badges */}
        <View style={[s.heroCard, { backgroundColor: colors.navySurface, borderRadius: radius.lg }]}>
          <View
            style={[
              s.avatar,
              { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill },
            ]}
          >
            <Text variant="title3" weight="700" tone="inverse">
              {getInitials(employee.name)}
            </Text>
          </View>
          <Text variant="title2" weight="700" tone="inverse">
            {employee.name}
          </Text>
          <View style={s.badgeRow}>
            <Badge tone="accent" label={payTypeLabel(employee.payType)} size="md" />
            <Badge
              tone={isActive ? 'success' : 'neutral'}
              label={isActive ? 'Active' : 'Inactive'}
              size="md"
            />
          </View>
        </View>

        {/* Compensation */}
        <SectionHeader title="Compensation" />
        <Card elevation="sm" padding="md" radius="md">
          <DetailRow label="Pay Type" value={payTypeLabel(employee.payType)} />
          <DetailRow label="Pay Rate" value={payRateValue} valueMuted={payRateMuted} />
          {isSalaried && employee.hourlyRate != null ? (
            <DetailRow label="Hourly Rate" value={`${formatCurrency(employee.hourlyRate)} / hr`} />
          ) : null}
        </Card>

        {/* Status */}
        <SectionHeader title="Status" />
        <Card elevation="sm" padding="md" radius="md">
          <DetailRow label="Employee ID" value={`#${employee.id}`} />
          <DetailRow label="Status" value={isActive ? 'Active' : 'Inactive'} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { padding: 16, gap: 10, alignItems: 'center' },
  avatar: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
