import { Text, View } from 'react-native';

import { GuidanceInfoButton } from '@/components/common/GuidanceInfoButton';
import type { GuidanceCardId } from '@/components/onboarding/cardRegistry';
import type { SRSStageLabel, StageTransition } from '@/core/srs/srs.types';
import { cn } from '@/utils/cn';

type Props = {
  stage: SRSStageLabel;
  /**
   * Adds an "explain this" affordance beside the stage name. Only the review
   * card passes it — the dot and the pill sit on every Browse row and detail
   * header, where an info button would be noise.
   */
  infoCardId?: GuidanceCardId;
};

const STAGE_ORDER: Record<SRSStageLabel, number> = {
  apprentice: 0,
  guru: 1,
  master: 2,
  enlightened: 3,
  burned: 4,
};

const STAGE_LABEL: Record<SRSStageLabel, string> = {
  apprentice: 'Apprentice',
  guru: 'Guru',
  master: 'Master',
  enlightened: 'Enlightened',
  burned: 'Burned',
};

/**
 * Stage names in their own hue, using Session 4's mapping: apprentice, guru and
 * master *are* the kanji, vocabulary and radical hues, so their labels take
 * those `-deep` steps — the base hues do not clear AA for a 12px label on a
 * plain background.
 */
const STAGE_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'text-content-kanji-deep',
  guru: 'text-content-vocabulary-deep',
  master: 'text-content-radical-deep',
  enlightened: 'text-srs-enlightened-deep',
  burned: 'text-muted',
};

const STAGE_DOT_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'bg-srs-apprentice',
  guru: 'bg-srs-guru',
  master: 'bg-srs-master',
  enlightened: 'bg-srs-enlightened',
  burned: 'bg-srs-burned',
};

/**
 * Stage pills borrow each stage's content twin — apprentice is the kanji hue,
 * guru the vocabulary hue, master the radical hue (Session 4's mapping). The two
 * stages with no twin take a neutral pill rather than inventing a soft step.
 */
const STAGE_PILL_CLASS: Record<SRSStageLabel, { fill: string; text: string }> = {
  apprentice: { fill: 'bg-content-kanji-soft', text: 'text-content-kanji-deep' },
  guru: { fill: 'bg-content-vocabulary-soft', text: 'text-content-vocabulary-deep' },
  master: { fill: 'bg-content-radical-soft', text: 'text-content-radical-deep' },
  enlightened: { fill: 'bg-surface-elevated', text: 'text-srs-enlightened-deep' },
  burned: { fill: 'bg-surface-elevated', text: 'text-muted' },
};

/**
 * The stage as a header pill: stage dot plus the tracked stage name on a soft
 * fill. Used in the item-detail header bar, where the stage is a status the page
 * is *about* rather than a marker on a row.
 */
export function SRSStagePill({ stage, testID }: { stage: SRSStageLabel; testID?: string }) {
  const pill = STAGE_PILL_CLASS[stage];

  return (
    <View
      accessible
      accessibilityLabel={`SRS stage: ${STAGE_LABEL[stage]}`}
      testID={testID}
      className={cn(
        'flex-row items-center gap-space-xs rounded-radius-full px-space-sm py-[5px]',
        pill.fill,
      )}>
      <View className={cn('h-[7px] w-[7px] rounded-radius-full', STAGE_DOT_CLASS[stage])} />
      <Text className={cn('text-overline font-ui-bold uppercase tracking-[0.1em]', pill.text)}>
        {STAGE_LABEL[stage]}
      </Text>
    </View>
  );
}

/**
 * The 9px stage dot from the spec's Browse rows — the compact form of the stage,
 * where a full label would crowd the row. Colour alone never carries the meaning:
 * every dot ships an accessibility label naming the stage.
 */
export function SRSStageDot({ stage, testID }: { stage: SRSStageLabel; testID?: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`SRS stage: ${STAGE_LABEL[stage]}`}
      testID={testID}
      className={cn('h-[9px] w-[9px] rounded-radius-full', STAGE_DOT_CLASS[stage])}
    />
  );
}

/**
 * Renders a stage change on the answer reveal. An advance carries the target
 * stage's accent colour and an upward affordance; a drop stays muted — no shaming.
 */
export function SRSStageTransitionBadge({ transition }: { transition: StageTransition }) {
  const { from, to } = transition;
  const advanced = STAGE_ORDER[to] > STAGE_ORDER[from];
  const colorClass = advanced ? STAGE_CLASS[to] : 'text-secondary';
  const a11yLabel = `SRS stage ${advanced ? 'advanced' : 'moved'} from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]}`;

  return (
    <Text
      accessibilityLabel={a11yLabel}
      className={`text-overline font-ui-bold uppercase tracking-[0.08em] ${colorClass}`}>
      {STAGE_LABEL[from]} → {STAGE_LABEL[to]}
      {advanced ? ' ↑' : ''}
    </Text>
  );
}

export function SRSStageIndicator({ stage, infoCardId }: Props) {
  const label = STAGE_LABEL[stage];
  const colorClass = STAGE_CLASS[stage];

  const stageText = (
    <Text
      accessibilityLabel={`SRS stage: ${label}`}
      className={`text-overline font-ui-bold uppercase tracking-[0.08em] ${colorClass}`}>
      {label}
    </Text>
  );

  if (!infoCardId) {
    return stageText;
  }

  return (
    <View className="flex-row items-center gap-space-xs">
      {stageText}
      <GuidanceInfoButton cardId={infoCardId} />
    </View>
  );
}
