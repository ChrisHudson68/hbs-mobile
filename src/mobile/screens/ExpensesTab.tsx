import React from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { EXPENSE_CATEGORIES } from '../constants';
import { styles } from '../styles';
import {
    AutoFilledFieldState,
    JobListItem,
    ReceiptAsset,
    UploadedReceipt,
} from '../types';
import { buildReceiptConfidenceText, formatCurrency } from '../utils';

type Props = {
  jobsLoading: boolean;
  jobs: JobListItem[];
  expenseJobId: number | null;
  setExpenseJobId: (id: number | null) => void;
  selectedExpenseJob: JobListItem | null;
  expenseCategory: string;
  setExpenseCategory: (value: string) => void;
  expenseVendor: string;
  setExpenseVendor: (value: string) => void;
  expenseAmount: string;
  setExpenseAmount: (value: string) => void;
  expenseDate: string;
  setExpenseDate: (value: string) => void;
  expenseReceiptAsset: ReceiptAsset | null;
  uploadedReceipt: UploadedReceipt | null;
  autoFilledFields: AutoFilledFieldState;
  receiptUploading: boolean;
  expenseSaving: boolean;
  expenseReadyToSave: boolean;
  lastSavedExpenseId: number | null;
  onPickReceipt: () => void;
  onUploadReceipt: () => void;
  onSaveExpense: () => void;
  onResetExpenseForm: () => void;
};

export default function ExpensesTab({
  jobsLoading,
  jobs,
  expenseJobId,
  setExpenseJobId,
  selectedExpenseJob,
  expenseCategory,
  setExpenseCategory,
  expenseVendor,
  setExpenseVendor,
  expenseAmount,
  setExpenseAmount,
  expenseDate,
  setExpenseDate,
  expenseReceiptAsset,
  uploadedReceipt,
  autoFilledFields,
  receiptUploading,
  expenseSaving,
  expenseReadyToSave,
  lastSavedExpenseId,
  onPickReceipt,
  onUploadReceipt,
  onSaveExpense,
  onResetExpenseForm,
}: Props) {
  return (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Expenses</Text>
        <Text style={styles.heroMeta}>Managers and admins only</Text>
        <Text style={styles.heroMeta}>Upload a receipt, review OCR suggestions, and save the expense.</Text>
      </View>

      <View style={styles.metricStrip}>
        <View style={styles.metricStripCard}>
          <Text style={styles.metricStripLabel}>Step 1</Text>
          <Text style={styles.metricStripValue}>Pick</Text>
        </View>
        <View style={styles.metricStripCard}>
          <Text style={styles.metricStripLabel}>Step 2</Text>
          <Text style={styles.metricStripValue}>Upload + OCR</Text>
        </View>
        <View style={styles.metricStripCard}>
          <Text style={styles.metricStripLabel}>Step 3</Text>
          <Text style={styles.metricStripValue}>Save Expense</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Receipt</Text>
        <Text style={styles.cardBody}>
          Select a receipt image, upload it, then confirm the OCR suggestions before saving.
        </Text>

        {expenseReceiptAsset ? (
          <View style={styles.receiptPreviewCard}>
            <Image source={{ uri: expenseReceiptAsset.uri }} style={styles.receiptPreviewImage} />
            <Text style={styles.selectionValue}>{expenseReceiptAsset.name}</Text>
            <Text style={styles.selectionHelper}>{expenseReceiptAsset.mimeType}</Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>No receipt selected yet.</Text>
        )}

        <View style={styles.buttonRow}>
          <Pressable onPress={onPickReceipt} style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>Pick Receipt</Text>
          </Pressable>

          <Pressable
            disabled={receiptUploading || !expenseReceiptAsset}
            onPress={onUploadReceipt}
            style={[
              styles.primaryButtonCompact,
              (!expenseReceiptAsset || receiptUploading) && styles.buttonDisabled,
            ]}
          >
            {receiptUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Upload Receipt</Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>OCR Summary</Text>

        <View style={styles.ocrStatusRow}>
          <View
            style={[
              styles.statusPill,
              uploadedReceipt?.hasSuggestions ? styles.statusPillGood : styles.statusPillNeutral,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                uploadedReceipt?.hasSuggestions
                  ? styles.statusPillTextGood
                  : styles.statusPillTextNeutral,
              ]}
            >
              {uploadedReceipt?.hasSuggestions ? 'Suggestions Found' : uploadedReceipt ? 'Uploaded' : 'Waiting'}
            </Text>
          </View>

          <View style={[styles.statusPill, styles.statusPillSecondary]}>
            <Text style={styles.statusPillTextNeutral}>
              {uploadedReceipt?.ocrEngine ? `Engine: ${uploadedReceipt.ocrEngine}` : 'Engine: —'}
            </Text>
          </View>
        </View>

        <Text style={styles.helperText}>{buildReceiptConfidenceText(uploadedReceipt)}</Text>

        {uploadedReceipt?.parsed ? (
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Merchant</Text>
              <Text style={styles.metricValueSmall}>{uploadedReceipt.parsed.merchantName || '—'}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total</Text>
              <Text style={styles.metricValueSmall}>
                {typeof uploadedReceipt.parsed.totalAmount === 'number'
                  ? formatCurrency(uploadedReceipt.parsed.totalAmount)
                  : '—'}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Date</Text>
              <Text style={styles.metricValueSmall}>{uploadedReceipt.parsed.receiptDate || '—'}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Receipt #</Text>
              <Text style={styles.metricValueSmall}>{uploadedReceipt.parsed.receiptNumber || '—'}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>Upload a receipt to see OCR suggestions.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Expense Details</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Job</Text>
          <View style={styles.selectionBox}>
            <Text style={styles.selectionLabel}>Current selection</Text>
            <Text style={styles.selectionValue}>
              {selectedExpenseJob ? selectedExpenseJob.jobName : 'No job selected'}
            </Text>
            <Text style={styles.selectionHelper}>
              {selectedExpenseJob?.customerName
                ? `Customer: ${selectedExpenseJob.customerName}`
                : 'Select the job this expense belongs to.'}
            </Text>
          </View>

          {jobsLoading ? (
            <View style={styles.centeredStateCompact}>
              <ActivityIndicator size="small" color="#1E3A5F" />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {jobs.map((job) => (
                <Pressable
                  key={job.id}
                  onPress={() => setExpenseJobId(job.id)}
                  style={[styles.choiceChip, expenseJobId === job.id && styles.choiceChipActive]}
                >
                  <Text style={[styles.choiceChipText, expenseJobId === job.id && styles.choiceChipTextActive]}>
                    {job.jobName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EXPENSE_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                onPress={() => setExpenseCategory(category)}
                style={[styles.choiceChip, expenseCategory === category && styles.choiceChipActive]}
              >
                <Text style={[styles.choiceChipText, expenseCategory === category && styles.choiceChipTextActive]}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            placeholder="Or type a custom category"
            placeholderTextColor="#9AA5B1"
            style={styles.input}
            value={expenseCategory}
            onChangeText={setExpenseCategory}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Vendor</Text>
            {autoFilledFields.vendor ? <Text style={styles.autoFilledBadge}>OCR Auto-Filled</Text> : null}
          </View>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            placeholder="Vendor name"
            placeholderTextColor="#9AA5B1"
            style={[styles.input, autoFilledFields.vendor && styles.inputAutoFilled]}
            value={expenseVendor}
            onChangeText={setExpenseVendor}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Amount</Text>
            {autoFilledFields.amount ? <Text style={styles.autoFilledBadge}>OCR Auto-Filled</Text> : null}
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9AA5B1"
            style={[styles.input, autoFilledFields.amount && styles.inputAutoFilled]}
            value={expenseAmount}
            onChangeText={setExpenseAmount}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Date</Text>
            {autoFilledFields.date ? <Text style={styles.autoFilledBadge}>OCR Auto-Filled</Text> : null}
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9AA5B1"
            style={[styles.input, autoFilledFields.date && styles.inputAutoFilled]}
            value={expenseDate}
            onChangeText={setExpenseDate}
          />
        </View>

        <View style={styles.readinessBox}>
          <Text style={styles.selectionLabel}>Ready to Save</Text>
          <Text style={styles.selectionHelper}>
            {expenseReadyToSave
              ? 'All required fields are ready.'
              : 'Required: uploaded receipt, job, category, amount, and date.'}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Pressable onPress={onResetExpenseForm} style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>Reset Form</Text>
          </Pressable>

          <Pressable
            disabled={expenseSaving || !expenseReadyToSave}
            onPress={onSaveExpense}
            style={[
              styles.primaryButtonCompact,
              (expenseSaving || !expenseReadyToSave) && styles.buttonDisabled,
            ]}
          >
            {expenseSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Expense</Text>
            )}
          </Pressable>
        </View>

        {lastSavedExpenseId ? (
          <Text style={styles.helperText}>Last saved expense ID: #{lastSavedExpenseId}</Text>
        ) : null}
      </View>
    </>
  );
}