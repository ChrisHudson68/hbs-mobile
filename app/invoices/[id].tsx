import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { CONFIG } from '../../src/mobile/constants';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { InvoiceDetail } from '../../src/mobile/types';
import { formatCurrency, formatDate, isManagerOrAdmin } from '../../src/mobile/utils';

const PAYMENT_METHODS = ['Check', 'Cash', 'ACH', 'Credit Card', 'Other'];

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === 'paid') return Colors.success;
  if (s === 'unpaid') return Colors.danger;
  if (s === 'partial') return Colors.warning;
  return Colors.muted;
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const navigation = useNavigation();
  const router = useRouter();
  const { user, token, tenantSubdomain } = useAuth();
  const canManage = isManagerOrAdmin(user);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('Check');
  const [payRef, setPayRef] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  const invoiceId = Number(id);

  const load = useCallback(async (isRefresh = false) => {
    if (!invoiceId) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.getInvoice(invoiceId);
      if (res.invoice) {
        setInvoice(res.invoice);
        navigation.setOptions({ title: res.invoice.invoiceNumber ?? `Invoice #${invoiceId}` });
      }
    } catch { /* ignore */ }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [api, invoiceId, navigation]);

  useEffect(() => { void load(); }, [load]);

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

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!payAmount.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Required', 'Enter a valid payment amount.');
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
      setPayAmount(''); setPayRef(''); setAddingPayment(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to record payment.');
    } finally {
      setPaySaving(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  if (!invoice) {
    return <SafeAreaView style={s.safe}><View style={s.center}><Text style={s.empty}>Invoice not found.</Text></View></SafeAreaView>;
  }

  const balance = Number(invoice.balance ?? 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={s.heroCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{invoice.invoiceNumber ?? `Invoice #${invoice.id}`}</Text>
              {invoice.jobName ? <Text style={s.heroSub}>{invoice.jobName}</Text> : null}
              {invoice.clientName ? <Text style={s.heroSub}>{invoice.clientName}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <View style={[s.badge, { backgroundColor: statusColor(invoice.status) + '30' }]}>
                <Text style={[s.badgeText, { color: statusColor(invoice.status) }]}>{invoice.status}</Text>
              </View>
              <Pressable style={s.pdfBtn} onPress={() => void handleSharePdf()} disabled={pdfLoading}>
                {pdfLoading
                  ? <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                  : <Text style={s.pdfBtnText}>⬇ PDF</Text>
                }
              </Pressable>
            </View>
          </View>
          <View style={s.heroAmounts}>
            <View>
              <Text style={s.heroAmtLabel}>Invoice Amount</Text>
              <Text style={s.heroAmt}>{formatCurrency(invoice.amount)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.heroAmtLabel}>Balance Due</Text>
              <Text style={[s.heroAmt, { color: balance > 0 ? Colors.danger : Colors.success }]}>
                {formatCurrency(balance)}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.detailCard}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Issued</Text>
            <Text style={s.detailValue}>{formatDate(invoice.dateIssued)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Due</Text>
            <Text style={s.detailValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Total Paid</Text>
            <Text style={s.detailValue}>{formatCurrency(invoice.totalPaid)}</Text>
          </View>
          {invoice.notes ? (
            <View style={[s.detailRow, { flexDirection: 'column', gap: 4 }]}>
              <Text style={s.detailLabel}>Notes</Text>
              <Text style={s.detailBody}>{invoice.notes}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.sectionTitle}>Payment History</Text>

        {canManage && balance > 0 && !addingPayment && (
          <Pressable style={s.addRowBtn} onPress={() => setAddingPayment(true)}>
            <Text style={s.addRowBtnText}>+ Record Payment</Text>
          </Pressable>
        )}

        {addingPayment && (
          <View style={s.formCard}>
            <Text style={s.formTitle}>Record Payment</Text>
            <TextInput
              style={s.input}
              placeholder="Amount"
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={Colors.mutedLight}
            />
            <TextInput
              style={s.input}
              placeholder="Date (YYYY-MM-DD)"
              value={payDate}
              onChangeText={setPayDate}
              placeholderTextColor={Colors.mutedLight}
            />
            <Text style={s.fieldLabel}>Method</Text>
            <View style={s.segmented}>
              {PAYMENT_METHODS.map(m => (
                <Pressable key={m} style={[s.segBtn, payMethod === m && s.segBtnActive]} onPress={() => setPayMethod(m)}>
                  <Text style={[s.segText, payMethod === m && s.segTextActive]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={s.input}
              placeholder="Reference / Check # (optional)"
              value={payRef}
              onChangeText={setPayRef}
              placeholderTextColor={Colors.mutedLight}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[s.saveBtn, { flex: 1 }]} onPress={() => void handleRecordPayment()} disabled={paySaving}>
                {paySaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
              </Pressable>
              <Pressable style={[s.cancelBtn, { flex: 1 }]} onPress={() => setAddingPayment(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {(invoice.payments ?? []).length === 0 && <Text style={s.empty}>No payments recorded.</Text>}
        {(invoice.payments ?? []).map(p => (
          <View key={p.id} style={s.paymentRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.payAmount}>{formatCurrency(p.amount)}</Text>
              <Text style={s.paySub}>
                {formatDate(p.date)}{p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ${p.reference}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  heroCard: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: 16, gap: 12 },
  heroTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  pdfBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', minWidth: 60, alignItems: 'center' },
  pdfBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  heroAmounts: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  heroAmtLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  heroAmt: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 2 },
  detailCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  detailBody: { fontSize: 13, color: Colors.muted, lineHeight: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  addRowBtn: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.infoBorder },
  addRowBtnText: { color: Colors.infoText, fontWeight: '700', fontSize: 13 },
  formCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  formTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  segBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  segText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  segTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 10, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.muted, fontWeight: '700', fontSize: 14 },
  paymentRow: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
  payAmount: { fontSize: 15, fontWeight: '800', color: Colors.text },
  paySub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: 8 },
});
