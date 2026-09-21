import { type Ref } from 'react';
import { Text, View } from 'react-native';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { FuriganaText } from '@/components/common/FuriganaText';
import { GuidanceInfoButton } from '@/components/common/GuidanceInfoButton';
import { Icon } from '@/components/common/Icon';
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
import { cn } from '@/utils/cn';
import { heroFontClass } from '@/utils/heroGlyphFont';

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

/**
 * The prompt kicker names what is being asked, so it is coloured by the *ask*,
 * not the item: meaning in the radical blue the spec draws, readings in the
 * kanji hue (the only two-card type that asks for one), production in gold.
 * All three take the `-deep` step — an extrabold 17px kicker is body text by
 * WCAG's reckoning and the base hues do not clear 4.5:1 in light mode.
 */
const MODE_LABEL_CLASS: Record<PromptType, string> = {
  reading: 'text-content-kanji-deep',
  meaning: 'text-content-radical-deep',
  production: 'text-content-grammar-deep',
};

/**
 * The review glyph is the biggest thing in the app. It steps down as the form
 * gets longer so a seven-character word still fits the line the spec draws for
 * a single kanji.
 */
const PROMPT_FONT_SIZE = {
  glyph: { fontSize: 132, lineHeight: 140 },
  word: { fontSize: 72, lineHeight: 84 },
  phrase: { fontSize: 44, lineHeight: 56 },
} as const;

function promptFontSize(display: string) {
  if (display.length <= 2) return PROMPT_FONT_SIZE.glyph;
  if (display.length <= 4) return PROMPT_FONT_SIZE.word;
  return PROMPT_FONT_SIZE.phrase;
}

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

/** "写", "写 and 真", "写, 真 and 番" */
function joinForms(forms: string[]): string {
  if (forms.length <= 1) return forms.join('');
  return `${forms.slice(0, -1).join(', ')} and ${forms[forms.length - 1]}`;
}

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
  const accent = CONTENT_TYPE_ACCENT[itemType];

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

  // The prompt sits on the item's soft type fill, same as the Browse/lesson
  // hero, so the glyph's family (radical/kanji/vocabulary/grammar) reads at a
  // glance instead of relying on the kicker text alone.
  const grammarPromptClass = cn('text-title-lg font-jp-bold text-center', accent.deep);
  // v2 rule 1/5: a meaning prompt on a word whose kanji are untaught is
  // unreadable as bare text, so it is annotated. Only the meaning card of a
  // reading-locked word — on any word that also gets a reading card, printing
  // the reading here would hand over that card's answer.
  const annotatedPrompt =
    item.readingLocked && promptType === 'meaning' ? item.furigana : null;
  const renderPrompt = (display: string) =>
    isGrammarCloze ? (
      <FuriganaText
        text={display}
        mode={furiganaMode}
        knownKanji={knownKanji}
        className={grammarPromptClass}
      />
    ) : annotatedPrompt ? (
      <FuriganaText
        testID="review-prompt-glyph"
        text={annotatedPrompt}
        mode={furiganaMode}
        // The word is reading-locked, so it is by definition not mastered —
        // 'auto' must show the reading. The learner's global 'hidden' setting
        // still wins; that is their explicit choice, not a silent default.
        isKnownWord={false}
        className={cn('text-center', accent.deep, heroFontClass(display, promptFontSize(display).fontSize))}
        style={promptFontSize(display)}
      />
    ) : (
      <Text
        testID="review-prompt-glyph"
        className={cn('text-center', accent.deep, heroFontClass(display, promptFontSize(display).fontSize))}
        style={promptFontSize(display)}>
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
      <View className="flex-row items-center gap-space-xs">
        <Text className={`text-body-lg font-ui-extrabold ${MODE_LABEL_CLASS[promptType]}`}>
          {modeLabel}
        </Text>
        {/* Only where the pair is visible — the incorrect reveal returns above
            without a kicker. Vocabulary pairs (v2 rule 2) are excluded: this
            card's copy is about kanji and would misname what is on screen. */}
        {item.isTwoCardItem && itemType === 'kanji' ? (
          <GuidanceInfoButton cardId="two-card-kanji" />
        ) : null}
      </View>

      <View className={cn('w-full items-center rounded-radius-xl p-space-lg', accent.soft)}>
        {promptNode}
      </View>

      {correctReveal ? null : (
        <SRSStageIndicator stage={srsState.srsStageLabel} infoCardId="spaced-repetition" />
      )}

      {/* v2 rule 3: the word is held at master until its kanji are learned. A
          word frozen with no explanation reads as a bug. */}
      {!correctReveal && item.readingLocked && item.readingLockedBy?.length ? (
        <Text testID="reading-locked-note" className="text-caption font-ui-medium text-secondary text-center">
          Master until you learn {joinForms(item.readingLockedBy)}
        </Text>
      ) : null}

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
            accessibilityLabel={`Correct, ${correctReveal.label.toLowerCase()}: ${correctReveal.value}`}
            className="flex-row items-center gap-space-sm">
            <Icon name="correct" size={24} strokeWidth={2.6} className="text-feedback-correct" />
            <Text className="text-title-lg font-ui-extrabold text-feedback-correct-deep">
              Correct
            </Text>
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
            <Text className="text-body-lg font-ui-semibold text-feedback-warning-deep text-center">
              {nudge}
            </Text>
          </View>
        </FadeSlideIn>
      ) : null}
    </View>
  );
}
