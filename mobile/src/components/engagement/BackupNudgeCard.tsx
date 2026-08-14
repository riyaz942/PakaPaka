import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type BackupNudgeCardProps = {
  /** Null when this device has never written a backup. */
  lastBackedUpAt: string | null;
  onBackUp: () => void;
  onDismiss: () => void;
};

/**
 * Web-only Home nudge (UX-DR5 slot). Browser storage is evictable — Safari
 * clears unused origins after about a week — so on web a backup is the only
 * thing standing between the learner and losing their schedule. Native Home
 * does not show this: the OS already backs the app sandbox up.
 */
export function BackupNudgeCard({ lastBackedUpAt, onBackUp, onDismiss }: BackupNudgeCardProps) {
  return (
    <View
      testID="backup-nudge-card"
      className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <Text className="text-body font-ui-extrabold text-primary">
        {lastBackedUpAt ? 'Time to back up again' : 'Back up your progress'}
      </Text>
      <Text className="mt-space-xs text-body-sm font-ui-medium text-secondary">
        Your progress lives in this browser, and browsers clear storage they think is unused. Export
        a backup file so a cleared browser costs you nothing.
      </Text>
      <View className="mt-space-md flex-row gap-space-sm">
        <View className="flex-1">
          <Button
            label="Back up now"
            variant="secondary"
            onPress={onBackUp}
            accessibilityLabel="Open backup in settings"
            testID="backup-nudge-open"
          />
        </View>
        <View className="flex-1">
          <Button
            label="Not now"
            variant="ghost"
            onPress={onDismiss}
            accessibilityLabel="Dismiss the backup reminder for this visit"
            testID="backup-nudge-dismiss"
          />
        </View>
      </View>
    </View>
  );
}
