import {
    DashboardMetrics,
    JobListItem,
    TimesheetEntry,
    TimesheetsResponse,
    UploadedReceipt,
    User,
} from './types';

export function hasPermission(user: User | null, permission: string) {
  return Array.isArray(user?.permissions) && user!.permissions.includes(permission);
}

export function isManagerOrAdmin(user: User | null) {
  return user?.role === 'Admin' || user?.role === 'Manager';
}

export function normalizeStatus(status: string | null | undefined) {
  return String(status || '').trim().toLowerCase();
}

export function isOnHoldStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return normalized.includes('hold');
}

export function isCompletedStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return normalized === 'completed' || normalized === 'complete';
}

export function isCancelledStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return normalized === 'cancelled' || normalized === 'canceled';
}

export function isActiveStatus(status: string | null | undefined) {
  return !isOnHoldStatus(status) && !isCompletedStatus(status) && !isCancelledStatus(status);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

export function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatHours(hours: number | null | undefined) {
  return `${Number(hours || 0).toFixed(2)} hrs`;
}

export function formatCurrency(amount: number | null | undefined) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

export function getWeekStart(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

export function getEntryDurationSeconds(
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

export function buildTimesheetMetrics(
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

export function buildDashboardMetrics(jobs: JobListItem[]): DashboardMetrics {
  let activeJobsCount = 0;
  let onHoldJobsCount = 0;
  let completedJobsCount = 0;
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalLabor = 0;
  let totalCosts = 0;
  let totalCollected = 0;
  let totalInvoiced = 0;
  let unpaidBalance = 0;
  let totalProfit = 0;
  let totalHours = 0;

  for (const job of jobs) {
    const status = job.status;

    if (isActiveStatus(status)) {
      activeJobsCount += 1;
    } else if (isOnHoldStatus(status)) {
      onHoldJobsCount += 1;
    } else if (isCompletedStatus(status)) {
      completedJobsCount += 1;
    }

    const financials = job.financials;
    if (!financials) continue;

    totalIncome += Number(financials.totalIncome || 0);
    totalExpenses += Number(financials.totalExpenses || 0);
    totalLabor += Number(financials.totalLabor || 0);
    totalCosts += Number(financials.totalCosts || 0);
    totalCollected += Number(financials.totalCollected || 0);
    totalInvoiced += Number(financials.totalInvoiced || 0);
    unpaidBalance += Number(financials.unpaidInvoiceBalance || 0);
    totalProfit += Number(financials.profit || 0);
    totalHours += Number(financials.totalHours || 0);
  }

  return {
    jobsCount: jobs.length,
    activeJobsCount,
    onHoldJobsCount,
    completedJobsCount,
    totalIncome,
    totalExpenses,
    totalLabor,
    totalCosts,
    totalCollected,
    totalInvoiced,
    unpaidBalance,
    totalProfit,
    totalHours,
    averageProfitPerJob: jobs.length > 0 ? totalProfit / jobs.length : 0,
  };
}

export async function parseJsonResponse(response: Response) {
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

export function errorMessageFromCode(error?: string) {
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
    case 'receipt_required':
      return 'Please select a receipt image before uploading.';
    case 'unauthorized':
      return 'Your session is no longer valid. Please sign in again.';
    default:
      return error ? `Request failed: ${error}` : 'Something went wrong. Please try again.';
  }
}

export function inferMimeTypeFromUri(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export function buildUploadFileName(uri: string) {
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
          : mime === 'application/pdf'
            ? 'pdf'
            : 'jpg';

  return `receipt-${Date.now()}.${extension}`;
}

export function buildReceiptConfidenceText(receipt: UploadedReceipt | null) {
  if (!receipt) return 'No OCR data available yet.';
  if (receipt.errorMessage) return receipt.errorMessage;
  if (receipt.hasSuggestions) return 'OCR found useful suggestions you can review below.';
  return 'Receipt uploaded successfully, but OCR did not find strong suggestions.';
}