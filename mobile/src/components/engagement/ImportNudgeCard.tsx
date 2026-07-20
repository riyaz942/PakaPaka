import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type ImportNudgeCardProps = {
  onImport: () => void;
  onDismiss: () => void;
};

/** Conditional Home nudge (UX-DR5): shown while no import has ever been run. */
export function ImportNudgeCard({ onImport, onDismiss }: ImportNudgeCardProps) {
  return (
    <View
      testID="import-nudge-card"
      className="rounded-radius-lg border border-border bg-surface p-space-md">
      <Text className="text-body font-semibold text-primary">
        Coming from WaniKani, Bunpro, or Anki?
      </Text>
      <Text className="mt-space-xs text-body-sm text-secondary">
        Import your review history so your queue starts where you left off.
      </Text>
      <View className="mt-space-md flex-row gap-space-sm">
        <View className="flex-1">
          <Button
            label="Import history"
            variant="secondary"
            onPress={onImport}
            accessibilityLabel="Open import in settings"
            testID="import-nudge-open"
          />
        </View>
        <View className="flex-1">
          <Button
            label="Not now"
            variant="ghost"
            onPress={onDismiss}
            accessibilityLabel="Dismiss the import suggestion for this visit"
            testID="import-nudge-dismiss"
          />
        </View>
      </View>
    </View>
  );
}
