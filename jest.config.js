// Jest setup for the Expo / RN app (bulletproof hardening §4-B). jest-expo mocks
// the native Expo SDK; transformIgnorePatterns lets Jest transpile the RN/Expo ESM
// packages it must (default list + the deps this app pulls in).
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|react-native-error-boundary|@shopify/flash-list|@tanstack/.*))',
  ],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
