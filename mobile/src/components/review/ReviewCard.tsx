import { type Ref } from 'react';
import { Text, View } from 'react-native';

import { SRSStageIndicator, SRSStageTransitionBadge } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { buildGrammarHintLevels } from '@/core/content/hintLevels';
import { englishHintsAllowed } from '@/core/grammar/inputMode';
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
  | 'wrong_script'
  | 'wrong_reading_type';

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
  /** Near-miss flag (Plan 10): answer contained the right chunk but more than the blank wants */
  incompleteAnswer?: boolean;
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
 * and the screen-reader announcement always agree. Grammar reveals the graded
 * chunk as "Answer" (never "Reading" — Plan 07); reading/production prompts
 * reveal the actual accepted reading; otherwise (or when no reading is seeded)
 * fall back to the meanings.
 */
export function resolveCorrectReveal(item: ReviewItem): { label: string; value: string } {
  const { itemType, promptType, displayMeaning, answerKey } = item;
  if (itemType === 'grammar') {
    // Prefer the chunk this cloze actually blanked (authored variant answer).
    const form = item.clozeAnswer ?? answerKey?.grammar?.acceptedForms?.[0];
    if (form) return { label: 'Answer', value: form };
  }
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

// Right item, wrong reading type (FR82): the answer was a valid kun'yomi, so
// nudge toward the prompted type without revealing the on'yomi.
const WRONG_READING_TYPE_NUDGE = "We're looking for the on'yomi reading.";

export function ReviewCard({
  item,
  state,
  displayAnswer,
  stageTransition,
  onHintReveal,
  resultRef,
  revealDetail,
  incompleteAnswer,
  rejectedAnswer,
  synonymState,
  onAddSynonym,
}: ReviewCardProps) {
  const { primaryForm, promptType, srsState, displayMeaning, itemType, reinforcementLink, answerKey } =
    item;

  // Grammar cloze contract (Plan 07): prompt with the blanked sentence/frame,
  // never the bare form (for particles the form IS the answer). Label the mode
  // "Grammar", not "Production", to stop implying kanji-style drills.
  const isGrammarCloze = itemType === 'grammar' && !!item.clozePrompt;
  const promptText = isGrammarCloze ? item.clozePrompt! : primaryForm;
  // Kanji reading cards validate on'yomi only (FR81) — the label must say so.
  const modeLabel =
    itemType === 'grammar'
      ? 'Grammar'
      : itemType === 'kanji' && promptType === 'reading'
        ? "Reading — on'yomi"
        : MODE_LABEL[promptType];

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
        incompleteAnswer={incompleteAnswer}
        stageTransition={stageTransition}
        resultRef={resultRef}
        rejectedAnswer={rejectedAnswer}
        synonymState={synonymState}
        onAddSynonym={onAddSynonym}
      />
    );
  }

  if (state === 'wrong_script' || state === 'wrong_reading_type') {
    // One-line nudge only: the user hasn't been told the answer, so don't reveal detail.
    const nudge =
      state === 'wrong_reading_type' ? WRONG_READING_TYPE_NUDGE : WRONG_SCRIPT_NUDGE[promptType];
    return (
      <View
        ref={resultRef}
        accessible
        accessibilityLabel={nudge}
        className="gap-space-md items-center">
        <Text
          className={`${isGrammarCloze ? 'text-title-lg' : 'text-display'} text-center ${CONTENT_TYPE_ACCENT[itemType].text}`}>
          {promptText}
        </Text>
        <Text className="text-body-lg text-feedback-warning text-center">{nudge}</Text>
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

  // Two-rung hint ladder (Plan 10): nudge → English, with the English rung
  // gated off at Enlightened+ (Plan 08 scaffolding gate). Interim fallbacks
  // until authored variants cover every item: structure as the nudge, the
  // labeled meaning as the English rung.
  const hintLevels =
    itemType === 'grammar'
      ? buildGrammarHintLevels({
          nudge: item.clozeNudge ?? answerKey.grammar?.structure,
          english:
            item.clozeEnglish ??
            (displayMeaning ? `Meaning (hint): ${displayMeaning}` : null),
          englishAllowed: englishHintsAllowed(srsState.srsStageLabel),
          reinforcementLink,
        })
      : [];

  return (
    <View className="gap-space-md w-full items-center">
      <Text className={`text-body-lg font-semibold ${MODE_LABEL_CLASS[promptType]}`}>
        {modeLabel}
      </Text>

      <Text
        className={`${isGrammarCloze ? 'text-title-lg' : 'text-display'} text-center ${CONTENT_TYPE_ACCENT[itemType].text}`}>
        {promptText}
      </Text>

      <SRSStageIndicator stage={srsState.srsStageLabel} />

      {itemType === 'grammar' ? (
        <ProgressiveHint key={item.itemId} levels={hintLevels} onReveal={onHintReveal} />
      ) : null}
    </View>
  );
}
