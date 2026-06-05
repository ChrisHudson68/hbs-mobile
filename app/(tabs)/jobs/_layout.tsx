import { Stack, useRouter } from 'expo-router';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { useTheme } from '../../../src/mobile/theme';
import { useAuth } from '../../../src/mobile/context/AuthContext';
import { isManagerOrAdmin } from '../../../src/mobile/utils';

export default function JobsStackLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const canManage = isManagerOrAdmin(user);

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
      <Stack.Screen
        name="index"
        options={{
          title: 'Jobs',
          headerRight: canManage
            ? () => (
                <HeaderIconButton
                  name="plus"
                  color={colors.navy}
                  onPress={() => router.push('/jobs/new')}
                  accessibilityLabel="New Job"
                  testID="jobs-new-button"
                />
              )
            : undefined,
        }}
      />
    </Stack>
  );
}
