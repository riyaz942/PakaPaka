import { render, screen } from '@testing-library/react-native';

import { goalStateLine, SessionSummaryCard } from './SessionSummaryCard';

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

  it('shows minutes studied and never a multi-app comparison', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.getByText('18 min studied')).toBeTruthy();
    expect(screen.queryByText(/separate apps/)).toBeNull();
    expect(screen.queryByTestId('session-goal-state')).toBeNull();
  });

  it('renders the goal state when a goal percent is provided', () => {
    render(<SessionSummaryCard {...BASE_PROPS} goalPercent={130} />);

    expect(screen.getByText('18 min studied')).toBeTruthy();
    expect(screen.getByTestId('session-goal-state')).toHaveTextContent(
      'Goal met — +30% overshoot',
    );
  });

  it('hides radical row when count is zero', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);
    expect(screen.queryByText(/Radical/)).toBeNull();
  });

  it('offers no share action', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);
    expect(screen.queryByLabelText('Share session summary')).toBeNull();
  });
});

describe('goalStateLine', () => {
  it('celebrates exact goal, overshoot, and calm partial progress', () => {
    expect(goalStateLine(100)).toBe('Goal met');
    expect(goalStateLine(145)).toBe('Goal met — +45% overshoot');
    expect(goalStateLine(60)).toBe("60% of today's goal");
  });
});
