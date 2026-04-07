import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { createApiClient, mobileLogin, mobileLogout } from './api/client';
import { STORAGE_KEYS } from './constants';
import AuthScreen from './screens/AuthScreen';
import DashboardTab from './screens/DashboardTab';
import ExpensesTab from './screens/ExpensesTab';
import JobDetailScreen from './screens/JobDetailScreen';
import JobsTab from './screens/JobsTab';
import TimesheetsTab from './screens/TimesheetsTab';
import { styles } from './styles';
import {
    AppTab,
    AutoFilledFieldState,
    ClockInJobsResponse,
    ClockOutResponse,
    JobListItem,
    JobsResponse,
    ReceiptAsset,
    TimesheetEntry,
    TimesheetsResponse,
    UploadedReceipt,
    User,
} from './types';
import {
    buildDashboardMetrics,
    buildUploadFileName,
    formatDateInputValue,
    formatHours,
    hasPermission,
    inferMimeTypeFromUri,
    isManagerOrAdmin,
} from './utils';

export default function AppShell() {
  const [tenantInput, setTenantInput] = useState('');
  const [tenantSubdomain, setTenantSubdomain] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [booting, setBooting] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('timesheets');

  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsRefreshing, setJobsRefreshing] = useState(false);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobListItem | null>(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);

  const [timesheetsLoading, setTimesheetsLoading] = useState(false);
  const [timesheetsRefreshing, setTimesheetsRefreshing] = useState(false);
  const [clockActionLoading, setClockActionLoading] = useState(false);
  const [timesheetSummary, setTimesheetSummary] = useState<TimesheetsResponse['summary'] | null>(null);
  const [activeClockEntry, setActiveClockEntry] = useState<TimesheetsResponse['activeClockEntry'] | null>(null);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [clockInJobId, setClockInJobId] = useState<number | null>(null);
  const [clockInJobsLoading, setClockInJobsLoading] = useState(false);
  const [clockInJobs, setClockInJobs] = useState<ClockInJobsResponse['jobs'] extends (infer U)[] ? U[] : never>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [receiptUploading, setReceiptUploading] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<string>('Materials');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(formatDateInputValue(new Date()));
  const [expenseJobId, setExpenseJobId] = useState<number | null>(null);
  const [expenseReceiptAsset, setExpenseReceiptAsset] = useState<ReceiptAsset | null>(null);
  const [uploadedReceipt, setUploadedReceipt] = useState<UploadedReceipt | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<AutoFilledFieldState>({
    vendor: false,
    amount: false,
    date: false,
  });
  const [lastSavedExpenseId, setLastSavedExpenseId] = useState<number | null>(null);

  const isAuthenticated = Boolean(token && tenantSubdomain && user);
  const canViewJobs = hasPermission(user, 'jobs.view');
  const canClockTime = hasPermission(user, 'time.clock');
  const canManageMobileExpenses = isManagerOrAdmin(user);
  const isEmployeeClockOnly = isAuthenticated && !canManageMobileExpenses;

  const selectedJobCard = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const selectedClockInJob = useMemo(() => {
    if (canViewJobs) {
      return jobs.find((job) => job.id === clockInJobId) ?? null;
    }

    return clockInJobs.find((job) => job.id === clockInJobId) ?? null;
  }, [canViewJobs, clockInJobId, clockInJobs, jobs]);

  const selectedExpenseJob = useMemo(
    () => jobs.find((job) => job.id === expenseJobId) ?? null,
    [expenseJobId, jobs],
  );

  const api = useMemo(
    () =>
      createApiClient({
        tenantSubdomain,
        token,
        onUnauthorized: async () => {
          await clearSession();
          setToken('');
          setUser(null);
          setTenantSubdomain('');
          resetAuthenticatedState();
          Alert.alert('Session expired', 'Please sign in again.');
        },
      }),
    [tenantSubdomain, token],
  );

  const timesheetMetrics = useMemo(
    () => {
      const { buildTimesheetMetrics } = require('./utils');
      return buildTimesheetMetrics(timesheetEntries, activeClockEntry);
    },
    [timesheetEntries, activeClockEntry],
  );

  const dashboardMetrics = useMemo(() => buildDashboardMetrics(jobs), [jobs]);

  const topProfitableJobs = useMemo(() => {
    return [...jobs]
      .filter((job) => Boolean(job.financials))
      .sort(
        (a, b) => Number(b.financials?.profit || 0) - Number(a.financials?.profit || 0),
      )
      .slice(0, 5);
  }, [jobs]);

  const attentionJobs = useMemo(() => {
    return [...jobs]
      .filter(
        (job) =>
          Boolean(job.financials) &&
          (Number(job.financials?.profit || 0) < 0 ||
            Number(job.financials?.unpaidInvoiceBalance || 0) > 0),
      )
      .sort((a, b) => {
        const aScore =
          Number(a.financials?.unpaidInvoiceBalance || 0) +
          Math.abs(Math.min(Number(a.financials?.profit || 0), 0));
        const bScore =
          Number(b.financials?.unpaidInvoiceBalance || 0) +
          Math.abs(Math.min(Number(b.financials?.profit || 0), 0));
        return bScore - aScore;
      })
      .slice(0, 5);
  }, [jobs]);

  const expenseReadyToSave = Boolean(
    expenseJobId &&
      expenseCategory.trim() &&
      expenseAmount.trim() &&
      expenseDate.trim() &&
      uploadedReceipt?.receiptFilename,
  );

  const saveSession = useCallback(async (nextTenant: string, nextToken: string, nextUser: User) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.tenant, nextTenant);
    await SecureStore.setItemAsync(STORAGE_KEYS.token, nextToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.user, JSON.stringify(nextUser));
  }, []);

  const clearSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.tenant);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.user);
  }, []);

  const resetExpenseForm = useCallback(() => {
    setExpenseCategory('Materials');
    setExpenseVendor('');
    setExpenseAmount('');
    setExpenseDate(formatDateInputValue(new Date()));
    setExpenseJobId(null);
    setExpenseReceiptAsset(null);
    setUploadedReceipt(null);
    setAutoFilledFields({
      vendor: false,
      amount: false,
      date: false,
    });
    setLastSavedExpenseId(null);
  }, []);

  const resetAuthenticatedState = useCallback(() => {
    setJobs([]);
    setSelectedJobId(null);
    setSelectedJob(null);
    setTimesheetSummary(null);
    setActiveClockEntry(null);
    setTimesheetEntries([]);
    setClockInJobId(null);
    setClockInJobs([]);
    setElapsedSeconds(0);
    resetExpenseForm();
    setActiveTab('timesheets');
  }, [resetExpenseForm]);

  const loadJobs = useCallback(
    async (isRefresh = false) => {
      if (!isAuthenticated || !canViewJobs) return;

      if (isRefresh) {
        setJobsRefreshing(true);
      } else {
        setJobsLoading(true);
      }

      try {
        const data = (await api.getJobs()) as JobsResponse;
        const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
        setJobs(nextJobs);

        if (clockInJobId && !nextJobs.some((job) => job.id === clockInJobId)) {
          setClockInJobId(null);
        }

        if (expenseJobId && !nextJobs.some((job) => job.id === expenseJobId)) {
          setExpenseJobId(null);
        }

        if (selectedJobId && !nextJobs.some((job) => job.id === selectedJobId)) {
          setSelectedJobId(null);
          setSelectedJob(null);
        }
      } catch (error) {
        if ((error as Error).message !== 'unauthorized') {
          Alert.alert('Jobs', (error as Error).message);
        }
      } finally {
        if (isRefresh) {
          setJobsRefreshing(false);
        } else {
          setJobsLoading(false);
        }
      }
    },
    [api, canViewJobs, clockInJobId, expenseJobId, isAuthenticated, selectedJobId],
  );

  const loadClockInJobs = useCallback(
    async (isRefresh = false) => {
      if (!isAuthenticated || !canClockTime || canViewJobs) return;

      if (!isRefresh) {
        setClockInJobsLoading(true);
      }

      try {
        const data = (await api.getClockInJobs()) as ClockInJobsResponse;
        const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
        setClockInJobs(nextJobs);

        if (clockInJobId && !nextJobs.some((job) => job.id === clockInJobId)) {
          setClockInJobId(null);
        }
      } catch (error) {
        if ((error as Error).message !== 'unauthorized') {
          Alert.alert('Clock-In Jobs', (error as Error).message);
        }
      } finally {
        if (!isRefresh) {
          setClockInJobsLoading(false);
        }
      }
    },
    [api, canClockTime, canViewJobs, clockInJobId, isAuthenticated],
  );

  const loadJobDetail = useCallback(
    async (jobId: number) => {
      if (!isAuthenticated || !canViewJobs) return;

      setJobDetailLoading(true);
      try {
        const data = await api.getJobDetail(jobId);
        setSelectedJob(data.job ?? null);
        setSelectedJobId(jobId);
      } catch (error) {
        if ((error as Error).message !== 'unauthorized') {
          Alert.alert('Job Detail', (error as Error).message);
        }
      } finally {
        setJobDetailLoading(false);
      }
    },
    [api, canViewJobs, isAuthenticated],
  );

  const loadTimesheets = useCallback(
    async (isRefresh = false) => {
      if (!isAuthenticated) return;

      if (isRefresh) {
        setTimesheetsRefreshing(true);
      } else {
        setTimesheetsLoading(true);
      }

      try {
        const data = await api.getTimesheets();
        setTimesheetSummary(data.summary ?? null);
        setActiveClockEntry(data.activeClockEntry ?? null);
        setTimesheetEntries(Array.isArray(data.timesheets) ? data.timesheets : []);
      } catch (error) {
        if ((error as Error).message !== 'unauthorized') {
          Alert.alert('Timesheets', (error as Error).message);
        }
      } finally {
        if (isRefresh) {
          setTimesheetsRefreshing(false);
        } else {
          setTimesheetsLoading(false);
        }
      }
    },
    [api, isAuthenticated],
  );

  const handleLogin = useCallback(async () => {
    const cleanedTenant = tenantInput.trim().toLowerCase();
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedTenant) {
      Alert.alert('Tenant Required', 'Enter your company subdomain to continue.');
      return;
    }

    if (!cleanedEmail || !password) {
      Alert.alert('Login Required', 'Enter your email and password.');
      return;
    }

    setAuthLoading(true);
    try {
      const payload = await mobileLogin({
        tenantSubdomain: cleanedTenant,
        email: cleanedEmail,
        password,
      });

      setTenantSubdomain(cleanedTenant);
      setTenantInput(cleanedTenant);
      setToken(payload.token);
      setUser(payload.user);
      await saveSession(cleanedTenant, payload.token, payload.user);
      setPassword('');
      resetAuthenticatedState();
    } catch (error) {
      Alert.alert('Sign In Failed', (error as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }, [email, password, resetAuthenticatedState, saveSession, tenantInput]);

  const handleLogout = useCallback(async () => {
    try {
      if (tenantSubdomain && token) {
        await mobileLogout({
          tenantSubdomain,
          token,
        });
      }
    } catch {
      // best effort logout
    }

    await clearSession();
    setToken('');
    setUser(null);
    setTenantSubdomain('');
    setPassword('');
    resetAuthenticatedState();
  }, [clearSession, resetAuthenticatedState, tenantSubdomain, token]);

  const handleClockIn = useCallback(async () => {
    if (!isAuthenticated) return;

    setClockActionLoading(true);
    try {
      await api.clockIn({
        jobId: clockInJobId ?? undefined,
      });
      await loadTimesheets();
      Alert.alert(
        'Clocked In',
        selectedClockInJob
          ? `Your time entry has started on ${selectedClockInJob.jobName}.`
          : 'Your time entry has started as general time.',
      );
    } catch (error) {
      if ((error as Error).message !== 'unauthorized') {
        Alert.alert('Clock In', (error as Error).message);
      }
    } finally {
      setClockActionLoading(false);
    }
  }, [api, clockInJobId, isAuthenticated, loadTimesheets, selectedClockInJob]);

  const handleClockOut = useCallback(async () => {
    if (!isAuthenticated) return;

    setClockActionLoading(true);
    try {
      const data = (await api.clockOut()) as ClockOutResponse;
      await loadTimesheets();
      Alert.alert(
        'Clocked Out',
        data.entry ? `Saved ${formatHours(data.entry.hours)} for this entry.` : 'Your time entry has been saved.',
      );
    } catch (error) {
      if ((error as Error).message !== 'unauthorized') {
        Alert.alert('Clock Out', (error as Error).message);
      }
    } finally {
      setClockActionLoading(false);
    }
  }, [api, isAuthenticated, loadTimesheets]);

  const handlePickReceipt = useCallback(async () => {
    if (!canManageMobileExpenses) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Photo library permission is required to select a receipt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType || inferMimeTypeFromUri(uri);
    const name = asset.fileName || buildUploadFileName(uri);

    setExpenseReceiptAsset({
      uri,
      name,
      mimeType,
    });
    setUploadedReceipt(null);
    setAutoFilledFields({
      vendor: false,
      amount: false,
      date: false,
    });
  }, [canManageMobileExpenses]);

  const handleUploadReceipt = useCallback(async () => {
    if (!canManageMobileExpenses) return;
    if (!expenseReceiptAsset) {
      Alert.alert('Receipt Required', 'Pick a receipt image before uploading.');
      return;
    }

    setReceiptUploading(true);
    try {
      const formData = new FormData();
      formData.append('receipt', {
        uri: expenseReceiptAsset.uri,
        name: expenseReceiptAsset.name,
        type: expenseReceiptAsset.mimeType,
      } as any);

      if (uploadedReceipt?.receiptFilename) {
        formData.append('pendingReceiptFilename', uploadedReceipt.receiptFilename);
      }

      const data = await api.uploadReceipt(formData);

      if (!data.receipt) {
        throw new Error('Receipt upload did not return a saved receipt.');
      }

      const parsed = data.receipt.parsed ?? null;
      const nextAutoFilled: AutoFilledFieldState = {
        vendor: false,
        amount: false,
        date: false,
      };

      setUploadedReceipt(data.receipt);

      if (!expenseVendor.trim() && parsed?.merchantName) {
        setExpenseVendor(parsed.merchantName);
        nextAutoFilled.vendor = true;
      }

      if (!expenseAmount.trim() && typeof parsed?.totalAmount === 'number') {
        setExpenseAmount(Number(parsed.totalAmount).toFixed(2));
        nextAutoFilled.amount = true;
      }

      if (parsed?.receiptDate) {
        setExpenseDate(parsed.receiptDate);
        nextAutoFilled.date = true;
      }

      setAutoFilledFields(nextAutoFilled);

      Alert.alert(
        'Receipt Uploaded',
        data.receipt.hasSuggestions
          ? 'Receipt uploaded successfully. OCR suggestions were applied where available.'
          : 'Receipt uploaded successfully.',
      );
    } catch (error) {
      Alert.alert('Receipt Upload', (error as Error).message);
    } finally {
      setReceiptUploading(false);
    }
  }, [
    api,
    canManageMobileExpenses,
    expenseAmount,
    expenseDate,
    expenseReceiptAsset,
    expenseVendor,
    uploadedReceipt,
  ]);

  const handleSaveExpense = useCallback(async () => {
    if (!canManageMobileExpenses) return;

    if (!expenseJobId) {
      Alert.alert('Job Required', 'Select a job for this expense.');
      return;
    }

    if (!expenseCategory.trim()) {
      Alert.alert('Category Required', 'Select or enter an expense category.');
      return;
    }

    if (!expenseAmount.trim()) {
      Alert.alert('Amount Required', 'Enter the expense amount.');
      return;
    }

    if (!expenseDate.trim()) {
      Alert.alert('Date Required', 'Enter the expense date.');
      return;
    }

    if (!uploadedReceipt?.receiptFilename) {
      Alert.alert('Receipt Required', 'Upload the receipt before saving the expense.');
      return;
    }

    setExpenseSaving(true);
    try {
      const data = await api.createExpense({
        jobId: expenseJobId,
        category: expenseCategory.trim(),
        vendor: expenseVendor.trim() || undefined,
        amount: expenseAmount.trim(),
        date: expenseDate.trim(),
        receiptFilename: uploadedReceipt.receiptFilename,
      });

      if (!data.expense) {
        throw new Error('Expense save did not return the new expense.');
      }

      setLastSavedExpenseId(data.expense.id);

      Alert.alert(
        'Expense Saved',
        `${data.expense.category} was saved for ${selectedExpenseJob?.jobName || 'the selected job'}.`,
      );

      resetExpenseForm();
    } catch (error) {
      Alert.alert('Save Expense', (error as Error).message);
    } finally {
      setExpenseSaving(false);
    }
  }, [
    api,
    canManageMobileExpenses,
    expenseAmount,
    expenseCategory,
    expenseDate,
    expenseJobId,
    expenseVendor,
    resetExpenseForm,
    selectedExpenseJob?.jobName,
    uploadedReceipt,
  ]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [storedTenant, storedToken, storedUserJson] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.tenant),
          SecureStore.getItemAsync(STORAGE_KEYS.token),
          SecureStore.getItemAsync(STORAGE_KEYS.user),
        ]);

        if (storedTenant) {
          setTenantInput(storedTenant);
          setTenantSubdomain(storedTenant);
        }

        if (storedToken && storedUserJson) {
          setToken(storedToken);
          setUser(JSON.parse(storedUserJson) as User);
        }
      } catch {
        await clearSession();
      } finally {
        setBooting(false);
      }
    };

    void bootstrap();
  }, [clearSession]);

  useEffect(() => {
    if (!activeClockEntry?.clockInAt) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeClockEntry.clockInAt).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
      setElapsedSeconds(diffSeconds);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeClockEntry]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (isEmployeeClockOnly && activeTab !== 'timesheets') {
      setActiveTab('timesheets');
    }
  }, [activeTab, isAuthenticated, isEmployeeClockOnly]);

  useEffect(() => {
    if (!isAuthenticated || !canViewJobs) return;
    void loadJobs();
  }, [canViewJobs, isAuthenticated, loadJobs]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'timesheets' || canViewJobs || !canClockTime) return;
    void loadClockInJobs();
  }, [activeTab, canClockTime, canViewJobs, isAuthenticated, loadClockInJobs]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab !== 'timesheets' && activeTab !== 'dashboard') return;
    void loadTimesheets();
  }, [activeTab, isAuthenticated, loadTimesheets]);

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#1E3A5F" />
          <Text style={styles.loadingText}>Loading Hudson Business Solutions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        authLoading={authLoading}
        tenantInput={tenantInput}
        email={email}
        password={password}
        setTenantInput={setTenantInput}
        setTenantSubdomain={setTenantSubdomain}
        setEmail={setEmail}
        setPassword={setPassword}
        onLogin={() => void handleLogin()}
      />
    );
  }

  if (selectedJob) {
    return (
      <JobDetailScreen
        selectedJob={selectedJob}
        jobDetailLoading={jobDetailLoading}
        onBack={() => setSelectedJob(null)}
        onUseForClockIn={() => {
          setClockInJobId(selectedJob.id);
          setSelectedJob(null);
          setActiveTab('timesheets');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            refreshing={
              activeTab === 'jobs' || activeTab === 'expenses' || activeTab === 'dashboard'
                ? jobsRefreshing
                : timesheetsRefreshing
            }
            onRefresh={() => {
              if (activeTab === 'jobs' || activeTab === 'expenses' || activeTab === 'dashboard') {
                void loadJobs(true);
                if (activeTab === 'dashboard') {
                  void loadTimesheets(true);
                }
              } else {
                void loadTimesheets(true);
                if (!canViewJobs && canClockTime) {
                  void loadClockInJobs(true);
                }
              }
            }}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.brandEyebrow}>{tenantSubdomain}</Text>
            <Text style={styles.screenTitle}>Welcome, {user?.name}</Text>
            <Text style={styles.screenSubtitle}>
              {isEmployeeClockOnly ? 'Clock in / out only' : user?.role}
            </Text>
          </View>
          <Pressable onPress={() => void handleLogout()} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </Pressable>
        </View>

        {isEmployeeClockOnly ? (
          <View style={styles.restrictedBanner}>
            <Text style={styles.restrictedBannerTitle}>Employee Mobile Access</Text>
            <Text style={styles.restrictedBannerBody}>
              This mobile app is limited to clock in, clock out, and viewing recent time entries.
            </Text>
          </View>
        ) : null}

        <View style={styles.tabBar}>
          {!isEmployeeClockOnly && canViewJobs ? (
            <Pressable
              onPress={() => setActiveTab('dashboard')}
              style={[styles.tabButton, activeTab === 'dashboard' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === 'dashboard' && styles.tabButtonTextActive]}>
                Dashboard
              </Text>
            </Pressable>
          ) : null}

          {!isEmployeeClockOnly && canViewJobs ? (
            <Pressable
              onPress={() => setActiveTab('jobs')}
              style={[styles.tabButton, activeTab === 'jobs' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === 'jobs' && styles.tabButtonTextActive]}>
                Jobs
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setActiveTab('timesheets')}
            style={[styles.tabButton, activeTab === 'timesheets' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === 'timesheets' && styles.tabButtonTextActive]}>
              Timesheets
            </Text>
          </Pressable>

          {!isEmployeeClockOnly && canManageMobileExpenses ? (
            <Pressable
              onPress={() => setActiveTab('expenses')}
              style={[styles.tabButton, activeTab === 'expenses' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === 'expenses' && styles.tabButtonTextActive]}>
                Expenses
              </Text>
            </Pressable>
          ) : null}
        </View>

        {activeTab === 'dashboard' && !isEmployeeClockOnly && canViewJobs ? (
          <DashboardTab
            dashboardMetrics={dashboardMetrics}
            jobsLoading={jobsLoading}
            topProfitableJobs={topProfitableJobs}
            attentionJobs={attentionJobs}
            loadJobDetail={(jobId) => void loadJobDetail(jobId)}
            activeClockEntry={activeClockEntry}
            elapsedSeconds={elapsedSeconds}
            timesheetsLoading={timesheetsLoading}
          />
        ) : null}

        {activeTab === 'jobs' && !isEmployeeClockOnly ? (
          <JobsTab
            jobsLoading={jobsLoading}
            jobs={jobs}
            clockInJobId={clockInJobId}
            loadJobDetail={(jobId) => void loadJobDetail(jobId)}
          />
        ) : null}

        {activeTab === 'timesheets' ? (
          <TimesheetsTab
            canViewJobs={canViewJobs}
            isEmployeeClockOnly={isEmployeeClockOnly}
            canClockTime={canClockTime}
            jobs={jobs}
            clockInJobs={clockInJobs}
            clockInJobsLoading={clockInJobsLoading}
            clockInJobId={clockInJobId}
            setClockInJobId={setClockInJobId}
            selectedClockInJob={selectedClockInJob}
            selectedJobCard={selectedJobCard}
            timesheetSummary={timesheetSummary}
            timesheetEntries={timesheetEntries}
            activeClockEntry={activeClockEntry}
            timesheetsLoading={timesheetsLoading}
            clockActionLoading={clockActionLoading}
            elapsedSeconds={elapsedSeconds}
            todayHours={timesheetMetrics.todayHours}
            weekHours={timesheetMetrics.weekHours}
            onClockIn={() => void handleClockIn()}
            onClockOut={() => void handleClockOut()}
          />
        ) : null}

        {activeTab === 'expenses' && !isEmployeeClockOnly && canManageMobileExpenses ? (
          <ExpensesTab
            jobsLoading={jobsLoading}
            jobs={jobs}
            expenseJobId={expenseJobId}
            setExpenseJobId={setExpenseJobId}
            selectedExpenseJob={selectedExpenseJob}
            expenseCategory={expenseCategory}
            setExpenseCategory={setExpenseCategory}
            expenseVendor={expenseVendor}
            setExpenseVendor={(value) => {
              setExpenseVendor(value);
              if (autoFilledFields.vendor) {
                setAutoFilledFields((current) => ({ ...current, vendor: false }));
              }
            }}
            expenseAmount={expenseAmount}
            setExpenseAmount={(value) => {
              setExpenseAmount(value);
              if (autoFilledFields.amount) {
                setAutoFilledFields((current) => ({ ...current, amount: false }));
              }
            }}
            expenseDate={expenseDate}
            setExpenseDate={(value) => {
              setExpenseDate(value);
              if (autoFilledFields.date) {
                setAutoFilledFields((current) => ({ ...current, date: false }));
              }
            }}
            expenseReceiptAsset={expenseReceiptAsset}
            uploadedReceipt={uploadedReceipt}
            autoFilledFields={autoFilledFields}
            receiptUploading={receiptUploading}
            expenseSaving={expenseSaving}
            expenseReadyToSave={expenseReadyToSave}
            lastSavedExpenseId={lastSavedExpenseId}
            onPickReceipt={() => void handlePickReceipt()}
            onUploadReceipt={() => void handleUploadReceipt()}
            onSaveExpense={() => void handleSaveExpense()}
            onResetExpenseForm={resetExpenseForm}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}