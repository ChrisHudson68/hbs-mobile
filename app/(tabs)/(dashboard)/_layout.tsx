import { Stack } from 'expo-router';
import { useTheme } from '../../../src/mobile/theme';

export default function DashboardStackLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: false,
        headerBlurEffect: 'systemChromeMaterial',
        headerTintColor: colors.navy,
        headerStyle: { backgroundColor: colors.bg },
        headerLargeStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
    </Stack>
  );
}
