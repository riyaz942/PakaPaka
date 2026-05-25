import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth } from '@/constants/theme';

type TabPlaceholderScreenProps = {
  title: string;
  children?: ReactNode;
};

export function TabPlaceholderScreen({ title, children }: TabPlaceholderScreenProps) {
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        className="flex-1 items-center justify-center gap-space-md px-space-lg"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          paddingBottom: BottomTabInset,
          width: '100%',
        }}>
        <Text className="text-center text-title text-primary">{title}</Text>
        {children}
      </SafeAreaView>
    </View>
  );
}
