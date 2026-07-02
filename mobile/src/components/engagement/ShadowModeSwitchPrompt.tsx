import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type ShadowModeSwitchPromptProps = {
  daysActive: number;
  onCommit: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
};

/**
 * Non-blocking "ready to switch fully?" card (Epic 8, FR33k-PM). Always an inline
 * Home card — never a modal — and ignoring it leaves the app fully usable.
 */
export function ShadowModeSwitchPrompt({
  daysActive,
  onCommit,
  onSnooze,
  onDismiss,
}: ShadowModeSwitchPromptProps) {
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`You've been comparing for ${daysActive} days. Ready to switch fully?`}
      className="gap-space-md rounded-radius-md border border-border bg-surface p-space-md">
      <Text accessibilityRole="header" className="text-title text-primary">
        {`You've been comparing for ${daysActive} days`}
      </Text>
      <Text className="text-body text-secondary">
        Ready to switch fully? No rush — nothing changes until you decide.
      </Text>

      <View className="gap-space-sm">
        <Button
          label="I'm ready to switch"
          onPress={onCommit}
          variant="primary"
          accessibilityLabel="I'm ready to switch fully"
          testID="shadow-mode-switch-prompt-commit"
        />
        <Button
          label="Remind me later"
          onPress={onSnooze}
          variant="tertiary"
          accessibilityLabel="Remind me later"
          testID="shadow-mode-switch-prompt-snooze"
        />
        <Button
          label="Don't show again"
          onPress={onDismiss}
          variant="ghost"
          accessibilityLabel="Don't show this again"
          testID="shadow-mode-switch-prompt-dismiss"
        />
      </View>
    </View>
  );
}
