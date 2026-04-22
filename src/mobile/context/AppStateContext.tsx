import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createApiClient } from '../api/client';
import { useAuth } from './AuthContext';
import { cancelClockOutReminder, scheduleClockOutReminder } from '../notifications';

type AppStateValue = {
  unpaidInvoiceCount: number;
  isClockedIn: boolean;
  refresh: () => void;
};

const AppStateContext = createContext<AppStateValue>({
  unpaidInvoiceCount: 0,
  isClockedIn: false,
  refresh: () => {},
});

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { token, tenantSubdomain, isAuthenticated, logout } = useAuth();
  const [unpaidInvoiceCount, setUnpaidInvoiceCount] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const appState = useRef(AppState.currentState);
  const prevClockedIn = useRef(false);

  const fetchSummary = useCallback(async () => {
    if (!isAuthenticated || !token || !tenantSubdomain) return;
    const api = createApiClient({ tenantSubdomain, token, onUnauthorized: logout });
    try {
      const [invoicesRes, tsRes] = await Promise.all([
        api.getInvoices().catch(() => null),
        api.getTimesheets().catch(() => null),
      ]);
      if (invoicesRes?.invoices) {
        const unpaid = invoicesRes.invoices.filter(i => i.status?.toLowerCase() === 'unpaid').length;
        setUnpaidInvoiceCount(unpaid);
      }
      if (tsRes) {
        const nowClockedIn = !!tsRes.activeClockEntry;
        setIsClockedIn(nowClockedIn);

        if (nowClockedIn && !prevClockedIn.current && tsRes.activeClockEntry?.clockInAt) {
          void scheduleClockOutReminder(tsRes.activeClockEntry.clockInAt);
        } else if (!nowClockedIn && prevClockedIn.current) {
          void cancelClockOutReminder();
        }

        prevClockedIn.current = nowClockedIn;
      }
    } catch { /* ignore */ }
  }, [isAuthenticated, token, tenantSubdomain, logout]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        void fetchSummary();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [fetchSummary]);

  return (
    <AppStateContext.Provider value={{ unpaidInvoiceCount, isClockedIn, refresh: fetchSummary }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppStateContext);
}
