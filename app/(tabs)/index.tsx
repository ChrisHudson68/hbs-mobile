import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { JobListItem, TimesheetsResponse } from '../../src/mobile/types';
import { buildDashboardMetrics, formatCurrency, formatDuration, formatHours, isManagerOrAdmin } from '../../src/mobile/utils';

export default function DashboardScreen() {
  const { user, tenantSubdomain, logout } = useAuth();
  const api = useApi();
  const router = useRouter();

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [timesheetData, setTimesheetData] = useState<TimesheetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [jobsRes, tsRes] = await Promise.all([
        api.getJobs().catch(() => null),
        api.getTimesheets().catch(() => null),
      ]);
      if (jobsRes?.jobs) setJobs(jobsRes.jobs);
      if (tsRes) setTimesheetData(tsRes);
    } catch {
      // ignore
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const entry = timesheetData?.activeClockEntry;
    if (!entry?.clockInAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(entry.clockInAt!).getTime()) / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [timesheetData?.activeClockEntry]);

  const handleClockOut = async () => {
    setClockLoading(true);
    try {
      await api.clockOut();
      void load();
    } catch (e) {
      Alert.alert('Clock Out', e instanceof Error ? e.message : 'Failed');
    } finally {
      setClockLoading(false);
    }
  };

  const metrics = buildDashboardMetrics(jobs);
  const activeEntry = timesheetData?.activeClockEntry;
  const canManage = isManagerOrAdmin(user);

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
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>{tenantSubdomain}</Text>
            <Text style={s.greeting}>Welcome, {user?.name}</Text>
            <Text style={s.role}>{user?.role}</Text>
          </View>
          <Pressable style={s.logoutBtn} onPress={() => void logout()}>
            <Text style={s.logoutText}>Log Out</Text>
          </Pressable>
        </View>

        {activeEntry ? (
          <View style={s.clockedInCard}>
            <Text style={s.clockedInLabel}>Currently Clocked In</Text>
            <Text style={s.clockedInJob}>{activeEntry.jobName ?? 'No Job'}</Text>
            <Text style={s.clockedInTime}>{formatDuration(elapsed)}</Text>
            <Pressable style={s.clockOutBtn} onPress={() => void handleClockOut()} disabled={clockLoading}>
              {clockLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.clockOutBtnText}>Clock Out</Text>}
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.clockInBanner} onPress={() => router.push('/(tabs)/timesheets')}>
            <Text style={s.clockInBannerText}>Not clocked in — tap to go to Timesheets</Text>
          </Pressable>
        )}

        {canManage && (
          <>
            <Text style={s.sectionTitle}>Overview</Text>
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
              <View style={[s.statCard, { borderTopColor: Colors.danger }]}>
                <Text style={s.statLabel}>Unpaid</Text>
                <Text style={[s.statValue, { fontSize: 16 }]}>{formatCurrency(metrics.unpaidBalance)}</Text>
              </View>
            </View>

            <Text style={s.sectionTitle}>Quick Access</Text>
            <View style={s.quickRow}>
              <Pressable style={s.quickBtn} onPress={() => router.push('/(tabs)/jobs')}>
                <Text style={s.quickBtnText}>Jobs</Text>
              </Pressable>
              <Pressable style={s.quickBtn} onPress={() => router.push('/(tabs)/invoices')}>
                <Text style={s.quickBtnText}>Invoices</Text>
              </Pressable>
              <Pressable style={s.quickBtn} onPress={() => router.push('/employees')}>
                <Text style={s.quickBtnText}>Employees</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={s.sectionTitle}>This Week</Text>
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Hours</Text>
            <Text style={s.statValue}>{formatHours(timesheetData?.summary?.totalHours)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Entries</Text>
            <Text style={s.statValue}>{timesheetData?.summary?.entryCount ?? 0}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 11, fontWeight: '800', color: Colors.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  greeting: { fontSize: 20, fontWeight: '900', color: Colors.text, marginTop: 2 },
  role: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  logoutText: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  clockedInCard: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.md, gap: 6, alignItems: 'center' },
  clockedInLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  clockedInJob: { color: '#fff', fontSize: 18, fontWeight: '800' },
  clockedInTime: { color: Colors.yellow, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  clockOutBtn: { marginTop: 4, backgroundColor: Colors.yellow, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 24 },
  clockOutBtnText: { color: Colors.navyDark, fontWeight: '800', fontSize: 14 },
  clockInBanner: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  clockInBannerText: { color: Colors.muted, fontSize: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderTopWidth: 3, borderTopColor: Colors.border, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 22, fontWeight: '900', color: Colors.text, marginTop: 4, letterSpacing: -0.5 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: Colors.navy },
});
