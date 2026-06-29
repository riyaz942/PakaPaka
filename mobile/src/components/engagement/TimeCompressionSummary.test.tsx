import { fireEvent, render, screen } from '@testing-library/react-native';

import { TimeCompressionSummary } from './TimeCompressionSummary';

const BASE_PROPS = {
  domainCounts: { radical: 0, kanji: 8, vocabulary: 5, grammar: 2 },
  actualMinutes: 18,
  estimatedMinutes: 35,
  savedMinutes: 17,
  hasSavings: true,
  sessionDate: new Date('2026-06-29T12:00:00.000Z'),
};

describe('TimeCompressionSummary', () => {
  it('renders domain counts', () => {
    render(<TimeCompressionSummary {...BASE_PROPS} />);

    expect(screen.getByText('Kanji 8')).toBeTruthy();
    expect(screen.getByText('Grammar 2')).toBeTruthy();
    expect(screen.getByText('Vocab 5')).toBeTruthy();
  });

  it('shows savings line only when hasSavings is true', () => {
    const { rerender } = render(<TimeCompressionSummary {...BASE_PROPS} />);
    expect(screen.getByText('18 min ≈ ~35 min across separate apps')).toBeTruthy();

    rerender(
      <TimeCompressionSummary
        {...BASE_PROPS}
        hasSavings={false}
        savedMinutes={0}
        estimatedMinutes={18}
      />,
    );
    expect(screen.queryByText('18 min ≈ ~35 min across separate apps')).toBeNull();
    expect(screen.getByText('Nice focused session — 18 min')).toBeTruthy();
  });

  it('hides radical row when count is zero', () => {
    render(<TimeCompressionSummary {...BASE_PROPS} />);
    expect(screen.queryByText(/Radical/)).toBeNull();
  });

  it('toggles methodology disclosure', () => {
    render(<TimeCompressionSummary {...BASE_PROPS} />);

    expect(screen.queryByText(/Deliberately conservative/)).toBeNull();
    fireEvent.press(screen.getByLabelText('How is this calculated?'));
    expect(screen.getByText(/Deliberately conservative/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('How is this calculated?'));
    expect(screen.queryByText(/Deliberately conservative/)).toBeNull();
  });

  it('fires onShare when Share button is pressed', () => {
    const onShare = jest.fn();
    render(<TimeCompressionSummary {...BASE_PROPS} onShare={onShare} />);

    fireEvent.press(screen.getByLabelText('Share session summary'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
