import { render, screen } from '@testing-library/react-native';

import { ShadowModeComparison } from './ShadowModeComparison';

const BASE_PROPS = {
  domainCounts: { radical: 0, kanji: 8, vocabulary: 5, grammar: 2 },
  itemsReviewed: 15,
  correctCount: 13,
  durationMs: 12 * 60_000,
};

describe('ShadowModeComparison', () => {
  it('renders retention rate rounded, with full-context accessibility label', () => {
    render(<ShadowModeComparison {...BASE_PROPS} />);

    expect(screen.getByText('Retention: 87%')).toBeTruthy();
    expect(
      screen.getByLabelText('Retention rate: 87 percent, 13 of 15 correct'),
    ).toBeTruthy();
  });

  it('renders domain counts with full-context accessibility labels', () => {
    render(<ShadowModeComparison {...BASE_PROPS} />);

    expect(screen.getByText('Kanji 8')).toBeTruthy();
    expect(screen.getByLabelText('Kanji: 8 items reviewed')).toBeTruthy();
    expect(screen.getByText('Grammar 2')).toBeTruthy();
    expect(screen.getByText('Vocab 5')).toBeTruthy();
  });

  it('hides the radical row when count is zero', () => {
    render(<ShadowModeComparison {...BASE_PROPS} />);
    expect(screen.queryByText(/Radical/)).toBeNull();
  });

  it('shows the radical row when count is greater than zero', () => {
    render(
      <ShadowModeComparison
        {...BASE_PROPS}
        domainCounts={{ ...BASE_PROPS.domainCounts, radical: 3 }}
      />,
    );
    expect(screen.getByText('Radical 3')).toBeTruthy();
  });

  it('renders total minutes studied', () => {
    render(<ShadowModeComparison {...BASE_PROPS} />);
    expect(screen.getByText('12 min this session')).toBeTruthy();
    expect(screen.getByLabelText('12 minutes studied this session')).toBeTruthy();
  });

  it('renders the parallel-tool framing copy', () => {
    render(<ShadowModeComparison {...BASE_PROPS} />);
    expect(
      screen.getByText('Compare these with your WaniKani/Bunpro session to see the difference.'),
    ).toBeTruthy();
  });

  it('guards divide-by-zero and renders nothing when itemsReviewed is 0', () => {
    const { toJSON } = render(
      <ShadowModeComparison {...BASE_PROPS} itemsReviewed={0} correctCount={0} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('rounds retention to the nearest whole percent', () => {
    render(<ShadowModeComparison {...BASE_PROPS} itemsReviewed={3} correctCount={2} />);
    // 2/3 = 66.67% → rounds to 67
    expect(screen.getByText('Retention: 67%')).toBeTruthy();
  });
});
