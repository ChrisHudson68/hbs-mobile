import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useTheme } from '../../src/mobile/theme';
import type { JobListItem } from '../../src/mobile/types';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Input } from '@/components/ui/Input';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Sheet header — Cancel / title / Save row (D-04)
// ---------------------------------------------------------------------------
function SheetHeader({
  title,
  onCancel,
}: {
  title: string;
  onCancel: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: spacing.sm }}>
      <Button variant="ghost" size="sm" label="Cancel" onPress={onCancel} />
      <Text variant="headline" weight="600">{title}</Text>
      {/* Spacer to balance the Cancel button width */}
      <View style={{ minWidth: 60 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function NewInvoiceScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const api = useApi();
  const { colors, spacing, radius } = useTheme();
  const { jobId: preselectedJobId } = useLocalSearchParams<{ jobId?: string }>();

  // --- data -----------------------------------------------------------------
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // --- form state -----------------------------------------------------------
  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    preselectedJobId ? Number(preselectedJobId) : null,
  );
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().slice(0, 10));
  /** Internal Date object for the native picker; serialised to YYYY-MM-DD on save. */
  const [due, setDue] = useState<Date | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // --- inline errors --------------------------------------------------------
  const [jobError, setJobError] = useState<string | undefined>(undefined);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [dueError, setDueError] = useState<string | undefined>(undefined);

  // --- UI state (pickers/sheets) -------------------------------------------
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);

  // --- derived --------------------------------------------------------------
  const selectedJob = jobs.find(j => j.id === selectedJobId) ?? null;

  // Dirty = any field the user has touched (drives discard guard D-10)
  const isDirty =
    selectedJobId !== null ||
    amount.trim().length > 0 ||
    due !== null ||
    notes.trim().length > 0;

  // --- load -----------------------------------------------------------------
  const load = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await api.getJobs();
      if (res.jobs) setJobs(res.jobs.filter(j => !j.isOverhead));
    } catch { /* ignore — user can retry by backing out */ }
    finally { setLoadingJobs(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  // --- discard guard (D-10) ------------------------------------------------
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        "Your changes won't be saved.",
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return sub;
  }, [navigation, isDirty]);

  // --- save -----------------------------------------------------------------
  const handleSave = async () => {
    let hasError = false;

    if (!selectedJobId) {
      setJobError('Select a job');
      hasError = true;
    }
    const amt = parseFloat(amount);
    if (!amount.trim() || isNaN(amt) || amt <= 0) {
      setAmountError('Enter a valid invoice amount');
      hasError = true;
    }
    if (!due) {
      setDueError('Enter a due date');
      hasError = true;
    }
    if (hasError) return;

    setSaving(true);
    try {
      const res = await api.createInvoice({
        jobId: selectedJobId!,
        dateIssued,
        // Wire format: YYYY-MM-DD string — byte-identical to dateIssued convention
        // (toISOString().slice(0,10) matches what the typed field sent before).
        dueDate: due!.toISOString().slice(0, 10),
        amount: amt,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Created', 'Invoice created successfully.', [
        { text: 'View', onPress: () => router.replace(`/invoices/${res.invoice?.id ?? ''}`) },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create invoice.');
      setSaving(false);
    }
  };

  // --- loading guard --------------------------------------------------------
  if (loadingJobs) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  // --- render ---------------------------------------------------------------
  return (
    <Screen headerMode="native" padded={false} keyboardAvoiding>
      {/* Main form in a ScrollView (keyboard-aware via Screen keyboardAvoiding) */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 8 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* Job picker trigger (D-05) */}
        <View>
          <Text variant="footnote" tone="muted" style={{ marginBottom: spacing.xs }}>
            Job *
          </Text>
          <ListRow
            title={selectedJob ? selectedJob.jobName : 'Tap to select'}
            trailing="chevron"
            onPress={() => { setJobPickerOpen(true); if (jobError) setJobError(undefined); }}
            testID="newinvoice-job-picker"
          />
          {jobError ? (
            <Text variant="footnote" tone="danger" numberOfLines={1} style={{ marginTop: spacing.xs }}>
              {jobError}
            </Text>
          ) : null}
        </View>

        {/* Invoice Amount */}
        <Input
          label="Invoice Amount *"
          value={amount}
          onChangeText={(v) => { setAmount(v); if (amountError) setAmountError(undefined); }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={amountError}
          testID="newinvoice-amount-input"
        />

        {/* Date Issued — keep as Input (typed), same as before */}
        <Input
          label="Date Issued"
          value={dateIssued}
          onChangeText={setDateIssued}
          placeholder="YYYY-MM-DD"
          leftIcon="calendar"
        />

        {/* Due Date — native iOS DateTimePicker (D-07) */}
        <View>
          <Text variant="footnote" tone="muted" style={{ marginBottom: spacing.xs }}>
            Due Date *
          </Text>
          <ListRow
            title={due ? due.toISOString().slice(0, 10) : 'Tap to pick a date'}
            trailing="chevron"
            onPress={() => { setShowDuePicker(v => !v); if (dueError) setDueError(undefined); }}
          />
          {showDuePicker && (
            <DateTimePicker
              value={due ?? new Date()}
              mode="date"
              display="inline"
              onChange={(_, d) => {
                if (d) { setDue(d); if (dueError) setDueError(undefined); }
              }}
              testID="newinvoice-duedate-picker"
              style={{ marginTop: spacing.xs }}
            />
          )}
          {dueError ? (
            <Text variant="footnote" tone="danger" numberOfLines={1} style={{ marginTop: spacing.xs }}>
              {dueError}
            </Text>
          ) : null}
        </View>

        {/* Notes — raw TextInput (kit Input has no multiline prop, known Bug 2) */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="footnote" tone="muted">Notes</Text>
          <TextInput
            style={[s.notesInput, {
              borderColor: colors.border,
              borderRadius: radius.sm,
              backgroundColor: colors.card,
              color: colors.text,
              padding: spacing.sm,
            }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes for the invoice"
            placeholderTextColor={colors.mutedLight}
            multiline
          />
        </View>
      </ScrollView>

      {/* Bottom-pinned primary CTA (outside ScrollView) */}
      <View style={{ padding: spacing.md }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          label="Create Invoice"
          loading={saving}
          onPress={() => void handleSave()}
          testID="newinvoice-save-button"
        />
      </View>

      {/* Job picker Sheet — sibling, NEVER inside ScrollView (gorhom-sheet-anchoring) */}
      {jobPickerOpen && (
        <Sheet
          snapPoints={['50%', '85%']}
          scrollable
          onClose={() => setJobPickerOpen(false)}
          header={
            <SheetHeader
              title="Select Job"
              onCancel={() => setJobPickerOpen(false)}
            />
          }
        >
          {jobs.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <Text variant="subhead" tone="muted">No jobs available.</Text>
            </View>
          ) : (
            jobs.map(j => (
              <ListRow
                key={j.id}
                title={j.jobName}
                trailing={selectedJobId === j.id ? 'custom' : 'none'}
                trailingCustom={
                  selectedJobId === j.id
                    ? <IconSymbol name="checkmark" size={18} color={colors.navy} />
                    : undefined
                }
                onPress={() => {
                  setSelectedJobId(j.id);
                  if (jobError) setJobError(undefined);
                  setJobPickerOpen(false);
                }}
              />
            ))
          )}
        </Sheet>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Raw multiline input shell (kit Input has no multiline prop — Bug 2)
  notesInput: { borderWidth: 1, minHeight: 80, fontSize: 15, textAlignVertical: 'top' },
});
