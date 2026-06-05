/**
 * Biometric app-lock gating (bulletproof hardening A7).
 * `tokenStoreOptions` is the single decision point for whether the session token is
 * keychain-gated behind Face ID/Touch ID. We never branch on a bare authenticate()
 * boolean — the keychain enforces it — so this pure helper is the thing to pin.
 */
import { tokenStoreOptions } from '../src/mobile/context/AuthContext';

describe('tokenStoreOptions (biometric token gating)', () => {
  test('returns undefined (plain store) when biometrics are disabled', () => {
    expect(tokenStoreOptions(false)).toBeUndefined();
  });

  test('requires authentication to read the token when biometrics are enabled', () => {
    const opts = tokenStoreOptions(true);
    expect(opts).toBeDefined();
    expect(opts?.requireAuthentication).toBe(true);
    expect(opts?.authenticationPrompt).toMatch(/unlock/i);
    // Readable after first device unlock per boot (so the gate is biometrics, not device-lock).
    expect(opts?.keychainAccessible).toBeDefined();
  });
});
