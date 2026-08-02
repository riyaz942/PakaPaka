import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';

type DailyThresholdNoticeProps = {
  visible: boolean;
  onDismiss?: () => void;
};

const NOTICE_COPY = 'Goal met — keep going if you like, every extra card counts past 100%.';
const NOTICE_COPY_A11Y =
  'Goal met — keep going if you like, every extra card counts past 100 percent.';

/**
 * The banner slot's success styling with a manual dismiss: this notice sits on
 * the review screen for as long as the user leaves it there, so it cannot use
 * `Banner`'s timed dismissal.
 */
export function DailyThresholdNotice({ visible, onDismiss }: DailyThresholdNoticeProps) {
  if (!visible) {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={NOTICE_COPY_A11Y}
      className="mx-space-md mb-space-sm flex-row items-center gap-space-sm rounded-radius-md bg-feedback-correct-soft px-space-md py-space-sm">
      <Icon
        name="correct"
        size={20}
        strokeWidth={2.2}
        className="text-feedback-correct-deep"
      />
      <Text className="flex-1 text-body-sm font-ui-semibold text-feedback-correct-deep">
        {NOTICE_COPY}
      </Text>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          className="min-h-[44px] min-w-[44px] items-end justify-center"
          hitSlop={8}>
          <Icon name="close" size={18} strokeWidth={2.2} className="text-feedback-correct-deep" />
        </Pressable>
      ) : null}
    </View>
  );
}
