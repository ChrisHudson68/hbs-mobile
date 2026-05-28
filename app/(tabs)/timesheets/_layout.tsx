import { Stack } from 'expo-router';
import { useTheme } from '../../../src/mobile/theme';

export default function TimesheetsStackLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: false,
        headerBlurEffect: 'systemChromeMaterial',
        headerTintColor: colors.navy,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Timesheets' }} />
    </Stack>
  );
}
