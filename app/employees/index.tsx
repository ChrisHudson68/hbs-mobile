import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useTheme } from '../../src/mobile/theme';
import type { Employee } from '../../src/mobile/types';
import { formatCurrency } from '../../src/mobile/utils';

function payLabel(emp: Employee) {
  if (emp.payType?.toLowerCase() === 'salary') {
    return emp.annualSalary
      ? `Salary · ${formatCurrency(emp.annualSalary)}/yr`
      : 'Salary · rate not set';
  }
  if (emp.hourlyRate) {
    return `Hourly · ${formatCurrency(emp.hourlyRate)}/hr`;
  }
  return emp.payType ?? '—';
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

export default function EmployeesScreen() {
  const api = useApi();
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getEmployees();
      setEmployees(res.employees ?? []);
    } catch { /* ignore */ }
    finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, [api]);

  // eslint-disable-next-line react-compiler-rules/set-state-in-effect -- fetch-on-mount
  useEffect(() => { void load(); }, [load]);

  // Client-side filter before splitting active/inactive — no API call
  const filtered = employees.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter(e => e.active);
  const inactive = filtered.filter(e => !e.active);

  if (loading) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  const isEmpty = filtered.length === 0;

  return (
    <Screen headerMode="native" padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: 10 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        <Input
          leftIcon="magnifyingglass"
          placeholder="Search employees…"
          value={search}
          onChangeText={setSearch}
          testID="employees-search-input"
        />

        {/* Search-empty state */}
        {isEmpty && search.length > 0 && (
          <View style={s.emptyState}>
            <IconSymbol name="magnifyingglass" size={48} color={colors.mutedLight} />
            <RNText style={{ textAlign: 'center', color: colors.muted, fontSize: 15 }}>
              {`No employees match "${search}"`}
            </RNText>
          </View>
        )}

        {/* Empty state (no employees at all) */}
        {isEmpty && search.length === 0 && (
          <View style={s.emptyState}>
            <IconSymbol name="person.2" size={48} color={colors.mutedLight} />
            <RNText style={{ textAlign: 'center', color: colors.muted, fontSize: 15 }}>
              No employees found.
            </RNText>
          </View>
        )}

        {/* Active section */}
        {!isEmpty && (
          <>
            <SectionHeader title={`Active (${active.length})`} />
            {active.map((emp, idx) => (
              <Pressable
                key={emp.id}
                testID={idx === 0 ? 'employees-row-0' : undefined}
                onPress={() => router.push(`/employees/${emp.id}` as never)}
                style={[
                  s.row,
                  {
                    backgroundColor: colors.card,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.sm,
                    gap: spacing.sm,
                  },
                ]}
              >
                {/* Avatar */}
                <View
                  style={[
                    s.avatar,
                    { backgroundColor: colors.navySurface, borderRadius: radius.pill },
                  ]}
                >
                  <Text variant="footnote" weight="600" tone="inverse">
                    {getInitials(emp.name)}
                  </Text>
                </View>
                {/* Name + pay */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline" weight="600" numberOfLines={1}>{emp.name}</Text>
                  <Text variant="footnote" tone="muted" numberOfLines={1}>{payLabel(emp)}</Text>
                </View>
                {/* Active badge */}
                <Badge tone="success" label="Active" size="sm" />
              </Pressable>
            ))}
          </>
        )}

        {/* Inactive section — only when there are inactive employees */}
        {!isEmpty && inactive.length > 0 && (
          <>
            <SectionHeader title={`Inactive (${inactive.length})`} />
            {inactive.map(emp => (
              <Pressable
                key={emp.id}
                onPress={() => router.push(`/employees/${emp.id}` as never)}
                style={[
                  s.row,
                  {
                    backgroundColor: colors.card,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.sm,
                    gap: spacing.sm,
                    opacity: 0.6,
                  },
                ]}
              >
                {/* Avatar — muted for inactive */}
                <View
                  style={[
                    s.avatar,
                    { backgroundColor: colors.border, borderRadius: radius.pill },
                  ]}
                >
                  <Text variant="footnote" weight="600" tone="muted">
                    {getInitials(emp.name)}
                  </Text>
                </View>
                {/* Name + pay */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline" weight="600" numberOfLines={1}>{emp.name}</Text>
                  <Text variant="footnote" tone="muted" numberOfLines={1}>{payLabel(emp)}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
