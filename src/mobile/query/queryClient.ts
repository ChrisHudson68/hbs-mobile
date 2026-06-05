import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/**
 * TanStack Query foundation (bulletproof hardening A3).
 *
 * One shared QueryClient + an AsyncStorage persister so display data loads
 * instantly from disk on reopen (field workers on flaky signal). onlineManager
 * is driven by expo-network and focusManager by AppState, so queries refetch on
 * reconnect / app-foreground.
 *
 * SECURITY: the persisted cache holds tenant data on disk, so it MUST be purged on
 * logout / tenant switch — see purgeQueryCache(), called from the provider when the
 * session ends. Every queryKey also embeds tenantSubdomain so tenant A's cache can
 * never satisfy tenant B's query.
 */

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export const PERSIST_CACHE_KEY = 'hbs-rq-cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s: treat data as fresh briefly, then revalidate
      gcTime: ONE_DAY_MS, // keep long enough for the persister to restore on reopen
      retry: 2,
      refetchOnReconnect: true,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_CACHE_KEY,
});

/** Wire onlineManager to real connectivity (expo-network). The listener lives app-long. */
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });
    return () => subscription.remove();
  });
}

/** Refetch-on-foreground: map AppState 'active' → focused. */
export function onAppStateChange(status: AppStateStatus): void {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export function subscribeAppStateFocus(): () => void {
  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => subscription.remove();
}

/**
 * Full purge of cached data — call on logout / tenant switch. Clears the in-memory
 * cache AND removes the on-disk persisted copy so no tenant data can bleed across
 * sessions. Best-effort on the storage removal (never blocks logout).
 */
export async function purgeQueryCache(): Promise<void> {
  queryClient.clear();
  try {
    await AsyncStorage.removeItem(PERSIST_CACHE_KEY);
  } catch {
    // best-effort; the in-memory clear() already removed live data
  }
}

/**
 * Tenant-scoped query key. ALWAYS build keys through this so tenantSubdomain is the
 * first key segment — guarantees per-tenant cache isolation.
 */
export function tenantKey(tenantSubdomain: string | null, ...parts: (string | number)[]): (string | number)[] {
  return ['t', tenantSubdomain ?? 'none', ...parts];
}
