import { Tabs } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];

  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        tabBarActiveTintColor: palette.tint,
        tabBarInactiveTintColor: palette.tabIconDefault,
        headerStyle: {
          backgroundColor: palette.background,
        },
        headerTintColor: palette.text,
        headerShadowVisible: false,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '공지',
          tabBarIcon: ({ color }) => (
            <Icon ios="megaphone.fill" android="campaign" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="spots"
        options={{
          title: '스팟',
          tabBarIcon: ({ color }) => (
            <Icon ios="mappin.and.ellipse" android="location_on" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="repairs"
        options={{
          title: '수리',
          tabBarIcon: ({ color }) => (
            <Icon ios="wrench.and.screwdriver.fill" android="build" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          title: '3D',
          tabBarIcon: ({ color }) => (
            <Icon ios="cube.fill" android="view_in_ar" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="votes"
        options={{
          title: '투표',
          tabBarIcon: ({ color }) => (
            <Icon ios="checkmark.square.fill" android="how_to_vote" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
