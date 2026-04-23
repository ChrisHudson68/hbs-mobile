import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { useCallback, useEffect, useRef } from 'react';
import { STORAGE_KEYS } from '../constants';

type QueuedClockIn = {
  type: 'clock-in';
  jobId: number;
  lat: number | null;
  lng: number | null;
  queuedAt: string;
};

type QueuedClockOut = {
  type: 'clock-out';
  note: string | null;
  queuedAt: string;
};

export type QueuedAction = QueuedClockIn | QueuedClockOut;

async function loadQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.offlineQueue);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedAction[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.offlineQueue, JSON.stringify(queue));
  } catch {
    // best-effort
  }
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export async function enqueueClockIn(args: { jobId: number; lat: number | null; lng: number | null }): Promise<void> {
  const queue = await loadQueue();
  queue.push({ type: 'clock-in', ...args, queuedAt: new Date().toISOString() });
  await saveQueue(queue);
}

export async function enqueueClockOut(note: string | null): Promise<void> {
  const queue = await loadQueue();
  queue.push({ type: 'clock-out', note, queuedAt: new Date().toISOString() });
  await saveQueue(queue);
}

export async function getPendingQueue(): Promise<QueuedAction[]> {
  return loadQueue();
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.offlineQueue);
}

type FlushOptions = {
  clockIn: (args: { jobId: number; lat?: number; lng?: number }) => Promise<any>;
  clockOut: (note?: string) => Promise<any>;
  onFlushed: (count: number) => void;
};

export function useOfflineQueueFlusher(options: FlushOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const flush = useCallback(async () => {
    const online = await isOnline();
    if (!online) return;

    const queue = await loadQueue();
    if (queue.length === 0) return;

    let flushed = 0;
    const remaining: QueuedAction[] = [];

    for (const action of queue) {
      try {
        if (action.type === 'clock-in') {
          await optionsRef.current.clockIn({
            jobId: action.jobId,
            lat: action.lat ?? undefined,
            lng: action.lng ?? undefined,
          });
        } else if (action.type === 'clock-out') {
          await optionsRef.current.clockOut(action.note ?? undefined);
        }
        flushed++;
      } catch {
        remaining.push(action);
      }
    }

    await saveQueue(remaining);
    if (flushed > 0) {
      optionsRef.current.onFlushed(flushed);
    }
  }, []);

  // Attempt flush on mount and whenever network state changes
  useEffect(() => {
    void flush();

    const interval = setInterval(() => void flush(), 30_000);
    return () => clearInterval(interval);
  }, [flush]);

  return { flush };
}
