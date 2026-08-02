import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import type { ReinforcementLink } from '@/core/content/content.types';

type ReinforcementHighlightProps = {
  link: ReinforcementLink | null | undefined;
};

export function ReinforcementHighlight({ link }: ReinforcementHighlightProps) {
  if (!link) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Reinforcement: ${link.displayText}`}
      className="flex-row items-center gap-space-xs rounded-radius-md bg-reinforcement-bg px-space-md py-space-sm">
      <Icon name="chevron" size={14} strokeWidth={2.2} className="text-reinforcement-text" />
      <Text className="flex-1 text-caption font-ui-medium text-reinforcement-text">
        {link.displayText}
      </Text>
    </View>
  );
}
