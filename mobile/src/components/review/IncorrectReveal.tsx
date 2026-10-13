import { type Ref } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlyphText } from '@/components/common/GlyphText';
import { Icon } from '@/components/common/Icon';
import { SRSStageTransitionBadge } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ReviewItem, StageTransition } from '@/core/srs/srs.types';
import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';
import { cn } from '@/utils/cn';
import { heroFontClassForWeight } from '@/utils/heroGlyphFont';

import { AnswerReveal, type AnswerCollision } from './AnswerReveal';
import { GrammarBuildCard } from './GrammarBuildCard';
import { GrammarReadCard } from './GrammarReadCard';

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
  /** The rejected answer, offered as a one-tap user synonym; empty for "Don't know" */
  rejectedAnswer?: string;
  synonymState?: AddSynonymUiState;
  onAddSynonym?: (options?: { force?: boolean }) => void;
  /** Another item's accepted answer matched the submission (FR86) */
  answerCollision?: AnswerCollision | null;
  onSaveGrammarAnswer?: () => void;
  grammarAnswerError?: boolean;
};

/** The verdict headline: drawn × plus the word, both in the danger family. */
function VerdictLine({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-space-sm">
      <Icon name="close" size={24} strokeWidth={2.6} className="text-feedback-incorrect" />
      <Text className="text-title-lg font-ui-extrabold text-feedback-incorrect-deep">
        {label}
      </Text>
    </View>
  );
}

export function IncorrectReveal({
  item,
  displayAnswer,
  detail,
  stageTransition,
  resultRef,
  rejectedAnswer,
  synonymState = { status: 'idle' },
  onAddSynonym,
  answerCollision,
  onSaveGrammarAnswer,
  grammarAnswerError,
}: IncorrectRevealProps) {
  const accent = CONTENT_TYPE_ACCENT[item.itemType];

  // Grammar: the hero card carries the answer itself, so no separate
  // "Correct answer" line. A variant form (もん for もの) shows beside the
  // pattern rather than contradicting it underneath.
  const isGrammar = item.itemType === 'grammar';
  const grammarCard =
    item.itemType === 'grammar'
      ? item.promptType === 'production'
        ? item.grammarBuild
        : item.grammarRead
      : undefined;
  const canSaveGrammarAnswer =
    item.itemType === 'grammar' &&
    item.promptType === 'production' &&
    Boolean(onSaveGrammarAnswer) &&
    Boolean(rejectedAnswer?.trim());
  // A Build answer is a whole sentence: the card below shows it, so the hero
  // keeps to the grammar form instead of repeating the sentence at display size.
  const heroText =
    isGrammar &&
    !(grammarCard && item.promptType === 'production') &&
    displayAnswer &&
    displayAnswer !== item.primaryForm
      ? `${item.primaryForm} / ${displayAnswer}`
      : item.primaryForm;

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
        accessibilityLabel={`Incorrect, correct answer is ${displayAnswer}`}
        className="gap-space-sm items-center">
        <VerdictLine label="Incorrect" />
        <View className={cn('w-full items-center rounded-radius-xl p-space-lg', accent.soft)}>
          <GlyphText
            className={cn(
              'text-display text-center',
              heroFontClassForWeight(heroText, 'bold'),
              accent.deep,
            )}>
            {heroText}
          </GlyphText>
        </View>
        {isGrammar ? null : (
          <Text className="text-body-lg font-ui-semibold text-primary text-center">
            Correct answer: {displayAnswer}
          </Text>
        )}
      </View>

      {grammarCard ? (
        <View className="w-full items-center gap-space-sm">
          {item.promptType === 'production' ? (
            <GrammarBuildCard item={item} answered />
          ) : (
            <GrammarReadCard item={item} answered />
          )}
          {item.answerKey.grammar?.structure ? (
            <Text className="text-body font-ui text-secondary text-center">
              {item.answerKey.grammar.structure}
            </Text>
          ) : null}
        </View>
      ) : null}

      {stageTransition ? (
        <View className="items-center">
          <SRSStageTransitionBadge transition={stageTransition} />
        </View>
      ) : null}

      {/* Shared trimmed panel (FR85): reading + meaning only — mnemonic and
          examples moved to the details route under review/. */}
      <AnswerReveal item={item} detail={detail} collision={answerCollision} />

      {canSaveGrammarAnswer ? (
        <View className="items-center gap-space-xs">
          {grammarAnswerError ? (
            <Text className="text-center text-body-sm font-ui text-feedback-incorrect-deep">
              Couldn&apos;t save your answer. Try again.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`My answer ${rejectedAnswer} is correct too`}
            onPress={onSaveGrammarAnswer}
            className="min-h-[44px] justify-center px-space-md">
            <Text className="text-body font-ui-semibold text-brand-text">My answer is correct too</Text>
          </Pressable>
        </View>
      ) : synonymState.status === 'added' ? (
        <Text className="text-center text-body-sm font-ui text-feedback-correct-deep">
          Added — it will be accepted on this item&apos;s next review.
        </Text>
      ) : canOfferSynonym ? (
        <View className="items-center gap-space-xs">
          {synonymState.status === 'collision' ? (
            <Text className="text-center text-body-sm font-ui text-feedback-warning-deep">
              &ldquo;{rejectedAnswer}&rdquo; is already accepted for {synonymState.collidesWith}.
            </Text>
          ) : null}
          {synonymState.status === 'error' ? (
            <Text className="text-center text-body-sm font-ui text-feedback-incorrect-deep">
              Couldn&apos;t save your answer. Try again.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Accept ${rejectedAnswer} as my answer`}
            onPress={() => onAddSynonym?.({ force: synonymState.status === 'collision' })}
            className="min-h-[44px] justify-center px-space-md">
            <Text className="text-body font-ui-semibold text-brand-text">
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
