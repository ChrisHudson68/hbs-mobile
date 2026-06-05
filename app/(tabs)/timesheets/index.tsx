import { useNavigation, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, LayoutAnimation, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text as RNText, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { interpolate, useAnimatedStyle, Extrapolation } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { useApi } from '../../../src/mobile/hooks/useApi';
import { useAppState } from '../../../src/mobile/context/AppStateContext';
import { enqueueClockIn, enqueueClockOut, isOnline, useOfflineQueueFlusher } from '../../../src/mobile/hooks/useOfflineQueue';
import { useTheme } from '../../../src/mobile/theme';
import type { ClockInJobsResponse, Employee, JobListItem, TimesheetEditRequest, TimesheetsResponse, TimesheetEntry } from '../../../src/mobile/types';
import { formatDate, formatDuration, formatHours, hasPermission, isManagerOrAdmin, validateHours, validateRequired } from '../../../src/mobile/utils';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ListRow } from '@/components/ui/ListRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Sheet } from '@/components/ui/Sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { SwipeRow, closeOpenSwipeRow } from '@/components/ui/SwipeRow';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import { EmptyState } from '@/components/ui/EmptyState';

// ---------------------------------------------------------------------------
// Pure helpers (unchanged)
// ---------------------------------------------------------------------------

function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(start: string): string {
  const end = addDays(start, 6);
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

function approvalTone(status: string | null): 'success' | 'danger' | 'warning' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

// Display-only: "DJ Manning" → "DJ M." so the Viewing chips never truncate.
function shortEmployeeName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(' ')} ${last.charAt(0).toUpperCase()}.`;
}

// ---------------------------------------------------------------------------
// TimeRowSwipeActions — role-gated swipe panel for week time-entry rows.
// Manager/Admin: Edit (navy/pencil) + Delete (danger/trash).
// Employee: Request Edit only (infoBg/square.and.pencil).
// Uses sv.get() via useAnimatedStyle — React Compiler-compliant (D-12).
// Panel width: 144pt for manager (2 × 72pt), 72pt for employee (1 × 72pt).
// ---------------------------------------------------------------------------

const SWIPE_BUTTON_WIDTH = 72;

type TimeRowSwipeActionsProps = {
  drag: SharedValue<number>;
  methods: SwipeableMethods;
  isManager: boolean;
  showRequestBtn: boolean;
  entryId: number;
  onEdit: () => void;
  onDelete: () => void;
  onRequestEdit: () => void;
};

function TimeRowSwipeActions({
  drag,
  methods,
  isManager,
  showRequestBtn,
  entryId,
  onEdit,
  onDelete,
  onRequestEdit,
}: TimeRowSwipeActionsProps) {
  const { colors, radius } = useTheme();
  const panelWidth = isManager ? SWIPE_BUTTON_WIDTH * 2 : SWIPE_BUTTON_WIDTH;

  // Translate the panel so it anchors to the right edge during the swipe
  // (Pitfall 3: drag is negative for left-swipe / right-actions revealed).
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          drag.get(),
          [-panelWidth, 0],
          [0, panelWidth],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (isManager) {
    return (
      <Animated.View style={[{ width: panelWidth, flexDirection: 'row' }, animStyle]}>
        <Pressable
          style={[s.swipeBtn, { backgroundColor: colors.navySurface, borderRadius: radius.sm }]}
          onPress={() => { methods.close(); onEdit(); }}
          accessibilityLabel="Edit entry"
          testID={`timesheet-edit-${entryId}`}
        >
          <IconSymbol name={'pencil' as never} size={20} color={colors.inverse} />
        </Pressable>
        <Pressable
          style={[s.swipeBtn, { backgroundColor: colors.danger, borderRadius: radius.sm }]}
          onPress={() => { methods.close(); onDelete(); }}
          accessibilityLabel="Delete entry"
          testID={`timesheet-delete-${entryId}`}
        >
          <IconSymbol name={'trash' as never} size={20} color={colors.inverse} />
        </Pressable>
      </Animated.View>
    );
  }

  if (showRequestBtn) {
    return (
      <Animated.View style={[{ width: panelWidth }, animStyle]}>
        <Pressable
          style={[s.swipeBtn, { backgroundColor: colors.infoBg, borderRadius: radius.sm }]}
          onPress={() => { methods.close(); onRequestEdit(); }}
          accessibilityLabel="Request edit"
          testID={`timesheet-request-edit-${entryId}`}
        >
          <IconSymbol name={'square.and.pencil' as never} size={20} color={colors.infoText} />
        </Pressable>
      </Animated.View>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// SheetHeader — reusable Cancel / Title / Save row
// ---------------------------------------------------------------------------

function SheetHeader({
  title,
  onCancel,
  onSave,
  saveLabel = 'Save',
  saveVariant = 'primary',
  saving = false,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveVariant?: 'primary' | 'danger';
  saving?: boolean;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ minHeight: 44, justifyContent: 'center', marginBottom: spacing.sm }}>
      {/* Title is centered on the full width so it stays optically centered
          regardless of the differing Cancel / Save button widths. */}
      <Text variant="headline" weight="600" style={{ textAlign: 'center' }}>{title}</Text>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <Button variant="ghost" size="sm" label="Cancel" onPress={onCancel} />
        <Button variant={saveVariant} size="sm" label={saveLabel} onPress={onSave} loading={saving} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TimesheetsScreen() {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, spacing, radius } = useTheme();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(todayStr));

  const [tsData, setTsData] = useState<TimesheetsResponse | null>(null);
  const [clockInJobs, setClockInJobs] = useState<ClockInJobsResponse['jobs']>([]);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editRequests, setEditRequests] = useState<TimesheetEditRequest[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const { refresh: refreshAppState, isClockedIn } = useAppState();

  // Clock-out sheet (renamed from showClockOutNote)
  const [clockOutSheetOpen, setClockOutSheetOpen] = useState(false);
  const [clockOutNote, setClockOutNote] = useState('');

  // Job picker sheet (clock-in idle state)
  const [jobPickerOpen, setJobPickerOpen] = useState(false);

  // Admin edit entry sheet
  const [editEntry, setEditEntry] = useState<TimesheetEntry | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editHoursError, setEditHoursError] = useState<string | undefined>(undefined);
  const [editNote, setEditNote] = useState('');
  const [editJobId, setEditJobId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Employee request-edit sheet
  const [requestEditEntry, setRequestEditEntry] = useState<TimesheetEntry | null>(null);
  const [reqHours, setReqHours] = useState('');
  const [reqHoursError, setReqHoursError] = useState<string | undefined>(undefined);
  const [reqNote, setReqNote] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqReasonError, setReqReasonError] = useState<string | undefined>(undefined);
  const [reqSaving, setReqSaving] = useState(false);

  const canClock = hasPermission(user, 'time.clock');
  const canViewJobs = hasPermission(user, 'jobs.view');
  const canManage = isManagerOrAdmin(user);
  const canApprove = hasPermission(user, 'time.approve');
  const canRequestEdits = hasPermission(user, 'time.edit_requests');

  const isCurrentWeek = weekAnchor === getWeekStart(todayStr);
  const isViewingOwnSheet = !selectedEmployeeId;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [ts, jobsRes, clockJobsRes, empRes, editReqRes] = await Promise.all([
        api.getTimesheets(selectedEmployeeId ? { employeeId: selectedEmployeeId, start: weekAnchor } : { start: weekAnchor }),
        canViewJobs ? api.getJobs().catch(() => null) : Promise.resolve(null),
        !canViewJobs && canClock ? api.getClockInJobs().catch(() => null) : Promise.resolve(null),
        canManage ? api.getEmployees().catch(() => null) : Promise.resolve(null),
        canApprove ? api.getTimesheetEditRequests().catch(() => null) : Promise.resolve(null),
      ]);
      setTsData(ts);
      if (jobsRes?.jobs) setJobs(jobsRes.jobs);
      if (clockJobsRes?.jobs) setClockInJobs(clockJobsRes.jobs);
      if (empRes?.employees) setEmployees(empRes.employees.filter(e => e.active));
      if (editReqRes?.requests) setEditRequests(editReqRes.requests);
    } catch { /* ignore */ }
    finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, [api, canClock, canViewJobs, canManage, canApprove, selectedEmployeeId, weekAnchor]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const entry = tsData?.activeClockEntry;
    if (!entry?.clockInAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(entry.clockInAt!).getTime()) / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [tsData?.activeClockEntry]);

  // -------------------------------------------------------------------------
  // Clock success haptic — fires ONLY on a real post-load clock-state change.
  // Guards:
  //   1. clockSyncReady: set only after the screen's initial loading=false.
  //      Prevents buzzing during the post-mount AppStateContext false→true sync
  //      transition (Pitfall 8 + 06-RESEARCH mount-guard pattern).
  //   2. prevClockedIn ref: tracks the last seen value to detect real changes.
  // DO NOT move this logic into handleClockIn/confirmClockOut (D-06).
  // -------------------------------------------------------------------------
  const prevClockedIn = useRef(isClockedIn);
  const clockSyncReady = useRef(false);

  useEffect(() => {
    if (!clockSyncReady.current) {
      // Keep prevClockedIn in sync while not ready; mark ready once loading clears.
      prevClockedIn.current = isClockedIn;
      if (!loading) {
        clockSyncReady.current = true;
      }
      return;
    }
    if (prevClockedIn.current !== isClockedIn) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      prevClockedIn.current = isClockedIn;
    }
  }, [isClockedIn, loading]);

  // Wire up the + Add Entry header button
  useEffect(() => {
    if (!canManage) return;
    navigation.setOptions({
      headerRight: () => (
        <HeaderIconButton
          name={'plus' as never}
          color={colors.navy}
          onPress={() => router.push('/timesheets/manual')}
          accessibilityLabel="Add Time Entry"
          testID="timesheets-add-entry-button"
        />
      ),
    });
  }, [canManage, navigation, router, colors.navy]);

  // -------------------------------------------------------------------------
  // PROTECTED ZONE — DO NOT EDIT (handleClockIn GPS block)
  // -------------------------------------------------------------------------
  const handleClockIn = async () => {
    if (!selectedJobId) { Alert.alert('Required', 'Select a job before clocking in.'); return; }
    setClockLoading(true);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch { /* GPS is best-effort */ }
    try {
      const online = await isOnline();
      if (!online) {
        await enqueueClockIn({ jobId: selectedJobId, lat, lng });
        Alert.alert('Queued', "You're offline. Your clock-in will sync when you reconnect.");
        return;
      }
      await api.clockIn({ jobId: selectedJobId, lat: lat ?? undefined, lng: lng ?? undefined });
      await load();
      refreshAppState();
      Alert.alert('Clocked In', 'Your time entry has started.');
    } catch (e) { Alert.alert('Clock In', e instanceof Error ? e.message : 'Failed'); }
    finally { setClockLoading(false); }
  };
  // -------------------------------------------------------------------------
  // END PROTECTED ZONE
  // -------------------------------------------------------------------------

  const handleClockOut = () => setClockOutSheetOpen(true);

  // -------------------------------------------------------------------------
  // PROTECTED ZONE — DO NOT EDIT (confirmClockOut body)
  // -------------------------------------------------------------------------
  const confirmClockOut = async () => {
    setClockOutSheetOpen(false);
    setClockLoading(true);
    const note = clockOutNote.trim() || null;
    try {
      const online = await isOnline();
      if (!online) {
        await enqueueClockOut(note);
        setClockOutNote('');
        Alert.alert('Queued', "You're offline. Your clock-out will sync when you reconnect.");
        return;
      }
      const res = await api.clockOut(note ?? undefined);
      setClockOutNote('');
      await load();
      refreshAppState();
      Alert.alert('Clocked Out', `Saved ${formatHours(res.entry?.hours)}.`);
    } catch (e) { Alert.alert('Clock Out', e instanceof Error ? e.message : 'Failed'); }
    finally { setClockLoading(false); }
  };
  // -------------------------------------------------------------------------
  // END PROTECTED ZONE
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // PROTECTED ZONE — DO NOT EDIT (useOfflineQueueFlusher wiring)
  // -------------------------------------------------------------------------
  useOfflineQueueFlusher({
    clockIn: (args) => api.clockIn(args),
    clockOut: (note) => api.clockOut(note),
    onFlushed: (count) => {
      void load();
      refreshAppState();
      Alert.alert('Synced', `${count} queued action${count > 1 ? 's' : ''} synced successfully.`);
    },
  });
  // -------------------------------------------------------------------------
  // END PROTECTED ZONE
  // -------------------------------------------------------------------------

  const openAdminEdit = (entry: TimesheetEntry) => {
    setEditEntry(entry);
    setEditHours(String(entry.hours));
    setEditHoursError(undefined);
    setEditNote(entry.note ?? '');
    setEditJobId(null);
  };

  const confirmAdminEdit = async () => {
    if (!editEntry) return;
    const hoursError = validateHours(editHours);
    setEditHoursError(hoursError);
    if (hoursError) return;
    const hours = parseFloat(editHours);
    setEditSaving(true);
    try {
      await api.editTimeEntry(editEntry.id, {
        hours,
        note: editNote.trim() || null,
        jobId: editJobId ?? undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditEntry(null);
      await load();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
    finally { setEditSaving(false); }
  };

  const openRequestEdit = (entry: TimesheetEntry) => {
    setRequestEditEntry(entry);
    setReqHours(String(entry.hours));
    setReqHoursError(undefined);
    setReqNote(entry.note ?? '');
    setReqReason('');
    setReqReasonError(undefined);
  };

  // Manager-only delete handler — mirrors jobs/[id].tsx handleDeleteTimeEntry pattern.
  // Server gates DELETE /api/timesheets/:id behind requireManagerOrAdmin.
  const handleDeleteTimeEntry = (entryId: number) => {
    Alert.alert('Delete Entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTimeEntry(entryId);
            // Optimistically drop the row so the slide-out animates THIS commit (D-10).
            // load() with no args sets loading=true and swaps the whole screen to the
            // full-screen skeleton, so configureNext would animate content→skeleton, not
            // the row removal. Reconcile silently via refresh mode.
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setTsData((prev) =>
              prev ? { ...prev, timesheets: (prev.timesheets ?? []).filter((e) => e.id !== entryId) } : prev,
            );
            void load(true);
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
          }
        },
      },
    ]);
  };

  const confirmRequestEdit = async () => {
    if (!requestEditEntry) return;
    const hoursError = validateHours(reqHours);
    const reasonError = validateRequired(reqReason, 'Reason');
    setReqHoursError(hoursError);
    setReqReasonError(reasonError);
    if (hoursError || reasonError) return;
    const hours = parseFloat(reqHours);
    setReqSaving(true);
    try {
      await api.requestTimesheetEdit(requestEditEntry.id, {
        proposedHours: hours,
        reason: reqReason.trim(),
        proposedNote: reqNote.trim() || undefined,
      });
      setRequestEditEntry(null);
      await load();
      Alert.alert('Submitted', 'Your edit request has been sent for approval.');
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setReqSaving(false); }
  };

  const handleApproveWeek = async () => {
    const empId = tsData?.scope?.employeeId;
    if (!empId) return;
    const empName = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId)?.name ?? 'employee' : 'yourself';
    Alert.alert('Approve Week', `Approve this week for ${empName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setApproveLoading(true);
        try {
          await api.approveWeek(empId, weekAnchor);
          await load();
          refreshAppState();
          Alert.alert('Approved', 'Week has been approved.');
        } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        finally { setApproveLoading(false); }
      }},
    ]);
  };

  const handleReopenWeek = async () => {
    const empId = tsData?.scope?.employeeId;
    if (!empId) return;
    const empName = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId)?.name ?? 'employee' : 'yourself';
    Alert.alert('Reopen Week', `Reopen this week for ${empName}? They will be able to request edits again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reopen', onPress: async () => {
        setApproveLoading(true);
        try {
          await api.reopenWeek(empId, weekAnchor);
          await load();
          Alert.alert('Reopened', 'Week has been reopened for edits.');
        } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        finally { setApproveLoading(false); }
      }},
    ]);
  };

  const handleApproveEditRequest = (req: TimesheetEditRequest) => {
    Alert.alert(
      'Approve Edit',
      `Approve ${req.employeeName}'s request to change ${formatDate(req.currentDate)} from ${formatHours(req.currentHours)} to ${formatHours(req.proposedHours)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: async () => {
          try {
            await api.approveEditRequest(req.id);
            await load();
            refreshAppState();
          } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        }},
      ]
    );
  };

  const handleRejectEditRequest = (req: TimesheetEditRequest) => {
    Alert.alert(
      'Reject Edit',
      `Reject ${req.employeeName}'s edit request for ${formatDate(req.currentDate)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => {
          try {
            await api.rejectEditRequest(req.id);
            await load();
            refreshAppState();
          } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
        }},
      ]
    );
  };

  const allJobs = canViewJobs ? jobs : (clockInJobs ?? []);
  const activeEntry = tsData?.activeClockEntry;
  const selectedJob = allJobs.find(j => j.id === selectedJobId) ?? null;

  const weekEntries = (tsData?.timesheets ?? []).filter(e => {
    const weekEnd = addDays(weekAnchor, 6);
    return e.date >= weekAnchor && e.date <= weekEnd;
  });

  const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
  const weekApproved = tsData?.summary?.weekApproved;
  const approvedByName = tsData?.summary?.approvedByName;

  if (loading) {
    return (
      <Screen headerMode="native" testID="timesheets-skeleton">
        <View style={{ padding: spacing.md, gap: 10 }}>
          <SkeletonBlock width="100%" height={100} borderRadius={radius.md} />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Screen>
    );
  }

  return (
    <Screen headerMode="native" padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingTop: spacing.sm }}
        contentInsetAdjustmentBehavior="automatic"
        onScrollBeginDrag={closeOpenSwipeRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void load(true); }} />}
      >

        {/* Pending edit requests (manager / canApprove) */}
        {canApprove && editRequests.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader
              title="Pending Edit Requests"
              action={
                <Badge tone="warning" label={String(editRequests.length)} />
              }
            />
            {editRequests.map(req => (
              <Card key={req.id} elevation="sm" padding="md" radius="lg">
                <View style={{
                  backgroundColor: colors.warningBg,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.warningBorder,
                  gap: spacing.sm,
                }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="headline" weight="600">{req.employeeName}</Text>
                      <Text variant="caption" tone="muted">
                        {formatDate(req.currentDate)}{req.jobName ? ` · ${req.jobName}` : ''}
                      </Text>
                      <RNText style={{ fontSize: 13, color: colors.muted }}>
                        {formatHours(req.currentHours)}
                        {' → '}
                        <RNText style={{ color: colors.navy, fontWeight: '800' }}>
                          {formatHours(req.proposedHours)}
                        </RNText>
                      </RNText>
                      <Text variant="caption" tone="muted">&quot;{req.reason}&quot;</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <Pressable
                        style={{
                          paddingHorizontal: 10, paddingVertical: 6,
                          borderRadius: radius.sm, backgroundColor: colors.success,
                          alignItems: 'center',
                        }}
                        onPress={() => handleApproveEditRequest(req)}
                      >
                        <RNText style={{ fontSize: 11, fontWeight: '800', color: colors.inverse }}>
                          Approve
                        </RNText>
                      </Pressable>
                      <Pressable
                        style={{
                          paddingHorizontal: 10, paddingVertical: 6,
                          borderRadius: radius.sm, backgroundColor: colors.bg,
                          borderWidth: 1, borderColor: colors.danger,
                          alignItems: 'center',
                        }}
                        onPress={() => handleRejectEditRequest(req)}
                      >
                        <RNText style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>
                          Reject
                        </RNText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Employee picker (manager — view-scope switcher, stays as chip row) */}
        {canManage && employees.length > 0 && (
          <Card elevation="sm" padding="md" radius="lg">
            <Text variant="footnote" tone="muted">Viewing</Text>
            {/* Relative wrapper so the right-edge fade can hint "more employees ↦" */}
            <View style={{ position: 'relative' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, flexDirection: 'row', paddingVertical: 2, paddingRight: spacing.lg }}
              >
                <Pressable
                  style={[s.chip, {
                    paddingVertical: 6, paddingHorizontal: 14,
                    borderRadius: radius.pill, borderWidth: 1, minHeight: 44,
                    justifyContent: 'center', alignItems: 'center',
                  },
                  !selectedEmployeeId
                    ? { backgroundColor: colors.navySurface, borderColor: colors.navySurface }
                    : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedEmployeeId(null)}
                >
                  <RNText
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: '600',
                      color: !selectedEmployeeId ? colors.inverse : colors.muted }}
                  >
                    My Sheet
                  </RNText>
                </Pressable>
                {employees.map(emp => (
                  <Pressable
                    key={emp.id}
                    style={[s.chip, {
                      paddingVertical: 6, paddingHorizontal: 14,
                      borderRadius: radius.pill, borderWidth: 1, minHeight: 44,
                      justifyContent: 'center', alignItems: 'center',
                    },
                    selectedEmployeeId === emp.id
                      ? { backgroundColor: colors.navySurface, borderColor: colors.navySurface }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedEmployeeId(emp.id)}
                  >
                    <RNText
                      numberOfLines={1}
                      style={{ fontSize: 13, fontWeight: '600',
                        color: selectedEmployeeId === emp.id ? colors.inverse : colors.muted }}
                    >
                      {shortEmployeeName(emp.name)}
                    </RNText>
                  </Pressable>
                ))}
              </ScrollView>
              {/* Peek/fade affordance — pinned to the right edge, fades into the card */}
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', colors.card]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.scrollFade}
              />
            </View>
          </Card>
        )}

        {/* Clock in/out — only when viewing own sheet */}
        {canClock && isViewingOwnSheet && (
          <Card elevation="sm" padding="md" radius="lg">
            {activeEntry ? (
              // Active state
              <View style={{ gap: spacing.sm }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text variant="headline" weight="600">{activeEntry.jobName ?? 'No Job'}</Text>
                  <RNText style={{
                    fontSize: 30, fontWeight: '700', letterSpacing: -0.5,
                    color: colors.yellow,
                  }}>
                    {formatDuration(elapsed)}
                  </RNText>
                </View>
                <Button
                  variant="danger"
                  size="lg"
                  fullWidth
                  label="Clock Out"
                  onPress={handleClockOut}
                  loading={clockLoading}
                  testID="timesheets-clockout-button"
                />
              </View>
            ) : (
              // Idle state — job picker row + clock-in button
              <View style={{ gap: spacing.sm }}>
                <ListRow
                  title={selectedJob ? selectedJob.jobName ?? 'Unknown Job' : 'Select a Job'}
                  subtitle={selectedJob ? undefined : 'Tap to select'}
                  trailing="chevron"
                  onPress={() => setJobPickerOpen(true)}
                  testID="timesheets-job-picker"
                />
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  label="Clock In"
                  onPress={() => void handleClockIn()}
                  loading={clockLoading}
                  disabled={!selectedJobId}
                  testID="timesheets-clockin-button"
                />
              </View>
            )}
          </Card>
        )}

        {/* Week navigation */}
        <Card elevation="sm" padding="md" radius="md">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable style={{ padding: 8 }} onPress={() => setWeekAnchor(w => addDays(w, -7))}>
              <RNText style={{ fontSize: 24, fontWeight: '700', color: colors.navy }}>‹</RNText>
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text variant="footnote" weight="600">{formatWeekRange(weekAnchor)}</Text>
              {!isCurrentWeek && (
                <Pressable onPress={() => setWeekAnchor(getWeekStart(todayStr))}>
                  <Text variant="caption" tone="muted">Back to this week</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              style={{ padding: 8, opacity: isCurrentWeek ? 0.3 : 1 }}
              onPress={() => { if (!isCurrentWeek) setWeekAnchor(w => addDays(w, 7)); }}
            >
              <RNText style={{ fontSize: 24, fontWeight: '700', color: colors.navy }}>›</RNText>
            </Pressable>
          </View>
        </Card>

        {/* Summary row */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderRadius: radius.md, borderTopColor: colors.navySurface }]}>
            <Text variant="caption" tone="muted">HOURS</Text>
            <Text variant="title3" weight="700">{weekTotal.toFixed(2)}</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderRadius: radius.md, borderTopColor: colors.navySurface }]}>
            <Text variant="caption" tone="muted">ENTRIES</Text>
            <Text variant="title3" weight="700">{String(weekEntries.length)}</Text>
          </View>
          {weekApproved ? (
            <>
              <View style={[s.summaryCard, { backgroundColor: colors.card, borderRadius: radius.md, borderTopColor: colors.success }]}>
                <Text variant="caption" tone="muted">STATUS</Text>
                <RNText style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>Approved</RNText>
              </View>
              {canApprove && (
                <Pressable
                  style={[s.summaryCard, { backgroundColor: colors.card, borderRadius: radius.md, borderTopColor: colors.muted, justifyContent: 'center' }]}
                  onPress={() => void handleReopenWeek()}
                  disabled={approveLoading}
                >
                  {approveLoading
                    ? <ActivityIndicator size="small" color={colors.muted} />
                    : <RNText style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>Reopen</RNText>
                  }
                </Pressable>
              )}
            </>
          ) : canApprove && weekEntries.length > 0 ? (
            <Pressable
              style={({ pressed }) => [s.actionTile, {
                backgroundColor: colors.navySurface, borderRadius: radius.md,
                opacity: pressed ? 0.85 : 1,
              }]}
              onPress={() => void handleApproveWeek()}
              disabled={approveLoading}
              accessibilityRole="button"
              accessibilityLabel="Approve Week"
            >
              {approveLoading
                ? <ActivityIndicator size="small" color={colors.inverse} />
                : <RNText style={{ fontSize: 13, fontWeight: '700', color: colors.inverse }}>Approve Week</RNText>
              }
            </Pressable>
          ) : null}
        </View>

        {weekApproved && approvedByName && (
          <RNText style={{ textAlign: 'center', marginTop: -spacing.sm, fontSize: 12, color: colors.muted }}>
            Approved by {approvedByName}
          </RNText>
        )}

        {/* Empty state */}
        {weekEntries.length === 0 && (
          <EmptyState
            icon="clock"
            message="No hours logged this week."
            actionLabel="Log Time"
            onAction={() => router.push('/timesheets/manual')}
            testID="timesheets-empty-state"
          />
        )}

        {/* Entry rows — role-gated swipe-to-action via shared SwipeRow */}
        {weekEntries.map(entry => {
          const isPendingEdit = entry.approvalStatus === 'pending_edit';
          const showRequestBtn = !canManage && canRequestEdits && isViewingOwnSheet && !weekApproved && !isPendingEdit;

          return (
            <SwipeRow
              key={entry.id}
              testID={`timesheet-row-${entry.id}`}
              enabled={canManage || showRequestBtn}
              renderActions={(drag, methods) => (
                <TimeRowSwipeActions
                  drag={drag}
                  methods={methods}
                  isManager={canManage}
                  showRequestBtn={showRequestBtn}
                  entryId={entry.id}
                  onEdit={() => openAdminEdit(entry)}
                  onDelete={() => handleDeleteTimeEntry(entry.id)}
                  onRequestEdit={() => openRequestEdit(entry)}
                />
              )}
            >
              <Card elevation="sm" padding="md" radius="md">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="headline" weight="600">{entry.jobName ?? 'General Time'}</Text>
                    {canManage && !isViewingOwnSheet && (
                      <Text variant="caption" tone="muted">{entry.employeeName}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <RNText style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>
                      {formatHours(entry.hours)}
                    </RNText>
                    {isPendingEdit && !canManage && (
                      <Badge tone="warning" label="Pending" />
                    )}
                  </View>
                </View>
                <Text variant="caption" tone="muted">{formatDate(entry.date)}</Text>
                {entry.note ? (
                  <Text variant="caption" tone="muted">{entry.note}</Text>
                ) : null}
                {entry.approvalStatus && (
                  <Badge
                    tone={approvalTone(entry.approvalStatus)}
                    label={entry.approvalStatus === 'pending_edit'
                      ? 'Edit Pending'
                      : entry.approvalStatus.charAt(0).toUpperCase() + entry.approvalStatus.slice(1)
                    }
                  />
                )}
              </Card>
            </SwipeRow>
          );
        })}
      </ScrollView>

      {/* ================================================================
          Sheet siblings — NEVER inside ScrollView
          ================================================================ */}

      {/* Clock-out note sheet */}
      {clockOutSheetOpen && (
        <Sheet
          testID="timesheets-clockout-sheet"
          snapPoints={['40%', '70%']}
          scrollable
          onClose={() => setClockOutSheetOpen(false)}
          header={
            <SheetHeader
              title="Clock Out"
              onCancel={() => setClockOutSheetOpen(false)}
              onSave={() => void confirmClockOut()}
              saveLabel="Clock Out"
              saveVariant="danger"
            />
          }
        >
          <Text variant="subhead" tone="muted">Add an optional note for this shift</Text>
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
            <Input
              bottomSheet
              placeholder="e.g. Finished framing, started drywall"
              value={clockOutNote}
              onChangeText={setClockOutNote}
            />
          </View>
        </Sheet>
      )}

      {/* Job picker sheet (clock-in) */}
      {jobPickerOpen && (
        <Sheet
          snapPoints={['50%', '85%']}
          scrollable
          onClose={() => setJobPickerOpen(false)}
          header={
            <View style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text variant="headline" weight="600">Select Job</Text>
            </View>
          }
        >
          {allJobs.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <Text variant="subhead" tone="muted">No jobs available</Text>
            </View>
          )}
          {allJobs.map(j => (
            <ListRow
              key={j.id}
              title={j.jobName ?? 'Untitled'}
              trailing={selectedJobId === j.id ? 'custom' : 'none'}
              trailingCustom={selectedJobId === j.id
                ? <IconSymbol name={'checkmark' as never} size={18} color={colors.navy} />
                : undefined}
              onPress={() => { setSelectedJobId(j.id); setJobPickerOpen(false); }}
            />
          ))}
        </Sheet>
      )}

      {/* Admin edit-time sheet */}
      {!!editEntry && (
        <Sheet
          snapPoints={['70%', '92%']}
          scrollable
          onClose={() => setEditEntry(null)}
          header={
            <SheetHeader
              title="Edit Entry"
              onCancel={() => setEditEntry(null)}
              onSave={() => void confirmAdminEdit()}
              saving={editSaving}
            />
          }
        >
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="footnote" tone="muted">
              {editEntry.employeeName} · {formatDate(editEntry.date)}
            </Text>
            <Input
              bottomSheet
              label="Hours"
              placeholder="e.g. 8"
              value={editHours}
              onChangeText={(v) => { setEditHours(v); if (editHoursError) setEditHoursError(undefined); }}
              keyboardType="decimal-pad"
              error={editHoursError}
            />
            <Input
              bottomSheet
              label="Note (optional)"
              placeholder="Add a note..."
              value={editNote}
              onChangeText={setEditNote}
            />
            {allJobs.length > 0 && (
              <View style={{ gap: spacing.xs }}>
                <Text variant="footnote" tone="muted">Change Job (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.sm, flexDirection: 'row', paddingVertical: 2 }}>
                  <Pressable
                    style={[s.chip, {
                      paddingVertical: 6, paddingHorizontal: 14,
                      borderRadius: radius.pill, borderWidth: 1, minHeight: 44,
                      justifyContent: 'center', alignItems: 'center',
                      opacity: editJobId === null ? 0.5 : 1,
                      backgroundColor: colors.card, borderColor: colors.border,
                    }]}
                    onPress={() => setEditJobId(null)}
                  >
                    <RNText style={{ fontSize: 13, fontWeight: '600', color: colors.muted }}>
                      Keep same
                    </RNText>
                  </Pressable>
                  {allJobs.map(j => (
                    <Pressable
                      key={j.id}
                      style={[s.chip, {
                        paddingVertical: 6, paddingHorizontal: 14,
                        borderRadius: radius.pill, borderWidth: 1, minHeight: 44,
                        justifyContent: 'center', alignItems: 'center',
                      },
                      editJobId === j.id
                        ? { backgroundColor: colors.navySurface, borderColor: colors.navySurface }
                        : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      onPress={() => setEditJobId(j.id)}
                    >
                      <RNText style={{ fontSize: 13, fontWeight: '600',
                        color: editJobId === j.id ? colors.inverse : colors.muted }}>
                        {j.jobName}
                      </RNText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </Sheet>
      )}

      {/* Employee request-edit sheet */}
      {!!requestEditEntry && (
        <Sheet
          snapPoints={['70%', '92%']}
          scrollable
          onClose={() => setRequestEditEntry(null)}
          header={
            <SheetHeader
              title="Request Edit"
              onCancel={() => setRequestEditEntry(null)}
              onSave={() => void confirmRequestEdit()}
              saveLabel="Submit"
              saving={reqSaving}
            />
          }
        >
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="footnote" tone="muted">{formatDate(requestEditEntry.date)}</Text>
            <Input
              bottomSheet
              label="Proposed Hours"
              placeholder="e.g. 8"
              value={reqHours}
              onChangeText={(v) => { setReqHours(v); if (reqHoursError) setReqHoursError(undefined); }}
              keyboardType="decimal-pad"
              error={reqHoursError}
            />
            <Input
              bottomSheet
              label="Note (optional)"
              placeholder="Update the note..."
              value={reqNote}
              onChangeText={setReqNote}
            />
            <Input
              bottomSheet
              label="Reason for edit *"
              placeholder="e.g. Forgot to clock out, worked until 5 PM"
              value={reqReason}
              onChangeText={(v) => { setReqReason(v); if (reqReasonError) setReqReasonError(undefined); }}
              error={reqReasonError}
            />
          </View>
        </Sheet>
      )}

    </Screen>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet — static layout only (no raw colors/spacing)
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chip: {},
  scrollFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderTopWidth: 3,
    alignItems: 'center',
    gap: 4,
  },
  // Filled CTA tile — same footprint as summaryCard but solid fill + no
  // bordered-pill accent, so an action never reads as a read-only stat.
  actionTile: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeBtn: {
    width: SWIPE_BUTTON_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Per-route crash boundary — scopes a render error to this screen (Expo Router).
export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/AppErrorBoundary';
