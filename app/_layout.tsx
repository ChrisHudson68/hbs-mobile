import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider } from '../src/mobile/context/ThemeProvider';
import { AuthProvider, useAuth } from '../src/mobile/context/AuthContext';
import { AppStateProvider } from '../src/mobile/context/AppStateContext';
import { useTheme } from '../src/mobile/theme';
import { AppErrorBoundary } from '../components/ui/AppErrorBoundary';
import {
  asyncStoragePersister,
  purgeQueryCache,
  queryClient,
  setupOnlineManager,
  subscribeAppStateFocus,
} from '../src/mobile/query/queryClient';

/**
 * Wires TanStack Query's online/focus managers and PURGES the query cache the moment
 * the session ends (logout / tenant switch) so no tenant data survives in memory or on
 * disk. Lives inside AuthProvider + the query provider.
 */
function QueryManagers() {
  const { isAuthenticated } = useAuth();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    setupOnlineManager();
    const offFocus = subscribeAppStateFocus();
    return () => { offFocus(); };
  }, []);

  useEffect(() => {
    // Only purge on a real authed→unauthed transition (not the initial boot state).
    if (wasAuthenticated.current && !isAuthenticated) {
      void purgeQueryCache();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  return null;
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // '/' is the app index → resolves through (tabs)/(dashboard) to the
      // Dashboard tab (same destination as the old '/(tabs)', but the bare group
      // isn't a typed leaf since the index is nested in the (dashboard) group).
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Zero-size sync marker for Maestro: once it exists in the tree, AuthContext has
  // finished hydrating, so flows can `assertVisible: id: auth-loaded` instead of
  // racing the splash. pointerEvents none → never intercepts touches.
  if (isLoading) return null;
  return <View testID="auth-loaded" style={{ width: 0, height: 0 }} pointerEvents="none" />;
}

function AppNavigator() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: false,
        headerTransparent: true,
        headerBlurEffect: 'systemChromeMaterial',
        headerTintColor: colors.navy,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerLargeStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="jobs/new" options={{ title: 'New Job', headerBackTitle: 'Jobs', presentation: 'formSheet' }} />
      <Stack.Screen name="jobs/[id]" options={{ title: 'Job Details', headerBackTitle: 'Jobs' }} />
      <Stack.Screen name="timesheets/manual" options={{ title: 'Add Time Entry', headerBackTitle: 'Timesheets', presentation: 'formSheet' }} />
      <Stack.Screen name="invoices/new" options={{ title: 'New Invoice', headerBackTitle: 'Invoices', presentation: 'formSheet' }} />
      <Stack.Screen name="invoices/[id]" options={{ title: 'Invoice', headerBackTitle: 'Invoices' }} />
      <Stack.Screen name="employees/index" options={{ title: 'Employees', headerLargeTitle: true, headerBackTitle: 'More' }} />
      <Stack.Screen name="employees/[id]" options={{ title: 'Employee', headerBackTitle: 'Employees' }} />
      <Stack.Screen name="expenses/new" options={{ title: 'New Expense', headerBackTitle: 'More', presentation: 'formSheet' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AppErrorBoundary>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
    <KeyboardProvider>
    <ThemeProvider>
    <AuthProvider>
      <AppStateProvider>
      <QueryManagers />
      <RootRedirect />
      <AppNavigator />
      <StatusBar style="auto" />
      </AppStateProvider>
    </AuthProvider>
    </ThemeProvider>
    </KeyboardProvider>
    </PersistQueryClientProvider>
    </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
