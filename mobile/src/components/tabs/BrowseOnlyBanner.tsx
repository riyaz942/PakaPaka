import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { useTabMode } from '@/providers/TabModeContext';

/** Web: stays at the top of every screen in a browse-only tab. */
export function BrowseOnlyBanner() {
  const tabMode = useTabMode();

  if (!tabMode.browseOnly) {
    return null;
  }

  return (
    <View className="flex-row flex-wrap items-center justify-between gap-space-sm border-b border-border bg-surface-elevated px-space-md py-space-sm">
      <Text className="flex-shrink text-body text-primary">
        Browse only. Reviews and lessons run in your other tab.
      </Text>
      <Button label="Use here" onPress={() => tabMode.useHere()} variant="secondary" />
    </View>
  );
}
