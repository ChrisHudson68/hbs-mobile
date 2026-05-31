import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
                <Pressable
                  onPress={() => router.push('/jobs/new')}
                  accessibilityLabel="New Job"
                  testID="jobs-new-button"
                  hitSlop={8}
                >
                  <IconSymbol name="plus" size={22} color={colors.navy} />
                </Pressable>
              )
            : undefined,
        }}
      />
    </Stack>
  );
}
