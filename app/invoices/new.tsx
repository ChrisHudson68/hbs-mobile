import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { JobListItem } from '../../src/mobile/types';

export default function NewInvoiceScreen() {
  const router = useRouter();
  const api = useApi();
  const { jobId: preselectedJobId } = useLocalSearchParams<{ jobId?: string }>();

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    preselectedJobId ? Number(preselectedJobId) : null
  );
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await api.getJobs();
      if (res.jobs) setJobs(res.jobs.filter(j => !j.isOverhead));
    } catch { /* ignore */ }
    finally { setLoadingJobs(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!selectedJobId) { Alert.alert('Required', 'Select a job.'); return; }
    const amt = parseFloat(amount);
    if (!amount.trim() || isNaN(amt) || amt <= 0) { Alert.alert('Required', 'Enter a valid invoice amount.'); return; }
    if (!dueDate.trim()) { Alert.alert('Required', 'Enter a due date.'); return; }
    setSaving(true);
    try {
      const res = await api.createInvoice({
        jobId: selectedJobId,
        dateIssued,
        dueDate,
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

  if (loadingJobs) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.field}>
          <Text style={s.label}>Job *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            <View style={s.pills}>
              {jobs.map(j => (
                <Pressable
                  key={j.id}
                  style={[s.pill, selectedJobId === j.id && s.pillActive]}
                  onPress={() => setSelectedJobId(j.id)}
                >
                  <Text style={[s.pillText, selectedJobId === j.id && s.pillTextActive]}>
                    {j.jobName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Invoice Amount *</Text>
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.mutedLight}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Date Issued</Text>
          <TextInput
            style={s.input}
            value={dateIssued}
            onChangeText={setDateIssued}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.mutedLight}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Due Date *</Text>
          <TextInput
            style={s.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.mutedLight}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Notes</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes for the invoice"
            placeholderTextColor={Colors.mutedLight}
            multiline
          />
        </View>

        <Pressable style={[s.saveBtn, saving && s.btnDisabled]} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Create Invoice</Text>}
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
  pills: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  pillTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.card },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
