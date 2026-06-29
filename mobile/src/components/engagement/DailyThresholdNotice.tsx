import { Pressable, Text, View } from 'react-native';

type DailyThresholdNoticeProps = {
  visible: boolean;
  onDismiss?: () => void;
};

const NOTICE_COPY =
  "You've done enough for today 🎉 — keep going if you like, or wrap up anytime.";
const NOTICE_COPY_A11Y =
  "You've done enough for today — keep going if you like, or wrap up anytime.";

export function DailyThresholdNotice({ visible, onDismiss }: DailyThresholdNoticeProps) {
  if (!visible) {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={NOTICE_COPY_A11Y}
      className="mx-space-md mb-space-sm rounded-radius-md border border-feedback-info/30 bg-surface-elevated px-space-md py-space-sm">
      <Text className="text-body text-primary">{NOTICE_COPY}</Text>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          className="mt-space-xs self-end">
          <Text className="text-body-sm text-feedback-info">Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
