import { z } from 'zod';

/**
 * Runtime contract schemas for the HBS JSON API (bulletproof hardening A2).
 *
 * The backend contract is FROZEN; these schemas mirror the real responses
 * (validated in __tests__/contract.test.ts against captured production JSON).
 *
 * Design rules to stay non-breaking:
 *  - Object schemas are `.loose()` (passthrough): unknown/extra server fields are
 *    KEPT, never a parse failure. We only assert the shape of fields the app reads.
 *  - Optionality/nullability mirrors what the server actually sends. When a field
 *    is sometimes null in real data, it is `.nullable()`.
 *  - Element shapes we could not capture live (empty arrays in fixtures) are modelled
 *    from types.ts and kept extra-lenient so a populated response can't false-reject.
 *
 * `request()` in client.ts validates with these and, on failure, throws a friendly
 * Error (caught by the root/route error boundaries) instead of letting a screen
 * index into undefined.
 */

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

export const FinancialsSchema = z
  .object({
    totalIncome: z.number(),
    totalExpenses: z.number(),
    totalLabor: z.number(),
    totalHours: z.number(),
    totalCosts: z.number(),
    totalInvoiced: z.number(),
    totalCollected: z.number(),
    unpaidInvoices: z.number(),
    unpaidInvoiceBalance: z.number(),
    remainingContract: z.number(),
    profit: z.number(),
  })
  .loose();

export const JobListItemSchema = z
  .object({
    id: z.number(),
    jobName: z.string(),
    clientName: nullableString,
    status: nullableString,
    isOverhead: z.boolean().optional(),
    jobDescription: nullableString.optional(),
    description: nullableString.optional(),
    sourceEstimateId: nullableNumber.optional(),
    sourceEstimateCustomerName: nullableString.optional(),
    financials: FinancialsSchema.optional(),
  })
  .loose();

export const JobsResponseSchema = z
  .object({ ok: z.boolean(), jobs: z.array(JobListItemSchema).optional(), error: z.string().optional() })
  .loose();

export const JobDetailResponseSchema = z
  .object({ ok: z.boolean(), job: JobListItemSchema.optional(), error: z.string().optional() })
  .loose();

export const ClockInJobOptionSchema = z
  .object({
    id: z.number(),
    jobName: z.string(),
    jobCode: nullableString.optional(),
    clientName: nullableString,
    status: nullableString,
    isOverhead: z.boolean(),
  })
  .loose();

export const ClockInJobsResponseSchema = z
  .object({ ok: z.boolean(), jobs: z.array(ClockInJobOptionSchema).optional(), error: z.string().optional() })
  .loose();

export const TimesheetEntrySchema = z
  .object({
    id: z.number(),
    employeeId: z.number(),
    employeeName: z.string(),
    date: z.string(),
    jobId: nullableNumber,
    jobName: nullableString,
    hours: z.number(),
    note: nullableString,
    clockInAt: nullableString,
    clockOutAt: nullableString,
    entryMethod: nullableString,
    approvalStatus: nullableString,
    hasPendingEditRequest: z.boolean(),
  })
  .loose();

export const TimesheetsResponseSchema = z
  .object({
    ok: z.boolean(),
    scope: z
      .object({
        employeeId: z.number(),
        start: z.string(),
        end: z.string(),
        isEmployeeUser: z.boolean(),
        canApproveTime: z.boolean(),
        canUseSelfClock: z.boolean(),
      })
      .loose()
      .optional(),
    summary: z
      .object({
        entryCount: z.number(),
        totalHours: z.number(),
        weekApproved: z.boolean(),
        approvedAt: nullableString,
        approvedByName: nullableString,
      })
      .loose()
      .optional(),
    activeClockEntry: z
      .object({
        id: z.number(),
        jobId: nullableNumber,
        jobName: nullableString,
        clockInAt: z.string(),
      })
      .loose()
      .nullable()
      .optional(),
    timesheets: z.array(TimesheetEntrySchema).optional(),
    error: z.string().optional(),
  })
  .loose();

export const ClockOutResponseSchema = z
  .object({
    ok: z.boolean(),
    entry: z
      .object({
        id: z.number(),
        jobId: nullableNumber,
        jobName: nullableString,
        clockInAt: z.string(),
        clockOutAt: z.string(),
        hours: z.number(),
        note: nullableString,
      })
      .loose()
      .optional(),
    error: z.string().optional(),
  })
  .loose();

export const InvoiceSchema = z
  .object({
    id: z.number(),
    jobId: z.number(),
    jobName: nullableString,
    clientName: nullableString,
    invoiceNumber: nullableString,
    dateIssued: z.string(),
    dueDate: z.string(),
    amount: z.number(),
    status: z.string(),
    notes: nullableString,
    totalPaid: z.number(),
    balance: z.number(),
  })
  .loose();

export const InvoicePaymentSchema = z
  .object({
    id: z.number(),
    date: z.string(),
    amount: z.number(),
    method: nullableString,
    reference: nullableString,
  })
  .loose();

export const InvoiceDetailSchema = InvoiceSchema.extend({
  payments: z.array(InvoicePaymentSchema),
}).loose();

export const InvoicesResponseSchema = z
  .object({ ok: z.boolean(), invoices: z.array(InvoiceSchema).optional(), error: z.string().optional() })
  .loose();

export const InvoiceDetailResponseSchema = z
  .object({ ok: z.boolean(), invoice: InvoiceDetailSchema.optional(), error: z.string().optional() })
  .loose();

export const EmployeeSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    payType: z.string(),
    hourlyRate: nullableNumber,
    annualSalary: nullableNumber,
    active: z.number(),
  })
  .loose();

export const EmployeesResponseSchema = z
  .object({ ok: z.boolean(), employees: z.array(EmployeeSchema).optional(), error: z.string().optional() })
  .loose();

export const TimesheetEditRequestSchema = z
  .object({
    id: z.number(),
    timeEntryId: z.number(),
    employeeId: z.number(),
    employeeName: z.string(),
    proposedDate: z.string(),
    proposedHours: z.number(),
    proposedNote: nullableString,
    reason: z.string(),
    createdAt: z.string(),
    currentHours: z.number(),
    currentDate: z.string(),
    jobName: nullableString,
  })
  .loose();

export const EditRequestsResponseSchema = z
  .object({ ok: z.boolean(), requests: z.array(TimesheetEditRequestSchema).optional(), error: z.string().optional() })
  .loose();

export const UserSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    permissions: z.array(z.string()),
  })
  .loose();

export const TenantSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    subdomain: z.string(),
    logoPath: nullableString,
  })
  .loose();

export const LoginResponseSchema = z
  .object({
    ok: z.literal(true),
    token: z.string(),
    expiresAt: z.string(),
    user: UserSchema,
    tenant: TenantSchema,
  })
  .loose();

export const JobIncomeSchema = z
  .object({
    id: z.number(),
    jobId: z.number(),
    amount: z.number(),
    date: z.string(),
    description: nullableString,
  })
  .loose();

export const JobExpenseSchema = z
  .object({
    id: z.number(),
    jobId: z.number(),
    category: z.string(),
    vendor: nullableString,
    amount: z.number(),
    date: z.string(),
  })
  .loose();

export const JobTimeEntrySchema = z
  .object({
    id: z.number(),
    employeeId: z.number(),
    employeeName: z.string(),
    date: z.string(),
    hours: z.number(),
    note: nullableString,
    entryMethod: nullableString,
  })
  .loose();

export const JobIncomeListSchema = z.object({ ok: z.boolean(), income: z.array(JobIncomeSchema) }).loose();
export const JobExpenseListSchema = z.object({ ok: z.boolean(), expenses: z.array(JobExpenseSchema) }).loose();
export const JobTimeEntryListSchema = z.object({ ok: z.boolean(), entries: z.array(JobTimeEntrySchema) }).loose();

/** Generic write-ack: `{ ok }` plus whatever the endpoint echoes back (kept via loose). */
export const OkAckSchema = z.object({ ok: z.boolean(), error: z.string().optional() }).loose();

// Inferred types — these become the single source of truth for the response shapes,
// re-exported through types.ts so screens keep importing from one place.
export type JobListItem = z.infer<typeof JobListItemSchema>;
export type JobsResponse = z.infer<typeof JobsResponseSchema>;
export type JobDetailResponse = z.infer<typeof JobDetailResponseSchema>;
export type ClockInJobOption = z.infer<typeof ClockInJobOptionSchema>;
export type ClockInJobsResponse = z.infer<typeof ClockInJobsResponseSchema>;
export type TimesheetEntry = z.infer<typeof TimesheetEntrySchema>;
export type TimesheetsResponse = z.infer<typeof TimesheetsResponseSchema>;
export type ClockOutResponse = z.infer<typeof ClockOutResponseSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoicePayment = z.infer<typeof InvoicePaymentSchema>;
export type InvoiceDetail = z.infer<typeof InvoiceDetailSchema>;
export type Employee = z.infer<typeof EmployeeSchema>;
export type TimesheetEditRequest = z.infer<typeof TimesheetEditRequestSchema>;
export type User = z.infer<typeof UserSchema>;
export type Tenant = z.infer<typeof TenantSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type JobIncome = z.infer<typeof JobIncomeSchema>;
export type JobExpense = z.infer<typeof JobExpenseSchema>;
export type JobTimeEntry = z.infer<typeof JobTimeEntrySchema>;
