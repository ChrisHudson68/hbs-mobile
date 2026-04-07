import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from '../styles';
import { JobListItem } from '../types';

type Props = {
  jobsLoading: boolean;
  jobs: JobListItem[];
  clockInJobId: number | null;
  loadJobDetail: (jobId: number) => void;
};

export default function JobsTab({
  jobsLoading,
  jobs,
  clockInJobId,
  loadJobDetail,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Jobs</Text>
      <Text style={styles.helperText}>
        Open a job to review details or choose a job for clock-in.
      </Text>
      {jobsLoading ? (
        <View style={styles.centeredStateCompact}>
          <ActivityIndicator size="small" color="#1E3A5F" />
        </View>
      ) : jobs.length === 0 ? (
        <Text style={styles.emptyText}>No jobs found.</Text>
      ) : (
        jobs.map((job) => (
          <Pressable key={job.id} onPress={() => loadJobDetail(job.id)} style={styles.listItem}>
            <Text style={styles.listItemTitle}>{job.jobName}</Text>
            <Text style={styles.listItemMeta}>Customer: {job.customerName || '—'}</Text>
            <Text style={styles.listItemMeta}>Status: {job.status || '—'}</Text>
            {clockInJobId === job.id ? <Text style={styles.selectedTag}>Selected for clock-in</Text> : null}
          </Pressable>
        ))
      )}
    </View>
  );
}