import { render, screen } from '@testing-library/react-native';

import type { SRSStageLabel } from '@/core/srs/srs.types';

import { SrsStageBreakdown } from './SrsStageBreakdown';

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

describe('SrsStageBreakdown', () => {
  it('renders all five stages even when some counts are zero', () => {
    render(
      <SrsStageBreakdown
        counts={{
          apprentice: 3,
          guru: 0,
          master: 1,
          enlightened: 0,
          burned: 2,
        }}
      />,
    );

    for (const stage of STAGE_ORDER) {
      expect(screen.getByText(STAGE_LABEL[stage])).toBeTruthy();
    }
  });

  it('displays counts correctly', () => {
    render(
      <SrsStageBreakdown
        counts={{
          apprentice: 12,
          guru: 4,
          master: 0,
          enlightened: 1,
          burned: 7,
        }}
      />,
    );

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getAllByText('0')).toHaveLength(1);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('preserves canonical stage order in the rendered tree', () => {
    render(
      <SrsStageBreakdown
        counts={{
          apprentice: 1,
          guru: 2,
          master: 3,
          enlightened: 4,
          burned: 5,
        }}
      />,
    );

    const labels = STAGE_ORDER.map((stage) => screen.getByText(STAGE_LABEL[stage]));
    for (let index = 1; index < labels.length; index += 1) {
      const previous = labels[index - 1];
      const current = labels[index];
      expect(previous).toBeTruthy();
      expect(current).toBeTruthy();
    }
  });

  it('sets accessibility labels with stage name and count', () => {
    render(
      <SrsStageBreakdown
        counts={{
          apprentice: 12,
          guru: 0,
          master: 0,
          enlightened: 0,
          burned: 0,
        }}
      />,
    );

    expect(screen.getByLabelText('Apprentice: 12 items')).toBeTruthy();
    expect(screen.getByLabelText('Guru: 0 items')).toBeTruthy();
  });

  it('uses singular item label when count is 1', () => {
    render(
      <SrsStageBreakdown
        counts={{
          apprentice: 1,
          guru: 0,
          master: 0,
          enlightened: 0,
          burned: 0,
        }}
      />,
    );

    expect(screen.getByLabelText('Apprentice: 1 item')).toBeTruthy();
  });
});
