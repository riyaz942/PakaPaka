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
          noProgressYet: false,
        }}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('4 items from unlocking “自己紹介”')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reading-readiness'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the calm day-1 invitation instead of a shame wall', () => {
    render(
      <ReadingReadiness
        target={{
          passageId: '1',
          title: '自己紹介',
          itemsRemainingToUnlock: 9,
          noProgressYet: true,
        }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Your first passage unlocks as you learn')).toBeTruthy();
    expect(screen.queryByText(/from unlocking/)).toBeNull();
  });
});
