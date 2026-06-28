import { Text, View } from 'react-native';

type Props = {
  message?: string;
};

export function StatsEmptyState({
  message = 'Complete your first session to see stats here.',
}: Props) {
  return (
    <View className="mt-8 items-center px-space-md">
      <Text accessibilityLabel="Stats illustration" className="text-display">
        📊
      </Text>
      <Text className="mt-space-md text-center text-body text-secondary">{message}</Text>
    </View>
  );
}

export function WeaknessEmptySubState() {
  return (
    <View className="px-space-md py-space-md">
      <Text className="text-center text-body text-secondary">
        No weak patterns detected yet — keep reviewing.
      </Text>
    </View>
  );
}
