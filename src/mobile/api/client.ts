import { CONFIG } from '../constants';
import {
    ClockInJobsResponse,
    ClockOutResponse,
    CreateExpenseResponse,
    JobDetailResponse,
    JobsResponse,
    LoginResponse,
    TimesheetsResponse,
    UploadReceiptResponse,
} from '../types';
import { errorMessageFromCode, parseJsonResponse } from '../utils';

type ApiClientOptions = {
  tenantSubdomain: string;
  token?: string;
  onUnauthorized?: () => Promise<void> | void;
};

type LoginArgs = {
  tenantSubdomain: string;
  email: string;
  password: string;
};

type ClockInArgs = {
  jobId?: number;
};

type CreateExpenseArgs = {
  jobId: number;
  category: string;
  vendor?: string;
  amount: string;
  date: string;
  receiptFilename: string;
};

function nowIso() {
  return new Date().toISOString();
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function summarizeBody(body: RequestInit['body']) {
  if (!body) return undefined;

  if (typeof body === 'string') {
    return body.length > 500 ? `${body.slice(0, 500)}...[truncated]` : body;
  }

  if (body instanceof FormData) {
    const entries: Array<{ key: string; value: string }> = [];

    try {
      for (const [key, value] of body.entries()) {
        if (typeof value === 'string') {
          entries.push({ key, value });
        } else {
          const fileLike = value as { name?: string; type?: string };
          entries.push({
            key,
            value: `[file name=${fileLike?.name || 'unknown'} type=${fileLike?.type || 'unknown'}]`,
          });
        }
      }
      return safeStringify(entries);
    } catch {
      return '[form-data]';
    }
  }

  return '[non-string-body]';
}

function logApiRequest(method: string, path: string, tenantSubdomain: string, body?: RequestInit['body']) {
  console.log(
    `[API REQUEST] ${nowIso()} ${method} ${path} tenant=${tenantSubdomain} body=${summarizeBody(body) ?? '[none]'}`
  );
}

function logApiResponse(method: string, path: string, status: number, durationMs: number) {
  console.log(
    `[API RESPONSE] ${nowIso()} ${method} ${path} status=${status} durationMs=${durationMs}`
  );
}

function logApiError(method: string, path: string, status: number, durationMs: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `[API ERROR] ${nowIso()} ${method} ${path} status=${status} durationMs=${durationMs} message=${message}`
  );
}

export function createApiClient({
  tenantSubdomain,
  token,
  onUnauthorized,
}: ApiClientOptions) {
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const method = options?.method || 'GET';
    const startedAt = Date.now();

    const headers = new Headers(options?.headers || {});
    headers.set('X-Tenant-Subdomain', tenantSubdomain);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    logApiRequest(method, path, tenantSubdomain, options?.body);

    let response: Response;
    try {
      response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
        ...options,
        headers,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      logApiError(method, path, 0, durationMs, error);
      throw error;
    }

    const durationMs = Date.now() - startedAt;
    let data: any = null;

    try {
      data = await parseJsonResponse(response);
    } catch (error) {
      logApiError(method, path, response.status, durationMs, error);
      throw error;
    }

    logApiResponse(method, path, response.status, durationMs);

    if (response.status === 401 || data?.error === 'unauthorized') {
      logApiError(method, path, response.status, durationMs, new Error('unauthorized'));
      await onUnauthorized?.();
      throw new Error('unauthorized');
    }

    if (!response.ok || data?.ok === false) {
      const message = errorMessageFromCode(data?.error);
      logApiError(method, path, response.status, durationMs, new Error(message));
      throw new Error(message);
    }

    return data as T;
  }

  return {
    request,

    getJobs() {
      return request<JobsResponse>('/api/jobs');
    },

    getJobDetail(jobId: number) {
      return request<JobDetailResponse>(`/api/jobs/${jobId}`);
    },

    getClockInJobs() {
      return request<ClockInJobsResponse>('/api/timesheets/clock-in-jobs');
    },

    getTimesheets() {
      return request<TimesheetsResponse>('/api/timesheets');
    },

    clockIn(args: ClockInArgs) {
      return request('/api/timesheets/clock-in', {
        method: 'POST',
        body: JSON.stringify({
          jobId: args.jobId,
        }),
      });
    },

    clockOut() {
      return request<ClockOutResponse>('/api/timesheets/clock-out', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },

    uploadReceipt(formData: FormData) {
      return request<UploadReceiptResponse>('/api/expenses/upload-receipt', {
        method: 'POST',
        body: formData,
      });
    },

    createExpense(args: CreateExpenseArgs) {
      return request<CreateExpenseResponse>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          jobId: args.jobId,
          category: args.category,
          vendor: args.vendor,
          amount: args.amount,
          date: args.date,
          receiptFilename: args.receiptFilename,
        }),
      });
    },
  };
}

export async function mobileLogin({
  tenantSubdomain,
  email,
  password,
}: LoginArgs) {
  const method = 'POST';
  const path = '/api/mobile/login';
  const startedAt = Date.now();

  const body = JSON.stringify({ email, password });
  logApiRequest(method, path, tenantSubdomain, body);

  let response: Response;
  try {
    response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Subdomain': tenantSubdomain,
      },
      body,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logApiError(method, path, 0, durationMs, error);
    throw error;
  }

  const durationMs = Date.now() - startedAt;
  const data = await parseJsonResponse(response);

  logApiResponse(method, path, response.status, durationMs);

  if (!response.ok || !data?.ok) {
    const message = errorMessageFromCode(data?.error);
    logApiError(method, path, response.status, durationMs, new Error(message));
    throw new Error(message);
  }

  return data as LoginResponse;
}

export async function mobileLogout({
  tenantSubdomain,
  token,
}: {
  tenantSubdomain: string;
  token: string;
}) {
  const method = 'POST';
  const path = '/api/mobile/logout';
  const startedAt = Date.now();

  logApiRequest(method, path, tenantSubdomain);

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Subdomain': tenantSubdomain,
        Authorization: `Bearer ${token}`,
      },
    });

    const durationMs = Date.now() - startedAt;
    logApiResponse(method, path, response.status, durationMs);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logApiError(method, path, 0, durationMs, error);
    throw error;
  }
}