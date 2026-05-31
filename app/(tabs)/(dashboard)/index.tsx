import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { useApi } from '../../../src/mobile/hooks/useApi';
import { Motion, useTheme } from '../../../src/mobile/theme';
import { motionEasing } from '../../../src/mobile/utils/motionEasing';
import type { Invoice, JobListItem, TimesheetsResponse } from '../../../src/mobile/types';
import {
  buildDashboardMetrics,
  formatCurrency,
  formatDate,
  formatDuration,
  formatHours,
  isActiveStatus,
  isManagerOrAdmin,
} from '../../../src/mobile/utils';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ListRow } from '@/components/ui/ListRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

export default function DashboardScreen() {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [timesheetData, setTimesheetData] = useState<TimesheetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const canManage = isManagerOrAdmin(user);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [jobsRes, tsRes, invRes] = await Promise.all([
        api.getJobs().catch(() => null),
        api.getTimesheets().catch(() => null),
        canManage ? api.getInvoices().catch(() => null) : Promise.resolve(null),
      ]);
      if (jobsRes?.jobs) setJobs(jobsRes.jobs);
      if (tsRes) setTimesheetData(tsRes);
      if (invRes?.invoices) setInvoices(invRes.invoices);
    } catch { /* ignore */ }
    finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, [api, canManage]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const entry = timesheetData?.activeClockEntry;
    if (!entry?.clockInAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(entry.clockInAt!).getTime()) / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [timesheetData?.activeClockEntry]);

  // Content fade-in (MOTION-01 / D-10): a single 150ms decelerate fade once
  // loading flips false. No staggered cascade, no count-up. Worklet-safe via
  // sv.get()/sv.set() (D-12).
  const contentOpacity = useSharedValue(0);
  useEffect(() => {
    if (!loading) {
      contentOpacity.set(
        withTiming(1, {
          duration: Motion.fast.duration,
          easing: motionEasing(Motion.fast.easing),
        }),
      );
    }
  }, [loading, contentOpacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.get() }));

  const metrics = buildDashboardMetrics(jobs);
  const activeEntry = timesheetData?.activeClockEntry;
  const weekHours = timesheetData?.summary?.totalHours ?? 0;
  const weekEntries = timesheetData?.summary?.entryCount ?? 0;
  const searchTerm = jobSearch.trim().toLowerCase();
  const searchResults = searchTerm
    ? jobs.filter(j =>
        j.jobName?.toLowerCase().includes(searchTerm) ||
        j.clientName?.toLowerCase().includes(searchTerm)
      ).slice(0, 5)
    : [];
  const recentJobs = jobs.filter(j => isActiveStatus(j.status)).slice(0, 3);
  const overdueInvoices = invoices.filter(i => {
    const due = new Date(i.dueDate);
    return i.status?.toLowerCase() !== 'paid' && due < new Date();
  });
  const unpaidInvoices = invoices.filter(i => i.status?.toLowerCase() !== 'paid');
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + Number(i.balance || 0), 0);

  const hoursGoal = 40;
  const hoursPercent = Math.min(1, weekHours / hoursGoal);

  if (loading) {
    const statWidth = (screenWidth - spacing.md * 3) / 2;
    return (
      <Screen headerMode="native" padded={false} testID="dashboard-skeleton">
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {/* 2×2 grid of stat-card placeholders */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <SkeletonBlock width={statWidth} height={80} borderRadius={radius.md} />
            <SkeletonBlock width={statWidth} height={80} borderRadius={radius.md} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <SkeletonBlock width={statWidth} height={80} borderRadius={radius.md} />
            <SkeletonBlock width={statWidth} height={80} borderRadius={radius.md} />
          </View>
          {/* Wide activity-card placeholder */}
          <SkeletonBlock
            width={screenWidth - spacing.md * 2}
            height={120}
            borderRadius={radius.md}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen headerMode="native" padded={false}>
      <Animated.View style={[s.fill, fadeStyle]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {/* Role subtitle — large title owns the greeting */}
        <Text variant="caption" tone="muted">{user?.role}</Text>

        {/* Job search */}
        <Input
          leftIcon="magnifyingglass"
          placeholder="Search jobs…"
          value={jobSearch}
          onChangeText={setJobSearch}
          testID="dashboard-job-search-input"
        />

        {/* Search results overlay — replaces main body while typing */}
        {searchTerm ? (
          <View style={s.section}>
            {searchResults.length === 0 ? (
              <RNText style={{ textAlign: 'center', color: colors.muted, paddingVertical: spacing.sm, fontSize: 15 }}>
                No jobs match &ldquo;{jobSearch}&rdquo;
              </RNText>
            ) : (
              searchResults.map(job => (
                <ListRow
                  key={job.id}
                  title={job.jobName ?? 'Untitled Job'}
                  subtitle={job.clientName ?? undefined}
                  trailing="chevron"
                  onPress={() => { setJobSearch(''); router.push(`/jobs/${job.id}`); }}
                />
              ))
            )}
          </View>
        ) : null}

        {/* Main content — hidden while searching */}
        {!searchTerm && (
          <>
            {/* Clock card */}
            <Pressable
              testID="dashboard-clock-card"
              onPress={() => router.push('/(tabs)/timesheets')}
              style={
                activeEntry
                  ? {
                      backgroundColor: colors.navySurface,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      alignItems: 'center',
                      gap: 4,
                    }
                  : {
                      backgroundColor: colors.card,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderStyle: 'dashed',
                    }
              }
            >
              {activeEntry ? (
                <>
                  <Text variant="caption" tone="inverse">CURRENTLY CLOCKED IN</Text>
                  <Text variant="headline" tone="inverse" weight="700">{activeEntry.jobName ?? 'No Job'}</Text>
                  <RNText
                    testID="dashboard-clock-elapsed"
                    style={{ color: colors.yellow, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}
                  >
                    {formatDuration(elapsed)}
                  </RNText>
                  <RNText style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
                    Tap to manage →
                  </RNText>
                </>
              ) : (
                <Text variant="callout" tone="muted">Not clocked in — tap to clock in</Text>
              )}
            </Pressable>

            {/* This-Week card */}
            <View style={s.section}>
              <Card elevation="sm" padding="md">
                <View style={s.weekRow}>
                  <View style={{ flex: 1 }}>
                    <RNText style={{ fontSize: 28, fontWeight: '900', color: colors.navy, letterSpacing: -1 }}>
                      {formatHours(weekHours)}
                    </RNText>
                    <Text variant="caption" tone="muted">
                      {weekEntries} {weekEntries === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>
                  <Text variant="footnote" tone="muted">/ {hoursGoal}h goal</Text>
                </View>
                <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: '100%',
                      backgroundColor: colors.yellow,
                      borderRadius: 4,
                      width: `${Math.round(hoursPercent * 100)}%` as any,
                    }}
                  />
                </View>
                <Text variant="footnote" tone="muted">{Math.round(hoursPercent * 100)}% of weekly goal</Text>
              </Card>
            </View>

            {/* Financials stat grid — manager only */}
            {canManage && (
              <View style={s.section}>
                <SectionHeader title="Financials" />
                <View style={s.statsGrid}>
                  {/* Active Jobs */}
                  <View style={s.statCell}>
                    <Card elevation="sm" padding="sm">
                      <View
                        style={{
                          borderTopWidth: 3,
                          borderTopColor: colors.navySurface,
                          borderTopLeftRadius: radius.md,
                          borderTopRightRadius: radius.md,
                          marginTop: -spacing.sm,
                          marginHorizontal: -spacing.sm,
                          marginBottom: spacing.sm,
                        }}
                      />
                      <RNText style={{ fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Active Jobs
                      </RNText>
                      <RNText style={{ fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4, letterSpacing: -0.5 }}>
                        {metrics.activeJobsCount}
                      </RNText>
                    </Card>
                  </View>
                  {/* Total Profit */}
                  <View style={s.statCell}>
                    <Card elevation="sm" padding="sm">
                      <View
                        style={{
                          borderTopWidth: 3,
                          borderTopColor: colors.yellow,
                          borderTopLeftRadius: radius.md,
                          borderTopRightRadius: radius.md,
                          marginTop: -spacing.sm,
                          marginHorizontal: -spacing.sm,
                          marginBottom: spacing.sm,
                        }}
                      />
                      <RNText style={{ fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Total Profit
                      </RNText>
                      <RNText style={{ fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 4, letterSpacing: -0.5 }}>
                        {formatCurrency(metrics.totalProfit)}
                      </RNText>
                    </Card>
                  </View>
                  {/* Collected */}
                  <View style={s.statCell}>
                    <Card elevation="sm" padding="sm">
                      <View
                        style={{
                          borderTopWidth: 3,
                          borderTopColor: colors.success,
                          borderTopLeftRadius: radius.md,
                          borderTopRightRadius: radius.md,
                          marginTop: -spacing.sm,
                          marginHorizontal: -spacing.sm,
                          marginBottom: spacing.sm,
                        }}
                      />
                      <RNText style={{ fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Collected
                      </RNText>
                      <RNText style={{ fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 4, letterSpacing: -0.5 }}>
                        {formatCurrency(metrics.totalCollected)}
                      </RNText>
                    </Card>
                  </View>
                  {/* Unpaid */}
                  <View style={s.statCell}>
                    <Card elevation="sm" padding="sm">
                      <View
                        style={{
                          borderTopWidth: 3,
                          borderTopColor: unpaidTotal > 0 ? colors.danger : colors.border,
                          borderTopLeftRadius: radius.md,
                          borderTopRightRadius: radius.md,
                          marginTop: -spacing.sm,
                          marginHorizontal: -spacing.sm,
                          marginBottom: spacing.sm,
                        }}
                      />
                      <RNText style={{ fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Unpaid
                      </RNText>
                      <RNText
                        style={{
                          fontSize: 16,
                          fontWeight: '900',
                          color: unpaidTotal > 0 ? colors.danger : colors.text,
                          marginTop: 4,
                          letterSpacing: -0.5,
                        }}
                      >
                        {formatCurrency(unpaidTotal)}
                      </RNText>
                    </Card>
                  </View>
                </View>
              </View>
            )}

            {/* Overdue invoice alert banner — manager only */}
            {canManage && overdueInvoices.length > 0 && (
              <Pressable
                style={{
                  backgroundColor: colors.dangerBg,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.dangerBorder,
                }}
                onPress={() => router.push('/(tabs)/invoices')}
              >
                <RNText style={{ color: colors.danger, fontWeight: '600', fontSize: 13 }}>
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} · tap to review
                </RNText>
              </Pressable>
            )}

            {/* Active Jobs list */}
            {recentJobs.length > 0 && (
              <View style={s.section}>
                <SectionHeader
                  title="Active Jobs"
                  action={
                    <Pressable onPress={() => router.push('/(tabs)/jobs')}>
                      <RNText style={{ color: colors.infoText, fontSize: 13, fontWeight: '700' }}>
                        See all →
                      </RNText>
                    </Pressable>
                  }
                />
                {recentJobs.map((job, idx) => (
                  <ListRow
                    key={job.id}
                    title={job.jobName ?? 'Untitled Job'}
                    subtitle={job.clientName ?? undefined}
                    trailing={job.financials && canManage ? 'custom' : 'chevron'}
                    trailingCustom={
                      job.financials && canManage
                        ? (
                          <RNText
                            style={{
                              color: Number(job.financials.profit) >= 0 ? colors.success : colors.danger,
                              fontSize: 13,
                              fontWeight: '700',
                            }}
                          >
                            {formatCurrency(job.financials.profit)}
                          </RNText>
                        )
                        : undefined
                    }
                    onPress={() => router.push(`/jobs/${job.id}`)}
                    testID={idx === 0 ? 'dashboard-active-job-row-0' : undefined}
                  />
                ))}
              </View>
            )}

            {/* Open Invoices — manager only */}
            {canManage && unpaidInvoices.length > 0 && (
              <View style={s.section}>
                <SectionHeader
                  title="Open Invoices"
                  action={
                    <Pressable onPress={() => router.push('/(tabs)/invoices')}>
                      <RNText style={{ color: colors.infoText, fontSize: 13, fontWeight: '700' }}>
                        See all →
                      </RNText>
                    </Pressable>
                  }
                />
                {unpaidInvoices
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .slice(0, 3)
                  .map(inv => {
                    const overdue = new Date(inv.dueDate) < new Date();
                    return (
                      <Card key={inv.id} elevation="none" padding="md">
                        <Pressable
                          style={s.invRow}
                          onPress={() => router.push(`/invoices/${inv.id}`)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text variant="headline" weight="600">
                              {inv.invoiceNumber ?? `Invoice #${inv.id}`}
                            </Text>
                            <Text variant="caption" tone="muted">{inv.jobName ?? '—'}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <Text variant="headline" weight="700">
                              {formatCurrency(inv.balance)}
                            </Text>
                            <RNText
                              style={{ fontSize: 11, fontWeight: '600', color: overdue ? colors.danger : colors.muted }}
                            >
                              {overdue ? 'Overdue' : `Due ${formatDate(inv.dueDate)}`}
                            </RNText>
                          </View>
                        </Pressable>
                      </Card>
                    );
                  })}
              </View>
            )}
          </>
        )}
      </ScrollView>
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  section: { gap: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Two-per-row wrap grid: flexBasis ~47% + grow:1 fills each row evenly with
  // the 10pt gap accounted for; minWidth:0 lets long currency values shrink
  // instead of forcing an overflow. Preserves the prior 2×2 layout.
  statCell: { flexGrow: 1, flexBasis: '47%', minWidth: 0 },
  weekRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
