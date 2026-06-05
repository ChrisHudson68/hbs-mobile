/**
 * API contract tests (bulletproof hardening A2).
 *
 * Feeds REAL production JSON (captured from acme tenant via /api/mobile/login + the
 * read endpoints, stored in __tests__/fixtures/) through the Zod schemas in
 * src/mobile/api/schemas.ts. If the backend contract ever drifts from what the app
 * expects, these fail — that is the early-warning the FROZEN contract relies on.
 *
 * Re-capture fixtures with the helper in the session notes if the contract changes.
 */
import clockinjobs from './fixtures/clockinjobs.json';
import editreq from './fixtures/editreq.json';
import employees from './fixtures/employees.json';
import invoicedetail from './fixtures/invoicedetail.json';
import invoices from './fixtures/invoices.json';
import jobdetail from './fixtures/jobdetail.json';
import jobs from './fixtures/jobs.json';
import login from './fixtures/login.json';
import timesheets from './fixtures/timesheets.json';

import {
  ClockInJobsResponseSchema,
  EditRequestsResponseSchema,
  EmployeesResponseSchema,
  InvoiceDetailResponseSchema,
  InvoicesResponseSchema,
  JobDetailResponseSchema,
  JobsResponseSchema,
  LoginResponseSchema,
  TimesheetsResponseSchema,
} from '../src/mobile/api/schemas';

const cases: [string, { safeParse: (d: unknown) => { success: boolean; error?: unknown } }, unknown][] = [
  ['login', LoginResponseSchema, login],
  ['jobs', JobsResponseSchema, jobs],
  ['jobDetail', JobDetailResponseSchema, jobdetail],
  ['clockInJobs', ClockInJobsResponseSchema, clockinjobs],
  ['timesheets', TimesheetsResponseSchema, timesheets],
  ['invoices', InvoicesResponseSchema, invoices],
  ['invoiceDetail', InvoiceDetailResponseSchema, invoicedetail],
  ['employees', EmployeesResponseSchema, employees],
  ['editRequests', EditRequestsResponseSchema, editreq],
];

describe('API contract — real production fixtures parse cleanly', () => {
  test.each(cases)('%s response matches its schema', (_name, schema, fixture) => {
    const result = schema.safeParse(fixture);
    if (!result.success) {
      // Surface the exact mismatch when a contract drift breaks the build.
      throw new Error(JSON.stringify((result.error as { issues?: unknown })?.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});

describe('API contract — schemas reject genuinely malformed bodies', () => {
  test('login schema rejects a missing token', () => {
    const broken = { ...(login as object), token: undefined };
    expect(LoginResponseSchema.safeParse(broken).success).toBe(false);
  });

  test('jobs schema keeps unknown server fields (forward-compatible)', () => {
    const withExtra = { ok: true, jobs: [], serverAddedField: 'future' };
    const parsed = JobsResponseSchema.safeParse(withExtra);
    expect(parsed.success).toBe(true);
    expect((parsed.data as Record<string, unknown>).serverAddedField).toBe('future');
  });
});
