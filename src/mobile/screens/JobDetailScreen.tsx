import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { styles } from '../styles';
import { JobListItem } from '../types';
import { formatCurrency } from '../utils';

type Props = {
  selectedJob: JobListItem;
  jobDetailLoading: boolean;
  onBack: () => void;
  onUseForClockIn: () => void;
};

export default function JobDetailScreen({
  selectedJob,
  jobDetailLoading,
  onBack,
  onUseForClockIn,
}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Pressable onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back to Jobs</Text>
        </Pressable>

        {jobDetailLoading ? (
          <View style={styles.centeredStateCompact}>
            <ActivityIndicator size="small" color="#1E3A5F" />
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>{selectedJob.jobName}</Text>
              <Text style={styles.heroMeta}>Customer: {selectedJob.customerName || '—'}</Text>
              <Text style={styles.heroMeta}>Status: {selectedJob.status || '—'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Description</Text>
              <Text style={styles.cardBody}>{selectedJob.description || 'No description available.'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Clock In Link</Text>
              <Text style={styles.cardBody}>
                This job is selected for mobile clock-in from the Timesheets tab.
              </Text>
              <Pressable onPress={onUseForClockIn} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Use This Job for Clock In</Text>
              </Pressable>
            </View>

            {selectedJob.financials ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Financials</Text>
                <View style={styles.metricGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Income</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(selectedJob.financials.totalIncome)}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Expenses</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(selectedJob.financials.totalExpenses)}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Labor</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(selectedJob.financials.totalLabor)}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Profit</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(selectedJob.financials.profit)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}