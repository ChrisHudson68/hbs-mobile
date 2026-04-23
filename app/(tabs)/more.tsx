import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { useAppState } from '../../src/mobile/context/AppStateContext';
import { useBiometrics } from '../../src/mobile/hooks/useBiometrics';
import { cancelWeeklySummaryNotification, scheduleWeeklySummaryNotification } from '../../src/mobile/notifications';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import { isManagerOrAdmin } from '../../src/mobile/utils';

type MenuItem = { label: string; sub: string; path: string; managerOnly?: boolean };

const MENU: MenuItem[] = [
  { label: 'Manual Time Entry', sub: 'Log hours for any employee', path: '/timesheets/manual', managerOnly: true },
  { label: 'Add Expense', sub: 'Upload receipt and log expense', path: '/expenses/new' },
  { label: 'Employees', sub: 'View employee roster and pay info', path: '/employees', managerOnly: true },
];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:    { bg: Colors.navy,       text: '#fff' },
  manager:  { bg: Colors.yellow,     text: Colors.navyDark },
  employee: { bg: Colors.successBg,  text: Colors.success },
  editor:   { bg: Colors.infoBg,     text: Colors.infoText },
  viewer:   { bg: Colors.border,     text: Colors.muted },
};

function getRoleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? { bg: Colors.border, text: Colors.muted };
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

export default function MoreScreen() {
  const { user, tenantSubdomain, logout } = useAuth();
  const { isClockedIn } = useAppState();
  const router = useRouter();
  const canManage = isManagerOrAdmin(user);
  const biometrics = useBiometrics();

  const handleToggleBiometrics = async () => {
    if (biometrics.enabled) {
      Alert.alert('Disable Biometrics', `Stop using ${biometrics.biometricType ?? 'biometrics'} to sign in?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable', style: 'destructive', onPress: () => void biometrics.disable() },
      ]);
    } else {
      const success = await biometrics.enable();
      if (!success) {
        Alert.alert('Not Enabled', 'Biometric authentication could not be verified. Try again.');
      }
    }
  };

  const [weeklySummaryOn, setWeeklySummaryOn] = useState(false);

  const handleToggleWeeklySummary = async (value: boolean) => {
    setWeeklySummaryOn(value);
    if (value) {
      await scheduleWeeklySummaryNotification();
    } else {
      await cancelWeeklySummaryNotification();
    }
  };

  const items = MENU.filter(m => !m.managerOnly || canManage);
  const roleColor = getRoleColor(user?.role ?? '');
  const initials = getInitials(user?.name ?? '');
  const appVersion = Constants.expoConfig?.version ?? '—';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.screenTitle}>Profile</Text>

        {/* Avatar card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.name}</Text>
            <View style={[s.roleBadge, { backgroundColor: roleColor.bg }]}>
              <Text style={[s.roleBadgeText, { color: roleColor.text }]}>
                {user?.role?.toUpperCase() ?? 'USER'}
              </Text>
            </View>
            <Text style={s.profileEmail}>{user?.email}</Text>
            {tenantSubdomain ? (
              <Text style={s.profileTenant}>
                {tenantSubdomain}.hudson-business-solutions.com
              </Text>
            ) : null}
          </View>
        </View>

        {/* Status chip */}
        <View style={[s.statusBar, isClockedIn ? s.statusBarActive : s.statusBarIdle]}>
          <View style={[s.statusDot, { backgroundColor: isClockedIn ? Colors.success : Colors.mutedLight }]} />
          <Text style={[s.statusText, { color: isClockedIn ? Colors.success : Colors.muted }]}>
            {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
          </Text>
          {isClockedIn && (
            <Pressable onPress={() => router.push('/(tabs)/timesheets')}>
              <Text style={s.statusLink}>View →</Text>
            </Pressable>
          )}
        </View>

        {/* Menu */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Quick Actions</Text>
          {items.map(item => (
            <Pressable key={item.path} style={s.menuItem} onPress={() => router.push(item.path as any)}>
              <View style={{ flex: 1 }}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Settings */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Settings</Text>

          {biometrics.available && (
            <View style={s.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.settingLabel}>{biometrics.biometricType ?? 'Biometrics'}</Text>
                <Text style={s.settingSub}>Sign in without typing your password</Text>
              </View>
              <Switch
                value={biometrics.enabled}
                onValueChange={() => void handleToggleBiometrics()}
                trackColor={{ true: Colors.navy }}
              />
            </View>
          )}

          <View style={s.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>Weekly Hours Reminder</Text>
              <Text style={s.settingSub}>Friday at 4 PM — review your timesheet</Text>
            </View>
            <Switch
              value={weeklySummaryOn}
              onValueChange={(v) => void handleToggleWeeklySummary(v)}
              trackColor={{ true: Colors.navy }}
            />
          </View>
        </View>

        {/* Sign out */}
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </Pressable>

        {/* App version */}
        <Text style={s.versionText}>Hudson Business Solutions v{appVersion}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  screenTitle: { fontSize: 22, fontWeight: '900', color: Colors.text },

  profileCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { fontSize: 24, fontWeight: '900', color: '#fff' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '900', color: '#fff' },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  profileEmail: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  profileTenant: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
  },
  statusBarActive: { backgroundColor: Colors.successBg, borderColor: Colors.successBorder },
  statusBarIdle: { backgroundColor: Colors.card, borderColor: Colors.border },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '700' },
  statusLink: { fontSize: 13, fontWeight: '700', color: Colors.infoText },

  section: { gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 2 },
  menuItem: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.muted },

  logoutBtn: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  logoutText: { color: Colors.danger, fontWeight: '800', fontSize: 15 },

  versionText: { textAlign: 'center', fontSize: 11, color: Colors.mutedLight, marginTop: 4 },
  settingRow: {
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  settingLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  settingSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
});
