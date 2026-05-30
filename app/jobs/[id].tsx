import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, LayoutAnimation, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
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
import { Sheet } from '@/components/ui/Sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SwipeRow, closeOpenSwipeRow } from '@/components/ui/SwipeRow';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { EmptyState } from '@/components/ui/EmptyState';

type Tab = 'overview' | 'income' | 'expenses' | 'time';

const STATUS_VALUES = ['Active', 'On Hold', 'Completed'] as const;
const TAB_VALUES = ['Overview', 'Income', 'Expenses', 'Time'] as const;
const TAB_KEYS: Tab[] = ['overview', 'income', 'expenses', 'time'];

function statusTone(status: string | null): 'success' | 'warning' | 'neutral' {
  if (isActiveStatus(status)) return 'success';
  if (status === 'On Hold') return 'warning';
  return 'neutral';
}

// Standard Cancel/Save sheet header (Pattern A — D-04).
function SheetHeader({
  title,
  onCancel,
  onSave,
  saveLabel = 'Save',
  loading = false,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  loading?: boolean;
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 44,
        marginBottom: spacing.sm,
      }}
    >
      <Button variant="ghost" size="sm" label="Cancel" onPress={onCancel} />
      <Text variant="headline" weight="600">{title}</Text>
      <Button variant="primary" size="sm" label={saveLabel} onPress={onSave} loading={loading} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// RowSwipeActions — shared swipe panel for job-detail expense + time rows.
// Delete (danger/trash) first, then Edit (navy/pencil) — matches the locked
// 06-UI-SPEC action contract (Delete shown first on left-swipe). Panel = 144pt
// (2 × 72pt). Uses sv.get() via useAnimatedStyle — React Compiler-compliant
// (D-12). Icon-only buttons carry accessibilityLabels.
// ---------------------------------------------------------------------------

const SWIPE_BUTTON_WIDTH = 72;
const SWIPE_PANEL_WIDTH = SWIPE_BUTTON_WIDTH * 2;

type RowSwipeActionsProps = {
  drag: SharedValue<number>;
  methods: SwipeableMethods;
  onDelete: () => void;
  onEdit: () => void;
  testIDDelete: string;
  testIDEdit: string;
  deleteLabel: string;
  editLabel: string;
};

function RowSwipeActions({
  drag,
  methods,
  onDelete,
  onEdit,
  testIDDelete,
  testIDEdit,
  deleteLabel,
  editLabel,
}: RowSwipeActionsProps) {
  const { colors, radius } = useTheme();

  // Translate the panel so it anchors to the right edge during the swipe
  // (Pitfall 3: drag is negative for left-swipe / right-actions revealed).
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          drag.get(),
          [-SWIPE_PANEL_WIDTH, 0],
          [0, SWIPE_PANEL_WIDTH],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[{ width: SWIPE_PANEL_WIDTH, flexDirection: 'row' }, animStyle]}>
      <Pressable
        style={[s.swipeBtn, { backgroundColor: colors.danger, borderRadius: radius.sm }]}
        onPress={() => { methods.close(); onDelete(); }}
        accessibilityLabel={deleteLabel}
        testID={testIDDelete}
      >
        <IconSymbol name={'trash' as never} size={20} color={colors.inverse} />
      </Pressable>
      <Pressable
        style={[s.swipeBtn, { backgroundColor: colors.navy, borderRadius: radius.sm }]}
        onPress={() => { methods.close(); onEdit(); }}
        accessibilityLabel={editLabel}
        testID={testIDEdit}
      >
        <IconSymbol name={'pencil' as never} size={20} color={colors.inverse} />
      </Pressable>
    </Animated.View>
  );
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

  const [editExpenseEntry, setEditExpenseEntry] = useState<JobExpense | null>(null);
  const [expCategory, setExpCategory] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expSaving, setExpSaving] = useState(false);
  const [expAmountError, setExpAmountError] = useState<string | undefined>(undefined);

  const [editTimeEntry, setEditTimeEntry] = useState<JobTimeEntry | null>(null);
  const [timeEditHours, setTimeEditHours] = useState('');
  const [timeEditNote, setTimeEditNote] = useState('');
  const [timeEditSaving, setTimeEditSaving] = useState(false);
  const [timeEditHoursError, setTimeEditHoursError] = useState<string | undefined>(undefined);

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
    setEditExpenseEntry(exp);
    setExpCategory(exp.category);
    setExpVendor(exp.vendor ?? '');
    setExpAmount(String(exp.amount));
    setExpDate(exp.date);
    setExpAmountError(undefined);
  };

  const confirmEditExpense = async () => {
    if (!editExpenseEntry) return;
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      setExpAmountError('Enter a valid amount');
      return;
    }
    setExpAmountError(undefined);
    setExpSaving(true);
    try {
      await api.editExpense(editExpenseEntry.id, {
        category: expCategory.trim(),
        vendor: expVendor.trim() || undefined,
        amount,
        date: expDate.trim(),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditExpenseEntry(null);
      await load();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
    finally { setExpSaving(false); }
  };

  const handleDeleteExpense = (expenseId: number) => {
    Alert.alert('Delete Expense', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteExpense(expenseId);
          // Slide the deleted row out before the list re-renders (D-10).
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          await load();
        }
        catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
      }},
    ]);
  };

  const handleDeleteTimeEntry = (entryId: number) => {
    Alert.alert('Delete Time Entry', 'Remove this time entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteTimeEntry(entryId);
          // Slide the deleted row out before the list re-renders (D-10).
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          await load();
        }
        catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
      }},
    ]);
  };

  const openEditTimeEntry = (entry: JobTimeEntry) => {
    setEditTimeEntry(entry);
    setTimeEditHours(String(entry.hours));
    setTimeEditNote(entry.note ?? '');
    setTimeEditHoursError(undefined);
  };

  const confirmEditTimeEntry = async () => {
    if (!editTimeEntry) return;
    const hours = parseFloat(timeEditHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      setTimeEditHoursError('Enter valid hours (0–24)');
      return;
    }
    setTimeEditHoursError(undefined);
    setTimeEditSaving(true);
    try {
      await api.editTimeEntry(editTimeEntry.id, {
        hours,
        note: timeEditNote.trim() || null,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditTimeEntry(null);
      await load();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
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
      <Screen headerMode="native" testID="jobdetail-skeleton">
        <View style={{ padding: spacing.md, gap: 10 }}>
          {/* Tab-bar rect — mimics the section SegmentedControl */}
          <SkeletonBlock width="100%" height={40} borderRadius={radius.md} />
          {[0, 1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </View>
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
        onScrollBeginDrag={closeOpenSwipeRow}
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
            {canManage && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                label="+ Add Income"
                onPress={() => setAddingIncome(true)}
              />
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
              <EmptyState
                icon="creditcard"
                message="No expenses."
                actionLabel={canManage ? 'Add Expense' : undefined}
                onAction={canManage ? () => router.push({ pathname: '/expenses/new', params: { jobId: id } }) : undefined}
                testID="jobdetail-expense-empty"
              />
            ) : (
              <>
                <Card elevation="sm" padding="sm" radius="md">
                  <View style={s.summaryRow}>
                    <Text variant="subhead" weight="700" tone="muted">Total Expenses</Text>
                    <Text variant="subhead" weight="700">{formatCurrency(totalExpenses)}</Text>
                  </View>
                </Card>
                {expenseList.map(e => (
                  <SwipeRow
                    key={e.id}
                    testID={`job-expense-row-${e.id}`}
                    enabled={canManage}
                    renderActions={(drag, methods) => (
                      <RowSwipeActions
                        drag={drag}
                        methods={methods}
                        onDelete={() => { methods.close(); handleDeleteExpense(e.id); }}
                        onEdit={() => { methods.close(); openEditExpense(e); }}
                        testIDDelete={`job-expense-delete-${e.id}`}
                        testIDEdit={`job-expense-edit-${e.id}`}
                        deleteLabel="Delete expense"
                        editLabel="Edit expense"
                      />
                    )}
                  >
                    <ListRow
                      title={formatCurrency(e.amount)}
                      subtitle={`${e.category}${e.vendor ? ' · ' + e.vendor : ''} · ${formatDate(e.date)}`}
                      trailing="none"
                    />
                  </SwipeRow>
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
              <EmptyState
                icon="clock"
                message="No time entries."
                actionLabel={canManage ? 'Add Entry' : undefined}
                onAction={canManage ? () => router.push({ pathname: '/timesheets/manual', params: { jobId: id } }) : undefined}
                testID="jobdetail-time-empty"
              />
            ) : (
              <>
                <Card elevation="sm" padding="sm" radius="md">
                  <View style={s.summaryRow}>
                    <Text variant="subhead" weight="700" tone="muted">Total Hours</Text>
                    <Text variant="subhead" weight="700">{formatHours(totalTime)}</Text>
                  </View>
                </Card>
                {timeEntries.map(e => (
                  <SwipeRow
                    key={e.id}
                    testID={`job-time-row-${e.id}`}
                    enabled={canManage}
                    renderActions={(drag, methods) => (
                      <RowSwipeActions
                        drag={drag}
                        methods={methods}
                        onDelete={() => { methods.close(); handleDeleteTimeEntry(e.id); }}
                        onEdit={() => { methods.close(); openEditTimeEntry(e); }}
                        testIDDelete={`job-time-delete-${e.id}`}
                        testIDEdit={`job-time-edit-${e.id}`}
                        deleteLabel="Delete entry"
                        editLabel="Edit entry"
                      />
                    )}
                  >
                    <ListRow
                      title={e.employeeName}
                      subtitle={`${formatDate(e.date)}${e.note ? ' · ' + e.note : ''} · ${formatHours(e.hours)}`}
                      trailing="none"
                    />
                  </SwipeRow>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Time Entry Sheet — sibling at screen root (gorhom anchoring pattern) */}
      {!!editTimeEntry && (
        <Sheet
          testID="jobdetail-edit-time-sheet"
          snapPoints={['55%']}
          onClose={() => setEditTimeEntry(null)}
          header={
            <SheetHeader
              title="Edit Entry"
              onCancel={() => setEditTimeEntry(null)}
              onSave={() => void confirmEditTimeEntry()}
              loading={timeEditSaving}
            />
          }
        >
          {editTimeEntry ? (
            <Text variant="footnote" tone="muted">
              {editTimeEntry.employeeName} · {formatDate(editTimeEntry.date)}
            </Text>
          ) : null}
          <Input
            label="Hours"
            placeholder="e.g. 8.0"
            value={timeEditHours}
            onChangeText={(v) => { setTimeEditHours(v); if (timeEditHoursError) setTimeEditHoursError(undefined); }}
            keyboardType="decimal-pad"
            error={timeEditHoursError}
          />
          <Input
            label="Note (optional)"
            placeholder="Optional note"
            value={timeEditNote}
            onChangeText={setTimeEditNote}
          />
        </Sheet>
      )}

      {/* Edit Expense Sheet — sibling at screen root (gorhom anchoring pattern) */}
      {!!editExpenseEntry && (
        <Sheet
          testID="jobdetail-edit-expense-sheet"
          snapPoints={['60%']}
          onClose={() => setEditExpenseEntry(null)}
          header={
            <SheetHeader
              title="Edit Expense"
              onCancel={() => setEditExpenseEntry(null)}
              onSave={() => void confirmEditExpense()}
              loading={expSaving}
            />
          }
        >
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
            onChangeText={(v) => { setExpAmount(v); if (expAmountError) setExpAmountError(undefined); }}
            keyboardType="decimal-pad"
            error={expAmountError}
          />
          <Input
            label="Date"
            placeholder="YYYY-MM-DD"
            value={expDate}
            onChangeText={setExpDate}
          />
        </Sheet>
      )}

      {/* Add Income Sheet — sibling at screen root (gorhom anchoring pattern) */}
      {addingIncome && (
        <Sheet
          testID="jobdetail-add-income-sheet"
          fitContent
          onClose={() => setAddingIncome(false)}
          header={
            <SheetHeader
              title="Add Income"
              onCancel={() => setAddingIncome(false)}
              onSave={() => void handleAddIncome()}
              loading={incomeSaving}
            />
          }
        >
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
        </Sheet>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCardWrapper: { flex: 1, minWidth: '45%' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  swipeBtn: { width: SWIPE_BUTTON_WIDTH, alignItems: 'center', justifyContent: 'center' },
});
