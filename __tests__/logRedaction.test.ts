/**
 * Log-redaction tests (bulletproof hardening — security pass).
 * console.log is NOT stripped in Release, so request bodies must never carry the
 * password, token, or raw GPS coords into the device console.
 */
import { redactSensitive } from '../src/mobile/api/client';

describe('redactSensitive', () => {
  test('redacts the password from a login body', () => {
    const out = redactSensitive(JSON.stringify({ email: 'a@b.com', password: 'hunter2' }));
    expect(out).not.toContain('hunter2');
    expect(out).toContain('[redacted]');
    expect(out).toContain('a@b.com'); // non-sensitive fields preserved
  });

  test('redacts GPS lat/lng on a clock-in body', () => {
    const out = redactSensitive(JSON.stringify({ jobId: 5, lat: 40.7128, lng: -74.006 }));
    expect(out).not.toContain('40.7128');
    expect(out).not.toContain('-74.006');
    expect(out).toContain('"jobId":5');
  });

  test('leaves null coords (GPS-denied) untouched and non-sensitive bodies intact', () => {
    expect(redactSensitive(JSON.stringify({ jobId: 5, lat: null, lng: null }))).toContain('"lat":null');
    expect(redactSensitive(JSON.stringify({ note: 'done' }))).toBe('{"note":"done"}');
  });

  test('returns non-JSON strings unchanged', () => {
    expect(redactSensitive('not json')).toBe('not json');
  });
});
