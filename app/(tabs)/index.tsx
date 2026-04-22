import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { useAppState } from '../../src/mobile/context/AppStateContext';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { Invoice, JobListItem, TimesheetsResponse } from '../../src/mobile/types';
import { buildDashboardMetrics, formatCurrency, formatDate, formatDuration, formatHours, isActiveStatus, isManagerOrAdmin } from '../../src/mobile/utils';

function greeting(name: string) {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${salutation}, ${name.split(' ')[0]}`;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();
  const { isClockedIn } = useAppState();

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [timesheetData, setTimesheetData] = useState<TimesheetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const canManage = isManagerOrAdmin(user);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
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
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
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
  const unpaidTotal = invoices
    .filter(i => i.status?.toLowerCase() !== 'paid')
    .reduce((s, i) => s + Number(i.balance || 0), 0);

  const hoursGoal = 40;
  const hoursPercent = Math.min(1, weekHours / hoursGoal);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.greeting}>{greeting(user?.name ?? 'there')}</Text>
          <Text style={s.role}>{user?.role}</Text>
        </View>

        {/* Job search */}
        <View style={s.searchWrap}>
          <TextInput
            style={s.searchInput}
            value={jobSearch}
            onChangeText={setJobSearch}
            placeholder="Search jobs..."
            placeholderTextColor={Colors.mutedLight}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>

        {searchTerm ? (
          <View style={s.section}>
            {searchResults.length === 0
              ? <Text style={s.empty}>No jobs match "{jobSearch}"</Text>
              : searchResults.map(job => (
                <Pressable key={job.id} style={s.jobCard} onPress={() => { setJobSearch(''); router.push(`/jobs/${job.id}`); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.jobName}>{job.jobName}</Text>
                    {job.clientName ? <Text style={s.jobClient}>{job.clientName}</Text> : null}
                  </View>
                  <Text style={s.jobStatus}>{job.status ?? 'Active'}</Text>
                  <Text style={s.chevron}>›</Text>
                </Pressable>
              ))
            }
          </View>
        ) : null}

        {/* Main content — hidden while searching */}
        {!searchTerm && (
          <>
            <Pressable style={activeEntry ? s.clockedInCard : s.clockBanner} onPress={() => router.push('/(tabs)/timesheets')}>
              {activeEntry ? (
                <>
                  <Text style={s.clockedInLabel}>Currently Clocked In</Text>
                  <Text style={s.clockedInJob}>{activeEntry.jobName ?? 'No Job'}</Text>
                  <Text style={s.clockedInTime}>{formatDuration(elapsed)}</Text>
                  <Text style={s.clockTapHint}>Tap to manage →</Text>
                </>
              ) : (
                <Text style={s.clockBannerText}>Not clocked in — tap to clock in</Text>
              )}
            </Pressable>

            <View style={s.section}>
              <Text style={s.sectionTitle}>This Week</Text>
              <View style={s.weekCard}>
                <View style={s.weekRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.weekHours}>{formatHours(weekHours)}</Text>
                    <Text style={s.weekLabel}>{weekEntries} {weekEntries === 1 ? 'entry' : 'entries'}</Text>
                  </View>
                  <Text style={s.weekGoal}>/ {hoursGoal}h goal</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.round(hoursPercent * 100)}%` as any }]} />
                </View>
                <Text style={s.progressPct}>{Math.round(hoursPercent * 100)}% of weekly goal</Text>
              </View>
            </View>

            {canManage && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Financials</Text>
                <View style={s.statsGrid}>
                  <View style={[s.statCard, { borderTopColor: Colors.navy }]}>
                    <Text style={s.statLabel}>Active Jobs</Text>
                    <Text style={s.statValue}>{metrics.activeJobsCount}</Text>
                  </View>
                  <View style={[s.statCard, { borderTopColor: Colors.yellow }]}>
                    <Text style={s.statLabel}>Total Profit</Text>
                    <Text style={[s.statValue, { fontSize: 16 }]}>{formatCurrency(metrics.totalProfit)}</Text>
                  </View>
                  <View style={[s.statCard, { borderTopColor: Colors.success }]}>
                    <Text style={s.statLabel}>Collected</Text>
                    <Text style={[s.statValue, { fontSize: 16 }]}>{formatCurrency(metrics.totalCollected)}</Text>
                  </View>
                  <View style={[s.statCard, { borderTopColor: unpaidTotal > 0 ? Colors.danger : Colors.border }]}>
                    <Text style={s.statLabel}>Unpaid</Text>
                    <Text style={[s.statValue, { fontSize: 16, color: unpaidTotal > 0 ? Colors.danger : Colors.text }]}>
                      {formatCurrency(unpaidTotal)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {canManage && overdueInvoices.length > 0 && (
              <Pressable style={s.alertBanner} onPress={() => router.push('/(tabs)/invoices')}>
                <Text style={s.alertText}>
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} · tap to review
                </Text>
              </Pressable>
            )}

            {recentJobs.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionRow}>
                  <Text style={s.sectionTitle}>Active Jobs</Text>
                  <Pressable onPress={() => router.push('/(tabs)/jobs')}>
                    <Text style={s.sectionLink}>See all →</Text>
                  </Pressable>
                </View>
                {recentJobs.map(job => (
                  <Pressable key={job.id} style={s.jobCard} onPress={() => router.push(`/jobs/${job.id}`)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.jobName}>{job.jobName}</Text>
                      {job.clientName ? <Text style={s.jobClient}>{job.clientName}</Text> : null}
                    </View>
                    {job.financials && canManage && (
                      <Text style={[s.jobProfit, { color: Number(job.financials.profit) >= 0 ? Colors.success : Colors.danger }]}>
                        {formatCurrency(job.financials.profit)}
                      </Text>
                    )}
                    <Text style={s.chevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {canManage && invoices.filter(i => i.status?.toLowerCase() !== 'paid').length > 0 && (
              <View style={s.section}>
                <View style={s.sectionRow}>
                  <Text style={s.sectionTitle}>Open Invoices</Text>
                  <Pressable onPress={() => router.push('/(tabs)/invoices')}>
                    <Text style={s.sectionLink}>See all →</Text>
                  </Pressable>
                </View>
                {invoices
                  .filter(i => i.status?.toLowerCase() !== 'paid')
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .slice(0, 3)
                  .map(inv => {
                    const overdue = new Date(inv.dueDate) < new Date();
                    return (
                      <Pressable key={inv.id} style={s.invCard} onPress={() => router.push(`/invoices/${inv.id}`)}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.invNum}>{inv.invoiceNumber ?? `Invoice #${inv.id}`}</Text>
                          <Text style={s.invJob}>{inv.jobName ?? '—'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Text style={s.invAmount}>{formatCurrency(inv.balance)}</Text>
                          <Text style={[s.invDue, overdue && { color: Colors.danger }]}>
                            {overdue ? 'Overdue' : `Due ${formatDate(inv.dueDate)}`}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { gap: 2, paddingTop: 4 },
  greeting: { fontSize: 24, fontWeight: '900', color: Colors.text, letterSpacing: -0.5 },
  role: { fontSize: 13, color: Colors.muted, textTransform: 'capitalize' },

  clockedInCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  clockedInLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  clockedInJob: { color: '#fff', fontSize: 17, fontWeight: '800' },
  clockedInTime: { color: Colors.yellow, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  clockTapHint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },

  clockBanner: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  clockBannerText: { color: Colors.muted, fontSize: 14, fontWeight: '600' },

  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLink: { fontSize: 13, color: Colors.infoText, fontWeight: '700' },

  weekCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  weekRow: { flexDirection: 'row', alignItems: 'flex-end' },
  weekHours: { fontSize: 28, fontWeight: '900', color: Colors.navy, letterSpacing: -1 },
  weekLabel: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  weekGoal: { fontSize: 13, color: Colors.mutedLight, fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.navy, borderRadius: 4 },
  progressPct: { fontSize: 11, color: Colors.muted },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderTopWidth: 3, borderTopColor: Colors.border, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 22, fontWeight: '900', color: Colors.text, marginTop: 4, letterSpacing: -0.5 },

  alertBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  alertText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },

  jobCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobName: { fontSize: 14, fontWeight: '800', color: Colors.text },
  jobClient: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  jobProfit: { fontSize: 13, fontWeight: '700' },
  chevron: { fontSize: 20, color: Colors.mutedLight },

  invCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invNum: { fontSize: 14, fontWeight: '800', color: Colors.text },
  invJob: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  invAmount: { fontSize: 14, fontWeight: '900', color: Colors.text },
  invDue: { fontSize: 11, color: Colors.muted, fontWeight: '600' },

  searchWrap: { marginTop: -4 },
  searchInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    fontSize: 14,
    color: Colors.text,
  },
  jobStatus: { fontSize: 11, color: Colors.muted, fontWeight: '600' },
  empty: { textAlign: 'center', color: Colors.muted, paddingVertical: 8 },
});
