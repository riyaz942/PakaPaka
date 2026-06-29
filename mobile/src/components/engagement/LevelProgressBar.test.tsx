import { render, screen } from '@testing-library/react-native';

import { LevelProgressBar } from './LevelProgressBar';

const BASE_PROPS = {
  level: 'N5' as const,
  perType: {
    kanji: { started: 10, total: 32 },
    vocabulary: { started: 15, total: 41 },
    grammar: { started: 4, total: 16 },
  },
  overallPercent: 29,
};

describe('LevelProgressBar', () => {
  it('renders level label, counts, and percent', () => {
    render(<LevelProgressBar {...BASE_PROPS} />);

    expect(screen.getByText('N5 Progress')).toBeTruthy();
    expect(screen.getByText('Kanji 10/32')).toBeTruthy();
    expect(screen.getByText('Grammar 4/16')).toBeTruthy();
    expect(screen.getByText('Vocab 15/41')).toBeTruthy();
  });

  it('exposes progressbar accessibility value matching overallPercent', () => {
    render(<LevelProgressBar {...BASE_PROPS} />);

    const bar = screen.getByLabelText('N5 progress 29 percent. Kanji 10 of 32, Vocab 15 of 41, Grammar 4 of 16');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 29 });
  });
});
