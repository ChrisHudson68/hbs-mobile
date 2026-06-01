/**
 * Pure formatter / validator / status / metrics tests (bulletproof hardening A6).
 * These power money display, date inputs, and dashboard roll-ups — the logic a
 * construction owner reads numbers from — so they get explicit coverage.
 */
import {
  buildDashboardMetrics,
  formatCurrency,
  formatDate,
  formatDateInputValue,
  formatDuration,
  formatHours,
  isActiveStatus,
  isCancelledStatus,
  isCompletedStatus,
  isOnHoldStatus,
  validateAmount,
  validateDate,
  validateHours,
  validateRequired,
} from '../src/mobile/utils';
import type { JobListItem } from '../src/mobile/types';

describe('formatCurrency', () => {
  test('formats positive amounts with thousands separators + 2 decimals', () => {
    expect(formatCurrency(1234567.5)).toBe('$1,234,567.50');
  });
  test('formats negatives with a leading minus before the dollar sign', () => {
    expect(formatCurrency(-42)).toBe('-$42.00');
  });
  test('treats null/undefined as zero', () => {
    expect(formatCurrency(null)).toBe('$0.00');
    expect(formatCurrency(undefined)).toBe('$0.00');
  });
});

describe('formatHours / formatDuration', () => {
  test('formatHours fixes to 2 decimals with unit', () => {
    expect(formatHours(8)).toBe('8.00 hrs');
    expect(formatHours(null)).toBe('0.00 hrs');
  });
  test('formatDuration splits seconds into h/m and floors negatives to 0', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
    expect(formatDuration(-5)).toBe('0h 0m');
  });
});

describe('formatDateInputValue (local-date, the D-fix)', () => {
  test('builds YYYY-MM-DD from LOCAL components, never UTC rollover', () => {
    // 11:30pm local on the 15th must stay the 15th even in UTC-negative zones.
    const d = new Date(2026, 0, 15, 23, 30, 0); // local Jan 15 2026 23:30
    expect(formatDateInputValue(d)).toBe('2026-01-15');
  });
  test('zero-pads month and day', () => {
    expect(formatDateInputValue(new Date(2026, 2, 5, 9, 0, 0))).toBe('2026-03-05');
  });
});

describe('formatDate', () => {
  test('renders an em dash for empty input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });
  test('echoes back an unparseable value rather than throwing', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('status predicates', () => {
  test('on-hold matches any string containing "hold" (case-insensitive)', () => {
    expect(isOnHoldStatus('On Hold')).toBe(true);
    expect(isOnHoldStatus('HOLD')).toBe(true);
    expect(isOnHoldStatus('active')).toBe(false);
  });
  test('completed matches complete/completed only', () => {
    expect(isCompletedStatus('Completed')).toBe(true);
    expect(isCompletedStatus('complete')).toBe(true);
    expect(isCompletedStatus('completing')).toBe(false);
  });
  test('cancelled matches both spellings', () => {
    expect(isCancelledStatus('Cancelled')).toBe(true);
    expect(isCancelledStatus('canceled')).toBe(true);
  });
  test('active = not hold/complete/cancel (incl. null/unknown)', () => {
    expect(isActiveStatus('In Progress')).toBe(true);
    expect(isActiveStatus(null)).toBe(true);
    expect(isActiveStatus('On Hold')).toBe(false);
    expect(isActiveStatus('Completed')).toBe(false);
  });
});

describe('validators (return undefined when valid, message when not)', () => {
  test('validateRequired', () => {
    expect(validateRequired('hi')).toBeUndefined();
    expect(validateRequired('   ')).toMatch(/required/i);
  });
  test('validateAmount strips $ and commas, rejects non-positive', () => {
    expect(validateAmount('$1,200.50')).toBeUndefined();
    expect(validateAmount('0')).toMatch(/valid/i);
    expect(validateAmount('abc')).toMatch(/valid/i);
  });
  test('validateHours bounds 0 < h <= 24', () => {
    expect(validateHours('8')).toBeUndefined();
    expect(validateHours('0')).toMatch(/0–24/);
    expect(validateHours('25')).toMatch(/0–24/);
  });
  test('validateDate allows empty, rejects bad format + calendar rollovers', () => {
    expect(validateDate('')).toBeUndefined();
    expect(validateDate('2026-01-15')).toBeUndefined();
    expect(validateDate('2026-13-01')).toMatch(/valid date/i);
    expect(validateDate('2026-02-30')).toMatch(/valid date/i); // Feb 30 rolls over
  });
});

describe('buildDashboardMetrics', () => {
  const job = (over: Partial<JobListItem>): JobListItem =>
    ({ id: 1, jobName: 'J', clientName: null, status: 'active', ...over } as JobListItem);

  test('counts jobs by status bucket', () => {
    const m = buildDashboardMetrics([
      job({ status: 'In Progress' }),
      job({ status: 'On Hold' }),
      job({ status: 'Completed' }),
    ]);
    expect(m.jobsCount).toBe(3);
    expect(m.activeJobsCount).toBe(1);
    expect(m.onHoldJobsCount).toBe(1);
    expect(m.completedJobsCount).toBe(1);
  });

  test('sums financials and computes average profit per job', () => {
    const fin = {
      totalIncome: 100, totalExpenses: 10, totalLabor: 5, totalHours: 2, totalCosts: 15,
      totalInvoiced: 80, totalCollected: 60, unpaidInvoices: 1, unpaidInvoiceBalance: 20,
      remainingContract: 0, profit: 40,
    };
    const m = buildDashboardMetrics([job({ financials: fin }), job({ financials: fin })]);
    expect(m.totalIncome).toBe(200);
    expect(m.totalProfit).toBe(80);
    expect(m.unpaidBalance).toBe(40);
    expect(m.averageProfitPerJob).toBe(40);
  });

  test('handles an empty job list without dividing by zero', () => {
    const m = buildDashboardMetrics([]);
    expect(m.jobsCount).toBe(0);
    expect(m.averageProfitPerJob).toBe(0);
  });
});
