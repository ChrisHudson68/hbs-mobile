import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { JobListItem } from '../../src/mobile/types';
import { formatCurrency, isActiveStatus, isCompletedStatus, isManagerOrAdmin, isOnHoldStatus, isCancelledStatus } from '../../src/mobile/utils';
import { useAuth } from '../../src/mobile/context/AuthContext';

type StatusFilter = 'active' | 'on-hold' | 'completed' | 'all';

function statusColor(status: string | null) {
  if (isActiveStatus(status)) return Colors.success;
  if (isOnHoldStatus(status)) return Colors.warning;
  if (isCompletedStatus(status)) return Colors.muted;
  return Colors.danger;
}

function matchesFilter(job: JobListItem, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return isActiveStatus(job.status);
  if (filter === 'on-hold') return isOnHoldStatus(job.status);
  if (filter === 'completed') return isCompletedStatus(job.status) || isCancelledStatus(job.status);
  return true;
}

export default function JobsScreen() {
  const api = useApi();
  const router = useRouter();
  const { user } = useAuth();
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

  const counts = {
    active: jobs.filter(j => isActiveStatus(j.status)).length,
    'on-hold': jobs.filter(j => isOnHoldStatus(j.status)).length,
    completed: jobs.filter(j => isCompletedStatus(j.status) || isCancelledStatus(j.status)).length,
    all: jobs.length,
  };

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={s.title}>Jobs</Text>
        {canManage && (
          <Pressable style={s.addBtn} onPress={() => router.push('/jobs/new')}>
            <Text style={s.addBtnText}>+ New Job</Text>
          </Pressable>
        )}
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search jobs..."
          placeholderTextColor={Colors.mutedLight}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterRow}>
        {(['active', 'on-hold', 'completed', 'all'] as StatusFilter[]).map(f => (
          <Pressable key={f} style={[s.filterPill, statusFilter === f && s.filterPillActive]} onPress={() => setStatusFilter(f)}>
            <Text style={[s.filterPillText, statusFilter === f && s.filterPillTextActive]}>
              {f === 'active' ? 'Active' : f === 'on-hold' ? 'On Hold' : f === 'completed' ? 'Completed' : 'All'}
              {' '}
              <Text style={[s.filterCount, statusFilter === f && s.filterCountActive]}>{counts[f]}</Text>
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {filtered.length === 0 && (
          <Text style={s.empty}>{search ? 'No jobs match your search.' : 'No jobs in this category.'}</Text>
        )}
        {filtered.map(job => (
          <Pressable key={job.id} style={s.card} onPress={() => router.push(`/jobs/${job.id}`)}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.jobName}>{job.jobName ?? 'Untitled Job'}</Text>
                {job.clientName ? <Text style={s.client}>{job.clientName}</Text> : null}
              </View>
              <View style={[s.badge, { backgroundColor: statusColor(job.status) + '20' }]}>
                <Text style={[s.badgeText, { color: statusColor(job.status) }]}>{job.status ?? 'Active'}</Text>
              </View>
            </View>
            {job.isOverhead && (
              <View style={s.overheadTag}>
                <Text style={s.overheadTagText}>Overhead</Text>
              </View>
            )}
            {job.financials && (
              <View style={s.financials}>
                <Text style={s.fin}>Profit: <Text style={{ color: Number(job.financials.profit) >= 0 ? Colors.success : Colors.danger }}>{formatCurrency(job.financials.profit)}</Text></Text>
                <Text style={s.fin}>Hours: {Number(job.financials.totalHours).toFixed(1)}</Text>
                {Number(job.financials.unpaidInvoices) > 0 && (
                  <Text style={[s.fin, { color: Colors.danger }]}>{job.financials.unpaidInvoices} unpaid inv.</Text>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text },
  addBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchWrap: { paddingHorizontal: Spacing.md, paddingBottom: 8 },
  search: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 10, fontSize: 14, color: Colors.text },
  filterBar: { flexGrow: 0, paddingBottom: 10 },
  filterRow: { paddingHorizontal: Spacing.md, gap: 8, flexDirection: 'row' },
  filterPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  filterPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterPillText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  filterPillTextActive: { color: '#fff' },
  filterCount: { fontSize: 12, color: Colors.mutedLight },
  filterCountActive: { color: 'rgba(255,255,255,0.7)' },
  scroll: { padding: Spacing.md, paddingTop: 0, gap: 10 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.xl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  jobName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  client: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  overheadTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: Colors.warningBg, borderWidth: 1, borderColor: Colors.warningBorder },
  overheadTagText: { fontSize: 10, fontWeight: '700', color: Colors.warning },
  financials: { flexDirection: 'row', gap: 12 },
  fin: { fontSize: 12, color: Colors.muted },
});
