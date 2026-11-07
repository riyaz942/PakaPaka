import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import React, { createContext, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/common/Icon';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useWideLayout } from '@/hooks/useWideLayout';
import { cn } from '@/utils/cn';

/** Lets the tab buttons follow the list's orientation without prop drilling through TabTrigger. */
const SidebarContext = createContext(false);

export default function TabsLayout() {
  // Desktop: navigation is a sidebar beside the content. Narrow windows keep
  // the top pill bar.
  const wide = useWideLayout();

  return (
    <SidebarContext.Provider value={wide}>
      <Tabs style={[styles.tabs, wide && styles.tabsWide]}>
        <TabList asChild>
          <WebTabList>
            <TabTrigger name="home" href="/" asChild>
              <TabButton icon="home">Home</TabButton>
            </TabTrigger>
            <TabTrigger name="browse" href="/browse" asChild>
              <TabButton icon="search">Browse</TabButton>
            </TabTrigger>
            <TabTrigger name="stats" href="/stats" asChild>
              <TabButton icon="stats">Stats</TabButton>
            </TabTrigger>
            <TabTrigger name="settings" href="/settings" asChild>
              <TabButton icon="settings">Settings</TabButton>
            </TabTrigger>
          </WebTabList>
        </TabList>
        <TabSlot style={styles.slot} />
      </Tabs>
    </SidebarContext.Provider>
  );
}

function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon: IconName }) {
  const sidebar = useContext(SidebarContext);

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        className={cn(
          'min-h-[44px] justify-center rounded-radius-md px-space-md py-space-sm',
          sidebar && 'flex-row items-center justify-start gap-space-sm',
          isFocused ? 'bg-brand-soft' : sidebar ? 'bg-background' : 'bg-surface',
        )}>
        {sidebar ? (
          <Icon
            name={icon}
            size={20}
            strokeWidth={1.9}
            className={isFocused ? 'text-brand-text' : 'text-faint'}
          />
        ) : null}
        <Text
          className={cn(
            sidebar ? 'text-body' : 'text-body-sm',
            isFocused ? 'font-ui-bold text-brand-text' : 'font-ui-semibold text-faint',
          )}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

function WebTabList(props: TabListProps) {
  const sidebar = useContext(SidebarContext);

  if (sidebar) {
    return (
      <View
        {...props}
        className="border-r border-border bg-background"
        style={styles.sidebar}>
        <Text className="mb-space-lg px-space-md text-title font-ui-extrabold text-primary">
          NihongoCore
        </Text>
        <View className="gap-space-xs">{props.children}</View>
      </View>
    );
  }

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
  tabsWide: {
    flexDirection: 'row',
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
  sidebar: {
    width: 232,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
