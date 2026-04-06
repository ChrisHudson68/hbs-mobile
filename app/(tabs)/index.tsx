import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Job = {
  id: number;
  jobName?: string;
  jobCode?: string | null;
  clientName?: string | null;
  status?: string | null;
};

type JobDetail = {
  id: number;
  jobName?: string;
  jobCode?: string | null;
  jobDescription?: string | null;
  clientName?: string | null;
  soldBy?: string | null;
  commissionPercent?: number | null;
  contractAmount?: number | null;
  retainagePercent?: number | null;
  startDate?: string | null;
  status?: string | null;
  sourceEstimateId?: number | null;
  sourceEstimateNumber?: string | null;
  sourceEstimateCustomerName?: string | null;
  financials?: {
    totalIncome?: number;
    totalExpenses?: number;
    totalLabor?: number;
    totalHours?: number;
    totalCosts?: number;
    totalInvoiced?: number;
    totalCollected?: number;
    unpaidInvoices?: number;
    unpaidInvoiceBalance?: number;
    remainingContract?: number;
    profit?: number;
  };
};

type TimesheetEntry = {
  id: number;
  employeeId?: number;
  employeeName?: string | null;
  date?: string | null;
  jobId?: number | null;
  jobName?: string | null;
  hours?: number | null;
  note?: string | null;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  entryMethod?: string | null;
  approvalStatus?: string | null;
  hasPendingEditRequest?: boolean;
};

type ActiveClockEntry = {
  id: number;
  jobId?: number | null;
  jobName?: string | null;
  clockInAt?: string | null;
};

type TimesheetSummary = {
  entryCount?: number;
  totalHours?: number;
  weekApproved?: boolean;
  approvedAt?: string | null;
  approvedByName?: string | null;
};

type TimesheetScope = {
  employeeId?: number;
  start?: string;
  end?: string;
  isEmployeeUser?: boolean;
  canApproveTime?: boolean;
  canUseSelfClock?: boolean;
};

type TimesheetResponse = {
  scope?: TimesheetScope;
  summary?: TimesheetSummary;
  activeClockEntry?: ActiveClockEntry | null;
  timesheets: TimesheetEntry[];
};

type AppTab = 'jobs' | 'timesheets';

const API_BASE_URL = 'http://192.168.1.181:3000';

const STORAGE_KEYS = {
  tenant: 'hbs_mobile_tenant',
  token: 'hbs_mobile_token',
};

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `$${amount.toFixed(2)}`;
}

function formatPercent(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `${amount.toFixed(2)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return value;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatHours(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `${amount.toFixed(2)} hrs`;
}

function mapApiError(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
  }

  return fallback;
}

export default function HomeScreen() {
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [selectedTenant, setSelectedTenant] = useState('');
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<AppTab>('jobs');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);

  const [timesheetScope, setTimesheetScope] = useState<TimesheetScope | null>(null);
  const [timesheetSummary, setTimesheetSummary] = useState<TimesheetSummary | null>(null);
  const [activeClockEntry, setActiveClockEntry] = useState<ActiveClockEntry | null>(null);
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);

  const [statusText, setStatusText] = useState('Loading app...');
  const [errorText, setErrorText] = useState('');
  const [isBooting, setIsBooting] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [isRefreshingJobs, setIsRefreshingJobs] = useState(false);
  const [isLoadingJobDetail, setIsLoadingJobDetail] = useState(false);
  const [isRefreshingTimesheets, setIsRefreshingTimesheets] = useState(false);
  const [isClockActionRunning, setIsClockActionRunning] = useState(false);

  async function getCsrfToken(tenantSubdomain: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/csrf-token`, {
      headers: {
        'X-Tenant-Subdomain': tenantSubdomain,
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.ok || !data.csrfToken) {
      throw new Error('Could not fetch CSRF token.');
    }

    return data.csrfToken as string;
  }

  async function loadJobsWithToken(
    tenantSubdomain: string,
    bearerToken: string,
  ): Promise<Job[]> {
    const jobsResponse = await fetch(`${API_BASE_URL}/api/jobs`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'X-Tenant-Subdomain': tenantSubdomain,
        Accept: 'application/json',
      },
    });

    const jobsData = await jobsResponse.json();

    if (!jobsResponse.ok || !jobsData.ok) {
      throw new Error(mapApiError(jobsData, 'Jobs failed to load.'));
    }

    return Array.isArray(jobsData.jobs) ? jobsData.jobs : [];
  }

  async function loadJobDetailWithToken(
    tenantSubdomain: string,
    bearerToken: string,
    jobId: number,
  ): Promise<JobDetail> {
    const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'X-Tenant-Subdomain': tenantSubdomain,
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.ok || !data.job) {
      throw new Error(mapApiError(data, 'Job detail failed to load.'));
    }

    return data.job as JobDetail;
  }

  async function loadTimesheetsWithToken(
    tenantSubdomain: string,
    bearerToken: string,
  ): Promise<TimesheetResponse> {
    const response = await fetch(`${API_BASE_URL}/api/timesheets`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'X-Tenant-Subdomain': tenantSubdomain,
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(mapApiError(data, 'Timesheets failed to load.'));
    }

    return {
      scope: data.scope ?? null,
      summary: data.summary ?? null,
      activeClockEntry: data.activeClockEntry ?? null,
      timesheets: Array.isArray(data.timesheets) ? data.timesheets : [],
    };
  }

  async function postTimesheetAction(
    tenantSubdomain: string,
    bearerToken: string,
    endpoint: '/api/timesheets/clock-in' | '/api/timesheets/clock-out',
  ) {
    const csrfToken = await getCsrfToken(tenantSubdomain);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'X-Tenant-Subdomain': tenantSubdomain,
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(mapApiError(data, 'Timesheet action failed.'));
    }

    return data;
  }

  async function clearSavedAuth() {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.tenant);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.token);
  }

  async function saveAuth(tenantSubdomain: string, bearerToken: string) {
    await SecureStore.setItemAsync(STORAGE_KEYS.tenant, tenantSubdomain);
    await SecureStore.setItemAsync(STORAGE_KEYS.token, bearerToken);
  }

  function resetTimesheetsState() {
    setTimesheetScope(null);
    setTimesheetSummary(null);
    setActiveClockEntry(null);
    setTimesheets([]);
  }

  async function refreshJobs(
    tenantSubdomain: string,
    bearerToken: string,
    options?: { silent?: boolean },
  ) {
    const silent = options?.silent === true;

    if (!silent) {
      setIsRefreshingJobs(true);
      setStatusText('Loading jobs...');
    }

    const loadedJobs = await loadJobsWithToken(tenantSubdomain, bearerToken);
    setJobs(loadedJobs);
  }

  async function refreshTimesheets(
    tenantSubdomain: string,
    bearerToken: string,
    options?: { silent?: boolean },
  ) {
    const silent = options?.silent === true;

    if (!silent) {
      setIsRefreshingTimesheets(true);
      setStatusText('Loading timesheets...');
    }

    const data = await loadTimesheetsWithToken(tenantSubdomain, bearerToken);
    setTimesheetScope(data.scope ?? null);
    setTimesheetSummary(data.summary ?? null);
    setActiveClockEntry(data.activeClockEntry ?? null);
    setTimesheets(data.timesheets);
  }

  async function loadInitialAppData(
    tenantSubdomain: string,
    bearerToken: string,
    options?: { silent?: boolean },
  ) {
    await refreshJobs(tenantSubdomain, bearerToken, options);
    await refreshTimesheets(tenantSubdomain, bearerToken, { silent: true });
  }

  useEffect(() => {
    async function bootApp() {
      try {
        setIsBooting(true);
        setErrorText('');
        setStatusText('Checking saved login...');

        const savedTenant = await SecureStore.getItemAsync(STORAGE_KEYS.tenant);
        const savedToken = await SecureStore.getItemAsync(STORAGE_KEYS.token);

        if (!savedTenant || !savedToken) {
          setStatusText('Enter your company subdomain to begin.');
          return;
        }

        setTenant(savedTenant);
        setSelectedTenant(savedTenant);
        setToken(savedToken);

        await loadInitialAppData(savedTenant, savedToken, { silent: true });
        setStatusText(`Logged in to ${savedTenant}.`);
      } catch (error) {
        await clearSavedAuth();
        setToken('');
        setJobs([]);
        setSelectedJob(null);
        resetTimesheetsState();
        setErrorText(error instanceof Error ? error.message : String(error));
        setStatusText('Saved login expired. Please sign in again.');
      } finally {
        setIsBooting(false);
        setIsRefreshingJobs(false);
        setIsRefreshingTimesheets(false);
      }
    }

    bootApp();
  }, []);

  function continueToLogin() {
    const trimmedTenant = tenant.trim().toLowerCase();

    if (!trimmedTenant) {
      setStatusText('Please enter a tenant subdomain.');
      return;
    }

    setSelectedTenant(trimmedTenant);
    setJobs([]);
    setSelectedJob(null);
    resetTimesheetsState();
    setToken('');
    setErrorText('');
    setStatusText(`Tenant selected: ${trimmedTenant}. Please log in.`);
  }

  async function loginAndLoadData() {
    try {
      if (!selectedTenant) {
        setStatusText('Please choose a tenant first.');
        return;
      }

      if (!email.trim() || !password) {
        setStatusText('Please enter your email and password.');
        return;
      }

      setIsWorking(true);
      setErrorText('');
      setStatusText('Signing in...');

      const csrfToken = await getCsrfToken(selectedTenant);

      const loginResponse = await fetch(`${API_BASE_URL}/api/mobile/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'X-Tenant-Subdomain': selectedTenant,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok || !loginData.ok || !loginData.token) {
        setErrorText(JSON.stringify(loginData, null, 2));
        setStatusText('Login failed.');
        return;
      }

      const bearerToken = String(loginData.token);

      await loadInitialAppData(selectedTenant, bearerToken, { silent: true });
      await saveAuth(selectedTenant, bearerToken);

      setToken(bearerToken);
      setActiveTab('jobs');
      setSelectedJob(null);
      setPassword('');
      setStatusText(`Logged in to ${selectedTenant}.`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
      setStatusText('Could not connect.');
    } finally {
      setIsWorking(false);
      setIsRefreshingJobs(false);
      setIsRefreshingTimesheets(false);
    }
  }

  async function openJobDetail(jobId: number) {
    try {
      if (!token || !selectedTenant) {
        setStatusText('You must be logged in.');
        return;
      }

      setIsLoadingJobDetail(true);
      setErrorText('');
      setStatusText('Loading job details...');

      const detail = await loadJobDetailWithToken(selectedTenant, token, jobId);
      setSelectedJob(detail);
      setStatusText(`Viewing job: ${detail.jobName || 'Job Detail'}`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
      setStatusText('Could not load job detail.');
    } finally {
      setIsLoadingJobDetail(false);
    }
  }

  function closeJobDetail() {
    setSelectedJob(null);
    setStatusText(`Logged in to ${selectedTenant}.`);
  }

  async function handleRefreshJobs() {
    try {
      if (!token || !selectedTenant) {
        setStatusText('You must be logged in.');
        return;
      }

      setErrorText('');
      await refreshJobs(selectedTenant, token);
      setStatusText('Jobs refreshed.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
      setStatusText('Could not refresh jobs.');
    } finally {
      setIsRefreshingJobs(false);
    }
  }

  async function handleRefreshTimesheets() {
    try {
      if (!token || !selectedTenant) {
        setStatusText('You must be logged in.');
        return;
      }

      setErrorText('');
      await refreshTimesheets(selectedTenant, token);
      setStatusText('Timesheets refreshed.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
      setStatusText('Could not refresh timesheets.');
    } finally {
      setIsRefreshingTimesheets(false);
    }
  }

  async function handleClockIn() {
    try {
      if (!token || !selectedTenant) {
        setStatusText('You must be logged in.');
        return;
      }

      setIsClockActionRunning(true);
      setErrorText('');
      setStatusText('Clocking in...');

      await postTimesheetAction(selectedTenant, token, '/api/timesheets/clock-in');
      await refreshTimesheets(selectedTenant, token, { silent: true });

      setActiveTab('timesheets');
      setStatusText('Clocked in successfully.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
      setStatusText('Could not clock in.');
    } finally {
      setIsClockActionRunning(false);
      setIsRefreshingTimesheets(false);
    }
  }

  async function handleClockOut() {
    try {
      if (!token || !selectedTenant) {
        setStatusText('You must be logged in.');
        return;
      }

      setIsClockActionRunning(true);
      setErrorText('');
      setStatusText('Clocking out...');

      await postTimesheetAction(selectedTenant, token, '/api/timesheets/clock-out');
      await refreshTimesheets(selectedTenant, token, { silent: true });

      setActiveTab('timesheets');
      setStatusText('Clocked out successfully.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
      setStatusText('Could not clock out.');
    } finally {
      setIsClockActionRunning(false);
      setIsRefreshingTimesheets(false);
    }
  }

  async function logout() {
    try {
      setIsWorking(true);

      if (token && selectedTenant) {
        const csrfToken = await getCsrfToken(selectedTenant);

        await fetch(`${API_BASE_URL}/api/mobile/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-CSRF-Token': csrfToken,
            'X-Tenant-Subdomain': selectedTenant,
            Accept: 'application/json',
          },
        });
      }
    } catch {
      // ignore logout errors
    } finally {
      await clearSavedAuth();
      setToken('');
      setJobs([]);
      setSelectedJob(null);
      resetTimesheetsState();
      setPassword('');
      setEmail('');
      setSelectedTenant('');
      setTenant('');
      setActiveTab('jobs');
      setErrorText('');
      setStatusText('Signed out.');
      setIsWorking(false);
      setIsRefreshingJobs(false);
      setIsRefreshingTimesheets(false);
      setIsClockActionRunning(false);
    }
  }

  const isLoggedIn = !!token;
  const canUseSelfClock = !!timesheetScope?.canUseSelfClock;
  const hasActiveClock = !!activeClockEntry;

  if (isBooting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 16 }}>{statusText}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedJob) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <TouchableOpacity
            onPress={closeJobDetail}
            style={{
              backgroundColor: '#1E3A5F',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
              Back to Jobs
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
            {selectedJob.jobName || 'Unnamed Job'}
          </Text>

          <Text style={{ fontSize: 16, marginBottom: 20 }}>
            {selectedJob.clientName || '—'}
          </Text>

          <View
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Job Info
            </Text>
            <Text>Job Code: {selectedJob.jobCode || '—'}</Text>
            <Text>Status: {selectedJob.status || '—'}</Text>
            <Text>Start Date: {formatDate(selectedJob.startDate)}</Text>
            <Text>Sold By: {selectedJob.soldBy || '—'}</Text>
            <Text>Commission: {formatPercent(selectedJob.commissionPercent)}</Text>
            <Text>Contract Amount: {formatMoney(selectedJob.contractAmount)}</Text>
            <Text>Retainage: {formatPercent(selectedJob.retainagePercent)}</Text>
            <Text>
              Source Estimate Number: {selectedJob.sourceEstimateNumber || '—'}
            </Text>
            <Text>
              Source Estimate Customer: {selectedJob.sourceEstimateCustomerName || '—'}
            </Text>
          </View>

          <View
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Description
            </Text>
            <Text>{selectedJob.jobDescription || '—'}</Text>
          </View>

          <View
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Financials
            </Text>
            <Text>
              Total Income: {formatMoney(selectedJob.financials?.totalIncome)}
            </Text>
            <Text>
              Total Expenses: {formatMoney(selectedJob.financials?.totalExpenses)}
            </Text>
            <Text>
              Total Labor: {formatMoney(selectedJob.financials?.totalLabor)}
            </Text>
            <Text>Total Hours: {Number(selectedJob.financials?.totalHours ?? 0).toFixed(2)}</Text>
            <Text>
              Total Costs: {formatMoney(selectedJob.financials?.totalCosts)}
            </Text>
            <Text>
              Total Invoiced: {formatMoney(selectedJob.financials?.totalInvoiced)}
            </Text>
            <Text>
              Total Collected: {formatMoney(selectedJob.financials?.totalCollected)}
            </Text>
            <Text>
              Unpaid Invoices: {Number(selectedJob.financials?.unpaidInvoices ?? 0)}
            </Text>
            <Text>
              Unpaid Invoice Balance: {formatMoney(selectedJob.financials?.unpaidInvoiceBalance)}
            </Text>
            <Text>
              Remaining Contract: {formatMoney(selectedJob.financials?.remainingContract)}
            </Text>
            <Text>
              Profit: {formatMoney(selectedJob.financials?.profit)}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
          Hudson Business Solutions
        </Text>

        <Text style={{ fontSize: 16, marginBottom: 16 }}>{statusText}</Text>

        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Company Subdomain
        </Text>

        <TextInput
          value={tenant}
          onChangeText={setTenant}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoggedIn && !isWorking}
          placeholder="Example: taylors"
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            marginBottom: 12,
            opacity: isLoggedIn ? 0.7 : 1,
          }}
        />

        {!isLoggedIn ? (
          <TouchableOpacity
            onPress={continueToLogin}
            disabled={isWorking}
            style={{
              backgroundColor: '#1E3A5F',
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 10,
              marginBottom: 20,
              opacity: isWorking ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
              Continue
            </Text>
          </TouchableOpacity>
        ) : null}

        {selectedTenant ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Email
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isLoggedIn && !isWorking}
              placeholder="you@company.com"
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
                marginBottom: 12,
                opacity: isLoggedIn ? 0.7 : 1,
              }}
            />

            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Password
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoggedIn && !isWorking}
              placeholder="Password"
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
                marginBottom: 12,
                opacity: isLoggedIn ? 0.7 : 1,
              }}
            />

            {!isLoggedIn ? (
              <TouchableOpacity
                onPress={loginAndLoadData}
                disabled={isWorking}
                style={{
                  backgroundColor: '#0F766E',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  marginBottom: 12,
                  opacity: isWorking ? 0.7 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
                  {isWorking ? 'Logging In...' : 'Log In'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={logout}
                disabled={isWorking}
                style={{
                  backgroundColor: '#7F1D1D',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  marginBottom: 12,
                  opacity: isWorking ? 0.7 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
                  {isWorking ? 'Signing Out...' : 'Log Out'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {errorText ? (
          <View style={{ marginBottom: 20, padding: 12, borderWidth: 1, borderColor: '#ccc' }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Error</Text>
            <Text>{errorText}</Text>
          </View>
        ) : null}

        {isLoggedIn ? (
          <View style={{ flexDirection: 'row', marginBottom: 20, gap: 12 }}>
            <TouchableOpacity
              onPress={() => setActiveTab('jobs')}
              style={{
                flex: 1,
                backgroundColor: activeTab === 'jobs' ? '#1E3A5F' : '#E5E7EB',
                paddingVertical: 12,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: '700',
                  color: activeTab === 'jobs' ? '#fff' : '#111827',
                }}
              >
                Jobs
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('timesheets')}
              style={{
                flex: 1,
                backgroundColor: activeTab === 'timesheets' ? '#1E3A5F' : '#E5E7EB',
                paddingVertical: 12,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: '700',
                  color: activeTab === 'timesheets' ? '#fff' : '#111827',
                }}
              >
                Timesheets
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {activeTab === 'jobs' ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '600' }}>Jobs</Text>

              {isLoggedIn ? (
                <TouchableOpacity
                  onPress={handleRefreshJobs}
                  disabled={isRefreshingJobs || isLoadingJobDetail}
                >
                  <Text style={{ color: '#1E3A5F', fontWeight: '700' }}>
                    {isRefreshingJobs ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {isLoadingJobDetail ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 12, textAlign: 'center' }}>
                  Loading job details...
                </Text>
              </View>
            ) : jobs.length === 0 ? (
              <Text>No jobs loaded yet.</Text>
            ) : (
              jobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  onPress={() => openJobDetail(job.id)}
                  style={{
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 10,
                    backgroundColor: '#fff',
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '600' }}>
                    {job.jobName || 'Unnamed Job'}
                  </Text>
                  <Text>Job Code: {job.jobCode || '—'}</Text>
                  <Text>Client: {job.clientName || '—'}</Text>
                  <Text>Status: {job.status || '—'}</Text>
                  <Text style={{ marginTop: 8, color: '#1E3A5F', fontWeight: '600' }}>
                    Tap to view details
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '600' }}>Timesheets</Text>

              {isLoggedIn ? (
                <TouchableOpacity
                  onPress={handleRefreshTimesheets}
                  disabled={isRefreshingTimesheets || isClockActionRunning}
                >
                  <Text style={{ color: '#1E3A5F', fontWeight: '700' }}>
                    {isRefreshingTimesheets ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
                This Week
              </Text>
              <Text>Entries: {Number(timesheetSummary?.entryCount ?? 0)}</Text>
              <Text>Total Hours: {formatHours(timesheetSummary?.totalHours)}</Text>
              <Text>
                Week Approved: {timesheetSummary?.weekApproved ? 'Yes' : 'No'}
              </Text>
              <Text>Approved At: {formatDateTime(timesheetSummary?.approvedAt)}</Text>
              <Text>Approved By: {timesheetSummary?.approvedByName || '—'}</Text>
              <Text>Week Start: {formatDate(timesheetScope?.start)}</Text>
              <Text>Week End: {formatDate(timesheetScope?.end)}</Text>
            </View>

            <View
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: hasActiveClock ? '#0F766E' : '#ddd',
                borderRadius: 10,
                marginBottom: 16,
                backgroundColor: hasActiveClock ? '#F0FDF4' : '#fff',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
                Clock Status
              </Text>

              {hasActiveClock ? (
                <>
                  <Text>Status: Clocked In</Text>
                  <Text>Clock In Time: {formatDateTime(activeClockEntry?.clockInAt)}</Text>
                  <Text>Job: {activeClockEntry?.jobName || 'No job selected'}</Text>
                </>
              ) : (
                <Text>Status: Not clocked in</Text>
              )}

              {!canUseSelfClock ? (
                <Text style={{ marginTop: 12 }}>
                  Self clock is not available for this account.
                </Text>
              ) : hasActiveClock ? (
                <TouchableOpacity
                  onPress={handleClockOut}
                  disabled={isClockActionRunning}
                  style={{
                    backgroundColor: '#7F1D1D',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    marginTop: 16,
                    opacity: isClockActionRunning ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
                    {isClockActionRunning ? 'Clocking Out...' : 'Clock Out'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleClockIn}
                  disabled={isClockActionRunning}
                  style={{
                    backgroundColor: '#0F766E',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    marginTop: 16,
                    opacity: isClockActionRunning ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
                    {isClockActionRunning ? 'Clocking In...' : 'Clock In'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
                Recent Entries
              </Text>

              {isRefreshingTimesheets ? (
                <View style={{ paddingVertical: 12 }}>
                  <ActivityIndicator size="small" />
                  <Text style={{ marginTop: 10, textAlign: 'center' }}>
                    Loading timesheets...
                  </Text>
                </View>
              ) : timesheets.length === 0 ? (
                <Text>No timesheet entries found for this week.</Text>
              ) : (
                timesheets.map((entry) => (
                  <View
                    key={entry.id}
                    style={{
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: '#eee',
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                      {entry.date || 'No date'}
                    </Text>
                    <Text>Job: {entry.jobName || '—'}</Text>
                    <Text>Hours: {formatHours(entry.hours)}</Text>
                    <Text>Method: {entry.entryMethod || '—'}</Text>
                    <Text>Status: {entry.approvalStatus || '—'}</Text>
                    <Text>Clock In: {formatDateTime(entry.clockInAt)}</Text>
                    <Text>Clock Out: {formatDateTime(entry.clockOutAt)}</Text>
                    <Text>Note: {entry.note || '—'}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
