import { useState, type Ref } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SRSStageTransitionBadge } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { deriveMeaningCandidates, normalizeMeaning } from '@/core/answer/meaningEvaluator';
import type { ReviewItem, StageTransition } from '@/core/srs/srs.types';
import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';

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
};

/**
 * Alternates worth listing under the primary meaning: accepted meanings that
 * aren't just split-outs of the display string (those would be noise).
 */
function meaningAlternates(displayMeaning: string, meanings: string[]): string[] {
  const derived = new Set(deriveMeaningCandidates(displayMeaning).map(normalizeMeaning));
  const seen = new Set<string>();
  const alternates: string[] = [];
  for (const meaning of meanings) {
    const normalized = normalizeMeaning(meaning);
    if (!normalized || derived.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    alternates.push(meaning);
  }
  return alternates;
}

const READING_TYPE_LABEL = { onyomi: "On'yomi", kunyomi: "Kun'yomi" } as const;

export function IncorrectReveal({
  item,
  displayAnswer,
  detail,
  stageTransition,
  resultRef,
  rejectedAnswer,
  synonymState = { status: 'idle' },
  onAddSynonym,
}: IncorrectRevealProps) {
  const [expanded, setExpanded] = useState(false);

  const alternates = meaningAlternates(item.displayMeaning, item.meanings);
  const mnemonic = item.personalMnemonic ?? item.mnemonic;
  const kanjiReadings = detail?.kanjiReadings ?? [];
  const vocabReadings =
    item.itemType === 'vocabulary'
      ? item.answerKey.acceptedReadings.filter((reading) => reading !== item.primaryForm)
      : [];
  const exampleSentences = detail?.exampleSentences ?? [];

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
        <Text className="text-title-lg text-feedback-incorrect">✗ Incorrect</Text>
        <Text className={`text-display text-center ${CONTENT_TYPE_ACCENT[item.itemType].text}`}>
          {item.primaryForm}
        </Text>
        <Text className="text-body-lg text-primary text-center">
          Correct answer: {displayAnswer}
        </Text>
      </View>

      {stageTransition ? (
        <View className="items-center">
          <SRSStageTransitionBadge transition={stageTransition} />
        </View>
      ) : null}

      <View className="gap-space-sm rounded-radius-md bg-surface p-space-md">
        <View>
          <Text className="text-overline uppercase text-secondary">Meaning</Text>
          <Text className="text-body-lg text-primary">{item.displayMeaning}</Text>
          {alternates.length > 0 ? (
            <Text className="text-body-sm text-secondary">
              Also accepted: {alternates.join(', ')}
            </Text>
          ) : null}
        </View>

        {kanjiReadings.length > 0 ? (
          <View>
            <Text className="text-overline uppercase text-secondary">Readings</Text>
            {(['onyomi', 'kunyomi'] as const).map((type) => {
              const readings = kanjiReadings.filter((r) => r.readingType === type);
              if (readings.length === 0) return null;
              return (
                <Text key={type} className="text-body text-primary">
                  {READING_TYPE_LABEL[type]}: {readings.map((r) => r.reading).join('、')}
                </Text>
              );
            })}
          </View>
        ) : vocabReadings.length > 0 ? (
          <View>
            <Text className="text-overline uppercase text-secondary">Reading</Text>
            <Text className="text-body text-primary">{vocabReadings.join('、')}</Text>
          </View>
        ) : null}

        {mnemonic ? (
          <View>
            <Text className="text-overline uppercase text-secondary">Mnemonic</Text>
            <Text className="text-body text-secondary">{mnemonic}</Text>
          </View>
        ) : null}

        {exampleSentences.length > 0 ? (
          expanded ? (
            <View className="gap-space-xs">
              <Text className="text-overline uppercase text-secondary">Examples</Text>
              {exampleSentences.map((sentence) => (
                <View key={sentence.id}>
                  <Text className="text-body text-primary">{sentence.japanese}</Text>
                  <Text className="text-body-sm text-secondary">{sentence.english}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See full details"
              onPress={() => setExpanded(true)}
              className="min-h-[44px] justify-center">
              <Text className="text-body text-feedback-info">See full details</Text>
            </Pressable>
          )
        ) : null}
      </View>

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
