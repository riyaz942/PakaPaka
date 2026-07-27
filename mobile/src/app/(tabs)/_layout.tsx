import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { getSemanticColors } from '@/constants/semantic-colors';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <MaterialIcons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const colors = getSemanticColors(usePaintedColorScheme());

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
        name="browse"
        options={{ title: 'Browse', tabBarIcon: tabIcon('search') }}
      />
      <Tabs.Screen
        name="converse"
        options={{ title: 'Talk', tabBarIcon: tabIcon('chat') }}
      />
      {/* Learn and Read are no longer tabs (FR62–FR63, UX-DR3) — Browse is the
          single discovery surface. The routes stay mounted with `href: null` so
          existing deep links keep resolving to their redirect screens. */}
      <Tabs.Screen name="learn" options={{ href: null }} />
      <Tabs.Screen name="read" options={{ href: null }} />
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
