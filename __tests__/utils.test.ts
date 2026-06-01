import {
  errorMessageFromCode,
  hasPermission,
  isManagerOrAdmin,
} from '../src/mobile/utils';
import type { User } from '../src/mobile/types';

// Minimal fixtures — these functions only read `role` and `permissions`.
const makeUser = (role: string, permissions: string[] = []) =>
  ({ role, permissions } as unknown as User);

describe('isManagerOrAdmin', () => {
  test('returns true for Admin', () => {
    expect(isManagerOrAdmin(makeUser('Admin'))).toBe(true);
  });

  test('returns true for Manager', () => {
    expect(isManagerOrAdmin(makeUser('Manager'))).toBe(true);
  });

  test('returns false for Employee', () => {
    expect(isManagerOrAdmin(makeUser('Employee'))).toBe(false);
  });

  test('returns false for null user', () => {
    expect(isManagerOrAdmin(null)).toBe(false);
  });
});

describe('hasPermission', () => {
  test('returns true when the user holds the permission', () => {
    expect(hasPermission(makeUser('Employee', ['time.clock']), 'time.clock')).toBe(true);
  });

  test('returns false when the user lacks the permission', () => {
    expect(hasPermission(makeUser('Employee', ['jobs.view']), 'time.clock')).toBe(false);
  });

  test('returns false for a null user', () => {
    expect(hasPermission(null, 'time.clock')).toBe(false);
  });

  test('returns false when permissions is missing/not an array', () => {
    expect(hasPermission(makeUser('Employee', undefined as unknown as string[]), 'x')).toBe(false);
  });
});

describe('errorMessageFromCode', () => {
  test('maps the D2 high-traffic codes to friendly copy (no raw code leak)', () => {
    const cases: [string, RegExp][] = [
      ['job_required', /select a job/i],
      ['too_many_attempts', /too many attempts/i],
      ['forbidden', /permission/i],
      ['week_approved', /approved/i],
      ['invalid_hours', /hours/i],
      ['reason_required', /reason/i],
    ];
    for (const [code, matcher] of cases) {
      const msg = errorMessageFromCode(code);
      expect(msg).toMatch(matcher);
      expect(msg).not.toContain(code); // never surface the raw code
    }
  });

  test('maps the original codes', () => {
    expect(errorMessageFromCode('invalid_login')).toMatch(/email and password/i);
    expect(errorMessageFromCode('unauthorized')).toMatch(/sign in again/i);
  });

  test('falls back gracefully for an unknown code', () => {
    expect(errorMessageFromCode('some_unmapped_code')).toMatch(/request failed/i);
  });

  test('returns a generic message when no code is given', () => {
    expect(errorMessageFromCode(undefined)).toMatch(/something went wrong/i);
  });
});
