// Global jest setup. AsyncStorage has no native module under jest, so mock it once
// for every suite (any import chain that reaches useOfflineQueue needs this).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
