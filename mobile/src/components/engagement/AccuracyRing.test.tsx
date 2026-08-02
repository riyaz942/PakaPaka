import { render, screen } from '@testing-library/react-native';

import { AccuracyRing } from './AccuracyRing';

describe('AccuracyRing', () => {
  it('reports the percent as a progressbar out of 100', () => {
    render(<AccuracyRing percent={83.4} testID="ring" />);

    const ring = screen.getByTestId('ring');
    expect(ring.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 83 });
    expect(screen.getByText('83%')).toBeTruthy();
  });

  it('clamps out-of-range values instead of overshooting', () => {
    render(<AccuracyRing percent={140} testID="ring" />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('never celebrates a beaten goal — that is the goal ring alone', () => {
    render(<AccuracyRing percent={100} testID="ring" />);

    expect(screen.queryByTestId('goal-ring-halo')).toBeNull();
    expect(screen.queryByText(/Beaten/i)).toBeNull();
  });
});
