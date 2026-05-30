import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  View,
} from 'react-native';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { useAppState } from '../../../src/mobile/context/AppStateContext';
import { useBiometrics } from '../../../src/mobile/hooks/useBiometrics';
import { cancelWeeklySummaryNotification, scheduleWeeklySummaryNotification } from '../../../src/mobile/notifications';
import { useTheme } from '../../../src/mobile/theme';
import { isManagerOrAdmin } from '../../../src/mobile/utils';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MenuItem = { label: string; sub: string; path: string; managerOnly?: boolean };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MENU: MenuItem[] = [
  { label: 'Manual Time Entry', sub: 'Log hours for any employee', path: '/timesheets/manual', managerOnly: true },
  { label: 'Add Expense', sub: 'Upload receipt and log expense', path: '/expenses/new' },
  { label: 'Employees', sub: 'View employee roster and pay info', path: '/employees', managerOnly: true },
];

// ---------------------------------------------------------------------------
// Role color helpers (unchanged logic; Colors.* → theme tokens applied inline)
// ---------------------------------------------------------------------------

// Role-specific avatar/badge palette — values resolved at render via useTheme()
// so they adapt to dark mode. The shape is kept as a function rather than a
// module-level constant so it captures the live theme tokens each render.
type RoleColorEntry = { bg: string; text: string; badgeTone: BadgeTone };

function getRoleColorEntry(
  role: string,
  colors: ReturnType<typeof useTheme>['colors']
): RoleColorEntry {
  const map: Record<string, RoleColorEntry> = {
    admin:    { bg: colors.navy,      text: colors.inverse,  badgeTone: 'accent' },
    manager:  { bg: colors.yellow,    text: colors.navyDark, badgeTone: 'accent' },
    employee: { bg: colors.successBg, text: colors.success,  badgeTone: 'success' },
    editor:   { bg: colors.infoBg,    text: colors.infoText, badgeTone: 'info' },
    viewer:   { bg: colors.border,    text: colors.muted,    badgeTone: 'neutral' },
  };
  return map[role.toLowerCase()] ?? { bg: colors.border, text: colors.muted, badgeTone: 'neutral' };
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

// ---------------------------------------------------------------------------
// Screen component
// ---------------------------------------------------------------------------

export default function MoreScreen() {
  const { user, tenantSubdomain, logout } = useAuth();
  const { isClockedIn } = useAppState();
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const canManage = isManagerOrAdmin(user);
  const biometrics = useBiometrics();

  // ----- Settings state (unchanged wiring) -----
  const [weeklySummaryOn, setWeeklySummaryOn] = useState(false);

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

  const handleToggleWeeklySummary = async (value: boolean) => {
    setWeeklySummaryOn(value);
    if (value) {
      await scheduleWeeklySummaryNotification();
    } else {
      await cancelWeeklySummaryNotification();
    }
  };

  // ----- Derived values -----
  const items = MENU.filter(m => !m.managerOnly || canManage);
  const roleEntry = getRoleColorEntry(user?.role ?? '', colors);
  const initials = getInitials(user?.name ?? '');
  const appVersion = Constants.expoConfig?.version ?? '—';

  // ----- Logout (Alert.alert confirmation — unchanged) -----
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <Screen headerMode="native" padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* ---------------------------------------------------------------- */}
        {/* Profile card (D-11) — light card, role-colored avatar             */}
        {/* ---------------------------------------------------------------- */}
        <Card elevation="sm" padding="md" testID="more-profile-card">
          <View style={s.profileRow}>
            {/* 56pt avatar circle with role-specific bg/text */}
            <View
              style={[
                s.avatar,
                { backgroundColor: roleEntry.bg, borderRadius: radius.pill },
              ]}
            >
              <RNText style={{ color: roleEntry.text, fontSize: 20, fontWeight: '600' }}>
                {initials}
              </RNText>
            </View>

            {/* Name, role badge, email, tenant */}
            <View style={s.profileInfo}>
              <Text variant="headline" weight="600">{user?.name}</Text>
              <Badge
                tone={roleEntry.badgeTone}
                label={user?.role?.toUpperCase() ?? 'USER'}
              />
              <Text variant="footnote" tone="muted" numberOfLines={1}>{user?.email}</Text>
              {tenantSubdomain ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {tenantSubdomain}.hudson-business-solutions.com
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Clock status chip — preserved logic, reskinned via tokens         */}
        {/* ---------------------------------------------------------------- */}
        <View
          style={[
            s.statusBar,
            {
              borderRadius: radius.md,
              borderColor: isClockedIn ? colors.successBorder : colors.border,
              backgroundColor: isClockedIn ? colors.successBg : colors.card,
            },
          ]}
        >
          <View
            style={[
              s.statusDot,
              { backgroundColor: isClockedIn ? colors.success : colors.mutedLight },
            ]}
          />
          <RNText
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: '600',
              color: isClockedIn ? colors.success : colors.muted,
            }}
          >
            {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
          </RNText>
          {isClockedIn && (
            <Pressable onPress={() => router.push('/(tabs)/timesheets')}>
              <RNText style={{ color: colors.infoText, fontSize: 13, fontWeight: '700' }}>
                View →
              </RNText>
            </Pressable>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Quick Actions — role-filtered, kit ListRow + SectionHeader        */}
        {/* ---------------------------------------------------------------- */}
        <View>
          <SectionHeader title="Quick Actions" />
          <Card elevation="none" padding="none">
            {items.map(item => (
              <ListRow
                key={item.path}
                title={item.label}
                subtitle={item.sub}
                trailing="chevron"
                onPress={() => router.push(item.path as any)}
              />
            ))}
          </Card>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Settings — switch-bug workaround: trailing='custom' + raw Switch  */}
        {/* ListRow trailing='switch' hardcodes value={false} — NOT used here */}
        {/* ---------------------------------------------------------------- */}
        <View>
          <SectionHeader title="Settings" />
          <Card elevation="none" padding="none">
            {biometrics.available && (
              <ListRow
                title={biometrics.biometricType ?? 'Biometrics'}
                subtitle="Sign in without typing your password"
                trailing="custom"
                trailingCustom={
                  <Switch
                    value={biometrics.enabled}
                    onValueChange={() => void handleToggleBiometrics()}
                    trackColor={{ false: colors.border, true: colors.navy }}
                    testID="more-biometrics-toggle"
                  />
                }
              />
            )}
            <ListRow
              title="Weekly Hours Reminder"
              subtitle="Friday at 4 PM — review your timesheet"
              trailing="custom"
              trailingCustom={
                <Switch
                  value={weeklySummaryOn}
                  onValueChange={(v) => void handleToggleWeeklySummary(v)}
                  trackColor={{ false: colors.border, true: colors.navy }}
                  testID="more-weekly-reminder-toggle"
                />
              }
            />
          </Card>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Sign Out — kit danger Button; handleLogout Alert.alert unchanged  */}
        {/* ---------------------------------------------------------------- */}
        <Button
          variant="danger"
          size="lg"
          fullWidth
          label="Sign Out"
          onPress={handleLogout}
          testID="more-signout-button"
        />

        {/* ---------------------------------------------------------------- */}
        {/* Version footer                                                    */}
        {/* ---------------------------------------------------------------- */}
        <RNText style={{ textAlign: 'center', fontSize: 12, color: colors.muted }}>
          Hudson Business Solutions v{appVersion}
        </RNText>
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Static layout primitives only — NO colors/spacing/radius constants here
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
