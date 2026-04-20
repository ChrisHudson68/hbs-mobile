import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../src/mobile/context/AuthContext';

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
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootRedirect />
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="jobs/new" options={{ title: 'New Job', headerBackTitle: 'Jobs' }} />
        <Stack.Screen name="jobs/[id]" options={{ title: 'Job Details', headerBackTitle: 'Jobs' }} />
        <Stack.Screen name="timesheets/manual" options={{ title: 'Add Time Entry', headerBackTitle: 'Timesheets' }} />
        <Stack.Screen name="invoices/new" options={{ title: 'New Invoice', headerBackTitle: 'Invoices' }} />
        <Stack.Screen name="invoices/[id]" options={{ title: 'Invoice', headerBackTitle: 'Invoices' }} />
        <Stack.Screen name="employees/index" options={{ title: 'Employees', headerBackTitle: 'More' }} />
        <Stack.Screen name="expenses/new" options={{ title: 'New Expense', headerBackTitle: 'More' }} />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
