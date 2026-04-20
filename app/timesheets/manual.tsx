import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { Employee, JobListItem } from '../../src/mobile/types';

export default function ManualTimeEntryScreen() {
  const router = useRouter();
  const api = useApi();
  const { jobId: preselectedJobId } = useLocalSearchParams<{ jobId?: string }>();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    preselectedJobId ? Number(preselectedJobId) : null
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadingData(true);
    try {
      const [empRes, jobsRes] = await Promise.all([
        api.getEmployees(),
        api.getJobs(),
      ]);
      if (empRes.employees) setEmployees(empRes.employees);
      if (jobsRes.jobs) setJobs(jobsRes.jobs);
    } catch { /* ignore */ }
    finally { setLoadingData(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!selectedJobId) { Alert.alert('Required', 'Select a job.'); return; }
    const h = parseFloat(hours);
    if (!hours.trim() || isNaN(h) || h <= 0) { Alert.alert('Required', 'Enter valid hours.'); return; }
    setSaving(true);
    try {
      await api.addManualTimeEntry({
        employeeId: selectedEmployeeId ?? undefined,
        jobId: selectedJobId,
        date,
        hours: h,
        note: note.trim() || undefined,
      });
      Alert.alert('Saved', 'Time entry recorded.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.section}>
          <Text style={s.label}>Employee</Text>
          <Text style={s.hint}>Leave blank to log for yourself</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={s.pills}>
              {employees.filter(e => e.active).map(emp => (
                <Pressable
                  key={emp.id}
                  style={[s.pill, selectedEmployeeId === emp.id && s.pillActive]}
                  onPress={() => setSelectedEmployeeId(selectedEmployeeId === emp.id ? null : emp.id)}
                >
                  <Text style={[s.pillText, selectedEmployeeId === emp.id && s.pillTextActive]}>
                    {emp.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Job *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
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

        <View style={s.section}>
          <Text style={s.label}>Date</Text>
          <TextInput
            style={s.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.mutedLight}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Hours *</Text>
          <TextInput
            style={s.input}
            value={hours}
            onChangeText={setHours}
            placeholder="e.g. 8 or 7.5"
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.mutedLight}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Note</Text>
          <TextInput
            style={[s.input, { minHeight: 72, textAlignVertical: 'top' }]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={Colors.mutedLight}
            multiline
          />
        </View>

        <Pressable style={[s.saveBtn, saving && s.btnDisabled]} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Entry</Text>}
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  hint: { fontSize: 11, color: Colors.mutedLight },
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
