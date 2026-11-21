import { View } from 'react-native';

import { Button } from '@/components/common/Button';

// Stub for Task 4; Task 5 replaces the body with the full modal.
export function BrowseOnlyIntroModal({
  browsePending,
  onBrowse,
  onUseHere,
}: {
  browsePending: boolean;
  onBrowse(): void;
  onUseHere(): void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Button label="Browse" onPress={onBrowse} disabled={browsePending} />
      <Button label="Use here" onPress={onUseHere} variant="secondary" />
    </View>
  );
}
