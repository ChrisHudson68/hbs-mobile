import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Pressable,
  ScrollView, StyleSheet, TextInput, View,
  ActivityIndicator,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useTheme } from '../../src/mobile/theme';
import type { Employee, JobListItem } from '../../src/mobile/types';
import {
  formatDateInputValue,
  validateDate,
  validateHours,
  validateRequired,
} from '../../src/mobile/utils';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Input } from '@/components/ui/Input';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Sheet header helper — Cancel / title / Save row (Pattern A / D-04)
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
      <Text variant="headline" weight="600" style={{ textAlign: 'center' }}>
        {title}
      </Text>
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
// Main screen
// ---------------------------------------------------------------------------
export default function ManualTimeEntryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const api = useApi();
  const { jobId: preselectedJobId } = useLocalSearchParams<{ jobId?: string }>();
  const { colors, spacing, radius, typographyRamp } = useTheme();

  // ---- data ----------------------------------------------------------------
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ---- form state ----------------------------------------------------------
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    preselectedJobId ? Number(preselectedJobId) : null
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // ---- validation errors ---------------------------------------------------
  const [jobError, setJobError] = useState<string | undefined>(undefined);
  const [hoursError, setHoursError] = useState<string | undefined>(undefined);
  const [dateError, setDateError] = useState<string | undefined>(undefined);

  // ---- picker sheet --------------------------------------------------------
  const [jobPickerOpen, setJobPickerOpen] = useState(false);

  // ---- derived -------------------------------------------------------------
  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const isDirty =
    !!selectedJobId || hours.trim().length > 0 || note.trim().length > 0;

  // Derive a Date for DateField from the YYYY-MM-DD string state. Anchor at local
  // midnight so the displayed day matches the stored string regardless of timezone.
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00`)
    : null;

  // ---- data load -----------------------------------------------------------
  const load = useCallback(async () => {
    setLoadingData(true);
    try {
      const [empRes, jobsRes] = await Promise.all([
        api.getEmployees(),
        api.getJobs(),
      ]);
      if (empRes.employees) setEmployees(empRes.employees);
      if (jobsRes.jobs) setJobs(jobsRes.jobs);
    } catch {
      /* ignore */
    } finally {
      setLoadingData(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- discard guard (Pattern E / D-10) ------------------------------------
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
        ]
      );
    });
    return sub;
  }, [navigation, isDirty]);

  // ---- save handler — API call UNCHANGED -----------------------------------
  const handleSave = async () => {
    const nextJobError = selectedJobId ? undefined : validateRequired('', 'Job');
    const nextHoursError = validateHours(hours);
    const nextDateError = validateRequired(date, 'Date') ?? validateDate(date);

    setJobError(nextJobError);
    setHoursError(nextHoursError);
    setDateError(nextDateError);

    if (nextJobError || nextHoursError || nextDateError) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSaving(true);
    try {
      await api.addManualTimeEntry({
        employeeId: selectedEmployeeId ?? undefined,
        jobId: selectedJobId!,
        date,
        hours: parseFloat(hours),
        note: note.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Time entry recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // ---- loading state -------------------------------------------------------
  if (loadingData) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  // ---- render --------------------------------------------------------------
  const activeEmployees = employees.filter((e) => e.active);

  return (
    <Screen headerMode="native" scroll keyboardAvoiding>
      <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
        {/* ---- Employee (optional) — chip row (short list, view-scope switcher) ---- */}
        <View style={{ gap: 4 }}>
          <Text variant="footnote" tone="muted">
            Employee
          </Text>
          <Text variant="footnote" tone="muted">
            Leave blank to log for yourself
          </Text>
          {activeEmployees.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                flexDirection: 'row',
                paddingVertical: 2,
                // Right-edge inset so the last chip never sits flush to the edge —
                // a small peek that signals the row is horizontally scrollable.
                paddingRight: spacing.xl,
              }}
              style={{ marginTop: 4 }}
            >
              {activeEmployees.map((emp) => {
                const isActive = selectedEmployeeId === emp.id;
                return (
                  <Pressable
                    key={emp.id}
                    onPress={() =>
                      setSelectedEmployeeId(isActive ? null : emp.id)
                    }
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 14,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      minHeight: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isActive ? colors.navy : colors.card,
                      borderColor: isActive ? colors.navy : colors.border,
                    }}
                  >
                    <Text
                      variant="footnote"
                      tone={isActive ? 'inverse' : 'muted'}
                    >
                      {emp.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ---- Job (required) — tap-to-open picker, styled to mirror Input/DateField ---- */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="footnote" tone="muted">
            Job
          </Text>
          <Pressable
            onPress={() => {
              setJobPickerOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Job"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              backgroundColor: colors.card,
              borderColor: jobError ? colors.danger : colors.border,
              borderWidth: jobError ? 2 : 1,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              gap: spacing.sm,
            }}
            testID="manualtime-job-picker"
          >
            <Text
              variant="body"
              tone={selectedJob ? 'default' : 'muted'}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {selectedJob?.jobName ?? 'Tap to select'}
            </Text>
            <IconSymbol
              name={'chevron.right' as never}
              size={16}
              color={colors.mutedLight}
            />
          </Pressable>
          {jobError ? (
            <Text variant="footnote" tone="danger" numberOfLines={1}>
              {jobError}
            </Text>
          ) : null}
        </View>

        {/* ---- Date (required) — DateField (no free text) ---- */}
        <DateField
          label="Date"
          value={dateValue}
          onChange={(d) => {
            setDate(formatDateInputValue(d));
            if (dateError) setDateError(undefined);
          }}
          error={dateError}
          maximumDate={new Date()}
          testID="manualtime-date-picker"
        />

        {/* ---- Hours (required) ---- */}
        <Input
          label="Hours"
          value={hours}
          onChangeText={(v) => {
            setHours(v);
            if (hoursError) setHoursError(undefined);
          }}
          placeholder="e.g. 8 or 7.5"
          keyboardType="decimal-pad"
          error={hoursError}
          testID="manualtime-hours-input"
        />

        {/* ---- Note (multiline — kit Input has no multiline, use raw TextInput) ---- */}
        <View style={{ gap: 6 }}>
          <Text variant="footnote" tone="muted">
            Note
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              padding: spacing.sm,
              fontSize: typographyRamp.body.fontSize,
              color: colors.text,
              backgroundColor: colors.card,
              minHeight: 72,
              textAlignVertical: 'top',
            }}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={colors.mutedLight}
            multiline
          />
        </View>

        {/* ---- Save button — scrolls above the keyboard with the form ---- */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          label="Save Entry"
          onPress={() => void handleSave()}
          loading={saving}
          testID="manualtime-save-button"
        />
      </View>

      {/* ---- Job picker sheet — sibling, NEVER inside ScrollView ---- */}
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
          {jobs.map((j) => (
            <ListRow
              key={j.id}
              title={j.jobName ?? 'Untitled'}
              trailing={selectedJobId === j.id ? 'custom' : 'none'}
              trailingCustom={
                selectedJobId === j.id ? (
                  <IconSymbol
                    name={'checkmark' as never}
                    size={18}
                    color={colors.navy}
                  />
                ) : undefined
              }
              onPress={() => {
                setSelectedJobId(j.id);
                setJobError(undefined);
                setJobPickerOpen(false);
              }}
            />
          ))}
        </Sheet>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
