import { useMemo } from 'react';
import { createApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useApi() {
  const { token, tenantSubdomain, logout } = useAuth();
  return useMemo(
    () => createApiClient({
      tenantSubdomain: tenantSubdomain ?? '',
      token: token ?? undefined,
      onUnauthorized: logout,
    }),
    [token, tenantSubdomain, logout],
  );
}
