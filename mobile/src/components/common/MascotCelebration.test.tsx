import { render, screen } from '@testing-library/react-native';

import { MascotCelebration } from './MascotCelebration';

let mockReducedMotion = false;
jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: mockReducedMotion }),
}));

describe('MascotCelebration', () => {
  it('renders Alpi with a confetti burst', () => {
    mockReducedMotion = false;
    const { toJSON } = render(<MascotCelebration pose="yay" />);

    expect(screen.getByLabelText('Alpi the alpaca cheering')).toBeTruthy();
    expect(JSON.stringify(toJSON())).toContain('bg-content-kanji');
  });

  it('shows the still pose with no confetti under reduced motion', () => {
    mockReducedMotion = true;
    const { toJSON } = render(<MascotCelebration pose="goal-achieved" />);

    expect(screen.getByLabelText('Alpi the alpaca cheering')).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toContain('bg-content-kanji');
  });
});
