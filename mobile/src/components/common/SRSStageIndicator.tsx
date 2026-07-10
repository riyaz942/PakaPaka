import { Text } from 'react-native';

import type { SRSStageLabel, StageTransition } from '@/core/srs/srs.types';

type Props = {
  stage: SRSStageLabel;
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

const STAGE_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'text-srs-apprentice',
  guru: 'text-srs-guru',
  master: 'text-srs-master',
  enlightened: 'text-srs-enlightened',
  burned: 'text-srs-burned',
};

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
      className={`text-overline font-semibold uppercase ${colorClass}`}>
      {STAGE_LABEL[from]} → {STAGE_LABEL[to]}
      {advanced ? ' ↑' : ''}
    </Text>
  );
}

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
