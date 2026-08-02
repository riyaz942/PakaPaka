import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';

type Props = {
  message?: string;
};

export function StatsEmptyState({
  message = 'Complete your first session to see stats here.',
}: Props) {
  return (
    <View className="mt-8 items-center px-space-md">
      {/* v2 has no emoji in UI: the bars mark stands in for the old chart glyph. */}
      <View
        accessible
        accessibilityLabel="Stats illustration"
        className="h-16 w-16 items-center justify-center rounded-radius-xl bg-surface-elevated">
        <Icon name="stats" size={32} className="text-muted" />
      </View>
      <Text className="mt-space-md text-center text-body font-ui-medium text-secondary">
        {message}
      </Text>
    </View>
  );
}

export function WeaknessEmptySubState() {
  return (
    <View className="px-space-md py-space-md">
      <Text className="text-center text-body-sm font-ui-medium text-muted">
        No weak patterns detected yet — keep reviewing.
      </Text>
    </View>
  );
}
