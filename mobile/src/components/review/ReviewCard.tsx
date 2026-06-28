import { Text, View } from 'react-native';

import { SRSStageIndicator } from '@/components/common/SRSStageIndicator';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewItem } from '@/core/srs/srs.types';

export type ReviewCardState = 'prompting' | 'evaluating' | 'correct' | 'incorrect' | 'typo';

type ReviewCardProps = {
  item: ReviewItem;
  state: ReviewCardState;
};

const MODE_LABEL: Record<PromptType, string> = {
  reading: 'Reading',
  meaning: 'Meaning',
  production: 'Production',
};

const MODE_LABEL_CLASS: Record<PromptType, string> = {
  reading: 'text-content-reading',
  meaning: 'text-feedback-info',
  production: 'text-content-grammar',
};

export function ReviewCard({ item, state }: ReviewCardProps) {
  if (state !== 'prompting') {
    return null;
  }

  const { primaryForm, promptType, srsState } = item;

  return (
    <View className="gap-space-md items-center">
      <Text className={`text-body-lg font-semibold ${MODE_LABEL_CLASS[promptType]}`}>
        {MODE_LABEL[promptType]}
      </Text>

      <Text className="text-display text-primary text-center">{primaryForm}</Text>

      <SRSStageIndicator stage={srsState.srsStageLabel} />
    </View>
  );
}
