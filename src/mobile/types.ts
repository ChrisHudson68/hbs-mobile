export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
};

export type Tenant = {
  id: number;
  name: string;
  subdomain: string;
  logoPath: string | null;
};

export type LoginResponse = {
  ok: true;
  token: string;
  expiresAt: string;
  user: User;
  tenant: Tenant;
};

export type JobListItem = {
  id: number;
  jobName: string;
  clientName: string | null;
  status: string | null;
  isOverhead?: boolean;
  description?: string | null;
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

export type JobsResponse = {
  ok: boolean;
  jobs?: JobListItem[];
  error?: string;
};

export type JobDetailResponse = {
  ok: boolean;
  job?: JobListItem;
  error?: string;
};

export type ClockInJobOption = {
  id: number;
  jobName: string;
  jobCode: string | null;
  clientName: string | null;
  status: string | null;
  isOverhead: boolean;
};

export type ClockInJobsResponse = {
  ok: boolean;
  jobs?: ClockInJobOption[];
  error?: string;
};

export type TimesheetEntry = {
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

export type TimesheetsResponse = {
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

export type ClockOutResponse = {
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

export type ParsedReceipt = {
  merchantName?: string;
  totalAmount?: number;
  subtotalAmount?: number;
  taxAmount?: number;
  receiptDate?: string;
  receiptNumber?: string;
  paymentMethodLast4?: string;
};

export type UploadedReceipt = {
  receiptFilename: string;
  status: string | null;
  ocrEngine: string | null;
  errorMessage: string | null;
  hasSuggestions: boolean;
  parsed?: ParsedReceipt | null;
};

export type UploadReceiptResponse = {
  ok: boolean;
  receipt?: UploadedReceipt;
  error?: string;
};

export type CreateExpenseResponse = {
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

export type ReceiptAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

export type AutoFilledFieldState = {
  vendor: boolean;
  amount: boolean;
  date: boolean;
};

export type DashboardMetrics = {
  jobsCount: number;
  activeJobsCount: number;
  onHoldJobsCount: number;
  completedJobsCount: number;
  totalIncome: number;
  totalExpenses: number;
  totalLabor: number;
  totalCosts: number;
  totalCollected: number;
  totalInvoiced: number;
  unpaidBalance: number;
  totalProfit: number;
  totalHours: number;
  averageProfitPerJob: number;
};

export type AppTab = 'dashboard' | 'jobs' | 'timesheets' | 'expenses';

export type Invoice = {
  id: number;
  jobId: number;
  jobName: string | null;
  clientName: string | null;
  invoiceNumber: string | null;
  dateIssued: string;
  dueDate: string;
  amount: number;
  status: string;
  notes: string | null;
  totalPaid: number;
  balance: number;
};

export type InvoicePayment = {
  id: number;
  date: string;
  amount: number;
  method: string | null;
  reference: string | null;
};

export type InvoiceDetail = Invoice & {
  payments: InvoicePayment[];
};

export type Employee = {
  id: number;
  name: string;
  payType: string;
  hourlyRate: number | null;
  annualSalary: number | null;
  active: number;
};

export type JobIncome = {
  id: number;
  jobId: number;
  amount: number;
  date: string;
  description: string | null;
};

export type CreateJobArgs = {
  jobName: string;
  jobCode?: string;
  clientName?: string;
  soldBy?: string;
  contractAmount?: number;
  startDate?: string;
  status?: string;
  isOverhead?: boolean;
  jobDescription?: string;
};

export type UpdateJobArgs = Partial<CreateJobArgs>;

export type CreateInvoiceArgs = {
  jobId: number;
  dateIssued: string;
  dueDate: string;
  amount: number;
  notes?: string;
};

export type RecordPaymentArgs = {
  date: string;
  amount: number;
  method?: string;
  reference?: string;
};

export type ManualTimeEntryArgs = {
  employeeId?: number;
  jobId: number;
  date: string;
  hours: number;
  note?: string;
};

export type AddIncomeArgs = {
  amount: number;
  date: string;
  description?: string;
};

export type JobExpense = {
  id: number;
  jobId: number;
  category: string;
  vendor: string | null;
  amount: number;
  date: string;
};

export type JobTimeEntry = {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  hours: number;
  note: string | null;
  entryMethod: string | null;
};

export type TimesheetEditRequest = {
  id: number;
  timeEntryId: number;
  employeeId: number;
  employeeName: string;
  proposedDate: string;
  proposedHours: number;
  proposedNote: string | null;
  reason: string;
  createdAt: string;
  currentHours: number;
  currentDate: string;
  jobName: string | null;
};

export type RequestTimesheetEditArgs = {
  proposedHours: number;
  reason: string;
  proposedNote?: string;
};