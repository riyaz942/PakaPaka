import { Tabs } from 'expo-router';
import React from 'react';

import { Icon, type IconName } from '@/components/common/Icon';
import { getSemanticColors } from '@/constants/semantic-colors';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

/**
 * Tab icons come from the v2 drawn set. React Navigation hands the tint down as
 * a raw colour, so the icon takes its class from the focused flag instead —
 * jade when active, faint when not.
 */
function tabIcon(name: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <Icon
        name={name}
        size={22}
        strokeWidth={1.9}
        className={focused ? 'text-brand-500' : 'text-faint'}
      />
    );
  };
}

export default function TabsLayout() {
  const colors = getSemanticColors(usePaintedColorScheme());

  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'PlusJakartaSans_600SemiBold',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Home', tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="browse"
        options={{ title: 'Browse', tabBarIcon: tabIcon('search') }}
      />
      <Tabs.Screen
        name="converse"
        options={{ title: 'Talk', tabBarIcon: tabIcon('talk') }}
      />
      {/* Learn and Read are no longer tabs (FR62–FR63, UX-DR3) — Browse is the
          single discovery surface. The routes stay mounted with `href: null` so
          existing deep links keep resolving to their redirect screens. */}
      <Tabs.Screen name="learn" options={{ href: null }} />
      <Tabs.Screen name="read" options={{ href: null }} />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: tabIcon('stats') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }}
      />
    </Tabs>
  );
}
