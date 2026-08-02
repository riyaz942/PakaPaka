import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type WelcomeBackCardProps = {
  sliceSize: number;
  dueCount: number;
  onStartSlice: () => void;
  onDismiss: () => void;
};

/**
 * Welcome-back triage (FR61): offers an eased slice instead of dumping the
 * whole backlog. Invitation framing — no guilt about the time away.
 */
export function WelcomeBackCard({
  sliceSize,
  dueCount,
  onStartSlice,
  onDismiss,
}: WelcomeBackCardProps) {
  return (
    <View
      testID="welcome-back-card"
      className="rounded-radius-lg bg-brand-soft p-space-md">
      <Text className="text-body font-ui-extrabold text-primary">Good to see you again</Text>
      <Text className="mt-space-xs text-body-sm font-ui-medium text-secondary">
        {`Ease back in: ${sliceSize} of your ${dueCount} due. The rest can wait.`}
      </Text>
      <View className="mt-space-md flex-row gap-space-sm">
        <View className="flex-1">
          <Button
            label={`Review ${sliceSize}`}
            onPress={onStartSlice}
            accessibilityLabel={`Start an eased review of ${sliceSize} items`}
            testID="welcome-back-start"
          />
        </View>
        <View className="flex-1">
          <Button
            label="Not now"
            variant="ghost"
            onPress={onDismiss}
            accessibilityLabel="Dismiss the welcome back offer for this visit"
            testID="welcome-back-dismiss"
          />
        </View>
      </View>
    </View>
  );
}
