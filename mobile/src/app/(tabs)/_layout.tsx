import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { useColorScheme } from 'react-native';

import { getSemanticColors } from '@/constants/semantic-colors';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const colors = getSemanticColors(resolveColorScheme(colorScheme));

  return (
    <NativeTabs
      backgroundColor={colors.background}
      labelStyle={{ color: colors.secondary, selected: { color: colors.primary } }}
      tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="learn">
        <NativeTabs.Trigger.Label>Learn</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="read">
        <NativeTabs.Trigger.Label>Read</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="text.book.closed" md="auto_stories" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gear" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
