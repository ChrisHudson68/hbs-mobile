import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS, ActivityIndicator, Alert, Image, Platform,
  Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { JobListItem } from '../../src/mobile/types';

const CATEGORIES = ['Materials', 'Equipment', 'Subcontractor', 'Fuel', 'Tools', 'Other'];

export default function NewExpenseScreen() {
  const router = useRouter();
  const api = useApi();
  const { jobId: preselectedJobId } = useLocalSearchParams<{ jobId?: string }>();

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    preselectedJobId ? Number(preselectedJobId) : null
  );
  const [category, setCategory] = useState('Materials');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await api.getJobs();
      if (res.jobs) setJobs(res.jobs);
    } catch { /* ignore */ }
    finally { setLoadingJobs(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setReceiptUri(asset.uri);
    setUploadingReceipt(true);
    try {
      const form = new FormData();
      form.append('receipt', {
        uri: asset.uri,
        name: asset.fileName ?? 'receipt.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as any);
      const res = await api.uploadReceipt(form);
      if (res.receipt) {
        setReceiptFilename(res.receipt.receiptFilename);
        const p = res.receipt.parsed;
        if (p?.totalAmount) setAmount(String(p.totalAmount));
        if (p?.merchantName) setVendor(p.merchantName);
        if (p?.receiptDate) setDate(p.receiptDate);
      }
    } catch (e) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Could not upload receipt.');
      setReceiptUri(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const launchCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera permission is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAsset(result.assets[0]);
  };

  const launchLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAsset(result.assets[0]);
  };

  const handlePickReceipt = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) void launchCamera();
          if (index === 2) void launchLibrary();
        },
      );
    } else {
      Alert.alert('Receipt Photo', 'How would you like to add a receipt?', [
        { text: 'Take Photo', onPress: () => void launchCamera() },
        { text: 'Choose from Library', onPress: () => void launchLibrary() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleSave = async () => {
    if (!selectedJobId) { Alert.alert('Required', 'Select a job.'); return; }
    if (!amount.trim()) { Alert.alert('Required', 'Enter an amount.'); return; }
    if (!receiptFilename) { Alert.alert('Required', 'Upload a receipt photo.'); return; }
    setSaving(true);
    try {
      await api.createExpense({
        jobId: selectedJobId,
        category,
        vendor: vendor.trim() || undefined,
        amount,
        date,
        receiptFilename,
      });
      Alert.alert('Saved', 'Expense logged successfully.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save expense.');
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
          <Text style={s.label}>Category</Text>
          <View style={s.segmented}>
            {CATEGORIES.map(cat => (
              <Pressable key={cat} style={[s.segBtn, category === cat && s.segBtnActive]} onPress={() => setCategory(cat)}>
                <Text style={[s.segText, category === cat && s.segTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={s.receiptBtn} onPress={handlePickReceipt} disabled={uploadingReceipt}>
          {uploadingReceipt ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={Colors.navy} />
              <Text style={s.receiptBtnText}>Uploading & scanning receipt...</Text>
            </View>
          ) : receiptUri ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Image source={{ uri: receiptUri }} style={s.receiptPreview} resizeMode="cover" />
              <Text style={s.receiptBtnText}>Tap to replace receipt</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={s.receiptIcon}>📷</Text>
              <Text style={s.receiptBtnText}>Add Receipt Photo</Text>
              <Text style={s.receiptHint}>Take a photo or choose from library</Text>
            </View>
          )}
        </Pressable>

        <View style={s.field}>
          <Text style={s.label}>Vendor / Store</Text>
          <TextInput style={s.input} value={vendor} onChangeText={setVendor} placeholder="e.g. Home Depot" placeholderTextColor={Colors.mutedLight} />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Amount *</Text>
          <TextInput style={s.input} value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={Colors.mutedLight} />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Date</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.mutedLight} />
        </View>

        <Pressable style={[s.saveBtn, saving && s.btnDisabled]} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Expense</Text>}
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
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  segBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  segText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  segTextActive: { color: '#fff' },
  receiptBtn: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  receiptIcon: { fontSize: 28 },
  receiptBtnText: { fontSize: 14, fontWeight: '700', color: Colors.navy },
  receiptHint: { fontSize: 12, color: Colors.muted },
  receiptPreview: { width: 120, height: 120, borderRadius: Radius.sm },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.card },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
