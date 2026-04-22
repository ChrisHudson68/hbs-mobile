import { Tabs } from 'expo-router';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '../../src/mobile/theme';
import { useAppState } from '../../src/mobile/context/AppStateContext';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { isManagerOrAdmin } from '../../src/mobile/utils';

export default function TabLayout() {
  const { unpaidInvoiceCount, isClockedIn } = useAppState();
  const { user } = useAuth();
  const canManage = isManagerOrAdmin(user);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Colors.navy,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol name="house.fill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => <IconSymbol name="briefcase.fill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="timesheets"
        options={{
          title: 'Timesheets',
          tabBarIcon: ({ color }) => <IconSymbol name="clock.fill" size={24} color={color} />,
          tabBarBadge: isClockedIn ? '●' : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.success, color: Colors.success, fontSize: 6, minWidth: 12, height: 12 },
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          tabBarIcon: ({ color }) => <IconSymbol name="doc.text.fill" size={24} color={color} />,
          tabBarBadge: canManage && unpaidInvoiceCount > 0 ? unpaidInvoiceCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <IconSymbol name="ellipsis.circle.fill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
