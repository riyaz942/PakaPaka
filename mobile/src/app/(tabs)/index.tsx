import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { TabPlaceholderScreen } from '@/components/common/TabPlaceholderScreen';

export default function HomeScreen() {
  return (
    <TabPlaceholderScreen title="Home">
      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          className="rounded-radius-md bg-surface px-space-md py-space-sm"
          onPress={() => router.push('/review')}>
          <Text className="text-body text-feedback-info">Open review placeholder</Text>
        </Pressable>
      ) : null}
    </TabPlaceholderScreen>
  );
}
