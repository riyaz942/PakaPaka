import { type Ref } from 'react';
import { Text, View } from 'react-native';

import { SRSStageIndicator, SRSStageTransitionBadge } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { buildGrammarHintLevels } from '@/core/content/hintLevels';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewItem, StageTransition } from '@/core/srs/srs.types';

import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';

import { IncorrectReveal, type AddSynonymUiState } from './IncorrectReveal';
import { ProgressiveHint } from './ProgressiveHint';
import { ReinforcementHighlight } from './ReinforcementHighlight';

export type ReviewCardState =
  | 'prompting'
  | 'evaluating'
  | 'correct'
  | 'incorrect'
  | 'typo'
  | 'wrong_script';

type ReviewCardProps = {
  item: ReviewItem;
  state: ReviewCardState;
  /** Correct answer shown on incorrect state */
  displayAnswer?: string;
  /** Stage movement caused by this answer; null/undefined when unchanged (no transition chrome) */
  stageTransition?: StageTransition | null;
  onHintReveal?: (count: number) => void;
  /** Ref attached to the accessible result region in correct/incorrect/typo states */
  resultRef?: Ref<View>;
  /** Prefetched full detail rendered on the incorrect reveal */
  revealDetail?: ReviewRevealDetail | null;
  /** The rejected answer, offered as a one-tap user synonym on the incorrect reveal */
  rejectedAnswer?: string;
  synonymState?: AddSynonymUiState;
  onAddSynonym?: (options?: { force?: boolean }) => void;
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

/**
 * Resolves the label + value revealed on a correct answer so the displayed text
 * and the screen-reader announcement always agree. Reading/production prompts
 * reveal the actual accepted reading; otherwise (or when no reading is seeded)
 * fall back to the meanings.
 */
export function resolveCorrectReveal(item: ReviewItem): { label: string; value: string } {
  const { promptType, displayMeaning, answerKey } = item;
  if (promptType === 'reading' || promptType === 'production') {
    const reading = answerKey?.acceptedReadings?.[0];
    if (reading) return { label: 'Reading', value: reading };
  }
  return { label: 'Meaning', value: displayMeaning };
}

const WRONG_SCRIPT_NUDGE: Record<PromptType, string> = {
  meaning: "We're looking for the meaning in English.",
  reading: "We're looking for the reading in kana or romaji.",
  production: "We're looking for the conjugated form in kana or romaji.",
};

export function ReviewCard({
  item,
  state,
  displayAnswer,
  stageTransition,
  onHintReveal,
  resultRef,
  revealDetail,
  rejectedAnswer,
  synonymState,
  onAddSynonym,
}: ReviewCardProps) {
  const { primaryForm, promptType, srsState, displayMeaning, itemType, reinforcementLink, answerKey } =
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
        {stageTransition ? <SRSStageTransitionBadge transition={stageTransition} /> : null}
        <ReinforcementHighlight link={reinforcementLink} />
      </View>
    );
  }

  if (state === 'incorrect') {
    return (
      <IncorrectReveal
        item={item}
        displayAnswer={displayAnswer ?? displayMeaning}
        detail={revealDetail ?? null}
        stageTransition={stageTransition}
        resultRef={resultRef}
        rejectedAnswer={rejectedAnswer}
        synonymState={synonymState}
        onAddSynonym={onAddSynonym}
      />
    );
  }

  if (state === 'wrong_script') {
    // One-line nudge only: the user hasn't been told the answer, so don't reveal detail.
    return (
      <View
        ref={resultRef}
        accessible
        accessibilityLabel={WRONG_SCRIPT_NUDGE[promptType]}
        className="gap-space-md items-center">
        <Text className={`text-display text-center ${CONTENT_TYPE_ACCENT[itemType].text}`}>
          {primaryForm}
        </Text>
        <Text className="text-body-lg text-feedback-warning text-center">
          {WRONG_SCRIPT_NUDGE[promptType]}
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
          meaning: displayMeaning,
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
