import { fireEvent, render, screen } from '@testing-library/react-native';

import { SessionSummaryCard } from './SessionSummaryCard';

const BASE_PROPS = {
  domainCounts: { radical: 0, kanji: 8, vocabulary: 5, grammar: 2 },
  actualMinutes: 18,
  sessionDate: new Date('2026-06-29T12:00:00.000Z'),
};

describe('SessionSummaryCard', () => {
  it('renders domain counts', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.getByText('Kanji 8')).toBeTruthy();
    expect(screen.getByText('Grammar 2')).toBeTruthy();
    expect(screen.getByText('Vocab 5')).toBeTruthy();
  });

  it('shows minutes studied without any multi-app comparison', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.getByText('18 min studied')).toBeTruthy();
    expect(screen.queryByText(/separate apps/)).toBeNull();
    expect(screen.queryByText(/How is this calculated/)).toBeNull();
  });

  it('hides radical row when count is zero', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);
    expect(screen.queryByText(/Radical/)).toBeNull();
  });

  it('fires onShare when Share button is pressed', () => {
    const onShare = jest.fn();
    render(<SessionSummaryCard {...BASE_PROPS} onShare={onShare} />);

    fireEvent.press(screen.getByLabelText('Share session summary'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
