import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { useApi } from '../../src/mobile/hooks/useApi';
import { useAppState } from '../../src/mobile/context/AppStateContext';
import { enqueueClockIn, enqueueClockOut, isOnline, useOfflineQueueFlusher } from '../../src/mobile/hooks/useOfflineQueue';
import { Colors, Radius, Spacing } from '../../src/mobile/theme';
import type { ClockInJobsResponse, Employee, JobListItem, TimesheetEditRequest, TimesheetsResponse, TimesheetEntry } from '../../src/mobile/types';
import { formatDate, formatDuration, formatHours, hasPermission, isManagerOrAdmin } from '../../src/mobile/utils';

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

function approvalBadgeStyle(status: string | null) {
  if (status === 'approved') return { bg: Colors.successBg, border: Colors.successBorder, text: Colors.success };
  if (status === 'rejected') return { bg: Colors.dangerBg, border: Colors.dangerBorder, text: Colors.danger };
  if (status === 'pending_edit') return { bg: Colors.warningBg, border: Colors.warningBorder, text: Colors.warning };
  return { bg: Colors.warningBg, border: Colors.warningBorder, text: Colors.warning };
}

export default function TimesheetsScreen() {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();

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

  const { refresh: refreshAppState } = useAppState();

  const [showClockOutNote, setShowClockOutNote] = useState(false);
  const [clockOutNote, setClockOutNote] = useState('');

  // Admin edit entry modal
  const [editEntry, setEditEntry] = useState<TimesheetEntry | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editJobId, setEditJobId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Employee request-edit modal
  const [requestEditEntry, setRequestEditEntry] = useState<TimesheetEntry | null>(null);
  const [reqHours, setReqHours] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqSaving, setReqSaving] = useState(false);

  const canClock = hasPermission(user, 'time.clock');
  const canViewJobs = hasPermission(user, 'jobs.view');
  const canManage = isManagerOrAdmin(user);
  const canApprove = hasPermission(user, 'time.approve');
  const canRequestEdits = hasPermission(user, 'time.edit_requests');

  const isCurrentWeek = weekAnchor === getWeekStart(todayStr);
  const isViewingOwnSheet = !selectedEmployeeId;

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
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
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
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

  const handleClockOut = () => setShowClockOutNote(true);

  const confirmClockOut = async () => {
    setShowClockOutNote(false);
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

  useOfflineQueueFlusher({
    clockIn: (args) => api.clockIn(args),
    clockOut: (note) => api.clockOut(note),
    onFlushed: (count) => {
      void load();
      refreshAppState();
      Alert.alert('Synced', `${count} queued action${count > 1 ? 's' : ''} synced successfully.`);
    },
  });

  const openAdminEdit = (entry: TimesheetEntry) => {
    setEditEntry(entry);
    setEditHours(String(entry.hours));
    setEditNote(entry.note ?? '');
    setEditJobId(null);
  };

  const confirmAdminEdit = async () => {
    if (!editEntry) return;
    const hours = parseFloat(editHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Invalid', 'Enter a valid number of hours (0–24).');
      return;
    }
    setEditSaving(true);
    try {
      await api.editTimeEntry(editEntry.id, {
        hours,
        note: editNote.trim() || null,
        jobId: editJobId ?? undefined,
      });
      setEditEntry(null);
      await load();
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed'); }
    finally { setEditSaving(false); }
  };

  const openRequestEdit = (entry: TimesheetEntry) => {
    setRequestEditEntry(entry);
    setReqHours(String(entry.hours));
    setReqNote(entry.note ?? '');
    setReqReason('');
  };

  const confirmRequestEdit = async () => {
    if (!requestEditEntry) return;
    const hours = parseFloat(reqHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Invalid', 'Enter a valid number of hours (0–24).');
      return;
    }
    if (!reqReason.trim()) {
      Alert.alert('Required', 'Please explain why this edit is needed.');
      return;
    }
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

  const weekEntries = (tsData?.timesheets ?? []).filter(e => {
    const weekEnd = addDays(weekAnchor, 6);
    return e.date >= weekAnchor && e.date <= weekEnd;
  });

  const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
  const weekApproved = tsData?.summary?.weekApproved;
  const approvedByName = tsData?.summary?.approvedByName;

  if (loading) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={Colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>

      {/* Clock-out note modal */}
      <Modal visible={showClockOutNote} transparent animationType="fade" onRequestClose={() => setShowClockOutNote(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Clock Out</Text>
            <Text style={s.modalSub}>Add an optional note for this shift</Text>
            <TextInput
              style={s.modalInput}
              value={clockOutNote}
              onChangeText={setClockOutNote}
              placeholder="e.g. Finished framing, started drywall"
              placeholderTextColor={Colors.mutedLight}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[s.modalBtn, { flex: 1, backgroundColor: Colors.danger }]} onPress={() => void confirmClockOut()}>
                <Text style={s.modalBtnText}>Clock Out</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, { flex: 1, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border }]} onPress={() => setShowClockOutNote(false)}>
                <Text style={[s.modalBtnText, { color: Colors.muted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin: Edit entry modal */}
      <Modal visible={!!editEntry} transparent animationType="fade" onRequestClose={() => setEditEntry(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Entry</Text>
            <Text style={s.modalSub}>{editEntry ? `${editEntry.employeeName} · ${formatDate(editEntry.date)}` : ''}</Text>
            <View>
              <Text style={s.fieldLabel}>Hours</Text>
              <TextInput
                style={s.modalInputSingle}
                value={editHours}
                onChangeText={setEditHours}
                placeholder="e.g. 8"
                placeholderTextColor={Colors.mutedLight}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            <View>
              <Text style={s.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={s.modalInput}
                value={editNote}
                onChangeText={setEditNote}
                placeholder="Add a note..."
                placeholderTextColor={Colors.mutedLight}
                multiline
              />
            </View>
            {allJobs.length > 0 && (
              <View>
                <Text style={s.fieldLabel}>Change Job (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
                    <Pressable
                      style={[s.jobPill, editJobId === null && s.jobPillDim]}
                      onPress={() => setEditJobId(null)}
                    >
                      <Text style={[s.jobPillText, editJobId === null && s.jobPillTextDim]}>Keep same</Text>
                    </Pressable>
                    {allJobs.map(j => (
                      <Pressable
                        key={j.id}
                        style={[s.jobPill, editJobId === j.id && s.jobPillActive]}
                        onPress={() => setEditJobId(j.id)}
                      >
                        <Text style={[s.jobPillText, editJobId === j.id && s.jobPillTextActive]}>{j.jobName}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[s.modalBtn, { flex: 1, backgroundColor: Colors.navy }]} onPress={() => void confirmAdminEdit()} disabled={editSaving}>
                {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnText}>Save</Text>}
              </Pressable>
              <Pressable style={[s.modalBtn, { flex: 1, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border }]} onPress={() => setEditEntry(null)}>
                <Text style={[s.modalBtnText, { color: Colors.muted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Employee: Request edit modal */}
      <Modal visible={!!requestEditEntry} transparent animationType="fade" onRequestClose={() => setRequestEditEntry(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Request Edit</Text>
            <Text style={s.modalSub}>{requestEditEntry ? formatDate(requestEditEntry.date) : ''}</Text>
            <View>
              <Text style={s.fieldLabel}>Proposed Hours</Text>
              <TextInput
                style={s.modalInputSingle}
                value={reqHours}
                onChangeText={setReqHours}
                placeholder="e.g. 8"
                placeholderTextColor={Colors.mutedLight}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            <View>
              <Text style={s.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={s.modalInput}
                value={reqNote}
                onChangeText={setReqNote}
                placeholder="Update the note..."
                placeholderTextColor={Colors.mutedLight}
                multiline
              />
            </View>
            <View>
              <Text style={s.fieldLabel}>Reason for edit <Text style={{ color: Colors.danger }}>*</Text></Text>
              <TextInput
                style={s.modalInput}
                value={reqReason}
                onChangeText={setReqReason}
                placeholder="e.g. Forgot to clock out, worked until 5 PM"
                placeholderTextColor={Colors.mutedLight}
                multiline
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[s.modalBtn, { flex: 1, backgroundColor: Colors.navy }]} onPress={() => void confirmRequestEdit()} disabled={reqSaving}>
                {reqSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnText}>Submit</Text>}
              </Pressable>
              <Pressable style={[s.modalBtn, { flex: 1, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border }]} onPress={() => setRequestEditEntry(null)}>
                <Text style={[s.modalBtnText, { color: Colors.muted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={s.topBar}>
          <Text style={s.title}>Timesheets</Text>
          {canManage && (
            <Pressable style={s.addBtn} onPress={() => router.push('/timesheets/manual')}>
              <Text style={s.addBtnText}>+ Add Entry</Text>
            </Pressable>
          )}
        </View>

        {/* Pending edit requests (admin) */}
        {canApprove && editRequests.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              Pending Edit Requests
              <Text style={{ color: Colors.warning }}> {editRequests.length}</Text>
            </Text>
            {editRequests.map(req => (
              <View key={req.id} style={s.editReqCard}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.editReqName}>{req.employeeName}</Text>
                  <Text style={s.editReqDate}>{formatDate(req.currentDate)}{req.jobName ? ` · ${req.jobName}` : ''}</Text>
                  <Text style={s.editReqHours}>
                    {formatHours(req.currentHours)} → <Text style={{ color: Colors.navy, fontWeight: '800' }}>{formatHours(req.proposedHours)}</Text>
                  </Text>
                  <Text style={s.editReqReason}>"{req.reason}"</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Pressable style={s.approveBtn} onPress={() => handleApproveEditRequest(req)}>
                    <Text style={s.approveBtnText}>Approve</Text>
                  </Pressable>
                  <Pressable style={s.rejectBtn} onPress={() => handleRejectEditRequest(req)}>
                    <Text style={s.rejectBtnText}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Employee picker for managers */}
        {canManage && employees.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Viewing</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                <Pressable
                  style={[s.jobPill, !selectedEmployeeId && s.jobPillActive]}
                  onPress={() => setSelectedEmployeeId(null)}
                >
                  <Text style={[s.jobPillText, !selectedEmployeeId && s.jobPillTextActive]}>My Sheet</Text>
                </Pressable>
                {employees.map(emp => (
                  <Pressable
                    key={emp.id}
                    style={[s.jobPill, selectedEmployeeId === emp.id && s.jobPillActive]}
                    onPress={() => setSelectedEmployeeId(emp.id)}
                  >
                    <Text style={[s.jobPillText, selectedEmployeeId === emp.id && s.jobPillTextActive]}>
                      {emp.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Clock in/out — only when viewing own sheet */}
        {canClock && isViewingOwnSheet && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Clock In / Out</Text>
            {activeEntry ? (
              <>
                <View style={s.activeEntryInfo}>
                  <Text style={s.activeJobName}>{activeEntry.jobName ?? 'No Job'}</Text>
                  <Text style={s.activeTimer}>{formatDuration(elapsed)}</Text>
                </View>
                <Pressable style={s.clockOutBtn} onPress={handleClockOut} disabled={clockLoading}>
                  {clockLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.clockOutBtnText}>Clock Out</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>Select Job</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                    {allJobs.map(j => (
                      <Pressable
                        key={j.id}
                        style={[s.jobPill, selectedJobId === j.id && s.jobPillActive]}
                        onPress={() => setSelectedJobId(j.id)}
                      >
                        <Text style={[s.jobPillText, selectedJobId === j.id && s.jobPillTextActive]}>
                          {j.jobName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <Pressable style={[s.clockInBtn, !selectedJobId && s.btnDisabled]} onPress={() => void handleClockIn()} disabled={clockLoading || !selectedJobId}>
                  {clockLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.clockInBtnText}>Clock In</Text>}
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Week navigation */}
        <View style={s.weekNav}>
          <Pressable style={s.weekNavBtn} onPress={() => setWeekAnchor(w => addDays(w, -7))}>
            <Text style={s.weekNavArrow}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.weekLabel}>{formatWeekRange(weekAnchor)}</Text>
            {!isCurrentWeek && (
              <Pressable onPress={() => setWeekAnchor(getWeekStart(todayStr))}>
                <Text style={s.weekTodayLink}>Back to this week</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={[s.weekNavBtn, isCurrentWeek && s.weekNavBtnDisabled]} onPress={() => {
            if (!isCurrentWeek) setWeekAnchor(w => addDays(w, 7));
          }}>
            <Text style={[s.weekNavArrow, isCurrentWeek && { color: Colors.border }]}>›</Text>
          </Pressable>
        </View>

        {/* Summary row */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Hours</Text>
            <Text style={s.summaryValue}>{weekTotal.toFixed(2)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Entries</Text>
            <Text style={s.summaryValue}>{weekEntries.length}</Text>
          </View>
          {weekApproved ? (
            <>
              <View style={[s.summaryCard, { borderTopColor: Colors.success }]}>
                <Text style={s.summaryLabel}>Status</Text>
                <Text style={[s.summaryValue, { fontSize: 13, color: Colors.success }]}>Approved</Text>
              </View>
              {canApprove && (
                <Pressable
                  style={[s.summaryCard, { borderTopColor: Colors.muted, justifyContent: 'center' }]}
                  onPress={() => void handleReopenWeek()}
                  disabled={approveLoading}
                >
                  {approveLoading
                    ? <ActivityIndicator size="small" color={Colors.muted} />
                    : <Text style={[s.summaryValue, { fontSize: 11, color: Colors.muted }]}>Reopen</Text>
                  }
                </Pressable>
              )}
            </>
          ) : canApprove && weekEntries.length > 0 ? (
            <Pressable
              style={[s.summaryCard, { borderTopColor: Colors.navy, justifyContent: 'center' }]}
              onPress={() => void handleApproveWeek()}
              disabled={approveLoading}
            >
              {approveLoading
                ? <ActivityIndicator size="small" color={Colors.navy} />
                : <Text style={[s.summaryValue, { fontSize: 12, color: Colors.navy }]}>Approve Week</Text>
              }
            </Pressable>
          ) : null}
        </View>

        {weekApproved && approvedByName && (
          <Text style={s.approvedHint}>Approved by {approvedByName}</Text>
        )}

        {weekEntries.length === 0 && <Text style={s.empty}>No entries for this week.</Text>}
        {weekEntries.map(entry => {
          const badge = approvalBadgeStyle(entry.approvalStatus);
          const isPendingEdit = entry.approvalStatus === 'pending_edit';
          const showRequestBtn = !canManage && canRequestEdits && isViewingOwnSheet && !weekApproved && !isPendingEdit;
          const showAdminEdit = canManage;

          return (
            <View key={entry.id} style={s.entryCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.entryJob}>{entry.jobName ?? 'General Time'}</Text>
                  {canManage && !isViewingOwnSheet && (
                    <Text style={s.entryEmployee}>{entry.employeeName}</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.entryHours}>{formatHours(entry.hours)}</Text>
                  {showAdminEdit && (
                    <Pressable onPress={() => openAdminEdit(entry)} style={s.editBtn}>
                      <Text style={s.editBtnText}>Edit</Text>
                    </Pressable>
                  )}
                  {showRequestBtn && (
                    <Pressable onPress={() => openRequestEdit(entry)} style={s.requestBtn}>
                      <Text style={s.requestBtnText}>Request Edit</Text>
                    </Pressable>
                  )}
                  {isPendingEdit && !canManage && (
                    <View style={s.pendingBadge}>
                      <Text style={s.pendingBadgeText}>Pending</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={s.entryDate}>{formatDate(entry.date)}</Text>
              {entry.note ? <Text style={s.entryNote}>{entry.note}</Text> : null}
              {entry.approvalStatus && (
                <View style={[s.approvalBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <Text style={[s.approvalBadgeText, { color: badge.text }]}>
                    {entry.approvalStatus === 'pending_edit' ? 'Edit Pending' : entry.approvalStatus.charAt(0).toUpperCase() + entry.approvalStatus.slice(1)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: Colors.text },
  addBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  activeEntryInfo: { alignItems: 'center', gap: 4 },
  activeJobName: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  activeTimer: { fontSize: 30, fontWeight: '900', color: Colors.yellow, letterSpacing: -0.5 },
  clockOutBtn: { backgroundColor: Colors.danger, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  clockOutBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.muted, marginBottom: 6 },
  jobPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  jobPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  jobPillDim: { backgroundColor: Colors.bg, borderColor: Colors.border, opacity: 0.5 },
  jobPillText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  jobPillTextActive: { color: '#fff' },
  jobPillTextDim: { color: Colors.muted },
  clockInBtn: { backgroundColor: Colors.navy, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  clockInBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: Colors.border },
  weekNavBtn: { padding: 8 },
  weekNavBtnDisabled: { opacity: 0.3 },
  weekNavArrow: { fontSize: 24, fontWeight: '700', color: Colors.navy },
  weekLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  weekTodayLink: { fontSize: 11, color: Colors.infoText, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, borderTopColor: Colors.navy, alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase' },
  summaryValue: { fontSize: 20, fontWeight: '900', color: Colors.text, marginTop: 4 },
  approvedHint: { textAlign: 'center', fontSize: 12, color: Colors.success, marginTop: -6 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: 8 },
  entryCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  entryJob: { fontSize: 14, fontWeight: '700', color: Colors.text },
  entryEmployee: { fontSize: 12, color: Colors.navy, fontWeight: '600', marginTop: 1 },
  entryHours: { fontSize: 14, fontWeight: '700', color: Colors.navy },
  entryDate: { fontSize: 12, color: Colors.muted },
  entryNote: { fontSize: 12, color: Colors.muted, fontStyle: 'italic' },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  editBtnText: { fontSize: 11, fontWeight: '700', color: Colors.muted },
  requestBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.infoBorder, backgroundColor: Colors.infoBg },
  requestBtnText: { fontSize: 11, fontWeight: '700', color: Colors.infoText },
  pendingBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: Colors.warningBg, borderWidth: 1, borderColor: Colors.warningBorder },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  approvalBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1, marginTop: 2 },
  approvalBadgeText: { fontSize: 10, fontWeight: '800' },
  editReqCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.warningBorder },
  editReqName: { fontSize: 13, fontWeight: '800', color: Colors.text },
  editReqDate: { fontSize: 12, color: Colors.muted },
  editReqHours: { fontSize: 13, color: Colors.muted },
  editReqReason: { fontSize: 12, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  approveBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: Colors.success, alignItems: 'center' },
  approveBtnText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  rejectBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.danger, alignItems: 'center' },
  rejectBtnText: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modalCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 20, gap: 14 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.muted, marginTop: -8 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg, minHeight: 80, textAlignVertical: 'top' },
  modalInputSingle: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg },
  modalBtn: { borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
