import { render, screen } from '@testing-library/react-native';

import type { ConfusionCluster } from '@/core/srs/srs.types';

import { WeaknessStatCard } from './WeaknessStatCard';

const fixtureCluster: ConfusionCluster = {
  id: 'te_form_vs_ta_form',
  label: 'て-form vs た-form',
  copy: 'You often confuse て-form and た-form',
  accuracy: 0.456,
  sampleSize: 23,
  itemIds: ['1', '2'],
};

describe('WeaknessStatCard', () => {
  it('renders label as headline, copy as secondary, accuracy percentage, and sample size', () => {
    render(<WeaknessStatCard cluster={fixtureCluster} />);

    expect(screen.getByText('て-form vs た-form')).toBeTruthy();
    expect(screen.getByText('You often confuse て-form and た-form')).toBeTruthy();
    expect(screen.getByText('46% accuracy')).toBeTruthy();
    expect(screen.getByText('23 attempts')).toBeTruthy();
  });

  it('uses singular attempt label for sample size of 1', () => {
    render(<WeaknessStatCard cluster={{ ...fixtureCluster, sampleSize: 1 }} />);
    expect(screen.getByText('1 attempt')).toBeTruthy();
  });

  it('announces label, accuracy, copy, and sample size in accessibilityLabel', () => {
    render(<WeaknessStatCard cluster={fixtureCluster} />);
    expect(
      screen.getByLabelText(
        'て-form vs た-form: 46% accuracy. You often confuse て-form and た-form. 23 attempts',
      ),
    ).toBeTruthy();
  });

  it('clamps accuracy above 100% to 100%', () => {
    render(<WeaknessStatCard cluster={{ ...fixtureCluster, accuracy: 1.5 }} />);
    expect(screen.getByText('100% accuracy')).toBeTruthy();
  });

  it('clamps accuracy below 0% to 0%', () => {
    render(<WeaknessStatCard cluster={{ ...fixtureCluster, accuracy: -0.1 }} />);
    expect(screen.getByText('0% accuracy')).toBeTruthy();
  });

  it('does not render a fabricated trend line', () => {
    render(<WeaknessStatCard cluster={fixtureCluster} />);
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.queryByTestId('weakness-trend-line')).toBeNull();
  });
});
