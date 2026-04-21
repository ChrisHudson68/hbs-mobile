import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { ClockInJobsResponse, JobListItem, TimesheetsResponse } from '../../src/mobile/types';
import { formatDate, formatDuration, formatHours, hasPermission, isManagerOrAdmin } from '../../src/mobile/utils';

function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(start: string): string {
  const end = addDays(start, 6);
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default function TimesheetsScreen() {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(todayStr));

  const [tsData, setTsData] = useState<TimesheetsResponse | null>(null);
  const [clockInJobs, setClockInJobs] = useState<ClockInJobsResponse['jobs']>([]);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const canClock = hasPermission(user, 'time.clock');
  const canViewJobs = hasPermission(user, 'jobs.view');
  const canManage = isManagerOrAdmin(user);

  const isCurrentWeek = weekAnchor === getWeekStart(todayStr);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [ts, jobsRes, clockJobsRes] = await Promise.all([
        api.getTimesheets(),
        canViewJobs ? api.getJobs().catch(() => null) : Promise.resolve(null),
        !canViewJobs && canClock ? api.getClockInJobs().catch(() => null) : Promise.resolve(null),
      ]);
      setTsData(ts);
      if (jobsRes?.jobs) setJobs(jobsRes.jobs);
      if (clockJobsRes?.jobs) setClockInJobs(clockJobsRes.jobs);
    } catch { /* ignore */ }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [api, canClock, canViewJobs]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const entry = tsData?.activeClockEntry;
    if (!entry?.clockInAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(entry.clockInAt!).getTime()) / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [tsData?.activeClockEntry]);

  const handleClockIn = async () => {
    if (!selectedJobId) { Alert.alert('Required', 'Select a job before clocking in.'); return; }
    setClockLoading(true);
    try {
      await api.clockIn({ jobId: selectedJobId });
      await load();
      Alert.alert('Clocked In', 'Your time entry has started.');
    } catch (e) { Alert.alert('Clock In', e instanceof Error ? e.message : 'Failed'); }
    finally { setClockLoading(false); }
  };

  const handleClockOut = async () => {
    setClockLoading(true);
    try {
      const res = await api.clockOut();
      await load();
      Alert.alert('Clocked Out', `Saved ${formatHours(res.entry?.hours)}.`);
    } catch (e) { Alert.alert('Clock Out', e instanceof Error ? e.message : 'Failed'); }
    finally { setClockLoading(false); }
  };

  const allJobs = canViewJobs ? jobs : (clockInJobs ?? []);
  const activeEntry = tsData?.activeClockEntry;

  const weekEntries = (tsData?.timesheets ?? []).filter(e => {
    const weekEnd = addDays(weekAnchor, 6);
    return e.date >= weekAnchor && e.date <= weekEnd;
  });

  const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={s.topBar}>
          <Text style={s.title}>Timesheets</Text>
          {canManage && (
            <Pressable style={s.addBtn} onPress={() => router.push('/timesheets/manual')}>
              <Text style={s.addBtnText}>+ Add Entry</Text>
            </Pressable>
          )}
        </View>

        {canClock && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Clock In / Out</Text>
            {activeEntry ? (
              <>
                <View style={s.activeEntryInfo}>
                  <Text style={s.activeJobName}>{activeEntry.jobName ?? 'No Job'}</Text>
                  <Text style={s.activeTimer}>{formatDuration(elapsed)}</Text>
                </View>
                <Pressable style={s.clockOutBtn} onPress={() => void handleClockOut()} disabled={clockLoading}>
                  {clockLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.clockOutBtnText}>Clock Out</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>Select Job</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                    {allJobs.map(j => (
                      <Pressable
                        key={j.id}
                        style={[s.jobPill, selectedJobId === j.id && s.jobPillActive]}
                        onPress={() => setSelectedJobId(j.id)}
                      >
                        <Text style={[s.jobPillText, selectedJobId === j.id && s.jobPillTextActive]}>
                          {j.jobName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <Pressable style={[s.clockInBtn, !selectedJobId && s.btnDisabled]} onPress={() => void handleClockIn()} disabled={clockLoading || !selectedJobId}>
                  {clockLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.clockInBtnText}>Clock In</Text>}
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Week navigation */}
        <View style={s.weekNav}>
          <Pressable style={s.weekNavBtn} onPress={() => setWeekAnchor(w => addDays(w, -7))}>
            <Text style={s.weekNavArrow}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.weekLabel}>{formatWeekRange(weekAnchor)}</Text>
            {!isCurrentWeek && (
              <Pressable onPress={() => setWeekAnchor(getWeekStart(todayStr))}>
                <Text style={s.weekTodayLink}>Back to this week</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={[s.weekNavBtn, isCurrentWeek && s.weekNavBtnDisabled]} onPress={() => {
            if (!isCurrentWeek) setWeekAnchor(w => addDays(w, 7));
          }}>
            <Text style={[s.weekNavArrow, isCurrentWeek && { color: Colors.border }]}>›</Text>
          </Pressable>
        </View>

        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Hours</Text>
            <Text style={s.summaryValue}>{weekTotal.toFixed(2)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Entries</Text>
            <Text style={s.summaryValue}>{weekEntries.length}</Text>
          </View>
          {tsData?.summary?.weekApproved && (
            <View style={[s.summaryCard, { borderTopColor: Colors.success }]}>
              <Text style={s.summaryLabel}>Status</Text>
              <Text style={[s.summaryValue, { fontSize: 13, color: Colors.success }]}>Approved</Text>
            </View>
          )}
        </View>

        {weekEntries.length === 0 && <Text style={s.empty}>No entries for this week.</Text>}
        {weekEntries.map(entry => (
          <View key={entry.id} style={s.entryCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.entryJob}>{entry.jobName ?? 'General Time'}</Text>
              <Text style={s.entryHours}>{formatHours(entry.hours)}</Text>
            </View>
            <Text style={s.entryDate}>{formatDate(entry.date)}</Text>
            {entry.note ? <Text style={s.entryNote}>{entry.note}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text },
  addBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  activeEntryInfo: { alignItems: 'center', gap: 4 },
  activeJobName: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  activeTimer: { fontSize: 30, fontWeight: '900', color: Colors.yellow, letterSpacing: -0.5 },
  clockOutBtn: { backgroundColor: Colors.danger, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  clockOutBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  jobPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  jobPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  jobPillText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  jobPillTextActive: { color: '#fff' },
  clockInBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  clockInBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: Colors.border },
  weekNavBtn: { padding: 8 },
  weekNavBtnDisabled: { opacity: 0.3 },
  weekNavArrow: { fontSize: 24, fontWeight: '700', color: Colors.navy },
  weekLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  weekTodayLink: { fontSize: 11, color: Colors.infoText, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, borderTopColor: Colors.navy },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase' },
  summaryValue: { fontSize: 20, fontWeight: '900', color: Colors.text, marginTop: 4 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: 8 },
  entryCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  entryJob: { fontSize: 14, fontWeight: '700', color: Colors.text },
  entryHours: { fontSize: 14, fontWeight: '700', color: Colors.navy },
  entryDate: { fontSize: 12, color: Colors.muted },
  entryNote: { fontSize: 12, color: Colors.muted, fontStyle: 'italic' },
});
