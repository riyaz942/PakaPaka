import { type Ref } from 'react';
import { Text, View } from 'react-native';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { FuriganaText } from '@/components/common/FuriganaText';
import { SRSStageIndicator, SRSStageTransitionBadge } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { buildGrammarHintLevels } from '@/core/content/hintLevels';
import { blankFormsInStructure } from '@/core/grammar/clozeBuilder';
import { englishHintsAllowed } from '@/core/grammar/inputMode';
import { resolveCompletedSentence } from '@/core/grammar/nearMiss';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewItem, StageTransition } from '@/core/srs/srs.types';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';

import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';

import { AnswerReveal, type AnswerCollision } from './AnswerReveal';
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
  /** Another item's accepted answer matched the submission (FR86) */
  answerCollision?: AnswerCollision | null;
};

const MODE_LABEL: Record<PromptType, string> = {
  reading: 'Reading',
  meaning: 'Meaning',
  production: 'Production',
};

const MODE_LABEL_CLASS: Record<PromptType, string> = {
  // Slate, as it always was — this is the prompt *type* "reading", unrelated to
  // reading passages. Session 7 retunes the review prompt kicker.
  reading: 'text-content-passage',
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

const TYPO_NUDGE = '~ Close! Try again.';

// Short enough that the feedback still lands inside NFR1's <100ms perception
// budget — decoration on top of information already on screen, never a gate.
const FEEDBACK_ANIMATION_MS = 200;

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
  answerCollision,
}: ReviewCardProps) {
  const { primaryForm, promptType, srsState, displayMeaning, itemType, reinforcementLink, answerKey } =
    item;
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();

  // Grammar cloze contract (Plan 07): prompt with the blanked sentence/frame,
  // never the bare form (for particles the form IS the answer). Label the mode
  // "Grammar", not "Production", to stop implying kanji-style drills.
  const isGrammarCloze = itemType === 'grammar' && !!item.clozePrompt;
  const promptDisplay = isGrammarCloze
    ? (item.clozePromptFurigana ?? item.clozePrompt!)
    : primaryForm;
  // Kanji reading cards validate on'yomi only (FR81) — the label must say so.
  const modeLabel =
    itemType === 'grammar'
      ? 'Grammar'
      : itemType === 'kanji' && promptType === 'reading'
        ? "Reading — on'yomi"
        : MODE_LABEL[promptType];

  const grammarPromptClass = `text-title-lg text-center ${CONTENT_TYPE_ACCENT[itemType].text}`;
  const renderPrompt = (display: string) =>
    isGrammarCloze ? (
      <FuriganaText
        text={display}
        mode={furiganaMode}
        knownKanji={knownKanji}
        className={grammarPromptClass}
      />
    ) : (
      <Text className={`text-display text-center ${CONTENT_TYPE_ACCENT[itemType].text}`}>
        {display}
      </Text>
    );
  const grammarPrompt = renderPrompt(promptDisplay);

  if (state === 'incorrect') {
    return (
      <FadeSlideIn duration={FEEDBACK_ANIMATION_MS} className="w-full">
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
          answerCollision={answerCollision}
        />
      </FadeSlideIn>
    );
  }

  // Plan 12.3/12.4: every non-terminal state and the correct reveal keep the
  // original question on screen — feedback is appended beneath the prompt,
  // never swapped in for it.
  const nudge =
    state === 'typo'
      ? TYPO_NUDGE
      : state === 'wrong_reading_type'
        ? WRONG_READING_TYPE_NUDGE
        : state === 'wrong_script'
          ? WRONG_SCRIPT_NUDGE[promptType]
          : null;

  const correctReveal = state === 'correct' ? resolveCorrectReveal(item) : null;
  // A correct grammar cloze reads best with the blank filled in.
  const promptNode =
    correctReveal && isGrammarCloze
      ? renderPrompt(
          resolveCompletedSentence(promptDisplay, correctReveal.value) ?? promptDisplay,
        )
      : grammarPrompt;

  // Two-rung hint ladder (Plan 10): nudge → English, with the English rung
  // gated off at Enlightened+ (Plan 08 scaffolding gate). Interim fallbacks
  // until authored variants cover every item: the structure frame as the nudge
  // — blanked, since "Noun + を + Verb" hands over a one-particle answer
  // (R1.5) — and the labeled meaning as the English rung.
  const hintLevels =
    itemType === 'grammar'
      ? buildGrammarHintLevels({
          nudge:
            item.clozeNudge ??
            blankFormsInStructure(answerKey.grammar?.structure, [
              ...(item.clozeAnswer ? [item.clozeAnswer] : []),
              ...(answerKey.grammar?.acceptedForms ?? []),
            ]),
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

      {promptNode}

      {correctReveal ? null : <SRSStageIndicator stage={srsState.srsStageLabel} />}

      {itemType === 'grammar' && !correctReveal ? (
        <ProgressiveHint key={item.itemId} levels={hintLevels} onReveal={onHintReveal} />
      ) : null}

      {correctReveal ? (
        <FadeSlideIn
          duration={FEEDBACK_ANIMATION_MS}
          className="gap-space-md w-full items-center">
          <View
            ref={resultRef}
            accessible
            accessibilityLabel={`Correct, ${correctReveal.label.toLowerCase()}: ${correctReveal.value}`}>
            <Text className="text-title-lg text-feedback-correct">✓ Correct</Text>
          </View>
          {stageTransition ? <SRSStageTransitionBadge transition={stageTransition} /> : null}
          {/* Shared trimmed panel on the correct path too (FR85, UX-DR8) —
              shown expanded, never gated behind an icon. */}
          <AnswerReveal item={item} detail={revealDetail ?? null} collision={answerCollision} />
          <ReinforcementHighlight link={reinforcementLink} />
        </FadeSlideIn>
      ) : null}

      {nudge ? (
        // One-line nudge only: the user hasn't been told the answer, so don't reveal detail.
        <FadeSlideIn duration={FEEDBACK_ANIMATION_MS} className="items-center">
          <View
            ref={resultRef}
            accessible
            accessibilityLabel={state === 'typo' ? 'Close, try again' : nudge}>
            <Text className="text-body-lg text-feedback-warning text-center">{nudge}</Text>
          </View>
        </FadeSlideIn>
      ) : null}
    </View>
  );
}
