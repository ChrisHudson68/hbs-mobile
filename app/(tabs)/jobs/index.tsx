import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import { useApi } from '../../../src/mobile/hooks/useApi';
import { useTheme } from '../../../src/mobile/theme';
import type { JobListItem } from '../../../src/mobile/types';
import {
  formatCurrency,
  isActiveStatus,
  isCancelledStatus,
  isCompletedStatus,
  isManagerOrAdmin,
  isOnHoldStatus,
} from '../../../src/mobile/utils';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { IconSymbol } from '@/components/ui/icon-symbol';

type StatusFilter = 'active' | 'on-hold' | 'completed' | 'all';

function statusTone(status: string | null): 'success' | 'warning' | 'neutral' {
  if (isActiveStatus(status)) return 'success';
  if (isOnHoldStatus(status)) return 'warning';
  return 'neutral';
}

function matchesFilter(job: JobListItem, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return isActiveStatus(job.status);
  if (filter === 'on-hold') return isOnHoldStatus(job.status);
  if (filter === 'completed') return isCompletedStatus(job.status) || isCancelledStatus(job.status);
  return true;
}

const FILTER_LABELS: Record<StatusFilter, string> = {
  active: 'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
  all: 'All',
};

const FILTER_TEST_IDS: Record<StatusFilter, string> = {
  active: 'jobs-filter-active',
  'on-hold': 'jobs-filter-on-hold',
  completed: 'jobs-filter-completed',
  all: 'jobs-filter-all',
};

export default function JobsScreen() {
  const api = useApi();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const canManage = isManagerOrAdmin(user);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.getJobs();
      setJobs(res.jobs ?? []);
    } catch { /* ignore */ }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const filtered = jobs.filter(j =>
    matchesFilter(j, statusFilter) &&
    (!search || j.jobName?.toLowerCase().includes(search.toLowerCase()) ||
      j.clientName?.toLowerCase().includes(search.toLowerCase()))
  );

  const counts: Record<StatusFilter, number> = {
    active: jobs.filter(j => isActiveStatus(j.status)).length,
    'on-hold': jobs.filter(j => isOnHoldStatus(j.status)).length,
    completed: jobs.filter(j => isCompletedStatus(j.status) || isCancelledStatus(j.status)).length,
    all: jobs.length,
  };

  if (loading) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  const hasSearch = search.length > 0;
  const isEmpty = filtered.length === 0;

  return (
    <Screen headerMode="native" padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0, gap: 10 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {/* Search box */}
        <View style={{ paddingTop: spacing.sm }}>
          <Input
            leftIcon="magnifyingglass"
            placeholder="Search jobs…"
            value={search}
            onChangeText={setSearch}
            testID="jobs-search-input"
          />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, flexDirection: 'row', paddingVertical: 2 }}
        >
          {(['active', 'on-hold', 'completed', 'all'] as StatusFilter[]).map(f => {
            const isActive = statusFilter === f;
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
                onPress={() => setStatusFilter(f)}
              >
                <RNText
                  style={{
                    fontSize: 16,
                    fontWeight: '400',
                    lineHeight: 22,
                    color: isActive ? colors.inverse : colors.muted,
                  }}
                >
                  {FILTER_LABELS[f]}
                </RNText>
                <RNText
                  style={{
                    fontSize: 12,
                    fontWeight: '400',
                    lineHeight: 16,
                    color: isActive ? 'rgba(255,255,255,0.7)' : colors.mutedLight,
                  }}
                >
                  {counts[f]}
                </RNText>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Empty state */}
        {isEmpty && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
            <IconSymbol
              name={hasSearch ? 'magnifyingglass' : 'briefcase'}
              size={48}
              color={colors.mutedLight}
            />
            {hasSearch ? (
              <RNText
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  lineHeight: 23,
                  color: colors.muted,
                  textAlign: 'center',
                }}
              >
                No jobs match your search
              </RNText>
            ) : (
              <>
                <RNText
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    lineHeight: 23,
                    color: colors.muted,
                    textAlign: 'center',
                  }}
                >
                  No jobs yet
                </RNText>
                <RNText
                  style={{
                    fontSize: 15,
                    fontWeight: '400',
                    lineHeight: 21,
                    color: colors.mutedLight,
                    textAlign: 'center',
                    maxWidth: 240,
                  }}
                >
                  {canManage
                    ? 'Create your first job with + above.'
                    : "Jobs you’re assigned to will appear here."}
                </RNText>
              </>
            )}
          </View>
        )}

        {/* Job cards */}
        {filtered.map((job, idx) => (
          <Pressable
            key={job.id}
            onPress={() => router.push(`/jobs/${job.id}`)}
          >
            <Card
              elevation="sm"
              padding="md"
              radius="lg"
              testID={idx === 0 ? 'jobs-card-0' : undefined}
            >
              {/* Top row: name + status badge */}
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text variant="headline" weight="600" numberOfLines={2}>
                    {job.jobName ?? 'Untitled Job'}
                  </Text>
                  {job.clientName ? (
                    <Text variant="subhead" tone="muted">
                      {job.clientName}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  tone={statusTone(job.status)}
                  label={job.status ?? 'Active'}
                />
              </View>

              {/* Overhead tag */}
              {job.isOverhead ? (
                <View style={{ marginTop: 4 }}>
                  <Badge tone="warning" label="Overhead" size="sm" />
                </View>
              ) : null}

              {/* Financials row — manager-gated */}
              {job.financials && canManage ? (
                <View
                  style={[
                    s.financials,
                    {
                      marginTop: 6,
                      paddingTop: 6,
                      borderTopWidth: 0.5,
                      borderTopColor: colors.border,
                      gap: spacing.md,
                    },
                  ]}
                >
                  {/* Profit */}
                  <View style={s.finItem}>
                    <RNText style={{ fontSize: 12, color: colors.muted }}>Profit</RNText>
                    <RNText
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: Number(job.financials.profit) >= 0
                          ? colors.success
                          : colors.danger,
                      }}
                    >
                      {formatCurrency(job.financials.profit)}
                    </RNText>
                  </View>

                  {/* Hours */}
                  <View style={s.finItem}>
                    <RNText style={{ fontSize: 12, color: colors.muted }}>Hours</RNText>
                    <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>
                      {Number(job.financials.totalHours).toFixed(1)} hrs
                    </RNText>
                  </View>

                  {/* Unpaid invoices */}
                  {Number(job.financials.unpaidInvoices) > 0 ? (
                    <View style={s.finItem}>
                      <RNText style={{ fontSize: 12, color: colors.muted }}>Unpaid</RNText>
                      <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.danger }}>
                        {formatCurrency(job.financials.unpaidInvoices)}
                      </RNText>
                    </View>
                  ) : (
                    <View style={s.finItem}>
                      <RNText style={{ fontSize: 12, color: colors.muted }}>Unpaid</RNText>
                      <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>
                        —
                      </RNText>
                    </View>
                  )}
                </View>
              ) : null}
            </Card>
          </Pressable>
        ))}

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
  financials: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  finItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
