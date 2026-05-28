import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { useTheme } from '../../src/mobile/theme';
import type { JobExpense, JobIncome, JobListItem, JobTimeEntry } from '../../src/mobile/types';
import { formatCurrency, formatDate, formatHours, isActiveStatus, isManagerOrAdmin } from '../../src/mobile/utils';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ListRow } from '@/components/ui/ListRow';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Tab = 'overview' | 'income' | 'expenses' | 'time';

const STATUS_VALUES = ['Active', 'On Hold', 'Completed'] as const;
const TAB_VALUES = ['Overview', 'Income', 'Expenses', 'Time'] as const;
const TAB_KEYS: Tab[] = ['overview', 'income', 'expenses', 'time'];

function statusTone(status: string | null): 'success' | 'warning' | 'neutral' {
  if (isActiveStatus(status)) return 'success';
  if (status === 'On Hold') return 'warning';
  return 'neutral';
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const canManage = isManagerOrAdmin(user);

  const [job, setJob] = useState<JobListItem | null>(null);
  const [income, setIncome] = useState<JobIncome[]>([]);
  const [expenseList, setExpenseList] = useState<JobExpense[]>([]);
  const [timeEntries, setTimeEntries] = useState<JobTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const [statusSaving, setStatusSaving] = useState(false);

  const [editExpense, setEditExpense] = useState<JobExpense | null>(null);
  const [expCategory, setExpCategory] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expSaving, setExpSaving] = useState(false);

  const [editTimeEntry, setEditTimeEntry] = useState<JobTimeEntry | null>(null);
  const [timeEditHours, setTimeEditHours] = useState('');
  const [timeEditNote, setTimeEditNote] = useState('');
  const [timeEditSaving, setTimeEditSaving] = useState(false);

  const [addingIncome, setAddingIncome] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().slice(0, 10));
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeAmountError, setIncomeAmountError] = useState<string | undefined>(undefined);

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

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === job?.status) return;
    setStatusSaving(true);
    try {
      await api.updateJob(jobId, { status: newStatus });
      await load();
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setStatusSaving(false); }
  };

  const handleAddIncome = async () => {
    if (!incomeAmount.trim()) { setIncomeAmountError('Enter a valid amount'); return; }
    setIncomeAmountError(undefined);
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

  const openEditExpense = (exp: JobExpense) => {
    setEditExpense(exp);
    setExpCategory(exp.category);
    setExpVendor(exp.vendor ?? '');
    setExpAmount(String(exp.amount));
    setExpDate(exp.date);
  };

  const confirmEditExpense = async () => {
    if (!editExpense) return;
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    setExpSaving(true);
    try {
      await api.editExpense(editExpense.id, {
        category: expCategory.trim(),
        vendor: expVendor.trim() || undefined,
        amount,
        date: expDate.trim(),
      });
      setEditExpense(null);
      await load();
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setExpSaving(false); }
  };

  const handleDeleteExpense = (expenseId: number) => {
    Alert.alert('Delete Expense', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteExpense(expenseId); await load(); }
        catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
      }},
    ]);
  };

  const handleDeleteTimeEntry = (entryId: number) => {
    Alert.alert('Delete Time Entry', 'Remove this time entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteTimeEntry(entryId); await load(); }
        catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
      }},
    ]);
  };

  const openEditTimeEntry = (entry: JobTimeEntry) => {
    setEditTimeEntry(entry);
    setTimeEditHours(String(entry.hours));
    setTimeEditNote(entry.note ?? '');
  };

  const confirmEditTimeEntry = async () => {
    if (!editTimeEntry) return;
    const hours = parseFloat(timeEditHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Invalid', 'Enter a valid number of hours (0–24).');
      return;
    }
    setTimeEditSaving(true);
    try {
      await api.editTimeEntry(editTimeEntry.id, {
        hours,
        note: timeEditNote.trim() || null,
      });
      setEditTimeEntry(null);
      await load();
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setTimeEditSaving(false); }
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
    return (
      <Screen headerMode="native">
        <View style={s.center}><ActivityIndicator size="large" color={colors.navy} /></View>
      </Screen>
    );
  }

  if (!job) {
    return (
      <Screen headerMode="native">
        <View style={s.center}><Text variant="body" tone="muted">Job not found.</Text></View>
      </Screen>
    );
  }

  const f = job.financials;
  const totalExpenses = expenseList.reduce((sum, e) => sum + e.amount, 0);
  const totalTime = timeEntries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <Screen headerMode="native" padded={false}>
      {/* Edit Time Entry Modal — kept as RN Modal, internals reskinned */}
      <Modal visible={!!editTimeEntry} transparent animationType="fade" onRequestClose={() => setEditTimeEntry(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
            <Text variant="title3" weight="700">Edit Time Entry</Text>
            {editTimeEntry ? (
              <Text variant="footnote" tone="muted">
                {editTimeEntry.employeeName} · {formatDate(editTimeEntry.date)}
              </Text>
            ) : null}
            <Input
              label="Hours"
              placeholder="e.g. 8.0"
              value={timeEditHours}
              onChangeText={setTimeEditHours}
              keyboardType="decimal-pad"
            />
            <Input
              label="Note (optional)"
              placeholder="Optional note"
              value={timeEditNote}
              onChangeText={setTimeEditNote}
            />
            <View style={s.modalBtnRow}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  label="Save"
                  onPress={() => void confirmEditTimeEntry()}
                  loading={timeEditSaving}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  label="Cancel"
                  onPress={() => setEditTimeEntry(null)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Expense Modal — kept as RN Modal, internals reskinned */}
      <Modal visible={!!editExpense} transparent animationType="fade" onRequestClose={() => setEditExpense(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
            <Text variant="title3" weight="700">Edit Expense</Text>
            <Input
              label="Category"
              placeholder="Category"
              value={expCategory}
              onChangeText={setExpCategory}
            />
            <Input
              label="Vendor (optional)"
              placeholder="Vendor"
              value={expVendor}
              onChangeText={setExpVendor}
            />
            <Input
              label="Amount"
              placeholder="0.00"
              value={expAmount}
              onChangeText={setExpAmount}
              keyboardType="decimal-pad"
            />
            <Input
              label="Date"
              placeholder="YYYY-MM-DD"
              value={expDate}
              onChangeText={setExpDate}
            />
            <View style={s.modalBtnRow}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  label="Save"
                  onPress={() => void confirmEditExpense()}
                  loading={expSaving}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  label="Cancel"
                  onPress={() => setEditExpense(null)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hero section */}
      <View
        testID="jobdetail-hero"
        style={{
          backgroundColor: colors.navy,
          padding: spacing.md,
          gap: 4,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        }}
      >
        <Text variant="title2" tone="inverse" weight="700">{job.jobName}</Text>
        {job.clientName ? <Text variant="body" tone="inverse">{job.clientName}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Badge tone={statusTone(job.status)} label={job.status ?? 'Active'} />
          {job.isOverhead && <Badge tone="warning" label="Overhead" />}
        </View>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            label="Edit"
            onPress={() => router.push({ pathname: '/jobs/new', params: { editId: id } })}
          />
        )}
      </View>

      {/* Status switcher (manager only) — native SegmentedControl */}
      {canManage && (
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: 10 }}>
          <SegmentedControl
            values={[...STATUS_VALUES]}
            selectedIndex={STATUS_VALUES.indexOf((job.status ?? 'Active') as typeof STATUS_VALUES[number])}
            onChange={(e) => void handleStatusChange(
              STATUS_VALUES[e.nativeEvent.selectedSegmentIndex]
            )}
            tintColor={colors.navy}
            enabled={!statusSaving}
          />
        </View>
      )}

      {/* Section tabs — native SegmentedControl */}
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        <SegmentedControl
          values={[...TAB_VALUES]}
          selectedIndex={TAB_KEYS.indexOf(tab)}
          onChange={(e) => setTab(TAB_KEYS[e.nativeEvent.selectedSegmentIndex])}
          tintColor={colors.navy}
          testID="jobdetail-section-tabs"
        />
      </View>

      {/* Tab content */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {/* Overview tab */}
        {tab === 'overview' && (
          <>
            {canManage && f ? (
              <>
                <View style={s.statsGrid}>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: colors.border, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Income</Text>
                      <Text variant="headline" weight="700">{formatCurrency(f.totalIncome)}</Text>
                    </Card>
                  </View>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: colors.border, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Expenses</Text>
                      <Text variant="headline" weight="700">{formatCurrency(f.totalExpenses)}</Text>
                    </Card>
                  </View>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: colors.border, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Labor</Text>
                      <Text variant="headline" weight="700">{formatCurrency(f.totalLabor)}</Text>
                    </Card>
                  </View>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: Number(f.profit) >= 0 ? colors.success : colors.danger, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Profit</Text>
                      <RNText style={{ color: Number(f.profit) >= 0 ? colors.success : colors.danger, fontSize: 17, fontWeight: '700' }}>
                        {formatCurrency(f.profit)}
                      </RNText>
                    </Card>
                  </View>
                </View>
                <View style={s.statsGrid}>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: colors.border, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Invoiced</Text>
                      <Text variant="headline" weight="700">{formatCurrency(f.totalInvoiced)}</Text>
                    </Card>
                  </View>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: colors.border, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Collected</Text>
                      <Text variant="headline" weight="700">{formatCurrency(f.totalCollected)}</Text>
                    </Card>
                  </View>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: colors.border, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Hours</Text>
                      <Text variant="headline" weight="700">{formatHours(f.totalHours)}</Text>
                    </Card>
                  </View>
                  <View style={s.statCardWrapper}>
                    <Card elevation="sm" padding="sm" radius="md">
                      <View style={{ borderTopWidth: 3, borderTopColor: colors.border, marginBottom: 6 }} />
                      <Text variant="caption" tone="muted">Unpaid Inv.</Text>
                      <Text variant="headline" weight="700">{f.unpaidInvoices}</Text>
                    </Card>
                  </View>
                </View>
              </>
            ) : !canManage ? (
              <Card elevation="sm" padding="md" radius="md">
                <Text variant="subhead" tone="muted">
                  {(job as any).jobDescription ?? 'No description available.'}
                </Text>
              </Card>
            ) : null}
            {canManage && (job as any).jobDescription ? (
              <Card elevation="sm" padding="md" radius="md">
                <Text variant="footnote" weight="700" tone="muted">Description</Text>
                <Text variant="body">{(job as any).jobDescription}</Text>
              </Card>
            ) : null}
          </>
        )}

        {/* Income tab */}
        {tab === 'income' && (
          <>
            {canManage && !addingIncome && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                label="+ Add Income"
                onPress={() => setAddingIncome(true)}
              />
            )}
            {addingIncome && (
              <Card elevation="sm" padding="md" radius="md">
                <Text variant="headline" weight="700">Add Income</Text>
                <Input
                  label="Amount"
                  placeholder="0.00"
                  value={incomeAmount}
                  onChangeText={(v) => { setIncomeAmount(v); if (incomeAmountError) setIncomeAmountError(undefined); }}
                  keyboardType="decimal-pad"
                  error={incomeAmountError}
                />
                <Input
                  label="Date"
                  placeholder="YYYY-MM-DD"
                  value={incomeDate}
                  onChangeText={setIncomeDate}
                />
                <Input
                  label="Description (optional)"
                  placeholder="Optional description"
                  value={incomeDesc}
                  onChangeText={setIncomeDesc}
                />
                <View style={s.modalBtnRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="primary"
                      size="md"
                      fullWidth
                      label="Save"
                      onPress={() => void handleAddIncome()}
                      loading={incomeSaving}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="secondary"
                      size="md"
                      fullWidth
                      label="Cancel"
                      onPress={() => setAddingIncome(false)}
                    />
                  </View>
                </View>
              </Card>
            )}
            {income.length === 0 ? (
              <View style={s.emptyState}>
                <IconSymbol name={'dollarsign.circle' as never} size={40} color={colors.mutedLight} />
                <RNText style={{ textAlign: 'center', color: colors.muted, fontSize: 15 }}>No income recorded yet.</RNText>
              </View>
            ) : (
              income.map(i => (
                <ListRow
                  key={i.id}
                  title={formatCurrency(i.amount)}
                  subtitle={`${formatDate(i.date)}${i.description ? ' · ' + i.description : ''}`}
                  trailing={canManage ? 'custom' : 'none'}
                  trailingCustom={
                    canManage
                      ? (
                        <Pressable onPress={() => handleDeleteIncome(i.id)} style={{ padding: 8 }}>
                          <RNText style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>✕</RNText>
                        </Pressable>
                      )
                      : undefined
                  }
                />
              ))
            )}
          </>
        )}

        {/* Expenses tab */}
        {tab === 'expenses' && (
          <>
            {canManage && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                label="+ Add Expense"
                onPress={() => router.push({ pathname: '/expenses/new', params: { jobId: id } })}
              />
            )}
            {expenseList.length === 0 ? (
              <View style={s.emptyState}>
                <IconSymbol name={'receipt' as never} size={40} color={colors.mutedLight} />
                <RNText style={{ textAlign: 'center', color: colors.muted, fontSize: 15 }}>No expenses recorded yet.</RNText>
              </View>
            ) : (
              <>
                <Card elevation="sm" padding="sm" radius="md">
                  <View style={s.summaryRow}>
                    <Text variant="subhead" weight="700" tone="muted">Total Expenses</Text>
                    <Text variant="subhead" weight="700">{formatCurrency(totalExpenses)}</Text>
                  </View>
                </Card>
                {expenseList.map(e => (
                  <ListRow
                    key={e.id}
                    title={formatCurrency(e.amount)}
                    subtitle={`${e.category}${e.vendor ? ' · ' + e.vendor : ''} · ${formatDate(e.date)}`}
                    trailing={canManage ? 'custom' : 'none'}
                    trailingCustom={
                      canManage
                        ? (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Pressable onPress={() => openEditExpense(e)} style={[s.editRowBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                              <RNText style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>Edit</RNText>
                            </Pressable>
                            <Pressable onPress={() => handleDeleteExpense(e.id)} style={{ padding: 8 }}>
                              <RNText style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>✕</RNText>
                            </Pressable>
                          </View>
                        )
                        : undefined
                    }
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* Time tab */}
        {tab === 'time' && (
          <>
            {canManage && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                label="+ Add Time Entry"
                onPress={() => router.push({ pathname: '/timesheets/manual', params: { jobId: id } })}
              />
            )}
            {timeEntries.length === 0 ? (
              <View style={s.emptyState}>
                <IconSymbol name={'clock' as never} size={40} color={colors.mutedLight} />
                <RNText style={{ textAlign: 'center', color: colors.muted, fontSize: 15 }}>No time entries yet.</RNText>
              </View>
            ) : (
              <>
                <Card elevation="sm" padding="sm" radius="md">
                  <View style={s.summaryRow}>
                    <Text variant="subhead" weight="700" tone="muted">Total Hours</Text>
                    <Text variant="subhead" weight="700">{formatHours(totalTime)}</Text>
                  </View>
                </Card>
                {timeEntries.map(e => (
                  <ListRow
                    key={e.id}
                    title={e.employeeName}
                    subtitle={`${formatDate(e.date)}${e.note ? ' · ' + e.note : ''} · ${formatHours(e.hours)}`}
                    trailing={canManage ? 'custom' : 'none'}
                    trailingCustom={
                      canManage
                        ? (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Pressable onPress={() => openEditTimeEntry(e)} style={[s.editRowBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                              <RNText style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>Edit</RNText>
                            </Pressable>
                            <Pressable onPress={() => handleDeleteTimeEntry(e.id)} style={{ padding: 8 }}>
                              <RNText style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>✕</RNText>
                            </Pressable>
                          </View>
                        )
                        : undefined
                    }
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCardWrapper: { flex: 1, minWidth: '45%' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  editRowBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalCard: { gap: 12, padding: 20 },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
});
