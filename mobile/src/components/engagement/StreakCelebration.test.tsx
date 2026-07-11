import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { StreakCelebration } from './StreakCelebration';

let mockReducedMotion = false;

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: mockReducedMotion }),
}));

describe('StreakCelebration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts up from n-1 to n', () => {
    render(<StreakCelebration streakCount={3} />);

    expect(screen.getByText('2 day streak')).toBeTruthy();

    act(() => {
      jest.runAllTimers();
    });

    expect(screen.getByText('3 day streak')).toBeTruthy();
  });

  it('shows the final count immediately under reduced motion', () => {
    mockReducedMotion = true;
    render(<StreakCelebration streakCount={5} />);

    expect(screen.getByText('5 day streak')).toBeTruthy();
  });

  it('announces the streak to screen readers', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    render(<StreakCelebration streakCount={3} />);

    expect(announce).toHaveBeenCalledWith('3 day streak');
  });
});
