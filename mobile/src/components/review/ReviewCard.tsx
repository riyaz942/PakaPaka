import { type Ref } from 'react';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { GlyphText } from '@/components/common/GlyphText';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { FuriganaText } from '@/components/common/FuriganaText';
import { GuidanceInfoButton } from '@/components/common/GuidanceInfoButton';
import { Icon } from '@/components/common/Icon';
import { SRSStageIndicator, SRSStageTransitionBadge } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { soft } from '@/constants/motion';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewItem, StageTransition } from '@/core/srs/srs.types';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';
import { cn } from '@/utils/cn';
import { heroFontClass } from '@/utils/heroGlyphFont';

import { AnswerReveal, type AnswerCollision } from './AnswerReveal';
import { GrammarBuildCard } from './GrammarBuildCard';
import { GrammarReadCard } from './GrammarReadCard';
import { IncorrectReveal, type AddSynonymUiState } from './IncorrectReveal';
import { ReinforcementHighlight } from './ReinforcementHighlight';

export type ReviewCardState =
  | 'prompting'
  | 'evaluating'
  | 'correct'
  | 'incorrect'
  | 'typo'
  | 'wrong_script'
  | 'wrong_reading_type'
  | 'other_grammar'
  | 'close';

type ReviewCardProps = {
  item: ReviewItem;
  state: ReviewCardState;
  /** Correct answer shown on incorrect state */
  displayAnswer?: string;
  /** Stage movement caused by this answer; null/undefined when unchanged (no transition chrome) */
  stageTransition?: StageTransition | null;
  /** Ref attached to the accessible result region in correct/incorrect/typo states */
  resultRef?: Ref<View>;
  /** Prefetched full detail rendered on the incorrect reveal */
  revealDetail?: ReviewRevealDetail | null;
  /** The rejected answer, offered as a one-tap user synonym on the incorrect reveal */
  rejectedAnswer?: string;
  synonymState?: AddSynonymUiState;
  onAddSynonym?: (options?: { force?: boolean }) => void;
  /** Another item's accepted answer matched the submission (FR86) */
  answerCollision?: AnswerCollision | null;
  /** Grammar Build, incorrect state: "My answer is correct too" (D4) */
  onSaveGrammarAnswer?: () => void;
  /** The last save attempt failed */
  grammarAnswerError?: boolean;
  /** Grammar Build, close state: the one-line nudge from the evaluator */
  closeNudge?: string;
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
 * and the screen-reader announcement always agree. A grammar Build card reveals
 * its sentence as "Answer", a Read card the meaning; reading/production prompts
 * reveal the actual accepted reading; otherwise (or when no reading is seeded)
 * fall back to the meanings.
 */
export function resolveCorrectReveal(item: ReviewItem): { label: string; value: string } {
  if (item.itemType === 'grammar' && item.promptType === 'production' && item.grammarBuild) {
    return { label: 'Answer', value: item.grammarBuild.japanese };
  }
  if (item.itemType === 'grammar' && item.promptType === 'meaning' && item.grammarRead) {
    return { label: 'Meaning', value: item.displayMeaning };
  }
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

// Right item, wrong reading type (FR82): the answer was a valid kun'yomi, so
// nudge toward the prompted type without revealing the on'yomi.
const WRONG_READING_TYPE_NUDGE = "We're looking for the on'yomi reading.";

const TYPO_NUDGE = '~ Close! Try again.';

const OTHER_GRAMMAR_NUDGE = 'That works, but it uses a different grammar point. Try again.';

/** "写", "写 and 真", "写, 真 and 番" */
function joinForms(forms: string[]): string {
  if (forms.length <= 1) return forms.join('');
  return `${forms.slice(0, -1).join(', ')} and ${forms[forms.length - 1]}`;
}

// Feedback text is on screen from the first frame; the spring only eases it
// in — decoration on top of information already shown, never a gate (NFR1).

/** The correct tick, then a stage-up badge, zoom in. */
const CORRECT_POP = soft(ZoomIn);
const STAGE_UP_POP = soft(ZoomIn.delay(100));

export function ReviewCard({
  item,
  state,
  displayAnswer,
  stageTransition,
  resultRef,
  revealDetail,
  rejectedAnswer,
  synonymState,
  onAddSynonym,
  answerCollision,
  onSaveGrammarAnswer,
  grammarAnswerError,
  closeNudge,
}: ReviewCardProps) {
  const { primaryForm, promptType, srsState, displayMeaning, itemType, reinforcementLink } = item;
  const { mode: furiganaMode } = useFuriganaPreference();
  const { reducedMotion } = useReducedMotion();
  const accent = CONTENT_TYPE_ACCENT[itemType];
  // Grammar pair (spec §3): the Read card asks about one sentence, the Build
  // card about another; both payloads ride on both cards of the pair.
  const grammarCard =
    itemType === 'grammar'
      ? promptType === 'production'
        ? item.grammarBuild
        : item.grammarRead
      : undefined;

  const promptDisplay = primaryForm;
  // Kanji reading cards validate on'yomi only (FR81) — the label must say so.
  const modeLabel =
    itemType === 'grammar'
      ? promptType === 'production'
        ? 'Grammar · Build'
        : 'Grammar · Read'
      : itemType === 'kanji' && promptType === 'reading'
        ? "Reading — on'yomi"
        : MODE_LABEL[promptType];

  // The prompt sits on the item's soft type fill, same as the Browse/lesson
  // hero, so the glyph's family (radical/kanji/vocabulary/grammar) reads at a
  // glance instead of relying on the kicker text alone.
  // v2 rule 1/5: a meaning prompt on a word whose kanji are untaught is
  // unreadable as bare text, so it is annotated. Only the meaning card of a
  // reading-locked word — on any word that also gets a reading card, printing
  // the reading here would hand over that card's answer.
  const annotatedPrompt =
    item.readingLocked && promptType === 'meaning' ? item.furigana : null;
  const renderPrompt = (display: string) =>
    annotatedPrompt ? (
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
      <GlyphText
        testID="review-prompt-glyph"
        className={cn('text-center', accent.deep, heroFontClass(display, promptFontSize(display).fontSize))}
        style={promptFontSize(display)}>
        {display}
      </GlyphText>
    );
  const grammarPrompt = renderPrompt(promptDisplay);

  if (state === 'incorrect') {
    return (
      // "Don't know" was the learner's own choice, not a miss — its answer
      // arrives on the calmer spring.
      <FadeSlideIn slow={!rejectedAnswer} className="w-full">
        <IncorrectReveal
          item={item}
          displayAnswer={displayAnswer ?? displayMeaning}
          detail={revealDetail ?? null}
          stageTransition={stageTransition}
          resultRef={resultRef}
          rejectedAnswer={rejectedAnswer}
          synonymState={synonymState}
          onAddSynonym={onAddSynonym}
          answerCollision={answerCollision}
          onSaveGrammarAnswer={onSaveGrammarAnswer}
          grammarAnswerError={grammarAnswerError}
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
        : state === 'other_grammar'
          ? OTHER_GRAMMAR_NUDGE
          : state === 'close'
            ? (closeNudge ?? null)
            : state === 'wrong_script'
              ? WRONG_SCRIPT_NUDGE[promptType]
              : null;

  const correctReveal = state === 'correct' ? resolveCorrectReveal(item) : null;
  const promptNode = grammarCard ? (
    promptType === 'production' ? (
      <GrammarBuildCard item={item} answered={state === 'correct'} />
    ) : (
      <GrammarReadCard item={item} answered={state === 'correct'} />
    )
  ) : (
    grammarPrompt
  );


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

      {correctReveal ? (
        <FadeSlideIn className="gap-space-md w-full items-center">
          <View
            ref={resultRef}
            accessible
            accessibilityLabel={`Correct, ${correctReveal.label.toLowerCase()}: ${correctReveal.value}`}
            className="flex-row items-center gap-space-sm">
            <Animated.View entering={reducedMotion ? undefined : CORRECT_POP}>
              <Icon name="correct" size={24} strokeWidth={2.6} className="text-feedback-correct" />
            </Animated.View>
            <Text className="text-title-lg font-ui-extrabold text-feedback-correct-deep">
              Correct
            </Text>
          </View>
          {stageTransition ? (
            <Animated.View entering={reducedMotion ? undefined : STAGE_UP_POP}>
              <SRSStageTransitionBadge transition={stageTransition} />
            </Animated.View>
          ) : null}
          {/* Shared trimmed panel on the correct path too (FR85, UX-DR8) —
              shown expanded, never gated behind an icon. */}
          <AnswerReveal item={item} detail={revealDetail ?? null} collision={answerCollision} />
          <ReinforcementHighlight link={reinforcementLink} />
        </FadeSlideIn>
      ) : null}

      {nudge ? (
        // One-line nudge only: the user hasn't been told the answer, so don't reveal detail.
        <FadeSlideIn className="items-center">
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
