import { render, screen } from '@testing-library/react-native';

import { buildReviewForecast } from '@/core/engagement/reviewForecast';

import { ReviewForecast } from './ReviewForecast';

const NOW = new Date(2026, 6, 20, 12, 0, 0); // Mon 2026-07-20 local

function isoOnLocalDay(dayOffset: number): string {
  return new Date(2026, 6, 20 + dayOffset, 9).toISOString();
}

describe('ReviewForecast', () => {
  it('renders the designed empty state when nothing is scheduled (day 1)', () => {
    render(<ReviewForecast forecast={buildReviewForecast([], NOW)} />);

    expect(screen.getByTestId('review-forecast-empty')).toBeTruthy();
    expect(screen.queryByTestId('forecast-wall-note')).toBeNull();
  });

  it('renders seven day cells with counts and no wall note on a calm week', () => {
    const forecast = buildReviewForecast([isoOnLocalDay(0), isoOnLocalDay(2)], NOW);
    render(<ReviewForecast forecast={forecast} />);

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByTestId('forecast-day-2026-07-26')).toBeTruthy();
    expect(screen.queryByTestId('forecast-wall-note')).toBeNull();
  });

  it('annotates the wall day with invitation copy', () => {
    const dues = Array.from({ length: 41 }, () => isoOnLocalDay(2));
    render(<ReviewForecast forecast={buildReviewForecast(dues, NOW)} />);

    expect(screen.getByTestId('forecast-wall-note')).toHaveTextContent(
      'Wall day Wed — 41 due. Go light on lessons.',
    );
  });
});
