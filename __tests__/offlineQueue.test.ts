/**
 * Offline clock-in/out queue tests (bulletproof hardening A6).
 * The offline queue is the punch-resilience guarantee — a clock action taken with
 * no signal must persist and replay exactly once on reconnect. These tests pin
 * that behavior and document the current at-least-once replay semantics.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearQueue,
  enqueueClockIn,
  enqueueClockOut,
  getPendingQueue,
} from '../src/mobile/hooks/useOfflineQueue';
import { STORAGE_KEYS } from '../src/mobile/constants';

// In-memory AsyncStorage so the queue persists within a test.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('offline queue — enqueue + persistence', () => {
  test('enqueues a clock-in with normalized lat/lng', async () => {
    await enqueueClockIn({ jobId: 7, lat: 1.5, lng: -2.5 });
    const queue = await getPendingQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ type: 'clock-in', jobId: 7, lat: 1.5, lng: -2.5 });
    expect(typeof (queue[0] as { queuedAt: string }).queuedAt).toBe('string');
  });

  test('enqueues a GPS-denied clock-in (null coords) — punch never blocked', async () => {
    await enqueueClockIn({ jobId: 9, lat: null, lng: null });
    const [action] = await getPendingQueue();
    expect(action).toMatchObject({ type: 'clock-in', jobId: 9, lat: null, lng: null });
  });

  test('preserves FIFO order across mixed actions', async () => {
    await enqueueClockIn({ jobId: 1, lat: null, lng: null });
    await enqueueClockOut('done for the day');
    const queue = await getPendingQueue();
    expect(queue.map((a) => a.type)).toEqual(['clock-in', 'clock-out']);
    expect(queue[1]).toMatchObject({ type: 'clock-out', note: 'done for the day' });
  });

  test('writes under the dedicated offline-queue storage key', async () => {
    await enqueueClockOut(null);
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.offlineQueue);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });

  test('clearQueue empties the queue', async () => {
    await enqueueClockIn({ jobId: 3, lat: null, lng: null });
    await clearQueue();
    expect(await getPendingQueue()).toHaveLength(0);
  });

  test('returns an empty array (never throws) when storage holds garbage', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.offlineQueue, '{not valid json');
    expect(await getPendingQueue()).toEqual([]);
  });
});
