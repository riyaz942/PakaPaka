import { Text, View } from 'react-native';

import { ProgressFill } from '@/components/common/ProgressFill';
import type { SRSStageLabel } from '@/core/srs/srs.types';
import { cn } from '@/utils/cn';

type Props = {
  counts: Record<SRSStageLabel, number>;
};

const STAGE_ORDER: SRSStageLabel[] = [
  'apprentice',
  'guru',
  'master',
  'enlightened',
  'burned',
];

const STAGE_LABEL: Record<SRSStageLabel, string> = {
  apprentice: 'Apprentice',
  guru: 'Guru',
  master: 'Master',
  enlightened: 'Enlightened',
  burned: 'Burned',
};

/**
 * Stage names in their own hue. Apprentice, guru and master are the kanji,
 * vocabulary and radical colours, so they take those `-deep` steps — the base
 * hues do not clear AA for a 12px label on a plain surface.
 */
const STAGE_TEXT_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'text-content-kanji-deep',
  guru: 'text-content-vocabulary-deep',
  master: 'text-content-radical-deep',
  enlightened: 'text-srs-enlightened-deep',
  burned: 'text-muted',
};

const STAGE_FILL_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'bg-srs-apprentice',
  guru: 'bg-srs-guru',
  master: 'bg-srs-master',
  enlightened: 'bg-srs-enlightened',
  burned: 'bg-srs-burned',
};

/**
 * The stage distribution as one row per stage: dot, tracked stage name, a mini
 * bar and the count. Every stage renders even at zero — an empty stage is part
 * of the picture, not an omission.
 */
export function SrsStageBreakdown({ counts }: Props) {
  // Bars are shares of the busiest stage, so the shape survives any total.
  const peak = Math.max(...STAGE_ORDER.map((stage) => counts[stage]), 1);

  return (
    <View className="gap-space-sm">
      {STAGE_ORDER.map((stage, index) => {
        const count = counts[stage];
        const label = STAGE_LABEL[stage];

        return (
          <View
            key={stage}
            accessible
            accessibilityLabel={`${label}: ${count} ${count === 1 ? 'item' : 'items'}`}
            className="min-h-[44px] flex-row items-center gap-space-sm rounded-radius-md border border-border bg-surface px-space-md py-space-sm shadow-e1">
            <View
              className={cn('h-[10px] w-[10px] rounded-radius-full', STAGE_FILL_CLASS[stage])}
            />
            <Text
              className={cn(
                'flex-1 text-caption font-ui-bold uppercase tracking-[0.1em]',
                STAGE_TEXT_CLASS[stage],
              )}>
              {label}
            </Text>
            <View className="h-[6px] w-[76px] overflow-hidden rounded-radius-full bg-surface-elevated">
              {/* Bars fill top to bottom, one after the other. */}
              <ProgressFill
                percent={Math.round((count / peak) * 100)}
                delayMs={index * 70}
                className={cn('h-full rounded-radius-full', STAGE_FILL_CLASS[stage])}
              />
            </View>
            <Text
              className={cn(
                'w-8 text-right text-body-sm font-ui-extrabold',
                count === 0 ? 'text-faint' : 'text-primary',
              )}>
              {count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
