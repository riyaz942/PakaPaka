import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { BrowseOnlyBlockedScreen } from '@/components/tabs/BrowseOnlyBlockedScreen';
import { TabModeContext } from '@/providers/TabModeContext';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

function renderScreen() {
  const useHere = jest.fn();
  render(
    <TabModeContext.Provider value={{ browseOnly: true, useHere }}>
      <BrowseOnlyBlockedScreen />
    </TabModeContext.Provider>,
  );
  return { useHere };
}

describe('BrowseOnlyBlockedScreen', () => {
  beforeEach(() => mockReplace.mockReset());

  it('shows the exact copy', () => {
    renderScreen();
    expect(screen.getByText('Reviews and lessons run in the other tab')).toBeTruthy();
    expect(
      screen.getByText(
        'Only one tab can save your progress. This tab is for browsing. To study here, move PakaPaka to this tab.',
      ),
    ).toBeTruthy();
  });

  it('blocked screen: Use here calls useHere; Back to Browse replaces to /browse', () => {
    const { useHere } = renderScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Use here' }));
    expect(useHere).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Back to Browse' }));
    expect(mockReplace).toHaveBeenCalledWith('/browse');
  });
});
