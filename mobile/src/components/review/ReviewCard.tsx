import { type Ref } from 'react';
import { Text, View } from 'react-native';

import { SRSStageIndicator } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { buildGrammarHintLevels } from '@/core/content/hintLevels';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewItem } from '@/core/srs/srs.types';

import { ProgressiveHint } from './ProgressiveHint';
import { ReinforcementHighlight } from './ReinforcementHighlight';

export type ReviewCardState = 'prompting' | 'evaluating' | 'correct' | 'incorrect' | 'typo';

type ReviewCardProps = {
  item: ReviewItem;
  state: ReviewCardState;
  /** Correct answer shown on incorrect state */
  displayAnswer?: string;
  onHintReveal?: (count: number) => void;
  /** Ref attached to the accessible result region in correct/incorrect/typo states */
  resultRef?: Ref<View>;
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

function formatMeanings(meanings: string[]): string {
  return meanings.join(', ');
}

/**
 * Resolves the label + value revealed on a correct answer so the displayed text
 * and the screen-reader announcement always agree. Reading/production prompts
 * reveal the actual accepted reading; otherwise (or when no reading is seeded)
 * fall back to the meanings.
 */
export function resolveCorrectReveal(item: ReviewItem): { label: string; value: string } {
  const { promptType, meanings, answerKey } = item;
  if (promptType === 'reading' || promptType === 'production') {
    const reading = answerKey?.acceptedReadings?.[0];
    if (reading) return { label: 'Reading', value: reading };
  }
  return { label: 'Meaning', value: formatMeanings(meanings) };
}

export function ReviewCard({
  item,
  state,
  displayAnswer,
  onHintReveal,
  resultRef,
}: ReviewCardProps) {
  const { primaryForm, promptType, srsState, meanings, itemType, reinforcementLink, answerKey } =
    item;

  if (state === 'evaluating') {
    return null;
  }

  if (state === 'correct') {
    const { label, value } = resolveCorrectReveal(item);
    return (
      <View className="gap-space-md w-full items-center">
        <View
          ref={resultRef}
          accessible
          accessibilityLabel={`Correct, ${label.toLowerCase()}: ${value}`}
          className="gap-space-md items-center">
          <Text className="text-title-lg text-feedback-correct">✓ Correct</Text>
          <Text className="text-body-lg text-primary text-center">
            {label}: {value}
          </Text>
        </View>
        <ReinforcementHighlight link={reinforcementLink} />
      </View>
    );
  }

  if (state === 'incorrect') {
    const answer = displayAnswer ?? formatMeanings(meanings);
    return (
      <View
        ref={resultRef}
        accessible
        accessibilityLabel={`Incorrect, correct answer is ${answer}`}
        className="gap-space-md items-center">
        <Text className="text-title-lg text-feedback-incorrect">✗ Incorrect</Text>
        <Text className="text-body-lg text-primary text-center">
          Correct answer: {answer}
        </Text>
      </View>
    );
  }

  if (state === 'typo') {
    return (
      <View
        ref={resultRef}
        accessible
        accessibilityLabel="Close, try again"
        className="gap-space-md items-center">
        <Text className="text-title-lg text-feedback-warning">~ Close! Try again.</Text>
      </View>
    );
  }

  const hintLevels =
    itemType === 'grammar'
      ? buildGrammarHintLevels({
          structure: answerKey.grammar?.structure,
          meaning: meanings[0],
          reinforcementLink,
        })
      : [];

  return (
    <View className="gap-space-md w-full items-center">
      <Text className={`text-body-lg font-semibold ${MODE_LABEL_CLASS[promptType]}`}>
        {MODE_LABEL[promptType]}
      </Text>

      <Text className={`text-display text-center ${CONTENT_TYPE_ACCENT[itemType].text}`}>
        {primaryForm}
      </Text>

      <SRSStageIndicator stage={srsState.srsStageLabel} />

      {itemType === 'grammar' ? (
        <ProgressiveHint key={item.itemId} levels={hintLevels} onReveal={onHintReveal} />
      ) : null}
    </View>
  );
}
