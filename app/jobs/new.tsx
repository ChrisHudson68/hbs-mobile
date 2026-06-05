import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable,
  ScrollView, StyleSheet, Switch, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { formatDateInputValue, validateAmount } from '../../src/mobile/utils';
import { useTheme } from '../../src/mobile/theme';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

const STATUS_OPTIONS = ['Active', 'On Hold', 'Completed', 'Cancelled'];

export default function NewJobScreen() {
  const router = useRouter();
  const api = useApi();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = Boolean(editId);
  const { colors, spacing, radius, typographyRamp } = useTheme();

  const [jobName, setJobName] = useState('');
  const [jobCode, setJobCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [soldBy, setSoldBy] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [status, setStatus] = useState('Active');
  const [isOverhead, setIsOverhead] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [jobNameError, setJobNameError] = useState<string | undefined>(undefined);
  const [contractAmountError, setContractAmountError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      try {
        const res = await api.getJobDetail(Number(editId));
        const j = res.job;
        if (!j) return;
        setJobName(j.jobName ?? '');
        setClientName(j.clientName ?? '');
        setStatus(j.status ?? 'Active');
        setIsOverhead(j.isOverhead ?? false);
        setJobDescription(j.jobDescription ?? '');
      } catch { /* ignore */ }
      finally { setLoadingEdit(false); }
    })();
  }, [editId, api]);

  const handleSave = async () => {
    // Required: job name. Optional but validated when present: contract amount.
    // Start date comes from DateField (a Date | null) — never free text, so it
    // needs no date-format validation.
    const nameError = jobName.trim() ? undefined : 'Job name is required';
    const amountError = contractAmount.trim()
      ? validateAmount(contractAmount, 'Contract Amount')
      : undefined;

    setJobNameError(nameError);
    setContractAmountError(amountError);
    if (nameError || amountError) return;

    setSaving(true);
    try {
      const args = {
        jobName: jobName.trim(),
        jobCode: jobCode.trim() || undefined,
        clientName: clientName.trim() || undefined,
        soldBy: soldBy.trim() || undefined,
        contractAmount: contractAmount.trim() ? parseFloat(contractAmount) : undefined,
        startDate: startDate ? formatDateInputValue(startDate) : undefined,
        status,
        isOverhead,
        jobDescription: jobDescription.trim() || undefined,
      };

      if (isEditing) {
        await api.updateJob(Number(editId), args);
        Alert.alert('Saved', 'Job updated successfully.');
      } else {
        const res = await api.createJob(args);
        Alert.alert('Created', 'Job created successfully.', [
          { text: 'View Job', onPress: () => router.replace(`/jobs/${res.jobId}`) },
          { text: 'Done', onPress: () => router.back() },
        ]);
        return;
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save job.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen headerMode="native" scroll keyboardAvoiding>
      <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
        <Input
          label="Job Name"
          value={jobName}
          onChangeText={(v) => { setJobName(v); if (jobNameError) setJobNameError(undefined); }}
          error={jobNameError}
          leftIcon="briefcase"
          placeholder="e.g. Kitchen Remodel"
          testID="newjob-name-input"
        />

        <Input
          label="Job Code"
          value={jobCode}
          onChangeText={setJobCode}
          leftIcon="number"
          placeholder="Optional (e.g. HVAC-102)"
          autoCapitalize="characters"
        />

        <Input
          label="Client Name"
          value={clientName}
          onChangeText={setClientName}
          leftIcon="building.2"
          placeholder="Client or company name"
          testID="newjob-client-input"
        />

        <Input
          label="Sold By"
          value={soldBy}
          onChangeText={setSoldBy}
          leftIcon="person"
          placeholder="Salesperson or estimator"
        />

        <Input
          label="Contract Amount"
          value={contractAmount}
          onChangeText={(v) => { setContractAmount(v); if (contractAmountError) setContractAmountError(undefined); }}
          error={contractAmountError}
          leftIcon="dollarsign.circle"
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <DateField
          label="Start Date"
          value={startDate}
          onChange={setStartDate}
          placeholder="Optional — tap to pick a date"
          testID="newjob-startdate-picker"
        />

        {/* Status chip row — scrollable, NOT a SegmentedControl (5 options don't fit) */}
        <View style={{ gap: 6 }}>
          <Text variant="footnote" tone="muted">Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {STATUS_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                onPress={() => setStatus(opt)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  backgroundColor: status === opt ? colors.navySurface : colors.card,
                  borderColor: status === opt ? colors.navySurface : colors.border,
                }}
              >
                <Text
                  variant="footnote"
                  tone={status === opt ? 'inverse' : 'muted'}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Description — raw TextInput: kit Input has no multiline support (Bug 2) */}
        <View style={{ gap: 6 }}>
          <Text variant="footnote" tone="muted">Description</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              padding: spacing.sm,
              fontSize: typographyRamp.body.fontSize,
              color: colors.text,
              backgroundColor: colors.card,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder="Describe the work for this job"
            placeholderTextColor={colors.mutedLight}
            selectionColor={colors.navy}
            multiline
          />
        </View>

        {/* Overhead toggle — trailing='custom' workaround: ListRow trailing='switch' hardcodes value=false */}
        <ListRow
          title="Overhead / Admin Job"
          subtitle="e.g. Office Time, Shop Time"
          trailing="custom"
          trailingCustom={
            <Switch
              value={isOverhead}
              onValueChange={setIsOverhead}
              trackColor={{ false: colors.border, true: colors.navySurface }}
            />
          }
        />

        {/* Save button — scrolls above the keyboard with the form */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          label={isEditing ? 'Save Changes' : 'Save Job'}
          loading={saving}
          onPress={() => void handleSave()}
          testID="newjob-save-button"
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
