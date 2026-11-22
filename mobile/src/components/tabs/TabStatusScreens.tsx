import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

/** Web: full screens for moving PakaPaka between tabs ("Use here"). */

export function MovingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <ActivityIndicator />
      <Text className="mt-4 text-center text-body text-primary">
        Moving PakaPaka to this tab…
      </Text>
    </View>
  );
}

export function MovedScreen({ onUseHere }: { onUseHere(): void }) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-title font-ui-bold text-primary">
        PakaPaka is open in another tab
      </Text>
      <Text className="mt-2 max-w-md text-center text-body text-muted">
        You moved PakaPaka to another tab. Your answers up to now are saved.
      </Text>
      <Button label="Use here" onPress={onUseHere} className="mt-6" />
    </View>
  );
}

export function NotRespondingScreen({ onReload }: { onReload(): void }) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-title font-ui-bold text-primary">
        The other PakaPaka tab did not answer
      </Text>
      <Text className="mt-2 max-w-md text-center text-body text-muted">
        Open that tab once, then reload this page.
      </Text>
      <Button label="Reload" onPress={onReload} className="mt-6" />
    </View>
  );
}
