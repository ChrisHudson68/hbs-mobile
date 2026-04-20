import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { Invoice } from '../../src/mobile/types';
import { formatCurrency, formatDate, isManagerOrAdmin } from '../../src/mobile/utils';
import { useAuth } from '../../src/mobile/context/AuthContext';

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === 'paid') return Colors.success;
  if (s === 'unpaid') return Colors.danger;
  if (s === 'partial') return Colors.warning;
  return Colors.muted;
}

export default function InvoicesScreen() {
  const api = useApi();
  const router = useRouter();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const canManage = isManagerOrAdmin(user);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.getInvoices();
      setInvoices(res.invoices ?? []);
    } catch { /* ignore */ }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  const unpaidTotal = invoices.filter(i => i.status?.toLowerCase() === 'unpaid').reduce((sum, i) => sum + Number(i.balance || 0), 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={s.title}>Invoices</Text>
        {canManage && (
          <Pressable style={s.addBtn} onPress={() => router.push('/invoices/new')}>
            <Text style={s.addBtnText}>+ New</Text>
          </Pressable>
        )}
      </View>

      {unpaidTotal > 0 && (
        <View style={s.alertBanner}>
          <Text style={s.alertText}>Unpaid balance: {formatCurrency(unpaidTotal)}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        {invoices.length === 0 && <Text style={s.empty}>No invoices found.</Text>}
        {invoices.map(inv => (
          <Pressable key={inv.id} style={s.card} onPress={() => router.push(`/invoices/${inv.id}`)}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.invNum}>{inv.invoiceNumber ?? `Invoice #${inv.id}`}</Text>
                <Text style={s.jobName}>{inv.jobName ?? '—'}</Text>
                <Text style={s.date}>Issued {formatDate(inv.dateIssued)} · Due {formatDate(inv.dueDate)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.amount}>{formatCurrency(inv.amount)}</Text>
                <View style={[s.badge, { backgroundColor: statusColor(inv.status) + '20' }]}>
                  <Text style={[s.badgeText, { color: statusColor(inv.status) }]}>{inv.status}</Text>
                </View>
              </View>
            </View>
            {Number(inv.balance) > 0 && inv.status?.toLowerCase() !== 'paid' && (
              <Text style={s.balance}>Balance due: {formatCurrency(inv.balance)}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text },
  addBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  alertBanner: { marginHorizontal: Spacing.md, marginBottom: 8, backgroundColor: Colors.dangerBg, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: Colors.dangerBorder },
  alertText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  scroll: { padding: Spacing.md, paddingTop: 0, gap: 10 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.xl },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  row: { flexDirection: 'row', gap: 10 },
  invNum: { fontSize: 15, fontWeight: '800', color: Colors.text },
  jobName: { fontSize: 12, color: Colors.navy, fontWeight: '600', marginTop: 2 },
  date: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '900', color: Colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  balance: { fontSize: 12, color: Colors.danger, fontWeight: '600' },
});
