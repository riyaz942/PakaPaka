import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';

import { getSemanticColors } from '@/constants/semantic-colors';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <MaterialIcons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const colors = getSemanticColors(resolveColorScheme(colorScheme));

  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.feedbackInfo,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="learn"
        options={{ title: 'Learn', tabBarIcon: tabIcon('menu-book') }}
      />
      <Tabs.Screen
        name="read"
        options={{ title: 'Read', tabBarIcon: tabIcon('auto-stories') }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: tabIcon('bar-chart') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }}
      />
    </Tabs>
  );
}
