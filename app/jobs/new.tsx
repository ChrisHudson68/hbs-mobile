import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';

const STATUS_OPTIONS = ['Active', 'On Hold', 'Completed', 'Cancelled'];

export default function NewJobScreen() {
  const router = useRouter();
  const api = useApi();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = Boolean(editId);

  const [jobName, setJobName] = useState('');
  const [jobCode, setJobCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [soldBy, setSoldBy] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [status, setStatus] = useState('Active');
  const [isOverhead, setIsOverhead] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);

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
        setJobDescription((j as any).jobDescription ?? '');
      } catch { /* ignore */ }
      finally { setLoadingEdit(false); }
    })();
  }, [editId, api]);

  const handleSave = async () => {
    if (!jobName.trim()) { Alert.alert('Required', 'Job name is required.'); return; }
    setSaving(true);
    try {
      const args = {
        jobName: jobName.trim(),
        jobCode: jobCode.trim() || undefined,
        clientName: clientName.trim() || undefined,
        soldBy: soldBy.trim() || undefined,
        contractAmount: contractAmount.trim() ? parseFloat(contractAmount) : undefined,
        startDate: startDate.trim() || undefined,
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
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.field}>
          <Text style={s.label}>Job Name *</Text>
          <TextInput style={s.input} value={jobName} onChangeText={setJobName} placeholder="e.g. Kitchen Remodel" placeholderTextColor={Colors.mutedLight} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Job Code</Text>
          <TextInput style={s.input} value={jobCode} onChangeText={setJobCode} placeholder="Optional (e.g. HVAC-102)" placeholderTextColor={Colors.mutedLight} autoCapitalize="characters" />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Client Name</Text>
          <TextInput style={s.input} value={clientName} onChangeText={setClientName} placeholder="Client or company name" placeholderTextColor={Colors.mutedLight} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Sold By</Text>
          <TextInput style={s.input} value={soldBy} onChangeText={setSoldBy} placeholder="Salesperson or estimator" placeholderTextColor={Colors.mutedLight} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Contract Amount</Text>
          <TextInput style={s.input} value={contractAmount} onChangeText={setContractAmount} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={Colors.mutedLight} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Start Date (YYYY-MM-DD)</Text>
          <TextInput style={s.input} value={startDate} onChangeText={setStartDate} placeholder="2025-01-15" placeholderTextColor={Colors.mutedLight} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Status</Text>
          <View style={s.segmented}>
            {STATUS_OPTIONS.map(opt => (
              <Pressable key={opt} style={[s.segBtn, status === opt && s.segBtnActive]} onPress={() => setStatus(opt)}>
                <Text style={[s.segText, status === opt && s.segTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={s.field}>
          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={jobDescription} onChangeText={setJobDescription} placeholder="Describe the work for this job" placeholderTextColor={Colors.mutedLight} multiline />
        </View>
        <View style={s.switchRow}>
          <View>
            <Text style={s.switchLabel}>Overhead / Admin Job</Text>
            <Text style={s.switchSub}>e.g. Office Time, Shop Time</Text>
          </View>
          <Switch value={isOverhead} onValueChange={setIsOverhead} trackColor={{ true: Colors.navy }} />
        </View>

        <Pressable style={[s.saveBtn, saving && s.btnDisabled]} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{isEditing ? 'Save Changes' : 'Create Job'}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.card },
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  segBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  segText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  segTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border },
  switchLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  switchSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
