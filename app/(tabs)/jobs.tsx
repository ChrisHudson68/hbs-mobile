import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { JobListItem } from '../../src/mobile/types';
import { formatCurrency, isActiveStatus, isCompletedStatus, isManagerOrAdmin, isOnHoldStatus } from '../../src/mobile/utils';
import { useAuth } from '../../src/mobile/context/AuthContext';

function statusColor(status: string | null) {
  if (isActiveStatus(status)) return Colors.success;
  if (isOnHoldStatus(status)) return Colors.warning;
  if (isCompletedStatus(status)) return Colors.muted;
  return Colors.danger;
}

export default function JobsScreen() {
  const api = useApi();
  const router = useRouter();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
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
    !search || j.jobName?.toLowerCase().includes(search.toLowerCase()) ||
    j.clientName?.toLowerCase().includes(search.toLowerCase())
  );

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

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {filtered.length === 0 && (
          <Text style={s.empty}>{search ? 'No jobs match your search.' : 'No jobs found.'}</Text>
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
            {job.financials && (
              <View style={s.financials}>
                <Text style={s.fin}>Profit: <Text style={{ color: Number(job.financials.profit) >= 0 ? Colors.success : Colors.danger }}>{formatCurrency(job.financials.profit)}</Text></Text>
                <Text style={s.fin}>Hours: {Number(job.financials.totalHours).toFixed(1)}</Text>
                {Number(job.financials.unpaidInvoices) > 0 && (
                  <Text style={[s.fin, { color: Colors.danger }]}>{job.financials.unpaidInvoices} unpaid</Text>
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
  scroll: { padding: Spacing.md, paddingTop: 0, gap: 10 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.xl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  jobName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  client: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  financials: { flexDirection: 'row', gap: 12 },
  fin: { fontSize: 12, color: Colors.muted },
});
