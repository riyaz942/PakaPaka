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
    <Tabs style={styles.tabs}>
      <TabList asChild>
        <WebTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="browse" href="/browse" asChild>
            <TabButton>Browse</TabButton>
          </TabTrigger>
          <TabTrigger name="stats" href="/stats" asChild>
            <TabButton>Stats</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton>Settings</TabButton>
          </TabTrigger>
        </WebTabList>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        className={cn(
          'min-h-[44px] justify-center rounded-radius-md px-space-md py-space-sm',
          isFocused ? 'bg-brand-soft' : 'bg-surface',
        )}>
        <Text
          className={cn(
            'text-body-sm',
            isFocused ? 'font-ui-bold text-brand-text' : 'font-ui-semibold text-faint',
          )}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

function WebTabList(props: TabListProps) {
  return (
    <View {...props} className="bg-background" style={styles.tabListContainer}>
      <View
        className="flex-row flex-grow items-center gap-space-sm rounded-radius-lg border border-border bg-surface px-space-lg py-space-sm shadow-e2"
        style={{ maxWidth: MaxContentWidth }}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  tabListContainer: {
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
