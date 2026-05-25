import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { cn } from '@/utils/cn';

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <WebTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="learn" href="/learn" asChild>
            <TabButton>Learn</TabButton>
          </TabTrigger>
          <TabTrigger name="read" href="/read" asChild>
            <TabButton>Read</TabButton>
          </TabTrigger>
          <TabTrigger name="stats" href="/stats" asChild>
            <TabButton>Stats</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton>Settings</TabButton>
          </TabTrigger>
        </WebTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        className={cn(
          'rounded-radius-md px-space-md py-space-sm',
          isFocused ? 'bg-surface-elevated' : 'bg-surface',
        )}>
        <Text
          className={cn('text-body-sm', isFocused ? 'text-primary' : 'text-secondary')}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

function WebTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View
        className="flex-row flex-grow items-center gap-space-sm rounded-radius-lg bg-surface px-space-lg py-space-sm"
        style={{ maxWidth: MaxContentWidth }}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  pressed: {
    opacity: 0.7,
  },
});
