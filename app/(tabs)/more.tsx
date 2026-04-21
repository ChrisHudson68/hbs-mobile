import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import { isManagerOrAdmin } from '../../src/mobile/utils';

type MenuItem = { label: string; sub: string; path: string; managerOnly?: boolean };

const MENU: MenuItem[] = [
  { label: 'Add Expense', sub: 'Upload receipt and log expense', path: '/expenses/new', managerOnly: true },
  { label: 'Employees', sub: 'View employee roster and pay info', path: '/employees', managerOnly: true },
  { label: 'Manual Time Entry', sub: 'Log hours for any employee', path: '/timesheets/manual', managerOnly: true },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const canManage = isManagerOrAdmin(user);

  const items = MENU.filter(m => !m.managerOnly || canManage);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>More</Text>

        <View style={s.userCard}>
          <Text style={s.userName}>{user?.name}</Text>
          <Text style={s.userRole}>{user?.role} · {user?.email}</Text>
        </View>

        {items.map(item => (
          <Pressable key={item.path} style={s.menuItem} onPress={() => router.push(item.path as any)}>
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuSub}>{item.sub}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        ))}

        <Pressable style={s.logoutBtn} onPress={() => void logout()}>
          <Text style={s.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text },
  userCard: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: 16, gap: 4 },
  userName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  userRole: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  menuItem: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.muted },
  logoutBtn: { marginTop: 8, backgroundColor: Colors.dangerBg, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.dangerBorder },
  logoutText: { color: Colors.danger, fontWeight: '800', fontSize: 15 },
});
