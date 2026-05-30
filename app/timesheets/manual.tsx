import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Pressable,
  ScrollView, StyleSheet, TextInput, View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useTheme } from '../../src/mobile/theme';
import type { Employee, JobListItem } from '../../src/mobile/types';
import { Button } from '@/components/ui/Button';
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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        marginBottom: spacing.sm,
      }}
    >
      <Button variant="ghost" size="sm" label="Cancel" onPress={onCancel} />
      <Text variant="headline" weight="600">
        {title}
      </Text>
      {/* Spacer to balance the Cancel button width */}
      <View style={{ minWidth: 72 }} />
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
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();

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

  // ---- picker sheet --------------------------------------------------------
  const [jobPickerOpen, setJobPickerOpen] = useState(false);

  // ---- derived -------------------------------------------------------------
  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const isDirty =
    !!selectedJobId || hours.trim().length > 0 || note.trim().length > 0;

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
    if (!selectedJobId) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setJobError('Select a job');
      return;
    }
    const h = parseFloat(hours);
    if (!hours.trim() || isNaN(h) || h <= 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setHoursError('Enter valid hours');
      return;
    }
    setSaving(true);
    try {
      await api.addManualTimeEntry({
        employeeId: selectedEmployeeId ?? undefined,
        jobId: selectedJobId,
        date,
        hours: h,
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
    <Screen headerMode="native" padded={false} keyboardAvoiding>
      <View style={{ height: frame.height - insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
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
              contentContainerStyle={{ gap: 8, flexDirection: 'row', paddingVertical: 2 }}
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

        {/* ---- Job (required) — tap-to-open picker ---- */}
        <View style={{ gap: 4 }}>
          {jobError ? (
            <Text variant="footnote" tone="danger">
              {jobError}
            </Text>
          ) : null}
          <ListRow
            title="Job"
            subtitle={selectedJob?.jobName ?? 'Tap to select'}
            trailing="chevron"
            onPress={() => {
              setJobPickerOpen(true);
            }}
            testID="manualtime-job-picker"
          />
        </View>

        {/* ---- Date ---- */}
        <Input
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          leftIcon="calendar"
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
      </ScrollView>

      {/* ---- Save button pinned to bottom of the modal (outside ScrollView) ---- */}
      <View style={{ padding: spacing.md }}>
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
