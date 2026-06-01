import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { mobileLogin, mobileLogout } from '../api/client';
import { clearQueue } from '../hooks/useOfflineQueue';
import { STORAGE_KEYS } from '../constants';
import type { User } from '../types';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  tenantSubdomain: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True when a saved session exists but is locked behind biometrics (awaiting Face ID/Touch ID). */
  hasLockedSession: boolean;
  login: (subdomain: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Reads the keychain-gated token (prompts Face ID/Touch ID) and restores the session. */
  unlockWithBiometrics: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Keychain options that force a Face ID / Touch ID check to READ the value. We gate the
 * token only: reading it triggers the OS biometric prompt (we never branch on a bare
 * authenticate() boolean — the keychain enforces it). `AFTER_FIRST_UNLOCK` keeps the
 * item readable after the first device unlock per boot (so background refresh still works)
 * while still requiring biometrics for the token read itself.
 */
const BIOMETRIC_TOKEN_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  authenticationPrompt: 'Unlock Hudson Business Solutions',
};

/**
 * Token store/read options. When the user has enabled biometric app-lock the token is
 * stored (and must be read) behind Face ID/Touch ID; otherwise it is stored normally.
 * Exported pure so the gating decision is unit-testable.
 */
export function tokenStoreOptions(biometricsEnabled: boolean): SecureStore.SecureStoreOptions | undefined {
  return biometricsEnabled ? BIOMETRIC_TOKEN_OPTIONS : undefined;
}

async function readBiometricsEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(STORAGE_KEYS.biometricsEnabled)) === 'true';
  } catch {
    return false;
  }
}

function parseUser(json: string | null): User | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenantSubdomain, setTenantSubdomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLockedSession, setHasLockedSession] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const biometricsEnabled = await readBiometricsEnabled();
        // Tenant + user are not secrets — read them plainly so we can tell a session exists.
        const [storedTenant, storedUserJson] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.tenant),
          SecureStore.getItemAsync(STORAGE_KEYS.user),
        ]);
        const storedUser = parseUser(storedUserJson);

        if (!storedTenant || !storedUser) {
          // No usable session.
          return;
        }

        if (biometricsEnabled) {
          // A saved session exists but the token is keychain-gated. Defer the (prompting)
          // token read to unlockWithBiometrics so the user sees exactly one Face ID prompt.
          setHasLockedSession(true);
          return;
        }

        const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.token);
        if (storedToken) {
          setTenantSubdomain(storedTenant);
          setUser(storedUser);
          setToken(storedToken);
        }
      } catch {
        // Only a genuine read failure lands here (not a biometric cancel — that path is
        // deferred). Leave the encrypted token in place so the user can retry; password
        // login remains available.
      } finally {
        setIsLoading(false);
      }
    };
    void bootstrap();
  }, []);

  const login = useCallback(async (subdomain: string, email: string, password: string) => {
    const payload = await mobileLogin({ tenantSubdomain: subdomain, email, password });
    const biometricsEnabled = await readBiometricsEnabled();
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.tenant, subdomain),
      SecureStore.setItemAsync(STORAGE_KEYS.user, JSON.stringify(payload.user)),
      // Gate the token behind biometrics iff the user has app-lock enabled.
      SecureStore.setItemAsync(STORAGE_KEYS.token, payload.token, tokenStoreOptions(biometricsEnabled)),
    ]);
    setTenantSubdomain(subdomain);
    setToken(payload.token);
    setUser(payload.user);
    setHasLockedSession(false);
  }, []);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const [storedTenant, storedUserJson, storedToken] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.tenant),
        SecureStore.getItemAsync(STORAGE_KEYS.user),
        // This read triggers the OS Face ID / Touch ID prompt (keychain-enforced).
        SecureStore.getItemAsync(STORAGE_KEYS.token, BIOMETRIC_TOKEN_OPTIONS),
      ]);
      const storedUser = parseUser(storedUserJson);
      if (storedTenant && storedUser && storedToken) {
        setTenantSubdomain(storedTenant);
        setUser(storedUser);
        setToken(storedToken);
        setHasLockedSession(false);
        return true;
      }
      return false;
    } catch {
      // Cancelled, lockout, or biometrics changed → stay locked; password login still works.
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    if (tenantSubdomain && token) {
      try { await mobileLogout({ tenantSubdomain, token }); } catch { /* best effort */ }
    }
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.tenant),
      SecureStore.deleteItemAsync(STORAGE_KEYS.token),
      SecureStore.deleteItemAsync(STORAGE_KEYS.user),
      // Purge any queued offline punches so they can't replay under the next user
      // (full state purge on logout / tenant switch).
      clearQueue(),
    ]);
    setToken(null);
    setUser(null);
    setTenantSubdomain(null);
    setHasLockedSession(false);
  }, [tenantSubdomain, token]);

  return (
    <AuthContext.Provider value={{
      token, user, tenantSubdomain,
      isAuthenticated: Boolean(token && user && tenantSubdomain),
      isLoading, hasLockedSession, login, logout, unlockWithBiometrics,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
