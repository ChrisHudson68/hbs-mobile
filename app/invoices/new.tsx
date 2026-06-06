import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useTheme } from '../../src/mobile/theme';
import {
  formatDateInputValue,
  validateAmount,
  validateDate,
  validateRequired,
} from '../../src/mobile/utils';
import type { JobListItem } from '../../src/mobile/types';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
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
    <View style={{ minHeight: 44, justifyContent: 'center', marginBottom: spacing.sm }}>
      {/* Title centered on the full width; Cancel overlaid on the leading edge so
          the title stays truly centered (no hand-tuned spacer width). */}
      <Text variant="headline" weight="600" style={{ textAlign: 'center' }}>{title}</Text>
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' }}
      >
        <Button variant="ghost" size="sm" label="Cancel" onPress={onCancel} />
      </View>
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
  /** Date objects for the pickers; serialised to YYYY-MM-DD on save. */
  const [dateIssued, setDateIssued] = useState<Date | null>(new Date());
  const [due, setDue] = useState<Date | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // --- inline errors --------------------------------------------------------
  const [jobError, setJobError] = useState<string | undefined>(undefined);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [dueError, setDueError] = useState<string | undefined>(undefined);
  const [dateIssuedError, setDateIssuedError] = useState<string | undefined>(undefined);

  // --- UI state (pickers/sheets) -------------------------------------------
  const [jobPickerOpen, setJobPickerOpen] = useState(false);

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

  // eslint-disable-next-line react-compiler-rules/set-state-in-effect -- fetch-on-mount
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
    const nextJobError = selectedJobId ? undefined : validateRequired('', 'Job');
    const nextAmountError = validateAmount(amount, 'invoice amount');
    const nextDueError = due
      ? undefined
      : validateRequired('', 'Due date');
    // A DateField that yields a Date never needs free-text date validation, but
    // run validateDate on the serialised value as a defensive guard.
    const nextDateIssuedError = dateIssued
      ? validateDate(formatDateInputValue(dateIssued))
      : validateRequired('', 'Date issued');

    setJobError(nextJobError);
    setAmountError(nextAmountError);
    setDueError(nextDueError);
    setDateIssuedError(nextDateIssuedError);

    if (nextJobError || nextAmountError || nextDueError || nextDateIssuedError) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSaving(true);
    try {
      const res = await api.createInvoice({
        jobId: selectedJobId!,
        dateIssued: formatDateInputValue(dateIssued!),
        dueDate: formatDateInputValue(due!),
        amount: Number(amount.trim().replace(/^\$/, '').replace(/,/g, '')),
        notes: notes.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Created', 'Invoice created successfully.', [
        { text: 'View', onPress: () => router.replace(`/invoices/${res.invoice?.id ?? ''}`) },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    <Screen headerMode="native" scroll keyboardAvoiding>
      <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
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

        {/* Date Issued — DateField (D-07) */}
        <DateField
          label="Date Issued *"
          value={dateIssued}
          onChange={(d) => { setDateIssued(d); if (dateIssuedError) setDateIssuedError(undefined); }}
          error={dateIssuedError}
          testID="newinvoice-dateissued-picker"
        />

        {/* Due Date — DateField (D-07) */}
        <DateField
          label="Due Date *"
          value={due}
          onChange={(d) => { setDue(d); if (dueError) setDueError(undefined); }}
          error={dueError}
          testID="newinvoice-duedate-picker"
        />

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
            selectionColor={colors.navy}
            multiline
          />
        </View>

        {/* Primary CTA — scrolls above the keyboard with the form */}
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
