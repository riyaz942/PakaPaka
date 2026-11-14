import { render, screen } from '@testing-library/react-native';

import { goalStateLine, SessionSummaryCard, slippedLine } from './SessionSummaryCard';

// Reduced motion draws the rings and bars at their final value at once.
jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

const BASE_PROPS = {
  domainCounts: { radical: 0, kanji: 8, vocabulary: 5, grammar: 2 },
  itemsReviewed: 15,
  correctCount: 13,
};

describe('SessionSummaryCard', () => {
  it('renders a count tile per type that appeared in the session', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.getByTestId('session-count-kanji')).toHaveTextContent(/8Kanji/);
    expect(screen.getByTestId('session-count-vocabulary')).toHaveTextContent(/5Vocab/);
    expect(screen.getByTestId('session-count-grammar')).toHaveTextContent(/2Grammar/);
  });

  it('hides the tile for a type with no items and never compares to other apps', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.queryByTestId('session-count-radical')).toBeNull();
    expect(screen.queryByText(/separate apps/)).toBeNull();
  });

  it('shows first-try accuracy on a ring, counting retries as misses', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.getByTestId('session-accuracy-ring')).toBeTruthy();
    expect(screen.getByText('13 of 15 right the first time.')).toBeTruthy();
  });

  it('omits the goal card entirely when no goal percent is known', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);

    expect(screen.queryByTestId('session-goal-state')).toBeNull();
  });

  it('renders the goal contribution card with the session delta', () => {
    render(<SessionSummaryCard {...BASE_PROPS} goalPercent={130} goalDeltaPercent={18} />);

    expect(screen.getByTestId('session-goal-state')).toHaveTextContent(
      /Goal met — \+30% overshoot/,
    );
    expect(screen.getByText('+18%')).toBeTruthy();
  });

  it('notes items that slipped, without listing every one', () => {
    render(
      <SessionSummaryCard
        {...BASE_PROPS}
        slipped={[
          { itemId: '1', primaryForm: '七', from: 'guru', to: 'apprentice' },
          { itemId: '2', primaryForm: '八', from: 'guru', to: 'apprentice' },
        ]}
      />,
    );

    expect(screen.getByTestId('session-slipped-note')).toHaveTextContent(
      /七 and 1 other slipped — queued sooner next time\./,
    );
    expect(screen.queryByText(/八/)).toBeNull();
  });

  it('draws a slipped form no font covers as an outline', () => {
    render(
      <SessionSummaryCard
        {...BASE_PROPS}
        slipped={[{ itemId: '1', primaryForm: '兑', from: 'guru', to: 'apprentice' }]}
      />,
    );

    expect(screen.getByLabelText('兑')).toBeTruthy();
    expect(screen.getByTestId('session-slipped-note')).toHaveTextContent(
      /slipped — queued sooner next time\./,
    );
  });

  it('shows no slipped note when nothing dropped a stage', () => {
    render(<SessionSummaryCard {...BASE_PROPS} />);
    expect(screen.queryByTestId('session-slipped-note')).toBeNull();
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

describe('slippedLine', () => {
  it('names the first item and counts the rest', () => {
    const slip = (primaryForm: string) =>
      ({ itemId: primaryForm, primaryForm, from: 'guru', to: 'apprentice' }) as const;

    expect(slippedLine([slip('七')])).toBe('七 slipped — queued sooner next time.');
    expect(slippedLine([slip('七'), slip('八')])).toBe(
      '七 and 1 other slipped — queued sooner next time.',
    );
    expect(slippedLine([slip('七'), slip('八'), slip('九')])).toBe(
      '七 and 2 others slipped — queued sooner next time.',
    );
  });
});
