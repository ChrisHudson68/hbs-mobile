import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, SafeAreaView,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useApi } from '../../src/mobile/hooks/useApi';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { Employee } from '../../src/mobile/types';
import { formatCurrency } from '../../src/mobile/utils';

function payLabel(emp: Employee) {
  if (emp.payType === 'salary' && emp.annualSalary) {
    return `Salary · ${formatCurrency(emp.annualSalary)}/yr`;
  }
  if (emp.hourlyRate) {
    return `Hourly · ${formatCurrency(emp.hourlyRate)}/hr`;
  }
  return emp.payType ?? '—';
}

export default function EmployeesScreen() {
  const api = useApi();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await api.getEmployees();
      setEmployees(res.employees ?? []);
    } catch { /* ignore */ }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const active = employees.filter(e => e.active);
  const inactive = employees.filter(e => !e.active);

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <Text style={s.title}>Employees</Text>

        <Text style={s.sectionHeader}>Active ({active.length})</Text>
        {active.length === 0 && <Text style={s.empty}>No active employees.</Text>}
        {active.map(emp => (
          <View key={emp.id} style={s.card}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{emp.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.empName}>{emp.name}</Text>
              <Text style={s.empPay}>{payLabel(emp)}</Text>
            </View>
            <View style={s.activeBadge}>
              <Text style={s.activeBadgeText}>Active</Text>
            </View>
          </View>
        ))}

        {inactive.length > 0 && (
          <>
            <Text style={[s.sectionHeader, { marginTop: 8 }]}>Inactive ({inactive.length})</Text>
            {inactive.map(emp => (
              <View key={emp.id} style={[s.card, { opacity: 0.6 }]}>
                <View style={[s.avatarCircle, { backgroundColor: Colors.border }]}>
                  <Text style={[s.avatarText, { color: Colors.muted }]}>{emp.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.empName}>{emp.name}</Text>
                  <Text style={s.empPay}>{payLabel(emp)}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.md, gap: 10 },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  sectionHeader: { fontSize: 11, fontWeight: '800', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  empName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  empPay: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: Colors.successBg ?? '#dcfce7' },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: 8 },
});
