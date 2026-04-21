import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { JobExpense, JobIncome, JobListItem, JobTimeEntry } from '../../src/mobile/types';
import { formatCurrency, formatDate, formatHours, isManagerOrAdmin } from '../../src/mobile/utils';

type Tab = 'overview' | 'income' | 'expenses' | 'time';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = isManagerOrAdmin(user);

  const [job, setJob] = useState<JobListItem | null>(null);
  const [income, setIncome] = useState<JobIncome[]>([]);
  const [expenseList, setExpenseList] = useState<JobExpense[]>([]);
  const [timeEntries, setTimeEntries] = useState<JobTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const [addingIncome, setAddingIncome] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().slice(0, 10));
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeSaving, setIncomeSaving] = useState(false);

  const jobId = Number(id);

  const load = useCallback(async (isRefresh = false) => {
    if (!jobId) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [jobRes, incomeRes, expRes, timeRes] = await Promise.all([
        api.getJobDetail(jobId),
        canManage ? api.getJobIncome(jobId).catch(() => null) : Promise.resolve(null),
        canManage ? api.getJobExpenses(jobId).catch(() => null) : Promise.resolve(null),
        canManage ? api.getJobTimeEntries(jobId).catch(() => null) : Promise.resolve(null),
      ]);
      if (jobRes.job) {
        setJob(jobRes.job);
        navigation.setOptions({ title: jobRes.job.jobName ?? 'Job Details' });
      }
      if (incomeRes?.income) setIncome(incomeRes.income);
      if (expRes?.expenses) setExpenseList(expRes.expenses);
      if (timeRes?.entries) setTimeEntries(timeRes.entries);
    } catch { /* ignore */ }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [api, jobId, canManage, navigation]);

  useEffect(() => { void load(); }, [load]);

  const handleAddIncome = async () => {
    if (!incomeAmount.trim()) { Alert.alert('Required', 'Enter an amount.'); return; }
    setIncomeSaving(true);
    try {
      await api.addJobIncome(jobId, {
        amount: parseFloat(incomeAmount),
        date: incomeDate,
        description: incomeDesc.trim() || undefined,
      });
      setIncomeAmount(''); setIncomeDesc(''); setAddingIncome(false);
      await load();
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setIncomeSaving(false); }
  };

  const handleDeleteIncome = (incomeId: number) => {
    Alert.alert('Delete Income', 'Remove this income entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteJobIncome(jobId, incomeId); await load(); }
        catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
      }},
    ]);
  };

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  if (!job) {
    return <SafeAreaView style={s.safe}><View style={s.center}><Text style={s.empty}>Job not found.</Text></View></SafeAreaView>;
  }

  const f = job.financials;
  const totalExpenses = expenseList.reduce((sum, e) => sum + e.amount, 0);
  const totalTime = timeEntries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.heroCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>{job.jobName}</Text>
            {job.clientName ? <Text style={s.heroSub}>{job.clientName}</Text> : null}
          </View>
          {canManage && (
            <Pressable style={s.editBtn} onPress={() => router.push({ pathname: '/jobs/new', params: { editId: id } })}>
              <Text style={s.editBtnText}>Edit</Text>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={s.heroBadge}><Text style={s.heroBadgeText}>{job.status ?? 'Active'}</Text></View>
          {job.isOverhead && <View style={[s.heroBadge, { backgroundColor: 'rgba(245,158,11,0.2)' }]}><Text style={[s.heroBadgeText, { color: Colors.yellow }]}>Overhead</Text></View>}
        </View>
      </View>

      <View style={s.tabBar}>
        {(['overview', 'income', 'expenses', 'time'] as Tab[]).map(t => (
          <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {tab === 'overview' && f && (
          <>
            <View style={s.statsGrid}>
              <View style={s.statCard}><Text style={s.statLabel}>Income</Text><Text style={s.statValue}>{formatCurrency(f.totalIncome)}</Text></View>
              <View style={s.statCard}><Text style={s.statLabel}>Expenses</Text><Text style={s.statValue}>{formatCurrency(f.totalExpenses)}</Text></View>
              <View style={s.statCard}><Text style={s.statLabel}>Labor</Text><Text style={s.statValue}>{formatCurrency(f.totalLabor)}</Text></View>
              <View style={[s.statCard, { borderTopColor: Number(f.profit) >= 0 ? Colors.success : Colors.danger }]}>
                <Text style={s.statLabel}>Profit</Text>
                <Text style={[s.statValue, { color: Number(f.profit) >= 0 ? Colors.success : Colors.danger }]}>{formatCurrency(f.profit)}</Text>
              </View>
            </View>
            <View style={s.statsGrid}>
              <View style={s.statCard}><Text style={s.statLabel}>Invoiced</Text><Text style={s.statValue}>{formatCurrency(f.totalInvoiced)}</Text></View>
              <View style={s.statCard}><Text style={s.statLabel}>Collected</Text><Text style={s.statValue}>{formatCurrency(f.totalCollected)}</Text></View>
              <View style={s.statCard}><Text style={s.statLabel}>Hours</Text><Text style={s.statValue}>{formatHours(f.totalHours)}</Text></View>
              <View style={s.statCard}><Text style={s.statLabel}>Unpaid Inv.</Text><Text style={s.statValue}>{f.unpaidInvoices}</Text></View>
            </View>
            {(job as any).jobDescription ? (
              <View style={s.card}><Text style={s.cardTitle}>Description</Text><Text style={s.cardBody}>{(job as any).jobDescription}</Text></View>
            ) : null}
          </>
        )}

        {tab === 'income' && (
          <>
            {canManage && !addingIncome && (
              <Pressable style={s.addRowBtn} onPress={() => setAddingIncome(true)}>
                <Text style={s.addRowBtnText}>+ Add Income</Text>
              </Pressable>
            )}
            {addingIncome && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Add Income</Text>
                <TextInput style={s.input} placeholder="Amount (e.g. 1500.00)" value={incomeAmount} onChangeText={setIncomeAmount} keyboardType="decimal-pad" placeholderTextColor={Colors.mutedLight} />
                <TextInput style={s.input} placeholder="Date (YYYY-MM-DD)" value={incomeDate} onChangeText={setIncomeDate} placeholderTextColor={Colors.mutedLight} />
                <TextInput style={s.input} placeholder="Description (optional)" value={incomeDesc} onChangeText={setIncomeDesc} placeholderTextColor={Colors.mutedLight} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={[s.saveBtn, { flex: 1 }]} onPress={() => void handleAddIncome()} disabled={incomeSaving}>
                    {incomeSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
                  </Pressable>
                  <Pressable style={[s.cancelBtn, { flex: 1 }]} onPress={() => setAddingIncome(false)}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {income.length === 0 && <Text style={s.empty}>No income recorded.</Text>}
            {income.map(i => (
              <View key={i.id} style={s.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowAmount}>{formatCurrency(i.amount)}</Text>
                  <Text style={s.rowSub}>{formatDate(i.date)}{i.description ? ` · ${i.description}` : ''}</Text>
                </View>
                {canManage && (
                  <Pressable onPress={() => handleDeleteIncome(i.id)} style={s.deleteBtn}>
                    <Text style={s.deleteBtnText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}

        {tab === 'expenses' && (
          <>
            {canManage && (
              <Pressable style={s.addRowBtn} onPress={() => router.push({ pathname: '/expenses/new', params: { jobId: id } })}>
                <Text style={s.addRowBtnText}>+ Add Expense</Text>
              </Pressable>
            )}
            {expenseList.length === 0
              ? <Text style={s.empty}>No expenses recorded.</Text>
              : (
                <>
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Total Expenses</Text>
                    <Text style={s.summaryValue}>{formatCurrency(totalExpenses)}</Text>
                  </View>
                  {expenseList.map(e => (
                    <View key={e.id} style={s.rowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowAmount}>{formatCurrency(e.amount)}</Text>
                        <Text style={s.rowSub}>{e.category}{e.vendor ? ` · ${e.vendor}` : ''} · {formatDate(e.date)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )
            }
          </>
        )}

        {tab === 'time' && (
          <>
            {canManage && (
              <Pressable style={s.addRowBtn} onPress={() => router.push({ pathname: '/timesheets/manual', params: { jobId: id } })}>
                <Text style={s.addRowBtnText}>+ Add Time Entry</Text>
              </Pressable>
            )}
            {timeEntries.length === 0
              ? <Text style={s.empty}>No time entries recorded.</Text>
              : (
                <>
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Total Hours</Text>
                    <Text style={s.summaryValue}>{formatHours(totalTime)}</Text>
                  </View>
                  {timeEntries.map(e => (
                    <View key={e.id} style={s.rowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowAmount}>{e.employeeName}</Text>
                        <Text style={s.rowSub}>{formatDate(e.date)}{e.note ? ` · ${e.note}` : ''}</Text>
                      </View>
                      <Text style={s.rowHours}>{formatHours(e.hours)}</Text>
                    </View>
                  ))}
                </>
              )
            }
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: Colors.navy, padding: Spacing.md, gap: 4 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  editBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.navy },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  tabTextActive: { color: Colors.navy, fontWeight: '800' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderTopWidth: 3, borderTopColor: Colors.border, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 18, fontWeight: '900', color: Colors.text, marginTop: 4 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  cardBody: { fontSize: 14, color: Colors.muted, lineHeight: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: Colors.muted },
  summaryValue: { fontSize: 15, fontWeight: '900', color: Colors.text },
  addRowBtn: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.infoBorder },
  addRowBtnText: { color: Colors.infoText, fontWeight: '700', fontSize: 13 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 10, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.muted, fontWeight: '700', fontSize: 14 },
  rowCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center' },
  rowAmount: { fontSize: 15, fontWeight: '800', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  rowHours: { fontSize: 14, fontWeight: '700', color: Colors.navy },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 16 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: 8 },
});
