import { fireEvent, render, screen } from '@testing-library/react-native';

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

  it('shows minutes studied without a multi-app claim when no estimate is passed', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.getByText('18 min studied')).toBeTruthy();
    expect(screen.queryByTestId('time-compression-block')).toBeNull();
    expect(screen.queryByTestId('session-goal-state')).toBeNull();
  });

  it('renders the time compression centerpiece and goal state when provided', () => {
    render(
      <SessionSummaryCard {...BASE_PROPS} estimatedMinutes={42} goalPercent={130} />,
    );

    expect(screen.getByText('18 min here — ~42 min in separate apps')).toBeTruthy();
    expect(
      screen.getByText('Estimated from separate single-purpose apps — deliberately conservative.'),
    ).toBeTruthy();
    expect(screen.getByTestId('session-goal-state')).toHaveTextContent(
      'Goal met — +30% overshoot',
    );
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

describe('goalStateLine', () => {
  it('celebrates exact goal, overshoot, and calm partial progress', () => {
    expect(goalStateLine(100)).toBe('Goal met');
    expect(goalStateLine(145)).toBe('Goal met — +45% overshoot');
    expect(goalStateLine(60)).toBe("60% of today's goal");
  });
});
