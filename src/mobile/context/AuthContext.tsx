import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { mobileLogin, mobileLogout } from '../api/client';
import { STORAGE_KEYS } from '../constants';
import type { User } from '../types';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  tenantSubdomain: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (subdomain: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenantSubdomain, setTenantSubdomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [storedTenant, storedToken, storedUserJson] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.tenant),
          SecureStore.getItemAsync(STORAGE_KEYS.token),
          SecureStore.getItemAsync(STORAGE_KEYS.user),
        ]);
        if (storedTenant && storedToken && storedUserJson) {
          setTenantSubdomain(storedTenant);
          setToken(storedToken);
          setUser(JSON.parse(storedUserJson) as User);
        }
      } catch {
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.tenant),
          SecureStore.deleteItemAsync(STORAGE_KEYS.token),
          SecureStore.deleteItemAsync(STORAGE_KEYS.user),
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    void bootstrap();
  }, []);

  const login = useCallback(async (subdomain: string, email: string, password: string) => {
    const payload = await mobileLogin({ tenantSubdomain: subdomain, email, password });
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.tenant, subdomain),
      SecureStore.setItemAsync(STORAGE_KEYS.token, payload.token),
      SecureStore.setItemAsync(STORAGE_KEYS.user, JSON.stringify(payload.user)),
    ]);
    setTenantSubdomain(subdomain);
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const logout = useCallback(async () => {
    if (tenantSubdomain && token) {
      try { await mobileLogout({ tenantSubdomain, token }); } catch { /* best effort */ }
    }
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.tenant),
      SecureStore.deleteItemAsync(STORAGE_KEYS.token),
      SecureStore.deleteItemAsync(STORAGE_KEYS.user),
    ]);
    setToken(null);
    setUser(null);
    setTenantSubdomain(null);
  }, [tenantSubdomain, token]);

  return (
    <AuthContext.Provider value={{
      token, user, tenantSubdomain,
      isAuthenticated: Boolean(token && user && tenantSubdomain),
      isLoading, login, logout,
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
