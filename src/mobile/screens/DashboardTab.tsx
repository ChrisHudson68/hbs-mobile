import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from '../styles';
import { DashboardMetrics, JobListItem, TimesheetsResponse } from '../types';
import { formatCurrency, formatDateTime, formatDuration, formatHours } from '../utils';

type Props = {
  dashboardMetrics: DashboardMetrics;
  jobsLoading: boolean;
  topProfitableJobs: JobListItem[];
  attentionJobs: JobListItem[];
  loadJobDetail: (jobId: number) => void;
  activeClockEntry: TimesheetsResponse['activeClockEntry'] | null;
  elapsedSeconds: number;
  timesheetsLoading: boolean;
};

export default function DashboardTab({
  dashboardMetrics,
  jobsLoading,
  topProfitableJobs,
  attentionJobs,
  loadJobDetail,
  activeClockEntry,
  elapsedSeconds,
  timesheetsLoading,
}: Props) {
  return (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Dashboard</Text>
        <Text style={styles.heroMeta}>Live rollup from authorized mobile job financials</Text>
        <Text style={styles.heroMeta}>
          Active jobs: {dashboardMetrics.activeJobsCount} • On hold: {dashboardMetrics.onHoldJobsCount} • Completed: {dashboardMetrics.completedJobsCount}
        </Text>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Recorded Income</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboardMetrics.totalIncome)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Profit</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboardMetrics.totalProfit)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Expenses</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboardMetrics.totalExpenses)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Labor</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboardMetrics.totalLabor)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Invoiced</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboardMetrics.totalInvoiced)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Collected</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboardMetrics.totalCollected)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Unpaid Balance</Text>
          <Text style={styles.metricValue}>{formatCurrency(dashboardMetrics.unpaidBalance)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Tracked Hours</Text>
          <Text style={styles.metricValue}>{formatHours(dashboardMetrics.totalHours)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Operational Snapshot</Text>
        <View style={styles.metricStrip}>
          <View style={styles.metricStripCard}>
            <Text style={styles.metricStripLabel}>Jobs</Text>
            <Text style={styles.metricStripValue}>{dashboardMetrics.jobsCount}</Text>
          </View>
          <View style={styles.metricStripCard}>
            <Text style={styles.metricStripLabel}>Avg Profit / Job</Text>
            <Text style={styles.metricStripValue}>
              {formatCurrency(dashboardMetrics.averageProfitPerJob)}
            </Text>
          </View>
          <View style={styles.metricStripCard}>
            <Text style={styles.metricStripLabel}>Total Costs</Text>
            <Text style={styles.metricStripValue}>{formatCurrency(dashboardMetrics.totalCosts)}</Text>
          </View>
        </View>
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
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>You are not clocked in right now.</Text>
            <Text style={styles.helperText}>Open the Timesheets tab to clock in or out.</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Profitable Jobs</Text>
        {jobsLoading ? (
          <View style={styles.centeredStateCompact}>
            <ActivityIndicator size="small" color="#1E3A5F" />
          </View>
        ) : topProfitableJobs.length === 0 ? (
          <Text style={styles.emptyText}>No job financial data available yet.</Text>
        ) : (
          topProfitableJobs.map((job) => (
            <Pressable key={job.id} onPress={() => loadJobDetail(job.id)} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{job.jobName}</Text>
              <Text style={styles.listItemMeta}>Customer: {job.customerName || '—'}</Text>
              <Text style={styles.listItemMeta}>Status: {job.status || '—'}</Text>
              <Text style={styles.listItemMeta}>Profit: {formatCurrency(job.financials?.profit)}</Text>
              <Text style={styles.listItemMeta}>
                Collected: {formatCurrency(job.financials?.totalCollected)} • Unpaid: {formatCurrency(job.financials?.unpaidInvoiceBalance)}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Needs Attention</Text>
        <Text style={styles.helperText}>
          Jobs with negative profit or unpaid invoice balances surface here first.
        </Text>
        {jobsLoading ? (
          <View style={styles.centeredStateCompact}>
            <ActivityIndicator size="small" color="#1E3A5F" />
          </View>
        ) : attentionJobs.length === 0 ? (
          <Text style={styles.emptyText}>No urgent job financial flags right now.</Text>
        ) : (
          attentionJobs.map((job) => {
            const negativeProfit = Number(job.financials?.profit || 0) < 0;
            const unpaidBalance = Number(job.financials?.unpaidInvoiceBalance || 0);

            return (
              <Pressable key={job.id} onPress={() => loadJobDetail(job.id)} style={styles.listItem}>
                <Text style={styles.listItemTitle}>{job.jobName}</Text>
                <Text style={styles.listItemMeta}>Customer: {job.customerName || '—'}</Text>
                <Text style={styles.listItemMeta}>Status: {job.status || '—'}</Text>
                <Text style={styles.listItemMeta}>Profit: {formatCurrency(job.financials?.profit)}</Text>
                <Text style={styles.listItemMeta}>Unpaid Balance: {formatCurrency(unpaidBalance)}</Text>
                {negativeProfit ? <Text style={styles.alertTag}>Negative profit</Text> : null}
                {unpaidBalance > 0 ? <Text style={styles.warningTag}>Outstanding invoice balance</Text> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </>
  );
}