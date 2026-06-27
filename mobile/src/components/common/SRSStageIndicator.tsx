import { Text } from 'react-native';

import type { SRSStageLabel } from '@/core/srs/srs.types';

type Props = {
  stage: SRSStageLabel;
};

const STAGE_LABEL: Record<SRSStageLabel, string> = {
  apprentice: 'Apprentice',
  guru: 'Guru',
  master: 'Master',
  enlightened: 'Enlightened',
  burned: 'Burned',
};

const STAGE_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'text-srs-apprentice',
  guru: 'text-srs-guru',
  master: 'text-srs-master',
  enlightened: 'text-srs-enlightened',
  burned: 'text-srs-burned',
};

export function SRSStageIndicator({ stage }: Props) {
  const label = STAGE_LABEL[stage];
  const colorClass = STAGE_CLASS[stage];

  return (
    <Text
      accessibilityLabel={`SRS stage: ${label}`}
      className={`text-overline font-semibold uppercase ${colorClass}`}>
      {label}
    </Text>
  );
}
