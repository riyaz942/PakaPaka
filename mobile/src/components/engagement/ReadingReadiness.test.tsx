import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReadingReadiness } from './ReadingReadiness';

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

describe('ReadingReadiness', () => {
  it('frames the locked passage as a destination', () => {
    const onPress = jest.fn();
    render(
      <ReadingReadiness
        target={{
          passageId: '1',
          title: '自己紹介',
          itemsRemainingToUnlock: 4,
          coverage: 0.62,
          noProgressYet: false,
        }}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('自己紹介 is 4 items away')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reading-readiness'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fills the progress bar to the passage coverage', () => {
    render(
      <ReadingReadiness
        target={{
          passageId: '1',
          title: '自己紹介',
          itemsRemainingToUnlock: 4,
          coverage: 0.62,
          noProgressYet: false,
        }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId('reading-readiness-progress').props.style).toEqual(
      expect.objectContaining({ width: '62%' }),
    );
  });

  it('shows the calm day-1 invitation instead of a shame wall', () => {
    render(
      <ReadingReadiness
        target={{
          passageId: '1',
          title: '自己紹介',
          itemsRemainingToUnlock: 9,
          coverage: 0,
          noProgressYet: true,
        }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Your first passage unlocks as you learn')).toBeTruthy();
    expect(screen.queryByText(/items away/)).toBeNull();
  });
});
