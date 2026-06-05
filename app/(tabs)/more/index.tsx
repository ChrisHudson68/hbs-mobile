import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { useAppState } from '../../../src/mobile/context/AppStateContext';
import { useApi } from '../../../src/mobile/hooks/useApi';
import { useBiometrics } from '../../../src/mobile/hooks/useBiometrics';
import { tenantKey } from '../../../src/mobile/query/queryClient';
import { cancelWeeklySummaryNotification, scheduleWeeklySummaryNotification } from '../../../src/mobile/notifications';
import { useTheme } from '../../../src/mobile/theme';
import type { JobListItem, TimesheetsResponse } from '../../../src/mobile/types';
import { isActiveStatus, isManagerOrAdmin } from '../../../src/mobile/utils';

import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';

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

// Profile badge is an always-navy fill surface (white text in both themes), so its
// darker gradient endpoint and on-navy "on clock" green are fixed, not theme tokens.
const PROFILE_GRADIENT_DARK = '#142844';
const PROFILE_ON_CLOCK = '#4ADE80';

// ---------------------------------------------------------------------------
// Role color helpers (unchanged logic; Colors.* → theme tokens applied inline)
// ---------------------------------------------------------------------------

// Role chip palette tuned to sit ON the navy profile hero (white-on-navy context),
// resolved at render via useTheme() so it adapts to dark mode.
type RoleChip = { bg: string; text: string };

function getRoleChip(
  role: string,
  colors: ReturnType<typeof useTheme>['colors']
): RoleChip {
  const map: Record<string, RoleChip> = {
    admin:    { bg: 'rgba(255,255,255,0.92)', text: colors.navySurface },
    manager:  { bg: colors.yellow,            text: colors.navyDark },
    employee: { bg: 'rgba(74,222,128,0.22)',  text: '#A7F3C0' },
    editor:   { bg: 'rgba(255,255,255,0.16)', text: colors.inverse },
    viewer:   { bg: 'rgba(255,255,255,0.14)', text: 'rgba(255,255,255,0.85)' },
  };
  return map[role.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.16)', text: colors.inverse };
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

// Time-of-day greeting (device-local; no data needed). The free "recognition" layer.
function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Live "Xh Ym" label from a clock-in timestamp, recomputed each tick.
function elapsedLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------------------
// Screen component
// ---------------------------------------------------------------------------

export default function MoreScreen() {
  const { user, tenantSubdomain, logout, applyBiometricLock } = useAuth();
  const { isClockedIn } = useAppState();
  const api = useApi();
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const canManage = isManagerOrAdmin(user);
  const biometrics = useBiometrics();

  // ----- Profile stats (same tenant-scoped, persisted queries the Dashboard uses;
  // a failed/slow fetch degrades to 0 — the card still renders identity + greeting).
  const timesheetsQuery = useQuery({
    queryKey: tenantKey(tenantSubdomain, 'timesheets'),
    queryFn: () => api.getTimesheets(),
  });
  const jobsQuery = useQuery({
    queryKey: tenantKey(tenantSubdomain, 'jobs'),
    queryFn: () => api.getJobs(),
    enabled: canManage,
  });

  const timesheetData: TimesheetsResponse | null = timesheetsQuery.data ?? null;
  const jobs: JobListItem[] = jobsQuery.data?.jobs ?? [];

  const weekHours = timesheetData?.summary?.totalHours ?? 0;
  const hoursPercent = Math.min(1, weekHours / 40);
  const activeJobsCount = jobs.filter(j => isActiveStatus(j.status)).length;

  // Live clock-in timer (drives the "On clock · Xh Ym" stat). Ticks only while
  // an active entry exists; cleared otherwise. Mirrors the Dashboard clock card.
  const activeEntry = timesheetData?.activeClockEntry;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!activeEntry?.clockInAt) { setElapsed(0); return; }
    const update = () => setElapsed(
      Math.max(0, Math.floor((Date.now() - new Date(activeEntry.clockInAt!).getTime()) / 1000)),
    );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeEntry?.clockInAt]);

  // ----- Settings state (unchanged wiring) -----
  const [weeklySummaryOn, setWeeklySummaryOn] = useState(false);

  const handleToggleBiometrics = async () => {
    if (biometrics.enabled) {
      Alert.alert('Disable Biometrics', `Stop using ${biometrics.biometricType ?? 'biometrics'} to sign in?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await biometrics.disable();
              // Re-store the token WITHOUT biometric gating so a normal launch can read it.
              await applyBiometricLock(false);
            })();
          },
        },
      ]);
    } else {
      const success = await biometrics.enable();
      if (success) {
        // CRITICAL: re-encrypt the current token behind biometrics. Enabling AFTER login
        // is the case login()'s gating misses; without this the unlock finds no gated
        // token and silently fails to sign in.
        await applyBiometricLock(true);
      } else {
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
  const roleChip = getRoleChip(user?.role ?? '', colors);
  const initials = getInitials(user?.name ?? '');
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'there';
  const greeting = getGreeting(new Date());
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
        {/* Greeting + profile badge (V3 centered ID-card). The greeting is    */}
        {/* the free "recognition" layer; the navy badge carries identity and  */}
        {/* a role-gated stat strip. Crew presence / photo / tenure are        */}
        {/* additive and land when the backend exposes them (see the profile   */}
        {/* belonging backend spec in .planning/).                             */}
        {/* ---------------------------------------------------------------- */}
        <RNText style={[s.greeting, { color: colors.muted }]}>{greeting}, {firstName}.</RNText>

        <LinearGradient
          colors={[colors.navySurface, PROFILE_GRADIENT_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.badge, { borderRadius: radius.lg }]}
          testID="more-profile-card"
        >
          {/* Avatar — static amber ring. (A literal hours-to-goal ring needs
              react-native-svg; the thin amber bar under "This week" carries
              progress instead.) Initials are the fallback until an HR-provided
              photo exists. */}
          <View style={[s.avatarRing, { borderColor: colors.yellow }]}>
            <View style={s.avatarInner}>
              <RNText style={s.avatarText}>{initials || '—'}</RNText>
            </View>
          </View>

          <RNText style={s.badgeName} numberOfLines={1}>{user?.name}</RNText>
          <RNText style={s.badgeMeta} numberOfLines={1}>
            {user?.role}{tenantSubdomain ? ` · ${tenantSubdomain}` : ''}
          </RNText>
          <View style={[s.roleChip, { backgroundColor: roleChip.bg }]}>
            <RNText style={[s.roleChipText, { color: roleChip.text }]}>
              {user?.role?.toUpperCase() ?? 'USER'}
            </RNText>
          </View>

          {/* Role-gated stat strip on a darker inset */}
          <View style={s.statStrip}>
            <View style={s.stat}>
              <RNText style={s.statValue}>
                {weekHours.toFixed(1)}<RNText style={s.statUnit}>/40h</RNText>
              </RNText>
              <RNText style={s.statKey}>This week</RNText>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.round(hoursPercent * 100)}%` as any, backgroundColor: colors.yellow }]} />
              </View>
            </View>

            {canManage && (
              <View style={[s.stat, s.statBorder]}>
                <RNText style={s.statValue}>{activeJobsCount}</RNText>
                <RNText style={s.statKey}>Active jobs</RNText>
              </View>
            )}

            <Pressable
              style={[s.stat, s.statBorder]}
              onPress={() => router.push('/(tabs)/timesheets')}
              accessibilityRole="button"
              accessibilityLabel={isClockedIn ? 'View timesheet' : 'Go to timesheets'}
            >
              <RNText style={[s.statValue, isClockedIn ? { color: PROFILE_ON_CLOCK } : null]}>
                {isClockedIn ? 'On clock' : 'Off'}
              </RNText>
              <RNText style={s.statKey}>{isClockedIn ? elapsedLabel(elapsed) : 'Tap to clock in'}</RNText>
            </Pressable>
          </View>
        </LinearGradient>

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
                testID={`more-row-${item.path.replace(/[^a-z]+/gi, '-').replace(/^-|-$/g, '')}`}
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
                    trackColor={{ false: colors.border, true: colors.navySurface }}
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
                  trackColor={{ false: colors.border, true: colors.navySurface }}
                  testID="more-weekly-reminder-toggle"
                />
              }
            />
          </Card>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Sign Out — quiet destructive: red text on card fill + thin red    */}
        {/* outline (a minor exit, not a danger primary). handleLogout         */}
        {/* Alert.alert unchanged.                                            */}
        {/* ---------------------------------------------------------------- */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
          onPress={handleLogout}
          testID="more-signout-button"
          style={({ pressed }) => [
            s.signOut,
            {
              borderRadius: radius.md,
              borderColor: colors.danger,
              backgroundColor: colors.card,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <RNText style={{ color: colors.danger, fontSize: 17, fontWeight: '600' }}>
            Sign Out
          </RNText>
        </Pressable>

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
  // ----- Profile badge (V3 centered ID-card) — always-navy fill, white text -----
  greeting: { fontSize: 15, fontWeight: '600', marginBottom: 2, marginLeft: 2 },
  badge: { alignItems: 'center', paddingTop: 20, overflow: 'hidden' },
  avatarRing: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  badgeName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginTop: 12 },
  badgeMeta: { color: 'rgba(255,255,255,0.66)', fontSize: 12.5, marginTop: 3, textTransform: 'capitalize' },
  roleChip: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  statStrip: {
    flexDirection: 'row', alignSelf: 'stretch', marginTop: 18,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
  },
  stat: { flex: 1, paddingVertical: 13, paddingHorizontal: 8, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)' },
  statValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  statUnit: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' },
  statKey: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  barTrack: { marginTop: 7, width: 44, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  signOut: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
  },
});
