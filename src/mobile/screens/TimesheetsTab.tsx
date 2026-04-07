import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { styles } from '../styles';
import {
    ClockInJobOption,
    JobListItem,
    TimesheetEntry,
    TimesheetsResponse,
} from '../types';
import {
    formatDate,
    formatDateTime,
    formatDuration,
    formatHours,
} from '../utils';

type Props = {
  canViewJobs: boolean;
  isEmployeeClockOnly: boolean;
  canClockTime: boolean;
  jobs: JobListItem[];
  clockInJobs: ClockInJobOption[];
  clockInJobsLoading: boolean;
  clockInJobId: number | null;
  setClockInJobId: (id: number | null) => void;
  selectedClockInJob: JobListItem | ClockInJobOption | null;
  selectedJobCard: JobListItem | null;
  timesheetSummary: TimesheetsResponse['summary'] | null;
  timesheetEntries: TimesheetEntry[];
  activeClockEntry: TimesheetsResponse['activeClockEntry'] | null;
  timesheetsLoading: boolean;
  clockActionLoading: boolean;
  elapsedSeconds: number;
  todayHours: number;
  weekHours: number;
  onClockIn: () => void;
  onClockOut: () => void;
};

export default function TimesheetsTab({
  canViewJobs,
  isEmployeeClockOnly,
  jobs,
  clockInJobs,
  clockInJobsLoading,
  clockInJobId,
  setClockInJobId,
  selectedClockInJob,
  selectedJobCard,
  timesheetSummary,
  timesheetEntries,
  activeClockEntry,
  timesheetsLoading,
  clockActionLoading,
  elapsedSeconds,
  todayHours,
  weekHours,
  onClockIn,
  onClockOut,
}: Props) {
  return (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Timesheets</Text>
        <Text style={styles.heroMeta}>Week total: {formatHours(weekHours)}</Text>
        <Text style={styles.heroMeta}>Today: {formatHours(todayHours)}</Text>
        <Text style={styles.heroMeta}>Entries: {timesheetSummary?.entryCount ?? 0}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Clock In Job</Text>
        {canViewJobs && !isEmployeeClockOnly ? (
          <>
            <Text style={styles.cardBody}>
              Pick a job before clocking in, or use general time if you are not tied to one job.
            </Text>
            <View style={styles.selectionBox}>
              <Text style={styles.selectionLabel}>Current selection</Text>
              <Text style={styles.selectionValue}>
                {selectedClockInJob ? selectedClockInJob.jobName : 'General time (no job)'}
              </Text>
              <Text style={styles.selectionHelper}>
                {'clientName' in (selectedClockInJob || {}) && selectedClockInJob?.clientName
                  ? `Customer: ${selectedClockInJob.clientName}`
                  : 'No job will be attached to the entry.'}
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable
                onPress={() => setClockInJobId(null)}
                style={[styles.choiceChip, clockInJobId === null && styles.choiceChipActive]}
              >
                <Text style={[styles.choiceChipText, clockInJobId === null && styles.choiceChipTextActive]}>
                  General Time
                </Text>
              </Pressable>
              {jobs.map((job) => (
                <Pressable
                  key={job.id}
                  onPress={() => setClockInJobId(job.id)}
                  style={[styles.choiceChip, clockInJobId === job.id && styles.choiceChipActive]}
                >
                  <Text style={[styles.choiceChipText, clockInJobId === job.id && styles.choiceChipTextActive]}>
                    {job.jobName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>
              Pick an active job for clock-in, or use general time if you are not tied to one job.
            </Text>
            <View style={styles.selectionBox}>
              <Text style={styles.selectionLabel}>Current selection</Text>
              <Text style={styles.selectionValue}>
                {selectedClockInJob ? selectedClockInJob.jobName : 'General time (no job)'}
              </Text>
              <Text style={styles.selectionHelper}>
                {'clientName' in (selectedClockInJob || {}) && selectedClockInJob?.clientName
                  ? `Customer: ${selectedClockInJob.clientName}`
                  : 'Only safe job fields are shown here for clock-in.'}
              </Text>
            </View>

            {clockInJobsLoading ? (
              <View style={styles.centeredStateCompact}>
                <ActivityIndicator size="small" color="#1E3A5F" />
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  onPress={() => setClockInJobId(null)}
                  style={[styles.choiceChip, clockInJobId === null && styles.choiceChipActive]}
                >
                  <Text style={[styles.choiceChipText, clockInJobId === null && styles.choiceChipTextActive]}>
                    General Time
                  </Text>
                </Pressable>
                {clockInJobs.map((job) => (
                  <Pressable
                    key={job.id}
                    onPress={() => setClockInJobId(job.id)}
                    style={[styles.choiceChip, clockInJobId === job.id && styles.choiceChipActive]}
                  >
                    <Text style={[styles.choiceChipText, clockInJobId === job.id && styles.choiceChipTextActive]}>
                      {job.jobName}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Clock Status</Text>
        {timesheetsLoading ? (
          <View style={styles.centeredStateCompact}>
            <ActivityIndicator size="small" color="#1E3A5F" />
          </View>
        ) : activeClockEntry ? (
          <>
            <Text style={styles.cardBody}>You are currently clocked in.</Text>
            <Text style={styles.detailRow}>Clocked in for: {formatDuration(elapsedSeconds)}</Text>
            <Text style={styles.detailRow}>Clock In: {formatDateTime(activeClockEntry.clockInAt)}</Text>
            <Text style={styles.detailRow}>Job: {activeClockEntry.jobName || 'General time'}</Text>
            <Pressable
              disabled={clockActionLoading}
              onPress={onClockOut}
              style={styles.primaryButton}
            >
              {clockActionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Clock Out</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>You are not clocked in right now.</Text>
            <Text style={styles.helperText}>
              {selectedClockInJob
                ? `This entry will be attached to ${selectedClockInJob.jobName}.`
                : 'This entry will be saved as general time.'}
            </Text>
            <Pressable
              disabled={clockActionLoading}
              onPress={onClockIn}
              style={styles.primaryButton}
            >
              {clockActionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Clock In</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Entries</Text>
        {canViewJobs && selectedJobCard && !isEmployeeClockOnly ? (
          <Text style={styles.helperText}>Selected from Jobs: {selectedJobCard.jobName}</Text>
        ) : null}
        {timesheetsLoading ? (
          <View style={styles.centeredStateCompact}>
            <ActivityIndicator size="small" color="#1E3A5F" />
          </View>
        ) : timesheetEntries.length === 0 ? (
          <Text style={styles.emptyText}>No timesheet entries found for the current week.</Text>
        ) : (
          timesheetEntries.map((entry) => (
            <View key={entry.id} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{formatDate(entry.date)}</Text>
              <Text style={styles.listItemMeta}>Job: {entry.jobName || 'General time'}</Text>
              <Text style={styles.listItemMeta}>Hours: {formatHours(entry.hours)}</Text>
              <Text style={styles.listItemMeta}>Clock In: {formatDateTime(entry.clockInAt)}</Text>
              <Text style={styles.listItemMeta}>Clock Out: {formatDateTime(entry.clockOutAt)}</Text>
              <Text style={styles.listItemMeta}>Status: {entry.approvalStatus || '—'}</Text>
              {entry.note ? <Text style={styles.listItemMeta}>Note: {entry.note}</Text> : null}
            </View>
          ))
        )}
      </View>
    </>
  );
}