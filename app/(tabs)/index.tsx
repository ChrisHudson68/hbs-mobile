import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const CONFIG = {
  API_BASE_URL: 'https://hudson-business-solutions.com',
};

const STORAGE_KEYS = {
  tenant: 'hbs_mobile_tenant',
  token: 'hbs_mobile_token',
  user: 'hbs_mobile_user',
} as const;

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
};

type Tenant = {
  id: number;
  name: string;
  subdomain: string;
  logoPath: string | null;
};

type LoginResponse = {
  ok: true;
  token: string;
  expiresAt: string;
  user: User;
  tenant: Tenant;
};

type JobListItem = {
  id: number;
  jobName: string;
  customerName: string | null;
  status: string | null;
  description: string | null;
  sourceEstimateId?: number | null;
  sourceEstimateCustomerName?: string | null;
  financials?: {
    totalIncome: number;
    totalExpenses: number;
    totalLabor: number;
    totalHours: number;
    totalCosts: number;
    totalInvoiced: number;
    totalCollected: number;
    unpaidInvoices: number;
    unpaidInvoiceBalance: number;
    remainingContract: number;
    profit: number;
  };
};

type JobsResponse = {
  ok: boolean;
  jobs?: JobListItem[];
  error?: string;
};

type JobDetailResponse = {
  ok: boolean;
  job?: JobListItem;
  error?: string;
};

type ClockInJobOption = {
  id: number;
  jobName: string;
  jobCode: string | null;
  clientName: string | null;
  status: string | null;
};

type ClockInJobsResponse = {
  ok: boolean;
  jobs?: ClockInJobOption[];
  error?: string;
};

type TimesheetEntry = {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  jobId: number | null;
  jobName: string | null;
  hours: number;
  note: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  entryMethod: string | null;
  approvalStatus: string | null;
  hasPendingEditRequest: boolean;
};

type TimesheetsResponse = {
  ok: boolean;
  scope?: {
    employeeId: number;
    start: string;
    end: string;
    isEmployeeUser: boolean;
    canApproveTime: boolean;
    canUseSelfClock: boolean;
  };
  summary?: {
    entryCount: number;
    totalHours: number;
    weekApproved: boolean;
    approvedAt: string | null;
    approvedByName: string | null;
  };
  activeClockEntry?: {
    id: number;
    jobId: number | null;
    jobName: string | null;
    clockInAt: string;
  } | null;
  timesheets?: TimesheetEntry[];
  error?: string;
};

type ClockOutResponse = {
  ok: boolean;
  entry?: {
    id: number;
    jobId: number | null;
    jobName: string | null;
    clockInAt: string;
    clockOutAt: string;
    hours: number;
    note: string | null;
  };
  error?: string;
};

type UploadedReceipt = {
  receiptFilename: string;
  status: string | null;
  ocrEngine: string | null;
  errorMessage: string | null;
  hasSuggestions: boolean;
  parsed?: {
    merchantName?: string;
    totalAmount?: number;
    subtotalAmount?: number;
    taxAmount?: number;
    receiptDate?: string;
    receiptNumber?: string;
    paymentMethodLast4?: string;
  } | null;
};

type UploadReceiptResponse = {
  ok: boolean;
  receipt?: UploadedReceipt;
  error?: string;
};

type CreateExpenseResponse = {
  ok: boolean;
  expense?: {
    id: number;
    jobId: number;
    category: string;
    vendor: string | null;
    amount: number;
    date: string;
    receiptFilename: string | null;
    receiptOcrStatus: string | null;
  };
  error?: string;
};

type ReceiptAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

type AppTab = 'jobs' | 'timesheets' | 'expenses';

function hasPermission(user: User | null, permission: string) {
  return Array.isArray(user?.permissions) && user!.permissions.includes(permission);
}

function isManagerOrAdmin(user: User | null) {
  return user?.role === 'Admin' || user?.role === 'Manager';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatHours(hours: number | null | undefined) {
  return `${Number(hours || 0).toFixed(2)} hrs`;
}

function formatCurrency(amount: number | null | undefined) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

function getWeekStart(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function getEntryDurationSeconds(
  entry:
    | TimesheetEntry
    | {
        id: number;
        date?: string;
        clockInAt: string | null;
        clockOutAt: string | null;
      },
  now: Date,
) {
  if (!entry.clockInAt) return 0;

  const start = new Date(entry.clockInAt);
  if (Number.isNaN(start.getTime())) return 0;

  const end = entry.clockOutAt ? new Date(entry.clockOutAt) : now;
  if (Number.isNaN(end.getTime())) return 0;

  const diff = (end.getTime() - start.getTime()) / 1000;
  return diff > 0 ? diff : 0;
}

function buildTimesheetMetrics(
  entries: TimesheetEntry[],
  activeClockEntry: TimesheetsResponse['activeClockEntry'] | null,
) {
  const now = new Date();
  const todayKey = now.toDateString();
  const weekStart = getWeekStart(now).getTime();

  const mergedEntries: Array<{
    id: number;
    date?: string;
    clockInAt: string | null;
    clockOutAt: string | null;
  }> = [...entries];

  if (activeClockEntry?.id && !mergedEntries.some((entry) => entry.id === activeClockEntry.id)) {
    mergedEntries.push({
      id: activeClockEntry.id,
      date: activeClockEntry.clockInAt.slice(0, 10),
      clockInAt: activeClockEntry.clockInAt,
      clockOutAt: null,
    });
  }

  let todaySeconds = 0;
  let weekSeconds = 0;

  for (const entry of mergedEntries) {
    if (!entry.clockInAt) continue;

    const start = new Date(entry.clockInAt);
    if (Number.isNaN(start.getTime())) continue;

    const durationSeconds = getEntryDurationSeconds(entry, now);

    if (start.toDateString() === todayKey) {
      todaySeconds += durationSeconds;
    }

    if (start.getTime() >= weekStart) {
      weekSeconds += durationSeconds;
    }
  }

  return {
    todayHours: todaySeconds / 3600,
    weekHours: weekSeconds / 3600,
  };
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.trim().slice(0, 120);
    throw new Error(
      snippet
        ? `Server returned a non-JSON response: ${snippet}`
        : 'Server returned a non-JSON response.',
    );
  }
}

function errorMessageFromCode(error?: string) {
  switch (error) {
    case 'tenant_required':
      return 'Tenant is required. Confirm your tenant subdomain and try again.';
    case 'invalid_login':
      return 'Login failed. Check your email and password.';
    case 'employee_required':
      return 'Your user is not linked to an employee record yet.';
    case 'already_clocked_in':
      return 'You are already clocked in.';
    case 'not_clocked_in':
      return 'You are not currently clocked in.';
    case 'invalid_job':
      return 'That job is no longer valid. Refresh jobs and try again.';
    case 'job_not_found':
      return 'That job could not be found.';
    case 'unauthorized':
      return 'Your session is no longer valid. Please sign in again.';
    case 'receipt_required':
      return 'Please select a receipt image first.';
    default:
      return error ? `Request failed: ${error}` : 'Something went wrong. Please try again.';
  }
}

function inferMimeTypeFromUri(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function buildUploadFileName(uri: string) {
  const lastSegment = uri.split('/').pop()?.trim();
  if (lastSegment && lastSegment.includes('.')) {
    return lastSegment;
  }

  const mime = inferMimeTypeFromUri(uri);
  const extension =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'image/heic'
          ? 'heic'
          : 'jpg';

  return `receipt-${Date.now()}.${extension}`;
}

export default function IndexScreen() {
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
  const [clockInJobs, setClockInJobs] = useState<ClockInJobOption[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [expenseSaving, setExpenseSaving] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(formatDateInputValue(new Date()));
  const [expenseJobId, setExpenseJobId] = useState<number | null>(null);
  const [expenseReceiptAsset, setExpenseReceiptAsset] = useState<ReceiptAsset | null>(null);
  const [uploadedReceipt, setUploadedReceipt] = useState<UploadedReceipt | null>(null);
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

  const timesheetMetrics = useMemo(
    () => buildTimesheetMetrics(timesheetEntries, activeClockEntry),
    [timesheetEntries, activeClockEntry],
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
    setExpenseCategory('');
    setExpenseVendor('');
    setExpenseAmount('');
    setExpenseDate(formatDateInputValue(new Date()));
    setExpenseJobId(null);
    setExpenseReceiptAsset(null);
    setUploadedReceipt(null);
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

  const handleUnauthorized = useCallback(async () => {
    await clearSession();
    setToken('');
    setUser(null);
    setTenantSubdomain('');
    resetAuthenticatedState();
    Alert.alert('Session expired', 'Please sign in again.');
  }, [clearSession, resetAuthenticatedState]);

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const headers = new Headers(options?.headers || {});
      headers.set('X-Tenant-Subdomain', tenantSubdomain);

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
        ...options,
        headers,
      });

      const data = await parseJsonResponse(response);

      if (response.status === 401 || data?.error === 'unauthorized') {
        await handleUnauthorized();
        throw new Error('unauthorized');
      }

      if (!response.ok || data?.ok === false) {
        throw new Error(errorMessageFromCode(data?.error));
      }

      return data;
    },
    [handleUnauthorized, tenantSubdomain, token],
  );

  const loadJobs = useCallback(
    async (isRefresh = false) => {
      if (!isAuthenticated || !canViewJobs) return;

      if (isRefresh) {
        setJobsRefreshing(true);
      } else {
        setJobsLoading(true);
      }

      try {
        const data = (await apiFetch('/api/jobs')) as JobsResponse;
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
    [apiFetch, canViewJobs, clockInJobId, expenseJobId, isAuthenticated, selectedJobId],
  );

  const loadClockInJobs = useCallback(
    async (isRefresh = false) => {
      if (!isAuthenticated || !canClockTime || canViewJobs) return;

      if (!isRefresh) {
        setClockInJobsLoading(true);
      }

      try {
        const data = (await apiFetch('/api/timesheets/clock-in-jobs')) as ClockInJobsResponse;
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
    [apiFetch, canClockTime, canViewJobs, clockInJobId, isAuthenticated],
  );

  const loadJobDetail = useCallback(
    async (jobId: number) => {
      if (!isAuthenticated || !canViewJobs) return;

      setJobDetailLoading(true);
      try {
        const data = (await apiFetch(`/api/jobs/${jobId}`)) as JobDetailResponse;
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
    [apiFetch, canViewJobs, isAuthenticated],
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
        const data = (await apiFetch('/api/timesheets')) as TimesheetsResponse;
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
    [apiFetch, isAuthenticated],
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
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/mobile/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Subdomain': cleanedTenant,
        },
        body: JSON.stringify({ email: cleanedEmail, password }),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok || !data?.ok) {
        throw new Error(errorMessageFromCode(data?.error));
      }

      const payload = data as LoginResponse;
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
        await fetch(`${CONFIG.API_BASE_URL}/api/mobile/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Subdomain': tenantSubdomain,
            Authorization: `Bearer ${token}`,
          },
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
      await apiFetch('/api/timesheets/clock-in', {
        method: 'POST',
        body: JSON.stringify({
          jobId: clockInJobId ?? undefined,
        }),
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
  }, [apiFetch, clockInJobId, isAuthenticated, loadTimesheets, selectedClockInJob]);

  const handleClockOut = useCallback(async () => {
    if (!isAuthenticated) return;

    setClockActionLoading(true);
    try {
      const data = (await apiFetch('/api/timesheets/clock-out', {
        method: 'POST',
        body: JSON.stringify({}),
      })) as ClockOutResponse;
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
  }, [apiFetch, isAuthenticated, loadTimesheets]);

  const handlePickReceipt = useCallback(async () => {
    if (!canManageMobileExpenses) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Photo library permission is required to select a receipt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      selectionLimit: 1,
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
      } as unknown as Blob);

      if (uploadedReceipt?.receiptFilename) {
        formData.append('pendingReceiptFilename', uploadedReceipt.receiptFilename);
      }

      const data = (await apiFetch('/api/expenses/upload-receipt', {
        method: 'POST',
        body: formData,
      })) as UploadReceiptResponse;

      if (!data.receipt) {
        throw new Error('Receipt upload did not return a saved receipt.');
      }

      setUploadedReceipt(data.receipt);

      if (!expenseVendor.trim() && data.receipt.parsed?.merchantName) {
        setExpenseVendor(data.receipt.parsed.merchantName);
      }

      if (!expenseAmount.trim() && typeof data.receipt.parsed?.totalAmount === 'number') {
        setExpenseAmount(Number(data.receipt.parsed.totalAmount).toFixed(2));
      }

      if (!expenseDate.trim() && data.receipt.parsed?.receiptDate) {
        setExpenseDate(data.receipt.parsed.receiptDate);
      }

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
  }, [apiFetch, canManageMobileExpenses, expenseAmount, expenseDate, expenseReceiptAsset, expenseVendor, uploadedReceipt]);

  const handleSaveExpense = useCallback(async () => {
    if (!canManageMobileExpenses) return;

    if (!expenseJobId) {
      Alert.alert('Job Required', 'Select a job for this expense.');
      return;
    }

    if (!expenseCategory.trim()) {
      Alert.alert('Category Required', 'Enter an expense category.');
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

    setExpenseSaving(true);
    try {
      const data = (await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          jobId: expenseJobId,
          category: expenseCategory.trim(),
          vendor: expenseVendor.trim() || undefined,
          amount: expenseAmount.trim(),
          date: expenseDate.trim(),
          receiptFilename: uploadedReceipt?.receiptFilename,
        }),
      })) as CreateExpenseResponse;

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
    apiFetch,
    canManageMobileExpenses,
    expenseAmount,
    expenseCategory,
    expenseDate,
    expenseJobId,
    expenseVendor,
    resetExpenseForm,
    selectedExpenseJob?.jobName,
    uploadedReceipt?.receiptFilename,
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
    if (!isAuthenticated || activeTab !== 'timesheets') return;
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
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.authScrollContent}>
          <View style={styles.authCard}>
            <Text style={styles.brandEyebrow}>Mobile</Text>
            <Text style={styles.authTitle}>Hudson Business Solutions</Text>
            <Text style={styles.authSubtitle}>
              Sign in with your company subdomain, email, and password.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Company Subdomain</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authLoading}
                onChangeText={(value) => {
                  setTenantInput(value);
                  setTenantSubdomain('');
                }}
                placeholder="taylorsreno"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                value={tenantInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authLoading}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authLoading}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#9AA5B1"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            <Pressable disabled={authLoading} onPress={() => void handleLogin()} style={styles.primaryButton}>
              {authLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (selectedJob) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.screenContent}>
          <Pressable onPress={() => setSelectedJob(null)} style={styles.secondaryButton}>
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
                <Pressable
                  onPress={() => {
                    setClockInJobId(selectedJob.id);
                    setSelectedJob(null);
                    setActiveTab('timesheets');
                  }}
                  style={styles.primaryButton}
                >
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
                        ${Number(selectedJob.financials.totalIncome || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Expenses</Text>
                      <Text style={styles.metricValue}>
                        ${Number(selectedJob.financials.totalExpenses || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Labor</Text>
                      <Text style={styles.metricValue}>
                        ${Number(selectedJob.financials.totalLabor || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Profit</Text>
                      <Text style={styles.metricValue}>
                        ${Number(selectedJob.financials.profit || 0).toFixed(2)}
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl
            refreshing={
              activeTab === 'jobs'
                ? jobsRefreshing
                : activeTab === 'expenses'
                  ? jobsRefreshing
                  : timesheetsRefreshing
            }
            onRefresh={() => {
              if (activeTab === 'jobs') {
                void loadJobs(true);
              } else if (activeTab === 'expenses') {
                void loadJobs(true);
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
              This mobile app is limited to clock in, clock out, and viewing your recent time entries.
            </Text>
          </View>
        ) : null}

        <View style={styles.tabBar}>
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
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'timesheets' && styles.tabButtonTextActive,
              ]}
            >
              Timesheets
            </Text>
          </Pressable>

          {!isEmployeeClockOnly && canManageMobileExpenses ? (
            <Pressable
              onPress={() => setActiveTab('expenses')}
              style={[styles.tabButton, activeTab === 'expenses' && styles.tabButtonActive]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'expenses' && styles.tabButtonTextActive,
                ]}
              >
                Expenses
              </Text>
            </Pressable>
          ) : null}
        </View>

        {activeTab === 'jobs' && !isEmployeeClockOnly ? (
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
                <Pressable key={job.id} onPress={() => void loadJobDetail(job.id)} style={styles.listItem}>
                  <Text style={styles.listItemTitle}>{job.jobName}</Text>
                  <Text style={styles.listItemMeta}>Customer: {job.customerName || '—'}</Text>
                  <Text style={styles.listItemMeta}>Status: {job.status || '—'}</Text>
                  {clockInJobId === job.id ? (
                    <Text style={styles.selectedTag}>Selected for clock-in</Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'timesheets' ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Timesheets</Text>
              <Text style={styles.heroMeta}>Week total: {formatHours(timesheetMetrics.weekHours)}</Text>
              <Text style={styles.heroMeta}>Today: {formatHours(timesheetMetrics.todayHours)}</Text>
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
                        <Text
                          style={[
                            styles.choiceChipText,
                            clockInJobId === job.id && styles.choiceChipTextActive,
                          ]}
                        >
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
                      {selectedClockInJob?.clientName
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
                          <Text
                            style={[
                              styles.choiceChipText,
                              clockInJobId === job.id && styles.choiceChipTextActive,
                            ]}
                          >
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
                    onPress={() => void handleClockOut()}
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
                    onPress={() => void handleClockIn()}
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
        ) : null}

        {activeTab === 'expenses' && !isEmployeeClockOnly && canManageMobileExpenses ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Expenses</Text>
              <Text style={styles.heroMeta}>Managers and admins only</Text>
              <Text style={styles.heroMeta}>Upload a receipt, review OCR suggestions, and save the expense.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Receipt</Text>
              <Text style={styles.cardBody}>
                Select a receipt image first, then upload it to run OCR before saving the expense.
              </Text>

              {expenseReceiptAsset ? (
                <View style={styles.receiptPreviewCard}>
                  <Image source={{ uri: expenseReceiptAsset.uri }} style={styles.receiptPreviewImage} />
                  <Text style={styles.selectionValue}>{expenseReceiptAsset.name}</Text>
                  <Text style={styles.selectionHelper}>{expenseReceiptAsset.mimeType}</Text>
                </View>
              ) : (
                <Text style={styles.emptyText}>No receipt selected yet.</Text>
              )}

              <View style={styles.buttonRow}>
                <Pressable onPress={() => void handlePickReceipt()} style={styles.secondaryActionButton}>
                  <Text style={styles.secondaryActionButtonText}>Pick Receipt</Text>
                </Pressable>

                <Pressable
                  disabled={receiptUploading || !expenseReceiptAsset}
                  onPress={() => void handleUploadReceipt()}
                  style={[
                    styles.primaryButtonCompact,
                    (!expenseReceiptAsset || receiptUploading) && styles.buttonDisabled,
                  ]}
                >
                  {receiptUploading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Upload Receipt</Text>
                  )}
                </Pressable>
              </View>

              {uploadedReceipt ? (
                <View style={styles.selectionBox}>
                  <Text style={styles.selectionLabel}>OCR Status</Text>
                  <Text style={styles.selectionValue}>{uploadedReceipt.status || 'Processed'}</Text>
                  <Text style={styles.selectionHelper}>
                    Engine: {uploadedReceipt.ocrEngine || '—'}
                    {uploadedReceipt.errorMessage ? ` • ${uploadedReceipt.errorMessage}` : ''}
                  </Text>
                  {uploadedReceipt.parsed?.merchantName ? (
                    <Text style={styles.listItemMeta}>Merchant: {uploadedReceipt.parsed.merchantName}</Text>
                  ) : null}
                  {typeof uploadedReceipt.parsed?.totalAmount === 'number' ? (
                    <Text style={styles.listItemMeta}>
                      OCR Total: {formatCurrency(uploadedReceipt.parsed.totalAmount)}
                    </Text>
                  ) : null}
                  {uploadedReceipt.parsed?.receiptDate ? (
                    <Text style={styles.listItemMeta}>
                      OCR Date: {uploadedReceipt.parsed.receiptDate}
                    </Text>
                  ) : null}
                  {uploadedReceipt.parsed?.receiptNumber ? (
                    <Text style={styles.listItemMeta}>
                      Receipt #: {uploadedReceipt.parsed.receiptNumber}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Expense Details</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Job</Text>
                <View style={styles.selectionBox}>
                  <Text style={styles.selectionLabel}>Current selection</Text>
                  <Text style={styles.selectionValue}>
                    {selectedExpenseJob ? selectedExpenseJob.jobName : 'No job selected'}
                  </Text>
                  <Text style={styles.selectionHelper}>
                    {selectedExpenseJob?.customerName
                      ? `Customer: ${selectedExpenseJob.customerName}`
                      : 'Select the job this expense belongs to.'}
                  </Text>
                </View>

                {jobsLoading ? (
                  <View style={styles.centeredStateCompact}>
                    <ActivityIndicator size="small" color="#1E3A5F" />
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {jobs.map((job) => (
                      <Pressable
                        key={job.id}
                        onPress={() => setExpenseJobId(job.id)}
                        style={[styles.choiceChip, expenseJobId === job.id && styles.choiceChipActive]}
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            expenseJobId === job.id && styles.choiceChipTextActive,
                          ]}
                        >
                          {job.jobName}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Category</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="Materials, Fuel, Equipment Rental..."
                  placeholderTextColor="#9AA5B1"
                  style={styles.input}
                  value={expenseCategory}
                  onChangeText={setExpenseCategory}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Vendor</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="Vendor name"
                  placeholderTextColor="#9AA5B1"
                  style={styles.input}
                  value={expenseVendor}
                  onChangeText={setExpenseVendor}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9AA5B1"
                  style={styles.input}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9AA5B1"
                  style={styles.input}
                  value={expenseDate}
                  onChangeText={setExpenseDate}
                />
              </View>

              <View style={styles.buttonRow}>
                <Pressable onPress={resetExpenseForm} style={styles.secondaryActionButton}>
                  <Text style={styles.secondaryActionButtonText}>Reset Form</Text>
                </Pressable>

                <Pressable
                  disabled={expenseSaving}
                  onPress={() => void handleSaveExpense()}
                  style={[styles.primaryButtonCompact, expenseSaving && styles.buttonDisabled]}
                >
                  {expenseSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save Expense</Text>
                  )}
                </Pressable>
              </View>

              {lastSavedExpenseId ? (
                <Text style={styles.helperText}>Last saved expense ID: #{lastSavedExpenseId}</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  screenContent: {
    padding: 16,
    gap: 16,
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 18,
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    gap: 10,
  },
  restrictedBanner: {
    backgroundColor: '#FFF7E6',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F7D070',
    gap: 6,
  },
  restrictedBannerTitle: {
    color: '#7C5A03',
    fontSize: 16,
    fontWeight: '800',
  },
  restrictedBannerBody: {
    color: '#8D6E08',
    fontSize: 14,
    lineHeight: 20,
  },
  brandEyebrow: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  authTitle: {
    color: '#102A43',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  authSubtitle: {
    color: '#52606D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 14,
    gap: 6,
  },
  label: {
    color: '#243B53',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#102A43',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonCompact: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BCCCDC',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#1E3A5F',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BCCCDC',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
  },
  secondaryActionButtonText: {
    color: '#1E3A5F',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  helperText: {
    color: '#7B8794',
    fontSize: 13,
  },
  selectedTag: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  loadingText: {
    marginTop: 12,
    color: '#52606D',
    fontSize: 15,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centeredStateCompact: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  screenTitle: {
    color: '#102A43',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  screenSubtitle: {
    color: '#52606D',
    fontSize: 14,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  logoutButtonText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EAF1F7',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabButtonText: {
    color: '#52606D',
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#1E3A5F',
  },
  listItem: {
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  listItemTitle: {
    color: '#102A43',
    fontSize: 16,
    fontWeight: '800',
  },
  listItemMeta: {
    color: '#52606D',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: '#7B8794',
    fontSize: 14,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroMeta: {
    color: '#D9E2EC',
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: '#102A43',
    fontSize: 18,
    fontWeight: '800',
  },
  cardBody: {
    color: '#52606D',
    fontSize: 14,
    lineHeight: 20,
  },
  detailRow: {
    color: '#243B53',
    fontSize: 14,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: '#52606D',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#102A43',
    fontSize: 18,
    fontWeight: '800',
  },
  selectionBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  selectionLabel: {
    color: '#52606D',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selectionValue: {
    color: '#102A43',
    fontSize: 16,
    fontWeight: '800',
  },
  selectionHelper: {
    color: '#7B8794',
    fontSize: 13,
    lineHeight: 18,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: '#BCCCDC',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  choiceChipActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  choiceChipText: {
    color: '#243B53',
    fontSize: 13,
    fontWeight: '700',
  },
  choiceChipTextActive: {
    color: '#FFFFFF',
  },
  receiptPreviewCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  receiptPreviewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
});