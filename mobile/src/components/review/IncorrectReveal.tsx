import { type Ref } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { SRSStageTransitionBadge } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { resolveCompletedSentence } from '@/core/grammar/nearMiss';
import type { ReviewItem, StageTransition } from '@/core/srs/srs.types';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';

import { AnswerReveal, type AnswerCollision } from './AnswerReveal';

export type AddSynonymUiState =
  | { status: 'idle' }
  | { status: 'collision'; collidesWith: string }
  | { status: 'added' }
  | { status: 'error' };

type IncorrectRevealProps = {
  item: ReviewItem;
  /** Correct answer for the missed prompt (reading or meaning) */
  displayAnswer: string;
  /** Prefetched full detail; the reveal renders without it (thin fallback), never fetches */
  detail: ReviewRevealDetail | null;
  stageTransition?: StageTransition | null;
  resultRef?: Ref<View>;
  /** Near-miss (Plan 10): the answer contained the right chunk but more than the blank wants */
  incompleteAnswer?: boolean;
  /** The rejected answer, offered as a one-tap user synonym; empty for "Don't know" */
  rejectedAnswer?: string;
  synonymState?: AddSynonymUiState;
  onAddSynonym?: (options?: { force?: boolean }) => void;
  /** Another item's accepted answer matched the submission (FR86) */
  answerCollision?: AnswerCollision | null;
};

export function IncorrectReveal({
  item,
  displayAnswer,
  detail,
  stageTransition,
  resultRef,
  incompleteAnswer,
  rejectedAnswer,
  synonymState = { status: 'idle' },
  onAddSynonym,
  answerCollision,
}: IncorrectRevealProps) {
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();

  // Near-miss teaching reveal (Plan 10): acknowledge intent, show the chunk,
  // and show the completed sentence so the blank's scope is unmistakable.
  const isIncomplete = !!incompleteAnswer && item.itemType === 'grammar';
  const clozeSentence =
    item.itemType === 'grammar' ? (item.clozePromptFurigana ?? item.clozePrompt) : null;
  const completedSentence = isIncomplete
    ? resolveCompletedSentence(clozeSentence, displayAnswer)
    : null;

  const canOfferSynonym =
    Boolean(onAddSynonym) &&
    Boolean(rejectedAnswer?.trim()) &&
    item.promptType !== 'production' &&
    synonymState.status !== 'added';

  return (
    <View className="gap-space-md w-full">
      <View
        ref={resultRef}
        accessible
        accessibilityLabel={
          isIncomplete
            ? `Close, but you need just the grammar piece: ${displayAnswer}`
            : `Incorrect, correct answer is ${displayAnswer}`
        }
        className="gap-space-sm items-center">
        {isIncomplete ? (
          <>
            <Text className="text-title-lg text-feedback-incorrect">✗ Not quite</Text>
            <Text className="text-body text-feedback-warning text-center">
              You had the right idea — we need just the grammar piece:
            </Text>
          </>
        ) : (
          <Text className="text-title-lg text-feedback-incorrect">✗ Incorrect</Text>
        )}
        {/* Plan 12.4: keep the sentence the blank came from on screen, so the
            revealed chunk has context. */}
        {!isIncomplete && clozeSentence ? (
          <FuriganaText
            text={clozeSentence}
            mode={furiganaMode}
            knownKanji={knownKanji}
            className="text-body-lg text-secondary text-center"
          />
        ) : null}
        <Text className={`text-display text-center ${CONTENT_TYPE_ACCENT[item.itemType].text}`}>
          {isIncomplete ? displayAnswer : item.primaryForm}
        </Text>
        {isIncomplete ? (
          completedSentence ? (
            <FuriganaText
              text={completedSentence}
              mode={furiganaMode}
              knownKanji={knownKanji}
              className="text-body-lg text-primary text-center"
            />
          ) : null
        ) : (
          <Text className="text-body-lg text-primary text-center">
            Correct answer: {displayAnswer}
          </Text>
        )}
      </View>

      {stageTransition ? (
        <View className="items-center">
          <SRSStageTransitionBadge transition={stageTransition} />
        </View>
      ) : null}

      {/* Shared trimmed panel (FR85): reading + meaning only — mnemonic and
          examples moved to the details route under review/. */}
      <AnswerReveal item={item} detail={detail} collision={answerCollision} />

      {synonymState.status === 'added' ? (
        <Text className="text-body-sm text-feedback-correct text-center">
          Added — it will be accepted on this item&apos;s next review.
        </Text>
      ) : canOfferSynonym ? (
        <View className="items-center gap-space-xs">
          {synonymState.status === 'collision' ? (
            <Text className="text-body-sm text-feedback-warning text-center">
              &ldquo;{rejectedAnswer}&rdquo; is already accepted for {synonymState.collidesWith}.
            </Text>
          ) : null}
          {synonymState.status === 'error' ? (
            <Text className="text-body-sm text-feedback-incorrect text-center">
              Couldn&apos;t save your answer. Try again.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Accept ${rejectedAnswer} as my answer`}
            onPress={() => onAddSynonym?.({ force: synonymState.status === 'collision' })}
            className="min-h-[44px] justify-center px-space-md">
            <Text className="text-body text-feedback-info">
              {synonymState.status === 'collision'
                ? 'Add it anyway'
                : `Accept "${rejectedAnswer}" as my answer`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
