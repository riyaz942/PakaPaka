import { Text, View } from 'react-native';

import { SRSStageIndicator } from '@/components/common/SRSStageIndicator';
import type { SRSStageLabel } from '@/core/srs/srs.types';

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

const STAGE_COUNT_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'text-srs-apprentice',
  guru: 'text-srs-guru',
  master: 'text-srs-master',
  enlightened: 'text-srs-enlightened',
  burned: 'text-srs-burned',
};

export function SrsStageBreakdown({ counts }: Props) {
  return (
    <View className="gap-space-sm">
      {STAGE_ORDER.map((stage) => {
        const count = counts[stage];
        const label = STAGE_LABEL[stage];
        const countClass = STAGE_COUNT_CLASS[stage];

        return (
          <View
            key={stage}
            accessible
            accessibilityLabel={`${label}: ${count} ${count === 1 ? 'item' : 'items'}`}
            className="min-h-[44px] flex-row items-center justify-between rounded-radius-md border border-border bg-surface px-space-md py-space-sm">
            <SRSStageIndicator stage={stage} />
            <Text className={`text-body font-semibold ${countClass}`}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}
