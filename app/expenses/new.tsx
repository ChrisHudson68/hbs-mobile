import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const CATEGORIES = ['Materials', 'Equipment', 'Subcontractor', 'Fuel', 'Tools', 'Other'];

export default function NewExpenseScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const api = useApi();
  const { jobId: preselectedJobId } = useLocalSearchParams<{ jobId?: string }>();
  const { colors, spacing, radius } = useTheme();
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();

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

  // Picker sheet open state
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  // Inline error state (D-12)
  const [jobError, setJobError] = useState<string | undefined>(undefined);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [receiptError, setReceiptError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await api.getJobs();
      if (res.jobs) setJobs(res.jobs);
    } catch { /* ignore */ }
    finally { setLoadingJobs(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  // Discard guard (Pattern E / D-10)
  const isDirty =
    !!selectedJobId ||
    amount.trim().length > 0 ||
    !!receiptFilename ||
    vendor.trim().length > 0;

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e: any) => {
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        "Your changes won't be saved.",
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return sub;
  }, [navigation, isDirty]);

  // ─── PROTECTED: uploadAsset — DO NOT EDIT ───────────────────────────────────
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
  // ────────────────────────────────────────────────────────────────────────────

  // ─── PROTECTED: launchCamera — DO NOT EDIT ──────────────────────────────────
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
  // ────────────────────────────────────────────────────────────────────────────

  // ─── PROTECTED: launchLibrary — DO NOT EDIT ─────────────────────────────────
  const launchLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAsset(result.assets[0]);
  };
  // ────────────────────────────────────────────────────────────────────────────

  const handlePickReceipt = () => {
    setReceiptSheetOpen(true);
  };

  const handleSave = async () => {
    let hasError = false;
    if (!selectedJobId) { setJobError('Select a job'); hasError = true; }
    if (!amount.trim()) { setAmountError('Enter an amount'); hasError = true; }
    if (!receiptFilename) { setReceiptError('Upload a receipt photo'); hasError = true; }
    if (hasError) return;

    setSaving(true);
    try {
      await api.createExpense({
        jobId: selectedJobId!,
        category,
        vendor: vendor.trim() || undefined,
        amount,
        date,
        receiptFilename: receiptFilename!,
      });
      Alert.alert('Saved', 'Expense logged successfully.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save expense.');
      setSaving(false);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  if (loadingJobs) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen headerMode="native" padded={false} keyboardAvoiding>
      <View style={{ height: frame.height - insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >

        {/* Job picker trigger */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="footnote" tone="muted">Job *</Text>
          <ListRow
            title={selectedJob?.jobName ?? 'Tap to select a job'}
            trailing="chevron"
            onPress={() => { setJobPickerOpen(true); if (jobError) setJobError(undefined); }}
            testID="newexpense-job-picker"
          />
          {jobError ? (
            <Text variant="footnote" tone="danger">{jobError}</Text>
          ) : null}
        </View>

        {/* Category picker trigger */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="footnote" tone="muted">Category</Text>
          <ListRow
            title={category}
            trailing="chevron"
            onPress={() => setCategoryPickerOpen(true)}
            testID="newexpense-category-picker"
          />
        </View>

        {/* Receipt zone — dashed Card */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="footnote" tone="muted">Receipt *</Text>
          <Pressable
            testID="newexpense-receipt-button"
            onPress={handlePickReceipt}
            disabled={uploadingReceipt}
            style={{
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: receiptError ? colors.danger : colors.border,
              borderStyle: 'dashed',
              padding: spacing.md,
              alignItems: 'center',
              backgroundColor: colors.card,
            }}
          >
            {uploadingReceipt ? (
              <View style={s.receiptInner}>
                <ActivityIndicator color={colors.navy} />
                <Text variant="subhead" weight="600">Uploading &amp; scanning receipt...</Text>
              </View>
            ) : receiptUri ? (
              <View style={[s.receiptInner, { gap: spacing.sm }]}>
                <Image source={{ uri: receiptUri }} style={[s.receiptPreview, { borderRadius: radius.sm }]} resizeMode="cover" />
                <Text variant="subhead" weight="600" tone="default">Tap to replace receipt</Text>
              </View>
            ) : (
              <View style={s.receiptInner}>
                <IconSymbol name={'camera.fill' as never} size={28} color={colors.mutedLight} />
                <RNText style={{ fontSize: 15, fontWeight: '700', lineHeight: 21, color: colors.navy }}>Add Receipt Photo</RNText>
                <Text variant="footnote" tone="muted">Take a photo or choose from library</Text>
              </View>
            )}
          </Pressable>
          {receiptError ? (
            <Text variant="footnote" tone="danger">{receiptError}</Text>
          ) : null}
        </View>

        {/* Vendor input */}
        <Input
          label="Vendor / Store"
          value={vendor}
          onChangeText={setVendor}
          placeholder="e.g. Home Depot"
        />

        {/* Amount input */}
        <Input
          label="Amount *"
          value={amount}
          onChangeText={(v) => { setAmount(v); if (amountError) setAmountError(undefined); }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          error={amountError}
        />

        {/* Date input */}
        <Input
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
        />

      </ScrollView>

      {/* Save button pinned outside ScrollView */}
      <View style={{ padding: spacing.md }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          label="Save Expense"
          loading={saving}
          onPress={() => void handleSave()}
          testID="newexpense-save-button"
        />
      </View>
      </View>

      {/* ── Sheets — siblings at root level, NEVER inside ScrollView ── */}

      {/* Receipt source sheet (Pattern C) */}
      {receiptSheetOpen && (
        <Sheet
          fitContent
          onClose={() => setReceiptSheetOpen(false)}
          testID="newexpense-receipt-sheet"
        >
          <ListRow
            title="Take Photo"
            leadingIcon={'camera' as never}
            onPress={() => { setReceiptSheetOpen(false); void launchCamera(); }}
            testID="receipt-camera"
          />
          <ListRow
            title="Choose from Library"
            leadingIcon={'photo' as never}
            onPress={() => { setReceiptSheetOpen(false); void launchLibrary(); }}
            testID="receipt-library"
          />
        </Sheet>
      )}

      {/* Job picker sheet (Pattern B) */}
      {jobPickerOpen && (
        <Sheet
          snapPoints={['50%', '85%']}
          scrollable
          onClose={() => setJobPickerOpen(false)}
          header={
            <View style={s.pickerHeader}>
              <Text variant="headline" weight="600">Select Job</Text>
            </View>
          }
        >
          {jobs.map(j => (
            <ListRow
              key={j.id}
              title={j.jobName ?? 'Untitled'}
              trailing={selectedJobId === j.id ? 'custom' : 'none'}
              trailingCustom={
                selectedJobId === j.id
                  ? <IconSymbol name={'checkmark' as never} size={18} color={colors.navy} />
                  : undefined
              }
              onPress={() => {
                setSelectedJobId(j.id);
                setJobPickerOpen(false);
                setJobError(undefined);
              }}
            />
          ))}
        </Sheet>
      )}

      {/* Category picker sheet (Pattern B, fitContent — 6 fixed rows) */}
      {categoryPickerOpen && (
        <Sheet
          fitContent
          onClose={() => setCategoryPickerOpen(false)}
          testID="newexpense-category-picker"
          header={
            <View style={s.pickerHeader}>
              <Text variant="headline" weight="600">Category</Text>
            </View>
          }
        >
          {CATEGORIES.map(cat => (
            <ListRow
              key={cat}
              title={cat}
              trailing={category === cat ? 'custom' : 'none'}
              trailingCustom={
                category === cat
                  ? <IconSymbol name={'checkmark' as never} size={18} color={colors.navy} />
                  : undefined
              }
              onPress={() => {
                setCategory(cat);
                setCategoryPickerOpen(false);
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
  receiptInner: { alignItems: 'center', gap: 8 },
  receiptPreview: { width: 120, height: 120 },
  pickerHeader: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
