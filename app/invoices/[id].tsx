import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  ScrollView, StyleSheet, View,
  Text as RNText,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { CONFIG } from '../../src/mobile/constants';
import { useTheme } from '../../src/mobile/theme';
import type { InvoiceDetail } from '../../src/mobile/types';
import { formatCurrency, formatDate, formatDateInputValue, isManagerOrAdmin } from '../../src/mobile/utils';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Sheet } from '@/components/ui/Sheet';

const PAYMENT_METHODS = ['Check', 'Cash', 'ACH', 'Credit Card', 'Other'];

function statusTone(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'paid') return 'success';
  if (s === 'unpaid') return 'danger';
  if (s === 'partial') return 'warning';
  return 'neutral';
}

function SheetHeader({
  title,
  onCancel,
  onSave,
  saveLabel = 'Save',
  saveLoading = false,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveLoading?: boolean;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ minHeight: 44, justifyContent: 'center', marginBottom: spacing.sm }}>
      {/* Centered title, edge buttons overlaid — keeps the title optically
          centered regardless of the Cancel / Save button widths. */}
      <Text variant="headline" weight="600" style={{ textAlign: 'center' }}>{title}</Text>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <Button variant="ghost" size="sm" label="Cancel" onPress={onCancel} />
        <Button variant="primary" size="sm" label={saveLabel} onPress={onSave} loading={saveLoading} />
      </View>
    </View>
  );
}

export default function InvoiceDetailScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const api = useApi();
  const navigation = useNavigation();
  const { user, token, tenantSubdomain } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const canManage = isManagerOrAdmin(user);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payAmountError, setPayAmountError] = useState<string | undefined>(undefined);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('Check');
  const [payRef, setPayRef] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  const invoiceId = Number(id);

  const load = useCallback(async (isRefresh = false) => {
    if (!invoiceId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getInvoice(invoiceId);
      if (res.invoice) {
        setInvoice(res.invoice);
        navigation.setOptions({ title: res.invoice.invoiceNumber ?? `Invoice #${invoiceId}` });
      }
    } catch { /* ignore */ }
    finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, [api, invoiceId, navigation]);

  useEffect(() => { void load(); }, [load]);

  // One-shot action-param dispatcher: fires the existing handler once after
  // the invoice has loaded. Keeps handleSharePdf / handleRecordPayment bodies
  // byte-for-byte unchanged (protected regions — 06-07 range-hash gate).
  const actionFiredRef = useRef(false);
  // Ref is populated after handleSharePdf is declared below; the effect only
  // runs after invoice loads so the ref is always populated before it fires.
  const handleSharePdfRef = useRef<() => Promise<void>>(async () => { /* populated below */ });
  const canManageRef = useRef(canManage);
  canManageRef.current = canManage;
  useEffect(() => {
    if (!action || loading || !invoice || actionFiredRef.current) return;
    actionFiredRef.current = true;
    if (action === 'share') {
      void handleSharePdfRef.current();
    } else if (action === 'recordPayment' && canManageRef.current) {
      setPaymentSheetOpen(true);
    }
  }, [action, loading, invoice]);

  const handleSharePdf = async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      const url = `${CONFIG.API_BASE_URL}/api/invoices/${invoiceId}/pdf`;
      const destFile = new File(Paths.cache, `invoice_${invoiceId}.pdf`);
      const downloaded = await File.downloadFileAsync(url, destFile, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Subdomain': tenantSubdomain ?? '',
        },
        idempotent: true,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Not Supported', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(downloaded.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Invoice ${invoice.invoiceNumber ?? invoiceId}`,
      });
    } catch (e) {
      Alert.alert('PDF Error', e instanceof Error ? e.message : 'Could not load PDF.');
    } finally {
      setPdfLoading(false);
    }
  };
  // Keep ref current so the action-param dispatcher can call the latest closure.
  handleSharePdfRef.current = handleSharePdf;

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!payAmount.trim() || isNaN(amt) || amt <= 0) {
      setPayAmountError('Enter a valid payment amount');
      return;
    }
    setPaySaving(true);
    try {
      await api.recordPayment(invoiceId, {
        amount: amt,
        date: payDate,
        method: payMethod,
        reference: payRef.trim() || undefined,
      });
      setPayAmount(''); setPayRef(''); setPaymentSheetOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to record payment.');
    } finally {
      setPaySaving(false);
    }
  };

  if (loading) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      </Screen>
    );
  }

  if (!invoice) {
    return (
      <Screen headerMode="native">
        <View style={s.center}>
          <IconSymbol name={'exclamationmark.triangle' as never} size={40} color={colors.mutedLight} />
          <Text variant="subhead" tone="muted">Invoice not found.</Text>
        </View>
      </Screen>
    );
  }

  const balance = Number(invoice.balance ?? 0);

  return (
    <Screen headerMode="native" padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {/* Navy hero card */}
        <View style={[s.heroCard, { backgroundColor: colors.navySurface, borderRadius: radius.lg }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title3" tone="inverse" weight="700">
                {invoice.invoiceNumber ?? `Invoice #${invoice.id}`}
              </Text>
              {invoice.jobName ? (
                <Text variant="caption" tone="inverse">{invoice.jobName}</Text>
              ) : null}
              {invoice.clientName ? (
                <Text variant="caption" tone="inverse">{invoice.clientName}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
              <Badge tone={statusTone(invoice.status)} label={invoice.status} />
              <Pressable
                testID="invoice-pdf-share-button"
                onPress={() => void handleSharePdf()}
                disabled={pdfLoading}
                accessibilityRole="button"
                accessibilityLabel="Download invoice PDF"
                accessibilityState={{ disabled: pdfLoading, busy: pdfLoading }}
                style={[s.pdfBtn, { borderColor: 'rgba(255,255,255,0.35)', borderRadius: radius.sm }]}
              >
                {pdfLoading ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <IconSymbol name={'arrow.down.doc' as never} size={14} color="rgba(255,255,255,0.9)" />
                    <RNText style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' }}>PDF</RNText>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Amount / Balance row */}
          <View style={[s.heroAmounts, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
            <View>
              <Text variant="caption" tone="inverse">Invoice Amount</Text>
              <Text variant="title2" tone="inverse" weight="700">{formatCurrency(invoice.amount)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="caption" tone="inverse">Balance Due</Text>
              <RNText style={{
                fontSize: 22,
                fontWeight: '700',
                lineHeight: 28,
                color: balance > 0 ? colors.danger : colors.success,
              }}>
                {formatCurrency(balance)}
              </RNText>
            </View>
          </View>
        </View>

        {/* Detail card */}
        <Card elevation="sm" padding="md" radius="md">
          <View style={s.detailRow}>
            <Text variant="footnote" tone="muted" weight="600">Issued</Text>
            <Text variant="subhead" weight="700">{formatDate(invoice.dateIssued)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text variant="footnote" tone="muted" weight="600">Due</Text>
            <Text variant="subhead" weight="700">{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text variant="footnote" tone="muted" weight="600">Total Paid</Text>
            <Text variant="subhead" weight="700">{formatCurrency(invoice.totalPaid)}</Text>
          </View>
          {invoice.notes ? (
            <View style={{ gap: 4 }}>
              <Text variant="footnote" tone="muted" weight="600">Notes</Text>
              <Text variant="body">{invoice.notes}</Text>
            </View>
          ) : null}
        </Card>

        {/* Payment history section */}
        <SectionHeader title="Payment History" />

        {canManage && balance > 0 && (
          <Button
            variant="primary"
            size="md"
            fullWidth
            label="+ Record Payment"
            onPress={() => setPaymentSheetOpen(true)}
            testID="invoice-record-payment-button"
          />
        )}

        {(invoice.payments ?? []).length === 0 ? (
          <View style={s.emptyState}>
            <IconSymbol name={'dollarsign.circle' as never} size={40} color={colors.mutedLight} />
            <Text variant="subhead" tone="muted">No payments recorded.</Text>
          </View>
        ) : null}

        {(invoice.payments ?? []).map(p => (
          <Card key={p.id} elevation="sm" padding="md" radius="md">
            <Text variant="headline" weight="600">{formatCurrency(p.amount)}</Text>
            <Text variant="caption" tone="muted">
              {formatDate(p.date)}{p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ${p.reference}` : ''}
            </Text>
          </Card>
        ))}
      </ScrollView>

      {/* Record Payment sheet — sibling at screen root, never inside ScrollView */}
      {paymentSheetOpen && (
        <Sheet
          testID="invoice-payment-sheet"
          snapPoints={['70%', '92%']}
          scrollable
          onClose={() => setPaymentSheetOpen(false)}
          header={
            <SheetHeader
              title="Record Payment"
              onCancel={() => setPaymentSheetOpen(false)}
              onSave={() => void handleRecordPayment()}
              saveLabel="Save"
              saveLoading={paySaving}
            />
          }
        >
          <Input
            label="Amount"
            placeholder="Amount"
            value={payAmount}
            onChangeText={(v) => { setPayAmount(v); if (payAmountError) setPayAmountError(undefined); }}
            keyboardType="decimal-pad"
            error={payAmountError}
            bottomSheet
          />
          <DateField
            label="Date"
            value={payDate ? new Date(`${payDate}T00:00:00`) : null}
            onChange={(d) => setPayDate(formatDateInputValue(d))}
            testID="invoice-payment-date"
          />
          <View style={{ gap: spacing.xs }}>
            <Text variant="footnote" tone="muted" weight="600">Method</Text>
            <View style={s.segmented}>
              {PAYMENT_METHODS.map(m => (
                <Pressable
                  key={m}
                  style={[
                    s.segBtn,
                    {
                      borderRadius: radius.sm,
                      borderColor: payMethod === m ? colors.navySurface : colors.border,
                      backgroundColor: payMethod === m ? colors.navySurface : colors.bg,
                    },
                  ]}
                  onPress={() => setPayMethod(m)}
                >
                  <RNText style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: payMethod === m ? colors.inverse : colors.muted,
                  }}>
                    {m}
                  </RNText>
                </Pressable>
              ))}
            </View>
          </View>
          <Input
            label="Reference"
            placeholder="Reference / Check # (optional)"
            value={payRef}
            onChangeText={setPayRef}
            bottomSheet
          />
        </Sheet>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroCard: { padding: 16, gap: 12 },
  heroAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  pdfBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segBtn: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1 },
});

// Per-route crash boundary — scopes a render error to this screen (Expo Router).
export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/AppErrorBoundary';
