import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { useTabMode } from '@/providers/TabModeContext';

/** Web browse-only tab: replaces every screen that studies or writes. */
export function BrowseOnlyBlockedScreen() {
  const tabMode = useTabMode();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text accessibilityRole="header" className="text-center text-title font-ui-bold text-primary">
        Reviews and lessons run in the other tab
      </Text>
      <Text className="mt-2 max-w-md text-center text-body text-muted">
        Only one tab can save your progress. This tab is for browsing. To study here, move
        PakaPaka to this tab.
      </Text>
      <View className="mt-6 flex-row flex-wrap justify-center gap-space-md">
        <Button label="Use here" onPress={() => tabMode.useHere()} />
        <Button
          label="Back to Browse"
          onPress={() => router.replace('/browse')}
          variant="secondary"
        />
      </View>
    </View>
  );
}
